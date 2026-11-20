// Carcelero de Almas: gancho, linterna, despellejar y cosecha de almas.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, SOULS_PER_ARMOR, scytheBonus, type UnitSpec } from '../src/core/combat/engine';
import { marksOf } from '../src/core/combat/marks';
import { runAiTurn } from '../src/core/combat/ai';
import { finishFight, heroSpec, newRun } from '../src/game/run';

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
  it('Corte de Guadaña: arco frontal, empuja 1 y se carga +3 por turno sin usarlo (máx. 3)', () => {
    const s = board([carc({ x: 3, y: 3 }), foe({ x: 4, y: 3 }), foe({ x: 5, y: 4 })]);
    const [k, a, b] = s.units;
    turnOf(s, k!.id);
    a!.armor = 0; b!.armor = 0;
    const hp = a!.hp;
    const r = cast(s, k!.id, 'k_guadana', { x: 4, y: 3 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.events.some((ev) => ev.t === 'damage' && ev.unit === b!.id)).toBe(true);
    expect(a!.pos).toEqual({ x: 5, y: 3 });
    const base = hp - a!.hp;
    // tres turnos sin usarla: +9
    for (let i = 0; i < 4; i++) { endTurn(s, current(s)!.id); turnOf(s, k!.id); }
    expect(k!.scytheCharge).toBe(3);
    expect(scytheBonus(k!)).toBe(9);
    k!.pos = { x: 4, y: 3 }; a!.hp = a!.maxHp = 500;
    const h2 = a!.hp;
    k!.ap = 6;
    a!.shield = 0;
    const r2 = cast(s, k!.id, 'k_guadana', { x: 5, y: 3 });
    expect(r2.ok).toBe(true);
    expect(h2 - a!.hp).toBe(base + 9);
    expect(k!.scytheCharge).toBe(0);
  });
  it(`cada ${SOULS_PER_ARMOR} almas, +1 de armadura en el acto`, () => {
    const s = board([carc({ x: 3, y: 3 }), ...Array.from({ length: 8 }, (_, i) => foe({ x: 2 + (i % 3), y: 2 + Math.floor(i / 3) }, 1)).filter((_, i) => i !== 4)]);
    const k = s.units[0]!;
    const before = k.armor;
    turnOf(s, k.id);
    k.spells.push({ id: 'k_despellejar', cd: 0 });
    cast(s, k.id, 'k_despellejar', k.pos);
    expect(k.souls).toBe(7);
    expect(k.armor).toBe(before + 0.5);
  });
  it('las almas cuentan en toda la partida y dan armadura permanente', () => {
    const run = newRun('T', 1, [{ owner: 'p0', name: 'K', cls: 'carcelero', routes: ['base'] }]);
    const h = run.heroes[0]!;
    const base = heroSpec(h).armor;
    h.souls = 11;
    expect(heroSpec(h).armor).toBe(base + 1);
    expect(heroSpec(h).souls).toBe(11);
  });
  it('las almas del combate se guardan en la partida', () => {
    const run = newRun('T', 1, [{ owner: 'p0', name: 'K', cls: 'carcelero', routes: ['base'] }]);
    const h = run.heroes[0]!;
    run.phase = 'combat' as never;
    run.kind = 'combat';
    run.fight = 1;
    const s = board([carc()]);
    s.units[0]!.souls = 4;
    s.over = 'win';
    run.combat = s;
    finishFight(run);
    expect(h.souls).toBe(4);
  });
  it('la IA lo juega sin errores ni bucles', () => {
    const s = board([{ ...carc(), ai: 'champ' }, { ...ally({ x: 1, y: 5 }), ai: 'champ' }, foe({ x: 6, y: 3 }, 60), foe({ x: 8, y: 2 }, 60)]);
    for (let i = 0; i < 300 && !s.over; i++) runAiTurn(s);
    expect(s.over).toBeTruthy();
  });
});

describe('v14', () => {
  it('las invocaciones mueren con su creador', () => {
    const k = carc({ x: 2, y: 3 });
    const boss = { ...foe({ x: 4, y: 3 }, 1), shield: 0, armor: 0 };
    const pet = { ...foe({ x: 6, y: 5 }), summoner: 2 };
    const s = createCombat({ seed: 3, w: 10, h: 7, obstacles: [], units: [k, boss, pet] }).state;
    s.turn = s.order.indexOf(1); s.units[0]!.ap = 9;
    const r = cast(s, 1, 'k_sentencia', { x: 4, y: 3 });
    expect(r.ok).toBe(true);
    expect(s.units[1]!.hp).toBe(0);
    expect(s.units[2]!.hp).toBe(0);
  });
  it('La caja: 3 PA y 2 de espera; Siega del condenado existe', () => {
    expect(SPELLS.k_caja!.ap).toBe(3); expect(SPELLS.k_caja!.cd).toBe(2);
    expect(SPELLS.k_siega).toBeTruthy(); expect(SPELLS.k_tormento).toBeTruthy();
  });
});
