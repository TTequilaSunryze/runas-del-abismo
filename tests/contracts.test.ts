import { beforeEach, describe, expect, it } from 'vitest';
import { PLAYABLE } from '../src/core/classes/classes';
import { recordArchive, resetArchiveTracking } from '../src/game/archive';
import { emptyArchive } from '../src/game/archiveData';
import { REWARD, activeContracts, claimContractReward, dayKey, generateContracts, refreshContracts, trackContract, weekKey } from '../src/game/contracts';
import { emptyContracts, mergeContracts, normalizeContracts } from '../src/game/contractsData';
import { MASTERY_XP, mergeMeta, meta, replaceMeta, saveMeta } from '../src/game/meta';
import { chooseNode, newRun, type RunState } from '../src/game/run';
import { ENEMIES } from '../src/content/enemies';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const T = Date.parse('2026-11-21T12:00:00Z'); // sábado
const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }];
const fight = (): RunState => { const run = roomStep(newRun('CTRS', 3, P)); chooseNode(run, 0); return run; };
const reset = (): void => { const m = meta(); m.contracts = emptyContracts(); m.archive = emptyArchive(); m.ecos = 0; resetArchiveTracking(); };
const force = (target: Parameters<typeof trackContract>[1]['t'], id: string, n = 1) => {
  const c = meta().contracts!.daily[0]!; c.targetType = target; c.targetId = id; c.requiredCount = n; c.progress = 0; c.completed = false; c.claimed = false; return c;
};

describe('Fase C · periodos y generación', () => {
  it('claves UTC de día y semana (lunes)', () => {
    expect(dayKey(T)).toBe('2026-11-21');
    expect(weekKey(T)).toBe('2026-11-16');
    expect(weekKey(Date.parse('2026-11-16T00:00:00Z'))).toBe('2026-11-16');
    expect(weekKey(Date.parse('2026-11-15T23:59:59Z'))).toBe('2026-11-09');
  });
  it('determinista: la misma fecha da los mismos contratos; otra fecha, otros', () => {
    expect(generateContracts('daily', '2026-11-21')).toEqual(generateContracts('daily', '2026-11-21'));
    expect(JSON.stringify(generateContracts('daily', '2026-11-22'))).not.toBe(JSON.stringify(generateContracts('daily', '2026-11-21')));
  });
  it('objetivos válidos del contenido real, ids únicos y caducidad al final del periodo', () => {
    for (let i = 0; i < 30; i++) {
      const key = dayKey(T + i * 86_400_000);
      const d = generateContracts('daily', key), w = generateContracts('weekly', weekKey(T + i * 86_400_000 * 7));
      expect(d).toHaveLength(3); expect(w).toHaveLength(3);
      for (const c of [...d, ...w]) {
        if (c.targetType === 'kill') expect(c.targetId.startsWith('zone:') || !!ENEMIES[c.targetId]).toBe(true);
        if (c.targetType === 'cast') expect(PLAYABLE).toContain(c.targetId);
        if (c.targetType === 'atlas') expect(['events', 'zones', 'omens']).toContain(c.targetId);
        expect(c.requiredCount).toBeGreaterThan(0);
        expect(c.rewardEcos).toBe(REWARD[c.category]);
      }
      expect(new Set([...d, ...w].map((c) => c.id)).size).toBe(6);
      expect(d[0]!.expiresAt).toBe(Date.parse(`${key}T00:00:00Z`) + 86_400_000);
    }
  });
  it('rotación: renueva al cambiar de día o de semana y no antes', () => {
    reset();
    expect(refreshContracts(meta(), T)).toBe(true);
    const d = meta().contracts!.daily.map((c) => c.id);
    expect(refreshContracts(meta(), T + 3_600_000)).toBe(false);
    expect(refreshContracts(meta(), T + 86_400_000)).toBe(true);
    expect(meta().contracts!.daily.map((c) => c.id)).not.toEqual(d);
    expect(meta().contracts!.week).toBe('2026-11-16');
    refreshContracts(meta(), Date.parse('2026-11-23T00:00:01Z'));
    expect(meta().contracts!.week).toBe('2026-11-23');
  });
});

describe('Fase C · progreso y cobro', () => {
  beforeEach(() => { reset(); refreshContracts(meta(), T); });
  it('el progreso avanza una vez por clave y completa el contrato', () => {
    const c = force('relic', 'any', 2);
    expect(trackContract(meta(), { t: 'relic', key: 'r1' }, T)).toBe(true);
    expect(trackContract(meta(), { t: 'relic', key: 'r1' }, T)).toBe(false);
    expect(c.progress).toBe(1);
    trackContract(meta(), { t: 'relic', key: 'r2' }, T);
    expect(c).toMatchObject({ progress: 2, completed: true });
    trackContract(meta(), { t: 'relic', key: 'r3' }, T);
    expect(c.progress).toBe(2);
  });
  it('solo cuentan los acontecimientos que encajan', () => {
    const c = force('kill', 'limo', 3);
    trackContract(meta(), { t: 'kill', enemy: 'esqueleto', zone: 1, key: 'a' }, T);
    trackContract(meta(), { t: 'cast', cls: 'arquero', key: 'b' }, T);
    expect(c.progress).toBe(0);
    trackContract(meta(), { t: 'kill', enemy: 'limo', zone: 1, key: 'c' }, T);
    expect(c.progress).toBe(1);
    const z = force('kill', 'zone:2', 1);
    trackContract(meta(), { t: 'kill', enemy: 'limo', zone: 1, key: 'd' }, T);
    expect(z.progress).toBe(0);
    trackContract(meta(), { t: 'kill', enemy: 'lobo', zone: 2, key: 'e' }, T);
    expect(z.completed).toBe(true);
  });
  it('cobro idempotente: una sola vez, solo si está completado y sin caducar', () => {
    const c = force('relic', 'any', 1);
    expect(claimContractReward(meta(), c.id, T)).toBe(0);
    trackContract(meta(), { t: 'relic', key: 'x' }, T);
    expect(claimContractReward(meta(), c.id, T)).toBe(REWARD.daily);
    expect(meta().ecos).toBe(REWARD.daily);
    expect(claimContractReward(meta(), c.id, T)).toBe(0);
    c.claimed = false; // aunque se perdiera la marca, el id ya figura como pagado
    expect(claimContractReward(meta(), c.id, T)).toBe(0);
    expect(meta().ecos).toBe(REWARD.daily);
    expect(claimContractReward(meta(), 'no-existe', T)).toBe(0);
  });
  it('un contrato caducado no se cobra y desaparece al rotar', () => {
    const c = force('relic', 'any', 1);
    trackContract(meta(), { t: 'relic', key: 'x' }, T);
    expect(claimContractReward(meta(), c.id, c.expiresAt)).toBe(0);
    expect(meta().ecos).toBe(0);
    expect(activeContracts(meta(), c.expiresAt).some((x) => x.id === c.id)).toBe(false);
  });
  it('generar o rotar no da ecos; repetir la rotación no regenera ni duplica', () => {
    for (let i = 0; i < 10; i++) refreshContracts(meta(), T + i * 1000);
    expect(meta().ecos).toBe(0);
    expect(meta().contracts!.daily).toHaveLength(3);
  });
});

describe('Fase C · conexión con el juego', () => {
  beforeEach(() => { reset(); refreshContracts(meta()); });
  it('derrotar enemigos en combate avanza los contratos de caza una vez por enemigo', () => {
    const run = fight();
    recordArchive(run, 'a');
    const e = run.combat!.units.find((u) => u.team === 'enemy')!;
    const c = meta().contracts!.daily[0]!; c.targetType = 'kill'; c.targetId = e.kind; c.requiredCount = 5; c.progress = 0; c.completed = false;
    recordArchive(run, 'a', [{ t: 'death', unit: e.id }]);
    recordArchive(run, 'a', [{ t: 'death', unit: e.id }]);
    resetArchiveTracking(); recordArchive(run, 'a', [{ t: 'death', unit: e.id }]);
    expect(c.progress).toBe(1);
  });
  it('lanzar hechizos con tu héroe avanza el contrato de su clase; repetir el lote no suma', () => {
    const run = fight();
    recordArchive(run, 'a');
    const u = run.combat!.units.find((x) => x.owner === 'a')!;
    const c = meta().contracts!.daily[0]!; c.targetType = 'cast'; c.targetId = 'arquero'; c.requiredCount = 10; c.progress = 0; c.completed = false;
    const sp = u.spells[0]!.id;
    const batch = [{ t: 'cast' as const, unit: u.id, spell: sp, at: u.pos }, { t: 'cast' as const, unit: u.id, spell: sp, at: u.pos }];
    recordArchive(run, 'a', batch);
    expect(c.progress).toBe(2);
    recordArchive(run, 'a', batch);
    expect(c.progress).toBe(2);
    u.ap -= 2; recordArchive(run, 'a', [batch[0]!]);
    expect(c.progress).toBe(3);
  });
  it('runas de la partida (antes reliquias), eventos resueltos y jefes avanzan sus contratos', () => {
    const run = fight();
    const cs = meta().contracts!.daily;
    Object.assign(cs[0]!, { targetType: 'relic', targetId: 'any', requiredCount: 5, progress: 0, completed: false });
    Object.assign(cs[1]!, { targetType: 'atlas', targetId: 'zones', requiredCount: 5, progress: 0, completed: false });
    run.heroes[0]!.runes = ['fractura', 'espora'];
    run.kind = 'boss';
    recordArchive(run, 'a'); recordArchive(run, 'a');
    expect(cs[0]!.progress).toBe(2);
    run.combat = null; run.fight++; run.phase = 'map';
    recordArchive(run, 'a'); recordArchive(run, 'a');
    expect(cs[1]!.progress).toBe(1);
  });
  it('otro jugador no hace avanzar tus contratos', () => {
    const run = fight();
    run.heroes[0]!.relics = ['colmillo'];
    const c = meta().contracts!.daily[0]!; Object.assign(c, { targetType: 'relic', targetId: 'any', progress: 0, completed: false });
    recordArchive(run, 'otro');
    expect(c.progress).toBe(0);
  });
});

describe('Fase C · persistencia y conservación', () => {
  beforeEach(() => { reset(); refreshContracts(meta(), T); });
  it('Meta antigua sin contratos se completa; datos corruptos se sanean', () => {
    expect(normalizeContracts(undefined)).toEqual(emptyContracts());
    const n = normalizeContracts({ day: 5, daily: [{ id: 'x', category: 'daily', targetType: 'kill', requiredCount: -3, progress: 99, rewardEcos: 1e9 }, { id: '', category: 'daily' }, { id: 'y', category: 'raro', targetType: 'kill' }], seen: 'no' });
    expect(n.daily).toHaveLength(1);
    expect(n.daily[0]).toMatchObject({ requiredCount: 1, progress: 1, completed: true, rewardEcos: 500 });
    expect(n.seen).toEqual([]);
  });
  it('guardar y cargar conserva contratos, avance y cobros', () => {
    const c = force('relic', 'any', 1);
    trackContract(meta(), { t: 'relic', key: 'x' }, T); claimContractReward(meta(), c.id, T);
    saveMeta();
    replaceMeta(JSON.parse(store.rda_meta));
    const back = meta().contracts!.daily[0]!;
    expect(back).toMatchObject({ id: c.id, claimed: true, completed: true });
    expect(claimContractReward(meta(), c.id, T)).toBe(0);
  });
  it('fusión: mismo periodo = mayor avance y cobrado en cualquiera; periodo distinto = el más reciente', () => {
    const a = { contracts: emptyContracts() }, b = { contracts: emptyContracts() };
    refreshContracts(a, T); refreshContracts(b, T);
    a.contracts.daily[0]!.progress = 1; b.contracts.daily[0]!.progress = a.contracts.daily[0]!.requiredCount; b.contracts.daily[0]!.completed = true;
    b.contracts.daily[1]!.claimed = true; b.contracts.paid = [b.contracts.daily[1]!.id];
    const m = mergeContracts(a.contracts, b.contracts);
    expect(m.daily[0]!.completed).toBe(true);
    expect(m.daily[1]!.claimed).toBe(true);
    const old = { contracts: emptyContracts() }; refreshContracts(old, T - 86_400_000);
    expect(mergeContracts(old.contracts, a.contracts).day).toBe(dayKey(T));
    expect(mergeContracts(m, m)).toEqual(m);
  });
  it('conserva ecos, mejoras, maestría, logros y Archivo al usar contratos y al fusionar Meta', () => {
    const m = meta();
    m.perks = { vit: 3 }; m.achievements = ['victoria']; m.mastery = { arquero: MASTERY_XP[2]! }; m.ecos = 100;
    m.archive!.relics.colmillo = { lv: 1, seen: 1, n: 0 };
    const c = force('relic', 'any', 1);
    trackContract(m, { t: 'relic', key: 'x' }, T); claimContractReward(m, c.id, T);
    expect(m.ecos).toBe(100 + REWARD.daily);
    expect([m.perks, m.achievements, m.mastery, m.archive!.relics.colmillo!.lv]).toEqual([{ vit: 3 }, ['victoria'], { arquero: MASTERY_XP[2] }, 1]);
    const merged = mergeMeta(m, { ...m, contracts: undefined, ecos: 50 });
    expect(merged.ecos).toBe(100 + REWARD.daily);
    expect(merged.contracts!.daily[0]!.claimed).toBe(true);
  });
});
