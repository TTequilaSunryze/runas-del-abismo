// Motor de combate por iniciativa: una unidad juega, las demás esperan.
// Todas las funciones modifican el estado y devuelven los eventos ocurridos.
import { FEATURES, schoolOf } from '../tuning';
import { SPELLS, type SpellDef } from '../classes/spells';
import { rand, randInt } from '../rng';
import { tuned } from '../upgrades';
import { key, type BoardMark, type CombatGoal, type CombatState, type Element, type GameEvent, type Pos, type StatusKind, type Unit } from '../state';
import { alive, dist, hasLineOfSight, isFree, lineCells, pathTo, reachable, same, unitAt } from './grid';
import { addMark, clearMarksOf, coneCells, dirOf, marksAt, marksOf, removeMark, tickMarks } from './marks';

export type UnitSpec = Omit<Unit, 'id'>;

export interface CombatSetup {
  seed: number;
  w: number;
  h: number;
  obstacles: Pos[];
  traps?: Pos[];
  puddles?: Pos[];
  abyss?: Pos[];
  braziers?: Pos[];
  roots?: Pos[];
  biome?: string;
  units: UnitSpec[];
  /** empieza con una fase de colocación de los héroes */
  deploy?: boolean;
  /** casillas de inicio elegibles (si no, las 3 primeras columnas) */
  deployCells?: Pos[];
  /** salas creadas: forma, objetivo y oleadas */
  voids?: Pos[];
  goal?: CombatGoal | null;
  waves?: Array<{ round: number; units: UnitSpec[] }>;
  story?: CombatState['story'];
  reward?: CombatState['reward'];
}

export type ActionResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string };

const BURN_DMG = 3;
/** Encantado: +2 de daño de cada golpe recibido */
const CHARM_FLAT = 2;
/** Estados perjudiciales (para la inmunidad de la Ciudadela de cristal). */
const NEGATIVE = new Set<StatusKind>(['burn', 'poison', 'slow', 'stun', 'mark', 'exposed', 'charm', 'vuln', 'bleed', 'hobble', 'deathmark', 'verdugo', 'chained', 'rooted', 'anchor']);
/** Pistolero Arcano: cargas del cargador y daño elemental del disparo con el cargador lleno. */
export const MAG_MAX = 4;
const MAG_FULL_FLAT = 6;
/** Arquitecto Rúnico: escudo y daño extra de Geometría Bélica; glifos a la vez. */
const GEO_SHIELD = 4;
const GEO_FLAT = 2;
const GLYPH_MAX = 6;
const ANCHOR_FLAT = 4;
const POISON_DMG = 2;
/** v12 daño plano: Marcado y crítico suman daño fijo. */
const MARK_FLAT = 2;
export const CRIT_FLAT = 5;
const PUSH_CRASH_DMG = 4;
const TRAP_DMG = 6;
const GUARD_SHIELD = 0.15;
const GUARD_CAP = 24;
export const LATE_ROUND = 20;
export const SUDDEN_ROUND = 30;
const PACK_BONUS = 1;
const EXECUTE_FLAT = 10;
const MENDER_MULT = 1.3;
const REGEN = 0.08;
const THORNS = 0.3;
const ENRAGE_POWER = 3;
const BOMB_DMG = 8;
const BOMB_PCT = 0.15;
/** Cosecha de almas: cada tantas almas de la partida, +1 de armadura permanente. */
export const SOULS_PER_ARMOR = 5;
/** Armadura que da cada tanda de almas (se redondea hacia abajo al recibir daño). */
export const SOUL_ARMOR = 0.5;
/** Cosecha (hechizo): tope de escudo. */
const SOUL_SHIELD_CAP = 20;
/** Élites y jefes: cada punto de PA/PM (o casilla de empuje) se tira dos veces y solo entra si salen las dos. */
export const RANK_ROLL = 0.7;
/** Placaje: proporción de PM que conservas al salir de casillas pegadas a enemigos. */
export function tackleKeep(dodge: number, tackle: number): number {
  return tackle <= 0 ? 1 : Math.min(1, (dodge + 2) / (2 * (tackle + 2)));
}

export const hasTrait = (u: Unit, t: string): boolean => !!u.traits?.includes(t);

/** Furia del Bárbaro: +1 de daño cada 40 puntos (máx. +2) y +6% de crítico cada 20. */
export const furyPower = (u: Unit): number => Math.floor((u.fury ?? 0) / 40);
export const furyCrit = (u: Unit): number => Math.floor((u.fury ?? 0) / 20) * 6;
export const FURY_MAX = 100;
/** Esencia necesaria para que la siguiente habilidad de daño cure (Esencia desbordante: 2). */
export const essenceNeed = (u: Unit): number => (hasTrait(u, 'esencia2') ? 2 : 3);
const VULN_FLAT = 2;
const FRENZY_FLAT = 1;
const BLEED_DMG = 3;
const DEATHMARK_PCT = 0.5;
/** Cadenas vinculantes: parte del daño que pasa al otro encadenado */
const CHAIN_SHARE = 0.5;
/** Pacto de sangre: daño que suma cada vez */
const PACT_POWER = 3;
/** Semillas oscuras: vida, daño base de la Implosión, crecimiento por turno, máximo de crecimiento y de semillas */
export const SEED_HP = 20, SEED_DMG = 14, SEED_GROW = 2, SEED_MAX = 10, SEED_CAP = 6;
/** Red de implosión: daño de cada conexión si la Implosión no trae el suyo (`link`). PROVISIONAL: ajustable en Equilibrio. */
export const SEED_LINK_DMG = 8;
const GUARD_SHARE = 0.4;
/** G3.3: Sed de batalla cura 2 + 20 por cada 100 de Furia. */
export const THIRST_PER_FURY = 0.2;
/** G3.1: derribar un pilar deja al jefe Expuesto. */
export const PILLAR_EXPOSE = { stacks: 2, turns: 2 };
/** G3.2: matar un eco del Eco de los Caídos le hace este % de su vida máxima. */
export const ECHO_BACKLASH = 0.04;
/** G3.3: Distancia letal del Arquero: +1 de daño por casilla más allá de 3 (máx. +3). */
export const ARCHER_RANGE_FROM = 3;
export const ARCHER_RANGE_MAX = 3;
/** ¿Es un héroe Arquero (no el Arquero óseo enemigo)? */
const isArcher = (u: Unit): boolean => u.kind === 'arquero' && (u.ai === null || u.ai === 'champ');
export const archerBonus = (u: Unit, t: Unit): number => (isArcher(u) ? Math.max(0, Math.min(hasTrait(u, 'viento') ? ARCHER_WIND_MAX : ARCHER_RANGE_MAX, dist(u.pos, t.pos) - ARCHER_RANGE_FROM)) : 0);
/** H5: Lectura del viento sube el tope de Distancia letal. */
export const ARCHER_WIND_MAX = 5;
/** H5: Acecho de la presa: daño extra contra enemigos frenados. */
export const PREY_BONUS = 3;
const slowed = (t: Unit): boolean => !!(t.statuses.slow || t.statuses.rooted || t.statuses.stun || t.statuses.hobble);
/** quién está lanzando el hechizo en curso (para la Marca de la muerte) */
let casting: number | null = null;
/** escuela del hechizo en curso: lo mágico usa el % de daño mágico del equipo y lo demás el físico */
let castingSchool: 'phys' | 'magic' | null = null;


/**
 * Daño plano extra de `u` contra `t` (v12: sin porcentajes): daño del personaje y de su tipo (físico/mágico),
 * potenciado, Furia, Marcado, Vulnerable, Frenesí y Desprecio. Se suma al daño fijo del hechizo; luego resta la armadura.
 */
export function dmgFlat(u: Unit, t: Unit, extra = 0): number {
  const school = castingSchool === 'magic' ? (u.powerMagic ?? 0) : castingSchool === 'phys' ? (u.powerPhys ?? 0) : 0;
  return u.power + school + extra + (u.statuses.empower?.stacks ?? 0) + furyPower(u)
    + (t.statuses.mark ? MARK_FLAT : 0) + (t.statuses.charm ? CHARM_FLAT : 0) + (t.statuses.vuln ? VULN_FLAT : 0) + (t.statuses.frenzy ? FRENZY_FLAT : 0)
    + (hasTrait(u, 'desprecio') && t.hp < t.maxHp / 2 ? 3 : 0)
    // Sello de anclaje: +4 de daño de los hechizos de quien lo selló
    + (t.statuses.anchor && t.statuses.anchor.from === u.id ? ANCHOR_FLAT : 0);
}
/** Daño extra de un crítico (Ejecutor: el doble). */
export const critFlat = (u: Unit): number => (hasTrait(u, 'execute') ? EXECUTE_FLAT : CRIT_FLAT);

/** Suma Furia (0 a 100). */
export function addFury(u: Unit, n: number, ev: GameEvent[]): void {
  if (u.fury === undefined || !n) return;
  const v = Math.max(0, Math.min(FURY_MAX, u.fury + n));
  if (v !== u.fury) { u.fury = v; ev.push({ t: 'fury', unit: u.id, value: v }); }
}
const fail = (reason: string): ActionResult => ({ ok: false, reason });

/**
 * Cola de turnos intercalada (v13): cada bando ordenado de mayor a menor iniciativa; empieza la iniciativa más alta
 * de todas y después se alterna estrictamente un aliado y un enemigo. Si un bando se queda sin unidades, el otro
 * termina la ronda en su orden.
 */
export function interleave(units: Array<Pick<Unit, 'id' | 'team' | 'initiative'>>): number[] {
  const byInit = (a: Pick<Unit, 'id' | 'initiative'>, b: Pick<Unit, 'id' | 'initiative'>): number => b.initiative - a.initiative || a.id - b.id;
  const heroes = units.filter((u) => u.team === 'hero').sort(byInit);
  const foes = units.filter((u) => u.team !== 'hero').sort(byInit);
  let turnHero = (heroes[0]?.initiative ?? -Infinity) >= (foes[0]?.initiative ?? -Infinity);
  const out: number[] = [];
  while (heroes.length || foes.length) {
    const from = (turnHero && heroes.length) || !foes.length ? heroes : foes;
    out.push(from.shift()!.id);
    turnHero = from !== heroes;
  }
  return out;
}

export function createCombat(setup: CombatSetup): { state: CombatState; events: GameEvent[] } {
  const units: Unit[] = setup.units.map((u, i) => ({ ...u, pos: { ...u.pos }, statuses: { ...u.statuses }, spells: u.spells.map((s) => ({ ...s })), id: i + 1 }));
  const order = interleave(units);
  const state: CombatState = {
    version: 1, rng: setup.seed >>> 0, w: setup.w, h: setup.h, obstacles: [...setup.obstacles, ...(setup.braziers ?? [])].map(key), abyss: (setup.abyss ?? []).map(key), braziers: (setup.braziers ?? []).map(key), roots: (setup.roots ?? []).map(key), fire: {}, biome: setup.biome, traps: (setup.traps ?? []).map(key), puddles: (setup.puddles ?? []).map(key),
    units, order, turn: -1, round: 1, over: null, nextId: units.length + 1,
  };
  if (setup.voids?.length) { state.voids = setup.voids.map(key); state.obstacles.push(...state.voids.filter((k) => !state.obstacles.includes(k))); }
  if (setup.goal) state.goal = { ...setup.goal };
  if (setup.story) state.story = { ...setup.story };
  if (setup.reward) state.reward = { ...setup.reward };
  if (setup.waves?.length) state.waves = setup.waves.filter((w) => w.units.length).map((w) => ({ round: Math.max(2, Math.floor(w.round)), units: w.units.map((u) => ({ ...u, pos: { ...u.pos }, statuses: { ...u.statuses }, spells: u.spells.map((sp) => ({ ...sp })) })) })).sort((a, b) => a.round - b.round);
  const events: GameEvent[] = [];
  if (setup.deploy) {
    // zona de despliegue: las 3 primeras columnas, sin obstáculos, trampas ni enemigos
    const cells: string[] = [];
    const only = setup.deployCells?.length ? new Set(setup.deployCells.map(key)) : null;
    for (let x = 0; x < (only ? state.w : Math.min(3, state.w)); x++) for (let y = 0; y < state.h; y++) {
      if (only && !only.has(key({ x, y }))) continue;
      const k = key({ x, y });
      if (state.obstacles.includes(k) || state.traps.includes(k) || state.puddles.includes(k) || state.abyss!.includes(k)) continue;
      if (units.some((u) => u.team !== 'hero' && same(u.pos, { x, y }))) continue;
      cells.push(k);
    }
    state.deploy = { cells, ready: [] };
    return { state, events };
  }
  beginNext(state, events);
  return { state, events };
}

/** Coloca a un héroe en una casilla de la zona de despliegue (si hay un aliado, se intercambian). */
export function deployMove(s: CombatState, unitId: number, to: Pos): ActionResult {
  const d = s.deploy;
  const u = getUnit(s, unitId);
  if (!d || !u || u.team !== 'hero') return fail('No es momento de colocarse');
  if (!d.cells.includes(key(to))) return fail('Elige una casilla verde de tu zona');
  const other = s.units.find((o) => o !== u && alive(o) && same(o.pos, to));
  if (other && other.team !== 'hero') return fail('Casilla ocupada');
  const from = { ...u.pos };
  if (other) other.pos = from;
  u.pos = { ...to };
  return { ok: true, events: [{ t: 'move', unit: u.id, path: [{ ...to }] }] };
}

/** Termina la colocación y empieza el primer turno. */
export function startCombat(s: CombatState): GameEvent[] {
  if (!s.deploy) return [];
  s.deploy = null;
  const events: GameEvent[] = [];
  beginNext(s, events);
  return events;
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
  // los invocados no sostienen el combate por sí solos
  const heroes = s.units.some((u) => u.team === 'hero' && alive(u) && u.summoner === undefined);
  // los pilares del jefe no cuentan: basta con vencer al resto
  const enemies = s.units.some((u) => u.team === 'enemy' && alive(u) && u.ai !== 'pillar');
  if (!heroes) s.over = 'lose';
  // sala con objetivo marcado: basta con acabar con los marcados
  else if (s.goal?.kind === 'targets' && s.units.some((u) => u.goal)) { if (!s.units.some((u) => u.goal && alive(u))) s.over = 'win'; else if (!enemies && s.waves?.length) spawnWave(s, ev, true); }
  // sin enemigos: si quedan refuerzos, entran ya
  else if (!enemies) { if (s.waves?.length) spawnWave(s, ev, true); else s.over = 'win'; }
  if (s.over) ev.push({ t: 'over', result: s.over });
}

/** Entran los refuerzos de esta ronda (o, si `early`, la siguiente oleada pendiente). */
function spawnWave(s: CombatState, ev: GameEvent[], early = false): void {
  if (!s.waves?.length) return;
  const round = early ? s.waves[0]!.round : s.round;
  const now = s.waves.filter((w) => w.round <= round);
  if (!now.length) return;
  s.waves = s.waves.filter((w) => w.round > round);
  if (!s.waves.length) delete s.waves;
  ev.push({ t: 'note', text: '¡Llegan refuerzos!' });
  for (const w of now) for (const spec of w.units) summon(s, spec, spec.pos, ev);
}

/** Aplica daño ya calculado (antes de armadura). Devuelve la vida perdida. */
function hurt(s: CombatState, u: Unit, raw: number, ev: GameEvent[], source: string, opts: { pierce?: boolean; crit?: boolean; element?: Element; armorPen?: number; armorFlat?: number } = {}): number {
  if (!alive(u)) return 0;
  const attacker = casting !== null && SPELLS[source] ? getUnit(s, casting) : undefined;
  // Cortina de humo: dentro de la nube se esquivan los ataques a distancia
  if (attacker && attacker.team !== u.team && dist(attacker.pos, u.pos) > 1 && (u.statuses.smoke || (s.marks ?? []).some((m) => m.kind === 'smoke' && m.team === u.team && same(m.pos, u.pos)))) {
    ev.push({ t: 'resist', unit: u.id, what: '¡Esquiva en el humo!' });
    duelShot(s, u, attacker, ev);
    return 0;
  }
  // Sacrificio del guardián: parte del daño lo recibe el Carcelero (con su armadura)
  const gd = u.statuses.guarded;
  if (gd && source !== 'guardian') {
    const g = gd.from === undefined ? undefined : s.units.find((x) => x.id === gd.from);
    if (g && alive(g) && g !== u) { hurt(s, g, raw * GUARD_SHARE * (hasTrait(g, 'custodia') ? 0.85 : 1), ev, 'guardian', { ...opts, crit: false }); raw *= 1 - GUARD_SHARE; }
  }
  // GANCHO DAÑOS CON EFECTO (FEATURES.effectDamage): el tipo de daño llegará en opts.element; las resistencias se reactivan con FEATURES.resistances
  const res = FEATURES.resistances && opts.element ? Math.min(75, u.resist[opts.element] ?? 0) : 0;
  raw *= 1 - res / 100;
  // Resiliencia salvaje: cada 20 de Furia, −2% de daño físico (máx. 10%)
  if (hasTrait(u, 'resiliencia') && !opts.element) raw = Math.max(0, raw - Math.min(2, Math.floor((u.fury ?? 0) / 40)));
  // Armadura de los condenados: +1 de armadura cada 2 almas sin gastar (máx. +6)
  const souls = hasTrait(u, 'condenados') ? Math.min(6, Math.floor((u.soulBank ?? 0) / 2)) : 0;
  // Cimientos sólidos: +2 de armadura sobre o junto a un glifo propio
  const found = hasTrait(u, 'cimientos') && nearOwnGlyph(s, u) ? 2 : 0;
  const armor = Math.max(0, Math.floor(Math.max(0, u.armor + souls + found - (u.statuses.exposed?.stacks ?? 0)) * (1 - (opts.armorPen ?? 0))) - (opts.armorFlat ?? 0));
  let dmg = opts.pierce ? Math.max(1, Math.round(raw)) : Math.max(1, Math.round(raw) - armor);
  const absorbed = Math.min(u.shield, dmg);
  u.shield -= absorbed;
  dmg -= absorbed;
  // Égida de Obsidiana: el primer golpe de cada ronda, a la mitad
  if (dmg > 0 && hasTrait(u, 'egida') && u.egidaRound !== s.round && source !== 'burn' && source !== 'poison' && source !== 'bleed') { u.egidaRound = s.round; dmg = Math.max(0, dmg - 6); }
  // Reflejo oscuro: una vez por combate, la Sombra recibe el golpe letal y estalla en humo
  if (dmg >= u.hp && hasTrait(u, 'reflejoscuro') && !u.shadowSaved) {
    const sh = marksOf(s, 'shadow', u.id).at(-1);
    if (sh) {
      u.shadowSaved = true;
      removeMark(s, sh, ev);
      dmg = 0;
      ev.push({ t: 'resist', unit: u.id, what: '¡Reflejo oscuro!' });
      const atk = casting !== null ? getUnit(s, casting) : undefined;
      if (atk && alive(atk) && atk.team !== u.team) { addStatus(atk, 'vuln', 1, 1, ev); atk.ap = Math.max(0, atk.ap - 1); ev.push({ t: 'drain', unit: atk.id, ap: -1, mp: 0 }); }
    }
  }
  // Negarse a morir: con 60 de Furia o más, sobrevive una vez con 1 de vida
  if (dmg >= u.hp && hasTrait(u, 'negarse') && !u.undying && (u.fury ?? 0) >= 60) {
    dmg = Math.max(0, u.hp - 1);
    u.undying = true;
    addFury(u, -60, ev);
    ev.push({ t: 'resist', unit: u.id, what: '¡Se niega a morir!' });
  }
  // laboratorio del creador: vida infinita
  if (hasTrait(u, 'labgod')) dmg = Math.min(dmg, Math.max(0, u.hp - 1));
  u.hp = Math.max(0, u.hp - dmg);
  ev.push({ t: 'damage', unit: u.id, amount: dmg, absorbed, crit: !!opts.crit, source });
  // Cadenas vinculantes: el otro encadenado recibe la mitad del daño
  const chn = u.statuses.chained;
  if (chn && source !== 'cadenas' && dmg + absorbed > 0) {
    const o = chn.link === undefined ? undefined : getUnit(s, chn.link);
    if (o && alive(o) && o.statuses.chained?.link === u.id) hurt(s, o, Math.max(1, Math.round((dmg + absorbed) * CHAIN_SHARE)), ev, 'cadenas', { pierce: true, element: 'shadow' });
  }
  if (attacker && attacker.team !== u.team && alive(attacker)) {
    // Baluarte prismático: devuelve el 15% de todo el daño recibido
    if (u.statuses.prism && dmg + absorbed > 0) hurt(s, attacker, Math.max(1, (dmg + absorbed) * 0.15), ev, 'prism', { pierce: true });
    // Barrera cinética: un golpe cuerpo a cuerpo contra el escudo hace retroceder al agresor
    if (u.statuses.kinetic && absorbed > 0 && dist(attacker.pos, u.pos) <= 1 && alive(attacker)) { delete u.statuses.kinetic; push(s, u.pos, attacker, 1, ev); }
    // Reflejos de duelo: al recibir un ataque a distancia, tiro rápido de vuelta
    if (dist(attacker.pos, u.pos) > 1 && alive(u)) duelShot(s, u, attacker, ev);
  }
  if (dmg > 0 && u.fury !== undefined) { u.furyHot = true; addFury(u, 10, ev); }
  // Lágrima del Eco: una vez por combate, al bajar del 30% se cura el 25%
  if (alive(u) && hasTrait(u, 'lagrima') && !u.tearUsed && u.hp < u.maxHp * 0.3) { u.tearUsed = true; heal(u, u.maxHp * 0.25, ev); }
  // Reacción visceral: un crítico recibido da +15 de Furia
  if (opts.crit && u.fury !== undefined && hasTrait(u, 'visceral')) addFury(u, 15, ev);
  // Marca de la muerte: guarda el 50% del daño que le hacen el Acechador y sus sombras
  const dm = u.statuses.deathmark;
  if (dm && dmg > 0 && casting !== null && dm.from === casting && source !== 'marca') dm.stacks += Math.round(dmg * DEATHMARK_PCT);
  if (!alive(u)) {
    ev.push({ t: 'death', unit: u.id });
    clearMarksOf(s, u.id, ev);
    // Hechicera: si un enemigo muere por cualquier daño suyo, su próximo Impulso espiritual cuesta 0 PA
    const zKiller = casting !== null ? getUnit(s, casting) : undefined;
    const imp = zKiller && zKiller.team !== u.team && alive(zKiller) ? zKiller.spells.find((sp) => sp.id === 'z_impulso') : undefined;
    if (imp && !imp.free) { imp.free = true; ev.push({ t: 'reset', unit: zKiller!.id, spell: 'z_impulso' }); }
    // Cosecha de almas: cada enemigo de verdad (no invocaciones ni pilares) que muere con el Carcelero vivo
    if (u.summoner === undefined && u.ai !== 'pillar') {
      for (const k of s.units) {
        if (k.souls === undefined || !alive(k) || k.team === u.team) continue;
        gainSoul(s, k, u.pos, ev);
        // Eco de los caídos: por debajo de la mitad, el alma de un enemigo cercano te cura el 8%
        if (hasTrait(k, 'ecocaidos') && k.hp < k.maxHp / 2 && dist(k.pos, u.pos) <= 3) heal(k, k.maxHp * 0.08, ev);
      }
    }
    const killer = casting !== null ? getUnit(s, casting) : undefined;
    if (killer && alive(killer) && killer.team !== u.team) {
      // Piel del Devorador: rematar cura el 5%
      if (hasTrait(killer, 'devorador')) heal(killer, killer.maxHp * 0.05, ev);
      // Ojo del Volcán: el rematado estalla
      if (hasTrait(killer, 'volcan')) for (const o of s.units.filter((x) => alive(x) && x.team === u.team && dist(x.pos, u.pos) <= 1)) hurt(s, o, 5, ev, 'volcan', { pierce: true });
    }
    // Alianza de la Viuda Eterna: si cae un aliado, +20% de daño
    if (u.summoner === undefined) for (const a of s.units) if (a !== u && alive(a) && a.team === u.team && hasTrait(a, 'viuda')) a.power += 2;
    if (hasTrait(u, 'puddle') && !s.puddles.includes(key(u.pos))) s.puddles.push(key(u.pos));
    if (hasTrait(u, 'split') && u.maxHp >= 16) splitUnit(s, u, ev);
    if (hasTrait(u, 'bomb')) {
      // explota: daña a todo lo que tenga pegado, de cualquier bando (puede encadenar otras explosiones)
      u.traits = u.traits!.filter((t) => t !== 'bomb');
      ev.push({ t: 'explode', unit: u.id });
      for (const o of s.units.filter((x) => x !== u && alive(x) && dist(x.pos, u.pos) <= 1)) hurt(s, o, BOMB_DMG + u.maxHp * BOMB_PCT, ev, 'bomb', { pierce: true, element: 'fire' });
    }
    // Pacto del Vacío Hambriento: estalla y daña a sus aliados pegados
    if (hasTrait(u, 'hambriento')) {
      u.traits = u.traits!.filter((t) => t !== 'hambriento');
      ev.push({ t: 'explode', unit: u.id });
      for (const o of s.units.filter((x) => x !== u && alive(x) && x.team === u.team && dist(x.pos, u.pos) <= 1)) hurt(s, o, Math.ceil(u.maxHp * 0.2), ev, 'vacio', { pierce: true });
    }
    // G3.1: derribar un pilar deja al jefe Expuesto (−2 de armadura) 2 rondas
    if (u.ai === 'pillar') {
      u.used = true;
      const boss = s.units.find((b) => alive(b) && b.team === u.team && b.ai === 'boss');
      if (boss) { addStatus(boss, 'exposed', PILLAR_EXPOSE.turns, PILLAR_EXPOSE.stacks, ev); ev.push({ t: 'note', text: `El pilar cae: ${boss.name} queda Expuesto.` }); }
    }
    // G3.2: matar una invocación da ventaja contra quien la creó
    const maker = u.summoner === undefined ? undefined : s.units.find((x) => x.id === u.summoner && alive(x) && x.team === u.team);
    if (maker && hasTrait(u, 'wail')) { maker.apMod -= 1; ev.push({ t: 'note', text: `El lamento se quiebra: ${maker.name} pierde 1 PA en su próximo turno.` }); }
    if (maker && hasTrait(u, 'echo')) { ev.push({ t: 'note', text: `El eco vuelve a ${maker.name} y lo hiere.` }); hurt(s, maker, maker.maxHp * ECHO_BACKLASH, ev, 'eco', { pierce: true }); }
    // las invocaciones mueren con su creador
    for (const m of s.units.filter((x) => alive(x) && x.summoner === u.id)) {
      m.hp = 0; m.shield = 0;
      ev.push({ t: 'death', unit: m.id });
      ev.push({ t: 'note', text: `${m.name} se desvanece con su invocador.` });
      clearMarksOf(s, m.id, ev);
    }
    checkOver(s, ev);
  }
  return dmg;
}

/** G3.1: daño de una mecánica de jefe (ataques anunciados): pasa por armadura, escudo y resistencias como cualquier golpe. */
export function strike(s: CombatState, u: Unit, raw: number, ev: GameEvent[], source: string, opts: { pierce?: boolean; element?: Element } = {}): number {
  return hurt(s, u, raw, ev, source, opts);
}
/** G3.1: aplica un estado desde la IA (respeta inmunidades). */
export function applyStatus(u: Unit, kind: StatusKind, turns: number, stacks: number, ev: GameEvent[]): void {
  addStatus(u, kind, turns, stacks, ev);
}

/** El Carcelero cosecha un alma: cuenta para la armadura, se puede gastar y deja un eco en el suelo. */
function gainSoul(s: CombatState, k: Unit, at: Pos, ev: GameEvent[]): void {
  k.souls = (k.souls ?? 0) + 1;
  k.soulBank = (k.soulBank ?? 0) + 1;
  k.soulsFight = (k.soulsFight ?? 0) + 1;
  const gain = k.souls % SOULS_PER_ARMOR === 0 ? SOUL_ARMOR : 0;
  k.armor += gain;
  ev.push({ t: 'soul', unit: k.id, armor: gain });
  if (!marksAt(s, 'soul', at).length) addMark(s, { kind: 'soul', pos: at, team: k.team, turns: 99 }, ev);
}

/** Se divide en dos copias más pequeñas que no vuelven a dividirse. */
function splitUnit(s: CombatState, u: Unit, ev: GameEvent[]): void {
  ev.push({ t: 'split', unit: u.id });
  const hp = Math.ceil(u.maxHp * 0.4);
  for (let i = 0; i < 2; i++) {
    summon(s, { ...u, name: `${u.name.split(' · ')[0]} menor`, hp, maxHp: hp, shield: 0, statuses: {}, traits: (u.traits ?? []).filter((t) => t !== 'split' && t !== 'bomb'), spells: u.spells.map((sp) => ({ ...sp, cd: 0 })), used: false, summoner: u.summoner }, u.pos, ev);
  }
}

export function heal(u: Unit, amount: number, ev: GameEvent[]): void {
  if (!alive(u)) return;
  const real = Math.min(u.maxHp - u.hp, Math.round(amount));
  if (real > 0) {
    u.hp += real;
    ev.push({ t: 'heal', unit: u.id, amount: real });
  }
}

function addStatus(u: Unit, kind: StatusKind, turns: number, stacks: number, ev: GameEvent[]): void {
  if (!alive(u)) return;
  // Sobrecarga de la forja: enemigos inmunes a las quemaduras
  if (kind === 'burn' && hasTrait(u, 'ignifugo')) return;
  // Ciudadela de cristal: inmune a estados alterados
  if (u.statuses.immune && NEGATIVE.has(kind)) { ev.push({ t: 'resist', unit: u.id, what: 'Inmune' }); return; }
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
      // salas creadas: sobrevivir N rondas, y refuerzos
      if (s.goal?.kind === 'survive' && s.round > s.goal.rounds) { s.over = 'win'; ev.push({ t: 'over', result: 'win' }); return; }
      if (s.waves?.length) spawnWave(s, ev);
      tickMarks(s, undefined, ev);
      for (const k of Object.keys(s.fire ?? {})) if (--s.fire![k]! <= 0) delete s.fire![k];
    }
    const u = getUnit(s, s.order[s.turn]!)!;
    if (!alive(u)) continue;
    ev.push({ t: 'turn', unit: u.id, round: s.round });
    tickMarks(s, u.id, ev);
    // acciones temporales: la cadena dura un turno; la linterna, mientras siga en el suelo
    delete u.hooked;
    u.discount = 0;
    u.reaper = false;
    u.syncHit = false;
    u.mistWalk = false; u.gravHit = false; u.twinBlades = false; u.huntUsed = false; u.bloodUsed = false; u.behindNow = false; u.firstCast = false;
    // el señuelo dura hasta su turno
    if (u.ai === 'decoy') { u.hp = 0; ev.push({ t: 'death', unit: u.id }); continue; }
    // G3.2: las manifestaciones se desvanecen solas al agotarse (sin cadáver que alzar ni devorar)
    const fd = u.statuses.fading;
    if (fd && --fd.turns <= 0) {
      u.hp = 0; u.shield = 0; u.used = true;
      ev.push({ t: 'death', unit: u.id });
      ev.push({ t: 'note', text: `${u.name} se desvanece.` });
      clearMarksOf(s, u.id, ev);
      checkOver(s, ev);
      continue;
    }
    // Furia: si pasa un turno entero sin atacar ni recibir daño, pierde 20
    if (u.fury !== undefined) { if (!u.furyHot) addFury(u, -20, ev); u.furyHot = false; }
    if (u.spells.some((sp) => sp.temp)) u.spells = u.spells.filter((sp) => !sp.temp || (sp.id === 'k_farol' && marksOf(s, 'lantern').some((m) => m.team === u.team)) || (sp.id === 's_cambio' && marksOf(s, 'shadow', u.id).length > 0));
    u.shield = 0;
    // a partir de la ronda 20 se acaban los escudos y curas automáticos: ningún combate dura para siempre
    const late = s.round >= LATE_ROUND;
    if (hasTrait(u, 'guard') && !late) {
      u.shield = Math.min(GUARD_CAP, Math.round(u.maxHp * GUARD_SHIELD));
      ev.push({ t: 'shield', unit: u.id, amount: u.shield });
    }
    for (const sp of u.spells) { if (sp.cd > 0) sp.cd--; delete sp.uses; delete sp.free; }
    if (hasTrait(u, 'regen') && !late) heal(u, u.maxHp * REGEN, ev);
    // muerte súbita: desde la ronda 30 el Abismo consume a todos, cada vez más
    if (s.round >= SUDDEN_ROUND && u.ai !== 'pillar') hurt(s, u, u.maxHp * 0.05 * (s.round - SUDDEN_ROUND + 1), ev, 'abismo', { pierce: true });
    if (!alive(u) || s.over) continue;
    if (u.statuses.burn) hurt(s, u, BURN_DMG, ev, 'burn', { pierce: true, element: 'fire' });
    if (alive(u) && u.statuses.poison) hurt(s, u, POISON_DMG * u.statuses.poison.stacks, ev, 'poison', { pierce: true, element: 'poison' });
    if (alive(u) && u.statuses.bleed) hurt(s, u, BLEED_DMG * u.statuses.bleed.stacks, ev, 'bleed', { pierce: true });
    tick(u, 'burn');
    tick(u, 'poison');
    tick(u, 'bleed');
    // Marca de la muerte: si quien la puso ya no está, se pierde (estalla al final del turno de su dueño, en endTurn)
    const dmk = u.statuses.deathmark;
    if (dmk && !s.units.some((x) => x.id === dmk.from && alive(x))) delete u.statuses.deathmark;
    // Semillas oscuras: cada turno de su dueña sin detonarlas crecen (+2, máx. +10)
    for (const sd of s.units) if (sd.seed !== undefined && sd.summoner === u.id && alive(sd)) sd.seed = Math.min(SEED_MAX, sd.seed + SEED_GROW);
    if (!alive(u) || s.over) continue;
    u.ap = Math.max(0, u.maxAp + u.apMod);
    u.mp = Math.max(0, u.maxMp + u.mpMod - (u.statuses.slow?.stacks ?? 0));
    u.apMod = 0;
    u.mpMod = 0;
    u.gunKill = false;
    // Inmovilizado: sin PM este turno
    if (u.statuses.rooted) { u.mp = 0; ev.push({ t: 'resist', unit: u.id, what: 'Inmovilizado' }); }
    zoneTurnStart(s, u, ev);
    if (!alive(u) || s.over) continue;
    tick(u, 'slow');
    tick(u, 'mark');
    tick(u, 'empower');
    tick(u, 'reach');
    tick(u, 'invis');
    tick(u, 'exposed');
    for (const k of ['charm', 'vuln', 'hobble', 'guarded', 'verdugo', 'frenzy', 'orbita', 'chained', 'rooted', 'anchor', 'silver', 'smoke', 'immune', 'kinetic', 'prism'] as const) tick(u, k);
    // Mirada del verdugo: si su presa sigue marcada, el Bárbaro gana 1 PM para ir a por ella
    if (s.units.some((x) => alive(x) && x.statuses.verdugo?.from === u.id)) { u.mp++; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
    turnStartBlessings(s, u, ev);
    // Corte de Guadaña: se carga en cada turno propio en que no se usó el anterior
    if (u.spells.some((sp) => sp.id === 'k_guadana')) {
      if (u.scytheCharge === undefined) u.scytheCharge = 0;
      else if (!u.scytheUsed) u.scytheCharge = Math.min(3, u.scytheCharge + 1);
      u.scytheUsed = false;
    }
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
  const reach = reachable(s, u.pos, u.mp, false, hasTrait(u, 'ghost'));
  const cost = reach.cost.get(key(to));
  if (!cost || s.obstacles.includes(key(to)) || (s.abyss ?? []).includes(key(to))) return fail('Casilla fuera de alcance');
  const path = pathTo(reach, u.pos, to);
  const ev: GameEvent[] = [];
  const walked: Pos[] = [];
  for (const p of path) {
    // placaje: al salir de una casilla pegada a enemigos se pierden PM
    const keep = Math.floor(u.mp * tackleKeep(dodgeOf(s, u), tacklersOf(s, u)));
    if (keep < u.mp) {
      ev.push({ t: 'tackle', unit: u.id, lost: u.mp - keep });
      u.mp = keep;
      if (u.mp <= 0) break;
    }
    u.pos = { ...p };
    u.mp--;
    walked.push(p);
    stepBlessings(s, u, ev);
    if (s.traps.includes(key(p))) {
      ev.push({ t: 'trap', unit: u.id });
      hurt(s, u, TRAP_DMG, ev, 'trap', { pierce: true });
      if (!alive(u)) break;
    }
    if (springSnare(s, u, ev)) { u.mp = 0; break; }
    if (stepOn(s, u, ev)) { u.mp = 0; break; }
    // los héroes se quedan pegados en los charcos: pierden el resto de PM
    if (u.team === 'hero' && s.puddles.includes(key(p)) && !s.obstacles.includes(key(p))) {
      u.mp = 0;
      ev.push({ t: 'stuck', unit: u.id });
      break;
    }
  }
  ev.unshift({ t: 'move', unit: u.id, path: walked, walk: true });
  if (!alive(u) && !s.over) beginNext(s, ev);
  return { ok: true, events: ev };
}

/** Placaje total de los enemigos pegados a `u` (los espectros y los invisibles no se dejan placar). */
export function tacklersOf(s: CombatState, u: Unit): number {
  return tacklersAt(s, u, u.pos);
}

/** El placaje no le afecta: espectros, invisibles, Frenesí, Caminante de la niebla, Golpe titánico. */
const untackleable = (u: Unit): boolean => hasTrait(u, 'ghost') || !!u.statuses.invis || !!u.statuses.frenzy || !!u.mistWalk || (hasTrait(u, 'titanico') && (u.fury ?? 0) > 80) || hasTrait(u, 'entremundos');
/** Placaje de `o` sobre `u` (Cadenas pesadas: +2 contra ralentizados, encadenados o con la Huida reducida). */
const tackleOf = (o: Unit, u: Unit): number => (o.tackle ?? 0) + (hasTrait(o, 'pesadas') && (u.statuses.slow || u.statuses.chained || u.statuses.hobble) ? 2 : 0);

/** Placaje que sufriría `u` si estuviera en `pos`. */
function tacklersAt(s: CombatState, u: Unit, pos: Pos): number {
  if (untackleable(u)) return 0;
  return s.units.filter((o) => o.team !== u.team && alive(o) && o.ai !== 'pillar' && !o.statuses.invis && o !== u && dist(o.pos, pos) === 1).reduce((a, o) => a + tackleOf(o, u), 0);
}

/**
 * Previsualización de un movimiento: el camino que seguiría `u` hasta `to`, las casillas al salir de las cuales
 * perdería PM por placaje (`tackled`) y hasta dónde llegaría de verdad (`stop`).
 */
export function movePreview(s: CombatState, u: Unit, to: Pos): { path: Pos[]; tackled: Pos[]; stop: number } | null {
  const reach = reachable(s, u.pos, u.mp, false, hasTrait(u, 'ghost'));
  if (!reach.cost.get(key(to))) return null;
  const path = pathTo(reach, u.pos, to);
  const tackled: Pos[] = [];
  let mp = u.mp, pos = u.pos, stop = path.length;
  for (let i = 0; i < path.length; i++) {
    const keep = Math.floor(mp * tackleKeep(dodgeOf(s, u), tacklersAt(s, u, pos)));
    if (keep < mp) { tackled.push({ ...pos }); mp = keep; if (mp <= 0) { stop = i; break; } }
    pos = path[i]!;
    mp--;
  }
  return { path, tackled, stop };
}

/** PM con los que `u` puede moverse desde donde está, contando el placaje. */
export function usableMp(s: CombatState, u: Unit): number {
  return Math.floor(u.mp * tackleKeep(dodgeOf(s, u), tacklersOf(s, u)));
}

/** Huida efectiva (Tormento espectral la reduce a la mitad). */
const dodgeOf = (s: CombatState, u: Unit): number => {
  // Manto de la noche: sin aliados a 3 casillas, +3 de Huida
  const alone = hasTrait(u, 'manto') && !s.units.some((o) => o !== u && alive(o) && o.team === u.team && o.ai !== 'pillar' && dist(o.pos, u.pos) <= 3);
  return ((u.dodge ?? 0) + (alone ? 3 : 0)) * (u.statuses.hobble ? 0.5 : 1);
};

/**
 * Al entrar en una casilla (andando, empujado o arrastrado): La caja y Cadenas vinculantes.
 * Devuelve true si debe detenerse.
 */
function stepOn(s: CombatState, u: Unit, ev: GameEvent[]): boolean {
  let stop = false;
  // terreno: raíces venenosas y casillas en llamas
  const here = key(u.pos);
  if (alive(u) && (s.roots ?? []).includes(here)) addStatus(u, 'poison', 2, 1, ev);
  if (alive(u) && (s.fire?.[here] ?? 0) > 0) addStatus(u, 'burn', 2, 1, ev);
  // glifos del Arquitecto: el fulminante explota (y se gasta); la matriz quita PA y sigue ahí
  for (const g of (s.marks ?? []).filter((m) => m.kind === 'glyph' && m.team !== u.team && same(m.pos, u.pos) && (m.sub === 'fulminante' || m.sub === 'matriz'))) {
    if (!alive(u)) break;
    triggerGlyph(s, g, u, ev, true);
    if (g.sub === 'fulminante') stop = true;
  }
  const cage = (s.marks ?? []).find((m) => m.kind === 'cage' && m.team !== u.team && same(m.pos, u.pos));
  if (cage && alive(u)) {
    // La caja: tocar sus muros duele y deja sin PM
    const src = cage.owner === undefined ? undefined : getUnit(s, cage.owner);
    ev.push({ t: 'caged', unit: u.id });
    hurt(s, u, 14 + (src ? dmgFlat(src, u) : 0), ev, 'caja', { element: 'shadow' });
    u.mp = 0;
    stop = true;
  }
  return stop;
}

/** Para élites y jefes: cuántos de `n` puntos entran (dos tiradas por punto). */
function landed(s: CombatState, t: Unit, n: number): number {
  if (!t.rank) return n;
  let ok = 0;
  for (let i = 0; i < n; i++) if (rand(s) < RANK_ROLL && rand(s) < RANK_ROLL) ok++;
  return ok;
}

/** Si `u` pisa un cepo rival, salta: daño y se queda sin moverse. Devuelve true si saltó. */
function springSnare(s: CombatState, u: Unit, ev: GameEvent[]): boolean {
  const i = (s.snares ?? []).findIndex((t) => t.k === key(u.pos) && t.team !== u.team);
  if (i < 0 || !alive(u)) return false;
  const t = s.snares!.splice(i, 1)[0]!;
  ev.push({ t: 'snare', unit: u.id });
  hurt(s, u, t.dmg, ev, t.burn ? 'mina' : 'snare', { pierce: true, element: t.burn ? 'fire' : undefined });
  if (t.burn && alive(u)) addStatus(u, 'burn', t.burn, 1, ev);
  if (t.bleed && alive(u)) addStatus(u, 'bleed', t.bleed, 1, ev);
  return true;
}

/** El hechizo tal como lo lanza `u`: con sus mejoras y su runa aplicadas. */
export function spellOf(u: Unit, id: string): SpellDef | undefined {
  const def = SPELLS[id];
  return def && tuned(def, u.spells.find((x) => x.id === id));
}

/** Motivo por el que `u` no puede lanzar el hechizo sobre `at`, o null si puede. */
export function castProblem(s: CombatState, u: Unit, base: SpellDef, at: Pos): string | null {
  const slot = u.spells.find((x) => x.id === base.id);
  if (!slot) return 'No conoces ese hechizo';
  const def = tuned(SPELLS[base.id] ?? base, slot);
  if (slot.cd > 0) return 'Hechizo en enfriamiento';
  if (slot.charges !== undefined && slot.charges <= 0) return 'No te quedan';
  if (def.perTurn && (slot.uses ?? 0) >= def.perTurn) return def.perTurn === 1 ? 'Ya lo usaste este turno' : `Máximo ${def.perTurn} veces por turno`;
  if (u.ap < apCost(u, base.id, s)) return 'No tienes PA suficientes';
  if (def.furyCost && (u.fury ?? 0) < def.furyCost) return `Necesitas ${def.furyCost} de Furia`;
  if (def.needSphere && !marksOf(s, 'sphere', u.id).length) return 'Necesitas una esfera en el tablero';
  if (def.special === 'soulburst' && !(u.soulBank ?? 0)) return 'No tienes almas que gastar';
  if (def.special === 'reap' && !u.syncHit) return 'Tu Sombra y tú no habéis golpeado al mismo enemigo este turno';
  if (def.special === 'converge' && !marksOf(s, 'shadow', u.id).length) return 'No tienes Sombra';
  if (def.special === 'absorb' && !marksOf(s, 'soul').length) return 'No hay almas en el tablero';
  if (def.special === 'seed' && seedsOf(s, u).length >= SEED_CAP) return `Máximo ${SEED_CAP} semillas`;
  if (def.special === 'implode' && !seedsOf(s, u).length) return 'No tienes Semillas oscuras';
  // Implosión: se elige qué Semilla oscura detonar (cualquiera de las tuyas, sin alcance ni visión)
  if (def.special === 'implode') { const sd = unitAt(s, at); return sd && sd.seed !== undefined && sd.summoner === u.id && alive(sd) ? null : 'Elige una de tus Semillas oscuras'; }
  if (def.swapShadow) {
    const sh = marksOf(s, 'shadow', u.id).at(-1);
    if (!sh) return 'No tienes Sombra';
    return isFree(s, sh.pos) ? null : 'Hay alguien sobre tu Sombra';
  }
  if (def.lanternJump) {
    const l = lanternNear(s, u);
    if (!l) return 'Necesitas una linterna aliada a tu lado';
    const o = l.owner === undefined ? undefined : getUnit(s, l.owner);
    if (!o || !alive(o)) return 'Su dueño ha caído';
    return dashCell(s, u, o.pos) ? null : 'No hay hueco junto al Carcelero';
  }
  const d = dist(u.pos, at);
  const extra = def.range[1] > 1 ? u.statuses.reach?.stacks ?? 0 : 0;
  if (d < def.range[0] || d > def.range[1] + extra) return 'Fuera de alcance';
  if (def.straight && d > 0 && at.x !== u.pos.x && at.y !== u.pos.y) return 'Solo en línea recta';
  if (def.los && d > 1 && !hasLineOfSight(s, u.pos, at)) return 'Sin línea de visión';
  const t = unitAt(s, at);
  const around = def.range[1] === 0;
  if ((def.target === 'self' || around) && !same(at, u.pos)) return 'Solo sobre ti';
  if (around) return null;
  if (def.revive) {
    if (t) return 'La casilla está ocupada';
    const dead = s.units.find((x) => !alive(x) && same(x.pos, at) && x.team === u.team && x.summoner === undefined);
    return dead ? null : 'Necesitas un aliado caído';
  }
  if (def.atSphere) return marksAt(s, 'sphere', at).some((m) => m.owner === u.id) ? null : 'Apunta a una de tus esferas';
  if (def.special === 'grapple') return grappleTarget(s, at) && !same(at, u.pos) ? null : 'Apunta a un muro, un brasero o un enemigo';
  if (def.target === 'ground') return s.obstacles.includes(key(at)) ? 'Hay un obstáculo' : at.x < 0 || at.y < 0 || at.x >= s.w || at.y >= s.h ? 'Fuera del tablero' : null;
  if (t && t.team !== u.team && t.statuses.invis) return 'No puedes ver al objetivo';
  if (def.target === 'cell') {
    if (!isFree(s, at)) return 'Necesitas una casilla libre';
    if (def.summon && s.units.some((x) => alive(x) && x.summoner === u.id)) return 'Ya tienes un compañero invocado';
    return null;
  }
  if (def.target === 'enemy' && (!t || t.team === u.team) && !(def.dmg && (s.braziers ?? []).includes(key(at)))) return 'Necesitas un enemigo como objetivo';
  if (def.target === 'ally' && (!t || t.team !== u.team)) return 'Necesitas un aliado como objetivo';
  if (def.hookOnly && t?.id !== u.hooked) return 'Solo sobre el enemigo enganchado';
  if (def.behind && t && !behindCell(s, u, t)) return 'No hay hueco a su espalda';
  if (def.special === 'chainlink' && t && !chainPartner(s, u, t)) return 'Necesitas otro enemigo a 3 casillas del objetivo';
  if (def.dash && !dashCell(s, u, at)) return 'No hay hueco junto al objetivo';
  return null;
}

/** PA que le cuesta ahora a `u` lanzar el hechizo (0 si lo tiene gratis tras rematar; con descuento de Danza de las nueve colas). */
export function apCost(u: Unit, id: string, s?: CombatState): number {
  const slot = u.spells.find((x) => x.id === id);
  if (slot?.free) return 0;
  // los consumibles (objetos con cargas) no gastan PA
  if (slot?.charges !== undefined) return 0;
  const d = spellOf(u, id);
  const base = d?.ap ?? 99;
  // Sinfonía mística: el próximo hechizo de 3 PA o más cuesta 1 menos
  const sym = u.symphony && base >= 3 ? 1 : 0;
  // Dominio esférico: hechizos de esferas a 2 casillas o menos de una esfera tuya
  const dom = s && d && hasTrait(u, 'dominio') && isSphereSpell(d) && marksOf(s, 'sphere', u.id).some((m) => dist(m.pos, u.pos) <= 2) ? 1 : 0;
  // Marca de la muerte: 1 PA menos si ya tienes una Sombra en el tablero
  const shade = s && d?.special === 'deathmark' && marksOf(s, 'shadow', u.id).length ? 1 : 0;
  // Primera Runa: el primer hechizo del turno cuesta 1 PA menos
  const first = hasTrait(u, 'primera') && !u.firstCast ? 1 : 0;
  const cost = Math.max(0, base - Math.max(u.discount ?? 0, sym) - dom - first - shade);
  // Pacto de la Magia Desatada: 1 PA menos (mínimo 1)
  return hasTrait(u, 'desatada') && cost > 1 ? cost - 1 : cost;
}

/** Hechizos que crean, mueven, consumen o usan esferas. */
const isSphereSpell = (d: SpellDef): boolean => !!(d.sphere || d.consume || d.detonate || d.needSphere || d.atSphere || d.sphereHit || d.sphereShield) || ['throwsphere', 'gravity', 'orbit', 'transfuse', 'singularity'].includes(d.special ?? '');

/** Casilla a la espalda de `t` vista desde `u` (libre), o null. */
function behindCell(s: CombatState, u: Unit, t: Unit): Pos | null {
  const [dx, dy] = dirOf(u.pos, t.pos);
  const p = { x: t.pos.x + dx, y: t.pos.y + dy };
  return isFree(s, p) ? p : null;
}

/** Otro enemigo a 2 casillas o menos de `t` (el más cercano), para Cadenas vinculantes. */
function chainPartner(s: CombatState, u: Unit, t: Unit): Unit | undefined {
  return s.units.filter((x) => x !== t && alive(x) && x.team === t.team && x.team !== u.team && x.ai !== 'pillar' && dist(x.pos, t.pos) <= 3).sort((a, b) => dist(a.pos, t.pos) - dist(b.pos, t.pos))[0];
}

/** Un paso de `t` hacia `to` (si la casilla está libre). */
function stepToward(s: CombatState, t: Unit, to: Pos, ev: GameEvent[]): void {
  if (!alive(t) || dist(t.pos, to) === 0) return;
  const [dx, dy] = dirOf(t.pos, to);
  const p = { x: t.pos.x + dx, y: t.pos.y + dy };
  if (!isFree(s, p)) return;
  t.pos = p;
  ev.push({ t: 'push', unit: t.id, to: { ...p } });
  springSnare(s, t, ev);
  stepOn(s, t, ev);
}

/** Linterna de tu bando pegada a ti (también en diagonal). */
function lanternNear(s: CombatState, u: Unit) {
  return marksOf(s, 'lantern').find((m) => m.team === u.team && Math.max(Math.abs(m.pos.x - u.pos.x), Math.abs(m.pos.y - u.pos.y)) <= 1);
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

function push(s: CombatState, from: Pos, u: Unit, cells: number, ev: GameEvent[]): boolean {
  const dx = Math.abs(u.pos.x - from.x) >= Math.abs(u.pos.y - from.y) ? Math.sign(u.pos.x - from.x) : 0;
  const dy = dx === 0 ? Math.sign(u.pos.y - from.y) : 0;
  return pushDir(s, u, dx, dy, cells, ev);
}

/** Empuja `u` en una dirección fija; si choca, recibe daño y se detiene. Devuelve true si chocó. */
function pushDir(s: CombatState, u: Unit, dx: number, dy: number, cells: number, ev: GameEvent[]): boolean {
  for (let i = 0; i < cells && alive(u); i++) {
    const n = { x: u.pos.x + dx, y: u.pos.y + dy };
    if ((s.abyss ?? []).includes(key(n)) && !unitAt(s, n)) { fallInto(s, u, n, ev); return false; }
    if (!isFree(s, n)) {
      hurt(s, u, PUSH_CRASH_DMG, ev, 'push', { pierce: true });
      return true;
    }
    u.pos = n;
    ev.push({ t: 'push', unit: u.id, to: { ...n } });
    springSnare(s, u, ev);
    if (stepOn(s, u, ev)) return false;
    if (s.traps.includes(key(n))) {
      ev.push({ t: 'trap', unit: u.id });
      hurt(s, u, TRAP_DMG, ev, 'trap', { pierce: true });
    }
  }
  return false;
}

export function cast(s: CombatState, unitId: number, spellId: string, at: Pos): ActionResult {
  casting = unitId;
  // el tipo de daño lo marca la clase: las mágicas escalan con daño mágico y las físicas con daño físico
  const caster = getUnit(s, unitId);
  castingSchool = caster && caster.team === 'hero' ? schoolOf(caster.kind) : null;
  try { return castInner(s, unitId, spellId, at); } finally { casting = null; castingSchool = null; }
}

function castInner(s: CombatState, unitId: number, spellId: string, at: Pos): ActionResult {
  const u = actor(s, unitId);
  if (typeof u === 'string') return fail(u);
  const base = SPELLS[spellId];
  if (!base) return fail('Hechizo desconocido');
  const problem = castProblem(s, u, base, at);
  if (problem) return fail(problem);
  const def = spellOf(u, spellId)!;

  const ev: GameEvent[] = [{ t: 'cast', unit: u.id, spell: def.id, at: { ...at }, element: def.element }];
  const slotUsed = u.spells.find((x) => x.id === def.id)!;
  const cost = apCost(u, def.id, s);
  if (!slotUsed.free && (u.discount ?? 0) > 0) u.discount = 0;
  if (slotUsed.charges === undefined) u.firstCast = true;
  if (!slotUsed.free && u.symphony && def.ap >= 3 && slotUsed.charges === undefined) u.symphony = false;
  u.ap -= cost;
  delete slotUsed.free;
  // Danza de las nueve colas: tras Impulso espiritual, el siguiente hechizo cuesta 1 PA menos
  if (def.id === 'z_impulso' && hasTrait(u, 'danza')) u.discount = 1;
  slotUsed.uses = (slotUsed.uses ?? 0) + 1;
  slotUsed.cd = def.cd > 0 ? def.cd + 1 : 0;
  // Recarga táctica: la Recarga acrobática no tiene espera
  if (def.special === 'reload' && hasTrait(u, 'recargatac')) slotUsed.cd = 0;
  if (slotUsed.charges !== undefined) slotUsed.charges--;
  // atacar rompe la invisibilidad (Ejecución silenciosa: el crítico se decide con la invisibilidad de antes)
  const wasInvis = !!u.statuses.invis;
  if (def.dmg && u.statuses.invis) delete u.statuses.invis;
  if (def.dmg && u.fury !== undefined) u.furyHot = true;
  // Robo de esencia: con 3 cargas (2 con Esencia desbordante), la siguiente habilidad de daño te cura el 15% y reinicia el contador
  const dealsDmg = !!def.dmg || !!def.followUp || def.special === 'fatuo';
  let essenceSpent = false;
  if (u.essence !== undefined && dealsDmg && u.essence >= essenceNeed(u)) {
    essenceHeal(u, ev);
    u.essence = 0;
    essenceSpent = true;
  }
  if (def.furyCost) addFury(u, -def.furyCost, ev);
  // golpe a un brasero (sin enemigo en la casilla): solo lo rompe
  if (def.target === 'enemy' && !unitAt(s, at) && (s.braziers ?? []).includes(key(at))) {
    breakBrazier(s, at, dirOf(u.pos, at), ev);
    return { ok: true, events: ev };
  }
  // Vínculo etéreo y Paso sombrío: apareces a su espalda
  if (def.behind) {
    const t0 = unitAt(s, at)!;
    const cell = behindCell(s, u, t0)!;
    u.pos = cell;
    ev.push({ t: 'blink', unit: u.id, to: { ...cell } });
    u.behindNow = true;
    // Cuchillas gemelas: el siguiente ataque cuerpo a cuerpo de este turno hace sangrar
    if (hasTrait(u, 'gemelas')) u.twinBlades = true;
  }
  // Caminante de la niebla: tras desplazarte, el placaje no te afecta este turno
  if (hasTrait(u, 'niebla') && (def.teleport || def.behind || def.dash || def.retreat || def.special === 'decoy')) u.mistWalk = true;
  // Paso de medianoche: volverte invisible te cura el 5%
  if (hasTrait(u, 'medianoche') && def.buff?.kind === 'invis') heal(u, u.maxHp * 0.05, ev);
  if (def.dash) {
    const cell = dashCell(s, u, at)!;
    if (!same(cell, u.pos)) {
      u.pos = cell;
      ev.push({ t: 'move', unit: u.id, path: [{ ...cell }] });
    }
  }
  if (def.selfDmg) u.hp = Math.max(1, u.hp - def.selfDmg);
  if (def.selfDmgPct) { const lost = Math.min(u.hp - 1, Math.round(u.hp * def.selfDmgPct)); u.hp -= lost; ev.push({ t: 'damage', unit: u.id, amount: lost, absorbed: 0, crit: false, source: def.id }); }
  if (def.buff) addStatus(u, def.buff.kind, def.buff.turns, def.buff.stacks ?? 1, ev);
  if (def.selfBuff2) addStatus(u, def.selfBuff2.kind, def.selfBuff2.turns, def.selfBuff2.stacks ?? 1, ev);
  if (def.selfMp) { u.mp += def.selfMp; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: def.selfMp }); }
  if (def.hookOnly) { delete u.hooked; u.spells = u.spells.filter((sp) => sp.id !== def.id); }
  if (def.soulShield) { const sh = Math.min(SOUL_SHIELD_CAP, def.soulShield * (u.souls ?? 0)); if (sh > 0) { u.shield += sh; ev.push({ t: 'shield', unit: u.id, amount: sh }); } }
  if (def.special && SELF_SPECIALS[def.special]) { SELF_SPECIALS[def.special]!(s, u, def, at, ev); return { ok: true, events: ev }; }
  if (def.swapShadow) {
    // intercambio con la Sombra: ignora el placaje (Sombra persistente: +2 PM)
    const sh = marksOf(s, 'shadow', u.id).at(-1)!;
    if (hasTrait(u, 'persistente')) { u.mp += 2; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 2 }); }
    const from = { ...u.pos };
    u.pos = { ...sh.pos };
    sh.pos = from;
    ev.push({ t: 'blink', unit: u.id, to: { ...u.pos } }, { t: 'markMove', kind: 'shadow', from: { ...u.pos }, to: { ...from } });
    springSnare(s, u, ev);
    return { ok: true, events: ev };
  }
  if (def.lanternJump) {
    const o = getUnit(s, lanternNear(s, u)!.owner!)!;
    const cell = dashCell(s, u, o.pos)!;
    u.pos = { ...cell };
    ev.push({ t: 'blink', unit: u.id, to: { ...cell } });
    u.spells = u.spells.filter((sp) => sp.id !== def.id);
    // Faro de las sombras: quien toma la linterna se cura
    if (hasTrait(o, 'faro')) heal(u, 10, ev);
    return { ok: true, events: ev };
  }
  if (def.revive) {
    const dead = s.units.find((x) => !alive(x) && same(x.pos, at) && x.team === u.team && x.summoner === undefined)!;
    dead.hp = Math.max(1, Math.round(dead.maxHp * def.revive));
    dead.statuses = {};
    dead.shield = 0;
    dead.used = true;
    ev.push({ t: 'revive', unit: dead.id });
    return { ok: true, events: ev };
  }

  if (def.target === 'cell') {
    if (def.teleport) { u.pos = { ...at }; ev.push({ t: 'blink', unit: u.id, to: { ...at } }); }
    if (def.followUp) {
      // tras aterrizar, el proyectil busca al enemigo visible más cercano
      const fu = def.followUp;
      const foe = s.units.filter((t) => alive(t) && t.team !== u.team && !t.statuses.invis && dist(t.pos, u.pos) <= fu.radius).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
      if (foe) {
        const raw = randInt(s, fu.dmg[0], fu.dmg[1]) + dmgFlat(u, foe);
        hurt(s, foe, raw, ev, def.id, { element: fu.element });
        if (u.essence !== undefined && !essenceSpent) gainEssence(u, 1, ev);
        // remate: se puede volver a usar gratis este turno
        if (def.resetOnKill && !alive(foe) && !s.over) { slotUsed.uses = 0; slotUsed.free = true; ev.push({ t: 'reset', unit: u.id, spell: def.id }); }
      }
    }
    if (def.shadow) placeShadow(s, u, at, def.shadow.turns, ev);
    if (def.special === 'charge') charge(s, u, def, at, ev);
    if (def.special === 'seed') plantSeed(s, u, at, ev);
    if (def.lantern) {
      const ln = def.lantern;
      addMark(s, { kind: 'lantern', pos: at, team: u.team, turns: ln.turns, owner: u.id, max: 1 }, ev);
      const mend = hasTrait(u, 'mender') ? MENDER_MULT : 1;
      for (const a of s.units.filter((x) => alive(x) && x.team === u.team && Math.max(Math.abs(x.pos.x - at.x), Math.abs(x.pos.y - at.y)) <= 1)) {
        const sh = Math.round(ln.shield * mend);
        a.shield += sh;
        ev.push({ t: 'shield', unit: a.id, amount: sh });
        if (ln.heal) heal(a, ln.heal * mend, ev);
      }
      // los aliados (no invocaciones) ganan la acción Tomar la linterna mientras siga en el suelo
      for (const a of s.units.filter((x) => alive(x) && x.team === u.team && x !== u && x.summoner === undefined && x.ai !== 'pillar')) {
        if (!a.spells.some((sp) => sp.id === 'k_farol')) a.spells.push({ id: 'k_farol', cd: 0, temp: true });
      }
    }
    // H5 · Cepos afilados: +6 de daño y sangrado
    if (def.snare) (s.snares ??= []).push({ k: key(at), team: u.team, dmg: Math.round(def.snare.dmg * (1 + u.power / 100)) + (hasTrait(u, 'cepos') ? 6 : 0), ...(def.snare.burn ? { burn: def.snare.burn } : {}), ...(hasTrait(u, 'cepos') ? { bleed: 2 } : {}) });
    if (def.summon) {
      const m = def.summon, hp = Math.round(u.maxHp * m.hpPct);
      const pet = summon(s, { team: u.team, kind: m.kind, name: m.name, owner: null, pos: at, hp, maxHp: hp, shield: 0, armor: m.armor, power: u.power, crit: 5,
        ap: m.ap, maxAp: m.ap, mp: m.mp, maxMp: m.mp, initiative: m.initiative, apMod: 0, mpMod: 0, resist: {}, statusBonus: 0, statuses: {}, spells: [{ id: m.spell, cd: 0 }], ai: 'melee', summoner: u.id }, at, ev);
      if (pet) {
        pet.summoner = u.id;
        // H5 · Vínculo del cetrero: el compañero es más duro y pega más
        if (hasTrait(u, 'cetrero')) { pet.maxHp = pet.hp = Math.round(pet.maxHp * 1.5); pet.power += 2; }
      }
    }
    return { ok: true, events: ev };
  }
  const wantTeam = def.target === 'enemy' || def.target === 'ground' ? (u.team === 'hero' ? 'enemy' : 'hero') : u.team;
  // gancho: se lleva al primer enemigo que encuentre la cadena
  const main = def.cone ? undefined : def.hook || def.firstHit || def.pull ? firstFoeTo(s, u, at) : unitAt(s, at);
  // Fuerza de voluntad: la esfera más antigua vuela a la casilla
  if (def.special === 'throwsphere') {
    const m = marksOf(s, 'sphere', u.id)[0]!;
    const from = { ...m.pos };
    m.pos = { ...at };
    ev.push({ t: 'markMove', kind: 'sphere', from, to: { ...at } });
  }
  // Gravedad inversa: atrae hacia la esfera a los enemigos a 2 casillas (antes de dañarlos)
  if (def.special === 'gravity') for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, at) <= 2 && dist(x.pos, at) > 0).sort((a, b) => dist(a.pos, at) - dist(b.pos, at))) stepToward(s, t, at, ev);
  // Singularidad perfecta: atrae hacia el centro a los enemigos a 2 casillas antes del daño
  if (def.special === 'singularity' && hasTrait(u, 'singperfecta')) for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && x.ai !== 'pillar' && dist(x.pos, at) <= 2 && dist(x.pos, at) > 0).sort((a, b) => dist(a.pos, at) - dist(b.pos, at))) stepToward(s, t, at, ev);
  // Singularidad: cuadrado de 2×2
  const square2 = def.special === 'singularity' ? [at, { x: at.x + 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x + 1, y: at.y + 1 }] : [];
  const lane = def.line ? lineCells(u.pos, at) : def.cone ? coneCells(u.pos, at, def.cone) : [];
  const inArea = (p: Pos): boolean => !!def.area && (def.square ? Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) : dist(p, at)) <= def.area;
  const targets = s.units.filter((t) => alive(t) && t.team === wantTeam && (t === main || inArea(t.pos) || lane.some((p) => same(p, t.pos)) || square2.some((p) => same(p, t.pos)) || (def.special === 'gravity' && dist(t.pos, at) <= 2)));
  // Convergencia letal: la Sombra se lanza junto al objetivo; si lo flanqueáis por lados opuestos, críticos
  let flank = false;
  if (def.special === 'converge' && main) {
    const sh = marksOf(s, 'shadow', u.id).at(-1)!;
    const [dx, dy] = dirOf(main.pos, sh.pos);
    const cell = { x: main.pos.x + dx, y: main.pos.y + dy };
    if (!same(cell, sh.pos) && (isFree(s, cell) || same(cell, u.pos))) { const from = { ...sh.pos }; sh.pos = cell; ev.push({ t: 'markMove', kind: 'shadow', from, to: { ...cell } }); }
    const [ax, ay] = dirOf(main.pos, u.pos), [bx, by] = dirOf(main.pos, sh.pos);
    flank = ax === -bx && ay === -by;
  }
  // Guadaña segadora: tras Sentencia o Corte de Guadaña, el siguiente ataque pega más por las almas del combate
  let reapBonus = 0;
  if (u.reaper && def.dmg) { reapBonus = Math.min(20, 2 * (u.soulsFight ?? 0)); u.reaper = false; }
  // Explosión de almas: gasta hasta 3 almas
  let spent = 0;
  if (def.special === 'soulburst') { spent = Math.min(3, u.soulBank ?? 0); u.soulBank = (u.soulBank ?? 0) - spent; u.spentSouls = spent; }
  // Siega del condenado: gasta hasta 2 almas (+6 cada una); si mata, las recupera y gana 1 más
  if (def.special === 'soulreap') { spent = Math.min(2, u.soulBank ?? 0); u.soulBank = (u.soulBank ?? 0) - spent; u.spentSouls = spent; }
  // Descarga desatada: consume todas tus esferas, +daño por cada una
  let flat = reapBonus + (def.furyScale ? Math.round((u.fury ?? 0) * def.furyScale) : 0);
  // Corte de Guadaña Espectral: +3 por turno sin usarlo (máx. 3) y +1 cada 5 almas del combate (máx. +3)
  const scythe = def.special === 'scythe' ? scytheBonus(u) : 0;
  if (def.special === 'scythe') { u.scytheCharge = 0; u.scytheUsed = true; }
  // Pistolero: con el cargador lleno, crítico seguro y daño elemental extra (y se vacía al final)
  const fullMag = !!def.gun && (u.magazine ?? 0) >= MAG_MAX;
  // Sobrecarga de tambor: 10 por carga y vacía el cargador
  const drum = def.special === 'drum' ? (u.magazine ?? 0) * 10 : 0;
  if (def.special === 'drum') u.magazine = 0;
  // Arquitecto: Geometría Bélica (+2 al siguiente hechizo de daño) y Resonancia geométrica (+3 con 2+ glifos)
  let geo = 0;
  if (def.dmg && u.glyphBonus) { geo = u.glyphBonus; u.glyphBonus = 0; }
  if (def.dmg && hasTrait(u, 'resonanciag') && marksOf(s, 'glyph', u.id).length >= 2) geo += 3;
  const flatAll = spent * 6 + scythe + drum + geo + (fullMag ? MAG_FULL_FLAT + (hasTrait(u, 'cargaench') ? 4 : 0) : 0);
  if (def.consume) {
    const mine = marksOf(s, 'sphere', u.id);
    flat = mine.length * def.consume.per;
    for (const m of mine) { removeMark(s, m, ev); sphereBurst(s, u, m.pos, ev); }
  }
  // Implosión: cada esfera daña a los enemigos pegados a ella
  if (def.detonate) {
    const dn = def.detonate;
    for (const m of marksOf(s, 'sphere', u.id)) {
      for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && (dn.square ? Math.max(Math.abs(x.pos.x - m.pos.x), Math.abs(x.pos.y - m.pos.y)) : dist(x.pos, m.pos)) <= dn.area)) {
        if (s.over) break;
        hurt(s, t, randInt(s, dn.dmg[0], dn.dmg[1]) + dmgFlat(u, t), ev, def.id, { element: def.element });
      }
      if (!def.keepSpheres) removeMark(s, m, ev);
      else ev.push({ t: 'markAdd', kind: 'pulse', at: { ...m.pos } });
    }
  }
  const mend = hasTrait(u, 'mender') ? MENDER_MULT : 1;
  let dealt = 0;
  let hits = 0;
  // el orbe rebota: recorre la línea dos veces
  for (let pass = 0; pass < (def.bounce ?? 1); pass++)
  for (const t of pass ? [...targets].reverse() : targets) {
    if (s.over || !alive(t)) continue;
    if (def.dmg) {
      // Aura de astucia: los enemigos pegados a quien la tiene pierden un 10% de crítico
      const astute = s.units.some((z) => alive(z) && z.team !== u.team && hasTrait(z, 'astucia') && dist(z.pos, u.pos) <= 1) ? 10 : 0;
      // Tirador nato: a más de 4 casillas, +15% de crítico; Tiro certero: probabilidad doble
      const far = (hasTrait(u, 'tiradornato') && dist(u.pos, t.pos) > 4 ? 15 : 0) + (hasTrait(u, 'ojocert') && u.statuses.reach ? 15 : 0);
      const crit = flank || fullMag || (!!def.invisCrit && wasInvis) || rand(s) * 100 < (u.crit + furyCrit(u) + (def.crit ?? 0) + far) * (def.critMul ?? 1) - astute;
      const melee = dist(u.pos, t.pos) <= 1;
      const furyBefore = u.fury ?? 0;
      // Doble filo letal: con una Sombra al otro lado, los críticos ignoran la armadura
      const opposite = hasTrait(u, 'doblefilo') && marksOf(s, 'shadow', u.id).some((m) => { const [ax, ay] = dirOf(t.pos, u.pos), [bx, by] = dirOf(t.pos, m.pos); return ax === -bx && ay === -by && (ax || ay); });
      const pen = hasTrait(u, 'titanico') && furyBefore > 80 && melee ? 0.2 : 0;
      const pack = hasTrait(u, 'pack') ? s.units.filter((o) => o !== u && o.team === u.team && alive(o) && hasTrait(o, 'pack')).length * PACK_BONUS : 0;
      const fury = hasTrait(u, 'enrage') && u.hp < u.maxHp / 2 ? ENRAGE_POWER : 0;
      const raw = (randInt(s, def.dmg[0], def.dmg[1]) + (t === main ? flat : 0) + flatAll + dmgFlat(u, t, pack + fury) + (crit ? critFlat(u) : 0)) * (t === main || def.range[1] === 0 || def.line || def.cone || square2.length ? 1 : def.areaPct ?? (def.fullArea ? 1 : 0.5)) * (pass ? 0.5 : 1);
      // Lanza resonante: +4 contra enemigos sobre o junto a un glifo tuyo
      const lres = def.id === 'r_lanza' && hasTrait(u, 'lanzares') && marksOf(s, 'glyph', u.id).some((m) => dist(m.pos, t.pos) <= 1) ? 4 : 0;
      // G3.4: daño extra contra objetivos con un estado concreto (Flecha ígnea contra quemados…); G3.3: Distancia letal
      const vs = def.bonusVs && t.statuses[def.bonusVs.kind] ? def.bonusVs.dmg : 0;
      const prey = hasTrait(u, 'presa') && slowed(t) ? PREY_BONUS : 0;
      const got = hurt(s, t, raw + lres + vs + prey + archerBonus(u, t), ev, def.id, { crit, element: fullMag ? 'fire' : def.element, pierce: def.pierce || (crit && opposite) || (!!def.gun && !!u.statuses.silver), armorPen: pen, armorFlat: def.armorIgnore });
      // Munición incendiaria: el disparo con el cargador lleno quema
      if (fullMag && hasTrait(u, 'incendiaria') && alive(t) && !pass) addStatus(t, 'burn', 2, 1, ev);
      if (!pass) {
        // H5 · Puntas de escarcha: los disparos a 4 casillas o más ralentizan
        if (hasTrait(u, 'escarcha') && alive(t) && t.team !== u.team && dist(u.pos, t.pos) >= 4) addStatus(t, 'slow', 1, 1, ev);
        // H5 · Paso del cazador: rematar a distancia da +2 PM (una vez por turno)
        if (hasTrait(u, 'pasocaz') && !alive(t) && t.team !== u.team && !melee && !u.huntUsed) { u.huntUsed = true; u.mp += 2; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 2 }); }
        // Zorro de fuego: lo que golpea en línea recta quema 2 turnos
        if (hasTrait(u, 'zfuego') && alive(t) && (def.line || def.straight || def.firstHit)) addStatus(t, 'burn', 2, 1, ev);
        // Espina de la Madre Raíz: los golpes envenenan
        if (hasTrait(u, 'espina') && alive(t)) addStatus(t, 'poison', 2, 1, ev);
        // Velo de Mil Esporas: quien te golpea cuerpo a cuerpo queda ralentizado
        if (hasTrait(t, 'esporas') && melee && alive(u) && alive(t)) addStatus(u, 'slow', 1, 1, ev);
        // Zarpas del Alfa: los críticos curan 4
        if (crit && got > 0 && hasTrait(u, 'alfa')) heal(u, 4, ev);
        // Cuchillas gemelas: tras aparecer a su espalda, el golpe cuerpo a cuerpo hace sangrar
        if (u.twinBlades && melee && alive(t)) addStatus(t, 'bleed', 2, 1, ev);
        // Reflejo ilusorio: golpe cuerpo a cuerpo recibido → señuelo y empujón (1 vez por ronda)
        if (alive(t) && melee && hasTrait(t, 'reflejo') && t.reflexRound !== s.round && alive(u)) { t.reflexRound = s.round; illusion(s, t, u, ev); }
        if (!alive(t) && melee) {
          // Ejecución sigilosa: remate cuerpo a cuerpo siendo invisible o tras aparecer a su espalda
          if (hasTrait(u, 'ejecsig') && (u.statuses.invis || u.behindNow)) { u.mp++; u.mistWalk = true; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
          // Matasangre: remate cuerpo a cuerpo con la Furia al máximo
          if (hasTrait(u, 'matasangre') && furyBefore >= FURY_MAX && !u.bloodUsed) { u.bloodUsed = true; u.ap += 2; ev.push({ t: 'drain', unit: u.id, ap: 2, mp: 0 }); }
        }
      }
      dealt += got;
      hits++;
      // Órbita defensiva: el primer enemigo que la golpea cuerpo a cuerpo sale despedido
      if (t.statuses.orbita && alive(u) && dist(u.pos, t.pos) <= 1 && u.team !== t.team) { delete t.statuses.orbita; push(s, t.pos, u, 1, ev); }
      // espinas: devuelven parte del daño cuerpo a cuerpo
      if (got > 0 && hasTrait(t, 'thorns') && dist(t.pos, u.pos) <= 1 && alive(u)) hurt(s, u, got * THORNS, ev, 'thorns', { pierce: true });
      if (hasTrait(u, 'ignite') && alive(t) && !pass) addStatus(t, 'burn', 2, 1, ev);
    }
    // a la vuelta del orbe solo se repite el daño: los efectos se aplican una vez
    if (pass) continue;
    if (def.heal) heal(t, def.heal * mend, ev);
    if (def.healPct) heal(t, t.maxHp * def.healPct * mend, ev);
    if (def.shield && alive(t)) {
      const sh = Math.round(def.shield * mend);
      t.shield += sh;
      ev.push({ t: 'shield', unit: t.id, amount: sh });
    }
    applyStatuses(s, u, t, def, ev);
    if (def.drainAp && alive(t)) {
      const n = t.team !== u.team ? landed(s, t, def.drainAp) : def.drainAp;
      if (n < def.drainAp) ev.push({ t: 'resist', unit: t.id, what: `Resiste ${def.drainAp - n} PA` });
      if (n) { t.apMod -= n; ev.push({ t: 'drain', unit: t.id, ap: -n, mp: 0 }); }
    }
    if (def.drainMp && alive(t)) {
      const n = t.team !== u.team ? landed(s, t, def.drainMp) : def.drainMp;
      if (n < def.drainMp) ev.push({ t: 'resist', unit: t.id, what: `Resiste ${def.drainMp - n} PM` });
      if (n) { t.mpMod -= n; ev.push({ t: 'drain', unit: t.id, ap: 0, mp: -n }); }
    }
    if (def.giveAp) t.apMod += def.giveAp;
    if (def.giveMp) t.mpMod += def.giveMp;
    if (def.push && def.pushAll && t !== main && alive(t)) {
      const n = landed(s, t, def.push);
      if (n < def.push) ev.push({ t: 'resist', unit: t.id, what: n ? 'Resiste parte del empujón' : 'Resiste el empujón' });
      if (n) push(s, u.pos, t, n, ev);
    }
    if (def.push && t === main) {
      const n = landed(s, t, def.push);
      if (n < def.push) ev.push({ t: 'resist', unit: t.id, what: n ? 'Resiste parte del empujón' : 'Resiste el empujón' });
      if (n) push(s, u.pos, t, n, ev);
    }
  }
  hitBraziers(s, u, def, at, ev);
  // H5: remate con un golpe directo (Decapitar): se puede repetir gratis este turno
  if (def.resetOnKill && def.target === 'enemy' && main && !alive(main) && main.team !== u.team && !s.over) { slotUsed.uses = 0; slotUsed.free = true; ev.push({ t: 'reset', unit: u.id, spell: def.id }); }
  if (u.twinBlades && def.dmg && targets.some((t) => dist(t.pos, u.pos) <= 1)) u.twinBlades = false;
  // Juicio del inframundo: tu hechizo más caro da 1 alma extra si alcanza a un élite o jefe
  if (hasTrait(u, 'juicio') && u.souls !== undefined && hits > 0 && def.ap >= Math.max(...u.spells.filter((sp) => !sp.temp && sp.charges === undefined).map((sp) => SPELLS[sp.id]?.ap ?? 0))) {
    const big = targets.find((t) => t.rank && t.team !== u.team);
    if (big) gainSoul(s, u, big.pos, ev);
  }
  // Prisión ineludible: enganchados y aturdidos quedan con la Huida a la mitad
  if (hasTrait(u, 'prision')) for (const t of targets) if (alive(t) && t.team !== u.team && (def.hook || t.statuses.stun)) addStatus(t, 'hobble', 1, 1, ev);
  if (def.dmg && slotUsed.charges === undefined && alive(u) && !def.noEcho) shadowEcho(s, u, def, main, targets, ev);
  // Convergencia: la Sombra golpea con todo su daño (crítico si flanquea)
  if (def.special === 'converge' && main && alive(main) && def.dmg) { hurt(s, main, randInt(s, def.dmg[0], def.dmg[1]) + dmgFlat(u, main) + (flank ? critFlat(u) : 0), ev, 'sombra', { crit: flank, element: def.element, pierce: flank && hasTrait(u, 'doblefilo') }); if (!alive(main)) huntKill(u, ev); }
  if (def.special && TARGET_SPECIALS[def.special]) TARGET_SPECIALS[def.special]!(s, u, def, at, main, targets, hits, ev);
  if (def.gun) gunAfter(s, u, def, main, targets, fullMag, ev);
  // Furia: +20 por lanzamiento que golpea (o por enemigo); el doble contra la presa de Mirada del verdugo
  if (u.fury !== undefined && hits > 0) {
    const prey = targets.some((t) => t.statuses.verdugo?.from === u.id) ? 2 : 1;
    addFury(u, furyGain(u, (def.furyPer ? def.furyPer * targets.length : 20) * prey), ev);
  }
  // Condenación eterna: los enemigos controlados pueden soltar un alma sin morir
  if (hasTrait(u, 'condena') && u.souls !== undefined && (def.hook || def.push || def.pull || def.status?.kind === 'stun'))
    for (const t of targets) if (alive(t) && t.team !== u.team && rand(s) < 0.5) gainSoul(s, u, t.pos, ev);
  if ((def.id === 'k_sentencia' || def.id === 'k_guadana' || def.id === 'k_despellejar') && hasTrait(u, 'guadana')) u.reaper = true;
  if (def.cone && def.push) coneBlast(s, u, def, at, targets, ev);
  const pullN = def.hook?.pull ?? def.pull ?? 0;
  if (pullN && main && alive(main) && alive(u) && main.team !== u.team) {
    // arrastra al enganchado hacia ti (élites y jefes: dos tiradas por casilla)
    const n = landed(s, main, pullN);
    if (n < pullN) ev.push({ t: 'resist', unit: main.id, what: n ? 'Resiste parte del arrastre' : 'Resiste el arrastre' });
    for (let i = 0; i < n && dist(main.pos, u.pos) > 1; i++) {
      // el arrastre sigue a quien tira, aunque no esté en línea recta
      const [dx, dy] = dirOf(main.pos, u.pos);
      const p = { x: main.pos.x + dx, y: main.pos.y + dy };
      if (!isFree(s, p)) break;
      main.pos = p;
      ev.push({ t: 'push', unit: main.id, to: { ...p } });
      springSnare(s, main, ev);
      if (stepOn(s, main, ev)) break;
    }
    if (def.hook) {
      u.hooked = main.id;
      if (!u.spells.some((sp) => sp.id === 'k_viaje')) u.spells.push({ id: 'k_viaje', cd: 0, temp: true });
    }
  }
  if (def.sphereShield && alive(u)) {
    const sh = def.sphereShield * marksOf(s, 'sphere', u.id).length;
    if (sh > 0) { u.shield += sh; ev.push({ t: 'shield', unit: u.id, amount: sh }); }
  }
  if (def.sphere && alive(u)) addSphere(s, u, at, def.sphere.turns, def.sphere.max, ev);
  if (def.special === 'singularity' && alive(u)) for (const p of [at, square2[3]!]) if (p.x < s.w && p.y < s.h && !s.obstacles.includes(key(p))) addSphere(s, u, p, 2, 4, ev);
  if (u.essence !== undefined && hits > 0 && !essenceSpent) gainEssence(u, 1, ev);
  if (u.essence !== undefined && def.pull && hasTrait(u, 'mirada') && main && !essenceSpent) gainEssence(u, 1, ev);
  if (def.lifesteal && dealt > 0) heal(u, dealt * def.lifesteal, ev);
  if (def.retreat && main && alive(u)) {
    const dx = Math.abs(u.pos.x - main.pos.x) >= Math.abs(u.pos.y - main.pos.y) ? Math.sign(u.pos.x - main.pos.x) || 1 : 0;
    const dy = dx === 0 ? Math.sign(u.pos.y - main.pos.y) || 1 : 0;
    for (let i = 0; i < def.retreat; i++) {
      const n = { x: u.pos.x + dx, y: u.pos.y + dy };
      if (!isFree(s, n)) break;
      u.pos = n;
      ev.push({ t: 'push', unit: u.id, to: { ...n } });
    }
  }
  if (def.selfShield && alive(u)) {
    u.shield += def.selfShield;
    ev.push({ t: 'shield', unit: u.id, amount: def.selfShield });
  }
  return { ok: true, events: ev };
}

/**
 * Onda en cono: primero salen las esferas del cono y luego se empuja a los enemigos, todo en la dirección del lanzamiento.
 * Una esfera que atraviesa a un enemigo lo daña y lo aturde (élites y jefes son inmunes a aturdir).
 */
function coneBlast(s: CombatState, u: Unit, def: SpellDef, at: Pos, targets: Unit[], ev: GameEvent[]): void {
  const [dx, dy] = dirOf(u.pos, at);
  const far = (p: Pos): number => -(dx * (p.x - u.pos.x) + dy * (p.y - u.pos.y));
  // 1) las esferas salen disparadas y atraviesan a los enemigos que encuentran (incluido el que tengan encima)
  const cone = coneCells(u.pos, at, def.cone!);
  const stunned = new Set<number>();
  const strike = (m: { pos: Pos }, hitBy: Set<number>): void => {
    const foe = s.units.find((x) => alive(x) && x.team !== u.team && same(x.pos, m.pos) && !hitBy.has(x.id));
    if (!foe || !def.sphereHit || s.over) return;
    hitBy.add(foe.id);
    const sh = def.sphereHit;
    hurt(s, foe, randInt(s, sh.dmg[0], sh.dmg[1]) + dmgFlat(u, foe), ev, 'esfera', { element: def.element });
    if (!alive(foe) || stunned.has(foe.id)) return;
    stunned.add(foe.id);
    if (foe.rank) ev.push({ t: 'resist', unit: foe.id, what: 'Inmune a aturdir' });
    else addStatus(foe, 'stun', sh.stun, 1, ev);
  };
  for (const m of marksOf(s, 'sphere', u.id).filter((m) => cone.some((p) => same(p, m.pos))).sort((a, b) => far(a.pos) - far(b.pos))) {
    const from = { ...m.pos }, hitBy = new Set<number>();
    strike(m, hitBy);
    for (let i = 0; i < def.push! && !s.over; i++) {
      const n = { x: m.pos.x + dx, y: m.pos.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= s.w || n.y >= s.h || s.obstacles.includes(key(n))) break;
      m.pos = n;
      strike(m, hitBy);
    }
    if (!same(from, m.pos)) { ev.push({ t: 'markMove', kind: m.kind, from, to: { ...m.pos } }); if (hasTrait(u, 'resonante') && marksOf(s, 'sphere', u.id).some((o) => o !== m && dist(o.pos, m.pos) <= 1)) resonate(s, u, m.pos, ev); }
  }
  // 2) la onda empuja a los enemigos alcanzados, primero los más lejanos para que no se bloqueen
  for (const t of [...targets].sort((a, b) => far(a.pos) - far(b.pos))) {
    if (!alive(t) || s.over) continue;
    const n = landed(s, t, def.push!);
    if (n < def.push!) ev.push({ t: 'resist', unit: t.id, what: n ? 'Resiste parte del empujón' : 'Resiste el empujón' });
    if (n) pushDir(s, t, dx, dy, n, ev);
  }
}

/** Aplica los estados de un hechizo a `t` (resistencias de élites y jefes incluidas). */
function applyStatuses(s: CombatState, u: Unit, t: Unit, def: SpellDef, ev: GameEvent[]): void {
  for (const st of [def.status, def.extraStatus]) {
    if (!st || !alive(t)) continue;
    // el encanto de élites y jefes exige las dos tiradas
    if (st.kind === 'charm' && t.rank && !landed(s, t, 1)) { ev.push({ t: 'resist', unit: t.id, what: 'Resiste el encanto' }); continue; }
    // élites y jefes: inmunes a aturdir y resisten la ralentización punto a punto
    if (st.kind === 'stun' && (t.rank || t.statuses.frenzy)) { ev.push({ t: 'resist', unit: t.id, what: 'Inmune a aturdir' }); continue; }
    let stacks = (st.stacks ?? 1) + (st.kind === 'poison' && hasTrait(u, 'venom') ? 1 : 0);
    if (st.kind === 'slow' && t.team !== u.team) {
      const want = stacks;
      stacks = landed(s, t, want);
      if (stacks < want) ev.push({ t: 'resist', unit: t.id, what: `Resiste ${want - stacks} PM` });
      if (!stacks) continue;
      ev.push({ t: 'drain', unit: t.id, ap: 0, mp: -stacks });
    }
    const extra = st.kind === 'charm' && hasTrait(u, 'mirada') && !t.rank ? 1 : 0;
    addStatus(t, st.kind, st.turns + extra + (st.kind === 'stun' || st.kind === 'deathmark' ? 0 : u.statusBonus), st.kind === 'deathmark' ? 0 : stacks, ev);
    const now = t.statuses[st.kind];
    if (now && (st.kind === 'charm' || st.kind === 'deathmark' || st.kind === 'guarded' || st.kind === 'verdugo' || st.kind === 'chained' || st.kind === 'anchor')) now.from = u.id;
  }
}

/**
 * La Sombra replica un hechizo de daño desde su casilla, al porcentaje de daño de Sombra viviente (50%).
 * Hechizos a tu alrededor: golpea a los pegados a la Sombra. El resto: al mismo objetivo, si lo ve y le llega.
 * Los estados solo se aplican a quien no los recibió ya del golpe principal (sin control doble).
 */
function shadowEcho(s: CombatState, u: Unit, def: SpellDef, main: Unit | undefined, already: Unit[], ev: GameEvent[]): void {
  for (const sh of marksOf(s, 'shadow', u.id)) echoFrom(s, u, def, main, already, sh, ev);
}

function echoFrom(s: CombatState, u: Unit, def: SpellDef, main: Unit | undefined, already: Unit[], sh: { pos: Pos }, ev: GameEvent[]): void {
  const pct = spellOf(u, 's_sombra')?.shadow?.echo ?? 0.5;
  let foes: Unit[] = [];
  if (def.range[1] === 0 && def.area) foes = s.units.filter((t) => alive(t) && t.team !== u.team && !t.statuses.invis && dist(t.pos, sh.pos) <= def.area!);
  else if (main && alive(main) && main.team !== u.team && dist(sh.pos, main.pos) <= def.range[1] + 1 && hasLineOfSight(s, sh.pos, main.pos)) foes = [main];
  for (const t of foes) {
    if (s.over || !alive(t)) continue;
    ev.push({ t: 'echo', unit: u.id, from: { ...sh.pos }, at: { ...t.pos }, element: def.element });
    if (t === main) u.syncHit = true;
    const raw = (randInt(s, def.dmg![0], def.dmg![1]) + dmgFlat(u, t)) * pct;
    hurt(s, t, raw, ev, 'sombra', { element: def.element });
    if (!alive(t)) huntKill(u, ev);
    if (!already.includes(t)) applyStatuses(s, u, t, def, ev);
  }
}

/** Primer enemigo visible en la línea recta de `u` hacia `at`. */
function firstFoeTo(s: CombatState, u: Unit, at: Pos): Unit | undefined {
  const [dx, dy] = dirOf(u.pos, at);
  for (let i = 1; i <= dist(u.pos, at); i++) {
    const t = unitAt(s, { x: u.pos.x + dx * i, y: u.pos.y + dy * i });
    if (t && alive(t) && t.team !== u.team && !t.statuses.invis) return t;
  }
  return unitAt(s, at);
}

export function endTurn(s: CombatState, unitId: number): ActionResult {
  const u = actor(s, unitId);
  if (typeof u === 'string') return fail(u);
  const ev: GameEvent[] = [];
  flamesFly(s, u, ev);
  // Marca de la muerte: estalla al final del turno de quien la puso, con todo el daño guardado
  for (const t of s.units) {
    const dmk = t.statuses.deathmark;
    if (!dmk || dmk.from !== u.id || !alive(t) || s.over) continue;
    delete t.statuses.deathmark;
    ev.push({ t: 'detonate', unit: t.id, amount: dmk.stacks });
    if (dmk.stacks > 0) hurt(s, t, dmk.stacks, ev, 'marca', { pierce: true });
  }
  if (!s.over) beginNext(s, ev);
  return { ok: true, events: ev };
}

/** Añade una unidad en la casilla libre más cercana a `near`. Juega al final del orden. */
export function summon(s: CombatState, spec: UnitSpec, near: Pos, ev: GameEvent[]): Unit | null {
  const cells = [...reachable(s, near, 4, true).cost.entries()].sort((a, b) => a[1] - b[1]);
  for (const [k] of cells) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (!isFree(s, { x, y })) continue;
    const u: Unit = { ...spec, pos: { x, y }, statuses: {}, spells: spec.spells.map((sp) => ({ ...sp })), id: s.nextId++ };
    s.units.push(u);
    s.order.push(u.id);
    ev.push({ t: 'summon', unit: u.id });
    return u;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mecánicas propias de las clases nuevas
// ---------------------------------------------------------------------------

/** Robo de esencia: cura el 15% (con Esencia desbordante, lo que sobra se vuelve escudo). */
function essenceHeal(u: Unit, ev: GameEvent[]): void {
  const amount = Math.round(u.maxHp * 0.15);
  const real = Math.min(u.maxHp - u.hp, amount);
  heal(u, amount, ev);
  if (hasTrait(u, 'esencia2') && amount - real > 0) { u.shield += amount - real; ev.push({ t: 'shield', unit: u.id, amount: amount - real }); }
}

/** Pone una esfera (Poder ilimitado: hasta 5 y 1 turno más). */
function addSphere(s: CombatState, u: Unit, at: Pos, turns: number, max: number, ev: GameEvent[]): void {
  // el máximo sale de la mejor versión que tengas de un hechizo de esferas (las bendiciones lo suben)
  let cap = Math.max(max, ...u.spells.map((sp) => spellOf(u, sp.id)?.sphere?.max ?? 0));
  if (hasTrait(u, 'poder')) { cap = Math.max(cap, 5); turns++; }
  const touching = hasTrait(u, 'resonante') && marksOf(s, 'sphere', u.id).some((m) => dist(m.pos, at) <= 1);
  addMark(s, { kind: 'sphere', pos: at, team: u.team, turns, owner: u.id, max: cap }, ev);
  if (touching) resonate(s, u, at, ev);
}

/** Semillas oscuras vivas de `u`. */
export const seedsOf = (s: CombatState, u: Unit): Unit[] => s.units.filter((x) => x.seed !== undefined && x.summoner === u.id && alive(x));

/** Red de implosión (pasiva): activa si `u` tiene a la vez Semilla oscura e Implosión. */
export const implosionNet = (u: Unit): boolean => u.spells.some((sp) => sp.id === 't_semilla') && u.spells.some((sp) => sp.id === 't_implosion');

/** Conexión entre dos semillas consecutivas de una fila o columna; `cells` son las casillas de entre medias. */
export interface SeedLink { a: number; b: number; cells: Pos[] }

/**
 * Conexiones de la Red de implosión de `u`: cada semilla se une a la siguiente de su fila y de su columna
 * (nunca en diagonal), si entre las dos no hay obstáculos. Se calcula siempre sobre las posiciones actuales,
 * así que aparecer, moverse, consumirse o destruirse una semilla cambia las conexiones al momento.
 */
export function seedLinks(s: CombatState, u: Unit): SeedLink[] {
  if (!implosionNet(u)) return [];
  const seeds = seedsOf(s, u), out: SeedLink[] = [];
  const blocked = new Set(s.obstacles);
  for (const sd of seeds) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      // la semilla más cercana en esa dirección (la de en medio corta la conexión con las de más allá)
      const next = seeds.filter((o) => o !== sd && (dx ? o.pos.y === sd.pos.y && o.pos.x > sd.pos.x : o.pos.x === sd.pos.x && o.pos.y > sd.pos.y))
        .sort((p, q) => (dx ? p.pos.x - q.pos.x : p.pos.y - q.pos.y))[0];
      if (!next) continue;
      const cells: Pos[] = [];
      let ok = true;
      for (let k = 1; ; k++) {
        const p = { x: sd.pos.x + dx * k, y: sd.pos.y + dy * k };
        if (p.x === next.pos.x && p.y === next.pos.y) break;
        if (blocked.has(key(p))) { ok = false; break; }
        cells.push(p);
      }
      if (ok) out.push({ a: sd.id, b: next.id, cells });
    }
  }
  return out;
}

/** Semillas de la misma red que `seedId` (incluidas las conectadas a través de otras). Sin conexiones: solo ella. */
export function seedNetwork(s: CombatState, u: Unit, seedId: number): { seeds: number[]; links: SeedLink[] } {
  const links = seedLinks(s, u), seen = new Set([seedId]), q = [seedId];
  while (q.length) { const id = q.shift()!; for (const l of links) for (const [x, y] of [[l.a, l.b], [l.b, l.a]] as const) if (x === id && !seen.has(y)) { seen.add(y); q.push(y); } }
  return { seeds: [...seen], links: links.filter((l) => seen.has(l.a)) };
}

/** Casillas que alcanzaría una Implosión sobre `seedId`: alrededor de cada semilla de la red y el interior de sus conexiones. */
export function implodePreview(s: CombatState, u: Unit, seedId: number): { seeds: Pos[]; blast: Pos[]; lines: Pos[] } {
  const net = seedNetwork(s, u, seedId), seeds = net.seeds.map((id) => getUnit(s, id)).filter((x): x is Unit => !!x).map((x) => ({ ...x.pos }));
  const blast: Pos[] = [];
  for (const p of seeds) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const q = { x: p.x + dx, y: p.y + dy }; if (q.x >= 0 && q.y >= 0 && q.x < s.w && q.y < s.h && !blast.some((b) => same(b, q))) blast.push(q); }
  return { seeds, blast, lines: net.links.flatMap((l) => l.cells) };
}

/** Semilla oscura: una unidad quieta de 20 de vida que ocupa la casilla (no juega turnos). */
function plantSeed(s: CombatState, u: Unit, at: Pos, ev: GameEvent[]): void {
  const sd = summon(s, { team: u.team, kind: 'semilla', name: 'Semilla oscura', owner: null, pos: at, hp: SEED_HP, maxHp: SEED_HP, shield: 0, armor: 0, power: 0, crit: 0,
    ap: 0, maxAp: 0, mp: 0, maxMp: 0, initiative: 0, apMod: 0, mpMod: 0, resist: {}, statusBonus: 0, statuses: {}, spells: [], ai: 'pillar', summoner: u.id, traits: ['semilla'] }, at, ev);
  if (!sd) return;
  sd.seed = 0;
  // no juega turnos: fuera del orden
  s.order = s.order.filter((id) => id !== sd.id);
}

/** Pone una Sombra del Acechador (Maestro de las sombras: hasta 2; Sombra persistente: 1 turno más). */
function placeShadow(s: CombatState, u: Unit, at: Pos, turns: number, ev: GameEvent[]): void {
  addMark(s, { kind: 'shadow', pos: at, team: u.team, turns: turns + (hasTrait(u, 'persistente') ? 1 : 0), owner: u.id, max: hasTrait(u, 'maestro') ? 2 : 1 }, ev);
  if (!u.spells.some((sp) => sp.id === 's_cambio')) u.spells.push({ id: 's_cambio', cd: 0, temp: true });
}

/** Casillas vecinas (8) dentro del tablero y sin obstáculo. */
function around(s: CombatState, p: Pos): Pos[] {
  const out: Pos[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
    const q = { x: p.x + dx, y: p.y + dy };
    if (q.x >= 0 && q.y >= 0 && q.x < s.w && q.y < s.h && !s.obstacles.includes(key(q))) out.push(q);
  }
  return out;
}

/** Fuego zorruno: al acabar el turno, cada llama vuela al enemigo más cercano (a 3); empate: menos vida y luego menos resistencias. */
function flamesFly(s: CombatState, u: Unit, ev: GameEvent[]): void {
  const flames = marksOf(s, 'flame', u.id);
  if (!flames.length) return;
  const def = spellOf(u, 'z_fuego');
  const dmg = def?.dmg ?? [3, 4];
  const resSum = (t: Unit): number => !FEATURES.resistances ? 0 : Object.values(t.resist ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const prev = casting;
  casting = u.id;
  try {
  for (const f of flames) {
    removeMark(s, f, ev);
    if (s.over || !alive(u)) continue;
    const t = s.units.filter((x) => alive(x) && x.team !== u.team && !x.statuses.invis && x.ai !== 'pillar' && dist(x.pos, u.pos) <= 3)
      .sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos) || a.hp - b.hp || resSum(a) - resSum(b))[0];
    if (!t) continue;
    ev.push({ t: 'flame', unit: u.id, from: { ...f.pos }, at: { ...t.pos } });
    hurt(s, t, randInt(s, dmg[0], dmg[1]) + dmgFlat(u, t), ev, 'z_fuego', { element: def?.element ?? 'fire' });
    if (def?.status && alive(t)) applyStatuses(s, u, t, def, ev);
    if (u.essence !== undefined) u.essence = Math.min(essenceNeed(u), u.essence + 1);
  }
  } finally { casting = prev; }
}

/** Embiste giratorio: carga en línea recta ignorando el placaje; daña a quien atraviesa y a los pegados al aterrizar. */
function charge(s: CombatState, u: Unit, def: SpellDef, at: Pos, ev: GameEvent[]): void {
  const [dx, dy] = dirOf(u.pos, at);
  const path: Pos[] = [];
  for (let p = { ...u.pos }; !same(p, at);) { p = { x: p.x + dx, y: p.y + dy }; path.push({ ...p }); }
  const passed = s.units.filter((t) => alive(t) && t.team !== u.team && path.some((p) => same(p, t.pos)));
  u.pos = { ...at };
  ev.push({ t: 'move', unit: u.id, path });
  springSnare(s, u, ev);
  const hit = [...new Set([...passed, ...s.units.filter((t) => alive(t) && t.team !== u.team && t.ai !== 'pillar' && dist(t.pos, u.pos) === 1)])];
  // +2 de daño por cada 20 de Furia que tengas al lanzarlo
  const furyBonus = Math.floor((u.fury ?? 0) / 20) * 2;
  const damaged: Unit[] = [];
  for (const t of hit) {
    if (s.over || !alive(t) || !def.dmg) continue;
    const crit = rand(s) * 100 < u.crit + furyCrit(u) + (def.crit ?? 0);
    const got = hurt(s, t, randInt(s, def.dmg[0], def.dmg[1]) + furyBonus + dmgFlat(u, t) + (crit ? critFlat(u) : 0), ev, def.id, { crit });
    if (got > 0) damaged.push(t);
  }
  if (damaged.length) { u.furyHot = true; addFury(u, furyGain(u, damaged.reduce((n, t) => n + 20 * (t.statuses.verdugo?.from === u.id ? 2 : 1), 0)), ev); }
  // Torbellino sangriento: si golpea a 2 o más, cuesta 1 PA menos
  if (hit.length >= 2 && hasTrait(u, 'torbellino')) { u.ap++; ev.push({ t: 'drain', unit: u.id, ap: 1, mp: 0 }); }
}

type SelfSpecial = (s: CombatState, u: Unit, def: SpellDef, at: Pos, ev: GameEvent[]) => void;
type TargetSpecial = (s: CombatState, u: Unit, def: SpellDef, at: Pos, main: Unit | undefined, targets: Unit[], hits: number, ev: GameEvent[]) => void;

/** Hechizos sin objetivo de daño: todo su efecto está aquí. */
const SELF_SPECIALS: Record<string, SelfSpecial> = {
  // Fuego zorruno: 3 llamas azules a su alrededor; vuelan al acabar el turno
  fatuo: (s, u, _d, _at, ev) => {
    const cells = around(s, u.pos).slice(0, 3);
    for (const p of cells) addMark(s, { kind: 'flame', pos: p, team: u.team, turns: 99, owner: u.id }, ev);
  },
  // Espejismo ilusorio: deja un señuelo y retrocede 2 casillas ignorando el placaje
  decoy: (s, u, _d, _at, ev) => {
    const from = { ...u.pos };
    const foe = s.units.filter((x) => alive(x) && x.team !== u.team).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
    const [dx, dy] = foe ? dirOf(foe.pos, u.pos) : [-1, 0];
    const dirs = [[dx || 0, dy || 0], [dy, dx], [-dy, -dx]].filter(([a, b]) => a || b) as [number, number][];
    for (const [ax, ay] of dirs) {
      let p = { ...u.pos };
      for (let i = 0; i < 2; i++) { const n = { x: p.x + ax, y: p.y + ay }; if (!isFree(s, n)) break; p = n; }
      if (!same(p, u.pos)) { u.pos = p; ev.push({ t: 'blink', unit: u.id, to: { ...p } }); break; }
    }
    summon(s, { ...u, name: 'Señuelo', owner: null, hp: 1, maxHp: 1, shield: 0, armor: 0, statuses: {}, spells: [], ai: 'decoy', summoner: u.id, traits: ['taunt'], essence: undefined, initiative: 0 }, from, ev);
    // G3.4: el engaño alimenta el Robo de esencia
    gainEssence(u, 1, ev);
  },
  // Órbita defensiva: consume la esfera más cercana: escudo y repele al primero que te golpee cuerpo a cuerpo
  orbit: (s, u, d, _at, ev) => {
    const m = marksOf(s, 'sphere', u.id).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos))[0]!;
    removeMark(s, m, ev);
    sphereBurst(s, u, m.pos, ev);
    const sh = Math.round((d.shield ?? 10) * (hasTrait(u, 'mender') ? MENDER_MULT : 1));
    u.shield += sh;
    ev.push({ t: 'shield', unit: u.id, amount: sh });
    addStatus(u, 'orbita', 2, 1, ev);
  },
  // Transfusión de vacío: consume la esfera más antigua y recupera 2 PA
  transfuse: (s, u, _d, _at, ev) => {
    const m = marksOf(s, 'sphere', u.id)[0]!;
    const at = { ...m.pos };
    removeMark(s, m, ev);
    sphereBurst(s, u, at, ev);
    // Tracción astral: atrae hacia allí al enemigo más cercano
    if (hasTrait(u, 'traccion')) { const t = s.units.filter((x) => alive(x) && x.team !== u.team && x.ai !== 'pillar').sort((a, b) => dist(a.pos, at) - dist(b.pos, at))[0]; if (t && dist(t.pos, at) > 0) stepToward(s, t, at, ev); }
    u.ap += 2;
    ev.push({ t: 'drain', unit: u.id, ap: 2, mp: 0 });
  },
  // Implosión: detona la Semilla oscura elegida y, con la Red de implosión, toda su red. Cada semilla hace 14 (+ lo que
  // haya crecido) a los enemigos de las 8 casillas de alrededor y cada conexión hace su daño a los enemigos de su interior.
  // Todo se decide antes de aplicar nada (resolución simultánea) y las semillas desaparecen al final.
  implode: (s, u, d, at, ev) => {
    let hitAny = false;
    const chosen = unitAt(s, at);
    if (!chosen || chosen.seed === undefined || chosen.summoner !== u.id) return;
    const net = seedNetwork(s, u, chosen.id), seeds = net.seeds.map((id) => getUnit(s, id)).filter((x): x is Unit => !!x && alive(x));
    const linkDmg = d.link ?? SEED_LINK_DMG;
    const enemies = s.units.filter((x) => alive(x) && x.team !== u.team);
    const hits: Array<{ t: Unit; dmg: number }> = [];
    for (const sd of seeds) for (const t of enemies) if (Math.max(Math.abs(t.pos.x - sd.pos.x), Math.abs(t.pos.y - sd.pos.y)) <= 1) hits.push({ t, dmg: SEED_DMG + (sd.seed ?? 0) });
    for (const l of net.links) for (const t of enemies) if (l.cells.some((p) => same(p, t.pos))) hits.push({ t, dmg: linkDmg });
    for (const sd of seeds) ev.push({ t: 'markAdd', kind: 'pulse', at: { ...sd.pos } }, { t: 'explode', unit: sd.id });
    for (const l of net.links) for (const p of l.cells) ev.push({ t: 'markAdd', kind: 'pulse', at: { ...p } });
    for (const h of hits) {
      if (s.over) break;
      if (alive(h.t) && hurt(s, h.t, h.dmg + dmgFlat(u, h.t), ev, d.id, { element: d.element ?? 'shadow' }) > 0) hitAny = true;
    }
    for (const sd of seeds) if (alive(sd)) { sd.hp = 0; ev.push({ t: 'death', unit: sd.id }); }
    if (hitAny && alive(u)) { u.ap += 1; ev.push({ t: 'drain', unit: u.id, ap: 1, mp: 0 }); }
    checkOver(s, ev);
  },
  // Cosecha oscura: +2 PA si la Sombra y él golpearon al mismo enemigo este turno
  reap: (_s, u, _d, _at, ev) => { u.ap += 2; u.syncHit = false; ev.push({ t: 'drain', unit: u.id, ap: 2, mp: 0 }); },
  // Atracción del abismo: absorbe las almas del suelo; escudo por cada una
  absorb: (s, u, _d, _at, ev) => {
    const list = marksOf(s, 'soul');
    for (const m of list) { removeMark(s, m, ev); ev.push({ t: 'flame', unit: u.id, from: { ...m.pos }, at: { ...u.pos } }); }
    const sh = Math.round(5 * list.length * (hasTrait(u, 'mender') ? MENDER_MULT : 1));
    if (sh) { u.shield += sh; ev.push({ t: 'shield', unit: u.id, amount: sh }); }
    // Cosecha voraz: +5% de daño por alma absorbida, hasta el final del combate
    if (hasTrait(u, 'voraz') && list.length) u.power += list.length;
  },
  // Sed de batalla: consume la Furia (la mitad con Furia inagotable) para curarse
  thirst: (_s, u, _d, _at, ev) => {
    const f = u.fury ?? 0;
    // G3.3: la Furia se convierte en una curación que compensa gastarla (antes 12 por cada 100)
    heal(u, 2 + f * THIRST_PER_FURY, ev);
    addFury(u, -(hasTrait(u, 'inagotable') ? Math.ceil(f / 2) : f), ev);
  },
  // Pacto de sangre: (la vida ya se pagó) +3 de daño hasta el final del combate
  pact: (_s, u, _d, _at, ev) => { u.power += PACT_POWER; ev.push({ t: 'resist', unit: u.id, what: `+${PACT_POWER} de daño` }); },
  // Velo de penumbra: (ya es invisible) deja una Sombra en su casilla
  veil: (s, u, _d, _at, ev) => placeShadow(s, u, u.pos, 1, ev),
  // La caja: muros espectrales en el anillo alrededor de la casilla, hasta su próximo turno
  cage: (s, u, _d, at, ev) => {
    for (const p of [at, ...around(s, at)].slice(1)) addMark(s, { kind: 'cage', pos: p, team: u.team, turns: 1, owner: u.id }, ev);
  },
  // Sacrificio del guardián: el 40% del daño que reciba el aliado lo recibe el Carcelero
  guardian: (s, u, _d, at, ev) => {
    const a = unitAt(s, at)!;
    addStatus(a, 'guarded', 1, 1, ev);
    a.statuses.guarded!.from = u.id;
  },
  // Grito desmoralizador: 3×3 a su alrededor: Desmoralizado (−5 de armadura 2 turnos) y +15 de Furia por enemigo
  roar: (s, u, _d, _at, ev) => {
    for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && x.ai !== 'pillar' && Math.max(Math.abs(x.pos.x - u.pos.x), Math.abs(x.pos.y - u.pos.y)) <= 1)) {
      addStatus(t, 'exposed', 2, 5, ev);
      ev.push({ t: 'resist', unit: t.id, what: 'Desmoralizado' });
      addFury(u, furyGain(u, 15 * (t.statuses.verdugo?.from === u.id ? 2 : 1)), ev);
    }
  },
};

/** Efectos que van después del daño. */
const TARGET_SPECIALS: Record<string, TargetSpecial> = {
  // Vórtice espiritual: atrae 1 casilla hacia el centro a los enemigos de alrededor
  vortex: (s, u, _d, at, _m, _t, _h, ev) => {
    for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, at) >= 1 && dist(x.pos, at) <= 2).sort((a, b) => dist(a.pos, at) - dist(b.pos, at))) stepToward(s, t, at, ev);
  },
  // Seducción arcana: si está Encantado o por debajo de la mitad, le roba 1 PA y 1 PM
  seduce: (s, u, _d, _at, main, _t, _h, ev) => {
    if (!main || !alive(main) || !(main.statuses.charm || main.hp < main.maxHp / 2)) return;
    const a = landed(s, main, 1), m = landed(s, main, 1);
    if (a) { main.apMod -= 1; u.ap += 1; }
    if (m) { main.mpMod -= 1; u.mp += 1; }
    ev.push({ t: 'drain', unit: main.id, ap: -a, mp: -m }, { t: 'drain', unit: u.id, ap: a, mp: m });
  },
  // Estallido de colas: si alcanza a 2 o más, se cura al instante como el Robo de esencia
  tails: (_s, u, _d, _at, _m, targets, _h, ev) => { if (targets.length >= 2) essenceHeal(u, ev); },
  // Marca de la muerte: además, una Sombra a la espalda del objetivo
  deathmark: (s, u, _d, _at, main, _t, _h, ev) => {
    if (!main || !alive(main)) return;
    const [dx, dy] = dirOf(u.pos, main.pos);
    const back = { x: main.pos.x + dx, y: main.pos.y + dy };
    const cell = isFree(s, back) ? back : around(s, main.pos).find((p) => isFree(s, p));
    if (cell) placeShadow(s, u, cell, 2, ev);
  },
  // Cadenas vinculantes: une al objetivo con otro enemigo cercano
  chainlink: (s, u, _d, _at, main, _t, _h, ev) => {
    if (!main || !alive(main)) return;
    const o = chainPartner(s, u, main);
    if (!o) return;
    for (const [a, b] of [[main, o], [o, main]] as const) { addStatus(a, 'chained', 2, 1, ev); a.statuses.chained!.link = b.id; a.statuses.chained!.from = u.id; }
  },
  // Golpe colosal: con 100 de Furia, empuja 2; si choca, aturde
  colossal: (s, u, _d, _at, main, _t, _h, ev) => {
    if (!main || !alive(main) || (u.fury ?? 0) < FURY_MAX) return;
    const n = landed(s, main, 2);
    if (n < 2) ev.push({ t: 'resist', unit: main.id, what: n ? 'Resiste parte del empujón' : 'Resiste el empujón' });
    const crashed = n ? push(s, u.pos, main, n, ev) : false;
    if (crashed && alive(main)) { if (main.rank || main.statuses.frenzy) ev.push({ t: 'resist', unit: main.id, what: 'Inmune a aturdir' }); else addStatus(main, 'stun', 1, 1, ev); }
  },
  // Paso sombrío: +1 PM si el objetivo está aislado
  isolated: (s, u, _d, _at, main, _t, _h, ev) => {
    if (main && !s.units.some((x) => x !== main && alive(x) && x.team === main.team && dist(x.pos, main.pos) <= 2)) { u.mp++; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
  },
  // Descarga desatada con Eco oscuro: si mata, deja caer 2 esferas
  descarga: (s, u, _d, _at, main, _t, _h, ev) => {
    if (!main || alive(main) || !hasTrait(u, 'eco_oscuro')) return;
    addSphere(s, u, main.pos, 2, 4, ev);
    const p = around(s, main.pos).find((q) => !marksAt(s, 'sphere', q).length);
    if (p) addSphere(s, u, p, 2, 4, ev);
  },
  // Explosión de almas: se cura por cada alma gastada (el daño extra ya se sumó)
  soulburst: (_s, u, _d, _at, _m, _t, _h, ev) => { const n = u.spentSouls ?? 0; if (n) heal(u, 5 * n, ev); delete u.spentSouls; },
  soulreap: (_s, u, _d, _at, main, _t, _h, ev) => {
    const n = u.spentSouls ?? 0; delete u.spentSouls;
    if (main && !alive(main)) { u.soulBank = (u.soulBank ?? 0) + n + 1; ev.push({ t: 'note', text: `Siega del condenado: ${u.name} recupera ${n + 1} alma(s).` }); }
  },
};

// ---------------------------------------------------------------------------
// Bendiciones v11
// ---------------------------------------------------------------------------

/** Furia ganada por habilidades (Sangre caliente: el doble por debajo de la mitad de vida). */
function furyGain(u: Unit, n: number): number {
  return hasTrait(u, 'sangrecal') && u.hp < u.maxHp / 2 ? n * 2 : n;
}

/** Suma cargas de Esencia (Sinfonía mística: al llenarla, el próximo hechizo caro cuesta 1 PA menos). */
function gainEssence(u: Unit, n: number, _ev: GameEvent[]): void {
  if (u.essence === undefined) return;
  const before = u.essence;
  u.essence = Math.min(essenceNeed(u), u.essence + n);
  if (hasTrait(u, 'sinfonia') && before < essenceNeed(u) && u.essence >= essenceNeed(u)) u.symphony = true;
}

/** Núcleo inestable: una esfera consumida estalla contra los enemigos pegados a ella. */
function sphereBurst(s: CombatState, u: Unit, at: Pos, ev: GameEvent[]): void {
  if (!hasTrait(u, 'nucleo')) return;
  ev.push({ t: 'markAdd', kind: 'pulse', at: { ...at } });
  for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, at) <= 1)) {
    if (s.over) break;
    hurt(s, t, 7 + dmgFlat(u, t), ev, 'nucleo');
  }
}

/** Vórtice resonante: dos esferas pegadas estallan (radio 1). */
function resonate(s: CombatState, u: Unit, at: Pos, ev: GameEvent[]): void {
  ev.push({ t: 'markAdd', kind: 'pulse', at: { ...at } });
  for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, at) <= 1)) {
    if (s.over) break;
    hurt(s, t, 10 + dmgFlat(u, t), ev, 'resonancia');
  }
}

/** Cacería coordinada: una Sombra remata → +2 PA (1 vez por turno). */
function huntKill(u: Unit, ev: GameEvent[]): void {
  if (!hasTrait(u, 'caceria') || u.huntUsed) return;
  u.huntUsed = true;
  u.ap += 2;
  ev.push({ t: 'drain', unit: u.id, ap: 2, mp: 0 });
}

/** Reflejo ilusorio: deja un señuelo junto a la Zorra y empuja 1 casilla al atacante. */
function illusion(s: CombatState, z: Unit, atk: Unit, ev: GameEvent[]): void {
  const cell = around(s, z.pos).find((p) => isFree(s, p));
  if (cell) summon(s, { ...z, name: 'Reflejo', owner: null, hp: 1, maxHp: 1, shield: 0, armor: 0, statuses: {}, spells: [], ai: 'decoy', summoner: z.id, traits: ['taunt'], essence: undefined, initiative: 0 }, cell, ev);
  if (!atk.rank) push(s, z.pos, atk, 1, ev);
}

/** Efectos de bendición al empezar el turno (después de reponer PA y PM). */
function turnStartBlessings(s: CombatState, u: Unit, ev: GameEvent[]): void {
  // Geometría Bélica (Arquitecto Rúnico): sobre o junto a un glifo propio → escudo y daño extra
  if (u.kind === 'arquitecto' && u.team === 'hero' && nearOwnGlyph(s, u)) {
    const sh = Math.round((hasTrait(u, 'geomperf') ? 6 : GEO_SHIELD) * (hasTrait(u, 'mender') ? MENDER_MULT : 1));
    u.shield += sh;
    ev.push({ t: 'shield', unit: u.id, amount: sh });
    u.glyphBonus = GEO_FLAT;
  }
  // Pies ligeros (Pistolero): +1 PM en el primer turno de cada combate
  if (hasTrait(u, 'piesligeros') && s.round === 1) { u.mp++; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
  // H5 · Retirada táctica: con un enemigo pegado al empezar, +1 PM y el placaje no te afecta este turno
  if (hasTrait(u, 'retirada') && s.units.some((t) => alive(t) && t.team !== u.team && t.ai !== 'pillar' && dist(t.pos, u.pos) === 1)) { u.mp++; u.mistWalk = true; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
  // Voluntad indómita: por debajo del 25%, +1 carga de Esencia
  if (hasTrait(u, 'indomita') && u.hp < u.maxHp * 0.25) gainEssence(u, 1, ev);
  // Órbita protectora: con 2+ esferas, escudo del 10% de la vida máxima
  if (hasTrait(u, 'orbitaprot') && marksOf(s, 'sphere', u.id).length >= 2) { const sh = Math.round(u.maxHp * 0.1); u.shield += sh; ev.push({ t: 'shield', unit: u.id, amount: sh }); }
  // Pasos del Que No Descansa: pegado a un enemigo → +1 PM
  if (hasTrait(u, 'incansable') && s.units.some((t) => alive(t) && t.team !== u.team && t.ai !== 'pillar' && dist(t.pos, u.pos) === 1)) { u.mp++; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
  // Huellas de Pavesa: los enemigos pegados se queman
  if (hasTrait(u, 'pavesa')) for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, u.pos) === 1)) addStatus(t, 'burn', 1, 1, ev);
  // Carga berserker: enemigo visible en línea recta → +1 PM
  if (hasTrait(u, 'carga') && s.units.some((t) => alive(t) && t.team !== u.team && !t.statuses.invis && (t.pos.x === u.pos.x || t.pos.y === u.pos.y) && hasLineOfSight(s, u.pos, t.pos))) { u.mp++; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
}

/** Efectos al dar un paso: Gravedad alterada (enemigos junto a una esfera) e Imparable (Bárbaro en Frenesí). */
function stepBlessings(s: CombatState, u: Unit, ev: GameEvent[]): void {
  if (!u.gravHit && u.mp > 0 && s.units.some((w) => alive(w) && w.team !== u.team && hasTrait(w, 'gravedad') && marksOf(s, 'sphere', w.id).some((m) => dist(m.pos, u.pos) <= 1))) {
    u.gravHit = true;
    u.mp--;
    ev.push({ t: 'drain', unit: u.id, ap: 0, mp: -1 });
  }
  if (u.statuses.frenzy && hasTrait(u, 'imparable'))
    for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && !x.rank && x.ai !== 'pillar' && dist(x.pos, u.pos) === 1 && !x.statuses.slow)) addStatus(t, 'slow', 1, 1, ev);
}

// ---------------------------------------------------------------------------
// v15: Arquitecto Rúnico (glifos, escudos) y Pistolero Arcano (cargador, disparos)
// ---------------------------------------------------------------------------

/** Daño plano de `owner` contra `t` fuera de su lanzamiento (glifos que explotan en otro turno). */
function ownerFlat(owner: Unit | undefined, t: Unit): number {
  if (!owner) return 0;
  const prev = castingSchool;
  castingSchool = owner.team === 'hero' ? schoolOf(owner.kind) : null;
  try { return dmgFlat(owner, t); } finally { castingSchool = prev; }
}

/** ¿Está `u` sobre o junto (también en diagonal) a uno de sus glifos? */
function nearOwnGlyph(s: CombatState, u: Unit): boolean {
  return (s.marks ?? []).some((m) => (m.kind === 'glyph' || m.kind === 'gravglyph') && m.owner === u.id && Math.max(Math.abs(m.pos.x - u.pos.x), Math.abs(m.pos.y - u.pos.y)) <= 1);
}

/** Pone un glifo del Arquitecto. Si ya hay un enemigo encima, se activa al momento. */
function placeGlyph(s: CombatState, u: Unit, at: Pos, sub: 'fulminante' | 'matriz', turns: number, dmg: number, ev: GameEvent[]): void {
  if (s.obstacles.includes(key(at)) || at.x < 0 || at.y < 0 || at.x >= s.w || at.y >= s.h) return;
  for (const old of marksAt(s, 'glyph', at).filter((m) => m.owner === u.id)) removeMark(s, old, ev);
  const g = addMark(s, { kind: 'glyph', sub, pos: at, team: u.team, turns: turns + (hasTrait(u, 'persistente2') ? 1 : 0), owner: u.id, max: GLYPH_MAX, dmg }, ev);
  const t = unitAt(s, at);
  if (t && alive(t) && t.team !== u.team) triggerGlyph(s, g, t, ev, false);
}

/** Activa un glifo sobre `t`: el fulminante explota (−1 PM y se gasta), la matriz quita 2 PA (y sigue). */
function triggerGlyph(s: CombatState, g: BoardMark, t: Unit, ev: GameEvent[], byEnemy: boolean, keep = false): void {
  const owner = g.owner === undefined ? undefined : getUnit(s, g.owner);
  ev.push({ t: 'markAdd', kind: 'pulse', at: { ...g.pos } });
  hurt(s, t, (g.dmg ?? 8) + ownerFlat(owner, t), ev, g.sub === 'matriz' ? 'matriz' : 'glifo');
  if (alive(t) && g.sub === 'fulminante') addStatus(t, 'slow', 1, owner && hasTrait(owner, 'gelidos') ? 2 : 1, ev);
  if (alive(t) && g.sub === 'matriz') { const n = landed(s, t, 2); if (n) { t.apMod -= n; ev.push({ t: 'drain', unit: t.id, ap: -n, mp: 0 }); } }
  // Blindaje rúnico: el Arquitecto gana 5 de escudo
  if (owner && alive(owner) && hasTrait(owner, 'blindaje') && (byEnemy || g.sub === 'fulminante')) { owner.shield += 5; ev.push({ t: 'shield', unit: owner.id, amount: 5 }); }
  if (g.sub === 'fulminante' && !keep) removeMark(s, g, ev);
}

/** Al empezar el turno de `u`: campo de inercia, glifo de gravedad y cercado de púas. */
function zoneTurnStart(s: CombatState, u: Unit, ev: GameEvent[]): void {
  const marks = s.marks ?? [];
  const inertia = marks.find((m) => m.kind === 'inertia' && same(m.pos, u.pos));
  if (inertia && u.ai !== 'pillar') {
    if (inertia.team === u.team) { u.mp++; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 1 }); }
    else if (u.mp > 0) { u.mp--; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: -1 }); }
  }
  const grav = marks.find((m) => m.kind === 'gravglyph' && m.team !== u.team && same(m.pos, u.pos));
  if (grav) {
    const owner = grav.owner === undefined ? undefined : getUnit(s, grav.owner);
    if (grav.c) stepToward(s, u, grav.c, ev);
    if (alive(u)) hurt(s, u, (grav.dmg ?? 10) + ownerFlat(owner, u), ev, 'gravedad');
  }
  const fence = alive(u) ? marks.find((m) => m.kind === 'fence' && m.team !== u.team && dist(m.pos, u.pos) === 1) : undefined;
  if (fence) { const owner = fence.owner === undefined ? undefined : getUnit(s, fence.owner); hurt(s, u, (fence.dmg ?? 12) + ownerFlat(owner, u), ev, 'cercado'); }
}

/** Reflejos de duelo: tiro rápido automático contra quien le ataca a distancia (una vez por ronda). */
function duelShot(s: CombatState, u: Unit, atk: Unit, ev: GameEvent[]): void {
  if (!hasTrait(u, 'duelo') || u.duelRound === s.round || !alive(u) || !alive(atk)) return;
  u.duelRound = s.round;
  ev.push({ t: 'resist', unit: u.id, what: 'Reflejos de duelo' });
  hurt(s, atk, 8 + ownerFlat(u, atk), ev, 'duelo');
}

/** Tras un disparo: rebote, cargador, Pólvora rápida y Gatillo fácil. */
function gunAfter(s: CombatState, u: Unit, def: SpellDef, main: Unit | undefined, targets: Unit[], fullMag: boolean, ev: GameEvent[]): void {
  if (def.ricochet && main && def.dmg && !s.over) {
    let from: Unit = main;
    const hit = new Set<Unit>([main]);
    for (let k = 0; k < (hasTrait(u, 'doblecanon') ? 2 : 1) && !s.over; k++) {
      const next = s.units.filter((x) => alive(x) && x.team !== u.team && !hit.has(x) && x.ai !== 'pillar' && !x.statuses.invis && dist(x.pos, from.pos) <= def.ricochet!).sort((a, b) => dist(a.pos, from.pos) - dist(b.pos, from.pos))[0];
      if (!next) break;
      ev.push({ t: 'flame', unit: u.id, from: { ...from.pos }, at: { ...next.pos } });
      hurt(s, next, randInt(s, def.dmg[0], def.dmg[1]) + dmgFlat(u, next), ev, def.id, { pierce: !!u.statuses.silver });
      hit.add(next);
      targets.push(next);
      from = next;
    }
  }
  // Bala explosiva: Disparo arcano con el cargador lleno salpica a los pegados al objetivo
  if (fullMag && def.id === 'g_disparo' && hasTrait(u, 'explosiva') && main && def.dmg)
    for (const t of s.units.filter((x) => alive(x) && x !== main && x.team !== u.team && dist(x.pos, main.pos) === 1)) { if (s.over) break; hurt(s, t, (randInt(s, def.dmg[0], def.dmg[1]) + dmgFlat(u, t) + MAG_FULL_FLAT) * 0.5, ev, def.id, { element: 'fire' }); }
  if (fullMag) {
    u.magazine = 0;
    if (hasTrait(u, 'polvora')) { u.mp += 2; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 2 }); }
  } else u.magazine = Math.min(MAG_MAX, (u.magazine ?? 0) + 1);
  // Gatillo fácil: rematar con un disparo devuelve 1 PA (una vez por turno)
  if (hasTrait(u, 'gatillo') && !u.gunKill && targets.some((t) => !alive(t) && t.team !== u.team)) { u.gunKill = true; u.ap++; ev.push({ t: 'drain', unit: u.id, ap: 1, mp: 0 }); }
}

/** Celdas del Glifo de gravedad (2×2 desde la casilla elegida). */
function square2Cells(s: CombatState, at: Pos): Pos[] {
  return [at, { x: at.x + 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x + 1, y: at.y + 1 }].filter((p) => p.x < s.w && p.y < s.h && !s.obstacles.includes(key(p)));
}

/** Para el Disparo de gancho: hay algo a lo que engancharse en la casilla. */
export function grappleTarget(s: CombatState, at: Pos): boolean {
  return !!unitAt(s, at) || s.obstacles.includes(key(at)) || (s.braziers ?? []).includes(key(at));
}

const V15_SELF: Record<string, SelfSpecial> = {
  // Glifo fulminante
  glyph: (s, u, d, at, ev) => {
    const dmg = randInt(s, d.dmg![0], d.dmg![1]);
    placeGlyph(s, u, at, 'fulminante', 2, dmg, ev);
    // Red de glifos: otro glifo en una casilla libre pegada
    if (hasTrait(u, 'redglifos')) { const p = [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x, y: at.y - 1 }].find((q) => isFree(s, q) && !marksAt(s, 'glyph', q).length); if (p) placeGlyph(s, u, p, 'fulminante', 2, dmg, ev); }
  },
  // Glifo de gravedad (2×2)
  gravglyph: (s, u, d, at, ev) => {
    for (const p of square2Cells(s, at)) addMark(s, { kind: 'gravglyph', sub: 'gravedad', pos: p, team: u.team, turns: 2 + (hasTrait(u, 'persistente2') ? 1 : 0), owner: u.id, dmg: randInt(s, d.dmg![0], d.dmg![1]), c: at }, ev);
  },
  // Pulsar rúnico: detona todos tus glifos
  pulsar: (s, u, d, _at, ev) => {
    const mine = (s.marks ?? []).filter((m) => (m.kind === 'glyph' || m.kind === 'gravglyph') && m.owner === u.id);
    for (const m of mine) {
      ev.push({ t: 'markAdd', kind: 'pulse', at: { ...m.pos } });
      for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, m.pos) <= 1)) { if (s.over) break; hurt(s, t, d.dmg![0] + dmgFlat(u, t), ev, d.id); }
      removeMark(s, m, ev);
    }
    const sh = Math.round(3 * mine.length * (hasTrait(u, 'mender') ? MENDER_MULT : 1));
    if (sh) { u.shield += sh; ev.push({ t: 'shield', unit: u.id, amount: sh }); }
  },
  // Cercado de púas: valla de 3 casillas perpendicular a la dirección del lanzador
  fence: (s, u, d, at, ev) => {
    const [dx, dy] = dirOf(u.pos, at);
    const px = dy, py = dx;
    for (const k of [-1, 0, 1]) {
      const p = { x: at.x + px * k, y: at.y + py * k };
      if (p.x < 0 || p.y < 0 || p.x >= s.w || p.y >= s.h || !isFree(s, p)) continue;
      s.obstacles.push(key(p));
      addMark(s, { kind: 'fence', pos: p, team: u.team, turns: 2, owner: u.id, dmg: d.dmg![0] }, ev);
    }
  },
  // Campo de inercia: 3×3 alrededor del lanzador
  inertia: (s, u, _d, at, ev) => {
    // centrado en la casilla elegida (alcance 2-5)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const p = { x: at.x + dx, y: at.y + dy };
      if (p.x < 0 || p.y < 0 || p.x >= s.w || p.y >= s.h || s.obstacles.includes(key(p))) continue;
      addMark(s, { kind: 'inertia', pos: p, team: u.team, turns: 2, owner: u.id }, ev);
    }
  },
  // Sobrecarga defensiva: el escudo se convierte en daño a los enemigos pegados
  overload: (s, u, _d, _at, ev) => {
    const sh = u.shield;
    if (sh <= 0) { ev.push({ t: 'resist', unit: u.id, what: 'Sin escudo que convertir' }); return; }
    u.shield = 0;
    const dmg = Math.min(50, sh * 4);
    ev.push({ t: 'markAdd', kind: 'pulse', at: { ...u.pos } });
    for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && Math.max(Math.abs(x.pos.x - u.pos.x), Math.abs(x.pos.y - u.pos.y)) <= 1)) { if (s.over) break; hurt(s, t, dmg, ev, 'r_sobrecarga'); }
  },
  // Matriz de distorsión: glifo mayor 3 turnos
  matrix: (s, u, d, at, ev) => placeGlyph(s, u, at, 'matriz', 3, d.dmg![0], ev),
  // Ciudadela de cristal: escudo, inmunidad y glifos alrededor
  citadel: (s, u, d, _at, ev) => {
    const sh = Math.round(25 * (hasTrait(u, 'mender') ? MENDER_MULT : 1));
    u.shield += sh;
    ev.push({ t: 'shield', unit: u.id, amount: sh });
    addStatus(u, 'immune', 1, 1, ev);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const p = { x: u.pos.x + dx, y: u.pos.y + dy };
      if (p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h && !s.obstacles.includes(key(p)) && !(unitAt(s, p)?.team === u.team)) placeGlyph(s, u, p, 'fulminante', 2, randInt(s, d.dmg![0], d.dmg![1]), ev);
    }
  },
  // Recarga acrobática: cargador lleno (el PM ya lo dio selfMp)
  reload: (_s, u, _d, _at, ev) => {
    u.magazine = MAG_MAX;
    ev.push({ t: 'resist', unit: u.id, what: '¡Cargador lleno!' });
    if (hasTrait(u, 'polvora')) { u.mp += 2; ev.push({ t: 'drain', unit: u.id, ap: 0, mp: 2 }); }
  },
  // Cortina de humo: nube en tu casilla y las 4 de alrededor hasta tu próximo turno
  smoke: (s, u, _d, _at, ev) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const p = { x: u.pos.x + dx, y: u.pos.y + dy };
      if (p.x < 0 || p.y < 0 || p.x >= s.w || p.y >= s.h || s.obstacles.includes(key(p))) continue;
      addMark(s, { kind: 'smoke', pos: p, team: u.team, turns: 1, owner: u.id }, ev);
    }
    addStatus(u, 'smoke', 1, 1, ev);
  },
  // Disparo de gancho: atrae al enemigo normal; con muros, braseros o enemigos grandes, te arrastras tú
  grapple: (s, u, _d, at, ev) => {
    const t = unitAt(s, at);
    if (t && t.team !== u.team && !t.rank && t.ai !== 'boss' && t.ai !== 'pillar') {
      for (let i = 0; i < 6 && alive(t) && dist(t.pos, u.pos) > 1; i++) { const before = key(t.pos); stepToward(s, t, u.pos, ev); if (key(t.pos) === before) break; }
      return;
    }
    const cell = dashCell(s, u, at);
    if (!cell) { ev.push({ t: 'resist', unit: u.id, what: 'No hay hueco junto al objetivo' }); return; }
    if (!same(cell, u.pos)) { u.pos = { ...cell }; ev.push({ t: 'move', unit: u.id, path: [{ ...cell }] }); springSnare(s, u, ev); stepOn(s, u, ev); }
  },
};
for (const [k, f] of Object.entries(V15_SELF)) SELF_SPECIALS[k] = f;

// Barrera compartida: el Arquitecto también gana escudo al proteger a un aliado
TARGET_SPECIALS.barrier = (_s, u, _d, _at, main, _t, _h, ev) => {
  if (main && main !== u && hasTrait(u, 'compartida')) { const sh = Math.round(6 * (hasTrait(u, 'mender') ? MENDER_MULT : 1)); u.shield += sh; ev.push({ t: 'shield', unit: u.id, amount: sh }); }
};
TARGET_SPECIALS.archshot = (s, u, _d, at, _m, _t, _h, ev) => {
  // Disparo arquitectónico: activa un glifo tuyo de la casilla (a su alrededor) sin gastarlo
  const g = marksAt(s, 'glyph', at).find((m) => m.owner === u.id);
  if (!g) return;
  for (const t of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, at) <= 1)) { if (s.over) break; triggerGlyph(s, g, t, ev, false, true); }
};

/** Daño extra del Corte de Guadaña: +3 por turno de carga (máx. 3) y +1 cada 5 almas del combate (máx. +3). */
export function scytheBonus(u: Unit): number {
  return 3 * Math.min(3, u.scytheCharge ?? 0) + Math.min(3, Math.floor((u.soulsFight ?? 0) / 5));
}

// ---------------------------------------------------------------------------
// v13 terreno: abismos y braseros
// ---------------------------------------------------------------------------

/** Cae al abismo: los normales y los héroes mueren; élites y jefes reciben 20 y vuelven a una casilla libre cercana. */
function fallInto(s: CombatState, u: Unit, pit: Pos, ev: GameEvent[]): void {
  ev.push({ t: 'push', unit: u.id, to: { ...pit } });
  ev.push({ t: 'resist', unit: u.id, what: '¡Cae al abismo!' });
  if (u.rank || u.ai === 'boss' || u.ai === 'pillar') {
    hurt(s, u, 20, ev, 'abismo', { pierce: true });
    const back = [...reachable(s, u.pos, 6, true).cost.keys()].map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y }; }).filter((p) => isFree(s, p)).sort((a, b) => dist(a, pit) - dist(b, pit))[0];
    if (back) { u.pos = back; ev.push({ t: 'blink', unit: u.id, to: { ...back } }); }
    return;
  }
  u.shield = 0;
  delete u.undying;
  hurt(s, u, u.hp + 999, ev, 'abismo', { pierce: true });
}

/** Rompe un brasero: deja una línea de fuego de 4 casillas en la dirección del golpe (3 turnos; quema 2 turnos). */
export function breakBrazier(s: CombatState, at: Pos, dir: [number, number], ev: GameEvent[]): void {
  const k = key(at);
  if (!(s.braziers ?? []).includes(k)) return;
  s.braziers = s.braziers!.filter((x) => x !== k);
  s.obstacles = s.obstacles.filter((x) => x !== k);
  ev.push({ t: 'markAdd', kind: 'pulse', at: { ...at } });
  const [dx, dy] = dir[0] || dir[1] ? dir : [1, 0];
  s.fire ??= {};
  for (let i = 0; i <= 4; i++) {
    const p = { x: at.x + dx * i, y: at.y + dy * i };
    if (!inBoundsPos(s, p) || s.obstacles.includes(key(p))) break;
    s.fire[key(p)] = 3;
    const t = unitAt(s, p);
    if (t && alive(t)) addStatus(t, 'burn', 2, 1, ev);
  }
}
const inBoundsPos = (s: CombatState, p: Pos): boolean => p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h;

/** Si un hechizo de daño alcanza un brasero (en su casilla objetivo, su línea o su área), lo rompe. */
function hitBraziers(s: CombatState, u: Unit, def: SpellDef, at: Pos, ev: GameEvent[]): void {
  if (!def.dmg || !(s.braziers ?? []).length) return;
  const cells: Pos[] = [at];
  if (def.line) cells.push(...lineCells(u.pos, at));
  if (def.cone) cells.push(...coneCells(u.pos, at, def.cone));
  if (def.area) for (const k of [...s.braziers!]) { const [x, y] = k.split(',').map(Number) as [number, number]; if (dist({ x, y }, at) <= def.area) cells.push({ x, y }); }
  for (const p of cells) if ((s.braziers ?? []).includes(key(p))) breakBrazier(s, p, dirOf(u.pos, p), ev);
}
