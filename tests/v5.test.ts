import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { CLASSES } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, move, tackleKeep, usableMp, type UnitSpec } from '../src/core/combat/engine';
import { finishFight, heroMaxHp, heroSpec, metaAction, newRun, offerBoon, waitingFor } from '../src/game/run';
import { spellKind } from '../src/ui/spellicons';

const hero = (cls: 'guerrero' | 'mago' | 'picaro' | 'arquero' | 'clerigo' = 'guerrero', pos = { x: 1, y: 3 }, routes: string[] = []): UnitSpec => makeHero({ cls, name: 'H', owner: 'p0', routes, pos, level: 3 });
const board = (units: UnitSpec[]) => createCombat({ seed: 9, w: 12, h: 7, obstacles: [], units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 30 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('kit inicial', () => {
  it('cada clase empieza con 3 habilidades: 2 de daño y 1 de potenciación propia', () => {
    for (const c of Object.values(CLASSES)) {
      expect(c.base).toHaveLength(3);
      const kinds = c.base.map((id) => SPELLS[id]!);
      expect(kinds.filter((d) => d.dmg && d.target === 'enemy').length, c.id).toBeGreaterThanOrEqual(2);
      expect(kinds.filter((d) => d.target === 'self').length, c.id).toBe(1);
      expect(spellKind(kinds[2]!)).not.toBe('dmg');
    }
  });
  it('Sed de sangre cuesta vida y potencia el daño', () => {
    const s = board([hero('guerrero'), makeEnemy('gargola', { x: 2, y: 3 })]);
    const h = s.units[0]!;
    turnOf(s, h.id);
    const hp = h.hp;
    expect(cast(s, h.id, 'sed_sangre', h.pos).ok).toBe(true);
    expect(h.hp).toBe(hp - Math.round(hp * 0.15));
    expect(h.statuses.empower?.stacks).toBe(35);
  });
  it('Desvanecerse: no se le puede apuntar y atacar lo revela', () => {
    const s = board([hero('picaro'), makeEnemy('esqueleto', { x: 2, y: 3 })]);
    const h = s.units[0]!, e = s.units[1]!;
    turnOf(s, h.id);
    expect(cast(s, h.id, 'desvanecer', h.pos).ok).toBe(true);
    expect(castProblem(s, e, SPELLS.e_golpe!, h.pos)).toBe('No puedes ver al objetivo');
    expect(cast(s, h.id, 'punalada', e.pos).ok).toBe(true);
    expect(h.statuses.invis).toBeUndefined();
  });
  it('Ojo de halcón da alcance', () => {
    const s = board([hero('arquero'), makeEnemy('limo', { x: 8, y: 3 })]);
    const h = s.units[0]!;
    turnOf(s, h.id);
    expect(castProblem(s, h, SPELLS.flecha!, { x: 8, y: 3 })).toBe('Fuera de alcance');
    cast(s, h.id, 'ojo_halcon', h.pos);
    expect(castProblem(s, h, SPELLS.flecha!, { x: 8, y: 3 })).toBeNull();
  });
});

describe('élites y jefes', () => {
  it('son inmunes a aturdir', () => {
    const boss = makeEnemy('prior', { x: 2, y: 3 });
    expect(boss.rank).toBe('boss');
    const s = board([hero('mago', { x: 1, y: 3 }, ['hielo']), boss]);
    const h = s.units[0]!, b = s.units[1]!;
    h.ap = 99;
    turnOf(s, h.id);
    h.ap = 99;
    const r = cast(s, h.id, 'congelar', b.pos);
    expect(r.ok && r.events.some((e) => e.t === 'resist')).toBe(true);
    expect(b.statuses.stun).toBeUndefined();
  });
  it('quitar PM: dos tiradas por punto (resisten bastante más que los normales)', () => {
    let normal = 0, boss = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const isBoss of [false, true]) {
        const foe = makeEnemy('gargola', { x: 3, y: 3 });
        if (isBoss) foe.rank = 'elite';
        const s = createCombat({ seed, w: 10, h: 7, obstacles: [], units: [hero('mago', { x: 1, y: 3 }, ['hielo']), foe] }).state;
        const h = s.units[0]!, f = s.units[1]!;
        turnOf(s, h.id);
        cast(s, h.id, 'escarcha', f.pos);
        const got = f.statuses.slow?.stacks ?? 0;
        if (isBoss) boss += got; else normal += got;
      }
    }
    expect(normal).toBeGreaterThan(boss * 1.5);
    expect(boss).toBeGreaterThan(0);
  });
});

describe('placaje', () => {
  it('alejarse de enemigos pegados cuesta PM', () => {
    expect(tackleKeep(2, 0)).toBe(1);
    expect(tackleKeep(2, 10)).toBeLessThan(0.5);
    const s = board([hero('mago', { x: 1, y: 3 }), makeEnemy('gargola', { x: 2, y: 3 }), makeEnemy('esqueleto', { x: 1, y: 2 })]);
    const h = s.units[0]!;
    turnOf(s, h.id);
    expect(usableMp(s, h)).toBeLessThan(h.mp);
    const r = move(s, h.id, { x: 0, y: 4 });
    expect(r.ok && r.events.some((e) => e.t === 'tackle')).toBe(true);
  });
  it('el pícaro escapa mejor que el mago', () => {
    const at = (cls: 'mago' | 'picaro') => { const s = board([hero(cls, { x: 1, y: 3 }), makeEnemy('gargola', { x: 2, y: 3 })]); const h = s.units[0]!; h.mp = 4; return usableMp(s, h); };
    expect(at('picaro')).toBeGreaterThan(at('mago'));
  });
});

describe('consumibles, bendiciones y botín', () => {
  it('las pociones se gastan y lo gastado no vuelve', () => {
    const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'guerrero', routes: ['baluarte'] }]);
    const h = run.heroes[0]!;
    h.bag2 = { c_vida: 2, c_fuego: 1 };
    const u = heroSpec(h, { x: 1, y: 3 });
    expect(u.spells.find((x) => x.id === 'c_vida')!.charges).toBe(2);
    const s = board([u, makeEnemy('limo', { x: 5, y: 3 })]);
    const me = s.units[0]!;
    me.hp = 10;
    turnOf(s, me.id);
    expect(cast(s, me.id, 'c_vida', me.pos).ok).toBe(true);
    expect(me.hp).toBeGreaterThan(10);
    run.combat = s; run.phase = 'combat'; run.kind = 'combat'; s.over = 'win';
    finishFight(run);
    expect(h.bag2.c_vida).toBeLessThanOrEqual(2);
    expect(h.bag2.c_vida! + (h.bag2.c_fuego ?? 0)).toBeGreaterThanOrEqual(2);
  });
  it('la poción de resurrección levanta a un aliado caído', () => {
    const a = makeHero({ cls: 'clerigo', name: 'A', owner: 'a', routes: [], pos: { x: 1, y: 3 } });
    const b = makeHero({ cls: 'guerrero', name: 'B', owner: 'b', routes: [], pos: { x: 2, y: 3 } });
    a.spells.push({ id: 'c_resu', cd: 0, charges: 1 });
    const s = board([a, b, makeEnemy('limo', { x: 9, y: 0 })]);
    const A = s.units[0]!, B = s.units[1]!;
    B.hp = 0;
    turnOf(s, A.id);
    const r = cast(s, A.id, 'c_resu', B.pos);
    expect(r.ok).toBe(true);
    expect(B.hp).toBe(Math.round(B.maxHp * 0.4));
  });
  it('bendición: 3 habilidades de un patrón, se añaden al héroe', () => {
    const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'mago', routes: ['fuego'] }]);
    const h = run.heroes[0]!;
    offerBoon(run, h);
    expect(h.boonOffer!.spells).toHaveLength(3);
    const sp = h.boonOffer!.spells[0]!;
    expect(metaAction(run, 'a', { a: 'boon', idx: 0 })).toBeNull();
    expect(heroSpec(h).spells.some((x) => x.id === sp)).toBe(true);
    h.boons = ['b_llamarada', 'b_infierno'];
    expect(heroSpec(h).power).toBe(heroSpec({ ...h, boons: [] }).power + 10);
    h.boons.push('b_fenix');
    expect(heroSpec(h).traits).toContain('ignite');
  });
  it('equiparse algo con vida suma esa vida a la actual', () => {
    const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'guerrero', routes: ['baluarte'] }]);
    const h = run.heroes[0]!;
    h.hp = heroMaxHp(h) - 10;
    h.bag.push({ slot: 'peto', name: 'Peto', rarity: 1, stats: { hp: 20 } });
    metaAction(run, 'a', { a: 'equip', idx: 0 });
    expect(h.hp).toBe(heroMaxHp(h) - 10);
  });
  it('el anfitrión espera a que todos elijan y pulsen Listo', () => {
    const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'guerrero', routes: ['baluarte'] }, { owner: 'b', name: 'B', cls: 'mago', routes: ['fuego'] }]);
    run.stamp = 1;
    run.offers.b = [];
    expect(waitingFor(run, ['a', 'b'], 'a').map((h) => h.owner)).toEqual(['b']);
    expect(metaAction(run, 'b', { a: 'ready' })).toMatch(/Antes elige/);
    delete run.offers.b;
    expect(metaAction(run, 'b', { a: 'ready' })).toBeNull();
    expect(waitingFor(run, ['a', 'b'], 'a')).toEqual([]);
    // si se desconecta, no se le espera
    run.ready = {};
    expect(waitingFor(run, ['a'], 'a')).toEqual([]);
  });
  it('lo raro sale más cuanto más profundo', async () => {
    const { rollRarity } = await import('../src/core/items/items');
    const box = { rng: 12345 };
    const avg = (d: number) => { let t = 0; for (let i = 0; i < 2000; i++) t += rollRarity(box, d); return t / 2000; };
    expect(avg(18)).toBeGreaterThan(avg(1) + 0.4);
  });
});
