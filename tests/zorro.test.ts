// Hechicera Zorro: orbe que rebota, encanto en línea recta, salto espiritual y robo de esencia.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { cast, castProblem, createCombat, current, endTurn, type UnitSpec } from '../src/core/combat/engine';
import { SPELLS } from '../src/core/classes/spells';
import { dist } from '../src/core/combat/grid';

const zorro = (pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls: 'zorro', name: 'Z', owner: 'p0', routes: [], pos, level: 1 });
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp });
const board = (units: UnitSpec[]) => createCombat({ seed: 4, w: 14, h: 7, obstacles: [], units }).state;
/** Pasa turnos hasta que juega la unidad `id`. */
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 30 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('Hechicera Zorro', () => {
  it('el orbe golpea dos veces a los enemigos de la línea', () => {
    const s = board([zorro(), foe({ x: 3, y: 3 }), foe({ x: 5, y: 3 })]);
    const [h, a, b] = s.units;
    const r = cast(s, h!.id, 'z_orbe', { x: 5, y: 3 });
    expect(r.ok).toBe(true);
    for (const e of [a!, b!]) expect(r.ok && r.events.filter((ev) => ev.t === 'damage' && ev.unit === e.id)).toHaveLength(2);
  });

  it('el orbe y el encanto solo apuntan en línea recta', () => {
    const s = board([zorro(), foe({ x: 3, y: 5 })]);
    expect(castProblem(s, s.units[0]!, SPELLS.z_orbe!, { x: 3, y: 5 })).toBe('Solo en línea recta');
    expect(castProblem(s, s.units[0]!, SPELLS.z_encanto!, { x: 3, y: 5 })).toBe('Solo en línea recta');
  });

  it('el robo de esencia acumula cargas por cada habilidad que golpea', () => {
    const s = board([zorro(), foe({ x: 3, y: 3 })]);
    const h = s.units[0]!;
    expect(h.essence).toBe(0);
    cast(s, h.id, 'z_orbe', { x: 3, y: 3 });
    expect(h.essence).toBe(1);
  });

  it('con 3 cargas, la siguiente habilidad de daño cura el 15% y reinicia el contador', () => {
    const s = board([zorro(), foe({ x: 3, y: 3 })]);
    const h = s.units[0]!;
    h.essence = 3;
    h.hp = h.maxHp - 40;
    const before = h.hp;
    const r = cast(s, h.id, 'z_orbe', { x: 3, y: 3 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.events.some((ev) => ev.t === 'heal' && ev.unit === h.id && ev.amount === Math.round(h.maxHp * 0.15))).toBe(true);
    expect(h.hp).toBeGreaterThan(before - 1);
    expect(h.essence).toBe(0);
  });

  it('el encanto atrae 2 casillas al primer enemigo de la línea (alcance 1-7)', () => {
    const s = board([zorro(), foe({ x: 8, y: 3 }, 60)]);
    const [h, en] = s.units;
    expect(cast(s, h!.id, 'z_encanto', { x: 8, y: 3 }).ok).toBe(true);
    expect(en!.pos).toEqual({ x: 6, y: 3 });
    expect(dist(en!.pos, h!.pos)).toBe(5);
  });

  it('el salto espiritual se desplaza en línea recta y golpea al enemigo más cercano', () => {
    const s = board([zorro({ x: 1, y: 3 }), foe({ x: 6, y: 3 })]);
    const [h, e] = s.units;
    turnOf(s, h!.id);
    const r = cast(s, h!.id, 'z_impulso', { x: 4, y: 3 });
    expect(r.ok).toBe(true);
    expect(h!.pos).toEqual({ x: 4, y: 3 });
    expect(r.ok && r.events.some((ev) => ev.t === 'damage' && ev.unit === e!.id && ev.source === 'z_impulso')).toBe(true);
  });

  it('el salto espiritual no sirve en diagonal', () => {
    const s = board([zorro({ x: 1, y: 3 }), foe({ x: 6, y: 3 })]);
    expect(castProblem(s, s.units[0]!, SPELLS.z_impulso!, { x: 3, y: 4 })).toBe('Solo en línea recta');
  });
});
