// Equilibrio para todos: como las salas, se guarda con save_run bajo un código reservado y la clave privada del
// creador, y todos lo leen con load_run. El ajuste en curso del creador (sin subir) vive en su navegador.
import { applyBalance, cleanBalance, emptyBalance, type Balance } from '../game/balance';
import { meta, saveMeta } from '../game/meta';
import { loadRun, saveRun } from './transport';

export const BALANCE_CODE = 'RDAAJUST';
const CACHE = 'rda_ajustes', DRAFT = 'rda_ajustes_borrador';

const read = (k: string): Balance | null => { try { const x = JSON.parse(localStorage.getItem(k) ?? 'null') as unknown; return x ? cleanBalance(x) : null; } catch { return null; } };
const write = (k: string, b: Balance | null): void => { try { if (b) localStorage.setItem(k, JSON.stringify(b)); else localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

let live: Balance = read(CACHE) ?? emptyBalance();
/** ¿Se está probando el borrador del creador en esta sesión? */
let testing = false;

/** El equilibrio que tienen todos los jugadores. */
export const liveBalance = (): Balance => live;
/** El borrador del creador (si no hay, una copia del que tienen todos). */
export const draftBalance = (): Balance => read(DRAFT) ?? cleanBalance(live);
export const draftPending = (): boolean => JSON.stringify({ ...draftBalance(), t: 0 }) !== JSON.stringify({ ...live, t: 0 });

/** Aplica el que toca: el borrador mientras el creador lo prueba; si no, el de todos. */
function reapply(): void { applyBalance(testing ? draftBalance() : live); }

/** Al abrir el juego: el último descargado (enseguida) y luego el de la red. */
export async function initBalance(): Promise<void> {
  reapply();
  const b = await loadRun(BALANCE_CODE);
  if (!b) return;
  live = cleanBalance(b);
  write(CACHE, live);
  reapply();
}

/** El creador cambia el borrador: se guarda y se aplica ya (para probarlo en el laboratorio). */
export function setDraft(b: Balance): void { write(DRAFT, cleanBalance(b)); testing = true; reapply(); }
/** Empieza a probar el borrador (al abrir la pantalla de equilibrio). */
export function testDraft(on: boolean): void { testing = on; reapply(); }
/** Tira el borrador: vuelve a lo que tienen todos. */
export function discardDraft(): void { write(DRAFT, null); reapply(); }

/** Sube el borrador: pasa a ser el equilibrio de todos los jugadores. */
export async function publishBalance(): Promise<string | null> {
  const m = meta();
  if (!m.roomsKey) { m.roomsKey = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); saveMeta(); }
  const next = { ...draftBalance(), t: Date.now() };
  if (JSON.stringify(next).length > 290000) return 'El ajuste es demasiado grande';
  if (!(await saveRun(BALANCE_CODE, m.roomsKey, next))) return 'No se pudo subir: sin conexión, o la clave de este dispositivo no es la de la primera subida (entra con tu cuenta para sincronizarla)';
  live = next;
  write(CACHE, live);
  write(DRAFT, null);
  reapply();
  return null;
}
