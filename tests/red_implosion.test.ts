// Red de implosión (Tejedora): conexiones entre Semillas oscuras y la Implosión con objetivo.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { SEED_DMG, SEED_LINK_DMG, cast, createCombat, current, endTurn, implodePreview, seedLinks, seedNetwork, type UnitSpec } from '../src/core/combat/engine';
import type { CombatState, Unit } from '../src/core/state';

const tej = (spells = ['t_semilla', 't_implosion']): UnitSpec => { const h = makeHero({ cls: 'esferas', name: 'T', owner: 'p1', routes: [], pos: { x: 0, y: 0 }, level: 1 }); return { ...h, crit: 0, armor: 0, spells: spells.map((id) => ({ id, cd: 0 })) }; };
const foe = (x: number, y: number) => ({ ...makeEnemy('esqueleto', { x, y }), hp: 999, maxHp: 999, armor: 0, initiative: 1, traits: [] as string[] });
function board(extra: UnitSpec[] = [], obstacles: { x: number; y: number }[] = [], spells?: string[]): { s: CombatState; u: Unit } {
  const s = createCombat({ seed: 3, w: 12, h: 9, obstacles, units: [tej(spells), ...extra] }).state;
  const u = s.units[0]!;
  for (let i = 0; i < 20 && current(s)!.id !== u.id; i++) endTurn(s, current(s)!.id);
  u.ap = 50;
  return { s, u };
}
/** Planta semillas saltándose el límite de 3 por turno (para montar las pruebas). */
function plant(s: CombatState, u: Unit, cells: Array<[number, number]>): Unit[] {
  for (const [x, y] of cells) { for (const sp of u.spells) { sp.uses = 0; } u.pos = [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]].map(([a, b]) => ({ x: a!, y: b! })).find((p) => p.x >= 0 && p.y >= 0 && p.x < 12 && p.y < 9 && !s.units.some((q) => q.hp > 0 && q !== u && q.pos.x === p.x && q.pos.y === p.y))!; const r = cast(s, u.id, 't_semilla', { x, y }); expect(r.ok, r.ok ? '' : r.reason).toBe(true); }
  u.pos = { x: 0, y: 8 };
  return cells.map(([x, y]) => s.units.find((q) => q.seed !== undefined && q.pos.x === x && q.pos.y === y)!);
}
const pairs = (s: CombatState, u: Unit): string[] => seedLinks(s, u).map((l) => { const a = s.units.find((q) => q.id === l.a)!, b = s.units.find((q) => q.id === l.b)!; return `${a.pos.x},${a.pos.y}-${b.pos.x},${b.pos.y}`; }).sort();
const implode = (s: CombatState, u: Unit, x: number, y: number) => { for (const sp of u.spells) sp.uses = 0; const r = cast(s, u.id, 't_implosion', { x, y }); expect(r.ok, r.ok ? '' : r.reason).toBe(true); };

describe('Red de implosión', () => {
  it('horizontal y vertical sí; diagonal no', () => {
    const { s, u } = board();
    plant(s, u, [[3, 3], [6, 3], [3, 6], [8, 5]]);
    expect(pairs(s, u)).toEqual(['3,3-3,6', '3,3-6,3']);
  });

  it('tres semillas en línea: dos conexiones consecutivas', () => {
    const { s, u } = board();
    plant(s, u, [[2, 4], [5, 4], [9, 4]]);
    expect(pairs(s, u)).toEqual(['2,4-5,4', '5,4-9,4']);
    expect(seedLinks(s, u).map((l) => l.cells.length).sort()).toEqual([2, 3]);
  });

  it('un obstáculo corta la conexión', () => {
    const { s, u } = board([], [{ x: 5, y: 2 }]);
    plant(s, u, [[3, 2], [7, 2]]);
    expect(pairs(s, u)).toEqual([]);
  });

  it('sin Implosión equipada no hay red', () => {
    const { s, u } = board([], [], ['t_semilla']);
    plant(s, u, [[3, 3], [6, 3]]);
    expect(seedLinks(s, u)).toEqual([]);
  });

  it('una semilla en dos conexiones une la red (en L) y el enemigo cruzado por dos recibe ambas', () => {
    const { s, u } = board([foe(5, 5)]);
    const e = s.units.find((q) => q.kind === 'esqueleto')!;
    // la de (5,3) une la horizontal y la vertical; el enemigo en (5,5) está en la vertical (5,3)-(5,7) y en la horizontal (2,5)-(8,5)
    plant(s, u, [[2, 3], [5, 3], [5, 7], [2, 5], [8, 5]]);
    expect(seedNetwork(s, u, s.units.find((q) => q.seed !== undefined && q.pos.x === 2 && q.pos.y === 3)!.id).seeds).toHaveLength(5);
    const hp = e.hp;
    implode(s, u, 2, 3);
    // daño: dos conexiones (sin semilla junto a él)
    expect(hp - e.hp).toBe(2 * SEED_LINK_DMG);
    expect(s.units.filter((q) => q.seed !== undefined && q.hp > 0)).toHaveLength(0);
  });

  it('semilla aislada: solo explota ella; otra red no se toca', () => {
    const { s, u } = board([foe(9, 7)]);
    const [lone] = plant(s, u, [[2, 7], [6, 2], [9, 2]]);
    implode(s, u, 2, 7);
    expect(lone!.hp).toBe(0);
    expect(s.units.filter((q) => q.seed !== undefined && q.hp > 0)).toHaveLength(2);
    implode(s, u, 6, 2);
    expect(s.units.filter((q) => q.seed !== undefined && q.hp > 0)).toHaveLength(0);
  });

  it('detonar una red hace la explosión de cada semilla y el daño de cada conexión', () => {
    const { s, u } = board([foe(4, 4), foe(7, 3)]);
    const [near, mid] = s.units.filter((q) => q.kind === 'esqueleto');
    plant(s, u, [[3, 3], [9, 3]]);
    const a = near!.hp, b = mid!.hp;
    implode(s, u, 9, 3);
    expect(a - near!.hp).toBe(SEED_DMG);
    expect(b - mid!.hp).toBe(SEED_LINK_DMG);
  });

  it('las conexiones se actualizan al destruirse o moverse una semilla', () => {
    const { s, u } = board();
    const [a, b, c] = plant(s, u, [[2, 2], [5, 2], [8, 2]]);
    expect(pairs(s, u)).toEqual(['2,2-5,2', '5,2-8,2']);
    b!.hp = 0;
    expect(pairs(s, u)).toEqual(['2,2-8,2']);
    c!.pos = { x: 8, y: 5 };
    expect(pairs(s, u)).toEqual([]);
    expect(implodePreview(s, u, a!.id).lines).toEqual([]);
  });

  it('Implosión pide una semilla tuya', () => {
    const { s, u } = board();
    plant(s, u, [[4, 4]]);
    expect(cast(s, u.id, 't_implosion', { x: 5, y: 5 }).ok).toBe(false);
    expect(cast(s, u.id, 't_implosion', u.pos).ok).toBe(false);
  });
});
