import { RUNES } from '../src/core/runes';
import { describe, expect, it } from 'vitest';
import { SPECIAL_EVENTS, specialCandidates } from '../src/content/specialEvents';
import { ATLAS } from '../src/game/atlas';
import { availableNodes, chooseNode, eventDef, finishFight, heroMaxHp, newRun, resolveEvent, vote, type RunState } from '../src/game/run';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } } as Storage;
const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }, { owner: 'b', name: 'B', cls: 'zorro' as const, routes: [] as string[] }];
const mk = (): RunState => { const r = roomStep(newRun('G2EV', 4, P)); for (const h of r.heroes) h.gold = 200; return r; };

describe('Fase G2 · eventos especiales', () => {
  it('10 eventos, ids únicos, en el Atlas y sin pisar los existentes', () => {
    expect(SPECIAL_EVENTS.length).toBe(10);
    expect(new Set(SPECIAL_EVENTS.map((e) => e.id)).size).toBe(10);
    for (const e of SPECIAL_EVENTS) expect(ATLAS.events.some((a) => a.id === e.id)).toBe(true);
    expect(new Set(ATLAS.events.map((a) => a.id)).size).toBe(ATLAS.events.length);
  });
  it('candidatos según zona y sin repetir los ya vistos', () => {
    const r = mk();
    expect(specialCandidates(r).some((e) => e.id === 'sp_viajero')).toBe(false); // solo desde la zona 2
    r.zone = 1;
    expect(specialCandidates(r).some((e) => e.id === 'sp_viajero')).toBe(true);
    r.eventsSeen.push('sp_viajero');
    expect(specialCandidates(r).some((e) => e.id === 'sp_viajero')).toBe(false);
  });
  it('cada opción se resuelve por votación sin dejar a nadie sin vida', () => {
    for (const e of SPECIAL_EVENTS) for (let i = 0; i < e.options.length; i++) {
      const r = mk(); r.phase = 'event'; r.event = { id: e.id, votes: {} };
      expect(eventDef(r)?.id).toBe(e.id);
      for (const h of r.heroes) vote(r, h.owner, i);
      resolveEvent(r, 'a');
      expect(r.event.result, `${e.id}/${i}`).toBeTruthy();
      for (const h of r.heroes) { expect(h.hp).toBeGreaterThan(0); expect(h.hp).toBeLessThanOrEqual(heroMaxHp(h)); expect(h.gold).toBeGreaterThanOrEqual(0); }
    }
  });
  it('a lo largo de muchas expediciones salen especiales, como mucho uno por zona', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = roomStep(newRun('G2F', seed, P));
      const ev = r.map.findIndex((row) => row.includes('event'));
      if (ev < 0) continue;
      r.step = ev; r.trail = Array.from({ length: ev }, () => 0);
      const i = r.map[ev]!.indexOf('event');
      if (!availableNodes(r).includes(i)) continue;
      chooseNode(r, i);
      if (eventDef(r)?.special) seen++;
      expect(r.flags.filter((f) => f.startsWith('g2z')).length).toBeLessThanOrEqual(1);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('Desafío del Campeón: runa rara para cada uno al ganar la emboscada', () => {
    const r = mk(); r.phase = 'event'; r.event = { id: 'sp_campeon', votes: {} };
    for (const h of r.heroes) vote(r, h.owner, 0);
    resolveEvent(r, 'a');
    expect(r.ambush).toBe(true);
    for (const h of r.heroes) h.runeOffers = [];
    r.phase = 'map'; chooseNode(r, availableNodes(r)[0]!);
    // emboscada: oferta del estandarte (rara o mejor) + la garantizada de élite
    if (r.combat) { r.combat.over = 'win'; finishFight(r); for (const h of r.heroes) { expect(h.runeOffers!.length).toBeGreaterThanOrEqual(2); expect(h.runeOffers![0]!.runes.every((id) => RUNES[id]!.rarity >= 3)).toBe(true); } }
  });
});
