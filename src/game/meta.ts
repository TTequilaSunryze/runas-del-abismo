// Progresión entre partidas: ecos (para la tienda de cosméticos), maestría, logros, ascensión y Archivo.
// Se guarda en el navegador de cada jugador.
import { CLASSES } from '../core/classes/classes';
import { MAX_ASC, modEcos } from '../content/modes';
import type { ClassId } from '../core/state';
import { ACT_ROOMS } from './map';
import type { Champion, HeroSave, RunState } from './run';
import { mergeArchive, normalizeArchive, type Archive } from './archiveData';
import { mergeContracts, normalizeContracts, type ContractBook } from './contractsData';
import { cleanRoom, mergeRooms, type RoomDef } from './salas';
import { mergeCosmetics, normalizeCosmetics, spentTotal, type Cosmetics } from './cosmetics';
export type { Cosmetics } from './cosmetics';
export type { Contract, ContractBook, ContractPeriod, ContractTarget, SpecialRecord, SpecialType } from './contractsData';
export type { Archive, AtlasEntryRecord, ChronicleEntryRecord, AtlasCat, AtlasState, ChronicleCat, ChronicleState } from './archiveData';

export interface Meta {
  v: 1;
  ecos: number;
  /** heredado: niveles de las antiguas Mejoras permanentes (ya retiradas). Se reembolsan al cargar y queda vacío. */
  perks?: Record<string, number>;
  /** niveles de Mejoras ya reembolsados (para no devolverlos dos veces, también al fusionar dispositivos) */
  perksRefunded?: Record<string, number>;
  /** ecos devueltos por las Mejoras retiradas (para avisar al jugador) y si ya vio el aviso */
  perksRefundEcos?: number;
  refundSeen?: boolean;
  /** reservado */
  unlocked: string[];
  /** ascensión más alta disponible */
  maxAsc: number;
  achievements: string[];
  stats: { runs: number; wins: number; kills: number; bosses: number; bestZone: number };
  seenTutorial: boolean;
  combats: number;
  /** partidas ya cobradas (para no cobrar dos veces) */
  claimed: string[];
  /** experiencia de maestría por clase */
  mastery: Record<string, number>;
  /** Salón de héroes y el equipo de duelo (ids del salón) */
  hall: Champion[];
  team: string[];
  /** última modificación (ms) y cuenta a la que está ligado */
  t: number;
  acct: string | null;
  /** nombres de cuenta de mis amigos */
  friends: string[];
  /** Archivo del Abismo (bestiario, grimorio, reliquias). Opcional: las Meta anteriores no lo tienen. */
  archive?: Archive;
  /** Contratos del Abismo (diarios y semanales). Opcional: las Meta anteriores no lo tienen. */
  contracts?: ContractBook;
  /** títulos y marcos desbloqueados y equipados (solo visuales). Opcional. */
  cosmetics?: Cosmetics;
  /** H3: habilidades equipadas por clase (4 ids). Opcional; se valida al usarla (si no vale, las iniciales). */
  kits?: Record<string, string[]>;
  /** Modo creador activado (solo surte efecto en las cuentas de creador). No borra ni cambia el progreso real. */
  creator?: boolean;
  /** salas creadas por el creador (y las que borró, para que no vuelvan al fusionar dispositivos) */
  rooms?: RoomDef[];
  roomsGone?: string[];
}

// ---------- modo creador ----------
/** Cuentas de creador (email de la cuenta, en minúsculas). */
export const CREATOR_EMAILS = ['rodrigoamericarp@gmail.com'];
let creatorAccount = false;
/** La cuenta avisa de quién ha entrado (o null al salir). */
export function setCreatorAccount(email: string | null | undefined): void { creatorAccount = !!email && CREATOR_EMAILS.includes(email.trim().toLowerCase()); }
/** ¿La cuenta conectada es de creador? */
export const isCreatorAccount = (): boolean => creatorAccount;
/** ¿Está activo el modo creador? (cuenta de creador y opción marcada) */
export const creatorOn = (m: Partial<Pick<Meta, 'creator'>> = meta()): boolean => creatorAccount && !!m.creator;
/** Ascensión máxima disponible (todas con el modo creador). */
export const maxAscOf = (m: Meta = meta()): number => (creatorOn(m) ? MAX_ASC : m.maxAsc);

const KEY = 'rda_meta';

/** Precios que tenían las Mejoras permanentes retiradas (para devolver exactamente lo gastado). */
export const LEGACY_PERKS: Record<string, { max: number; cost: (lvl: number) => number }> = {
  vit: { max: 5, cost: (l) => 30 + l * 25 }, gold: { max: 4, cost: (l) => 25 + l * 20 }, loot: { max: 1, cost: () => 120 }, aid: { max: 3, cost: (l) => 40 + l * 30 },
};
const lvlOf = (x: unknown, max: number): number => (Number.isFinite(Number(x)) ? Math.max(0, Math.min(max, Math.floor(Number(x)))) : 0);
/**
 * Devuelve los ecos gastados en Mejoras que aún no se habían devuelto y deja `perks` vacío. Idempotente: `perksRefunded`
 * recuerda los niveles ya devueltos, así que volver a cargar o fusionar con otro dispositivo no devuelve dos veces.
 */
export function refundPerks(m: Meta): number {
  let got = 0;
  const done = (m.perksRefunded ??= {});
  for (const [id, def] of Object.entries(LEGACY_PERKS)) {
    const lvl = lvlOf(m.perks?.[id], def.max), had = lvlOf(done[id], def.max);
    for (let l = had; l < lvl; l++) got += def.cost(l);
    if (lvl > had) done[id] = lvl;
  }
  if (got) { m.ecos += got; m.perksRefundEcos = (m.perksRefundEcos ?? 0) + got; }
  delete m.perks;
  return got;
}
const fresh = (): Meta => ({ v: 1, ecos: 0, unlocked: [], maxAsc: 0, achievements: [], stats: { runs: 0, wins: 0, kills: 0, bosses: 0, bestZone: 0 }, seenTutorial: false, combats: 0, claimed: [], mastery: {}, hall: [], team: [], t: 0, acct: null, friends: [], archive: normalizeArchive(undefined), contracts: normalizeContracts(undefined), cosmetics: normalizeCosmetics(undefined) });

let cache: Meta | null = null;
export function meta(): Meta {
  if (cache) return cache;
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Meta | null;
    cache = m && m.v === 1 ? { ...fresh(), ...m, stats: { ...fresh().stats, ...m.stats }, archive: normalizeArchive(m.archive), contracts: normalizeContracts(m.contracts), cosmetics: normalizeCosmetics(m.cosmetics) } : fresh();
    if (refundPerks(cache)) saveMeta(false);
    // quien ya jugaba antes de la maestría no empieza de cero
    if (m && m.v === 1 && !m.mastery && cache.stats.runs > 0) {
      for (const c of Object.keys(CLASSES)) cache.mastery[c] = cache.achievements.includes(`clase_${c}`) ? MASTERY_XP[1]! : MASTERY_XP[0]!;
    }
  } catch {
    cache = fresh();
  }
  return cache;
}
let onSave: (() => void) | null = null;
/** La cuenta se engancha aquí para subir el progreso a la nube tras cada cambio. */
export function setSaveHook(fn: (() => void) | null): void { onSave = fn; }

export function saveMeta(touch = true): void {
  const m = meta();
  if (touch) m.t = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* sin almacenamiento */ }
  if (touch) onSave?.();
}

/** Sustituye el progreso local (al cargar el de la cuenta). */
export function replaceMeta(m: Meta): void {
  cache = { ...fresh(), ...m, stats: { ...fresh().stats, ...m.stats }, archive: normalizeArchive(m.archive), contracts: normalizeContracts(m.contracts), cosmetics: normalizeCosmetics(m.cosmetics) };
  refundPerks(cache);
  saveMeta(false);
}

const uniq = <T,>(a: T[]): T[] => [...new Set(a)];
/**
 * Ecos al unir dos dispositivos. Lo ganado nunca baja, así que el total ganado (saldo + gastado en la tienda) de cada uno es
 * fiable: se toma el mayor y se le resta lo gastado en ambos (sin duplicar compras). Así una compra hecha en un dispositivo
 * no se «devuelve» al fusionar con otro que aún no la tenía, ni se cobra dos veces.
 */
export function mergedEcos(a: Pick<Meta, 'ecos' | 'cosmetics'>, b: Partial<Pick<Meta, 'ecos' | 'cosmetics'>>): number {
  const gross = Math.max(a.ecos + spentTotal(a.cosmetics), (b.ecos ?? 0) + spentTotal(b.cosmetics));
  return Math.max(0, gross - spentTotal(mergeCosmetics(a.cosmetics, b.cosmetics)));
}
/** Une dos progresos sin perder nada: lo mayor de cada cosa. Se usa la primera vez que un navegador entra en una cuenta. */
export function mergeMeta(a: Meta, b: Partial<Meta>): Meta {
  const f = fresh();
  const maxRec = (x: Record<string, number | undefined> = {}, y: Record<string, number | undefined> = {}): Record<string, number> =>
    Object.fromEntries(uniq([...Object.keys(x), ...Object.keys(y)]).map((k) => [k, Math.max(Number(x[k]) || 0, Number(y[k]) || 0)]));
  const hall = [...(a.hall ?? [])];
  for (const c of b.hall ?? []) if (!hall.some((x) => x.id === c.id)) hall.push(c);
  return {
    ...f, v: 1, ecos: mergedEcos(a, b), perks: maxRec(a.perks, b.perks), perksRefunded: maxRec(a.perksRefunded, b.perksRefunded), perksRefundEcos: Math.max(a.perksRefundEcos ?? 0, b.perksRefundEcos ?? 0), refundSeen: !!(a.refundSeen || b.refundSeen), unlocked: uniq([...a.unlocked, ...(b.unlocked ?? [])]),
    maxAsc: Math.max(a.maxAsc, b.maxAsc ?? 0), achievements: uniq([...a.achievements, ...(b.achievements ?? [])]),
    stats: maxRec(a.stats, b.stats) as Meta['stats'], seenTutorial: a.seenTutorial || !!b.seenTutorial, combats: Math.max(a.combats, b.combats ?? 0),
    claimed: uniq([...a.claimed, ...(b.claimed ?? [])]).slice(-40), mastery: maxRec(a.mastery, b.mastery), hall: hall.slice(-HALL_SIZE),
    team: (a.team?.length ? a.team : b.team) ?? [], t: Date.now(), acct: a.acct, friends: uniq([...(a.friends ?? []), ...(b.friends ?? [])]).slice(0, 30),
    archive: mergeArchive(a.archive, b.archive),
    contracts: mergeContracts(a.contracts, b.contracts),
    cosmetics: mergeCosmetics(a.cosmetics, b.cosmetics),
    // H3: la configuración de este dispositivo manda; de la otra, solo las clases que aquí no se han tocado
    kits: { ...cleanKits(b.kits), ...cleanKits(a.kits) },
    roomsGone: uniq([...(a.roomsGone ?? []), ...(b.roomsGone ?? [])]).slice(-200),
    rooms: mergeRooms(a.rooms, b.rooms, uniq([...(a.roomsGone ?? []), ...(b.roomsGone ?? [])])),
  };
}
/** H3: configuraciones guardadas con forma correcta (4 textos por clase); la validez se comprueba al usarlas. */
export function cleanKits(x: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!x || typeof x !== 'object') return out;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (CLASSES[k as ClassId] && Array.isArray(v) && v.length === 4) out[k] = v.map(String).slice(0, 4);
  return out;
}

// ---------- salas creadas (solo cuentas de creador) ----------
export const myRooms = (): RoomDef[] => (meta().rooms ?? []).map(cleanRoom).filter((r): r is RoomDef => !!r);
/** Guarda (o actualiza) una sala y la sube a la nube con el resto del progreso. */
export function putRoom(r: RoomDef): void {
  const m = meta(), c = cleanRoom({ ...r, t: Date.now() });
  if (!c) return;
  m.rooms = [...(m.rooms ?? []).filter((x) => x.id !== c.id), c];
  saveMeta();
}
export function dropRoom(id: string): void {
  const m = meta();
  m.rooms = (m.rooms ?? []).filter((x) => x.id !== id);
  m.roomsGone = [...(m.roomsGone ?? []), id].slice(-200);
  saveMeta();
}

// ---------- maestría de clase ----------
/** Experiencia necesaria para cada nivel de maestría (1 a 5). */
export const MASTERY_XP = [40, 110, 220, 380, 600];
export const MASTERY_TEXT = ['Desbloquea un 2.º kit inicial', 'Desbloquea un 3.er kit inicial', 'Desbloquea un 4.º kit inicial', 'Desbloquea un 5.º kit inicial', 'Maestro: tus ofertas de hechizos y bendiciones muestran 4 opciones'];
/** Oro inicial extra por cada nivel de maestría que no abre un kit nuevo. */
export const MASTERY_GOLD = 25;
/** Lo que da el nivel `i + 1` de maestría de una clase. */
export function masteryText(cls: ClassId, i: number): string {
  if (i >= 4) return MASTERY_TEXT[4]!;
  const r = CLASSES[cls].routes[i + 1];
  // H3: los kits por maestría ya no se eligen en la sala: sus habilidades del catálogo se regalan en la tienda
  return r ? `Regala habilidades del kit ${r.name} en la tienda` : `Empiezas cada partida con +${MASTERY_GOLD} de oro`;
}
/** Progreso de maestría de una clase: nivel, experiencia y lo que falta para el siguiente. */
export function masteryProgress(cls: string): { lv: number; xp: number; prev: number; next: number | undefined; pct: number } {
  const xp = meta().mastery[cls] ?? 0, lv = masteryLevel(xp), next = MASTERY_XP[lv], prev = lv ? MASTERY_XP[lv - 1]! : 0;
  return { lv, xp, prev, next, pct: next ? Math.round(((xp - prev) / (next - prev)) * 100) : 100 };
}
export const masteryLevel = (xp: number): number => MASTERY_XP.filter((n) => xp >= n).length;
export const masteryOf = (cls: string): number => (creatorOn() ? 5 : masteryLevel(meta().mastery[cls] ?? 0));
/** Rutas que se pueden elegir con ese nivel de maestría: al principio la 1.ª y la 3.ª (no opuestas). */
/** Kits iniciales que se pueden elegir: el Clásico siempre; uno más por cada nivel de maestría (hasta el 4). */
export function openRoutes(cls: ClassId, level = masteryOf(cls)): string[] {
  return CLASSES[cls].routes.filter((_r, i) => i <= level).map((r) => r.id);
}
export const routeNeeds = (cls: ClassId, route: string): number => Math.max(0, CLASSES[cls].routes.findIndex((r) => r.id === route));
/**
 * Salas realmente superadas en la partida. `step` es la capa actual del mapa de la zona (sube al cerrar una sala,
 * y vuelve a 0 al cambiar de zona), y `trail` se reinicia con cada mapa, así que las zonas ya completadas se
 * suman por su tamaño fijo: ACT_ROOMS + 1 capas (la última es el jefe) y, en la primera zona, el Altar de Pactos
 * delante (salvo en la arena). Cada capa cuenta una sola vez: el jefe y el altar son capas como las demás.
 */
/** Las zonas tenían 11 salas (10 + jefe) y ahora tienen 8: cada sala vale 11/8 para que una zona completa dé los mismos
 * ecos y la misma experiencia de maestría que antes. */
export const ROOM_SCALE = 11 / (ACT_ROOMS + 1);
export function roomsCleared(run: RunState): number {
  const perZone = ACT_ROOMS + 1, first = perZone + (run.arena ? 0 : 1);
  const before = run.zone <= 0 ? 0 : first + (run.zone - 1) * perZone;
  const here = Math.max(0, Math.min(run.step, run.map.length || run.step));
  return before + here;
}

export function masteryXpFor(run: RunState): number {
  const rooms = roomsCleared(run) * ROOM_SCALE, bosses = run.flags.filter((f) => f.startsWith('boss_')).length;
  return Math.round((rooms * 5 + bosses * 25 + (run.phase === 'won' ? 50 : 0)) * (1 + 0.2 * run.asc));
}

// ---------- Salón de héroes ----------
export const HALL_SIZE = 12;
export function saveChampion(c: Champion): void {
  const m = meta();
  m.hall = [...m.hall.filter((x) => x.id !== c.id), c].slice(-HALL_SIZE);
  if (m.team.length < 3 && !m.team.includes(c.id)) m.team.push(c.id);
  m.team = m.team.filter((id) => m.hall.some((x) => x.id === id));
  saveMeta();
}
export function removeChampion(id: string): void {
  const m = meta();
  m.hall = m.hall.filter((x) => x.id !== id);
  m.team = m.team.filter((x) => x !== id);
  saveMeta();
}
export function toggleTeam(id: string): void {
  const m = meta();
  if (m.team.includes(id)) m.team = m.team.filter((x) => x !== id);
  else if (m.team.length < 3 && m.hall.some((x) => x.id === id)) m.team.push(id);
  saveMeta();
}
export const myTeam = (): Champion[] => meta().team.map((id) => meta().hall.find((c) => c.id === id)).filter((c): c is Champion => !!c);
/** El héroe más fuerte del salón: el que puede volver como némesis. */
export const myNemesis = (): Champion | null => meta().hall.slice().sort((a, b) => b.level + b.asc * 2 + Number(b.won) * 5 - (a.level + a.asc * 2 + Number(a.won) * 5))[0] ?? null;


export interface AchievementDef {
  id: string;
  name: string;
  text: string;
  ecos?: number;
  check: (run: RunState, h: HeroSave, m: Meta) => boolean;
}

const won = (r: RunState): boolean => r.phase === 'won';
const classWin = (cls: ClassId): AchievementDef => ({
  id: `clase_${cls}`, name: `Maestría: ${CLASSES[cls].name}`, text: `Gana una partida con ${CLASSES[cls].name}.`, ecos: 50,
  check: (r, h) => won(r) && h.cls === cls,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'jefe1', name: 'Silencio en el osario', text: 'Vence al Prior Hueco.', check: (r) => r.flags.includes('boss_0') },
  { id: 'jefe2', name: 'Raíz arrancada', text: 'Vence a la Madre Raíz.', check: (r) => r.flags.includes('boss_1') },
  { id: 'victoria', name: 'Fin del abismo', text: 'Gana una partida completa.', ecos: 60, check: won },
  { id: 'impecable', name: 'Impecable', text: 'Vence a un jefe sin que caiga nadie.', ecos: 50, check: (r) => r.flags.some((f) => f.startsWith('flawless_')) },
  { id: 'leyenda', name: 'Reliquia legendaria', text: 'Termina una partida con un objeto legendario equipado.', ecos: 40, check: (_r, h) => Object.values(h.equip).some((i) => i.rarity === 3) },
  { id: 'rico', name: 'Avaricia', text: 'Llega a tener 300 de oro.', ecos: 30, check: (_r, h) => h.stats.maxGold >= 300 },
  { id: 'carnicero', name: 'Carnicero', text: 'Acumula 150 bajas entre todas tus partidas.', ecos: 60, check: (_r, _h, m) => m.stats.kills >= 150 },
  { id: 'intacto', name: 'Intocable', text: 'Gana una partida sin caer ni una vez.', ecos: 100, check: (r, h) => won(r) && h.stats.falls === 0 },
  { id: 'cuatro', name: 'Hermandad', text: 'Gana una partida con 4 jugadores.', ecos: 80, check: (r) => won(r) && r.heroes.length === 4 },
  { id: 'asc3', name: 'Ascendido', text: 'Gana en ascensión 3 o más.', ecos: 120, check: (r) => won(r) && r.asc >= 3 },
  { id: 'asc10', name: 'Señor del abismo', text: 'Gana en ascensión 10.', ecos: 300, check: (r) => won(r) && r.asc >= 10 },
  { id: 'diario', name: 'Constancia', text: 'Supera la zona 1 en un reto diario.', ecos: 40, check: (r) => !!r.daily && (r.zone >= 1 || won(r)) },
  { id: 'abismo', name: 'Cerrar el Abismo', text: 'Gana una partida que incluya la zona 4.', ecos: 150, check: (r) => r.flags.includes('abyss_won') },
  { id: 'reliquias5', name: 'Coleccionista', text: 'Termina una partida con 5 reliquias o más.', ecos: 40, check: (_r, h) => (h.relics?.length ?? 0) >= 5 },
  { id: 'mutado', name: 'Por gusto', text: 'Gana una partida con 3 modificadores elegidos.', ecos: 100, check: (r) => won(r) && !r.daily && r.mods.length >= 3 },
  { id: 'nemesis', name: 'Cara a cara', text: 'Vence a un Némesis: un héroe del Salón convertido en élite.', ecos: 50, check: (r) => r.flags.includes('nemesis') },
  { id: 'maestro', name: 'Maestro de clase', text: 'Alcanza la maestría 5 con una clase.', ecos: 150, check: (_r, _h, m) => Object.values(m.mastery).some((xp) => masteryLevel(xp) >= 5) },
  classWin('guerrero'), classWin('mago'), classWin('clerigo'), classWin('picaro'), classWin('arquero'), classWin('zorro'), classWin('esferas'), classWin('carcelero'), classWin('acechador'), classWin('barbaro'), classWin('arquitecto'), classWin('pistolero'),
];

/**
 * Logros que se muestran: se ocultan los de clases que no se pueden jugar (CLASSES[x].hidden), salvo que el jugador
 * ya los tenga. En ACHIEVEMENTS siguen existiendo (y en meta.achievements los ya ganados): solo cambia la lista visible.
 */
export function listedAchievements(m: Pick<Meta, 'achievements'> = meta()): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => {
    const cls = a.id.startsWith('clase_') ? CLASSES[a.id.slice(6) as ClassId] : undefined;
    return !cls?.hidden || m.achievements.includes(a.id);
  });
}
export const achievementCount = (m: Pick<Meta, 'achievements'> = meta()): string => `${listedAchievements(m).filter((a) => m.achievements.includes(a.id)).length}/${listedAchievements(m).length}`;

/** Ecos que gana un jugador al terminar: por salas, jefes y victoria, más por ascensión. */
export function ecosFor(run: RunState): number {
  const rooms = roomsCleared(run) * ROOM_SCALE;
  const bosses = run.flags.filter((f) => f.startsWith('boss_')).length;
  const base = rooms * 4 + bosses * 25 + (won(run) ? 60 : 0);
  return Math.round((base + (run.flags.includes('abyss_won') ? 80 : 0) + (run.abyss ? Math.max(0, run.zone - 2) * 30 : 0)) * (1 + 0.2 * run.asc) * (run.daily ? 1.3 : 1 + run.mods.reduce((n, id) => n + modEcos(id), 0)));
}

export interface Settlement {
  ecos: number;
  achievements: AchievementDef[];
  /** ascensión recién desbloqueada */
  asc: number | null;
  /** maestría de la clase jugada: experiencia ganada y nivel antes y después */
  mastery: { cls: ClassId; xp: number; before: number; after: number; total: number };
}

const settled = new Map<string, Settlement>();

/** Reparte las recompensas de una partida terminada. Solo una vez por partida. */
export function settle(run: RunState, myId: string): Settlement | null {
  const h = run.heroes.find((x) => x.owner === myId);
  if (!h || run.arena || (run.phase !== 'won' && run.phase !== 'lost')) return null;
  const key = `${run.code}:${run.zone}:${run.step}:${run.fight}:${run.heroes.map((x) => x.stats.dmg).join('.')}`;
  const m = meta();
  if (settled.has(key)) return settled.get(key)!;
  if (m.claimed.includes(key)) return null;
  const xp = masteryXpFor(run), had = m.mastery[h.cls] ?? 0;
  m.mastery[h.cls] = had + xp;
  const res: Settlement = { ecos: ecosFor(run), achievements: [], asc: null, mastery: { cls: h.cls, xp, before: masteryLevel(had), after: masteryLevel(had + xp), total: had + xp } };
  m.ecos += res.ecos;
  m.stats.runs++;
  if (won(run)) m.stats.wins++;
  m.stats.kills += h.stats.kills;
  m.stats.bosses += run.flags.filter((f) => f.startsWith('boss_')).length;
  m.stats.bestZone = Math.max(m.stats.bestZone, won(run) ? (run.abyss ? 5 : 4) : run.zone + 1);
  if (won(run) && !run.daily && run.asc >= m.maxAsc && m.maxAsc < MAX_ASC) { m.maxAsc = run.asc + 1; res.asc = m.maxAsc; }
  for (const a of ACHIEVEMENTS) {
    if (m.achievements.includes(a.id) || !a.check(run, h, m)) continue;
    m.achievements.push(a.id);
    if (a.ecos) m.ecos += a.ecos;
    res.achievements.push(a);
  }
  m.claimed = [...m.claimed.slice(-30), key];
  saveMeta();
  settled.set(key, res);
  return res;
}
