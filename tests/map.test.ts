import { describe, expect, it } from 'vitest';
import { makeActMap, combatShare, minFightsOnPath, ACT_ROOMS } from '../src/game/map';
import { availableNodes, chooseNode, newRun } from '../src/game/run';

const box = (seed: number) => ({ rng: seed >>> 0 }) as never;

describe('mapa ramificado', () => {
  it('≥10 salas, jefe al final, 60-70% combates y ningún camino sin pelear', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const m = makeActMap(box(seed * 7919));
      expect(m.layers.length).toBeGreaterThanOrEqual(ACT_ROOMS + 1);
      expect(m.layers.at(-1)).toEqual(['boss']);
      const s = combatShare(m);
      expect(s).toBeGreaterThanOrEqual(0.6);
      expect(s).toBeLessThanOrEqual(0.7);
      expect(minFightsOnPath(m)).toBeGreaterThanOrEqual(5);
      expect(m.layers[0]!.every((k) => k === 'combat')).toBe(true);
      expect(m.layers[1]).toContain('shrine');
      expect(m.layers[1]).not.toContain('event');
    }
  });
  it('todos los nodos son alcanzables y tienen salida; hay ramas distintas', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const m = makeActMap(box(seed * 31));
      m.links.forEach((rows, l) => {
        rows.forEach((to) => expect(to.length).toBeGreaterThan(0));
        for (let j = 0; j < m.layers[l + 1]!.length; j++) expect(rows.some((to) => to.includes(j))).toBe(true);
      });
      expect(m.layers.slice(1, -1).some((r) => r.length >= 3)).toBe(true);
      const kinds = new Set(m.layers.flat());
      expect(kinds.has('elite') && kinds.has('shop') && kinds.has('rest')).toBe(true);
    }
  });
  it('en la partida solo se puede ir por las aristas del mapa', () => {
    const run = newRun('T', 5, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }]);
    expect(availableNodes(run)).toEqual([0, 1, 2]);
    chooseNode(run, 1);
    expect(run.at).toBe(1);
    expect(run.phase).toBe('combat');
    run.phase = 'map'; run.step = 1;
    const ok = availableNodes(run);
    expect(ok).toEqual(run.links[0]![1]);
    const bad = run.map[1]!.map((_, i) => i).find((i) => !ok.includes(i));
    if (bad !== undefined) { chooseNode(run, bad); expect(run.phase).toBe('map'); }
  });
});
