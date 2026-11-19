import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/core/classes/classes';
import { SPELLS } from '../src/core/classes/spells';
import { cast, createCombat, current, endTurn, move, type UnitSpec } from '../src/core/combat/engine';
import { makeHero } from '../src/core/classes/factory';
import { makeEnemy } from '../src/content/enemies';
import { tuned, UPGRADES } from '../src/core/upgrades';
import { championOf, cleanChampion, finishFight, heroSpec, metaAction, newArena, newRun, type Champion } from '../src/game/run';
import { autoplay } from './helpers';

const hero = (cls: 'arquero' | 'guerrero', routes: string[], pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls, name: 'H', owner: 'p0', routes, pos, level: 3 });
const board = (units: UnitSpec[]) => createCombat({ seed: 5, w: 12, h: 7, obstacles: [], units }).state;

describe('arquero', () => {
  it('tiene 4 rutas de 3 hechizos que existen', () => {
    for (const r of CLASSES.arquero.routes) { expect(r.spells).toHaveLength(3); for (const id of r.spells) expect(SPELLS[id]).toBeTruthy(); }
  });
  it('no puede disparar a un enemigo pegado', () => {
    const s = board([hero('arquero', ['francotirador']), makeEnemy('limo', { x: 2, y: 3 })]);
    const me = s.units[0]!;
    while (current(s)!.id !== me.id) endTurn(s, current(s)!.id);
    expect(cast(s, me.id, 'flecha', { x: 2, y: 3 }).ok).toBe(false);
  });
  it('el cepo daña y detiene al enemigo que lo pisa', () => {
    const s = board([hero('arquero', ['trampero']), makeEnemy('esqueleto', { x: 6, y: 3 })]);
    const me = s.units[0]!, foe = s.units[1]!;
    while (current(s)!.id !== me.id) endTurn(s, current(s)!.id);
    expect(cast(s, me.id, 'cepo', { x: 4, y: 3 }).ok).toBe(true);
    expect(s.snares).toHaveLength(1);
    endTurn(s, me.id);
    const hp = foe.hp;
    const r = move(s, foe.id, { x: 3, y: 3 });
    expect(r.ok).toBe(true);
    expect(foe.pos).toEqual({ x: 4, y: 3 });
    expect(foe.hp).toBeLessThan(hp);
    expect(s.snares).toHaveLength(0);
  });
  it('el lobo lucha solo y no sostiene el combate si cae el arquero', () => {
    const s = board([hero('arquero', ['bestias']), makeEnemy('esqueleto', { x: 6, y: 3 })]);
    const me = s.units[0]!;
    while (current(s)!.id !== me.id) endTurn(s, current(s)!.id);
    expect(cast(s, me.id, 'lobo', { x: 2, y: 3 }).ok).toBe(true);
    const wolf = s.units.find((u) => u.summoner === me.id)!;
    expect(wolf.team).toBe('hero');
    expect(cast(s, me.id, 'lobo', { x: 1, y: 4 }).ok).toBe(false);
    autoplay(s);
    expect(s.over).toBeTruthy();
  });
  it('el tiro perforante atraviesa en línea', () => {
    const a = hero('arquero', ['francotirador']);
    const s = board([a, makeEnemy('esqueleto', { x: 4, y: 3 }), makeEnemy('esqueleto', { x: 6, y: 3 })]);
    const me = s.units[0]!;
    while (current(s)!.id !== me.id) endTurn(s, current(s)!.id);
    const r = cast(s, me.id, 'perforante', { x: 6, y: 3 });
    expect(r.ok && r.events.filter((e) => e.t === 'damage').length).toBe(2);
  });
});

describe('mejoras de hechizo', () => {
  it('los hechizos solo se ofrecen al vencer al jefe: 3 hechizos nuevos', () => {
    const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'zorro', routes: [] }]);
    const h = run.heroes[0]!;
    expect(h.boonOffer).toBeNull(); expect(h.bossOffer).toBeNull();
    for (const kind of ['combat', 'combat', 'elite'] as const) {
      run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
      run.combat.over = 'win'; run.phase = 'combat'; run.kind = kind;
      finishFight(run);
      expect(h.bossOffer).toBeNull(); expect(h.boonOffer).toBeNull();
      delete run.offers.a;
    }
    run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
    run.combat.over = 'win'; run.phase = 'combat'; run.kind = 'boss';
    finishFight(run);
    const o = h.bossOffer!;
    expect(o).toHaveLength(3);
    for (const x of o) expect(x.kind).toBe('spell');
    expect(new Set(o.map((x) => (x as { id: string }).id)).size).toBe(3);
    expect(run.report?.turns).toBeGreaterThan(0);
    expect(metaAction(run, 'a', { a: 'bossreward', idx: 0 })).toBeNull();
    expect(h.bossOffer).toBeNull();
    expect(h.boons).toContain((o[0] as { id: string }).id);
  });
  it('potenciado suma +3 de daño', () => {
    const d = tuned(SPELLS.tajo!, { ups: ['pot'] });
    expect(d.dmg![0]).toBe(SPELLS.tajo!.dmg![0] + 3);
    expect(Object.keys(UPGRADES).length).toBeGreaterThan(5);
  });
});

describe('salón y duelos', () => {
  const run = newRun('T', 3, [{ owner: 'a', name: 'Ana', cls: 'guerrero', routes: ['baluarte'] }, { owner: 'b', name: 'Leo', cls: 'mago', routes: ['fuego'] }, { owner: 'c', name: 'Sara', cls: 'arquero', routes: ['francotirador'] }]);
  for (const h of run.heroes) h.level = 8;
  const team = run.heroes.map((h) => championOf(run, h));
  it('limpia los héroes que llegan de fuera', () => {
    const bad = { ...team[0]!, level: 99, routes: ['baluarte', 'berserker'], equip: { arma: { slot: 'arma', name: 'x', rarity: 9, stats: { power: 9999, ap: 20 } } } } as unknown as Champion;
    const c = cleanChampion(bad)!;
    expect(c.level).toBe(12);
    expect(c.routes).toEqual(['baluarte']);
    expect(c.equip.arma!.stats.power).toBe(60);
    expect(c.equip.arma!.stats.ap).toBe(1);
    expect(cleanChampion({ cls: 'nada' })).toBeNull();
  });
  it('un duelo contra la IA termina', () => {
    const a = newArena('DUEL', 9, { owner: 'me', name: 'Yo', team }, { owner: null, name: 'IA', team })!;
    const c = a.combat!;
    expect(c.units.filter((u) => u.team === 'enemy' && u.ai === 'champ')).toHaveLength(3);
    // mi bando también lo juega la IA de héroes para la prueba
    for (const u of c.units) if (u.team === 'hero') u.ai = 'champ';
    autoplay(c, 800);
    expect(c.over).toBeTruthy();
    finishFight(a);
    expect(['won', 'lost']).toContain(a.phase);
  });
  it('el némesis aparece como élite en la zona 2', () => {
    let seen = false;
    for (let seed = 1; seed < 12 && !seen; seed++) {
      const r = newRun('T', seed, [{ owner: 'a', name: 'A', cls: 'guerrero', routes: ['baluarte'] }], { nemesis: team });
      r.zone = 1; r.kind = 'elite';
      seen = r.nemesis.length === 3 && !!(awaitFight(r));
    }
    expect(seen).toBe(true);
  });
});

import { buildFight } from '../src/game/run';
function awaitFight(r: ReturnType<typeof newRun>): boolean {
  return buildFight(r).units.some((u) => u.name.startsWith('Némesis: '));
}
