// IA enemiga: apoyo a aliados, rasgos especiales (devorar, alzar muertos), acercarse y atacar.
// El jefe tiene dos fases, invoca refuerzos y pilares que lo curan.
import { SPELLS, type SpellDef } from '../classes/spells';
import type { CombatState, GameEvent, Pos, Unit } from '../state';
import { LATE_ROUND, cast, castProblem, current, endTurn, hasTrait, heal, move, spellOf, summon, type UnitSpec } from './engine';
import { alive, dist, hasLineOfSight, isFree, reachable } from './grid';

/** Lo que la zona aporta a la IA: invocaciones del jefe y de los nigromantes. */
export interface BossInfo {
  minion: (pos: Pos) => UnitSpec;
  pillar?: (pos: Pos) => UnitSpec;
  phase2Name: string;
  /** cuántos pilares levanta el jefe al cambiar de fase */
  pillars?: number;
  /** máximo de invocados vivos a la vez */
  minionCap?: number;
}

const RAISE_AP = 2;
const DEVOUR_HEAL = 0.35;
const PILLAR_HEAL = 0.05;

function attackAll(s: CombatState, u: Unit, def: SpellDef, ev: GameEvent[]): void {
  for (let i = 0; i < 6 && !s.over && alive(u); i++) {
    const target = s.units
      .filter((h) => h.team !== u.team && alive(h) && !castProblem(s, u, def, h.pos))
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) return;
    const r = cast(s, u.id, def.id, target.pos);
    if (!r.ok) return;
    ev.push(...r.events);
  }
}

/** Ataca, se recoloca para poder atacar y vuelve a atacar. `keepAway` prefiere disparar desde lejos. */
function fight(s: CombatState, u: Unit, def: SpellDef, keepAway: boolean, ev: GameEvent[]): void {
  attackAll(s, u, def, ev);
  if (s.over || !alive(u) || current(s)?.id !== u.id || u.mp <= 0) return;
  let foes = s.units.filter((h) => h.team !== u.team && alive(h) && !h.statuses.invis);
  // los cazadores van a por el más frágil
  if (hasTrait(u, 'hunter') && foes.length) foes = [foes.reduce((a, b) => (b.maxHp < a.maxHp ? b : a))];
  const ghost = hasTrait(u, 'ghost');
  const reach = reachable(s, u.pos, u.mp, false, ghost);
  let best: Pos | null = null;
  let bestScore = Infinity;
  for (const k of reach.cost.keys()) {
    if (s.obstacles.includes(k)) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    const p = { x, y };
    const walk = reachable(s, p, 40, true, ghost).cost;
    let score = Infinity;
    for (const f of foes) {
      const d = walk.get(`${f.pos.x},${f.pos.y}`) ?? 99;
      const flat = dist(p, f.pos);
      const canHit = flat >= def.range[0] && flat <= def.range[1] && (!def.los || flat <= 1 || hasLineOfSight(s, p, f.pos));
      const v = canHit ? (keepAway ? -flat : 0) : d + 10;
      if (v < score) score = v;
    }
    // las púas se evitan si hay alternativa
    score += reach.cost.get(k)! * 0.01 + (s.traps.includes(k) ? 3 : 0);
    if (score < bestScore) { bestScore = score; best = p; }
  }
  if (best && (best.x !== u.pos.x || best.y !== u.pos.y)) {
    const r = move(s, u.id, best);
    if (r.ok) ev.push(...r.events);
  }
  if (alive(u) && current(s)?.id === u.id) attackAll(s, u, def, ev);
}

/** Cepos: deja uno oculto junto al héroe más cercano (como mucho 3 del bando a la vez). */
function trapper(s: CombatState, u: Unit, ev: GameEvent[]): void {
  const mine = (s.snares ?? []).filter((t) => t.team === u.team).length;
  if (mine >= 3 || u.ap < 2) return;
  const foe = s.units.filter((h) => h.team !== u.team && alive(h) && !h.statuses.invis).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
  if (!foe) return;
  const cells = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]
    .map(([dx, dy]) => ({ x: foe.pos.x + dx!, y: foe.pos.y + dy! }))
    .filter((p) => isFree(s, p) && !(s.snares ?? []).some((t) => t.k === `${p.x},${p.y}`));
  const at = cells[(s.round + u.id) % Math.max(1, cells.length)];
  if (!at) return;
  (s.snares ??= []).push({ k: `${at.x},${at.y}`, team: u.team, dmg: 7 + Math.round(u.power / 10) });
  u.ap -= 2;
}

/** Salto sombrío: si no tiene a nadie al lado, aparece junto al héroe más frágil (cada dos rondas). */
function blink(s: CombatState, u: Unit, ev: GameEvent[]): void {
  if (s.round % 2 === 1) return;
  const foes = s.units.filter((h) => h.team !== u.team && alive(h) && !h.statuses.invis);
  if (!foes.length || foes.some((f) => dist(f.pos, u.pos) <= 1)) return;
  const prey = foes.reduce((a, b) => (b.hp < a.hp ? b : a));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const p = { x: prey.pos.x + dx, y: prey.pos.y + dy };
    if (!isFree(s, p)) continue;
    u.pos = p;
    ev.push({ t: 'blink', unit: u.id, to: { ...p } });
    return;
  }
}

/** Hechizos de apoyo (escudar, dar PA): sobre el aliado más herido que esté a tiro. */
function support(s: CombatState, u: Unit, ev: GameEvent[]): void {
  for (const sp of u.spells.slice(1)) {
    const def = SPELLS[sp.id];
    if (!def || def.target !== 'ally') continue;
    const ally = s.units
      .filter((a) => a.team === u.team && alive(a) && a !== u && a.ai !== 'pillar' && !castProblem(s, u, def, a.pos) && (!def.shield || a.shield === 0))
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!ally || (def.shield && ally.hp / ally.maxHp > 0.85) || (def.heal && ally.hp / ally.maxHp > 0.7)) continue;
    const r = cast(s, u.id, def.id, ally.pos);
    if (r.ok) ev.push(...r.events);
  }
}

const corpses = (s: CombatState): Unit[] => s.units.filter((c) => !alive(c) && !c.used && c.ai !== 'pillar');

/** Devorar: si está herido, se acerca a un cadáver y se lo come. */
function devour(s: CombatState, u: Unit, ev: GameEvent[]): void {
  if (u.hp > u.maxHp * 0.75 || u.ap < 3) return;
  const reach = reachable(s, u.pos, u.mp);
  let best: { corpse: Unit; cell: Pos; cost: number } | null = null;
  for (const c of corpses(s)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const cell = { x: c.pos.x + dx, y: c.pos.y + dy };
      const cost = cell.x === u.pos.x && cell.y === u.pos.y ? 0 : reach.cost.get(`${cell.x},${cell.y}`);
      if (cost === undefined || s.obstacles.includes(`${cell.x},${cell.y}`)) continue;
      if (!best || cost < best.cost) best = { corpse: c, cell, cost };
    }
  }
  if (!best) return;
  if (best.cost > 0) {
    const r = move(s, u.id, best.cell);
    if (!r.ok) return;
    ev.push(...r.events);
  }
  best.corpse.used = true;
  u.ap -= 3;
  ev.push({ t: 'devour', unit: u.id, corpse: best.corpse.id });
  heal(u, u.maxHp * DEVOUR_HEAL, ev);
}

/** Alzar muertos: convierte un cadáver cercano en un nuevo enemigo. */
function raise(s: CombatState, u: Unit, info: BossInfo | undefined, ev: GameEvent[]): void {
  if (!info || u.ap < RAISE_AP) return;
  const living = s.units.filter((e) => e.team === u.team && alive(e)).length;
  const heroes = s.units.filter((h) => h.team !== u.team).length;
  if (living >= heroes + 4) return;
  const c = corpses(s).filter((x) => dist(x.pos, u.pos) <= 5 && isFree(s, x.pos)).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
  if (!c) return;
  c.used = true;
  u.ap -= RAISE_AP;
  const nu = summon(s, info.minion(c.pos), c.pos, ev);
  if (nu) ev.push({ t: 'raise', unit: u.id, corpse: c.id });
}

function bossTurn(s: CombatState, u: Unit, info: BossInfo | undefined, ev: GameEvent[]): void {
  const heroes = s.units.filter((h) => h.team === 'hero').length;
  const minions = s.units.filter((m) => m.team === 'enemy' && alive(m) && m.id !== u.id && m.ai !== 'pillar').length;
  const cap = info?.minionCap ?? heroes;
  if ((u.phase ?? 1) === 1 && u.hp <= u.maxHp / 2) {
    // Segunda fase: más duro, más rápido, cuerpo a cuerpo, y levanta pilares que lo curan.
    u.phase = 2;
    u.armor += 2;
    u.maxMp = 3;
    u.mp = 3;
    u.name = info?.phase2Name ?? u.name;
    ev.push({ t: 'phase', unit: u.id, phase: 2 });
    if (info) for (let i = 0; i < Math.max(1, heroes - 1); i++) summon(s, info.minion(u.pos), u.pos, ev);
    if (info?.pillar) {
      // pilares lejos del jefe, para obligar al grupo a repartirse
      const spots = [...reachable(s, u.pos, 30, true).cost.keys()]
        .map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y }; })
        .filter((p) => isFree(s, p) && dist(p, u.pos) >= 3)
        .sort((a, b) => dist(b, u.pos) - dist(a, u.pos));
      for (let i = 0; i < (info.pillars ?? 2); i++) {
        const at = spots[(i * 5) % Math.max(1, spots.length)];
        if (at && isFree(s, at)) summon(s, info.pillar(at), at, ev);
      }
    }
  } else if ((u.phase ?? 1) === 1 && info && s.round % 2 === 0 && minions < cap) {
    summon(s, info.minion(u.pos), u.pos, ev);
    u.ap = Math.max(0, u.ap - 3);
  }
  const phase2 = u.phase === 2;
  // primer hechizo: a distancia (fase 1); segundo: cuerpo a cuerpo en área (fase 2)
  fight(s, u, SPELLS[u.spells[phase2 ? 1 : 0]!.id]!, !phase2, ev);
}

/** Los pilares no se mueven: curan al jefe en cada uno de sus turnos. */
function pillarTurn(s: CombatState, ev: GameEvent[]): void {
  const boss = s.units.find((b) => b.ai === 'boss' && alive(b));
  if (boss && s.round < LATE_ROUND) heal(boss, boss.maxHp * PILLAR_HEAL, ev);
}

/** Lanza lo mejor que tenga a mano: primero ayuda a un aliado malherido, luego el hechizo que más daño haga. */
function champCast(s: CombatState, u: Unit, ev: GameEvent[]): boolean {
  const defs = u.spells.filter((sp) => sp.cd === 0).map((sp) => spellOf(u, sp.id)!).filter((d) => d && d.ap <= u.ap);
  const allies = s.units.filter((a) => a.team === u.team && alive(a));
  const foes = s.units.filter((f) => f.team !== u.team && alive(f) && !f.statuses.invis);
  let best: { d: SpellDef; at: Pos; score: number } | null = null;
  const consider = (d: SpellDef, at: Pos, score: number): void => {
    if (score > 0 && (!best || score > best.score) && !castProblem(s, u, SPELLS[d.id]!, at)) best = { d, at, score };
  };
  for (const d of defs) {
    const around = d.range[1] === 0;
    const near = (list: Unit[], at: Pos): Unit[] => list.filter((x) => dist(x.pos, at) <= (d.area ?? 0));
    if (d.target === 'cell') {
      if (d.summon) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) consider(d, { x: u.pos.x + dx, y: u.pos.y + dy }, 30);
    } else if (d.target === 'enemy') {
      const avg = d.dmg ? (d.dmg[0] + d.dmg[1]) / 2 : 0;
      const value = (f: Unit): number => avg * (f.statuses.mark ? 1.3 : 1) + (d.status && !f.statuses[d.status.kind] ? (d.status.kind === 'stun' ? 14 : 6) : 0) + (d.drainAp ?? 0) * 3 + (avg >= f.hp ? 10 : 0);
      if (around) consider(d, u.pos, near(foes, u.pos).reduce((a, f) => a + value(f), 0));
      else for (const f of foes) consider(d, f.pos, value(f) + near(foes, f.pos).filter((x) => x !== f).length * avg * 0.5);
    } else {
      const value = (a: Unit): number => (d.heal ? Math.min(d.heal, a.maxHp - a.hp) * (a.hp < a.maxHp * 0.6 ? 1.6 : 0.4) : 0) + (d.shield && a.shield === 0 ? d.shield * 0.7 : 0) + ((d.giveAp ?? 0) * 3 + (d.giveMp ?? 0)) * (a === u ? 0 : 1);
      if (d.target === 'self' || around) consider(d, u.pos, (around ? near(allies, u.pos) : [u]).reduce((a, x) => a + value(x), 0));
      else for (const a of allies) consider(d, a.pos, value(a));
    }
  }
  const pickd = best as { d: SpellDef; at: Pos } | null;
  if (!pickd) return false;
  const r = cast(s, u.id, pickd.d.id, pickd.at);
  if (r.ok) ev.push(...r.events);
  return r.ok;
}

/** Un héroe llevado por la IA (némesis y duelos): usa todos sus hechizos. */
function champTurn(s: CombatState, u: Unit, ev: GameEvent[]): void {
  const mine = (): boolean => !s.over && alive(u) && current(s)?.id === u.id;
  for (let i = 0; i < 8 && mine() && champCast(s, u, ev); i++);
  if (!mine()) return;
  // se recoloca según su hechizo básico y vuelve a intentarlo
  const base = spellOf(u, u.spells[0]!.id)!;
  if (u.mp > 0) {
    const ap = u.ap;
    u.ap = 0;
    fight(s, u, base, base.range[1] > 1, ev);
    if (alive(u)) u.ap = ap;
  }
  for (let i = 0; i < 8 && mine() && champCast(s, u, ev); i++);
}

/** Juega el turno completo de la unidad actual si la controla la IA. */
export function runAiTurn(s: CombatState, info?: BossInfo): GameEvent[] {
  const u = current(s);
  const ev: GameEvent[] = [];
  if (!u || !u.ai) return ev;
  if (u.ai === 'pillar') pillarTurn(s, ev);
  else if (u.ai === 'boss') bossTurn(s, u, info, ev);
  else if (u.ai === 'champ') champTurn(s, u, ev);
  else {
    support(s, u, ev);
    if (hasTrait(u, 'blink')) blink(s, u, ev);
    if (hasTrait(u, 'trapper')) trapper(s, u, ev);
    if (hasTrait(u, 'devour')) devour(s, u, ev);
    if (hasTrait(u, 'raise')) raise(s, u, info, ev);
    if (alive(u) && current(s)?.id === u.id) fight(s, u, SPELLS[u.spells[0]!.id]!, u.ai === 'ranged', ev);
  }
  if (!s.over && current(s)?.id === u.id) {
    const r = endTurn(s, u.id);
    if (r.ok) ev.push(...r.events);
  }
  return ev;
}
