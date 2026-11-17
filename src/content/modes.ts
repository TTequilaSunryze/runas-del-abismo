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
  { id: 'elites', name: 'Campeones', text: 'Muchos más enemigos con modificadores de élite.' },
  { id: 'presagios', name: 'Tiempos de augurio', text: 'Todos los combates tienen un presagio.' },
  { id: 'veloces', name: 'Cazadores', text: 'Enemigos con +1 PM y +4 de iniciativa.' },
  { id: 'sin_descanso', name: 'Sin descanso', text: 'Las hogueras se convierten en combates.' },
  { id: 'jefes', name: 'Tiranos', text: 'Los jefes tienen un 30% más de vida.' },
  { id: 'pobreza', name: 'Pobreza', text: 'Ganáis la mitad de oro.' },
];
/** El reto diario solo usa los modificadores originales (para que el ranking sea comparable). */
export const DAILY_POOL = ['llamas', 'horda', 'codicia', 'cristal', 'frenesi'];
/** Ecos extra por cada modificador elegido a mano. */
export const MOD_ECOS = 0.15;
export const MAX_MODS = 3;

/** Presagio: una regla especial para un combate concreto. */
export interface OmenDef {
  id: string;
  name: string;
  icon: string;
  text: string;
}
export const OMENS: OmenDef[] = [
  { id: 'sangre', name: 'Luna de sangre', icon: '🌕', text: 'Todos hacen un 20% más de daño.' },
  { id: 'pantano', name: 'Ciénaga', icon: '🟢', text: 'El suelo está lleno de charcos que atrapan a los héroes.' },
  { id: 'puas', name: 'Suelo de púas', icon: '📌', text: 'Púas por todo el tablero.' },
  { id: 'bendicion', name: 'Bendición', icon: '🕊️', text: 'Los héroes empiezan con un escudo del 20% de su vida.' },
  { id: 'oro', name: 'Botín maldito', icon: '💰', text: 'Enemigos con +25% de vida, pero el doble de oro.' },
  { id: 'eclipse', name: 'Eclipse', icon: '🌑', text: 'Los enemigos se regeneran cada turno.' },
  { id: 'calma', name: 'Calma antes de la tormenta', icon: '🍃', text: 'Los héroes tienen +1 PA en este combate.' },
  { id: 'tormenta', name: 'Tormenta rúnica', icon: '⚡', text: 'Enemigos con +1 PM; si ganáis, una runa para cada uno.' },
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
  { id: 'loot', name: 'Ojo del saqueador', icon: '🎁', text: (l) => `+${l} objeto en los botines de élites y jefes`, max: 1, cost: () => 120 },
  { id: 'aid', name: 'Primeros auxilios', icon: '🩹', text: (l) => `+${l * 8}% de curación entre combates`, max: 3, cost: (l) => 40 + l * 30 },
];

export type Perks = Partial<Record<string, number>>;

/** Nivel de una mejora, siempre dentro de sus límites (los datos llegan de otros jugadores). */
export function perkLevel(p: Perks | undefined, id: string): number {
  const def = PERKS.find((x) => x.id === id);
  const v = Number(p?.[id] ?? 0);
  return def && Number.isFinite(v) ? Math.max(0, Math.min(def.max, Math.floor(v))) : 0;
}
