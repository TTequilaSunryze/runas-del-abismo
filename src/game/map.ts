// Mapa de un acto: grafo por capas (estilo Slay the Spire). Cada nodo enlaza con 1-2 nodos de la capa siguiente.
import { rand, randInt, type RngBox } from '../core/rng';

export type MapKind = 'combat' | 'elite' | 'event' | 'rest' | 'shop' | 'boss' | 'cage' | 'shrine' | 'treasure' | 'forge' | 'altar';
export interface ActMap {
  /** capas de nodos: la última es el jefe */
  layers: MapKind[][];
  /** links[capa][nodo] = índices de la capa siguiente a los que se puede ir */
  links: number[][][];
}

/** Salas hasta el jefe (sin contarlo). */
export const ACT_ROOMS = 7;

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
      if (b > 1 && rand(box) < 0.6) out[i]!.add(Math.max(0, Math.min(b - 1, j + (x * b - j > 0.5 ? 1 : -1))));
    }
    for (let j = 0; j < b; j++) {
      if (out.some((s) => s.has(j))) continue;
      out[nearest((j + 0.5) / b, a)]!.add(j);
    }
    links.push(out.map((s) => [...s].sort((p, q) => p - q)));
  }
  return links;
}

/** Nº mínimo de combates (de cualquier tipo, jefe incluido) en cualquier camino de la capa 0 al jefe. */
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

/** Todas las rutas completas (índice de nodo en cada capa), de cualquier nodo de la capa 0 hasta el jefe. */
export function allPaths(m: ActMap): number[][] {
  const out: number[][] = [];
  const walk = (l: number, path: number[]): void => {
    if (l === m.layers.length - 1) { out.push(path); return; }
    for (const j of m.links[l]![path[l]!] ?? []) walk(l + 1, [...path, j]);
  };
  m.layers[0]!.forEach((_, i) => walk(0, [i]));
  return out;
}

/** Garantías de cada ruta: entre 3 y 5 combates normales (las jaulas cuentan), como mucho un élite, al menos un descanso
 * antes del jefe y nunca 3 salas de combate seguidas. */
export const MIN_FORKS = 4, MIN_PATHS = 6;
export const PATH_RULES = { minFights: 3, maxFights: 5, maxElites: 1, maxStreak: 2 };
export interface PathStats { fights: number; elites: number; rests: number; streak: number }
export function pathStats(m: ActMap, path: number[]): PathStats {
  let fights = 0, elites = 0, rests = 0, streak = 0, run = 0;
  path.forEach((i, l) => {
    const k = m.layers[l]![i]!;
    if (k === 'boss') return;
    const fight = k === 'combat' || k === 'cage' || k === 'elite';
    if (k === 'combat' || k === 'cage') fights++;
    if (k === 'elite') elites++;
    if (k === 'rest') rests++;
    run = fight ? run + 1 : 0; streak = Math.max(streak, run);
  });
  return { fights, elites, rests, streak };
}
export function pathOk(st: PathStats): boolean {
  return st.fights >= PATH_RULES.minFights && st.fights <= PATH_RULES.maxFights && st.elites <= PATH_RULES.maxElites && st.rests >= 1 && st.streak <= PATH_RULES.maxStreak;
}

type W = Partial<Record<MapKind, number>>;
/** Papel de cada fila: de combate, mixta o tranquila. Marca el ritmo sin fijar qué sala va en cada sitio. */
type Role = 'F' | 'M' | 'N';
function weights(role: Role, l: number, last: number): W {
  if (l === last) return { rest: 9, shop: 1, event: 1 };
  if (role === 'F') return { combat: 7, elite: l >= 2 ? 4 : 0, cage: 1, event: 1 };
  if (role === 'M') return { combat: 5, elite: l >= 2 ? 3 : 0, cage: 1, event: 2, shop: l >= 1 ? 1 : 0, shrine: l >= 1 ? 1 : 0, rest: l >= 3 ? 1 : 0 };
  return { event: 3, shop: 2, shrine: l >= 1 ? 2 : 0, treasure: l >= 1 ? 1 : 0, forge: l >= 1 ? 2 : 0, rest: l >= 3 ? 1 : 0 };
}
function roll(box: RngBox, w: W): MapKind {
  const e = Object.entries(w).filter(([, v]) => (v ?? 0) > 0) as Array<[MapKind, number]>;
  let r = rand(box) * e.reduce((n, [, v]) => n + v, 0);
  for (const [k, v] of e) if ((r -= v) < 0) return k;
  return e[0]![0];
}
/** Ritmo de las 6 primeras filas: 3 o 4 de combate (nunca 3 seguidas), el resto mixtas o tranquilas; la primera nunca es tranquila. */
function rhythm(box: RngBox): Role[] {
  for (;;) {
    const r: Role[] = Array.from({ length: ACT_ROOMS - 1 }, (_, l): Role => { const x = rand(box); return l === 0 ? (x < 0.6 ? 'F' : 'M') : x < 0.5 ? 'F' : x < 0.75 ? 'M' : 'N'; });
    const f = r.filter((x) => x === 'F').length, streak = r.join('').includes('FFF');
    if (f >= 2 && f <= 4 && !streak && r.includes('N')) return r;
  }
}

function build(box: RngBox): ActMap {
  const L = ACT_ROOMS + 1, last = L - 2, roles = rhythm(box);
  const widths = Array.from({ length: L }, (_, l) => (l === 0 ? 3 : l === L - 1 ? 1 : l === last ? randInt(box, 2, 3) : randInt(box, 2, 4)));
  const layers: MapKind[][] = widths.map((w, l) => Array.from({ length: w }, (): MapKind => (l === L - 1 ? 'boss' : roll(box, weights(roles[l] ?? 'N', l, last)))));
  return { layers, links: makeLinks(box, widths) };
}

/** ¿Cumple el mapa todas las garantías? (cada ruta y el contenido mínimo de la zona) */
export function mapOk(m: ActMap): boolean {
  const n = (k: MapKind): number => m.layers.flat().filter((x) => x === k).length;
  if (n('forge') < 1 || n('shop') < 1 || n('event') < 1 || n('elite') > 3) return false;
  // caminos que se separan y vuelven a unirse: varias bifurcaciones y bastantes rutas distintas
  const forks = m.links.flat().filter((to) => to.length > 1).length;
  const paths = allPaths(m);
  if (forks < MIN_FORKS || paths.length < MIN_PATHS) return false;
  return paths.every((p) => pathOk(pathStats(m, p)));
}

/** Mapa de reserva (por si la generación no encontrara uno válido): ramificado y válido sea cual sea el camino. */
function fallback(): ActMap {
  const rows: MapKind[][] = [
    ['combat', 'combat', 'combat'], ['shrine', 'event', 'shop'], ['combat', 'cage', 'combat'], ['forge', 'treasure', 'event'],
    ['combat', 'combat', 'combat'], ['event', 'elite', 'shop'], ['rest', 'rest', 'rest'], ['boss'],
  ];
  const links = rows.slice(0, -1).map((r, l) => r.map((_, i) => (rows[l + 1]!.length === 1 ? [0] : [...new Set([i, Math.min(r.length - 1, i + 1)])])));
  return { layers: rows, links };
}

/**
 * Genera una zona: 7 salas jugables y el jefe, en un grafo ramificado de 2 a 4 nodos por capa. Cada ruta completa se valida
 * (3-5 combates normales, máximo un élite, un descanso como mínimo y sin 3 combates seguidos); si no cumple, se vuelve a generar
 * con la misma semilla de la partida, así que el resultado es reproducible.
 */
export function makeActMap(box: RngBox): ActMap {
  for (let t = 0; t < 400; t++) {
    const m = build(box);
    if (!mapOk(m)) continue;
    // riesgo y recompensa: si la zona no tiene élite, se intenta convertir un combate en élite sin romper ninguna ruta
    if (!m.layers.flat().includes('elite')) {
      const cand = m.layers.flatMap((row, l) => row.map((k, i) => ({ l, i, k }))).filter((x) => x.k === 'combat' && x.l >= 2 && x.l < m.layers.length - 2);
      for (let n = cand.length; n > 0; n--) {
        const c = cand.splice(Math.floor(rand(box) * n), 1)[0]!;
        m.layers[c.l]![c.i] = 'elite';
        if (mapOk(m)) break;
        m.layers[c.l]![c.i] = 'combat';
      }
    }
    return m;
  }
  return fallback();
}
