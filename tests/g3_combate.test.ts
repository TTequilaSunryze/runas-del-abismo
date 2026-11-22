// G3.1–G3.4: jefes con identidad propia, invocaciones por categorías, ajustes de clases y habilidades de jefe.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { PATRONS } from '../src/content/boons';
import { PLAYABLE } from '../src/core/classes/classes';
import { ZONES } from '../src/content/zones';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { BOSS_KITS } from '../src/core/combat/bosskits';
import { omenCells, runAiTurn } from '../src/core/combat/ai';
import { archerBonus, cast, castProblem, createCombat, current, endTurn, type UnitSpec } from '../src/core/combat/engine';
import { marksOf } from '../src/core/combat/marks';
import type { ClassId, CombatState, Unit } from '../src/core/state';
import { bossInfo, buildFight, newRun, type RunState } from '../src/game/run';
import { autoplay } from './helpers';

const P = (n: number) => Array.from({ length: n }, (_, i) => ({ owner: `p${i}`, name: `H${i}`, cls: (['arquero', 'barbaro', 'carcelero', 'esferas'] as ClassId[])[i]!, routes: ['base'] }));
const BOSSES = ZONES.flatMap((z, zi) => z.bosses.map((b, bi) => ({ id: b.id, zone: zi, idx: bi })));
const bossRun = (id: string, n: number, asc = 0): RunState => {
  const b = BOSSES.find((x) => x.id === id)!;
  const r = newRun('G3X', 11, P(n), { asc });
  r.zone = b.zone; r.zoneFight = 5; r.kind = 'boss'; r.bossPick = ZONES.map(() => b.idx);
  return r;
};
const hero = (cls: ClassId, pos: { x: number; y: number }, extra: string[] = []): UnitSpec => {
  const u = makeHero({ cls, name: cls, owner: 'p0', routes: [], pos });
  for (const id of extra) u.spells.push({ id, cd: 0 });
  return u;
};
const board = (units: UnitSpec[], w = 14, h = 8): CombatState => createCombat({ seed: 5, w, h, obstacles: [], units }).state;
/** Deja que le toque a `u` y le da 30 PA. */
const me = (s: CombatState, u: Unit): Unit => { for (let i = 0; i < 40 && current(s)!.id !== u.id; i++) endTurn(s, current(s)!.id); u.ap = 30; return u; };
/** Turno del jefe en una ronda concreta (sin pasar por los demás). */
const bossAt = (s: CombatState, boss: Unit, round: number) => { s.round = round; boss.ap = boss.maxAp; s.over = null; s.turn = s.order.indexOf(boss.id); return runAiTurn(s, info0); };
let info0: ReturnType<typeof bossInfo> | undefined;

describe('G3.1 · ocho jefes con identidad táctica', () => {
  it('cada jefe tiene su kit y no comparten el mismo patrón', () => {
    expect(BOSSES).toHaveLength(8);
    for (const b of BOSSES) expect(BOSS_KITS[b.id], b.id).toBeTruthy();
    const sig = new Set(BOSSES.map((b) => { const k = BOSS_KITS[b.id]!; return `${k.omen.shape}/${k.omen.target}/${k.omen.effect ?? '-'}/${k.minion.role}`; }));
    expect(sig.size).toBe(8);
    // no todos levantan pilares
    expect(BOSSES.filter((b) => BOSS_KITS[b.id]!.pillars === 0).length).toBeGreaterThanOrEqual(3);
    expect(BOSSES.filter((b) => BOSS_KITS[b.id]!.pillars === undefined).length).toBeGreaterThanOrEqual(3);
  });
  it('el ataque anunciado se marca un turno antes, cuesta 3 PA y solo daña a quien no se aparta', () => {
    const r = bossRun('prior', 2); info0 = bossInfo(r);
    const s = board([hero('arquero', { x: 3, y: 3 }), hero('barbaro', { x: 3, y: 4 }), makeEnemy('prior', { x: 10, y: 3 })]);
    const boss = s.units[2]!, a = s.units[0]!, b = s.units[1]!;
    a.hp = a.maxHp = b.hp = b.maxHp = 500;
    const omen = BOSS_KITS.prior!.omen;
    bossAt(s, boss, omen.at + omen.every);
    const marks = marksOf(s, 'omen', boss.id);
    expect(marks.length).toBeGreaterThan(0);
    // la cruz cae sobre el grupo apiñado
    expect(marks.some((m) => m.pos.x === a.pos.x && m.pos.y === a.pos.y) || marks.some((m) => m.pos.x === b.pos.x && m.pos.y === b.pos.y)).toBe(true);
    // uno se aparta lejos, el otro se queda
    const stay = marks.some((m) => m.pos.x === a.pos.x && m.pos.y === a.pos.y) ? a : b, flee = stay === a ? b : a;
    flee.pos = { x: 0, y: 7 };
    const hpStay = stay.hp, hpFlee = flee.hp;
    // siguiente turno del jefe: estalla (no toca otro anuncio en la ronda siguiente)
    bossAt(s, boss, omen.at + omen.every + 1);
    expect(stay.hp).toBeLessThan(hpStay);
    expect(flee.hp).toBe(hpFlee);
    expect(marksOf(s, 'omen', boss.id)).toHaveLength(0);
  });
  it('nunca anuncia dos ataques seguidos ni invoca en la misma ronda en que anuncia', () => {
    for (const b of BOSSES) {
      const k = BOSS_KITS[b.id]!;
      for (const o of [k.omen, k.omen2].filter((x) => !!x)) {
        expect(o!.every, b.id).toBeGreaterThanOrEqual(2);
        if (o === k.omen && k.minion.phases.includes(1)) expect(k.minion.at % k.minion.every, b.id).not.toBe(o!.at % o!.every);
      }
    }
  });
  it('ventanas de vulnerabilidad: la Fundidora queda Expuesta tras su vertido', () => {
    info0 = bossInfo(bossRun('fundidora', 1));
    const s = board([hero('barbaro', { x: 6, y: 3 }), makeEnemy('fundidora', { x: 7, y: 3 })]);
    const boss = s.units[1]!, h = s.units[0]!;
    h.hp = h.maxHp = 900;
    const o = BOSS_KITS.fundidora!.omen;
    bossAt(s, boss, o.every + o.at);
    expect(marksOf(s, 'omen', boss.id).length).toBeGreaterThan(0);
    bossAt(s, boss, o.every + o.at + 1);
    expect(boss.statuses.exposed?.stacks).toBe(4);
    // el vertido deja el suelo ardiendo
    expect(Object.keys(s.fire ?? {}).length).toBeGreaterThan(0);
  });
  it('efectos: raíces inmovilizan, las fauces devoran el escudo y el gemido quita PA', () => {
    const cases: Array<[string, (h: Unit, ev: ReturnType<typeof bossAt>) => boolean]> = [
      ['madre', (h) => !!h.statuses.rooted],
      ['devorarunas', (_h, ev) => ev.some((e) => e.t === 'resist' && /Escudo devorado/.test(e.what))],
      ['planidera', (h, ev) => ev.some((e, i) => e.t === 'damage' && e.source === 'omen' && e.unit === h.id && ev[i + 1]?.t === 'drain')],
    ];
    for (const [id, check] of cases) {
      info0 = bossInfo(bossRun(id, 1));
      const s = board([hero('arquero', { x: 4, y: 3 }), makeEnemy(id, { x: 9, y: 3 })]);
      const boss = s.units[1]!, h = s.units[0]!;
      h.hp = h.maxHp = 900;
      // la Plañidera solo gime en la segunda fase
      if (id === 'planidera') { boss.phase = 2; }
      const o = id === 'planidera' ? BOSS_KITS[id]!.omen2! : BOSS_KITS[id]!.omen;
      bossAt(s, boss, o.every * 2 + o.at);
      h.pos = { x: 4, y: 3 };
      const m = marksOf(s, 'omen', boss.id);
      expect(m.length, id).toBeGreaterThan(0);
      // vuelve a ponerse dentro, con escudo
      h.pos = { ...m[0]!.pos }; h.shield = 20;
      const ev = bossAt(s, boss, o.every * 2 + o.at + 1);
      expect(check(h, ev), id).toBe(true);
    }
  });
  it('derribar un pilar deja al jefe Expuesto', () => {
    const s = board([hero('arquero', { x: 2, y: 3 }, []), makeEnemy('prior', { x: 10, y: 3 }), makeEnemy('pilar', { x: 5, y: 3 })]);
    const u = me(s, s.units[0]!), boss = s.units[1]!, p = s.units[2]!;
    p.hp = 1; p.armor = 0;
    expect(cast(s, u.id, 'flecha', p.pos).ok).toBe(true);
    expect(boss.statuses.exposed?.stacks).toBe(2);
  });
  it('las líneas se cortan con obstáculos (se puede uno cubrir)', () => {
    const s = createCombat({ seed: 1, w: 14, h: 8, obstacles: [{ x: 6, y: 3 }], units: [hero('arquero', { x: 3, y: 3 }), makeEnemy('cazador', { x: 9, y: 3 })] }).state;
    const cells = omenCells(s, s.units[1]!, BOSS_KITS.cazador!.omen);
    expect(cells.some((c) => c.x === 7)).toBe(true);
    expect(cells.some((c) => c.x <= 6)).toBe(false);
  });
});

describe('G3.2 · invocaciones, fantasmas y esbirros', () => {
  it('con 1-4 jugadores y 30 rondas, ningún jefe pasa de su tope a la vez ni del total por combate', () => {
    for (const b of BOSSES) for (const n of [1, 2, 3, 4]) {
      const r = bossRun(b.id, n); const info = bossInfo(r); info0 = info;
      const s = createCombat({ ...buildFight(r as never) }).state;
      const boss = s.units.find((u) => u.rank === 'boss')!;
      for (const h of s.units.filter((u) => u.team === 'hero')) { h.hp = h.maxHp = 5000; }
      const cap = BOSS_KITS[b.id]!.minion.cap ?? info.minionCap!;
      let maxAlive = 0;
      for (let round = 1; round <= 30; round++) {
        bossAt(s, boss, round);
        maxAlive = Math.max(maxAlive, s.units.filter((u) => u.summoner === boss.id && u.ai !== 'pillar' && u.hp > 0).length);
      }
      const mine = s.units.filter((u) => u.summoner === boss.id && u.ai !== 'pillar');
      expect(mine.length, `${b.id} n=${n}`).toBeLessThanOrEqual(info.minionTotal!);
      // el cambio de fase puede sumar de golpe; fuera de eso, el tope a la vez
      expect(maxAlive, `${b.id} n=${n}`).toBeLessThanOrEqual(cap + Math.max(1, Math.ceil(n / 2)));
    }
  });
  it('vida por papel: esbirros, guardianes y manifestaciones por debajo de un enemigo normal', () => {
    for (const b of BOSSES) {
      const r = bossRun(b.id, 2); const info = bossInfo(r); info0 = info;
      const s = board([hero('arquero', { x: 1, y: 1 }), makeEnemy(b.id, { x: 8, y: 4 })]);
      const boss = s.units[1]!;
      const k = BOSS_KITS[b.id]!;
      bossAt(s, boss, k.minion.every + k.minion.at);
      const m = s.units.find((u) => u.summoner === boss.id && u.ai !== 'pillar');
      expect(m, b.id).toBeTruthy();
      expect(m!.maxHp, b.id).toBeLessThanOrEqual(Math.round(info.minion({ x: 0, y: 0 }).maxHp * k.minion.hp) + 1);
      if (k.minion.fade) expect(m!.statuses.fading?.turns, b.id).toBeGreaterThanOrEqual(k.minion.fade);
      for (const t of k.minion.drop ?? []) expect(m!.traits ?? [], b.id).not.toContain(t);
    }
  });
  it('las manifestaciones se desvanecen solas al cabo de sus turnos', () => {
    info0 = bossInfo(bossRun('planidera', 1));
    const s = board([hero('arquero', { x: 1, y: 1 }), makeEnemy('planidera', { x: 9, y: 4 })]);
    const boss = s.units[1]!;
    boss.initiative = 99;
    bossAt(s, boss, 3);
    const m = s.units.find((u) => u.summoner === boss.id)!;
    expect(m).toBeTruthy();
    s.units[0]!.hp = s.units[0]!.maxHp = 5000;
    // pasan turnos normales: el espectro actúa 2 turnos suyos y se desvanece al empezar el 3.º
    let turns = 0;
    for (let i = 0; i < 40 && m.hp > 0; i++) { const c = current(s)!; if (c.id === m.id) turns++; if (c.ai) runAiTurn(s, info0); else endTurn(s, c.id); }
    expect(m.hp).toBe(0);
    expect(m.used).toBe(true);
    expect(turns).toBeLessThanOrEqual(3);
  });
  it('matar una invocación da ventaja: el espectro le quita PA a la Plañidera; el eco hiere al Eco', () => {
    for (const [id, check] of [['planidera', (b: Unit) => b.apMod === -1], ['eco', (b: Unit) => b.hp < b.maxHp]] as const) {
      info0 = bossInfo(bossRun(id, 1));
      const s = board([hero('arquero', { x: 2, y: 2 }), makeEnemy(id, { x: 11, y: 5 })]);
      const boss = s.units[1]!;
      bossAt(s, boss, 3);
      const m = s.units.find((u) => u.summoner === boss.id)!;
      boss.hp = boss.maxHp; boss.apMod = 0;
      const u = me(s, s.units[0]!);
      m.hp = 1; m.armor = 0; m.shield = 0; m.pos = { x: 6, y: 2 }; m.statuses = {};
      expect(cast(s, u.id, 'flecha', m.pos).ok, id).toBe(true);
      expect(check(boss), id).toBe(true);
    }
  });
  it('el Eco ya no se regenera siempre: se cura por cada eco vivo', () => {
    info0 = bossInfo(bossRun('eco', 1));
    const s = board([hero('arquero', { x: 1, y: 1 }), makeEnemy('eco', { x: 9, y: 4 })]);
    const boss = s.units[1]!;
    bossAt(s, boss, 1);
    expect(boss.traits ?? []).not.toContain('regen');
    boss.hp = Math.round(boss.maxHp * 0.8);
    bossAt(s, boss, 3); // invoca un eco
    const hp = boss.hp;
    bossAt(s, boss, 4);
    expect(boss.hp).toBeGreaterThan(hp);
  });
  it('el Prior alza a sus guardianes sobre los cadáveres', () => {
    info0 = bossInfo(bossRun('prior', 1));
    const s = board([hero('arquero', { x: 1, y: 1 }), makeEnemy('prior', { x: 9, y: 4 }), makeEnemy('esqueleto', { x: 7, y: 4 })]);
    const boss = s.units[1]!, corpse = s.units[2]!;
    corpse.hp = 0;
    bossAt(s, boss, 3);
    const m = s.units.find((u) => u.summoner === boss.id)!;
    expect(corpse.used).toBe(true);
    expect(m.pos).toEqual({ x: 7, y: 4 });
  });
  it('los nigromantes alzan como mucho 2 a la vez y sus alzados caen con ellos', () => {
    const info = bossInfo(newRun('T', 1, [{ owner: 'p', name: 'L', cls: 'arquero', routes: ['base'] }]));
    const s = board([hero('arquero', { x: 0, y: 0 }), makeEnemy('acolito', { x: 8, y: 3 }), ...[0, 1, 2, 3].map((i) => makeEnemy('limo', { x: 9, y: i + 2 }))]);
    const aco = s.units[1]!;
    for (const c of s.units.slice(2)) c.hp = 0;
    s.units[0]!.hp = s.units[0]!.maxHp = 5000;
    for (let i = 0; i < 6; i++) { s.turn = s.order.indexOf(aco.id); aco.ap = 10; s.over = null; runAiTurn(s, info); }
    const raised = s.units.filter((u) => u.summoner === aco.id && u.hp > 0);
    expect(raised.length).toBe(2);
    aco.hp = 1; aco.armor = 0; aco.shield = 0;
    const u = me(s, s.units[0]!);
    aco.pos = { x: 4, y: 0 };
    expect(cast(s, u.id, 'flecha', aco.pos).ok).toBe(true);
    expect(raised.every((r) => r.hp === 0)).toBe(true);
  });
});

describe('G3.3 · clases', () => {
  it('Arquero · Distancia letal: +1 por casilla más allá de 3, máx. +3; el Arquero óseo no la tiene', () => {
    const s = board([hero('arquero', { x: 0, y: 0 }), makeEnemy('esqueleto', { x: 5, y: 0 }), makeEnemy('arquero', { x: 0, y: 7 })]);
    const a = s.units[0]!, e = s.units[1]!, bone = s.units[2]!;
    expect(archerBonus(a, e)).toBe(2);
    e.pos = { x: 9, y: 0 }; expect(archerBonus(a, e)).toBe(3);
    e.pos = { x: 2, y: 0 }; expect(archerBonus(a, e)).toBe(0);
    expect(archerBonus(bone, a)).toBe(0);
  });
  it('Arquitecto · la Lanza de energía se lanza como mucho 2 veces por turno', () => {
    const s = board([hero('arquitecto', { x: 0, y: 0 }), { ...makeEnemy('esqueleto', { x: 3, y: 0 }), hp: 999, maxHp: 999 }]);
    const u = me(s, s.units[0]!), e = s.units[1]!;
    expect(cast(s, u.id, 'r_lanza', e.pos).ok).toBe(true);
    expect(cast(s, u.id, 'r_lanza', e.pos).ok).toBe(true);
    expect(castProblem(s, u, SPELLS.r_lanza!, e.pos)).toMatch(/Máximo 2/);
  });
});

describe('G3.4 · habilidades de jefe', () => {
  const AP: Record<string, number> = {
    z_espejismo: 2, t_singularidad: 3, s_marca: 3, s_velo: 1, k_sacrificio: 2, b_mirada: 2, b_frenesi: 2,
    r_inercia: 3, r_matriz: 3, r_ciudadela: 4, g_plata: 3, a_letal: 4, a_halcon: 3, a_conmocion: 3,
  };
  const POOL = Object.values(PATRONS).filter((p) => PLAYABLE.includes(p.cls)).flatMap((p) => p.spells).filter((id) => SPELLS[id]?.route === 'boon');
  it('las habilidades de jefe de las 8 clases no tienen enfriamiento (salvo las del ajuste de habilidades) y conservan su coste de PA', () => {
    expect(POOL.length).toBe(56);
    const rework = new Set(['k_caja', 'k_sacrificio', 'k_condena', 'z_espejismo', 'z_drenaje', 'z_velo', 'z_resguardo', 't_singularidad', 's_velo', 's_ejecucion']);
    for (const id of POOL) if (!rework.has(id)) expect(SPELLS[id]!.cd, id).toBe(0);
    for (const [id, ap] of Object.entries(AP)) expect(SPELLS[id]!.ap, id).toBe(ap);
  });
  it('sin enfriamiento se pueden repetir en el mismo turno mientras haya PA', () => {
    const s = board([hero('barbaro', { x: 2, y: 2 }, ['b_mirada']), { ...makeEnemy('esqueleto', { x: 4, y: 2 }), hp: 999, maxHp: 999 }]);
    const u = me(s, s.units[0]!), e = s.units[1]!;
    expect(cast(s, u.id, 'b_mirada', e.pos).ok).toBe(true);
    expect(cast(s, u.id, 'b_mirada', e.pos).ok).toBe(true);
    u.ap = 1;
    expect(castProblem(s, u, SPELLS.b_mirada!, e.pos)).toMatch(/PA/);
  });
  it('Campo de inercia se lanza a 2-5 casillas y crea el campo allí', () => {
    const s = board([hero('arquitecto', { x: 2, y: 2 }, ['r_inercia']), makeEnemy('esqueleto', { x: 12, y: 7 })]);
    const u = me(s, s.units[0]!);
    expect(castProblem(s, u, SPELLS.r_inercia!, u.pos)).toMatch(/alcance/);
    expect(castProblem(s, u, SPELLS.r_inercia!, { x: 8, y: 2 })).toMatch(/alcance/);
    expect(cast(s, u.id, 'r_inercia', { x: 5, y: 2 }).ok).toBe(true);
    const cells = marksOf(s, 'inertia', u.id).map((m) => `${m.pos.x},${m.pos.y}`);
    expect(cells).toContain('5,2'); expect(cells).toContain('6,3'); expect(cells).not.toContain('2,2');
  });
  it('Frenesí imparable cuesta 30 de Furia', () => {
    const s = board([hero('barbaro', { x: 2, y: 2 }, ['b_frenesi']), makeEnemy('esqueleto', { x: 9, y: 2 })]);
    const u = me(s, s.units[0]!);
    u.fury = 20;
    expect(castProblem(s, u, SPELLS.b_frenesi!, u.pos)).toMatch(/Furia/);
    u.fury = 50;
    expect(cast(s, u.id, 'b_frenesi', u.pos).ok).toBe(true);
    expect(u.fury).toBe(20);
    expect(u.statuses.frenzy).toBeTruthy();
  });
  it('Espejismo ilusorio da 1 carga de esencia', () => {
    const s = board([hero('zorro', { x: 5, y: 3 }, ['z_espejismo']), makeEnemy('esqueleto', { x: 6, y: 3 })]);
    const u = me(s, s.units[0]!);
    u.essence = 0;
    expect(cast(s, u.id, 'z_espejismo', u.pos).ok).toBe(true);
    expect(u.essence).toBe(1);
  });
  it('sinergias con estados: Flecha ígnea contra quemados y Tiro certero contra marcados', () => {
    for (const [cls, id, kind] of [['arquero', 'a_ignea', 'burn'], ['pistolero', 'g_certero', 'mark']] as const) {
      const dmg = (on: boolean): number => {
        const s = board([hero(cls, { x: 0, y: 0 }, [id]), { ...makeEnemy('esqueleto', { x: 3, y: 0 }), hp: 999, maxHp: 999, armor: 0, resist: {} }]);
        const u = me(s, s.units[0]!), e = s.units[1]!;
        u.crit = 0; e.traits = [];
        if (on) e.statuses[kind] = { turns: 3, stacks: 1 };
        s.rng = 77;
        cast(s, u.id, id, e.pos);
        return 999 - e.hp;
      };
      expect(dmg(true) - dmg(false), id).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('G3 · combates completos', () => {
  it('cada jefe se puede jugar entero en solitario y con 4, y es determinista', () => {
    for (const b of BOSSES) for (const n of [1, 4]) {
      const play = (): string => {
        const r = bossRun(b.id, n);
        const s = createCombat({ ...buildFight(r as never) }).state;
        for (const u of s.units) if (u.team === 'hero' && u.ai === null) u.ai = 'champ';
        autoplay(s, 1500, bossInfo(r));
        return JSON.stringify({ over: s.over, round: s.round, hp: s.units.map((u) => u.hp) });
      };
      const a = play();
      expect(JSON.parse(a).over, `${b.id} n=${n}`).toBeTruthy();
      expect(play(), `${b.id} n=${n}`).toBe(a);
    }
  });
});
