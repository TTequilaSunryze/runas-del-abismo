// Testers del creador: la lista (huellas SHA-256 de los emails, nunca los emails) se guarda como las salas y el
// equilibrio: save_run con código reservado y la clave privada del creador; todos la leen con load_run.
import { emailHash, meta, saveMeta, setTesterList, type Tester } from '../game/meta';
import { loadRun, saveRun } from './transport';

export const TESTERS_CODE = 'RDATESTR';
const CACHE = 'rda_testers';

try { const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { list?: Record<string, boolean> } | null; if (c?.list) setTesterList(c.list); } catch { /* sin caché */ }

/** Al abrir el juego: la lista publicada. */
export async function fetchTesters(): Promise<void> {
  const b = (await loadRun(TESTERS_CODE)) as { v?: number; list?: Record<string, boolean> } | null;
  if (!b || b.v !== 1 || !b.list) return;
  const list: Record<string, boolean> = {};
  for (const [h, r] of Object.entries(b.list)) if (/^[0-9a-f]{64}$/.test(h)) list[h] = !!r;
  setTesterList(list);
  try { localStorage.setItem(CACHE, JSON.stringify({ list })); } catch { /* sin almacenamiento */ }
}

const cleanEmail = (e: string): string => e.trim().toLowerCase();
export const validEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(e));

/** El creador cambia la lista: se guarda en su progreso y se publica al momento. */
export async function saveTesters(list: Tester[]): Promise<string | null> {
  const m = meta();
  const seen = new Set<string>();
  m.testers = list.map((x) => ({ email: cleanEmail(x.email), rooms: !!x.rooms })).filter((x) => validEmail(x.email) && !seen.has(x.email) && seen.add(x.email)).slice(0, 100);
  if (!m.roomsKey) m.roomsKey = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  saveMeta();
  const pub: Record<string, boolean> = {};
  for (const x of m.testers) pub[await emailHash(x.email)] = x.rooms;
  if (!(await saveRun(TESTERS_CODE, m.roomsKey, { v: 1, t: Date.now(), list: pub }))) return 'Guardado en tu cuenta, pero no se pudo publicar (sin conexión o clave distinta: entra con tu cuenta en este dispositivo)';
  setTesterList(pub);
  try { localStorage.setItem(CACHE, JSON.stringify({ list: pub })); } catch { /* sin almacenamiento */ }
  return null;
}
