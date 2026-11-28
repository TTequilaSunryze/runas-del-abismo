// Parche «runas y otros fixes»: ecos que se ven como el lanzamiento, frecuencia de runas, Sala de los Pactos y Santuario.
import { describe, expect, it } from 'vitest';
import { SPELLS } from '../src/core/classes/spells';
import { createCombat } from '../src/core/combat/engine';
import { runEchoes } from '../src/core/combat/runefx';
import type { GameEvent } from '../src/core/state';
import { enterRoom, roomDone } from '../src/game/rooms';
import { CHEST_RUNE_CHANCE, COMBAT_RUNE_CHANCE, ELITE_RUNE_CHANCE, SHRINE_RUNE_CHANCE } from '../src/game/runeLoot';
import { advanceZone, finishFight, heroSpec, leaveNode, metaAction, newRun, pendingOf } from '../src/game/run';

const P = [{ owner: 'a', name: 'A', cls: 'zorro' as const, routes: ['base'] }];

describe('ecos rúnicos: la réplica se anima como el lanzamiento', () => {
  it('cada eco emite un lanzamiento marcado como eco antes de su daño', () => {
    const run = newRun('ECO', 1, P);
    const h = run.heroes[0]!;
    const st = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
    const me = st.units[0]!;
    const foe = { ...me, id: 99, team: 'enemy' as const, owner: null, name: 'Muñeco', pos: { x: 3, y: 1 }, hp: 50, maxHp: 50, statuses: {}, runeEchoes: undefined };
    st.units.push(foe);
    const spell = Object.values(SPELLS).find((d) => d.dmg && !d.area)!;
    me.runeEchoes = [{ spell: spell.id, at: { ...foe.pos }, pct: 0.5 }];
    const ev: GameEvent[] = [];
    const ctx = { hurt: (_s: unknown, u: { hp: number }, raw: number, e: GameEvent[]) => { const d = Math.round(raw); u.hp -= d; e.push({ t: 'damage', unit: 99, amount: d } as GameEvent); return d; }, addStatus: () => {}, heal: () => 0 };
    runEchoes(st, me, () => spell, () => 0, (a) => a, ctx as never, ev);
    const cast = ev.findIndex((e) => e.t === 'cast');
    expect(cast).toBeGreaterThanOrEqual(0);
    expect(ev[cast]).toMatchObject({ t: 'cast', unit: me.id, spell: spell.id, echo: true });
    expect(ev.findIndex((e) => e.t === 'damage')).toBeGreaterThan(cast);
    // no se vuelven a programar
    expect(me.runeEchoes).toBeUndefined();
  });
});

describe('menos runas', () => {
  it('combates normales, élites, cofres y santuarios bajan; los jefes siguen garantizados', () => {
    for (let z = 0; z < 4; z++) { expect(COMBAT_RUNE_CHANCE(z)).toBeLessThanOrEqual(0.12); expect(CHEST_RUNE_CHANCE(z)).toBeLessThanOrEqual(0.55); }
    expect(ELITE_RUNE_CHANCE).toBeLessThan(1);
    expect(SHRINE_RUNE_CHANCE).toBeLessThan(0.5);
    const run = newRun('JEFE', 3, P); run.kind = 'boss';
    const h = run.heroes[0]!; h.runeOffers = [];
    run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state; run.combat.over = 'win'; run.phase = 'combat';
    finishFight(run);
    expect(h.runeOffers!.some((o) => o.src === 'boss')).toBe(true);
  });
});

describe('Sala de los Pactos', () => {
  const beatBoss = (seed: number) => {
    const run = newRun('PACTO', seed, P); run.kind = 'boss';
    const h = run.heroes[0]!;
    run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state; run.combat.over = 'win'; run.phase = 'combat';
    finishFight(run);
    return { run, h };
  };
  it('tras el jefe: runa sí, bendición no; al descender, la sala ofrece la bendición sin contar como paso del mapa', () => {
    const { run, h } = beatBoss(4);
    expect(h.boonOffer).toBeNull();
    expect(run.zoneClear).toBe(true);
    h.runeOffers = [];
    leaveNode(run); // descenso
    expect(run.zone).toBe(1);
    expect(run.phase).toBe('room');
    expect(run.room?.kind).toBe('blessing');
    expect(pendingOf(run, h)).toContain('bendición');
    const offered = h.boonOffer!.spells;
    expect(offered).toHaveLength(3);
    expect(metaAction(run, 'a', { a: 'boon', idx: 0 })).toBeNull();
    expect(h.boons).toContain(offered[0]);
    expect(roomDone(run)).toBe(true);
    leaveNode(run);
    expect(run.step).toBe(0);
    expect(run.room).toBeNull();
    expect(['map', 'event']).toContain(run.phase);
  });
  it('es idempotente: descender dos veces no da dos bendiciones', () => {
    const { run, h } = beatBoss(7);
    h.runeOffers = [];
    advanceZone(run);
    const first = h.boonOffer;
    advanceZone(run); // sin zoneClear ya no hace nada
    expect(run.zone).toBe(1);
    expect(h.boonOffer).toBe(first);
  });
});

describe('Santuario', () => {
  it('una runa pendiente bloquea la salida hasta elegirla o renunciar (y la sala la muestra)', () => {
    const run = newRun('SANT', 2, P);
    const h = run.heroes[0]!;
    h.runeOffers = [{ src: 'shrine', runes: ['espora'] }];
    h.bossOffer = null; h.boonOffer = null;
    enterRoom(run, 'shrine');
    expect(pendingOf(run, h)).toContain('runa');
    expect(metaAction(run, 'a', { a: 'rune', op: 'skip' })).toBeNull();
    expect(pendingOf(run, h)).toHaveLength(0);
  });
});
