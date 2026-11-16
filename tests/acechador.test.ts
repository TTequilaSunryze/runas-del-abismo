// Acechador de Sombras: la Sombra es un marcador fantasma que replica el daño al 50% y permite intercambiarse.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, move, type UnitSpec } from '../src/core/combat/engine';
import { marksOf } from '../src/core/combat/marks';
import { runAiTurn } from '../src/core/combat/ai';
import { unitAt } from '../src/core/combat/grid';

const ace = (pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls: 'acechador', name: 'A', owner: 'p0', routes: [], pos, level: 1 });
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp, armor: 0 });
const board = (units: UnitSpec[]) => createCombat({ seed: 9, w: 14, h: 7, obstacles: [], units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 40 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };
const dmgTo = (r: ReturnType<typeof cast>, id: number, source?: string) => (r.ok ? r.events : []).filter((e) => e.t === 'damage' && e.unit === id && (!source || e.source === source));

describe('Acechador de Sombras', () => {
  it('la Sombra es un marcador: no tiene vida, no bloquea y no es una unidad', () => {
    const s = board([ace(), foe({ x: 9, y: 5 })]);
    const h = s.units[0]!;
    turnOf(s, h.id);
    expect(cast(s, h.id, 's_sombra', { x: 3, y: 3 }).ok).toBe(true);
    expect(marksOf(s, 'shadow', h.id)).toHaveLength(1);
    expect(s.units).toHaveLength(2);
    expect(unitAt(s, { x: 3, y: 3 })).toBeUndefined();
    expect(move(s, h.id, { x: 4, y: 3 }).ok).toBe(true);
  });
  it('el shuriken golpea al primer enemigo de la línea', () => {
    const s = board([ace(), foe({ x: 3, y: 3 }), foe({ x: 5, y: 3 })]);
    const [h, a, b] = s.units;
    const r = cast(s, h!.id, 's_shuriken', { x: 5, y: 3 });
    expect(dmgTo(r, a!.id)).toHaveLength(1);
    expect(dmgTo(r, b!.id)).toHaveLength(0);
  });
  it('con Sombra, el shuriken se replica al mismo enemigo al 50%', () => {
    const s = board([ace(), foe({ x: 5, y: 3 })]);
    const [h, e] = s.units;
    turnOf(s, h!.id);
    h!.ap = 20;
    expect(cast(s, h!.id, 's_sombra', { x: 4, y: 2 }).ok).toBe(true);
    const r = cast(s, h!.id, 's_shuriken', { x: 5, y: 3 });
    const main = dmgTo(r, e!.id).find((x) => x.t === 'damage' && x.source === 's_shuriken');
    const echo = dmgTo(r, e!.id, 'sombra')[0];
    expect(main && echo).toBeTruthy();
    if (main?.t === 'damage' && echo?.t === 'damage' && !main.crit) expect(echo.amount).toBeLessThanOrEqual(Math.ceil(main.amount * 0.5 * 9 / 7) + 1);
    expect(r.ok && r.events.some((x) => x.t === 'echo')).toBe(true);
  });
  it('sin Sombra no hay réplica', () => {
    const s = board([ace(), foe({ x: 5, y: 3 })]);
    const [h, e] = s.units;
    expect(dmgTo(cast(s, h!.id, 's_shuriken', { x: 5, y: 3 }), e!.id, 'sombra')).toHaveLength(0);
  });
  it('el tajo golpea alrededor de ti y de tu Sombra, y quita PM una sola vez', () => {
    const s = board([ace({ x: 3, y: 3 }), foe({ x: 4, y: 3 }), foe({ x: 8, y: 4 })]);
    const [h, a, b] = s.units;
    turnOf(s, h!.id);
    h!.ap = 20;
    cast(s, h!.id, 's_sombra', { x: 5, y: 3 });
    // la Sombra queda en (5,3): `a` está pegado a los dos; muevo `b` junto a la Sombra
    b!.pos = { x: 5, y: 4 };
    const r = cast(s, h!.id, 's_tajo', h!.pos);
    expect(dmgTo(r, a!.id, 's_tajo')).toHaveLength(1);
    expect(dmgTo(r, a!.id, 'sombra')).toHaveLength(1);
    expect(dmgTo(r, b!.id, 'sombra')).toHaveLength(1);
    expect(a!.statuses.slow?.stacks).toBe(1);
    expect(b!.statuses.slow).toBeTruthy();
  });
  it('Intercambiar cambia de sitio con la Sombra ignorando el placaje', () => {
    const s = board([ace({ x: 3, y: 3 }), foe({ x: 4, y: 3 }), foe({ x: 3, y: 4 })]);
    const [h] = s.units;
    turnOf(s, h!.id);
    expect(cast(s, h!.id, 's_sombra', { x: 5, y: 1 }).ok).toBe(true);
    expect(h!.spells.some((sp) => sp.id === 's_cambio')).toBe(true);
    expect(cast(s, h!.id, 's_cambio', h!.pos).ok).toBe(true);
    expect(h!.pos).toEqual({ x: 5, y: 1 });
    expect(marksOf(s, 'shadow', h!.id)[0]!.pos).toEqual({ x: 3, y: 3 });
  });
  it('no se puede intercambiar si alguien pisa la Sombra', () => {
    const s = board([ace(), foe({ x: 9, y: 5 })]);
    const [h, e] = s.units;
    turnOf(s, h!.id);
    cast(s, h!.id, 's_sombra', { x: 3, y: 3 });
    e!.pos = { x: 3, y: 3 };
    expect(castProblem(s, h!, SPELLS.s_cambio!, h!.pos)).toBe('Hay alguien sobre tu Sombra');
  });
  it('la Sombra dura 2 turnos tuyos y luego desaparece con su acción', () => {
    const s = board([ace(), foe({ x: 9, y: 5 })]);
    const [h] = s.units;
    turnOf(s, h!.id);
    cast(s, h!.id, 's_sombra', { x: 3, y: 3 });
    endTurn(s, h!.id); turnOf(s, h!.id);
    expect(marksOf(s, 'shadow', h!.id)).toHaveLength(1);
    endTurn(s, h!.id); turnOf(s, h!.id);
    expect(marksOf(s, 'shadow', h!.id)).toHaveLength(0);
    expect(h!.spells.some((sp) => sp.id === 's_cambio')).toBe(false);
  });
  it('la IA lo juega sin errores ni bucles', () => {
    const s = board([{ ...ace(), ai: 'champ' }, foe({ x: 6, y: 3 }, 60), foe({ x: 8, y: 2 }, 60)]);
    for (let i = 0; i < 300 && !s.over; i++) runAiTurn(s);
    expect(s.over).toBeTruthy();
  });
});
