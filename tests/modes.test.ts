import { describe, expect, it } from 'vitest';
import { buildFight, dailyOf, finishFight, heroMaxHp, heroSpec, metaAction, newRun, priceOf, recordEvents } from '../src/game/run';
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

describe('mejoras permanentes', () => {
  it('dan vida, oro, runas, opciones de botín y re-tiradas', () => {
    const base = newRun('T', 3, P);
    const boosted = newRun('T', 3, [{ ...P[0]!, perks: { vit: 5, gold: 2, loot: 1, reroll: 1, hack: 99 } }]);
    const h = boosted.heroes[0]!;
    expect(heroMaxHp(h)).toBeGreaterThan(heroMaxHp(base.heroes[0]!));
    expect(h.gold).toBe(50);
    h.boonOffer = null; h.spellOffers = 3;
    boosted.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
    boosted.combat.over = 'win'; boosted.phase = 'combat'; boosted.kind = 'boss';
    finishFight(boosted);
    expect(boosted.offers.p0).toHaveLength(4);
    const first = boosted.offers.p0!.map((i) => i.name).join();
    expect(metaAction(boosted, 'p0', { a: 'reroll' })).toBeNull();
    expect(metaAction(boosted, 'p0', { a: 'reroll' })).toBe('No te quedan re-tiradas en esta zona');
    expect(boosted.offers.p0).toHaveLength(4);
    void first;
  });
  it('los niveles fuera de rango se recortan', () => {
    const r = newRun('T', 3, [{ ...P[0]!, perks: { vit: 999, gold: -5 } }]);
    expect(r.heroes[0]!.perks.vit).toBe(5);
    expect(r.heroes[0]!.gold).toBe(0);
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
