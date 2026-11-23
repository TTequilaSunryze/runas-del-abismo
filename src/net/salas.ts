// Salas creadas para todos los jugadores: el creador las deja en el guardado de partidas (save_run) bajo un código
// reservado y con una clave que solo está en su progreso; cualquiera las lee (load_run). No cambia nada de Supabase.
import { cleanRoom, type RoomDef } from '../game/salas';
import { meta, saveMeta } from '../game/meta';
import { loadRun, saveRun } from './transport';

/** Código reservado (8 letras: las salas de juego usan 4). */
export const ROOMS_CODE = 'RDASALAS';
const CACHE = 'rda_salas_global';

interface Board { v: 1; t: number; rooms: RoomDef[] }
let board: Board | null = null;
try { const raw = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as Board | null; if (raw?.v === 1) board = raw; } catch { /* sin caché */ }

const clean = (b: unknown): Board | null => {
  const x = b as Partial<Board> | null;
  if (!x || x.v !== 1 || !Array.isArray(x.rooms)) return null;
  return { v: 1, t: Number(x.t) || 0, rooms: x.rooms.map(cleanRoom).filter((r): r is RoomDef => !!r).map((r) => ({ ...r, published: true })) };
};

/** Salas para todos (las últimas descargadas). */
export const globalRooms = (): RoomDef[] => board?.rooms ?? [];
/** Cuándo se subieron por última vez (ms) o 0. */
export const globalStamp = (): number => board?.t ?? 0;

/** Descarga las salas para todos (al abrir el juego). */
export async function fetchGlobalRooms(): Promise<void> {
  const b = clean(await loadRun(ROOMS_CODE));
  if (!b) return;
  board = b;
  try { localStorage.setItem(CACHE, JSON.stringify(b)); } catch { /* sin almacenamiento */ }
}

/** El creador sube sus salas publicadas: pasan a ser las de todos (las que no estén, dejan de salir). */
export async function publishRooms(rooms: RoomDef[]): Promise<string | null> {
  const m = meta();
  if (!m.roomsKey) { m.roomsKey = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); saveMeta(); }
  const next: Board = { v: 1, t: Date.now(), rooms: rooms.map((r) => ({ ...r, published: true })) };
  if (JSON.stringify(next).length > 290000) return 'Demasiadas salas para subirlas de una vez (quita alguna)';
  const ok = await saveRun(ROOMS_CODE, m.roomsKey, next);
  if (!ok) return 'No se pudo subir: sin conexión, o la clave de este dispositivo no es la que se usó la primera vez (entra con tu cuenta para sincronizarla)';
  board = next;
  try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
  return null;
}
