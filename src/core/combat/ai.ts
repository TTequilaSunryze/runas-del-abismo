// IA enemiga: acercarse y atacar. El jefe tiene dos fases e invoca refuerzos.
import { SPELLS, type SpellDef } from '../classes/spells';
import type { CombatState, GameEvent, Pos, Unit } from '../state';
import { cast, castProblem, current, endTurn, move, summon, type UnitSpec } from './engine';
import { alive, dist, hasLineOfSight, reachable } from './grid';

function attackAll(s: CombatState, u: Unit, def: SpellDef, ev: GameEvent[]): void {
  for (let i = 0; i < 6 && !s.over && alive(u); i++) {
    const target = s.units
      .filter((h) => h.team !== u.team && alive(h) && !castProblem(s, u, def, h.pos))
      .sort((a, b) => a.hp - b.hp)[0];
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
  const foes = s.units.filter((h) => h.team !== u.team && alive(h));
  const reach = reachable(s, u.pos, u.mp);
  let best: Pos | null = null;
  let bestScore = Infinity;
  for (const k of reach.cost.keys()) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const p = { x, y };
    const walk = reachable(s, p, 40, true).cost;
    let score = Infinity;
    for (const f of foes) {
      const d = walk.get(`${f.pos.x},${f.pos.y}`) ?? 99;
      const flat = dist(p, f.pos);
      const canHit = flat >= def.range[0] && flat <= def.range[1] && (!def.los || flat <= 1 || hasLineOfSight(s, p, f.pos));
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

export type MinionFactory = (pos: Pos) => UnitSpec;

function bossTurn(s: CombatState, u: Unit, minion: MinionFactory | undefined, ev: GameEvent[]): void {
  const heroes = s.units.filter((h) => h.team === 'hero').length;
  const minions = s.units.filter((m) => m.team === 'enemy' && alive(m) && m.id !== u.id).length;
  if ((u.phase ?? 1) === 1 && u.hp <= u.maxHp / 2) {
    // Fase 2: se funde con el osario. Más duro, más rápido, cuerpo a cuerpo.
    u.phase = 2;
    u.armor += 2;
    u.maxMp = 3;
    u.mp = 3;
    u.name = 'Coloso del Osario';
    ev.push({ t: 'phase', unit: u.id, phase: 2 });
    if (minion) for (let i = 0; i < Math.max(1, heroes - 1); i++) summon(s, minion(u.pos), u.pos, ev);
  } else if ((u.phase ?? 1) === 1 && minion && s.round % 2 === 0 && minions < 1 + heroes) {
    summon(s, minion(u.pos), u.pos, ev);
    u.ap = Math.max(0, u.ap - 3);
  }
  const phase2 = u.phase === 2;
  fight(s, u, SPELLS[phase2 ? 'e_barrido' : 'e_maldicion']!, !phase2, ev);
}

/** Juega el turno completo de la unidad actual si la controla la IA. */
export function runAiTurn(s: CombatState, minion?: MinionFactory): GameEvent[] {
  const u = current(s);
  const ev: GameEvent[] = [];
  if (!u || !u.ai) return ev;
  if (u.ai === 'boss') bossTurn(s, u, minion, ev);
  else fight(s, u, SPELLS[u.spells[0]!.id]!, u.ai === 'ranged', ev);
  if (!s.over && current(s)?.id === u.id) {
    const r = endTurn(s, u.id);
    if (r.ok) ev.push(...r.events);
  }
  return ev;
}
