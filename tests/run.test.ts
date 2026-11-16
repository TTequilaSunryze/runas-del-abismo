import { describe, expect, it } from 'vitest';
import { ZONA1_ITEMS } from '../src/content/zona1/items';
import { SLOTS, genItem } from '../src/core/items/items';
import { advance, bossMinion, finishFight, heroMaxHp, newRun, pickLoot, resolveEvent, vote, TOTAL_FIGHTS, type RunState } from '../src/game/run';
import { autoplay } from './helpers';

const CLS = [
  { cls: 'guerrero', routes: ['baluarte', 'duelista'] }, { cls: 'mago', routes: ['fuego', 'tormenta'] },
  { cls: 'clerigo', routes: ['luz', 'juicio'] }, { cls: 'mago', routes: ['hielo', 'arcano'] },
] as const;

function playRun(n: number, seed: number): RunState {
  const run = newRun('TEST', seed, CLS.slice(0, n).map((c, i) => ({ owner: `p${i}`, name: `H${i}`, cls: c.cls, routes: [...c.routes] })));
  for (let step = 0; step < 40 && run.phase !== 'won' && run.phase !== 'lost'; step++) {
    if (run.phase === 'between') {
      for (const h of run.heroes) if (run.offers[h.owner]) pickLoot(run, h.owner, 0);
      advance(run);
    } else if (run.phase === 'event') {
      for (const h of run.heroes) vote(run, h.owner, 0);
      resolveEvent(run, 'p0');
      expect(run.event!.result).toBeTruthy();
      advance(run);
    } else {
      autoplay(run.combat!, 800, bossMinion(run));
      expect(run.combat!.over).not.toBeNull();
      finishFight(run);
    }
  }
  return run;
}

describe('objetos', () => {
  it('genera objetos válidos para las 8 ranuras y respeta la rareza mínima', () => {
    const box = { rng: 5 };
    for (const slot of SLOTS) {
      const it = genItem(box, ZONA1_ITEMS, 3, 2, slot);
      expect(it.slot).toBe(slot);
      expect(it.rarity).toBeGreaterThanOrEqual(2);
      expect(Object.keys(it.stats).length).toBeGreaterThan(0);
    }
  });
});

describe('partida completa', () => {
  it('equipar un objeto cambia las estadísticas del héroe', () => {
    const run = newRun('TEST', 1, [{ owner: 'p0', name: 'A', cls: 'guerrero', routes: ['baluarte'] }]);
    const before = heroMaxHp(run.heroes[0]!);
    run.offers.p0 = [{ slot: 'peto', name: 'x', rarity: 0, stats: { hp: 10 } }];
    pickLoot(run, 'p0', 0);
    expect(heroMaxHp(run.heroes[0]!)).toBe(before + 10);
    expect(run.offers.p0).toBeUndefined();
  });
  it('una partida de 1 a 4 jugadores llega siempre a un final, pasando por eventos y botín', () => {
    const results: string[] = [];
    for (let n = 1; n <= 4; n++)
      for (const seed of [11, 22, 33]) {
        const run = playRun(n, seed * n);
        expect(['won', 'lost']).toContain(run.phase);
        if (run.phase === 'won') expect(run.fight).toBe(TOTAL_FIGHTS);
        results.push(`${n}j:${run.phase}@${run.fight}`);
      }
    console.log(results.join(' '));
  });
});
