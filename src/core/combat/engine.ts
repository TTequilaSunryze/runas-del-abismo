// Motor de combate por iniciativa: una unidad juega, las demás esperan.
// Todas las funciones modifican el estado y devuelven los eventos ocurridos.
import { SPELLS, type SpellDef } from '../classes/spells';
import { rand, randInt } from '../rng';
import { key, type CombatState, type GameEvent, type Pos, type StatusKind, type Unit } from '../state';
import { alive, dist, hasLineOfSight, isFree, pathTo, reachable, same, unitAt } from './grid';

export type UnitSpec = Omit<Unit, 'id'>;

export interface CombatSetup {
  seed: number;
  w: number;
  h: number;
  obstacles: Pos[];
  units: UnitSpec[];
}

export type ActionResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string };

const BURN_DMG = 3;
const POISON_DMG = 2;
const MARK_MULT = 1.3;
const CRIT_MULT = 1.5;
const PUSH_CRASH_DMG = 4;
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export function createCombat(setup: CombatSetup): { state: CombatState; events: GameEvent[] } {
  const units: Unit[] = setup.units.map((u, i) => ({ ...u, pos: { ...u.pos }, statuses: { ...u.statuses }, spells: u.spells.map((s) => ({ ...s })), id: i + 1 }));
  const order = units
    .slice()
    .sort((a, b) => b.initiative - a.initiative || (a.team === b.team ? a.id - b.id : a.team === 'hero' ? -1 : 1))
    .map((u) => u.id);
  const state: CombatState = {
    version: 1, rng: setup.seed >>> 0, w: setup.w, h: setup.h, obstacles: setup.obstacles.map(key),
    units, order, turn: -1, round: 1, over: null, nextId: units.length + 1,
  };
  const events: GameEvent[] = [];
  beginNext(state, events);
  return { state, events };
}

export function getUnit(s: CombatState, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id);
}

/** Unidad a la que le toca jugar (undefined si el combate terminó). */
export function current(s: CombatState): Unit | undefined {
  return s.over ? undefined : getUnit(s, s.order[s.turn]!);
}

function checkOver(s: CombatState, ev: GameEvent[]): void {
  if (s.over) return;
  const heroes = s.units.some((u) => u.team === 'hero' && alive(u));
  const enemies = s.units.some((u) => u.team === 'enemy' && alive(u));
  if (!heroes) s.over = 'lose';
  else if (!enemies) s.over = 'win';
  if (s.over) ev.push({ t: 'over', result: s.over });
}

/** Aplica daño ya calculado (antes de armadura). Devuelve la vida perdida. */
function hurt(s: CombatState, u: Unit, raw: number, ev: GameEvent[], source: string, opts: { pierce?: boolean; crit?: boolean } = {}): number {
  if (!alive(u)) return 0;
  let dmg = opts.pierce ? Math.round(raw) : Math.max(1, Math.round(raw) - u.armor);
  const absorbed = Math.min(u.shield, dmg);
  u.shield -= absorbed;
  dmg -= absorbed;
  u.hp = Math.max(0, u.hp - dmg);
  ev.push({ t: 'damage', unit: u.id, amount: dmg, absorbed, crit: !!opts.crit, source });
  if (!alive(u)) {
    ev.push({ t: 'death', unit: u.id });
    checkOver(s, ev);
  }
  return dmg;
}

function heal(u: Unit, amount: number, ev: GameEvent[]): void {
  if (!alive(u)) return;
  const real = Math.min(u.maxHp - u.hp, Math.round(amount));
  if (real > 0) {
    u.hp += real;
    ev.push({ t: 'heal', unit: u.id, amount: real });
  }
}

function addStatus(u: Unit, kind: StatusKind, turns: number, stacks: number, ev: GameEvent[]): void {
  if (!alive(u)) return;
  const cur = u.statuses[kind];
  const stackable = kind === 'poison';
  u.statuses[kind] = { turns: Math.max(turns, cur?.turns ?? 0), stacks: stackable ? (cur?.stacks ?? 0) + stacks : Math.max(stacks, cur?.stacks ?? 0) };
  ev.push({ t: 'status', unit: u.id, kind, turns });
}

function tick(u: Unit, kind: StatusKind): void {
  const st = u.statuses[kind];
  if (st && --st.turns <= 0) delete u.statuses[kind];
}

/** Pasa a la siguiente unidad viva y prepara su turno. Salta muertos y aturdidos. */
function beginNext(s: CombatState, ev: GameEvent[]): void {
  for (let guard = 0; guard < s.order.length * 4 && !s.over; guard++) {
    s.turn++;
    if (s.turn >= s.order.length) {
      s.turn = 0;
      s.round++;
    }
    const u = getUnit(s, s.order[s.turn]!)!;
    if (!alive(u)) continue;
    ev.push({ t: 'turn', unit: u.id, round: s.round });
    u.shield = 0;
    for (const sp of u.spells) if (sp.cd > 0) sp.cd--;
    if (u.statuses.burn) hurt(s, u, BURN_DMG, ev, 'burn', { pierce: true });
    if (alive(u) && u.statuses.poison) hurt(s, u, POISON_DMG * u.statuses.poison.stacks, ev, 'poison', { pierce: true });
    tick(u, 'burn');
    tick(u, 'poison');
    if (!alive(u) || s.over) continue;
    u.ap = Math.max(0, u.maxAp + u.apMod);
    u.mp = Math.max(0, u.maxMp + u.mpMod - (u.statuses.slow?.stacks ?? 0));
    u.apMod = 0;
    u.mpMod = 0;
    tick(u, 'slow');
    tick(u, 'mark');
    if (u.statuses.stun) {
      tick(u, 'stun');
      ev.push({ t: 'skip', unit: u.id, reason: 'stun' });
      continue;
    }
    return;
  }
}

function actor(s: CombatState, unitId: number): Unit | string {
  if (s.over) return 'El combate ha terminado';
  const u = current(s);
  if (!u || u.id !== unitId) return 'No es tu turno';
  return u;
}

export function move(s: CombatState, unitId: number, to: Pos): ActionResult {
  const u = actor(s, unitId);
  if (typeof u === 'string') return fail(u);
  const reach = reachable(s, u.pos, u.mp);
  const cost = reach.cost.get(key(to));
  if (!cost) return fail('Casilla fuera de alcance');
  const path = pathTo(reach, u.pos, to);
  u.pos = { ...to };
  u.mp -= cost;
  return { ok: true, events: [{ t: 'move', unit: u.id, path }] };
}

/** Motivo por el que `u` no puede lanzar el hechizo sobre `at`, o null si puede. */
export function castProblem(s: CombatState, u: Unit, def: SpellDef, at: Pos): string | null {
  const slot = u.spells.find((x) => x.id === def.id);
  if (!slot) return 'No conoces ese hechizo';
  if (slot.cd > 0) return 'Hechizo en enfriamiento';
  if (u.ap < def.ap) return 'No tienes PA suficientes';
  const d = dist(u.pos, at);
  if (d < def.range[0] || d > def.range[1]) return 'Fuera de alcance';
  if (def.los && d > 1 && !hasLineOfSight(s, u.pos, at)) return 'Sin línea de visión';
  const t = unitAt(s, at);
  if (def.target === 'self' && !same(at, u.pos)) return 'Solo sobre ti';
  if (def.target === 'enemy' && (!t || t.team === u.team)) return 'Necesitas un enemigo como objetivo';
  if (def.target === 'ally' && (!t || t.team !== u.team)) return 'Necesitas un aliado como objetivo';
  if (def.dash && !dashCell(s, u, at)) return 'No hay hueco junto al objetivo';
  return null;
}

function dashCell(s: CombatState, u: Unit, target: Pos): Pos | null {
  let best: Pos | null = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const p = { x: target.x + dx, y: target.y + dy };
    if (!same(p, u.pos) && !isFree(s, p)) continue;
    if (!best || dist(p, u.pos) < dist(best, u.pos)) best = p;
  }
  return best;
}

function push(s: CombatState, from: Pos, u: Unit, cells: number, ev: GameEvent[]): void {
  const dx = Math.abs(u.pos.x - from.x) >= Math.abs(u.pos.y - from.y) ? Math.sign(u.pos.x - from.x) : 0;
  const dy = dx === 0 ? Math.sign(u.pos.y - from.y) : 0;
  for (let i = 0; i < cells && alive(u); i++) {
    const n = { x: u.pos.x + dx, y: u.pos.y + dy };
    if (!isFree(s, n)) {
      hurt(s, u, PUSH_CRASH_DMG, ev, 'push', { pierce: true });
      return;
    }
    u.pos = n;
    ev.push({ t: 'push', unit: u.id, to: { ...n } });
  }
}

export function cast(s: CombatState, unitId: number, spellId: string, at: Pos): ActionResult {
  const u = actor(s, unitId);
  if (typeof u === 'string') return fail(u);
  const def = SPELLS[spellId];
  if (!def) return fail('Hechizo desconocido');
  const problem = castProblem(s, u, def, at);
  if (problem) return fail(problem);

  const ev: GameEvent[] = [{ t: 'cast', unit: u.id, spell: def.id, at: { ...at } }];
  u.ap -= def.ap;
  u.spells.find((x) => x.id === def.id)!.cd = def.cd > 0 ? def.cd + 1 : 0;
  if (def.dash) {
    const cell = dashCell(s, u, at)!;
    if (!same(cell, u.pos)) {
      u.pos = cell;
      ev.push({ t: 'move', unit: u.id, path: [{ ...cell }] });
    }
  }
  if (def.selfDmg) u.hp = Math.max(1, u.hp - def.selfDmg);

  const wantTeam = def.target === 'enemy' ? (u.team === 'hero' ? 'enemy' : 'hero') : u.team;
  const main = unitAt(s, at);
  const targets = s.units.filter((t) => alive(t) && t.team === wantTeam && (t === main || (def.area ? dist(t.pos, at) <= def.area : false)));
  let dealt = 0;
  for (const t of targets) {
    if (s.over) break;
    if (def.dmg) {
      const crit = rand(s) * 100 < u.crit;
      const raw = randInt(s, def.dmg[0], def.dmg[1]) * (1 + u.power / 100) * (crit ? CRIT_MULT : 1) * (t.statuses.mark ? MARK_MULT : 1) * (t === main ? 1 : 0.5);
      dealt += hurt(s, t, raw, ev, def.id, { crit });
    }
    if (def.heal) heal(t, def.heal, ev);
    if (def.shield && alive(t)) {
      t.shield += def.shield;
      ev.push({ t: 'shield', unit: t.id, amount: def.shield });
    }
    if (def.status) addStatus(t, def.status.kind, def.status.turns, def.status.stacks ?? 1, ev);
    if (def.drainAp) t.apMod -= def.drainAp;
    if (def.giveAp) t.apMod += def.giveAp;
    if (def.giveMp) t.mpMod += def.giveMp;
    if (def.push && t === main) push(s, u.pos, t, def.push, ev);
  }
  if (def.lifesteal && dealt > 0) heal(u, dealt * def.lifesteal, ev);
  return { ok: true, events: ev };
}

export function endTurn(s: CombatState, unitId: number): ActionResult {
  const u = actor(s, unitId);
  if (typeof u === 'string') return fail(u);
  const ev: GameEvent[] = [];
  beginNext(s, ev);
  return { ok: true, events: ev };
}
