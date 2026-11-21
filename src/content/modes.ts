// Modos que cambian la dificultad: niveles de ascensión, modificadores del reto diario y presagios.

export const MAX_ASC = 10;

/** Cada nivel incluye todos los anteriores. */
export const ASCENSION: string[] = [
  'Dificultad normal.',
  'Enemigos +10% de vida y daño.',
  'Los élites tienen 2 modificadores.',
  'Un 30% menos de curación tras el jefe y en las hogueras.',
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
  /** riesgo: 1 leve, 2 medio, 3 alto (los originales del reto diario: 2) */
  tier?: 1 | 2 | 3;
  /** ecos extra de este modificador (por defecto MOD_ECOS) */
  ecos?: number;
  /** modificadores con los que no se puede combinar */
  excl?: string[];
}

export const DAILY_MODS: DailyMod[] = [
  { id: 'llamas', name: 'Mazmorra en llamas', text: 'Todos los enemigos son Ardientes.' },
  { id: 'horda', name: 'Horda', text: 'Un enemigo más en cada combate.' },
  { id: 'codicia', name: 'Codicia', text: 'Doble oro, pero todo cuesta el doble.' },
  { id: 'cristal', name: 'Cañón de cristal', text: 'Los héroes tienen un 25% menos de vida y hacen +3 de daño.' },
  { id: 'frenesi', name: 'Frenesí', text: 'Los enemigos hacen +1 de daño.' },
  { id: 'elites', name: 'Campeones', text: 'Muchos más enemigos con modificadores de élite.' },
  { id: 'presagios', name: 'Tiempos de augurio', text: 'Todos los combates tienen un presagio.' },
  { id: 'veloces', name: 'Cazadores', text: 'Enemigos con +1 PM y +4 de iniciativa.' },
  { id: 'sin_descanso', name: 'Sin descanso', text: 'Las hogueras se convierten en combates.' },
  { id: 'jefes', name: 'Tiranos', text: 'Los jefes tienen un 30% más de vida.' },
  { id: 'pobreza', name: 'Pobreza', text: 'Ganáis la mitad de oro.' },
  // Fase G1: modificadores de expedición
  { id: 'oscuridad', name: 'Oscuridad profunda', text: 'En el mapa solo se ve qué hay en las 2 capas siguientes; el resto queda en sombra.', tier: 1, ecos: 0.1 },
  { id: 'ecos_inestables', name: 'Ecos inestables', text: 'Los combates normales dan un 30% menos de oro; élites y jefes, un 50% más.', tier: 1, ecos: 0.05, excl: ['codicia', 'pobreza'] },
  { id: 'agrietado', name: 'Santuario agrietado', text: 'Los santuarios ofrecen una bendición menos, pero curan un 20% de la vida al entrar.', tier: 1, ecos: 0.1 },
  { id: 'niebla', name: 'Niebla arcana', text: 'En los combates con presagio, los enemigos tienen +20% de vida.', tier: 1, ecos: 0.1 },
  { id: 'reforzados', name: 'Enemigos reforzados', text: 'Los enemigos empiezan cada combate con un escudo del 15% de su vida.', tier: 2, ecos: 0.15 },
  { id: 'maldicion', name: 'Maldición persistente', text: 'El grupo tiene un 10% menos de vida máxima toda la partida; a cambio, cada héroe empieza con una reliquia.', tier: 2, ecos: 0.1, excl: ['cristal'] },
  { id: 'riesgo', name: 'Riesgo creciente', text: 'Desde la zona 2, los enemigos ganan +12% de vida y +1 de daño por cada zona superada.', tier: 3, ecos: 0.2, excl: ['jefes'] },
];
export const modDef = (id: string): DailyMod | undefined => DAILY_MODS.find((m) => m.id === id);
/** Ecos extra de un modificador. */
export const modEcos = (id: string): number => modDef(id)?.ecos ?? MOD_ECOS;
/** Por qué no se puede añadir `id` a la selección (o null si se puede). */
export function modConflict(id: string, chosen: readonly string[]): string | null {
  const d = modDef(id);
  for (const c of chosen) {
    if (c === id) continue;
    const o = modDef(c);
    if (d?.excl?.includes(c) || o?.excl?.includes(id)) return `Incompatible con ${o?.name ?? c}`;
  }
  return null;
}
/** Quita de una lista los modificadores desconocidos, repetidos o incompatibles (se queda el primero). */
export function cleanMods(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const m of list) if (modDef(m) && !out.includes(m) && !modConflict(m, out) && out.length < MAX_MODS) out.push(m);
  return out;
}
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
  { id: 'sangre', name: 'Luna de sangre', icon: '🌕', text: 'Todos hacen +2 de daño (los enemigos, +1).' },
  { id: 'pantano', name: 'Ciénaga', icon: '🟢', text: 'El suelo está lleno de charcos que atrapan a los héroes.' },
  { id: 'puas', name: 'Suelo de púas', icon: '📌', text: 'Púas por todo el tablero.' },
  { id: 'bendicion', name: 'Bendición', icon: '🕊️', text: 'Los héroes empiezan con un escudo del 20% de su vida.' },
  { id: 'oro', name: 'Botín maldito', icon: '💰', text: 'Enemigos con +25% de vida, pero el doble de oro.' },
  { id: 'eclipse', name: 'Eclipse', icon: '🌑', text: 'Los enemigos se regeneran cada turno.' },
  { id: 'calma', name: 'Calma antes de la tormenta', icon: '🍃', text: 'Los héroes tienen +1 PA en este combate.' },
  { id: 'tormenta', name: 'Tormenta rúnica', icon: '⚡', text: 'Enemigos con +1 PM.' },
];
export const DAILY_ASC = 3;

