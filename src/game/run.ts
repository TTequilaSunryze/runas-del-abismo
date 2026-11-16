// Estado de una partida (run): mapa, combates, botín, tienda y eventos de grupo.
// Es lo que se sincroniza entre jugadores y lo que se guarda.
import { AFFIXES, makeEnemy } from '../content/enemies';
import { DAILY_ASC, DAILY_MODS, perkLevel, type Perks } from '../content/modes';
import { ZONES, type ZoneDef } from '../content/zones';
import type { BossInfo } from '../core/combat/ai';
import { RELIC_EVENTS } from '../content/relics';
import { CLASSES, MAX_LEVEL, canPickRoute } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { SETS, setBonus } from '../core/items/sets';
import { UPGRADES, canUpgrade } from '../core/upgrades';
import { makeHero } from '../core/classes/factory';
import { createCombat, type CombatSetup, type UnitSpec } from '../core/combat/engine';
import { reachable } from '../core/combat/grid';
import { BAG_SIZE, PRICE, SLOTS, STAT_NAME, genItem, genSetPiece, type Item, type Rarity, type Slot, type StatKey, type Stats } from '../core/items/items';
import { pick, rand, randInt, seedFrom, shuffle, type RngBox } from '../core/rng';
import { RUNES } from '../core/runes';
import type { ClassId, CombatState, GameEvent, Pos } from '../core/state';

export interface HeroSave {
  owner: string;
  name: string;
  cls: ClassId;
  routes: string[];
  hp: number;
  level: number;
  gold: number;
  equip: Partial<Record<Slot, Item>>;
  bag: Item[];
  /** runas sin engarzar */
  runes: string[];
  /** runa engarzada en cada hechizo: id de hechizo → id de runa */
  sockets: Record<string, string>;
  /** bendiciones y maldiciones de eventos */
  boon: Stats;
  /** mejoras permanentes del jugador (compradas con ecos) */
  perks: Perks;
  /** re-tiradas de botín que le quedan en esta zona */
  rerolls: number;
  stats: HeroStats;
  /** mejoras de hechizo elegidas: id de hechizo → ids de mejora */
  ups: Record<string, string[]>;
  /** elecciones de mejora que le quedan por hacer */
  upPending: number;
  /** mejoras entre las que elegir ahora */
  upOffer: Array<{ spell: string; up: string }> | null;
  /** nivel de maestría de la clase al empezar */
  mastery: number;
}

/** Héroe guardado en el Salón: lo justo para reconstruirlo. */
export interface Champion {
  id: string;
  name: string;
  /** jugador que lo guardó */
  by: string;
  cls: ClassId;
  routes: string[];
  level: number;
  equip: Partial<Record<Slot, Item>>;
  sockets: Record<string, string>;
  ups: Record<string, string[]>;
  asc: number;
  won: boolean;
  date: string;
}

export interface HeroStats {
  dmg: number;
  kills: number;
  falls: number;
  heal: number;
  maxGold: number;
}

export interface GroupEvent {
  id: string;
  votes: Record<string, number>;
  /** texto del desenlace; mientras no exista, se está votando */
  result?: string;
}

export type NodeKind = 'combat' | 'elite' | 'event' | 'rest' | 'shop' | 'treasure' | 'boss';
export const NODE_NAME: Record<NodeKind, string> = { combat: '⚔️ Combate', elite: '☠️ Élite', event: '❓ Evento de grupo', rest: '🔥 Descanso', shop: '💰 Tienda', treasure: '🎁 Tesoro', boss: '👑 Jefe' };
export const NODE_HINT: Record<NodeKind, string> = {
  combat: 'Enemigos normales. Botín, oro y un nivel.', elite: 'El campeón de la zona, con modificadores. Botín raro y una runa rara.',
  event: 'Una decisión que se vota y afecta a todos.', rest: 'Todos recuperan el 40% de su vida.',
  shop: 'Gastad vuestro oro en objetos y pociones.', treasure: 'Cada uno elige un objeto raro o mejor, sin combatir.', boss: 'El guardián de la zona. Dos fases.',
};

export interface ShopSlot {
  item?: Item;
  rune?: string;
  price: number;
  sold: boolean;
}

export interface RunState extends RngBox {
  version: 7;
  code: string;
  /** nivel de ascensión (0 = normal) */
  asc: number;
  /** fecha del reto diario (AAAA-MM-DD) o null */
  daily: string | null;
  /** modificadores del reto diario */
  mods: string[];
  /** runas desbloqueadas por logros (de cualquiera del grupo) */
  unlocked: string[];
  /** hitos de la partida, para logros: p. ej. flawless_0 = jefe de la zona 1 sin bajas */
  flags: string[];
  /** zona actual (0 a 2) */
  zone: number;
  /** combates ganados en esta zona: marca la dificultad de sus enemigos */
  zoneFight: number;
  /** combates ganados en total: marca la calidad del botín */
  fight: number;
  /** sala actual del mapa */
  step: number;
  map: NodeKind[][];
  phase: 'map' | 'combat' | 'event' | 'shop' | 'won' | 'lost';
  /** tipo del combate en curso */
  kind: NodeKind;
  heroes: HeroSave[];
  combat: CombatState | null;
  /** botín a elegir por jugador (uno de la lista) */
  offers: Record<string, Item[]>;
  event: GroupEvent | null;
  eventsSeen: string[];
  shop: ShopSlot[] | null;
  /** la próxima sala de combate es una emboscada: más enemigos y mejor botín */
  ambush: boolean;
  /** lo último que pasó, para mostrarlo en el mapa */
  note: string;
  /** héroes guardados por los jugadores: pueden volver como élites */
  nemesis: Champion[];
  nemesisUsed: string[];
  /** duelo 3 contra 3: dueños de cada bando (null = IA) y sus nombres */
  arena?: { a: string; b: string | null; nameA: string; nameB: string };
}

export const POTION_PRICE = 25;
export const POTION_HEAL = 0.3;

function makeMap(box: RngBox): NodeKind[][] {
  const two = (list: NodeKind[]): NodeKind[] => shuffle(box, list).slice(0, 2);
  // 7 salas por zona
  return [['combat'], ['combat', 'event'], two(['combat', 'treasure', 'shop']), ['elite', 'combat'], two(['combat', 'event', 'treasure']), ['rest', 'shop'], ['boss']];
}

export interface RunOpts {
  asc?: number;
  /** fecha AAAA-MM-DD para el reto diario */
  daily?: string | null;
  unlocked?: string[];
  nemesis?: unknown[];
}

export type NewHero = Pick<HeroSave, 'owner' | 'name' | 'cls' | 'routes'> & { perks?: Perks; mastery?: number };

/** Niveles en los que se elige una mejora de hechizo. */
export const UP_LEVELS = [4, 6, 8, 10, 12];

/** Semilla y modificadores del reto diario de una fecha: iguales para todo el mundo. */
export function dailyOf(date: string): { seed: number; mods: string[] } {
  const box = { rng: seedFrom(`rda-diario-${date}`) };
  return { seed: box.rng, mods: shuffle(box, DAILY_MODS.map((m) => m.id)).slice(0, 2) };
}

export function newRun(code: string, seed: number, players: NewHero[], opts: RunOpts = {}): RunState {
  const daily = opts.daily ? dailyOf(opts.daily) : null;
  const run: RunState = {
    version: 7, code, asc: daily ? DAILY_ASC : Math.max(0, Math.min(10, opts.asc ?? 0)), daily: opts.daily ?? null, mods: daily?.mods ?? [],
    unlocked: [...new Set(opts.unlocked ?? [])].filter((r) => RUNES[r]), flags: [],
    zone: 0, zoneFight: 0, rng: (daily?.seed ?? seed) >>> 0, fight: 0, step: 0, map: [], phase: 'map', kind: 'combat', combat: null,
    offers: {}, event: null, eventsSeen: [], shop: null, ambush: false, note: ZONES[0]!.intro,
    nemesis: (opts.nemesis ?? []).map(cleanChampion).filter((c): c is Champion => !!c).slice(0, 8), nemesisUsed: [],
    heroes: players.map((p) => ({
      owner: p.owner, name: p.name, cls: p.cls, routes: p.routes, hp: 0, level: 1, gold: 0, equip: {}, bag: [], runes: [], sockets: {}, boon: {},
      perks: Object.fromEntries(['vit', 'gold', 'rune', 'loot', 'reroll', 'aid'].map((k) => [k, perkLevel(p.perks, k)])),
      rerolls: 0, stats: { dmg: 0, kills: 0, falls: 0, heal: 0, maxGold: 0 },
      ups: {}, upOffer: null, mastery: Math.max(0, Math.min(5, Math.floor(Number(p.mastery) || 0))), upPending: 0,
    })),
  };
  run.map = makeMap(run);
  for (const h of run.heroes) {
    const base = heroMaxHp(h);
    h.boon.hp = Math.round(base * (perkLevel(h.perks, 'vit') * 0.06 - (run.mods.includes('cristal') ? 0.25 : 0)));
    if (run.mods.includes('cristal')) h.boon.power = 25;
    h.gold = perkLevel(h.perks, 'gold') * 25;
    h.rerolls = perkLevel(h.perks, 'reroll');
    h.hp = Math.round(heroMaxHp(h) * (run.asc >= 8 ? 0.75 : 1));
    for (let i = 0; i <= perkLevel(h.perks, 'rune'); i++) h.runes.push(randomRune(run, false));
    // talento de maestría: una mejora de hechizo desde el principio (dos con maestría 5)
    h.upPending = h.mastery >= 5 ? 2 : h.mastery >= 3 ? 1 : 0;
    ensureUpOffer(run, h);
  }
  return run;
}

export const zoneOf = (run: RunState): ZoneDef => ZONES[run.zone] ?? ZONES[0]!;

export const RUNE_PRICE = [45, 90] as const;

/** Runa al azar: `rare` true = rara, false = común, undefined = cualquiera (las raras salen menos). */
export function randomRune(run: RunState, rare?: boolean): string {
  const want = rare ?? rand(run) < 0.25;
  return pick(run, Object.values(RUNES).filter((r) => r.rare === want && (!r.locked || run.unlocked.includes(r.id)))).id;
}

/** Precio con los recargos de la ascensión y del reto diario. */
export const priceOf = (run: RunState, base: number): number => Math.round(base * (run.asc >= 4 ? 1.25 : 1) * (run.mods.includes('codicia') ? 2 : 1));

type Build = Pick<HeroSave, 'cls' | 'name' | 'owner' | 'routes' | 'level' | 'equip' | 'sockets'> & { boon?: Stats; ups?: Record<string, string[]> };

/** El héroe listo para combatir: clase, nivel, equipo, sets, runas y mejoras. */
export function heroSpec(h: Build, pos: Pos = { x: 0, y: 0 }): UnitSpec {
  const sets = setBonus(h.equip);
  const u = makeHero({ cls: h.cls, name: h.name, owner: h.owner, routes: h.routes, pos, level: h.level, bonus: [...Object.values(h.equip).map((i) => i.stats), ...sets.stats, h.boon] });
  for (const sp of u.spells) {
    if (h.sockets[sp.id]) sp.rune = h.sockets[sp.id];
    if (h.ups?.[sp.id]?.length) sp.ups = [...h.ups[sp.id]!];
  }
  if (sets.traits.length) u.traits = sets.traits;
  return u;
}

/** Propone mejoras de hechizo si al héroe le queda alguna elección pendiente. */
export function ensureUpOffer(run: RunState, h: HeroSave): void {
  if (h.upOffer || h.upPending <= 0) return;
  const all = heroSpec(h).spells.flatMap((sp) => Object.keys(UPGRADES).filter((id) => canUpgrade(SPELLS[sp.id]!, h.ups[sp.id] ?? [], id)).map((up) => ({ spell: sp.id, up })));
  if (!all.length) { h.upPending = 0; return; }
  const out: Array<{ spell: string; up: string }> = [];
  // primero una por hechizo, para que haya variedad
  for (const o of shuffle(run, all)) if (out.length < (h.mastery >= 4 ? 4 : 3) && !out.some((x) => x.spell === o.spell)) out.push(o);
  for (const o of shuffle(run, all)) if (out.length < (h.mastery >= 4 ? 4 : 3) && !out.includes(o)) out.push(o);
  h.upOffer = out;
}

const STAT_LIMIT: Partial<Record<StatKey, number>> = { ap: 1, mp: 1, status: 1, armor: 8 };

/** Valida un héroe guardado que llega de otro jugador: nada fuera de las reglas del juego. */
export function cleanChampion(x: unknown): Champion | null {
  try {
    const c = x as Champion;
    if (!c || typeof c !== 'object' || !CLASSES[c.cls] || !Array.isArray(c.routes)) return null;
    const routes: string[] = [];
    for (const r of c.routes.slice(0, 2)) if (canPickRoute(c.cls, routes, String(r))) routes.push(String(r));
    if (!routes.length) return null;
    const equip: Partial<Record<Slot, Item>> = {};
    for (const sl of SLOTS) {
      const it = (c.equip ?? {})[sl];
      if (!it || typeof it !== 'object') continue;
      const stats: Stats = {};
      for (const k of Object.keys(STAT_NAME) as StatKey[]) {
        const v = Math.round(Number(it.stats?.[k]) || 0);
        if (v) stats[k] = Math.max(-40, Math.min(STAT_LIMIT[k] ?? 60, v));
      }
      equip[sl] = { slot: sl, name: String(it.name ?? '?').slice(0, 40), rarity: Math.max(0, Math.min(3, Math.floor(Number(it.rarity) || 0))) as Rarity, stats, ...(it.set && SETS[it.set] && SETS[it.set]!.pieces[sl] ? { set: it.set } : {}) };
    }
    const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(c.level) || 1)));
    const known = makeHero({ cls: c.cls, name: 'x', owner: 'x', routes, pos: { x: 0, y: 0 }, level }).spells.map((sp) => sp.id);
    const sockets: Record<string, string> = {}, ups: Record<string, string[]> = {};
    let total = 0;
    for (const id of known) {
      const r = c.sockets?.[id];
      if (typeof r === 'string' && RUNES[r]) sockets[id] = r;
      const list: string[] = [];
      for (const up of Array.isArray(c.ups?.[id]) ? c.ups[id]! : []) if (total < 7 && canUpgrade(SPELLS[id]!, list, String(up))) { list.push(String(up)); total++; }
      if (list.length) ups[id] = list;
    }
    return { id: String(c.id ?? '').slice(0, 40) || 'x', name: String(c.name ?? 'Héroe').slice(0, 14), by: String(c.by ?? '').slice(0, 14), cls: c.cls, routes, level, equip, sockets, ups,
      asc: Math.max(0, Math.min(10, Math.floor(Number(c.asc) || 0))), won: !!c.won, date: String(c.date ?? '').slice(0, 10) };
  } catch {
    return null;
  }
}

/** Foto de un héroe de la partida para guardarlo en el Salón. */
export function championOf(run: RunState, h: HeroSave): Champion {
  return { id: `${run.code}-${run.rng >>> 0}-${h.owner.slice(0, 6)}`, name: h.name, by: h.name, cls: h.cls, routes: [...h.routes], level: h.level, equip: structuredClone(h.equip), sockets: { ...h.sockets }, ups: structuredClone(h.ups),
    asc: run.asc, won: run.phase === 'won', date: new Date().toISOString().slice(0, 10) };
}

/** Un héroe guardado como unidad de combate. `owner` null = lo lleva la IA. */
export function championUnit(c: Champion, pos: Pos, team: 'hero' | 'enemy', owner: string | null, o: { hpMul?: number; powerMul?: number; level?: number; name?: string } = {}): UnitSpec {
  const u = heroSpec({ ...c, owner: owner ?? '', level: Math.min(c.level, o.level ?? MAX_LEVEL), name: o.name ?? c.name }, pos);
  u.team = team;
  u.owner = owner;
  u.ai = owner ? null : 'champ';
  u.hp = u.maxHp = Math.round(u.maxHp * (o.hpMul ?? 1));
  u.power = Math.round(u.power * (o.powerMul ?? 1));
  return u;
}

export const heroMaxHp = (h: HeroSave): number => heroSpec(h).maxHp;
const clampHp = (h: HeroSave): void => { h.hp = Math.max(1, Math.min(heroMaxHp(h), h.hp)); };

/** El tablero crece con el grupo: 12×7, 14×8, 16×9, 16×10. */
export function boardSize(players: number): { w: number; h: number } {
  return { w: Math.min(16, 10 + players * 2), h: 6 + players };
}

function enemyList(run: RunState): string[] {
  const n = run.heroes.length;
  const d = run.zoneFight;
  const z = zoneOf(run);
  if (run.kind === 'boss') return [z.boss, ...Array.from({ length: n }, () => pick(run, z.bossGuard))];
  const pool = z.pools[d < 1 ? 0 : d < 3 ? 1 : 2];
  const elite = run.kind === 'elite';
  const count = n + (d >= 1 ? 1 : 0) + (d >= 3 ? 1 : 0) - (elite ? 1 : 0) + (run.ambush ? 2 : 0) + (run.asc >= 7 ? 1 : 0) + (run.mods.includes('horda') ? 1 : 0);
  const list = Array.from({ length: Math.max(1, count) }, () => pick(run, pool));
  if (elite) {
    // a partir de la zona 2, un héroe del Salón puede ocupar el lugar del élite
    const pool = run.nemesis.filter((c) => !run.nemesisUsed.includes(c.id));
    if (run.zone >= 1 && pool.length && rand(run) < 0.65) {
      const c = pick(run, pool);
      run.nemesisUsed.push(c.id);
      list.unshift(`nemesis:${c.id}`);
    } else list.unshift(z.elite);
  }
  // en grupo, desde el segundo combate siempre hay un tirador que obliga a moverse
  if (n >= 2 && d >= 1 && !list.includes(z.shooter)) list[list.length - 1] = z.shooter;
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
    // el jefe no crece indefinidamente con los combates previos
    const enemies = ids.map((id, i) => id.startsWith('nemesis:') ? nemesisUnit(run, id.slice(8), free(w - 4, w - 1)) : makeEnemy(id, free(w - 4, w - 1), Math.min(id === zoneOf(run).boss || (run.kind === 'elite' && i === 0) ? 2 : 5, run.zoneFight), n, enemyOpts(run, id, i === 0)));
    const setup: CombatSetup = { seed: randInt(run, 1, 2 ** 31 - 1), w, h, obstacles, traps, units: [...heroes, ...enemies] };
    // todo el mundo debe poder llegar a todo el mundo
    const probe = createCombat(setup).state;
    const walk = reachable(probe, heroes[0]!.pos, 99, true).cost;
    if (setup.units.every((u) => walk.has(`${u.pos.x},${u.pos.y}`))) return setup;
  }
}

function nemesisUnit(run: RunState, id: string, pos: Pos): UnitSpec {
  const c = run.nemesis.find((x) => x.id === id)!;
  const n = run.heroes.length;
  const level = Math.max(...run.heroes.map((h) => h.level));
  return championUnit(c, pos, 'enemy', null, { hpMul: 1.9 + 0.7 * (n - 1) + (run.asc >= 1 ? 0.2 : 0), powerMul: 0.5, level, name: `Némesis: ${c.name}` });
}

/** Ascensión y reto diario sobre cada enemigo, y modificadores de élite. */
function enemyOpts(run: RunState, id: string, first: boolean) {
  const n = run.heroes.length;
  const z = zoneOf(run);
  const boost = (run.asc >= 1 ? 0.1 : 0) + (run.asc >= 9 ? 0.1 : 0);
  const affixes: string[] = [];
  const all = Object.keys(AFFIXES);
  if (run.kind === 'elite' && first && id === z.elite) affixes.push(...shuffle(run, all).slice(0, run.asc >= 2 ? 2 : 1));
  else if (id !== z.boss) {
    // en grupo y más adelante, más variantes con modificador
    const chance = run.zone * 0.12 + (run.zoneFight >= 2 ? 0.1 : 0) + 0.08 * (n - 1) + (run.asc >= 5 ? 0.15 : 0);
    if (rand(run) < chance) affixes.push(pick(run, all));
  }
  if (run.mods.includes('llamas') && !affixes.includes('ardiente')) affixes.push('ardiente');
  return {
    affixes,
    hpMul: 1 + boost + (id === z.boss && run.asc >= 6 ? 0.2 : 0),
    power: boost * 100 + (run.mods.includes('frenesi') ? 20 : 0),
  };
}

/** Lo que invoca el jefe de la zona, sus pilares y su nombre en la segunda fase. */
export const bossInfo = (run: RunState): BossInfo => {
  const z = zoneOf(run), n = run.heroes.length;
  return {
    minion: (pos: Pos) => makeEnemy(z.bossMinion, pos, 1, 1, { hpMul: 1 + (run.asc >= 1 ? 0.1 : 0) }),
    pillar: (pos: Pos) => makeEnemy(z.bossPillar, pos, 0, n),
    pillars: (n >= 3 ? 3 : 2) * (run.asc >= 10 ? 2 : 1),
    minionCap: n,
    phase2Name: z.bossPhase2,
  };
};

/** Lleva la cuenta de daño, bajas, caídas y curación de cada héroe a partir de lo ocurrido en combate. */
export function recordEvents(run: RunState, events: GameEvent[], track: { caster: number | null }): void {
  const c = run.combat;
  if (!c) return;
  const ownerOf = (id: number | null): HeroSave | undefined => {
    const u = id === null ? undefined : c.units.find((x) => x.id === id);
    return u?.owner ? run.heroes.find((h) => h.owner === u.owner) : undefined;
  };
  for (const e of events) {
    if (e.t === 'turn') track.caster = null;
    else if (e.t === 'cast') track.caster = e.unit;
    else if (e.t === 'damage') { const h = ownerOf(track.caster); const t = c.units.find((x) => x.id === e.unit); if (h && t?.team === 'enemy') h.stats.dmg += e.amount; }
    else if (e.t === 'heal') { const h = ownerOf(track.caster); if (h) h.stats.heal += e.amount; }
    else if (e.t === 'death') {
      const t = c.units.find((x) => x.id === e.unit);
      if (t?.team === 'hero') { const h = ownerOf(t.id); if (h) h.stats.falls++; }
      else if (t && t.ai !== 'pillar') { const h = ownerOf(track.caster); if (h) h.stats.kills++; }
    }
  }
}

/** Un objeto de botín. A veces es una pieza de set, sobre todo de los sets que el héroe ya empezó. */
export function genLoot(run: RunState, h: HeroSave | undefined, min: Rarity, depth = run.fight, forceSet = false): Item {
  const mine = h ? [...Object.values(h.equip), ...h.bag].filter((i) => i.set) : [];
  const started = [...new Set(mine.map((i) => i.set!))].filter((id) => SETS[id] && mine.filter((i) => i.set === id).length < 3);
  if (forceSet || rand(run) < (started.length ? 0.3 : 0.14)) {
    const set = started.length && rand(run) < 0.75 ? SETS[pick(run, started)]! : pick(run, Object.values(SETS));
    const all = Object.keys(set.pieces) as Slot[];
    const missing = all.filter((sl) => !mine.some((i) => i.set === set.id && i.slot === sl));
    return genSetPiece(run, zoneOf(run).items, depth, set, pick(run, missing.length ? missing : all));
  }
  return genItem(run, zoneOf(run).items, depth, min);
}

function offerAll(run: RunState, count: number, min: Rarity, forceSet = false): void {
  for (const h of run.heroes) run.offers[h.owner] = Array.from({ length: count + perkLevel(h.perks, 'loot') }, (_, i) => genLoot(run, h, min, run.fight, forceSet && i === 0));
}

/** El anfitrión elige uno de los nodos de la sala actual. */
export function chooseNode(run: RunState, idx: number): GameEvent[] {
  const node = run.map[run.step]?.[idx];
  if (run.phase !== 'map' || !node) return [];
  run.offers = {};
  run.note = '';
  if (node === 'combat' || node === 'elite' || node === 'boss') {
    run.kind = node;
    const { state, events } = createCombat(buildFight(run));
    run.combat = state;
    run.phase = 'combat';
    return events;
  }
  if (node === 'event') {
    const all = zoneOf(run).events;
    const options = all.filter((e) => !run.eventsSeen.includes(e.id));
    const e = pick(run, options.length ? options : all);
    run.eventsSeen.push(e.id);
    run.event = { id: e.id, votes: {} };
    run.phase = 'event';
  } else if (node === 'shop') {
    run.shop = Array.from({ length: 6 }, (_, i): ShopSlot => {
      const item = genLoot(run, run.heroes.length ? pick(run, run.heroes) : undefined, i < 2 ? 2 : i < 4 ? 1 : 0, run.fight + 1, i === 0);
      return { item, price: priceOf(run, PRICE[item.rarity]), sold: false };
    });
    for (const rare of [false, true]) run.shop.push({ rune: randomRune(run, rare), price: priceOf(run, RUNE_PRICE[rare ? 1 : 0]), sold: false });
    run.phase = 'shop';
  } else if (node === 'rest') {
    for (const h of run.heroes) h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * 0.4));
    run.note = 'Descansáis junto a una hoguera: todos recuperáis el 40% de la vida.';
    run.step++;
  } else {
    offerAll(run, 3, 1, true);
    for (const h of run.heroes) h.runes.push(randomRune(run));
    run.note = 'Encontráis un ajuar funerario intacto: una runa para cada uno y un objeto a elegir (con una pieza de set).';
    run.step++;
  }
  return [];
}

/** Salir de la tienda o de un evento ya resuelto y volver al mapa. */
export function leaveNode(run: RunState): void {
  if (run.phase === 'shop' || (run.phase === 'event' && run.event?.result)) {
    run.note = run.phase === 'event' ? (run.event?.result ?? '') : 'Dejáis atrás al mercader de reliquias.';
    const relic = !!run.event?.id.startsWith('reliquia_');
    run.shop = null;
    run.event = null;
    if (!relic) run.step++;
    run.phase = 'map';
  }
}

export const eventDef = (run: RunState) => [...RELIC_EVENTS, ...ZONES.flatMap((z) => z.events)].find((e) => e.id === run.event?.id);

export function vote(run: RunState, owner: string, idx: number): void {
  const def = eventDef(run);
  if (!def || !run.event || run.event.result || !run.heroes.some((h) => h.owner === owner)) return;
  if (idx >= 0 && idx < def.options.length) run.event.votes[owner] = idx;
}

/** Decide por mayoría; en empate manda el voto del anfitrión (o la primera opción empatada). */
export function resolveEvent(run: RunState, hostId: string): void {
  const ev = run.event;
  const def = eventDef(run);
  if (!ev || !def || ev.result) return;
  const count = def.options.map((_, i) => Object.values(ev.votes).filter((v) => v === i).length);
  const max = Math.max(...count);
  const tied = count.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  const hostVote = ev.votes[hostId];
  const winner = tied.length > 1 && hostVote !== undefined && tied.includes(hostVote) ? hostVote : tied[0]!;
  const opt = def.options[winner]!;
  ev.result = `El grupo elige: ${opt.label}. ${opt.apply(run)}`;
  run.heroes.forEach(clampHp);
}

/** Cierra el combate terminado: vida, nivel, oro y botín. */
export function finishFight(run: RunState): void {
  const c = run.combat;
  if (!c?.over) return;
  if (run.arena) { run.phase = c.over === 'win' ? 'won' : 'lost'; run.note = `Gana el equipo de ${c.over === 'win' ? run.arena.nameA : run.arena.nameB}.`; return; }
  if (c.over === 'lose') { run.phase = 'lost'; return; }
  if (c.units.some((u) => u.name.startsWith('Némesis: '))) run.flags.push('nemesis');
  const gold = (25 + run.fight * 8 + (run.kind === 'elite' ? 20 : run.kind === 'boss' ? 40 : 0)) * (run.mods.includes('codicia') ? 2 : 1);
  if (run.kind === 'boss' && c.units.every((u) => u.team !== 'hero' || u.hp > 0)) run.flags.push(`flawless_${run.zone}`);
  if (run.kind === 'boss') run.flags.push(`boss_${run.zone}`);
  for (const h of run.heroes) {
    const u = c.units.find((x) => x.owner === h.owner);
    const left = u ? u.hp : h.hp;
    if (h.level < MAX_LEVEL) { h.level++; if (UP_LEVELS.includes(h.level)) h.upPending++; }
    const max = heroMaxHp(h);
    // los caídos vuelven con el 30%; los demás recuperan un 35% entre combates
    const healPct = (0.35 + perkLevel(h.perks, 'aid') * 0.08) * (run.asc >= 3 ? 0.7 : 1);
    h.hp = left <= 0 ? Math.ceil(max * 0.3) : Math.min(max, left + Math.ceil(max * healPct));
    h.gold += gold;
    h.stats.maxGold = Math.max(h.stats.maxGold, h.gold);
    // runas: seguras (y raras) tras élite o jefe; a veces tras un combate normal
    if (run.kind !== 'combat') h.runes.push(randomRune(run, true));
    else if (rand(run) < 0.45) h.runes.push(randomRune(run, false));
  }
  for (const h of run.heroes) ensureUpOffer(run, h);
  run.offers = {};
  offerAll(run, run.ambush ? 4 : 3, run.ambush ? 2 : run.kind === 'elite' ? 1 : 0);
  run.note = `Victoria: cada uno gana ${gold} de oro y sube un nivel.${run.kind !== 'combat' ? ' Además, una runa rara para cada uno.' : ' Puede que alguno haya encontrado una runa.'}`;
  run.ambush = false;
  run.fight++;
  run.zoneFight++;
  run.step++;
  run.combat = null;
  run.phase = 'map';
  if (run.kind === 'boss') {
    const won = zoneOf(run).bossWin;
    if (run.zone >= ZONES.length - 1) { run.phase = 'won'; run.note = won; return; }
    // siguiente zona: mapa nuevo y un respiro
    run.zone++;
    run.zoneFight = 0;
    run.step = 0;
    run.map = makeMap(run);
    for (const h of run.heroes) { h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * 0.5)); h.rerolls = perkLevel(h.perks, 'reroll'); }
    run.note = `${won} ${zoneOf(run).intro} Recuperáis el 50% de la vida.`;
    // reliquia de grupo: se vota antes de seguir
    const relic = RELIC_EVENTS[run.zone - 1];
    if (relic) { run.event = { id: relic.id, votes: {} }; run.phase = 'event'; }
  }
}

/** Mete un objeto en el equipo si la ranura está libre; si no, en la mochila. Devuelve false si no cabe. */
function receive(h: HeroSave, item: Item): boolean {
  if (!h.equip[item.slot]) h.equip[item.slot] = item;
  else if (h.bag.length < BAG_SIZE) h.bag.push(item);
  else return false;
  return true;
}

export type MetaAction =
  | { a: 'pick'; idx: number }
  | { a: 'vote'; idx: number }
  | { a: 'equip'; idx: number }
  | { a: 'unequip'; slot: Slot }
  | { a: 'give'; idx: number; to: string }
  | { a: 'sell'; idx: number }
  | { a: 'drop'; idx: number }
  | { a: 'buy'; idx: number }
  | { a: 'socket'; spell: string; idx: number }
  | { a: 'unsocket'; spell: string }
  | { a: 'potion' }
  | { a: 'reroll' }
  | { a: 'upgrade'; idx: number };

/** Acciones de un jugador fuera del combate. Devuelve un mensaje de error o null si se aplicó. */
export function metaAction(run: RunState, owner: string, a: MetaAction): string | null {
  const h = run.heroes.find((x) => x.owner === owner);
  if (!h) return 'No formas parte de esta partida';
  if (run.phase === 'combat') return 'No se puede en combate';
  switch (a.a) {
    case 'pick': {
      const list = run.offers[owner];
      if (!list) return 'No tienes botín pendiente';
      const item = list[a.idx];
      if (item && !receive(h, item)) return 'Mochila llena: tira, da o vende algo antes';
      delete run.offers[owner];
      break;
    }
    case 'vote':
      if (run.phase !== 'event') return 'No hay votación';
      vote(run, owner, a.idx);
      break;
    case 'equip': {
      const item = h.bag[a.idx];
      if (!item) return 'Objeto no encontrado';
      const old = h.equip[item.slot];
      h.bag.splice(a.idx, 1);
      if (old) h.bag.push(old);
      h.equip[item.slot] = item;
      break;
    }
    case 'unequip': {
      const item = h.equip[a.slot];
      if (!item) return 'Ranura vacía';
      if (h.bag.length >= BAG_SIZE) return 'Mochila llena';
      delete h.equip[a.slot];
      h.bag.push(item);
      break;
    }
    case 'give': {
      const item = h.bag[a.idx];
      const to = run.heroes.find((x) => x.owner === a.to && x !== h);
      if (!item || !to) return 'No se puede dar';
      if (!receive(to, item)) return `${to.name} tiene la mochila llena`;
      h.bag.splice(a.idx, 1);
      clampHp(to);
      break;
    }
    case 'drop':
      if (!h.bag[a.idx]) return 'Objeto no encontrado';
      h.bag.splice(a.idx, 1);
      break;
    case 'sell': {
      const item = h.bag[a.idx];
      if (run.phase !== 'shop' || !item) return 'Solo se vende en la tienda';
      h.bag.splice(a.idx, 1);
      h.gold += Math.floor(PRICE[item.rarity] / 3);
      break;
    }
    case 'buy': {
      const slot = run.shop?.[a.idx];
      if (run.phase !== 'shop' || !slot || slot.sold) return 'Ya no está a la venta';
      if (h.gold < slot.price) return 'No tienes oro suficiente';
      if (slot.rune) h.runes.push(slot.rune);
      else if (!slot.item || !receive(h, slot.item)) return 'Mochila llena';
      h.gold -= slot.price;
      slot.sold = true;
      break;
    }
    case 'socket': {
      const rune = h.runes[a.idx];
      if (!rune || !RUNES[rune]) return 'Runa no encontrada';
      if (!heroSpec({ ...h, level: MAX_LEVEL }).spells.some((sp) => sp.id === a.spell)) return 'No tienes ese hechizo';
      h.runes.splice(a.idx, 1);
      const old = h.sockets[a.spell];
      if (old) h.runes.push(old);
      h.sockets[a.spell] = rune;
      break;
    }
    case 'unsocket': {
      const old = h.sockets[a.spell];
      if (!old) return 'Ese hechizo no tiene runa';
      delete h.sockets[a.spell];
      h.runes.push(old);
      break;
    }
    case 'upgrade': {
      const o = h.upOffer?.[a.idx];
      if (!o) return 'No hay mejora que elegir';
      (h.ups[o.spell] ??= []).push(o.up);
      h.upOffer = null;
      h.upPending = Math.max(0, h.upPending - 1);
      ensureUpOffer(run, h);
      break;
    }
    case 'reroll': {
      const list = run.offers[owner];
      if (!list) return 'No tienes botín pendiente';
      if (h.rerolls <= 0) return 'No te quedan re-tiradas en esta zona';
      h.rerolls--;
      const min = Math.min(...list.map((x) => x.rarity)) as Rarity;
      run.offers[owner] = list.map(() => genLoot(run, h, min));
      break;
    }
    case 'potion': {
      const cost = priceOf(run, POTION_PRICE);
      if (run.phase !== 'shop') return 'Solo en la tienda';
      if (h.gold < cost) return 'No tienes oro suficiente';
      if (h.hp >= heroMaxHp(h)) return 'Ya tienes la vida al máximo';
      h.gold -= cost;
      h.hp += Math.ceil(heroMaxHp(h) * POTION_HEAL);
      break;
    }
    default:
      return 'Acción desconocida';
  }
  clampHp(h);
  h.stats.maxGold = Math.max(h.stats.maxGold, h.gold);
  return null;
}

/** Puntuación del reto diario. */
export function dailyScore(run: RunState): number {
  const kills = run.heroes.reduce((a, h) => a + h.stats.kills, 0);
  return Math.min(100000, run.zone * 1000 + run.step * 120 + kills * 10 + (run.phase === 'won' ? 5000 : 0));
}

/** Duelo de 3 contra 3 con héroes del Salón. Si `b.owner` es null, ese bando lo lleva la IA. */
export function newArena(code: string, seed: number, a: { owner: string; name: string; team: unknown[] }, b: { owner: string | null; name: string; team: unknown[] }): RunState | null {
  const ta = a.team.map(cleanChampion).filter((c): c is Champion => !!c).slice(0, 3);
  const tb = b.team.map(cleanChampion).filter((c): c is Champion => !!c).slice(0, 3);
  if (!ta.length || !tb.length) return null;
  const run = newRun(code, seed, []);
  run.arena = { a: a.owner, b: b.owner, nameA: a.name.slice(0, 14), nameB: b.name.slice(0, 14) };
  const w = 14, h = 8, ys = [3, 5, 1];
  // igualados al nivel máximo y con más vida, para que el duelo dure
  const opts = { hpMul: 1.6, level: MAX_LEVEL };
  const units = [...ta.map((c, i) => championUnit(c, { x: 1, y: ys[i]! }, 'hero', a.owner, opts)), ...tb.map((c, i) => championUnit(c, { x: w - 2, y: ys[i]! + 1 }, 'enemy', b.owner, opts))];
  for (let attempt = 0; ; attempt++) {
    const taken = new Set(units.map((u) => `${u.pos.x},${u.pos.y}`));
    const obstacles: Pos[] = [];
    // obstáculos en espejo: ningún bando tiene ventaja de terreno
    while (attempt < 30 && obstacles.length < 10) {
      const p = { x: randInt(run, 3, 6), y: randInt(run, 0, h - 1) }, q = { x: w - 1 - p.x, y: h - 1 - p.y };
      if (taken.has(`${p.x},${p.y}`) || taken.has(`${q.x},${q.y}`)) continue;
      taken.add(`${p.x},${p.y}`); taken.add(`${q.x},${q.y}`);
      obstacles.push(p, q);
    }
    const setup: CombatSetup = { seed: randInt(run, 1, 2 ** 31 - 1), w, h, obstacles, units };
    const probe = createCombat(setup);
    const walk = reachable(probe.state, units[0]!.pos, 99, true).cost;
    if (!units.every((u) => walk.has(`${u.pos.x},${u.pos.y}`))) continue;
    run.combat = probe.state;
    run.phase = 'combat';
    run.kind = 'combat';
    return run;
  }
}
