// Tienda de ecos: catálogo de cosméticos (solo apariencia), compras, desbloqueos exclusivos, equipamiento y kits visuales.
// Nada de aquí entra en el combate ni en RunState: los héroes se construyen igual con o sin cosméticos.
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import type { ClassId } from '../core/state';
import { AURAS, PALETTES, auraDef, paletteDef } from '../render/palettes';
import type { Look } from '../render/looks';
import { chronicleState } from './atlas';
import { FRAMES, LOADOUT_MAX, TITLES, emptyCosmetics, frameDef, titleName, type Cosmetics, type Loadout, type Slot } from './cosmetics';
import { masteryLevel, type Meta } from './meta';
import { SPECIALS } from './specials';

export type ShopCat = 'skin' | 'kit' | 'fx' | 'frame' | 'emblem' | 'title' | 'deco' | 'theme' | 'card' | 'bg';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'set';
export const CAT_NAME: Record<ShopCat, string> = {
  skin: 'Aspectos de héroe', kit: 'Kits visuales', fx: 'Efectos visuales', frame: 'Marcos de perfil', emblem: 'Emblemas', title: 'Títulos',
  deco: 'Decoración del Archivo', theme: 'Temas del Archivo', card: 'Marcos de fichas', bg: 'Ilustraciones del Archivo',
};
export const RARITY_NAME: Record<Rarity, string> = { common: 'Común', uncommon: 'Poco común', rare: 'Rara', epic: 'Épica', set: 'Conjunto' };
/** Rangos de precio por rareza (propuesta aprobada). */
export const PRICE_RANGE: Record<Rarity, [number, number]> = { common: [50, 100], uncommon: [150, 250], rare: [300, 450], epic: [600, 900], set: [900, 1400] };

/** Requisito de desbloqueo. Los elementos con requisito y sin precio solo se consiguen así (no se compran). */
export type Req =
  | { k: 'achievement'; id: string }
  | { k: 'mastery'; cls: ClassId; lv: number }
  | { k: 'special'; id: string }
  | { k: 'chronicle'; cat: 'stories' | 'milestones'; id: string; state: 'discovered' | 'completed' };

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  cat: ShopCat;
  rarity: Rarity;
  /** null: exclusivo (no se compra; se desbloquea con su requisito) */
  price: number | null;
  /** clase compatible; null = todas */
  cls: ClassId | null;
  req?: Req;
  /** recurso visual: id de paleta, aura, título, marco, tema, escena o emoji */
  ref: string;
  /** de dónde sale el arte: siempre recursos ya existentes del juego (paletas aplicadas a los sprites, escenas, emojis, CSS) */
  art: 'palette' | 'aura' | 'scene' | 'emoji' | 'css' | 'text';
  /** kits: elementos que incluye */
  includes?: string[];
  /** false = aún no disponible (no se muestra como comprable) */
  available: boolean;
}

const ACH_NAME: Record<string, string> = { jefe1: 'Silencio en el osario', victoria: 'Fin del abismo', asc3: 'Ascendido', abismo: 'Cerrar el Abismo' };
export function reqText(r: Req): string {
  if (r.k === 'achievement') return `Logro «${ACH_NAME[r.id] ?? r.id}»`;
  if (r.k === 'mastery') return `Maestría ${r.lv} con ${CLASSES[r.cls].name}`;
  if (r.k === 'special') return `Contrato especial «${SPECIALS().find((s) => s.id === r.id)?.title ?? r.id}»`;
  if (r.cat === 'milestones') return `Hito «${r.id.replace('bestiary_', '').replace('relics_', '').replace('grimoire_', '')}% del ${r.id.startsWith('bestiary') ? 'Bestiario' : r.id.startsWith('relics') ? 'catálogo de reliquias' : 'Grimorio'}»`;
  return r.id === 'zona_4' ? 'Llegar al Abismo (zona 4)' : `Crónica «${r.id}» ${r.state === 'completed' ? 'completada' : 'descubierta'}`;
}

// ---------- catálogo ----------
const PAIRS: Array<[string, string]> = [['escarcha', 'sombra'], ['brasa', 'jade'], ['sangre', 'ceniza'], ['jade', 'escarcha'], ['ceniza', 'brasa'], ['sombra', 'sangre'], ['escarcha', 'brasa'], ['jade', 'sangre']];
const KIT_AURA = 'fx_escarcha', KIT_EMBLEM = 'em_espadas', KIT_DISCOUNT = 0.9;
const it = (x: Omit<ShopItem, 'available'> & { available?: boolean }): ShopItem => ({ available: true, ...x });

function build(): ShopItem[] {
  const out: ShopItem[] = [];
  const pal = (id: string): string => paletteDef(id)!.name;
  PLAYABLE.forEach((c, i) => {
    const [a, b] = PAIRS[i % PAIRS.length]!, n = CLASSES[c].name;
    out.push(it({ id: `skin_${c}_${a}`, name: `${n} · ${pal(a)}`, desc: `Variante de color «${pal(a)}» para ${n}.`, cat: 'skin', rarity: 'uncommon', price: 200, cls: c, ref: a, art: 'palette' }));
    out.push(it({ id: `skin_${c}_${b}`, name: `${n} · ${pal(b)}`, desc: `Variante de color «${pal(b)}» para ${n}.`, cat: 'skin', rarity: 'rare', price: 350, cls: c, ref: b, art: 'palette' }));
    out.push(it({ id: `skin_${c}_oro`, name: `${n} · Oro`, desc: `Variante dorada de maestro para ${n}.`, cat: 'skin', rarity: 'epic', price: null, cls: c, ref: 'oro', art: 'palette', req: { k: 'mastery', cls: c, lv: 5 } }));
  });
  out.push(it({ id: 'skin_abisal', name: 'Aspecto abisal', desc: 'Variante abisal para cualquier héroe.', cat: 'skin', rarity: 'epic', price: null, cls: null, ref: 'abisal', art: 'palette', req: { k: 'achievement', id: 'abismo' } }));

  const fx: Array<[string, Rarity, number | null, Req?]> = [['brasas', 'common', 80], ['runas', 'uncommon', 220], ['escarcha', 'rare', 380], ['corona', 'epic', 750], ['prior', 'rare', null, { k: 'achievement', id: 'jefe1' }], ['ecos', 'epic', null, { k: 'special', id: 'lore_descent' }]];
  for (const [id, rarity, price, req] of fx) { const a = auraDef(id)!; out.push(it({ id: `fx_${id}`, name: a.name, desc: 'Aura bajo los pies de tu héroe en combate.', cat: 'fx', rarity, price, cls: null, ref: id, art: 'aura', ...(req ? { req } : {}) })); }

  const ems: Array<[string, string, string, Rarity, number | null, Req?]> = [
    ['em_calavera', 'Calavera', '💀', 'common', 60], ['em_vela', 'Vela', '🕯️', 'common', 90], ['em_espadas', 'Espadas cruzadas', '⚔️', 'uncommon', 160], ['em_luna', 'Luna', '🌙', 'uncommon', 220],
    ['em_dragon', 'Dragón', '🐉', 'rare', 380], ['em_ojo', 'Ojo del Abismo', '👁️', 'epic', 650], ['em_trofeo', 'Trofeo', '🏆', 'rare', null, { k: 'achievement', id: 'victoria' }], ['em_corona', 'Corona', '👑', 'epic', null, { k: 'achievement', id: 'asc3' }],
  ];
  for (const [id, name, e, rarity, price, req] of ems) out.push(it({ id, name, desc: 'Emblema junto a tu nombre en el inicio, la sala y el Salón.', cat: 'emblem', rarity, price, cls: null, ref: e, art: 'emoji', ...(req ? { req } : {}) }));

  const buyTitles: Array<[string, Rarity, number]> = [['aventurero', 'common', 50], ['saqueador', 'common', 100], ['explorador', 'uncommon', 200], ['rompepactos', 'rare', 400], ['heraldo', 'epic', 800]];
  for (const [id, rarity, price] of buyTitles) out.push(it({ id: `title_${id}`, name: titleName(id), desc: 'Título para tu nombre y tus héroes del Salón.', cat: 'title', rarity, price, cls: null, ref: id, art: 'text' }));
  out.push(it({ id: 'title_domador', name: titleName('domador'), desc: 'Título para quien cerró el Abismo.', cat: 'title', rarity: 'epic', price: null, cls: null, ref: 'domador', art: 'text', req: { k: 'achievement', id: 'abismo' } }));
  const buyFrames: Array<[string, Rarity, number]> = [['cobre', 'common', 60], ['plata', 'uncommon', 180], ['obsidiana', 'rare', 380], ['aurora', 'epic', 700]];
  for (const [id, rarity, price] of buyFrames) out.push(it({ id: `frame_${id}`, name: frameDef(id)!.name, desc: 'Marco para las fichas de tus héroes del Salón.', cat: 'frame', rarity, price, cls: null, ref: id, art: 'css' }));
  // títulos y marcos de los Contratos Especiales (Fase D): exclusivos, se entregan al reclamar el especial
  for (const s of SPECIALS()) {
    const r = s.reward;
    if (r.kind === 'title') out.push(it({ id: `title_${r.id}`, name: titleName(r.id), desc: `Recompensa del contrato especial «${s.title}».`, cat: 'title', rarity: 'rare', price: null, cls: null, ref: r.id, art: 'text', req: { k: 'special', id: s.id } }));
    else out.push(it({ id: `frame_${r.id}`, name: frameDef(r.id)!.name, desc: `Recompensa del contrato especial «${s.title}».`, cat: 'frame', rarity: 'rare', price: null, cls: null, ref: r.id, art: 'css', req: { k: 'special', id: s.id } }));
  }

  const decos: Array<[string, string, string, Rarity, number]> = [['deco_velas', 'Velas votivas', '🕯️', 'common', 80], ['deco_cadenas', 'Cadenas del osario', '⛓️', 'uncommon', 180], ['deco_runas', 'Runas encendidas', 'ᚱ', 'rare', 320]];
  for (const [id, name, e, rarity, price] of decos) out.push(it({ id, name, desc: 'Adorno para la cabecera del Archivo.', cat: 'deco', rarity, price, cls: null, ref: e, art: 'emoji' }));
  const themes: Array<[string, string, Rarity, number, Req?]> = [['pergamino', 'Pergamino', 'uncommon', 200], ['ceniza', 'Ceniza', 'rare', 350], ['bosque', 'Bosque corrompido', 'rare', 350], ['abisal', 'Abisal', 'epic', 700, { k: 'chronicle', cat: 'stories', id: 'zona_4', state: 'discovered' }]];
  for (const [id, name, rarity, price, req] of themes) out.push(it({ id: `theme_${id}`, name: `Tema: ${name}`, desc: 'Colores y fondo del Archivo. No cambia lo que se muestra.', cat: 'theme', rarity, price, cls: null, ref: id, art: 'css', ...(req ? { req } : {}) }));
  const cards: Array<[string, string, Rarity, number | null, Req?]> = [['hueso', 'Fichas de hueso', 'uncommon', 150], ['oro', 'Fichas doradas', 'rare', 420], ['bestia', 'Fichas del bestiólogo', 'rare', null, { k: 'chronicle', cat: 'milestones', id: 'bestiary_50', state: 'completed' }]];
  for (const [id, name, rarity, price, req] of cards) out.push(it({ id: `card_${id}`, name, desc: 'Borde de las fichas del Archivo.', cat: 'card', rarity, price, cls: null, ref: id, art: 'css', ...(req ? { req } : {}) }));
  const bgs: Array<[string, string, number]> = [['altar', 'El Altar de los Pactos', 150], ['forja', 'La Forja', 150], ['cofre', 'El cofre', 200], ['descanso', 'La hoguera', 200], ['santuario', 'El santuario', 250]];
  for (const [id, name, price] of bgs) out.push(it({ id: `bg_${id}`, name: `Ilustración: ${name}`, desc: 'Ilustración del juego en la cabecera del Archivo.', cat: 'bg', rarity: 'uncommon', price, cls: null, ref: id, art: 'scene' }));

  // kits visuales: las dos variantes de la clase, el Halo de escarcha y las Espadas cruzadas, con descuento
  const priceOf = (id: string): number => out.find((x) => x.id === id)?.price ?? 0;
  PLAYABLE.forEach((c, i) => {
    const [a, b] = PAIRS[i % PAIRS.length]!, inc = [`skin_${c}_${a}`, `skin_${c}_${b}`, KIT_AURA, KIT_EMBLEM];
    const price = Math.round((inc.reduce((n, x) => n + priceOf(x), 0) * KIT_DISCOUNT) / 10) * 10;
    out.push(it({ id: `kit_${c}`, name: `Kit visual: ${CLASSES[c].name}`, desc: `Sus dos variantes de color, el Halo de escarcha y el emblema ⚔️. Lo que ya tengas se descuenta.`, cat: 'kit', rarity: 'set', price, cls: c, ref: c, art: 'palette', includes: inc }));
  });
  return out;
}
let cache: ShopItem[] | null = null;
/** Catálogo completo (se construye una vez, cuando ya están cargados los Contratos Especiales). */
export const CATALOG = (): ShopItem[] => (cache ??= build());
export const shopItem = (id: string): ShopItem | undefined => CATALOG().find((x) => x.id === id);

// ---------- estado del jugador ----------
const cos = (m: Pick<Meta, 'cosmetics'>): Cosmetics => {
  const c = (m.cosmetics ??= emptyCosmetics());
  c.owned ??= []; c.eq ??= {}; c.skins ??= {}; c.loadouts ??= {}; c.seen ??= []; c.spent ??= {};
  return c;
};
/** ¿Tiene el jugador este elemento? (títulos y marcos se guardan en sus listas de la Fase D) */
export function owns(m: Pick<Meta, 'cosmetics'>, id: string): boolean {
  const x = shopItem(id), c = cos(m);
  if (!x) return false;
  if (x.cat === 'title') return c.titles.includes(x.ref);
  if (x.cat === 'frame') return c.frames.includes(x.ref);
  if (x.cat === 'kit') return (x.includes ?? []).every((i) => owns(m, i));
  return c.owned!.includes(id);
}
/** ¿Cumple el requisito? (sin requisito: sí) */
export function reqMet(m: Pick<Meta, 'achievements' | 'mastery' | 'contracts' | 'archive'>, r: Req | undefined): boolean {
  if (!r) return true;
  if (r.k === 'achievement') return m.achievements.includes(r.id);
  if (r.k === 'mastery') return masteryLevel(m.mastery[r.cls] ?? 0) >= r.lv;
  if (r.k === 'special') return !!m.contracts?.special?.[r.id]?.completed;
  const st = chronicleState(m, r.cat, r.id);
  return r.state === 'discovered' ? st !== 'locked' : st === 'completed';
}
function give(m: Pick<Meta, 'cosmetics'>, x: ShopItem): void {
  const c = cos(m);
  if (x.cat === 'title') { if (!c.titles.includes(x.ref)) c.titles.push(x.ref); }
  else if (x.cat === 'frame') { if (!c.frames.includes(x.ref)) c.frames.push(x.ref); }
  else if (x.cat === 'kit') for (const i of x.includes ?? []) { const y = shopItem(i); if (y && !owns(m, i)) give(m, y); }
  else if (!c.owned!.includes(x.id)) c.owned!.push(x.id);
}

/** Precio real: los kits descuentan, en proporción, lo que ya tienes de su contenido. */
export function priceFor(m: Pick<Meta, 'cosmetics'>, x: ShopItem): number {
  if (x.price === null) return 0;
  if (x.cat !== 'kit') return x.price;
  const parts = (x.includes ?? []).map((i) => shopItem(i)!), total = parts.reduce((n, p) => n + (p.price ?? 0), 0);
  const missing = parts.filter((p) => !owns(m, p.id)).reduce((n, p) => n + (p.price ?? 0), 0);
  return total ? Math.round((x.price * missing) / total / 10) * 10 : x.price;
}

export type ItemState = 'locked' | 'exclusive' | 'available' | 'owned' | 'equipped';
export function itemState(m: Meta, x: ShopItem, cls?: ClassId): ItemState {
  if (owns(m, x.id)) return isEquipped(m, x, cls) ? 'equipped' : 'owned';
  if (!reqMet(m, x.req)) return 'locked';
  return x.price === null ? 'exclusive' : 'available';
}

export type BuyResult = { ok: true; paid: number } | { ok: false; error: string };
/**
 * Compra un elemento. Valida que exista, esté disponible, cumpla requisitos, no se tenga y haya saldo; después descuenta
 * los ecos una sola vez, registra la compra y la propiedad. Si algo falla, no se toca nada.
 */
export function buyItem(m: Meta, id: string): BuyResult {
  const x = shopItem(id);
  if (!x) return { ok: false, error: 'Ese elemento no existe.' };
  if (!x.available) return { ok: false, error: 'Ese elemento aún no está disponible.' };
  if (x.price === null) return { ok: false, error: 'No se compra: se desbloquea con su requisito.' };
  if (owns(m, id)) return { ok: false, error: 'Ya lo tienes.' };
  if (!reqMet(m, x.req)) return { ok: false, error: `Requisito: ${reqText(x.req!)}.` };
  const price = priceFor(m, x);
  if (m.ecos < price) return { ok: false, error: `Te faltan ${price - m.ecos} ecos.` };
  const c = cos(m);
  // segunda barrera: una compra ya registrada nunca se vuelve a cobrar
  if (c.spent![id] !== undefined) return { ok: false, error: 'Ya lo tienes.' };
  m.ecos -= price;
  c.spent![id] = price;
  give(m, x);
  return { ok: true, paid: price };
}

/** Entrega los exclusivos cuyo requisito ya se cumple (idempotente). Los de contratos especiales se entregan al reclamarlos. */
export function grantUnlocks(m: Meta): ShopItem[] {
  const got: ShopItem[] = [];
  for (const x of CATALOG()) {
    if (x.price !== null || !x.req || (x.req.k === 'special' && (x.cat === 'title' || x.cat === 'frame'))) continue;
    if (!owns(m, x.id) && reqMet(m, x.req)) { give(m, x); got.push(x); }
  }
  return got;
}

// ---------- equipamiento ----------
const SLOT_OF: Partial<Record<ShopCat, Slot>> = { emblem: 'emblem', fx: 'aura', theme: 'theme', card: 'card', bg: 'bg', deco: 'deco' };
export function isEquipped(m: Pick<Meta, 'cosmetics'>, x: ShopItem, cls?: ClassId): boolean {
  const c = cos(m);
  if (x.cat === 'title') return c.title === x.ref;
  if (x.cat === 'frame') return c.frame === x.ref;
  if (x.cat === 'skin') return !!cls && c.skins![cls] === x.id;
  const s = SLOT_OF[x.cat];
  return !!s && c.eq![s] === x.id;
}
/** Equipa un elemento propio. Las variantes de color solo en su clase. Devuelve un error o null. */
export function equipItem(m: Pick<Meta, 'cosmetics'>, id: string, cls?: ClassId): string | null {
  const x = shopItem(id), c = cos(m);
  if (!x || !owns(m, id)) return 'No lo tienes.';
  if (x.cat === 'kit') return 'Los kits no se equipan: equipa sus elementos o guarda un conjunto.';
  if (x.cat === 'title') { c.title = x.ref; return null; }
  if (x.cat === 'frame') { c.frame = x.ref; return null; }
  if (x.cat === 'skin') {
    if (!cls) return 'Elige una clase.';
    if (x.cls && x.cls !== cls) return `Solo para ${CLASSES[x.cls].name}.`;
    c.skins![cls] = id; return null;
  }
  c.eq![SLOT_OF[x.cat]!] = id;
  return null;
}
/** Quita lo equipado en una ranura (o la variante de una clase). */
export function unequip(m: Pick<Meta, 'cosmetics'>, what: Slot | 'title' | 'frame' | 'skin', cls?: ClassId): void {
  const c = cos(m);
  if (what === 'title') c.title = null; else if (what === 'frame') c.frame = null;
  else if (what === 'skin') { if (cls) c.skins![cls] = null; } else c.eq![what] = null;
}

// ---------- kits guardados (conjuntos por clase) ----------
export function saveLoadout(m: Pick<Meta, 'cosmetics'>, cls: ClassId, name: string): string | null {
  const c = cos(m), list = (c.loadouts![cls] ??= []);
  if (list.length >= LOADOUT_MAX) return `Como mucho ${LOADOUT_MAX} conjuntos por clase.`;
  list.push({ name: name.slice(0, 20) || `Conjunto ${list.length + 1}`, skin: c.skins![cls] ?? null, aura: c.eq!.aura ?? null, emblem: c.eq!.emblem ?? null });
  return null;
}
/** Aplica un conjunto guardado (lo que ya no tengas se ignora). */
export function applyLoadout(m: Pick<Meta, 'cosmetics'>, cls: ClassId, idx: number): boolean {
  const c = cos(m), l: Loadout | undefined = c.loadouts![cls]?.[idx];
  if (!l) return false;
  const ok = (id: string | null, cat: ShopCat): string | null => (id && shopItem(id)?.cat === cat && owns(m, id) ? id : null);
  const skin = ok(l.skin, 'skin');
  c.skins![cls] = skin && (!shopItem(skin)!.cls || shopItem(skin)!.cls === cls) ? skin : null;
  c.eq!.aura = ok(l.aura, 'fx'); c.eq!.emblem = ok(l.emblem, 'emblem');
  return true;
}
export function deleteLoadout(m: Pick<Meta, 'cosmetics'>, cls: ClassId, idx: number): void { cos(m).loadouts![cls]?.splice(idx, 1); }
/** Vuelve al aspecto predeterminado de la clase (sin variante, aura ni emblema). Lo comprado se conserva. */
export function resetLook(m: Pick<Meta, 'cosmetics'>, cls: ClassId): void { const c = cos(m); c.skins![cls] = null; c.eq!.aura = null; c.eq!.emblem = null; }

/** Apariencia que se envía a la sala para la clase elegida (solo ids de paleta, aura y emoji). */
export function currentLook(m: Pick<Meta, 'cosmetics'>, cls: ClassId): Look {
  const c = cos(m), skin = c.skins![cls] ? shopItem(c.skins![cls]!) : undefined, aura = c.eq!.aura ? shopItem(c.eq!.aura!) : undefined, em = c.eq!.emblem ? shopItem(c.eq!.emblem!) : undefined;
  return { cls, ...(skin ? { skin: skin.ref } : {}), ...(aura ? { aura: aura.ref } : {}), ...(em ? { emblem: em.ref } : {}) };
}
export const emblemOf = (m: Pick<Meta, 'cosmetics'>): string => { const id = m.cosmetics?.eq?.emblem; return id ? shopItem(id)?.ref ?? '' : ''; };
/** Personalización del Archivo equipada (clases CSS e ilustración). */
export function archiveLook(m: Pick<Meta, 'cosmetics'>): { theme: string; card: string; bg: string; deco: string } {
  const r = (s: Slot): string => { const id = m.cosmetics?.eq?.[s]; return id ? shopItem(id)?.ref ?? '' : ''; };
  return { theme: r('theme'), card: r('card'), bg: r('bg'), deco: r('deco') };
}

// ---------- novedades ----------
/** Elementos propios que el jugador aún no ha visto en la tienda. */
export const unseenOwned = (m: Pick<Meta, 'cosmetics'>): ShopItem[] => CATALOG().filter((x) => x.cat !== 'kit' && owns(m, x.id) && !cos(m).seen!.includes(x.id));
export function markSeen(m: Pick<Meta, 'cosmetics'>, ids: string[]): boolean {
  const c = cos(m), add = ids.filter((i) => !c.seen!.includes(i));
  if (add.length) c.seen!.push(...add);
  return add.length > 0;
}
export { AURAS, FRAMES, PALETTES, TITLES };
