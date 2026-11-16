// Zona 1: Las Catacumbas Olvidadas. Enemigos base (el jefe y los élites llegan con el generador de mazmorra).
import type { UnitSpec } from '../../core/combat/engine';
import type { Element, Pos } from '../../core/state';

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

export const ZONA1_ENEMIES: Record<string, EnemyDef> = {
  limo: { id: 'limo', name: 'Limo de osario', hp: 20, armor: 0, ap: 3, mp: 2, initiative: 4, ai: 'melee', spell: 'e_golpe', resist: { poison: 50, fire: -30 } },
  murcielago: { id: 'murcielago', name: 'Murciélago de cripta', hp: 13, armor: 0, ap: 3, mp: 5, initiative: 16, ai: 'melee', spell: 'e_mordisco' },
  esqueleto: { id: 'esqueleto', name: 'Esqueleto guardián', hp: 24, armor: 1, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_golpe', resist: { poison: 60, holy: -30 } },
  acolito: { id: 'acolito', name: 'Acólito hereje', hp: 19, armor: 0, ap: 3, mp: 2, initiative: 13, ai: 'ranged', spell: 'e_llama', resist: { fire: 60, ice: -30 } },
  arquero: { id: 'arquero', name: 'Arquero óseo', hp: 17, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_flecha' },
  caballero: { id: 'caballero', name: 'Caballero sepulcral', hp: 70, armor: 2, ap: 6, mp: 3, initiative: 11, ai: 'melee', spell: 'e_tajo', scales: true },
  prior: { id: 'prior', name: 'El Prior Hueco', hp: 120, armor: 1, ap: 6, mp: 2, initiative: 6, ai: 'boss', spell: 'e_maldicion', more: ['e_barrido'], scales: true, resist: { shadow: 50, poison: 40, holy: -25 } },
  necrofago: { id: 'necrofago', name: 'Necrófago', hp: 30, armor: 1, ap: 3, mp: 3, initiative: 7, ai: 'melee', spell: 'e_zarpazo', resist: { poison: 75, fire: -30 } },
};

/** Crea un enemigo de la zona, escalado por profundidad de sala (0 = primera) y, si es élite o jefe, por jugadores. */
export function makeEnemy(id: string, pos: Pos, depth = 0, players = 1): UnitSpec {
  const e = ZONA1_ENEMIES[id];
  if (!e) throw new Error(`Enemigo desconocido: ${id}`);
  const hp = Math.round(e.hp * (1 + depth * 0.14) * (e.scales ? 1 + 0.4 * (players - 1) : 1));
  return {
    team: 'enemy', kind: e.id, name: e.name, owner: null, pos,
    hp, maxHp: hp, shield: 0, armor: e.armor, power: depth * 10, crit: 0,
    ap: e.ap, maxAp: e.ap, mp: e.mp, maxMp: e.mp, initiative: e.initiative, apMod: 0, mpMod: 0, resist: { ...e.resist }, statusBonus: 0,
    statuses: {}, spells: [e.spell, ...(e.more ?? [])].map((sid) => ({ id: sid, cd: 0 })), ai: e.ai,
  };
}
