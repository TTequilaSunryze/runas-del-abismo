import { describe, expect, it } from 'vitest';
import { ACT_ROOMS, PATH_RULES, allPaths, makeActMap, mapOk, pathStats } from '../src/game/map';
import { availableNodes, chooseNode, newRun } from '../src/game/run';
import { roomStep } from './helpers';

const box = (seed: number) => ({ rng: seed >>> 0 }) as never;

describe('mapa ramificado (7 salas + jefe)', () => {
  it('cada ruta: 3-5 combates normales, como mucho un élite, un descanso y sin 3 combates seguidos', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const m = makeActMap(box(seed * 7919));
      expect(m.layers.length).toBe(ACT_ROOMS + 1);
      expect(m.layers.at(-1)).toEqual(['boss']);
      for (const row of m.layers.slice(0, -1)) { expect(row.length).toBeGreaterThanOrEqual(2); expect(row.length).toBeLessThanOrEqual(4); }
      expect(mapOk(m)).toBe(true);
      for (const p of allPaths(m)) {
        const st = pathStats(m, p);
        expect(st.fights).toBeGreaterThanOrEqual(PATH_RULES.minFights);
        expect(st.fights).toBeLessThanOrEqual(PATH_RULES.maxFights);
        expect(st.elites).toBeLessThanOrEqual(1);
        expect(st.rests).toBeGreaterThanOrEqual(1);
        expect(st.streak).toBeLessThanOrEqual(2);
      }
    }
  });
  it('todos los nodos son alcanzables, tienen salida y llegan al jefe; hay ramas y variedad', () => {
    const firstRow = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const m = makeActMap(box(seed * 31));
      m.links.forEach((rows, l) => {
        rows.forEach((to) => expect(to.length).toBeGreaterThan(0));
        for (let j = 0; j < m.layers[l + 1]!.length; j++) expect(rows.some((to) => to.includes(j))).toBe(true);
      });
      expect(allPaths(m).length).toBeGreaterThan(1);
      const kinds = new Set(m.layers.flat());
      expect(kinds.has('shop') && kinds.has('rest') && kinds.has('forge') && kinds.has('event')).toBe(true);
      expect(m.layers[0]).not.toContain('shrine');
      m.layers[0]!.forEach((k) => firstRow.add(k));
    }
    expect(firstRow.size).toBeGreaterThan(1); // la primera fila no es siempre igual
  });
  it('misma semilla, mismo mapa (lo genera el anfitrión y viaja en la partida)', () => {
    expect(makeActMap(box(77))).toEqual(makeActMap(box(77)));
  });
  it('en la partida solo se puede ir por las aristas del mapa', () => {
    const run = roomStep(newRun('T', 5, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }]));
    expect(availableNodes(run)).toEqual(run.map[run.step]!.map((_, i) => i));
    const i = run.map[run.step]!.indexOf('combat');
    chooseNode(run, i >= 0 ? i : 0);
    expect(run.at).toBe(i >= 0 ? i : 0);
    run.phase = 'map'; run.step += 1;
    const ok = availableNodes(run);
    expect(ok).toEqual(run.links[run.step - 1]![run.at]);
    const bad = run.map[run.step]!.map((_, k) => k).find((k) => !ok.includes(k));
    if (bad !== undefined) { chooseNode(run, bad); expect(run.phase).toBe('map'); }
  });
});
