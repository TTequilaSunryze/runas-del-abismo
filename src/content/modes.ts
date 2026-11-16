// Modos que cambian la dificultad: niveles de ascensión, modificadores del reto diario y mejoras permanentes.

export const MAX_ASC = 10;

/** Cada nivel incluye todos los anteriores. */
export const ASCENSION: string[] = [
  'Dificultad normal.',
  'Enemigos +10% de vida y daño.',
  'Los élites tienen 2 modificadores.',
  'Un 30% menos de curación entre combates.',
  'Precios de la tienda +25%.',
  'Más enemigos normales con modificadores.',
  'Jefes +20% de vida.',
  'Un enemigo más en cada combate.',
  'Empezáis con el 75% de la vida.',
  'Enemigos otro +10% de vida y daño.',
  'Los jefes levantan el doble de pilares.',
];

export interface DailyMod {
  id: string;
  name: string;
  text: string;
}

export const DAILY_MODS: DailyMod[] = [
  { id: 'llamas', name: 'Mazmorra en llamas', text: 'Todos los enemigos son Ardientes.' },
  { id: 'horda', name: 'Horda', text: 'Un enemigo más en cada combate.' },
  { id: 'codicia', name: 'Codicia', text: 'Doble oro, pero todo cuesta el doble.' },
  { id: 'cristal', name: 'Cañón de cristal', text: 'Los héroes tienen un 25% menos de vida y hacen un 25% más de daño.' },
  { id: 'frenesi', name: 'Frenesí', text: 'Los enemigos hacen un 20% más de daño.' },
];
export const DAILY_ASC = 3;

/** Mejoras permanentes que cada jugador compra con ecos. */
export interface PerkDef {
  id: string;
  name: string;
  icon: string;
  text: (lvl: number) => string;
  max: number;
  cost: (lvl: number) => number;
}

export const PERKS: PerkDef[] = [
  { id: 'vit', name: 'Vitalidad', icon: '❤️', text: (l) => `+${l * 6}% de vida máxima`, max: 5, cost: (l) => 30 + l * 25 },
  { id: 'gold', name: 'Bolsa heredada', icon: '💰', text: (l) => `Empiezas con ${l * 25} de oro`, max: 4, cost: (l) => 25 + l * 20 },
  { id: 'rune', name: 'Runa ancestral', icon: '🔮', text: (l) => `Empiezas con ${l} runa(s) más`, max: 2, cost: (l) => 60 + l * 60 },
  { id: 'loot', name: 'Ojo del saqueador', icon: '🎁', text: (l) => `+${l} opción en cada botín`, max: 1, cost: () => 120 },
  { id: 'reroll', name: 'Segunda oportunidad', icon: '🎲', text: (l) => `${l} re-tirada(s) de botín por zona`, max: 2, cost: (l) => 70 + l * 60 },
  { id: 'aid', name: 'Primeros auxilios', icon: '🩹', text: (l) => `+${l * 8}% de curación entre combates`, max: 3, cost: (l) => 40 + l * 30 },
];

export type Perks = Partial<Record<string, number>>;

/** Nivel de una mejora, siempre dentro de sus límites (los datos llegan de otros jugadores). */
export function perkLevel(p: Perks | undefined, id: string): number {
  const def = PERKS.find((x) => x.id === id);
  const v = Number(p?.[id] ?? 0);
  return def && Number.isFinite(v) ? Math.max(0, Math.min(def.max, Math.floor(v))) : 0;
}
