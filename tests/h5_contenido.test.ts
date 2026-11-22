// Fase H5: las 10 habilidades alternativas que faltaban y las 10 bendiciones propias del Arquero.
import { describe, expect, it } from 'vitest';
import { SPELL_CATALOG } from '../src/content/spellCatalog';
import { BLESSINGS } from '../src/core/boonmods';
import { PLAYABLE } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { ARCHER_WIND_MAX, archerBonus, cast, castProblem, createCombat, current, endTurn, type UnitSpec } from '../src/core/combat/engine';
import { makeEnemy } from '../src/content/enemies';
import type { ClassId, CombatState, Unit } from '../src/core/state';
import { blessingPool, newRun } from '../src/game/run';
import { CATALOG, spellItemId } from '../src/game/shop';

const NEW = ['b_salto', 'b_piel', 'b_arenga', 'b_decapitar', 'b_agarre', 's_garrote', 's_bruma', 'z_resguardo', 'r_runa', 'g_bengala'];
const hero = (cls: ClassId, x: number, y: number, spells: string[] = [], traits: string[] = []): UnitSpec => {
  const h = makeHero({ cls, name: 'H', owner: 'p', routes: [], pos: { x, y } }); h.traits = traits; h.crit = 0;
  for (const id of spells) h.spells.push({ id, cd: 0 });
  return h;
};
const foe = (x: number, y: number): UnitSpec => { const e = makeEnemy('esqueleto', { x, y }); e.traits = []; e.hp = e.maxHp = 300; e.armor = 0; e.initiative = 0; e.resist = {}; return e; };
const fight = (units: UnitSpec[]): CombatState => { const s = createCombat({ seed: 7, w: 14, h: 8, obstacles: [], units }).state; while (current(s)!.team !== 'hero') endTurn(s, current(s)!.id); current(s)!.ap = 30; return s; };
const me = (s: CombatState): Unit => current(s)!;

describe('H5 · catálogo completo', () => {
  it('las 8 clases tienen sus 14 habilidades y ya no falta ninguna', () => {
    for (const c of PLAYABLE) { expect(SPELL_CATALOG[c]!.missing, c).toBe(0); expect(SPELL_CATALOG[c]!.starters.length + SPELL_CATALOG[c]!.alts.length, c).toBe(14); }
  });
  it('las 10 nuevas existen, no tienen espera y se venden en la tienda', () => {
    for (const id of NEW) { expect(SPELLS[id], id).toBeTruthy(); if (!new Set(['k_caja', 'k_sacrificio', 'k_condena', 'z_espejismo', 'z_drenaje', 'z_velo', 'z_resguardo', 't_singularidad', 's_velo', 's_ejecucion']).has(id)) expect(SPELLS[id]!.cd).toBe(0); expect(CATALOG().some((x) => x.id === spellItemId(id)), id).toBe(true); }
  });
});

describe('H5 · Bárbaro', () => {
  it('Salto del berserker: salta junto al enemigo lejano y le pega', () => {
    const s = fight([hero('barbaro', 1, 3, ['b_salto']), foe(4, 3)]);
    const u = me(s), e = s.units[1]!;
    expect(cast(s, u.id, 'b_salto', e.pos).ok).toBe(true);
    expect(Math.abs(u.pos.x - e.pos.x) + Math.abs(u.pos.y - e.pos.y)).toBe(1);
    expect(e.hp).toBeLessThan(300);
    expect(u.fury).toBeGreaterThan(0);
  });
  it('Piel de hierro: 40 de Furia por 18 de escudo', () => {
    const s = fight([hero('barbaro', 1, 3, ['b_piel']), foe(8, 3)]);
    const u = me(s);
    u.fury = 30; expect(castProblem(s, u, SPELLS.b_piel!, u.pos)).toMatch(/Furia/);
    u.fury = 60; expect(cast(s, u.id, 'b_piel', u.pos).ok).toBe(true);
    expect(u.shield).toBe(18); expect(u.fury).toBe(20);
  });
  it('Arenga salvaje: +1 PA al próximo turno y +2 de daño', () => {
    const s = fight([hero('barbaro', 1, 3, ['b_arenga']), hero('pistolero', 2, 3), foe(9, 3)]);
    const u = s.units[0]!, ally = s.units.find((x) => x.kind === 'pistolero')!;
    s.turn = s.order.indexOf(u.id); u.ap = 10;
    expect(cast(s, u.id, 'b_arenga', ally.pos).ok).toBe(true);
    expect(ally.statuses.empower?.stacks).toBe(2);
    expect(ally.apMod).toBe(1);
  });
  it('Decapitar: cuesta Furia, escala con la que queda y se repite gratis si remata', () => {
    const s = fight([hero('barbaro', 1, 3, ['b_decapitar']), foe(2, 3), foe(1, 4)]);
    const u = me(s), a = s.units[1]!, b = s.units[2]!;
    u.fury = 100; a.hp = 5;
    expect(cast(s, u.id, 'b_decapitar', a.pos).ok).toBe(true);
    expect(a.hp).toBe(0);
    u.fury = 100; u.ap = 0;
    expect(cast(s, u.id, 'b_decapitar', b.pos).ok).toBe(true);
    expect(b.hp).toBeLessThan(300);
  });
  it('Agarre brutal: Inmovilizado y Expuesto', () => {
    const s = fight([hero('barbaro', 1, 3, ['b_agarre']), foe(2, 3)]);
    const u = me(s), e = s.units[1]!;
    expect(cast(s, u.id, 'b_agarre', e.pos).ok).toBe(true);
    expect(e.statuses.rooted).toBeTruthy(); expect(e.statuses.exposed?.stacks).toBe(2);
  });
});

describe('H5 · Acechador, Zorro, Arquitecto y Pistolero', () => {
  it('Garrote: aparece a su espalda, lo inmoviliza y le quita PA', () => {
    const s = fight([hero('acechador', 1, 3, ['s_garrote']), foe(3, 3)]);
    const u = me(s), e = s.units[1]!;
    expect(cast(s, u.id, 's_garrote', e.pos).ok).toBe(true);
    expect(u.pos).toEqual({ x: 4, y: 3 });
    expect(e.statuses.rooted).toBeTruthy(); expect(e.apMod).toBeLessThan(0);
  });
  it('Bruma de sombras: ralentiza a todos en el área', () => {
    const s = fight([hero('acechador', 1, 3, ['s_bruma']), foe(4, 3), foe(4, 4)]);
    const u = me(s);
    expect(cast(s, u.id, 's_bruma', { x: 4, y: 3 }).ok).toBe(true);
    expect(s.units.slice(1).every((e) => !!e.statuses.slow)).toBe(true);
  });
  it('Resguardo de zorro y Runa de poder apoyan a un aliado', () => {
    const s = fight([hero('zorro', 1, 3, ['z_resguardo']), hero('arquitecto', 2, 3, ['r_runa']), foe(10, 3)]);
    const z = s.units[0]!, r = s.units[1]!;
    s.turn = s.order.indexOf(z.id); z.ap = 10;
    expect(cast(s, z.id, 'z_resguardo', r.pos).ok).toBe(true);
    expect(r.shield).toBe(10); expect(r.mpMod).toBe(1);
    s.turn = s.order.indexOf(r.id); r.ap = 10;
    expect(cast(s, r.id, 'r_runa', z.pos).ok).toBe(true);
    expect(z.statuses.empower?.stacks).toBe(2);
  });
  it('Bengala arcana: marca a los enemigos del área', () => {
    const s = fight([hero('pistolero', 1, 3, ['g_bengala']), foe(5, 3), foe(5, 4)]);
    const u = me(s);
    expect(cast(s, u.id, 'g_bengala', { x: 5, y: 3 }).ok).toBe(true);
    expect(s.units.slice(1).every((e) => !!e.statuses.mark)).toBe(true);
  });
});

describe('H5 · bendiciones del Arquero', () => {
  it('son 10, propias y entran en su oferta según lo equipado', () => {
    const own = Object.values(BLESSINGS).filter((b) => b.cls === 'arquero');
    expect(own).toHaveLength(10);
    const run = newRun('H5', 2, [{ owner: 'a', name: 'A', cls: 'arquero', routes: ['base'], kit: ['flecha', 'tiro_rasante', 'a_letal', 'a_ignea'] }]);
    const pool = blessingPool(run.heroes[0]!);
    expect(pool).toContain('ab_viento');
    expect(pool).not.toContain('ab_cepos'); // sin Campo de cepos
    expect(pool).not.toContain('ab_cetrero'); // sin Halcón
    expect(pool).not.toContain('ab_ojo'); // sin Ojo de halcón
  });
  it('Lectura del viento sube el tope de Distancia letal', () => {
    const s = fight([hero('arquero', 0, 0), foe(10, 0)]);
    const u = me(s), e = s.units[1]!;
    expect(archerBonus(u, e)).toBe(3);
    u.traits = ['viento'];
    expect(archerBonus(u, e)).toBe(ARCHER_WIND_MAX);
  });
  it('Acecho de la presa: +3 contra enemigos frenados', () => {
    const hit = (slow: boolean): number => {
      const s = fight([hero('arquero', 1, 3, [], ['presa']), foe(4, 3)]);
      const e = s.units[1]!; if (slow) e.statuses.slow = { turns: 2, stacks: 1 };
      s.rng = 99; cast(s, me(s).id, 'flecha', e.pos); return 300 - e.hp;
    };
    expect(hit(true) - hit(false)).toBe(3);
  });
  it('Puntas de escarcha: a 4 casillas o más ralentiza', () => {
    const s = fight([hero('arquero', 1, 3, [], ['escarcha']), foe(5, 3), foe(3, 4)]);
    const u = me(s);
    cast(s, u.id, 'flecha', { x: 5, y: 3 });
    expect(s.units[1]!.statuses.slow).toBeTruthy();
    cast(s, u.id, 'flecha', { x: 3, y: 4 });
    expect(s.units[2]!.statuses.slow).toBeFalsy();
  });
  it('Cepos afilados: +6 de daño y sangrado', () => {
    const plain = fight([hero('arquero', 1, 3, ['a_campo']), foe(9, 3)]);
    cast(plain, me(plain).id, 'a_campo', { x: 2, y: 3 });
    const sharp = fight([hero('arquero', 1, 3, ['a_campo'], ['cepos']), foe(9, 3)]);
    cast(sharp, me(sharp).id, 'a_campo', { x: 2, y: 3 });
    expect(sharp.snares![0]!.dmg - plain.snares![0]!.dmg).toBe(6);
    expect(sharp.snares![0]!.bleed).toBe(2);
  });
  it('Vínculo del cetrero: halcón con +50% de vida y +2 de daño', () => {
    const pet = (traits: string[]): Unit => { const s = fight([hero('arquero', 1, 3, ['a_halcon'], traits), foe(10, 3)]); cast(s, me(s).id, 'a_halcon', { x: 2, y: 3 }); return s.units.find((x) => x.summoner === me(s).id)!; };
    const a = pet([]), b = pet(['cetrero']);
    expect(b.maxHp).toBe(Math.round(a.maxHp * 1.5));
    expect(b.power).toBe(a.power + 2);
  });
  it('Ojo certero: con Ojo de halcón activo, +15% de crítico', () => {
    const s = fight([hero('arquero', 1, 3, [], ['ojocert']), foe(4, 3)]);
    const u = me(s); u.crit = 85; u.statuses.reach = { turns: 2, stacks: 2 };
    let crits = 0;
    for (let i = 0; i < 6; i++) { u.ap = 30; const r = cast(s, u.id, 'flecha', s.units[1]!.pos); if (r.ok && r.events.some((e) => e.t === 'damage' && 'crit' in e && e.crit)) crits++; }
    expect(crits).toBe(6);
  });
  it('Paso del cazador: rematar a distancia da +2 PM una vez por turno', () => {
    const s = fight([hero('arquero', 1, 3, [], ['pasocaz']), foe(4, 3), foe(4, 5)]);
    const u = me(s), mp = u.mp;
    s.units[1]!.hp = 1; s.units[2]!.hp = 1;
    cast(s, u.id, 'flecha', s.units[1]!.pos);
    expect(u.mp).toBe(mp + 2);
    cast(s, u.id, 'flecha', s.units[2]!.pos);
    expect(u.mp).toBe(mp + 2);
  });
  it('Retirada táctica: con un enemigo pegado al empezar, +1 PM y sin placaje', () => {
    const s = createCombat({ seed: 7, w: 12, h: 8, obstacles: [], units: [hero('arquero', 1, 3, [], ['retirada']), foe(2, 3)] }).state;
    for (let i = 0; i < 6 && current(s)!.team !== 'hero'; i++) endTurn(s, current(s)!.id);
    const u = me(s);
    expect(u.mistWalk).toBe(true);
  });
});
