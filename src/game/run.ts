// Estado de una partida (run) de la Zona 1 y construcción de cada combate.
// Es lo que se sincroniza entre jugadores y lo que se guarda.
import { makeEnemy } from '../content/zona1/enemies';
import { CLASSES } from '../core/classes/classes';
import { makeHero } from '../core/classes/factory';
import { createCombat, type CombatSetup } from '../core/combat/engine';
import { reachable } from '../core/combat/grid';
import { pick, randInt, type RngBox } from '../core/rng';
import type { ClassId, CombatState, GameEvent, Pos } from '../core/state';

export interface HeroSave {
  owner: string;
  name: string;
  cls: ClassId;
  routes: string[];
  hp: number;
}

export interface RunState extends RngBox {
  version: 1;
  code: string;
  /** combate actual, empezando en 0 */
  fight: number;
  total: number;
  phase: 'combat' | 'between' | 'won' | 'lost';
  heroes: HeroSave[];
  combat: CombatState | null;
}

export const TOTAL_FIGHTS = 5;

export function newRun(code: string, seed: number, players: Array<Omit<HeroSave, 'hp'>>): RunState {
  return {
    version: 1, code, rng: seed >>> 0, fight: 0, total: TOTAL_FIGHTS, phase: 'between', combat: null,
    heroes: players.map((p) => ({ ...p, hp: CLASSES[p.cls].hp })),
  };
}

/** El tablero crece con el grupo: 12×7, 14×8, 16×9, 16×10. */
export function boardSize(players: number): { w: number; h: number } {
  return { w: Math.min(16, 10 + players * 2), h: 6 + players };
}

function enemyList(run: RunState): string[] {
  const n = run.heroes.length;
  const d = run.fight;
  const pool = d < 1 ? ['limo', 'murcielago', 'esqueleto'] : d < 3 ? ['limo', 'murcielago', 'esqueleto', 'arquero'] : ['murcielago', 'esqueleto', 'arquero', 'necrofago'];
  const last = d === run.total - 1;
  const count = n + 1 + Math.floor(d / 2) - (last ? 1 : 0);
  const list = Array.from({ length: Math.max(1, count) }, () => pick(run, pool));
  if (last) list.unshift('caballero');
  // en grupo, desde el segundo combate siempre hay al menos un tirador que obliga a moverse
  if (n >= 2 && d >= 1 && !list.includes('arquero')) list[list.length - 1] = 'arquero';
  return list;
}

export function buildFight(run: RunState): CombatSetup {
  const n = run.heroes.length;
  const { w, h } = boardSize(n);
  const ys = [0, 1, -1, 2].map((o) => Math.floor(h / 2) + o);
  const heroes = run.heroes.map((s, i) => {
    const u = makeHero({ cls: s.cls, name: s.name, owner: s.owner, routes: s.routes, pos: { x: 1, y: ys[i]! } });
    u.hp = Math.max(1, Math.min(u.maxHp, s.hp));
    return u;
  });
  const ids = enemyList(run);
  for (let attempt = 0; ; attempt++) {
    const taken = new Set(heroes.map((u) => `${u.pos.x},${u.pos.y}`));
    const free = (minX: number, maxX: number): Pos => {
      for (;;) {
        const p = { x: randInt(run, minX, maxX), y: randInt(run, 0, h - 1) };
        if (!taken.has(`${p.x},${p.y}`)) { taken.add(`${p.x},${p.y}`); return p; }
      }
    };
    const obstacles = attempt > 30 ? [] : Array.from({ length: 4 + n * 2 }, () => free(3, w - 5));
    const enemies = ids.map((id) => makeEnemy(id, free(w - 4, w - 1), run.fight));
    const setup: CombatSetup = { seed: randInt(run, 1, 2 ** 31 - 1), w, h, obstacles, units: [...heroes, ...enemies] };
    // todo el mundo debe poder llegar a todo el mundo
    const probe = createCombat(setup).state;
    const walk = reachable(probe, heroes[0]!.pos, 99, true).cost;
    if (setup.units.every((u) => walk.has(`${u.pos.x},${u.pos.y}`))) return setup;
  }
}

export function startFight(run: RunState): GameEvent[] {
  const { state, events } = createCombat(buildFight(run));
  run.combat = state;
  run.phase = 'combat';
  return events;
}

/** Cierra el combate terminado: guarda la vida de cada héroe y decide la siguiente fase. */
export function finishFight(run: RunState): void {
  const c = run.combat;
  if (!c?.over) return;
  if (c.over === 'lose') { run.phase = 'lost'; return; }
  for (const h of run.heroes) {
    const u = c.units.find((x) => x.owner === h.owner);
    if (!u) continue;
    // los caídos vuelven con el 30%; los demás recuperan un 25% entre combates
    h.hp = u.hp <= 0 ? Math.ceil(u.maxHp * 0.3) : Math.min(u.maxHp, u.hp + Math.ceil(u.maxHp * 0.25));
  }
  run.fight++;
  run.combat = null;
  run.phase = run.fight >= run.total ? 'won' : 'between';
}
