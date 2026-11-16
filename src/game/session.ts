// Sesión de juego: el anfitrión ejecuta el motor y reparte el estado; los demás envían acciones.
import { canPickRoute } from '../core/classes/classes';
import { runAiTurn } from '../core/combat/ai';
import { cast, current, endTurn, move, type ActionResult } from '../core/combat/engine';
import type { ClassId, GameEvent, Pos } from '../core/state';
import { saveRun, type Peer, type Transport } from '../net/transport';
import { bossMinion, chooseNode, finishFight, leaveNode, metaAction, newRun, resolveEvent, type MetaAction, type RunState } from './run';

export type Action = { a: 'move'; to: Pos } | { a: 'cast'; spell: string; at: Pos } | { a: 'end' } | MetaAction;

export interface LobbyPlayer {
  id: string;
  name: string;
  cls: ClassId;
  routes: string[];
  host: boolean;
}

export const TURN_SECONDS = 60;
const AI_DELAY = 750;
const HEARTBEAT = 3000;
const BEACON = 2000;
const BEACON_TTL = 8000;

export class Session {
  run: RunState | null = null;
  /** se llama cuando cambia el estado; `events` trae lo ocurrido para animarlo */
  onChange: (events: GameEvent[]) => void = () => {};
  onError: (text: string) => void = () => {};
  /** cambió la lista de jugadores de la sala */
  onLobby: () => void = () => {};
  turnEndsAt = 0;
  private mine: Record<string, unknown> = {};
  private beacons = new Map<string, { data: Record<string, unknown>; at: number }>();
  private beaconTimer: ReturnType<typeof setInterval>;
  private lobbyKey = '';
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private beat: ReturnType<typeof setInterval> | null = null;
  private lastTurnKey = '';
  private savedStep = -1;

  constructor(
    readonly t: Transport,
    readonly myId: string,
    readonly code: string,
    readonly isHost: boolean,
    private secret: string,
  ) {
    t.on('sync', (p) => {
      if (this.isHost) return;
      const m = p as { run: RunState; ev: GameEvent[] };
      if (!m?.run || m.run.version !== 3) return;
      this.run = m.run;
      this.noteTurn();
      this.onChange(Array.isArray(m.ev) ? m.ev : []);
    });
    t.on('act', (p, from) => {
      if (this.isHost) this.apply(from, p as Action);
    });
    t.on('err', (p) => {
      const m = p as { to: string; text: string };
      if (m && m.to === this.myId) this.onError(String(m.text).slice(0, 80));
    });
    if (isHost) this.beat = setInterval(() => this.run && this.broadcast([]), HEARTBEAT);
    // Cada jugador se anuncia también por mensaje: la lista no depende solo de la presencia del servidor.
    t.on('here', (p, from) => {
      if (p && typeof p === 'object') this.beacons.set(from, { data: p as Record<string, unknown>, at: Date.now() });
      this.checkLobby();
    });
    t.on('bye', (_p, from) => { this.beacons.delete(from); this.checkLobby(); });
    t.onPeers(() => this.checkLobby());
    this.beaconTimer = setInterval(() => { this.t.send('here', this.mine); this.checkLobby(); }, BEACON);
  }

  /** Publica mis datos de sala (nombre, clase, rutas). */
  announce(data: Record<string, unknown>): void {
    this.mine = data;
    this.t.setPresence(data);
    this.t.send('here', data);
    this.checkLobby();
  }

  private checkLobby(): void {
    const k = JSON.stringify(this.lobby());
    if (k === this.lobbyKey) return;
    this.lobbyKey = k;
    this.onLobby();
  }

  private everyone(): Peer[] {
    const all = new Map<string, Record<string, unknown>>();
    for (const p of this.t.peers()) all.set(p.id, p.data);
    const now = Date.now();
    for (const [id, b] of this.beacons) if (now - b.at < BEACON_TTL) all.set(id, b.data);
    all.set(this.myId, this.mine);
    return [...all].map(([id, data]) => ({ id, data }));
  }

  lobby(): LobbyPlayer[] {
    return this.everyone()
      .filter((p: Peer) => typeof p.data.name === 'string')
      .map((p) => ({
        id: p.id, name: String(p.data.name).slice(0, 14), cls: p.data.cls as ClassId,
        routes: Array.isArray(p.data.routes) ? (p.data.routes as string[]) : [], host: !!p.data.host,
      }))
      .sort((a, b) => Number(b.host) - Number(a.host) || a.id.localeCompare(b.id));
  }

  hostPresent(): boolean {
    return this.isHost || this.everyone().some((p) => p.data.host);
  }

  /** Mi unidad en el combate actual. */
  myUnit() {
    return this.run?.combat?.units.find((u) => u.owner === this.myId);
  }

  isMyTurn(): boolean {
    const c = this.run?.combat;
    return !!c && current(c)?.owner === this.myId;
  }

  // ---------- anfitrión ----------
  startRun(): void {
    if (!this.isHost) return;
    const players = this.lobby().slice(0, 4).filter((p) => {
      const chosen: string[] = [];
      return p.routes.length > 0 && p.routes.every((r) => canPickRoute(p.cls, chosen, r) && chosen.push(r));
    });
    if (!players.length) return;
    this.run = newRun(this.code, (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, players.map((p) => ({ owner: p.id, name: p.name, cls: p.cls, routes: p.routes })));
    this.afterChange([]);
  }

  resume(run: RunState): void {
    if (!this.isHost) return;
    this.run = run;
    this.savedStep = run.step;
    this.afterChange([]);
  }

  /** Elige un nodo del mapa. */
  choose(idx: number): void {
    if (this.isHost && this.run?.phase === 'map') this.afterChange(chooseNode(this.run, idx));
  }

  /** Vuelve al mapa desde la tienda o desde un evento resuelto. */
  leaveNode(): void {
    if (!this.isHost || !this.run) return;
    leaveNode(this.run);
    this.afterChange([]);
  }

  /** Cierra la votación del evento con los votos que haya. */
  resolve(): void {
    if (!this.isHost || !this.run || this.run.phase !== 'event') return;
    resolveEvent(this.run, this.myId);
    this.afterChange([]);
  }

  /** El anfitrión puede pasar el turno de un jugador ausente. */
  skipTurn(): void {
    const c = this.run?.combat;
    const u = c && current(c);
    if (this.isHost && c && u && !u.ai) {
      const r = endTurn(c, u.id);
      if (r.ok) this.afterChange(r.events);
    }
  }

  private reject(to: string, text: string): void {
    if (to === this.myId) this.onError(text);
    else this.t.send('err', { to, text });
  }

  private apply(from: string, a: Action): void {
    const run = this.run;
    if (!run || !a || typeof a.a !== 'string') return;
    if (a.a !== 'move' && a.a !== 'cast' && a.a !== 'end') {
      const err = metaAction(run, from, a);
      if (err) return this.reject(from, err);
      if (run.phase === 'event' && run.event && !run.event.result && run.heroes.every((h) => run.event!.votes[h.owner] !== undefined)) resolveEvent(run, this.myId);
      this.afterChange([]);
      return;
    }
    const c = run.combat;
    if (!c || c.over) return;
    const u = current(c);
    if (!u || u.owner !== from) return;
    let r: ActionResult;
    if (a.a === 'move' && a.to) r = move(c, u.id, { x: a.to.x | 0, y: a.to.y | 0 });
    else if (a.a === 'cast' && a.at) r = cast(c, u.id, String(a.spell), { x: a.at.x | 0, y: a.at.y | 0 });
    else if (a.a === 'end') r = endTurn(c, u.id);
    else return;
    if (!r.ok) return this.reject(from, r.reason);
    this.afterChange(r.events);
  }

  private afterChange(events: GameEvent[]): void {
    const run = this.run!;
    this.broadcast(events);
    this.noteTurn();
    this.onChange(events);
    if (run.phase === 'map' && run.step !== this.savedStep) {
      this.savedStep = run.step;
      void saveRun(run.code, this.secret, run);
    }
    const c = run.combat;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = null;
    if (!c) return;
    if (c.over) {
      this.aiTimer = setTimeout(() => {
        finishFight(run);
        this.afterChange([]);
      }, 1600);
    } else if (current(c)?.ai) {
      this.aiTimer = setTimeout(() => this.afterChange(runAiTurn(c, bossMinion(run))), AI_DELAY);
    }
  }

  private broadcast(ev: GameEvent[]): void {
    if (this.run) this.t.send('sync', { run: this.run, ev });
  }

  /** Reinicia el reloj cuando cambia de quién es el turno. */
  private noteTurn(): void {
    const c = this.run?.combat;
    const u = c && !c.over ? current(c) : undefined;
    const k = c && u ? `${this.run!.step}:${c.round}:${c.turn}:${u.id}` : '';
    if (k === this.lastTurnKey) return;
    this.lastTurnKey = k;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnEndsAt = u && !u.ai ? Date.now() + TURN_SECONDS * 1000 : 0;
    if (this.isHost && c && u && !u.ai) {
      this.turnTimer = setTimeout(() => {
        if (this.run?.combat !== c || current(c)?.id !== u.id) return;
        const r = endTurn(c, u.id);
        if (r.ok) this.afterChange(r.events);
      }, TURN_SECONDS * 1000);
    }
  }

  // ---------- todos ----------
  act(a: Action): void {
    if (this.isHost) this.apply(this.myId, a);
    else this.t.send('act', a);
  }

  leave(): void {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.beat) clearInterval(this.beat);
    clearInterval(this.beaconTimer);
    this.t.send('bye', null);
    this.t.leave();
  }
}
