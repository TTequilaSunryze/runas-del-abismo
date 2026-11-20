// Sesión de juego: el anfitrión ejecuta el motor y reparte el estado; los demás envían acciones.
import { PLAYABLE, canPickRoute } from '../core/classes/classes';
import { runAiTurn } from '../core/combat/ai';
import { cast, current, deployMove, endTurn, move, startCombat, type ActionResult } from '../core/combat/engine';
import type { ClassId, GameEvent, Pos } from '../core/state';
import { saveRun, type Peer, type Transport } from '../net/transport';
import { clearSnapshot, saveSnapshot } from './snapshot';
import { meta } from './meta';
import type { Perks } from '../content/modes';
import { pendingOf, waitingFor, type HeroSave } from './run';
import { bossInfo, chooseNode, recordEvents, finishFight, leaveNode, metaAction, newArena, newRun, resolveEvent, type MetaAction, type RunState } from './run';

export type Action = { a: 'move'; to: Pos } | { a: 'cast'; spell: string; at: Pos } | { a: 'end' } | { a: 'deploy'; to: Pos } | { a: 'deployready'; force?: boolean } | MetaAction;

export interface LobbyPlayer {
  id: string;
  name: string;
  cls: ClassId;
  routes: string[];
  host: boolean;
  perks: Perks;
  /** reservado */
  unlocked: string[];
  /** solo del anfitrión: ascensión elegida y si es el reto diario */
  asc: number;
  daily: string | null;
  /** maestría con la clase elegida */
  mastery: number;
  /** su mejor héroe del Salón (puede volver como némesis) */
  nem: unknown;
  /** tiene equipo de duelo */
  hasTeam: boolean;
  /** solo del anfitrión: modificadores elegidos y si incluye el Abismo */
  mods: string[];
  abyss: boolean;
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
  private savedAt = 0;
  private savedKey = '';
  private track = { caster: null as number | null };
  /** mi equipo de duelo, cuando el anfitrión lo pide */
  teamProvider: () => unknown[] = () => [];
  private duelWith = '';

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
      if (!m?.run || m.run.version !== 9) return;
      this.run = m.run;
      this.noteTurn();
      this.onChange(Array.isArray(m.ev) ? m.ev : []);
    });
    t.on('act', (p, from) => {
      if (this.isHost) this.apply(from, p as Action);
    });
    t.on('teamreq', (p) => {
      const m = p as { to: string };
      if (!this.isHost && m?.to === this.myId) this.t.send('team', { team: this.teamProvider() });
    });
    t.on('team', (p, from) => {
      const m = p as { team: unknown[] };
      if (!this.isHost || from !== this.duelWith || this.run || !Array.isArray(m?.team)) return;
      this.duelWith = '';
      const me = this.lobby().find((x) => x.id === this.myId), foe = this.lobby().find((x) => x.id === from);
      this.startArena(me?.name ?? 'Anfitrión', this.teamProvider(), { owner: from, name: foe?.name ?? 'Rival', team: m.team });
    });
    t.on('reset', () => {
      if (this.isHost) return;
      this.run = null;
      this.onChange([]);
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
    // en la presencia solo lo mínimo (Supabase limita su frecuencia); el resto viaja en los avisos «here»
    this.t.setPresence({ name: data.name, cls: data.cls, routes: data.routes, host: data.host });
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
        id: p.id, name: String(p.data.name).slice(0, 14), cls: (PLAYABLE.includes(p.data.cls as ClassId) ? p.data.cls : 'zorro') as ClassId,
        routes: Array.isArray(p.data.routes) ? (p.data.routes as string[]) : [], host: !!p.data.host,
        perks: (p.data.perks && typeof p.data.perks === 'object' ? p.data.perks : {}) as Perks,
        unlocked: Array.isArray(p.data.unlocked) ? (p.data.unlocked as string[]).slice(0, 20).map(String) : [],
        asc: Number(p.data.asc) || 0, daily: typeof p.data.daily === 'string' ? p.data.daily : null,
        mastery: Number(p.data.mastery) || 0, nem: p.data.nem ?? null, hasTeam: !!p.data.hasTeam,
        mods: Array.isArray(p.data.mods) ? (p.data.mods as unknown[]).slice(0, 3).map(String) : [], abyss: !!p.data.abyss,
      }))
      .sort((a, b) => Number(b.host) - Number(a.host) || a.id.localeCompare(b.id));
  }

  hostPresent(): boolean {
    return this.isHost || this.everyone().some((p) => p.data.host);
  }

  /** Mi unidad en el combate actual. */
  myUnit() {
    const c = this.run?.combat;
    if (!c) return undefined;
    // en los duelos llevo varias unidades: la que juega ahora, o la primera que siga en pie
    const cur = current(c);
    if (cur?.owner === this.myId) return cur;
    return c.units.find((u) => u.owner === this.myId && u.hp > 0) ?? c.units.find((u) => u.owner === this.myId);
  }

  isMyTurn(): boolean {
    const c = this.run?.combat;
    return !!c && current(c)?.owner === this.myId;
  }

  // ---------- anfitrión ----------
  startRun(): void {
    if (!this.isHost) return;
    const all = this.lobby().slice(0, 4);
    const players = all.filter((p) => {
      const chosen: string[] = [];
      return p.routes.length > 0 && p.routes.every((r) => canPickRoute(p.cls, chosen, r) && chosen.push(r));
    });
    if (!players.length) return;
    const host = all.find((p) => p.id === this.myId);
    this.run = newRun(this.code, (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0,
      players.map((p) => ({ owner: p.id, name: p.name, cls: p.cls, routes: p.routes, perks: p.perks, mastery: p.mastery })),
      { firstRun: meta().stats.runs === 0, asc: host?.asc ?? 0, daily: host?.daily ?? null, unlocked: players.flatMap((p) => p.unlocked), nemesis: all.map((p) => p.nem).filter(Boolean), mods: host?.mods ?? [], abyss: host?.abyss ?? false });
    this.afterChange([]);
  }

  /** Duelo 3 contra 3. Si el rival no tiene dueño, lo lleva la IA. */
  startArena(myName: string, mine: unknown[], foe: { owner: string | null; name: string; team: unknown[] }): boolean {
    if (!this.isHost) return false;
    const run = newArena(this.code, (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, { owner: this.myId, name: myName, team: mine }, foe);
    if (!run) { this.onError('Hace falta al menos un héroe en cada equipo'); return false; }
    this.run = run;
    this.afterChange([]);
    return true;
  }

  /** Reta a otro jugador de la sala: le pide su equipo y empieza el duelo en vivo. */
  challenge(id: string): void {
    if (!this.isHost || this.run) return;
    this.duelWith = id;
    this.t.send('teamreq', { to: id });
  }

  resume(run: RunState): void {
    if (!this.isHost) return;
    this.run = run;
    this.afterChange([]);
  }

  /** Al terminar: todos vuelven a la sala para jugar otra partida. */
  backToLobby(): void {
    if (!this.isHost) return;
    this.run = null;
    clearSnapshot();
    if (this.aiTimer) clearTimeout(this.aiTimer);
    for (let i = 0; i < 3; i++) setTimeout(() => this.t.send('reset', null), i * 700);
    this.onChange([]);
  }

  /** Elige un nodo del mapa. */
  choose(idx: number): void {
    if (!this.isHost || this.run?.phase !== 'map') return;
    if (this.blocked()) return;
    this.afterChange(chooseNode(this.run, idx));
  }

  /** Jugadores conectados por los que hay que esperar (botín sin elegir o sin pulsar «Listo»). */
  waiting(): HeroSave[] {
    if (!this.run) return [];
    const present = [this.myId, ...this.lobby().map((p) => p.id)];
    return waitingFor(this.run, present, this.myId);
  }

  /** El anfitrión da por listos a los que solo faltaba que pulsaran «Listo» (sin nada pendiente que elegir). */
  forceReady(): void {
    const run = this.run;
    if (!this.isHost || !run) return;
    for (const h of this.waiting()) if (!pendingOf(run, h).length) run.ready[h.owner] = run.stamp;
    this.afterChange([]);
  }

  private blocked(): boolean {
    const w = this.waiting();
    if (!w.length) return false;
    this.onError(`Esperando a: ${w.map((h) => h.name).join(', ')}`);
    return true;
  }

  /** Vuelve al mapa desde la tienda o desde un evento resuelto. */
  leaveNode(): void {
    if (!this.isHost || !this.run) return;
    if (this.blocked()) return;
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
    // fase de colocación: cada jugador mueve su héroe dentro de su zona y marca «listo»
    if (a.a === 'deploy' || a.a === 'deployready') {
      const c = run.combat;
      if (!c?.deploy || run.phase !== 'combat') return;
      const mine = c.units.find((u) => u.owner === from && u.team === 'hero' && u.hp > 0 && u.summoner === undefined);
      if (a.a === 'deploy') {
        if (!mine || !a.to) return;
        const r = deployMove(c, mine.id, { x: a.to.x | 0, y: a.to.y | 0 });
        if (!r.ok) return this.reject(from, r.reason);
        return this.afterChange(r.events);
      }
      if (!c.deploy.ready.includes(from)) c.deploy.ready.push(from);
      const owners = [...new Set(c.units.filter((u) => u.team === 'hero' && u.owner && u.hp > 0).map((u) => u.owner!))];
      const ev = (a.force && from === this.myId && this.isHost) || owners.every((o) => c.deploy!.ready.includes(o)) ? startCombat(c) : [];
      return this.afterChange(ev);
    }
    if (a.a !== 'move' && a.a !== 'cast' && a.a !== 'end') {
      if (a.a === 'room' && a.op === 'seal' && !(from === this.myId && this.isHost)) return this.reject(from, 'Solo el anfitrión puede cerrar la votación');
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
    if (this.isHost) recordEvents(run, events, this.track);
    this.broadcast(events);
    this.noteTurn();
    this.onChange(events);
    // guardado ante desconexiones: copia local en cada cambio y copia en la nube en cada sala, ronda o cada 5 s
    const key = `${run.zone}:${run.step}:${run.phase}:${run.combat?.round ?? 0}`;
    const ended = run.phase === 'won' || run.phase === 'lost';
    if (this.isHost && !run.arena) {
      if (ended) clearSnapshot();
      else saveSnapshot({ code: run.code, host: true, local: this.t.kind !== 'online', run });
      if (!ended && this.t.kind === 'online' && (key !== this.savedKey || Date.now() - this.savedAt > 5000)) {
        this.savedKey = key;
        this.savedAt = Date.now();
        void saveRun(run.code, this.secret, run);
      }
    } else if (!this.isHost && !run.arena) {
      if (ended) clearSnapshot();
      else saveSnapshot({ code: run.code, host: false, local: false });
    }
    const c = run.combat;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = null;
    if (!c || run.phase !== 'combat') return;
    if (c.over) {
      this.aiTimer = setTimeout(() => {
        finishFight(run);
        this.afterChange([]);
      }, 1600);
    } else if (current(c)?.ai) {
      this.aiTimer = setTimeout(() => this.afterChange(runAiTurn(c, bossInfo(run))), AI_DELAY);
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
