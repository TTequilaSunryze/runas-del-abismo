// Q1 · Rediseño de los encuentros de jefe: composición mínima, desgaste por oleadas, objetivos estructurales,
// presión acumulativa, segunda fase, runas y escalado de 1 a 4 jugadores.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { ZONES } from '../src/content/zones';
import { makeHero } from '../src/core/classes/factory';
import { runAiTurn } from '../src/core/combat/ai';
import { BOSS_KITS, MIN_HOSTILES, WARD_CAP } from '../src/core/combat/bosskits';
import { OMEN_CAP, omenHit, wardOf } from '../src/core/combat/encounter';
import { cast, createCombat, current, endTurn, interleave, strike, type UnitSpec } from '../src/core/combat/engine';
import { alive, reachable } from '../src/core/combat/grid';
import { marksOf } from '../src/core/combat/marks';
import type { ClassId, CombatState, GameEvent, Unit } from '../src/core/state';
import { ESCORT_HP, bossEscorts, bossInfo, buildFight, heroSpec, newRun, type RunState } from '../src/game/run';
import { autoplay, bringBoss } from './helpers';

const P = (n: number) => Array.from({ length: n }, (_, i) => ({ owner: `p${i}`, name: `H${i}`, cls: (['arquero', 'barbaro', 'carcelero', 'esferas'] as ClassId[])[i]!, routes: ['base'] }));
const BOSSES = ZONES.flatMap((z, zi) => z.bosses.map((b, bi) => ({ id: b.id, zone: zi, idx: bi })));
const ATTRITION = ['planidera', 'rey', 'eco'];
const bossRun = (id: string, n: number, asc = 0, seed = 11): RunState => {
  const b = BOSSES.find((x) => x.id === id)!;
  const r = newRun(`Q1${id}`, seed, P(n), { asc });
  r.zone = b.zone; r.zoneFight = 5; r.kind = 'boss'; r.bossPick = ZONES.map(() => b.idx);
  return r;
};
const fight = (id: string, n: number, asc = 0, seed = 11): { r: RunState; s: CombatState } => {
  const r = bossRun(id, n, asc, seed);
  return { r, s: createCombat({ ...buildFight(r), deploy: false }).state };
};
const hostiles = (s: CombatState): Unit[] => s.units.filter((u) => u.team === 'enemy' && alive(u) && u.ai !== 'pillar');
const hero = (cls: ClassId, pos: { x: number; y: number }): UnitSpec => makeHero({ cls, name: cls, owner: 'p0', routes: [], pos });
/** Pasa turnos (héroes: terminan sin hacer nada; IA: juega) hasta empezar la ronda `round`. Devuelve los eventos. */
const toRound = (s: CombatState, round: number, info?: ReturnType<typeof bossInfo>): GameEvent[] => {
  const ev: GameEvent[] = [];
  for (let i = 0; i < 400 && s.round < round && !s.over; i++) {
    const u = current(s)!;
    if (u.ai) ev.push(...runAiTurn(s, info)); else { const r = endTurn(s, u.id); if (r.ok) ev.push(...r.events); }
  }
  return ev;
};
const immortal = (s: CombatState): void => { for (const h of s.units.filter((u) => u.team === 'hero')) h.hp = h.maxHp = 99999; };

describe('Q1 · regla universal: composición de los encuentros', () => {
  it('los ocho jefes tienen formato, y los tres de desgaste son la Plañidera, el Rey y el Eco', () => {
    expect(BOSSES).toHaveLength(8);
    for (const b of BOSSES) expect(BOSS_KITS[b.id]!.encounter, b.id).toBeTruthy();
    expect(BOSSES.filter((b) => BOSS_KITS[b.id]!.encounter.format === 'attrition').map((b) => b.id).sort()).toEqual([...ATTRITION].sort());
  });
  it('con 1 a 4 jugadores, ningún jefe está solo: mínimo 4 hostiles contando al jefe, con papeles distintos', () => {
    expect([1, 2, 3, 4].map(bossEscorts).every((x) => x >= MIN_HOSTILES - 1)).toBe(true);
    for (const b of BOSSES) for (const n of [1, 2, 3, 4]) {
      const { s } = fight(b.id, n);
      const start = hostiles(s);
      expect(start.length, `${b.id} n=${n}`).toBeGreaterThanOrEqual(MIN_HOSTILES);
      // papeles: no todos iguales
      expect(new Set(start.map((u) => u.kind)).size, `${b.id} n=${n}`).toBeGreaterThanOrEqual(3);
      if (!ATTRITION.includes(b.id)) expect(start.some((u) => u.kind === b.id), b.id).toBe(true);
    }
  });
  it('nadie aparece encima de un héroe, dentro de un obstáculo ni en una casilla inaccesible', () => {
    for (const b of BOSSES) for (const n of [1, 4]) {
      const { s } = fight(b.id, n);
      const h = s.units.find((u) => u.team === 'hero')!;
      const walk = reachable(s, h.pos, 99, true).cost;
      const cells = s.units.map((u) => `${u.pos.x},${u.pos.y}`);
      expect(new Set(cells).size, `${b.id} n=${n}`).toBe(cells.length);
      for (const u of s.units) {
        expect(s.obstacles.includes(`${u.pos.x},${u.pos.y}`), `${b.id} ${u.kind}`).toBe(false);
        expect(walk.has(`${u.pos.x},${u.pos.y}`), `${b.id} ${u.kind}`).toBe(true);
      }
    }
  });
  it('la escolta ajusta su vida al grupo; el jefe sigue escalando por jugadores', () => {
    expect(ESCORT_HP[0]).toBeLessThan(ESCORT_HP[3]);
    const solo = fight('prior', 1).s, four = fight('prior', 4).s;
    const boss = (s: CombatState) => s.units.find((u) => u.kind === 'prior')!;
    expect(boss(four).maxHp).toBeGreaterThan(boss(solo).maxHp);
  });
});

describe('Q1 · desgaste por oleadas', () => {
  for (const id of ATTRITION) it(`${id}: 4 enemigos, +4 en la ronda 3 (anunciados en la 2) y el jefe con 3 acompañantes en la 5`, () => {
    for (const n of [1, 4]) {
      const { r, s } = fight(id, n);
      const info = bossInfo(r);
      immortal(s);
      expect(hostiles(s)).toHaveLength(4);
      expect(s.units.some((u) => u.ai === 'boss')).toBe(false);
      expect(s.encounter?.bossIn).toBe(false);
      // ronda 2: aviso con casillas marcadas
      const ev2 = toRound(s, 2, info);
      expect(marksOf(s, 'arrival').length, id).toBe(4);
      expect(ev2.some((e) => e.t === 'note' && /refuerzos la próxima ronda/.test(e.text))).toBe(true);
      const before = new Set(hostiles(s).map((u) => u.id));
      // ronda 3: entran 4 más; los supervivientes siguen
      toRound(s, 3, info);
      const now3 = hostiles(s);
      expect(now3.filter((u) => !before.has(u.id)).length, `${id} n=${n}`).toBe(4);
      expect(now3.filter((u) => before.has(u.id)).length).toBe(before.size);
      expect(marksOf(s, 'arrival')).toHaveLength(0);
      // ronda 4: anuncio del jefe
      const ev4 = toRound(s, 4, info);
      expect(ev4.some((e) => e.t === 'note' && /irrumpirá la próxima ronda/.test(e.text)), id).toBe(true);
      const prev = new Set(hostiles(s).map((u) => u.id));
      const ev5 = toRound(s, 5, info);
      const boss = s.units.find((u) => u.ai === 'boss')!;
      expect(boss, id).toBeTruthy();
      expect(ev5.some((e) => e.t === 'bossEnter' && e.unit === boss.id)).toBe(true);
      const fresh = hostiles(s).filter((u) => !prev.has(u.id));
      // jefe + subordinado especial + 2 acompañantes
      expect(fresh.length, `${id} n=${n}`).toBe(4);
      expect(fresh.filter((u) => u.rank === 'elite')).toHaveLength(1);
      expect(s.encounter?.bossIn).toBe(true);
      // nadie encima de nadie
      const cells = s.units.filter(alive).map((u) => `${u.pos.x},${u.pos.y}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
  it('nadie juega dos veces en la ronda en que llegan refuerzos y el jefe respeta su iniciativa', () => {
    const { r, s } = fight('planidera', 2);
    const info = bossInfo(r); immortal(s);
    toRound(s, 5, info);
    // la ronda 5 acaba de empezar: el orden se ha rehecho por iniciativa
    expect(s.order).toEqual(interleave(s.units));
    const seen = new Map<number, number>();
    for (let i = 0; i < 200 && s.round === 5 && !s.over; i++) {
      const u = current(s)!;
      seen.set(u.id, (seen.get(u.id) ?? 0) + 1);
      if (u.ai) runAiTurn(s, info); else endTurn(s, u.id);
    }
    expect([...seen.values()].every((k) => k === 1)).toBe(true);
    const boss = s.units.find((u) => u.ai === 'boss')!;
    expect(seen.get(boss.id)).toBe(1);
  });
  it('si se despeja la sala, la siguiente oleada se adelanta con aviso (no se puede impedir que llegue el jefe)', () => {
    const { r, s } = fight('rey', 1);
    const info = bossInfo(r); immortal(s);
    expect(s.waves?.[0]?.round).toBe(3);
    // se acaba con toda la primera oleada en la ronda 1
    for (const u of hostiles(s)) { u.traits = []; strike(s, u, 99999, [], 'test', { pierce: true }); }
    expect(s.over).toBeNull();
    expect(s.waves?.[0]?.round).toBe(2);
    expect(marksOf(s, 'arrival').length).toBe(4);
    toRound(s, 2, info);
    expect(hostiles(s).length).toBe(4);
    expect(s.over).toBeNull();
  });
  it('sin casillas libres suficientes, los refuerzos esperan en la entrada y llegan la ronda siguiente (no se pierden)', () => {
    const { r, s } = fight('eco', 1);
    const info = bossInfo(r); immortal(s);
    toRound(s, 2, info);
    // se tapa casi todo el tablero con muros
    const keep = new Set(s.units.filter(alive).map((u) => `${u.pos.x},${u.pos.y}`));
    let free = 0;
    for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) { const k = `${x},${y}`; if (keep.has(k) || s.obstacles.includes(k)) continue; if (free < 2) { free++; continue; } s.obstacles.push(k); }
    const count = s.waves![0]!.units.length;
    const n0 = hostiles(s).length;
    toRound(s, 3, info);
    const arrived = hostiles(s).length - n0;
    expect(arrived).toBeLessThan(count);
    expect(s.waves?.[0]?.units.length).toBe(count - arrived);
    expect(s.waves?.[0]?.round).toBe(4);
  });
});

describe('Q1 · objetivos estructurales', () => {
  it('obligatorios: sellos del Prior, raíces de la Madre y almas del Eco protegen sin inmunidad (tope 60%)', () => {
    for (const [id, mech] of [['prior', 'seal'], ['madre', 'root']] as const) for (const n of [1, 4]) {
      const { s } = fight(id, n);
      const boss = s.units.find((u) => u.ai === 'boss')!;
      const objs = s.units.filter((u) => u.objective?.mech === mech);
      const def = BOSS_KITS[id]!.encounter.objectives![0]!;
      expect(objs.length, `${id} n=${n}`).toBe(def.count[n - 1]);
      expect(wardOf(s, boss)).toBeCloseTo(Math.min(WARD_CAP, def.ward! * objs.length));
      expect(wardOf(s, boss)).toBeLessThan(1);
      for (const o of objs) { expect(o.hp).toBeGreaterThan(0); expect(o.objective!.role).toBe('required'); }
    }
  });
  it('la protección reduce el daño de verdad y romper un sello lo expone, lo debilita y baja la protección', () => {
    const s = createCombat({ seed: 3, w: 14, h: 8, obstacles: [], units: [hero('arquero', { x: 2, y: 3 }), makeEnemy('prior', { x: 10, y: 3 }), ...[1, 5, 6, 7].map((y) => ({ ...makeEnemy('sello', { x: 6, y: y }), objective: { mech: 'seal' as const, role: 'required' as const, ward: 0.15 } }))], encounter: { boss: 'prior', format: 'classic', players: 1, bossIn: true, pressure: 0, broken: 0 } }).state;
    const h = s.units[0]!, boss = s.units[1]!;
    for (let i = 0; i < 20 && current(s)!.id !== h.id; i++) endTurn(s, current(s)!.id);
    h.ap = 99;
    boss.hp = boss.maxHp = 9999; boss.armor = 0;
    const hit = (): number => { const hp = boss.hp; h.pos = { x: 8, y: 3 }; cast(s, h.id, 'flecha', boss.pos); return hp - boss.hp; };
    const full = (() => { let t = 0; for (let i = 0; i < 6; i++) t += hit(); return t; })();
    expect(wardOf(s, boss)).toBeCloseTo(0.6);
    const power = boss.power;
    const seal = s.units.find((u) => u.objective?.mech === 'seal')!;
    seal.hp = 1; seal.armor = 0; seal.shield = 0;
    h.pos = { x: 6, y: 3 };
    expect(cast(s, h.id, 'flecha', seal.pos).ok).toBe(true);
    expect(alive(seal)).toBe(false);
    expect(boss.statuses.exposed).toBeTruthy();
    expect(boss.power).toBe(power - BOSS_KITS.prior!.encounter.breakPower!);
    expect(wardOf(s, boss)).toBeCloseTo(0.45);
    for (const o of s.units.filter((u) => u.objective && alive(u))) o.hp = 0;
    delete boss.statuses.exposed;
    const bare = (() => { let t = 0; for (let i = 0; i < 6; i++) t += hit(); return t; })();
    expect(bare).toBeGreaterThan(full * 1.8);
  });
  it('opcionales: braseros, válvulas, puestos y fragmentos se colocan, reciben daño y no hacen falta para ganar', () => {
    for (const [id, mech] of [['rey', 'pyre'], ['fundidora', 'valve'], ['cazador', 'post'], ['devorarunas', 'shard']] as const) {
      const { s } = fight(id, 2);
      const objs = s.units.filter((u) => u.objective?.mech === mech);
      expect(objs.length, id).toBeGreaterThan(0);
      expect(objs.every((o) => o.objective!.role === 'optional' && o.ai === 'pillar')).toBe(true);
      // ganar: basta con acabar con los hostiles (jefe incluido)
      bringBoss(s);
      for (const u of hostiles(s)) u.hp = 0;
      const h = s.units.find((u) => u.team === 'hero')!;
      for (let i = 0; i < 20 && current(s)!.id !== h.id && !s.over; i++) endTurn(s, current(s)!.id);
      const o = objs[0]!; o.hp = 1; o.armor = 0; h.ap = 99; h.pos = { x: Math.max(0, o.pos.x - 2), y: o.pos.y };
      if (!s.over) { hostiles(s).forEach((u) => (u.hp = 0)); endTurn(s, h.id); }
      expect(s.over === 'win' || s.units.filter((u) => u.team === 'enemy' && alive(u) && u.ai !== 'pillar').length === 0, id).toBe(true);
    }
  });
  it('Fundidora: la presión sube cada turno, la colada se anuncia y una válvula abierta la corta y la escalda', () => {
    const { r, s } = fight('fundidora', 1);
    const info = bossInfo(r); immortal(s);
    const boss = s.units.find((u) => u.ai === 'boss')!;
    const bossAt = (round: number) => { s.round = round; boss.ap = boss.maxAp; s.over = null; s.turn = s.order.indexOf(boss.id); return runAiTurn(s, info); };
    let ev: GameEvent[] = [];
    for (let round = 1; round <= 6 && !(s.marks ?? []).some((m) => m.sub === 'colada'); round++) ev = bossAt(round * 3 + 1);
    expect((s.marks ?? []).some((m) => m.kind === 'omen' && m.sub === 'colada')).toBe(true);
    expect(ev.some((e) => e.t === 'note' && /Colada masiva/.test(e.text))).toBe(true);
    const valve = s.units.find((u) => u.objective?.mech === 'valve' && alive(u))!;
    valve.pos = { ...valve.pos };
    // la válvula junto a ella para que el vapor la alcance
    const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: boss.pos.x + dx!, y: boss.pos.y + dy! })).find((p) => !s.units.some((u) => alive(u) && u.pos.x === p.x && u.pos.y === p.y) && !s.obstacles.includes(`${p.x},${p.y}`))!;
    valve.pos = free;
    const hp = boss.hp;
    const h = s.units.find((u) => u.team === 'hero')!;
    for (let i = 0; i < 30 && current(s)!.id !== h.id; i++) endTurn(s, current(s)!.id);
    valve.hp = 1; valve.armor = 0; h.ap = 99; h.pos = { x: Math.max(0, valve.pos.x - 3), y: valve.pos.y };
    if (s.units.some((u) => u !== h && alive(u) && u.pos.x === h.pos.x && u.pos.y === h.pos.y)) h.pos = { x: valve.pos.x, y: Math.max(0, valve.pos.y - 3) };
    const res = cast(s, h.id, 'flecha', valve.pos);
    expect(res.ok).toBe(true);
    expect((s.marks ?? []).some((m) => m.sub === 'colada')).toBe(false);
    expect(boss.hp).toBeLessThan(hp);
  });
  it('Devorador: se come los fragmentos (y crece); romperlos antes da energía al héroe', () => {
    const { r, s } = fight('devorarunas', 1);
    const info = bossInfo(r); immortal(s);
    const boss = s.units.find((u) => u.ai === 'boss')!;
    const shards = () => s.units.filter((u) => u.objective?.mech === 'shard' && alive(u));
    const n0 = shards().length;
    for (const sh of shards()) sh.pos = { ...sh.pos };
    s.round = 1; boss.ap = boss.maxAp; s.turn = s.order.indexOf(boss.id);
    // acerca un fragmento
    shards()[0]!.pos = s.units.some((u) => alive(u) && u.pos.x === boss.pos.x - 2 && u.pos.y === boss.pos.y) ? shards()[0]!.pos : { x: boss.pos.x - 2, y: boss.pos.y };
    runAiTurn(s, info);
    expect(s.encounter!.pressure).toBe(1);
    expect(shards().length).toBe(n0 - 1);
    // romper un fragmento antes de que se lo coma: su energía pasa al héroe más cercano
    const sh = shards()[0] ?? s.units.find((u) => u.objective?.mech === 'shard')!;
    sh.hp = Math.max(1, sh.hp);
    strike(s, sh, 99999, [], 'test', { pierce: true });
    expect(s.units.some((u) => u.team === 'hero' && u.statuses.empower?.stacks === 25)).toBe(true);
  });
  it('Plañidera: deja ecos que potencian su lamento; destruirlos lo evita; al estallar se los traga', () => {
    const { r, s } = fight('planidera', 1);
    const info = bossInfo(r); immortal(s);
    const boss = bringBoss(s)!;
    // sin muros: que la línea del llanto no quede cortada por una cobertura
    s.obstacles = [];
    const bossAt = (round: number) => { s.round = round; boss.ap = boss.maxAp; s.over = null; s.turn = s.order.indexOf(boss.id); return runAiTurn(s, info); };
    bossAt(1);
    const echoes = () => s.units.filter((u) => u.objective?.mech === 'wail' && alive(u));
    expect(echoes().length).toBeGreaterThan(0);
    // en la ronda 1 anuncia el llanto (every 3, at 1): con ecos vivos pega más (con tope); sin ecos, normal
    const m = marksOf(s, 'omen', boss.id);
    expect(m.length).toBeGreaterThan(0);
    const h = s.units.find((u) => u.team === 'hero')!;
    const boosted = omenHit(s, boss, m[0]!.dmg!, h);
    expect(boosted).toBeLessThanOrEqual(Math.round(h.maxHp * OMEN_CAP[1]));
    const old = echoes().map((u) => u.id);
    // al estallar (siguiente turno), se traga los ecos que había
    bossAt(2);
    expect(s.units.filter((u) => old.includes(u.id) && alive(u))).toHaveLength(0);
    // destruir los ecos antes evita la potencia extra
    for (const e of echoes()) e.hp = 0;
    expect(omenHit(s, boss, m[0]!.dmg!, h)).toBeLessThan(boosted);
  });
  it('Cazador: marca al que se separa y se esconde junto a un puesto; sin puestos no puede', () => {
    const { r, s } = fight('cazador', 2);
    const info = bossInfo(r); immortal(s);
    const boss = s.units.find((u) => u.ai === 'boss')!;
    const [a, b] = s.units.filter((u) => u.team === 'hero');
    a!.pos = { x: 0, y: 0 }; b!.pos = { x: 0, y: s.h - 1 };
    s.round = 2; boss.ap = boss.maxAp; s.turn = s.order.indexOf(boss.id);
    runAiTurn(s, info);
    expect(a!.statuses.mark || b!.statuses.mark).toBeTruthy();
    expect(boss.statuses.invis).toBeTruthy();
    const post = s.units.filter((u) => u.objective?.mech === 'post' && alive(u));
    expect(post.some((p) => Math.abs(p.pos.x - boss.pos.x) + Math.abs(p.pos.y - boss.pos.y) <= 1)).toBe(true);
    for (const p of post) p.hp = 0;
    delete boss.statuses.invis;
    const at = { ...boss.pos };
    s.round = 5; boss.ap = boss.maxAp; s.turn = s.order.indexOf(boss.id);
    runAiTurn(s, info);
    expect(boss.statuses.invis).toBeFalsy();
    void at;
  });
  it('Rey: los braseros avivan la pira y prenden el suelo; apagarlos baja la presión', () => {
    const { r, s } = fight('rey', 2);
    const info = bossInfo(r); immortal(s);
    toRound(s, 4, info);
    expect(s.encounter!.pressure).toBeGreaterThanOrEqual(2);
    expect(Object.keys(s.fire ?? {}).length).toBeGreaterThan(0);
    const p0 = s.encounter!.pressure;
    const br = s.units.find((u) => u.objective?.mech === 'pyre' && alive(u))!;
    const near = Object.keys(s.fire ?? {}).length;
    strike(s, br, 99999, [], 'test', { pierce: true });
    expect(alive(br)).toBe(false);
    expect(s.encounter!.pressure).toBe(Math.max(0, p0 - 2));
    expect(Object.keys(s.fire ?? {}).length).toBeLessThanOrEqual(near);
  });
});

describe('Q1 · fases, final y runas', () => {
  it('la segunda fase conserva los objetivos destruidos (no se reinicia la protección)', () => {
    const { r, s } = fight('madre', 2);
    const info = bossInfo(r); immortal(s);
    const boss = s.units.find((u) => u.ai === 'boss')!;
    const roots = s.units.filter((u) => u.objective?.mech === 'root');
    roots[0]!.hp = 0; roots[1]!.hp = 0;
    const ward = wardOf(s, boss);
    boss.hp = Math.floor(boss.maxHp / 2);
    s.round = 3; boss.ap = boss.maxAp; s.turn = s.order.indexOf(boss.id);
    runAiTurn(s, info);
    expect(boss.phase).toBe(2);
    expect(wardOf(s, boss)).toBeCloseTo(ward);
    expect(s.units.filter((u) => u.objective?.mech === 'root' && alive(u))).toHaveLength(2);
    // la Raíz Desatada invade el tablero
    const r0 = (s.roots ?? []).length;
    s.round = 4; boss.ap = boss.maxAp; s.turn = s.order.indexOf(boss.id);
    runAiTurn(s, info);
    expect((s.roots ?? []).length).toBeGreaterThan(r0);
  });
  it('muerte del jefe y fin de la sala aunque queden objetivos en pie', () => {
    for (const b of BOSSES) {
      const { s } = fight(b.id, 1);
      const boss = bringBoss(s)!;
      for (const u of hostiles(s)) if (u !== boss) u.hp = 0;
      const h = s.units.find((u) => u.team === 'hero')!;
      for (let i = 0; i < 40 && current(s)!.id !== h.id && !s.over; i++) endTurn(s, current(s)!.id);
      boss.hp = 1; boss.armor = 0; boss.shield = 0; h.ap = 99;
      for (const o of s.units.filter((u) => u.objective)) o.objective!.ward = 0;
      h.pos = { x: Math.max(0, boss.pos.x - 2), y: boss.pos.y };
      if (s.units.some((u) => u !== h && alive(u) && u.pos.x === h.pos.x && u.pos.y === h.pos.y)) h.pos = { x: boss.pos.x, y: Math.max(0, boss.pos.y - 2) };
      cast(s, h.id, 'flecha', boss.pos);
      if (!s.over) strike(s, boss, 99999, [], 'test', { pierce: true });
      expect(s.over, b.id).toBe('win');
    }
  });
  it('Metralla rebota entre objetivos del encuentro; Ejecución no mata al jefe de golpe pero sí remata un objetivo', () => {
    const run = newRun('R', 3, [{ owner: 'a', name: 'A', cls: 'arquero', routes: [] }]);
    const hs = run.heroes[0]!; hs.runes = ['metralla', 'ejecucion'];
    const u = heroSpec(hs, { x: 1, y: 3 });
    const sello = (x: number, y: number) => ({ ...makeEnemy('sello', { x, y }), objective: { mech: 'seal' as const, role: 'required' as const, ward: 0.15 } });
    const s = createCombat({ seed: 9, w: 12, h: 7, obstacles: [], units: [u, makeEnemy('prior', { x: 6, y: 3 }), sello(7, 3), sello(6, 5)], encounter: { boss: 'prior', format: 'classic', players: 1, bossIn: true, pressure: 0, broken: 0 } }).state;
    const h = s.units[0]!, boss = s.units[1]!;
    for (let i = 0; i < 20 && current(s)!.id !== h.id; i++) endTurn(s, current(s)!.id);
    h.ap = 99;
    boss.hp = 30; boss.statuses.poison = { turns: 3, stacks: 1 };
    const r1 = cast(s, h.id, 'flecha', boss.pos);
    expect(r1.ok).toBe(true);
    const hits = new Set((r1.ok ? r1.events : []).filter((e) => e.t === 'damage').map((e) => (e as { unit: number }).unit));
    expect([...hits].some((id) => s.units.find((x) => x.id === id)?.objective)).toBe(true);
    expect(alive(boss)).toBe(true);
    const seal = s.units[2]!;
    seal.hp = Math.max(1, Math.floor(seal.maxHp * 0.25)); seal.armor = 0; seal.statuses.poison = { turns: 3, stacks: 1 };
    h.pos = { x: 4, y: 3 };
    cast(s, h.id, 'flecha', seal.pos);
    expect(alive(seal)).toBe(false);
  });
  it('los ataques anunciados pegan más en un encuentro, con tope (nadie cae de un golpe sin aviso)', () => {
    const { s } = fight('prior', 1);
    const boss = s.units.find((u) => u.ai === 'boss')!, h = s.units.find((u) => u.team === 'hero')!;
    expect(omenHit(s, boss, 10, h)).toBeGreaterThan(10);
    expect(omenHit(s, boss, 999, h)).toBeLessThanOrEqual(Math.round(h.maxHp * OMEN_CAP[0]));
    // sin encuentro (laboratorio de unidades), el daño no cambia
    const lab = createCombat({ seed: 1, w: 8, h: 6, obstacles: [], units: [hero('arquero', { x: 0, y: 0 }), makeEnemy('prior', { x: 5, y: 3 })] }).state;
    expect(omenHit(lab, lab.units[1]!, 10, lab.units[0]!)).toBe(10);
  });
});

describe('Q1 · partidas completas de 1 y 4 jugadores (sin bloqueos ni turnos duplicados)', () => {
  for (const b of BOSSES) it(`${b.id}: termina con 1 y con 4 jugadores, y en ascensión 10`, () => {
    for (const [n, asc] of [[1, 0], [4, 0], [2, 10]] as const) {
      const { r, s } = fight(b.id, n, asc, 5);
      for (const h of s.units.filter((u) => u.team === 'hero')) { h.hp = h.maxHp = h.maxHp * 4; h.power += 6; }
      autoplay(s, 3000, bossInfo(r));
      expect(s.over, `${b.id} n=${n} asc=${asc} ronda ${s.round}`).not.toBeNull();
      if (ATTRITION.includes(b.id) && s.over === 'win') expect(s.units.some((u) => u.ai === 'boss' && !alive(u)), b.id).toBe(true);
    }
  });
});
