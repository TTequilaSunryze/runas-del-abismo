// Contratos del Abismo: objetivos diarios y semanales generados por fecha UTC a partir del contenido del Archivo.
// Progreso automático (idempotente) y cobro de ecos una sola vez por contrato.
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import { seedFrom, pick, randInt, shuffle, type RngBox } from '../core/rng';
import { ZONES } from '../content/zones';
import { BESTIARY, beastDef } from './archive';
import { ATLAS_NAME } from './atlas';
import { PAID_MAX, SEEN_MAX, emptyContracts, type Contract, type ContractBook, type ContractPeriod, type ContractTarget } from './contractsData';
import type { Meta } from './meta';

export { type Contract, type ContractBook } from './contractsData';

/** Recompensas: deliberadamente modestas frente a los ecos de una partida (una derrota en la zona 1 da ~16; una victoria, ~270). */
export const REWARD: Record<ContractPeriod, number> = { daily: 10, weekly: 30 };
export const DAILY_COUNT = 3;
export const WEEKLY_COUNT = 3;
const DAY_MS = 86_400_000;

// ---------- periodos UTC ----------
export const dayKey = (now: number): string => new Date(now).toISOString().slice(0, 10);
/** Lunes (UTC) de la semana de `now`. */
export const weekKey = (now: number): string => { const d = new Date(Math.floor(now / DAY_MS) * DAY_MS); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return dayKey(d.getTime()); };
const endOf = (key: string, days: number): number => Date.parse(`${key}T00:00:00Z`) + days * DAY_MS;

// ---------- plantillas (todo sale del contenido del juego) ----------
const zoneName = (n: number): string => ZONES[n - 1]?.name ?? `zona ${n}`;
/** Enemigos que aparecen en cualquier sala de la zona (primera lista de encuentros): siempre alcanzables. */
const commonOf = (zone: number): string[] => (ZONES[zone - 1]?.pools[0] ?? []).filter((id) => BESTIARY.some((b) => b.id === id));

type Draft = Omit<Contract, 'id' | 'category' | 'rewardEcos' | 'expiresAt' | 'completed' | 'progress' | 'claimed'>;
const kill = (id: string, n: number): Draft => ({ title: `Caza: ${beastDef(id)?.name ?? id}`, description: `Derrota ${n} × ${beastDef(id)?.name ?? id}.`, targetType: 'kill', targetId: id, requiredCount: n });
const killZone = (z: number, n: number): Draft => ({ title: `Purga de ${zoneName(z)}`, description: `Derrota ${n} enemigos en ${zoneName(z)}.`, targetType: 'kill', targetId: `zone:${z}`, requiredCount: n });
const cast = (cls: string, n: number): Draft => ({ title: `Práctica: ${CLASSES[cls as keyof typeof CLASSES].name}`, description: `Lanza ${n} hechizos con ${CLASSES[cls as keyof typeof CLASSES].name}.`, targetType: 'cast', targetId: cls, requiredCount: n });
const relic = (n: number): Draft => ({ title: 'Buscarreliquias', description: `Consigue ${n} reliquia${n > 1 ? 's' : ''} en tus partidas.`, targetType: 'relic', targetId: 'any', requiredCount: n });
const ATLAS_DO: Record<string, (n: number) => string> = {
  events: (n) => `Resuelve ${n} evento${n > 1 ? 's' : ''} de grupo.`, zones: (n) => `Derrota a ${n} jefe${n > 1 ? 's' : ''} de zona.`, omens: (n) => `Gana ${n} combate${n > 1 ? 's' : ''} bajo un presagio.`,
};
const atlas = (cat: 'events' | 'zones' | 'omens', n: number): Draft => ({ title: `Atlas: ${ATLAS_NAME[cat]}`, description: ATLAS_DO[cat]!(n), targetType: 'atlas', targetId: cat, requiredCount: n });

function drafts(period: ContractPeriod, box: RngBox): Draft[] {
  const cls = pick(box, PLAYABLE);
  if (period === 'daily') {
    const opts: Draft[] = [kill(pick(box, commonOf(1)), randInt(box, 3, 5)), cast(cls, randInt(box, 10, 15)), atlas('events', 1), relic(1), atlas('omens', 1)];
    return [opts[0]!, opts[1]!, ...shuffle(box, opts.slice(2)).slice(0, DAILY_COUNT - 2)];
  }
  const opts: Draft[] = [killZone(randInt(box, 1, 2), randInt(box, 20, 30)), kill(pick(box, commonOf(2)), randInt(box, 6, 10)), cast(cls, randInt(box, 40, 60)), atlas('zones', 2), relic(3), atlas('events', 3)];
  return [opts[0]!, ...shuffle(box, opts.slice(1)).slice(0, WEEKLY_COUNT - 1)];
}

/** Contratos de un periodo: los mismos para todo el mundo ese día o esa semana (semilla = fecha UTC). */
export function generateContracts(period: ContractPeriod, key: string): Contract[] {
  const box: RngBox = { rng: seedFrom(`contratos:${period}:${key}`) };
  const expiresAt = endOf(key, period === 'daily' ? 1 : 7);
  return drafts(period, box).map((d, i) => ({ ...d, id: `${period === 'daily' ? 'd' : 'w'}:${key}:${i}`, category: period, rewardEcos: REWARD[period], expiresAt, completed: false, progress: 0, claimed: false }));
}

const book = (meta: Pick<Meta, 'contracts'>): ContractBook => (meta.contracts ??= emptyContracts());

/** Renueva los contratos cuyo periodo ha terminado (los no cobrados de un periodo pasado se pierden). Devuelve true si cambió algo. */
export function refreshContracts(meta: Pick<Meta, 'contracts'>, now = Date.now()): boolean {
  const b = book(meta), d = dayKey(now), w = weekKey(now);
  let changed = false;
  if (b.day !== d) { b.day = d; b.daily = generateContracts('daily', d); changed = true; }
  if (b.week !== w) { b.week = w; b.weekly = generateContracts('weekly', w); b.seen = []; changed = true; }
  return changed;
}

export const activeContracts = (meta: Pick<Meta, 'contracts'>, now = Date.now()): Contract[] => { refreshContracts(meta, now); return [...book(meta).daily, ...book(meta).weekly]; };

/** Un acontecimiento de la partida que puede hacer avanzar contratos. `key` lo identifica: con la misma clave no se cuenta dos veces. */
export type ContractEvent =
  | { t: 'kill'; enemy: string; zone: number; key: string }
  | { t: 'cast'; cls: string; key: string }
  | { t: 'relic'; key: string }
  | { t: 'atlas'; cat: string; key: string };

const matches = (c: Contract, e: ContractEvent): boolean => {
  if (c.targetType !== (e.t as ContractTarget)) return false;
  if (e.t === 'kill') return c.targetId === e.enemy || c.targetId === `zone:${e.zone}`;
  if (e.t === 'cast') return c.targetId === e.cls;
  if (e.t === 'atlas') return c.targetId === e.cat;
  return true;
};

/** Suma el acontecimiento a los contratos activos que encajen. Silencioso e idempotente. Devuelve true si avanzó alguno. */
export function trackContract(meta: Pick<Meta, 'contracts'>, e: ContractEvent, now = Date.now()): boolean {
  refreshContracts(meta, now);
  const b = book(meta);
  if (b.seen.includes(e.key)) return false;
  let changed = false;
  for (const c of [...b.daily, ...b.weekly]) {
    if (c.completed || now >= c.expiresAt || !matches(c, e)) continue;
    c.progress = Math.min(c.requiredCount, c.progress + 1);
    if (c.progress >= c.requiredCount) c.completed = true;
    changed = true;
  }
  if (changed) { b.seen.push(e.key); if (b.seen.length > SEEN_MAX) b.seen.splice(0, b.seen.length - SEEN_MAX); }
  return changed;
}

/**
 * Cobra la recompensa de un contrato completado. Solo acredita ecos una vez: exige que esté completado, no caducado,
 * no cobrado y que su id no figure entre los ya pagados. Devuelve los ecos acreditados (0 si no procede).
 */
export function claimContractReward(meta: Pick<Meta, 'contracts' | 'ecos'>, contractId: string, now = Date.now()): number {
  refreshContracts(meta, now);
  const b = book(meta), c = [...b.daily, ...b.weekly].find((x) => x.id === contractId);
  if (!c || !c.completed || c.claimed || now >= c.expiresAt || b.paid.includes(c.id)) return 0;
  c.claimed = true;
  b.paid = [...b.paid, c.id].slice(-PAID_MAX);
  meta.ecos += c.rewardEcos;
  return c.rewardEcos;
}
