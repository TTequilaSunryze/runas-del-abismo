// IA enemiga básica: acercarse al héroe más próximo y atacar mientras queden PA.
import { SPELLS } from '../classes/spells';
import type { CombatState, GameEvent, Pos, Unit } from '../state';
import { cast, castProblem, current, endTurn, move } from './engine';
import { alive, dist, hasLineOfSight, reachable } from './grid';

function attackAll(s: CombatState, u: Unit, ev: GameEvent[]): void {
  const def = SPELLS[u.spells[0]!.id]!;
  for (let i = 0; i < 6 && !s.over; i++) {
    const target = s.units
      .filter((h) => h.team !== u.team && alive(h) && !castProblem(s, u, def, h.pos))
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) return;
    const r = cast(s, u.id, def.id, target.pos);
    if (!r.ok) return;
    ev.push(...r.events);
  }
}

/** Juega el turno completo de la unidad actual si la controla la IA. */
export function runAiTurn(s: CombatState): GameEvent[] {
  const u = current(s);
  const ev: GameEvent[] = [];
  if (!u || !u.ai) return ev;
  const def = SPELLS[u.spells[0]!.id]!;
  attackAll(s, u, ev);
  if (!s.over && u.mp > 0) {
    const foes = s.units.filter((h) => h.team !== u.team && alive(h));
    const reach = reachable(s, u.pos, u.mp);
    let best: Pos | null = null;
    let bestScore = Infinity;
    for (const k of reach.cost.keys()) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const p = { x, y };
      // distancia real (rodeando obstáculos) al héroe más cercano
      const walk = reachable(s, p, 40, true).cost;
      let score = Infinity;
      for (const f of foes) {
        const d = walk.get(`${f.pos.x},${f.pos.y}`) ?? 99;
        const flat = dist(p, f.pos);
        const canHit = flat >= def.range[0] && flat <= def.range[1] && (!def.los || flat <= 1 || hasLineOfSight(s, p, f.pos));
        // a distancia: cualquier casilla desde la que pueda disparar vale, cuanto más lejos mejor
        const v = canHit ? (u.ai === 'ranged' ? -flat : 0) : d + 10;
        if (v < score) score = v;
      }
      score += reach.cost.get(k)! * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best && (best.x !== u.pos.x || best.y !== u.pos.y)) {
      const r = move(s, u.id, best);
      if (r.ok) ev.push(...r.events);
    }
    attackAll(s, u, ev);
  }
  if (!s.over && current(s)?.id === u.id) {
    const r = endTurn(s, u.id);
    if (r.ok) ev.push(...r.events);
  }
  return ev;
}
