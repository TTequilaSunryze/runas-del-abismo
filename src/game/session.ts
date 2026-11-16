// Sesión de juego: el anfitrión ejecuta el motor y reparte el estado; los demás envían acciones.
import { runAiTurn } from '../core/combat/ai';
import { cast, current, endTurn, move, type ActionResult } from '../core/combat/engine';
import { canPickRoute } from '../core/classes/classes';
import type { ClassId, GameEvent, Pos } from '../core/state';
import { saveRun, type Peer, type Transport } from '../net/transport';
import { advance, bossMinion, finishFight, newRun, pickLoot, resolveEvent, vote, type RunState } from './run';

export type Action = { a: 'move'; to: Pos } | { a: 'cast'; spell: string; at: Pos } | { a: 'end' } | { a: 'pick'; idx: number } | { a: 'vote'; idx: number };

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
  private mine: Record<string, unknown> = {};
  private beacons = new Map<string, { data: Record<string, unknown>; at: number }>();
  private beaconTimer: ReturnType<typeof setInterval>;
  private lobbyKey = '';
  turnEndsAt = 0;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private beat: ReturnType<typeof setInterval> | null = null;
  private lastTurnKey = '';

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
      if (!m?.run || m.run.version !== 2) return;
      this.run = m.run;
      this.noteTurn();
      this.onChange(Array.isArray(m.ev) ? m.ev : []);
    });
    t.on('act', (p, from) => {
      if (this.isHost) this.apply(from, p as Action);
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
    this.nextFight();
  }

  resume(run: RunState): void {
    if (!this.isHost) return;
    this.run = run;
    this.afterChange([]);
  }

  /** Avanza desde la pantalla de botín o desde un evento ya resuelto. */
  nextFight(): void {
    const run = this.run;
    if (!this.isHost || !run) return;
    if (run.phase === 'between' || (run.phase === 'event' && run.event?.result)) this.afterChange(advance(run));
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
    if (this.isHost && c && u && !u.ai) this.afterChange(this.unwrap(endTurn(c, u.id)));
  }

  private unwrap(r: ActionResult): GameEvent[] {
    if (r.ok) return r.events;
    this.onError(r.reason);
    return [];
  }

  private apply(from: string, a: Action): void {
    const run = this.run;
    if (!run || !a) return;
    if (a.a === 'pick' && (run.phase === 'between' || run.phase === 'won')) {
      pickLoot(run, from, a.idx | 0);
      this.afterChange([]);
      return;
    }
    if (a.a === 'vote' && run.phase === 'event') {
      vote(run, from, a.idx | 0);
      if (run.event && run.heroes.every((h) => run.event!.votes[h.owner] !== undefined)) resolveEvent(run, this.myId);
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
    if (!r.ok) {
      if (from === this.myId) this.onError(r.reason);
      return;
    }
    this.afterChange(r.events);
  }

  private afterChange(events: GameEvent[]): void {
    const run = this.run!;
    this.broadcast(events);
    this.noteTurn();
    this.onChange(events);
    const c = run.combat;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = null;
    if (!c) return;
    if (c.over) {
      this.aiTimer = setTimeout(() => {
        finishFight(run);
        void saveRun(run.code, this.secret, run);
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
    const k = c && u ? `${this.run!.fight}:${c.round}:${c.turn}` : '';
    if (k === this.lastTurnKey) return;
    this.lastTurnKey = k;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnEndsAt = u && !u.ai ? Date.now() + TURN_SECONDS * 1000 : 0;
    if (this.isHost && c && u && !u.ai) {
      this.turnTimer = setTimeout(() => {
        if (this.run?.combat === c && current(c)?.id === u.id) this.afterChange(this.unwrap(endTurn(c, u.id)));
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
