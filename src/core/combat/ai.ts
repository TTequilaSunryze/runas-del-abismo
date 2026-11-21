// IA enemiga: apoyo a aliados, rasgos especiales (devorar, alzar muertos), acercarse y atacar.
// El jefe tiene dos fases, invoca refuerzos y pilares que lo curan.
import { SPELLS, type SpellDef } from '../classes/spells';
import type { CombatState, GameEvent, Pos, Unit } from '../state';
import { LATE_ROUND, apCost, applyStatus, cast, castProblem, current, endTurn, hasTrait, heal, move, spellOf, strike, summon, type UnitSpec } from './engine';
import { alive, dist, hasLineOfSight, isFree, reachable, same } from './grid';
import { addMark, coneCells, dirOf, marksOf, removeMark } from './marks';
import { bossKit, type BossKit, type OmenDef } from './bosskits';

/** Lo que la zona aporta a la IA: invocaciones del jefe y de los nigromantes. */
export interface BossInfo {
  minion: (pos: Pos) => UnitSpec;
  pillar?: (pos: Pos) => UnitSpec;
  phase2Name: string;
  /** cuántos pilares levanta el jefe al cambiar de fase */
  pillars?: number;
  /** máximo de invocados vivos a la vez */
  minionCap?: number;
  /** máximo de invocaciones del jefe en todo el combate (G3.0) */
  minionTotal?: number;
}

const RAISE_AP = 2;
/** G3.2: alzados vivos por nigromante. */
const RAISE_MAX = 2;
const DEVOUR_HEAL = 0.35;
/** G3.0: cada pilar cura un 3% de la vida del jefe por turno (antes 5%: con 3 pilares, un 15% por ronda). */
const PILLAR_HEAL = 0.03;
/** G3.0: el jefe invoca cada 3 rondas (antes cada 2). */
const SUMMON_EVERY = 3;

function attackAll(s: CombatState, u: Unit, def: SpellDef, ev: GameEvent[]): void {
  for (let i = 0; i < 6 && !s.over && alive(u); i++) {
    const target = s.units
      .filter((h) => h.team !== u.team && alive(h) && !castProblem(s, u, def, h.pos))
      .sort((a, b) => Number(hasTrait(b, 'taunt')) - Number(hasTrait(a, 'taunt')) || a.hp - b.hp)[0];
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
  // un señuelo cercano atrae a los enemigos
  const lure = foes.filter((h) => hasTrait(h, 'taunt') && dist(h.pos, u.pos) <= 5);
  if (lure.length) foes = lure;
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
      const canHit = flat >= def.range[0] && flat <= def.range[1] && (!def.straight || p.x === f.pos.x || p.y === f.pos.y) && (!def.los || flat <= 1 || hasLineOfSight(s, p, f.pos));
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
  if (living >= heroes + 2) return;
  // G3.2: cada nigromante mantiene como mucho 2 alzados; son suyos y caen con él
  if (s.units.filter((x) => alive(x) && x.summoner === u.id).length >= RAISE_MAX) return;
  const c = corpses(s).filter((x) => dist(x.pos, u.pos) <= 5 && isFree(s, x.pos)).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
  if (!c) return;
  c.used = true;
  u.ap -= RAISE_AP;
  const nu = summon(s, info.minion(c.pos), c.pos, ev);
  if (nu) { nu.summoner = u.id; ev.push({ t: 'raise', unit: u.id, corpse: c.id }); }
}

/** Héroes visibles (incluye sus invocaciones, no los señuelos). */
const heroTargets = (s: CombatState, u: Unit): Unit[] => s.units.filter((h) => h.team !== u.team && alive(h) && !h.statuses.invis && h.ai !== 'decoy');

const inBoard = (s: CombatState, p: Pos): boolean => p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h && !s.obstacles.includes(`${p.x},${p.y}`);
const crossAt = (p: Pos): Pos[] => [p, { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }];
const squareAt = (p: Pos): Pos[] => { const o: Pos[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) o.push({ x: p.x + dx, y: p.y + dy }); return o; };

/** A quién apunta un ataque anunciado. */
function omenTarget(s: CombatState, u: Unit, how: OmenDef['target'], foes: Unit[]): Unit | undefined {
  if (!foes.length) return undefined;
  const byHp = [...foes].sort((a, b) => a.hp - b.hp || a.id - b.id);
  if (how === 'frail') return byHp[0];
  if (how === 'marked') return foes.find((f) => f.statuses.mark) ?? [...foes].sort((a, b) => dist(b.pos, u.pos) - dist(a.pos, u.pos) || a.id - b.id)[0];
  if (how === 'far') return [...foes].sort((a, b) => dist(b.pos, u.pos) - dist(a.pos, u.pos) || a.id - b.id)[0];
  if (how === 'near') return [...foes].sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos) || a.id - b.id)[0];
  // cluster: el que tenga más compañeros pegados (desempate: el de menos vida)
  const near = (f: Unit): number => foes.filter((o) => dist(o.pos, f.pos) <= 1).length;
  return byHp.sort((a, b) => near(b) - near(a))[0];
}

/** Casillas que cubre el ataque anunciado. */
export function omenCells(s: CombatState, u: Unit, o: OmenDef): Pos[] {
  const foes = heroTargets(s, u);
  const t = omenTarget(s, u, o.target, foes);
  let cells: Pos[] = [];
  if (o.shape === 'ring') {
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const d = Math.abs(dx) + Math.abs(dy); if (d >= 1 && d <= 2) cells.push({ x: u.pos.x + dx, y: u.pos.y + dy }); }
  } else if (o.shape === 'heroes') {
    cells = foes.map((f) => ({ ...f.pos }));
  } else if (t && o.shape === 'cross') cells = crossAt(t.pos);
  else if (t && o.shape === 'square') cells = squareAt(t.pos);
  else if (t && o.shape === 'twin') {
    const other = foes.filter((f) => f !== t).sort((a, b) => dist(b.pos, t.pos) - dist(a.pos, t.pos) || a.id - b.id)[0];
    cells = [...crossAt(t.pos), ...(other ? crossAt(other.pos) : [])];
  } else if (t && o.shape === 'line') {
    const [dx, dy] = dirOf(u.pos, t.pos);
    for (let i = 1; i <= (o.len ?? 6); i++) {
      const p = { x: u.pos.x + dx * i, y: u.pos.y + dy * i };
      if (!inBoard(s, p)) break;
      cells.push(p);
    }
  }
  const seen = new Set<string>();
  return cells.filter((p) => inBoard(s, p) && !seen.has(`${p.x},${p.y}`) && !!seen.add(`${p.x},${p.y}`));
}

/** Daño de un ataque anunciado: su golpe en área (2.º hechizo) por el multiplicador, más su daño plano. */
export function omenDamage(u: Unit, o: OmenDef): number {
  const d = SPELLS[u.spells[1]?.id ?? u.spells[0]!.id]?.dmg ?? [8, 8];
  return Math.round(((d[0] + d[1]) / 2) * o.mul + u.power);
}

/** Marca en el suelo el ataque anunciado: estallará al empezar el siguiente turno del jefe. */
function placeOmen(s: CombatState, u: Unit, o: OmenDef, ev: GameEvent[]): boolean {
  const cells = omenCells(s, u, o);
  if (!cells.length) return false;
  const dmg = omenDamage(u, o);
  for (const p of cells) addMark(s, { kind: 'omen', pos: p, team: u.team, turns: 2, owner: u.id, dmg, sub: o.effect ?? 'none' }, ev);
  ev.push({ t: 'note', text: `⚠ ${u.name} prepara ${o.name}. ${o.hint}` });
  return true;
}

/** Al empezar su turno, el jefe suelta lo que anunció: daña a los héroes que sigan en las casillas marcadas. */
function detonateOmens(s: CombatState, u: Unit, kit: BossKit, ev: GameEvent[]): void {
  const marks = marksOf(s, 'omen', u.id);
  if (!marks.length) return;
  const hit = new Set<number>();
  for (const m of marks) {
    if (m.sub === 'fire') { s.fire ??= {}; s.fire[`${m.pos.x},${m.pos.y}`] = Math.max(s.fire[`${m.pos.x},${m.pos.y}`] ?? 0, 2); }
    for (const h of s.units.filter((x) => alive(x) && x.team !== u.team && same(x.pos, m.pos) && !hit.has(x.id))) {
      hit.add(h.id);
      if (m.sub === 'strip' && h.shield > 0) { ev.push({ t: 'resist', unit: h.id, what: '¡Escudo devorado!' }); h.shield = 0; }
      strike(s, h, m.dmg ?? 8, ev, 'omen', { element: SPELLS[u.spells[1]?.id ?? '']?.element });
      if (!alive(h)) continue;
      if (m.sub === 'root') applyStatus(h, 'rooted', 1, 1, ev);
      if (m.sub === 'fire') applyStatus(h, 'burn', 2, 1, ev);
      if (m.sub === 'drainap') { h.apMod -= 1; ev.push({ t: 'drain', unit: h.id, ap: -1, mp: 0 }); }
    }
    removeMark(s, m, ev);
    if (s.over) return;
  }
  ev.push({ t: 'note', text: hit.size ? `${u.name} descarga su ataque: alcanza a ${hit.size}.` : `${u.name} descarga su ataque, pero nadie se ha quedado dentro.` });
  if (kit.after && alive(u)) { applyStatus(u, kit.after.kind, kit.after.turns, kit.after.stacks, ev); ev.push({ t: 'note', text: `${u.name} ${kit.after.text}.` }); }
}

/** Una invocación del jefe, ya adaptada a su papel (esbirro, guardián o manifestación). */
function bossMinion(s: CombatState, u: Unit, info: BossInfo, kit: BossKit | undefined, ev: GameEvent[]): Unit | null {
  let at = u.pos;
  if (kit?.minion.fromCorpse) {
    const c = corpses(s).filter((x) => dist(x.pos, u.pos) <= 6 && isFree(s, x.pos)).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos) || a.id - b.id)[0];
    if (c) { c.used = true; at = c.pos; }
  }
  const spec = info.minion(at);
  if (kit) {
    const hp = Math.max(4, Math.round(spec.maxHp * kit.minion.hp));
    spec.hp = spec.maxHp = hp;
    const traits = (spec.traits ?? []).filter((x) => !kit.minion.drop?.includes(x));
    for (const x of kit.minion.add ?? []) if (!traits.includes(x)) traits.push(x);
    spec.traits = traits;
  }
  const m = summon(s, spec, at, ev);
  if (!m) return null;
  m.summoner = u.id;
  if (kit?.minion.fade) m.statuses.fading = { turns: kit.minion.fade + 1, stacks: 0 };
  return m;
}

function bossTurn(s: CombatState, u: Unit, info: BossInfo | undefined, ev: GameEvent[]): void {
  const kit = bossKit(u.kind);
  const heroes = s.units.filter((h) => h.team === 'hero').length;
  if (u.phase === undefined) {
    u.phase = 1;
    if (kit?.dropStart) u.traits = (u.traits ?? []).filter((x) => !kit.dropStart!.includes(x));
  }
  // G3.1: primero suelta el ataque que anunció el turno anterior
  if (kit) detonateOmens(s, u, kit, ev);
  if (s.over || !alive(u)) return;
  // G3.2: invocaciones del jefe marcadas como suyas (mueren con él), con tope a la vez y en total por combate
  const mine = (): Unit[] => s.units.filter((m) => m.summoner === u.id && m.ai !== 'pillar');
  const minions = s.units.filter((m) => m.team === 'enemy' && alive(m) && m.id !== u.id && m.ai !== 'pillar').length;
  const cap = kit?.minion.cap ?? info?.minionCap ?? heroes;
  const room = (): number => (info?.minionTotal ?? Infinity) - mine().length;
  const call = (k: number): void => { for (let i = 0; i < k && room() > 0 && info; i++) bossMinion(s, u, info, kit, ev); };
  // el Eco se cura mientras vivan sus ecos (en lugar de regenerarse siempre)
  if (kit?.healPerMinion && s.round < LATE_ROUND) { const n = mine().filter(alive).length; if (n) heal(u, u.maxHp * kit.healPerMinion * n, ev); }
  let summoned = false;
  if ((u.phase ?? 1) === 1 && u.hp <= u.maxHp / 2) {
    // Segunda fase: más duro, más rápido, cuerpo a cuerpo y, según el jefe, pilares que lo curan.
    u.phase = 2;
    u.armor += 2;
    u.maxMp = 3;
    u.mp = 3;
    u.name = info?.phase2Name ?? u.name;
    ev.push({ t: 'phase', unit: u.id, phase: 2 });
    if (kit?.phase2) {
      u.traits = (u.traits ?? []).filter((x) => !kit.phase2!.drop?.includes(x));
      for (const x of kit.phase2.add ?? []) if (!u.traits.includes(x)) u.traits.push(x);
      ev.push({ t: 'note', text: kit.phase2.text });
    }
    if (info) call(kit?.minion.burst ?? Math.max(1, Math.ceil(heroes / 2)));
    const pillars = kit?.pillars ?? info?.pillars ?? 2;
    if (info?.pillar && pillars > 0) {
      // pilares lejos del jefe, para obligar al grupo a repartirse
      const spots = [...reachable(s, u.pos, 30, true).cost.keys()]
        .map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y }; })
        .filter((p) => isFree(s, p) && dist(p, u.pos) >= 3)
        .sort((a, b) => dist(b, u.pos) - dist(a, u.pos));
      for (let i = 0; i < pillars; i++) {
        const at = spots[(i * 5) % Math.max(1, spots.length)];
        if (at && isFree(s, at)) summon(s, info.pillar(at), at, ev);
      }
    }
    summoned = true;
  }
  const phase2 = u.phase === 2;
  const omen = kit ? (phase2 ? kit.omen2 ?? kit.omen : kit.omen) : undefined;
  // G3.1: el ataque anunciado toca en rondas fijas (nunca dos seguidos) y gasta 3 PA; si toca, ese turno no invoca
  const omenNow = !!omen && !summoned && s.round % omen.every === omen.at && !marksOf(s, 'omen', u.id).length && u.ap >= 3;
  const summonNow = !!info && !summoned && !omenNow && room() > 0 && mine().filter(alive).length < cap && minions < heroes + 1
    && (kit ? kit.minion.phases.includes(u.phase ?? 1) && s.round % kit.minion.every === kit.minion.at : !phase2 && s.round % SUMMON_EVERY === 0);
  if (summonNow) {
    const m = bossMinion(s, u, info!, kit, ev);
    if (m && kit) ev.push({ t: 'note', text: `${u.name} ${kit.minion.text}.` });
    u.ap = Math.max(0, u.ap - 3);
  }
  if (hasTrait(u, 'trapper')) trapper(s, u, ev);
  if (hasTrait(u, 'blink')) blink(s, u, ev);
  if (omenNow) u.ap -= 3;
  // primer hechizo: a distancia (fase 1); segundo: cuerpo a cuerpo en área (fase 2)
  if (alive(u) && current(s)?.id === u.id) fight(s, u, SPELLS[u.spells[phase2 ? 1 : 0]!.id]!, !phase2, ev);
  if (omenNow && alive(u) && !s.over && current(s)?.id === u.id) placeOmen(s, u, omen!, ev);
}

/** Los pilares no se mueven: curan al jefe en cada uno de sus turnos. */
function pillarTurn(s: CombatState, ev: GameEvent[]): void {
  const boss = s.units.find((b) => b.ai === 'boss' && alive(b));
  if (boss && s.round < LATE_ROUND) heal(boss, boss.maxHp * PILLAR_HEAL, ev);
}

/** Lanza lo mejor que tenga a mano: primero ayuda a un aliado malherido, luego el hechizo que más daño haga. */
function champCast(s: CombatState, u: Unit, ev: GameEvent[]): boolean {
  const defs = u.spells.filter((sp) => sp.cd === 0).map((sp) => spellOf(u, sp.id)!).filter((d) => d && apCost(u, d.id, s) <= u.ap);
  const allies = s.units.filter((a) => a.team === u.team && alive(a));
  const foes = s.units.filter((f) => f.team !== u.team && alive(f) && !f.statuses.invis);
  let best: { d: SpellDef; at: Pos; score: number } | null = null;
  const consider = (d: SpellDef, at: Pos, score: number): void => {
    if (score > 0 && (!best || score > best.score) && !castProblem(s, u, SPELLS[d.id]!, at)) best = { d, at, score };
  };
  for (const d of defs) {
    const around = d.range[1] === 0;
    const near = (list: Unit[], at: Pos): Unit[] => list.filter((x) => dist(x.pos, at) <= (d.area ?? 0));
    const spheres = marksOf(s, 'sphere', u.id);
    const avgD = d.dmg ? (d.dmg[0] + d.dmg[1]) / 2 : 0;
    const adj = (p: Pos, r = 1): Unit[] => foes.filter((f) => Math.max(Math.abs(f.pos.x - p.x), Math.abs(f.pos.y - p.y)) <= r);
    const sp = d.special;
    if (sp === 'fatuo') { if (foes.some((f) => dist(f.pos, u.pos) <= 3)) consider(d, u.pos, 3 * avgD); continue; }
    if (sp === 'decoy') { if (u.hp < u.maxHp * 0.5 && adj(u.pos).length) consider(d, u.pos, 16); continue; }
    if (sp === 'orbit') { if (u.hp < u.maxHp * 0.7 && u.shield === 0) consider(d, u.pos, 8); continue; }
    if (sp === 'transfuse') { if (spheres.length >= 2 && u.ap <= 3) consider(d, u.pos, 9); continue; }
    if (sp === 'reap' || sp === 'absorb') { consider(d, u.pos, sp === 'reap' ? 15 : 4 * marksOf(s, 'soul').length); continue; }
    if (sp === 'thirst') { const f = u.fury ?? 0; if (u.hp < u.maxHp * 0.55 && f >= 40) consider(d, u.pos, 4 + f * 0.22); continue; }
    if (sp === 'pact') { if ((u.fury ?? 0) <= 40 && u.hp > u.maxHp * 0.6) consider(d, u.pos, 7); continue; }
    if (sp === 'roar') { const n = adj(u.pos).length; if (n) consider(d, u.pos, n * 7); continue; }
    if (sp === 'veil') { if (u.hp < u.maxHp * 0.4) consider(d, u.pos, 12); continue; }
    if (sp === 'guardian') { for (const a of allies.filter((x) => x !== u && x.summoner === undefined && x.hp < x.maxHp * 0.5)) consider(d, a.pos, 10); continue; }
    if (sp === 'cage') { for (const f of foes) consider(d, f.pos, 6 + adj(f.pos).length * 2); continue; }
    if (sp === 'gravity') { for (const m of spheres) consider(d, m.pos, foes.filter((f) => dist(f.pos, m.pos) <= 2).length * (avgD + 3)); continue; }
    if (sp === 'singularity' || sp === 'throwsphere') {
      for (const f of foes) consider(d, f.pos, avgD + adj(f.pos).filter((x) => x !== f).length * avgD * 0.6 + (sp === 'singularity' ? 4 : 0));
      continue;
    }
    if (sp === 'charge') {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) for (let i = 1; i <= d.range[1]; i++) {
        const at = { x: u.pos.x + dx * i, y: u.pos.y + dy * i };
        const n = foes.filter((f) => dist(f.pos, at) === 1).length;
        if (n) consider(d, at, n * avgD + 6);
      }
      continue;
    }
    if (d.detonate && d.keepSpheres) { consider(d, u.pos, spheres.reduce((a, m) => a + foes.filter((f) => dist(f.pos, m.pos) <= 1).length, 0) * avgD); continue; }
    if (d.target === 'self' && d.buff?.kind === 'frenzy') { if (adj(u.pos).length) consider(d, u.pos, 9); continue; }
    if (d.status?.kind === 'verdugo') { for (const f of foes) consider(d, f.pos, f.hp > 20 ? 6 : 0); continue; }
    if (d.shadow) {
      // la Sombra junto a un enemigo (para que replique el tajo), si aún no hay
      if (!marksOf(s, 'shadow', u.id).length) for (const f of foes) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) consider(d, { x: f.pos.x + dx, y: f.pos.y + dy }, 14);
    } else if (d.swapShadow) {
      // malherido: cámbiate por la Sombra si está más lejos de los enemigos
      const sh = marksOf(s, 'shadow', u.id)[0];
      const near = (p: { x: number; y: number }): number => Math.min(99, ...foes.map((f) => dist(f.pos, p)));
      if (sh && u.hp < u.maxHp * 0.4 && near(sh.pos) > near(u.pos) + 1) consider(d, u.pos, 18);
    } else if (d.lanternJump) {
      // malherido junto a una linterna: escapa al lado del Carcelero
      if (u.hp < u.maxHp * 0.4) consider(d, u.pos, 20);
    } else if (d.lantern) {
      // linterna junto a un aliado malherido
      for (const a of allies.filter((x) => x !== u && x.summoner === undefined && x.hp < x.maxHp * 0.5))
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) consider(d, { x: a.pos.x + dx, y: a.pos.y + dy }, 12);
    } else if (d.cone) {
      // onda en cono: cuenta enemigos dentro y esferas que pueden chocar
      const avg = d.dmg ? (d.dmg[0] + d.dmg[1]) / 2 : 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const at = { x: u.pos.x + dx, y: u.pos.y + dy }, cone = coneCells(u.pos, at, d.cone);
        const hit = foes.filter((f) => cone.some((p) => same(p, f.pos))).length;
        const orbs = spheres.filter((m) => cone.some((p) => same(p, m.pos))).length;
        consider(d, at, hit * avg + (hit && orbs ? 12 : 0));
      }
    } else if (d.detonate) {
      consider(d, u.pos, spheres.reduce((a, m) => a + foes.filter((f) => dist(f.pos, m.pos) <= d.detonate!.area).length, 0) * 7);
    } else if (d.target === 'ground') {
      // esferas: sobre un enemigo (o, si no hace daño, junto a uno)
      const avg = d.dmg ? (d.dmg[0] + d.dmg[1]) / 2 : 3;
      for (const f of foes) consider(d, f.pos, avg + (spheres.length < (d.sphere?.max ?? 0) ? 3 : 0));
    } else if (d.target === 'cell') {
      if (d.summon) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) consider(d, { x: u.pos.x + dx, y: u.pos.y + dy }, 30);
      else if (d.followUp && d.teleport) {
        // Impulso: salta en línea recta a una casilla desde la que el proyectil alcance a alguien
        const fu = d.followUp, avg = (fu.dmg[0] + fu.dmg[1]) / 2;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) for (let i = d.range[0]; i <= d.range[1]; i++) {
          const at = { x: u.pos.x + dx * i, y: u.pos.y + dy * i };
          const prey = foes.filter((f) => dist(f.pos, at) <= fu.radius).sort((a, b) => dist(a.pos, at) - dist(b.pos, at))[0];
          // mejor aterrizar lejos de los enemigos: la Zorra es frágil
          if (prey) consider(d, at, avg + (avg >= prey.hp ? 12 : 0) - foes.filter((f) => dist(f.pos, at) <= 1).length * 5 - (u.hp < u.maxHp * 0.5 ? foes.filter((f) => dist(f.pos, at) <= 2).length * 3 : 0));
        }
      }
    } else if (d.target === 'enemy') {
      // Descarga: vale más cuantas más esferas tengas (si tienes pocas, mejor esperar)
      const avg = (d.dmg ? (d.dmg[0] + d.dmg[1]) / 2 : 0) + (d.consume ? d.consume.per * spheres.length - (spheres.length < 2 ? 6 : 0) : 0);
      const value = (f: Unit): number => avg * (f.statuses.mark ? 1.3 : 1) + (d.status && !f.statuses[d.status.kind] ? (d.status.kind === 'stun' ? 14 : 6) : 0) + (d.extraStatus && !f.statuses[d.extraStatus.kind] ? 4 : 0) + (d.drainAp ?? 0) * 3 + (avg >= f.hp ? 10 : 0);
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
  // sala de pruebas: el muñeco recupera toda su vida en su turno (daño infinito en la práctica)
  if (hasTrait(u, 'dummy')) u.hp = u.maxHp;
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
