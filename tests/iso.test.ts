import { describe, expect, it } from 'vitest';
import { isoCell, isoPoint, isoSize, ISO_W, ISO_H } from '../src/render/board';

describe('vista isométrica', () => {
  it('casilla → pantalla → casilla devuelve la misma casilla', () => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 14; x++) {
      const p = isoPoint(x + 0.5, y + 0.5, 8), q = isoCell(p.x, p.y, 8);
      expect(Math.floor(q.x)).toBe(x); expect(Math.floor(q.y)).toBe(y);
    }
  });
  it('rombo 2:1 y el tablero entero cabe en el lienzo', () => {
    expect(ISO_W).toBe(ISO_H * 2);
    const s = isoSize(14, 8);
    for (const [x, y] of [[0, 0], [14, 0], [0, 8], [14, 8]] as const) {
      const p = isoPoint(x, y, 8);
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(s.w);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(s.h);
    }
  });
});

import { sheetDir } from '../src/render/board';
describe('hojas de 8 direcciones', () => {
  // filas: S, SE, E, NE, N, NW, W, SW
  it('cada desplazamiento en casillas mira hacia donde se ve en pantalla', () => {
    expect(sheetDir(1, 1)).toBe(0); // abajo en pantalla: S
    expect(sheetDir(1, 0)).toBe(1); // abajo a la derecha: SE
    expect(sheetDir(1, -1)).toBe(2); // derecha: E
    expect(sheetDir(0, -1)).toBe(3); // arriba a la derecha: NE
    expect(sheetDir(-1, -1)).toBe(4); // arriba: N
    expect(sheetDir(-1, 0)).toBe(5); // arriba a la izquierda: NW
    expect(sheetDir(-1, 1)).toBe(6); // izquierda: W
    expect(sheetDir(0, 1)).toBe(7); // abajo a la izquierda: SW
  });
});
