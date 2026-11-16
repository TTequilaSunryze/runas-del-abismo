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

/** Supabase corta a quien actualiza la presencia demasiado a menudo: como mucho una vez cada PRESENCE_MS. */
const PRESENCE_MS = 4000;

class SupabaseTransport extends Base implements Transport {
  readonly kind = 'online';
  private presence: Record<string, unknown> = {};
  private joined = false;
  private ok = true;
  private tracked = '';
  private lastTrack = 0;
  private trackTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private channel: RealtimeChannel, private myId: string) {
    super();
    channel.on('broadcast', { event: 'm' }, ({ payload }) => {
      const m = payload as { e: string; p: unknown; f: string };
      if (m && typeof m.e === 'string' && m.f !== this.myId) this.dispatch(m.e, m.p, String(m.f));
    });
    channel.on('presence', { event: 'sync' }, () => this.peersChanged());
  }
  markJoined(): void {
    this.joined = true;
    this.ok = true;
    this.tracked = '';
    this.track();
  }
  /** Estado del canal tras unirse: si se cae, Supabase lo reintenta; al volver se republica la presencia. */
  status(st: string): void {
    const was = this.ok;
    if (st === 'SUBSCRIBED') this.markJoined();
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') this.ok = false;
    if (was !== this.ok) this.peersChanged();
  }
  connected(): boolean {
    return this.ok;
  }
  private track(): void {
    if (!this.joined) return;
    const json = JSON.stringify(this.presence);
    if (json === this.tracked) return;
    const wait = this.lastTrack + PRESENCE_MS - Date.now();
    if (wait > 0) {
      this.trackTimer ??= setTimeout(() => { this.trackTimer = null; this.track(); }, wait);
      return;
    }
    this.tracked = json;
    this.lastTrack = Date.now();
    void this.channel.track(this.presence);
  }
  send(event: string, payload: unknown): void {
    void this.channel.send({ type: 'broadcast', event: 'm', payload: { e: event, p: payload, f: this.myId } });
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
    if (this.trackTimer) clearTimeout(this.trackTimer);
    void supabase().removeChannel(this.channel);
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
    const channel = supabase().channel('rda-' + code, { config: { broadcast: { self: false }, presence: { key: myId } } });
    const t = new SupabaseTransport(channel, myId);
    const timer = setTimeout(() => reject(new Error('Sin respuesta del servidor')), 12000);
    let done = false;
    channel.subscribe((status) => {
      if (done) { t.status(status); return; }
      if (status === 'SUBSCRIBED') {
        done = true;
        clearTimeout(timer);
        t.markJoined();
        resolve(t);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error('No se pudo conectar a la sala'));
      }
    });
  });
}

export async function saveRun(code: string, secret: string, state: unknown): Promise<boolean> {
  try {
    const { data, error } = await supabase().rpc('save_run', { p_code: code, p_secret: secret, p_state: state });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function loadRun(code: string): Promise<unknown> {
  try {
    const { data, error } = await supabase().rpc('load_run', { p_code: code });
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
    const { data, error } = await supabase().rpc('submit_daily', { p_day: row.day, p_code: row.code, p_names: row.names, p_players: row.players, p_score: row.score, p_won: row.won, p_zone: row.zone });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function topDaily(day: string): Promise<DailyRow[] | null> {
  try {
    const { data, error } = await supabase().rpc('top_daily', { p_day: day });
    return error || !Array.isArray(data) ? null : (data as DailyRow[]);
  } catch {
    return null;
  }
}
