// Carcelero de Almas: gancho, linterna, despellejar y cosecha de almas.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, SOUL_ARMOR_CAP, type UnitSpec } from '../src/core/combat/engine';
import { marksOf } from '../src/core/combat/marks';
import { runAiTurn } from '../src/core/combat/ai';
import { finishFight, newRun } from '../src/game/run';

const carc = (pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls: 'carcelero', name: 'K', owner: 'p0', routes: [], pos, level: 1 });
const ally = (pos: { x: number; y: number }): UnitSpec => makeHero({ cls: 'mago', name: 'M', owner: 'p1', routes: [], pos, level: 1 });
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp });
const board = (units: UnitSpec[]) => createCombat({ seed: 3, w: 14, h: 7, obstacles: [], units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 40 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('Carcelero de Almas', () => {
  it('Sentencia engancha al primer enemigo de la línea, quita PA y lo arrastra 2', () => {
    const s = board([carc(), foe({ x: 4, y: 3 }), foe({ x: 6, y: 3 })]);
    const [k, a, b] = s.units;
    turnOf(s, k!.id);
    const r = cast(s, k!.id, 'k_sentencia', { x: 6, y: 3 });
    expect(r.ok).toBe(true);
    expect(a!.pos).toEqual({ x: 2, y: 3 });
    expect(a!.apMod).toBe(-2);
    expect(b!.pos).toEqual({ x: 6, y: 3 });
    expect(k!.hooked).toBe(a!.id);
  });
  it('Recorrer la cadena (1 PA) lleva al Carcelero junto al enganchado y desaparece', () => {
    const s = board([carc(), foe({ x: 6, y: 3 })]);
    const [k, e] = s.units;
    turnOf(s, k!.id);
    cast(s, k!.id, 'k_sentencia', { x: 6, y: 3 });
    expect(e!.pos).toEqual({ x: 4, y: 3 });
    expect(k!.spells.some((sp) => sp.id === 'k_viaje')).toBe(true);
    const ap = k!.ap;
    expect(cast(s, k!.id, 'k_viaje', e!.pos).ok).toBe(true);
    expect(Math.abs(k!.pos.x - e!.pos.x) + Math.abs(k!.pos.y - e!.pos.y)).toBe(1);
    expect(k!.ap).toBe(ap - 1);
    expect(k!.spells.some((sp) => sp.id === 'k_viaje')).toBe(false);
  });
  it('la cadena solo dura ese turno', () => {
    const s = board([carc(), foe({ x: 6, y: 3 })]);
    const [k] = s.units;
    turnOf(s, k!.id);
    cast(s, k!.id, 'k_sentencia', { x: 6, y: 3 });
    endTurn(s, k!.id);
    turnOf(s, k!.id);
    expect(k!.hooked).toBeUndefined();
    expect(k!.spells.some((sp) => sp.id === 'k_viaje')).toBe(false);
  });
  it('Linterna: escudo a los aliados pegados y Tomar la linterna los trae junto al Carcelero, ignorando el placaje', () => {
    const s = board([carc({ x: 1, y: 3 }), ally({ x: 8, y: 3 }), foe({ x: 9, y: 3 }), foe({ x: 8, y: 4 })]);
    const [k, m] = s.units;
    turnOf(s, k!.id);
    k!.pos = { x: 5, y: 3 };
    expect(cast(s, k!.id, 'k_linterna', { x: 8, y: 2 }).ok).toBe(true);
    expect(m!.shield).toBeGreaterThanOrEqual(8);
    expect(marksOf(s, 'lantern')).toHaveLength(1);
    turnOf(s, m!.id);
    expect(m!.spells.some((sp) => sp.id === 'k_farol')).toBe(true);
    expect(castProblem(s, m!, SPELLS.k_farol!, m!.pos)).toBeNull();
    expect(cast(s, m!.id, 'k_farol', m!.pos).ok).toBe(true);
    expect(Math.abs(m!.pos.x - k!.pos.x) + Math.abs(m!.pos.y - k!.pos.y)).toBe(1);
  });
  it('sin linterna al lado no se puede tomar', () => {
    const s = board([carc(), ally({ x: 9, y: 5 })]);
    const [k, m] = s.units;
    turnOf(s, k!.id);
    cast(s, k!.id, 'k_linterna', { x: 3, y: 3 });
    expect(castProblem(s, m!, SPELLS.k_farol!, m!.pos)).toBe('Necesitas una linterna aliada a tu lado');
  });
  it('la linterna caduca al empezar el siguiente turno del Carcelero', () => {
    const s = board([carc(), ally({ x: 9, y: 5 })]);
    const [k] = s.units;
    turnOf(s, k!.id);
    cast(s, k!.id, 'k_linterna', { x: 3, y: 3 });
    endTurn(s, k!.id);
    turnOf(s, k!.id);
    expect(marksOf(s, 'lantern')).toHaveLength(0);
  });
  it('Despellejar alcanza el 3×3, quita PM y empuja 1', () => {
    const s = board([carc({ x: 5, y: 3 }), foe({ x: 6, y: 4 }), foe({ x: 4, y: 3 })]);
    const [k, a, b] = s.units;
    turnOf(s, k!.id);
    const r = cast(s, k!.id, 'k_despellejar', k!.pos);
    expect(r.ok).toBe(true);
    for (const e of [a!, b!]) expect(r.ok && r.events.some((ev) => ev.t === 'damage' && ev.unit === e.id)).toBe(true);
    expect(b!.pos).toEqual({ x: 3, y: 3 });
    expect(a!.statuses.slow?.stacks).toBe(2);
  });
  it('cada enemigo que muere con él vivo le da +1 de armadura fija', () => {
    const s = board([carc({ x: 3, y: 4 }), foe({ x: 2, y: 4 }, 1), foe({ x: 3, y: 3 }, 1)]);
    const k = s.units[0]!;
    turnOf(s, k.id);
    const before = k.armor;
    cast(s, k.id, 'k_despellejar', k.pos);
    expect(k.souls).toBe(2);
    expect(k.armor).toBe(before + 2);
  });
  it(`la armadura de las almas tiene un tope de +${SOUL_ARMOR_CAP} por combate`, () => {
    const s = board([carc({ x: 3, y: 3 }), ...Array.from({ length: 8 }, (_, i) => foe({ x: 2 + (i % 3), y: 2 + Math.floor(i / 3) }, 1)).filter((_, i) => i !== 4)]);
    const k = s.units[0]!;
    const before = k.armor;
    turnOf(s, k.id);
    cast(s, k.id, 'k_despellejar', k.pos);
    expect(k.souls).toBe(7);
    expect(k.armor).toBe(before + SOUL_ARMOR_CAP);
  });
  it('las almas se acumulan entre salas: cada 3, una mejora de hechizo', () => {
    const run = newRun('T', 1, [{ owner: 'p0', name: 'K', cls: 'carcelero', routes: ['base'] }]);
    const h = run.heroes[0]!;
    run.phase = 'combat' as never;
    run.kind = 'combat';
    run.fight = 1;
    const s = board([carc()]);
    s.units[0]!.souls = 4;
    s.over = 'win';
    run.combat = s;
    const pend = h.upPending;
    finishFight(run);
    expect(h.souls).toBe(1);
    // +1 por las almas (la recompensa normal de esta sala también puede sumar)
    expect(h.upPending + (h.upOffer ? 1 : 0)).toBeGreaterThanOrEqual(pend + 1);
  });
  it('la IA lo juega sin errores ni bucles', () => {
    const s = board([{ ...carc(), ai: 'champ' }, { ...ally({ x: 1, y: 5 }), ai: 'champ' }, foe({ x: 6, y: 3 }, 60), foe({ x: 8, y: 2 }, 60)]);
    for (let i = 0; i < 300 && !s.over; i++) runAiTurn(s);
    expect(s.over).toBeTruthy();
  });
});
