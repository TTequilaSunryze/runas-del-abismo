// Zona 1: Las Catacumbas Olvidadas. Enemigos base (el jefe y los élites llegan con el generador de mazmorra).
import type { UnitSpec } from '../../core/combat/engine';
import type { Pos } from '../../core/state';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  armor: number;
  ap: number;
  mp: number;
  initiative: number;
  ai: 'melee' | 'ranged';
  spell: string;
}

export const ZONA1_ENEMIES: Record<string, EnemyDef> = {
  limo: { id: 'limo', name: 'Limo de osario', hp: 20, armor: 0, ap: 3, mp: 2, initiative: 4, ai: 'melee', spell: 'e_golpe' },
  murcielago: { id: 'murcielago', name: 'Murciélago de cripta', hp: 13, armor: 0, ap: 3, mp: 5, initiative: 16, ai: 'melee', spell: 'e_mordisco' },
  esqueleto: { id: 'esqueleto', name: 'Esqueleto guardián', hp: 24, armor: 1, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_golpe' },
  arquero: { id: 'arquero', name: 'Arquero óseo', hp: 17, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_flecha' },
  necrofago: { id: 'necrofago', name: 'Necrófago', hp: 30, armor: 1, ap: 3, mp: 3, initiative: 7, ai: 'melee', spell: 'e_zarpazo' },
};

/** Crea un enemigo de la zona, escalado por profundidad de sala (0 = primera). */
export function makeEnemy(id: string, pos: Pos, depth = 0): UnitSpec {
  const e = ZONA1_ENEMIES[id];
  if (!e) throw new Error(`Enemigo desconocido: ${id}`);
  const hp = Math.round(e.hp * (1 + depth * 0.14));
  return {
    team: 'enemy', kind: e.id, name: e.name, owner: null, pos,
    hp, maxHp: hp, shield: 0, armor: e.armor, power: depth * 10, crit: 0,
    ap: e.ap, maxAp: e.ap, mp: e.mp, maxMp: e.mp, initiative: e.initiative, apMod: 0, mpMod: 0,
    statuses: {}, spells: [{ id: e.spell, cd: 0 }], ai: e.ai,
  };
}
