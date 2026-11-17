// v8: estadísticas iguales, usos por turno, Impulso que se reinicia al rematar, tope de mejoras y una recompensa por sala.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { PATRONS, patronsOf } from '../src/content/boons';
import { BOON_MODS } from '../src/core/boonmods';
import { CLASSES, PLAYABLE } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, type UnitSpec } from '../src/core/combat/engine';
import { canUpgrade, MAX_SPELL_UPS, tuned } from '../src/core/upgrades';
import { ensureUpOffer, newRun, offerBoon, upCount, type HeroSave } from '../src/game/run';
import type { ClassId } from '../src/core/state';

const hero = (cls: ClassId, pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls, name: 'H', owner: 'p0', routes: [], pos, level: 1 });
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp, armor: 0 });
const board = (units: UnitSpec[]) => createCombat({ seed: 5, w: 14, h: 7, obstacles: [], units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 40 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('v8', () => {
  it('se juega con 5 clases, todas con 60 de vida, 6 PA y 3 PM', () => {
    expect(PLAYABLE).toEqual(['zorro', 'esferas', 'acechador', 'carcelero', 'arquero']);
    for (const c of ['guerrero', 'mago', 'picaro', 'clerigo'] as const) expect(CLASSES[c].hidden).toBe(true);
    for (const c of PLAYABLE) expect([CLASSES[c].hp, CLASSES[c].ap, CLASSES[c].mp], c).toEqual([60, 6, 3]);
    // los hechizos de las clases retiradas siguen existiendo
    expect(SPELLS.tajo && SPELLS.dardo && SPELLS.maza && SPELLS.punalada).toBeTruthy();
  });

  it('cada clase tiene al menos 6 hechizos nuevos en sus bendiciones', () => {
    for (const c of PLAYABLE) {
      const news = new Set(patronsOf(c).flatMap((p) => p.spells).filter((id) => !BOON_MODS[id] && SPELLS[id]));
      expect(news.size, c).toBeGreaterThanOrEqual(6);
    }
  });

  it('los rasgos de 3 piezas no se repiten entre estilos de las clases jugables', () => {
    const traits = PLAYABLE.flatMap((c) => patronsOf(c).map((p) => p.trait).filter(Boolean));
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('Orbe y Shuriken: máximo 2 veces por turno; Sentencia y Descarga: 1', () => {
    for (const [cls, id, n] of [['zorro', 'z_orbe', 2], ['acechador', 's_shuriken', 2], ['carcelero', 'k_sentencia', 1], ['esferas', 't_descarga', 1]] as const) {
      const s = board([hero(cls), foe({ x: 4, y: 3 })]);
      const h = s.units[0]!;
      turnOf(s, h.id);
      for (let i = 0; i < n; i++) { h.ap = 20; expect(cast(s, h.id, id, { x: 4, y: 3 }).ok, `${id} ${i}`).toBe(true); s.units[1]!.pos = { x: 4, y: 3 }; }
      h.ap = 20;
      expect(castProblem(s, h, SPELLS[id]!, { x: 4, y: 3 }), id).toMatch(/turno/);
      // al turno siguiente vuelve a estar disponible
      endTurn(s, h.id);
      turnOf(s, h.id);
      h.ap = 20;
      expect(castProblem(s, h, SPELLS[id]!, s.units[1]!.pos), id).toBeNull();
    }
  });

  it('el orbe hace daño a la ida y a la vuelta, pero sus efectos se aplican una sola vez', () => {
    const s = board([hero('zorro'), foe({ x: 4, y: 3 })]);
    const h = s.units[0]!;
    h.spells.find((sp) => sp.id === 'z_orbe')!.ups = ['el_veneno'];
    const r = cast(s, h.id, 'z_orbe', { x: 4, y: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.filter((e) => e.t === 'damage' && e.unit === s.units[1]!.id)).toHaveLength(2);
    expect(r.events.filter((e) => e.t === 'status' && e.unit === s.units[1]!.id)).toHaveLength(1);
  });

  it('Impulso espiritual: una vez por turno, y gratis otra vez si remata', () => {
    const s = board([hero('zorro', { x: 1, y: 3 }), foe({ x: 6, y: 3 }, 1), foe({ x: 9, y: 3 })]);
    const h = s.units[0]!;
    turnOf(s, h.id);
    expect(cast(s, h.id, 'z_impulso', { x: 4, y: 3 }).ok).toBe(true);
    expect(s.units[1]!.hp).toBe(0);
    const ap = h.ap;
    expect(castProblem(s, h, SPELLS.z_impulso!, { x: 7, y: 3 })).toBeNull();
    expect(cast(s, h.id, 'z_impulso', { x: 7, y: 3 }).ok).toBe(true);
    expect(h.ap).toBe(ap);
    // sin remate, ya no
    expect(castProblem(s, h, SPELLS.z_impulso!, { x: 7, y: 4 })).toMatch(/turno/);
  });

  it('un hechizo se mejora como mucho 2 veces y solo con una mejora elemental', () => {
    const d = SPELLS.z_orbe!;
    expect(canUpgrade(d, ['pot', 'cri'], 'efi')).toBe(false);
    expect(canUpgrade(d, ['el_fuego'], 'el_hielo')).toBe(false);
    expect(canUpgrade(d, ['el_fuego'], 'pot')).toBe(true);
    const t = tuned(d, { ups: ['el_fuego'] });
    expect(t.element).toBe('fire');
    expect(t.status?.kind).toBe('burn');
    // las bendiciones cuentan para el tope
    const run = newRun('T', 2, [{ owner: 'a', name: 'A', cls: 'zorro', routes: [] }]);
    const h = run.heroes[0]!;
    h.boons = ['zm_orbe_intenso'];
    h.ups = { z_orbe: ['pot'] };
    expect(upCount(h, 'z_orbe')).toBe(MAX_SPELL_UPS);
    for (let i = 0; i < 20; i++) { h.upOffer = null; h.upPending = 1; ensureUpOffer(run, h); expect((h.upOffer as HeroSave['upOffer'])?.some((o) => o.spell === 'z_orbe') ?? false).toBe(false); }
    for (let i = 0; i < 20; i++) { h.boonOffer = null; offerBoon(run, h); expect((h.boonOffer as HeroSave['boonOffer'])?.spells.some((x) => BOON_MODS[x]?.target === 'z_orbe') ?? false).toBe(false); }
  });

  it('nunca ofrece mejorar un hechizo que no tienes: ofrece primero el hechizo', () => {
    const run = newRun('T', 7, [{ owner: 'a', name: 'A', cls: 'zorro', routes: [] }]);
    const h = run.heroes[0]!;
    for (let i = 0; i < 40; i++) {
      h.boonOffer = null;
      offerBoon(run, h);
      for (const o of (h.boonOffer as HeroSave['boonOffer'])?.spells ?? []) if (BOON_MODS[o]) expect([...CLASSES.zorro.base, ...h.boons]).toContain(BOON_MODS[o]!.target);
    }
    // con Fuego zorruno ya aprendido, su mejora sí puede salir
    h.boons = ['z_fuego'];
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) { h.boonOffer = null; offerBoon(run, h); seen = !!(h.boonOffer as HeroSave['boonOffer'])?.spells.includes('zm_fuego_vivo'); }
    expect(seen).toBe(true);
    expect(PATRONS.z_llama!.spells).toContain('zm_fuego_vivo');
  });
});
