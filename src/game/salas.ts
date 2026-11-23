// Salas creadas por el creador: forma, terreno, enemigos (con sus ajustes), casillas de inicio, oleadas y objetivo.
// Se guardan en su progreso (Meta.rooms) y, si se publican, pueden salir en las expediciones que él aloje.
// Las salas de src/content/salas.json salen para todos los jugadores.
import { AFFIXES, ENEMIES, ALLIES, makeEnemy, type EnemyOpts } from '../content/enemies';
import { ZONA1_ENEMIES } from '../content/zona1/enemies';
import { ZONA2_ENEMIES } from '../content/zona2/enemies';
import { ZONA3_ENEMIES } from '../content/zona3/enemies';
import { ZONA4_ENEMIES } from '../content/zona4/enemies';
import type { CombatSetup, UnitSpec } from '../core/combat/engine';
import type { CombatGoal, Pos } from '../core/state';

/** Lo que puede haber en una casilla (vacía = suelo). */
export type CellKind = 'void' | 'wall' | 'brazier' | 'abyss' | 'root' | 'puddle' | 'trap';
export const CELL_KINDS: CellKind[] = ['void', 'wall', 'brazier', 'abyss', 'root', 'puddle', 'trap'];

/** Ajustes de un enemigo colocado, sobre sus valores normales. */
export interface StatMod {
  /** vida: % extra (−90 a +500) */
  hp?: number;
  /** daño plano extra */
  power?: number;
  ap?: number;
  mp?: number;
  armor?: number;
  initiative?: number;
  tackle?: number;
  dodge?: number;
  /** % de crítico extra */
  crit?: number;
  /** escudo inicial: % de su vida */
  shield?: number;
  /** alcance extra de sus ataques a distancia */
  range?: number;
}
export const STAT_KEYS: Array<{ k: keyof StatMod; name: string; min: number; max: number; step: number; unit?: string }> = [
  { k: 'hp', name: 'Vida', min: -90, max: 500, step: 10, unit: '%' },
  { k: 'power', name: 'Daño', min: -10, max: 40, step: 1 },
  { k: 'ap', name: 'PA', min: -3, max: 8, step: 1 },
  { k: 'mp', name: 'PM', min: -5, max: 8, step: 1 },
  { k: 'armor', name: 'Armadura', min: -5, max: 20, step: 1 },
  { k: 'initiative', name: 'Iniciativa', min: -20, max: 40, step: 1 },
  { k: 'tackle', name: 'Placaje', min: -10, max: 20, step: 1 },
  { k: 'dodge', name: 'Huida', min: -10, max: 20, step: 1 },
  { k: 'crit', name: 'Crítico', min: 0, max: 100, step: 5, unit: '%' },
  { k: 'shield', name: 'Escudo inicial', min: 0, max: 200, step: 10, unit: '%' },
  { k: 'range', name: 'Alcance', min: 0, max: 6, step: 1 },
];

export interface RoomEnemy {
  kind: string;
  x: number;
  y: number;
  /** ronda en la que entra (0 o 1 = desde el principio) */
  wave?: number;
  /** solo aparece con al menos este número de jugadores */
  min?: number;
  elite?: boolean;
  /** objetivo marcado (para el objetivo «Acabar con los marcados») */
  goal?: boolean;
  /** modificadores de élite (ids de AFFIXES) */
  affixes?: string[];
  mod?: StatMod;
}

export type RoomGoal = { kind: 'kill' } | { kind: 'survive'; rounds: number } | { kind: 'targets' };
export type RoomKind = 'combat' | 'elite' | 'boss';

export interface RoomDef {
  id: string;
  name: string;
  /** zona 0 a 3 */
  zone: number;
  kind: RoomKind;
  w: number;
  h: number;
  /** "x,y" → lo que hay en la casilla */
  cells: Record<string, CellKind>;
  /** casillas de inicio de los héroes */
  starts: Pos[];
  enemies: RoomEnemy[];
  goal: RoomGoal;
  /** sale en las expediciones */
  published: boolean;
  /** probabilidad (%) de salir cuando toca una sala de su zona y tipo */
  chance: number;
  /** última modificación */
  t: number;
}

export const ROOM_MIN = { w: 5, h: 4 }, ROOM_MAX = { w: 16, h: 10 };
export const KIND_NAME: Record<RoomKind, string> = { combat: 'Combate', elite: 'Élite', boss: 'Jefe' };
export const ZONE_SHORT = ['Catacumbas', 'Bosque', 'Ceniza', 'Abismo'];

/** Zona de cada enemigo (los aliados, −1). */
export const ENEMY_ZONE: Record<string, number> = Object.fromEntries([
  ...[ZONA1_ENEMIES, ZONA2_ENEMIES, ZONA3_ENEMIES, ZONA4_ENEMIES].flatMap((list, z) => Object.keys(list).map((id) => [id, z] as const)),
  ...Object.keys(ALLIES).map((id) => [id, -1] as const),
]);

const int = (x: unknown, lo: number, hi: number, d: number): number => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

export function newRoom(zone = 0): RoomDef {
  const w = 12, h = 7;
  return { id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, name: 'Sala nueva', zone, kind: 'combat', w, h, cells: {},
    starts: [{ x: 1, y: 1 }, { x: 1, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 2 }], enemies: [], goal: { kind: 'kill' }, published: false, chance: 35, t: Date.now() };
}

/** Comprueba y arregla una sala que viene de fuera (guardado, archivo importado). */
export function cleanRoom(x: unknown): RoomDef | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Partial<RoomDef>;
  const w = int(r.w, ROOM_MIN.w, ROOM_MAX.w, 12), h = int(r.h, ROOM_MIN.h, ROOM_MAX.h, 7);
  const inside = (p: { x?: unknown; y?: unknown }): boolean => Number.isInteger(p.x) && Number.isInteger(p.y) && (p.x as number) >= 0 && (p.y as number) >= 0 && (p.x as number) < w && (p.y as number) < h;
  const cells: Record<string, CellKind> = {};
  for (const [k, v] of Object.entries(r.cells ?? {})) {
    const [cx, cy] = k.split(',').map(Number);
    if (CELL_KINDS.includes(v as CellKind) && inside({ x: cx, y: cy })) cells[`${cx},${cy}`] = v as CellKind;
  }
  const seen = new Set<string>();
  const starts = (Array.isArray(r.starts) ? r.starts : []).filter((p) => p && inside(p) && !cells[`${p.x},${p.y}`] && !seen.has(`${p.x},${p.y}`) && seen.add(`${p.x},${p.y}`)).map((p) => ({ x: p.x, y: p.y })).slice(0, 12);
  const enemies: RoomEnemy[] = [];
  for (const e of Array.isArray(r.enemies) ? r.enemies : []) {
    if (!e || !ENEMIES[e.kind] || !inside(e)) continue;
    const mod: StatMod = {};
    for (const s of STAT_KEYS) { const v = (e.mod as Record<string, unknown> | undefined)?.[s.k]; if (v !== undefined && Number(v)) mod[s.k] = int(v, s.min, s.max, 0); }
    enemies.push({ kind: e.kind, x: e.x, y: e.y, ...(e.wave && e.wave > 1 ? { wave: int(e.wave, 2, 30, 2) } : {}), ...(e.min && e.min > 1 ? { min: int(e.min, 2, 4, 2) } : {}), ...(e.elite ? { elite: true } : {}), ...(e.goal ? { goal: true } : {}),
      ...(Array.isArray(e.affixes) && e.affixes.some((a) => AFFIXES[a]) ? { affixes: [...new Set(e.affixes.filter((a) => AFFIXES[a]))] } : {}), ...(Object.keys(mod).length ? { mod } : {}) });
  }
  const g = r.goal as RoomGoal | undefined;
  const goal: RoomGoal = g?.kind === 'survive' ? { kind: 'survive', rounds: int(g.rounds, 1, 30, 5) } : g?.kind === 'targets' ? { kind: 'targets' } : { kind: 'kill' };
  return {
    id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : newRoom().id, name: String(r.name ?? 'Sala').slice(0, 40) || 'Sala', zone: int(r.zone, 0, 3, 0),
    kind: r.kind === 'elite' || r.kind === 'boss' ? r.kind : 'combat', w, h, cells, starts, enemies: enemies.slice(0, 40), goal, published: !!r.published, chance: int(r.chance, 1, 100, 35), t: Number(r.t) || Date.now(),
  };
}

/** Contenido de una casilla: terreno, inicio de héroe o enemigos (de cualquier oleada). */
export const cellOf = (r: RoomDef, p: Pos): CellKind | undefined => r.cells[`${p.x},${p.y}`];
export const startAt = (r: RoomDef, p: Pos): number => r.starts.findIndex((s) => s.x === p.x && s.y === p.y);
export const enemiesAt = (r: RoomDef, p: Pos): RoomEnemy[] => r.enemies.filter((e) => e.x === p.x && e.y === p.y);

/** Cambia el tamaño: lo que queda fuera se borra. */
export function resizeRoom(r: RoomDef, w: number, h: number): void {
  r.w = int(w, ROOM_MIN.w, ROOM_MAX.w, r.w); r.h = int(h, ROOM_MIN.h, ROOM_MAX.h, r.h);
  for (const k of Object.keys(r.cells)) { const [x, y] = k.split(',').map(Number) as [number, number]; if (x >= r.w || y >= r.h) delete r.cells[k]; }
  r.starts = r.starts.filter((p) => p.x < r.w && p.y < r.h);
  r.enemies = r.enemies.filter((e) => e.x < r.w && e.y < r.h);
}

/** Aplica los ajustes del creador a un enemigo ya escalado. */
export function applyMod(u: UnitSpec, e: Pick<RoomEnemy, 'mod' | 'elite' | 'goal'>): UnitSpec {
  const m = e.mod ?? {};
  if (m.hp) { u.maxHp = Math.max(1, Math.round(u.maxHp * (1 + m.hp / 100))); u.hp = u.maxHp; }
  if (m.power) u.power += m.power;
  if (m.ap) { u.ap = Math.max(0, u.ap + m.ap); u.maxAp = Math.max(0, u.maxAp + m.ap); }
  if (m.mp) { u.mp = Math.max(0, u.mp + m.mp); u.maxMp = Math.max(0, u.maxMp + m.mp); }
  if (m.armor) u.armor = Math.max(0, u.armor + m.armor);
  if (m.initiative) u.initiative = Math.max(0, u.initiative + m.initiative);
  if (m.tackle) u.tackle = Math.max(0, (u.tackle ?? 0) + m.tackle);
  if (m.dodge) u.dodge = Math.max(0, (u.dodge ?? 0) + m.dodge);
  if (m.crit) u.crit += m.crit;
  if (m.shield) u.shield = Math.round(u.maxHp * m.shield / 100);
  if (m.range) u.statuses = { ...u.statuses, reach: { turns: 999, stacks: m.range } };
  if (e.elite) { u.rank = 'elite'; u.tackle = (u.tackle ?? 0) + 3; }
  if (e.goal) u.goal = true;
  return u;
}

/** Cómo se escalan los enemigos de la sala (nivel de la zona, jugadores y refuerzos de la partida). */
export interface RoomScale {
  players: number;
  /** profundidad dentro de la zona (0 = primera sala) */
  depth: number;
  /** vida y daño de la partida (ascensión, zona, retos) para cada enemigo */
  opts?: (id: string, first: boolean) => EnemyOpts;
}

/** Un enemigo de la sala, listo para el combate. */
export function roomEnemyUnit(e: RoomEnemy, sc: RoomScale, first = false): UnitSpec {
  const big = ENEMIES[e.kind]?.ai === 'boss' || e.elite;
  const base = sc.opts?.(e.kind, first) ?? {};
  const u = makeEnemy(e.kind, { x: e.x, y: e.y }, big ? Math.min(2, sc.depth) : sc.depth, sc.players, { ...base, affixes: [...new Set([...(e.affixes ?? []), ...(base.affixes ?? [])])] });
  return applyMod(u, e);
}

/**
 * Combate de una sala creada. Los héroes van a las casillas de inicio (si faltan, a las primeras columnas libres);
 * los enemigos que piden más jugadores de los que hay no salen.
 */
export function roomSetup(r: RoomDef, heroes: UnitSpec[], sc: RoomScale, seed: number, deploy = true): CombatSetup {
  const of = (k: CellKind): Pos[] => Object.entries(r.cells).filter(([, v]) => v === k).map(([p]) => { const [x, y] = p.split(',').map(Number) as [number, number]; return { x, y }; });
  const blocked = new Set(Object.keys(r.cells).filter((k) => r.cells[k] !== 'trap' && r.cells[k] !== 'puddle' && r.cells[k] !== 'root'));
  const list = r.enemies.filter((e) => (e.min ?? 1) <= sc.players);
  const taken = new Set(list.filter((e) => (e.wave ?? 0) <= 1).map((e) => `${e.x},${e.y}`));
  const starts = r.starts.filter((p) => !blocked.has(`${p.x},${p.y}`) && !taken.has(`${p.x},${p.y}`));
  // si hay menos casillas de inicio que héroes, se añaden en las primeras columnas
  for (let x = 0; x < r.w && starts.length < heroes.length; x++) for (let y = 0; y < r.h && starts.length < heroes.length; y++) {
    const k = `${x},${y}`;
    if (!blocked.has(k) && !taken.has(k) && !starts.some((p) => p.x === x && p.y === y)) starts.push({ x, y });
  }
  heroes.forEach((u, i) => { u.pos = { ...starts[i]! }; });
  const units = list.filter((e) => (e.wave ?? 0) <= 1).map((e, i) => roomEnemyUnit(e, sc, i === 0));
  const waves = new Map<number, UnitSpec[]>();
  for (const e of list.filter((x) => (x.wave ?? 0) > 1)) { const arr = waves.get(e.wave!) ?? []; arr.push(roomEnemyUnit(e, sc)); waves.set(e.wave!, arr); }
  const goal: CombatGoal | null = r.goal.kind === 'survive' ? { kind: 'survive', rounds: r.goal.rounds } : r.goal.kind === 'targets' ? { kind: 'targets' } : null;
  return {
    seed, w: r.w, h: r.h, obstacles: of('wall'), voids: of('void'), braziers: of('brazier'), abyss: of('abyss'), roots: of('root'), puddles: of('puddle'), traps: of('trap'),
    biome: r.name, units: [...heroes, ...units], deploy, deployCells: starts, goal, waves: [...waves].map(([round, us]) => ({ round, units: us })),
  };
}

/** Avisos del editor: lo que puede hacer que la sala no funcione bien. */
export function roomWarnings(r: RoomDef): string[] {
  const out: string[] = [];
  const blocked = (k: string): boolean => !!r.cells[k] && r.cells[k] !== 'trap' && r.cells[k] !== 'puddle' && r.cells[k] !== 'root';
  if (r.starts.length < 4) out.push(`Solo hay ${r.starts.length} casillas de inicio: con más jugadores se añaden solas en las primeras columnas.`);
  if (!r.enemies.some((e) => (e.wave ?? 0) <= 1 && (e.min ?? 1) <= 1)) out.push('No hay ningún enemigo desde el principio con 1 jugador.');
  if (r.goal.kind === 'targets' && !r.enemies.some((e) => e.goal)) out.push('El objetivo es acabar con los marcados, pero no hay ninguno marcado (se jugará como «acabar con todos»).');
  for (const e of r.enemies) if (blocked(`${e.x},${e.y}`)) { out.push(`${ENEMIES[e.kind]?.name ?? e.kind} está sobre un muro o fuera de la sala.`); break; }
  const pos = new Map<string, number>();
  for (const e of r.enemies) { const k = `${e.x},${e.y}:${e.wave ?? 0}`; pos.set(k, (pos.get(k) ?? 0) + 1); }
  if ([...pos.values()].some((n) => n > 1)) out.push('Hay enemigos de la misma oleada en la misma casilla: alguno saldrá en la casilla libre más cercana.');
  // ¿se llega a todo?
  const start = r.starts[0];
  if (start) {
    const seen = new Set([`${start.x},${start.y}`]), q = [start];
    while (q.length) {
      const p = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { x: p.x + dx, y: p.y + dy }, k = `${n.x},${n.y}`;
        if (n.x < 0 || n.y < 0 || n.x >= r.w || n.y >= r.h || seen.has(k) || blocked(k)) continue;
        seen.add(k); q.push(n);
      }
    }
    const far = [...r.starts, ...r.enemies.filter((e) => ENEMIES[e.kind]?.ai !== 'pillar')].filter((p) => !seen.has(`${p.x},${p.y}`));
    if (far.length) out.push('Hay casillas de inicio o enemigos a los que no se puede llegar andando (en las expediciones, la sala se descartará).');
  }
  return out;
}

/** Fusiona las salas de dos dispositivos: gana la versión más reciente; las borradas no vuelven. */
export function mergeRooms(a: RoomDef[] = [], b: RoomDef[] = [], gone: string[] = []): RoomDef[] {
  const m = new Map<string, RoomDef>();
  for (const r of [...a, ...b]) { const c = cleanRoom(r); if (c && !gone.includes(c.id) && (!m.has(c.id) || m.get(c.id)!.t < c.t)) m.set(c.id, c); }
  return [...m.values()].sort((x, y) => x.t - y.t).slice(-60);
}
