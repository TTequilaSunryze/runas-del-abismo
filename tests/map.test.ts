import { describe, expect, it } from 'vitest';
import { ACT_ROOMS, PATH_RULES, allPaths, makeActMap, mapOk, pathCount, pathRange, pathStats } from '../src/game/map';
import { availableNodes, chooseNode, newRun } from '../src/game/run';
import { roomStep } from './helpers';

const box = (seed: number) => ({ rng: seed >>> 0 }) as never;
const LEGEND = new Set(['combat', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss']);

describe('mapa ramificado (14 salas + jefe)', () => {
  it('15 filas: la última es el jefe y la anterior, siempre descanso; solo los 6 tipos de la leyenda', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const m = makeActMap(box(seed * 7919));
      expect(m.layers.length).toBe(ACT_ROOMS + 1);
      expect(ACT_ROOMS).toBe(14);
      expect(m.layers.at(-1)).toEqual(['boss']);
      expect(m.layers.at(-2)!.every((k) => k === 'rest')).toBe(true);
      for (const row of m.layers.slice(0, -1)) { expect(row.length).toBeGreaterThanOrEqual(2); expect(row.length).toBeLessThanOrEqual(4); }
      for (const k of m.layers.flat()) expect(LEGEND.has(k)).toBe(true);
      expect(m.layers.flat()).toContain('shop');
      expect(mapOk(m)).toBe(true);
    }
  });
  it('cada ruta sigue la guía (élites, descansos, tesoros, ?, combates) y nunca 3 combates seguidos', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = makeActMap(box(seed * 104729));
      const { min, max } = pathRange(m);
      for (const k of ['fights', 'elites', 'rests', 'treasures', 'events', 'shops'] as const) {
        expect(min[k]).toBeGreaterThanOrEqual(PATH_RULES[k][0]);
        expect(max[k]).toBeLessThanOrEqual(PATH_RULES[k][1]);
      }
      expect(max.streak).toBeLessThanOrEqual(PATH_RULES.maxStreak);
    }
  });
  it('pathRange coincide con recorrer todas las rutas (comprobado en mapas pequeños)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = makeActMap(box(seed * 31));
      // recorta a las 8 primeras filas + jefe para poder enumerar
      const cut = { layers: [...m.layers.slice(0, 8), ['boss' as const]], links: [...m.links.slice(0, 7), m.layers[7]!.map(() => [0])] };
      const all = allPaths(cut).map((p) => pathStats(cut, p));
      const { min, max } = pathRange(cut);
      expect(Math.min(...all.map((s) => s.elites))).toBe(min.elites);
      expect(Math.max(...all.map((s) => s.events))).toBe(max.events);
      expect(Math.max(...all.map((s) => s.streak))).toBe(max.streak);
      expect(pathCount(cut)).toBe(all.length);
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
      expect(pathCount(m)).toBeGreaterThan(5);
      expect(m.layers[0]!.every((k) => k === 'combat' || k === 'event')).toBe(true);
      m.layers[0]!.forEach((k) => firstRow.add(k));
    }
    expect(firstRow.size).toBeGreaterThan(1);
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
