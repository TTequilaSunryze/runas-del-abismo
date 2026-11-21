// Apariencia de cada jugador en combate (variante de color y aura). Llega por la presencia de la sala, no por la partida:
// así el estado autoritativo (RunState) no cambia y un cosmético nunca puede afectar al juego.
import { auraDef, paletteDef } from './palettes';
import { EMBLEMS } from '../game/cosmetics';

export interface Look {
  /** clase para la que vale la variante (la del héroe que lleva el jugador) */
  cls?: string;
  /** id de paleta (PALETTES) */
  skin?: string;
  /** id de aura (AURAS) */
  aura?: string;
  /** emblema (emoji del catálogo) */
  emblem?: string;
}
const looks = new Map<string, Look>();

/** Sanea lo que llega de otros jugadores: solo ids que existen. */
export function cleanLook(x: unknown): Look {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length <= 24 ? v : undefined);
  const skin = str(o.skin), aura = str(o.aura), emblem = str(o.emblem);
  return {
    cls: str(o.cls),
    ...(paletteDef(skin) ? { skin } : {}), ...(auraDef(aura) ? { aura } : {}), ...(emblem && EMBLEMS.includes(emblem) ? { emblem } : {}),
  };
}
export function setLooks(list: Array<[string, Look]>): void { looks.clear(); for (const [id, l] of list) looks.set(id, l); }
export const lookOf = (owner: string | null | undefined): Look | undefined => (owner ? looks.get(owner) : undefined);
