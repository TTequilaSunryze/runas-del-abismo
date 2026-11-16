// IA enemiga: apoyo a aliados, rasgos especiales (devorar, alzar muertos), acercarse y atacar.
// El jefe tiene dos fases, invoca refuerzos y pilares que lo curan.
import { SPELLS, type SpellDef } from '../classes/spells';
import type { CombatState, GameEvent, Pos, Unit } from '../state';
import { cast, castProblem, current, endTurn, hasTrait, heal, move, summon, type UnitSpec } from './engine';
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
  let foes = s.units.filter((h) => h.team !== u.team && alive(h));
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

/** Hechizos de apoyo (escudar, dar PA): sobre el aliado más herido que esté a tiro. */
function support(s: CombatState, u: Unit, ev: GameEvent[]): void {
  for (const sp of u.spells.slice(1)) {
    const def = SPELLS[sp.id];
    if (!def || def.target !== 'ally') continue;
    const ally = s.units
      .filter((a) => a.team === u.team && alive(a) && a !== u && a.ai !== 'pillar' && !castProblem(s, u, def, a.pos) && (!def.shield || a.shield === 0))
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!ally || (def.shield && ally.hp / ally.maxHp > 0.85)) continue;
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
  if (boss) heal(boss, boss.maxHp * PILLAR_HEAL, ev);
}

/** Juega el turno completo de la unidad actual si la controla la IA. */
export function runAiTurn(s: CombatState, info?: BossInfo): GameEvent[] {
  const u = current(s);
  const ev: GameEvent[] = [];
  if (!u || !u.ai) return ev;
  if (u.ai === 'pillar') pillarTurn(s, ev);
  else if (u.ai === 'boss') bossTurn(s, u, info, ev);
  else {
    support(s, u, ev);
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
