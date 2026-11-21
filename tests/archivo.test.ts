import { beforeEach, describe, expect, it } from 'vitest';
import { startCombat } from '../src/core/combat/engine';
import type { GameEvent } from '../src/core/state';
import { RELICS } from '../src/content/relics';
import { BESTIARY, DOCUMENTED_KILLS, GRIMOIRE, LV, catalogIds, completion, completionAll, discover, discovered, entriesOf, levelFor, recordArchive, resetArchiveTracking, setLevel } from '../src/game/archive';
import { emptyArchive, mergeArchive, normalizeArchive, raise } from '../src/game/archiveData';
import { MASTERY_XP, ecosFor, mergeMeta, meta, replaceMeta, saveMeta, settle } from '../src/game/meta';
import { chooseNode, newRun } from '../src/game/run';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }];
const fight = (seed = 3) => { const run = roomStep(newRun('ARCH', seed, P)); chooseNode(run, 0); expect(run.phase).toBe('combat'); return run; };
const reset = (): void => { meta().archive = normalizeArchive(undefined); meta().hall = []; resetArchiveTracking(); };

describe('Archivo · modelo', () => {
  beforeEach(reset);
  it('descubre una entrada nueva y no repite', () => {
    const id = catalogIds('relics')[0]!;
    expect(discovered('relics', id)).toBe(false);
    expect(discover('relics', id)).toBe(true);
    expect(discovered('relics', id)).toBe(true);
    expect(discover('relics', id)).toBe(false);
    expect(meta().archive!.relics[id]!.seen).toBe(1);
  });
  it('ignora ids que no existen en el catálogo', () => {
    expect(discover('bestiary', 'no_existe')).toBe(false);
    expect(setLevel('grimoire', 'no_existe', 1)).toBe(false);
  });
  it('transiciones: solo suben y respetan el máximo de cada categoría', () => {
    const b = BESTIARY[0]!.id;
    expect(levelFor('bestiary', b)).toBe(0);
    expect(setLevel('bestiary', b, LV.studied)).toBe(true);
    expect(setLevel('bestiary', b, LV.found)).toBe(false);
    expect(levelFor('bestiary', b)).toBe(LV.studied);
    expect(setLevel('bestiary', b, 9)).toBe(true);
    expect(levelFor('bestiary', b)).toBe(3);
    const g = GRIMOIRE[0]!.id, r = catalogIds('relics')[0]!;
    setLevel('grimoire', g, 9); setLevel('relics', r, 9);
    expect(levelFor('grimoire', g)).toBe(2);
    expect(levelFor('relics', r)).toBe(1);
  });
  it('porcentaje de colección y entradas por categoría', () => {
    expect(completion('relics')).toEqual({ found: 0, total: Object.keys(RELICS).length, pct: 0 });
    for (const id of catalogIds('relics')) discover('relics', id);
    expect(completion('relics').pct).toBe(100);
    expect(completionAll().found).toBe(Object.keys(RELICS).length);
    expect(entriesOf('bestiary')).toHaveLength(BESTIARY.length);
    expect(entriesOf('grimoire').every((e) => e.lv === 0)).toBe(true);
  });
  it('catálogos: sin duplicados, aliados fuera del bestiario, hechizos de clases ocultas fuera del grimorio', () => {
    for (const c of ['bestiary', 'grimoire', 'relics'] as const) expect(new Set(catalogIds(c)).size).toBe(catalogIds(c).length);
    expect(catalogIds('bestiary')).not.toContain('mercenario');
    expect(GRIMOIRE.some((g) => g.cls === 'guerrero')).toBe(false);
    expect(GRIMOIRE.some((g) => g.kind === 'blessing')).toBe(true);
  });
});

describe('Archivo · registro automático', () => {
  beforeEach(reset);
  it('un enemigo que aparece queda descubierto, una sola vez por combate', () => {
    const run = fight();
    const kinds = new Set(run.combat!.units.filter((u) => u.team === 'enemy').map((u) => u.kind));
    expect(recordArchive(run, 'a')).toBe(true);
    for (const k of kinds) expect(levelFor('bestiary', k)).toBe(LV.found);
    const before = JSON.stringify(meta().archive);
    expect(recordArchive(run, 'a')).toBe(false);
    expect(JSON.stringify(meta().archive)).toBe(before);
    for (const k of kinds) expect(meta().archive!.bestiary[k]!.seen).toBe(1);
  });
  it('derrotar a un enemigo lo estudia y se cuenta una vez aunque el evento se repita', () => {
    const run = fight();
    recordArchive(run, 'a');
    const e = run.combat!.units.find((u) => u.team === 'enemy' && BESTIARY.some((b) => b.id === u.kind))!;
    const ev: GameEvent[] = [{ t: 'death', unit: e.id }];
    recordArchive(run, 'a', ev);
    expect(levelFor('bestiary', e.kind)).toBe(LV.studied);
    expect(meta().archive!.bestiary[e.kind]!.n).toBe(1);
    recordArchive(run, 'a', ev);
    expect(meta().archive!.bestiary[e.kind]!.n).toBe(1);
  });
  it('documentado tras varias derrotas en combates distintos; recargar no recuenta', () => {
    const k = BESTIARY[0]!.id;
    for (let i = 0; i < DOCUMENTED_KILLS; i++) raise(meta().archive!, 'bestiary', k, LV.studied, { n: 1 });
    const run = fight();
    const u = run.combat!.units.find((x) => x.team === 'enemy')!;
    u.kind = k;
    recordArchive(run, 'a');
    recordArchive(run, 'a', [{ t: 'death', unit: u.id }]);
    expect(levelFor('bestiary', k)).toBe(LV.documented);
    resetArchiveTracking(); // «recarga»: se pierde la memoria, pero el combate en curso está guardado en el Archivo
    recordArchive(run, 'a', [{ t: 'death', unit: u.id }]);
    expect(meta().archive!.bestiary[k]!.n).toBe(DOCUMENTED_KILLS + 1);
  });
  it('registra la muerte aunque llegue en el mismo cambio en que acaba el combate', () => {
    const run = fight();
    recordArchive(run, 'a');
    const e = run.combat!.units.find((u) => u.team === 'enemy' && BESTIARY.some((b) => b.id === u.kind))!;
    run.combat = null;
    recordArchive(run, 'a', [{ t: 'death', unit: e.id }]);
    expect(levelFor('bestiary', e.kind)).toBe(LV.studied);
  });
  it('hechizos y bendiciones que tienes quedan descubiertos; lanzarlos los marca como utilizados', () => {
    const run = fight();
    const h = run.heroes[0]!;
    h.boons = [GRIMOIRE.find((g) => g.kind === 'blessing' && g.cls === 'arquero')?.id ?? GRIMOIRE.find((g) => g.kind === 'blessing')!.id];
    recordArchive(run, 'a');
    const base = GRIMOIRE.filter((g) => g.kind === 'spell' && g.cls === 'arquero').map((g) => g.id);
    expect(base.some((id) => levelFor('grimoire', id) === LV.found)).toBe(true);
    expect(levelFor('grimoire', h.boons[0]!)).toBe(LV.found);
    const s = run.combat!;
    startCombat(s);
    const u = s.units.find((x) => x.owner === 'a')!;
    const spell = u.spells.map((sp) => sp.id).find((id) => base.includes(id))!;
    recordArchive(run, 'a', [{ t: 'cast', unit: u.id, spell, at: u.pos }]);
    expect(levelFor('grimoire', spell)).toBe(LV.studied);
    recordArchive(run, 'a', [{ t: 'cast', unit: u.id, spell, at: u.pos }]);
    expect(meta().archive!.grimoire[spell]!.lv).toBe(2);
    // un hechizo ajeno no cuenta
    const other = base.find((id) => id !== spell && levelFor('grimoire', id) < 2)!;
    recordArchive(run, 'a', [{ t: 'cast', unit: u.id + 99, spell: other, at: u.pos }]);
    expect(levelFor('grimoire', other)).toBe(LV.found);
  });
  it('una reliquia encontrada queda descubierta una vez; solo registra al jugador que la tiene', () => {
    const run = fight();
    run.heroes[0]!.relics = ['colmillo'];
    expect(recordArchive(run, 'otro')).toBe(false);
    expect(discovered('relics', 'colmillo')).toBe(false);
    recordArchive(run, 'a');
    expect(levelFor('relics', 'colmillo')).toBe(LV.found);
    recordArchive(run, 'a');
    expect(meta().archive!.relics.colmillo!.seen).toBe(1);
  });
  it('no da ecos ni cambia el resultado de la partida', () => {
    const run = fight();
    const before = meta().ecos, e = ecosFor(run);
    recordArchive(run, 'a');
    expect(meta().ecos).toBe(before);
    expect(ecosFor(run)).toBe(e);
  });
  it('nunca interrumpe la partida: estado raro = sin cambios y sin excepción', () => {
    expect(recordArchive(null, 'a')).toBe(false);
    const run = fight();
    run.combat!.units = undefined as never;
    expect(() => recordArchive(run, 'a')).not.toThrow();
  });
});

describe('Archivo · persistencia y migración', () => {
  beforeEach(() => { reset(); meta().ecos = 0; meta().claimed = []; });
  it('una Meta antigua (sin archive) se carga sin perder nada', () => {
    const old = { v: 1, ecos: 321, perks: { vit: 2 }, unlocked: [], maxAsc: 3, achievements: ['victoria'], stats: { runs: 9, wins: 2, kills: 40, bosses: 3, bestZone: 3 }, seenTutorial: true, combats: 5, claimed: ['k'], mastery: { arquero: 150 }, hall: [], team: [], t: 5, acct: null, friends: ['bea'] };
    store.rda_meta = JSON.stringify(old);
    replaceMeta(JSON.parse(store.rda_meta));
    const m = meta();
    // las Mejoras retiradas se devuelven: vit 2 = 30 + 55
    expect([m.ecos, m.perks, m.maxAsc, m.achievements, m.mastery, m.friends, m.stats.runs]).toEqual([321 + 85, undefined, 3, ['victoria'], { arquero: 150 }, ['bea'], 9]);
    expect(m.archive).toEqual(normalizeArchive(undefined));
  });
  it('datos corruptos del Archivo se sanean', () => {
    const a = normalizeArchive({ bestiary: { x: { lv: 99, seen: -3, n: 'a' }, y: { lv: 0 } }, relics: 'mal', cur: { k: 5 } });
    expect(a.bestiary.x).toEqual({ lv: 3, seen: 0, n: 0 });
    expect(a.bestiary.y).toBeUndefined();
    expect(a.relics).toEqual({});
    expect(a.cur).toBeNull();
  });
  it('guardar y cargar conserva el Archivo', () => {
    discover('relics', 'colmillo'); setLevel('bestiary', BESTIARY[1]!.id, LV.studied);
    saveMeta();
    const saved = JSON.parse(store.rda_meta);
    replaceMeta(JSON.parse(JSON.stringify(saved)));
    expect(discovered('relics', 'colmillo')).toBe(true);
    expect(levelFor('bestiary', BESTIARY[1]!.id)).toBe(LV.studied);
  });
  it('siembra desde el Salón una sola vez, sin duplicar', () => {
    meta().archive = normalizeArchive(undefined);
    meta().hall = [{ id: 'h1', name: 'H', by: 'a', cls: 'arquero', routes: [], level: 3, equip: {}, ups: {}, asc: 0, won: true, date: '2026-01-01' }];
    const n1 = completion('grimoire').found;
    expect(n1).toBeGreaterThan(0);
    meta().hall = [];
    expect(completion('grimoire').found).toBe(n1);
    expect(meta().archive!.seeded).toBe(true);
  });
  it('fusión local/remota: unión de entradas, mayor nivel y contadores, sin duplicar ni perder el resto', () => {
    const a = emptyArchive(), b = emptyArchive();
    raise(a, 'bestiary', 'limo', LV.found, { seen: 2 });
    raise(b, 'bestiary', 'limo', LV.studied, { seen: 1, n: 4 });
    raise(a, 'relics', 'colmillo', 1, { seen: 1 });
    raise(b, 'grimoire', 'tiro_certero', 1, { seen: 1 });
    const m = mergeArchive(a, b);
    expect(m.bestiary.limo).toEqual({ lv: 2, seen: 2, n: 4 });
    expect(Object.keys(m.relics)).toEqual(['colmillo']);
    expect(Object.keys(m.grimoire)).toEqual(['tiro_certero']);
    expect(mergeArchive(m, m)).toEqual(m);
    const base = { v: 1 as const, ecos: 10, perks: { vit: 1 }, unlocked: [], maxAsc: 0, achievements: ['x'], stats: { runs: 1, wins: 0, kills: 0, bosses: 0, bestZone: 1 }, seenTutorial: false, combats: 0, claimed: [], mastery: { arquero: 50 }, hall: [], team: [], t: 1, acct: null, friends: [] };
    const merged = mergeMeta({ ...base, archive: a }, { ...base, ecos: 99, mastery: { arquero: 10, mago: 5 }, archive: b });
    expect(merged.ecos).toBe(99);
    expect(merged.mastery).toEqual({ arquero: 50, mago: 5 });
    expect(merged.archive!.bestiary.limo!.lv).toBe(2);
    // una Meta remota antigua sin archive no borra el local
    expect(mergeMeta({ ...base, archive: a }, base).archive!.bestiary.limo!.seen).toBe(2);
  });
  it('conserva ecos, mejoras, maestría y logros al jugar y cobrar una partida con el Archivo activo', () => {
    meta().perks = { vit: 1 }; meta().achievements = ['victoria']; meta().mastery = { arquero: MASTERY_XP[0]! };
    const run = fight();
    recordArchive(run, 'a');
    run.phase = 'lost';
    const r = settle(run, 'a')!;
    expect(meta().ecos).toBe(r.ecos);
    expect(meta().perks).toEqual({ vit: 1 });
    expect(meta().achievements).toContain('victoria');
    expect(meta().mastery.arquero).toBeGreaterThanOrEqual(MASTERY_XP[0]!);
    expect(meta().archive!.bestiary).not.toEqual({});
    const ecos = meta().ecos;
    settle(run, 'a');
    expect(meta().ecos).toBe(ecos);
  });
});
