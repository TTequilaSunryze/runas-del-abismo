import { beforeEach, describe, expect, it } from 'vitest';
import { newRun } from '../src/game/run';
import { ACHIEVEMENTS, buyPerk, ecosFor, meta, settle } from '../src/game/meta';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const mk = () => newRun('TEST', 7, [{ owner: 'a', name: 'A', cls: 'guerrero', routes: ['baluarte'] }]);

describe('progresión', () => {
  beforeEach(() => { meta().ecos = 0; meta().claimed = []; });
  it('una partida perdida da ecos y solo se cobra una vez', () => {
    const r = mk(); r.phase = 'lost'; r.step = 4;
    const a = settle(r, 'a');
    expect(a!.ecos).toBe(ecosFor(r));
    expect(a!.ecos).toBeGreaterThan(0);
    const before = meta().ecos;
    settle(r, 'a');
    expect(meta().ecos).toBe(before);
  });
  it('ganar desbloquea ascensión, logros y runa', () => {
    const r = mk(); r.phase = 'won'; r.zone = 2; r.step = 6; r.flags = ['boss_0', 'boss_1', 'boss_2'];
    const s = settle(r, 'a')!;
    expect(s.asc).toBe(1);
    expect(s.achievements.map((x) => x.id)).toContain('victoria');
    expect(meta().unlocked).toContain('sangrienta');
  });
  it('las mejoras cuestan ecos y tienen tope', () => {
    meta().ecos = 1000;
    expect(buyPerk('vit')).toBe(true);
    for (let i = 0; i < 10; i++) buyPerk('vit');
    expect(meta().perks.vit).toBe(5);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(10);
  });
});
