import { STATUSES } from '../core/statuses';
import { FEATURES, schoolOf } from '../core/tuning';
import { SPELLS } from '../core/classes/spells';
// Tablero de combate: dibuja el estado y convierte clics en acciones.
import { ZONES } from '../content/zones';
import { animMul } from '../content/animSpeed';
import { CRIT_FLAT, castProblem, current, essenceNeed, furyCrit, furyPower, implodePreview, movePreview, seedLinks, spellOf, usableMp } from '../core/combat/engine';
import { coneCells } from '../core/combat/marks';
import { alive, dist, hasLineOfSight, reachable } from '../core/combat/grid';
import type { CombatState, GameEvent, Pos, Unit } from '../core/state';
import type { Session } from '../game/session';
import { PLAYER_COLORS, drawUnit, isModel, lookKind } from './sprites';
import { lookOf } from './looks';
import { auraDef, drawAura } from './palettes';
import { STATUS_ART, iconUrl } from '../ui/gameicons';

/** Iconos de estado (se cargan una vez; mientras tanto, el cuadradito de color). */
const statusImg = new Map<string, HTMLImageElement>();
function statusIcon(k: string): HTMLImageElement | null {
  const name = STATUS_ART[k];
  if (!name || typeof Image === 'undefined') return null;
  let im = statusImg.get(name);
  if (!im) { im = new Image(); im.src = iconUrl(name); statusImg.set(name, im); }
  return im.complete && im.naturalWidth ? im : null;
}
import { ANIM_FRAMES, animFor, type Anim } from './models';
import { FxLayer, fxCells, recipeFor } from './fx';

const TILE = 56;
/** margen superior: los muros y los personajes sobresalen por arriba de su casilla */
const PAD = 42;

// ---------- vista isométrica (prototipo) ----------
// La lógica sigue en casillas. Solo cambia la proyección: el suelo se dibuja con una transformación afín
// (cada casilla cuadrada se convierte en un rombo 2:1) y lo que está «de pie» (personajes, pilares, textos)
// se dibuja sin deformar, anclado al centro de su rombo.
/** ancho y alto del rombo de una casilla */
export const ISO_W = 128, ISO_H = 64;
/** margen a los lados del lienzo (los muros del fondo sobresalen del tablero) */
const ISO_SIDE = 72;
/** espacio por encima del rombo más alto, para muros y personajes */
const ISO_PAD = 250;
/** margen inferior */
const ISO_BOTTOM = 24;
/** escala de lo que está de pie respecto a la vista plana */
const ISO_UP = 1.6;
/** el pie de los personajes queda un poco por debajo del centro del rombo */
const ISO_FOOT = ISO_H * 0.18;
const ISO_KEY = 'runas.iso';
const isoPref = (): boolean => { try { return localStorage.getItem(ISO_KEY) !== '0'; } catch { return true; } };
/** Tamaño del lienzo isométrico para un mapa de w×h casillas. */
export const isoSize = (w: number, h: number): { w: number; h: number } => ({ w: ((w + h) * ISO_W) / 2 + ISO_SIDE * 2, h: ((w + h) * ISO_H) / 2 + ISO_PAD + ISO_BOTTOM });
/** Casilla → punto de pantalla (centro del rombo), en un mapa de h filas. Coordenadas de casilla con decimales. */
export function isoPoint(x: number, y: number, h: number): { x: number; y: number } {
  return { x: ISO_SIDE + (h * ISO_W) / 2 + ((x - y) * ISO_W) / 2, y: ISO_PAD + ((x + y) * ISO_H) / 2 };
}
/** Punto de pantalla → casilla (la inversa de isoPoint, sin redondear). */
export function isoCell(sx: number, sy: number, h: number): { x: number; y: number } {
  const u = (sx - ISO_SIDE - (h * ISO_W) / 2) / (ISO_W / 2), v = (sy - ISO_PAD) / (ISO_H / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/** Arte ilustrado de la zona 1 (Catacumbas): losas (hoja 4×4 de 64 px) y pilar. Si aún no ha cargado, se dibuja lo de siempre. */
const art = (src: string): HTMLImageElement | null => { if (typeof Image === 'undefined') return null; const i = new Image(); i.src = `${import.meta.env.BASE_URL}${src}`; return i; };
const Z1 = { floor: art('tiles/z1_floor.png'), pillar: art('tiles/z1_pillar.png') };
const ready = (i: HTMLImageElement | null): i is HTMLImageElement => !!i && i.complete && i.naturalWidth > 0;
/** Arte isométrico de la zona 1 (lote 1): pilares de 256 px de ancho con la base en el borde inferior. */
/**
 * «Stone Crypt FREE» (dotplays): suelos, muros, puertas, antorchas y objetos en la rejilla 2:1 de 128×64 (la del tablero).
 * Punto de apoyo de muros y objetos: centro de abajo de la imagen, sobre el punto (x + ancho, y + fondo) de su huella.
 * Ya vienen oscurecidas (tools/arte).
 */
const cr = (id: string): HTMLImageElement | null => art(`iso/crypt/${id}.png`);
const CRYPT = {
  flag: cr('floor_flag'), cracked: cr('floor_cracked'), moss: cr('floor_moss'), broken: cr('floor_broken'),
  // transiciones (autotile por esquinas): índice = máscara N=1 E=2 S=4 O=8
  flagMoss: [null, ...Array.from({ length: 14 }, (_, i) => cr(`floor_flag_moss_${String(i + 1).padStart(2, '0')}`))],
  flagBroken: [null, ...Array.from({ length: 14 }, (_, i) => cr(`floor_flag_broken_${String(i + 1).padStart(2, '0')}`))],
  decals: ['decal_blood', 'decal_cracks', 'decal_debris', 'decal_moss'].map(cr),
  wallX: cr('wall_tall_x'), wallY: cr('wall_tall_y'), doorwayX: cr('wall_doorway_x'), doorwayY: cr('wall_doorway_y'),
  doorClosedX: cr('door_closed_x'), doorClosedY: cr('door_closed_y'), doorOpenX: cr('door_open_x'), doorOpenY: cr('door_open_y'), corner: cr('corner_tall'),
  torch: cr('wall_torch'), brazier: cr('brazier'), spikes: cr('spike_trap_up'), flame: cr('fx_flame'),
  barrel: cr('barrel'), crates: cr('crates'), sacks: cr('sacks'), rubble: cr('rubble'), stalagmites: cr('stalagmites'), table: cr('table'), bones: cr('bone_pile'),
};
const cryptReady = (): boolean => [CRYPT.flag, CRYPT.cracked, CRYPT.moss, CRYPT.broken, ...CRYPT.flagMoss.slice(1), ...CRYPT.flagBroken.slice(1), CRYPT.wallX, CRYPT.wallY, CRYPT.corner, CRYPT.torch, CRYPT.flame].every(ready);
/** posición de la llama pintada respecto al punto de apoyo (según el pack) */
const TORCH_FLAME = [-5.7, -137] as const, BRAZIER_FLAME = [-0.7, -84] as const;
/**
 * Objetos de «Pixel Worlds - 202 Dungeon, Castle & Mine Props» (SdavGha), a 2× (rombo 128×64), con el mismo punto de apoyo.
 * Obstáculos por zona: se mezclan con los del Stone Crypt.
 */
const prop = (id: string): HTMLImageElement | null => art(`iso/props/${id}.png`);
const ZONE_PROPS: Array<Array<HTMLImageElement | null>> = [
  // catacumbas: barriles, cajas, cascotes, pilar roto, jaula, altar, calavera en estaca, pilar con cadenas, ángel, gárgola, candelabro, lápidas, calaveras
  [CRYPT.barrel, CRYPT.crates, CRYPT.rubble, ...['d01_13', 'd01_11', 'd01_14', 'd01_09', 'd10_14', 'd05_04', 'd05_15', 'd05_05', 'd05_13', 'd05_03', 'd05_10'].map(prop)],
  // bosque: estalagmitas, sacos, tótem, estalagmita, cascotes, pilar roto, lápida, calavera en estaca, setas
  [CRYPT.stalagmites, CRYPT.sacks, CRYPT.rubble, CRYPT.barrel, ...['d05_07', 'd04_01', 'd01_13', 'd05_13', 'd01_09', 'd04_08', 'd05_07'].map(prop)],
  // ruinas de ceniza: cascotes, mesa, cajas, pilar roto, armadura, alabardas, estandarte, trono, gárgola
  [CRYPT.rubble, CRYPT.table, CRYPT.crates, CRYPT.rubble, ...['d01_13', 'd06_16', 'd06_04', 'd06_08', 'd06_07', 'd05_15'].map(prop)],
  // abismo: estalagmitas, cascotes, obelisco, cristales, pilar de invocación, cristal de barrera, runas flotantes, piedra rúnica, pilar con cadenas
  [CRYPT.stalagmites, CRYPT.rubble, ...['d10_09', 'd04_02', 'd10_07', 'd10_06', 'd11_10', 'd07_05', 'd10_14', 'd10_09'].map(prop)],
];
/**
 * Personajes con hoja de animación en 8 direcciones (vista isométrica). Fotogramas de 96 px con los pies en (48, 80);
 * filas S, SE, E, NE, N, NW, W, SW. Se dibujan a 2×.
 */
type SheetAnim = 'idle' | 'walk' | 'attack' | 'hurt' | 'death' | 'cast' | 'transform' | (string & {});
/**
 * img: una imagen por animación (filas = direcciones). dirs 8 = S, SE, E, NE, N, NW, W, SW; dirs 1 = de perfil mirando
 * a la derecha (se voltea para mirar a la izquierda). foot = pies dentro del fotograma; scale = aumento entero.
 */
interface Sheet {
  img: Partial<Record<SheetAnim, HTMLImageElement | null>>; frames: Partial<Record<SheetAnim, number>>; size: number; foot: [number, number]; scale: number; dirs: 8 | 1;
  /** duración de ataque/lanzamiento (ms) y en qué fracción sale el proyectil */
  actMs?: number; release?: number;
  /** alto real del dibujo sobre los pies (píxeles de la hoja), para poner la barra de vida encima */
  head?: number;
  /** proyectil propio (sustituye al genérico en los ataques que viajan), y su altura de salida sobre los pies */
  arrow?: HTMLImageElement | null; arrowY?: number;
  /** animación propia de algunos hechizos (id del hechizo → animación de la hoja) */
  spellAnim?: Record<string, string>;
  /** pilares: el reposo no se anima; cada dibujo es un estado según la vida que le queda (sano, dañado, roto) */
  hpFrames?: boolean;
}
const sheet = (name: string, frames: Sheet['frames'], size = 96, foot: [number, number] = [48, 80], scale = 2, dirs: 8 | 1 = 8): Sheet => ({
  img: Object.fromEntries(Object.keys(frames).map((a) => [a, art(`iso/units/${name}_${a}.png`)])) as Sheet['img'],
  frames, size, foot, scale, dirs,
});
const withHead = (s: Sheet, head: number): Sheet => ({ ...s, head });
/** qué enemigos usan una hoja (por su clase) */
const SHEETS: Record<string, Sheet> = {
  // modelos 3D pasados a pixel art (tools/arte/pixelar_hoja.py)
  devorador: withHead(sheet('demon', { idle: 8, walk: 10, attack: 10, hurt: 4, death: 12 }, 160, [80, 104]), 67),
  larva: withHead(sheet('centipede', { idle: 8, walk: 6, attack: 6, hurt: 5, death: 8 }, 160, [80, 80]), 41),
  ent: withHead(sheet('tree', { idle: 9, walk: 8, attack: 9, hurt: 6, death: 9 }, 176, [86, 95]), 67),
  // araña gigante 3D (celdas de 256 en origen)
  // Limo de osario: hoja de una dirección (mira a la derecha), fotogramas de 96×96 con los pies en (48, 92), a 2×
  limo: { ...sheet('limo', { idle: 4, walk: 7, attack: 7, hurt: 3, death: 8 }, 96, [48, 92], 2, 1), head: 46 },
  // Murciélago de cripta: hoja dibujada con IA (una dirección, mira a la derecha), celdas de 72 px con la sombra en (36, 69), a 2×
  murcielago: { ...sheet('bat', { idle: 4, walk: 8, attack: 8, hurt: 4, death: 5 }, 72, [36, 68], 2, 1), head: 60 },
  // Arquero óseo: lámina dibujada con IA (tools/arte/hoja_ia.py), una dirección; suelta la flecha en el 5.º fotograma de 8
  arquero: { ...sheet('boneArcher', { idle: 6, walk: 10, attack: 8, hurt: 5, death: 6 }, 96, [48, 92], 2, 1), head: 66, actMs: 800, release: 4 / 8 },
  // Caballero sepulcral: lámina JPG con fondo gris (se quita rellenando desde los bordes), celdas de 160; el tajo llega en el 5.º fotograma
  caballero: { ...sheet('knight', { idle: 3, walk: 8, attack: 8, hurt: 4, death: 6 }, 160, [80, 156], 2, 1), head: 66, actMs: 800, release: 4 / 8 },
  // Momia del osario: lámina JPG con fondo gris oscuro (quitado), celdas de 160; el zarpazo llega en el 5.º fotograma de 8
  momia: { ...sheet('mummy', { idle: 4, walk: 9, attack: 8, hurt: 3, death: 5 }, 160, [80, 156], 2, 1), head: 68, actMs: 800, release: 4 / 8 },
  // láminas dibujadas con IA (tools/arte/detectar.py + hoja_ia.py), una dirección
  calavera: { ...sheet('calavera', { idle: 4, walk: 8, attack: 7, hurt: 3, death: 7 }, 96, [48, 92], 2, 1), head: 40, actMs: 800, release: 4 / 7 },
  sepulturero: { ...sheet('sepulturero', { idle: 4, walk: 7, attack: 6, cast: 6, hurt: 3, death: 6 }, 96, [48, 92], 2, 1), head: 52, actMs: 800, release: 3 / 6 },
  abominacion: { ...sheet('abominacion', { idle: 3, walk: 8, attack: 4, cast: 4, hurt: 3, death: 4 }, 160, [80, 156], 2, 1), head: 86, actMs: 900, release: 2 / 4 },
  lobo: { ...sheet('lobo', { idle: 6, walk: 6, attack: 6, cast: 4, hurt: 2, death: 6 }, 144, [72, 140], 2, 1), head: 54, actMs: 700, release: 3 / 6 },
  // jefes con dos fases: en la fase 2 cambian de hoja («…2»); su «transform» se ve al cambiar de fase
  prior: { ...sheet('prior', { idle: 4, walk: 3, attack: 4, hurt: 3, death: 5 }, 160, [80, 156], 2, 1), head: 76, actMs: 900, release: 3 / 4 },
  prior2: { ...sheet('prior2', { idle: 4, walk: 3, attack: 4, transform: 5, hurt: 3, death: 4 }, 160, [80, 156], 2, 1), head: 84, actMs: 900, release: 3 / 4 },
  planidera: { ...sheet('planidera', { idle: 5, walk: 5, attack: 5, cast: 4, hurt: 2, death: 4 }, 224, [112, 220], 2, 1), head: 74, actMs: 900, release: 3 / 5 },
  planidera2: { ...sheet('planidera2', { idle: 5, walk: 5, attack: 5, cast: 4, hurt: 2, death: 4, transform: 5 }, 224, [112, 220], 2, 1), head: 74, actMs: 900, release: 3 / 5 },
  esqueleto: { ...sheet('esqueleto', { idle: 5, walk: 9, attack: 5, cast: 9, hurt: 6, death: 9 }, 128, [64, 124], 2, 1), head: 60, actMs: 800, release: 2 / 5 },
  acolito: { ...sheet('acolito', { idle: 6, walk: 7, attack: 10, cast: 10, hurt: 4, death: 7 }, 128, [64, 124], 2, 1), head: 66, actMs: 1000, release: 4 / 10 },
  necrofago: { ...sheet('necrofago', { idle: 8, walk: 4, attack: 7, cast: 9, hurt: 5, death: 9 }, 128, [64, 124], 2, 1), head: 58, actMs: 800, release: 3 / 7 },
  espectro: { ...sheet('espectro', { idle: 5, walk: 5, attack: 5, cast: 4, hurt: 3, death: 4 }, 128, [64, 124], 2, 1), head: 66, actMs: 800, release: 3 / 5 },
  gargola: { ...sheet('gargola', { idle: 6, walk: 9, attack: 6, cast: 6, hurt: 4, death: 6 }, 128, [64, 124], 2, 1), head: 63, actMs: 800, release: 3 / 6 },
  // zona 2 · bosque (hojas del creador)
  pilar: { ...sheet('pilar', { idle: 3, hurt: 2, death: 2 }, 128, [64, 124], 2, 1), head: 104, hpFrames: true },
  arana: { ...sheet('arana', { idle: 6, walk: 6, attack: 6, hurt: 4, death: 8 }, 128, [64, 124], 2, 1), head: 44, actMs: 700, release: 3 / 6 },
  chaman: { ...sheet('chaman', { idle: 8, walk: 8, attack: 8, cast: 8, hurt: 5, death: 8 }, 128, [64, 124], 2, 1), head: 63, actMs: 900, release: 5 / 8 },
  hongo: { ...sheet('hongo', { idle: 5, walk: 7, attack: 7, hurt: 4, death: 8 }, 128, [64, 124], 2, 1), head: 54, actMs: 800, release: 4 / 7 },
  pantera: { ...sheet('pantera', { idle: 5, walk: 6, attack: 7, cast: 7, hurt: 4, death: 6 }, 128, [64, 124], 2, 1), head: 53, actMs: 700, release: 3 / 7 },
  alfa: { ...sheet('alfa', { idle: 6, walk: 6, attack: 6, cast: 6, hurt: 6, death: 6 }, 160, [80, 156], 2, 1), head: 72, actMs: 750, release: 3 / 6 },
  reina: { ...sheet('reina', { idle: 10, walk: 10, attack: 10, cast: 10, death: 10 }, 160, [80, 156], 2, 1), head: 85, actMs: 900, release: 4 / 10 },
  madre: { ...sheet('madre', { idle: 4, walk: 3, attack: 4, cast: 4, hurt: 3, death: 5 }, 192, [96, 188], 2, 1), head: 89, actMs: 900, release: 3 / 4, spellAnim: { e_aplastar: 'cast' } },
  madre2: { ...sheet('madre2', { idle: 4, walk: 4, attack: 4, cast: 4, hurt: 3, transform: 5, death: 4 }, 192, [96, 188], 2, 1), head: 83, actMs: 900, release: 3 / 4, spellAnim: { e_aplastar: 'cast' } },
  druida: { ...sheet('druida', { idle: 6, walk: 7, attack: 9, cast: 10, hurt: 4, death: 10 }, 128, [64, 124], 2, 1), head: 61, actMs: 1000, release: 6 / 9 },
  zarzal: { ...sheet('zarzal', { idle: 8, walk: 8, attack: 4, hurt: 4, death: 8 }, 160, [80, 156], 2, 1), head: 72, actMs: 700, release: 2 / 4 },
  brote: { ...sheet('brote', { idle: 3, hurt: 2, death: 3 }, 128, [64, 124], 2, 1), head: 64 },
  cazador: { ...sheet('cazador', { idle: 5, walk: 6, attack: 6, bite: 6, cast: 5, hurt: 4, death: 6 }, 160, [80, 156], 2, 1), head: 80, actMs: 800, release: 3 / 6, spellAnim: { e_mordida: 'bite' } },
  cazador2: { ...sheet('cazador2', { idle: 5, walk: 5, attack: 5, bite: 5, cast: 4, hurt: 4, transform: 6, death: 8 }, 192, [96, 188], 2, 1), head: 86, actMs: 800, release: 4 / 5, spellAnim: { e_mordida: 'bite' } },
  tejedora: withHead(sheet('weaver', { idle: 12, walk: 8, attack: 10, hurt: 8, death: 12 }, 159, [80, 84]), 27),
};
/** héroes con hoja (por clase). Arquero: «Arcane archer», de perfil. */
const HERO_SHEETS: Record<string, Sheet> = {
  // Hechicera Zorro: una animación por familia de hechizos (orbe, encanto, salto, fuego, ilusión, vórtice, colas, esencia)
  zorro: {
    ...sheet('zorro', { idle: 4, walk: 4, attack: 3, charm: 2, dash: 2, foxfire: 3, illusion: 3, vortex: 2, tail: 3, essence: 3, hurt: 3, death: 3 }, 128, [64, 124], 2, 1), head: 54, actMs: 750, release: 2 / 3,
    spellAnim: { z_orbe: 'attack', z_encanto: 'charm', z_seduccion: 'charm', z_maldicion: 'charm', z_impulso: 'dash', z_fuego: 'foxfire', z_vinculo: 'foxfire', z_espejismo: 'illusion', z_velo: 'illusion', z_vortice: 'vortex', z_estallido: 'tail', z_colas: 'tail', z_drenaje: 'essence', z_resguardo: 'essence' },
  },
  // a 3×: unos 96 px de alto; tensa el arco y suelta la flecha en el 7.º fotograma (de 7)
  arquero: { ...sheet('archer', { idle: 4, walk: 8, attack: 7, cast: 4, hurt: 2, death: 8 }, 64, [32, 48], 3, 1), actMs: 800, release: 6 / 7, arrow: art('iso/units/archer_arrow.png'), arrowY: 23, head: 32 },
};
const sheetOf = (u: { kind: string; team: string; summoner?: number; phase?: number }): Sheet | undefined =>
  u.team === 'enemy' ? ((u.phase ?? 1) >= 2 && SHEETS[`${u.kind}2`]) || SHEETS[u.kind] : u.summoner === undefined ? HERO_SHEETS[u.kind] : undefined;
/** Para la vista previa del creador: hoja de un enemigo o héroe (imágenes, nº de fotogramas y tamaño de celda). */
export const sheetPreview = (kind: string, hero = false): { img: Sheet['img']; frames: Sheet['frames']; size: number } | undefined => { const s = hero ? HERO_SHEETS[kind] : SHEETS[kind]; return s && { img: s.img, frames: s.frames, size: s.size }; };
const sheetReady = (s: Sheet): boolean => Object.values(s.img).every((i) => ready(i ?? null));
/** alto del personaje sobre sus pies, en pantalla */
const sheetHeight = (s: Sheet): number => (s.head ?? s.foot[1]) * s.scale;
/** Dirección (fila de la hoja) para un desplazamiento en casillas, vista en pantalla isométrica. */
export function sheetDir(dx: number, dy: number): number {
  if (!dx && !dy) return 0;
  const a = Math.atan2((dx + dy) / 2, dx - dy), k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  // k: 0 = E, 1 = SE, 2 = S, 3 = SO, 4 = O, 5 = NO, 6 = N, 7 = NE → filas S, SE, E, NE, N, NW, W, SW
  return [2, 1, 0, 7, 6, 5, 4, 3][k]!;
}

/** tiempo por casilla al andar */
const STEP_MS = 380;
/** duración de la transformación de fase de los jefes */
const PHASE_MS = 1600;

/** objetos con velas: dan luz */
/**
 * Bosque (zona 2): «Forest», de Rafael Sewa (CC BY-NC-SA 4.0), pixelado, oscurecido y pasado a 2:1.
 * Suelo de tierra (textura que se pinta en perspectiva), manchas de hierba y musgo, árboles alrededor y obstáculos de bosque.
 */
const fo = (id: string): HTMLImageElement | null => art(`iso/forest/${id}.png`);
const FOREST = {
  ground: fo('ground'),
  patches: ["g_darkgrass2", "g_darkgrass3", "g_darkgrass4", "g_darkgrass6", "g_darkgrass7", "g_darkgrass8", "g_darkgrass12", "g_moss2", "g_moss3", "g_moss4", "g_groundleaves2", "g_groundleaves4", "g_mushroom4", "g_mushroom3", "g_flowerground3", "g_densegrass2"].map(fo),
  props: ["o_tree33", "o_tree35", "o_tree37", "o_tree51", "o_tree10", "o_tree13", "o_stump4", "o_stump5", "o_stump6", "o_rock3", "o_rock5", "o_rock6", "o_log1", "o_fern3", "o_tallgrass4", "o_mushroom6"].map(fo),
  border: ["b_tree44", "b_tree45", "b_tree47", "b_tree48", "b_tree49", "b_tree50", "b_tree43", "b_tree52", "b_tree22", "b_tree21"].map(fo),
};
/** Ruinas de ceniza (zona 3): imágenes IA del creador (suelo de piedra volcánica, grietas de lava, ciudadelas en ruinas, yunque). */
const as = (id: string): HTMLImageElement | null => art(`iso/ash/${id}.png`);
/** Escenario propio de una zona: suelo en perspectiva, manchas, borde del fondo, obstáculos propios y ambiente. */
interface Biome {
  ground: HTMLImageElement | null; patches: Array<HTMLImageElement | null>; border: Array<HTMLImageElement | null>;
  /** obstáculos propios; se mezclan con los de ZONE_PROPS de la zona si `mixProps` */
  props: Array<HTMLImageElement | null>; mixProps?: boolean;
  /** manchas por casilla, separación de las piezas del borde, borde de tierra y tono */
  patchDensity: number; borderStep: [number, number]; rim: [string, string]; tint: string; fx: 'fireflies' | 'embers';
}
const BIOMES: Record<number, Biome> = {
  1: { ground: FOREST.ground, patches: FOREST.patches, border: FOREST.border, props: FOREST.props, patchDensity: 0.32, borderStep: [0.9, 0.7], rim: ['#2b2617', '#1e1b11'], tint: '#e2eadb', fx: 'fireflies' },
  2: { ground: as('ground'), patches: ['crack0', 'crack1', 'crack2'].map(as), border: ['wall00', 'wall01', 'wall10', 'wall11'].map(as), props: [as('prop_anvil')], mixProps: true,
    patchDensity: 0.07, borderStep: [1.7, 0.7], rim: ['#2a1a14', '#1c120e'], tint: '#f0e2dc', fx: 'embers' },
};
const biomeOf = (zone: number | undefined): Biome | undefined => { const b = BIOMES[zone ?? -1]; return b && [b.ground, ...b.patches, ...b.border, ...b.props].every((i) => ready(i)) ? b : undefined; };
const LIT_PROPS = new Set(['d05_05', 'd01_14'].map(prop));
/** tono de cada zona sobre suelo y muros (multiplicar) */
const ZONE_TINT = ['#e6e2ee', '#bccfa8', '#e8bfa0', '#c8b0ea'];

/** Sala generada a partir de una semilla: manchas de musgo o piedra rota, marcas en el suelo, puertas y antorchas. */
interface RoomLook {
  seed: number;
  /** losa de cada casilla */
  floor: Array<HTMLImageElement | null>;
  decals: Array<{ x: number; y: number; img: HTMLImageElement | null }>;
  /** tramos de muro: lado, posición y tipo */
  walls: Array<{ side: 'x' | 'y'; i: number; kind: 'wall' | 'closed' | 'open' | 'arch' }>;
  torches: Array<{ side: 'x' | 'y'; i: number }>;
  /** bosque: manchas sobre el suelo y árboles del borde */
  /** índices: se resuelven con las listas del escenario de la zona al dibujar */
  patches: Array<{ x: number; y: number; i: number; flip: boolean }>;
  trees: Array<{ x: number; y: number; i: number; flip: boolean }>;
}
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
function buildRoom(seed: number, w: number, h: number, zone = 0): RoomLook {
  const r = rng(seed);
  // segundo suelo de la sala: musgo, piedra rota o nada
  const kind = r() < 0.45 ? 'moss' : r() < 0.85 ? 'broken' : 'none';
  const blobs = Array.from({ length: kind === 'none' ? 0 : 2 + Math.floor(r() * 3) }, () => ({ x: r() * (w + 1), y: r() * (h + 1), r: 1.2 + r() * 2.2 }));
  const corner = (x: number, y: number): number => (blobs.some((b) => Math.hypot(x - b.x, (y - b.y) * 1.1) < b.r) ? 1 : 0);
  const floor: RoomLook['floor'] = [];
  const set = kind === 'moss' ? CRYPT.flagMoss : CRYPT.flagBroken, full = kind === 'moss' ? CRYPT.moss : CRYPT.broken;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // esquinas del rombo: N = (x, y), E = (x+1, y), S = (x+1, y+1), O = (x, y+1)
      const m = corner(x, y) * 1 + corner(x + 1, y) * 2 + corner(x + 1, y + 1) * 4 + corner(x, y + 1) * 8;
      floor.push(m === 0 ? (r() < 0.22 ? CRYPT.cracked : CRYPT.flag) : m === 15 ? full : set[m] ?? CRYPT.flag);
    }
  const decals = Array.from({ length: 2 + Math.floor(r() * 5) }, () => ({ x: Math.floor(r() * w), y: Math.floor(r() * h), img: CRYPT.decals[Math.floor(r() * CRYPT.decals.length)] ?? null }));
  // muros: de 0 a 2 arcos (con puerta cerrada, abierta o sin puerta), nunca en los extremos
  const walls: RoomLook['walls'] = [];
  for (let i = 0; i < w; i++) walls.push({ side: 'x', i, kind: 'wall' });
  for (let i = 0; i < h; i++) walls.push({ side: 'y', i, kind: 'wall' });
  const arches = Math.floor(r() * 3);
  for (let n = 0; n < arches; n++) {
    const side = r() < 0.5 ? 'x' : 'y', len = side === 'x' ? w : h, i = 1 + Math.floor(r() * Math.max(1, len - 2));
    const wl = walls.find((q) => q.side === side && q.i === i);
    if (wl && wl.kind === 'wall') { const k = r(); wl.kind = k < 0.4 ? 'closed' : k < 0.7 ? 'open' : 'arch'; }
  }
  // antorchas cada 2 a 4 tramos, fuera de los arcos
  const torches: RoomLook['torches'] = [];
  for (const side of ['x', 'y'] as const) {
    const len = side === 'x' ? w : h;
    for (let i = Math.floor(r() * 2); i < len; i += 2 + Math.floor(r() * 3)) if (walls.find((q) => q.side === side && q.i === i)?.kind === 'wall') torches.push({ side, i });
  }
  // bosque: manchas de hierba, musgo y hojas; árboles grandes detrás de los dos lados del fondo (y alguno en las esquinas)
  const bio = BIOMES[zone], dens = bio?.patchDensity ?? 0.3, [st, sv] = bio?.borderStep ?? [0.9, 0.7], R = (): number => Math.floor(r() * 1e6);
  const patches = Array.from({ length: Math.max(1, Math.round(w * h * dens)) }, () => ({ x: 0.3 + r() * (w - 0.6), y: 0.3 + r() * (h - 0.6), i: R(), flip: r() < 0.5 }));
  const trees: RoomLook['trees'] = [];
  const back = st > 1.5 ? 0.9 : 0.55;
  for (let i = -1.2; i < w + 0.6; i += st + r() * sv) trees.push({ x: i + r() * 0.3, y: -back - r() * 0.6, i: R(), flip: r() < 0.5 });
  for (let i = -0.4; i < h + 0.6; i += st + r() * sv) trees.push({ x: -back - r() * 0.6, y: i + r() * 0.3, i: R(), flip: r() < 0.5 });
  trees.sort((a, b) => a.x + a.y - (b.x + b.y));
  return { seed, floor, decals, walls, torches, patches, trees };
}

/** variante fija por casilla */
const pick = <T,>(list: T[], x: number, y: number): T => list[(((x * 73856093) ^ (y * 19349663)) >>> 0) % list.length]!;
/** Colores y nombres de los estados: salen del catálogo único (core/statuses.ts); se conservan los colores de siempre. */
const STATUS_COLOR: Record<string, string> = { ...Object.fromEntries(Object.values(STATUSES).map((x) => [x.kind, x.color])), burn: '#ff8a30', poison: '#7fe05a', slow: '#8ae0ff', stun: '#ffe84a', mark: '#ff5ad0', charm: '#ff9ad8', vuln: '#c9a0ff', bleed: '#e03040', hobble: '#9ad0e8', guarded: '#7fe0b0', deathmark: '#ff3a4a', verdugo: '#ff8a30', frenzy: '#ff5030', orbita: '#b07cff', chained: '#a0a8c0', rooted: '#c89a5a', anchor: '#5ac8ff', silver: '#e0e8ff', smoke: '#9a8ab8', immune: '#7ae8ff', kinetic: '#58a6ff', prism: '#c8a0ff', fading: '#b0b8d0' };
export const STATUS_NAME: Record<string, string> = Object.fromEntries(Object.values(STATUSES).map((x) => [x.kind, x.name]));

interface Float { x: number; y: number; text: string; color: string; t0: number }
interface Shot { x0: number; y0: number; x1: number; y1: number; color: string; t0: number; dur: number; orb?: boolean }
/** Onda expansiva (esfera nueva, golpe giratorio) */
interface Ring { x: number; y: number; color: string; t0: number; dur: number; r: number; spin?: boolean }
/** golpes giratorios: el personaje (y su Sombra) dan una vuelta */
const SPIN_SPELLS = ['s_tajo', 'k_despellejar', 'k_guadana', 'z_colas', 'g_remolino', 'torbellino'];
const SPIN_MS = 420;
interface Ghost { kind: string; team: string; idx: number; x: number; y: number; t0: number; sheet?: string; dir?: number }
const ELEMENT_COLOR: Record<string, string> = { fire: '#ff8a30', ice: '#8ae0ff', poison: '#7fe05a', shadow: '#b07cff', holy: '#ffe9a0' };
const ELEMENT_NAME: Record<string, string> = { fire: 'fuego', ice: 'hielo', poison: 'veneno', shadow: 'sombra', holy: 'sagrado' };
const LUNGE_MS = 240;
/** duración de las animaciones de hechizo de los modelos animados */
const ACT_MS = 480;
/** duración de la animación de muerte de los modelos animados */
const DEATH_MS = 900;

const CLASS_KINDS = ['guerrero', 'mago', 'clerigo', 'picaro', 'arquero', 'zorro', 'esferas', 'carcelero', 'acechador', 'barbaro', 'arquitecto', 'pistolero'];
/** Índice de color y etiqueta: héroes de jugadores, y héroes rivales (némesis, duelos) dentro de su bando. */
function teamIdx(c: CombatState): Map<number, number> {
  const m = new Map<number, number>();
  for (const team of ['hero', 'enemy'] as const) c.units.filter((u) => u.team === team && CLASS_KINDS.includes(lookKind(u)) && u.ai !== 'decoy').forEach((u, i) => m.set(u.id, i));
  return m;
}

export class Board {
  /** hechizo elegido, esperando objetivo */
  sel: string | null = null;
  onSelect: () => void = () => {};
  private g: CanvasRenderingContext2D;
  private hover: Pos | null = null;
  /** editor de salas / laboratorio: si está puesto, los clics van aquí en vez de al combate (drag = arrastrando) */
  pick: ((p: Pos, drag: boolean) => void) | null = null;
  private painting: Pos | null = null;
  /** marcas del editor sobre el suelo: color de relleno, borde y texto */
  overlay: Array<{ x: number; y: number; fill: string; stroke?: string; text?: string }> = [];
  /** señales tácticas (tecla G) */
  pings: Array<{ x: number; y: number; at: number; col: string; name: string }> = [];
  /** Casilla bajo el ratón (para la tecla G). */
  hoverCell(): Pos | null { return this.hover; }
  private shown = new Map<number, Pos>();
  private flash = new Map<number, number>();
  private floats: Float[] = [];
  private shots: Shot[] = [];
  private fx = new FxLayer(TILE);
  private rings: Ring[] = [];
  private spins = new Map<number, number>();
  private ghosts: Ghost[] = [];
  private lunge = new Map<number, { t0: number; dx: number; dy: number }>();
  /** animación de hechizo en curso (modelos animados) */
  private acts = new Map<number, { t0: number; anim: Anim; ms?: number; spell?: string }>();
  /** caminatas en curso: camino casilla a casilla */
  private walks = new Map<number, { from: Pos; path: Pos[]; t0: number; end: number }>();
  /** dirección del tramo que va andando (dx, dy) y casillas andadas, para la animación */
  private walkSeg = new Map<number, { dx: number; dy: number; dist: number }>();
  /** acción que espera a que acabe la transformación de fase */
  private pendingAct = new Map<number, { t0: number; anim: Anim; ms?: number; spell?: string }>();
  /** Pone la animación de una acción; si se está transformando, la deja para cuando acabe. */
  private setAct(id: number, act: { t0: number; anim: Anim; ms?: number; spell?: string }): void {
    const cur = this.acts.get(id);
    if (cur && (cur.anim as string) === 'phase' && act.t0 < cur.t0 + (cur.ms ?? ACT_MS)) this.pendingAct.set(id, { ...act, t0: Math.max(act.t0, cur.t0 + (cur.ms ?? ACT_MS)) });
    else this.acts.set(id, act);
  }
  /** flechas propias en vuelo (pantalla isométrica) */
  private arrows: Array<{ img: HTMLImageElement; from: Pos; at: Pos; t0: number; dur: number; lift: number }> = [];
  private faceLeft = new Map<number, boolean>();
  /** Semilla oscura: un orbe que late; pasa de violeta a rojo encendido según lo que ha crecido (0 a +10). */
  private drawSeed(u: Unit, cx: number, by: number, now: number): void {
    const g = this.g, k = Math.min(1, (u.seed ?? 0) / 10), pulse = 1 + 0.08 * Math.sin(now / (260 - k * 140) + u.id);
    const mix = (a: number[], b: number[]): string => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * k)).join(',')})`;
    const core = mix([150, 90, 240], [255, 70, 50]), rim = mix([60, 20, 110], [120, 10, 20]), glow = mix([170, 110, 255], [255, 120, 60]);
    const y = by - TILE * 0.32, r = TILE * (0.2 + k * 0.06) * pulse;
    const gr = g.createRadialGradient(cx, y, 2, cx, y, r * 2.4); gr.addColorStop(0, glow.replace('rgb', 'rgba').replace(')', ',.45)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, y, r * 2.4, 0, 6.3); g.fill();
    g.fillStyle = rim; g.beginPath(); g.arc(cx, y, r, 0, 6.3); g.fill();
    g.fillStyle = core; g.beginPath(); g.arc(cx, y, r * 0.62, 0, 6.3); g.fill();
    g.fillStyle = '#fff6f0'; g.beginPath(); g.arc(cx - r * 0.25, y - r * 0.3, r * 0.18, 0, 6.3); g.fill();
    // raíces en el suelo
    g.strokeStyle = rim; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; g.beginPath(); g.moveTo(cx, by - 4); g.lineTo(cx + Math.cos(a) * TILE * 0.3, by - 4 + Math.sin(a) * TILE * 0.1); g.stroke(); }
    if (u.seed) { g.font = 'bold 11px ui-monospace, monospace'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(`+${u.seed}`, cx, y + 4); g.fillStyle = '#fff'; g.fillText(`+${u.seed}`, cx, y + 4); }
  }

  /** destello de golpe: dura 180 ms desde que llega el golpe */
  private flashing(id: number, now: number): boolean { const end = this.flash.get(id) ?? 0; return now < end && now >= end - 180; }
  /** dirección de cada personaje con hoja de 8 direcciones, y cuándo le golpearon por última vez */
  private facing = new Map<number, number>();
  private hurtAt = new Map<number, number>();
  private raf = 0;
  /** braseros vistos en este combate (para dejar el brasero volcado donde se rompió) */
  private brazierSeen = new Set<string>();
  private lastRound = 0;
  /** antorchas de los muros del fondo en este fotograma (coordenadas de pantalla) */
  private torches: Array<{ x: number; y: number; side: number; lit: boolean }> = [];
  /** esta sala se pinta como bosque */
  private forest = false;
  private groundPattern: CanvasPattern | null = null;
  private patternOf: HTMLImageElement | null = null;
  /** escenario propio de la zona de este combate (bosque, ceniza…) */
  private biome: Biome | undefined;
  /** este fotograma el suelo se ha dibujado con losas isométricas */
  private isoFloor = false;
  /** vista isométrica (se recuerda en el navegador) */
  iso = isoPref();
  setIso(on: boolean): void { this.iso = on; try { localStorage.setItem(ISO_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ } }
  /** temblor de pantalla del fotograma actual */
  private shake: [number, number] = [0, 0];
  /** Proporción ancho/alto del lienzo, para el CSS. */
  aspect(c: CombatState): number { if (this.iso) { const s = isoSize(c.w, c.h); return s.w / s.h; } return (c.w * TILE) / (c.h * TILE + 22); }
  /** Dibujo sobre el suelo: en isométrico, la casilla cuadrada se proyecta en un rombo. */
  private ground(): void {
    const [sx, sy] = this.shake, c = this.c;
    if (!this.iso || !c) { this.g.setTransform(1, 0, 0, 1, sx, PAD + sy); return; }
    const o = isoPoint(0, 0, c.h), a = ISO_W / 2 / TILE, b = ISO_H / 2 / TILE;
    this.g.setTransform(a, b, -a, b, o.x + sx, o.y + sy);
  }
  /** Dibujo de pie sobre la casilla (x, y): el código de la vista plana se reutiliza tal cual, desplazado al rombo y sin deformar. */
  private upright(x: number, y: number): void {
    const [sx, sy] = this.shake, c = this.c;
    if (!this.iso || !c) { this.g.setTransform(1, 0, 0, 1, sx, PAD + sy); return; }
    const p = isoPoint(x + 0.5, y + 0.5, c.h), fx = (x + 0.5) * TILE, fy = (y + 1) * TILE, k = ISO_UP;
    this.g.setTransform(k, 0, 0, k, p.x - fx * k + sx, p.y + ISO_FOOT - fy * k + sy);
  }
  /** Sin transformación (luces, avisos y ventanas que ocupan todo el lienzo). */
  private screen(): void { this.g.setTransform(1, 0, 0, 1, 0, 0); }

  constructor(private canvas: HTMLCanvasElement, private session: Session) {
    this.g = canvas.getContext('2d')!;
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.hover = this.cell(e); });
    canvas.addEventListener('mouseleave', () => { if (!this.touch) this.hover = null; });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.select(null); });
    window.addEventListener('pointerdown', (e) => { this.touch = e.pointerType !== 'mouse'; });
    // editor de salas: pintar al pulsar y al arrastrar
    canvas.addEventListener('pointerdown', (e) => { if (!this.pick || e.button !== 0) return; const p = this.cell(e); this.painting = p; if (p) this.pick(p, false); });
    canvas.addEventListener('pointermove', (e) => { if (!this.pick || !this.painting || !(e.buttons & 1)) return; const p = this.cell(e); if (p && (p.x !== this.painting.x || p.y !== this.painting.y)) { this.painting = p; this.pick(p, true); } });
    window.addEventListener('pointerup', () => { this.painting = null; });
    canvas.addEventListener('click', (e) => {
      if (this.pick) return;
      const p = this.cell(e);
      // en pantallas táctiles no hay «pasar el ratón»: el primer toque enseña la previsualización y el segundo confirma
      if (this.touch && p && !(this.hover && this.hover.x === p.x && this.hover.y === p.y) && !this.c?.deploy) { this.hover = p; return; }
      this.click(p);
      if (this.touch) this.hover = null;
    });
    const loop = (): void => { this.raf = requestAnimationFrame(loop); this.draw(); };
    loop();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  select(id: string | null): void {
    this.sel = id;
    this.onSelect();
  }

  private get c(): CombatState | null {
    return this.session.run?.combat ?? null;
  }

  private cell(e: MouseEvent): Pos | null {
    const c = this.c;
    if (!c) return null;
    const r = this.canvas.getBoundingClientRect();
    if (this.iso) {
      const q = isoCell(((e.clientX - r.left) / r.width) * this.canvas.width, ((e.clientY - r.top) / r.height) * this.canvas.height, c.h);
      const p = { x: Math.floor(q.x), y: Math.floor(q.y) };
      return p.x >= 0 && p.y >= 0 && p.x < c.w && p.y < c.h ? p : null;
    }
    const p = { x: Math.floor(((e.clientX - r.left) / r.width) * c.w), y: Math.floor((((e.clientY - r.top) / r.height) * (c.h * TILE + PAD) - PAD) / TILE) };
    return p.x >= 0 && p.y >= 0 && p.x < c.w && p.y < c.h ? p : null;
  }

  private click(p: Pos | null): void {
    const c = this.c;
    if (!c || !p) return;
    if (c.deploy) { this.session.act({ a: 'deploy', to: p }); return; }
    if (!this.session.isMyTurn()) return;
    if (this.sel) {
      this.session.act({ a: 'cast', spell: this.sel, at: p });
      this.select(null);
    } else {
      this.session.act({ a: 'move', to: p });
    }
  }

  /** Efectos visuales de lo que acaba de pasar. */
  applyEvents(events: GameEvent[]): void {
    const c = this.c;
    if (!c) return;
    const now0 = performance.now();
    /** retraso de lo que viene detrás de un disparo con flecha propia: el golpe se ve cuando llega */
    let late = 0;
    /** retraso por andar: también lo esperan los lanzamientos (atacar al llegar) */
    let walkLate = 0;
    const float = (id: number, text: string, color: string): void => {
      const u = c.units.find((x) => x.id === id), t0 = now0 + late;
      const p = this.shown.get(id) ?? u?.pos;
      if (p) this.floats.push({ x: (p.x + 0.5) * TILE + (Math.random() * 16 - 8), y: p.y * TILE + 8 - this.floats.filter((f) => Math.abs(f.t0 - t0) < 200).length * 14, text, color, t0 });
    };
    const heroIdx = teamIdx(c);
    for (const e of events) {
      // lo que no es el propio lanzamiento llega con el retraso de la flecha
      const now = e.t === 'cast' ? now0 + walkLate : now0 + late;
      const u = 'unit' in e ? c.units.find((x) => x.id === e.unit) : undefined;
      const from = u ? this.shown.get(u.id) ?? u.pos : undefined;
      const shc = this.iso && u ? sheetOf(u) : undefined;
      if (e.t === 'cast' && u) this.setAct(u.id, { t0: now, anim: animFor(e.spell, !!SPELLS[e.spell]?.dmg), ms: shc?.actMs ? shc.actMs * animMul(u.kind, 'attack', u.team === 'enemy') : undefined, spell: e.spell });
      if (e.t === 'cast' && u && from && SPIN_SPELLS.includes(e.spell)) {
        // giro: el personaje da una vuelta y un tajo circular le rodea (también a su Sombra)
        this.spins.set(u.id, now);
        const sh = c.marks?.find((m) => m.kind === 'shadow' && m.owner === u.id);
        for (const p of [from, ...(sh ? [sh.pos] : [])]) this.rings.push({ x: (p.x + 0.5) * TILE, y: (p.y + 0.55) * TILE, color: e.element ? ELEMENT_COLOR[e.element] ?? '#e8e0ff' : '#e8e0ff', t0: now, dur: SPIN_MS, r: TILE * 0.85, spin: true });
      }
      if (e.t === 'markAdd' && e.kind === 'pulse') this.rings.push({ x: (e.at.x + 0.5) * TILE, y: (e.at.y + 0.45) * TILE, color: '#c9a0ff', t0: now, dur: 420, r: TILE * 1.2 });
      if (e.t === 'flame') {
        const souls = u?.souls !== undefined;
        // Atracción del abismo: las almas vuelan en verde hacia el Carcelero, una tras otra, y se funden en un aro
        const k = souls ? this.shots.filter((p) => p.color === '#9af0d0' && p.t0 >= now).length : 0;
        this.shots.push({ x0: (e.from.x + 0.5) * TILE, y0: (e.from.y + 0.4) * TILE, x1: (e.at.x + 0.5) * TILE, y1: (e.at.y + 0.4) * TILE, color: souls ? '#9af0d0' : '#4ad0ff', t0: now + k * 120, dur: souls ? 650 : 300, orb: true });
        if (souls) this.rings.push({ x: (e.at.x + 0.5) * TILE, y: (e.at.y + 0.55) * TILE, color: '#9af0d0', t0: now + k * 120 + 650, dur: 420, r: TILE * 0.9 });
      }
      if (e.t === 'markAdd' && e.kind === 'sphere') {
        // la esfera aparece con una pequeña explosión
        const x = (e.at.x + 0.5) * TILE, y = (e.at.y + 0.45) * TILE;
        this.rings.push({ x, y, color: '#c9a0ff', t0: now + 150, dur: 380, r: TILE * 0.55 });
        for (let i = 0; i < 8; i++) this.shots.push({ x0: x, y0: y, x1: x + Math.cos(i * 0.785) * TILE * 0.6, y1: y + Math.sin(i * 0.785) * TILE * 0.6, color: '#a070ff', t0: now + 150, dur: 300 });
      }
      if (e.t === 'echo') {
        // la Sombra replica el golpe: un proyectil sale de su casilla
        const dx = e.at.x - e.from.x, dy = e.at.y - e.from.y, len = Math.hypot(dx, dy);
        this.shots.push({ x0: (e.from.x + 0.5) * TILE, y0: (e.from.y + 0.4) * TILE, x1: (e.at.x + 0.5) * TILE, y1: (e.at.y + 0.4) * TILE, color: '#7a3fc0', t0: now + 120, dur: Math.min(320, 90 + len * 35) });
      }
      if (e.t === 'cast' && u && from) {
        const dx = e.at.x - from.x, dy = e.at.y - from.y, len = Math.hypot(dx, dy);
        if (len > 0) {
          this.lunge.set(u.id, { t0: now, dx: dx / len, dy: dy / len });
          if (dx !== 0) this.faceLeft.set(u.id, dx < 0);
          const bounce = SPELLS[e.spell]?.bounce;
          if (bounce) {
            // el orbe va hasta el final de la línea y vuelve a la mano
            const dur = Math.min(380, 120 + len * 40), x0 = (from.x + 0.5) * TILE, y0 = (from.y + 0.4) * TILE, x1 = (e.at.x + 0.5) * TILE, y1 = (e.at.y + 0.4) * TILE;
            const col = e.spell === 'z_orbe' ? '#4ad0ff' : ELEMENT_COLOR[e.element ?? ''] ?? '#ffe08a';
            this.shots.push({ x0, y0, x1, y1, color: col, t0: now, dur, orb: true }, { x0: x1, y0: y1, x1: x0, y1: y0, color: col, t0: now + dur, dur, orb: true });
          }
        }
        // H6: el resto de hechizos se dibuja con su receta de efectos (proyectil, haz, arco, área, impacto, temblor)
        const def = SPELLS[e.spell];
        if (def && !def.bounce && !SPIN_SPELLS.includes(e.spell)) {
          // con hoja propia: el efecto espera a que suelte (p. ej. el arquero tensa el arco) y usa su flecha
          const r = recipeFor(def, u.kind), rel = shc?.release && shc.actMs ? shc.release * shc.actMs * animMul(u.kind, 'attack', u.team === 'enemy') : 0;
          if (shc?.arrow && ready(shc.arrow) && (r.travel === 'line' || r.travel === 'arc')) {
            const len = Math.hypot(e.at.x - from.x, e.at.y - from.y), dur = Math.min(420, 110 + len * 45);
            this.arrows.push({ img: shc.arrow, from: { ...from }, at: { ...e.at }, t0: now + rel, dur, lift: (shc.arrowY ?? 20) * shc.scale });
            this.fx.cast({ ...r, travel: 'instant', onSelf: 'none' }, from, e.at, fxCells(def, from, e.at, c.w, c.h), now + rel + dur);
            late = rel + dur;
          } else { this.fx.cast(r, from, e.at, fxCells(def, from, e.at, c.w, c.h), now + rel); late = rel; }
        }
      } else if (e.t === 'move' && u && e.path.length) {
        const last = e.path[e.path.length - 1]!;
        if (from && last.x !== Math.round(from.x)) this.faceLeft.set(u.id, last.x < from.x);
        // andar: recorre el camino casilla a casilla; lo que pase después en el turno espera a que llegue
        if (e.walk && from) {
          const start = Math.max(now, this.walks.get(u.id)?.end ?? 0);
          this.walks.set(u.id, { from: { x: Math.round(from.x), y: Math.round(from.y) }, path: e.path.map((p) => ({ ...p })), t0: start, end: start + e.path.length * STEP_MS });
          walkLate = Math.max(walkLate, start + e.path.length * STEP_MS - now0);
          late = Math.max(late, walkLate);
        }
      } else if (e.t === 'death' && u && from) {
        if (u.seed === undefined) this.ghosts.push({ kind: lookKind(u), team: u.team, idx: heroIdx.get(u.id) ?? 0, x: from.x, y: from.y, t0: now, sheet: sheetOf(u) ? u.kind : undefined, dir: this.facing.get(u.id) ?? 0 });
      }
      if (e.t === 'damage' && e.amount > 0) this.hurtAt.set(e.unit, now);
      if (e.t === 'damage') {
        this.flash.set(e.unit, now + 180);
        if (from && e.amount > 0) this.fx.hit(from, e.crit, now);
        float(e.unit, e.amount > 0 ? `-${e.amount}${e.crit ? '!' : ''}` : `escudo -${e.absorbed}`, e.crit ? '#ffd24a' : '#ff7080');
      } else if (e.t === 'heal') float(e.unit, `+${e.amount}`, '#5fcf80');
      else if (e.t === 'shield') float(e.unit, `escudo +${e.amount}`, '#58a6ff');
      else if (e.t === 'status') float(e.unit, STATUS_NAME[e.kind] ?? e.kind, STATUS_COLOR[e.kind] ?? '#fff');
      else if (e.t === 'skip') float(e.unit, 'Pierde el turno', '#ffe84a');
      else if (e.t === 'soul') float(e.unit, e.armor ? 'Alma +1 armadura' : 'Alma', '#9ad0e8');
      else if (e.t === 'trap') float(e.unit, '¡Púas!', '#ff8a30');
      else if (e.t === 'stuck') float(e.unit, '¡Atrapado!', '#7fe05a');
      else if (e.t === 'snare') float(e.unit, '¡Cepo!', '#d8b060');
      else if (e.t === 'drain') { if (e.mp) float(e.unit, `${e.mp > 0 ? '+' : ''}${e.mp} PM`, '#58a6ff'); if (e.ap) float(e.unit, `${e.ap > 0 ? '+' : ''}${e.ap} PA`, '#f2c14e'); }
      else if (e.t === 'resist') float(e.unit, e.what, '#c8c8d8');
      else if (e.t === 'tackle') float(e.unit, `¡Placado! -${e.lost} PM`, '#58a6ff');
      else if (e.t === 'revive') float(e.unit, '¡Resucita!', '#7fe05a');
      else if (e.t === 'explode') { float(e.unit, '¡BUM!', '#ff8a30'); if (from) for (let i = 0; i < 6; i++) this.shots.push({ x0: (from.x + 0.5) * TILE, y0: (from.y + 0.5) * TILE, x1: (from.x + 0.5 + Math.cos(i * 1.05) * 1.3) * TILE, y1: (from.y + 0.5 + Math.sin(i * 1.05) * 1.3) * TILE, color: '#ff8a30', t0: now, dur: 260 }); }
      else if (e.t === 'split') float(e.unit, 'Se divide', '#c9a0ff');
      else if (e.t === 'blink') { this.shown.set(e.unit, { ...e.to }); float(e.unit, 'Salto sombrío', '#c77dff'); }
      else if (e.t === 'devour') float(e.unit, 'Devora', '#c9a0ff');
      else if (e.t === 'raise') float(e.unit, 'Alza muertos', '#c9a0ff');
      else if (e.t === 'summon') float(e.unit, 'Invocado', '#c77dff');
      else if (e.t === 'phase') {
        float(e.unit, '¡FASE 2!', '#ff3060');
        // hojas con segunda fase: se ve la transformación (su animación de lanzar)
        const pu = c.units.find((x) => x.id === e.unit), ps = pu && SHEETS[`${pu.kind}2`];
        if (ps?.frames.transform) {
          this.acts.set(e.unit, { t0: now, anim: 'phase' as Anim, ms: PHASE_MS });
          // lo que hace después en su turno (atacar, invocar…) se ve cuando termina de transformarse
          late = Math.max(late, PHASE_MS);
        }
      }
      else if (e.t === 'detonate') float(e.unit, `¡Marca de la muerte! ${e.amount}`, '#ff3a4a');
      else if (e.t === 'caged') float(e.unit, '¡La caja!', '#7fe0b0');
      else if (e.t === 'reset') float(e.unit, `¡Remate! ${SPELLS[e.spell]?.name ?? ''} gratis`, '#4ad0ff');
    }
  }

  /** Suelo en damero con ruido pixel-art, abismos, raíces, fuego y la sombra que proyectan los muros. */
  private drawFloor(c: CombatState, zone: (typeof ZONES)[number], now: number): void {
    const g = this.g;
    const out = new Set(c.voids ?? []), wall = new Set(c.obstacles.filter((k) => !out.has(k))), pit = new Set(c.abyss ?? []);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const X = x * TILE, Y = y * TILE, k = `${x},${y}`;
        // fuera de la sala (salas creadas): nada
        if (out.has(k)) { if (!this.iso) { g.fillStyle = '#07050a'; g.fillRect(X, Y, TILE, TILE); } continue; }
        if (pit.has(k)) {
          // abismo: hueco negro con el borde de piedra iluminado y algún brillo lejano
          const gr = g.createLinearGradient(0, Y, 0, Y + TILE);
          gr.addColorStop(0, '#000'); gr.addColorStop(1, '#0a0614');
          g.fillStyle = gr; g.fillRect(X, Y, TILE, TILE);
          if (!pit.has(`${x},${y - 1}`)) { g.fillStyle = zone.rock[0]; g.fillRect(X, Y, TILE, 9); g.fillStyle = zone.rock[1]; g.fillRect(X, Y, TILE, 3); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(X, Y + 9, TILE, 6); }
          const tw = 0.3 + 0.3 * Math.sin(now / 700 + x * 3 + y);
          g.fillStyle = `rgba(150,90,255,${tw * 0.5})`; g.fillRect(X + ((x * 17 + y * 7) % 40) + 6, Y + 26 + ((x * 5) % 18), 2, 2);
          continue;
        }
        const light = (x + y) % 2 === 0;
        if (this.isoFloor) {
          // losas isométricas ya dibujadas: solo el damero suave para leer las casillas y la sombra de los muros
          // en el bosque, una cuadrícula muy suave (sin damero) para no parecer un tablero de ajedrez
          if (this.forest) { g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.2; g.strokeRect(X + 0.5, Y + 0.5, TILE - 1, TILE - 1); }
          else { g.fillStyle = light ? 'rgba(255,240,210,.035)' : 'rgba(0,0,0,.16)'; g.fillRect(X, Y, TILE, TILE); }
          if (wall.has(`${x},${y - 1}`)) { const sg = g.createLinearGradient(0, Y, 0, Y + TILE * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(X, Y, TILE, TILE * 0.45); }
          continue;
        }
        if (zone === ZONES[0] && ready(Z1.floor)) {
          // losas ilustradas: una de las 16 variantes, fija por casilla; el damero se conserva para leer las casillas
          const v = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 16;
          g.drawImage(Z1.floor, (v % 4) * 64, Math.floor(v / 4) * 64, 64, 64, X, Y, TILE, TILE);
          g.fillStyle = light ? 'rgba(255,240,210,.04)' : 'rgba(0,0,0,.2)'; g.fillRect(X, Y, TILE, TILE);
          if (wall.has(`${x},${y - 1}`)) { const sg = g.createLinearGradient(0, Y, 0, Y + TILE * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(X, Y, TILE, TILE * 0.45); }
          continue;
        }
        // damero: casillas claras y oscuras con ruido fijo
        g.fillStyle = zone.floor[light ? 0 : 1]!;
        g.fillRect(X, Y, TILE, TILE);
        // damero marcado: las casillas oscuras se oscurecen y las claras reciben un poco de luz
        g.fillStyle = light ? 'rgba(255,240,210,.05)' : 'rgba(0,0,0,.22)'; g.fillRect(X, Y, TILE, TILE);
        const h = (x * 73856093) ^ (y * 19349663);
        for (let i = 0; i < 10; i++) {
          const r = Math.imul(h ^ (i * 2654435761), 2246822519) >>> 0;
          g.fillStyle = (r & 1) ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)';
          g.fillRect(X + 2 + ((r >>> 4) % (TILE - 6)), Y + 2 + ((r >>> 12) % (TILE - 6)), 4, 4);
        }
        // juntas de las losas: luz arriba-izquierda, sombra abajo-derecha
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(X, Y, TILE, 2); g.fillRect(X, Y, 2, TILE);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X, Y + TILE - 2, TILE, 2); g.fillRect(X + TILE - 2, Y, 2, TILE);
        if ((h & 15) === 3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X + 10 + ((h >> 6) & 15), Y + 18 + ((h >> 10) & 15), 12, 2); g.fillRect(X + 20 + ((h >> 6) & 15), Y + 20 + ((h >> 10) & 15), 2, 7); }
        // sombra proyectada por el muro de arriba
        if (wall.has(`${x},${y - 1}`)) { const sg = g.createLinearGradient(0, Y, 0, Y + TILE * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(X, Y, TILE, TILE * 0.45); }
      }
    // raíces venenosas: zarzas violáceas con espinas verdes
    for (const k of c.roots ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const X = x * TILE, Y = y * TILE;
      g.strokeStyle = '#2a1028'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(X + 6, Y + 40); g.bezierCurveTo(X + 18, Y + 18, X + 34, Y + 46, X + 50, Y + 16); g.stroke();
      g.strokeStyle = '#b04aa0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(X + 6, Y + 40); g.bezierCurveTo(X + 18, Y + 18, X + 34, Y + 46, X + 50, Y + 16); g.stroke();
      g.beginPath(); g.moveTo(X + 10, Y + 12); g.quadraticCurveTo(X + 26, Y + 30, X + 20, Y + 50); g.stroke();
      g.fillStyle = `rgba(140,255,120,${0.6 + 0.3 * Math.sin(now / 300 + x)})`;
      for (const [a, b] of [[16, 26], [30, 36], [42, 22], [22, 44]] as const) g.fillRect(X + a, Y + b, 3, 3);
    }
    // fuego en el suelo (brasero roto)
    for (const [k, t] of Object.entries(c.fire ?? {})) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const X = x * TILE, Y = y * TILE;
      g.fillStyle = 'rgba(255,90,20,.22)'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
      // en isométrico las llamas se dibujan de pie (drawIsoGround)
      if (this.isoFloor) continue;
      for (let i = 0; i < 4; i++) {
        const fx = X + 10 + i * 11, fl = 10 + 6 * Math.sin(now / 90 + i * 1.7 + x);
        g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(fx - 5, Y + TILE - 8); g.quadraticCurveTo(fx, Y + TILE - 8 - fl * 2, fx + 5, Y + TILE - 8); g.fill();
        g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(fx - 2, Y + TILE - 8); g.quadraticCurveTo(fx, Y + TILE - 8 - fl, fx + 2, Y + TILE - 8); g.fill();
      }
      g.fillStyle = '#fff3c0'; g.font = 'bold 11px monospace'; g.textAlign = 'left'; g.fillText(String(t), X + TILE - 13, Y + 13);
    }
  }

  /** Muro con volumen: cara superior iluminada (sobresale hacia arriba) y cara frontal de ladrillo más oscura. */
  private drawWall(c: CombatState, zone: (typeof ZONES)[number], x: number, y: number): void {
    const g = this.g, X = x * TILE, Y = y * TILE, lift = Math.round(TILE * 0.4);
    if (zone === ZONES[0] && ready(Z1.pillar)) {
      // pilar ilustrado: ocupa su casilla y sobresale hacia arriba (tapa lo que hay detrás, no lo de delante)
      const h = Math.round(TILE * (Z1.pillar.naturalHeight / Z1.pillar.naturalWidth));
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(X + TILE / 2, Y + TILE - 4, TILE * 0.46, 7, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(Z1.pillar, X, Y + TILE - h, TILE, h);
      return;
    }
    const front = !c.obstacles.includes(`${x},${y + 1}`);
    const topY = Y - lift, topH = TILE - 2;
    // cara frontal de ladrillo (la que mira hacia abajo, si no hay otro muro delante)
    if (front) {
      const fy = topY + topH, fh = Y + TILE - fy;
      g.fillStyle = zone.rock[2]; g.fillRect(X, fy, TILE, fh);
      g.fillStyle = 'rgba(0,0,0,.28)';
      for (let r = 0; r < fh; r += 8) {
        g.fillRect(X, fy + r, TILE, 1);
        const off = (r / 8) % 2 ? 0 : 14;
        for (let bx = off; bx < TILE; bx += 28) g.fillRect(X + bx, fy + r, 1, 8);
      }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(X, Y + TILE - 3, TILE, 3);
    }
    // cara superior: más clara, biselada y con grietas
    g.fillStyle = zone.rock[1]; g.fillRect(X, topY, TILE, topH);
    g.fillStyle = zone.rock[0]; g.fillRect(X + 3, topY + 3, TILE - 6, topH - 7);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(X + 3, topY + 3, TILE - 6, 3);
    const h = (x * 92821) ^ (y * 68917);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X + 8 + (h & 15), topY + 12 + ((h >> 4) & 15), 10, 2); g.fillRect(X + 22 + ((h >> 8) & 15), topY + 20 + ((h >> 12) & 7), 2, 8);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.strokeRect(X + 1, topY + 1, TILE - 2, (front ? Y + TILE : topY + topH) - topY - 2);
  }

  /** Llama animada del pack (8 fotogramas), con la base en (x, y) y h de alto; con halo si glow. */
  private drawFlame(x: number, y: number, h: number, now: number, seed: number, glow = false): void {
    const g = this.g, img = CRYPT.flame;
    if (!ready(img)) return;
    const fw = img.naturalWidth / 8, fh = img.naturalHeight, fr = Math.floor(now / 83 + seed * 3.7) % 8;
    const w = (h * fw) / fh;
    if (glow) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y - h * 0.4, 2, x, y - h * 0.4, h * 2.4);
      gr.addColorStop(0, `rgba(255,140,50,${(0.3 + 0.05 * Math.sin(now / 90 + seed)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,110,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y - h * 0.4, h * 2.4, 0, 6.3); g.fill(); g.restore();
    }
    g.drawImage(img, fr * fw, 0, fw, fh, x - w / 2, y - h, w, h);
  }

  /** Cosas a ras de suelo en isométrico: braseros volcados y llamas del fuego del suelo. */
  private drawIsoGround(c: CombatState, now: number): void {
    const g = this.g, [sx, sy] = this.shake;
    if (c.round < this.lastRound) this.brazierSeen.clear();
    this.lastRound = c.round;
    for (const k of c.braziers ?? []) this.brazierSeen.add(k);
    // brasero roto: escombros y huesos chamuscados donde estaba
    for (const k of this.brazierSeen) {
      if ((c.braziers ?? []).includes(k)) continue;
      const [x, y] = k.split(',').map(Number) as [number, number], q = this.top(c, x + 0.5, y + 0.5);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(q.x, q.y, 44, 20, 0, 0, 6.3); g.fill();
      if (ready(CRYPT.decals[2] ?? null)) { const d = CRYPT.decals[2]!; g.drawImage(d, q.x - d.naturalWidth / 2, q.y - d.naturalHeight / 2); }
    }
    // fuego: tres llamas por casilla, de atrás adelante, con los turnos que le quedan
    const cells = Object.entries(c.fire ?? {}).map(([k, t]) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y, t }; }).sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const f of cells) {
      const p = isoPoint(f.x + 0.5, f.y + 0.5, c.h);
      for (const [dx, dy, hh] of [[-18, -4, 40], [16, -2, 36], [0, 8, 48]] as const) this.drawFlame(p.x + dx + sx, p.y + dy + sy, hh, now, f.x * 3 + f.y * 5 + dx, dx === 0);
      g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000';
      g.strokeText(String(f.t), p.x + 30 + sx, p.y + 4 + sy); g.fillStyle = '#fff3c0'; g.fillText(String(f.t), p.x + 30 + sx, p.y + 4 + sy);
    }
  }

  /** Luz de las antorchas: halo cálido que parpadea sobre el muro y sobre el suelo de delante, y llama en los soportes apagados. */
  private drawTorchLight(now: number): void {
    const g = this.g;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [i, t] of this.torches.entries()) {
      const fl = 0.85 + 0.15 * Math.sin(now / 110 + i * 1.7) + 0.06 * Math.sin(now / 37 + i);
      // halo en el muro
      let gr = g.createRadialGradient(t.x, t.y, 2, t.x, t.y, 70);
      gr.addColorStop(0, `rgba(255,150,60,${(0.28 * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(t.x - 70, t.y - 70, 140, 140);
      // charco de luz en el suelo, delante del muro (elipse aplastada como el suelo)
      const fx = t.x + t.side * 70, fy = t.y + 150;
      g.save(); g.translate(fx, fy); g.scale(1, 0.5);
      gr = g.createRadialGradient(0, 0, 4, 0, 0, 190);
      gr.addColorStop(0, `rgba(255,140,50,${(0.2 * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,110,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 190, 0, 6.3); g.fill(); g.restore();
    }
    g.restore();
    // llama en los soportes que venían apagados
    for (const [i, t] of this.torches.entries()) {
      if (t.lit) continue;
      this.drawFlame(t.x, t.y + 4, 30, now, i * 3.1);
    }
  }

  /** Un fotograma de una hoja de 8 direcciones, con los pies en el centro de la casilla (x, y) (con decimales). */
  private sheetFrame(c: CombatState, s: Sheet, anim: SheetAnim, frame: number, dir: number, x: number, y: number, alpha = 1, flash = false): void {
    const g = this.g, img = s.img[anim] ?? s.img.idle!, p = this.top(c, x + 0.5, y + 0.5), k = s.scale, sz = s.size;
    // de perfil: una sola fila; mira a la izquierda (W, SW, NW, N) volteando la imagen
    const row = s.dirs === 1 ? 0 : dir, flip = s.dirs === 1 && [4, 5, 6, 7].includes(dir);
    const px = Math.round(p.x), py = Math.round(p.y + ISO_FOOT);
    this.screen(); g.save(); g.globalAlpha = alpha;
    g.translate(px, py); if (flip) g.scale(-1, 1);
    const dx = -s.foot[0] * k, dy = -s.foot[1] * k;
    g.drawImage(img, frame * sz, row * sz, sz, sz, dx, dy, sz * k, sz * k);
    if (flash) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * 0.6; g.drawImage(img, frame * sz, row * sz, sz, sz, dx, dy, sz * k, sz * k); }
    g.restore();
  }

  /** Personaje con hoja de 8 direcciones: ataque, herido, andar o reposo, mirando a su objetivo o al enemigo más cercano. */
  private drawSheetUnit(c: CombatState, u: Unit, s: Pos, sh: Sheet, now: number, moving: boolean): void {
    const pend = this.pendingAct.get(u.id);
    if (pend && now >= pend.t0) { this.acts.set(u.id, pend); this.pendingAct.delete(u.id); }
    // una acción que aún no ha empezado (espera a que acabe de andar) no cuenta todavía
    const ac = this.acts.get(u.id), ak = ac && now >= ac.t0 ? (now - ac.t0) / (ac.ms ?? ACT_MS) : 1, lg = this.lunge.get(u.id), hurt = now - (this.hurtAt.get(u.id) ?? -1e9);
    let dir = this.facing.get(u.id);
    if (ac && ak < 1 && lg) dir = sheetDir(lg.dx, lg.dy);
    else if (moving) { const sg = this.walkSeg.get(u.id); dir = sg ? sheetDir(sg.dx, sg.dy) : sheetDir(u.pos.x - s.x, u.pos.y - s.y); }
    else if (dir === undefined || !(ac && ak < 1.5)) {
      // quieto: mira al rival vivo más cercano
      let best: Unit | undefined, bd = 1e9;
      for (const o of c.units) if (o.hp > 0 && o.team !== u.team) { const d = Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y); if (d < bd) { bd = d; best = o; } }
      if (best) dir = sheetDir(best.pos.x - u.pos.x, best.pos.y - u.pos.y);
    }
    dir ??= 0; this.facing.set(u.id, dir);
    const n = (a: SheetAnim): number => sh.frames[a] ?? 1;
    // reposo: ciclo de ida y vuelta (0 1 2 3 2 1…) y lento, unos 1,2 s por vuelta sea cual sea el número de dibujos
    // (antes 1,2 s por vuelta; ahora unos 3 s, y el creador puede ajustarlo por personaje)
    const en = u.team === 'enemy', ni = n('idle'), idleMs = Math.max(280, 3000 / ni) * animMul(u.kind, 'idle', en), loop = ni > 2 ? ni * 2 - 2 : ni, step = Math.floor((now + u.id * 397) / idleMs) % loop;
    let anim: SheetAnim = 'idle', fr = step < ni ? step : loop - step;
    // hechizos sin daño: animación de lanzar si la hoja la tiene
    // pilares: un dibujo por estado según la vida que le queda
    if (sh.hpFrames) fr = Math.min(ni - 1, Math.floor((1 - Math.max(0, u.hp) / Math.max(1, u.maxHp)) * ni));
    const own = ac?.spell ? sh.spellAnim?.[ac.spell] : undefined;
    if (ac && ak < 1) { anim = (ac.anim as string) === 'phase' && sh.frames.transform ? 'transform' : own && sh.frames[own] ? own : ac.anim !== 'attack' && sh.frames.cast ? 'cast' : 'attack'; fr = Math.min(n(anim) - 1, Math.floor(ak * n(anim))); }
    else if (hurt < 500 * animMul(u.kind, 'hurt', en)) { anim = 'hurt'; fr = Math.min(n('hurt') - 1, Math.floor(hurt / (120 * animMul(u.kind, 'hurt', en)))); }
    else if (moving) {
      // los pasos van con la distancia: un ciclo de andar cada 2 casillas (así los pies no patinan)
      anim = 'walk';
      const sg = this.walkSeg.get(u.id);
      fr = sg ? Math.floor(sg.dist * n('walk') / (2 * animMul(u.kind, 'walk', en))) % n('walk') : Math.floor(now / Math.max(90, 800 / n('walk'))) % n('walk');
    }
    this.sheetFrame(c, sh, anim, fr, dir, s.x, s.y, u.statuses.invis ? 0.4 : 1, this.flashing(u.id, now));
    this.upright(s.x, s.y);
  }

  /** Punto de pantalla (con temblor) del punto del mundo (x, y). */
  private top(c: CombatState, x: number, y: number): { x: number; y: number } {
    const p = isoPoint(x, y, c.h); return { x: p.x + this.shake[0], y: p.y + this.shake[1] };
  }

  /** Imagen con su punto de apoyo (centro de abajo) en el punto del mundo (wx, wy); volteada si flip. */
  private pivot(c: CombatState, img: HTMLImageElement, wx: number, wy: number, flip = false): { x: number; y: number } {
    const p = this.top(c, wx, wy), w = img.naturalWidth, h = img.naturalHeight;
    if (!flip) this.g.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h));
    else { this.g.save(); this.g.translate(Math.round(p.x + w / 2), Math.round(p.y - h)); this.g.scale(-1, 1); this.g.drawImage(img, 0, 0); this.g.restore(); }
    return p;
  }

  /** Sala de este combate (se genera una vez por semilla). */
  private room: RoomLook | null = null;
  /** semilla fija de la decoración (editor de salas: que no cambie al colocar cosas) */
  roomSeed: number | null = null;
  private roomFor(c: CombatState): RoomLook {
    const zone = this.session.run?.zone ?? 0;
    if (this.roomSeed !== null) { const s = (this.roomSeed + zone) >>> 0; if (!this.room || this.room.seed !== s || this.room.floor.length !== c.w * c.h) this.room = buildRoom(s, c.w, c.h, zone); return this.room; }
    const run = this.session.run;
    // semilla estable durante el combate: partida, zona, sala y tamaño del mapa
    let s = 2166136261;
    for (const ch of `${run?.code ?? ''}|${run?.zone ?? 0}|${run?.step ?? 0}|${c.w}x${c.h}|${c.units.length}`) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
    if (!this.room || this.room.seed !== s >>> 0 || this.room.floor.length !== c.w * c.h) this.room = buildRoom(s >>> 0, c.w, c.h, zone);
    return this.room;
  }

  /** Suelo de la sala, marcas, borde y tono de la zona. */
  private drawCryptFloor(c: CombatState, room: RoomLook): void {
    const g = this.g, pit = new Set([...(c.abyss ?? []), ...(c.voids ?? [])]);
    // borde de roca bajo los dos lados de delante del tablero
    const [sx, sy] = this.shake, D = 34, P = (x: number, y: number): [number, number] => { const q = isoPoint(x, y, c.h); return [q.x + sx, q.y + sy]; };
    const [lx, ly] = P(0, c.h), [bx, by] = P(c.w, c.h), [rx, ry] = P(c.w, 0);
    for (const [ax, ay, cx2, cy2, col] of [[lx, ly, bx, by, '#2a2a33'], [bx, by, rx, ry, '#1c1c24']] as const) {
      const gr = g.createLinearGradient(0, Math.min(ay, cy2), 0, Math.max(ay, cy2) + D); gr.addColorStop(0, col); gr.addColorStop(1, '#050507');
      g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx2, cy2); g.lineTo(cx2, cy2 + D); g.lineTo(ax, ay + D); g.closePath(); g.fill();
    }
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        if (pit.has(`${x},${y}`)) continue;
        const img = room.floor[y * c.w + x];
        if (!img || !ready(img)) continue;
        const p = this.top(c, x, y);
        g.drawImage(img, Math.round(p.x - ISO_W / 2), Math.round(p.y));
      }
    for (const d of room.decals) {
      if (!d.img || !ready(d.img) || pit.has(`${d.x},${d.y}`)) continue;
      const p = this.top(c, d.x + 0.5, d.y + 0.5);
      g.drawImage(d.img, Math.round(p.x - d.img.naturalWidth / 2), Math.round(p.y - d.img.naturalHeight / 2));
    }
  }

  /** Muros del fondo (fila de arriba y columna de la izquierda), con arcos, puertas y antorchas. */
  private drawCryptWalls(c: CombatState, room: RoomLook): void {
    this.torches = [];
    const T = 0.25;
    // de atrás adelante: la esquina, y luego los tramos por x + y
    // salas creadas: sin muro del fondo donde la casilla del borde está fuera de la sala
    const out = new Set(c.voids ?? []), edgeOut = (side: 'x' | 'y', i: number): boolean => out.has(side === 'x' ? `${i},0` : `0,${i}`);
    if (ready(CRYPT.corner) && !out.has('0,0')) this.pivot(c, CRYPT.corner, 0, 0);
    const order = [...room.walls].sort((a, b) => a.i - b.i);
    for (const wl of order) {
      if (edgeOut(wl.side, wl.i)) continue;
      const isX = wl.side === 'x';
      // tramo a lo largo de x en la línea y = −T (pie en (i + 1, 0)); a lo largo de y en x = −T (pie en (0, i + 1))
      const wx = isX ? wl.i + 1 : -T + T, wy = isX ? 0 : wl.i + 1;
      const base = wl.kind === 'wall' ? (isX ? CRYPT.wallX : CRYPT.wallY) : (isX ? CRYPT.doorwayX : CRYPT.doorwayY);
      if (!ready(base)) continue;
      this.pivot(c, base, wx, wy);
      const door = wl.kind === 'closed' ? (isX ? CRYPT.doorClosedX : CRYPT.doorClosedY) : wl.kind === 'open' ? (isX ? CRYPT.doorOpenX : CRYPT.doorOpenY) : null;
      if (door && ready(door)) this.pivot(c, door, wx, wy);
    }
    // antorchas: pintadas para muros a lo largo de y; volteadas para los de x
    for (const tc of room.torches) {
      if (!ready(CRYPT.torch) || edgeOut(tc.side, tc.i)) continue;
      const isX = tc.side === 'x', wx = isX ? tc.i + 1 : 1, wy = isX ? 1 : tc.i + 1;
      const p = this.pivot(c, CRYPT.torch, wx, wy, isX);
      this.torches.push({ x: p.x + (isX ? -TORCH_FLAME[0] : TORCH_FLAME[0]), y: p.y + TORCH_FLAME[1] + 3, side: isX ? -1 : 1, lit: false });
    }
  }

  /** Bosque: suelo de tierra en perspectiva, borde de tierra y manchas de hierba, musgo y hojas. */
  private drawForestFloor(c: CombatState, room: RoomLook): void {
    const g = this.g, pit = new Set([...(c.abyss ?? []), ...(c.voids ?? [])]);
    const [sx, sy] = this.shake, D = 30, P = (x: number, y: number): [number, number] => { const q = isoPoint(x, y, c.h); return [q.x + sx, q.y + sy]; };
    const [lx, ly] = P(0, c.h), [bx, by] = P(c.w, c.h), [rx, ry] = P(c.w, 0);
    const bio = this.biome!;
    for (const [ax, ay, cx2, cy2, col] of [[lx, ly, bx, by, bio.rim[0]], [bx, by, rx, ry, bio.rim[1]]] as const) {
      const gr = g.createLinearGradient(0, Math.min(ay, cy2), 0, Math.max(ay, cy2) + D); gr.addColorStop(0, col); gr.addColorStop(1, '#050504');
      g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx2, cy2); g.lineTo(cx2, cy2 + D); g.lineTo(ax, ay + D); g.closePath(); g.fill();
    }
    // la textura (256 px) cubre 4×4 casillas
    if ((!this.groundPattern || this.patternOf !== bio.ground) && bio.ground) { this.groundPattern = g.createPattern(bio.ground, 'repeat'); this.groundPattern?.setTransform(new DOMMatrix().scale((TILE * 4) / 256)); this.patternOf = bio.ground; }
    this.ground();
    if (this.groundPattern) g.fillStyle = this.groundPattern;
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (!pit.has(`${x},${y}`)) g.fillRect(x * TILE - 0.5, y * TILE - 0.5, TILE + 1, TILE + 1);
    this.screen();
    for (const d of room.patches) {
      const img = bio.patches[d.i % bio.patches.length];
      if (!img || pit.has(`${Math.floor(d.x)},${Math.floor(d.y)}`)) continue;
      const p = this.top(c, d.x, d.y), w = img.naturalWidth, h = img.naturalHeight;
      if (d.flip) { g.save(); g.translate(Math.round(p.x + w / 2), Math.round(p.y - h / 2)); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore(); }
      else g.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h / 2));
    }
  }

  /** Bosque: árboles grandes y oscuros detrás de los dos lados del fondo. */
  private drawForestEdge(c: CombatState, room: RoomLook): void {
    this.torches = [];
    const g = this.g, out = new Set(c.voids ?? []);
    const bio = this.biome!;
    for (const tr of room.trees) {
      const img = bio.border[tr.i % bio.border.length];
      if (!img) continue;
      // donde la sala no llega (forma de las salas creadas) no hace falta borde
      const ex = Math.max(0, Math.min(c.w - 1, Math.round(tr.x))), ey = Math.max(0, Math.min(c.h - 1, Math.round(tr.y)));
      if (out.has(`${ex},${ey}`)) continue;
      const p = this.top(c, tr.x, tr.y), w = img.naturalWidth, h = img.naturalHeight;
      if (tr.flip) { g.save(); g.translate(Math.round(p.x + w / 2), Math.round(p.y - h + 10)); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore(); }
      else g.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h + 10));
    }
    // niebla baja entre los troncos
    const [ax, ay] = [this.top(c, 0, 0).x, this.top(c, 0, 0).y];
    const gr = g.createRadialGradient(ax, ay, 40, ax, ay, 520); gr.addColorStop(0, 'rgba(10,14,12,.55)'); gr.addColorStop(1, 'rgba(10,14,12,0)');
    g.fillStyle = gr; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Bosque: obstáculo de la casilla (árbol, tocón, roca, tronco caído, helecho…), con el tronco en el centro. */
  private drawForestObstacle(c: CombatState, x: number, y: number, seed: number): void {
    const bio = this.biome!, zp = bio.mixProps ? ZONE_PROPS[this.session.run?.zone ?? 0] ?? [] : [];
    const all = [...bio.props, ...zp], it = pick(all, x * 7 + seed, y * 3 + (seed >>> 4));
    if (!it) return;
    // los del pack de objetos se colocan como siempre
    if (zp.includes(it) && !bio.props.includes(it)) { this.drawCryptObstacle(c, x, y, seed, it); return; }
    const g = this.g, q = this.top(c, x + 0.5, y + 0.5), w = it.naturalWidth, h = it.naturalHeight;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(q.x, q.y + 6, Math.min(44, w * 0.32), 15, 0, 0, 6.3); g.fill();
    // si tapa a alguien que está detrás, se ve a través
    const behind = c.units.some((u) => u.hp > 0 && u.pos.x + u.pos.y < x + y && x + y - (u.pos.x + u.pos.y) <= 3 && Math.abs(u.pos.x - u.pos.y - (x - y)) <= 2);
    if (behind && h > 90) g.globalAlpha = 0.5;
    g.drawImage(it, Math.round(q.x - w / 2), Math.round(q.y + 14 - h));
    g.globalAlpha = 1;
  }

  /** Ceniza: chispas que suben desde el suelo y brillo de las grietas. */
  private drawEmbers(c: CombatState, now: number): void {
    const g = this.g, n = Math.round(c.w * c.h * 0.14);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const s1 = (i * 9301 + 49297) % 233280 / 233280, s2 = (i * 4421 + 1663) % 3571 / 3571, per = 3200 + (i % 7) * 400;
      const k = ((now + i * 811) % per) / per, p = this.top(c, s1 * c.w + Math.sin(now / 900 + i) * 0.15, s2 * c.h);
      const lift = 6 + k * 120, a = Math.sin(k * Math.PI) * 0.8, rad = 2.2 + (i % 3);
      const gr = g.createRadialGradient(p.x, p.y - lift, 0, p.x, p.y - lift, rad * 2.5); gr.addColorStop(0, `rgba(255,170,60,${a.toFixed(2)})`); gr.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - lift, rad * 2.5, 0, 6.3); g.fill();
    }
    // las grietas de lava laten
    const room = this.room, bio = this.biome;
    if (room && bio) for (const d of room.patches) {
      const p = this.top(c, d.x, d.y), a = 0.1 + 0.07 * Math.sin(now / 420 + d.i);
      const gr = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, 70); gr.addColorStop(0, `rgba(255,110,30,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, 70, 0, 6.3); g.fill();
    }
    g.restore();
  }

  /** Bosque: luciérnagas que van y vienen sobre el tablero. */
  private drawFireflies(c: CombatState, now: number): void {
    const g = this.g, n = Math.round(c.w * c.h * 0.08);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const s1 = (i * 9301 + 49297) % 233280 / 233280, s2 = (i * 4421 + 1663) % 3571 / 3571;
      const fx = s1 * c.w + Math.sin(now / (2400 + i * 37) + i) * 0.6, fy = s2 * c.h + Math.cos(now / (2900 + i * 53) + i * 2) * 0.6;
      const p = this.top(c, fx, fy), lift = 30 + 25 * Math.sin(now / 1700 + i * 1.7), a = 0.35 + 0.35 * Math.sin(now / 300 + i * 2.3);
      if (a <= 0.05) continue;
      const gr = g.createRadialGradient(p.x, p.y - lift, 0, p.x, p.y - lift, 9); gr.addColorStop(0, `rgba(210,255,120,${a.toFixed(2)})`); gr.addColorStop(1, 'rgba(160,255,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - lift, 9, 0, 6.3); g.fill();
    }
    g.restore();
  }

  /** Obstáculo: un objeto de la zona (barriles, lápidas, estatuas, jaulas…), distinto en cada sala. */
  private drawCryptObstacle(c: CombatState, x: number, y: number, seed: number, img?: HTMLImageElement): void {
    const list = ZONE_PROPS[this.session.run?.zone ?? 0] ?? ZONE_PROPS[0]!, it = img ?? pick(list, x * 7 + seed, y * 3 + (seed >>> 4));
    if (!it || !ready(it)) return;
    const g = this.g, q = this.top(c, x + 0.5, y + 0.5);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(q.x, q.y + 4, 36, 16, 0, 0, 6.3); g.fill();
    this.pivot(c, it, x + 1, y + 1);
    if (LIT_PROPS.has(it)) {
      const now = performance.now(), ly = q.y - it.naturalHeight * 0.75;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(q.x, ly, 2, q.x, ly, 110);
      gr.addColorStop(0, `rgba(255,170,70,${(0.22 + 0.04 * Math.sin(now / 100 + x * 3)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,130,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(q.x, ly, 110, 0, 6.3); g.fill(); g.restore();
    }
  }

  /** Brasero: cuenco de hierro con llamas; se rompe con un golpe y deja una línea de fuego. */
  /** Cercado de púas del Arquitecto: cristales de runas azules. */
  private drawFence(x: number, y: number, now: number): void {
    const g = this.g, bx = x * TILE, by = y * TILE;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(bx + TILE / 2, by + TILE * 0.82, TILE * 0.42, TILE * 0.14, 0, 0, 6.3); g.fill();
    const glow = 0.6 + 0.3 * Math.sin(now / 260 + x * 2 + y);
    for (const [ox, h, w] of [[0.18, 0.62, 0.2], [0.42, 0.85, 0.24], [0.68, 0.55, 0.2]] as const) {
      const cx = bx + TILE * (ox + w / 2), top = by + TILE * (0.85 - h), base = by + TILE * 0.85;
      g.fillStyle = '#1a3a70'; g.beginPath(); g.moveTo(cx - TILE * w / 2, base); g.lineTo(cx, top); g.lineTo(cx + TILE * w / 2, base); g.closePath(); g.fill();
      g.fillStyle = `rgba(110,200,255,${glow.toFixed(2)})`; g.beginPath(); g.moveTo(cx - TILE * w / 4, base); g.lineTo(cx, top + 4); g.lineTo(cx + 1, base); g.closePath(); g.fill();
      g.fillStyle = '#e0f4ff'; g.fillRect(cx - 1, top + TILE * h * 0.45, 2, 4);
    }
  }

  private drawBrazier(x: number, y: number, now: number): void {
    const g = this.g, cx = (x + 0.5) * TILE, base = (y + 1) * TILE - 8;
    const sh = g.createRadialGradient(cx, base, 1, cx, base, TILE * 0.35); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(cx, base, TILE * 0.35, 8, 0, 0, 6.3); g.fill();
    const glow = g.createRadialGradient(cx, base - 30, 2, cx, base - 30, TILE * 0.7);
    glow.addColorStop(0, 'rgba(255,140,40,.35)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, base - 30, TILE * 0.7, 0, 6.3); g.fill();
    g.fillStyle = '#2a2420'; g.fillRect(cx - 3, base - 18, 6, 16); g.fillRect(cx - 12, base - 3, 24, 4);
    g.fillStyle = '#4a4038'; g.beginPath(); g.moveTo(cx - 16, base - 24); g.lineTo(cx + 16, base - 24); g.lineTo(cx + 10, base - 14); g.lineTo(cx - 10, base - 14); g.fill();
    g.fillStyle = '#8a7a68'; g.fillRect(cx - 16, base - 26, 32, 3);
    for (let i = 0; i < 3; i++) {
      const fx = cx - 9 + i * 9, fl = 12 + 5 * Math.sin(now / 80 + i * 2 + x);
      g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(fx - 6, base - 25); g.quadraticCurveTo(fx, base - 25 - fl * 1.6, fx + 6, base - 25); g.fill();
      g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(fx - 3, base - 25); g.quadraticCurveTo(fx, base - 25 - fl, fx + 3, base - 25); g.fill();
    }
  }

  private draw(): void {
    const c = this.c;
    const g = this.g;
    if (!c) return;
    const size = this.iso ? isoSize(c.w, c.h) : { w: c.w * TILE, h: c.h * TILE + PAD };
    if (this.canvas.width !== size.w || this.canvas.height !== size.h) {
      this.canvas.width = size.w;
      this.canvas.height = size.h;
      this.shown.clear();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07050a';
    if (this.iso) g.fillRect(0, 0, size.w, size.h); else g.fillRect(0, 0, this.canvas.width, PAD);
    const now = performance.now();
    // H6: temblor de pantalla de los golpes fuertes
    this.shake = this.fx.offset(now);
    g.imageSmoothingEnabled = !this.iso;
    const bio = biomeOf(this.session.run?.zone);
    this.biome = bio;
    this.forest = !!bio;
    const forest = !!bio;
    this.isoFloor = this.iso && (forest || cryptReady());
    if (this.isoFloor) {
      const room = this.roomFor(c);
      if (forest) { this.drawForestFloor(c, room); this.drawForestEdge(c, room); } else { this.drawCryptFloor(c, room); this.drawCryptWalls(c, room); }
      // tono de la zona sobre suelo y muros
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = bio ? bio.tint : ZONE_TINT[this.session.run?.zone ?? 0] ?? ZONE_TINT[0]!;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height); g.restore();
      this.drawTorchLight(now);
      if (bio?.fx === 'fireflies') this.drawFireflies(c, now);
      else if (bio?.fx === 'embers') this.drawEmbers(c, now);
    }
    this.ground();
    const zone = ZONES[this.session.run?.zone ?? 0] ?? ZONES[0]!;
    this.drawFloor(c, zone, now);
    if (this.isoFloor) { this.screen(); this.drawIsoGround(c, now); this.ground(); }
    const me0 = this.session.myUnit();
    for (const k of c.puddles ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      g.fillStyle = 'rgba(70,200,90,.38)'; g.beginPath(); g.ellipse((x + 0.5) * TILE, (y + 0.6) * TILE, TILE * 0.42, TILE * 0.28, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(190,255,150,.35)'; g.beginPath(); g.ellipse((x + 0.42) * TILE, (y + 0.55) * TILE, TILE * 0.14, TILE * 0.07, 0, 0, 6.3); g.fill();
    }
    // aliados caídos: charco, lápida y su nombre donde cayeron
    for (const d of c.units.filter((x) => x.hp <= 0 && x.team === 'hero' && x.summoner === undefined && x.ai !== 'decoy' && !c.units.some((o) => o.hp > 0 && o.pos.x === x.pos.x && o.pos.y === x.pos.y))) {
      this.upright(d.pos.x, d.pos.y);
      const cx = (d.pos.x + 0.5) * TILE, cy = (d.pos.y + 0.5) * TILE;
      g.fillStyle = 'rgba(110,10,18,.55)'; g.beginPath(); g.ellipse(cx + 3, cy + 12, TILE * 0.36, TILE * 0.17, 0.2, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, cy + 14, 13, 4, 0, 0, 6.3); g.fill();
      // lápida
      g.fillStyle = '#1a1714'; g.fillRect(cx - 10, cy - 12, 20, 26); g.beginPath(); g.arc(cx, cy - 12, 10, Math.PI, 0); g.fill();
      g.fillStyle = '#7a7268'; g.fillRect(cx - 8, cy - 11, 16, 23); g.beginPath(); g.arc(cx, cy - 11, 8, Math.PI, 0); g.fill();
      g.fillStyle = '#9c948a'; g.fillRect(cx - 8, cy - 11, 3, 23);
      g.fillStyle = '#3a342e'; g.fillRect(cx - 1, cy - 14, 3, 13); g.fillRect(cx - 5, cy - 10, 11, 3);
      g.font = 'bold 9px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(`✝ ${d.name}`, cx, cy + 24); g.fillStyle = '#ff9a9a'; g.fillText(`✝ ${d.name}`, cx, cy + 24);
    }
    // marcadores en el suelo (esferas oscuras…); los que flotan o están de pie no se deforman
    for (const m of c.marks ?? []) {
      if (['sphere', 'shadow', 'flame', 'soul', 'lantern'].includes(m.kind)) this.upright(m.pos.x, m.pos.y); else this.ground();
      const cx = (m.pos.x + 0.5) * TILE, cy = (m.pos.y + 0.45) * TILE, pulse = 1 + Math.sin(performance.now() / 260 + m.id) * 0.06;
      if (m.kind === 'sphere') {
        // esfera oscura como en la ficha: halo violeta, anillo claro y núcleo brillante que flota
        const fy = cy + Math.sin(now / 300 + m.id) * 3;
        const gl = g.createRadialGradient(cx, fy, 2, cx, fy, TILE * 0.42 * pulse);
        gl.addColorStop(0, 'rgba(200,150,255,.55)'); gl.addColorStop(1, 'rgba(122,63,192,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(cx, fy, TILE * 0.42 * pulse, 0, 6.3); g.fill();
        g.fillStyle = '#2a1050'; g.beginPath(); g.arc(cx, fy, TILE * 0.19, 0, 6.3); g.fill();
        g.strokeStyle = '#b07cff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, fy, TILE * 0.19, 0, 6.3); g.stroke();
        g.fillStyle = '#9a5cf0'; g.beginPath(); g.arc(cx, fy, TILE * 0.11 * pulse, 0, 6.3); g.fill();
        g.fillStyle = '#f6eaff'; g.beginPath(); g.arc(cx - 2, fy - 2, TILE * 0.05, 0, 6.3); g.fill();
      } else if (m.kind === 'shadow') {
        // la Sombra: un clon oscuro del Acechador, quieto en su casilla
        const o = c.units.find((x) => x.id === m.owner);
        const sk = o && this.spins.has(o.id) ? (now - this.spins.get(o.id)!) / SPIN_MS : 1;
        if (o) drawUnit(g, o.kind, o.team, 0, cx, (m.pos.y + 1) * TILE - 6, TILE, { anim: sk < 1 ? 'attack' : 'idle', frame: sk < 1 ? Math.floor(sk * ANIM_FRAMES.attack) : Math.floor(now / 260) % ANIM_FRAMES.idle, tint: 'shadow', alpha: 0.85, flip: sk < 1 ? Math.floor(sk * 6) % 2 === 0 : this.faceLeft.get(o.id) ?? false });
      } else if (m.kind === 'flame') {
        // llama azul del Fuego zorruno
        const fy = cy + Math.sin(now / 160 + m.id) * 3, fl = 1 + Math.sin(now / 90 + m.id) * 0.12;
        g.fillStyle = 'rgba(74,208,255,.25)'; g.beginPath(); g.arc(cx, fy, TILE * 0.26, 0, 6.3); g.fill();
        g.fillStyle = '#2a7ad8'; g.beginPath(); g.moveTo(cx - 7, fy + 6); g.quadraticCurveTo(cx, fy - 16 * fl, cx + 7, fy + 6); g.fill();
        g.fillStyle = '#7ae8ff'; g.beginPath(); g.moveTo(cx - 4, fy + 5); g.quadraticCurveTo(cx, fy - 9 * fl, cx + 4, fy + 5); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(cx - 1, fy, 2, 4);
        continue;
      } else if (m.kind === 'cage') {
        // muro espectral de La caja
        const X = m.pos.x * TILE, Y = m.pos.y * TILE;
        g.fillStyle = 'rgba(127,224,176,.16)'; g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.strokeStyle = `rgba(160,255,210,${0.55 + 0.25 * Math.sin(now / 200 + m.id)})`; g.lineWidth = 2;
        for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(X + (i * TILE) / 4, Y + 6); g.lineTo(X + (i * TILE) / 4, Y + TILE - 6); g.stroke(); }
        g.strokeRect(X + 5, Y + 5, TILE - 10, TILE - 10);
        continue;
      } else if (m.kind === 'soul') {
        // alma suelta: un fuego fatuo verdoso
        const fy = cy + Math.sin(now / 300 + m.id) * 4;
        g.fillStyle = 'rgba(140,240,210,.25)'; g.beginPath(); g.arc(cx, fy, TILE * 0.2, 0, 6.3); g.fill();
        g.fillStyle = '#9af0d0'; g.beginPath(); g.arc(cx, fy, 5, 0, 6.3); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(cx - 2, fy - 2, 3, 3);
        continue;
      } else if (m.kind === 'lantern') {
        g.fillStyle = 'rgba(127,224,90,.18)'; g.beginPath(); g.arc(cx, cy + 4, TILE * 0.45 * pulse, 0, 6.3); g.fill();
        g.fillStyle = '#6a6a78'; g.fillRect(cx - 1, cy - TILE * 0.3, 2, TILE * 0.12);
        g.fillStyle = '#3a3a2a'; g.fillRect(cx - TILE * 0.14, cy - TILE * 0.18, TILE * 0.28, TILE * 0.36);
        g.fillStyle = '#7fe05a'; g.fillRect(cx - TILE * 0.08, cy - TILE * 0.1, TILE * 0.16, TILE * 0.2 * pulse);
        g.fillStyle = '#e0ffb0'; g.fillRect(cx - 2, cy - 2, 4, 4);
      } else if (m.kind === 'glyph' || m.kind === 'gravglyph') {
        // glifos del Arquitecto: círculo rúnico que gira (fulminante cian, matriz magenta, gravedad violeta)
        const col = m.sub === 'matriz' ? '255,90,220' : m.kind === 'gravglyph' ? '170,110,255' : '90,210,255';
        const rot = now / (m.sub === 'matriz' ? 700 : 1100) + m.id;
        const r = TILE * (m.sub === 'matriz' ? 0.42 : 0.34);
        const gy = (m.pos.y + 0.55) * TILE;
        const gl = g.createRadialGradient(cx, gy, 2, cx, gy, r * 1.2); gl.addColorStop(0, `rgba(${col},.35)`); gl.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gl; g.beginPath(); g.arc(cx, gy, r * 1.2, 0, 6.3); g.fill();
        g.save(); g.translate(cx, gy); g.scale(1, 0.62); g.rotate(rot);
        g.strokeStyle = `rgba(${col},.95)`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, 6.3); g.stroke();
        g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= (m.sub === 'matriz' ? 6 : 4); i++) { const a = (i / (m.sub === 'matriz' ? 6 : 4)) * 6.283; const px = Math.cos(a) * r * 0.8, py = Math.sin(a) * r * 0.8; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke();
        g.fillStyle = `rgba(${col},1)`; for (let i = 0; i < 4; i++) { const a = i * 1.571; g.fillRect(Math.cos(a) * r - 2, Math.sin(a) * r - 2, 4, 4); }
        g.restore();
      } else if (m.kind === 'inertia') {
        g.fillStyle = `rgba(80,170,255,${(0.12 + 0.05 * Math.sin(now / 400)).toFixed(3)})`; g.fillRect(m.pos.x * TILE + 2, m.pos.y * TILE + 2, TILE - 4, TILE - 4);
        g.strokeStyle = 'rgba(140,210,255,.45)'; g.setLineDash([4, 4]); g.strokeRect(m.pos.x * TILE + 3, m.pos.y * TILE + 3, TILE - 6, TILE - 6); g.setLineDash([]);
      } else if (m.kind === 'smoke') {
        for (let i = 0; i < 4; i++) { const a = now / 900 + i * 1.6 + m.id; g.fillStyle = 'rgba(150,120,190,.32)'; g.beginPath(); g.arc(cx + Math.cos(a) * 9, (m.pos.y + 0.5) * TILE + Math.sin(a) * 6, TILE * 0.24, 0, 6.3); g.fill(); }
      } else if (m.kind === 'omen') {
        // G3.1: ataque anunciado del jefe: casilla roja que late; estalla al empezar su siguiente turno
        const X = m.pos.x * TILE, Y = m.pos.y * TILE, a = 0.22 + 0.14 * Math.sin(now / 160 + m.id);
        g.fillStyle = `rgba(255,40,40,${a.toFixed(3)})`; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.strokeStyle = 'rgba(255,90,70,.9)'; g.lineWidth = 2; g.strokeRect(X + 3, Y + 3, TILE - 6, TILE - 6);
        g.save(); g.beginPath(); g.rect(X + 3, Y + 3, TILE - 6, TILE - 6); g.clip();
        g.strokeStyle = 'rgba(255,120,90,.35)'; g.lineWidth = 2;
        for (let k = -TILE; k < TILE; k += 10) { g.beginPath(); g.moveTo(X + k, Y + TILE); g.lineTo(X + k + TILE, Y); g.stroke(); }
        g.restore();
        g.save(); g.fillStyle = '#ffe0d0'; g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText('!', cx, cy + 6); g.restore();
        continue;
      } else if (m.kind === 'fence') {
        // se dibuja como obstáculo (drawFence)
      } else {
        g.strokeStyle = '#c8c8ff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, TILE * 0.2, 0, 6.3); g.stroke();
      }
      if (m.kind !== 'inertia' && m.kind !== 'smoke' && m.kind !== 'fence' && m.kind !== 'gravglyph') { g.fillStyle = '#f0d8ff'; g.font = 'bold 11px monospace'; g.fillText(String(m.turns), m.pos.x * TILE + TILE - 14, m.pos.y * TILE + 14); }
    }
    this.ground();
    for (const t of c.snares ?? []) {
      // los cepos rivales no se ven
      if (me0 && t.team !== me0.team) continue;
      const [x, y] = t.k.split(',').map(Number) as [number, number];
      if (t.burn) {
        // mina de proximidad: disco metálico con luces rojas
        const mx = (x + 0.5) * TILE, my = (y + 0.6) * TILE;
        g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(mx, my, TILE * 0.24, TILE * 0.14, 0, 0, 6.3); g.fill();
        g.fillStyle = '#4a4a54'; g.beginPath(); g.ellipse(mx, my - 3, TILE * 0.17, TILE * 0.09, 0, 0, 6.3); g.fill();
        const on = Math.sin(now / 200) > 0;
        g.fillStyle = on ? '#ff3a3a' : '#7a1a1a'; for (const dx of [-8, 0, 8]) g.fillRect(mx + dx - 1.5, my + 1, 3, 3);
        continue;
      }
      g.strokeStyle = '#d8b060'; g.lineWidth = 3; g.beginPath(); g.arc((x + 0.5) * TILE, (y + 0.6) * TILE, TILE * 0.26, 0, 6.3); g.stroke();
      g.fillStyle = '#d8b060'; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.fillRect((x + 0.5) * TILE + Math.cos(a) * TILE * 0.26 - 2, (y + 0.6) * TILE + Math.sin(a) * TILE * 0.26 - 2, 4, 4); }
    }
    if (this.isoFloor && ready(CRYPT.spikes)) {
      // isométrico: placa de púas del pack con un brillo rojo que late
      this.screen();
      for (const k of c.traps ?? []) {
        const [x, y] = k.split(',').map(Number) as [number, number], q = this.top(c, x + 0.5, y + 0.5);
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,50,40,${(0.12 + 0.08 * Math.sin(now / 240 + x + y)).toFixed(3)})`;
        g.beginPath(); g.ellipse(q.x, q.y, 54, 26, 0, 0, 6.3); g.fill(); g.restore();
        this.pivot(c, CRYPT.spikes, x + 1, y + 1);
      }
      this.ground();
    }
    for (const k of this.isoFloor && ready(CRYPT.spikes) ? [] : c.traps ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      // púas: placa hundida con borde rojo encendido y pinchos con brillo
      g.fillStyle = '#1a0c10'; g.fillRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
      g.strokeStyle = `rgba(255,80,70,${0.55 + 0.25 * Math.sin(now / 240 + x + y)})`; g.lineWidth = 2; g.strokeRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const px = x * TILE + 12 + i * 13, py = y * TILE + 15 + j * 13;
        g.fillStyle = '#8a8098'; g.beginPath(); g.moveTo(px, py + 5); g.lineTo(px + 4, py - 6); g.lineTo(px + 8, py + 5); g.fill();
        g.fillStyle = '#f0ecff'; g.fillRect(px + 3, py - 4, 2, 4);
      }
    }
    const me = this.session.myUnit();
    const cur = current(c);
    const fill = (p: Pos, color: string): void => { g.fillStyle = color; g.fillRect(p.x * TILE + 3, p.y * TILE + 3, TILE - 6, TILE - 6); };
    if (c.deploy) {
      // casillas de inicio: azules y con pulso, bien visibles (al estilo Dofus)
      const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 300);
      for (const k of c.deploy.cells) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        fill({ x, y }, `rgba(60,140,255,${(0.28 * pulse + 0.12).toFixed(3)})`);
        g.strokeStyle = `rgba(150,200,255,${pulse.toFixed(3)})`; g.lineWidth = 2; g.strokeRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
        g.fillStyle = 'rgba(210,235,255,.85)'; g.beginPath(); g.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 3, 0, Math.PI * 2); g.fill();
      }
      if (me) { g.strokeStyle = '#5fcf70'; g.lineWidth = 3; g.strokeRect(me.pos.x * TILE + 2, me.pos.y * TILE + 2, TILE - 4, TILE - 4); }
    }
    // Red de implosión: casillas interiores de cada conexión entre Semillas oscuras (violeta, solo filas y columnas)
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
    for (const owner of c.units.filter((x) => x.hp > 0 && x.spells.some((sp) => sp.id === 't_implosion'))) {
      for (const l of seedLinks(c, owner)) {
        const a = c.units.find((x) => x.id === l.a), b = c.units.find((x) => x.id === l.b);
        if (!a || !b) continue;
        for (const p of l.cells) { fill(p, `rgba(170,80,255,${(0.16 + 0.12 * pulse).toFixed(3)})`); g.strokeStyle = 'rgba(200,140,255,.55)'; g.lineWidth = 2; g.strokeRect(p.x * TILE + 6, p.y * TILE + 6, TILE - 12, TILE - 12); }
        // rayo de semilla a semilla por el centro de las casillas
        g.save(); g.strokeStyle = `rgba(225,180,255,${(0.55 + 0.35 * pulse).toFixed(3)})`; g.lineWidth = 5; g.shadowColor = '#b060ff'; g.shadowBlur = 12;
        g.beginPath(); g.moveTo((a.pos.x + 0.5) * TILE, (a.pos.y + 0.5) * TILE); g.lineTo((b.pos.x + 0.5) * TILE, (b.pos.y + 0.5) * TILE); g.stroke(); g.restore();
      }
    }
    if (me && cur?.id === me.id && !c.over) {
      const def = this.sel ? spellOf(me, this.sel) : undefined;
      // Implosión: solo se marcan tus semillas; al pasar por encima de una, su red y todo lo que alcanzará
      if (def?.special === 'implode') {
        for (const sd of c.units.filter((x) => x.hp > 0 && x.seed !== undefined && x.summoner === me.id)) { g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.strokeRect(sd.pos.x * TILE + 4, sd.pos.y * TILE + 4, TILE - 8, TILE - 8); }
        const hv = this.hover ? c.units.find((x) => x.hp > 0 && x.seed !== undefined && x.summoner === me.id && x.pos.x === this.hover!.x && x.pos.y === this.hover!.y) : undefined;
        if (hv) {
          const pv = implodePreview(c, me, hv.id);
          for (const p of pv.blast) fill(p, 'rgba(255,60,60,.24)');
          for (const p of pv.lines) fill(p, 'rgba(255,90,200,.32)');
          for (const p of pv.seeds) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 4; g.strokeRect(p.x * TILE + 3, p.y * TILE + 3, TILE - 6, TILE - 6); }
        }
      } else if (def) {
        for (let y = 0; y < c.h; y++)
          for (let x = 0; x < c.w; x++) {
            const p = { x, y }, d = dist(me.pos, p);
            // el alcance extra (Ojo de halcón y similares) cuenta en cuanto se aplica
            const reach = def.range[1] + (def.range[1] > 1 ? me.statuses.reach?.stacks ?? 0 : 0);
            if (d < def.range[0] || d > reach || c.obstacles.includes(`${x},${y}`)) continue;
            // solo las casillas que respetan la geometría del hechizo: línea recta y línea de visión
            if (def.straight && d > 0 && x !== me.pos.x && y !== me.pos.y) continue;
            if (def.los && d > 1 && !hasLineOfSight(c, me.pos, p)) continue;
            fill(p, 'rgba(255,150,60,.18)');
            if (!castProblem(c, me, SPELLS[def.id]!, p)) { g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.strokeRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8); }
          }
        if (this.hover && def.cone && !castProblem(c, me, SPELLS[def.id]!, this.hover)) for (const p of coneCells(me.pos, this.hover, def.cone)) if (!c.obstacles.includes(`${p.x},${p.y}`)) fill(p, 'rgba(255,60,60,.25)');
        // área: alrededor de la casilla del ratón, o de ti si la habilidad es sobre ti
        const ac = def.range[1] === 0 ? me.pos : this.hover;
        if (ac && def.area) {
          for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if ((def.square ? Math.max(Math.abs(x - ac.x), Math.abs(y - ac.y)) : dist({ x, y }, ac)) <= def.area && !(x === me.pos.x && y === me.pos.y && def.range[1] === 0)) fill({ x, y }, 'rgba(255,60,60,.2)');
        }
      } else {
        const reach = reachable(c, me.pos, usableMp(c, me));
        for (const [k, cost] of reach.cost) {
          if (!cost) continue;
          const [x, y] = k.split(',').map(Number) as [number, number];
          fill({ x, y }, 'rgba(120,255,170,.24)');
          // borde iluminado en el contorno de la zona de movimiento
          g.strokeStyle = 'rgba(200,255,215,.95)'; g.lineWidth = 3;
          const edge = (nx: number, ny: number): boolean => !reach.cost.has(`${nx},${ny}`) && !(nx === me.pos.x && ny === me.pos.y);
          g.beginPath();
          if (edge(x, y - 1)) { g.moveTo(x * TILE + 1, y * TILE + 1); g.lineTo((x + 1) * TILE - 1, y * TILE + 1); }
          if (edge(x, y + 1)) { g.moveTo(x * TILE + 1, (y + 1) * TILE - 1); g.lineTo((x + 1) * TILE - 1, (y + 1) * TILE - 1); }
          if (edge(x - 1, y)) { g.moveTo(x * TILE + 1, y * TILE + 1); g.lineTo(x * TILE + 1, (y + 1) * TILE - 1); }
          if (edge(x + 1, y)) { g.moveTo((x + 1) * TILE - 1, y * TILE + 1); g.lineTo((x + 1) * TILE - 1, (y + 1) * TILE - 1); }
          g.stroke();
          // zona de placaje: salir de aquí costará PM (rojo translúcido)
          if (c.units.some((o) => o.team !== me.team && o.hp > 0 && o.ai !== 'pillar' && (o.tackle ?? 0) > 0 && !o.statuses.invis && Math.abs(o.pos.x - x) + Math.abs(o.pos.y - y) === 1)) fill({ x, y }, 'rgba(220,60,50,.16)');
        }
        // previsualización del camino: en rojo las casillas en las que el placaje te quitará PM al salir
        const pv = this.hover ? movePreview(c, me, this.hover) : null;
        if (pv) {
          for (const t of pv.tackled) { fill(t, 'rgba(230,50,50,.45)'); g.strokeStyle = '#ff4a4a'; g.lineWidth = 2; g.strokeRect(t.x * TILE + 4, t.y * TILE + 4, TILE - 8, TILE - 8); }
          const pts = [me.pos, ...pv.path];
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1]!, b = pts[i]!, cut = i > pv.stop;
            g.strokeStyle = cut ? 'rgba(255,74,74,.7)' : pv.tackled.length ? '#ff7a5a' : '#8fd0ff';
            g.lineWidth = 4; g.setLineDash(cut ? [6, 6] : []);
            g.beginPath(); g.moveTo(a.x * TILE + TILE / 2, a.y * TILE + TILE / 2); g.lineTo(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2); g.stroke();
          }
          g.setLineDash([]);
          if (pv.stop < pv.path.length) { const e = pv.path[Math.max(0, pv.stop - 1)] ?? me.pos; g.fillStyle = '#ff4a4a'; g.font = 'bold 14px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText('✋', e.x * TILE + TILE / 2, e.y * TILE + 16); }
        }
      }
    }
    for (const o of this.overlay) {
      g.fillStyle = o.fill; g.fillRect(o.x * TILE + 3, o.y * TILE + 3, TILE - 6, TILE - 6);
      if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = 3; g.strokeRect(o.x * TILE + 4, o.y * TILE + 4, TILE - 8, TILE - 8); }
    }
    // los textos, de pie (sin la deformación del suelo)
    if (this.overlay.some((o) => o.text)) {
      this.screen();
      g.font = 'bold 20px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = '#000'; g.fillStyle = '#fff';
      for (const o of this.overlay) {
        if (!o.text) continue;
        const q = this.iso ? this.top(c, o.x + 0.5, o.y + 0.5) : { x: (o.x + 0.5) * TILE, y: PAD + (o.y + 0.5) * TILE };
        g.strokeText(o.text, q.x, q.y); g.fillText(o.text, q.x, q.y);
      }
      g.textBaseline = 'alphabetic';
      this.ground();
    }
    if (this.hover) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(this.hover.x * TILE + 2, this.hover.y * TILE + 2, TILE - 4, TILE - 4); }

    const heroIdx = teamIdx(c);
    // 2.5D: muros y braseros se dibujan por filas junto a las unidades, para que lo de delante tape lo de detrás
    const fences = new Set((c.marks ?? []).filter((m) => m.kind === 'fence').map((m) => `${m.pos.x},${m.pos.y}`));
    // profundidad: en plano, por filas; en isométrico, por diagonales (x + y)
    const depth = (p: Pos): number => (this.iso ? p.x + p.y : p.y);
    const voids = new Set(c.voids ?? []);
    const props = [...c.obstacles].filter((k) => !voids.has(k)).map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y, brazier: (c.braziers ?? []).includes(k), fence: fences.has(k) }; }).sort((a, b) => depth(a) - depth(b) || a.x - b.x);
    let pi = 0;
    const flushProps = (row: number): void => {
      while (pi < props.length && depth(props[pi]!) <= row) {
        const p = props[pi++]!;
        // en isométrico, un muro que tapa a alguien que está justo detrás se vuelve translúcido
        g.globalAlpha = this.iso && c.units.some((u) => alive(u) && (() => { const d = p.x - u.pos.x + (p.y - u.pos.y); return d >= 1 && d <= 2 && Math.abs(p.x - p.y - (u.pos.x - u.pos.y)) <= 1; })()) ? 0.42 : 1;
        if (this.isoFloor && p.brazier && ready(CRYPT.brazier)) {
          // brasero del pack con su llama animada y su luz
          this.screen();
          const q = this.pivot(c, CRYPT.brazier, p.x + 1, p.y + 1);
          this.drawFlame(q.x + BRAZIER_FLAME[0], q.y + BRAZIER_FLAME[1] + 6, 34, now, p.x + p.y, true);
          g.save(); g.globalCompositeOperation = 'lighter';
          const gr = g.createRadialGradient(q.x, q.y - 20, 4, q.x, q.y - 20, 160);
          gr.addColorStop(0, `rgba(255,120,40,${(0.28 + 0.05 * Math.sin(now / 90 + p.x)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,100,30,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y - 20, 160, 0, 6.3); g.fill(); g.restore();
          g.globalAlpha = 1; continue;
        }
        if (this.isoFloor && !p.brazier && !p.fence) { this.screen(); if (this.forest) this.drawForestObstacle(c, p.x, p.y, this.room?.seed ?? 0); else this.drawCryptObstacle(c, p.x, p.y, this.room?.seed ?? 0); g.globalAlpha = 1; continue; }
        if (p.brazier) this.drawBrazier(p.x, p.y, now); else if (p.fence) this.drawFence(p.x, p.y, now); else this.drawWall(c, zone, p.x, p.y);
        g.globalAlpha = 1;
      }
    };
    for (const u of c.units.filter(alive).sort((a, b) => depth(a.pos) - depth(b.pos))) {
      flushProps(depth(u.pos));
      // posición mostrada: se acerca suavemente a la real
      const s = this.shown.get(u.id) ?? { ...u.pos };
      const wk = this.walks.get(u.id);
      if (wk && now < wk.end) {
        // andando: posición a lo largo del camino, a paso constante
        const k = Math.max(0, (now - wk.t0) / STEP_MS), i = Math.min(wk.path.length - 1, Math.floor(k)), f = Math.min(1, k - i);
        const a = i === 0 ? wk.from : wk.path[i - 1]!, b = wk.path[i]!;
        s.x = a.x + (b.x - a.x) * f; s.y = a.y + (b.y - a.y) * f;
        this.walkSeg.set(u.id, { dx: b.x - a.x, dy: b.y - a.y, dist: k });
      } else {
        if (wk) { this.walks.delete(u.id); this.walkSeg.delete(u.id); }
        s.x += (u.pos.x - s.x) * 0.25; s.y += (u.pos.y - s.y) * 0.25;
        if (Math.abs(u.pos.x - s.x) < 0.02) s.x = u.pos.x;
        if (Math.abs(u.pos.y - s.y) < 0.02) s.y = u.pos.y;
      }
      this.shown.set(u.id, s);
      this.upright(s.x, s.y);
      const cx = (s.x + 0.5) * TILE, by = (s.y + 1) * TILE - 6;
      if (cur?.id === u.id) { g.strokeStyle = u.team === 'hero' ? '#f2c14e' : '#e0475b'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.36, 8, 0, 0, 6.3); g.stroke(); }
      // sombra bajo los pies (más oscura en el centro)
      const sh = g.createRadialGradient(cx, by - 1, 1, cx, by - 1, TILE * 0.36);
      sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(cx, by - 1, TILE * 0.36, 9, 0, 0, 6.3); g.fill();
      const moving = s.x !== u.pos.x || s.y !== u.pos.y;
      const model = isModel(lookKind(u));
      // modelos animados: hechizo en curso, andar o reposo (sin el balanceo de los sprites antiguos)
      let anim: Anim = 'idle', frame = Math.floor(now / 220 + u.id) % ANIM_FRAMES.idle;
      if (model) {
        const ac = this.acts.get(u.id), ak = ac ? (now - ac.t0) / ACT_MS : 1;
        if (ac && ak < 1) { anim = ac.anim; frame = Math.floor(ak * ANIM_FRAMES[anim]); }
        else if (moving) { anim = 'walk'; frame = Math.floor(now / 110) % ANIM_FRAMES.walk; }
        // anillo con el color del jugador (los modelos tienen colores propios)
        if (u.team === 'hero' && u.summoner === undefined) { const pc = PLAYER_COLORS[(heroIdx.get(u.id) ?? 0) % 4]!; g.strokeStyle = pc.b; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.33, 7, 0, 0, 6.3); g.stroke(); }
      }
      const bob = model ? 0 : moving ? -Math.abs(Math.sin(now / 70)) * 5 : Math.sin(now / 260 + u.id) * 1.5;
      const lg = this.lunge.get(u.id);
      const lk = lg ? (now - lg.t0) / LUNGE_MS : 1;
      const swing = lk < 1 ? Math.sin(lk * Math.PI) : 0;
      const def0 = u.team === 'hero';
      const sp0 = this.spins.get(u.id), spk = sp0 === undefined ? 1 : (now - sp0) / SPIN_MS;
      // durante el giro mira alternativamente a cada lado
      const left = spk < 1 ? Math.floor(spk * 6) % 2 === 0 : this.faceLeft.get(u.id) ?? !def0;
      // aura: la siguiente habilidad de daño de la Zorra la curará (Robo de esencia lleno)
      if (u.essence !== undefined && u.essence >= essenceNeed(u)) {
        const k = 0.5 + 0.5 * Math.sin(now / 180);
        const gr = g.createRadialGradient(cx, by - TILE * 0.35, 4, cx, by - TILE * 0.35, TILE * 0.62);
        gr.addColorStop(0, `rgba(255,120,200,${0.35 + 0.2 * k})`); gr.addColorStop(1, 'rgba(255,120,200,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, by - TILE * 0.35, TILE * 0.62, 0, 6.3); g.fill();
        g.strokeStyle = `rgba(255,170,220,${0.6 + 0.3 * k})`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.38, 9, 0, 0, 6.3); g.stroke();
      }
      // Furia alta: el Bárbaro arde
      if ((u.fury ?? 0) >= 60) { g.fillStyle = `rgba(255,70,30,${0.12 + ((u.fury ?? 0) / 100) * 0.18})`; g.beginPath(); g.arc(cx, by - TILE * 0.4, TILE * 0.5, 0, 6.3); g.fill(); }
      // cosméticos del jugador (solo apariencia): aura bajo los pies y variante de color de su héroe
      const look = u.team === 'hero' && u.summoner === undefined ? lookOf(u.owner) : undefined;
      const aura = auraDef(look?.aura);
      if (aura && !u.statuses.invis) drawAura(g, aura, cx, by - 2, TILE * 0.36, 8, now);
      const sh8 = this.iso ? sheetOf(u) : undefined;
      if (u.seed !== undefined) this.drawSeed(u, cx, by, now);
      else if (sh8 && sheetReady(sh8)) this.drawSheetUnit(c, u, s, sh8, now, moving);
      else drawUnit(g, lookKind(u), u.team, heroIdx.get(u.id) ?? 0, cx + (lg ? lg.dx * swing * TILE * 0.3 : 0), by + bob + (lg ? lg.dy * swing * TILE * 0.3 : 0), Math.round(TILE * 1.18),
        { flash: this.flashing(u.id, now), swing, flip: def0 ? left : !left, alpha: u.statuses.invis ? 0.4 : u.ai === 'decoy' ? 0.55 : 1, anim, frame, skin: look?.cls === u.kind ? look.skin : undefined });
      // Marca de la muerte: calavera con el daño guardado
      const dmk = u.statuses.deathmark;
      if (dmk) {
        const mx = cx + TILE * 0.32, my = s.y * TILE + 18;
        g.fillStyle = '#1a0610'; g.fillRect(mx - 9, my - 9, 18 + String(dmk.stacks).length * 7, 16);
        g.fillStyle = '#ff3a4a'; g.font = 'bold 12px ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(`☠${dmk.stacks}`, mx - 7, my + 3);
      }
      // barra encima de la cabeza: alto del personaje en pantalla pasado a la escala de lo que está de pie
      this.bars(u, cx, s.y * TILE - (sh8 ? Math.round((sheetHeight(sh8) + 8) / ISO_UP - TILE) : 8), heroIdx.get(u.id));
    }
    flushProps(this.iso ? c.w + c.h : c.h);
    // caídos: se desvanecen hacia arriba
    this.ghosts = this.ghosts.filter((d) => now - d.t0 < (d.sheet ? 1600 * animMul(d.kind, 'death', d.team === 'enemy') : isModel(d.kind) ? DEATH_MS : 600));
    for (const d of this.ghosts) {
      const gs = d.sheet && this.iso ? (d.team === 'enemy' ? SHEETS[d.sheet] : HERO_SHEETS[d.sheet]) : undefined;
      if (gs && sheetReady(gs)) {
        // hoja de animación: cae (10 fotogramas en 1 s), se queda en el suelo y se desvanece
        const nd = gs.frames.death ?? 1, dm = animMul(d.kind, 'death', d.team === 'enemy'), t0 = (now - d.t0) / dm, fr = Math.min(nd - 1, Math.floor((t0 / 1000) * nd));
        this.sheetFrame(c, gs, 'death', fr, d.dir ?? 0, d.x, d.y, t0 < 1100 ? 1 : Math.max(0, 1 - (t0 - 1100) / 500));
        continue;
      }
      if (isModel(d.kind)) {
        // modelos animados: animación de muerte y luego se desvanecen
        const k = (now - d.t0) / DEATH_MS;
        this.upright(d.x, d.y);
        drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6, TILE, { anim: 'death', frame: Math.min(ANIM_FRAMES.death - 1, Math.floor(k * 1.4 * ANIM_FRAMES.death)), alpha: k < 0.7 ? 1 : (1 - k) / 0.3 });
        continue;
      }
      const k = (now - d.t0) / 600;
      this.upright(d.x, d.y);
      drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6 - k * 14, TILE, { alpha: 1 - k, flash: k < 0.3 });
    }
    this.ground();
    // ondas: un aro que se abre; los giros, un tajo en arco que da la vuelta
    this.rings = this.rings.filter((r) => now - r.t0 < r.dur);
    for (const r of this.rings) {
      if (now < r.t0) continue;
      const k = (now - r.t0) / r.dur;
      g.globalAlpha = 1 - k; g.strokeStyle = r.color;
      if (r.spin) {
        const a0 = -Math.PI / 2 + k * Math.PI * 2;
        for (let i = 0; i < 3; i++) { g.lineWidth = 6 - i * 2; g.beginPath(); g.ellipse(r.x, r.y, r.r * (0.7 + i * 0.12), r.r * (0.45 + i * 0.08), 0, a0 - 1.6 + i * 0.3, a0); g.stroke(); }
      } else { g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, r.r * (0.2 + k * 0.8), 0, 6.3); g.stroke(); }
      g.globalAlpha = 1;
    }
    // proyectiles con estela
    this.shots = this.shots.filter((p) => now - p.t0 < p.dur);
    for (const p of this.shots) {
      if (now < p.t0) continue;
      if (p.orb) {
        // orbe brillante: halo, núcleo blanco y una estela de chispas
        const k = (now - p.t0) / p.dur, x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k;
        for (let i = 1; i <= 4; i++) { const kk = Math.max(0, k - i * 0.06); g.globalAlpha = 0.5 - i * 0.1; g.fillStyle = p.color; g.beginPath(); g.arc(p.x0 + (p.x1 - p.x0) * kk, p.y0 + (p.y1 - p.y0) * kk, 7 - i, 0, 6.3); g.fill(); }
        g.globalAlpha = 0.35; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, 14, 0, 6.3); g.fill();
        g.globalAlpha = 1; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, 8, 0, 6.3); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 1, y - 1, 4, 0, 6.3); g.fill();
        continue;
      }
      for (let i = 4; i >= 0; i--) {
        const k = Math.max(0, (now - p.t0) / p.dur - i * 0.05);
        g.globalAlpha = 1 - i * 0.2; g.fillStyle = i ? p.color : '#fff';
        const sz = 10 - i * 1.5;
        g.fillRect(p.x0 + (p.x1 - p.x0) * k - sz / 2, p.y0 + (p.y1 - p.y0) * k - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;
    }
    // H6: efectos de habilidades (recetas)
    this.fx.draw(g, now);
    if (this.iso && this.arrows.length) {
      // flechas propias: vuelan en línea recta en pantalla, giradas hacia el blanco
      this.screen();
      this.arrows = this.arrows.filter((a) => now - a.t0 < a.dur);
      for (const a of this.arrows) {
        if (now < a.t0) continue;
        const p0 = this.top(c, a.from.x + 0.5, a.from.y + 0.5), p1 = this.top(c, a.at.x + 0.5, a.at.y + 0.5), k = (now - a.t0) / a.dur;
        const y0 = p0.y + ISO_FOOT - a.lift, y1 = p1.y - 40, x = p0.x + (p1.x - p0.x) * k, y = y0 + (y1 - y0) * k;
        g.save(); g.translate(x, y); g.rotate(Math.atan2(y1 - y0, p1.x - p0.x)); g.drawImage(a.img, -a.img.naturalWidth * 1.5, -a.img.naturalHeight, a.img.naturalWidth * 2, a.img.naturalHeight * 2); g.restore();
      }
      this.ground();
    }
    // luz de antorchas en las esquinas y viñeta
    if (this.iso) this.screen();
    const W = this.iso ? size.w : c.w * TILE, H = this.iso ? size.h : c.h * TILE, fl = 0.1 + 0.03 * Math.sin(now / 130);
    for (const [lx, ly] of (this.isoFloor && this.torches.length ? [] : [[0, 0], [W, 0], [0, H], [W, H]]) as Array<readonly [number, number]>) {
      const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 280);
      gr.addColorStop(0, `rgba(${zone.light},${fl})`); gr.addColorStop(1, `rgba(${zone.light},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.floats = this.floats.filter((f) => now - f.t0 < 1100);
    g.font = 'bold 16px ui-monospace, monospace'; g.textAlign = 'center';
    for (const f of this.floats) {
      if (now < f.t0) continue;
      const k = (now - f.t0) / 1100;
      if (this.iso) { this.upright(Math.floor(f.x / TILE), Math.floor(f.y / TILE)); g.font = 'bold 16px ui-monospace, monospace'; g.textAlign = 'center'; }
      g.globalAlpha = 1 - k * k; g.lineWidth = 4; g.strokeStyle = '#000';
      g.strokeText(f.text, f.x, f.y - k * 30); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - k * 30);
    }
    g.globalAlpha = 1;
    if (this.hover) { if (this.iso) this.screen(); else this.ground(); this.tooltip(c); }
    // táctil: recordatorio de que el segundo toque confirma
    if (this.touch && this.session.isMyTurn() && !c.over && (this.hover || this.sel)) {
      const d = this.sel && me ? spellOf(me, this.sel) : undefined;
      const g = this.g, txt = this.hover ? (this.sel ? 'Toca otra vez la casilla para lanzar' : 'Toca otra vez la casilla para moverte') : `${d?.name ?? ''}: toca una casilla iluminada`;
      g.font = 'bold 16px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center';
      if (this.iso) this.screen();
      const w = g.measureText(txt).width + 24, X = this.iso ? size.w / 2 : (c.w * TILE) / 2;
      // el aviso va abajo, salvo que tape la casilla que estás mirando
      const Y = this.iso ? size.h - 14 : this.hover && this.hover.y >= c.h - 2 ? 26 : c.h * TILE - 14;
      g.fillStyle = 'rgba(10,8,6,.85)'; g.fillRect(X - w / 2, Y - 18, w, 26);
      g.strokeStyle = '#e3b04b'; g.lineWidth = 2; g.strokeRect(X - w / 2, Y - 18, w, 26);
      g.fillStyle = '#ffe2a0'; g.fillText(txt, X, Y);
    }
    // señales tácticas: anillo que pulsa con el color y el nombre de quien marca
    const tnow = Date.now();
    this.pings = this.pings.filter((p) => tnow - p.at < 4000);
    for (const p of this.pings) {
      this.upright(p.x, p.y);
      const t = (tnow - p.at) / 1000, cx = (p.x + 0.5) * TILE, cy = (p.y + 0.5) * TILE;
      for (let r = 0; r < 2; r++) { const k = ((t * 1.3 + r * 0.5) % 1); g.strokeStyle = p.col; g.globalAlpha = 1 - k; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 8 + k * TILE * 0.6, 0, 6.3); g.stroke(); }
      g.globalAlpha = 1;
      g.fillStyle = p.col; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx - 9, cy - 24); g.lineTo(cx + 9, cy - 24); g.closePath(); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke();
      g.font = 'bold 10px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeText(`❗ ${p.name}`, cx, cy - 28); g.fillStyle = '#fff'; g.fillText(`❗ ${p.name}`, cx, cy - 28);
    }
  }

  /** el último toque fue con el dedo (o lápiz) y no con el ratón */
  private touch = false;

  /** se pueden ocultar las barras de vida (botón ❤️ o tecla V) */
  showBars = true;

  private bars(u: Unit, cx: number, top: number, heroIdx: number | undefined): void {
    const g = this.g, w = TILE - 14, x = cx - w / 2;
    if (this.showBars) {
    // barra con borde de hierro, vida actual/total centrada y la vida que falta en rojo oscuro
    const bh = 10;
    g.fillStyle = '#0a0806'; g.fillRect(x - 2, top - 2, w + 4, bh + 4);
    g.fillStyle = '#5d544b'; g.fillRect(x - 1, top - 1, w + 2, bh + 2);
    g.fillStyle = '#2a0f0c'; g.fillRect(x, top, w, bh);
    // el escudo va en azul a continuación de la vida (si la supera, la barra se escala)
    const total = Math.max(u.maxHp, u.hp + u.shield);
    const hw = Math.max(0, (w * u.hp) / total);
    g.fillStyle = u.team === 'hero' ? '#3f9a4a' : '#c23b3b'; g.fillRect(x, top, hw, bh);
    g.fillStyle = u.team === 'hero' ? '#6fd07a' : '#ef6a5e'; g.fillRect(x, top, hw, 3);
    if (u.shield > 0) { const sw = Math.max(2, (w * u.shield) / total); g.fillStyle = '#2f7fe0'; g.fillRect(x + hw, top, sw, bh); g.fillStyle = '#8cc8ff'; g.fillRect(x + hw, top, sw, 3); g.fillStyle = '#d8ecff'; g.fillRect(x + hw, top, 1, bh); }
    g.font = 'bold 9px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = `${u.hp}/${u.maxHp}`;
    const lx = u.shield > 0 ? cx - 8 : cx;
    g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(label, lx, top + bh / 2 + 0.5);
    g.fillStyle = '#fff'; g.fillText(label, lx, top + bh / 2 + 0.5);
    if (u.shield > 0) { const sl = `+${u.shield}`; const sx = lx + g.measureText(label).width / 2 + 3 + g.measureText(sl).width / 2; g.strokeText(sl, sx, top + bh / 2 + 0.5); g.fillStyle = '#9fd4ff'; g.fillText(sl, sx, top + bh / 2 + 0.5); }
    g.textBaseline = 'alphabetic';
    if (u.fury !== undefined) { g.fillStyle = '#000'; g.fillRect(x - 1, top - 6, w + 2, 5); g.fillStyle = '#ff6a20'; g.fillRect(x, top - 5, (w * u.fury) / 100, 3); }
    if (u.essence !== undefined) for (let i = 0; i < essenceNeed(u); i++) { g.fillStyle = i < u.essence ? '#ff8ad0' : '#3a2040'; g.fillRect(x + i * 7, top - 6, 5, 4); }
    }
    // objetivo de la sala creada
    if (u.goal) { g.font = 'bold 16px ui-monospace, monospace'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText('★', x - 9, top + 9); g.fillStyle = '#ffd24a'; g.fillText('★', x - 9, top + 9); }
    let ix = x;
    for (const k of Object.keys(u.statuses)) { const im = statusIcon(k); if (im) { g.drawImage(im, ix - 1, top + 11, 12, 12); ix += 12; } else { g.fillStyle = STATUS_COLOR[k] ?? '#fff'; g.fillRect(ix, top + 14, 6, 6); ix += 8; } }
    if (heroIdx !== undefined) {
      g.font = '12px ui-monospace, monospace'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(u.name, cx, top + TILE - 2);
      g.fillStyle = u.team === 'hero' ? PLAYER_COLORS[heroIdx % 4]!.b : '#e8a0b0'; g.fillText(u.name.replace('Némesis: ', '☠ '), cx, top + TILE - 2);
    }
  }

  private tooltip(c: CombatState): void {
    const h = this.hover!;
    const u = c.units.find((x) => alive(x) && x.pos.x === h.x && x.pos.y === h.y);
    if (!u) return;
    const g = this.g;
    const st = [...Object.entries(u.statuses).map(([k, v]) => `${STATUS_NAME[k]}${STATUSES[k as keyof typeof STATUSES]?.stack === 'add' && v!.stacks > 1 ? ` ×${v!.stacks}` : ''} ${v!.turns}${k === 'deathmark' || k === 'doom' ? ` (guarda ${v!.stacks})` : ''}`), ...(u.essence !== undefined ? [`Esencia ${u.essence}/${essenceNeed(u)}${u.essence >= essenceNeed(u) ? ' ¡cura!' : ''}`] : []), ...(u.souls !== undefined ? [`Almas ${u.souls} (${u.soulBank ?? 0} para gastar)`] : []), ...(u.fury !== undefined ? [`Furia ${u.fury}: +${furyPower(u)}% daño, +${furyCrit(u)}% crít.`] : [])].join(', ');
    const res = !FEATURES.resistances ? '' : Object.entries(u.resist ?? {}).filter(([, v]) => v).map(([k, v]) => (v! > 0 ? `Resiste ${ELEMENT_NAME[k]} ${v}%` : `Débil a ${ELEMENT_NAME[k]} ${-v!}%`)).join(' · ');
    // daño estimado del hechizo elegido sobre esta unidad
    let est = '';
    const me = this.session.myUnit();
    const def = me && this.sel ? spellOf(me, this.sel) : undefined;
    if (me && def?.dmg && u.team !== me.team) {
      const res = FEATURES.resistances && def.element ? Math.min(75, u.resist[def.element] ?? 0) : 0;
      const school = me.team === 'hero' ? (schoolOf(me.kind) === 'magic' ? me.powerMagic ?? 0 : me.powerPhys ?? 0) : 0;
      // daño plano: fijo del hechizo + daño del personaje y de su tipo + potenciado + Marcado/Vulnerable − armadura
      const bonus = me.power + school + (me.statuses.empower?.stacks ?? 0) + (u.statuses.mark ? 2 : 0) + (u.statuses.charm ? 2 : 0) + (u.statuses.vuln ? 2 : 0) + (u.statuses.frenzy ? 1 : 0);
      const arm = def.pierce ? 0 : Math.max(0, u.armor - (u.statuses.exposed?.stacks ?? 0));
      const v = Math.max(1, Math.round((def.dmg[0] + bonus) * (1 - res / 100)) - arm);
      const crit = Math.max(1, Math.round((def.dmg[0] + bonus + CRIT_FLAT) * (1 - res / 100)) - arm);
      est = `${def.name}: ${v} de daño (crítico ${crit})${v >= u.hp + u.shield ? ' · ¡LO MATA!' : crit >= u.hp + u.shield ? ' · lo mata con crítico' : ''}`;
    }
    // PA y PM: los de ahora si es su turno; si no, los que tendrá en su próximo turno (con lo que le han quitado)
    const isCur = current(c)?.id === u.id;
    const apNow = isCur ? u.ap : Math.max(0, u.maxAp + u.apMod);
    const mpNow = isCur ? u.mp : Math.max(0, u.maxMp + u.mpMod - (u.statuses.slow?.stacks ?? 0));
    const armorNow = Math.max(0, u.armor - (u.statuses.exposed?.stacks ?? 0));
    const tk = me && u.team !== me.team && u.ai !== 'pillar' ? ` · Placaje ${u.tackle ?? 0}` : '';
    const L: Array<[string, string]> = [];
    if (est) L.push([est, '#f2c14e']);
    L.push([`${u.name}  ${u.hp}/${u.maxHp} PV${u.shield ? `  escudo ${u.shield}` : ''}`, '#e8e0f5']);
    if (u.rank) L.push([`${u.rank === 'boss' ? 'Jefe' : 'Élite'}: inmune a aturdir · resiste PA/PM y empujones`, '#c9a0ff']);
    L.push([`PA ${apNow}${apNow !== u.maxAp ? `/${u.maxAp}` : ''}${isCur ? '' : ' (próx. turno)'}`, apNow < u.maxAp ? '#f2c14e' : '#9a8fb5']);
    L.push([`PM ${mpNow}${mpNow !== u.maxMp ? `/${u.maxMp}` : ''}${mpNow < u.maxMp ? ` (−${u.maxMp - mpNow})` : ''}`, mpNow < u.maxMp ? '#58a6ff' : '#9a8fb5']);
    L.push([`Armadura ${armorNow}${armorNow !== u.armor ? ` (−${u.armor - armorNow})` : ''} · Huida ${u.dodge ?? 0}${tk}`, '#9a8fb5']);
    if (res) L.push([res, '#9a8fb5']);
    if (st) L.push([st, '#9a8fb5']);
    const lines = L.map((l) => l[0]);
    g.font = '14px ui-monospace, monospace'; g.textAlign = 'left';
    const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 14, hh = lines.length * 18 + 8;
    let x = Math.min(c.w * TILE - w - 4, (h.x + 1) * TILE), y = Math.max(4, Math.min(c.h * TILE - hh - 4, h.y * TILE - 10));
    if (this.iso) {
      // en isométrico la ventana va junto al rombo, en coordenadas de pantalla
      const p = isoPoint(h.x + 1, h.y, c.h);
      x = Math.max(4, Math.min(this.canvas.width - w - 4, p.x + 10)); y = Math.max(4, Math.min(this.canvas.height - hh - 4, p.y - 90));
    }
    g.fillStyle = 'rgba(10,6,20,.93)'; g.fillRect(x, y, w, hh); g.strokeStyle = '#3b2f57'; g.lineWidth = 2; g.strokeRect(x, y, w, hh);
    L.forEach(([l, col], i) => { g.fillStyle = col; g.fillText(l, x + 7, y + 18 + i * 18); });
  }
}
