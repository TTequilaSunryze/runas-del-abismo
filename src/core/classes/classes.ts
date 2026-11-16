// Clases, rutas y la regla de exclusión entre rutas opuestas.
import type { ClassId } from '../state';

export interface RouteDef {
  id: string;
  name: string;
  /** ruta opuesta: elegir una bloquea la otra durante toda la partida */
  opposite: string;
  spells: string[];
  text: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  hp: number;
  armor: number;
  power: number;
  crit: number;
  ap: number;
  mp: number;
  initiative: number;
  baseSpell: string;
  routes: RouteDef[];
}

const R = (id: string, name: string, opposite: string, spells: string[], text: string): RouteDef => ({ id, name, opposite, spells, text });

export const CLASSES: Record<ClassId, ClassDef> = {
  guerrero: {
    id: 'guerrero', name: 'Guerrero', hp: 64, armor: 2, power: 0, crit: 5, ap: 6, mp: 3, initiative: 10, baseSpell: 'tajo',
    routes: [
      R('baluarte', 'Baluarte', 'berserker', ['muro', 'proteger', 'embate'], 'Tanque: escudos y protección de aliados.'),
      R('berserker', 'Berserker', 'baluarte', ['frenesi', 'sed', 'torbellino'], 'Daño bruto pagado con tu propia vida.'),
      R('caudillo', 'Caudillo', 'duelista', ['arenga', 'avanzad', 'grito'], 'Apoyo: da PA y PM al grupo.'),
      R('duelista', 'Duelista', 'caudillo', ['estocada', 'desarmar', 'ejecucion'], 'Un solo objetivo: movilidad y anulación.'),
    ],
  },
  mago: {
    id: 'mago', name: 'Mago', hp: 42, armor: 0, power: 8, crit: 5, ap: 6, mp: 3, initiative: 14, baseSpell: 'dardo',
    routes: [
      R('fuego', 'Fuego', 'hielo', ['ignicion', 'bola', 'lluvia'], 'Daño en área y Quemadura.'),
      R('hielo', 'Hielo', 'fuego', ['escarcha', 'congelar', 'ventisca'], 'Control: quita PM y congela.'),
      R('tormenta', 'Tormenta', 'arcano', ['rayo', 'vendaval', 'tempestad'], 'Quita PA y recoloca enemigos.'),
      R('arcano', 'Arcano', 'tormenta', ['barrera', 'impulso', 'cupula'], 'Escudos y PA para los aliados.'),
    ],
  },
  picaro: {
    id: 'picaro', name: 'Pícaro', hp: 50, armor: 1, power: 0, crit: 15, ap: 7, mp: 4, initiative: 16, baseSpell: 'punalada',
    routes: [
      R('veneno', 'Veneno', 'asesino', ['daga_ven', 'nube', 'toxina'], 'Daño por turno que se acumula.'),
      R('asesino', 'Asesino', 'veneno', ['apunalar', 'emboscada', 'golpe_mortal'], 'Daño directo a un objetivo.'),
      R('sombras', 'Sombras', 'acrobata', ['cegar', 'punto_debil', 'golpe_bajo'], 'Debilita: quita PA, marca y aturde.'),
      R('acrobata', 'Acróbata', 'sombras', ['voltereta', 'evasion', 'senal'], 'Movilidad, evasión y apoyo.'),
    ],
  },
  clerigo: {
    id: 'clerigo', name: 'Clérigo', hp: 56, armor: 1, power: 4, crit: 5, ap: 6, mp: 3, initiative: 8, baseSpell: 'maza',
    routes: [
      R('luz', 'Luz', 'penitencia', ['sanar', 'aura', 'plegaria'], 'Curación directa y en área.'),
      R('penitencia', 'Penitencia', 'luz', ['flagelo', 'expiar', 'martirio'], 'Daño sagrado con robo de vida.'),
      R('egida', 'Égida', 'juicio', ['custodia', 'consagrar', 'bastion'], 'Escudos para todo el grupo.'),
      R('juicio', 'Juicio', 'egida', ['marca', 'sentencia', 'veredicto'], 'Marca, debilita y aturde.'),
    ],
  },
};

export const MAX_ROUTES = 2;

export function findRoute(cls: ClassId, routeId: string): RouteDef | undefined {
  return CLASSES[cls].routes.find((r) => r.id === routeId);
}

/** Rutas que ya no se pueden elegir: las opuestas a las elegidas (o todas, si ya hay 2). */
export function blockedRoutes(cls: ClassId, chosen: readonly string[]): string[] {
  const all = CLASSES[cls].routes;
  if (chosen.length >= MAX_ROUTES) return all.filter((r) => !chosen.includes(r.id)).map((r) => r.id);
  return all.filter((r) => chosen.includes(r.opposite)).map((r) => r.id);
}

export function canPickRoute(cls: ClassId, chosen: readonly string[], routeId: string): boolean {
  return !!findRoute(cls, routeId) && !chosen.includes(routeId) && !blockedRoutes(cls, chosen).includes(routeId);
}

export const MAX_LEVEL = 6;

/** Hechizos disponibles: el básico siempre; de cada ruta elegida, 1 a nivel 1, 2 a nivel 2 y 3 desde nivel 3. */
export function spellsFor(cls: ClassId, chosen: readonly string[], level = 3): string[] {
  const c = CLASSES[cls];
  return [c.baseSpell, ...c.routes.filter((r) => chosen.includes(r.id)).flatMap((r) => r.spells.slice(0, Math.max(1, Math.min(3, level))))];
}
