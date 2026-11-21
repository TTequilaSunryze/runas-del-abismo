// Archivo del Abismo · Atlas (zonas, eventos, pactos, presagios) y Crónicas (historias, secretos, hitos de colección).
// Catálogos derivados del contenido existente; funciones de registro idempotentes sobre Meta. Sin recompensas.
import { PLAYABLE } from '../core/classes/classes';
import { OMENS } from '../content/modes';
import { PACTS } from '../content/pacts';
import { RELIC_EVENTS } from '../content/relics';
import { ENDING_LOST, ENDING_WON, ZONE_STORY, CLASS_STORY } from '../content/story';
import { ZONES } from '../content/zones';
import { CLASSES } from '../core/classes/classes';
import {
  ATLAS_STATES, CHRONICLE_STATES, MASTERED_AT, emptyArchive,
  type Archive, type AtlasCat, type AtlasEntryRecord, type AtlasState, type ChronicleCat, type ChronicleEntryRecord,
} from './archiveData';
import type { Meta } from './meta';

export interface AtlasRef { id: string; cat: AtlasCat; name: string; icon: string; text: string; zone?: number }
const zoneId = (i: number): string => `z${i + 1}`;

/** Zonas (4), eventos de grupo (los de cada zona y los de reliquia), pactos y presagios del juego. */
export const ATLAS: Record<AtlasCat, AtlasRef[]> = {
  zones: ZONES.map((z, i) => ({ id: zoneId(i), cat: 'zones', name: z.name, icon: ['🦴', '🌲', '🔥', '🕳️'][i] ?? '🗺️', text: ZONE_STORY[i] ?? z.intro, zone: i + 1 })),
  events: [...ZONES.flatMap((z, i) => z.events.map((e) => ({ e, zone: i + 1 }))), ...RELIC_EVENTS.map((e) => ({ e, zone: 0 }))]
    .map(({ e, zone }): AtlasRef => ({ id: e.id, cat: 'events', name: e.title, icon: '❓', text: e.text, ...(zone ? { zone } : {}) })),
  pacts: PACTS.map((p) => ({ id: p.id, cat: 'pacts', name: p.name, icon: p.icon, text: `${p.boon} · ${p.bane}` })),
  omens: OMENS.map((o) => ({ id: o.id, cat: 'omens', name: o.name, icon: o.icon, text: o.text })),
};
export const ATLAS_NAME: Record<AtlasCat, string> = { zones: 'Zonas', events: 'Eventos', pacts: 'Pactos', omens: 'Presagios' };
export const ATLAS_STATE_NAME: Record<AtlasState, string> = { unlocked: 'Desbloqueado', explored: 'Explorado', mastered: 'Dominado' };
/** Qué significa «completar» una entrada, por categoría (para mostrarlo en las fichas). */
export const ATLAS_DONE_TEXT: Record<AtlasCat, string> = {
  zones: 'derrotar a su jefe', events: 'resolver el evento', pacts: 'derrotar a un jefe con el pacto activo', omens: 'ganar un combate bajo el presagio',
};

export type ChronicleRef = { id: string; cat: ChronicleCat; name: string; text: string; goal: number; hint?: string };
export const MILESTONE_PCTS = [25, 50, 75, 100];
export const MILESTONE_CATS = ['bestiary', 'grimoire', 'relics'] as const;
const CAT_LABEL = { bestiary: 'el Bestiario', grimoire: 'el Grimorio', relics: 'las Reliquias' };

/** Secretos de combate: su condición no se muestra hasta que se cumplen. */
export const SECRETS: ChronicleRef[] = [
  { id: 'intocables', cat: 'secrets', name: 'Intocables', goal: 1, text: 'Ganar un combate de élite o de jefe sin que caiga ningún héroe.', hint: 'Hay quien pelea contra lo peor sin una sola baja.' },
  { id: 'relampago', cat: 'secrets', name: 'Relámpago', goal: 1, text: 'Ganar un combate en 3 rondas o menos.', hint: 'Lo rápido también deja huella.' },
  { id: 'al_limite', cat: 'secrets', name: 'Al límite', goal: 1, text: 'Ganar un combate en el que un héroe tuyo llegue a tener menos del 10% de vida y siga en pie al final.', hint: 'A veces basta con seguir en pie.' },
];
export const RELAMPAGO_ROUNDS = 3;
export const LIMITE_PCT = 10;

export const CHRONICLES: Record<ChronicleCat, ChronicleRef[]> = {
  stories: [
    ...ZONES.map((z, i): ChronicleRef => ({ id: `zona_${i + 1}`, cat: 'stories', name: z.name, goal: 2, text: ZONE_STORY[i] ?? z.intro })),
    ...PLAYABLE.map((c): ChronicleRef => ({ id: `clase_${c}`, cat: 'stories', name: CLASSES[c].name, goal: 2, text: CLASS_STORY[c] ?? '' })),
    { id: 'final_victoria', cat: 'stories', name: 'La última runa', goal: 1, text: ENDING_WON },
    { id: 'final_derrota', cat: 'stories', name: 'El Abismo os recuerda', goal: 1, text: ENDING_LOST },
  ],
  secrets: SECRETS,
  milestones: MILESTONE_CATS.flatMap((c) => MILESTONE_PCTS.map((p): ChronicleRef => ({ id: `${c}_${p}`, cat: 'milestones', name: `${p}% de ${CAT_LABEL[c]}`, goal: p, text: `Descubre el ${p}% de ${CAT_LABEL[c]}.` }))),
};
export const CHRONICLE_NAME: Record<ChronicleCat, string> = { stories: 'Historias', secrets: 'Secretos', milestones: 'Hitos' };
export const CHRONICLE_STATE_NAME = { locked: 'Bloqueada', discovered: 'Descubierta', completed: 'Completada' } as const;
export const chronicleRef = (cat: ChronicleCat, id: string): ChronicleRef | undefined => CHRONICLES[cat].find((c) => c.id === id);

const ensure = (m: Pick<Meta, 'archive'>): Archive => (m.archive ??= emptyArchive());

/**
 * Registra un encuentro o un avance del Atlas. `initialState` es el estado al que se lleva la entrada (nunca se baja):
 * - `unlocked`: la has encontrado → cuenta un encuentro.
 * - `explored`: la has completado → cuenta una compleción (y, si era nueva, también el encuentro). A las MASTERED_AT compleciones pasa a `mastered`.
 * - `mastered`: la marca como dominada directamente.
 * Con `key` (p. ej. código de partida + sala), llamarla otra vez con la misma clave no cuenta nada más: es idempotente.
 * Ids que no existen en el catálogo se ignoran. Devuelve true si cambió algo.
 */
export function registerAtlasDiscovery(meta: Pick<Meta, 'archive'>, category: AtlasCat, id: string, initialState: AtlasState = 'unlocked', key?: string): boolean {
  if (!ATLAS[category]?.some((r) => r.id === id)) return false;
  const rec = ensure(meta).atlas[category];
  let e = rec[id], changed = false;
  if (!e) { e = rec[id] = { state: 'unlocked', encounters: 0, completions: 0 }; changed = true; }
  if (initialState === 'unlocked' || !e.encounters) {
    if (key === undefined || e.lastSeen !== key) { e.encounters++; if (key !== undefined) e.lastSeen = key; changed = true; }
  }
  if (initialState === 'explored' && (key === undefined || e.lastDone !== key)) { e.completions++; if (key !== undefined) e.lastDone = key; changed = true; }
  const want = initialState === 'mastered' || e.completions >= MASTERED_AT ? 'mastered' : initialState === 'explored' || e.completions > 0 ? 'explored' : 'unlocked';
  if (ATLAS_STATES.indexOf(want) > ATLAS_STATES.indexOf(e.state)) { e.state = want; changed = true; }
  return changed;
}

/**
 * Registra avance narrativo, de un secreto o de un hito. `targetValue` es el valor alcanzado (se guarda el máximo y nunca baja).
 * Con avance > 0 la entrada queda `discovered`; al llegar al objetivo de la entrada, `completed`. Los secretos (objetivo 1) se completan con un solo cumplimiento. `key` es opcional (guarda la clave del último avance). Solo se escribe si hay avance real, así que repetir la llamada no cambia nada. Idempotente.
 */
export function registerChronicleProgress(meta: Pick<Meta, 'archive'>, category: ChronicleCat, id: string, targetValue: number, key?: string): boolean {
  const ref = chronicleRef(category, id);
  if (!ref || !(targetValue > 0)) return false;
  const rec = ensure(meta).chronicles[category];
  let e: ChronicleEntryRecord | undefined = rec[id], changed = false;
  if (!e) { e = rec[id] = { state: 'discovered', progress: 0 }; changed = true; }
  const v = Math.floor(targetValue);
  // solo se escribe cuando hay avance real: repetir un valor igual o menor (con cualquier clave) no toca nada
  if (v > e.progress) { e.progress = v; if (key !== undefined) e.last = key; changed = true; }
  const want = e.progress >= ref.goal ? 'completed' : 'discovered';
  if (CHRONICLE_STATES.indexOf(want) > CHRONICLE_STATES.indexOf(e.state)) { e.state = want; changed = true; }
  return changed;
}

export const atlasEntry = (meta: Pick<Meta, 'archive'>, cat: AtlasCat, id: string): AtlasEntryRecord | undefined => meta.archive?.atlas[cat][id];
export const chronicleEntry = (meta: Pick<Meta, 'archive'>, cat: ChronicleCat, id: string): ChronicleEntryRecord | undefined => meta.archive?.chronicles[cat][id];
export const chronicleState = (meta: Pick<Meta, 'archive'>, cat: ChronicleCat, id: string) => chronicleEntry(meta, cat, id)?.state ?? 'locked';
export const atlasProgress = (meta: Pick<Meta, 'archive'>, cat: AtlasCat): { found: number; total: number; pct: number } => {
  const total = ATLAS[cat].length, found = ATLAS[cat].filter((r) => !!meta.archive?.atlas[cat][r.id]).length;
  return { found, total, pct: total ? Math.round((found / total) * 100) : 0 };
};
export const chronicleProgress = (meta: Pick<Meta, 'archive'>, cat: ChronicleCat): { found: number; total: number; pct: number } => {
  const total = CHRONICLES[cat].length, found = CHRONICLES[cat].filter((r) => chronicleState(meta, cat, r.id) === 'completed').length;
  return { found, total, pct: total ? Math.round((found / total) * 100) : 0 };
};
