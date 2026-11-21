// Transporte de sala: mensajes entre jugadores y lista de presentes.
// Dos implementaciones: Supabase Realtime (online) y BroadcastChannel (pestañas del mismo navegador, para pruebas).
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export interface Peer {
  id: string;
  data: Record<string, unknown>;
}

type Handler = (payload: unknown, from: string) => void;

export interface Transport {
  readonly kind: 'online' | 'local';
  send(event: string, payload: unknown): void;
  on(event: string, cb: Handler): void;
  setPresence(data: Record<string, unknown>): void;
  peers(): Peer[];
  onPeers(cb: () => void): void;
  leave(): void;
  /** false mientras la conexión con la sala está caída (se reintenta sola) */
  connected(): boolean;
  /** al recuperar la conexión tras una caída */
  onReconnect?(cb: () => void): void;
}

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rda_auth' } });
  return client;
}

abstract class Base {
  protected handlers = new Map<string, Handler[]>();
  protected peerCbs: Array<() => void> = [];
  on(event: string, cb: Handler): void {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb]);
  }
  onPeers(cb: () => void): void {
    this.peerCbs.push(cb);
  }
  protected dispatch(event: string, payload: unknown, from: string): void {
    for (const h of this.handlers.get(event) ?? []) h(payload, from);
  }
  protected peersChanged(): void {
    for (const cb of this.peerCbs) cb();
  }
}

/** Supabase limita la presencia (5 llamadas cada 30 s por cliente): como mucho una vez cada PRESENCE_MS. */
const PRESENCE_MS = 7000;
/** Si el canal no vuelve solo en este tiempo, se rehace desde cero. */
const REBUILD_MS = 4000;

/**
 * Cliente solo para las salas de juego: usa la clave pública y NUNCA la sesión de la cuenta.
 * Con la sesión, el servidor cerraba el canal al caducar el token (cada hora) y la partida se caía.
 * Los latidos van en un worker para que no se paren con la pestaña en segundo plano.
 */
let roomClient: SupabaseClient | null = null;
function rtClient(): SupabaseClient {
  roomClient ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'rda_rt' },
    realtime: { worker: typeof Worker !== 'undefined', heartbeatIntervalMs: 15000, reconnectAfterMs: (n: number) => [500, 1000, 2000, 4000][n - 1] ?? 5000 },
  });
  return roomClient;
}

class SupabaseTransport extends Base implements Transport {
  readonly kind = 'online';
  private presence: Record<string, unknown> = {};
  private joined = false;
  private ok = true;
  private tracked = '';
  private lastTrack = 0;
  private trackTimer: ReturnType<typeof setTimeout> | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private left = false;
  /** mensajes importantes enviados sin conexión: se mandan al volver */
  private queue: Array<{ e: string; p: unknown }> = [];
  private channel!: RealtimeChannel;
  private reconnectCbs: Array<() => void> = [];
  constructor(private code: string, private myId: string) {
    super();
    this.channel = this.makeChannel();
    const wake = (): void => { if (!this.left && !this.isJoined()) this.rebuild(); };
    addEventListener('online', wake);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  }
  private makeChannel(): RealtimeChannel {
    const ch = rtClient().channel('rda-' + this.code, { config: { broadcast: { self: false }, presence: { key: this.myId } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      const m = payload as { e: string; p: unknown; f: string };
      if (m && typeof m.e === 'string' && m.f !== this.myId) this.dispatch(m.e, m.p, String(m.f));
    });
    ch.on('presence', { event: 'sync' }, () => this.peersChanged());
    return ch;
  }
  /** Se suscribe al canal; `first` resuelve la primera vez que entra. */
  subscribe(first?: (ok: boolean) => void): void {
    const ch = this.channel;
    let done = false;
    ch.subscribe((st) => {
      if (ch !== this.channel) return;
      if (!done && first) {
        if (st === 'SUBSCRIBED') { done = true; first(true); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { done = true; first(false); return; }
      }
      this.status(st);
    });
  }
  private isJoined(): boolean {
    return this.channel.state === 'joined';
  }
  onReconnect(cb: () => void): void {
    this.reconnectCbs.push(cb);
  }
  /** Rehace el canal desde cero (si el servidor lo cerró, supabase no siempre vuelve solo). */
  private rebuild(): void {
    if (this.left) return;
    if (this.rebuildTimer) { clearTimeout(this.rebuildTimer); this.rebuildTimer = null; }
    const old = this.channel;
    this.channel = this.makeChannel();
    this.joined = false;
    void rtClient().removeChannel(old).catch(() => undefined);
    this.subscribe();
  }
  markJoined(): void {
    const again = this.joined || !this.ok;
    this.joined = true;
    this.ok = true;
    this.tracked = '';
    this.track();
    // lo que no se pudo enviar sin conexión
    const q = this.queue.splice(0);
    for (const m of q) this.send(m.e, m.p);
    if (again) for (const cb of this.reconnectCbs) cb();
  }
  /** Estado del canal: si se cae, se reintenta; si no vuelve en unos segundos, se rehace el canal entero. */
  status(st: string): void {
    const was = this.ok;
    if (st === 'SUBSCRIBED') {
      if (this.rebuildTimer) { clearTimeout(this.rebuildTimer); this.rebuildTimer = null; }
      this.markJoined();
    } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
      this.ok = false;
      if (!this.left && !this.rebuildTimer) this.rebuildTimer = setTimeout(() => { this.rebuildTimer = null; if (!this.isJoined()) this.rebuild(); }, st === 'CLOSED' ? 500 : REBUILD_MS);
    }
    if (was !== this.ok) this.peersChanged();
  }
  connected(): boolean {
    return this.ok;
  }
  private track(): void {
    if (!this.joined || !this.isJoined()) return;
    const json = JSON.stringify(this.presence);
    if (json === this.tracked) return;
    const wait = this.lastTrack + PRESENCE_MS - Date.now();
    if (wait > 0) {
      this.trackTimer ??= setTimeout(() => { this.trackTimer = null; this.track(); }, wait);
      return;
    }
    this.tracked = json;
    this.lastTrack = Date.now();
    void this.channel.track(this.presence).catch(() => undefined);
  }
  send(event: string, payload: unknown): void {
    // sin conexión no se envía (si no, supabase lo intenta por HTTP y falla): las acciones esperan, el estado se reenvía al volver
    if (!this.isJoined()) {
      if (event === 'act' || event === 'err' || event === 'team' || event === 'teamreq') { this.queue.push({ e: event, p: payload }); this.queue.splice(0, Math.max(0, this.queue.length - 20)); }
      return;
    }
    void this.channel.send({ type: 'broadcast', event: 'm', payload: { e: event, p: payload, f: this.myId } }).catch(() => undefined);
  }
  setPresence(data: Record<string, unknown>): void {
    this.presence = data;
    this.track();
  }
  peers(): Peer[] {
    const state = this.channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
    return Object.entries(state).map(([id, metas]) => ({ id, data: metas[metas.length - 1] ?? {} }));
  }
  leave(): void {
    this.left = true;
    if (this.trackTimer) clearTimeout(this.trackTimer);
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    void rtClient().removeChannel(this.channel).catch(() => undefined);
  }
}

class LocalTransport extends Base implements Transport {
  readonly kind = 'local';
  private bc: BroadcastChannel;
  private others = new Map<string, Record<string, unknown>>();
  private presence: Record<string, unknown> = {};
  constructor(room: string, private myId: string) {
    super();
    this.bc = new BroadcastChannel('rda-' + room);
    this.bc.onmessage = (ev) => {
      const m = ev.data as { k: string; f: string; e?: string; p?: unknown; d?: Record<string, unknown> };
      if (m.f === this.myId) return;
      if (m.k === 'msg') this.dispatch(m.e!, m.p, m.f);
      else if (m.k === 'pres') { this.others.set(m.f, m.d!); this.peersChanged(); }
      else if (m.k === 'hello') this.bc.postMessage({ k: 'pres', f: this.myId, d: this.presence });
      else if (m.k === 'bye') { this.others.delete(m.f); this.peersChanged(); }
    };
    this.bc.postMessage({ k: 'hello', f: myId });
    addEventListener('pagehide', () => this.bc.postMessage({ k: 'bye', f: myId }));
  }
  send(event: string, payload: unknown): void {
    this.bc.postMessage({ k: 'msg', f: this.myId, e: event, p: JSON.parse(JSON.stringify(payload)) });
  }
  setPresence(data: Record<string, unknown>): void {
    this.presence = data;
    this.bc.postMessage({ k: 'pres', f: this.myId, d: data });
    this.peersChanged();
  }
  peers(): Peer[] {
    return [{ id: this.myId, data: this.presence }, ...[...this.others].map(([id, data]) => ({ id, data }))];
  }
  connected(): boolean {
    return true;
  }
  leave(): void {
    this.bc.postMessage({ k: 'bye', f: this.myId });
    this.bc.close();
  }
}

/** Entra en la sala. `local` usa solo este navegador (un jugador o pruebas entre pestañas). */
export function joinRoom(code: string, myId: string, local: boolean): Promise<Transport> {
  if (local) return Promise.resolve(new LocalTransport(code, myId));
  return new Promise((resolve, reject) => {
    const t = new SupabaseTransport(code, myId);
    const timer = setTimeout(() => { t.leave(); reject(new Error('Sin respuesta del servidor')); }, 12000);
    t.subscribe((ok) => {
      clearTimeout(timer);
      if (ok) resolve(t);
      else { t.leave(); reject(new Error('No se pudo conectar a la sala')); }
    });
  });
}

export async function saveRun(code: string, secret: string, state: unknown): Promise<boolean> {
  try {
    const { data, error } = await rtClient().rpc('save_run', { p_code: code, p_secret: secret, p_state: state });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function loadRun(code: string): Promise<unknown> {
  try {
    const { data, error } = await rtClient().rpc('load_run', { p_code: code });
    return error ? null : data;
  } catch {
    return null;
  }
}

export interface DailyRow {
  names: string;
  players: number;
  score: number;
  won: boolean;
  zone: number;
}

export async function submitDaily(row: DailyRow & { day: string; code: string }): Promise<boolean> {
  try {
    const { data, error } = await rtClient().rpc('submit_daily', { p_day: row.day, p_code: row.code, p_names: row.names, p_players: row.players, p_score: row.score, p_won: row.won, p_zone: row.zone });
    if (error) console.warn('[reto diario] submit_daily falló:', error.message);
    else if (data !== true) console.warn('[reto diario] submit_daily rechazó la puntuación (fecha fuera de rango)');
    return !error && data === true;
  } catch (e) {
    console.warn('[reto diario] submit_daily no se pudo enviar:', e);
    return false;
  }
}

export async function topDaily(day: string): Promise<DailyRow[] | null> {
  try {
    const { data, error } = await rtClient().rpc('top_daily', { p_day: day });
    return error || !Array.isArray(data) ? null : (data as DailyRow[]);
  } catch {
    return null;
  }
}
