// Sprites dibujados por código. Cada letra es un color de la paleta.
// Héroes: 16×16, uno por clase. Enemigos: 12×12.
const SPR: Record<string, string[]> = {
  guerrero: [
    '......oooo......', '.....obbbbo.....', '....ommmmmmo....', '...ommmmmmmmo...', '...ommssssmmo...', '...omsesseso....',
    '...omssssso.....', '....oommoo......', '...oaammaao.....', '..oaammmmaao....', '..osammmmaso....', '..ooammmmaoo....',
    '....oaaaao......', '....oao.oao.....', '...ommo.ommo....', '...ooo..ooo.....',
  ],
  mago: [
    '.......oo.......', '......oaao......', '.....oaaaao.....', '.....oaabao.....', '...ooaaaaaaoo...', '..obbbbbbbbbbo..',
    '....osssssso....', '....osesseso....', '....owwwwwwo....', '.....owwwwo.....', '....oaawwaao....', '...oaaaaaaaao...',
    '..osaaabbaaaso..', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oooooooooo...',
  ],
  clerigo: [
    '......oooo......', '.....owwwwo.....', '....owwggwwo....', '....owwwwwwo....', '....osssssso....', '....osesseso....',
    '....osssssso....', '.....oosso......', '....obbggbbo....', '...obbbggbbbo...', '..osbggggggbso..', '..oobbbggbbboo..',
    '....obbggbbo....', '....obbbbbbo....', '...oaaaooaaao...', '...oooo..oooo...',
  ],
  picaro: [
    '......oooo......', '.....oaaaao.....', '....oaaaaaao....', '....oaaaaaao....', '....oassssao....', '....oaesseao....',
    '....oakkkkao....', '.....oakkao.....', '....oabbbbao....', '...oaabbbbaao...', '..osabbbbbbaso..', '..ooabbbbbbaoo..',
    '....oabbbbao....', '....oko..oko....', '...okko..okko...', '...ooo....ooo...',
  ],
  arquero: [
    '......oooo......', '.....oaaaao.....', '....oaaaaaao....', '....oaabbaao....', '....oassssao....', '....oaesseao....',
    '....oassssao....', '.....oassao.....', '....obbaabbo....', '...obbbaabbbo...', '..osbbbaabbbso..', '..oobbbbbbbboo..',
    '....obbbbbbo....', '....oao..oao....', '...okko..okko...', '...ooo....ooo...',
  ],
  slime: ['............', '............', '....oooo....', '...oaaaao...', '..oaaaaaao..', '..oaeaaeao..', '.oaaaaaaaao.', '.oaabaaaaao.', '.oaaaaaaaao.', '..oooooooo..', '............', '............'],
  bat: ['............', 'o..........o', 'oo...oo...oo', 'oao.oaao.oao', 'oaaooaaooaao', '.oaaoeeoaao.', '..ooaaaaoo..', '....oaao....', '....oooo....', '............', '............', '............'],
  skel: ['....oooo....', '...owwwwo...', '...owwwwo...', '...oewweo...', '...owwwwo...', '....owwo....', '...owwwwo...', '..owowwowo..', '...owwwwo...', '....owwo....', '...ow..wo...', '..oo....oo..'],
  ghoul: ['....oooo....', '...oaaaao...', '..oaaaaaao..', '..oaeaaeao..', '..oaaooaao..', '...oaaaao...', '..oabbbbao..', '.oaobbbboao.', '.oa.obbo.ao.', '....obbo....', '...oa..ao...', '..ooo..ooo..'],
  hound: ['............', '............', '.........oo.', '........oaao', 'o......oaaeo', 'oo..oooaaaao', '.oaaaaaaaao.', '.oaaaaaaao..', '.oaaoooaao..', '.oao...oao..', '.oo....oo...', '............'],
  spider: ['............', '............', 'o..o....o..o', '.o..oooo..o.', '..ooaaaaoo..', 'ooaaeaaeaaoo', '..oaaaaaao..', 'ooaaaaaaaaoo', '..ooaaaaoo..', '.o..oooo..o.', 'o..........o', '............'],
  golem: ['...oooooo...', '..oaaaaaao..', '..oaeaaeao..', '..oaaaaaao..', '.oooaaaaooo.', 'oaaoabbaoaao', 'oaaoabbaoaao', 'oaaoaaaaoaao', '.ooooaaoooo.', '...oaaaao...', '..oaa..aao..', '..ooo..ooo..'],
  pillar: ['....oooo....', '...oaaaao...', '..oabbbbao..', '..oaaaaaao..', '...oabbao...', '...oaaaao...', '...oabbao...', '...oaaaao...', '...oabbao...', '..oaaaaaao..', '.oaaaaaaaao.', '.oooooooooo.'],
  ghost: ['....oooo....', '...owwwwo...', '..owwwwwwo..', '..owewwewo..', '..owwooowwo.', '..owwwwwwo..', '..owwwwwwo..', '.owwwwwwwwo.', '.owwowwowwo.', '.owo.ww.owo.', '..o..oo..o..', '............'],
  cult: ['....oooo....', '...oaaaao...', '..oaaaaaao..', '..oaooooao..', '..oaoeeoao..', '..oaaooaao..', '..oaaaaaao..', '.oaaaaaaaao.', '.oaabaabaao.', '.oaaaaaaaao.', '..oaaaaaao..', '..oooooooo..'],
};

const BASE: Record<string, string> = { o: '#15101f', w: '#f1ead8', s: '#f0c9a0', e: '#15101f', m: '#b9bfd0', g: '#f2c14e', k: '#2a2438' };

interface Look {
  sprite: string;
  pal: Record<string, string>;
  scale?: number;
}

/** Colores por jugador (1 a 4): a = oscuro, b = claro. */
export const PLAYER_COLORS = [
  { a: '#8a2636', b: '#d8485f' },
  { a: '#234a8c', b: '#4a93ee' },
  { a: '#22662e', b: '#55c765' },
  { a: '#8a661c', b: '#eabd3a' },
];

/** Héroes en el bando rival (némesis y duelos). */
const RIVAL_COLORS = [
  { a: '#5a1f6a', b: '#b05ad8' },
  { a: '#6a2a1a', b: '#e07a3a' },
  { a: '#1f5a5a', b: '#4ad0c0' },
];
const HERO_SPRITES = ['guerrero', 'mago', 'clerigo', 'picaro', 'arquero'];

const ENEMY_LOOK: Record<string, Look> = {
  limo: { sprite: 'slime', pal: { a: '#8fbf6a', b: '#c4e8a0', e: '#102010' } },
  murcielago: { sprite: 'bat', pal: { a: '#7a4a9a', e: '#ff4060' } },
  esqueleto: { sprite: 'skel', pal: { e: '#c02030' } },
  arquero: { sprite: 'skel', pal: { w: '#c9d6a8', e: '#30a040' } },
  necrofago: { sprite: 'ghoul', pal: { a: '#7d9a78', b: '#4a3a4a', e: '#ffd24a' } },
  acolito: { sprite: 'cult', pal: { a: '#8a2a2a', b: '#f2c14e', e: '#ffb030' } },
  prior: { sprite: 'cult', pal: { a: '#4a2a7a', b: '#b9a8d8', e: '#ff3060' }, scale: 1.6 },
  caballero: { sprite: 'skel', pal: { w: '#c8c8d8', e: '#ff2040' }, scale: 1.25 },
  lobo: { sprite: 'hound', pal: { a: '#5a6a58', e: '#c8ff60' } },
  arana: { sprite: 'spider', pal: { a: '#4a3a5a', e: '#7fe05a' } },
  tejedora: { sprite: 'spider', pal: { a: '#8a8a70', e: '#ffffff' } },
  chaman: { sprite: 'cult', pal: { a: '#3f6a3a', b: '#c8ff60', e: '#c8ff60' } },
  ent: { sprite: 'golem', pal: { a: '#5a4a30', b: '#3f6a3a', e: '#c8ff60' }, scale: 1.2 },
  alfa: { sprite: 'hound', pal: { a: '#2f3a30', e: '#ff4040' }, scale: 1.4 },
  madre: { sprite: 'golem', pal: { a: '#3f5a2a', b: '#8a2a5a', e: '#ff60c0' }, scale: 1.7 },
  sabueso: { sprite: 'hound', pal: { a: '#6a3a2a', e: '#ffb030' } },
  ceniciento: { sprite: 'skel', pal: { w: '#6a6058', e: '#ff8a30' } },
  piromante: { sprite: 'cult', pal: { a: '#5a2a1a', b: '#ff8a30', e: '#ffe060' } },
  escoria: { sprite: 'golem', pal: { a: '#4a4040', b: '#ff6a20', e: '#ffb030' }, scale: 1.25 },
  verdugo: { sprite: 'skel', pal: { w: '#4a4040', e: '#ff3020' }, scale: 1.35 },
  pilar: { sprite: 'pillar', pal: { a: '#8a8478', b: '#c9c0a8' } },
  brote: { sprite: 'pillar', pal: { a: '#3f6a3a', b: '#8ae060' } },
  brasero: { sprite: 'pillar', pal: { a: '#4a4040', b: '#ff8a30' } },
  espectro: { sprite: 'ghost', pal: { w: '#9ad0e8', e: '#102040' } },
  rey: { sprite: 'cult', pal: { a: '#3a2020', b: '#f2c14e', e: '#ff5020' }, scale: 1.7 },
};

const cache = new Map<string, HTMLCanvasElement>();

function bake(sprite: string, pal: Record<string, string>): HTMLCanvasElement {
  const k = sprite + JSON.stringify(pal);
  let c = cache.get(k);
  if (c) return c;
  const rows = SPR[sprite]!;
  c = document.createElement('canvas');
  c.width = c.height = rows.length;
  const g = c.getContext('2d')!;
  const full = { ...BASE, ...pal };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = full[row[x]!];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  cache.set(k, c);
  return c;
}

/** Arma de cada clase, en píxeles del sprite de 16. */
function weapon(g: CanvasRenderingContext2D, cls: string, x: number, y: number, s: number, swing: number): void {
  const r = (px: number, py: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(x + px * s, y + py * s, w * s, h * s); };
  const up = Math.round(swing * 3);
  if (cls === 'guerrero') { r(13, 3 - up, 1, 8, '#e4e8f4'); r(12, 11 - up, 3, 1, '#8a6a2a'); r(13, 12 - up, 1, 2, '#5a4520'); r(1, 8, 2, 5, '#6a7088'); r(1, 9, 2, 1, '#f2c14e'); }
  else if (cls === 'mago') { r(14, 4 - up, 1, 12, '#7a4a1a'); r(13, 2 - up, 3, 3, '#58a6ff'); r(14, 3 - up, 1, 1, '#d6ecff'); }
  else if (cls === 'clerigo') { r(14, 5 - up, 1, 10, '#7a4a1a'); r(13, 3 - up, 3, 3, '#f2c14e'); r(14, 2 - up, 1, 1, '#fff2c0'); }
  else if (cls === 'arquero') { r(14, 5, 1, 8, '#8a5a2a'); r(13, 4, 1, 1, '#8a5a2a'); r(13, 13, 1, 1, '#8a5a2a'); r(12 - up, 5, 1, 8, '#d8d0c0'); if (up) r(9, 8, 6, 1, '#e4e8f4'); }
  else { r(14, 8 - up, 1, 4, '#e4e8f4'); r(1, 8 + up, 1, 4, '#e4e8f4'); r(14, 12 - up, 1, 1, '#5a4520'); r(1, 12 + up, 1, 1, '#5a4520'); }
}

export interface DrawOpts {
  flash?: boolean;
  alpha?: number;
  /** 0..1: arma levantada al atacar */
  swing?: number;
  flip?: boolean;
}

/** Dibuja una unidad centrada en la base de una casilla de tamaño `tile`. */
export function drawUnit(g: CanvasRenderingContext2D, kind: string, team: string, colorIdx: number, cx: number, baseY: number, tile: number, o: DrawOpts = {}): void {
  const hero = team === 'hero';
  // un héroe puede estar en el bando rival (némesis) y un monstruo en el nuestro (invocaciones)
  const cls = HERO_SPRITES.includes(kind);
  const look: Look = cls ? { sprite: kind, pal: hero ? PLAYER_COLORS[colorIdx % 4]! : RIVAL_COLORS[colorIdx % 3]! } : ENEMY_LOOK[kind] ?? ENEMY_LOOK.esqueleto!;
  const img = bake(look.sprite, look.pal);
  const n = img.width;
  const s = Math.max(2, Math.floor((tile * (cls ? 0.98 : 0.9) * (look.scale ?? 1)) / n));
  const w = n * s;
  const x = Math.round(cx - w / 2), y = Math.round(baseY - w);
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = o.alpha ?? 1;
  // los enemigos miran a la izquierda; `flip` invierte el sentido habitual
  if (hero ? o.flip : !o.flip) { g.translate(x + w, y); g.scale(-1, 1); } else g.translate(x, y);
  g.drawImage(img, 0, 0, w, w);
  if (cls) weapon(g, kind, 0, 0, s, o.swing ?? 0);
  if (o.flash) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.6;
    g.drawImage(img, 0, 0, w, w);
  }
  g.restore();
}

/** Para comprobaciones: todas las filas de cada sprite miden lo mismo que su alto. */
export function spriteErrors(): string[] {
  return Object.entries(SPR).flatMap(([k, rows]) => rows.filter((r) => r.length !== rows.length).map((r) => `${k}: "${r}" mide ${r.length}`));
}
