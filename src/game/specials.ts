// Contratos Especiales: desafíos permanentes de jefes, clases, colecciones y crónicas. Recompensa: títulos y marcos (solo visuales).
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import type { ClassId } from '../core/state';
import { ENEMIES } from '../content/enemies';
import { PACTS } from '../content/pacts';
import { ZONES } from '../content/zones';
import { completion } from './archive';
import { CHRONICLES, SECRETS, chronicleState } from './atlas';
import { emptyContracts, type SpecialRecord, type SpecialType } from './contractsData';
import { FRAMES, TITLES, emptyCosmetics, frameDef, titleName } from './cosmetics';
import type { Meta } from './meta';

export type BossCondition = 'flawless' | 'fast' | 'pact';
/** Rondas máximas para el desafío «rápido» de jefe (a validar con partidas reales). */
export const BOSS_FAST_ROUNDS = 8;
export const CONDITION_TEXT: Record<BossCondition, string> = { flawless: 'sin que caiga ningún héroe', fast: `en ${BOSS_FAST_ROUNDS} rondas o menos`, pact: 'con un pacto activo' };

export interface SpecialReward { kind: 'title' | 'frame'; id: string }
export interface SpecialDef {
  id: string;
  type: SpecialType;
  title: string;
  description: string;
  requiredCount: number;
  reward: SpecialReward;
  /** datos para validar: jefe y condición, clase */
  boss?: string; condition?: BossCondition; cls?: ClassId;
}
export const SPECIAL_TYPE_NAME: Record<SpecialType, string> = { boss_challenge: 'Desafíos de jefes', class_mastery: 'Pruebas de clase', collection_milestone: 'Colecciones', narrative_lore: 'Crónicas' };

// ---------- catálogo (derivado del contenido: jefes de cada zona, clases jugables, catálogos del Archivo) ----------
const BOSS_PLAN: Array<[BossCondition, SpecialReward]> = [
  ['flawless', { kind: 'frame', id: 'hueso' }], ['fast', { kind: 'title', id: 'veloz' }],
  ['pact', { kind: 'frame', id: 'raiz' }], ['flawless', { kind: 'title', id: 'intocable' }],
  ['fast', { kind: 'frame', id: 'ceniza' }], ['pact', { kind: 'title', id: 'pactista' }],
  ['flawless', { kind: 'frame', id: 'abisal' }], ['pact', { kind: 'title', id: 'cazajefes' }],
];
const bossChallenges: SpecialDef[] = ZONES.flatMap((z) => z.bosses.map((b) => b.id)).slice(0, BOSS_PLAN.length).map((boss, i) => {
  const [condition, reward] = BOSS_PLAN[i]!, name = ENEMIES[boss]?.name ?? boss;
  return { id: `boss_${boss}`, type: 'boss_challenge', title: `${name}, ${condition === 'fast' ? 'a contrarreloj' : condition === 'pact' ? 'bajo pacto' : 'sin bajas'}`, description: `Derrota a ${name} ${CONDITION_TEXT[condition]}.`, requiredCount: 1, reward, boss, condition };
});
const classTrials: SpecialDef[] = PLAYABLE.filter((c) => TITLES.some((t) => t.id === `leyenda_${c}`)).map((c) => ({
  id: `class_${c}`, type: 'class_mastery', title: `Prueba: ${CLASSES[c].name}`, description: `Gana una expedición completa con ${CLASSES[c].name} y un pacto activo.`, requiredCount: 1, reward: { kind: 'title', id: `leyenda_${c}` }, cls: c,
}));
const collections = (): SpecialDef[] => [
  { id: 'col_bestiary', type: 'collection_milestone', title: 'Bestiario completo', description: 'Descubre todas las criaturas del Bestiario.', requiredCount: completion('bestiary').total, reward: { kind: 'title', id: 'bestiario' } },
  // (id heredado de las reliquias: quien ya lo completó lo conserva; ahora cuenta las runas)
  { id: 'col_relics', type: 'collection_milestone', title: 'Todas las runas', description: 'Descubre todas las runas del Grimorio rúnico.', requiredCount: completion('runes').total, reward: { kind: 'frame', id: 'reliquia' } },
  { id: 'col_grimoire', type: 'collection_milestone', title: 'Grimorio completo', description: 'Descubre todos los hechizos y bendiciones del Grimorio.', requiredCount: completion('grimoire').total, reward: { kind: 'frame', id: 'grimorio' } },
];
const DESCENT = ['zona_1', 'zona_2', 'zona_3'];
const lore: SpecialDef[] = [
  { id: 'lore_descent', type: 'narrative_lore', title: 'Crónica del descenso', description: 'Completa las historias de las tres zonas (derrota a sus jefes).', requiredCount: DESCENT.length, reward: { kind: 'title', id: 'cronista' } },
  { id: 'lore_secrets', type: 'narrative_lore', title: 'Lo que nadie cuenta', description: 'Completa todos los secretos de las Crónicas.', requiredCount: SECRETS.length, reward: { kind: 'title', id: 'guardasecretos' } },
  { id: 'lore_all', type: 'narrative_lore', title: 'Archivero del Abismo', description: 'Completa todas las historias de las Crónicas.', requiredCount: CHRONICLES.stories.length, reward: { kind: 'title', id: 'archivero' } },
];
let cache: SpecialDef[] | null = null;
/** Todos los Contratos Especiales (se calcula una vez: los catálogos del Archivo ya están cargados). */
export const SPECIALS = (): SpecialDef[] => (cache ??= [...bossChallenges, ...classTrials, ...collections(), ...lore]);
export const specialDef = (id: string): SpecialDef | undefined => SPECIALS().find((s) => s.id === id);
export const rewardName = (r: SpecialReward): string => (r.kind === 'title' ? `Título «${titleName(r.id)}»` : frameDef(r.id)?.name ?? r.id);

const rec = (meta: Pick<Meta, 'contracts'>, id: string): SpecialRecord => {
  const b = (meta.contracts ??= emptyContracts());
  return ((b.special ??= {})[id] ??= { progress: 0, completed: false, claimed: false });
};
/** Sube el avance de un especial (nunca lo baja). Devuelve true si cambió algo. */
function advance(meta: Pick<Meta, 'contracts'>, def: SpecialDef, value: number): boolean {
  const r = rec(meta, def.id), v = Math.min(def.requiredCount, Math.floor(value));
  let changed = false;
  if (v > r.progress) { r.progress = v; changed = true; }
  if (!r.completed && r.progress >= def.requiredCount) { r.completed = true; changed = true; }
  return changed;
}

/** Acontecimientos que validan desafíos: un jefe derrotado (con sus condiciones) o una expedición ganada. */
export type SpecialEvent =
  | { t: 'boss'; boss: string; downs: number; rounds: number; pact: string | null }
  | { t: 'won'; cls: string; pact: string | null };

/** Comprueba si un jefe derrotado cumple su condición. */
export function bossConditionMet(c: BossCondition, e: Extract<SpecialEvent, { t: 'boss' }>): boolean {
  return c === 'flawless' ? e.downs === 0 : c === 'fast' ? e.rounds <= BOSS_FAST_ROUNDS : !!e.pact && PACTS.some((p) => p.id === e.pact);
}

/** Registra un acontecimiento de desafío. Idempotente: un especial completado no cambia. */
export function registerSpecial(meta: Pick<Meta, 'contracts'>, e: SpecialEvent): boolean {
  let changed = false;
  for (const d of SPECIALS()) {
    if (e.t === 'boss' && d.type === 'boss_challenge' && d.boss === e.boss && bossConditionMet(d.condition!, e)) changed = advance(meta, d, 1) || changed;
    if (e.t === 'won' && d.type === 'class_mastery' && d.cls === e.cls && !!e.pact && PACTS.some((p) => p.id === e.pact)) changed = advance(meta, d, 1) || changed;
  }
  return changed;
}

/** Recalcula colecciones y crónicas a partir del Archivo (el avance solo sube). */
export function evaluateSpecials(meta: Pick<Meta, 'contracts' | 'archive'>): boolean {
  let changed = false;
  for (const d of SPECIALS()) {
    let v = -1;
    if (d.id === 'col_bestiary') v = completion('bestiary').found;
    else if (d.id === 'col_relics') v = completion('runes').found;
    else if (d.id === 'col_grimoire') v = completion('grimoire').found;
    else if (d.id === 'lore_descent') v = DESCENT.filter((s) => chronicleState(meta, 'stories', s) === 'completed').length;
    else if (d.id === 'lore_secrets') v = SECRETS.filter((s) => chronicleState(meta, 'secrets', s.id) === 'completed').length;
    else if (d.id === 'lore_all') v = CHRONICLES.stories.filter((s) => chronicleState(meta, 'stories', s.id) === 'completed').length;
    if (v > 0) changed = advance(meta, d, v) || changed;
  }
  return changed;
}

export interface SpecialRow { def: SpecialDef; progress: number; completed: boolean; claimed: boolean }
export const specialRows = (meta: Pick<Meta, 'contracts'>): SpecialRow[] =>
  SPECIALS().map((def) => { const r = meta.contracts?.special?.[def.id]; return { def, progress: r?.progress ?? 0, completed: !!r?.completed, claimed: !!r?.claimed }; });

/**
 * Cobra la recompensa de un especial completado: añade el título o el marco una sola vez. Devuelve la recompensa o null.
 * No da ecos ni ningún efecto de juego.
 */
export function claimSpecialReward(meta: Pick<Meta, 'contracts' | 'cosmetics'>, id: string): SpecialReward | null {
  const def = specialDef(id), r = meta.contracts?.special?.[id];
  if (!def || !r || !r.completed || r.claimed) return null;
  r.claimed = true;
  const c = (meta.cosmetics ??= emptyCosmetics());
  const list = def.reward.kind === 'title' ? c.titles : c.frames;
  if (!list.includes(def.reward.id)) list.push(def.reward.id);
  return def.reward;
}

/** Equipa (o quita, con null) un título o un marco desbloqueado. Devuelve true si cambió. */
export function equipCosmetic(meta: Pick<Meta, 'cosmetics'>, kind: 'title' | 'frame', id: string | null): boolean {
  const c = (meta.cosmetics ??= emptyCosmetics());
  if (id !== null && !(kind === 'title' ? c.titles : c.frames).includes(id)) return false;
  if (c[kind] === id) return false;
  c[kind] = id;
  return true;
}
export { FRAMES, TITLES };
