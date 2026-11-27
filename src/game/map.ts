// Mapa de un acto: grafo por capas (estilo Slay the Spire). Cada nodo enlaza con 1-2 nodos de la capa siguiente.
import { rand, randInt, type RngBox } from '../core/rng';

export type MapKind = 'combat' | 'elite' | 'event' | 'rest' | 'shop' | 'boss' | 'cage' | 'shrine' | 'treasure' | 'forge' | 'altar'
  // G4: Senda de sangre (combate endurecido con recompensa conocida) y pasaje secreto (cámara, solo si se abre)
  | 'sangre' | 'vault';
export interface ActMap {
  /** capas de nodos: la última es el jefe */
  layers: MapKind[][];
  /** links[capa][nodo] = índices de la capa siguiente a los que se puede ir */
  links: number[][][];
}

/** Salas hasta el jefe (sin contarlo). La sala 15 de cada zona es el jefe. */
export const ACT_ROOMS = 14;

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
  const fight = (k: MapKind): number => (k === 'combat' || k === 'elite' || k === 'boss' || k === 'cage' || k === 'sangre' ? 1 : 0);
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

/**
 * Guía de cada ruta (las 14 salas antes del jefe), orientativa y con margen: unos 3 combates normales, 2 élites, 2 descansos
 * (uno es siempre la sala justo antes del jefe), 2 tesoros o bendiciones, unos 4 eventos «?» y un comerciante. Nunca 3 salas
 * de combate seguidas.
 */
export const MIN_FORKS = 6, MIN_PATHS = 6;
export const PATH_RULES = {
  fights: [2, 6], elites: [1, 2], rests: [2, 2], treasures: [1, 4], events: [2, 7], shops: [0, 2], maxStreak: 2,
  // compatibilidad con la guía anterior
  minFights: 2, maxFights: 6, maxElites: 2,
} as const;
export interface PathStats { fights: number; elites: number; rests: number; treasures: number; events: number; shops: number; streak: number }
const isFight = (k: MapKind): boolean => k === 'combat' || k === 'cage' || k === 'elite' || k === 'sangre';
const statKey = (k: MapKind): Exclude<keyof PathStats, 'streak'> | null =>
  k === 'combat' || k === 'cage' || k === 'sangre' ? 'fights' : k === 'elite' ? 'elites' : k === 'rest' ? 'rests'
    : k === 'treasure' || k === 'shrine' ? 'treasures' : k === 'event' || k === 'forge' || k === 'vault' ? 'events' : k === 'shop' ? 'shops' : null;
export function pathStats(m: ActMap, path: number[]): PathStats {
  const st: PathStats = { fights: 0, elites: 0, rests: 0, treasures: 0, events: 0, shops: 0, streak: 0 };
  let run = 0;
  path.forEach((i, l) => {
    const k = m.layers[l]![i]!;
    if (k === 'boss') return;
    const key = statKey(k);
    if (key) st[key]++;
    run = isFight(k) ? run + 1 : 0; st.streak = Math.max(st.streak, run);
  });
  return st;
}
const RANGE_KEYS = ['fights', 'elites', 'rests', 'treasures', 'events', 'shops'] as const;
export function pathOk(st: PathStats): boolean {
  return RANGE_KEYS.every((k) => st[k] >= PATH_RULES[k][0] && st[k] <= PATH_RULES[k][1]) && st.streak <= PATH_RULES.maxStreak;
}

/**
 * Mínimo y máximo de cada cuenta sobre TODAS las rutas, y la racha de combates más larga, sin enumerar las rutas
 * (con 14 filas pueden ser decenas de miles): programación dinámica fila a fila.
 */
export function pathRange(m: ActMap): { min: PathStats; max: PathStats } {
  type Acc = { lo: number[]; hi: number[]; run: number; best: number };
  const nk = RANGE_KEYS.length;
  const own = (k: MapKind): number[] => RANGE_KEYS.map((key) => (statKey(k) === key ? 1 : 0));
  let cur: Acc[] = m.layers[0]!.map((k) => { const o = own(k), f = isFight(k) ? 1 : 0; return { lo: o, hi: [...o], run: f, best: f }; });
  for (let l = 0; l < m.links.length; l++) {
    const row = m.layers[l + 1]!;
    const next: Array<Acc | null> = row.map(() => null);
    m.links[l]!.forEach((to, i) => to.forEach((j) => {
      const k = row[j]!, o = k === 'boss' ? Array(nk).fill(0) as number[] : own(k), src = cur[i]!;
      const run = k !== 'boss' && isFight(k) ? src.run + 1 : 0;
      const cand: Acc = { lo: src.lo.map((v, x) => v + o[x]!), hi: src.hi.map((v, x) => v + o[x]!), run, best: Math.max(src.best, run) };
      const n = next[j];
      next[j] = n ? { lo: n.lo.map((v, x) => Math.min(v, cand.lo[x]!)), hi: n.hi.map((v, x) => Math.max(v, cand.hi[x]!)), run: Math.max(n.run, cand.run), best: Math.max(n.best, cand.best) } : cand;
    }));
    cur = next.map((n) => n ?? { lo: Array(nk).fill(99) as number[], hi: Array(nk).fill(-1) as number[], run: 0, best: 0 });
  }
  const lo = RANGE_KEYS.map((_, x) => Math.min(...cur.map((c) => c.lo[x]!)));
  const hi = RANGE_KEYS.map((_, x) => Math.max(...cur.map((c) => c.hi[x]!)));
  const best = Math.max(...cur.map((c) => c.best));
  const mk = (v: number[], streak: number): PathStats => ({ ...Object.fromEntries(RANGE_KEYS.map((k, x) => [k, v[x]!])), streak } as PathStats);
  return { min: mk(lo, best), max: mk(hi, best) };
}

/** Nº de rutas distintas (sin enumerarlas). */
export function pathCount(m: ActMap): number {
  let ways = m.layers[0]!.map(() => 1);
  m.links.forEach((rows, l) => { const next = m.layers[l + 1]!.map(() => 0); rows.forEach((to, i) => to.forEach((j) => { next[j] = (next[j] ?? 0) + ways[i]!; })); ways = next; });
  return ways.reduce((a, b) => a + b, 0);
}

/** La fila justo antes del jefe es siempre de descanso. */
const restRow = (): number => ACT_ROOMS - 1;
/** Sala «principal» de cada fila (0..12): marca el ritmo; los demás nodos de la fila son alternativas cercanas. */
const PLAN: MapKind[] = ['elite', 'elite', 'rest', 'treasure', 'treasure', 'event', 'event', 'event', 'event', 'combat', 'combat', 'combat', 'shop'];
function allowed(k: MapKind, l: number): boolean {
  if (l === 0) return k === 'combat' || k === 'event';
  if (k === 'elite') return l >= 3;
  if (k === 'rest') return l >= 5 && l <= restRow() - 2;
  if (k === 'shop') return l >= 2;
  return true;
}
function rhythm(box: RngBox): MapKind[] {
  for (let t = 0; t < 500; t++) {
    const p = shuffleBox(box, PLAN);
    if (!p.every((k, l) => allowed(k, l))) continue;
    if (p.some((k, l) => l > 0 && k === 'elite' && p[l - 1] === 'elite')) continue;
    // nunca 3 filas de combate seguidas
    if (p.some((k, l) => l > 1 && isFight(k) && isFight(p[l - 1]!) && isFight(p[l - 2]!))) continue;
    return p;
  }
  return ['combat', 'event', 'treasure', 'elite', 'event', 'combat', 'rest', 'event', 'shop', 'elite', 'treasure', 'event', 'combat'];
}
function shuffleBox<T>(box: RngBox, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(box) * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
/** Alternativa a la sala principal de una fila mixta: un solo tipo cercano, para que las rutas varíen sin romper el ritmo. */
function alternative(box: RngBox, k: MapKind, l: number): MapKind | null {
  const opts: MapKind[] = k === 'elite' ? ['combat'] : k === 'combat' ? ['event'] : k === 'event' ? ['combat', 'treasure'] : k === 'treasure' ? ['event', 'shop'] : k === 'shop' ? ['treasure', 'event'] : [];
  const ok = opts.filter((x) => allowed(x, l));
  return ok.length ? ok[Math.floor(rand(box) * ok.length)]! : null;
}
function build(box: RngBox): ActMap {
  const L = ACT_ROOMS + 1, plan = rhythm(box);
  const widths = Array.from({ length: L }, (_, l) => (l === 0 ? 3 : l === L - 1 ? 1 : l === restRow() ? randInt(box, 2, 3) : randInt(box, 2, 4)));
  const layers: MapKind[][] = widths.map((w, l) => {
    if (l === L - 1) return ['boss'];
    if (l === restRow()) return Array.from({ length: w }, (): MapKind => 'rest');
    const main = plan[l]!, alt = rand(box) < 0.65 ? alternative(box, main, l) : null;
    if (!alt) return Array.from({ length: w }, (): MapKind => main);
    // fila mixta: los dos tipos aparecen siempre
    const row = Array.from({ length: w }, (): MapKind => (rand(box) < 0.5 ? main : alt));
    row[0] = main; row[w - 1] = alt;
    return shuffleBox(box, row);
  });
  return { layers, links: makeLinks(box, widths) };
}

/** ¿Cumple el mapa todas las garantías? (cada ruta y el contenido mínimo de la zona) */
export function mapOk(m: ActMap): boolean {
  if (m.layers.length !== ACT_ROOMS + 1 || m.layers.at(-1)?.[0] !== 'boss') return false;
  if (!m.layers[restRow()]!.every((k) => k === 'rest')) return false;
  if (!m.layers.flat().includes('shop')) return false;
  const forks = m.links.flat().filter((to) => to.length > 1).length;
  if (forks < MIN_FORKS || pathCount(m) < MIN_PATHS) return false;
  const { min, max } = pathRange(m);
  return RANGE_KEYS.every((k) => min[k] >= PATH_RULES[k][0] && max[k] <= PATH_RULES[k][1]) && max.streak <= PATH_RULES.maxStreak;
}

/** Mapa de reserva (por si la generación no encontrara uno válido): ramificado y válido sea cual sea el camino. */
function fallback(): ActMap {
  const rows: MapKind[][] = [
    ['combat', 'event', 'combat'], ['event', 'treasure', 'event'], ['combat', 'event', 'combat'], ['elite', 'elite', 'elite'],
    ['event', 'shop', 'event'], ['treasure', 'treasure', 'treasure'], ['rest', 'rest', 'rest'], ['combat', 'event', 'combat'],
    ['event', 'event', 'event'], ['elite', 'elite', 'elite'], ['event', 'treasure', 'event'], ['combat', 'combat', 'combat'],
    ['shop', 'shop', 'shop'], ['rest', 'rest', 'rest'], ['boss'],
  ];
  const links = rows.slice(0, -1).map((r, l) => r.map((_, i) => (rows[l + 1]!.length === 1 ? [0] : [...new Set([i, Math.min(r.length - 1, i + 1)])])));
  return { layers: rows, links };
}

/**
 * Genera una zona: 14 salas jugables y el jefe, en un grafo ramificado de 2 a 4 nodos por fila. La sala justo antes del jefe es
 * siempre un descanso. Cada ruta se valida (ver PATH_RULES); si no cumple, se vuelve a generar con la misma semilla de la
 * partida, así que el resultado es reproducible. Las salas especiales (forja, santuario, jaula, senda de sangre, pasaje secreto)
 * ya no son nodos del mapa: salen al entrar en un «?» o en un Tesoro.
 */
export function makeActMap(box: RngBox): ActMap {
  for (let t = 0; t < 600; t++) { const m = build(box); if (mapOk(m)) return m; }
  return fallback();
}

/** Probabilidad de que la zona tenga una Senda de sangre. */
export const SANGRE_CHANCE = 0.7;

/**
 * G4: rutas alternativas sobre un mapa ya válido.
 * - Senda de sangre: un combate normal (fuera de la primera fila) pasa a ser endurecido, con recompensa conocida. Cuenta como
 *   combate para las garantías, así que no rompe ninguna ruta.
 * - Pasaje secreto: un nodo extra al final de una fila intermedia, enlazado desde un nodo de la fila anterior (que conserva sus
 *   caminos) hacia uno de la siguiente. Solo se coloca si todas las rutas que pasan por él siguen cumpliendo las garantías;
 *   mientras está sellado no se puede elegir, así que nunca deja a nadie sin salida.
 */
export function addRoutes(box: RngBox, m: ActMap): ActMap {
  const L = m.layers.length;
  if (rand(box) < SANGRE_CHANCE) {
    const cand = m.layers.flatMap((row, l) => row.map((k, i) => ({ l, i, k }))).filter((x) => x.k === 'combat' && x.l >= 1 && x.l < L - 2);
    if (cand.length) { const c = cand[Math.floor(rand(box) * cand.length)]!; m.layers[c.l]![c.i] = 'sangre'; }
  }
  const tries: Array<{ l: number; from: number; to: number }> = [];
  for (let l = 2; l <= L - 3; l++) if (m.layers[l]!.length < 4) m.layers[l - 1]!.forEach((_, from) => m.layers[l + 1]!.forEach((__, to) => tries.push({ l, from, to })));
  for (let n = tries.length; n > 0; n--) {
    const c = tries.splice(Math.floor(rand(box) * n), 1)[0]!;
    const idx = m.layers[c.l]!.length;
    m.layers[c.l]!.push('vault');
    m.links[c.l - 1]![c.from]!.push(idx);
    m.links[c.l]!.push([c.to]);
    if (allPaths(m).every((p) => pathOk(pathStats(m, p)))) return m;
    m.layers[c.l]!.pop(); m.links[c.l - 1]![c.from]!.pop(); m.links[c.l]!.pop();
  }
  return m;
}

/** Fila y nodo del pasaje secreto de la zona (si lo hay). */
export function vaultAt(layers: readonly (readonly string[])[]): { l: number; i: number } | null {
  for (let l = 0; l < layers.length; l++) { const i = layers[l]!.indexOf('vault'); if (i >= 0) return { l, i }; }
  return null;
}

