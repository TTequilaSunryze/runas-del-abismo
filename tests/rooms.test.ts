import { describe, expect, it } from 'vitest';
import { CURSES, HEAT_OVERLOAD, PACTS } from '../src/content/pacts';
import { makeActMap } from '../src/game/map';
import { chooseNode, heroMaxHp, heroSpec, upgradeChoices, leaveNode, metaAction, newRun, type RunState } from '../src/game/run';
import { enterRoom, recalStats } from '../src/game/rooms';
import { roomStep } from './helpers';

const P = [{ owner: 'a', name: 'A', cls: 'barbaro' as const, routes: [] }, { owner: 'b', name: 'B', cls: 'zorro' as const, routes: [] }];

function into(run: RunState, kind: string): void {
  run.map[run.step] = [kind as never];
  run.at = -1;
  chooseNode(run, 0);
  // un Tesoro puede ser cofre o santuario: para probar el cofre, se fuerza
  if (kind === 'treasure' && run.room?.kind !== 'chest') { for (const h of run.heroes) h.bossOffer = null; enterRoom(run, 'chest'); }
}

describe('salas especiales v14', () => {
  it('hay al menos 10 pactos y 5 maldiciones', () => {
    expect(PACTS.length).toBeGreaterThanOrEqual(10);
    expect(CURSES.length).toBeGreaterThanOrEqual(5);
  });
  it('la Forja del Abismo sale detrás de un «?» (como mucho una por zona) y el Tesoro es cofre o santuario', () => {
    for (let seed = 1; seed < 40; seed++) expect(makeActMap({ rng: seed * 31 }).layers.flat()).not.toContain('forge');
    const seen = { forge: 0, chest: 0, shrine: 0 };
    for (let seed = 1; seed < 120; seed++) {
      const run = roomStep(newRun('T', seed, P));
      run.map[run.step] = ['event']; run.at = -1; chooseNode(run, 0);
      if (run.room?.kind === 'forge') { seen.forge++; expect(run.flags).toContain(`forja_z${run.zone}`); }
      const r2 = roomStep(newRun('T', seed, P));
      r2.map[r2.step] = ['treasure']; r2.at = -1; chooseNode(r2, 0);
      if (r2.room?.kind === 'chest') seen.chest++; else if (r2.room?.kind === 'shrine') seen.shrine++;
    }
    expect(seen.forge).toBeGreaterThan(3);
    expect(seen.chest).toBeGreaterThan(20);
    expect(seen.shrine).toBeGreaterThan(20);
  });
  it('la partida empieza en el altar: 2 pactos a votar (apagado en la primera partida)', () => {
    const run = newRun('T', 4, P);
    expect(run.phase).toBe('room');
    expect(run.map[0]).toEqual(['altar']);
    expect(run.room?.kind === 'altar' && run.room.pacts.length).toBe(2);
    leaveNode(run);
    expect(run.phase).toBe('room');
    metaAction(run, 'a', { a: 'room', op: 'pact', idx: 1 });
    metaAction(run, 'b', { a: 'room', op: 'pact', idx: 1 });
    expect(run.pact).toBeTruthy();
    leaveNode(run);
    expect(run.phase).toBe('map');
    expect(run.step).toBe(1);
    const first = newRun('T', 4, P, { firstRun: true });
    expect(first.room?.kind === 'altar' && first.room.pacts.length).toBe(0);
    leaveNode(first);
    expect(first.phase).toBe('map');
    expect(first.pact ?? null).toBeNull();
  });
  it('pacto de sangre: +3 de daño y menos vida máxima', () => {
    const run = newRun('T', 4, P);
    const h = run.heroes[0]!;
    const hp0 = heroMaxHp(h);
    const r = run.room!;
    if (r.kind === 'altar') r.pacts = ['sangre', 'hierro'];
    metaAction(run, 'a', { a: 'room', op: 'pact', idx: 0 });
    metaAction(run, 'b', { a: 'room', op: 'pact', idx: 0 });
    expect(run.pact).toBe('sangre');
    expect(h.boon.power).toBe(3);
    expect(heroMaxHp(h)).toBeLessThan(hp0);
  });
  it('forja: recalibrar, desguazar, templar y el calor endurece el siguiente combate', () => {
    const run = roomStep(newRun('T', 4, P));
    into(run, 'forge');
    expect(run.phase).toBe('room');
    const h = run.heroes[0]!;
    h.gold = 500;
    h.bag.push({ slot: 'arma', name: 'Hoja del Oso', rarity: 1, stats: { hp: 8, crit: 4 }, affixes: [{ kind: 'prefix', id: 'prefix_crit', name: 'Letal', stat: 'crit', value: 4 }, { kind: 'suffix', id: 'suffix_hp', name: 'del Oso', stat: 'hp', value: 8 }] });
    h.bag.push({ slot: 'botas', name: 'Botas', rarity: 3, stats: { mp: 1 } });
    expect(recalStats(h, h.bag[0]!)).toContain('powerPhys');
    expect(metaAction(run, 'a', { a: 'room', op: 'recal', ref: 'b:0', affix: 1, stat: 'powerPhys' })).toBeNull();
    expect(h.bag[0]!.stats.hp).toBeUndefined();
    expect(h.bag[0]!.stats.powerPhys).toBeGreaterThan(0);
    expect(h.gold).toBe(470);
    expect(metaAction(run, 'a', { a: 'room', op: 'scrap', idx: 1 })).toBeNull();
    expect(h.escofinas).toBe(5);
    const spell = heroSpec(h).spells.map((x) => x.id).find((id) => upgradeChoices(h, id).length)!;
    const up = upgradeChoices(h, spell)[0]!;
    expect(metaAction(run, 'a', { a: 'room', op: 'hone', spell, up })).toBeNull();
    expect(h.ups[spell]).toContain(up);
    expect(h.escofinas).toBe(2);
    expect(metaAction(run, 'a', { a: 'room', op: 'hone', spell, up })).toBeTruthy();
    expect((run.room as { heat: number }).heat).toBeGreaterThan(0);
    (run.room as { heat: number }).heat = HEAT_OVERLOAD - 1;
    expect(metaAction(run, 'b', { a: 'room', op: 'recal', ref: 'b:0', affix: 0, stat: 'initiative' })).not.toBeNull(); // b no tiene ese objeto
    metaAction(run, 'a', { a: 'room', op: 'recal', ref: 'b:0', affix: 0, stat: 'initiative' });
    expect(run.overload).toBe('overload');
    leaveNode(run);
    into(run, 'combat');
    const foes = run.combat!.units.filter((u) => u.team === 'enemy');
    expect(foes.every((u) => u.traits?.includes('ignifugo') && u.traits?.includes('pavesa'))).toBe(true);
  });
  it('cofre: siempre informa del resultado, sea botín o maldición', () => {
    let cursed = 0, loot = 0;
    for (let seed = 1; seed < 40; seed++) {
      const run = roomStep(newRun('T', seed, P));
      into(run, 'treasure');
      expect(run.room?.kind).toBe('chest');
      leaveNode(run);
      expect(run.phase).toBe('room');
      metaAction(run, 'a', { a: 'room', op: 'open' });
      const r = run.room!;
      if (r.kind !== 'chest') throw new Error();
      expect(r.opened).toBe(true);
      if (r.cursed) cursed++; else { loot++; expect(r.lines!.length).toBeGreaterThan(0); }
      leaveNode(run);
      expect(run.phase).toBe('map');
    }
    expect(cursed).toBeGreaterThan(0);
    expect(loot).toBeGreaterThan(cursed);
  });
  it('descanso: cada uno elige descansar o meditar', () => {
    const run = roomStep(newRun('T', 4, P));
    run.heroes[0]!.hp = 10;
    into(run, 'rest');
    expect(run.room?.kind).toBe('rest');
    metaAction(run, 'a', { a: 'room', op: 'rest', idx: 0 });
    metaAction(run, 'b', { a: 'room', op: 'rest', idx: 1 });
    expect(run.heroes[0]!.hp).toBeGreaterThan(10);
    expect(run.heroes[1]!.escofinas).toBe(2);
    leaveNode(run);
    expect(run.phase).toBe('map');
  });
});

import { availableNodes, mapChoice } from '../src/game/run';
describe('votación del camino', () => {
  it('gana la más votada; en empate, la del anfitrión', () => {
    const run = roomStep(newRun('T', 4, [...P, { owner: 'c', name: 'C', cls: 'esferas' as const, routes: [] }]));
    // primero cada uno elige su runa inicial
    for (const h of run.heroes) expect(metaAction(run, h.owner, { a: 'rune', op: 'take', idx: 0 })).toBeNull();
    const av = availableNodes(run);
    expect(mapChoice(run, 'a')).toBe(-1);
    expect(metaAction(run, 'b', { a: 'mapvote', idx: av[1]! })).toBeNull();
    expect(metaAction(run, 'a', { a: 'mapvote', idx: av[0]! })).toBeNull();
    expect(mapChoice(run, 'a')).toBe(av[0]);
    metaAction(run, 'c', { a: 'mapvote', idx: av[1]! });
    expect(mapChoice(run, 'a')).toBe(av[1]);
    expect(run.ready.b).toBe(run.stamp);
  });
});
