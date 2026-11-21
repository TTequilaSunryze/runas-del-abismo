// Marcadores en el suelo vinculados a una unidad: esferas, almas, linternas…
// Sistema genérico: no bloquean, no tienen turno y el motor los hace caducar.
import { same } from './grid';
import type { BoardMark, CombatState, GameEvent, Pos, Team } from '../state';

/** Marcadores de un tipo (y, si se indica, de un dueño), del más antiguo al más nuevo. */
export function marksOf(s: CombatState, kind: string, owner?: number): BoardMark[] {
  return (s.marks ?? []).filter((m) => m.kind === kind && (owner === undefined || m.owner === owner)).sort((a, b) => a.id - b.id);
}

/** Marcadores de un tipo en una casilla. */
export function marksAt(s: CombatState, kind: string, at: Pos): BoardMark[] {
  return (s.marks ?? []).filter((m) => m.kind === kind && same(m.pos, at));
}

export function removeMark(s: CombatState, m: BoardMark, ev: GameEvent[]): void {
  const i = (s.marks ?? []).indexOf(m);
  if (i < 0) return;
  s.marks!.splice(i, 1);
  // Cercado de púas: al desaparecer, la casilla vuelve a ser transitable
  if (m.kind === 'fence') s.obstacles = s.obstacles.filter((k) => k !== `${m.pos.x},${m.pos.y}`);
  ev.push({ t: 'markGone', kind: m.kind, at: { ...m.pos } });
}

/** Pone un marcador. Con `max`, si el dueño ya tiene tantos de ese tipo, desaparece el más antiguo. */
export function addMark(s: CombatState, o: { kind: string; pos: Pos; team: Team; turns: number; owner?: number; max?: number; sub?: string; dmg?: number; c?: Pos }, ev: GameEvent[]): BoardMark {
  if (o.max !== undefined && o.owner !== undefined) {
    const mine = marksOf(s, o.kind, o.owner);
    for (let i = 0; i <= mine.length - o.max; i++) removeMark(s, mine[i]!, ev);
  }
  const m: BoardMark = { id: s.nextId++, kind: o.kind, pos: { ...o.pos }, team: o.team, turns: o.turns, ...(o.owner !== undefined ? { owner: o.owner } : {}), ...(o.sub ? { sub: o.sub } : {}), ...(o.dmg !== undefined ? { dmg: o.dmg } : {}), ...(o.c ? { c: { ...o.c } } : {}) };
  (s.marks ??= []).push(m);
  ev.push({ t: 'markAdd', kind: m.kind, at: { ...m.pos } });
  return m;
}

/** Resta un turno a los marcadores de `owner` (undefined = los que no tienen dueño) y quita los gastados. */
export function tickMarks(s: CombatState, owner: number | undefined, ev: GameEvent[]): void {
  for (const m of [...(s.marks ?? [])]) if (m.owner === owner && --m.turns <= 0) removeMark(s, m, ev);
}

/** Quita todos los marcadores de una unidad (al morir). */
export function clearMarksOf(s: CombatState, owner: number, ev: GameEvent[]): void {
  for (const m of [...(s.marks ?? [])]) if (m.owner === owner) removeMark(s, m, ev);
}

/**
 * Cono frontal desde `from` hacia `toward` (en línea recta): `len` casillas de largo,
 * 1 de ancho en la primera fila y 3 en las siguientes.
 */
export function coneCells(from: Pos, toward: Pos, len: number): Pos[] {
  const [dx, dy] = dirOf(from, toward);
  if (!dx && !dy) return [];
  const out: Pos[] = [];
  for (let k = 1; k <= len; k++) {
    const half = Math.min(k - 1, 1);
    for (let w = -half; w <= half; w++) out.push({ x: from.x + dx * k + dy * w, y: from.y + dy * k + dx * w });
  }
  return out;
}

/** Dirección principal (un paso ortogonal) de `from` hacia `to`. */
export function dirOf(from: Pos, to: Pos): [number, number] {
  const dx = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? Math.sign(to.x - from.x) : 0;
  return [dx, dx === 0 ? Math.sign(to.y - from.y) : 0];
}
