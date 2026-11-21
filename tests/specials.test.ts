import { beforeEach, describe, expect, it } from 'vitest';
import { CLASSES, PLAYABLE } from '../src/core/classes/classes';
import { ZONES } from '../src/content/zones';
import { catalogIds, discover, recordArchive, resetArchiveTracking } from '../src/game/archive';
import { emptyArchive } from '../src/game/archiveData';
import { registerChronicleProgress } from '../src/game/atlas';
import { emptyContracts, mergeContracts, normalizeContracts } from '../src/game/contractsData';
import { FRAMES, TITLES, emptyCosmetics, mergeCosmetics, normalizeCosmetics } from '../src/game/cosmetics';
import { MASTERY_XP, mergeMeta, meta, replaceMeta, saveMeta } from '../src/game/meta';
import { chooseNode, cleanChampion, heroSpec, newRun, type RunState } from '../src/game/run';
import { BOSS_FAST_ROUNDS, SPECIALS, claimSpecialReward, equipCosmetic, evaluateSpecials, registerSpecial, specialDef, specialRows } from '../src/game/specials';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }];
const reset = (): void => { const m = meta(); m.contracts = emptyContracts(); m.archive = emptyArchive(); m.cosmetics = emptyCosmetics(); m.ecos = 0; resetArchiveTracking(); };
const boss0 = ZONES[0]!.bosses[0]!.id; // desafío «sin bajas»
const bossFight = (): RunState => { const run = roomStep(newRun('SPCL', 3, P)); chooseNode(run, 0); run.kind = 'boss'; run.bossPick[0] = 0; return run; };

describe('Fase D · catálogo', () => {
  it('4 tipos, ids únicos, recompensas existentes y sin repetir', () => {
    const all = SPECIALS();
    expect(new Set(all.map((s) => s.type))).toEqual(new Set(['boss_challenge', 'class_mastery', 'collection_milestone', 'narrative_lore']));
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of all) expect(s.reward.kind === 'title' ? TITLES.some((t) => t.id === s.reward.id) : FRAMES.some((f) => f.id === s.reward.id)).toBe(true);
    expect(new Set(all.map((s) => `${s.reward.kind}:${s.reward.id}`)).size).toBe(all.length);
    expect(all.filter((s) => s.type === 'class_mastery')).toHaveLength(PLAYABLE.length);
    for (const s of all.filter((x) => x.type === 'boss_challenge')) expect(ZONES.some((z) => z.bosses.some((b) => b.id === s.boss))).toBe(true);
  });
});

describe('Fase D · validación de desafíos', () => {
  beforeEach(reset);
  it('jefe: solo cuenta si se cumple su condición', () => {
    const d = specialDef(`boss_${boss0}`)!;
    expect(d.condition).toBe('flawless');
    expect(registerSpecial(meta(), { t: 'boss', boss: boss0, downs: 1, rounds: 3, pact: null })).toBe(false);
    expect(registerSpecial(meta(), { t: 'boss', boss: 'otro', downs: 0, rounds: 3, pact: null })).toBe(false);
    expect(registerSpecial(meta(), { t: 'boss', boss: boss0, downs: 0, rounds: 30, pact: null })).toBe(true);
    expect(meta().contracts!.special![d.id]).toEqual({ progress: 1, completed: true, claimed: false });
    expect(registerSpecial(meta(), { t: 'boss', boss: boss0, downs: 0, rounds: 30, pact: null })).toBe(false);
  });
  it('condiciones rápida y de pacto', () => {
    const fast = SPECIALS().find((s) => s.condition === 'fast')!, pact = SPECIALS().find((s) => s.condition === 'pact')!;
    registerSpecial(meta(), { t: 'boss', boss: fast.boss!, downs: 2, rounds: BOSS_FAST_ROUNDS + 1, pact: null });
    expect(meta().contracts!.special?.[fast.id]?.completed ?? false).toBe(false);
    registerSpecial(meta(), { t: 'boss', boss: fast.boss!, downs: 2, rounds: BOSS_FAST_ROUNDS, pact: null });
    expect(meta().contracts!.special![fast.id]!.completed).toBe(true);
    registerSpecial(meta(), { t: 'boss', boss: pact.boss!, downs: 0, rounds: 1, pact: 'no_existe' });
    expect(meta().contracts!.special?.[pact.id]?.completed ?? false).toBe(false);
    registerSpecial(meta(), { t: 'boss', boss: pact.boss!, downs: 0, rounds: 1, pact: 'sangre' });
    expect(meta().contracts!.special![pact.id]!.completed).toBe(true);
  });
  it('prueba de clase: ganar con la clase y un pacto', () => {
    registerSpecial(meta(), { t: 'won', cls: 'arquero', pact: null });
    expect(meta().contracts!.special?.class_arquero?.completed ?? false).toBe(false);
    registerSpecial(meta(), { t: 'won', cls: 'zorro', pact: 'hierro' });
    expect(meta().contracts!.special?.class_arquero?.completed ?? false).toBe(false);
    registerSpecial(meta(), { t: 'won', cls: 'arquero', pact: 'hierro' });
    expect(meta().contracts!.special!.class_arquero!.completed).toBe(true);
  });
  it('colecciones y crónicas avanzan con el Archivo y solo suben', () => {
    for (const id of catalogIds('relics').slice(0, 5)) discover('relics', id);
    evaluateSpecials(meta());
    expect(meta().contracts!.special!.col_relics!.progress).toBe(5);
    for (const id of catalogIds('relics')) discover('relics', id);
    evaluateSpecials(meta());
    expect(meta().contracts!.special!.col_relics!.completed).toBe(true);
    for (const z of ['zona_1', 'zona_2']) registerChronicleProgress(meta(), 'stories', z, 2);
    evaluateSpecials(meta());
    expect(meta().contracts!.special!.lore_descent).toMatchObject({ progress: 2, completed: false });
    meta().archive = emptyArchive(); evaluateSpecials(meta());
    expect(meta().contracts!.special!.lore_descent!.progress).toBe(2);
  });
  it('desde la partida: un jefe ganado sin bajas completa su desafío; con una baja, no', () => {
    const run = bossFight();
    recordArchive(run, 'a');
    run.combat = null; run.fight++; run.phase = 'map';
    recordArchive(run, 'a');
    expect(meta().contracts!.special![`boss_${boss0}`]!.completed).toBe(true);
    reset();
    const b = bossFight();
    recordArchive(b, 'a');
    recordArchive(b, 'a', [{ t: 'death', unit: b.combat!.units.find((u) => u.owner === 'a')!.id }]);
    b.combat = null; b.fight++; b.phase = 'map';
    recordArchive(b, 'a');
    expect(meta().contracts!.special?.[`boss_${boss0}`]?.completed ?? false).toBe(false);
  });
  it('desde la partida: ganar la expedición con pacto completa la prueba de clase', () => {
    const run = bossFight();
    run.pact = 'sangre'; run.phase = 'won';
    recordArchive(run, 'a');
    expect(meta().contracts!.special!.class_arquero!.completed).toBe(true);
  });
});

describe('Fase D · recompensas idempotentes', () => {
  beforeEach(reset);
  it('reclamar desbloquea el título una sola vez y no da ecos ni poder', () => {
    const d = specialDef(`boss_${boss0}`)!;
    expect(claimSpecialReward(meta(), d.id)).toBeNull();
    registerSpecial(meta(), { t: 'boss', boss: boss0, downs: 0, rounds: 1, pact: null });
    const run = newRun('SPCL', 3, P), before = JSON.stringify(heroSpec(run.heroes[0]!));
    expect(claimSpecialReward(meta(), d.id)).toEqual(d.reward);
    expect(claimSpecialReward(meta(), d.id)).toBeNull();
    const list = d.reward.kind === 'title' ? meta().cosmetics!.titles : meta().cosmetics!.frames;
    expect(list.filter((x) => x === d.reward.id)).toHaveLength(1);
    expect(meta().ecos).toBe(0);
    expect(JSON.stringify(heroSpec(newRun('SPCL', 3, P).heroes[0]!))).toBe(before);
    expect(claimSpecialReward(meta(), 'no_existe')).toBeNull();
  });
  it('equipar: solo lo desbloqueado; null lo quita', () => {
    expect(equipCosmetic(meta(), 'title', 'cronista')).toBe(false);
    meta().cosmetics!.titles.push('cronista');
    expect(equipCosmetic(meta(), 'title', 'cronista')).toBe(true);
    expect(meta().cosmetics!.title).toBe('cronista');
    expect(equipCosmetic(meta(), 'title', 'cronista')).toBe(false);
    expect(equipCosmetic(meta(), 'title', null)).toBe(true);
    expect(meta().cosmetics!.title).toBeNull();
  });
  it('los héroes del Salón llevan título y marco válidos; los inventados se descartan', () => {
    const c = { id: 'x', name: 'A', by: 'a', cls: 'arquero', routes: [CLASSES.arquero.routes[0]!.id], level: 2, equip: {}, ups: {}, asc: 0, won: true, date: '2026-11-21' };
    expect(cleanChampion({ ...c, title: 'cronista', frame: 'abisal' })).toMatchObject({ title: 'cronista', frame: 'abisal' });
    const bad = cleanChampion({ ...c, title: '<script>', frame: 'oro_falso' })!;
    expect(bad.title).toBeUndefined(); expect(bad.frame).toBeUndefined();
  });
});

describe('Fase D · persistencia y conservación', () => {
  beforeEach(reset);
  it('Meta y libretas anteriores sin especiales ni cosméticos se completan', () => {
    expect(normalizeContracts({ day: '2026-11-21', daily: [], weekly: [] }).special).toEqual({});
    expect(normalizeCosmetics(undefined)).toEqual(emptyCosmetics());
    expect(normalizeCosmetics({ titles: ['cronista', 'falso', 'cronista'], title: 'falso', frame: 'abisal' })).toEqual({ v: 1, titles: ['cronista'], frames: [], title: null, frame: null });
  });
  it('guardar y cargar conserva especiales, títulos y marcos', () => {
    registerSpecial(meta(), { t: 'won', cls: 'arquero', pact: 'sangre' });
    claimSpecialReward(meta(), 'class_arquero'); equipCosmetic(meta(), 'title', 'leyenda_arquero');
    saveMeta(); replaceMeta(JSON.parse(store.rda_meta));
    expect(meta().contracts!.special!.class_arquero).toEqual({ progress: 1, completed: true, claimed: true });
    expect(meta().cosmetics).toMatchObject({ titles: ['leyenda_arquero'], title: 'leyenda_arquero' });
    expect(claimSpecialReward(meta(), 'class_arquero')).toBeNull();
  });
  it('fusión: avance y cobros de ambos, desbloqueos unidos', () => {
    const a = emptyContracts(), b = emptyContracts();
    a.special = { class_arquero: { progress: 1, completed: true, claimed: false } };
    b.special = { class_arquero: { progress: 1, completed: true, claimed: true }, col_relics: { progress: 4, completed: false, claimed: false } };
    const m = mergeContracts(a, b);
    expect(m.special!.class_arquero!.claimed).toBe(true);
    expect(m.special!.col_relics!.progress).toBe(4);
    expect(mergeCosmetics({ titles: ['cronista'], title: 'cronista' }, { titles: ['veloz'], frames: ['hueso'] })).toEqual({ v: 1, titles: ['cronista', 'veloz'], frames: ['hueso'], title: 'cronista', frame: null });
  });
  it('conserva ecos, mejoras, maestría, logros, Archivo y contratos periódicos', () => {
    const m = meta();
    m.ecos = 77; m.perks = { vit: 2 }; m.achievements = ['victoria']; m.mastery = { arquero: MASTERY_XP[1]! };
    m.archive!.relics.colmillo = { lv: 1, seen: 1, n: 0 };
    m.contracts!.day = '2026-11-21'; m.contracts!.paid = ['d:2026-11-21:0'];
    registerSpecial(m, { t: 'won', cls: 'arquero', pact: 'sangre' }); claimSpecialReward(m, 'class_arquero');
    expect([m.ecos, m.perks, m.achievements, m.mastery, m.archive!.relics.colmillo!.lv, m.contracts!.paid]).toEqual([77, { vit: 2 }, ['victoria'], { arquero: MASTERY_XP[1] }, 1, ['d:2026-11-21:0']]);
    const mm = mergeMeta(m, { ...m, cosmetics: undefined, contracts: undefined });
    expect(mm.cosmetics!.titles).toContain('leyenda_arquero');
    expect(mm.contracts!.special!.class_arquero!.claimed).toBe(true);
    expect(specialRows(mm).find((r) => r.def.id === 'class_arquero')!.claimed).toBe(true);
  });
});
