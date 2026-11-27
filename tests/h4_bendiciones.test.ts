// Fase H4: los jefes dan bendiciones de clase; el Santuario, mejoras de hechizo.
import { describe, expect, it } from 'vitest';
import { SPELL_CATALOG, catalogClassOf } from '../src/content/spellCatalog';
import { BLESSINGS, BOON_MODS } from '../src/core/boonmods';
import { PLAYABLE } from '../src/core/classes/classes';
import { SPELLS } from '../src/core/classes/spells';
import { createCombat } from '../src/core/combat/engine';
import { blessingPool, chooseNode, eventDef, finishFight, heroSpec, metaAction, newRun, offerBossReward, resolveEvent, vote, type HeroSave, type RunState } from '../src/game/run';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } } as Storage;
const mk = (cls: HeroSave['cls'], kit?: string[], seed = 5): RunState => newRun('H4', seed, [{ owner: 'a', name: 'A', cls, routes: ['base'], kit: kit ?? SPELL_CATALOG[cls]!.starters }]);
const winBoss = (run: RunState): void => {
  const h = run.heroes[0]!;
  run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
  run.combat.over = 'win'; run.phase = 'combat'; run.kind = 'boss';
  finishFight(run);
};

describe('H4 · bendiciones de clase como recompensa de jefe', () => {
  it('cada clase, con sus 4 iniciales, tiene al menos 3 bendiciones que ofrecer (el Arquero, sus mejoras de hechizo)', () => {
    for (const c of PLAYABLE) {
      const pool = blessingPool(mk(c).heroes[0]!);
      expect(pool.length, c).toBeGreaterThanOrEqual(3);
      for (const id of pool) expect(!!BLESSINGS[id] || !!BOON_MODS[id], `${c} ${id}`).toBe(true);
      for (const id of pool) expect(SPELLS[id]?.route === 'boon' && !BLESSINGS[id] && !BOON_MODS[id], id).toBe(false);
    }
  });
  it('al vencer al jefe: una oferta de bendiciones, sin hechizos nuevos', () => {
    for (const c of PLAYABLE) {
      const run = mk(c), h = run.heroes[0]!;
      winBoss(run);
      expect(h.bossOffer, c).toBeNull();
      expect(h.boonOffer!.spells, c).toHaveLength(3);
      expect(metaAction(run, 'a', { a: 'boon', idx: 1 })).toBeNull();
      expect(h.boons).toContain(run.heroes[0]!.boons[0]);
    }
  });
  it('solo se ofrecen las que encajan con lo equipado', () => {
    const sin = blessingPool(mk('zorro', ['z_orbe', 'z_encanto', 'z_fuego', 'z_drenaje']).heroes[0]!);
    expect(sin).not.toContain('zb_danza'); // Impulso espiritual
    expect(sin).not.toContain('zb_cola'); // modifica Vínculo etéreo
    const con = blessingPool(mk('zorro', ['z_orbe', 'z_impulso', 'z_vinculo', 'z_fuego']).heroes[0]!);
    expect(con).toContain('zb_danza');
    expect(con).toContain('zb_cola');
    const arq = blessingPool(mk('arquero', ['flecha', 'a_letal', 'a_ignea', 'a_campo']).heroes[0]!);
    expect(arq).toContain('am_ignea');
    expect(arq).not.toContain('am_doble'); // Tiro rasante no equipado
  });
  it('las dependencias apuntan a habilidades reales de la misma clase', () => {
    for (const b of Object.values(BLESSINGS)) for (const n of b.needs ?? []) { expect(SPELLS[n], `${b.id} → ${n}`).toBeTruthy(); expect(catalogClassOf(n), `${b.id} → ${n}`).toBe(b.cls); }
  });
  it('sin bendiciones disponibles: mejora de hechizo (nunca un hechizo nuevo)', () => {
    const run = mk('barbaro'), h = run.heroes[0]!;
    h.boons.push(...blessingPool(h));
    expect(blessingPool(h)).toHaveLength(0);
    offerBossReward(run, h);
    expect(h.boonOffer).toBeNull();
    expect(h.bossOffer!.length).toBeGreaterThan(0);
    expect(h.bossOffer!.some((o) => o.kind === 'spell')).toBe(false);
  });
  it('determinista: misma semilla, misma oferta', () => {
    const a = mk('esferas', undefined, 9), b = mk('esferas', undefined, 9);
    winBoss(a); winBoss(b);
    expect(a.heroes[0]!.boonOffer).toEqual(b.heroes[0]!.boonOffer);
  });
});

describe('H4 · Santuario y eventos', () => {
  it('el Santuario ofrece mejoras de hechizo, no bendiciones ni hechizos', () => {
    let tested = 0;
    for (let seed = 1; seed <= 40 && !tested; seed++) {
      const run = roomStep(mk('pistolero', undefined, seed));
      // el Santuario sale detrás de un Tesoro (la mitad de las veces)
      run.phase = 'map'; run.map[run.step] = ['treasure']; run.at = -1;
      chooseNode(run, 0);
      if (run.room?.kind !== 'shrine') continue;
      const h = run.heroes[0]!;
      expect(h.boonOffer).toBeNull();
      expect(h.bossOffer!.length).toBeGreaterThanOrEqual(2);
      expect(h.bossOffer!.every((o) => o.kind !== 'spell')).toBe(true);
      expect(h.bossOffer!.some((o) => o.kind === 'up')).toBe(true);
      tested++;
    }
    expect(tested).toBe(1);
  });
  it('el Oráculo, el Heraldo y la Cámara dan una bendición de clase', () => {
    for (const [id, opt, zone] of [['g4_heraldo', 0, 1], ['g4_camara', 1, 0]] as const) {
      const run = mk('carcelero'); run.zone = zone;
      run.phase = 'event'; run.event = { id, votes: {} }; vote(run, 'a', opt); resolveEvent(run, 'a');
      expect(eventDef(run)?.id).toBe(id);
      expect(run.heroes[0]!.boonOffer, id).toBeTruthy();
    }
  });
  it('compatibilidad: un héroe de una partida antigua con hechizos aprendidos los conserva', () => {
    const run = mk('zorro'), h = run.heroes[0]!;
    h.boons.push('z_vortice');
    expect(heroSpec(h).spells.some((s) => s.id === 'z_vortice')).toBe(true);
  });
});
