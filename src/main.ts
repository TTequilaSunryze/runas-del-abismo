// Página provisional: demuestra el motor con un combate simulado. La sustituirá la interfaz real.
import { makeEnemy } from './content/zona1/enemies';
import { makeHero } from './core/classes/factory';
import { SPELLS } from './core/classes/spells';
import { runAiTurn } from './core/combat/ai';
import { cast, castProblem, createCombat, current, endTurn, getUnit, move } from './core/combat/engine';
import { alive, dist, reachable } from './core/combat/grid';
import type { CombatState, GameEvent } from './core/state';

function describe(s: CombatState, e: GameEvent): string | null {
  const n = (id: number): string => getUnit(s, id)?.name ?? '?';
  switch (e.t) {
    case 'turn': return `\n— Ronda ${e.round}: turno de ${n(e.unit)} —`;
    case 'move': return `${n(e.unit)} se mueve ${e.path.length} casilla(s)`;
    case 'cast': return `${n(e.unit)} usa ${SPELLS[e.spell]?.name ?? e.spell}`;
    case 'damage': return `  ${n(e.unit)} pierde ${e.amount} de vida${e.crit ? ' (crítico)' : ''}${e.absorbed ? `, escudo absorbe ${e.absorbed}` : ''}`;
    case 'heal': return `  ${n(e.unit)} recupera ${e.amount}`;
    case 'shield': return `  ${n(e.unit)} gana ${e.amount} de escudo`;
    case 'status': return `  ${n(e.unit)} sufre ${e.kind} (${e.turns} turnos)`;
    case 'skip': return `  ${n(e.unit)} pierde el turno`;
    case 'death': return `  ✝ ${n(e.unit)} cae`;
    case 'over': return `\n=== ${e.result === 'win' ? 'VICTORIA' : 'DERROTA'} ===`;
    default: return null;
  }
}

function simulate(): string {
  const { state: s, events } = createCombat({
    seed: Date.now() >>> 0, w: 12, h: 7, obstacles: [{ x: 5, y: 3 }, { x: 6, y: 1 }, { x: 4, y: 5 }],
    units: [
      makeHero({ cls: 'guerrero', name: 'Guerrero', owner: 'p1', routes: ['baluarte', 'duelista'], pos: { x: 1, y: 3 } }),
      makeHero({ cls: 'mago', name: 'Mago', owner: 'p2', routes: ['fuego', 'tormenta'], pos: { x: 1, y: 2 } }),
      makeHero({ cls: 'clerigo', name: 'Clérigo', owner: 'p3', routes: ['luz', 'juicio'], pos: { x: 1, y: 4 } }),
      makeEnemy('esqueleto', { x: 8, y: 3 }), makeEnemy('arquero', { x: 10, y: 2 }),
      makeEnemy('necrofago', { x: 9, y: 4 }), makeEnemy('murcielago', { x: 9, y: 1 }),
    ],
  });
  const all: GameEvent[] = [...events];
  const push = (r: { ok: boolean; events?: GameEvent[] }): void => { if (r.ok && r.events) all.push(...r.events); };
  for (let i = 0; i < 300 && !s.over; i++) {
    const u = current(s)!;
    if (u.ai) { all.push(...runAiTurn(s)); continue; }
    for (let k = 0; k < 8 && !s.over && current(s)?.id === u.id; k++) {
      const foes = s.units.filter((e) => e.team === 'enemy' && alive(e)).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos));
      const hurtAlly = s.units.filter((h) => h.team === 'hero' && alive(h) && h.hp < h.maxHp * 0.6)[0];
      const opts = u.spells.map((sp) => SPELLS[sp.id]!).reverse();
      const healSpell = hurtAlly && opts.find((d) => d.heal && !castProblem(s, u, d, d.area ? u.pos : hurtAlly.pos));
      if (healSpell && hurtAlly) { push(cast(s, u.id, healSpell.id, healSpell.area ? u.pos : hurtAlly.pos)); continue; }
      const hit = opts.filter((d) => d.target === 'enemy').flatMap((d) => foes.map((f) => ({ d, f }))).find(({ d, f }) => !castProblem(s, u, d, f.pos));
      if (hit) { push(cast(s, u.id, hit.d.id, hit.f.pos)); continue; }
      if (u.mp > 0 && foes[0]) {
        const best = [...reachable(s, u.pos, u.mp).cost.keys()].map((c) => c.split(',').map(Number) as [number, number])
          .sort((a, b) => dist({ x: a[0], y: a[1] }, foes[0]!.pos) - dist({ x: b[0], y: b[1] }, foes[0]!.pos))[0]!;
        if (best[0] !== u.pos.x || best[1] !== u.pos.y) { push(move(s, u.id, { x: best[0], y: best[1] })); continue; }
      }
      break;
    }
    if (!s.over && current(s)?.id === u.id) push(endTurn(s, u.id));
  }
  return all.map((e) => describe(s, e)).filter(Boolean).join('\n');
}

document.getElementById('sim')!.addEventListener('click', () => {
  document.getElementById('out')!.textContent = simulate();
});
