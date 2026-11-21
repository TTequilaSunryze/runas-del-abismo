import { beforeEach, describe, expect, it } from 'vitest';
import { newRun } from '../src/game/run';
import { ACHIEVEMENTS, ecosFor, mergeMeta, meta, replaceMeta, settle } from '../src/game/meta';

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
  it('ganar desbloquea ascensión y logros', () => {
    const r = mk(); r.phase = 'won'; r.zone = 2; r.step = 6; r.flags = ['boss_0', 'boss_1', 'boss_2'];
    const s = settle(r, 'a')!;
    expect(s.asc).toBe(1);
    expect(s.achievements.map((x) => x.id)).toContain('victoria');
  });
  it('las Mejoras retiradas se devuelven en ecos una sola vez (también al fusionar)', () => {
    const old = { ...meta(), ecos: 10, perks: { vit: 5, gold: 4, loot: 1, aid: 3 }, perksRefunded: undefined };
    replaceMeta(old as never);
    // vit 30+55+80+105+130 = 400 · gold 25+45+65+85 = 220 · loot 120 · aid 40+70+100 = 210 → 950
    expect(meta().ecos).toBe(10 + 950);
    expect(meta().perks).toBeUndefined();
    replaceMeta(JSON.parse(JSON.stringify(meta())));
    expect(meta().ecos).toBe(960);
    // otro dispositivo con los datos antiguos: la fusión no devuelve otra vez
    replaceMeta(mergeMeta(meta(), old as never));
    expect(meta().ecos).toBe(960);
    // si el otro dispositivo compró un nivel más que aún no se devolvió, solo se devuelve esa diferencia
    const more = { ...(old as object), perks: { vit: 5, gold: 4, loot: 1, aid: 3, hack: 9 } };
    replaceMeta(mergeMeta(meta(), more as never));
    expect(meta().ecos).toBe(960);
    expect(meta().perksRefundEcos).toBe(950);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(10);
  });
});
