// Equipo: 8 ranuras, 4 rarezas. Los nombres y la temática vienen de cada zona (content/).
import { pick, rand, randInt, shuffle, type RngBox } from '../rng';

export const SLOTS = ['casco', 'capa', 'arma', 'peto', 'anillo', 'amuleto', 'botas', 'guantes'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_NAME: Record<Slot, string> = { casco: 'Casco', capa: 'Capa', arma: 'Arma', peto: 'Peto', anillo: 'Anillo', amuleto: 'Amuleto', botas: 'Botas', guantes: 'Guantes' };

export type StatKey = 'hp' | 'armor' | 'power' | 'crit' | 'ap' | 'mp' | 'initiative' | 'resFire' | 'resIce' | 'resPoison' | 'resShadow' | 'status' | 'tackle' | 'dodge';
export type Stats = Partial<Record<StatKey, number>>;
export const STAT_NAME: Record<StatKey, string> = { hp: 'Vida', armor: 'Armadura', power: '% Daño', crit: '% Crítico', ap: 'PA', mp: 'PM', initiative: 'Iniciativa', resFire: '% Res. fuego', resIce: '% Res. hielo', resPoison: '% Res. veneno', resShadow: '% Res. sombra', status: 'turno(s) a tus estados', tackle: 'Placaje', dodge: 'Huida' };

/** 0 Común, 1 Raro, 2 Épico, 3 Legendario */
export type Rarity = 0 | 1 | 2 | 3;
export const RARITY_NAME = ['Común', 'Raro', 'Épico', 'Legendario'] as const;

export interface Item {
  slot: Slot;
  name: string;
  rarity: Rarity;
  stats: Stats;
  lore?: string;
  /** set al que pertenece (ver sets.ts) */
  set?: string;
  /** mejoras de forja (+1 a +5) */
  lvl?: number;
}

/** Temática de una zona: nombres por ranura y legendarios fijos. */
export interface ItemTheme {
  names: Record<Slot, string[]>;
  suffixes: string[];
  legendaries: Item[];
}

const POOL: Record<Slot, StatKey[]> = {
  casco: ['hp', 'armor', 'initiative', 'resShadow', 'tackle'],
  capa: ['hp', 'crit', 'initiative', 'resIce', 'resShadow', 'dodge'],
  arma: ['power', 'crit', 'status'],
  peto: ['hp', 'armor', 'resFire', 'tackle'],
  anillo: ['power', 'crit', 'ap', 'resPoison'],
  amuleto: ['power', 'hp', 'ap', 'status', 'resFire'],
  botas: ['initiative', 'hp', 'mp', 'resIce', 'dodge'],
  guantes: ['crit', 'power', 'armor', 'resPoison', 'tackle'],
};
const MULT = [1, 1.35, 1.75, 2.2];

function roll(box: RngBox, k: StatKey, rarity: Rarity, depth: number): number {
  const m = MULT[rarity]!;
  if (k === 'ap' || k === 'mp' || k === 'status') return 1;
  if (k.startsWith('res')) return Math.round(randInt(box, 8, 13) * m);
  if (k === 'armor') return Math.max(1, Math.round((1 + depth / 4) * (rarity >= 2 ? 2 : 1)));
  if (k === 'hp') return Math.round((randInt(box, 5, 8) + depth * 2) * m);
  if (k === 'power') return Math.round((randInt(box, 4, 7) + depth) * m);
  if (k === 'crit') return Math.round(randInt(box, 3, 5) * m);
  if (k === 'tackle' || k === 'dodge') return Math.round(randInt(box, 2, 3) * m + depth / 6);
  return Math.round(randInt(box, 2, 4) * m);
}

export function rollRarity(box: RngBox, depth: number, min: Rarity = 0): Rarity {
  const r = rand(box);
  // cuanto más profundo, más probable lo raro (con techo para que lo legendario siga siendo especial)
  const leg = Math.min(0.2, 0.02 + depth * 0.007), epic = Math.min(0.55, 0.1 + depth * 0.02), rare = Math.min(0.85, 0.42 + depth * 0.015);
  const base: Rarity = r < leg ? 3 : r < leg + epic ? 2 : r < leg + epic + rare ? 1 : 0;
  return Math.max(base, min) as Rarity;
}

export function genItem(box: RngBox, theme: ItemTheme, depth: number, min: Rarity = 0, slot?: Slot): Item {
  const rarity = rollRarity(box, depth, min);
  if (rarity === 3) {
    const options = theme.legendaries.filter((l) => !slot || l.slot === slot);
    if (options.length) return structuredClone(pick(box, options));
  }
  const s = slot ?? pick(box, SLOTS);
  // PA y PM solo en épicos o mejores
  const keys = [...new Set(shuffle(box, POOL[s]))].filter((k) => rarity >= 2 || (k !== 'ap' && k !== 'mp' && k !== 'status'));
  const stats: Stats = {};
  for (const k of keys.slice(0, Math.min(3, rarity + 1))) stats[k] = roll(box, k, rarity, depth);
  const name = pick(box, theme.names[s]) + (rarity > 0 ? ' ' + pick(box, theme.suffixes) : '');
  return { slot: s, name, rarity, stats };
}

/** Pieza de un set: estadísticas normales de su ranura, al menos rara, con el nombre del set. */
export function genSetPiece(box: RngBox, theme: ItemTheme, depth: number, set: { id: string; pieces: Partial<Record<Slot, string>> }, slot: Slot): Item {
  let it = genItem(box, theme, depth, 1, slot);
  // los legendarios fijos no forman parte de sets
  for (let i = 0; i < 6 && it.rarity === 3; i++) it = genItem(box, theme, depth, 1, slot);
  if (it.rarity === 3) it.rarity = 2;
  return { slot, name: set.pieces[slot] ?? it.name, rarity: it.rarity, stats: it.stats, set: set.id };
}

/** Precio de compra en la tienda. */
export const PRICE = [30, 60, 110, 200] as const;
export const BAG_SIZE = 8;

/** Diferencia de estadísticas al cambiar `old` por `next` (solo las que cambian). */
export function statDiff(next: Stats, old: Stats | undefined): Stats {
  const out: Stats = {};
  for (const k of new Set([...Object.keys(next), ...Object.keys(old ?? {})]) as Set<StatKey>) {
    const d = (next[k] ?? 0) - (old?.[k] ?? 0);
    if (d) out[k] = d;
  }
  return out;
}

export function sumStats(list: Array<Stats | undefined>): Record<StatKey, number> {
  const total: Record<StatKey, number> = { hp: 0, armor: 0, power: 0, crit: 0, ap: 0, mp: 0, initiative: 0, resFire: 0, resIce: 0, resPoison: 0, resShadow: 0, status: 0, tackle: 0, dodge: 0 };
  for (const s of list) if (s) for (const k of Object.keys(s) as StatKey[]) total[k] += s[k] ?? 0;
  return total;
}

export function statsText(s: Stats): string {
  return (Object.keys(s) as StatKey[]).map((k) => `${(s[k] ?? 0) > 0 ? '+' : ''}${s[k]} ${STAT_NAME[k]}`).join(' · ');
}
