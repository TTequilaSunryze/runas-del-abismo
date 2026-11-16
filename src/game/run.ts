// Estado de una partida (run) de la Zona 1: mapa, combates, botín, tienda y eventos de grupo.
// Es lo que se sincroniza entre jugadores y lo que se guarda.
import { makeEnemy } from '../content/enemies';
import { ZONES, type ZoneDef } from '../content/zones';
import type { BossInfo } from '../core/combat/ai';
import { MAX_LEVEL } from '../core/classes/classes';
import { makeHero } from '../core/classes/factory';
import { createCombat, type CombatSetup } from '../core/combat/engine';
import { reachable } from '../core/combat/grid';
import { BAG_SIZE, PRICE, genItem, type Item, type Rarity, type Slot, type Stats } from '../core/items/items';
import { pick, rand, randInt, shuffle, type RngBox } from '../core/rng';
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
  combat: 'Enemigos normales. Botín, oro y un nivel.', elite: 'Un Caballero sepulcral. Botín raro o mejor y más oro.',
  event: 'Una decisión que se vota y afecta a todos.', rest: 'Todos recuperan el 40% de su vida.',
  shop: 'Gastad vuestro oro en objetos y pociones.', treasure: 'Cada uno elige un objeto raro o mejor, sin combatir.', boss: 'El Prior Hueco.',
};

export interface ShopSlot {
  item?: Item;
  rune?: string;
  price: number;
  sold: boolean;
}

export interface RunState extends RngBox {
  version: 5;
  code: string;
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
}

export const POTION_PRICE = 25;
export const POTION_HEAL = 0.3;

function makeMap(box: RngBox): NodeKind[][] {
  const two = (list: NodeKind[]): NodeKind[] => shuffle(box, list).slice(0, 2);
  // 7 salas por zona
  return [['combat'], ['combat', 'event'], two(['combat', 'treasure', 'shop']), ['elite', 'combat'], two(['combat', 'event', 'treasure']), ['rest', 'shop'], ['boss']];
}

export function newRun(code: string, seed: number, players: Array<Pick<HeroSave, 'owner' | 'name' | 'cls' | 'routes'>>): RunState {
  const run: RunState = {
    version: 5, code, zone: 0, zoneFight: 0, rng: seed >>> 0, fight: 0, step: 0, map: [], phase: 'map', kind: 'combat', combat: null,
    offers: {}, event: null, eventsSeen: [], shop: null, ambush: false, note: ZONES[0]!.intro,
    heroes: players.map((p) => ({ ...p, hp: 0, level: 1, gold: 0, equip: {}, bag: [], runes: [], sockets: {}, boon: {} })),
  };
  run.map = makeMap(run);
  for (const h of run.heroes) {
    h.hp = heroMaxHp(h);
    h.runes.push(randomRune(run, false));
  }
  return run;
}

export const zoneOf = (run: RunState): ZoneDef => ZONES[run.zone] ?? ZONES[0]!;

export const RUNE_PRICE = [45, 90] as const;

/** Runa al azar: `rare` true = rara, false = común, undefined = cualquiera (las raras salen menos). */
export function randomRune(box: RngBox, rare?: boolean): string {
  const want = rare ?? rand(box) < 0.25;
  return pick(box, Object.values(RUNES).filter((r) => r.rare === want)).id;
}

export function heroSpec(h: HeroSave, pos: Pos = { x: 0, y: 0 }) {
  const u = makeHero({ cls: h.cls, name: h.name, owner: h.owner, routes: h.routes, pos, level: h.level, bonus: [...Object.values(h.equip).map((i) => i.stats), h.boon] });
  for (const sp of u.spells) if (h.sockets[sp.id]) sp.rune = h.sockets[sp.id];
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
  const count = n + (d >= 1 ? 1 : 0) + (d >= 4 ? 1 : 0) - (elite ? 1 : 0) + (run.ambush ? 2 : 0);
  const list = Array.from({ length: Math.max(1, count) }, () => pick(run, pool));
  if (elite) list.unshift(z.elite);
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
    const enemies = ids.map((id) => makeEnemy(id, free(w - 4, w - 1), Math.min(run.kind === 'boss' ? 2 : 5, run.zoneFight), n));
    const setup: CombatSetup = { seed: randInt(run, 1, 2 ** 31 - 1), w, h, obstacles, traps, units: [...heroes, ...enemies] };
    // todo el mundo debe poder llegar a todo el mundo
    const probe = createCombat(setup).state;
    const walk = reachable(probe, heroes[0]!.pos, 99, true).cost;
    if (setup.units.every((u) => walk.has(`${u.pos.x},${u.pos.y}`))) return setup;
  }
}

/** Lo que invoca el jefe de la zona y su nombre en la segunda fase. */
export const bossInfo = (run: RunState): BossInfo => ({ minion: (pos: Pos) => makeEnemy(zoneOf(run).bossMinion, pos, 1), phase2Name: zoneOf(run).bossPhase2 });

function offerAll(run: RunState, count: number, min: Rarity): void {
  for (const h of run.heroes) run.offers[h.owner] = Array.from({ length: count }, () => genItem(run, zoneOf(run).items, run.fight, min));
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
      const item = genItem(run, zoneOf(run).items, run.fight + 1, i < 2 ? 2 : i < 4 ? 1 : 0);
      return { item, price: PRICE[item.rarity], sold: false };
    });
    for (const rare of [false, true]) run.shop.push({ rune: randomRune(run, rare), price: RUNE_PRICE[rare ? 1 : 0], sold: false });
    run.phase = 'shop';
  } else if (node === 'rest') {
    for (const h of run.heroes) h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * 0.4));
    run.note = 'Descansáis junto a una hoguera: todos recuperáis el 40% de la vida.';
    run.step++;
  } else {
    offerAll(run, 3, 1);
    for (const h of run.heroes) h.runes.push(randomRune(run));
    run.note = 'Encontráis un ajuar funerario intacto: una runa para cada uno y un objeto a elegir.';
    run.step++;
  }
  return [];
}

/** Salir de la tienda o de un evento ya resuelto y volver al mapa. */
export function leaveNode(run: RunState): void {
  if (run.phase === 'shop' || (run.phase === 'event' && run.event?.result)) {
    run.note = run.phase === 'event' ? (run.event?.result ?? '') : 'Dejáis atrás al mercader de reliquias.';
    run.shop = null;
    run.event = null;
    run.step++;
    run.phase = 'map';
  }
}

export const eventDef = (run: RunState) => ZONES.flatMap((z) => z.events).find((e) => e.id === run.event?.id);

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
  if (c.over === 'lose') { run.phase = 'lost'; return; }
  const gold = 25 + run.fight * 8 + (run.kind === 'elite' ? 20 : run.kind === 'boss' ? 40 : 0);
  for (const h of run.heroes) {
    const u = c.units.find((x) => x.owner === h.owner);
    const left = u ? u.hp : h.hp;
    if (h.level < MAX_LEVEL) h.level++;
    const max = heroMaxHp(h);
    // los caídos vuelven con el 30%; los demás recuperan un 35% entre combates
    h.hp = left <= 0 ? Math.ceil(max * 0.3) : Math.min(max, left + Math.ceil(max * 0.35));
    h.gold += gold;
    // runas: seguras (y raras) tras élite o jefe; a veces tras un combate normal
    if (run.kind !== 'combat') h.runes.push(randomRune(run, true));
    else if (rand(run) < 0.45) h.runes.push(randomRune(run, false));
  }
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
    for (const h of run.heroes) h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * 0.5));
    run.note = `${won} ${zoneOf(run).intro} Recuperáis el 50% de la vida.`;
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
  | { a: 'potion' };

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
    case 'potion':
      if (run.phase !== 'shop') return 'Solo en la tienda';
      if (h.gold < POTION_PRICE) return 'No tienes oro suficiente';
      if (h.hp >= heroMaxHp(h)) return 'Ya tienes la vida al máximo';
      h.gold -= POTION_PRICE;
      h.hp += Math.ceil(heroMaxHp(h) * POTION_HEAL);
      break;
    default:
      return 'Acción desconocida';
  }
  clampHp(h);
  return null;
}
