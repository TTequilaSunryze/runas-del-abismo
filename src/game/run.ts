// Estado de una partida (run) de la Zona 1: combates, botín, niveles y eventos de grupo.
// Es lo que se sincroniza entre jugadores y lo que se guarda.
import { makeEnemy } from '../content/zona1/enemies';
import { ZONA1_EVENTS } from '../content/zona1/events';
import { ZONA1_ITEMS } from '../content/zona1/items';
import { MAX_LEVEL } from '../core/classes/classes';
import { makeHero } from '../core/classes/factory';
import { createCombat, type CombatSetup } from '../core/combat/engine';
import { reachable } from '../core/combat/grid';
import { genItem, type Item, type Rarity, type Slot, type Stats } from '../core/items/items';
import { pick, randInt, type RngBox } from '../core/rng';
import type { ClassId, CombatState, GameEvent, Pos } from '../core/state';

export interface HeroSave {
  owner: string;
  name: string;
  cls: ClassId;
  routes: string[];
  hp: number;
  level: number;
  equip: Partial<Record<Slot, Item>>;
  /** bendiciones y maldiciones de eventos */
  boon: Stats;
}

export interface GroupEvent {
  id: string;
  votes: Record<string, number>;
  /** texto del desenlace; mientras no exista, se está votando */
  result?: string;
}

export interface RunState extends RngBox {
  version: 2;
  code: string;
  /** combate actual, empezando en 0 */
  fight: number;
  total: number;
  phase: 'combat' | 'between' | 'event' | 'won' | 'lost';
  heroes: HeroSave[];
  combat: CombatState | null;
  /** botín a elegir por jugador tras cada combate (uno de la lista) */
  offers: Record<string, Item[]>;
  event: GroupEvent | null;
  eventsSeen: string[];
  /** la próxima sala es una emboscada: más enemigos y mejor botín */
  ambush: boolean;
}

export const TOTAL_FIGHTS = 6;
/** Antes de estos combates hay un evento de grupo. */
const EVENT_BEFORE = [2, 4];
const ELITE_FIGHT = 3;

export function newRun(code: string, seed: number, players: Array<Pick<HeroSave, 'owner' | 'name' | 'cls' | 'routes'>>): RunState {
  const run: RunState = {
    version: 2, code, rng: seed >>> 0, fight: 0, total: TOTAL_FIGHTS, phase: 'between', combat: null,
    offers: {}, event: null, eventsSeen: [], ambush: false,
    heroes: players.map((p) => ({ ...p, hp: 0, level: 1, equip: {}, boon: {} })),
  };
  for (const h of run.heroes) h.hp = heroMaxHp(h);
  return run;
}

export function heroSpec(h: HeroSave, pos: Pos = { x: 0, y: 0 }) {
  return makeHero({ cls: h.cls, name: h.name, owner: h.owner, routes: h.routes, pos, level: h.level, bonus: [...Object.values(h.equip).map((i) => i.stats), h.boon] });
}

export const heroMaxHp = (h: HeroSave): number => heroSpec(h).maxHp;

/** El tablero crece con el grupo: 12×7, 14×8, 16×9, 16×10. */
export function boardSize(players: number): { w: number; h: number } {
  return { w: Math.min(16, 10 + players * 2), h: 6 + players };
}

function enemyList(run: RunState): string[] {
  const n = run.heroes.length;
  const d = run.fight;
  if (d === run.total - 1) return ['prior', ...Array.from({ length: n }, () => pick(run, ['esqueleto', 'arquero']))];
  const pool = d < 1 ? ['limo', 'murcielago', 'esqueleto'] : d < 3 ? ['limo', 'murcielago', 'esqueleto', 'arquero'] : ['murcielago', 'esqueleto', 'arquero', 'necrofago'];
  const elite = d === ELITE_FIGHT;
  // normal: n, n+1, n+1, (élite + n-1... mínimo 1), n+2
  const count = n + (d >= 1 ? 1 : 0) + (d >= 4 ? 1 : 0) - (elite ? 1 : 0) + (run.ambush ? 2 : 0);
  const list = Array.from({ length: Math.max(1, count) }, () => pick(run, pool));
  if (elite) list.unshift('caballero');
  // en grupo, desde el segundo combate siempre hay un tirador que obliga a moverse
  if (n >= 2 && d >= 1 && !list.includes('arquero')) list[list.length - 1] = 'arquero';
  return list;
}

export function buildFight(run: RunState): CombatSetup {
  const n = run.heroes.length;
  const { w, h } = boardSize(n);
  const ys = [0, 1, -1, 2].map((o) => Math.floor(h / 2) + o);
  const heroes = run.heroes.map((s, i) => {
    const u = heroSpec(s, { x: 1, y: ys[i]! });
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
    // las púas solo aparecen en grupo: 2 por jugador extra
    const traps = Array.from({ length: (n - 1) * 2 }, () => free(3, w - 4));
    const enemies = ids.map((id) => makeEnemy(id, free(w - 4, w - 1), run.fight, n));
    const setup: CombatSetup = { seed: randInt(run, 1, 2 ** 31 - 1), w, h, obstacles, traps, units: [...heroes, ...enemies] };
    // todo el mundo debe poder llegar a todo el mundo
    const probe = createCombat(setup).state;
    const walk = reachable(probe, heroes[0]!.pos, 99, true).cost;
    if (setup.units.every((u) => walk.has(`${u.pos.x},${u.pos.y}`))) return setup;
  }
}

/** Esqueletos que invoca el jefe. */
export const bossMinion = (run: RunState) => (pos: Pos) => makeEnemy('esqueleto', pos, Math.max(0, run.fight - 2));

/** Pasa a lo siguiente tras la pantalla de botín: evento de grupo o combate. */
export function advance(run: RunState): GameEvent[] {
  if (run.phase !== 'between' && run.phase !== 'event') return [];
  run.offers = {};
  if (run.phase === 'between' && EVENT_BEFORE.includes(run.fight)) {
    const options = ZONA1_EVENTS.filter((e) => !run.eventsSeen.includes(e.id));
    if (options.length) {
      const e = pick(run, options);
      run.eventsSeen.push(e.id);
      run.event = { id: e.id, votes: {} };
      run.phase = 'event';
      return [];
    }
  }
  run.event = null;
  const { state, events } = createCombat(buildFight(run));
  run.combat = state;
  run.phase = 'combat';
  return events;
}

export function vote(run: RunState, owner: string, idx: number): void {
  const def = ZONA1_EVENTS.find((e) => e.id === run.event?.id);
  if (!def || !run.event || run.event.result || !run.heroes.some((h) => h.owner === owner)) return;
  if (idx >= 0 && idx < def.options.length) run.event.votes[owner] = idx;
}

/** Decide por mayoría; en empate manda el voto del anfitrión (o la primera opción empatada). */
export function resolveEvent(run: RunState, hostId: string): void {
  const ev = run.event;
  const def = ZONA1_EVENTS.find((e) => e.id === ev?.id);
  if (!ev || !def || ev.result) return;
  const count = def.options.map((_, i) => Object.values(ev.votes).filter((v) => v === i).length);
  const max = Math.max(...count);
  const tied = count.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  const hostVote = ev.votes[hostId];
  const winner = tied.length > 1 && hostVote !== undefined && tied.includes(hostVote) ? hostVote : tied[0]!;
  const opt = def.options[winner]!;
  ev.result = `El grupo elige: ${opt.label}. ${opt.apply(run)}`;
  for (const h of run.heroes) h.hp = Math.max(1, Math.min(heroMaxHp(h), h.hp));
}

/** Cierra el combate terminado: vida, nivel y botín. */
export function finishFight(run: RunState): void {
  const c = run.combat;
  if (!c?.over) return;
  if (c.over === 'lose') { run.phase = 'lost'; return; }
  const minRarity: Rarity = run.ambush ? 2 : run.fight === ELITE_FIGHT ? 1 : 0;
  const depth = run.fight;
  run.offers = {};
  for (const h of run.heroes) {
    const u = c.units.find((x) => x.owner === h.owner);
    const left = u ? u.hp : h.hp;
    if (h.level < MAX_LEVEL) h.level++;
    const max = heroMaxHp(h);
    // los caídos vuelven con el 30%; los demás recuperan un 35% entre combates
    h.hp = left <= 0 ? Math.ceil(max * 0.3) : Math.min(max, left + Math.ceil(max * 0.35));
    run.offers[h.owner] = Array.from({ length: run.ambush ? 4 : 3 }, () => genItem(run, ZONA1_ITEMS, depth, minRarity));
  }
  run.ambush = false;
  run.fight++;
  run.combat = null;
  run.phase = run.fight >= run.total ? 'won' : 'between';
}

/** El jugador se queda uno de los objetos ofrecidos (lo equipa, sustituyendo al anterior) o los descarta con -1. */
export function pickLoot(run: RunState, owner: string, idx: number): void {
  const list = run.offers[owner];
  const h = run.heroes.find((x) => x.owner === owner);
  if (!list || !h) return;
  const item = list[idx];
  if (item) {
    h.equip[item.slot] = item;
    h.hp = Math.max(1, Math.min(heroMaxHp(h), h.hp));
  }
  delete run.offers[owner];
}
