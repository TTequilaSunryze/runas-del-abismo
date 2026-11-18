import { it, expect } from 'vitest';
import { newRun, chooseNode } from '../src/game/run';
import { current, deployMove, startCombat } from '../src/core/combat/engine';
it('fase de colocación: zona, intercambio y arranque', () => {
  const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }, { owner: 'b', name: 'B', cls: 'zorro', routes: [] }]);
  chooseNode(run, 0);
  const c = run.combat!;
  expect(c.deploy?.cells.length).toBeGreaterThan(4);
  expect(current(c)).toBeUndefined();
  const [a, b] = c.units.filter((u) => u.team === 'hero');
  const r = deployMove(c, a!.id, b!.pos); expect(r.ok).toBe(true);
  expect(deployMove(c, a!.id, { x: 8, y: 1 }).ok).toBe(false);
  startCombat(c); expect(current(c)).toBeTruthy(); expect(c.deploy).toBeNull();
});
