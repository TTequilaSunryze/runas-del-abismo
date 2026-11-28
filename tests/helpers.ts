import { SPELLS } from '../src/core/classes/spells';
import { runAiTurn } from '../src/core/combat/ai';
import { cast, castProblem, current, endTurn, move, startCombat } from '../src/core/combat/engine';
import { alive, dist, reachable } from '../src/core/combat/grid';
import type { CombatState } from '../src/core/state';

/**
 * Juega un combate entero: IA para enemigos y un jugador sencillo para los héroes
 * (cura a quien lo necesita, rompe pilares, usa primero los hechizos más fuertes y remata).
 */
export function autoplay(s: CombatState, maxTurns = 600, info?: Parameters<typeof runAiTurn>[1]): void {
  if (s.deploy) startCombat(s);
  for (let i = 0; i < maxTurns && !s.over; i++) {
    const u = current(s)!;
    if (u.ai) { runAiTurn(s, info); continue; }
    for (let n = 0; n < 10 && !s.over && current(s)?.id === u.id; n++) {
      const spells = u.spells.map((sp) => SPELLS[sp.id]!).sort((a, b) => b.ap - a.ap);
      const hurt = s.units.filter((h) => h.team === 'hero' && alive(h) && h.hp < h.maxHp * 0.55).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const help = spells.filter((d) => d.heal || (d.shield && !d.dmg)).flatMap((d) => [...hurt, u].map((h) => ({ d, at: d.range[1] === 0 ? u.pos : h.pos })))
        .find(({ d, at }) => hurt.length && !castProblem(s, u, d, at));
      if (help) { cast(s, u.id, help.d.id, help.at); continue; }
      const foes = s.units.filter((e) => e.team === 'enemy' && alive(e))
        .sort((a, b) => Number(b.ai === 'pillar') - Number(a.ai === 'pillar') || a.hp - b.hp);
      const opt = spells.filter((d) => d.target === 'enemy' && d.dmg)
        .flatMap((d) => (d.range[1] === 0 ? [{ d, at: u.pos }] : foes.map((f) => ({ d, at: f.pos })))).find(({ d, at }) => !castProblem(s, u, d, at));
      if (opt) { cast(s, u.id, opt.d.id, opt.at); continue; }
      const goal = foes.sort((a, b) => Number(b.ai === 'pillar') - Number(a.ai === 'pillar') || dist(a.pos, u.pos) - dist(b.pos, u.pos))[0];
      if (u.mp > 0 && goal) {
        const reach = reachable(s, u.pos, u.mp);
        const atk = spells.filter((d) => d.target === 'enemy' && d.dmg && d.ap <= u.ap);
        const home = { ...u.pos };
        // mejor casilla: desde la que pueda atacar a alguien; si no, la más cercana al objetivo
        const score = (x: number, y: number): number => {
          u.pos = { x, y };
          const hit = atk.some((d) => foes.some((f) => !castProblem(s, u, d, d.range[1] === 0 ? u.pos : f.pos)));
          u.pos = home;
          return (hit ? 0 : 100) + dist({ x, y }, goal.pos);
        };
        const best = [...reach.cost.keys()].filter((k) => !s.obstacles.includes(k)).map((k) => k.split(',').map(Number) as [number, number])
          .sort((a, b) => score(a[0], a[1]) - score(b[0], b[1]))[0]!;
        if (best[0] !== u.pos.x || best[1] !== u.pos.y) { move(s, u.id, { x: best[0], y: best[1] }); continue; }
      }
      break;
    }
    if (!s.over && current(s)?.id === u.id) endTurn(s, u.id);
  }
}

import { leaveNode, metaAction, type RunState } from '../src/game/run';
/** Resuelve una sala especial como lo haría un grupo de bots (pacto 0, abrir cofre, descansar, salir de la forja). */
export function roomStep(run: RunState): RunState {
  if (run.phase !== 'room' || !run.room) return run;
  const r = run.room;
  if (r.kind === 'altar' && !r.result) for (const h of run.heroes) metaAction(run, h.owner, { a: 'room', op: 'pact', idx: 0 });
  if (r.kind === 'chest') metaAction(run, run.heroes[0]!.owner, { a: 'room', op: 'open' });
  if (r.kind === 'rest') for (const h of run.heroes) metaAction(run, h.owner, { a: 'room', op: 'rest', idx: 0 });
  leaveNode(run);
  return run;
}

import { arrivalCells, summon } from '../src/core/combat/engine';
/**
 * Q1: en el desgaste el jefe llega en la 3.ª oleada. Para las pruebas que juegan turnos sueltos del jefe,
 * hace entrar ya todas las oleadas pendientes (en casillas válidas) y devuelve el jefe.
 */
export function bringBoss(s: CombatState): ReturnType<typeof current> {
  for (const w of s.waves ?? []) for (const spec of w.units) { const at = arrivalCells(s, 1)[0]; if (at) summon(s, spec, at, []); }
  delete s.waves;
  if (s.encounter) s.encounter.bossIn = true;
  return s.units.find((u) => u.rank === 'boss');
}
