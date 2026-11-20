import { it, expect } from 'vitest';
import { newRun, chooseNode } from '../src/game/run';
import { roomStep } from './helpers';
import { current, deployMove, startCombat } from '../src/core/combat/engine';
it('fase de colocación: zona, intercambio y arranque', () => {
  const run = roomStep(newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }, { owner: 'b', name: 'B', cls: 'zorro', routes: [] }]));
  chooseNode(run, 0);
  const c = run.combat!;
  expect(c.deploy?.cells.length).toBeGreaterThanOrEqual(3);
  // casillas de inicio separadas entre sí
  const cells = c.deploy!.cells.map((k) => k.split(',').map(Number) as [number, number]);
  for (const [i, p] of cells.entries()) for (const q of cells.slice(i + 1)) expect(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1])).toBeGreaterThanOrEqual(2);
  // enemigos a 5 casillas como mucho de alguna casilla de inicio (y nunca pegados)
  for (const e of c.units.filter((u) => u.team === 'enemy')) {
    const d = Math.min(...cells.map(([x, y]) => Math.abs(x - e.pos.x) + Math.abs(y - e.pos.y)));
    expect(d).toBeGreaterThanOrEqual(2); expect(d).toBeLessThanOrEqual(6);
  }
  expect(current(c)).toBeUndefined();
  const [a, b] = c.units.filter((u) => u.team === 'hero');
  const r = deployMove(c, a!.id, b!.pos); expect(r.ok).toBe(true);
  const out = Array.from({ length: c.w * c.h }, (_, i) => ({ x: i % c.w, y: Math.floor(i / c.w) })).find((p) => !c.deploy!.cells.includes(`${p.x},${p.y}`))!;
  expect(deployMove(c, a!.id, out).ok).toBe(false);
  startCombat(c); expect(current(c)).toBeTruthy(); expect(c.deploy).toBeNull();
});
