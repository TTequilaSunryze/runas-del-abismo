// Títulos y marcos: recompensas puramente visuales de los Contratos Especiales. Sin efecto en combate ni estadísticas.
// Sin dependencias del contenido, para que Meta y la validación de héroes del Salón puedan usarlo.

export interface TitleDef { id: string; name: string }
export interface FrameDef { id: string; name: string; color: string }

export const TITLES: TitleDef[] = [
  { id: 'cazajefes', name: 'Cazajefes' },
  { id: 'intocable', name: 'el Intocable' },
  { id: 'veloz', name: 'Relámpago del Osario' },
  { id: 'pactista', name: 'Señor de los Pactos' },
  { id: 'leyenda_zorro', name: 'Leyenda de las Nueve Colas' },
  { id: 'leyenda_esferas', name: 'Leyenda de las Esferas' },
  { id: 'leyenda_acechador', name: 'Leyenda de las Sombras' },
  { id: 'leyenda_carcelero', name: 'Leyenda de la Linterna' },
  { id: 'leyenda_barbaro', name: 'Leyenda de la Furia' },
  { id: 'leyenda_arquitecto', name: 'Leyenda de las Runas' },
  { id: 'leyenda_pistolero', name: 'Leyenda del Gatillo' },
  { id: 'leyenda_arquero', name: 'Leyenda del Arco' },
  { id: 'bestiario', name: 'Bestiólogo' },
  { id: 'archivero', name: 'Archivero del Abismo' },
  { id: 'cronista', name: 'Cronista del Descenso' },
  { id: 'guardasecretos', name: 'Guardasecretos' },
  // Fase F: títulos de la tienda
  { id: 'aventurero', name: 'Aventurero' },
  { id: 'saqueador', name: 'Saqueador de tumbas' },
  { id: 'explorador', name: 'Explorador del Osario' },
  { id: 'rompepactos', name: 'Rompepactos' },
  { id: 'heraldo', name: 'Heraldo del Abismo' },
  { id: 'domador', name: 'Domador del Abismo' },
];
export const FRAMES: FrameDef[] = [
  { id: 'hueso', name: 'Marco de hueso', color: '#d8d0b8' },
  { id: 'raiz', name: 'Marco de raíz', color: '#5fa04e' },
  { id: 'ceniza', name: 'Marco de ceniza', color: '#e0723a' },
  { id: 'abisal', name: 'Marco abisal', color: '#9b5cff' },
  { id: 'reliquia', name: 'Marco rúnico', color: '#f2c14e' },
  { id: 'grimorio', name: 'Marco del grimorio', color: '#5cc8ff' },
  // Fase F: marcos de la tienda
  { id: 'cobre', name: 'Marco de cobre', color: '#c07a4a' },
  { id: 'plata', name: 'Marco de plata', color: '#c8d0dc' },
  { id: 'obsidiana', name: 'Marco de obsidiana', color: '#6a5a8a' },
  { id: 'aurora', name: 'Marco de aurora', color: '#7affc8' },
];
/** Emojis que pueden ser emblema (los del catálogo de la tienda): sirve para validar lo que llega de otros jugadores. */
export const EMBLEMS = ['💀', '🕯️', '⚔️', '🌙', '🐉', '👁️', '🏆', '👑'];
export const validEmblem = (e: unknown): string | undefined => (typeof e === 'string' && EMBLEMS.includes(e) ? e : undefined);
export const titleName = (id: string | null | undefined): string => TITLES.find((t) => t.id === id)?.name ?? '';
export const frameDef = (id: string | null | undefined): FrameDef | undefined => FRAMES.find((f) => f.id === id);
export const validTitle = (id: unknown): string | undefined => (typeof id === 'string' && TITLES.some((t) => t.id === id) ? id : undefined);
export const validFrame = (id: unknown): string | undefined => (typeof id === 'string' && FRAMES.some((f) => f.id === id) ? id : undefined);

/** Un conjunto visual guardado para una clase (variante de color, aura y emblema). */
export interface Loadout { name: string; skin: string | null; aura: string | null; emblem: string | null }
export const LOADOUT_MAX = 3;
/** Ranuras equipables además de título y marco (valores: ids del catálogo de la tienda). */
export type Slot = 'emblem' | 'aura' | 'theme' | 'card' | 'bg' | 'deco';
export const SLOTS: Slot[] = ['emblem', 'aura', 'theme', 'card', 'bg', 'deco'];

/** Lo desbloqueado y lo que lleva puesto el jugador (títulos y marcos desde la Fase D; el resto desde la Fase F). */
export interface Cosmetics {
  v: 1; titles: string[]; frames: string[]; title: string | null; frame: string | null;
  /** ids del catálogo comprados o desbloqueados (excepto títulos y marcos, que van en sus listas) */
  owned?: string[];
  /** lo equipado en cada ranura (id del catálogo) */
  eq?: Partial<Record<Slot, string | null>>;
  /** variante de color equipada por clase (id del catálogo) */
  skins?: Record<string, string | null>;
  /** conjuntos guardados por clase */
  loadouts?: Record<string, Loadout[]>;
  /** elementos que el jugador ya ha visto en la tienda (lo demás desbloqueado se marca como nuevo) */
  seen?: string[];
  /** compras: id → ecos pagados. Sirve para fusionar dispositivos sin devolver ni regalar ecos. */
  spent?: Record<string, number>;
}
export const emptyCosmetics = (): Cosmetics => ({ v: 1, titles: [], frames: [], title: null, frame: null, owned: [], eq: {}, skins: {}, loadouts: {}, seen: [], spent: {} });

const idList = (x: unknown, max = 400): string[] => [...new Set((Array.isArray(x) ? x : []).filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 48))].slice(0, max);
const idOrNull = (x: unknown): string | null => (typeof x === 'string' && x.length > 0 && x.length <= 48 ? x : null);
function cleanRecord<T>(x: unknown, fn: (v: unknown) => T | undefined, max = 40): Record<string, T> {
  const out: Record<string, T> = {};
  if (!x || typeof x !== 'object') return out;
  for (const [k, v] of Object.entries(x as Record<string, unknown>).slice(0, max)) { const r = fn(v); if (r !== undefined && k.length <= 48) out[k] = r; }
  return out;
}
const cleanLoadouts = (v: unknown): Loadout[] | undefined => (Array.isArray(v) ? v.slice(0, LOADOUT_MAX).map((l) => {
  const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
  return { name: typeof o.name === 'string' ? o.name.slice(0, 20) : 'Kit', skin: idOrNull(o.skin), aura: idOrNull(o.aura), emblem: idOrNull(o.emblem) };
}) : undefined);

export function normalizeCosmetics(x: unknown): Cosmetics {
  const s = (x && typeof x === 'object' ? x : {}) as Partial<Cosmetics>;
  const titles = [...new Set((Array.isArray(s.titles) ? s.titles : []).map(validTitle).filter((t): t is string => !!t))];
  const frames = [...new Set((Array.isArray(s.frames) ? s.frames : []).map(validFrame).filter((f): f is string => !!f))];
  const owned = idList(s.owned);
  const eq: Partial<Record<Slot, string | null>> = {};
  for (const k of SLOTS) { const v = idOrNull(s.eq?.[k]); if (v && owned.includes(v)) eq[k] = v; }
  return {
    v: 1, titles, frames, title: titles.includes(s.title as string) ? (s.title as string) : null, frame: frames.includes(s.frame as string) ? (s.frame as string) : null,
    owned, eq,
    skins: cleanRecord(s.skins, (v) => { const id = idOrNull(v); return id && owned.includes(id) ? id : undefined; }),
    loadouts: cleanRecord(s.loadouts, cleanLoadouts),
    seen: idList(s.seen, 600),
    spent: cleanRecord(s.spent, (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(100000, Math.floor(Number(v))) : undefined), 400),
  };
}
/** Unión: lo desbloqueado y comprado en cualquiera se conserva (sin duplicar); lo equipado, el del primero. */
export function mergeCosmetics(a: unknown, b: unknown): Cosmetics {
  const x = normalizeCosmetics(a), y = normalizeCosmetics(b);
  const titles = [...new Set([...x.titles, ...y.titles])], frames = [...new Set([...x.frames, ...y.frames])];
  const spent: Record<string, number> = { ...y.spent };
  for (const [k, v] of Object.entries(x.spent ?? {})) spent[k] = Math.max(v, spent[k] ?? 0);
  return {
    v: 1, titles, frames, title: x.title ?? y.title, frame: x.frame ?? y.frame,
    owned: [...new Set([...(x.owned ?? []), ...(y.owned ?? [])])], eq: { ...y.eq, ...x.eq }, skins: { ...y.skins, ...x.skins },
    loadouts: { ...y.loadouts, ...x.loadouts }, seen: [...new Set([...(x.seen ?? []), ...(y.seen ?? [])])], spent,
  };
}
/** Ecos gastados en la tienda según el registro de compras. */
export const spentTotal = (c: Pick<Cosmetics, 'spent'> | undefined): number => Object.values(c?.spent ?? {}).reduce((n, v) => n + v, 0);
