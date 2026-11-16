// Progresión entre partidas: ecos, mejoras permanentes, logros, runas desbloqueadas y ascensión.
// Se guarda en el navegador de cada jugador.
import { CLASSES } from '../core/classes/classes';
import { MAX_ASC, PERKS, perkLevel, type Perks } from '../content/modes';
import { RUNES } from '../core/runes';
import type { ClassId } from '../core/state';
import type { HeroSave, RunState } from './run';

export interface Meta {
  v: 1;
  ecos: number;
  perks: Perks;
  /** runas desbloqueadas por logros */
  unlocked: string[];
  /** ascensión más alta disponible */
  maxAsc: number;
  achievements: string[];
  stats: { runs: number; wins: number; kills: number; bosses: number; bestZone: number };
  seenTutorial: boolean;
  combats: number;
  /** partidas ya cobradas (para no cobrar dos veces) */
  claimed: string[];
}

const KEY = 'rda_meta';
const fresh = (): Meta => ({ v: 1, ecos: 0, perks: {}, unlocked: [], maxAsc: 0, achievements: [], stats: { runs: 0, wins: 0, kills: 0, bosses: 0, bestZone: 0 }, seenTutorial: false, combats: 0, claimed: [] });

let cache: Meta | null = null;
export function meta(): Meta {
  if (cache) return cache;
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Meta | null;
    cache = m && m.v === 1 ? { ...fresh(), ...m, stats: { ...fresh().stats, ...m.stats } } : fresh();
  } catch {
    cache = fresh();
  }
  return cache;
}
export function saveMeta(): void {
  try { localStorage.setItem(KEY, JSON.stringify(meta())); } catch { /* sin almacenamiento */ }
}

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
  rune?: string;
  check: (run: RunState, h: HeroSave, m: Meta) => boolean;
}

const won = (r: RunState): boolean => r.phase === 'won';
const classWin = (cls: ClassId): AchievementDef => ({
  id: `clase_${cls}`, name: `Maestría: ${CLASSES[cls].name}`, text: `Gana una partida con ${CLASSES[cls].name}.`, ecos: 50,
  check: (r, h) => won(r) && h.cls === cls,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'jefe1', name: 'Silencio en el osario', text: 'Vence al Prior Hueco.', rune: 'bendicion', check: (r) => r.flags.includes('boss_0') },
  { id: 'jefe2', name: 'Raíz arrancada', text: 'Vence a la Madre Raíz.', rune: 'aturdidora', check: (r) => r.flags.includes('boss_1') },
  { id: 'victoria', name: 'Fin del abismo', text: 'Gana una partida completa.', rune: 'sangrienta', ecos: 60, check: won },
  { id: 'runico', name: 'Rúnico', text: 'Termina una partida con 4 runas engarzadas.', rune: 'silencio', check: (_r, h) => Object.keys(h.sockets).length >= 4 },
  { id: 'impecable', name: 'Impecable', text: 'Vence a un jefe sin que caiga nadie.', ecos: 50, check: (r) => r.flags.some((f) => f.startsWith('flawless_')) },
  { id: 'leyenda', name: 'Reliquia legendaria', text: 'Termina una partida con un objeto legendario equipado.', ecos: 40, check: (_r, h) => Object.values(h.equip).some((i) => i.rarity === 3) },
  { id: 'rico', name: 'Avaricia', text: 'Llega a tener 300 de oro.', ecos: 30, check: (_r, h) => h.stats.maxGold >= 300 },
  { id: 'carnicero', name: 'Carnicero', text: 'Acumula 150 bajas entre todas tus partidas.', ecos: 60, check: (_r, _h, m) => m.stats.kills >= 150 },
  { id: 'intacto', name: 'Intocable', text: 'Gana una partida sin caer ni una vez.', ecos: 100, check: (r, h) => won(r) && h.stats.falls === 0 },
  { id: 'cuatro', name: 'Hermandad', text: 'Gana una partida con 4 jugadores.', ecos: 80, check: (r) => won(r) && r.heroes.length === 4 },
  { id: 'asc3', name: 'Ascendido', text: 'Gana en ascensión 3 o más.', ecos: 120, check: (r) => won(r) && r.asc >= 3 },
  { id: 'asc10', name: 'Señor del abismo', text: 'Gana en ascensión 10.', ecos: 300, check: (r) => won(r) && r.asc >= 10 },
  { id: 'diario', name: 'Constancia', text: 'Supera la zona 1 en un reto diario.', ecos: 40, check: (r) => !!r.daily && (r.zone >= 1 || won(r)) },
  classWin('guerrero'), classWin('mago'), classWin('clerigo'), classWin('picaro'),
];

/** Ecos que gana un jugador al terminar: por salas, jefes y victoria, más por ascensión. */
export function ecosFor(run: RunState): number {
  const rooms = run.zone * 7 + run.step;
  const bosses = run.flags.filter((f) => f.startsWith('boss_')).length;
  const base = rooms * 4 + bosses * 25 + (won(run) ? 60 : 0);
  return Math.round(base * (1 + 0.2 * run.asc) * (run.daily ? 1.3 : 1));
}

export interface Settlement {
  ecos: number;
  achievements: AchievementDef[];
  /** ascensión recién desbloqueada */
  asc: number | null;
}

const settled = new Map<string, Settlement>();

/** Reparte las recompensas de una partida terminada. Solo una vez por partida. */
export function settle(run: RunState, myId: string): Settlement | null {
  const h = run.heroes.find((x) => x.owner === myId);
  if (!h || (run.phase !== 'won' && run.phase !== 'lost')) return null;
  const key = `${run.code}:${run.zone}:${run.step}:${run.fight}:${run.heroes.map((x) => x.stats.dmg).join('.')}`;
  const m = meta();
  if (settled.has(key)) return settled.get(key)!;
  if (m.claimed.includes(key)) return null;
  const res: Settlement = { ecos: ecosFor(run), achievements: [], asc: null };
  m.ecos += res.ecos;
  m.stats.runs++;
  if (won(run)) m.stats.wins++;
  m.stats.kills += h.stats.kills;
  m.stats.bosses += run.flags.filter((f) => f.startsWith('boss_')).length;
  m.stats.bestZone = Math.max(m.stats.bestZone, won(run) ? 4 : run.zone + 1);
  if (won(run) && !run.daily && run.asc >= m.maxAsc && m.maxAsc < MAX_ASC) { m.maxAsc = run.asc + 1; res.asc = m.maxAsc; }
  for (const a of ACHIEVEMENTS) {
    if (m.achievements.includes(a.id) || !a.check(run, h, m)) continue;
    m.achievements.push(a.id);
    if (a.ecos) m.ecos += a.ecos;
    if (a.rune && RUNES[a.rune] && !m.unlocked.includes(a.rune)) m.unlocked.push(a.rune);
    res.achievements.push(a);
  }
  m.claimed = [...m.claimed.slice(-30), key];
  saveMeta();
  settled.set(key, res);
  return res;
}
