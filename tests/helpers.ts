import { SPELLS } from '../src/core/classes/spells';
import { runAiTurn } from '../src/core/combat/ai';
import { cast, castProblem, current, endTurn, move } from '../src/core/combat/engine';
import { alive, dist, reachable } from '../src/core/combat/grid';
import type { CombatState } from '../src/core/state';

/** Juega un combate entero: IA para enemigos y un guion simple para héroes. */
export function autoplay(s: CombatState, maxTurns = 600, minion?: Parameters<typeof runAiTurn>[1]): void {
  for (let i = 0; i < maxTurns && !s.over; i++) {
    const u = current(s)!;
    if (u.ai) { runAiTurn(s, minion); continue; }
    for (let n = 0; n < 8 && !s.over && current(s)?.id === u.id; n++) {
      const foes = s.units.filter((e) => e.team === 'enemy' && alive(e)).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos));
      const opt = u.spells.map((sp) => SPELLS[sp.id]!).filter((d) => d.target === 'enemy')
        .flatMap((d) => foes.map((f) => ({ d, f }))).find(({ d, f }) => !castProblem(s, u, d, f.pos));
      if (opt) { cast(s, u.id, opt.d.id, opt.f.pos); continue; }
      if (u.mp > 0 && foes[0]) {
        const reach = reachable(s, u.pos, u.mp);
        const best = [...reach.cost.keys()].map((k) => k.split(',').map(Number) as [number, number])
          .sort((a, b) => dist({ x: a[0], y: a[1] }, foes[0]!.pos) - dist({ x: b[0], y: b[1] }, foes[0]!.pos))[0]!;
        if (best[0] !== u.pos.x || best[1] !== u.pos.y) { move(s, u.id, { x: best[0], y: best[1] }); continue; }
      }
      break;
    }
    if (!s.over && current(s)?.id === u.id) endTurn(s, u.id);
  }
}

