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
      R('baluarte', 'Baluarte', 'berserker', ['muro', 'proteger'], 'Tanque: escudos y protección de aliados.'),
      R('berserker', 'Berserker', 'baluarte', ['frenesi', 'sed'], 'Daño bruto pagado con tu propia vida.'),
      R('caudillo', 'Caudillo', 'duelista', ['arenga', 'avanzad'], 'Apoyo: da PA y PM al grupo.'),
      R('duelista', 'Duelista', 'caudillo', ['estocada', 'desarmar'], 'Un solo objetivo: movilidad y anulación.'),
    ],
  },
  mago: {
    id: 'mago', name: 'Mago', hp: 42, armor: 0, power: 8, crit: 5, ap: 6, mp: 3, initiative: 14, baseSpell: 'dardo',
    routes: [
      R('fuego', 'Fuego', 'hielo', ['bola', 'ignicion'], 'Daño en área y Quemadura.'),
      R('hielo', 'Hielo', 'fuego', ['escarcha', 'congelar'], 'Control: quita PM y congela.'),
      R('tormenta', 'Tormenta', 'arcano', ['rayo', 'vendaval'], 'Quita PA y recoloca enemigos.'),
      R('arcano', 'Arcano', 'tormenta', ['barrera', 'impulso'], 'Escudos y PA para los aliados.'),
    ],
  },
  clerigo: {
    id: 'clerigo', name: 'Clérigo', hp: 56, armor: 1, power: 4, crit: 5, ap: 6, mp: 3, initiative: 8, baseSpell: 'maza',
    routes: [
      R('luz', 'Luz', 'penitencia', ['sanar', 'aura'], 'Curación directa y en área.'),
      R('penitencia', 'Penitencia', 'luz', ['flagelo', 'expiar'], 'Daño sagrado con robo de vida.'),
      R('egida', 'Égida', 'juicio', ['consagrar', 'custodia'], 'Escudos para todo el grupo.'),
      R('juicio', 'Juicio', 'egida', ['marca', 'sentencia'], 'Marca, debilita y aturde.'),
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

/** Hechizos disponibles con las rutas elegidas (el básico de clase siempre). */
export function spellsFor(cls: ClassId, chosen: readonly string[]): string[] {
  const c = CLASSES[cls];
  return [c.baseSpell, ...c.routes.filter((r) => chosen.includes(r.id)).flatMap((r) => r.spells)];
}
