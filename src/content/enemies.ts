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

export const ENEMIES: Record<string, EnemyDef> = { ...ZONA1_ENEMIES, ...ZONA2_ENEMIES, ...ZONA3_ENEMIES };

/** Modificadores de élite: se aplican sobre un enemigo ya creado. */
export const AFFIXES: Record<string, { name: string; text: string; apply: (u: UnitSpec) => void }> = {
  ardiente: { name: 'Ardiente', text: 'Sus golpes queman; resiste el fuego.', apply: (u) => { u.spells[0]!.rune = 'fuego'; u.resist.fire = (u.resist.fire ?? 0) + 50; } },
  vampirico: { name: 'Vampírico', text: 'Se cura con el daño que hace.', apply: (u) => { u.spells[0]!.rune = 'vampiro'; } },
  blindado: { name: 'Blindado', text: '+2 de armadura y +20% de vida.', apply: (u) => { u.armor += 2; u.hp = u.maxHp = Math.round(u.maxHp * 1.2); } },
  veloz: { name: 'Veloz', text: '+2 PM y mucha más iniciativa.', apply: (u) => { u.mp += 2; u.maxMp += 2; u.initiative += 10; } },
  enorme: { name: 'Enorme', text: '+50% de vida y +15% de daño.', apply: (u) => { u.hp = u.maxHp = Math.round(u.maxHp * 1.5); u.power += 15; } },
  venenoso: { name: 'Venenoso', text: 'Sus golpes envenenan.', apply: (u) => { u.spells[0]!.rune = 'veneno'; } },
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
