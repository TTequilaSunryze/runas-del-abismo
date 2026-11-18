// Mapa de un acto: grafo por capas (estilo Slay the Spire). Cada nodo enlaza con 1-2 nodos de la capa siguiente.
import { pick, rand, randInt, shuffle, type RngBox } from '../core/rng';

export type MapKind = 'combat' | 'elite' | 'event' | 'rest' | 'shop' | 'boss' | 'cage' | 'shrine' | 'treasure';
export interface ActMap {
  /** capas de nodos: la última es el jefe */
  layers: MapKind[][];
  /** links[capa][nodo] = índices de la capa siguiente a los que se puede ir */
  links: number[][][];
}

/** Salas hasta el jefe (sin contarlo). */
export const ACT_ROOMS = 10;

const nearest = (x: number, n: number): number => Math.max(0, Math.min(n - 1, Math.floor(x * n)));

function makeLinks(box: RngBox, widths: number[]): number[][][] {
  const links: number[][][] = [];
  for (let l = 0; l < widths.length - 1; l++) {
    const a = widths[l]!, b = widths[l + 1]!;
    const out: Set<number>[] = Array.from({ length: a }, () => new Set<number>());
    for (let i = 0; i < a; i++) {
      const x = (i + 0.5) / a;
      const j = nearest(x, b);
      out[i]!.add(j);
      if (b > 1 && rand(box) < 0.5) out[i]!.add(Math.max(0, Math.min(b - 1, j + (x * b - j > 0.5 ? 1 : -1))));
    }
    for (let j = 0; j < b; j++) {
      if (out.some((s) => s.has(j))) continue;
      out[nearest((j + 0.5) / b, a)]!.add(j);
    }
    links.push(out.map((s) => [...s].sort((p, q) => p - q)));
  }
  return links;
}

/** Nº mínimo de combates en cualquier camino de la capa 0 al jefe. */
export function minFightsOnPath(m: ActMap): number {
  const fight = (k: MapKind): number => (k === 'combat' || k === 'elite' || k === 'boss' || k === 'cage' ? 1 : 0);
  let best = m.layers[0]!.map((k) => fight(k));
  for (let l = 0; l < m.links.length; l++) {
    const next = m.layers[l + 1]!.map(() => Infinity);
    m.links[l]!.forEach((to, i) => to.forEach((j) => { next[j] = Math.min(next[j]!, best[i]! + fight(m.layers[l + 1]![j]!)); }));
    best = next;
  }
  return Math.min(...best);
}

export const combatShare = (m: ActMap): number => m.layers.flat().filter((k) => k === 'combat').length / m.layers.flat().length;

function build(box: RngBox): ActMap {
  const L = ACT_ROOMS + 1;
  const widths = Array.from({ length: L }, (_, l) => (l === 0 ? 3 : l === L - 1 ? 1 : l === L - 2 ? randInt(box, 2, 3) : randInt(box, 2, 4)));
  const layers: MapKind[][] = widths.map((w, l) => Array.from({ length: w }, (): MapKind => (l === L - 1 ? 'boss' : 'combat')));
  const total = widths.reduce((s, w) => s + w, 0);
  // la capa 1 trae siempre un santuario (las primeras ofertas de hechizo) y nunca eventos
  layers[1]![randInt(box, 0, widths[1]! - 1)] = 'shrine';
  // antes del jefe siempre hay un descanso
  layers[L - 2]![randInt(box, 0, widths[L - 2]! - 1)] = 'rest';
  // estructura fija: 2 tiendas, 1 sala de botín en el centro del acto y 1 o 2 eventos
  const mid = Math.floor(L / 2);
  const freeIn = (l: number): number[] => layers[l]!.map((k, i) => (k === 'combat' ? i : -1)).filter((i) => i >= 0 && layers[l]!.filter((x) => x !== 'combat').length < widths[l]! - 1);
  const put = (k: MapKind, lo: number, hi: number): boolean => {
    const ls = shuffle(box, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).filter((l) => !layers[l]!.includes(k) && freeIn(l).length);
    const l = ls[0];
    if (l === undefined) return false;
    layers[l]![pick(box, freeIn(l))] = k;
    return true;
  };
  layers[mid]![pick(box, freeIn(mid))] = 'treasure';
  put('shop', 2, mid - 1); put('shop', mid + 1, L - 3);
  put('event', 2, L - 3); if (rand(box) < 0.5) put('event', 2, L - 3);
  // el resto (élites, más descansos y santuarios) hasta dejar entre el 60% y el 70% de combates
  const target = Math.round(total * (0.62 + rand(box) * 0.06));
  put('elite', 4, L - 3);
  const extra: MapKind[] = ['elite', 'rest', 'shrine', 'elite', 'rest', 'elite'];
  for (const k of extra) {
    if (layers.flat().filter((x) => x === 'combat').length <= target) break;
    put(k, k === 'elite' ? 4 : 3, L - 3);
  }
  return { layers, links: makeLinks(box, widths) };
}

/** Genera un acto: ≥10 salas hasta el jefe, 60-70% de combates normales y ningún camino sin pelear. */
export function makeActMap(box: RngBox): ActMap {
  let m = build(box);
  for (let t = 0; t < 300; t++) {
    const s = combatShare(m);
    const n = (k: MapKind): number => m.layers.flat().filter((x) => x === k).length;
    if (s >= 0.6 && s <= 0.7 && minFightsOnPath(m) >= 5 && n('shop') === 2 && n('treasure') === 1 && n('event') >= 1 && n('event') <= 2) return m;
    m = build(box);
  }
  return m;
}
