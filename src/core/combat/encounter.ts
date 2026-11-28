/**
 * Q1 · Mecánicas de encuentro de los jefes: objetivos estructurales, protección, presión acumulativa y oleadas.
 *
 * No es un sistema aparte: reutiliza lo que ya había.
 * - Los objetivos (sellos, raíces, braseros, válvulas…) son enemigos con ai 'pillar' y `Unit.objective`: tienen vida,
 *   se golpean, salen en el tablero y no cuentan para ganar (como los pilares de la fase 2).
 * - Las oleadas del desgaste son las `waves` de las salas creadas, con aviso previo (`EncounterWave.warn`).
 * - La presión vive en `CombatState.encounter` (JSON plano).
 *
 * Este módulo solo depende de datos y de la rejilla: el motor y la IA le pasan sus primitivas (`EncounterCtx`),
 * igual que runefx.ts, para no crear dependencias circulares. Sin `s.encounter` (pruebas, laboratorio de unidades)
 * nada de esto se activa salvo la protección por objetivos presentes en el tablero.
 */
import { SPELLS } from '../classes/spells';
import { randInt } from '../rng';
import { key, type CombatState, type Element, type GameEvent, type ObjectiveMech, type Pos, type StatusKind, type Unit } from '../state';
import { bossKit, WARD_CAP, type OmenDef } from './bosskits';
import { alive, dist, isFree, reachable } from './grid';
import { addMark, marksOf, removeMark } from './marks';
import type { UnitSpec } from './engine';

/** Primitivas del motor que necesitan las mecánicas (las pasan engine.ts y ai.ts). */
export interface EncounterCtx {
  hurt: (s: CombatState, u: Unit, raw: number, ev: GameEvent[], source: string, opts?: { pierce?: boolean; element?: Element }) => number;
  addStatus: (u: Unit, kind: StatusKind, turns: number, stacks: number, ev: GameEvent[]) => void;
  heal: (u: Unit, amount: number, ev: GameEvent[]) => number;
  summon: (s: CombatState, spec: UnitSpec, near: Pos, ev: GameEvent[]) => Unit | null;
}

/** Fábrica de objetivos que aporta la zona (game/run.ts → bossInfo). */
export type ObjectiveFactory = (kind: string, pos: Pos) => UnitSpec;

// --- números de diseño -----------------------------------------------------------------------------------------

/** Daño de mecánicas que no se reduce por la protección del jefe (castigos de sus propias mecánicas). */
const WARD_BYPASS: ReadonlySet<string> = new Set(['eco', 'vapor', 'alma', 'abismo']);
/** Raíz principal / alma caída: curación del jefe por turno del objetivo. */
const ROOT_HEAL = 0.02;
const SOUL_HEAL = 0.03;
/** Plañidera: ecos que deja por turno (fase 1 / fase 2), tope en el tablero, rondas que duran y potencia por eco. */
const WAIL_PER_TURN = [1, 2] as const;
const WAIL_CAP = [4, 6] as const;
const WAIL_FADE = 4;
const WAIL_BOOST = 0.25;
/** Rey: presión máxima de la pira y daño plano por punto (×0.75). */
const PYRE_CAP = 8;
/** Fundidora: presión con la que suelta la colada (fase 1 / fase 2) y lo que baja una válvula abierta. */
const CRUCIBLE_AT = [5, 4] as const;
const VALVE_VENT = 3;
const VALVE_SCALD = 0.08;
const VALVE_RANGE = 3;
/** Devorador: runas absorbidas para saciarse, potencia saciado y fragmentos en el tablero. */
const SHARD_SATED = 3;
const SATED_OMEN = 1.4;
const SATED_POWER = 3;
const SHARD_CAP = [3, 3, 3, 4] as const;
/** Coro: potencia del coro por alma y eco de las almas en la fase 2 (fracción del último golpe, tope por vida). */
const SOUL_BOOST = 0.15;
const SOUL_REPEAT = 0.35;
const SOUL_REPEAT_CAP = 0.15;
const SOUL_BACKLASH = 0.04;
/** Ataques anunciados en un encuentro: además de su daño, una parte de la vida máxima de quien se queda dentro. */
export const OMEN_HP_PCT = 0.1;
/** Tope de un ataque anunciado sobre un héroe (fracción de su vida máxima); si se ignoraron mecánicas, el segundo. */
export const OMEN_CAP = [0.55, 0.75] as const;

/** La colada masiva de la Fundidora: un anillo grande que se anuncia y se puede cortar con una válvula. */
export const COLADA: OmenDef = { name: 'Colada masiva', shape: 'ring', radius: 3, target: 'near', every: 1, at: 0, mul: 1.4, effect: 'fire', hint: 'Alejaos a 4 casillas o abrid una válvula para cortarla.' };

/** Qué hace cada tipo de objetivo, en una línea (ficha del tablero). */
export const OBJECTIVE_TEXT: Record<ObjectiveMech, string> = {
  seal: 'protege al Prior (−15% de daño); romperlo lo expone y lo debilita',
  wail: 'potencia el próximo lamento un 25%; en la 2.ª fase persigue y gime',
  root: 'protege y regenera a la Madre Raíz; cortarla la expone y la debilita',
  post: 'escondite del Cazador; sin puestos no puede emboscaros',
  pyre: 'aviva la Pira Real y prende el suelo; apagarlo frena el incendio',
  valve: 'ábrela (rómpela) para bajar la presión, cortar la colada y escaldar a la Fundidora cerca',
  shard: 'si el Devorador lo come, crece; rómpelo y recuperas su energía (+25% de daño)',
  soul: 'protege, regenera y potencia al Coro; liberarla lo desgarra',
};

// --- consultas ---------------------------------------------------------------------------------------------------

export const encounterBoss = (s: CombatState): Unit | undefined => s.units.find((u) => u.ai === 'boss' && u.team === 'enemy' && alive(u));
export const objectivesOf = (s: CombatState, mech?: ObjectiveMech): Unit[] => s.units.filter((u) => alive(u) && !!u.objective && (!mech || u.objective.mech === mech));
const heroesOf = (s: CombatState): Unit[] => s.units.filter((u) => u.team === 'hero' && alive(u) && u.summoner === undefined && !u.statuses.invis);
const nearestHero = (s: CombatState, p: Pos): Unit | undefined => heroesOf(s).sort((a, b) => dist(a.pos, p) - dist(b.pos, p) || a.id - b.id)[0];
const kitOf = (s: CombatState) => (s.encounter ? bossKit(s.encounter.boss) : undefined);
const phaseOf = (s: CombatState): number => encounterBoss(s)?.phase ?? 1;
const freeCellsNear = (s: CombatState, p: Pos, r: number): Pos[] => {
  const out: Pos[] = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const q = { x: p.x + dx, y: p.y + dy };
    if ((dx || dy) && Math.abs(dx) + Math.abs(dy) <= r && isFree(s, q)) out.push(q);
  }
  return out;
};
const pickCell = (s: CombatState, cells: Pos[]): Pos | undefined => (cells.length ? cells[randInt(s, 0, cells.length - 1)] : undefined);

/** Fracción de daño que le quitan al jefe sus objetivos en pie (0 si no es un jefe o no hay ninguno). */
export function wardOf(s: CombatState, u: Unit): number {
  if (u.ai !== 'boss') return 0;
  const w = s.units.reduce((a, o) => a + (o !== u && alive(o) && o.team === u.team && o.objective?.ward ? o.objective.ward : 0), 0);
  return Math.min(WARD_CAP, w);
}
/** ¿Se reduce este daño por la protección? (los castigos de sus propias mecánicas no). */
export const wardApplies = (source: string): boolean => !WARD_BYPASS.has(source);

/** Daño plano extra del jefe por la presión que se ha dejado crecer. */
export function encounterPower(s: CombatState, u: Unit): number {
  const e = s.encounter;
  if (!e || u.ai !== 'boss') return 0;
  if (u.kind === 'rey') return Math.floor(e.pressure * 0.75);
  if (u.kind === 'devorarunas' && e.pressure >= SHARD_SATED) return SATED_POWER;
  return 0;
}

/** Multiplicador del próximo ataque anunciado por las mecánicas ignoradas (se calcula al estallar). */
export function omenBoost(s: CombatState, u: Unit): number {
  const e = s.encounter;
  if (!e || u.ai !== 'boss') return 1;
  if (u.kind === 'planidera') return 1 + WAIL_BOOST * objectivesOf(s, 'wail').length;
  if (u.kind === 'eco') return 1 + SOUL_BOOST * objectivesOf(s, 'soul').length;
  if (u.kind === 'devorarunas' && e.pressure >= SHARD_SATED) return SATED_OMEN;
  if (u.kind === 'rey') return 1 + 0.05 * e.pressure;
  return 1;
}

/** Daño de un ataque anunciado sobre un héroe: base × potencia + parte de su vida, con tope (nunca de un golpe sin aviso). */
export function omenHit(s: CombatState, boss: Unit, base: number, target: Unit): number {
  if (!s.encounter) return base;
  const boost = omenBoost(s, boss);
  const raw = base * boost + OMEN_HP_PCT * target.maxHp;
  return Math.round(Math.min(raw, target.maxHp * OMEN_CAP[boost > 1 ? 1 : 0]));
}

/** Tras estallar el ataque anunciado: la Plañidera consume sus ecos. */
export function afterOmen(s: CombatState, boss: Unit, ev: GameEvent[]): void {
  if (!s.encounter || boss.kind !== 'planidera') return;
  const echoes = objectivesOf(s, 'wail');
  if (!echoes.length) return;
  for (const e of echoes) vanish(s, e, ev);
  ev.push({ t: 'note', text: `El lamento se traga ${echoes.length} eco${echoes.length > 1 ? 's' : ''}.` });
}

/** Quita una unidad del tablero sin que cuente como derribada (absorbida, consumida). */
function vanish(s: CombatState, u: Unit, ev: GameEvent[]): void {
  u.hp = 0; u.shield = 0; u.used = true;
  ev.push({ t: 'death', unit: u.id });
  for (const m of [...(s.marks ?? [])]) if (m.owner === u.id) removeMark(s, m, ev);
}

// --- objetivos ---------------------------------------------------------------------------------------------------

/** Crea un objetivo estructural ligado al jefe (o, si aún no ha llegado, sin dueño). */
function spawnObjective(s: CombatState, make: ObjectiveFactory | undefined, kind: string, at: Pos, ctx: EncounterCtx, ev: GameEvent[]): Unit | null {
  const def = kitOf(s)?.encounter.objectives?.find((o) => o.kind === kind);
  if (!make) return null;
  const spec = make(kind, at);
  spec.objective = { mech: def?.mech ?? 'wail', role: def?.role ?? 'optional', ...(def?.ward ? { ward: def.ward } : {}) };
  const u = ctx.summon(s, spec, at, ev);
  return u;
}

/** ¿Deja Expuesto al jefe cuando cae? (los ecos y los fragmentos dan otras ventajas) */
export const objectiveExposes = (u: Unit): boolean => !u.objective || (u.objective.mech !== 'wail' && u.objective.mech !== 'shard');

/** Un objetivo estructural ha caído: su efecto sobre el jefe y el encuentro. `killer`: quien lo derribó. */
export function onObjectiveDown(s: CombatState, u: Unit, killer: Unit | undefined, ctx: EncounterCtx, ev: GameEvent[]): void {
  const o = u.objective;
  if (!o) return;
  const e = s.encounter;
  const boss = encounterBoss(s);
  const kit = boss ? bossKit(boss.kind) : kitOf(s);
  if (e) e.broken++;
  const lose = kit?.encounter.breakPower ?? 0;
  if (boss && lose && (o.role === 'required' || o.mech === 'pyre' || o.mech === 'soul' || o.mech === 'post')) boss.power -= lose;
  const left = (mech: ObjectiveMech): number => objectivesOf(s, mech).length;
  switch (o.mech) {
    case 'seal':
    case 'root': {
      const ward = boss ? Math.round(wardOf(s, boss) * 100) : 0;
      ev.push({ t: 'note', text: `${u.name} cae (quedan ${left(o.mech)}): ${boss ? `${boss.name} se debilita · protección ${ward}%` : 'la protección se resquebraja'}.` });
      break;
    }
    case 'soul':
      if (boss) { ev.push({ t: 'note', text: `El alma se libera y desgarra a ${boss.name}.` }); ctx.hurt(s, boss, boss.maxHp * SOUL_BACKLASH, ev, 'alma', { pierce: true }); }
      break;
    case 'pyre':
      if (e) e.pressure = Math.max(0, e.pressure - 2);
      for (const p of [u.pos, ...freeCellsNear(s, u.pos, 1)]) if (s.fire?.[key(p)]) delete s.fire[key(p)];
      ev.push({ t: 'note', text: `El brasero se apaga: la Pira Real pierde fuerza (avivado ${e?.pressure ?? 0}).` });
      break;
    case 'valve': {
      if (e) e.pressure = Math.max(0, e.pressure - VALVE_VENT);
      const colada = (s.marks ?? []).filter((m) => m.kind === 'omen' && m.sub === 'colada');
      for (const m of colada) removeMark(s, m, ev);
      ev.push({ t: 'note', text: `¡La válvula revienta y el crisol se desahoga!${colada.length ? ' La colada se corta.' : ''}` });
      if (boss && dist(boss.pos, u.pos) <= VALVE_RANGE) {
        ev.push({ t: 'note', text: `El vapor escalda a ${boss.name}.` });
        ctx.hurt(s, boss, boss.maxHp * VALVE_SCALD, ev, 'vapor', { pierce: true, element: 'fire' });
        if (alive(boss)) ctx.addStatus(boss, 'exposed', 2, 2, ev);
      }
      break;
    }
    case 'shard': {
      const h = killer?.team === 'hero' && alive(killer) ? killer : nearestHero(s, u.pos);
      if (h) { ctx.addStatus(h, 'empower', 2, 25, ev); ev.push({ t: 'note', text: `${h.name} recupera la energía del fragmento: +25% de daño 2 turnos.` }); }
      break;
    }
    case 'post':
      for (const m of marksOf(s, 'hunt')) if (dist(m.pos, u.pos) <= 1) removeMark(s, m, ev);
      ev.push({ t: 'note', text: `Puesto de caza destruido: el Cazador pierde un escondite (quedan ${left('post')}).` });
      break;
    case 'wail':
      ev.push({ t: 'note', text: 'Un eco del lamento se apaga.' });
      break;
  }
}

/** Turno de un objetivo estructural (en lugar del turno de pilar). `late`: ronda 20 o más (sin curas automáticas). */
export function objectiveTurn(s: CombatState, u: Unit, ctx: EncounterCtx, late: boolean, ev: GameEvent[]): void {
  const o = u.objective!;
  const boss = encounterBoss(s);
  const e = s.encounter;
  if (o.mech === 'root' && boss && !late) ctx.heal(boss, boss.maxHp * ROOT_HEAL, ev);
  if (o.mech === 'soul' && boss && !late) ctx.heal(boss, boss.maxHp * SOUL_HEAL, ev);
  if (o.mech === 'soul' && boss && (boss.phase ?? 1) >= 2 && e?.lastHit) soulRepeat(s, u, ctx, ev);
  if (o.mech === 'pyre' && e) {
    // una vez por ronda se aviva la pira (con un brasero en pie basta); cada brasero prende el suelo junto a un héroe
    if (e.pyreRound !== s.round && e.pressure < PYRE_CAP) { e.pyreRound = s.round; e.pressure++; }
    const h = nearestHero(s, u.pos);
    const at = h && pickCell(s, freeCellsNear(s, h.pos, 1));
    if (at) { s.fire ??= {}; s.fire[key(at)] = Math.max(s.fire[key(at)] ?? 0, 2); ev.push({ t: 'markAdd', kind: 'pulse', at: { ...at } }); }
  }
  if (o.mech === 'wail' && phaseOf(s) >= 2) {
    // fase 2: los ecos persiguen al héroe más cercano y gimen si lo alcanzan
    const h = nearestHero(s, u.pos);
    if (h && dist(h.pos, u.pos) > 1) {
      const step = reachable(s, u.pos, 1).cost;
      const to = [...step.keys()].map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y }; })
        .filter((p) => isFree(s, p)).sort((a, b) => dist(a, h.pos) - dist(b, h.pos))[0];
      if (to && dist(to, h.pos) < dist(u.pos, h.pos)) { const from = { ...u.pos }; u.pos = to; ev.push({ t: 'move', unit: u.id, path: [from, { ...to }] }); }
    }
    if (h && dist(h.pos, u.pos) <= 1) ctx.hurt(s, h, 5 + Math.max(0, boss?.power ?? 0), ev, 'lamento', { element: 'shadow' });
  }
}

/** Fase 2 del Coro: el alma repite contra el héroe el último golpe que dio (una fracción, con tope). */
function soulRepeat(s: CombatState, u: Unit, ctx: EncounterCtx, ev: GameEvent[]): void {
  const hits = s.encounter!.lastHit!;
  const prey = heroesOf(s).filter((h) => (hits[h.id] ?? 0) > 0 && dist(h.pos, u.pos) <= 6).sort((a, b) => (hits[b.id] ?? 0) - (hits[a.id] ?? 0) || a.id - b.id)[0];
  if (!prey) return;
  const dmg = Math.min(prey.maxHp * SOUL_REPEAT_CAP, (hits[prey.id] ?? 0) * SOUL_REPEAT);
  delete hits[prey.id];
  ev.push({ t: 'note', text: `${u.name} repite el golpe de ${prey.name} contra él.` });
  ctx.hurt(s, prey, dmg, ev, 'alma', { element: 'shadow' });
}

// --- el turno del jefe -------------------------------------------------------------------------------------------

/**
 * Mecánicas propias del jefe en su turno (después de soltar su ataque anunciado y de cambiar de fase).
 * Devuelve un ataque anunciado que sustituye al de su calendario (la colada de la Fundidora), si toca.
 */
export function bossEncounterTurn(s: CombatState, u: Unit, make: ObjectiveFactory | undefined, ctx: EncounterCtx, ev: GameEvent[]): { omen?: OmenDef } {
  const e = s.encounter;
  if (!e || e.boss !== u.kind) return {};
  const p2 = (u.phase ?? 1) >= 2;
  if (p2 && e.p2Round === undefined) e.p2Round = s.round;
  const heroes = heroesOf(s);
  switch (u.kind) {
    case 'prior': if (p2 && s.round % 2 === 0) collapse(s, u, heroes, ev); break;
    case 'planidera': {
      // deja ecos en las casillas a las que el grupo querrá moverse
      const cap = WAIL_CAP[p2 ? 1 : 0];
      for (let i = 0; i < WAIL_PER_TURN[p2 ? 1 : 0] && objectivesOf(s, 'wail').length < cap; i++) {
        const h = heroes[(s.round + i) % Math.max(1, heroes.length)];
        const at = h && pickCell(s, freeCellsNear(s, h.pos, 2).filter((p) => dist(p, h.pos) === 2));
        const echo = at ? spawnObjective(s, make, 'eco_lamento', at, ctx, ev) : null;
        if (echo) { echo.summoner = u.id; echo.statuses.fading = { turns: WAIL_FADE + 1, stacks: 0 }; }
      }
      const n = objectivesOf(s, 'wail').length;
      if (n) ev.push({ t: 'note', text: `${n} eco${n > 1 ? 's' : ''} del lamento resuena${n > 1 ? 'n' : ''}: cada uno hará su próximo lamento un ${Math.round(WAIL_BOOST * 100)}% más fuerte.` });
      break;
    }
    case 'madre': if (p2) invadeRoots(s, heroes, ev); break;
    case 'cazador': hunter(s, u, heroes, p2, ctx, ev); break;
    case 'rey': if (p2) spreadFire(s, heroes, 2 + Math.min(6, s.round - (e.p2Round ?? s.round)), ev); break;
    case 'fundidora': {
      e.pressure += 1;
      if (p2) spreadFire(s, [u, ...heroes.slice(0, 1)], 2, ev, 3);
      const pending = (s.marks ?? []).some((m) => m.kind === 'omen' && m.owner === u.id);
      if (e.pressure >= CRUCIBLE_AT[p2 ? 1 : 0] && !pending) { e.pressure = 0; return { omen: COLADA }; }
      ev.push({ t: 'note', text: `Presión del crisol: ${e.pressure}/${CRUCIBLE_AT[p2 ? 1 : 0]}.` });
      break;
    }
    case 'devorarunas': devourer(s, u, make, heroes, p2, ctx, ev); break;
    default: break;
  }
  return {};
}

/** Coloso del Osario (fase 2): derrumba la cobertura que lo rodea y agrieta el suelo junto al héroe más cercano. */
function collapse(s: CombatState, u: Unit, heroes: Unit[], ev: GameEvent[]): void {
  const keep = new Set([...(s.voids ?? []), ...(s.braziers ?? [])]);
  const gone = s.obstacles.filter((k) => !keep.has(k) && (() => { const [x, y] = k.split(',').map(Number) as [number, number]; return dist({ x, y }, u.pos) <= 2; })());
  if (gone.length) s.obstacles = s.obstacles.filter((k) => !gone.includes(k));
  const h = heroes.sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
  let cracked = 0;
  if (h) for (const p of freeCellsNear(s, h.pos, 1).slice(0, 3)) if (s.traps.length < 12 && !s.traps.includes(key(p))) { s.traps.push(key(p)); cracked++; ev.push({ t: 'markAdd', kind: 'pulse', at: { ...p } }); }
  ev.push({ t: 'note', text: `${u.name} hace temblar el osario${gone.length ? `: derrumba ${gone.length} muro${gone.length > 1 ? 's' : ''}` : ''}${cracked ? ` y agrieta ${cracked} casillas` : ''}.` });
}

/** La Raíz Desatada (fase 2): brotan raíces venenosas junto a los héroes. */
function invadeRoots(s: CombatState, heroes: Unit[], ev: GameEvent[]): void {
  s.roots ??= [];
  let n = 0;
  for (const h of heroes) {
    if (s.roots.length >= 14 || n >= 2) break;
    const at = pickCell(s, freeCellsNear(s, h.pos, 2).filter((p) => !s.roots!.includes(key(p))));
    if (at) { s.roots.push(key(at)); n++; ev.push({ t: 'markAdd', kind: 'pulse', at: { ...at } }); }
  }
  if (n) ev.push({ t: 'note', text: `Las raíces invaden el claro (${s.roots.length} casillas envenenadas).` });
}

/** Prende `n` casillas junto a los objetivos (el fuego daña a quien las pisa o empieza su turno en ellas). */
function spreadFire(s: CombatState, around: Unit[], n: number, ev: GameEvent[], turns = 2): void {
  s.fire ??= {};
  const limit = Math.floor(s.w * s.h * 0.25);
  let lit = 0;
  for (let i = 0; i < n * 3 && lit < n && Object.keys(s.fire).length < limit; i++) {
    const t = around[i % Math.max(1, around.length)];
    const at = t && pickCell(s, freeCellsNear(s, t.pos, 2));
    if (!at || (s.fire[key(at)] ?? 0) > 0) continue;
    s.fire[key(at)] = turns; lit++;
    ev.push({ t: 'markAdd', kind: 'pulse', at: { ...at } });
  }
  if (lit) ev.push({ t: 'note', text: `La arena arde: ${lit} casillas más en llamas.` });
}

/** El Cazador: marca a quien se separa, se esconde junto a sus puestos y, en la fase 2, convierte la zona en territorio de caza. */
function hunter(s: CombatState, u: Unit, heroes: Unit[], p2: boolean, ctx: EncounterCtx, ev: GameEvent[]): void {
  if (heroes.length >= 2) {
    const lone = heroes.filter((h) => !heroes.some((o) => o !== h && dist(o.pos, h.pos) <= 2));
    for (const h of lone) if (!h.statuses.mark) { ctx.addStatus(h, 'mark', 2, 1, ev); ev.push({ t: 'note', text: `${u.name} marca a ${h.name}, que se ha separado del grupo.` }); }
  }
  const posts = objectivesOf(s, 'post');
  if (p2) {
    for (const m of marksOf(s, 'hunt')) removeMark(s, m, ev);
    for (const p of posts) for (const c of [p.pos, ...freeCellsNear(s, p.pos, 1)]) addMark(s, { kind: 'hunt', pos: c, team: u.team, turns: 2 }, ev);
  }
}

/**
 * Al final del turno del jefe (después de atacar, que rompe la invisibilidad). El Cazador, cada 3 rondas, desaparece
 * y reaparece junto al puesto de caza más alejado del grupo (si le queda alguno): hay que buscarlo y destruir los puestos.
 */
export function bossEncounterEnd(s: CombatState, u: Unit, ctx: EncounterCtx, ev: GameEvent[]): void {
  if (!s.encounter || s.encounter.boss !== u.kind || !alive(u) || u.kind !== 'cazador') return;
  const posts = objectivesOf(s, 'post');
  const heroes = heroesOf(s);
  if (s.round % 3 !== 2 || !posts.length || !heroes.length) return;
  const far = (p: Unit): number => Math.min(...heroes.map((h) => dist(h.pos, p.pos)));
  const post = [...posts].sort((a, b) => far(b) - far(a) || a.id - b.id)[0]!;
  const at = freeCellsNear(s, post.pos, 1)[0];
  if (!at) return;
  u.pos = { ...at };
  ev.push({ t: 'blink', unit: u.id, to: { ...at } });
  ctx.addStatus(u, 'invis', 1, 1, ev);
  ev.push({ t: 'note', text: `${u.name} se desvanece entre la maleza junto a un puesto de caza.` });
}

/** El Devorador: absorbe fragmentos (crece), hace brotar más y, en la fase 2, abre grietas que roban PA. */
function devourer(s: CombatState, u: Unit, make: ObjectiveFactory | undefined, heroes: Unit[], p2: boolean, ctx: EncounterCtx, ev: GameEvent[]): void {
  const e = s.encounter!;
  const shards = objectivesOf(s, 'shard').sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos) || a.id - b.id);
  const meal = shards[0];
  if (meal && dist(meal.pos, u.pos) <= 6) {
    vanish(s, meal, ev);
    e.pressure++;
    ctx.heal(u, u.maxHp * 0.04, ev);
    if (p2) u.ap += 2;
    ev.push({ t: 'note', text: e.pressure === SHARD_SATED ? `${u.name} devora un fragmento y se sacia: sus ataques se vuelven mucho más peligrosos.` : `${u.name} devora un fragmento rúnico (${e.pressure}/${SHARD_SATED}).` });
  }
  if (s.round % 3 === 2 && objectivesOf(s, 'shard').length < SHARD_CAP[Math.min(3, e.players - 1)]!) {
    const h = heroes[s.round % Math.max(1, heroes.length)];
    const cells = h ? freeCellsNear(s, h.pos, 3).filter((p) => dist(p, h.pos) >= 2 && dist(p, u.pos) >= 3) : [];
    const at = pickCell(s, cells);
    if (at && spawnObjective(s, make, 'fragmento', at, ctx, ev)) ev.push({ t: 'note', text: 'Un nuevo fragmento rúnico emerge del suelo.' });
  }
  if (p2 && s.round % 2 === 0) {
    for (const h of heroes) { const at = pickCell(s, freeCellsNear(s, h.pos, 2)); if (at) addMark(s, { kind: 'rift', pos: at, team: u.team, turns: 3 }, ev); }
    ev.push({ t: 'note', text: `${u.name} reescribe el campo: las grietas del vacío roban 1 PA a quien empiece su turno en ellas.` });
  }
}

/** Efectos del suelo del encuentro al empezar un turno: territorio de caza, grietas y llamas del encuentro. */
export function encounterTurnStart(s: CombatState, u: Unit, ctx: EncounterCtx, ev: GameEvent[]): void {
  if (!s.encounter || u.ai === 'pillar' || !alive(u)) return;
  const here = key(u.pos);
  const on = (kind: string): boolean => (s.marks ?? []).some((m) => m.kind === kind && key(m.pos) === here);
  if (u.team === 'hero' && on('hunt')) { ctx.addStatus(u, 'mark', 1, 1, ev); ctx.addStatus(u, 'slow', 1, 1, ev); ev.push({ t: 'resist', unit: u.id, what: 'Territorio de caza' }); }
  if (on('rift') && u.ap > 0) { u.ap--; ev.push({ t: 'drain', unit: u.id, ap: -1, mp: 0 }); }
  // en los encuentros, quedarse en el fuego también quema
  if (u.team === 'hero' && (s.fire?.[here] ?? 0) > 0 && !u.statuses.burn) ctx.addStatus(u, 'burn', 2, 1, ev);
}

/** Registra el último golpe de un héroe a un enemigo (lo que repetirán las almas del Coro). */
export function recordHit(s: CombatState, attacker: Unit | undefined, target: Unit, amount: number, source: string): void {
  if (!s.encounter || !attacker || attacker.team !== 'hero' || target.team === 'hero' || amount <= 0 || !SPELLS[source]) return;
  (s.encounter.lastHit ??= {})[attacker.id] = amount;
}
