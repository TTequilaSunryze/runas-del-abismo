// Obtención de runas durante la expedición: ofertas (elige una de varias), garantías de élites y jefes y tablas de rareza.
// Todo usa el RNG de la partida (reproducible y sincronizado en cooperativo) y vive en HeroSave (se guarda con la partida).
import { pick, rand, shuffle, type RngBox } from '../core/rng';
import { RUNES, RUNE_LIST, RUNE_RESERVE, RUNE_SLOTS, cleanRunes, equipProblem, type RuneDef, type RuneRarity } from '../core/runes';
import { RELIC_REFUND, RELIC_TO_RUNE } from '../core/runeCatalog';

/** De dónde sale una oferta de runas. */
export type RuneSource = 'start' | 'combat' | 'elite' | 'boss' | 'final' | 'chest' | 'shrine' | 'event' | 'shop';
export const SOURCE_NAME: Record<RuneSource, string> = {
  start: 'Runa inicial', combat: 'Runa del combate', elite: 'Runa del élite', boss: 'Runa del jefe', final: 'Runa del jefe final',
  chest: 'Runa del cofre', shrine: 'Runa del santuario', event: 'Runa del evento', shop: 'Runa comprada',
};
export interface RuneOffer {
  src: RuneSource;
  /** opciones (ids de runa); se elige una o se renuncia (salvo la inicial) */
  runes: string[];
}

/** Lo que necesita un héroe para llevar runas (subconjunto de HeroSave). */
export interface RuneHolder {
  runes?: string[];
  runeBag?: string[];
  runeOffers?: RuneOffer[];
  relics: string[];
  gold: number;
}

/** Pesos de rareza (común … legendaria) por fuente. Las legendarias solo salen de jefes, del jefe final y de muy pocos eventos. */
export const RARITY_WEIGHTS: Record<RuneSource, [number, number, number, number, number]> = {
  start: [1, 0, 0, 0, 0],
  combat: [70, 28, 2, 0, 0],
  chest: [45, 40, 13, 2, 0],
  event: [30, 42, 22, 6, 0],
  shop: [40, 38, 18, 4, 0],
  shrine: [10, 45, 35, 10, 0],
  elite: [0, 58, 34, 8, 0],
  boss: [0, 0, 55, 40, 5],
  final: [0, 0, 0, 0, 1],
};
/** Probabilidad de que un combate normal suelte una runa menor (no deben ser la fuente principal). */
export const COMBAT_RUNE_CHANCE = (zone: number): number => Math.min(0.2, 0.08 + 0.03 * zone);
/** Opciones por oferta. */
export const OFFER_SIZE: Record<RuneSource, number> = { start: 3, combat: 2, chest: 2, event: 3, shop: 1, shrine: 3, elite: 3, boss: 3, final: 3 };
/** Precio en oro de una runa en la tienda, por rareza. */
export const RUNE_PRICE: Record<RuneRarity, number> = { 1: 60, 2: 95, 3: 150, 4: 230, 5: 400 };

/** Tira una rareza con los pesos de la fuente (la zona sube un poco las altas, nunca la legendaria fuera de jefes). */
export function rollRarity(box: RngBox, src: RuneSource, zone = 0): RuneRarity {
  const w = [...RARITY_WEIGHTS[src]];
  if (src !== 'start' && src !== 'final') { w[2] = w[2]! * (1 + 0.25 * zone); w[3] = w[3]! * (1 + 0.4 * zone); }
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand(box) * total;
  for (let i = 0; i < 5; i++) { r -= w[i]!; if (r < 0) return (i + 1) as RuneRarity; }
  for (let i = 4; i >= 0; i--) if (w[i]! > 0) return (i + 1) as RuneRarity;
  return 1;
}

/** Runas que el héroe aún no lleva (no se ofrecen duplicados de las no acumulables). */
function available(h: Pick<RuneHolder, 'runes' | 'runeBag'>, r: RuneDef): boolean {
  return r.stackable || !(h.runes ?? []).includes(r.id) && !(h.runeBag ?? []).includes(r.id);
}

/**
 * Genera una oferta: `size` runas distintas de la fuente. Las rarezas se tiran una a una; si no queda ninguna de esa rareza,
 * se baja (o sube) a la más cercana. Las iniciales son comunes y, si se puede, de familias distintas.
 */
export function makeOffer(box: RngBox, h: Pick<RuneHolder, 'runes' | 'runeBag'>, src: RuneSource, opts: { zone?: number; boss?: string; min?: RuneRarity; size?: number } = {}): RuneOffer {
  const size = opts.size ?? OFFER_SIZE[src];
  const out: string[] = [];
  const free = RUNE_LIST.filter((r) => !r.boss && !r.final && available(h, r));
  // jefe: su runa exclusiva va siempre entre las opciones (si no la lleva ya)
  if (opts.boss) { const own = RUNE_LIST.find((r) => r.boss === opts.boss && available(h, r) && (src !== 'final' || r.rarity === 5)); if (own) out.push(own.id); }
  // jefe final: el Juicio del Segador siempre, y legendarias de cualquier origen
  if (src === 'final') {
    const fin = RUNE_LIST.find((r) => r.final && available(h, r));
    if (fin) out.push(fin.id);
    for (const r of shuffle(box, RUNE_LIST.filter((x) => x.rarity === 5 && !x.final && available(h, x)))) { if (out.length >= size) break; out.push(r.id); }
  }
  let guard = 0;
  while (out.length < size && guard++ < 40) {
    let rar = Math.max(opts.min ?? 1, rollRarity(box, src, opts.zone ?? 0)) as RuneRarity;
    let pool: RuneDef[] = [];
    for (let d = 0; d <= 4 && !pool.length; d++) for (const r of [rar - d, rar + d]) if (!pool.length && r >= (opts.min ?? 1) && r <= 5) { pool = free.filter((x) => x.rarity === r && !out.includes(x.id)); if (pool.length) rar = r as RuneRarity; }
    if (!pool.length) break;
    // la inicial: familias distintas y efectos distintos
    if (src === 'start') { const fams = new Set(out.map((id) => RUNES[id]!.family)); const fresh = pool.filter((x) => !fams.has(x.family)); if (fresh.length) pool = fresh; }
    out.push(pick(box, pool).id);
  }
  return { src, runes: out };
}

/** Pone una oferta en la cola del héroe (se elige en orden). Devuelve la oferta, o null si no había nada que ofrecer. */
export function queueOffer(h: RuneHolder, offer: RuneOffer): RuneOffer | null {
  if (!offer.runes.length) return null;
  (h.runeOffers ??= []).push(offer);
  return offer;
}

/** Garantía de élites y jefes: la oferta existe siempre (si el catálogo se agota, se repite una rareza menor). */
export function guaranteedOffer(box: RngBox, h: RuneHolder, src: 'elite' | 'boss' | 'final', zone: number, boss?: string): RuneOffer {
  let offer = makeOffer(box, h, src, { zone, boss });
  if (!offer.runes.length) offer = makeOffer(box, h, 'event', { zone });
  if (!offer.runes.length) offer = { src, runes: [pick(box, RUNE_LIST.filter((r) => r.stackable)).id] };
  (h.runeOffers ??= []).push(offer);
  return offer;
}

// ---------- gestión de runas (equipar, sustituir, reserva) ----------
export type RuneOp =
  | { op: 'take'; idx: number; slot?: number; bag?: boolean }
  | { op: 'skip' }
  | { op: 'equip'; idx: number; slot?: number }
  | { op: 'unequip'; slot: number }
  | { op: 'swap'; from: number; to: number }
  | { op: 'drop'; idx: number };

/** Mete una runa: al espacio indicado (lo que había va a la reserva), al primer espacio libre o a la reserva. */
function place(h: RuneHolder, id: string, slot?: number, bag?: boolean): string | null {
  const eq = (h.runes ??= []), res = (h.runeBag ??= []);
  if (bag) { if (res.length >= RUNE_RESERVE) return `Reserva llena (${RUNE_RESERVE})`; if (!RUNES[id]!.stackable && (eq.includes(id) || res.includes(id))) return 'Ya la llevas'; res.push(id); return null; }
  if (slot !== undefined && slot < eq.length) {
    const p = equipProblem(eq, id, slot);
    if (p) return p;
    const old = eq[slot]!;
    eq[slot] = id;
    if (res.length < RUNE_RESERVE) res.push(old);
    return null;
  }
  const p = equipProblem(eq, id);
  if (p) return p;
  eq.push(id);
  return null;
}

/** Acción de runas de un jugador. Devuelve el error o null. Solo fuera de combate (lo comprueba metaAction). */
export function runeAction(h: RuneHolder, a: RuneOp): string | null {
  const offer = h.runeOffers?.[0];
  switch (a.op) {
    case 'take': {
      if (!offer) return 'No tienes runas que elegir';
      const id = offer.runes[a.idx];
      if (!id || !RUNES[id]) return 'Opción no válida';
      const err = place(h, id, a.slot, a.bag);
      if (err) return err;
      h.runeOffers!.shift();
      return null;
    }
    case 'skip':
      if (!offer) return 'No tienes runas que elegir';
      if (offer.src === 'start') return 'Elige tu runa inicial';
      h.runeOffers!.shift();
      return null;
    case 'equip': {
      const res = (h.runeBag ??= []);
      const id = res[a.idx];
      if (!id) return 'Esa runa no está en la reserva';
      res.splice(a.idx, 1);
      const err = place(h, id, a.slot);
      if (err) { res.splice(a.idx, 0, id); return err; }
      return null;
    }
    case 'unequip': {
      const eq = (h.runes ??= []), res = (h.runeBag ??= []);
      const id = eq[a.slot];
      if (!id) return 'Espacio vacío';
      if (res.length >= RUNE_RESERVE) return `Reserva llena (${RUNE_RESERVE}): suelta una antes`;
      eq.splice(a.slot, 1);
      res.push(id);
      return null;
    }
    case 'swap': {
      const eq = h.runes ?? [];
      if (!eq[a.from] || !eq[a.to]) return 'Espacio vacío';
      [eq[a.from], eq[a.to]] = [eq[a.to]!, eq[a.from]!];
      return null;
    }
    case 'drop': {
      const res = h.runeBag ?? [];
      if (!res[a.idx]) return 'Esa runa no está en la reserva';
      res.splice(a.idx, 1);
      return null;
    }
  }
}

/**
 * Migración de partidas guardadas (idempotente):
 * - Sin campo de runas (anteriores al PR #8): reciben Fractura, como en el núcleo V1.
 * - Reliquias personales: las que tienen runa equivalente pasan a runas (equipadas si hay hueco, si no a la reserva);
 *   el resto se devuelve en oro. La lista de reliquias queda vacía, así no se cobran dos veces.
 */
export function migrateRunes(h: RuneHolder): boolean {
  let changed = false;
  if (!Array.isArray(h.runes)) { h.runes = ['fractura']; changed = true; }
  const clean = cleanRunes(h.runes);
  if (clean.length !== h.runes.length) { h.runes = clean; changed = true; }
  if (h.runeBag !== undefined && !Array.isArray(h.runeBag)) { h.runeBag = []; changed = true; }
  if (h.runeBag) { const b = cleanRunes(h.runeBag, RUNE_RESERVE); if (b.length !== h.runeBag.length) { h.runeBag = b; changed = true; } }
  if (h.runeOffers !== undefined) {
    const ok = Array.isArray(h.runeOffers) ? h.runeOffers.filter((o) => o && Array.isArray(o.runes)).map((o) => ({ src: o.src, runes: o.runes.filter((id) => !!RUNES[id]) })).filter((o) => o.runes.length) : [];
    if (JSON.stringify(ok) !== JSON.stringify(h.runeOffers)) { h.runeOffers = ok; changed = true; }
  }
  if (h.relics?.length) {
    for (const r of h.relics) {
      const rune = RELIC_TO_RUNE[r];
      if (rune && !place(h, rune)) continue;
      if (rune && !place(h, rune, undefined, true)) continue;
      h.gold += RELIC_REFUND;
    }
    h.relics = [];
    changed = true;
  }
  return changed;
}
export { RUNE_SLOTS };
