// Equipo: 8 ranuras, 4 rarezas. Los nombres y la temática vienen de cada zona (content/).
import { FEATURES } from '../tuning';
import { pick, rand, randInt, shuffle, type RngBox } from '../rng';

export const SLOTS = ['casco', 'capa', 'arma', 'peto', 'anillo', 'amuleto', 'botas', 'guantes'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_NAME: Record<Slot, string> = { casco: 'Casco', capa: 'Capa', arma: 'Arma', peto: 'Peto', anillo: 'Anillo', amuleto: 'Amuleto', botas: 'Botas', guantes: 'Guantes' };

export type StatKey = 'hp' | 'armor' | 'power' | 'powerPhys' | 'powerMagic' | 'crit' | 'ap' | 'mp' | 'initiative' | 'resFire' | 'resIce' | 'resPoison' | 'resShadow' | 'status' | 'tackle' | 'dodge';
export type Stats = Partial<Record<StatKey, number>>;
export const STAT_NAME: Record<StatKey, string> = { hp: 'Vida', armor: 'Armadura', power: '% Daño (físico y mágico)', powerPhys: '% Daño físico', powerMagic: '% Daño mágico', crit: '% Crítico', ap: 'PA', mp: 'PM', initiative: 'Iniciativa', resFire: '% Res. fuego', resIce: '% Res. hielo', resPoison: '% Res. veneno', resShadow: '% Res. sombra', status: 'turno(s) a tus estados', tackle: 'Placaje', dodge: 'Huida' };

/** 0 Common, 1 Uncommon, 2 Rare, 3 Legendary */
export type Rarity = 0 | 1 | 2 | 3;
export const RARITY_NAME = ['Common', 'Uncommon', 'Rare', 'Legendary'] as const;
export const RARITY_COLOR = ['#FFFFFF', '#3B82F6', '#F97316', '#EF4444'] as const;

/** Un afijo de un objeto: prefijo o sufijo que da una estadística. */
export interface Affix {
  kind: 'prefix' | 'suffix';
  id: string;
  name: string;
  stat: StatKey;
  value: number;
}

export interface Item {
  slot: Slot;
  name: string;
  rarity: Rarity;
  /** suma de los afijos (es lo que cuenta en combate) */
  stats: Stats;
  affixes?: Affix[];
  lore?: string;
}

/** Temática de una zona: nombres por ranura y legendarios con nombre propio. */
export interface ItemTheme {
  names: Record<Slot, string[]>;
  suffixes: string[];
  legendaries: Item[];
}

/** Estadísticas que puede dar cada ranura. */
const POOL: Record<Slot, StatKey[]> = {
  casco: ['hp', 'tackle', 'armor', 'initiative', 'crit', 'resFire', 'resIce', 'resPoison', 'resShadow'],
  capa: ['hp', 'dodge', 'crit', 'mp', 'initiative', 'resIce', 'resShadow'],
  arma: ['powerPhys', 'powerMagic', 'crit', 'ap', 'power'],
  peto: ['hp', 'tackle', 'dodge', 'armor', 'initiative', 'resFire', 'resPoison'],
  anillo: ['powerPhys', 'powerMagic', 'crit', 'ap', 'hp', 'resPoison'],
  amuleto: ['powerMagic', 'powerPhys', 'hp', 'ap', 'power', 'resFire', 'resShadow'],
  botas: ['mp', 'dodge', 'hp', 'tackle', 'initiative', 'resIce'],
  guantes: ['crit', 'powerPhys', 'powerMagic', 'tackle', 'ap', 'resPoison'],
};

/** Nombre de cada estadística como prefijo y como sufijo. */
export const AFFIX_NAMES: Record<StatKey, { prefix: string; suffix: string }> = {
  hp: { prefix: 'Vital', suffix: 'del Oso' },
  powerPhys: { prefix: 'Brutal', suffix: 'de la Carnicería' },
  powerMagic: { prefix: 'Sobrenatural', suffix: 'del Arcano' },
  crit: { prefix: 'Letal', suffix: 'del Cazador' },
  ap: { prefix: 'Incansable', suffix: 'de la Presteza' },
  mp: { prefix: 'Veloz', suffix: 'del Viento' },
  resFire: { prefix: 'Ardiente', suffix: 'de la Ceniza' },
  resIce: { prefix: 'Glacial', suffix: 'del Deshielo' },
  resPoison: { prefix: 'Antitóxico', suffix: 'de la Triaca' },
  resShadow: { prefix: 'Luminoso', suffix: 'de la Vigilia' },
  tackle: { prefix: 'Implacable', suffix: 'del Sabueso' },
  dodge: { prefix: 'Fugaz', suffix: 'de la Sombra Ligera' },
  armor: { prefix: 'Férreo', suffix: 'del Bastión' },
  power: { prefix: 'Poderoso', suffix: 'del Titán' },
  initiative: { prefix: 'Raudo', suffix: 'del Relámpago' },
  status: { prefix: 'Duradero', suffix: 'de la Condena' },
};

const MULT = [1, 1.15, 1.3, 1.5];
/** Cuánto crece cada estadística con el acto (por zona superada). */
const ACT_GROWTH = 0.25;

/** Estadísticas que solo salen en Rare o mejor (pesan mucho en el combate). */
const RARE_ONLY: StatKey[] = ['ap', 'mp'];

function roll(box: RngBox, k: StatKey, rarity: Rarity, act: number): number {
  if (k === 'ap' || k === 'mp') return 1;
  const m = MULT[rarity]! * (1 + ACT_GROWTH * act);
  if (k.startsWith('res')) return Math.round(randInt(box, 8, 13) * m);
  if (k === 'hp') return Math.round(randInt(box, 6, 10) * m);
  if (k === 'powerPhys' || k === 'powerMagic') return Math.round(randInt(box, 4, 7) * m);
  if (k === 'crit') return Math.round(randInt(box, 3, 5) * m);
  return Math.max(2, Math.round(randInt(box, 2, 3) * m));
}

/** Contexto de la sala de la que sale el botín. */
export type DropKind = 'combat' | 'elite' | 'boss' | 'shop';

/**
 * Pesos de rareza: mucho Common, poco Uncommon, muy poco Rare y casi nunca Legendary.
 * Suben un poco con el acto y bastante en élites y jefes.
 */
export function rarityWeights(act: number, kind: DropKind): [number, number, number, number] {
  const k = { combat: [1, 1, 1], elite: [1.6, 2.5, 3], boss: [2.2, 4, 6], shop: [1.4, 1.6, 1.6] }[kind];
  const w: [number, number, number, number] = [78, 18 * k[0]! * (1 + 0.25 * act), 3.6 * k[1]! * (1 + 0.5 * act), 0.4 * k[2]! * (1 + 0.8 * act)];
  if (kind === 'boss') w[0] = 30;
  return w;
}

export function rollRarity(box: RngBox, act: number, kind: DropKind = 'combat', min: Rarity = 0): Rarity {
  const w = rarityWeights(act, kind);
  let r = rand(box) * (w[0] + w[1] + w[2] + w[3]);
  let out: Rarity = 0;
  for (let i = 0; i < 4; i++) { if (r < w[i]!) { out = i as Rarity; break; } r -= w[i]!; out = i as Rarity; }
  return Math.max(out, min) as Rarity;
}

/** Cuántos prefijos y sufijos lleva cada rareza. */
export function affixLayout(box: RngBox, rarity: Rarity): { prefixes: number; suffixes: number } {
  if (rarity === 0) return rand(box) < 0.5 ? { prefixes: 1, suffixes: 0 } : { prefixes: 0, suffixes: 1 };
  if (rarity === 1) return { prefixes: 1, suffixes: 1 };
  if (rarity === 2) return rand(box) < 0.5 ? { prefixes: 2, suffixes: 1 } : { prefixes: 1, suffixes: 2 };
  return { prefixes: 2, suffixes: 2 };
}

/** Genera un objeto: rareza según acto y sala, y sus prefijos y sufijos al azar. */
export function genItem(box: RngBox, theme: ItemTheme, act: number, kind: DropKind = 'combat', min: Rarity = 0, slot?: Slot, school?: 'phys' | 'magic'): Item {
  const rarity = rollRarity(box, act, kind, min);
  const s = slot ?? pick(box, SLOTS);
  const { prefixes, suffixes } = affixLayout(box, rarity);
  const keys = shuffle(box, POOL[s]).filter((k) => (rarity >= 2 || !RARE_ONLY.includes(k))
    // sin resistencias mientras el sistema esté apagado; y solo el tipo de daño de quien lo encuentra
    && (FEATURES.resistances || !k.startsWith('res'))
    && !(school === 'magic' && k === 'powerPhys') && !(school === 'phys' && k === 'powerMagic'));
  const affixes: Affix[] = [];
  const stats: Stats = {};
  const kinds: Array<'prefix' | 'suffix'> = [...Array(prefixes).fill('prefix'), ...Array(suffixes).fill('suffix')];
  kinds.forEach((kind2, i) => {
    const stat = keys[i];
    if (!stat) return;
    const value = roll(box, stat, rarity, act);
    stats[stat] = (stats[stat] ?? 0) + value;
    affixes.push({ kind: kind2, id: `${kind2}_${stat}`, name: AFFIX_NAMES[stat][kind2], stat, value });
  });
  const named = rarity === 3 ? theme.legendaries.filter((l) => l.slot === s) : [];
  const base = named.length ? pick(box, named) : undefined;
  const firstSuffix = affixes.find((a) => a.kind === 'suffix');
  const name = base ? base.name : pick(box, theme.names[s]) + (firstSuffix ? ' ' + firstSuffix.name : '');
  return { slot: s, name, rarity, stats, affixes, ...(base?.lore ? { lore: base.lore } : {}) };
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
  const total: Record<StatKey, number> = { hp: 0, armor: 0, power: 0, powerPhys: 0, powerMagic: 0, crit: 0, ap: 0, mp: 0, initiative: 0, resFire: 0, resIce: 0, resPoison: 0, resShadow: 0, status: 0, tackle: 0, dodge: 0 };
  for (const s of list) if (s) for (const k of Object.keys(s) as StatKey[]) total[k] += s[k] ?? 0;
  return total;
}

export function statsText(s: Stats): string {
  return (Object.keys(s) as StatKey[]).map((k) => `${(s[k] ?? 0) > 0 ? '+' : ''}${s[k]} ${STAT_NAME[k]}`).join(' · ');
}
