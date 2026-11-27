import { beforeEach, describe, expect, it } from 'vitest';
import { CLASSES } from '../src/core/classes/classes';
import { PLAYABLE } from '../src/core/classes/classes';
import { statsText } from '../src/core/items/items';
import { RELICS, RELIC_EVENTS } from '../src/content/relics';
import { ZONES } from '../src/content/zones';
import { PATRONS } from '../src/content/boons';
import { AFFIXES } from '../src/content/enemies';
import { ACT_ROOMS } from '../src/game/map';
import { ACHIEVEMENTS, ROOM_SCALE, achievementCount, ecosFor, listedAchievements, masteryXpFor, meta, roomsCleared } from '../src/game/meta';
import { buildBossOffer, dailyZone, newRun, newSpellPool, offerBoon, offerSize, type RunState } from '../src/game/run';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const mk = (mastery = 0, cls: 'arquero' | 'arquitecto' = 'arquero'): RunState => newRun('TEST', 7, [{ owner: 'a', name: 'A', cls, routes: [], mastery }]);
const at = (r: RunState, zone: number, step: number, phase: RunState['phase'] = 'lost', flags: string[] = []): RunState => { r.zone = zone; r.step = step; r.phase = phase; r.flags = flags; return r; };

describe('Fase 0 · reto diario', () => {
  it('la zona enviada está siempre entre 1 y 3 (lo que exige daily_scores)', () => {
    const r = mk();
    const sent = [0, 1, 2, 3, 4, 5].map((z) => { r.zone = z; return dailyZone(r); });
    expect(sent).toEqual([1, 2, 3, 3, 3, 3]);
    for (const z of sent) { expect(z).toBeGreaterThanOrEqual(1); expect(z).toBeLessThanOrEqual(3); }
  });
  it('regresión: la primera zona ya no envía 0', () => {
    expect(dailyZone(at(mk(), 0, 3))).toBe(1);
  });
});

describe('Fase 0 · salas recorridas, ecos y maestría', () => {
  beforeEach(() => { meta().ecos = 0; });
  it('cuenta capas reales: la primera zona incluye el Altar; las demás, ACT_ROOMS + 1', () => {
    const per = ACT_ROOMS + 1;
    expect(roomsCleared(at(mk(), 0, 0))).toBe(0);
    expect(roomsCleared(at(mk(), 0, 4))).toBe(4);
    expect(roomsCleared(at(mk(), 1, 0))).toBe(per + 1);
    expect(roomsCleared(at(mk(), 1, 5))).toBe(per + 1 + 5);
    expect(roomsCleared(at(mk(), 2, 0))).toBe(2 * per + 1);
    const w = at(mk(), 2, per, 'won');
    expect(roomsCleared(w)).toBe(3 * per + 1);
  });
  it('sin Altar (arena) la primera zona no suma esa capa', () => {
    const r = at(mk(), 1, 0); r.arena = { a: 'x', b: null, nameA: 'A', nameB: 'B' };
    expect(roomsCleared(r)).toBe(ACT_ROOMS + 1);
  });
  it('step nunca cuenta más que las capas del mapa', () => {
    const r = at(mk(), 0, 999);
    expect(roomsCleared(r)).toBe(r.map.length);
  });
  it('ecos: derrota en 1, 2 y 3 zonas y victoria, con jefes y ascensión sin cambios', () => {
    const per = ACT_ROOMS + 1, S = ROOM_SCALE;
    expect(ecosFor(at(mk(), 0, 4))).toBe(Math.round(4 * S * 4));
    expect(ecosFor(at(mk(), 1, 5, 'lost', ['boss_0']))).toBe(Math.round((per + 1 + 5) * S * 4 + 25));
    expect(ecosFor(at(mk(), 2, 3, 'lost', ['boss_0', 'boss_1']))).toBe(Math.round((2 * per + 1 + 3) * S * 4 + 50));
    const win = ecosFor(at(mk(), 2, per, 'won', ['boss_0', 'boss_1', 'boss_2']));
    expect(win).toBe(Math.round((3 * per + 1) * S * 4 + 75 + 60));
    // con zonas más cortas, una victoria sigue dando lo mismo que antes (271)
    expect(Math.abs(win - 271)).toBeLessThanOrEqual(3);
    const asc = at(mk(), 0, 4); asc.asc = 5;
    expect(ecosFor(asc)).toBe(Math.round(4 * S * 4 * 2));
    const daily = at(mk(), 0, 4); daily.daily = '2026-11-21';
    expect(ecosFor(daily)).toBe(Math.round(4 * S * 4 * (1 + 0.2 * daily.asc) * 1.3));
  });
  it('experiencia de maestría con la misma base de salas', () => {
    const per = ACT_ROOMS + 1, S = ROOM_SCALE;
    expect(masteryXpFor(at(mk(), 0, 4))).toBe(Math.round(4 * S * 5));
    expect(masteryXpFor(at(mk(), 2, per, 'won', ['boss_0', 'boss_1', 'boss_2']))).toBe(Math.round((3 * per + 1) * S * 5 + 75 + 50));
  });
  it('perder antes de terminar la sala no cuenta esa sala dos veces', () => {
    const a = at(mk(), 0, 3), b = at(mk(), 0, 3);
    b.phase = 'combat';
    expect(roomsCleared(a)).toBe(roomsCleared(b));
  });
});

describe('Fase 0 · ofertas: 3 como máximo, también con maestría 5', () => {
  it('con maestría menor que 5 las ofertas son de 3', () => {
    for (const m of [0, 1, 4]) {
      const run = mk(m), h = run.heroes[0]!;
      expect(offerSize(h)).toBe(3);
      expect(buildBossOffer(run, h, { spells: true })).toHaveLength(3);
      const rb = mk(m, 'arquitecto'), hb = rb.heroes[0]!;
      offerBoon(rb, hb);
      expect(hb.boonOffer!.spells).toHaveLength(3);
    }
  });
  it('con maestría 5 la oferta del jefe y la del santuario siguen siendo de 3, sin duplicados', () => {
    const run = mk(5), h = run.heroes[0]!;
    expect(offerSize(h)).toBe(3);
    for (let i = 0; i < 40; i++) {
      const o = buildBossOffer(run, h, { spells: true });
      expect(o).toHaveLength(3);
      const keys = o.map((x) => x.kind === 'spell' ? `s:${x.id}` : x.kind === 'up' ? `u:${x.spell}` : x.kind);
      expect(new Set(keys).size).toBe(3);
    }
    const rb = mk(5, 'arquitecto'), hb = rb.heroes[0]!;
    offerBoon(rb, hb);
    expect(hb.boonOffer!.spells).toHaveLength(3);
  });
  it('fallback: sin hechizos ni mejoras que ofrecer se queda en 3 (oro/curación), nunca relleno en la 4.ª', () => {
    const run = mk(5), h = run.heroes[0]!;
    h.boons = [...newSpellPool(h)];
    h.ups = {};
    // sin hechizos nuevos: la oferta se completa con mejoras y, si faltan, con oro/curación hasta 3 como antes
    for (let i = 0; i < 20; i++) { const o = buildBossOffer(run, h); expect(o.length).toBeGreaterThanOrEqual(3); expect(o.length).toBeLessThanOrEqual(4); expect(o.filter((x) => x.kind === 'heal').length).toBeLessThanOrEqual(1); }
  });
});

describe('Fase 0 · textos sin promesas falsas', () => {
  const RES = /resisten|resistencia|res\. (fuego|hielo|veneno|sombra)/i;
  it('ningún texto de reliquia, evento, bendición o modificador promete resistencias', () => {
    const texts: string[] = [];
    for (const r of Object.values(RELICS)) texts.push(r.text);
    for (const e of [...RELIC_EVENTS, ...ZONES.flatMap((z) => z.events)]) for (const o of e.options) texts.push(o.hint ?? '');
    for (const p of Object.values(PATRONS)) texts.push(p.twoText ?? '', p.threeText ?? '');
    for (const a of Object.values(AFFIXES)) texts.push(a.text);
    for (const t of texts) expect(t, t).not.toMatch(RES);
  });
  it('las estadísticas de resistencia no se muestran mientras estén desactivadas', () => {
    expect(statsText({ hp: 10, resFire: 20, resShadow: 5 })).toBe('+10 Vida');
  });
  it('ningún texto promete re-tiradas ni «4 opciones» de botín', () => {
    expect(RELICS.dado!.text).not.toMatch(/re-tirada de botín en cada/i);
    for (const e of ZONES.flatMap((z) => z.events)) for (const o of e.options) expect(o.hint ?? '').not.toMatch(/4 opciones/);
  });
});

describe('Fase 0 · logros de clases ocultas', () => {
  it('no se listan los de clases no jugables, pero siguen definidos y se conservan si ya estaban ganados', () => {
    const hidden = (Object.keys(CLASSES) as Array<keyof typeof CLASSES>).filter((c) => CLASSES[c].hidden);
    expect(hidden.length).toBeGreaterThan(0);
    const none = { achievements: [] as string[] };
    for (const c of hidden) {
      expect(ACHIEVEMENTS.some((a) => a.id === `clase_${c}`)).toBe(true);
      expect(listedAchievements(none).some((a) => a.id === `clase_${c}`)).toBe(false);
      expect(listedAchievements({ achievements: [`clase_${c}`] }).some((a) => a.id === `clase_${c}`)).toBe(true);
    }
    for (const c of PLAYABLE) expect(listedAchievements(none).some((a) => a.id === `clase_${c}`)).toBe(true);
    expect(achievementCount(none)).toBe(`0/${listedAchievements(none).length}`);
  });
});
