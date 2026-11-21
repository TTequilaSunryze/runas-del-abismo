// Contratos del Abismo · modelo persistente (sin dependencias del contenido, para que Meta pueda importarlo).
export type ContractPeriod = 'daily' | 'weekly';
/** Qué hay que hacer: derrotar enemigos, lanzar hechizos, encontrar reliquias o completar entradas del Atlas. */
export type ContractTarget = 'kill' | 'cast' | 'relic' | 'atlas';

export interface Contract {
  id: string;
  title: string;
  description: string;
  /** periodo del contrato (diario o semanal) */
  category: ContractPeriod;
  targetType: ContractTarget;
  /** kill: id de enemigo o `zone:N` · cast: id de clase · relic: `any` · atlas: categoría del Atlas (events, zones, omens) */
  targetId: string;
  requiredCount: number;
  rewardEcos: number;
  /** fin del periodo (ms, UTC) */
  expiresAt: number;
  completed: boolean;
  /** avance actual (0 … requiredCount) */
  progress: number;
  /** recompensa ya cobrada */
  claimed: boolean;
}

/** Tipos de Contratos Especiales (permanentes, sin caducidad). */
export type SpecialType = 'boss_challenge' | 'class_mastery' | 'collection_milestone' | 'narrative_lore';
/** Avance guardado de un Contrato Especial. La definición (título, requisitos, recompensa) vive en `specials.ts`. */
export interface SpecialRecord { progress: number; completed: boolean; claimed: boolean }

export interface ContractBook {
  v: 1;
  /** periodo de los contratos activos: día `YYYY-MM-DD` y semana `YYYY-MM-DD` (su lunes), en UTC */
  day: string;
  week: string;
  daily: Contract[];
  weekly: Contract[];
  /** claves de acontecimientos ya contados (deduplicación); se vacía al empezar una semana nueva */
  seen: string[];
  /** ids de contratos ya cobrados (segunda barrera contra cobros dobles) */
  paid: string[];
  /** Contratos Especiales: id → avance (opcional: las libretas anteriores no lo tienen) */
  special?: Record<string, SpecialRecord>;
}

export const SEEN_MAX = 2000;
export const PAID_MAX = 60;
export const emptyContracts = (): ContractBook => ({ v: 1, day: '', week: '', daily: [], weekly: [], seen: [], paid: [], special: {} });

const specialMap = (x: unknown): Record<string, SpecialRecord> => {
  const out: Record<string, SpecialRecord> = {};
  if (!x || typeof x !== 'object') return out;
  for (const [id, r] of Object.entries(x as Record<string, Partial<SpecialRecord>>).slice(0, 200)) {
    if (!r || typeof r !== 'object' || !id) continue;
    const progress = Number.isFinite(Number(r.progress)) ? Math.max(0, Math.min(1e6, Math.floor(Number(r.progress)))) : 0;
    out[id.slice(0, 60)] = { progress, completed: !!r.completed || !!r.claimed, claimed: !!r.claimed };
  }
  return out;
};

const num = (x: unknown, max = 1e9): number => (Number.isFinite(Number(x)) ? Math.max(0, Math.min(max, Math.floor(Number(x)))) : 0);
const str = (x: unknown, n = 120): string => (typeof x === 'string' ? x.slice(0, n) : '');
const PERIODS: ContractPeriod[] = ['daily', 'weekly'];
const TARGETS: ContractTarget[] = ['kill', 'cast', 'relic', 'atlas'];

function contract(c: Partial<Contract> | undefined): Contract | null {
  if (!c || !str(c.id) || !PERIODS.includes(c.category as ContractPeriod) || !TARGETS.includes(c.targetType as ContractTarget)) return null;
  const req = Math.max(1, num(c.requiredCount, 999)), progress = Math.min(req, num(c.progress, 999));
  return {
    id: str(c.id, 60), title: str(c.title), description: str(c.description, 200), category: c.category as ContractPeriod, targetType: c.targetType as ContractTarget,
    targetId: str(c.targetId, 40), requiredCount: req, rewardEcos: num(c.rewardEcos, 500), expiresAt: num(c.expiresAt, 1e14),
    progress, completed: !!c.completed || progress >= req, claimed: !!c.claimed,
  };
}

/** Valida lo que llega del almacenamiento o de la nube. */
export function normalizeContracts(x: unknown): ContractBook {
  const s = (x && typeof x === 'object' ? x : {}) as Partial<ContractBook>;
  const list = (l: unknown): Contract[] => (Array.isArray(l) ? l : []).map((c) => contract(c as Partial<Contract>)).filter((c): c is Contract => !!c).slice(0, 8);
  return {
    v: 1, day: str(s.day, 10), week: str(s.week, 10), daily: list(s.daily), weekly: list(s.weekly),
    seen: (Array.isArray(s.seen) ? s.seen : []).map((k) => str(k, 120)).filter(Boolean).slice(-SEEN_MAX),
    paid: (Array.isArray(s.paid) ? s.paid : []).map((k) => str(k, 60)).filter(Boolean).slice(-PAID_MAX),
    special: specialMap(s.special),
  };
}

/**
 * Une dos libretas sin dar ventaja: si los dos dispositivos están en el mismo periodo, cada contrato queda con el mayor avance
 * y cobrado si lo estaba en alguno; si no, gana el periodo más reciente. Los cobrados de ambos se conservan.
 */
export function mergeContracts(a: unknown, b: unknown): ContractBook {
  const x = normalizeContracts(a), y = normalizeContracts(b);
  const mergeList = (p: Contract[], q: Contract[], pk: string, qk: string): [Contract[], string] => {
    if (pk !== qk) return pk > qk ? [p, pk] : [q, qk];
    return [p.map((c) => { const o = q.find((d) => d.id === c.id); if (!o) return c; const progress = Math.max(c.progress, o.progress);
      return { ...c, progress, completed: c.completed || o.completed || progress >= c.requiredCount, claimed: c.claimed || o.claimed }; }), pk];
  };
  const [daily, day] = mergeList(x.daily, y.daily, x.day, y.day), [weekly, week] = mergeList(x.weekly, y.weekly, x.week, y.week);
  const paid = [...new Set([...x.paid, ...y.paid])].slice(-PAID_MAX);
  for (const c of [...daily, ...weekly]) if (paid.includes(c.id)) c.claimed = true;
  const special: Record<string, SpecialRecord> = {};
  for (const id of new Set([...Object.keys(x.special ?? {}), ...Object.keys(y.special ?? {})])) {
    const p = x.special?.[id], q = y.special?.[id];
    special[id] = { progress: Math.max(p?.progress ?? 0, q?.progress ?? 0), completed: !!(p?.completed || q?.completed), claimed: !!(p?.claimed || q?.claimed) };
  }
  return { v: 1, day, week, daily, weekly, seen: [...new Set([...x.seen, ...y.seen])].slice(-SEEN_MAX), paid, special };
}
