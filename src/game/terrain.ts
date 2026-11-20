// v13: tableros por bioma. Cada zona tiene sus biomas; cada combate sale con uno al azar y, a veces, con forma de pasillo.
import { pick, rand, randInt, shuffle, type RngBox } from '../core/rng';
import type { Pos } from '../core/state';

export interface Terrain {
  biome: string;
  name: string;
  obstacles: Pos[];
  abyss: Pos[];
  braziers: Pos[];
  roots: Pos[];
  puddles: Pos[];
  /** pasillo estrecho: filas por las que se puede pasar */
  lane?: number[];
}

export interface BiomeDef { id: string; name: string; zone: number; gen: (b: Builder) => void }

/** Ayudante para dibujar el terreno sin pisar las zonas de despliegue (columnas 0-2 y las 3 últimas). */
class Builder {
  cells = new Map<string, 'wall' | 'abyss' | 'brazier' | 'root' | 'puddle'>();
  constructor(readonly box: RngBox, readonly w: number, readonly h: number) {}
  /** columnas centrales donde se puede poner terreno */
  get x0(): number { return 3; }
  get x1(): number { return this.w - 4; }
  ok(p: Pos): boolean { return p.x >= this.x0 && p.x <= this.x1 && p.y >= 0 && p.y < this.h && !this.cells.has(`${p.x},${p.y}`); }
  put(p: Pos, k: 'wall' | 'abyss' | 'brazier' | 'root' | 'puddle'): void { if (this.ok(p)) this.cells.set(`${p.x},${p.y}`, k); }
  rnd(): Pos { return { x: randInt(this.box, this.x0, this.x1), y: randInt(this.box, 0, this.h - 1) }; }
  /** mancha orgánica de `n` casillas alrededor de un punto */
  blob(k: 'wall' | 'abyss' | 'root' | 'puddle', n: number, at = this.rnd()): void {
    let p = at;
    for (let i = 0; i < n * 3 && n > 0; i++) {
      if (this.ok(p)) { this.put(p, k); n--; }
      const d = pick(this.box, [[1, 0], [-1, 0], [0, 1], [0, -1]] as const);
      p = { x: Math.max(this.x0, Math.min(this.x1, p.x + d[0])), y: Math.max(0, Math.min(this.h - 1, p.y + d[1])) };
    }
  }
  /** segmento recto */
  seg(k: 'wall' | 'abyss', at: Pos, len: number, vertical: boolean): void {
    for (let i = 0; i < len; i++) this.put(vertical ? { x: at.x, y: at.y + i } : { x: at.x + i, y: at.y }, k);
  }
  many(k: 'wall' | 'brazier' | 'puddle' | 'root', n: number): void { for (let i = 0; i < n; i++) this.put(this.rnd(), k); }
}

export const BIOMES: BiomeDef[] = [
  // Zona 1 · Catacumbas Olvidadas
  { id: 'osario', name: 'Osario', zone: 0, gen: (b) => { for (let i = 0; i < 3 + randInt(b.box, 0, 2); i++) b.seg('wall', b.rnd(), 2, rand(b.box) < 0.5); } },
  { id: 'cripta', name: 'Cripta inundada', zone: 0, gen: (b) => { b.blob('puddle', 5); b.blob('puddle', 4); b.many('wall', 2 + randInt(b.box, 0, 1)); } },
  { id: 'nichos', name: 'Pasillos de nichos', zone: 0, gen: (b) => {
    for (let x = b.x0; x <= b.x1; x += 2) { b.put({ x, y: 0 }, 'wall'); b.put({ x, y: b.h - 1 }, 'wall'); }
    b.many('wall', 2);
  } },
  // Zona 2 · Bosque Corrompido
  { id: 'raices', name: 'Claro de raíces', zone: 1, gen: (b) => { b.blob('root', 4); b.blob('root', 4); b.blob('root', 3); b.many('wall', 2 + randInt(b.box, 0, 1)); } },
  { id: 'cueva', name: 'Cueva claustrofóbica', zone: 1, gen: (b) => {
    for (let x = b.x0; x <= b.x1; x++) { if (rand(b.box) < 0.55) b.put({ x, y: 0 }, 'wall'); if (rand(b.box) < 0.55) b.put({ x, y: b.h - 1 }, 'wall'); }
    b.blob('wall', 3); b.blob('wall', 3);
  } },
  { id: 'pantano', name: 'Pantano de esporas', zone: 1, gen: (b) => { b.blob('puddle', 4); b.blob('puddle', 4); b.many('wall', 3); b.blob('root', 2); } },
  // Zona 3 · Ruinas de Ceniza
  { id: 'braseros', name: 'Salón de braseros', zone: 2, gen: (b) => { b.many('brazier', 4 + randInt(b.box, 0, 2)); b.many('wall', 2); } },
  { id: 'calles', name: 'Calles derrumbadas', zone: 2, gen: (b) => {
    for (let i = 0; i < 4; i++) b.blob('wall', 2);
    b.seg('abyss', b.rnd(), 2 + randInt(b.box, 0, 1), rand(b.box) < 0.5); b.seg('abyss', b.rnd(), 2, rand(b.box) < 0.5);
  } },
  { id: 'fundicion', name: 'Fundición', zone: 2, gen: (b) => {
    // canal de lava vertical con 2 puentes
    const x = randInt(b.box, b.x0 + 1, b.x1 - 1);
    const bridges = shuffle(b.box, Array.from({ length: b.h }, (_, i) => i)).slice(0, 2);
    for (let y = 0; y < b.h; y++) if (!bridges.includes(y)) b.put({ x, y }, 'abyss');
    b.many('brazier', 2); b.many('wall', 1);
  } },
  // Zona 4 · El Abismo
  { id: 'espejos', name: 'Salón de espejos rotos', zone: 3, gen: (b) => {
    for (let i = 0; i < 3; i++) { const p = b.rnd(); b.seg('wall', { x: p.x, y: Math.min(p.y, b.h - 3) }, 2 + randInt(b.box, 0, 1), true); }
    b.many('wall', 2);
  } },
  { id: 'islas', name: 'Islas flotantes', zone: 3, gen: (b) => { for (let i = 0; i < 4; i++) b.blob('abyss', 3 + randInt(b.box, 0, 2)); } },
];

/** Probabilidad de que un combate normal salga como pasillo estrecho. */
export const CORRIDOR_CHANCE = 0.2;

/**
 * Genera el terreno de un combate. `corridor`: pasillo de 1-2 filas con un embudo junto a los enemigos,
 * donde el placaje y el control de zona deciden la pelea.
 */
export function genTerrain(box: RngBox, zone: number, w: number, h: number, players: number, corridor: boolean): Terrain {
  const options = BIOMES.filter((b) => b.zone === Math.min(zone, 3));
  const biome = pick(box, options);
  const b = new Builder(box, w, h);
  let lane: number[] | undefined;
  if (corridor) {
    const width = players >= 3 ? 2 : 1;
    const mid = Math.floor(h / 2);
    lane = Array.from({ length: width + 1 }, (_, i) => mid - Math.floor(width / 2) + i).filter((y) => y >= 0 && y < h);
    // pasillo: muros en todas las filas fuera del carril, con un embudo que se abre antes de los enemigos
    for (let x = b.x0; x <= b.x1; x++) for (let y = 0; y < h; y++) {
      const funnel = x >= b.x1 - 1 && Math.abs(y - mid) <= 1 + (x - (b.x1 - 1));
      if (!lane.includes(y) && !funnel) b.put({ x, y }, 'wall');
    }
    // un poco del bioma dentro del carril
    if (biome.id === 'raices' || biome.id === 'pantano') b.cells.set(`${randInt(box, b.x0 + 1, b.x1 - 2)},${lane[0]}`, biome.id === 'raices' ? 'root' : 'puddle');
    if (biome.id === 'braseros') b.cells.set(`${b.x0 + 1},${lane[0]! - 1 >= 0 ? lane[0]! - 1 : lane.at(-1)! + 1}`, 'brazier');
  } else biome.gen(b);
  const out: Terrain = { biome: biome.id, name: corridor ? `${biome.name} · pasillo` : biome.name, obstacles: [], abyss: [], braziers: [], roots: [], puddles: [], ...(lane ? { lane } : {}) };
  for (const [k, kind] of b.cells) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const p = { x, y };
    if (kind === 'wall') out.obstacles.push(p);
    else if (kind === 'abyss') out.abyss.push(p);
    else if (kind === 'brazier') out.braziers.push(p);
    else if (kind === 'root') out.roots.push(p);
    else out.puddles.push(p);
  }
  return out;
}
