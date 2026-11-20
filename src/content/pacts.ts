// Pactos Mayores: una regla que cambia toda la mazmorra. Se vota en el Altar al empezar la partida.
import type { Stats } from '../core/items/items';

export interface PactDef {
  id: string;
  name: string;
  icon: string;
  /** lo que ganáis (verde) */
  boon: string;
  /** lo que cuesta (rojo) */
  bane: string;
  /** cambios directos en las estadísticas de cada héroe al sellarlo (vida en % de la máxima) */
  stats?: Stats & { hpPct?: number };
}

export const PACTS: PactDef[] = [
  { id: 'vacio', name: 'Pacto del Vacío Hambriento', icon: '🕳️', boon: 'Al morir, cada enemigo estalla y daña a sus aliados pegados (20% de su vida máxima)', bane: 'Los enemigos tienen +30% de vida' },
  { id: 'desatada', name: 'Pacto de la Magia Desatada', icon: '✨', boon: 'Vuestros hechizos cuestan 1 PA menos (mínimo 1)', bane: 'No os curáis de ninguna forma entre combates: ni hogueras, ni jefes, ni cambio de zona' },
  { id: 'sangre', name: 'Pacto de Sangre', icon: '🩸', boon: '+3 de daño para todos', bane: '−20% de vida máxima', stats: { power: 3, hpPct: -0.2 } },
  { id: 'hierro', name: 'Pacto del Hierro', icon: '🛡️', boon: '+4 de armadura para todos', bane: '−1 PM para todos', stats: { armor: 4, mp: -1 } },
  { id: 'presteza', name: 'Pacto de la Presteza', icon: '💨', boon: '+1 PM y +6 de iniciativa para todos', bane: 'Los enemigos también tienen +1 PM', stats: { mp: 1, initiative: 6 } },
  { id: 'avaricia', name: 'Pacto de la Avaricia', icon: '💰', boon: 'Ganáis el doble de oro en los combates', bane: 'Los enemigos hacen +2 de daño' },
  { id: 'cristal', name: 'Pacto del Filo de Cristal', icon: '🔮', boon: '+25% de crítico para todos', bane: 'Los enemigos tienen +15% de crítico', stats: { crit: 25 } },
  { id: 'espinas', name: 'Pacto de las Espinas', icon: '🌵', boon: 'Devolvéis el 30% del daño cuerpo a cuerpo que recibís', bane: 'Los enemigos tienen +15% de vida' },
  { id: 'ayuno', name: 'Pacto del Ayuno', icon: '🍞', boon: '+25% de vida máxima para todos', bane: 'Sin consumibles: perdéis los que lleváis y la tienda no los vende', stats: { hpPct: 0.25 } },
  { id: 'tirano', name: 'Pacto del Tirano', icon: '👑', boon: 'Los élites sueltan siempre un objeto Rare o mejor', bane: 'Élites y jefes tienen +30% de vida' },
  { id: 'ecos', name: 'Pacto de los Ecos', icon: '🔔', boon: 'Cada uno empieza con 3 Escofinas de Eco (una mejora de hechizo a elegir en la Forja)', bane: 'Los enemigos tienen +15% de vida' },
  { id: 'ceniza', name: 'Pacto de Ceniza', icon: '🔥', boon: 'Vuestros golpes queman 2 turnos', bane: 'Todos los enemigos son Ardientes: sus golpes también queman' },
  { id: 'penumbra', name: 'Pacto de la Penumbra', icon: '🌑', boon: '+1 PA para todos', bane: 'Los enemigos tienen +25% de vida y +1 de daño', stats: { ap: 1 } },
];

export const pactOf = (id: string | null | undefined): PactDef | undefined => PACTS.find((p) => p.id === id);

/** Vida extra de los enemigos por el pacto (élites y jefes aparte). */
export function pactEnemyHp(pact: string | null | undefined, strong: boolean): number {
  return ({ vacio: 0.3, espinas: 0.15, ecos: 0.15, penumbra: 0.25 } as Record<string, number>)[pact ?? ''] ?? (pact === 'tirano' && strong ? 0.3 : 0);
}
export const pactEnemyPower = (pact: string | null | undefined): number => (pact === 'avaricia' ? 2 : pact === 'penumbra' ? 1 : 0);

// ---------------------------------------------------------------------------
// Maldiciones de los cofres
// ---------------------------------------------------------------------------
export interface CurseDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  /** combates que dura (0 = efecto inmediato) */
  fights: number;
}
export const CURSES: CurseDef[] = [
  { id: 'mimico', name: '¡Era un mímico!', icon: '🦷', text: 'El cofre muerde: cada uno pierde el 20% de su vida máxima.', fights: 0 },
  { id: 'avaro', name: 'Mano del avaro', icon: '🪙', text: 'Una mano espectral os vacía las bolsas: cada uno pierde el 25% de su oro.', fights: 0 },
  { id: 'grilletes', name: 'Grilletes de plomo', icon: '⛓️', text: 'Cadenas invisibles: −1 PM en los 2 próximos combates.', fights: 2 },
  { id: 'oxido', name: 'Óxido maldito', icon: '🟤', text: 'Vuestras armas se oxidan: −2 de daño en los 2 próximos combates.', fights: 2 },
  { id: 'guardianes', name: 'Guardianes despiertos', icon: '👁️', text: 'El ruido despierta a la guardia: el próximo combate es una emboscada con más enemigos (y mejor botín).', fights: 1 },
  { id: 'eclipse', name: 'Mal augurio', icon: '🌑', text: 'Una sombra cubre el cofre: en el próximo combate los enemigos se regeneran cada turno.', fights: 1 },
];
export const curseOf = (id: string): CurseDef | undefined => CURSES.find((c) => c.id === id);
export const CHEST_CURSE_CHANCE = 0.3;

// ---------------------------------------------------------------------------
// Forja
// ---------------------------------------------------------------------------
/** Calor que suma cada acción en la forja. */
export const HEAT = { recalibrate: 15, scrap: 10, hone: 20 } as const;
/** Umbrales: desde «hot» el próximo combate es Ardiente; desde «overload», Sobrecarga de fuego. */
export const HEAT_HOT = 40;
export const HEAT_OVERLOAD = 80;
export const HEAT_MAX = 120;
export function heatTier(heat: number): { id: 'calm' | 'hot' | 'overload'; name: string; text: string } {
  if (heat >= HEAT_OVERLOAD) return { id: 'overload', name: 'Sobrecarga de fuego', text: 'Próximo combate: enemigos inmunes a las quemaduras, sus golpes queman, abrasan a quien tengan pegado y tienen +20% de vida.' };
  if (heat >= HEAT_HOT) return { id: 'hot', name: 'Crisol ardiente', text: 'Próximo combate: enemigos inmunes a las quemaduras y sus golpes queman.' };
  return { id: 'calm', name: 'Crisol templado', text: 'El próximo combate no cambia.' };
}
/** Escofinas de Eco por desguazar un objeto, según su rareza. */
export const SCRAP_YIELD = [1, 2, 3, 5] as const;
/** Escofinas que cuesta elegir una mejora de hechizo. */
export const HONE_COST = 3;
/** Oro del recalibrado: sube con cada uso del mismo héroe. */
export const recalibratePrice = (uses: number): number => 30 + 20 * uses;

// ---------------------------------------------------------------------------
// Descanso: un texto por zona
// ---------------------------------------------------------------------------
export const REST_TEXT: string[] = [
  'Entre nichos vacíos encontráis una cripta seca. Encendéis una hoguera con huesos viejos y, por un rato, el silencio de las catacumbas parece amable.',
  'Bajo las raíces de un roble muerto, un claro de musgo tibio. Las esporas brillan como luciérnagas mientras curáis las heridas.',
  'Una fragua abandonada aún guarda brasas. Os sentáis junto al yunque frío y el calor del hierro os devuelve las fuerzas.',
  'Una isla de piedra flota quieta en el vacío. No hay viento ni sonido: solo vuestra hoguera, pequeña y obstinada, frente al Abismo.',
];
