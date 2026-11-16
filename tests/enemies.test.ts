import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { runAiTurn } from '../src/core/combat/ai';
import { cast, createCombat, current, endTurn, move, type UnitSpec } from '../src/core/combat/engine';
import type { CombatState } from '../src/core/state';
import { bossInfo, newRun } from '../src/game/run';

const hero = (x = 1, y = 3): UnitSpec => makeHero({ cls: 'mago', name: 'Leo', owner: 'p', routes: [], pos: { x, y } });
const fight = (units: UnitSpec[], obstacles = [] as { x: number; y: number }[]): CombatState => createCombat({ seed: 3, w: 12, h: 7, obstacles, units }).state;
/** Pasa turnos (héroes pasan, IA juega) hasta que le toque a `id`. */
function until(s: CombatState, id: number, info = bossInfo(newRun('T', 1, [{ owner: 'p', name: 'L', cls: 'mago', routes: ['fuego'] }]))): void {
  for (let i = 0; i < 20 && current(s)?.id !== id && !s.over; i++) {
    const u = current(s)!;
    if (u.ai) runAiTurn(s, info); else endTurn(s, u.id);
  }
}

describe('rasgos de enemigos', () => {
  it('el limo deja un charco al morir que detiene a los héroes', () => {
    const s = fight([hero(4, 3), makeEnemy('limo', { x: 6, y: 3 }), makeEnemy('esqueleto', { x: 11, y: 0 })]);
    const leo = s.units[0]!, limo = s.units[1]!;
    limo.hp = 1;
    until(s, leo.id);
    expect(cast(s, leo.id, 'dardo', limo.pos).ok).toBe(true);
    expect(s.puddles).toContain('6,3');
    leo.mp = 3;
    const r = move(s, leo.id, { x: 7, y: 3 });
    expect(r.ok).toBe(true);
    expect(leo.pos).toEqual({ x: 6, y: 3 });
    expect(leo.mp).toBe(0);
  });
  it('el esqueleto empieza cada turno con escudo', () => {
    const s = fight([hero(), makeEnemy('esqueleto', { x: 9, y: 3 })]);
    const esq = s.units[1]!;
    until(s, esq.id);
    expect(esq.shield).toBeGreaterThan(0);
  });
  it('el espectro atraviesa obstáculos y va a por el más frágil', () => {
    const wall = Array.from({ length: 7 }, (_, y) => ({ x: 6, y }));
    const tank = makeHero({ cls: 'guerrero', name: 'Ana', owner: 'p1', routes: ['baluarte'], pos: { x: 1, y: 0 } });
    const s = fight([tank, hero(1, 6), makeEnemy('espectro', { x: 9, y: 6 })], wall);
    const sp = s.units[2]!;
    until(s, sp.id);
    runAiTurn(s);
    expect(sp.pos.x).toBeLessThan(6);
  });
  it('el necrófago herido devora un cadáver y se cura', () => {
    const s = fight([hero(1, 0), makeEnemy('necrofago', { x: 8, y: 3 }), makeEnemy('limo', { x: 9, y: 4 })]);
    const nec = s.units[1]!, limo = s.units[2]!;
    limo.hp = 0;
    nec.hp = 10;
    until(s, nec.id);
    runAiTurn(s);
    expect(nec.hp).toBeGreaterThan(10);
    expect(limo.used).toBe(true);
  });
  it('el acólito alza a los muertos', () => {
    const s = fight([hero(1, 0), makeEnemy('acolito', { x: 8, y: 3 }), makeEnemy('limo', { x: 9, y: 4 })]);
    const aco = s.units[1]!, limo = s.units[2]!;
    limo.hp = 0;
    const before = s.units.length;
    until(s, aco.id);
    runAiTurn(s, bossInfo(newRun('T', 1, [{ owner: 'p', name: 'L', cls: 'mago', routes: ['fuego'] }])));
    expect(s.units.length).toBe(before + 1);
    expect(s.units[s.units.length - 1]!.kind).toBe('esqueleto');
  });
  it('los lobos hacen más daño en manada', () => {
    const dmg = (pack: number): number => {
      const target = makeHero({ cls: 'guerrero', name: 'A', owner: 'p', routes: ['baluarte'], pos: { x: 5, y: 3 } });
      target.armor = 0; target.hp = target.maxHp = 500;
      const wolves = Array.from({ length: pack }, (_, i) => makeEnemy('lobo', { x: 10, y: i }));
      const s = fight([makeEnemy('lobo', { x: 6, y: 3 }), target, ...wolves]);
      const w = s.units[0]!;
      w.crit = 0;
      until(s, w.id);
      let total = 0;
      for (let i = 0; i < 8; i++) { s.rng = 1000 + i; w.ap = 3; cast(s, w.id, 'e_mordida', target.pos); }
      total = 500 - s.units[1]!.hp;
      return total;
    };
    expect(dmg(3)).toBeGreaterThan(dmg(0));
  });
  it('el jefe pasa a la segunda fase y levanta pilares que lo curan', () => {
    const run = newRun('T', 1, [{ owner: 'p', name: 'L', cls: 'mago', routes: ['fuego'] }]);
    const s = fight([hero(1, 3), makeEnemy('prior', { x: 9, y: 3 })]);
    const boss = s.units[1]!;
    boss.hp = Math.floor(boss.maxHp / 2);
    until(s, boss.id, bossInfo(run));
    runAiTurn(s, bossInfo(run));
    expect(boss.phase).toBe(2);
    const pillars = s.units.filter((u) => u.ai === 'pillar');
    expect(pillars.length).toBeGreaterThanOrEqual(2);
    const before = boss.hp;
    until(s, pillars[0]!.id, bossInfo(run));
    runAiTurn(s, bossInfo(run));
    expect(boss.hp).toBeGreaterThan(before);
    // vencer al jefe y a sus esbirros basta, aunque queden pilares
    for (const u of s.units) if (u.team === 'enemy' && u.ai !== 'pillar') u.hp = 0;
    const leo = s.units[0]!;
    until(s, leo.id, bossInfo(run));
    if (!s.over) { const e = s.units.find((u) => u.team === 'enemy' && u.ai !== 'pillar' && u.hp > 0); expect(e).toBeUndefined(); }
  });
});

describe('modificadores de élite', () => {
  it('cambian el nombre y las estadísticas', () => {
    const plain = makeEnemy('caballero', { x: 0, y: 0 });
    const tough = makeEnemy('caballero', { x: 0, y: 0 }, 0, 1, { affixes: ['blindado', 'ardiente'] });
    expect(tough.name).toBe('Caballero sepulcral · Blindado, Ardiente');
    expect(tough.armor).toBe(plain.armor + 2);
    expect(tough.maxHp).toBeGreaterThan(plain.maxHp);
    expect(tough.spells[0]!.rune).toBe('fuego');
  });
});
