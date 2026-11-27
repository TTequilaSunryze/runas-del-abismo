// Ritmo de cada zona: entre 4 y 9 combates comunes y siempre al menos un élite antes de la sala del jefe.
// El «?» es casi siempre un evento y hay eventos comunes para todas las zonas.
import { describe, expect, it } from 'vitest';
import { allPaths, makeActMap, pathStats } from '../src/game/map';
import { COMMON_EVENTS } from '../src/content/commonEvents';
import { UNKNOWN_ODDS, newRun, resolveNode } from '../src/game/run';

describe('reglas de la zona', () => {
  it('cada ruta tiene de 4 a 9 combates comunes y al menos un élite', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const m = makeActMap({ rng: seed * 104729 });
      for (const p of allPaths(m)) {
        const st = pathStats(m, p);
        expect(st.fights).toBeGreaterThanOrEqual(4);
        expect(st.fights).toBeLessThanOrEqual(9);
        expect(st.elites).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('el «?» es un evento la mayoría de las veces', () => {
    expect(UNKNOWN_ODDS.combat + UNKNOWN_ODDS.cage + UNKNOWN_ODDS.sangre).toBeLessThan(0.25);
    let events = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const run = newRun('Q', seed, [{ owner: 'me', name: 'Yo', cls: 'carcelero', routes: ['base'] }]);
      if (resolveNode(run, 'event') === 'event') events++;
    }
    expect(events).toBeGreaterThan(130);
  });

  it('los eventos comunes se aplican sin errores', () => {
    expect(COMMON_EVENTS.length).toBeGreaterThanOrEqual(10);
    for (const ev of COMMON_EVENTS) for (let i = 0; i < ev.options.length; i++) {
      const run = newRun('C', 7 + i, [{ owner: 'a', name: 'A', cls: 'carcelero', routes: ['base'] }, { owner: 'b', name: 'B', cls: 'barbaro', routes: ['base'] }]);
      const text = ev.options[i]!.apply(run);
      expect(text.length).toBeGreaterThan(0);
      for (const h of run.heroes) expect(h.hp).toBeGreaterThan(0);
    }
  });
});
