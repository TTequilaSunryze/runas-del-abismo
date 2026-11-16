// Registro de enemigos de todas las zonas y su construcción.
import type { UnitSpec } from '../core/combat/engine';
import type { Element, Pos } from '../core/state';
import { ZONA1_ENEMIES } from './zona1/enemies';
import { ZONA2_ENEMIES } from './zona2/enemies';
import { ZONA3_ENEMIES } from './zona3/enemies';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  armor: number;
  ap: number;
  mp: number;
  initiative: number;
  ai: 'melee' | 'ranged' | 'boss';
  spell: string;
  /** hechizos extra (jefes) */
  more?: string[];
  /** su vida crece con el número de jugadores */
  scales?: boolean;
  /** resistencias (positivo) y debilidades (negativo), en % */
  resist?: Partial<Record<Element, number>>;
}

export const ENEMIES: Record<string, EnemyDef> = { ...ZONA1_ENEMIES, ...ZONA2_ENEMIES, ...ZONA3_ENEMIES };

/** Crea un enemigo, escalado por profundidad dentro de la zona (0 = primera sala) y, si es élite o jefe, por jugadores. */
export function makeEnemy(id: string, pos: Pos, depth = 0, players = 1): UnitSpec {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Enemigo desconocido: ${id}`);
  const hp = Math.round(e.hp * (1 + depth * 0.14) * (e.scales ? 1 + 0.4 * (players - 1) : 1));
  return {
    team: 'enemy', kind: e.id, name: e.name, owner: null, pos,
    hp, maxHp: hp, shield: 0, armor: e.armor, power: depth * 10, crit: 0,
    ap: e.ap, maxAp: e.ap, mp: e.mp, maxMp: e.mp, initiative: e.initiative, apMod: 0, mpMod: 0, resist: { ...e.resist }, statusBonus: 0,
    statuses: {}, spells: [e.spell, ...(e.more ?? [])].map((sid) => ({ id: sid, cd: 0 })), ai: e.ai,
  };
}
