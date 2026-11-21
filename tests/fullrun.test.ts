import { beforeEach, describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/state';
import { archiveTotal, drainArchiveNotices, recordArchive, resetArchiveTracking } from '../src/game/archive';
import { atlasEntry, chronicleState } from '../src/game/atlas';
import { REWARD, refreshContracts } from '../src/game/contracts';
import { claimSpecialReward, specialRows } from '../src/game/specials';
import { mergeMeta, meta, replaceMeta, saveMeta, settle, type Meta } from '../src/game/meta';
import { availableNodes, chooseNode, finishFight, lastZone, leaveNode, metaAction, newRun, resolveEvent, vote, type RunState } from '../src/game/run';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

/** Meta tal como la guardaba el juego antes del Archivo (commit be207e0): sin archive, contracts ni cosmetics. */
const OLD_META = { v: 1, ecos: 412, perks: { vit: 2, gold: 1 }, unlocked: [], maxAsc: 2, achievements: ['victoria', 'jefe1'], stats: { runs: 14, wins: 3, kills: 210, bosses: 9, bestZone: 4 }, seenTutorial: true, combats: 60, claimed: ['OLD:1'], mastery: { arquero: 230, zorro: 45 }, hall: [], team: [], t: 1000, acct: null, friends: ['bea'] };

const P = [{ owner: 'a', name: 'Ana', cls: 'arquero' as const, routes: [] as string[] }, { owner: 'b', name: 'Bru', cls: 'zorro' as const, routes: [] as string[] }];

/** Juega una expedición entera como haría el anfitrión, ganando cada combate; `step` recibe los eventos de cada paso. */
function playRun(run: RunState, step: (ev: GameEvent[]) => void): number {
  let n = 0;
  for (; n < 600 && run.phase !== 'won' && run.phase !== 'lost'; n++) {
    for (const h of run.heroes) {
      if (h.bossOffer) metaAction(run, h.owner, { a: 'bossreward', idx: 0 });
      if (h.boonOffer) metaAction(run, h.owner, { a: 'boon', idx: 0 });
    }
    if (run.phase === 'room') {
      const r = run.room!;
      if (r.kind === 'altar' && !r.result) for (const h of run.heroes) metaAction(run, h.owner, { a: 'room', op: 'pact', idx: 0 });
      if (r.kind === 'chest') metaAction(run, run.heroes[0]!.owner, { a: 'room', op: 'open' });
      if (r.kind === 'rest') for (const h of run.heroes) metaAction(run, h.owner, { a: 'room', op: 'rest', idx: 0 });
      step([]); leaveNode(run); step([]);
    } else if (run.phase === 'map') {
      step(chooseNode(run, availableNodes(run)[0]!));
    } else if (run.phase === 'combat') {
      const c = run.combat!;
      const ev: GameEvent[] = [];
      const me = c.units.find((u) => u.team === 'hero' && u.owner === 'a');
      if (me) ev.push({ t: 'cast', unit: me.id, spell: me.spells[0]!.id, at: me.pos });
      for (const u of c.units.filter((x) => x.team === 'enemy' && x.hp > 0)) { u.hp = 0; ev.push({ t: 'death', unit: u.id }); }
      step(ev);
      c.over = 'win';
      finishFight(run); step([]);
    } else if (run.phase === 'event') {
      if (!run.event!.result) { for (const h of run.heroes) vote(run, h.owner, 0); resolveEvent(run, run.heroes[0]!.owner); }
      step([]); leaveNode(run); step([]);
    } else if (run.phase === 'shop') { step([]); leaveNode(run); step([]); }
  }
  return n;
}

/** Cada cliente tiene su propia Meta (como en dos navegadores). Se cambia de una a otra para registrar. */
const clients: Record<string, string> = {};
const as = <T,>(id: string, fn: () => T): T => { replaceMeta(JSON.parse(clients[id]!)); const r = fn(); saveMeta(false); clients[id] = JSON.stringify(meta()); return r; };

describe('Fase E · expedición completa hasta el jefe del Abismo (2 jugadores)', () => {
  beforeEach(() => {
    resetArchiveTracking(); drainArchiveNotices();
    clients.a = JSON.stringify(OLD_META);
    clients.b = JSON.stringify({ ...OLD_META, ecos: 5, mastery: {}, achievements: [] });
  });

  it('recorre las 4 zonas, registra el Archivo de cada uno sin alterar la partida y conserva el progreso antiguo', () => {
    const run = newRun('FULL', 21, P, { abyss: true });
    expect(lastZone(run)).toBe(3);
    let mutated = 0;
    const n = playRun(run, (ev) => {
      // anfitrión: estado original · invitado: copia recibida por red (JSON)
      const before = JSON.stringify(run);
      as('a', () => recordArchive(run, 'a', ev));
      as('b', () => recordArchive(JSON.parse(before) as RunState, 'b', ev));
      if (JSON.stringify(run) !== before) mutated++;
    });
    expect(run.phase).toBe('won');
    expect(run.zone).toBe(3);
    expect(n).toBeLessThan(600);
    expect(mutated).toBe(0); // el Archivo nunca toca el estado autoritativo: sin desincronización

    for (const id of ['a', 'b']) as(id, () => {
      const m = meta();
      for (const z of ['z1', 'z2', 'z3', 'z4']) expect(atlasEntry(m, 'zones', z)!.state, `${id} ${z}`).toBe('explored');
      expect(chronicleState(m, 'stories', 'final_victoria')).toBe('completed');
      expect(chronicleState(m, 'stories', `clase_${id === 'a' ? 'arquero' : 'zorro'}`)).toBe('completed');
      expect(Object.keys(m.archive!.bestiary).length).toBeGreaterThan(10);
      expect(Object.values(m.archive!.bestiary).every((e) => e.lv >= 2)).toBe(true);
      expect(m.archive!.atlas.pacts[run.pact!]).toBeTruthy();
      // prueba de clase: ganada con pacto
      expect(specialRows(m).find((r) => r.def.id === `class_${id === 'a' ? 'arquero' : 'zorro'}`)!.completed).toBe(true);
      expect(archiveTotal().pct).toBeGreaterThan(0);
    });
    // los hechizos solo cuentan para quien los lanza
    as('a', () => expect(Object.values(meta().archive!.grimoire).some((e) => e.lv === 2)).toBe(true));
    as('b', () => expect(Object.values(meta().archive!.grimoire).some((e) => e.lv === 2)).toBe(false));

    // progreso antiguo intacto
    as('a', () => {
      const m = meta();
      expect([m.ecos, m.perks, m.maxAsc, m.achievements, m.mastery, m.friends, m.stats.runs]).toEqual([OLD_META.ecos, OLD_META.perks, 2, OLD_META.achievements, OLD_META.mastery, ['bea'], 14]);
    });

    // cobro final: una vez por jugador
    as('a', () => {
      const res = settle(run, 'a')!;
      expect(res.ecos).toBeGreaterThan(200);
      expect(meta().ecos).toBeGreaterThanOrEqual(OLD_META.ecos + res.ecos);
      const e = meta().ecos;
      expect(settle(run, 'a') === null || meta().ecos === e).toBe(true);
      expect(meta().ecos).toBe(e);
    });
  });

  it('repetir todos los registros (reconexiones, recargas) no cambia nada', () => {
    const run = newRun('REPL', 22, P);
    const log: Array<{ s: string; ev: GameEvent[] }> = [];
    playRun(run, (ev) => { const s = JSON.stringify(run); log.push({ s, ev }); as('a', () => recordArchive(JSON.parse(s), 'a', ev)); });
    const once = JSON.parse(clients.a!) as Meta;
    resetArchiveTracking();
    for (const { s, ev } of log) as('a', () => recordArchive(JSON.parse(s), 'a', ev));
    const twice = JSON.parse(clients.a!) as Meta;
    const strip = (m: Meta) => ({ ...m, t: 0 });
    const d = (x: unknown, y: unknown, path = ''): string[] => { if (JSON.stringify(x) === JSON.stringify(y)) return []; if (x && y && typeof x === 'object' && typeof y === 'object') return [...new Set([...Object.keys(x), ...Object.keys(y as object)])].flatMap((k) => d((x as never)[k], (y as never)[k], `${path}.${k}`)); return [`${path}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`]; };
    expect(d(once.archive, twice.archive)).toEqual([]);
    expect(strip(twice).archive).toEqual(strip(once).archive);
    expect(twice.contracts!.daily.map((c) => c.progress)).toEqual(once.contracts!.daily.map((c) => c.progress));
    expect(twice.ecos).toBe(once.ecos);
  });

  it('guardado local, persistencia remota (fusión) y recompensas sin duplicar entre dispositivos', () => {
    const run = newRun('SYNC', 23, P);
    playRun(run, (ev) => as('a', () => recordArchive(run, 'a', ev)));
    const local = JSON.parse(clients.a!) as Meta;
    // «nube»: la misma cuenta en otro dispositivo, con la Meta antigua
    const cloud = JSON.parse(JSON.stringify(OLD_META)) as Meta;
    const merged = mergeMeta(local, cloud);
    expect(merged.archive).toEqual(local.archive && mergeMeta(local, local).archive);
    expect(merged.ecos).toBe(Math.max(local.ecos, cloud.ecos));
    expect(merged.mastery).toEqual(OLD_META.mastery);
    // un especial reclamado en un dispositivo sigue reclamado tras fusionar, y no se puede volver a reclamar
    replaceMeta(local);
    const done = specialRows(meta()).find((r) => r.completed && !r.claimed);
    if (done) {
      expect(claimSpecialReward(meta(), done.def.id)).toBeTruthy();
      const again = mergeMeta(meta(), local);
      replaceMeta(again);
      expect(claimSpecialReward(meta(), done.def.id)).toBeNull();
    }
    // guardar y cargar
    saveMeta();
    const back = JSON.parse(store.rda_meta!) as Meta;
    replaceMeta(back);
    expect(meta().archive).toEqual(back.archive);
  });

  it('una partida perdida también registra y cobra una sola vez', () => {
    const run = newRun('LOSS', 24, P);
    let k = 0;
    playRun(run, (ev) => { as('a', () => recordArchive(run, 'a', ev)); if (run.phase === 'map' && run.zone === 1 && ++k > 3) run.phase = 'lost'; });
    expect(run.phase).toBe('lost');
    as('a', () => recordArchive(run, 'a'));
    as('a', () => {
      expect(chronicleState(meta(), 'stories', 'final_derrota')).toBe('completed');
      expect(atlasEntry(meta(), 'zones', 'z1')!.state).toBe('explored');
      const r = settle(run, 'a')!; const e = meta().ecos;
      expect(r.ecos).toBeGreaterThan(0);
      settle(run, 'a');
      expect(meta().ecos).toBe(e);
    });
  });
});

describe('Fase E · equilibrio de recompensas', () => {
  it('los contratos son una fuente pequeña frente a las partidas; los especiales no dan ecos', () => {
    const weekMax = REWARD.daily * 3 * 7 + REWARD.weekly * 3;
    expect(weekMax).toBeLessThanOrEqual(300);
    // una sola victoria a ascensión 0 da 271: el máximo semanal de contratos no llega a 1,2 victorias
    expect(weekMax).toBeLessThan(271 * 1.2);
    const m = { contracts: undefined, archive: undefined, cosmetics: undefined, ecos: 0 } as unknown as Meta;
    refreshContracts(m);
    expect(m.ecos).toBe(0);
  });
});
