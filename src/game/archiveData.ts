// Archivo del Abismo · modelo de datos persistente (sin dependencias del contenido, para que Meta pueda importarlo).
// Vive en Meta.archive (campo opcional: las Meta antiguas simplemente no lo tienen y se completan al cargar).

export type ArchiveCat = 'bestiary' | 'grimoire' | 'relics';

/** Niveles de descubrimiento. 0 = desconocido en todas las categorías. */
export const LV = {
  /** Bestiario: aparece en una partida tuya. Grimorio: lo tienes. Reliquias: la has encontrado. */
  found: 1,
  /** Bestiario: derrotado al menos una vez. Grimorio: lanzado en combate. */
  studied: 2,
  /** Bestiario: derrotado `DOCUMENTED_KILLS` veces. */
  documented: 3,
} as const;
/** Nivel máximo de cada categoría (el Grimorio llega a «Utilizado»; las Reliquias, a «Descubierta»). */
export const MAX_LV: Record<ArchiveCat, number> = { bestiary: 3, grimoire: 2, relics: 1 };
export const DOCUMENTED_KILLS = 5;

export interface ArchiveEntry {
  /** nivel de descubrimiento (ver LV) */
  lv: number;
  /** veces que apareció / se obtuvo (una por combate o por partida) */
  seen: number;
  /** bestiario: veces derrotado · grimorio: veces lanzado */
  n: number;
}

// ---------- Atlas y Crónicas (Fase B) ----------
export type AtlasCat = 'zones' | 'events' | 'pacts' | 'omens';
export type AtlasState = 'unlocked' | 'explored' | 'mastered';
export const ATLAS_STATES: AtlasState[] = ['unlocked', 'explored', 'mastered'];
export type ChronicleCat = 'stories' | 'secrets' | 'milestones';
/** `locked` es el estado de lo que no tiene registro: no se guarda. */
export type ChronicleState = 'locked' | 'discovered' | 'completed';
export const CHRONICLE_STATES: ChronicleState[] = ['locked', 'discovered', 'completed'];
/** Veces que hay que completar una entrada del Atlas para dominarla. */
export const MASTERED_AT = 3;

export interface AtlasEntryRecord {
  state: AtlasState;
  /** veces que se ha encontrado (una por expedición, sala o combate: ver `key`) */
  encounters: number;
  /** veces que se ha completado (jefe derrotado, evento resuelto, combate ganado con ello activo) */
  completions: number;
  /** claves del último encuentro y de la última compleción: con la misma clave no se vuelve a contar */
  lastSeen?: string;
  lastDone?: string;
}
export interface ChronicleEntryRecord {
  state: ChronicleState;
  /** avance hacia el objetivo de la entrada (se guarda el máximo alcanzado) */
  progress: number;
  last?: string;
}
export const ATLAS_CATS: AtlasCat[] = ['zones', 'events', 'pacts', 'omens'];
export const CHRONICLE_CATS: ChronicleCat[] = ['stories', 'secrets', 'milestones'];

export interface Archive {
  v: 1;
  bestiary: Record<string, ArchiveEntry>;
  grimoire: Record<string, ArchiveEntry>;
  relics: Record<string, ArchiveEntry>;
  atlas: Record<AtlasCat, Record<string, AtlasEntryRecord>>;
  chronicles: Record<ChronicleCat, Record<string, ChronicleEntryRecord>>;
  /** combate en curso: evita contar dos veces lo mismo si el estado se repite o se recarga la página */
  cur: { k: string; seen: string[]; dead: number[]; done?: boolean; down?: number; low?: number } | null;
  /** el Archivo se sembró ya con los datos antiguos del Salón */
  seeded: boolean;
}

export const emptyArchive = (): Archive => ({
  v: 1, bestiary: {}, grimoire: {}, relics: {},
  atlas: { zones: {}, events: {}, pacts: {}, omens: {} }, chronicles: { stories: {}, secrets: {}, milestones: {} },
  cur: null, seeded: false,
});

const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Math.max(0, Math.floor(Number(x))) : 0);
const entry = (e: Partial<ArchiveEntry> | undefined, max: number): ArchiveEntry => ({ lv: Math.min(max, num(e?.lv)), seen: num(e?.seen), n: num(e?.n) });

/** Valida lo que llega del almacenamiento o de la nube (puede venir de una versión antigua o estar incompleto). */
export function normalizeArchive(a: unknown): Archive {
  const src = (a && typeof a === 'object' ? a : {}) as Partial<Archive>;
  const out = emptyArchive();
  for (const cat of ['bestiary', 'grimoire', 'relics'] as const) {
    const rec = (src[cat] && typeof src[cat] === 'object' ? src[cat] : {}) as Record<string, Partial<ArchiveEntry>>;
    for (const [id, e] of Object.entries(rec)) { const x = entry(e, MAX_LV[cat]); if (x.lv > 0) out[cat][id] = x; }
  }
  for (const cat of ATLAS_CATS) {
    const rec = (src.atlas?.[cat] && typeof src.atlas[cat] === 'object' ? src.atlas[cat] : {}) as Record<string, Partial<AtlasEntryRecord>>;
    for (const [id, e] of Object.entries(rec)) {
      if (!e || !ATLAS_STATES.includes(e.state as AtlasState)) continue;
      out.atlas[cat][id] = { state: e.state as AtlasState, encounters: num(e.encounters), completions: num(e.completions), ...(typeof e.lastSeen === 'string' ? { lastSeen: e.lastSeen.slice(0, 80) } : {}), ...(typeof e.lastDone === 'string' ? { lastDone: e.lastDone.slice(0, 80) } : {}) };
    }
  }
  for (const cat of CHRONICLE_CATS) {
    const rec = (src.chronicles?.[cat] && typeof src.chronicles[cat] === 'object' ? src.chronicles[cat] : {}) as Record<string, Partial<ChronicleEntryRecord>>;
    for (const [id, e] of Object.entries(rec)) {
      if (!e || !CHRONICLE_STATES.includes(e.state as ChronicleState) || e.state === 'locked') continue;
      out.chronicles[cat][id] = { state: e.state as ChronicleState, progress: num(e.progress), ...(typeof e.last === 'string' ? { last: e.last.slice(0, 80) } : {}) };
    }
  }
  const c = src.cur;
  out.cur = c && typeof c.k === 'string' ? { k: c.k.slice(0, 80), seen: (Array.isArray(c.seen) ? c.seen : []).map(String).slice(0, 40), dead: (Array.isArray(c.dead) ? c.dead : []).map(num).slice(0, 80), done: !!c.done, down: num(c.down), low: c.low === undefined ? undefined : Math.min(100, num(c.low)) } : null;
  out.seeded = !!src.seeded;
  return out;
}

/** Une dos archivos sin perder nada: el mayor nivel y el mayor contador de cada entrada. */
export function mergeArchive(a: unknown, b: unknown): Archive {
  const x = normalizeArchive(a), y = normalizeArchive(b), out = emptyArchive();
  for (const cat of ['bestiary', 'grimoire', 'relics'] as const) {
    for (const id of new Set([...Object.keys(x[cat]), ...Object.keys(y[cat])])) {
      const p = x[cat][id], q = y[cat][id];
      out[cat][id] = { lv: Math.max(p?.lv ?? 0, q?.lv ?? 0), seen: Math.max(p?.seen ?? 0, q?.seen ?? 0), n: Math.max(p?.n ?? 0, q?.n ?? 0) };
    }
  }
  for (const cat of ATLAS_CATS) {
    for (const id of new Set([...Object.keys(x.atlas[cat]), ...Object.keys(y.atlas[cat])])) {
      const p = x.atlas[cat][id], q = y.atlas[cat][id];
      const state = ATLAS_STATES[Math.max(p ? ATLAS_STATES.indexOf(p.state) : -1, q ? ATLAS_STATES.indexOf(q.state) : -1)]!;
      out.atlas[cat][id] = { state, encounters: Math.max(p?.encounters ?? 0, q?.encounters ?? 0), completions: Math.max(p?.completions ?? 0, q?.completions ?? 0), lastSeen: p?.lastSeen ?? q?.lastSeen, lastDone: p?.lastDone ?? q?.lastDone };
    }
  }
  for (const cat of CHRONICLE_CATS) {
    for (const id of new Set([...Object.keys(x.chronicles[cat]), ...Object.keys(y.chronicles[cat])])) {
      const p = x.chronicles[cat][id], q = y.chronicles[cat][id];
      const state = CHRONICLE_STATES[Math.max(p ? CHRONICLE_STATES.indexOf(p.state) : 0, q ? CHRONICLE_STATES.indexOf(q.state) : 0)]!;
      out.chronicles[cat][id] = { state, progress: Math.max(p?.progress ?? 0, q?.progress ?? 0), last: p?.last ?? q?.last };
    }
  }
  out.cur = x.cur ?? y.cur;
  out.seeded = x.seeded || y.seeded;
  return out;
}

/** Sube el nivel de una entrada (nunca lo baja). Devuelve true si algo cambió. `inc` suma al contador `n`. */
export function raise(arc: Archive, cat: ArchiveCat, id: string, lv: number, inc: { seen?: number; n?: number } = {}): boolean {
  const e = (arc[cat][id] ??= { lv: 0, seen: 0, n: 0 });
  const next = Math.min(MAX_LV[cat], Math.max(e.lv, lv));
  const changed = next !== e.lv || !!inc.seen || !!inc.n;
  e.lv = next; e.seen += inc.seen ?? 0; e.n += inc.n ?? 0;
  if (e.lv <= 0) delete arc[cat][id];
  return changed;
}

export const levelOf = (arc: Archive, cat: ArchiveCat, id: string): number => arc[cat][id]?.lv ?? 0;
export const isDiscovered = (arc: Archive, cat: ArchiveCat, id: string): boolean => levelOf(arc, cat, id) > 0;
