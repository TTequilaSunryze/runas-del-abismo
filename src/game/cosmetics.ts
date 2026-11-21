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
];
export const FRAMES: FrameDef[] = [
  { id: 'hueso', name: 'Marco de hueso', color: '#d8d0b8' },
  { id: 'raiz', name: 'Marco de raíz', color: '#5fa04e' },
  { id: 'ceniza', name: 'Marco de ceniza', color: '#e0723a' },
  { id: 'abisal', name: 'Marco abisal', color: '#9b5cff' },
  { id: 'reliquia', name: 'Marco de reliquias', color: '#f2c14e' },
  { id: 'grimorio', name: 'Marco del grimorio', color: '#5cc8ff' },
];
export const titleName = (id: string | null | undefined): string => TITLES.find((t) => t.id === id)?.name ?? '';
export const frameDef = (id: string | null | undefined): FrameDef | undefined => FRAMES.find((f) => f.id === id);
export const validTitle = (id: unknown): string | undefined => (typeof id === 'string' && TITLES.some((t) => t.id === id) ? id : undefined);
export const validFrame = (id: unknown): string | undefined => (typeof id === 'string' && FRAMES.some((f) => f.id === id) ? id : undefined);

/** Lo desbloqueado y lo que lleva puesto el jugador. */
export interface Cosmetics { v: 1; titles: string[]; frames: string[]; title: string | null; frame: string | null }
export const emptyCosmetics = (): Cosmetics => ({ v: 1, titles: [], frames: [], title: null, frame: null });

export function normalizeCosmetics(x: unknown): Cosmetics {
  const s = (x && typeof x === 'object' ? x : {}) as Partial<Cosmetics>;
  const titles = [...new Set((Array.isArray(s.titles) ? s.titles : []).map(validTitle).filter((t): t is string => !!t))];
  const frames = [...new Set((Array.isArray(s.frames) ? s.frames : []).map(validFrame).filter((f): f is string => !!f))];
  return { v: 1, titles, frames, title: titles.includes(s.title as string) ? (s.title as string) : null, frame: frames.includes(s.frame as string) ? (s.frame as string) : null };
}
/** Unión: lo desbloqueado en cualquiera se conserva; lo equipado, el del primero si sigue siendo válido. */
export function mergeCosmetics(a: unknown, b: unknown): Cosmetics {
  const x = normalizeCosmetics(a), y = normalizeCosmetics(b);
  const titles = [...new Set([...x.titles, ...y.titles])], frames = [...new Set([...x.frames, ...y.frames])];
  return { v: 1, titles, frames, title: x.title ?? y.title, frame: x.frame ?? y.frame };
}
