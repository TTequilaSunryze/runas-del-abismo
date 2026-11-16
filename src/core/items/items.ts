// Equipo: 8 ranuras, 4 rarezas. Los nombres y la temática vienen de cada zona (content/).
import { pick, rand, randInt, shuffle, type RngBox } from '../rng';

export const SLOTS = ['casco', 'capa', 'arma', 'peto', 'anillo', 'amuleto', 'botas', 'guantes'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_NAME: Record<Slot, string> = { casco: 'Casco', capa: 'Capa', arma: 'Arma', peto: 'Peto', anillo: 'Anillo', amuleto: 'Amuleto', botas: 'Botas', guantes: 'Guantes' };

export type StatKey = 'hp' | 'armor' | 'power' | 'crit' | 'ap' | 'mp' | 'initiative';
export type Stats = Partial<Record<StatKey, number>>;
export const STAT_NAME: Record<StatKey, string> = { hp: 'Vida', armor: 'Armadura', power: '% Daño', crit: '% Crítico', ap: 'PA', mp: 'PM', initiative: 'Iniciativa' };

/** 0 Común, 1 Raro, 2 Épico, 3 Legendario */
export type Rarity = 0 | 1 | 2 | 3;
export const RARITY_NAME = ['Común', 'Raro', 'Épico', 'Legendario'] as const;

export interface Item {
  slot: Slot;
  name: string;
  rarity: Rarity;
  stats: Stats;
  lore?: string;
}

/** Temática de una zona: nombres por ranura y legendarios fijos. */
export interface ItemTheme {
  names: Record<Slot, string[]>;
  suffixes: string[];
  legendaries: Item[];
}

const POOL: Record<Slot, StatKey[]> = {
  casco: ['hp', 'armor', 'initiative'],
  capa: ['hp', 'crit', 'initiative'],
  arma: ['power', 'crit', 'power'],
  peto: ['hp', 'armor', 'hp'],
  anillo: ['power', 'crit', 'ap'],
  amuleto: ['power', 'hp', 'ap'],
  botas: ['initiative', 'hp', 'mp'],
  guantes: ['crit', 'power', 'armor'],
};
const MULT = [1, 1.35, 1.75, 2.2];

function roll(box: RngBox, k: StatKey, rarity: Rarity, depth: number): number {
  const m = MULT[rarity]!;
  if (k === 'ap' || k === 'mp') return 1;
  if (k === 'armor') return Math.max(1, Math.round((1 + depth / 4) * (rarity >= 2 ? 2 : 1)));
  if (k === 'hp') return Math.round((randInt(box, 5, 8) + depth * 2) * m);
  if (k === 'power') return Math.round((randInt(box, 4, 7) + depth) * m);
  if (k === 'crit') return Math.round(randInt(box, 3, 5) * m);
  return Math.round(randInt(box, 2, 4) * m);
}

export function rollRarity(box: RngBox, depth: number, min: Rarity = 0): Rarity {
  const r = rand(box);
  const base: Rarity = r < 0.03 + depth * 0.015 ? 3 : r < 0.13 + depth * 0.035 ? 2 : r < 0.5 ? 1 : 0;
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
  const keys = [...new Set(shuffle(box, POOL[s]))].filter((k) => rarity >= 2 || (k !== 'ap' && k !== 'mp'));
  const stats: Stats = {};
  for (const k of keys.slice(0, Math.min(3, rarity + 1))) stats[k] = roll(box, k, rarity, depth);
  const name = pick(box, theme.names[s]) + (rarity > 0 ? ' ' + pick(box, theme.suffixes) : '');
  return { slot: s, name, rarity, stats };
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
  const total: Record<StatKey, number> = { hp: 0, armor: 0, power: 0, crit: 0, ap: 0, mp: 0, initiative: 0 };
  for (const s of list) if (s) for (const k of Object.keys(s) as StatKey[]) total[k] += s[k] ?? 0;
  return total;
}

export function statsText(s: Stats): string {
  return (Object.keys(s) as StatKey[]).map((k) => `${(s[k] ?? 0) > 0 ? '+' : ''}${s[k]} ${STAT_NAME[k]}`).join(' · ');
}
