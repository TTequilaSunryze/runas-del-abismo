// Estado de una partida (run): mapa, combates, botín, tienda y eventos de grupo.
// Es lo que se sincroniza entre jugadores y lo que se guarda.
import { ENEMY_SCALING, FEATURES, schoolOf } from '../core/tuning';
import { AFFIXES, CAGE_ALLY, makeEnemy } from '../content/enemies';
import { DAILY_ASC, DAILY_MODS, DAILY_POOL, MAX_MODS, OMENS, perkLevel, type Perks } from '../content/modes';
import { BASE_ZONES, ZONES, type BossDef, type ZoneDef } from '../content/zones';
import type { BossInfo } from '../core/combat/ai';
import { RELIC_EVENTS, RELICS } from '../content/relics';
import { CONSUMABLES, MAX_CONSUMABLE, patronBonus, patronsOf } from '../content/boons';
import { BLESSINGS, BOON_MODS } from '../core/boonmods';
import { CLASSES, MAX_LEVEL, canPickRoute } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { MAX_SPELL_UPS, UPGRADES, canUpgrade } from '../core/upgrades';
import { makeHero } from '../core/classes/factory';
import { SOULS_PER_ARMOR, createCombat, type CombatSetup, type UnitSpec } from '../core/combat/engine';
import { reachable } from '../core/combat/grid';
import { BAG_SIZE, PRICE, SLOTS, STAT_NAME, genItem, sumStats, type DropKind, type Item, type Rarity, type Slot, type StatKey, type Stats } from '../core/items/items';
import { pick, rand, randInt, seedFrom, shuffle, type RngBox } from '../core/rng';
import { makeActMap, type ActMap } from './map';
import { CORRIDOR_CHANCE, genTerrain } from './terrain';
import type { ClassId, CombatState, GameEvent, Pos } from '../core/state';

/** Una opción de la recompensa del jefe. */
export type BossOption =
  | { kind: 'up'; spell: string; up: string }
  | { kind: 'spell'; id: string }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal' };

/** Resumen del último combate ganado (lo muestra el modal de victoria). */
export interface FightReport {
  stamp: number;
  kind: NodeKind;
  turns: number;
  gold: number;
  /** daño infligido por cada héroe en este combate */
  damage: Array<{ owner: string; name: string; dmg: number }>;
  /** objetos que ha soltado el combate, por jugador */
  items: Array<{ owner: string; item: Item }>;
  /** otro botín: reliquias y consumibles */
  loot: Array<{ owner: string; icon: string; name: string; text: string; rare?: boolean }>;
}

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
  /** bendiciones y maldiciones de eventos */
  boon: Stats;
  /** mejoras permanentes del jugador (compradas con ecos) */
  perks: Perks;
  /** re-tiradas de botín que le quedan en esta zona */
  rerolls: number;
  stats: HeroStats;
  /** mejoras de hechizo elegidas: id de hechizo → ids de mejora */
  ups: Record<string, string[]>;
  /** Carcelero: almas cosechadas en toda la partida (cada 5, +1 de armadura) */
  souls?: number;
  /** Carcelero: almas sin gastar (Explosión de almas) */
  soulBank?: number;
  /** recompensa del jefe pendiente: mejora, mejora, hechizo nuevo (en ese orden) */
  bossOffer: BossOption[] | null;
  /** nivel de maestría de la clase al empezar */
  mastery: number;
  /** reliquias personales */
  relics: string[];
  /** habilidades extra de bendición (ids de SPELLS) y la oferta pendiente */
  boons: string[];
  boonOffer: { patron: string; spells: string[] } | null;
  /** consumibles: id → cantidad */
  bag2: Record<string, number>;
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

export type NodeKind = 'combat' | 'elite' | 'event' | 'rest' | 'shop' | 'boss' | 'cage' | 'shrine' | 'treasure';
export const NODE_NAME: Record<NodeKind, string> = { combat: '⚔️ Combate', elite: '☠️ Élite', event: '❓ Evento de grupo', rest: '🔥 Descanso', shop: '💰 Tienda', boss: '👑 Jefe', cage: '⛓️ Jaula', shrine: '✨ Santuario', treasure: '🎁 Botín' };
export const NODE_HINT: Record<NodeKind, string> = {
  treasure: 'Sin combate: cada uno se lleva un objeto Uncommon o mejor.',
  combat: 'Enemigos normales. Oro y, a veces, un objeto.', elite: 'El campeón de la zona, con modificadores. Oro y objetos mejores.',
  event: 'Una decisión que se vota y afecta a todos.', rest: 'Todos recuperan el 40% de su vida.',
  shop: 'Gastad vuestro oro en objetos y pociones.', boss: 'El guardián de la zona. Dos fases. Objetos, una reliquia y una mejora o un hechizo nuevo.',
  cage: 'Un prisionero vigilado: venced a sus captores y luchará con vosotros hasta el final de la zona.',
  shrine: 'Cada uno elige una de las bendiciones pasivas de su clase.',
};

export interface ShopSlot {
  item?: Item;
  relic?: string;
  consumable?: string;
  price: number;
  sold: boolean;
}

export interface RunState extends RngBox {
  version: 9;
  code: string;
  /** nivel de ascensión (0 = normal) */
  asc: number;
  /** fecha del reto diario (AAAA-MM-DD) o null */
  daily: string | null;
  /** modificadores del reto diario */
  mods: string[];
  /** reservado (antes: desbloqueos por logros) */
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
  /** resumen del último combate ganado */
  report?: FightReport | null;
  /** daño acumulado de cada héroe al empezar el combate */
  dmg0?: Record<string, number>;
  /** aristas del mapa: links[capa][nodo] = nodos de la capa siguiente */
  links: number[][][];
  /** nodo elegido en la capa anterior (−1 al empezar el acto) */
  at: number;
  /** nodo elegido en cada capa ya recorrida */
  trail: number[];
  phase: 'map' | 'combat' | 'event' | 'shop' | 'won' | 'lost';
  /** tipo del combate en curso */
  kind: NodeKind;
  heroes: HeroSave[];
  combat: CombatState | null;
  /** botín a elegir por jugador (uno de la lista) */
  offers: Record<string, Item[]>;
  /** Alijo de grupo: objetos encontrados que nadie se ha quedado aún */
  stash?: Item[];
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
  /** jefe elegido en cada zona (índice en ZoneDef.bosses) */
  bossPick: number[];
  /** se juega también la zona 4 */
  abyss: boolean;
  /** aliados que acompañan al grupo hasta el final de la zona */
  allies: string[];
  /** presagio del combate actual y el forzado para el próximo */
  omen: string | null;
  nextOmen: string | null;
  /** aliado que se libera al ganar el combate de la jaula */
  cage: string | null;
  /** «Listo»: cada jugador marca el paso de sala en el que está listo (ver stamp) */
  ready: Record<string, number>;
  stamp: number;
  /** duelo 3 contra 3: dueños de cada bando (null = IA) y sus nombres */
  arena?: { a: string; b: string | null; nameA: string; nameB: string };
}

/** Dificultad base de los enemigos: ajuste de vida y daño en la zona 1 y cuánto sube por zona. */
export const DIFF = { base: -0.4, perZone: 0.45 };
export const POTION_PRICE = 25;
export const POTION_HEAL = 0.3;

function makeMap(box: RngBox, mods: string[] = []): ActMap {
  const m = makeActMap(box);
  if (mods.includes('sin_descanso')) m.layers = m.layers.map((n) => n.map((k) => (k === 'rest' ? 'combat' : k)));
  return m;
}

/** Nodos de la sala actual a los que se puede ir desde el último elegido (índices en `map[step]`). */
export function availableNodes(run: Pick<RunState, 'map' | 'links' | 'at' | 'step'>): number[] {
  const row = run.map[run.step] ?? [];
  const from = run.step > 0 && run.at >= 0 ? run.links?.[run.step - 1]?.[run.at] : undefined;
  const ok = (from ?? []).filter((i) => i < row.length);
  return ok.length ? ok : row.map((_, i) => i);
}

function setMap(run: RunState): void {
  const m = makeMap(run, run.mods);
  run.map = m.layers; run.links = m.links; run.at = -1; run.trail = [];
}

export interface RunOpts {
  asc?: number;
  /** fecha AAAA-MM-DD para el reto diario */
  daily?: string | null;
  unlocked?: string[];
  nemesis?: unknown[];
  /** modificadores elegidos por el anfitrión (no en el reto diario) */
  mods?: string[];
  /** incluir la zona 4 */
  abyss?: boolean;
}

export type NewHero = Pick<HeroSave, 'owner' | 'name' | 'cls' | 'routes'> & { perks?: Perks; mastery?: number };

/** Niveles en los que se elige una mejora de hechizo. */
/** Kit inicial válido de la clase (uno solo; el Clásico por defecto). */
export const kitOf = (cls: ClassId, routes: readonly string[]): string[] => { const r = routes.find((x) => CLASSES[cls].routes.some((k) => k.id === x)); return [r ?? 'base']; };

/** Semilla y modificadores del reto diario de una fecha: iguales para todo el mundo. */
export function dailyOf(date: string): { seed: number; mods: string[] } {
  const box = { rng: seedFrom(`rda-diario-${date}`) };
  return { seed: box.rng, mods: shuffle(box, [...DAILY_POOL]).slice(0, 2) };
}

export function newRun(code: string, seed: number, players: NewHero[], opts: RunOpts = {}): RunState {
  const daily = opts.daily ? dailyOf(opts.daily) : null;
  const run: RunState = {
    version: 9, code, asc: daily ? DAILY_ASC : Math.max(0, Math.min(10, opts.asc ?? 0)), daily: opts.daily ?? null, mods: daily?.mods ?? [...new Set((opts.mods ?? []).filter((m) => DAILY_MODS.some((d) => d.id === m)))].slice(0, MAX_MODS),
    bossPick: [], abyss: !daily && !!opts.abyss, allies: [], omen: null, nextOmen: null, cage: null, ready: {}, stamp: 0,
    unlocked: [...new Set(opts.unlocked ?? [])], flags: [],
    zone: 0, zoneFight: 0, rng: (daily?.seed ?? seed) >>> 0, fight: 0, step: 0, map: [], links: [], at: -1, trail: [], phase: 'map', kind: 'combat', combat: null,
    offers: {}, event: null, eventsSeen: [], shop: null, ambush: false, note: ZONES[0]!.intro,
    nemesis: (opts.nemesis ?? []).map(cleanChampion).filter((c): c is Champion => !!c).slice(0, 8), nemesisUsed: [],
    heroes: players.map((p) => ({
      owner: p.owner, name: p.name, cls: p.cls, routes: kitOf(p.cls, p.routes), hp: 0, level: 1, gold: 0, equip: {}, bag: [], boon: {},
      perks: Object.fromEntries(['vit', 'gold', 'loot', 'reroll', 'aid'].map((k) => [k, perkLevel(p.perks, k)])),
      rerolls: 0, stats: { dmg: 0, kills: 0, falls: 0, heal: 0, maxGold: 0 },
      relics: [], boons: [], boonOffer: null, bag2: { c_vida: 1 }, ups: {}, bossOffer: null, mastery: Math.max(0, Math.min(5, Math.floor(Number(p.mastery) || 0))),
    })),
  };
  setMap(run);
  run.bossPick = ZONES.map((z) => randInt(run, 0, z.bosses.length - 1));
  for (const h of run.heroes) {
    const base = heroMaxHp(h);
    h.boon.hp = Math.round(base * (perkLevel(h.perks, 'vit') * 0.06 - (run.mods.includes('cristal') ? 0.25 : 0)));
    if (run.mods.includes('cristal')) h.boon.power = 3;
    // maestría: los niveles que no abren un kit dan oro inicial
    const noKit = Array.from({ length: Math.min(4, h.mastery) }, (_, i) => i + 1).filter((i) => !CLASSES[h.cls].routes[i]).length;
    h.gold = perkLevel(h.perks, 'gold') * 25 + noKit * 25;
    h.rerolls = perkLevel(h.perks, 'reroll');
    h.hp = Math.round(heroMaxHp(h) * (run.asc >= 8 ? 0.75 : 1));
  }
  return run;
}

export const zoneOf = (run: RunState): ZoneDef => ZONES[run.zone] ?? ZONES[0]!;
/** Jefe de la zona actual en esta partida. */
export const bossOf = (run: RunState): BossDef => { const z = zoneOf(run); return z.bosses[run.bossPick?.[run.zone] ?? 0] ?? z.bosses[0]!; };
/** Última zona de la partida (2, o 3 con el Abismo). */
export const lastZone = (run: RunState): number => (run.abyss ? ZONES.length : BASE_ZONES) - 1;

/** Reliquia al azar que el héroe no tenga. Devuelve su id (o null si ya las tiene todas). */
export function giveRelic(run: RunState, h: HeroSave, rare?: boolean): string | null {
  const all = Object.values(RELICS).filter((r) => !h.relics.includes(r.id));
  const pool = rare === undefined ? all : all.filter((r) => !!r.rare === rare);
  const r = (pool.length ? pick(run, pool) : all.length ? pick(run, all) : null);
  if (!r) return null;
  h.relics.push(r.id);
  if (r.id === 'dado') h.rerolls++;
  if (r.stats?.hp) h.hp = Math.max(1, h.hp + r.stats.hp);
  return r.id;
}
/** Un aliado se une al grupo hasta el final de la zona. */
export function addAlly(run: RunState, id: string): void { if (run.allies.length < 2) run.allies.push(id); }

/** Mejoras de bendición que ya lleva un hechizo. */
const modsOn = (h: Pick<HeroSave, 'boons'>, spell: string): string[] => h.boons.filter((b) => BOON_MODS[b]?.target === spell);
/** Veces que ya se ha mejorado un hechizo en esta partida (bendiciones y mejoras). */
export const upCount = (h: Pick<HeroSave, 'boons' | 'ups'>, spell: string): number => modsOn(h, spell).length + (h.ups[spell]?.length ?? 0);
/** Hechizos únicos de la clase del héroe (el pool del que aprende) que aún no tiene. */
export function newSpellPool(h: Pick<HeroSave, 'cls' | 'boons' | 'routes' | 'level'>): string[] {
  const owned = new Set(heroSpec({ ...h, owner: '', name: '', equip: {} } as Build).spells.map((sp) => sp.id));
  return [...new Set(patronsOf(h.cls).flatMap((p) => p.spells))].filter((id) => !!SPELLS[id] && SPELLS[id]!.route === 'boon' && !BOON_MODS[id] && !BLESSINGS[id] && !h.boons.includes(id) && !owned.has(id));
}

/**
 * Santuario: bendiciones pasivas de la clase (hasta 3 en total). Elige una o rechaza.
 */
export function offerBoon(run: RunState, h: HeroSave): void {
  if (h.boonOffer) return;
  const mineCls = patronsOf(h.cls);
  const left = mineCls.flatMap((p) => p.spells.filter((id) => !!BLESSINGS[id] && !h.boons.includes(id)).map((id) => ({ p: p.id, id })));
  if (!left.length) return;
  const patron = left[0]!.p;
  h.boonOffer = { patron, spells: shuffle(run, left.map((x) => x.id)).slice(0, 3) };
}

/**
 * Recompensa del jefe, siempre en este orden: 1) mejora de un hechizo que tienes, 2) mejora de otro hechizo que tienes,
 * 3) hechizo nuevo del pool de tu clase. Si no hay mejoras posibles se sustituyen por hechizos nuevos, oro o curación.
 */
export function buildBossOffer(run: RunState, h: HeroSave): BossOption[] {
  const spells = heroSpec(h).spells.filter((sp) => sp.charges === undefined).map((sp) => sp.id);
  const choices = (id: string): string[] => {
    const def = SPELLS[id]!;
    const have = [...modsOn(h, id), ...(h.ups[id] ?? [])];
    if (upCount(h, id) >= MAX_SPELL_UPS) return [];
    const generic = Object.keys(UPGRADES).filter((up) => canUpgrade(def, have, up));
    const own = Object.keys(BOON_MODS).filter((m) => BOON_MODS[m]!.target === id && !h.boons.includes(m) && !have.includes(m));
    return [...generic, ...own];
  };
  // v12: el jefe ofrece 3 hechizos nuevos de la clase. Si ya no quedan, mejoras de los que tienes; y si tampoco, oro o curación.
  const out: BossOption[] = shuffle(run, newSpellPool(h)).slice(0, 3).map((id) => ({ kind: 'spell', id }));
  for (const id of shuffle(run, spells.filter((id) => choices(id).length))) { if (out.length >= 3) break; out.push({ kind: 'up', spell: id, up: pick(run, choices(id)) }); }
  if (out.length < 3) out.push({ kind: 'gold', amount: 60 + 40 * run.zone });
  if (out.length < 3) out.push({ kind: 'heal' });
  while (out.length < 3) out.push({ kind: 'gold', amount: 30 + 20 * run.zone });
  return out;
}

/** Qué le falta a un jugador para poder seguir (botín, mejoras o bendiciones sin elegir). */
export function pendingOf(run: RunState, h: HeroSave): string[] {
  const out: string[] = [];
  if (run.offers[h.owner]) out.push('botín');
  if (h.bossOffer) out.push('recompensa del jefe');
  if (h.boonOffer) out.push('bendición');
  return out;
}
/** Jugadores (presentes) por los que hay que esperar antes de cambiar de sala. */
export function waitingFor(run: RunState, present: readonly string[], hostId: string): HeroSave[] {
  // al empezar la partida no hay nada que reclamar: no hace falta pulsar «Listo»
  return run.heroes.filter((h) => present.includes(h.owner) && (pendingOf(run, h).length > 0 || (run.stamp > 0 && h.owner !== hostId && run.ready[h.owner] !== run.stamp)));
}

/** Desglose de estadísticas de un héroe: clase y nivel, equipo, reliquias, bendiciones y eventos. */
export function statBreakdown(h: HeroSave): Array<{ key: string; name: string; base: number; parts: Array<[string, number]>; total: number }> {
  const spec = heroSpec(h);
  const sum = (list: Array<Stats | undefined>) => sumStats(list);
  const equip = sum(Object.values(h.equip).map((i) => i.stats));
  const rel = sum(h.relics.map((r) => RELICS[r]?.stats));
  const pat = sum(patronBonus(h.boons).stats);
  const boon = sum([h.boon]);
  const base = makeHero({ cls: h.cls, name: h.name, owner: h.owner, routes: h.routes, pos: { x: 0, y: 0 }, level: h.level });
  const rows: Array<[string, string, number, number]> = [
    ['hp', 'Vida', base.maxHp, spec.maxHp], ['ap', 'PA', base.maxAp, spec.maxAp], ['mp', 'PM', base.maxMp, spec.maxMp],
    ['power', 'Daño (físico y mágico)', base.power, spec.power], [schoolOf(h.cls) === 'magic' ? 'powerMagic' : 'powerPhys', schoolOf(h.cls) === 'magic' ? 'Daño mágico' : 'Daño físico', 0, (schoolOf(h.cls) === 'magic' ? spec.powerMagic : spec.powerPhys) ?? 0], ['crit', '% Crítico', base.crit, spec.crit], ['armor', 'Armadura', base.armor, spec.armor],
    ['initiative', 'Iniciativa', base.initiative, spec.initiative], ['tackle', 'Placaje', base.tackle ?? 0, spec.tackle ?? 0], ['dodge', 'Huida', base.dodge ?? 0, spec.dodge ?? 0],
    ...(FEATURES.resistances ? [['resFire', '% Res. fuego', 0, spec.resist.fire ?? 0], ['resIce', '% Res. hielo', 0, spec.resist.ice ?? 0], ['resPoison', '% Res. veneno', 0, spec.resist.poison ?? 0], ['resShadow', '% Res. sombra', 0, spec.resist.shadow ?? 0]] as Array<[string, string, number, number]> : []),
  ];
  return rows.map(([key, name, b, total]) => {
    const k = key as StatKey;
    const parts: Array<[string, number]> = ([['Equipo', equip[k]], ['Reliquias', rel[k]], ['Bendiciones', pat[k]], ['Eventos', boon[k]], ['Almas', k === 'armor' && spec.souls !== undefined ? Math.floor(spec.souls / SOULS_PER_ARMOR) : 0]] as Array<[string, number]>).filter(([, v]) => v);
    return { key, name, base: b, parts, total };
  });
}

/** Precio con los recargos de la ascensión y del reto diario. */
/** Curación de jefe y hogueras: base + 8% por nivel de Primeros auxilios, −30% desde la ascensión 3. */
export const healOf = (run: RunState, h: HeroSave, base: number): number => (base + perkLevel(h.perks, 'aid') * 0.08) * (run.asc >= 3 ? 0.7 : 1);

export const priceOf = (run: RunState, base: number): number => Math.round(base * (run.asc >= 4 ? 1.25 : 1) * (run.mods.includes('codicia') ? 2 : 1));

type Build = Pick<HeroSave, 'cls' | 'name' | 'owner' | 'routes' | 'level' | 'equip'> & { boon?: Stats; ups?: Record<string, string[]>; relics?: string[]; boons?: string[]; bag2?: Record<string, number>; souls?: number; soulBank?: number };

/** El héroe listo para combatir: clase, nivel, equipo y mejoras. */
export function heroSpec(h: Build, pos: Pos = { x: 0, y: 0 }): UnitSpec {
  const traits: string[] = [];
  const relics = (h.relics ?? []).map((r) => RELICS[r]).filter((r) => !!r);
  const pat = patronBonus(h.boons ?? []);
  const u = makeHero({ cls: h.cls, name: h.name, owner: h.owner, routes: h.routes, pos, level: h.level, bonus: [...Object.values(h.equip).map((i) => i.stats), h.boon, ...relics.map((r) => r!.stats), ...pat.stats] });
  for (const t of pat.traits) if (!traits.includes(t)) traits.push(t);
  // Carcelero: las almas de toda la partida dan armadura (+1 cada 5)
  if (u.souls !== undefined) { u.souls = Math.max(0, Math.floor(h.souls ?? 0)); u.soulBank = Math.max(0, Math.floor(h.soulBank ?? 0)); u.armor += Math.floor(u.souls / SOULS_PER_ARMOR); }
  // habilidades de bendición y consumibles (con sus usos)
  for (const b of h.boons ?? []) {
    // bendiciones pasivas: un rasgo y, si la tiene, un cambio en un hechizo
    const bl = BLESSINGS[b];
    if (bl) {
      if (bl.trait && !traits.includes(bl.trait)) traits.push(bl.trait);
      if (bl.mod) { const sp = u.spells.find((x) => x.id === bl.mod!.target); if (sp) sp.ups = [b, ...(sp.ups ?? [])]; }
      continue;
    }
    const mod = BOON_MODS[b];
    if (mod) { const sp = u.spells.find((x) => x.id === mod.target); if (sp) sp.ups = [b, ...(sp.ups ?? [])]; }
    else if (SPELLS[b] && !u.spells.some((x) => x.id === b)) u.spells.push({ id: b, cd: 0 });
  }
  for (const [id, n] of Object.entries(h.bag2 ?? {})) if (n > 0 && SPELLS[id]) u.spells.push({ id, cd: 0, charges: n });
  for (const r of relics) if (r!.trait && !traits.includes(r!.trait)) traits.push(r!.trait);
  // pasivas de los legendarios equipados
  for (const it of Object.values(h.equip)) if (it.passive && !traits.includes(it.passive.trait)) traits.push(it.passive.trait);
  for (const sp of u.spells) {
    if (h.ups?.[sp.id]?.length) sp.ups = [...(sp.ups ?? []), ...h.ups[sp.id]!];
  }
  if (traits.length) u.traits = traits;
  return u;
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
      equip[sl] = { slot: sl, name: String(it.name ?? '?').slice(0, 40), rarity: Math.max(0, Math.min(3, Math.floor(Number(it.rarity) || 0))) as Rarity, stats };
    }
    const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(c.level) || 1)));
    const known = makeHero({ cls: c.cls, name: 'x', owner: 'x', routes, pos: { x: 0, y: 0 }, level }).spells.map((sp) => sp.id);
    const ups: Record<string, string[]> = {};
    let total = 0;
    for (const id of known) {
      const list: string[] = [];
      for (const up of Array.isArray(c.ups?.[id]) ? c.ups[id]! : []) if (total < 7 && canUpgrade(SPELLS[id]!, list, String(up))) { list.push(String(up)); total++; }
      if (list.length) ups[id] = list;
    }
    return { id: String(c.id ?? '').slice(0, 40) || 'x', name: String(c.name ?? 'Héroe').slice(0, 14), by: String(c.by ?? '').slice(0, 14), cls: c.cls, routes, level, equip, ups,
      asc: Math.max(0, Math.min(10, Math.floor(Number(c.asc) || 0))), won: !!c.won, date: String(c.date ?? '').slice(0, 10) };
  } catch {
    return null;
  }
}

/** Foto de un héroe de la partida para guardarlo en el Salón. */
export function championOf(run: RunState, h: HeroSave): Champion {
  return { id: `${run.code}-${run.rng >>> 0}-${h.owner.slice(0, 6)}`, name: h.name, by: h.name, cls: h.cls, routes: [...h.routes], level: h.level, equip: structuredClone(h.equip), ups: structuredClone(h.ups),
    asc: run.asc, won: run.phase === 'won', date: new Date().toISOString().slice(0, 10) };
}

/** Un héroe guardado como unidad de combate. `owner` null = lo lleva la IA. */
export function championUnit(c: Champion, pos: Pos, team: 'hero' | 'enemy', owner: string | null, o: { hpMul?: number; powerMul?: number; level?: number; name?: string } = {}): UnitSpec {
  const u = heroSpec({ ...c, owner: owner ?? '', level: 1, name: o.name ?? c.name }, pos);
  u.team = team;
  u.owner = owner;
  u.ai = owner ? null : 'champ';
  u.hp = u.maxHp = Math.round(u.maxHp * (o.hpMul ?? 1));
  // Némesis: sus hechizos de héroe hacen el doble de daño; los rebaja con daño negativo
  if ((o.powerMul ?? 1) < 1) u.power -= 4;
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
  const b = bossOf(run);
  if (run.kind === 'boss') return [b.id, ...Array.from({ length: n }, () => pick(run, b.guard))];
  const pool = z.pools[d < 1 ? 0 : d < 3 ? 1 : 2];
  const elite = run.kind === 'elite';
  const count = n + (d >= 1 ? 1 : 0) + (d >= 3 && n >= 3 ? 1 : 0) - (elite ? 1 : 0) + (run.ambush ? 2 : 0) + (run.asc >= 7 ? 1 : 0) + (run.mods.includes('horda') ? 1 : 0);
  const list = Array.from({ length: Math.max(1, count) }, () => pick(run, pool));
  if (elite) {
    // a partir de la zona 2, un héroe del Salón puede ocupar el lugar del élite
    const pool = run.nemesis.filter((c) => !run.nemesisUsed.includes(c.id));
    if (run.zone >= 1 && pool.length && rand(run) < 0.65) {
      const c = pick(run, pool);
      run.nemesisUsed.push(c.id);
      list.unshift(`nemesis:${c.id}`);
    } else list.unshift(pick(run, z.elites));
  }
  // en grupo, desde el segundo combate siempre hay un tirador que obliga a moverse
  if (n >= 2 && d >= 1 && !list.includes(z.shooter)) list[list.length - 1] = z.shooter;
  return list;
}

export function buildFight(run: RunState): CombatSetup {
  const n = run.heroes.length;
  const { w, h } = boardSize(n);
  const ys = [0, 1, -1, 2].map((o) => Math.floor(h / 2) + o);
  const omen = run.omen;
  const heroes = run.heroes.map((s, i) => {
    const u = heroSpec(s, { x: 1, y: ys[i]! });
    u.hp = Math.max(1, Math.min(u.maxHp, s.hp));
    if (omen === 'sangre') u.power += 2;
    if (omen === 'bendicion') u.shield = Math.round(u.maxHp * 0.2);
    if (omen === 'calma') { u.ap++; u.maxAp++; }
    return u;
  });
  // aliados (jaulas, eventos y el espíritu del ciervo en el jefe): no cuentan para ganar ni perder
  const allyIds = [...run.allies, ...(run.kind === 'boss' && run.flags.includes(`espiritu_${run.zone}`) ? ['ciervo'] : [])];
  const allies = allyIds.map((id, i) => {
    const a = makeEnemy(id, { x: 0, y: Math.min(h - 1, i * 2 + 1) }, run.zone * 3 + Math.min(run.zoneFight, 4), 1);
    a.team = 'hero';
    a.summoner = -1;
    // los aliados no llevan la vida ×2,75 de los enemigos
    a.hp = a.maxHp = Math.round(a.maxHp / ENEMY_SCALING.flatHp);
    return a;
  });
  const ids = enemyList(run);
  // los combates normales (no élites ni jefes) salen a veces como pasillo estrecho
  const corridor = run.kind === 'combat' && !run.ambush && rand(run) < CORRIDOR_CHANCE;
  for (let attempt = 0; ; attempt++) {
    const terrain = attempt > 30 ? null : genTerrain(run, run.zone, w, h, n, corridor && attempt < 15);
    // en el pasillo, los héroes empiezan dentro del carril
    if (terrain?.lane) heroes.forEach((u, i) => { u.pos = { x: i < terrain.lane!.length ? 1 : 0, y: terrain.lane![i % terrain.lane!.length]! }; });
    else heroes.forEach((u, i) => { u.pos = { x: 1, y: ys[i]! }; });
    const taken = new Set([...heroes, ...allies].map((u) => `${u.pos.x},${u.pos.y}`));
    for (const p of terrain ? [...terrain.obstacles, ...terrain.abyss, ...terrain.braziers] : []) taken.add(`${p.x},${p.y}`);
    const free = (minX: number, maxX: number): Pos => {
      for (;;) {
        const p = { x: randInt(run, minX, maxX), y: randInt(run, 0, h - 1) };
        if (!taken.has(`${p.x},${p.y}`)) { taken.add(`${p.x},${p.y}`); return p; }
      }
    };
    // v13: el terreno lo pone el bioma; las púas solo con el presagio de púas
    const obstacles = terrain?.obstacles ?? [];
    const traps = Array.from({ length: omen === 'puas' ? 6 : 0 }, () => free(3, w - 4));
    const puddles = [...(terrain?.puddles ?? []), ...(omen === 'pantano' ? Array.from({ length: 4 + n * 2 }, () => free(2, w - 4)) : [])];
    // el jefe no crece indefinidamente con los combates previos
    const enemies = ids.map((id, i) => id.startsWith('nemesis:') ? nemesisUnit(run, id.slice(8), free(w - 4, w - 1)) : makeEnemy(id, free(w - 4, w - 1), Math.min(id === bossOf(run).id || (run.kind === 'elite' && i === 0) ? 2 : 5, run.zoneFight), n, enemyOpts(run, id, i === 0)));
    if (run.kind === 'elite' && enemies[0]) { enemies[0].rank = 'elite'; enemies[0].tackle = (enemies[0].tackle ?? 0) + 3; }
    for (const e of enemies) {
      if (omen === 'sangre') e.power += 1;
      if (omen === 'eclipse' && !e.traits?.includes('regen')) e.traits = [...(e.traits ?? []), 'regen'];
      if (omen === 'oro') e.hp = e.maxHp = Math.round(e.maxHp * 1.25);
      if (omen === 'tormenta' || run.mods.includes('veloces')) { e.mp++; e.maxMp++; }
      if (run.mods.includes('veloces')) e.initiative += 4;
    }
    const setup: CombatSetup = { seed: randInt(run, 1, 2 ** 31 - 1), w, h, obstacles, traps, puddles, abyss: terrain?.abyss ?? [], braziers: terrain?.braziers ?? [], roots: terrain?.roots ?? [], biome: terrain?.name, units: [...heroes, ...allies, ...enemies] };
    // todo el mundo debe poder llegar a todo el mundo
    const probe = createCombat(setup).state;
    const walk = reachable(probe, heroes[0]!.pos, 99, true).cost;
    if (setup.units.every((u) => walk.has(`${u.pos.x},${u.pos.y}`))) return setup;
  }
}

function nemesisUnit(run: RunState, id: string, pos: Pos): UnitSpec {
  const c = run.nemesis.find((x) => x.id === id)!;
  const n = run.heroes.length;
  const level = 1;
  return championUnit(c, pos, 'enemy', null, { hpMul: 1.9 + 0.7 * (n - 1) + (run.asc >= 1 ? 0.2 : 0), powerMul: 0.5, level, name: `Némesis: ${c.name}` });
}

/** Ascensión y reto diario sobre cada enemigo, y modificadores de élite. */
function enemyOpts(run: RunState, id: string, first: boolean) {
  const n = run.heroes.length;
  const z = zoneOf(run);
  // el Abismo es más duro que todo lo anterior
  const boost = (run.asc >= 1 ? 0.1 : 0) + (run.asc >= 9 ? 0.1 : 0) + (run.zone >= 3 ? 0.4 : 0) + run.zone * DIFF.perZone + DIFF.base - Math.max(0, 3 - n) * 0.12;
  const affixes: string[] = [];
  const all = Object.keys(AFFIXES);
  if (run.kind === 'elite' && first && z.elites.includes(id)) {
    const cursed = run.flags.includes('cursed_elite');
    if (cursed) run.flags = run.flags.filter((f) => f !== 'cursed_elite');
    affixes.push(...shuffle(run, all).slice(0, (run.asc >= 2 ? 2 : 1) + (cursed ? 2 : 0)));
  } else if (id !== bossOf(run).id) {
    // en grupo y más adelante, más variantes con modificador
    const chance = run.zone * 0.12 + (run.zoneFight >= 2 ? 0.1 : 0) + 0.08 * (n - 1) + (run.asc >= 5 ? 0.15 : 0) + (run.mods.includes('elites') ? 0.4 : 0);
    if (rand(run) < chance) affixes.push(pick(run, all));
  }
  if (run.mods.includes('llamas') && !affixes.includes('ardiente')) affixes.push('ardiente');
  return {
    affixes,
    laterList: run.kind !== 'boss' && run.zoneFight >= 1,
    hpMul: 1 + boost + (id === bossOf(run).id ? (run.asc >= 6 ? 0.2 : 0) + (run.mods.includes('jefes') ? 0.3 : 0) : 0),
    power: boost * 5 + (run.mods.includes('frenesi') ? 1 : 0),
  };
}

/** Lo que invoca el jefe de la zona, sus pilares y su nombre en la segunda fase. */
export const bossInfo = (run: RunState): BossInfo => {
  const b = bossOf(run), n = run.heroes.length;
  return {
    minion: (pos: Pos) => makeEnemy(b.minion, pos, 1, 1, { hpMul: 1 + (run.asc >= 1 ? 0.1 : 0) }),
    pillar: (pos: Pos) => makeEnemy(b.pillar, pos, 0, n),
    pillars: (n >= 3 ? 3 : 2) * (run.asc >= 10 ? 2 : 1),
    minionCap: n,
    phase2Name: b.phase2,
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


/** Tipo de sala del que sale el botín (la jaula vigilada cuenta como élite). */
export const dropKindOf = (run: Pick<RunState, 'kind' | 'ambush'>): DropKind => (run.kind === 'boss' ? 'boss' : run.kind === 'elite' || run.ambush ? 'elite' : 'combat');

/** Probabilidad de que un combate suelte objeto: sube con el acto; élites y jefes siempre. */
export const dropChance = (act: number, kind: DropKind): number => (kind === 'combat' ? Math.min(0.85, 0.5 + 0.1 * act) : 1);

/** Un objeto de botín según el acto y la sala. */
export function genLoot(run: RunState, kind: DropKind = dropKindOf(run), min: Rarity = 0, h?: Pick<HeroSave, 'cls'>): Item {
  return genItem(run, zoneOf(run).items, run.zone, kind, min, undefined, h ? schoolOf(h.cls) : undefined);
}

/**
 * Botín de objetos: 1 objeto por héroe en combate normal y élite, 2 en jefe (más 1 con el perk o la lupa en élites
 * y jefes), con el tipo de daño de ese héroe. Todo va al Alijo de grupo y el grupo decide quién se lo queda.
 */
function dropLoot(run: RunState, h: HeroSave, kind: DropKind, report: Item[]): void {
  if (!(rand(run) < dropChance(run.zone, kind))) return;
  const extra = kind === 'combat' ? 0 : perkLevel(h.perks, 'loot') + (h.relics.includes('lupa') ? 1 : 0);
  const n = { combat: 1, elite: 1, boss: 2, shop: 1 }[kind] + extra;
  for (let i = 0; i < n; i++) {
    const it = genLoot(run, kind, 0, h);
    (run.stash ??= []).push(it);
    report.push(it);
  }
}

/** El anfitrión elige uno de los nodos de la sala actual. */
export function chooseNode(run: RunState, idx: number): GameEvent[] {
  const node = run.map[run.step]?.[idx];
  if (run.phase !== 'map' || !node || !availableNodes(run).includes(idx)) return [];
  run.at = idx;
  run.trail[run.step] = idx;
  run.report = null;
  run.dmg0 = Object.fromEntries(run.heroes.map((h) => [h.owner, h.stats.dmg]));
  run.offers = {};
  run.note = '';
  run.stamp++;
  if (node === 'cage') {
    // la jaula está vigilada: hay que ganar el combate para liberar al prisionero
    run.cage = CAGE_ALLY[run.zone] ?? 'mercenario';
    run.ambush = true;
  }
  if (node === 'combat' || node === 'elite' || node === 'boss' || node === 'cage') {
    run.kind = node === 'cage' ? 'combat' : node;
    // presagio: a veces (siempre con el modificador), nunca en el jefe
    run.omen = node === 'boss' ? null : run.nextOmen ?? (run.mods.includes('presagios') || rand(run) < 0.3 ? pick(run, OMENS).id : null);
    run.nextOmen = null;
    const { state, events } = createCombat({ ...buildFight(run), deploy: true });
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
    run.shop = Array.from({ length: 6 }, (): ShopSlot => {
      const item = genLoot(run, 'shop', 0, pick(run, run.heroes));
      return { item, price: priceOf(run, PRICE[item.rarity]), sold: false };
    });
    const rel = pick(run, Object.values(RELICS));
    run.shop.push({ relic: rel.id, price: priceOf(run, rel.rare ? 160 : 100), sold: false });
    // consumibles: no se agotan (cada uno compra los suyos)
    for (const id of ['c_vida', 'c_fuego', 'c_humo', 'c_resu']) run.shop.push({ consumable: id, price: priceOf(run, CONSUMABLES[id]!.price), sold: false });
    run.phase = 'shop';
  } else if (node === 'rest') {
    for (const h of run.heroes) h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * healOf(run, h, 0.4)));
    run.note = 'Descansáis junto a una hoguera: todos recuperáis el 40% de la vida.';
    run.step++;
  } else if (node === 'treasure') {
    const got: string[] = [];
    for (const h of run.heroes) { const it = giveItem(run, h, 'elite', 1); got.push(`${h.name}: ${it.name}`); }
    run.note = `Sala del botín: cada uno encuentra un objeto Uncommon o mejor (${got.join(' · ')}).`;
    run.step++;
  } else if (node === 'shrine') {
    for (const h of run.heroes) offerBoon(run, h);
    run.note = 'El santuario despierta el poder de cada clase: elegid una bendición pasiva.';
    run.step++;
  }
  return [];
}

/** Salir de la tienda o de un evento ya resuelto y volver al mapa. */
export function leaveNode(run: RunState): void {
  if (run.phase === 'shop' || (run.phase === 'event' && run.event?.result)) {
    // el «Listo» dado en la tienda o el evento vale también para el mapa que sigue
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
/** ¿Se puede continuar esta partida guardada? (versión actual y clases que existen) */
export function loadable(run: RunState | null): run is RunState {
  return !!run && run.version === 9 && run.heroes.every((h) => h.cls in CLASSES);
}

export function finishFight(run: RunState): void {
  const c = run.combat;
  if (!c?.over) return;
  if (run.arena) { run.phase = c.over === 'win' ? 'won' : 'lost'; run.note = `Gana el equipo de ${c.over === 'win' ? run.arena.nameA : run.arena.nameB}.`; return; }
  if (c.over === 'lose') { run.phase = 'lost'; return; }
  if (c.units.some((u) => u.name.startsWith('Némesis: '))) run.flags.push('nemesis');
  const gold = Math.round((25 + run.fight * 8 + (run.kind === 'elite' ? 20 : run.kind === 'boss' ? 40 : 0)) * (run.mods.includes('codicia') ? 2 : 1) * (run.omen === 'oro' ? 2 : 1) * (run.mods.includes('pobreza') ? 0.5 : 1));
  const flawless = c.units.every((u) => u.team !== 'hero' || u.summoner !== undefined || u.hp > 0);
  const extra: string[] = [];
  const loot: FightReport['loot'] = [];
  const found: Record<string, Item[]> = {};
  if (run.kind === 'boss' && flawless) run.flags.push(`flawless_${run.zone}`);
  if (run.kind === 'boss') run.flags.push(`boss_${run.zone}`);
  for (const h of run.heroes) {
    const u = c.units.find((x) => x.owner === h.owner && x.summoner === undefined);
    const left = u ? u.hp : h.hp;
    // los consumibles gastados no vuelven
    if (u) for (const sp of u.spells) if (sp.charges !== undefined) h.bag2[sp.id] = Math.max(0, sp.charges);
    // botín variado: consumibles (seguros tras élite o jefe)
    if (run.kind !== 'combat' || rand(run) < 0.4) {
      const r = rand(run), id = r < 0.4 ? 'c_vida' : r < 0.65 ? 'c_fuego' : r < 0.9 ? 'c_humo' : 'c_resu';
      if ((h.bag2[id] ?? 0) < MAX_CONSUMABLE) { h.bag2[id] = (h.bag2[id] ?? 0) + 1; extra.push(`${h.name}: ${CONSUMABLES[id]!.icon} ${CONSUMABLES[id]!.name}`); loot.push({ owner: h.owner, icon: CONSUMABLES[id]!.icon, name: CONSUMABLES[id]!.name, text: 'Consumible de combate' }); }
    }
    // Cosecha de almas del Carcelero: cuentan en toda la partida (cada 5, +1 de armadura)
    if (u?.souls !== undefined) {
      const before = Math.floor((h.souls ?? 0) / SOULS_PER_ARMOR);
      h.souls = u.souls;
      h.soulBank = u.soulBank ?? 0;
      const gained = Math.floor(h.souls / SOULS_PER_ARMOR) - before;
      if (gained > 0) extra.push(`${h.name}: ${h.souls} almas, +${gained} de armadura`);
    }
    // objetos según la sala; los hechizos solo llegan al vencer al jefe de la zona
    dropLoot(run, h, dropKindOf(run), (found[h.owner] ??= []));
    if (run.kind === 'boss' && run.zone < lastZone(run)) h.bossOffer = buildBossOffer(run, h);
    const max = heroMaxHp(h);
    // no hay curación gratis tras un combate: solo tras vencer al jefe (o en hogueras, eventos y habilidades).
    // Los caídos se levantan con el 30% de la vida para poder seguir jugando.
    const healPct = run.kind === 'boss' ? healOf(run, h, 0.5) : 0;
    h.hp = left <= 0 ? Math.max(Math.ceil(max * 0.3), Math.ceil(max * healPct)) : Math.min(max, left + Math.ceil(max * healPct));
    h.gold += gold + (h.relics.includes('bolsa') ? 15 : 0);
    h.stats.maxGold = Math.max(h.stats.maxGold, h.gold);
    // reliquias: siempre tras el jefe, a veces tras un élite; y la promesa cumplida
    const relicHere = run.kind === 'boss' || (run.kind === 'elite' && rand(run) < 0.35);
    if (relicHere) { const r = giveRelic(run, h, run.kind === 'boss' ? undefined : false); if (r) { extra.push(`${h.name}: ${RELICS[r]!.icon} ${RELICS[r]!.name}`); loot.push({ owner: h.owner, icon: RELICS[r]!.icon, name: RELICS[r]!.name, text: RELICS[r]!.text, rare: !!RELICS[r]!.rare }); } }
    if (run.kind === 'boss' && flawless && run.flags.includes(`promesa_${run.zone}`)) { const r = giveRelic(run, h, true); if (r) { extra.push(`${h.name} (promesa): ${RELICS[r]!.icon} ${RELICS[r]!.name}`); loot.push({ owner: h.owner, icon: RELICS[r]!.icon, name: RELICS[r]!.name, text: RELICS[r]!.text, rare: !!RELICS[r]!.rare }); } }
  }
  if (run.cage) { addAlly(run, run.cage); extra.push(`Liberáis al prisionero: ${makeEnemy(run.cage, { x: 0, y: 0 }).name} os acompaña hasta el final de la zona`); run.cage = null; }
  run.stamp++;
  run.note = `Victoria: cada uno gana ${gold} de oro.${extra.length ? ` También: ${extra.join(' · ')}.` : ''}`;
  run.report = { stamp: run.stamp, kind: run.kind, turns: c.round, gold, loot, items: Object.entries(found).flatMap(([owner, list]) => list.map((item) => ({ owner, item }))), damage: run.heroes.map((h) => ({ owner: h.owner, name: h.name, dmg: Math.max(0, h.stats.dmg - (run.dmg0?.[h.owner] ?? h.stats.dmg)) })) };
  run.omen = null;
  run.ambush = false;
  run.fight++;
  run.zoneFight++;
  run.step++;
  run.combat = null;
  run.phase = 'map';
  if (run.kind === 'boss') {
    const won = bossOf(run).win;
    if (run.zone >= lastZone(run)) { run.phase = 'won'; run.note = won; if (run.abyss) run.flags.push('abyss_won'); return; }
    // siguiente zona: mapa nuevo y un respiro
    run.zone++;
    run.zoneFight = 0;
    run.step = 0;
    setMap(run);
    run.allies = [];
    for (const h of run.heroes) { h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * 0.5)); h.rerolls = perkLevel(h.perks, 'reroll') + (h.relics.includes('dado') ? 1 : 0); }
    run.note = `${won} ${zoneOf(run).intro} Recuperáis el 50% de la vida.`;
    // el prestamista cobra al llegar a la zona siguiente
    if (run.flags.includes(`deuda_${run.zone}`)) {
      run.flags = run.flags.filter((f) => f !== `deuda_${run.zone}`);
      for (const h of run.heroes) { if (h.gold >= 100) h.gold -= 100; else { h.gold = 0; h.boon.hp = (h.boon.hp ?? 0) - 15; clampHp(h); } }
      run.note += ' El prestamista de huesos cobra su deuda.';
    }
    // reliquia de grupo: se vota antes de seguir
    const relic = RELIC_EVENTS[run.zone - 1];
    if (relic) { run.event = { id: relic.id, votes: {} }; run.phase = 'event'; }
  }
}

/** Mete un objeto en el equipo si la ranura está libre; si no, en la mochila. Devuelve false si no cabe. */
/** Da un objeto nuevo a un héroe (a la ranura libre o a la mochila; si no cabe, se pierde). */
export function giveItem(run: RunState, h: HeroSave, kind: DropKind = 'combat', min: Rarity = 0): Item {
  const it = genLoot(run, kind, min, h);
  // si no le cabe, va al Alijo de grupo (nunca se pierde ni se vende solo)
  if (!receive(h, it)) (run.stash ??= []).push(it);
  return it;
}

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
  | { a: 'stash'; idx: number; op: 'equip' | 'bag' | 'split' }
  | { a: 'drop'; idx: number }
  | { a: 'buy'; idx: number }
  | { a: 'potion' }
  | { a: 'reroll' }
  | { a: 'bossreward'; idx: number }
  | { a: 'boon'; idx: number }
  | { a: 'ready' };

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
      const before = heroMaxHp(h);
      if (item && !receive(h, item)) return 'Mochila llena: tira, da o vende algo antes';
      h.hp += Math.max(0, heroMaxHp(h) - before);
      delete run.offers[owner];
      break;
    }
    case 'stash': {
      const item = run.stash?.[a.idx];
      if (!item) return 'Ese objeto ya no está en el alijo';
      const before = heroMaxHp(h);
      if (a.op === 'equip') {
        const old = h.equip[item.slot];
        if (old && h.bag.length >= BAG_SIZE) return 'Mochila llena: no cabe lo que llevas puesto';
        if (old) h.bag.push(old);
        h.equip[item.slot] = item;
      } else if (a.op === 'bag') {
        if (h.bag.length >= BAG_SIZE) return `Mochila llena (${BAG_SIZE})`;
        h.bag.push(item);
      } else {
        // repartir: se vende al 50% y el oro se reparte a partes iguales
        const each = Math.floor(Math.floor(PRICE[item.rarity] / 2) / run.heroes.length);
        for (const x of run.heroes) x.gold += each;
      }
      run.stash!.splice(a.idx, 1);
      h.hp = Math.max(1, Math.min(heroMaxHp(h), h.hp + Math.max(0, heroMaxHp(h) - before)));
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
      const before = heroMaxHp(h);
      h.bag.splice(a.idx, 1);
      if (old) h.bag.push(old);
      h.equip[item.slot] = item;
      // la vida que da el objeto nuevo se suma también a la vida actual
      h.hp = Math.max(1, Math.min(heroMaxHp(h), h.hp + heroMaxHp(h) - before));
      break;
    }
    case 'unequip': {
      const item = h.equip[a.slot];
      if (!item) return 'Ranura vacía';
      if (h.bag.length >= BAG_SIZE) return 'Mochila llena';
      delete h.equip[a.slot];
      h.bag.push(item);
      clampHp(h);
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
      h.gold += Math.floor(PRICE[item.rarity] / 2);
      break;
    }
    case 'buy': {
      const slot = run.shop?.[a.idx];
      if (run.phase !== 'shop' || !slot || slot.sold) return 'Ya no está a la venta';
      if (h.gold < slot.price) return 'No tienes oro suficiente';
      if (slot.consumable) { if ((h.bag2[slot.consumable] ?? 0) >= MAX_CONSUMABLE) return `Llevas el máximo (${MAX_CONSUMABLE})`; h.bag2[slot.consumable] = (h.bag2[slot.consumable] ?? 0) + 1; h.gold -= slot.price; break; }
      if (slot.relic) { if (h.relics.includes(slot.relic)) return 'Ya tienes esa reliquia'; h.relics.push(slot.relic); }
      else if (!slot.item || !receive(h, slot.item)) return 'Mochila llena';
      h.gold -= slot.price;
      slot.sold = true;
      break;
    }
    case 'bossreward': {
      const o = h.bossOffer?.[a.idx];
      if (!o) return 'No tienes recompensa del jefe pendiente';
      if (o.kind === 'up') {
        if (BOON_MODS[o.up]) h.boons.push(o.up); else (h.ups[o.spell] ??= []).push(o.up);
      } else if (o.kind === 'spell') { if (!h.boons.includes(o.id)) h.boons.push(o.id); }
      else if (o.kind === 'gold') h.gold += o.amount;
      else h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * 0.5));
      h.bossOffer = null;
      break;
    }
    case 'reroll': {
      const list = run.offers[owner];
      if (!list) return 'No tienes botín pendiente';
      if (h.rerolls <= 0) return 'No te quedan re-tiradas en esta zona';
      h.rerolls--;
      const min = Math.min(...list.map((x) => x.rarity)) as Rarity;
      run.offers[owner] = list.map(() => genLoot(run, dropKindOf(run), min));
      break;
    }
    case 'boon': {
      const o = h.boonOffer;
      if (!o) return 'No tienes ninguna bendición pendiente';
      if (a.idx >= 0) { const sp = o.spells[a.idx]; if (!sp) return 'Opción no válida'; if (!h.boons.includes(sp)) h.boons.push(sp); }
      h.boonOffer = null;
      break;
    }
    case 'ready': {
      const p = pendingOf(run, h);
      if (p.length) return `Antes elige: ${p.join(', ')}`;
      run.ready[owner] = run.ready[owner] === run.stamp ? -1 : run.stamp;
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
  const opts = { hpMul: 2.2, level: 1 };
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
