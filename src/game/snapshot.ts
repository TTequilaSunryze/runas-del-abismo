// Copia local de la partida en curso para poder volver tras una desconexión o una recarga.
import type { RunState } from './run';

const KEY = 'rda_snap';
/** Cuánto tiempo se puede volver a una partida interrumpida. */
export const SNAPSHOT_TTL = 30 * 60 * 1000;

export interface Snapshot {
  code: string;
  host: boolean;
  /** partida en solitario (sin sala en línea) */
  local: boolean;
  /** estado completo (solo el anfitrión, que es quien lleva la partida) */
  run?: RunState;
  at: number;
}

let last = 0;
let pending: Omit<Snapshot, 'at'> | null = null;

/** Guarda la partida (como mucho una vez por segundo). */
export function saveSnapshot(s: Omit<Snapshot, 'at'>): void {
  pending = s;
  const now = Date.now();
  if (now - last < 1000) { setTimeout(flush, 1000); return; }
  flush();
}

function flush(): void {
  if (!pending) return;
  last = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify({ ...pending, at: last })); } catch { /* sin almacenamiento */ }
  pending = null;
}

export function clearSnapshot(): void {
  pending = null;
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

/** La partida interrumpida, si es de hace menos de 30 minutos. */
export function readSnapshot(): Snapshot | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Snapshot | null;
    if (!s || typeof s.code !== 'string' || Date.now() - s.at > SNAPSHOT_TTL) return null;
    return s;
  } catch {
    return null;
  }
}
