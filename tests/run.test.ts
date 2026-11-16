import { describe, expect, it } from 'vitest';
import { ZONA1_ITEMS } from '../src/content/zona1/items';
import { SLOTS, genItem, statDiff } from '../src/core/items/items';
import { bossInfo, chooseNode, finishFight, heroMaxHp, leaveNode, metaAction, newRun, resolveEvent, type RunState } from '../src/game/run';
import { autoplay } from './helpers';

const CLS = [
  { cls: 'guerrero', routes: ['baluarte', 'duelista'] }, { cls: 'mago', routes: ['fuego', 'tormenta'] },
  { cls: 'clerigo', routes: ['luz', 'juicio'] }, { cls: 'picaro', routes: ['veneno', 'sombras'] },
] as const;

const make = (n: number, seed: number): RunState =>
  newRun('TEST', seed, CLS.slice(0, n).map((c, i) => ({ owner: `p${i}`, name: `H${i}`, cls: c.cls, routes: [...c.routes] })));

/** Juega una partida entera eligiendo siempre el nodo `prefer` si existe (o el primero). */
function playRun(n: number, seed: number, prefer: string): RunState {
  const run = make(n, seed);
  for (let step = 0; step < 150 && run.phase !== 'won' && run.phase !== 'lost'; step++) {
    for (const h of run.heroes) for (let k = 0; k < 6 && h.upOffer; k++) metaAction(run, h.owner, { a: 'upgrade', idx: 0 });
    if (run.phase === 'map') {
      for (const h of run.heroes) {
        if (run.offers[h.owner] && metaAction(run, h.owner, { a: 'pick', idx: 0 })) {
          expect(metaAction(run, h.owner, { a: 'drop', idx: 0 })).toBeNull();
          expect(metaAction(run, h.owner, { a: 'pick', idx: 0 })).toBeNull();
        }
        if (h.bag.length) metaAction(run, h.owner, { a: 'equip', idx: 0 });
      }
      const nodes = run.map[run.step]!;
      chooseNode(run, Math.max(0, nodes.indexOf(prefer as never)));
    } else if (run.phase === 'event') {
      for (const h of run.heroes) metaAction(run, h.owner, { a: 'vote', idx: 0 });
      resolveEvent(run, 'p0');
      expect(run.event!.result).toBeTruthy();
      leaveNode(run);
    } else if (run.phase === 'camp') {
      for (const h of run.heroes) {
        const k = run.camp!.kind;
        const err = k === 'forge' ? metaAction(run, h.owner, { a: 'forge', slot: (Object.keys(h.equip)[0] ?? 'arma') as never }) : k === 'altar' ? metaAction(run, h.owner, { a: 'altar', opt: 2 }) : metaAction(run, h.owner, { a: 'gamble', opt: 0 });
        if (!err) expect(run.camp!.done[h.owner]).toBeTruthy();
      }
      leaveNode(run);
      expect(run.phase).toBe('map');
    } else if (run.phase === 'shop') {
      for (const h of run.heroes) { metaAction(run, h.owner, { a: 'buy', idx: 5 }); metaAction(run, h.owner, { a: 'potion' }); }
      leaveNode(run);
    } else {
      autoplay(run.combat!, 800, bossInfo(run));
      expect(run.combat!.over).not.toBeNull();
      finishFight(run);
    }
    for (const h of run.heroes) { expect(h.gold).toBeGreaterThanOrEqual(0); expect(h.hp).toBeLessThanOrEqual(heroMaxHp(h)); }
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
  it('compara estadísticas entre dos objetos', () => {
    expect(statDiff({ hp: 10, armor: 1 }, { hp: 6, crit: 3 })).toEqual({ hp: 4, armor: 1, crit: -3 });
  });
});

describe('mochila y tienda', () => {
  it('el botín va a la ranura libre o a la mochila, y se puede equipar, quitar y dar', () => {
    const run = make(2, 1);
    const [a, b] = run.heroes as [RunState['heroes'][0], RunState['heroes'][0]];
    const before = heroMaxHp(a);
    run.offers.p0 = [{ slot: 'peto', name: 'x', rarity: 0, stats: { hp: 10 } }];
    expect(metaAction(run, 'p0', { a: 'pick', idx: 0 })).toBeNull();
    expect(heroMaxHp(a)).toBe(before + 10);
    run.offers.p0 = [{ slot: 'peto', name: 'y', rarity: 1, stats: { hp: 20 } }];
    metaAction(run, 'p0', { a: 'pick', idx: 0 });
    expect(a.bag.map((i) => i.name)).toEqual(['y']);
    expect(metaAction(run, 'p0', { a: 'equip', idx: 0 })).toBeNull();
    expect(a.equip.peto!.name).toBe('y');
    expect(a.bag.map((i) => i.name)).toEqual(['x']);
    expect(metaAction(run, 'p0', { a: 'give', idx: 0, to: 'p1' })).toBeNull();
    expect(b.equip.peto!.name).toBe('x');
    expect(metaAction(run, 'p0', { a: 'unequip', slot: 'peto' })).toBeNull();
    expect(a.hp).toBeLessThanOrEqual(heroMaxHp(a));
  });
  it('comprar exige oro y cada objeto se vende una sola vez', () => {
    const run = make(2, 3);
    run.map[0] = ['shop'];
    chooseNode(run, 0);
    expect(run.phase).toBe('shop');
    expect(metaAction(run, 'p0', { a: 'buy', idx: 0 })).toBe('No tienes oro suficiente');
    run.heroes[0]!.gold = 500; run.heroes[1]!.gold = 500;
    expect(metaAction(run, 'p0', { a: 'buy', idx: 0 })).toBeNull();
    expect(metaAction(run, 'p1', { a: 'buy', idx: 0 })).toBe('Ya no está a la venta');
    expect(run.heroes[0]!.gold).toBe(500 - run.shop![0]!.price);
  });
});

describe('partida completa', () => {
  it('de 1 a 4 jugadores y por distintas rutas del mapa, siempre llega a un final', () => {
    const results: string[] = [];
    for (let n = 1; n <= 4; n++)
      for (const [seed, prefer] of [[11, 'combat'], [22, 'event'], [33, 'shop'], [44, 'treasure']] as const) {
        const run = playRun(n, seed * n, prefer);
        expect(['won', 'lost']).toContain(run.phase);
        if (run.phase === 'won') expect(run.step).toBe(run.map.length);
        results.push(`${n}j:${run.phase}@z${run.zone + 1}s${run.step}`);
      }
    console.log(results.join(' '));
  });
});
