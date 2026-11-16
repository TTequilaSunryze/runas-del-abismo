import { describe, expect, it } from 'vitest';
import { autoplay } from './helpers';
import { makeEnemy } from '../src/content/enemies';
import { blockedRoutes, canPickRoute, spellsFor } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { runAiTurn } from '../src/core/combat/ai';
import { cast, castProblem, createCombat, current, endTurn, getUnit, move, type CombatSetup } from '../src/core/combat/engine';
import { hasLineOfSight } from '../src/core/combat/grid';
import { rand, seedFrom } from '../src/core/rng';
import { deserialize, serialize } from '../src/core/state';

const setup = (over: Partial<CombatSetup> = {}): CombatSetup => ({
  seed: 42, w: 12, h: 7, obstacles: [],
  units: [
    makeHero({ cls: 'guerrero', name: 'Ana', owner: 'p1', routes: ['baluarte', 'duelista'], pos: { x: 1, y: 3 } }),
    makeHero({ cls: 'mago', name: 'Leo', owner: 'p2', routes: ['tormenta'], pos: { x: 1, y: 2 } }),
    makeEnemy('esqueleto', { x: 8, y: 3 }),
    makeEnemy('arquero', { x: 9, y: 2 }),
  ],
  ...over,
});

describe('azar por semilla', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = { rng: seedFrom('abismo') }, b = { rng: seedFrom('abismo') };
    expect([rand(a), rand(a), rand(a)]).toEqual([rand(b), rand(b), rand(b)]);
  });
});

describe('kits iniciales', () => {
  it('se elige un solo kit de 3 habilidades (sin rutas opuestas)', () => {
    expect(blockedRoutes('mago', ['fuego'])).toEqual([]);
    expect(canPickRoute('mago', [], 'hielo')).toBe(true);
    expect(canPickRoute('mago', ['fuego'], 'hielo')).toBe(false);
    expect(spellsFor('clerigo', [])).toEqual(['maza', 'castigo', 'fervor']);
    expect(spellsFor('clerigo', ['luz'])).toEqual(['maza', 'sanar', 'aura']);
    // si llegan dos, solo cuenta el primero
    expect(makeHero({ cls: 'mago', name: 'x', owner: 'p', routes: ['fuego', 'hielo'], pos: { x: 0, y: 0 } }).spells.map((s) => s.id)).toEqual(['ignicion', 'bola', 'lluvia']);
  });
  it('todos los kits tienen 3 hechizos que existen', () => {
    for (const cls of ['guerrero', 'mago', 'clerigo', 'picaro', 'arquero'] as const)
      for (const r of ['base', 'baluarte', 'berserker', 'caudillo', 'duelista', 'fuego', 'hielo', 'tormenta', 'arcano', 'luz', 'penitencia', 'egida', 'juicio']) {
        const list = spellsFor(cls, [r]);
        expect(list).toHaveLength(3);
        for (const id of list) expect(SPELLS[id], id).toBeDefined();
      }
  });
});

describe('combate por iniciativa', () => {
  it('ordena por iniciativa y solo juega la unidad actual', () => {
    const { state: s } = createCombat(setup());
    expect(s.order.map((id) => getUnit(s, id)!.kind)).toEqual(['mago', 'arquero', 'guerrero', 'esqueleto']);
    const ana = s.units.find((u) => u.name === 'Ana')!;
    expect(move(s, ana.id, { x: 2, y: 3 })).toEqual({ ok: false, reason: 'No es tu turno' });
  });
  it('moverse gasta PM y no atraviesa obstáculos', () => {
    const { state: s } = createCombat(setup({ obstacles: [{ x: 2, y: 2 }] }));
    const leo = current(s)!;
    expect(move(s, leo.id, { x: 2, y: 2 }).ok).toBe(false);
    // detrás del obstáculo hacen falta 4 pasos (rodeándolo) y el mago tiene 3 PM
    expect(move(s, leo.id, { x: 3, y: 2 }).ok).toBe(false);
    expect(move(s, leo.id, { x: 2, y: 1 }).ok).toBe(true);
    expect(leo.mp).toBe(1);
  });
  it('los obstáculos bloquean la línea de visión', () => {
    const { state: s } = createCombat(setup({ obstacles: [{ x: 5, y: 2 }] }));
    expect(hasLineOfSight(s, { x: 1, y: 2 }, { x: 9, y: 2 })).toBe(false);
    expect(hasLineOfSight(s, { x: 1, y: 3 }, { x: 8, y: 3 })).toBe(true);
    const leo = current(s)!;
    leo.pos = { x: 4, y: 2 };
    expect(castProblem(s, leo, SPELLS.rayo!, { x: 9, y: 2 })).toBe('Sin línea de visión');
  });
  it('el daño respeta armadura y escudo, y el enfriamiento impide repetir', () => {
    const { state: s } = createCombat(setup());
    const leo = current(s)!;
    const esq = s.units.find((u) => u.kind === 'esqueleto')!;
    leo.spells.push({ id: 'congelar', cd: 0 });
    leo.pos = { x: 5, y: 3 };
    esq.shield = 3;
    const before = esq.hp;
    const r = cast(s, leo.id, 'congelar', esq.pos);
    expect(r.ok).toBe(true);
    expect(esq.shield).toBe(0);
    expect(esq.hp).toBeLessThanOrEqual(before);
    expect(esq.statuses.stun).toBeDefined();
    expect(cast(s, leo.id, 'congelar', esq.pos)).toEqual({ ok: false, reason: 'Hechizo en enfriamiento' });
  });
  it('un aturdido pierde su turno y quitar PA se aplica en su siguiente turno', () => {
    const { state: s } = createCombat(setup());
    const leo = current(s)!;
    const arq = s.units.find((u) => u.kind === 'arquero')!;
    leo.pos = { x: 6, y: 2 };
    expect(cast(s, leo.id, 'rayo', arq.pos).ok).toBe(true);
    const r = endTurn(s, leo.id);
    expect(r.ok).toBe(true);
    expect(current(s)!.id).toBe(arq.id);
    expect(arq.ap).toBe(arq.maxAp - 1);
  });
  it('las púas dañan a quien las pisa', () => {
    const { state: s } = createCombat(setup({ traps: [{ x: 2, y: 2 }] }));
    const leo = current(s)!;
    const before = leo.hp;
    expect(move(s, leo.id, { x: 3, y: 2 }).ok).toBe(true);
    expect(leo.hp).toBe(before - 6);
  });
  it('un hechizo de área alrededor de uno mismo golpea a los enemigos cercanos', () => {
    const { state: s } = createCombat(setup({ units: [
      makeHero({ cls: 'mago', name: 'Leo', owner: 'p2', routes: ['hielo'], pos: { x: 4, y: 3 } }),
      makeEnemy('esqueleto', { x: 5, y: 3 }), makeEnemy('limo', { x: 4, y: 5 }), makeEnemy('limo', { x: 9, y: 3 }),
    ] }));
    const leo = current(s)!;
    expect(cast(s, leo.id, 'ventisca', leo.pos).ok).toBe(true);
    const hit = s.units.filter((u) => u.team === 'enemy' && u.statuses.slow).map((u) => u.pos.x);
    expect(hit.sort()).toEqual([4, 5]);
  });
  it('guardar y cargar a mitad de combate da exactamente el mismo resultado', () => {
    const { state: a } = createCombat(setup());
    endTurn(a, current(a)!.id);
    runAiTurn(a);
    const b = deserialize(serialize(a));
    autoplay(a);
    autoplay(b);
    expect(a.over).not.toBeNull();
    expect(serialize(b)).toBe(serialize(a));
  });
  it('un combate completo siempre termina, con 1 a 4 jugadores', () => {
    for (let n = 1; n <= 4; n++) {
      const heroes = [
        makeHero({ cls: 'guerrero', name: 'A', owner: 'p1', routes: ['berserker'], pos: { x: 1, y: 3 } }),
        makeHero({ cls: 'mago', name: 'B', owner: 'p2', routes: ['fuego'], pos: { x: 1, y: 2 } }),
        makeHero({ cls: 'clerigo', name: 'C', owner: 'p3', routes: ['penitencia'], pos: { x: 1, y: 4 } }),
        makeHero({ cls: 'guerrero', name: 'D', owner: 'p4', routes: ['duelista'], pos: { x: 1, y: 1 } }),
      ].slice(0, n);
      const enemies = ['esqueleto', 'arquero', 'necrofago', 'murcielago', 'limo'].slice(0, n + 1).map((id, i) => makeEnemy(id, { x: 9, y: 1 + i }));
      const { state: s } = createCombat({ seed: 7 * n, w: 12, h: 7, obstacles: [{ x: 5, y: 3 }, { x: 6, y: 1 }], units: [...heroes, ...enemies] });
      autoplay(s);
      expect(s.over, `con ${n} jugadores`).not.toBeNull();
    }
  });
});
