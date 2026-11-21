import { beforeEach, describe, expect, it } from 'vitest';
import { ATLAS, CHRONICLES, atlasEntry, chronicleEntry, chronicleState, registerAtlasDiscovery, registerChronicleProgress } from '../src/game/atlas';
import { BESTIARY, LV, discover, recordArchive, resetArchiveTracking, setLevel, catalogIds, completion } from '../src/game/archive';
import { MASTERED_AT, emptyArchive, mergeArchive, normalizeArchive } from '../src/game/archiveData';
import { MASTERY_XP, ecosFor, mergeMeta, meta, replaceMeta, saveMeta, settle } from '../src/game/meta';
import { chooseNode, newRun, type RunState } from '../src/game/run';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }];
const fight = (seed = 3): RunState => { const run = roomStep(newRun('ATLS', seed, P)); chooseNode(run, 0); expect(run.phase).toBe('combat'); return run; };
const win = (run: RunState): void => { run.combat = null; run.fight++; run.phase = 'map'; };
const reset = (): void => { meta().archive = emptyArchive(); meta().hall = []; resetArchiveTracking(); };

describe('Fase B · Atlas', () => {
  beforeEach(reset);
  it('descubre una entrada nueva y la repetición con la misma clave no cuenta', () => {
    const m = meta();
    expect(registerAtlasDiscovery(m, 'pacts', 'sangre', 'unlocked', 'r1')).toBe(true);
    expect(atlasEntry(m, 'pacts', 'sangre')).toMatchObject({ state: 'unlocked', encounters: 1, completions: 0 });
    expect(registerAtlasDiscovery(m, 'pacts', 'sangre', 'unlocked', 'r1')).toBe(false);
    expect(atlasEntry(m, 'pacts', 'sangre')!.encounters).toBe(1);
  });
  it('un encuentro nuevo (otra clave) suma al conteo sin cambiar el estado', () => {
    const m = meta();
    registerAtlasDiscovery(m, 'omens', 'sangre', 'unlocked', 'a');
    registerAtlasDiscovery(m, 'omens', 'sangre', 'unlocked', 'b');
    expect(atlasEntry(m, 'omens', 'sangre')).toMatchObject({ state: 'unlocked', encounters: 2 });
  });
  it('transiciones: unlocked → explored → mastered, sin bajar nunca', () => {
    const m = meta();
    registerAtlasDiscovery(m, 'zones', 'z1', 'unlocked', 'a');
    registerAtlasDiscovery(m, 'zones', 'z1', 'explored', 'd1');
    expect(atlasEntry(m, 'zones', 'z1')!.state).toBe('explored');
    registerAtlasDiscovery(m, 'zones', 'z1', 'unlocked', 'b');
    expect(atlasEntry(m, 'zones', 'z1')!.state).toBe('explored');
    for (let i = 2; i <= MASTERED_AT; i++) registerAtlasDiscovery(m, 'zones', 'z1', 'explored', `d${i}`);
    expect(atlasEntry(m, 'zones', 'z1')).toMatchObject({ state: 'mastered', completions: MASTERED_AT });
    registerAtlasDiscovery(m, 'zones', 'z1', 'explored', 'd1');
    expect(atlasEntry(m, 'zones', 'z1')!.state).toBe('mastered');
  });
  it('completar sin haberlo visto lo registra también como encontrado; mastered se puede forzar', () => {
    const m = meta();
    registerAtlasDiscovery(m, 'events', ATLAS.events[0]!.id, 'explored', 'x');
    expect(atlasEntry(m, 'events', ATLAS.events[0]!.id)).toMatchObject({ state: 'explored', encounters: 1, completions: 1 });
    registerAtlasDiscovery(m, 'pacts', 'hierro', 'mastered');
    expect(atlasEntry(m, 'pacts', 'hierro')!.state).toBe('mastered');
  });
  it('ignora ids inexistentes y los catálogos salen del contenido real', () => {
    expect(registerAtlasDiscovery(meta(), 'pacts', 'no_existe')).toBe(false);
    expect(ATLAS.zones).toHaveLength(4);
    expect(ATLAS.pacts.length).toBeGreaterThanOrEqual(13);
    expect(ATLAS.omens.length).toBeGreaterThan(5);
    for (const c of Object.values(ATLAS)) expect(new Set(c.map((r) => r.id)).size).toBe(c.length);
  });
});

describe('Fase B · Crónicas', () => {
  beforeEach(reset);
  it('estados locked → discovered → completed y el avance solo sube', () => {
    const m = meta();
    expect(chronicleState(m, 'stories', 'zona_1')).toBe('locked');
    registerChronicleProgress(m, 'stories', 'zona_1', 1, 'k1');
    expect(chronicleState(m, 'stories', 'zona_1')).toBe('discovered');
    registerChronicleProgress(m, 'stories', 'zona_1', 2, 'k2');
    expect(chronicleState(m, 'stories', 'zona_1')).toBe('completed');
    registerChronicleProgress(m, 'stories', 'zona_1', 1, 'k3');
    expect(chronicleEntry(m, 'stories', 'zona_1')).toMatchObject({ state: 'completed', progress: 2 });
  });
  it('misma clave = sin cambios; valores no válidos e ids desconocidos se ignoran', () => {
    const m = meta();
    registerChronicleProgress(m, 'secrets', 'relampago', 1, 'f1');
    expect(registerChronicleProgress(m, 'secrets', 'relampago', 1, 'f1')).toBe(false);
    expect(registerChronicleProgress(m, 'secrets', 'relampago', 0)).toBe(false);
    expect(registerChronicleProgress(m, 'secrets', 'no_existe', 1)).toBe(false);
    expect(chronicleState(m, 'secrets', 'relampago')).toBe('completed');
  });
  it('los hitos se completan al alcanzar su porcentaje de colección', () => {
    for (const id of catalogIds('relics').slice(0, 6)) discover('relics', id);
    const run = fight(); // cualquier registro evalúa los hitos
    recordArchive(run, 'a');
    const pct = completion('relics').pct;
    expect(pct).toBeGreaterThanOrEqual(25);
    expect(chronicleState(meta(), 'milestones', 'relics_25')).toBe('completed');
    expect(chronicleState(meta(), 'milestones', 'relics_50')).toBe(pct >= 50 ? 'completed' : 'discovered');
    expect(chronicleState(meta(), 'milestones', 'relics_100')).not.toBe('completed');
  });
  it('catálogo de historias con los textos del juego y sin duplicados', () => {
    expect(CHRONICLES.stories.length).toBe(4 + 8 + 2);
    expect(CHRONICLES.stories.every((s) => s.text.length > 10)).toBe(true);
    expect(CHRONICLES.milestones).toHaveLength(12);
  });
});

describe('Fase B · puntos de registro', () => {
  beforeEach(reset);
  it('entrar en una expedición registra zona, historia de zona e historia de clase, una sola vez', () => {
    const run = fight();
    recordArchive(run, 'a');
    expect(atlasEntry(meta(), 'zones', 'z1')).toMatchObject({ state: 'unlocked', encounters: 1 });
    expect(chronicleState(meta(), 'stories', 'zona_1')).toBe('discovered');
    expect(chronicleState(meta(), 'stories', 'clase_arquero')).toBe('discovered');
    recordArchive(run, 'a'); resetArchiveTracking(); recordArchive(run, 'a');
    expect(atlasEntry(meta(), 'zones', 'z1')!.encounters).toBe(1);
  });
  it('pactos y presagios: encuentro al verlos y compleción al ganar con ellos', () => {
    const run = fight();
    run.pact = 'hierro'; run.omen = 'sangre'; run.kind = 'boss';
    recordArchive(run, 'a');
    expect(atlasEntry(meta(), 'pacts', 'hierro')!.state).toBe('unlocked');
    expect(atlasEntry(meta(), 'omens', 'sangre')!.state).toBe('unlocked');
    win(run); run.omen = null;
    recordArchive(run, 'a');
    expect(atlasEntry(meta(), 'omens', 'sangre')).toMatchObject({ state: 'explored', completions: 1 });
    expect(atlasEntry(meta(), 'pacts', 'hierro')).toMatchObject({ state: 'explored', completions: 1 });
    expect(atlasEntry(meta(), 'zones', 'z1')!.state).toBe('explored');
    expect(chronicleState(meta(), 'stories', 'zona_1')).toBe('completed');
    const snapshot = JSON.stringify(meta().archive);
    recordArchive(run, 'a'); resetArchiveTracking(); recordArchive(run, 'a');
    expect(JSON.stringify(meta().archive)).toBe(snapshot);
  });
  it('eventos: desbloqueo al aparecer y exploración al resolverse', () => {
    const run = roomStep(newRun('ATLS', 5, P));
    const ev = ATLAS.events[0]!.id;
    run.phase = 'event'; run.event = { id: ev, votes: {} };
    recordArchive(run, 'a');
    expect(atlasEntry(meta(), 'events', ev)!.state).toBe('unlocked');
    run.event.result = 'hecho';
    recordArchive(run, 'a'); recordArchive(run, 'a');
    expect(atlasEntry(meta(), 'events', ev)).toMatchObject({ state: 'explored', encounters: 1, completions: 1 });
  });
  it('secretos de combate: Relámpago y Intocables al ganar un élite rápido y sin bajas', () => {
    const run = fight();
    run.kind = 'elite';
    recordArchive(run, 'a');
    win(run);
    recordArchive(run, 'a');
    expect(chronicleState(meta(), 'secrets', 'relampago')).toBe('completed');
    expect(chronicleState(meta(), 'secrets', 'intocables')).toBe('completed');
    expect(chronicleState(meta(), 'secrets', 'al_limite')).toBe('locked');
  });
  it('un combate normal no da Intocables, y una baja lo impide en un élite', () => {
    const a = fight();
    recordArchive(a, 'a'); win(a); recordArchive(a, 'a');
    expect(chronicleState(meta(), 'secrets', 'intocables')).toBe('locked');
    reset();
    const b = fight(); b.kind = 'elite';
    recordArchive(b, 'a');
    const hero = b.combat!.units.find((u) => u.owner === 'a')!;
    recordArchive(b, 'a', [{ t: 'death', unit: hero.id }]);
    win(b); recordArchive(b, 'a');
    expect(chronicleState(meta(), 'secrets', 'intocables')).toBe('locked');
  });
  it('Al límite: héroe por debajo del 10% que sigue en pie al ganar', () => {
    const run = fight();
    recordArchive(run, 'a');
    const hero = run.combat!.units.find((u) => u.owner === 'a')!;
    hero.hp = 1;
    recordArchive(run, 'a');
    win(run); recordArchive(run, 'a');
    expect(chronicleState(meta(), 'secrets', 'al_limite')).toBe('completed');
  });
  it('final de partida: victoria y derrota desbloquean su final; la historia de clase se completa al ganar', () => {
    const run = fight();
    run.phase = 'won'; recordArchive(run, 'a');
    expect(chronicleState(meta(), 'stories', 'final_victoria')).toBe('completed');
    expect(chronicleState(meta(), 'stories', 'clase_arquero')).toBe('completed');
    expect(chronicleState(meta(), 'stories', 'final_derrota')).toBe('locked');
    run.phase = 'lost'; recordArchive(run, 'a');
    expect(chronicleState(meta(), 'stories', 'final_derrota')).toBe('completed');
  });
  it('registra solo al jugador de la partida y no interrumpe con estados raros', () => {
    const run = fight();
    expect(recordArchive(run, 'otro')).toBe(false);
    expect(atlasEntry(meta(), 'zones', 'z1')).toBeUndefined();
    run.combat!.units = undefined as never;
    expect(() => recordArchive(run, 'a')).not.toThrow();
  });
});

describe('Fase B · persistencia, migración y conservación', () => {
  beforeEach(() => { reset(); meta().ecos = 0; meta().claimed = []; });
  it('un Archivo de la Fase A (sin atlas ni crónicas) se completa sin perder nada', () => {
    const faseA = { v: 1, bestiary: { limo: { lv: 2, seen: 3, n: 4 } }, grimoire: {}, relics: { colmillo: { lv: 1, seen: 1, n: 0 } }, cur: null, seeded: true };
    const a = normalizeArchive(faseA);
    expect(a.bestiary.limo).toEqual({ lv: 2, seen: 3, n: 4 });
    expect(a.relics.colmillo!.lv).toBe(1);
    expect(a.atlas).toEqual({ zones: {}, events: {}, pacts: {}, omens: {}, mods: {} });
    expect(a.chronicles).toEqual({ stories: {}, secrets: {}, milestones: {} });
    expect(a.seeded).toBe(true);
  });
  it('datos corruptos de Atlas y Crónicas se sanean', () => {
    const a = normalizeArchive({ atlas: { zones: { z1: { state: 'raro', encounters: 2 }, z2: { state: 'explored', encounters: -5, completions: 'x' } }, pacts: 'mal' }, chronicles: { stories: { a: { state: 'locked', progress: 3 }, b: { state: 'completed', progress: 2 } } } });
    expect(a.atlas.zones.z1).toBeUndefined();
    expect(a.atlas.zones.z2).toEqual({ state: 'explored', encounters: 0, completions: 0 });
    expect(a.atlas.pacts).toEqual({});
    expect(a.chronicles.stories.a).toBeUndefined();
    expect(a.chronicles.stories.b).toEqual({ state: 'completed', progress: 2 });
  });
  it('guardar y cargar conserva Atlas y Crónicas', () => {
    registerAtlasDiscovery(meta(), 'pacts', 'sangre', 'explored', 'k');
    registerChronicleProgress(meta(), 'secrets', 'relampago', 1, 'k');
    saveMeta();
    replaceMeta(JSON.parse(store.rda_meta));
    expect(atlasEntry(meta(), 'pacts', 'sangre')).toMatchObject({ state: 'explored', completions: 1 });
    expect(chronicleState(meta(), 'secrets', 'relampago')).toBe('completed');
  });
  it('fusión local/remota: mayor estado y contadores, sin duplicar', () => {
    const a = { archive: emptyArchive() }, b = { archive: emptyArchive() };
    registerAtlasDiscovery(a, 'zones', 'z1', 'unlocked', 'a');
    registerAtlasDiscovery(b, 'zones', 'z1', 'explored', 'b');
    registerAtlasDiscovery(b, 'zones', 'z2', 'unlocked', 'b');
    registerChronicleProgress(a, 'stories', 'zona_1', 1, 'a');
    registerChronicleProgress(b, 'stories', 'zona_1', 2, 'b');
    const m = mergeArchive(a.archive, b.archive);
    expect(m.atlas.zones.z1).toMatchObject({ state: 'explored', completions: 1 });
    expect(Object.keys(m.atlas.zones).sort()).toEqual(['z1', 'z2']);
    expect(m.chronicles.stories.zona_1).toMatchObject({ state: 'completed', progress: 2 });
    expect(mergeArchive(m, m)).toEqual(m);
    expect(mergeArchive(m, undefined)).toEqual(m);
  });
  it('conserva ecos, mejoras, maestría y logros al registrar y cobrar; no hay recompensas por descubrir', () => {
    const m = meta();
    m.perks = { vit: 2 }; m.achievements = ['victoria']; m.mastery = { arquero: MASTERY_XP[1]! }; m.stats.runs = 4;
    const run = fight();
    run.pact = 'sangre'; run.omen = 'pantano';
    const before = { ecos: m.ecos, perks: { ...m.perks }, ach: [...m.achievements], mastery: { ...m.mastery }, ecosFor: ecosFor(run) };
    setLevel('bestiary', BESTIARY[0]!.id, LV.studied);
    recordArchive(run, 'a'); win(run); recordArchive(run, 'a');
    expect(m.ecos).toBe(before.ecos);
    expect(m.perks).toEqual(before.perks);
    expect(m.achievements).toEqual(before.ach);
    expect(m.mastery).toEqual(before.mastery);
    run.phase = 'lost';
    const r = settle(run, 'a')!;
    expect(r.ecos).toBeGreaterThan(0);
    expect(m.ecos).toBe(before.ecos + r.ecos);
    const e = m.ecos; settle(run, 'a');
    expect(m.ecos).toBe(e);
  });
  it('mergeMeta une el Archivo completo sin perder ecos ni maestría', () => {
    const base = { v: 1 as const, ecos: 5, perks: {}, unlocked: [], maxAsc: 0, achievements: [], stats: { runs: 0, wins: 0, kills: 0, bosses: 0, bestZone: 0 }, seenTutorial: false, combats: 0, claimed: [], mastery: { arquero: 7 }, hall: [], team: [], t: 1, acct: null, friends: [] };
    const l = { ...base, archive: emptyArchive() }, r = { ...base, ecos: 50, mastery: { arquero: 3, mago: 9 }, archive: emptyArchive() };
    registerAtlasDiscovery(r, 'omens', 'eclipse', 'unlocked', 'x');
    const mm = mergeMeta(l, r);
    expect(mm.ecos).toBe(50);
    expect(mm.mastery).toEqual({ arquero: 7, mago: 9 });
    expect(mm.archive!.atlas.omens.eclipse!.state).toBe('unlocked');
  });
});
