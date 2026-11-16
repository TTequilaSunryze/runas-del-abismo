// Construcción de unidades a partir de los datos de clase.
import type { UnitSpec } from '../combat/engine';
import type { ClassId, Pos } from '../state';
import { CLASSES, canPickRoute, spellsFor } from './classes';

export function makeHero(opts: { cls: ClassId; name: string; owner: string; routes: string[]; pos: Pos }): UnitSpec {
  const c = CLASSES[opts.cls];
  const chosen: string[] = [];
  for (const r of opts.routes) {
    if (!canPickRoute(opts.cls, chosen, r)) throw new Error(`Ruta no permitida: ${r}`);
    chosen.push(r);
  }
  return {
    team: 'hero', kind: c.id, name: opts.name, owner: opts.owner, pos: opts.pos,
    hp: c.hp, maxHp: c.hp, shield: 0, armor: c.armor, power: c.power, crit: c.crit,
    ap: c.ap, maxAp: c.ap, mp: c.mp, maxMp: c.mp, initiative: c.initiative, apMod: 0, mpMod: 0,
    statuses: {}, spells: spellsFor(opts.cls, chosen).map((id) => ({ id, cd: 0 })), ai: null,
  };
}
