// Amigos e invitaciones. Los conectados con cuenta comparten un canal de presencia: así se ve quién está en línea
// y se le puede invitar a una sala. La lista de amigos se guarda en el progreso de la cuenta (meta.friends).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { meta, saveMeta } from '../game/meta';
import { supabase } from './transport';

export interface Invite { from: string; code: string; at: number }

let channel: RealtimeChannel | null = null;
let me = '';
let room: string | null = null;
let onChange: () => void = () => {};
let onInvite: (i: Invite) => void = () => {};

export function socialHandlers(change: () => void, invite: (i: Invite) => void): void {
  onChange = change;
  onInvite = invite;
}

const track = (): void => { if (channel) void channel.track({ name: me, room }); };

/** Se conecta al canal de presencia con el nombre de cuenta. */
export function goOnline(name: string): void {
  if (channel && me === name) return;
  goOffline();
  me = name;
  try {
    channel = supabase().channel('rda-online', { config: { presence: { key: name.toLowerCase() } } });
    channel.on('presence', { event: 'sync' }, () => onChange());
    channel.on('broadcast', { event: 'invite' }, ({ payload }) => {
      const p = payload as { to?: string; from?: string; code?: string };
      if (!p || String(p.to).toLowerCase() !== me.toLowerCase() || typeof p.code !== 'string' || !/^[A-Z0-9]{4}$/.test(p.code)) return;
      // solo invitaciones de mis amigos
      if (!isFriend(String(p.from))) return;
      onInvite({ from: String(p.from).slice(0, 14), code: p.code, at: Date.now() });
    });
    channel.subscribe((st) => { if (st === 'SUBSCRIBED') track(); });
  } catch { channel = null; }
}

export function goOffline(): void {
  if (channel) { try { void supabase().removeChannel(channel); } catch { /* da igual */ } }
  channel = null;
  me = '';
}

/** Sala en la que estoy (para que mis amigos lo vean). */
export function setRoom(code: string | null): void {
  room = code;
  track();
}

export const isFriend = (name: string): boolean => meta().friends.some((f) => f.toLowerCase() === name.toLowerCase());

/** Amigos con su estado: en línea y en qué sala. */
export function friendsStatus(): Array<{ name: string; online: boolean; room: string | null }> {
  const state = (channel?.presenceState() ?? {}) as Record<string, Array<{ name?: string; room?: string | null }>>;
  return meta().friends.map((name) => {
    const p = state[name.toLowerCase()];
    const last = p?.[p.length - 1];
    return { name, online: !!last, room: last?.room ?? null };
  });
}

export async function addFriend(name: string): Promise<string | null> {
  name = name.trim();
  if (!name) return 'Escribe el nombre de cuenta de tu amigo.';
  if (name.toLowerCase() === me.toLowerCase()) return 'Ese eres tú.';
  if (isFriend(name)) return 'Ya está en tu lista.';
  try {
    const { data, error } = await supabase().rpc('account_name', { p_name: name });
    if (error) return 'No se pudo comprobar (¿has entrado con tu cuenta?).';
    if (!data) return `No existe ninguna cuenta llamada «${name}».`;
    const m = meta();
    m.friends = [...m.friends, String(data)].slice(0, 30);
    saveMeta();
    onChange();
    return null;
  } catch {
    return 'Sin conexión con el servidor.';
  }
}

export function removeFriend(name: string): void {
  const m = meta();
  m.friends = m.friends.filter((f) => f.toLowerCase() !== name.toLowerCase());
  saveMeta();
  onChange();
}

/** Invita a un amigo a mi sala. Solo le llega si él también me tiene como amigo. */
export function invite(name: string, code: string): void {
  void channel?.send({ type: 'broadcast', event: 'invite', payload: { to: name, from: me, code } });
}

export const online = (): boolean => !!channel;
