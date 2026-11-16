// Construcción de héroes a partir de clase, rutas, nivel y equipo.
import type { UnitSpec } from '../combat/engine';
import { sumStats, type Stats } from '../items/items';
import type { ClassId, Pos } from '../state';
import { CLASSES, canPickRoute, spellsFor } from './classes';

export interface HeroBuild {
  cls: ClassId;
  name: string;
  owner: string;
  routes: string[];
  pos: Pos;
  /** 1 a MAX_LEVEL; por defecto 3 (todos los hechizos de ruta) */
  level?: number;
  /** estadísticas del equipo y de bendiciones o maldiciones */
  bonus?: Array<Stats | undefined>;
}

/** Cada nivel por encima del 1 da +8% de vida base y +6% de daño. */
export function makeHero(opts: HeroBuild): UnitSpec {
  const c = CLASSES[opts.cls];
  // un solo kit: el primero válido (o el Clásico)
  const chosen = opts.routes.filter((r) => canPickRoute(opts.cls, [], r)).slice(0, 1);
  const level = opts.level ?? 1;
  const b = sumStats(opts.bonus ?? []);
  const hp = Math.max(10, Math.round(c.hp * (1 + 0.08 * (level - 1))) + b.hp);
  const ap = Math.max(2, c.ap + b.ap), mp = Math.max(1, c.mp + b.mp);
  return {
    team: 'hero', kind: c.id, name: opts.name, owner: opts.owner, pos: opts.pos,
    hp, maxHp: hp, shield: 0, armor: Math.max(0, c.armor + b.armor), power: c.power + 6 * (level - 1) + b.power, crit: c.crit + b.crit,
    ap, maxAp: ap, mp, maxMp: mp, initiative: c.initiative + b.initiative, apMod: 0, mpMod: 0, tackle: Math.max(0, c.tackle + b.tackle), dodge: Math.max(0, c.dodge + b.dodge),
    resist: { fire: b.resFire, ice: b.resIce, poison: b.resPoison, shadow: b.resShadow }, statusBonus: Math.max(0, Math.min(2, b.status)),
    statuses: {}, spells: spellsFor(opts.cls, chosen, level).map((id) => ({ id, cd: 0 })), ai: null,
    // la Hechicera Zorro empieza sin esencia acumulada
    ...(opts.cls === 'zorro' ? { essence: 0 } : {}),
    // el Carcelero cosecha almas: armadura fija por cada enemigo que cae con él vivo
    ...(opts.cls === 'carcelero' ? { souls: 0 } : {}),
  };
}
