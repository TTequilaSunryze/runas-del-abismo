// Sprites de 12×12 dibujados por código. Cada letra es un color de la paleta.
const SPR: Record<string, string[]> = {
  hero: ['....oooo....', '...oaaaao...', '..oaaaaaao..', '..osssssso..', '..osesseso..', '..osssssso..', '...obbbbo...', '..obbbbbbo..', '.sobbbbbbos.', '..obbbbbbo..', '...oo..oo...', '..ooo..ooo..'],
  slime: ['............', '............', '....oooo....', '...oaaaao...', '..oaaaaaao..', '..oaeaaeao..', '.oaaaaaaaao.', '.oaaaaaaaao.', '.oaaaaaaaao.', '..oooooooo..', '............', '............'],
  bat: ['............', 'o..........o', 'oo...oo...oo', 'oao.oaao.oao', 'oaaooaaooaao', '.oaaoeeoaao.', '..ooaaaaoo..', '....oaao....', '....oooo....', '............', '............', '............'],
  skel: ['....oooo....', '...owwwwo...', '...owwwwo...', '...oewweo...', '...owwwwo...', '....owwo....', '...owwwwo...', '..owowwowo..', '...owwwwo...', '....owwo....', '...ow..wo...', '..oo....oo..'],
  ghoul: ['....oooo....', '...oaaaao...', '..oaaaaaao..', '..oaeaaeao..', '..oaaooaao..', '...oaaaao...', '..oabbbbao..', '.oaobbbboao.', '.oa.obbo.ao.', '....obbo....', '...oa..ao...', '..ooo..ooo..'],
};

const BASE: Record<string, string> = { o: '#1a1226', w: '#f1ead8', s: '#f0c9a0' };

interface Look {
  sprite: string;
  pal: Record<string, string>;
  scale?: number;
}

/** Colores de capa por jugador (1 a 4). */
export const PLAYER_COLORS = [
  { a: '#7a2230', b: '#c0394f' },
  { a: '#1f3f7a', b: '#3f86e0' },
  { a: '#1f5a2a', b: '#4cb85a' },
  { a: '#7a5a1a', b: '#e0b030' },
];

const ENEMY_LOOK: Record<string, Look> = {
  limo: { sprite: 'slime', pal: { a: '#8fbf6a', e: '#102010' } },
  murcielago: { sprite: 'bat', pal: { a: '#7a4a9a', e: '#ff4060' } },
  esqueleto: { sprite: 'skel', pal: { e: '#c02030' } },
  arquero: { sprite: 'skel', pal: { w: '#c9d6a8', e: '#30a040' } },
  necrofago: { sprite: 'ghoul', pal: { a: '#7d9a78', b: '#4a3a4a', e: '#ffd24a' } },
  prior: { sprite: 'ghoul', pal: { a: '#b9a8d8', b: '#4a2a7a', e: '#ff3060' }, scale: 1.5 },
  caballero: { sprite: 'skel', pal: { w: '#c8c8d8', e: '#ff2040' }, scale: 1.25 },
};

const cache = new Map<string, HTMLCanvasElement>();

function bake(sprite: string, pal: Record<string, string>): HTMLCanvasElement {
  const k = sprite + JSON.stringify(pal);
  let c = cache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 12;
  const g = c.getContext('2d')!;
  const full = { ...BASE, ...pal };
  SPR[sprite]!.forEach((row, y) => {
    for (let x = 0; x < 12; x++) {
      const col = full[row[x]!];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  cache.set(k, c);
  return c;
}

function weapon(g: CanvasRenderingContext2D, cls: string, x: number, y: number, s: number): void {
  const hx = x + 10 * s, hy = y + 8 * s;
  if (cls === 'guerrero') {
    g.fillStyle = '#d0d6e8'; g.fillRect(hx, hy - 7 * s, s, 7 * s);
    g.fillStyle = '#8a6a2a'; g.fillRect(hx - s, hy, 3 * s, s);
  } else if (cls === 'mago') {
    g.fillStyle = '#7a4a1a'; g.fillRect(hx, hy - 7 * s, s, 10 * s);
    g.fillStyle = '#58a6ff'; g.fillRect(hx - s, hy - 9 * s, 3 * s, 3 * s);
  } else {
    g.fillStyle = '#7a4a1a'; g.fillRect(hx, hy - 6 * s, s, 8 * s);
    g.fillStyle = '#f2c14e'; g.fillRect(hx - s, hy - 8 * s, 3 * s, 3 * s);
  }
}

/** Dibuja una unidad centrada en la base de una casilla de tamaño `tile`. */
export function drawUnit(g: CanvasRenderingContext2D, kind: string, team: string, colorIdx: number, cx: number, baseY: number, tile: number, flash: boolean): void {
  const hero = team === 'hero';
  const look = hero ? { sprite: 'hero', pal: PLAYER_COLORS[colorIdx % 4]!, scale: 1 } : ENEMY_LOOK[kind] ?? ENEMY_LOOK.esqueleto!;
  const s = Math.max(2, Math.floor((tile * 0.9 * (look.scale ?? 1)) / 12));
  const x = Math.round(cx - 6 * s), y = Math.round(baseY - 12 * s);
  g.imageSmoothingEnabled = false;
  const img = bake(look.sprite, look.pal as Record<string, string>);
  if (hero) {
    g.drawImage(img, x, y, 12 * s, 12 * s);
    weapon(g, kind, x, y, s);
  } else {
    g.save(); g.translate(x + 12 * s, y); g.scale(-1, 1); g.drawImage(img, 0, 0, 12 * s, 12 * s); g.restore();
  }
  if (flash) {
    g.globalAlpha = 0.55; g.fillStyle = '#fff'; g.fillRect(x + 2 * s, y + s, 8 * s, 10 * s); g.globalAlpha = 1;
  }
}
