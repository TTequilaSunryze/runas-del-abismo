// Azar reproducible (mulberry32). El estado es un número: se guarda con la partida.
export interface RngBox {
  rng: number;
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Devuelve un número en [0, 1) y avanza el estado guardado en `box`. */
export function rand(box: RngBox): number {
  box.rng = (box.rng + 0x6d2b79f5) >>> 0;
  let t = box.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entero entre a y b, ambos incluidos. */
export function randInt(box: RngBox, a: number, b: number): number {
  return a + Math.floor(rand(box) * (b - a + 1));
}

export function pick<T>(box: RngBox, list: readonly T[]): T {
  return list[Math.floor(rand(box) * list.length)]!;
}

export function shuffle<T>(box: RngBox, list: readonly T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(box) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
