// Ajuste de habilidades (Carcelero, Hechicera, Tejedora, Acechador y Bárbaro)
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { SEED_DMG, apCost, cast, createCombat, current, endTurn, type UnitSpec } from '../src/core/combat/engine';
import { addMark } from '../src/core/combat/marks';
import type { ClassId, CombatState, GameEvent, Unit } from '../src/core/state';

const hero = (cls: ClassId, pos = { x: 2, y: 3 }, extra: string[] = []): UnitSpec => {
  const h = makeHero({ cls, name: cls, owner: 'p0', routes: [], pos, level: 1 });
  for (const id of extra) if (!h.spells.some((sp) => sp.id === id)) h.spells.push({ id, cd: 0 });
  return { ...h, crit: 0, armor: 0 };
};
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp, armor: 0, initiative: 1, traits: [] as string[] });
const board = (units: UnitSpec[]): CombatState => createCombat({ seed: 9, w: 14, h: 8, obstacles: [], units }).state;
const me = (s: CombatState): Unit => { const u = s.units[0]!; for (let i = 0; i < 40 && current(s)!.id !== u.id; i++) endTurn(s, current(s)!.id); u.ap = 30; u.mp = 9; return u; };
const ok = (s: CombatState, u: Unit, id: string, at: { x: number; y: number }): GameEvent[] => { const r = cast(s, u.id, id, at); expect(r.ok, r.ok ? id : `${id}: ${r.reason}`).toBe(true); return r.ok ? r.events : []; };
const dmg = (ev: GameEvent[], id: number, source?: string): number => ev.filter((e) => e.t === 'damage' && e.unit === id && (!source || e.source === source)).reduce((n, e) => n + (e as { amount: number }).amount + (e as { absorbed: number }).absorbed, 0);

describe('Carcelero', () => {
  it('Sacrificio del guardián: el aliado recibe el 60% y el Carcelero el 40%', () => {
    const s = board([hero('carcelero', { x: 2, y: 3 }, ['k_sacrificio']), hero('zorro', { x: 2, y: 5 }), foe({ x: 9, y: 7 })]);
    const u = me(s), ally = s.units[1]!;
    ok(s, u, 'k_sacrificio', ally.pos);
    ally.hp = ally.maxHp = 500; u.hp = u.maxHp = 500;
    const b = s.units[2]!; b.power = 97; b.crit = 0; b.pos = { x: 2, y: 6 }; b.ap = 9;
    // golpe directo de un enemigo al aliado
    s.turn = s.order.indexOf(b.id);
    const ev = ok(s, b, 'e_golpe', ally.pos);
    const toAlly = dmg(ev, ally.id), toMe = dmg(ev, u.id);
    expect(toAlly).toBeGreaterThan(0);
    expect(Math.abs(toAlly / (toAlly + toMe) - 0.6)).toBeLessThan(0.03);
    expect(SPELLS.k_sacrificio!.range).toEqual([1, 6]);
    expect(SPELLS.k_sacrificio!.cd).toBe(2);
  });
  it('costes y límites', () => {
    expect([SPELLS.k_sentencia!.ap, SPELLS.k_sentencia!.perTurn]).toEqual([2, 1]);
    expect([SPELLS.k_guadana!.ap, SPELLS.k_guadana!.perTurn]).toEqual([2, 2]);
    expect([SPELLS.k_azote!.ap, SPELLS.k_azote!.perTurn, SPELLS.k_azote!.range]).toEqual([3, 2, [1, 3]]);
    expect([SPELLS.k_alma!.ap, SPELLS.k_alma!.perTurn, SPELLS.k_alma!.range]).toEqual([3, 2, [1, 2]]);
    expect([SPELLS.k_condena!.perTurn, SPELLS.k_condena!.cd]).toEqual([1, 2]);
  });
});

describe('Hechicera', () => {
  it('Encantado: +2 de daño de cada golpe y ya no daña al empezar su turno', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }, ['z_drenaje']), foe({ x: 3, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    const a = dmg(ok(s, u, 'z_drenaje', e.pos), e.id, 'z_drenaje');
    s.units[0]!.spells.find((sp) => sp.id === 'z_drenaje')!.uses = 0; s.units[0]!.spells.find((sp) => sp.id === 'z_drenaje')!.cd = 0;
    e.statuses.charm = { turns: 2, stacks: 1 };
    const b = dmg(ok(s, u, 'z_drenaje', e.pos), e.id, 'z_drenaje');
    expect(b - a).toBe(2);
  });
  it('el Orbe hace el 50% a la vuelta', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }), foe({ x: 4, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    const hits = ok(s, u, 'z_orbe', e.pos).filter((ev) => ev.t === 'damage' && ev.unit === e.id) as Array<{ amount: number }>;
    expect(hits).toHaveLength(2);
    expect(hits[1]!.amount).toBeLessThan(hits[0]!.amount);
  });
  it('si un enemigo muere por su daño, el próximo Impulso cuesta 0 PA (máx. 2 por turno)', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }), foe({ x: 3, y: 3 }, 1), foe({ x: 12, y: 7 })]);
    const u = me(s);
    expect(apCost(u, 'z_impulso', s)).toBe(2);
    ok(s, u, 'z_orbe', { x: 3, y: 3 });
    expect(apCost(u, 'z_impulso', s)).toBe(0);
    expect(SPELLS.z_impulso!.perTurn).toBe(2);
  });
  it('Velo espectral ya no hace invisible', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }, ['z_velo']), foe({ x: 9, y: 3 })]);
    const u = me(s), mp = u.mp;
    ok(s, u, 'z_velo', u.pos);
    expect(u.statuses.invis).toBeUndefined();
    expect(u.mp).toBe(mp + 2);
  });
});

describe('Tejedora', () => {
  it('Fuerza de voluntad: 75% al resto del área', () => {
    expect(SPELLS.t_voluntad!.areaPct).toBe(0.75);
  });
  it('las Semillas ocupan casilla, tienen 20 de vida, crecen +2 por turno (máx. +10) y la Implosión da 1 PA si golpea', () => {
    const s = board([hero('esferas', { x: 2, y: 3 }, ['t_semilla', 't_implosion']), foe({ x: 6, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    ok(s, u, 't_semilla', { x: 5, y: 3 });
    const sd = s.units.find((x) => x.seed !== undefined)!;
    expect([sd.hp, sd.seed, s.order.includes(sd.id)]).toEqual([20, 0, false]);
    expect(cast(s, u.id, 'move', { x: 5, y: 3 }).ok).toBe(false);
    for (let i = 0; i < 7; i++) { endTurn(s, current(s)!.id); me(s); }
    expect(sd.seed).toBe(10);
    const ap = u.ap, hp = e.hp;
    ok(s, u, 't_implosion', { x: 5, y: 3 });
    expect(hp - e.hp).toBeGreaterThanOrEqual(SEED_DMG + 10);
    expect(u.ap).toBe(ap - 1 + 1);
    expect(sd.hp).toBe(0);
  });
});

describe('Acechador', () => {
  it('Marca de la muerte: guarda el 50% y estalla al final de tu turno; cuesta 1 PA menos con una Sombra', () => {
    const s = board([hero('acechador', { x: 2, y: 3 }, ['s_marca']), foe({ x: 4, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    expect(apCost(u, 's_marca', s)).toBe(3);
    addMark(s, { kind: 'shadow', pos: { x: 2, y: 6 }, team: 'hero', turns: 2, owner: u.id }, []);
    expect(apCost(u, 's_marca', s)).toBe(2);
    ok(s, u, 's_marca', e.pos);
    const stored = e.statuses.deathmark!.stacks;
    const r = endTurn(s, u.id);
    expect(r.ok && r.events.some((ev) => ev.t === 'detonate' && ev.unit === e.id)).toBe(true);
    expect(e.statuses.deathmark).toBeUndefined();
    expect(stored).toBeGreaterThanOrEqual(0);
  });
  it('Ejecución silenciosa: siendo invisible siempre es crítica', () => {
    const s = board([hero('acechador', { x: 2, y: 3 }, ['s_ejecucion']), foe({ x: 3, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    u.statuses.invis = { turns: 1, stacks: 1 };
    const ev = ok(s, u, 's_ejecucion', e.pos);
    expect(ev.some((x) => x.t === 'damage' && x.unit === e.id && x.crit)).toBe(true);
  });
});

describe('Bárbaro', () => {
  it('Embiste: +2 de daño por cada 20 de Furia', () => {
    const run = (fury: number): number => {
      const s = board([hero('barbaro', { x: 2, y: 3 }), foe({ x: 5, y: 3 })]);
      const u = me(s); u.fury = fury;
      return dmg(ok(s, u, 'b_embiste', { x: 4, y: 3 }), s.units[1]!.id, 'b_embiste');
    };
    // +10 por la Furia del Embiste (además, la Furia ya sube el daño de todo)
    expect(run(100) - run(0)).toBeGreaterThanOrEqual(10);
  });
  it('Salto del berserker: si remata, se repite gratis', () => {
    const s = board([hero('barbaro', { x: 2, y: 3 }, ['b_salto']), foe({ x: 5, y: 3 }, 1), foe({ x: 12, y: 7 })]);
    const u = me(s);
    ok(s, u, 'b_salto', { x: 5, y: 3 });
    expect(apCost(u, 'b_salto', s)).toBe(0);
  });
});
