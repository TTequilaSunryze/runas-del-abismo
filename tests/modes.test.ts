import { describe, expect, it } from 'vitest';
import { buildFight, dailyOf, finishFight, heroMaxHp, heroSpec, newRun, priceOf, recordEvents } from '../src/game/run';
import { cast, createCombat, current } from '../src/core/combat/engine';

const P = [{ owner: 'p0', name: 'A', cls: 'guerrero' as const, routes: ['baluarte'] }];

describe('ascensión', () => {
  it('endurece a los enemigos y encarece la tienda', () => {
    const easy = newRun('T', 7, P), hard = newRun('T', 7, P, { asc: 9 });
    easy.kind = hard.kind = 'combat';
    const hpOf = (r: typeof easy) => buildFight(r).units.filter((u) => u.team === 'enemy').reduce((a, u) => a + u.maxHp, 0) / buildFight(r).units.filter((u) => u.team === 'enemy').length;
    expect(hpOf(hard)).toBeGreaterThan(hpOf(easy));
    expect(priceOf(hard, 100)).toBe(125);
    expect(hard.heroes[0]!.hp).toBeLessThan(heroMaxHp(hard.heroes[0]!));
  });
  it('los élites llevan modificadores', () => {
    const run = newRun('T', 7, P, { asc: 2 });
    run.kind = 'elite';
    const elite = buildFight(run).units.find((u) => u.rank === 'elite')!;
    expect(elite.name.split(',').length).toBe(2);
  });
});

describe('reto diario', () => {
  it('la misma fecha da la misma semilla, modificadores y mapa', () => {
    expect(dailyOf('2026-11-16')).toEqual(dailyOf('2026-11-16'));
    expect(dailyOf('2026-11-16').mods).toHaveLength(2);
    const a = newRun('A', 1, P, { daily: '2026-11-16' }), b = newRun('B', 999, P, { daily: '2026-11-16' });
    expect(a.map).toEqual(b.map);
    expect(a.asc).toBe(3);
  });
});

describe('mejoras permanentes retiradas', () => {
  it('ya no existen: sin vida ni oro extra; el botín de élite es individual (+1 solo con la lupa)', () => {
    const run = newRun('T', 3, P);
    const h = run.heroes[0]!;
    expect('perks' in h).toBe(false);
    expect('rerolls' in h).toBe(false);
    expect(h.gold).toBe(0);
    expect(h.boon.hp ?? 0).toBe(0);
    const loot = (lupa: boolean): number => {
      const r = newRun('T', 3, P), x = r.heroes[0]!;
      if (lupa) x.relics.push('lupa');
      x.boonOffer = null;
      r.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(x, { x: 1, y: 1 })] }).state;
      r.combat.over = 'win'; r.phase = 'combat'; r.kind = 'elite'; r.pact = 'tirano';
      finishFight(r);
      expect(r.offers.p0).toBeUndefined();
      return r.report!.items.length;
    };
    expect(loot(false)).toBe(1);
    // la Lupa del tasador era una reliquia: el sistema se retiró y ya no da una opción más
    expect(loot(true)).toBe(1);
    void heroMaxHp;
  });
});

describe('estadísticas', () => {
  it('cuentan daño y bajas del héroe que lanza', () => {
    const run = newRun('T', 5, P);
    run.kind = 'combat';
    run.combat = createCombat(buildFight(run)).state;
    const c = run.combat;
    const hero = c.units.find((u) => u.team === 'hero')!;
    const foe = c.units.find((u) => u.team === 'enemy')!;
    while (current(c)!.id !== hero.id) c.turn = (c.turn + 1) % c.order.length;
    hero.pos = { x: foe.pos.x - 1, y: foe.pos.y };
    if (c.obstacles.includes(`${hero.pos.x},${hero.pos.y}`)) c.obstacles = [];
    foe.hp = 1; foe.shield = 0;
    const track = { caster: null as number | null };
    const r = cast(c, hero.id, 'tajo', foe.pos);
    expect(r.ok).toBe(true);
    if (r.ok) recordEvents(run, r.events, track);
    expect(run.heroes[0]!.stats.kills).toBe(1);
    expect(run.heroes[0]!.stats.dmg).toBeGreaterThan(0);
  });
});
