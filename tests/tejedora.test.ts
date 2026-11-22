// Tejedora de Esferas y el sistema genérico de marcadores en el suelo.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, move, type UnitSpec } from '../src/core/combat/engine';
import { addMark, coneCells, marksOf, tickMarks } from '../src/core/combat/marks';
import { runAiTurn } from '../src/core/combat/ai';

const tej = (pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls: 'esferas', name: 'T', owner: 'p0', routes: [], pos, level: 1 });
const foe = (pos: { x: number; y: number }, hp = 999, kind = 'esqueleto') => ({ ...makeEnemy(kind, pos), hp, maxHp: hp });
const board = (units: UnitSpec[], obstacles: { x: number; y: number }[] = []) => createCombat({ seed: 5, w: 14, h: 7, obstacles, units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 40 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('marcadores en el suelo', () => {
  it('no bloquean el paso', () => {
    const s = board([tej()]);
    const h = s.units[0]!;
    addMark(s, { kind: 'sphere', pos: { x: 2, y: 3 }, team: 'hero', turns: 3, owner: h.id }, []);
    turnOf(s, h.id);
    expect(move(s, h.id, { x: 3, y: 3 }).ok).toBe(true);
    expect(h.pos).toEqual({ x: 3, y: 3 });
  });
  it('caducan en los turnos de su dueño y los sin dueño por rondas', () => {
    const s = board([tej()]);
    addMark(s, { kind: 'sphere', pos: { x: 2, y: 3 }, team: 'hero', turns: 2, owner: 1 }, []);
    addMark(s, { kind: 'soul', pos: { x: 4, y: 3 }, team: 'enemy', turns: 1 }, []);
    tickMarks(s, 1, []);
    expect(marksOf(s, 'sphere')).toHaveLength(1);
    tickMarks(s, undefined, []);
    expect(marksOf(s, 'soul')).toHaveLength(0);
    tickMarks(s, 1, []);
    expect(marksOf(s, 'sphere')).toHaveLength(0);
  });
  it('desaparecen al morir su dueño', () => {
    const s = board([tej(), foe({ x: 6, y: 3 }, 999)]);
    const [h] = s.units;
    addMark(s, { kind: 'sphere', pos: { x: 2, y: 3 }, team: 'hero', turns: 3, owner: h!.id }, []);
    // muere la Tejedora: se va su esfera
    const t = s.units.find((u) => u.id === h!.id)!;
    t.hp = 1;
    s.units[1]!.statuses = {};
    turnOf(s, s.units[1]!.id);
    for (let i = 0; i < 20 && t.hp > 0; i++) { runAiTurn(s); if (t.hp > 0) t.hp = Math.min(t.hp, 1); }
    if (t.hp <= 0) expect(marksOf(s, 'sphere', h!.id)).toHaveLength(0);
  });
  it('el cono mide 3 de largo y 1-3-3 de ancho', () => {
    const c = coneCells({ x: 1, y: 3 }, { x: 2, y: 3 }, 3);
    expect(c).toHaveLength(7);
    expect(c).toContainEqual({ x: 4, y: 2 });
    expect(c).not.toContainEqual({ x: 2, y: 2 });
  });
});

describe('Tejedora de Esferas', () => {
  it('Pulso oscuro daña y deja una esfera, también en casilla vacía', () => {
    const s = board([tej(), foe({ x: 4, y: 3 })]);
    const [h, e] = s.units;
    const r = cast(s, h!.id, 't_pulso', { x: 4, y: 3 });
    expect(r.ok && r.events.some((ev) => ev.t === 'damage' && ev.unit === e!.id)).toBe(true);
    expect(cast(s, h!.id, 't_pulso', { x: 3, y: 5 }).ok).toBe(true);
    expect(marksOf(s, 'sphere', h!.id)).toHaveLength(2);
  });
  it('no se puede apuntar a un obstáculo', () => {
    const s = board([tej()], [{ x: 4, y: 3 }]);
    expect(castProblem(s, s.units[0]!, SPELLS.t_pulso!, { x: 4, y: 3 })).toBe('Hay un obstáculo');
  });
  it('máximo 4 esferas: la quinta borra la más antigua', () => {
    const s = board([tej()]);
    const h = s.units[0]!;
    for (const x of [2, 3, 4, 5, 6]) { h.ap = 9; h.spells.forEach((sp) => delete sp.uses); cast(s, h.id, 't_pulso', { x, y: 3 }); }
    const m = marksOf(s, 'sphere', h.id);
    expect(m).toHaveLength(4);
    expect(m.map((x) => x.pos.x)).toEqual([3, 4, 5, 6]);
  });
  it('con Constelación caben 5', () => {
    const s = board([tej()]);
    const h = s.units[0]!;
    h.spells.find((sp) => sp.id === 't_pulso')!.ups = ['tm_cinco'];
    for (const at of [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 3, y: 5 }, { x: 4, y: 5 }]) { h.ap = 9; h.spells.forEach((sp) => delete sp.uses); expect(cast(s, h.id, 't_pulso', at).ok).toBe(true); }
    expect(marksOf(s, 'sphere', h.id)).toHaveLength(5);
  });
  it('Descarga consume las esferas y suma daño por cada una', () => {
    const dmgWith = (n: number): number => {
      const s = board([tej(), foe({ x: 5, y: 3 })]);
      const [h, e] = s.units;
      for (let i = 0; i < n; i++) addMark(s, { kind: 'sphere', pos: { x: 8, y: i }, team: 'hero', turns: 3, owner: h!.id }, []);
      const r = cast(s, h!.id, 't_descarga', { x: 5, y: 3 });
      expect(marksOf(s, 'sphere', h!.id)).toHaveLength(0);
      return r.ok ? r.events.filter((ev) => ev.t === 'damage' && ev.unit === e!.id).reduce((a, ev) => a + (ev.t === 'damage' ? ev.amount : 0), 0) : -1;
    };
    expect(dmgWith(3) - dmgWith(0)).toBeGreaterThanOrEqual(13);
  });
  it('Dispersión empuja enemigos y esferas; la esfera que choca aturde', () => {
    const s = board([tej(), foe({ x: 3, y: 3 })]);
    const [h, e] = s.units;
    addMark(s, { kind: 'sphere', pos: { x: 2, y: 3 }, team: 'hero', turns: 3, owner: h!.id }, []);
    const r = cast(s, h!.id, 't_dispersion', { x: 2, y: 3 });
    expect(r.ok).toBe(true);
    expect(e!.pos).toEqual({ x: 6, y: 3 });
    expect(e!.statuses.stun).toBeTruthy();
    expect(r.ok && r.events.some((ev) => ev.t === 'damage' && ev.source === 'esfera')).toBe(true);
    expect(marksOf(s, 'sphere', h!.id)[0]!.pos).toEqual({ x: 5, y: 3 });
  });
  it('combo: Pulso sobre un enemigo y Dispersión lo aturde', () => {
    const s = board([tej(), foe({ x: 3, y: 3 })]);
    const [h, e] = s.units;
    h!.ap = 9;
    cast(s, h!.id, 't_pulso', { x: 3, y: 3 });
    cast(s, h!.id, 't_dispersion', { x: 2, y: 3 });
    expect(e!.statuses.stun).toBeTruthy();
  });
  it('élites y jefes no se aturden con las esferas', () => {
    const s = board([tej(), { ...foe({ x: 3, y: 3 }), rank: 'elite' as const }]);
    const [h, e] = s.units;
    addMark(s, { kind: 'sphere', pos: { x: 2, y: 3 }, team: 'hero', turns: 3, owner: h!.id }, []);
    cast(s, h!.id, 't_dispersion', { x: 2, y: 3 });
    expect(e!.statuses.stun).toBeUndefined();
  });
  it('Implosión detona las semillas (no las esferas) junto a enemigos', () => {
    const s = board([tej(), foe({ x: 5, y: 3 })]);
    const [h, e] = s.units;
    h!.spells.push({ id: 't_implosion', cd: 0 }, { id: 't_semilla', cd: 0 });
    addMark(s, { kind: 'sphere', pos: { x: 5, y: 2 }, team: 'hero', turns: 3, owner: h!.id }, []);
    expect(cast(s, h!.id, 't_implosion', h!.pos).ok).toBe(false);
    expect(cast(s, h!.id, 't_semilla', { x: 4, y: 4 }).ok).toBe(true);
    const r = cast(s, h!.id, 't_implosion', h!.pos);
    expect(r.ok && r.events.some((ev) => ev.t === 'damage' && ev.unit === e!.id)).toBe(true);
    expect(marksOf(s, 'sphere')).toHaveLength(1);
    expect(s.units.filter((x) => x.seed !== undefined && x.hp > 0)).toHaveLength(0);
  });
  it('la IA sabe jugarla (sin errores ni bucles)', () => {
    const s = board([{ ...tej(), ai: 'champ' }, foe({ x: 6, y: 3 }, 80), foe({ x: 8, y: 2 }, 80)]);
    for (let i = 0; i < 200 && !s.over; i++) runAiTurn(s);
    expect(s.over).toBeTruthy();
  });
});
