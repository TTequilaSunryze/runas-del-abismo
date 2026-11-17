// Registro de enemigos de todas las zonas y su construcción.
import type { UnitSpec } from '../core/combat/engine';
import type { Element, Pos } from '../core/state';
import { ZONA1_ENEMIES } from './zona1/enemies';
import { ZONA2_ENEMIES } from './zona2/enemies';
import { ZONA3_ENEMIES } from './zona3/enemies';
import { ZONA4_ENEMIES } from './zona4/enemies';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  armor: number;
  ap: number;
  mp: number;
  initiative: number;
  ai: 'melee' | 'ranged' | 'boss' | 'pillar';
  spell: string;
  /** hechizos extra (jefes) */
  more?: string[];
  /** su vida crece con el número de jugadores */
  scales?: boolean;
  /** resistencias (positivo) y debilidades (negativo), en % */
  resist?: Partial<Record<Element, number>>;
  /** rasgos especiales: ver Unit.traits */
  traits?: string[];
}

/** Aliados que se unen al grupo (jaulas y eventos). Usan la IA de los enemigos, pero en vuestro bando. */
export const ALLIES: Record<string, EnemyDef> = {
  mercenario: { id: 'mercenario', name: 'Mercenario', hp: 46, armor: 2, ap: 6, mp: 3, initiative: 10, ai: 'melee', spell: 'e_espadazo', traits: ['guard'] },
  caballero_aliado: { id: 'caballero_aliado', name: 'Caballero de hueso', hp: 52, armor: 2, ap: 6, mp: 3, initiative: 9, ai: 'melee', spell: 'e_tajo', resist: { poison: 60 } },
  sacerdotisa: { id: 'sacerdotisa', name: 'Sacerdotisa del bosque', hp: 34, armor: 0, ap: 5, mp: 3, initiative: 12, ai: 'ranged', spell: 'e_flecha', more: ['e_savia'], traits: ['regen'] },
  lobo_aliado: { id: 'lobo_aliado', name: 'Lobo leal', hp: 40, armor: 1, ap: 6, mp: 5, initiative: 15, ai: 'melee', spell: 'e_mordida' },
  guardia_forja: { id: 'guardia_forja', name: 'Guardia de forja', hp: 60, armor: 3, ap: 6, mp: 2, initiative: 7, ai: 'melee', spell: 'e_martillo', resist: { fire: 60 }, traits: ['thorns'] },
  caido: { id: 'caido', name: 'Paladín caído', hp: 70, armor: 3, ap: 6, mp: 3, initiative: 11, ai: 'melee', spell: 'e_espadazo', more: ['e_savia'], resist: { shadow: 40 }, traits: ['regen'] },
  ciervo: { id: 'ciervo', name: 'Espíritu del ciervo', hp: 60, armor: 1, ap: 6, mp: 5, initiative: 16, ai: 'melee', spell: 'e_raiz', more: ['e_savia'] },
};
/** Aliado que se encuentra en una jaula, por zona. */
export const CAGE_ALLY = ['mercenario', 'lobo_aliado', 'guardia_forja', 'caido'];

export const ENEMIES: Record<string, EnemyDef> = { ...ZONA1_ENEMIES, ...ZONA2_ENEMIES, ...ZONA3_ENEMIES, ...ZONA4_ENEMIES, ...ALLIES };

const addTrait = (u: UnitSpec, t: string): void => { if (!u.traits?.includes(t)) u.traits = [...(u.traits ?? []), t]; };

/** Modificadores de élite: se aplican sobre un enemigo ya creado. */
export const AFFIXES: Record<string, { name: string; text: string; apply: (u: UnitSpec) => void }> = {
  ardiente: { name: 'Ardiente', text: 'Sus golpes queman; resiste el fuego.', apply: (u) => { u.spells[0]!.imbue = 'fuego'; u.resist.fire = (u.resist.fire ?? 0) + 50; } },
  vampirico: { name: 'Vampírico', text: 'Se cura con el daño que hace.', apply: (u) => { u.spells[0]!.imbue = 'vampiro'; } },
  blindado: { name: 'Blindado', text: '+2 de armadura y +20% de vida.', apply: (u) => { u.armor += 2; u.hp = u.maxHp = Math.round(u.maxHp * 1.2); } },
  veloz: { name: 'Veloz', text: '+2 PM y mucha más iniciativa.', apply: (u) => { u.mp += 2; u.maxMp += 2; u.initiative += 10; } },
  enorme: { name: 'Enorme', text: '+50% de vida y +15% de daño.', apply: (u) => { u.hp = u.maxHp = Math.round(u.maxHp * 1.5); u.power += 15; } },
  venenoso: { name: 'Venenoso', text: 'Sus golpes envenenan.', apply: (u) => { u.spells[0]!.imbue = 'veneno'; } },
  reflejante: { name: 'Reflejante', text: 'Devuelve el 30% del daño cuerpo a cuerpo.', apply: (u) => addTrait(u, 'thorns') },
  regenerador: { name: 'Regenerador', text: 'Recupera el 8% de su vida cada turno.', apply: (u) => addTrait(u, 'regen') },
  explosivo: { name: 'Explosivo', text: 'Al morir explota y daña a todo lo que tenga pegado.', apply: (u) => addTrait(u, 'bomb') },
  fantasmal: { name: 'Fantasmal', text: 'Atraviesa obstáculos y persigue al más frágil.', apply: (u) => { addTrait(u, 'ghost'); addTrait(u, 'hunter'); } },
  furioso: { name: 'Furioso', text: '+40% de daño por debajo de la mitad de vida.', apply: (u) => addTrait(u, 'enrage') },
  escindido: { name: 'Escindido', text: 'Al morir se divide en dos copias menores.', apply: (u) => addTrait(u, 'split') },
  trampero: { name: 'Trampero', text: 'Esconde cepos junto a los héroes.', apply: (u) => addTrait(u, 'trapper') },
};

export interface EnemyOpts {
  /** modificadores de élite (ids de AFFIXES) */
  affixes?: string[];
  /** multiplicador de vida (ascensión, jefes) */
  hpMul?: number;
  /** % de daño extra (ascensión) */
  power?: number;
}

/** Crea un enemigo, escalado por profundidad dentro de la zona (0 = primera sala) y, si es élite o jefe, por jugadores. */
export function makeEnemy(id: string, pos: Pos, depth = 0, players = 1, opts: EnemyOpts = {}): UnitSpec {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Enemigo desconocido: ${id}`);
  const hp = Math.round(e.hp * (1 + depth * 0.17) * (e.scales || e.ai === 'pillar' ? 1 + 0.35 * (players - 1) : 1) * (opts.hpMul ?? 1));
  const u: UnitSpec = {
    team: 'enemy', kind: e.id, name: e.name, owner: null, pos,
    hp, maxHp: hp, shield: 0, armor: e.armor, power: depth * 12 + (opts.power ?? 0), crit: 0,
    ap: e.ap, maxAp: e.ap, mp: e.mp, maxMp: e.mp, initiative: e.initiative, apMod: 0, mpMod: 0, resist: { ...e.resist }, statusBonus: 0,
    statuses: {}, spells: [e.spell, ...(e.more ?? [])].map((sid) => ({ id: sid, cd: 0 })), ai: e.ai, traits: e.traits ? [...e.traits] : undefined,
    // placaje según su forma de luchar; los jefes retienen mucho
    tackle: e.ai === 'boss' ? 10 : e.ai === 'melee' ? 5 + Math.floor(depth / 3) : e.ai === 'pillar' ? 0 : 2,
    dodge: e.ai === 'boss' ? 6 : e.ai === 'ranged' ? 5 : 3,
    ...(e.ai === 'boss' ? { rank: 'boss' as const } : {}),
  };
  const names: string[] = [];
  for (const a of opts.affixes ?? []) {
    const def = AFFIXES[a];
    if (!def) continue;
    def.apply(u);
    names.push(def.name);
  }
  if (names.length) u.name = `${e.name} · ${names.join(', ')}`;
  return u;
}
