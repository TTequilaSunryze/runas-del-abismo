// Progresión entre partidas: ecos, mejoras permanentes, logros y ascensión.
// Se guarda en el navegador de cada jugador.
import { CLASSES } from '../core/classes/classes';
import { MAX_ASC, MOD_ECOS, PERKS, perkLevel, type Perks } from '../content/modes';
import type { ClassId } from '../core/state';
import type { Champion, HeroSave, RunState } from './run';

export interface Meta {
  v: 1;
  ecos: number;
  perks: Perks;
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
}

const KEY = 'rda_meta';
const fresh = (): Meta => ({ v: 1, ecos: 0, perks: {}, unlocked: [], maxAsc: 0, achievements: [], stats: { runs: 0, wins: 0, kills: 0, bosses: 0, bestZone: 0 }, seenTutorial: false, combats: 0, claimed: [], mastery: {}, hall: [], team: [], t: 0, acct: null, friends: [] });

let cache: Meta | null = null;
export function meta(): Meta {
  if (cache) return cache;
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Meta | null;
    cache = m && m.v === 1 ? { ...fresh(), ...m, stats: { ...fresh().stats, ...m.stats } } : fresh();
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
  cache = { ...fresh(), ...m, stats: { ...fresh().stats, ...m.stats } };
  saveMeta(false);
}

const uniq = <T,>(a: T[]): T[] => [...new Set(a)];
/** Une dos progresos sin perder nada: lo mayor de cada cosa. Se usa la primera vez que un navegador entra en una cuenta. */
export function mergeMeta(a: Meta, b: Partial<Meta>): Meta {
  const f = fresh();
  const maxRec = (x: Record<string, number | undefined> = {}, y: Record<string, number | undefined> = {}): Record<string, number> =>
    Object.fromEntries(uniq([...Object.keys(x), ...Object.keys(y)]).map((k) => [k, Math.max(Number(x[k]) || 0, Number(y[k]) || 0)]));
  const hall = [...(a.hall ?? [])];
  for (const c of b.hall ?? []) if (!hall.some((x) => x.id === c.id)) hall.push(c);
  return {
    ...f, v: 1, ecos: Math.max(a.ecos, b.ecos ?? 0), perks: maxRec(a.perks, b.perks), unlocked: uniq([...a.unlocked, ...(b.unlocked ?? [])]),
    maxAsc: Math.max(a.maxAsc, b.maxAsc ?? 0), achievements: uniq([...a.achievements, ...(b.achievements ?? [])]),
    stats: maxRec(a.stats, b.stats) as Meta['stats'], seenTutorial: a.seenTutorial || !!b.seenTutorial, combats: Math.max(a.combats, b.combats ?? 0),
    claimed: uniq([...a.claimed, ...(b.claimed ?? [])]).slice(-40), mastery: maxRec(a.mastery, b.mastery), hall: hall.slice(-HALL_SIZE),
    team: (a.team?.length ? a.team : b.team) ?? [], t: Date.now(), acct: a.acct, friends: uniq([...(a.friends ?? []), ...(b.friends ?? [])]).slice(0, 30),
  };
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
  return r ? `Desbloquea el kit ${r.name}` : `Empiezas cada partida con +${MASTERY_GOLD} de oro`;
}
/** Progreso de maestría de una clase: nivel, experiencia y lo que falta para el siguiente. */
export function masteryProgress(cls: string): { lv: number; xp: number; prev: number; next: number | undefined; pct: number } {
  const xp = meta().mastery[cls] ?? 0, lv = masteryLevel(xp), next = MASTERY_XP[lv], prev = lv ? MASTERY_XP[lv - 1]! : 0;
  return { lv, xp, prev, next, pct: next ? Math.round(((xp - prev) / (next - prev)) * 100) : 100 };
}
export const masteryLevel = (xp: number): number => MASTERY_XP.filter((n) => xp >= n).length;
export const masteryOf = (cls: string): number => masteryLevel(meta().mastery[cls] ?? 0);
/** Rutas que se pueden elegir con ese nivel de maestría: al principio la 1.ª y la 3.ª (no opuestas). */
/** Kits iniciales que se pueden elegir: el Clásico siempre; uno más por cada nivel de maestría (hasta el 4). */
export function openRoutes(cls: ClassId, level = masteryOf(cls)): string[] {
  return CLASSES[cls].routes.filter((_r, i) => i <= level).map((r) => r.id);
}
export const routeNeeds = (cls: ClassId, route: string): number => Math.max(0, CLASSES[cls].routes.findIndex((r) => r.id === route));
export function masteryXpFor(run: RunState): number {
  const rooms = run.zone * 7 + run.step, bosses = run.flags.filter((f) => f.startsWith('boss_')).length;
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

export function buyPerk(id: string): boolean {
  const m = meta(), def = PERKS.find((p) => p.id === id);
  const lvl = perkLevel(m.perks, id);
  if (!def || lvl >= def.max || m.ecos < def.cost(lvl)) return false;
  m.ecos -= def.cost(lvl);
  m.perks[id] = lvl + 1;
  saveMeta();
  return true;
}

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

/** Ecos que gana un jugador al terminar: por salas, jefes y victoria, más por ascensión. */
export function ecosFor(run: RunState): number {
  const rooms = run.zone * 7 + run.step;
  const bosses = run.flags.filter((f) => f.startsWith('boss_')).length;
  const base = rooms * 4 + bosses * 25 + (won(run) ? 60 : 0);
  return Math.round((base + (run.flags.includes('abyss_won') ? 80 : 0) + (run.abyss ? Math.max(0, run.zone - 2) * 30 : 0)) * (1 + 0.2 * run.asc) * (run.daily ? 1.3 : 1 + MOD_ECOS * run.mods.length));
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
