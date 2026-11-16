// Geometría de la cuadrícula: distancias, caminos y línea de visión.
import { key, type CombatState, type Pos, type Unit } from '../state';

export const dist = (a: Pos, b: Pos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const same = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;
export const alive = (u: Unit): boolean => u.hp > 0;

export function inBounds(s: CombatState, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h;
}

export function unitAt(s: CombatState, p: Pos): Unit | undefined {
  return s.units.find((u) => alive(u) && same(u.pos, p));
}

export function isFree(s: CombatState, p: Pos): boolean {
  return inBounds(s, p) && !s.obstacles.includes(key(p)) && !unitAt(s, p);
}

const DIRS: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export interface Reach {
  cost: Map<string, number>;
  prev: Map<string, string>;
}

/** Casillas alcanzables desde `from` con `max` pasos. `throughUnits` ignora unidades (para medir distancias). */
export function reachable(s: CombatState, from: Pos, max: number, throughUnits = false): Reach {
  const cost = new Map<string, number>([[key(from), 0]]);
  const prev = new Map<string, string>();
  const queue: Pos[] = [from];
  const blocked = new Set(s.obstacles);
  while (queue.length) {
    const p = queue.shift()!;
    const c = cost.get(key(p))!;
    if (c >= max) continue;
    for (const d of DIRS) {
      const n = { x: p.x + d.x, y: p.y + d.y };
      const k = key(n);
      if (!inBounds(s, n) || cost.has(k) || blocked.has(k)) continue;
      if (!throughUnits && unitAt(s, n)) continue;
      cost.set(k, c + 1);
      prev.set(k, key(p));
      queue.push(n);
    }
  }
  return { cost, prev };
}

export function pathTo(reach: Reach, from: Pos, to: Pos): Pos[] {
  const path: Pos[] = [];
  let k = key(to);
  const start = key(from);
  while (k !== start) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    path.unshift({ x, y });
    const p = reach.prev.get(k);
    if (p === undefined) return [];
    k = p;
  }
  return path;
}

/**
 * Línea de visión: recorre las casillas entre a y b. La bloquean los obstáculos;
 * las unidades no. Origen y destino no cuentan.
 */
export function hasLineOfSight(s: CombatState, a: Pos, b: Pos): boolean {
  const blocked = new Set(s.obstacles);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  for (let i = 1; i < steps; i++) {
    const x = Math.round(a.x + (dx * i) / steps);
    const y = Math.round(a.y + (dy * i) / steps);
    if ((x === a.x && y === a.y) || (x === b.x && y === b.y)) continue;
    if (blocked.has(`${x},${y}`)) return false;
  }
  return true;
}
