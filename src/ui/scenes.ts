// Escenas pixel-art (SVG) de las salas especiales: altar, forja, cofre y hoguera. Animadas con CSS.

type Pal = Record<string, string>;

/** Dibuja un mapa de píxeles (una cadena por fila; «.» = vacío) con rectángulos agrupados por tramos. */
function px(rows: string[], pal: Pal, ox: number, oy: number, cls = ''): string {
  const out: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === '.' || !pal[ch]) { x++; continue; }
      let w = 1;
      while (row[x + w] === ch) w++;
      out.push(`<rect x="${ox + x}" y="${oy + y}" width="${w}" height="1" fill="${pal[ch]}"/>`);
      x += w;
    }
  });
  return `<g class="${cls}">${out.join('')}</g>`;
}

let gid = 0;
const svg = (body: string, bg: [string, string], extra = ''): string => {
  const id = `sg${++gid}`;
  return `<svg class="scene ${extra}" viewBox="0 0 160 72" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true">
  <defs><radialGradient id="${id}" cx="50%" cy="60%" r="70%"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient></defs>
  <rect width="160" height="72" fill="url(#${id})"/>${body}</svg>`;
};

/** Suelo de losas (damero) en la parte baja de la escena. */
function floor(a: string, b: string, y = 58): string {
  let s = '';
  for (let x = 0; x < 160; x += 8) for (let yy = y; yy < 72; yy += 4) s += `<rect x="${x + ((yy / 4) % 2 ? 4 : 0)}" y="${yy}" width="8" height="4" fill="${((x / 8 + yy / 4) % 2) ? a : b}"/>`;
  return `<g opacity=".85">${s}</g><rect y="${y}" width="160" height="1" fill="#000" opacity=".5"/>`;
}

/** Agranda los sprites centrales (×2 alrededor del suelo, en el centro). */
const big = (inner: string, k = 2): string => `<g transform="translate(80 60) scale(${k}) translate(-80 -60)">${inner}</g>`;

/** Chispas/ascuas que suben (partículas animadas). */
function embers(n: number, color: string, x0: number, x1: number, y: number, seed = 1): string {
  let s = '', r = seed;
  const rnd = (): number => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + rnd() * (x1 - x0)), d = (1.2 + rnd() * 1.8).toFixed(2), dl = (rnd() * 2).toFixed(2);
    s += `<rect class="ember" x="${x}" y="${y}" width="1" height="1" fill="${color}" style="animation-duration:${d}s;animation-delay:-${dl}s"/>`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Cofre
// ---------------------------------------------------------------------------
const CHEST_PAL: Pal = { k: '#140b06', b: '#7a4723', d: '#4c2a13', g: '#e3b04b', y: '#fff2a8', m: '#8c939c', l: '#b9c0c8' };
const LID = [
  '...kkkkkkkkkk...',
  '..kbbbbbbbbbbk..',
  '.kbyybbbbbbbbbk.',
  'kbbbbbbbbbbbbbbk',
  'kllmmmmmmmmmmmmk',
  'kddddddggddddddk',
];
const BODY = [
  'kbbbbbbggbbbbbbk',
  'kbbbbbbkkbbbbbbk',
  'kmbbbbbbbbbbbbmk',
  'kmbbbbbbbbbbbbmk',
  'kbbbbbbbbbbbbbbk',
  'kmbbbbbbbbbbbbmk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
];
const COINS = ['..y.gy..g.yg..', '.gygygyggyggy.'];

export function chestScene(state: 'closed' | 'loot' | 'cursed'): string {
  const ox = 72, oy = 44;
  const open = state !== 'closed';
  const glow = state === 'loot' ? '#ffd76a' : '#b14cff';
  const body = `${floor('#2a2119', '#211a13')}${big(`
    <ellipse cx="80" cy="58" rx="16" ry="3" fill="#000" opacity=".5"/>
    ${open ? `<ellipse class="chestglow" cx="80" cy="44" rx="22" ry="16" fill="${glow}" opacity=".35"/>` : ''}
    ${px(BODY, CHEST_PAL, ox, oy + 6, 'chestbody')}
    ${state === 'loot' ? px(COINS, CHEST_PAL, ox + 1, oy + 4) : ''}
    ${px(LID, CHEST_PAL, ox, oy, `chestlid ${open ? 'open' : 'shake'}`)}
    ${state === 'loot' ? embers(14, '#ffe98a', 66, 94, 46, 7) : ''}
    ${state === 'cursed' ? `${embers(16, '#c77dff', 64, 96, 46, 3)}<text class="curseface" x="80" y="44" text-anchor="middle" font-size="12">💀</text>` : ''}`)}`;
  return svg(body, state === 'cursed' ? ['#3a1450', '#0b0610'] : ['#5a4120', '#0d0a07'], `chest ${state}`);
}

// ---------------------------------------------------------------------------
// Hoguera (según la zona)
// ---------------------------------------------------------------------------
const LOGS = [
  '...kkk....kkk...',
  '..kbbbkkkkbbbk..',
  '.kbdddbbbbdddbk.',
  'kkkkkkkkkkkkkkkk',
];
const STONES = ['.ss..ss..ss..ss.', 'sSSs.SSsSS.sSSs.'];
const FLAME = [
  '.....r....',
  '....ro....',
  '...roor...',
  '..rooyor..',
  '..royyor..',
  '.roywyyor.',
  '.royywyor.',
  'rooyyyyoor',
];
const FIRE_PAL: Pal = { r: '#c8361e', o: '#ff7a2a', y: '#ffd04a', w: '#fff6d0' };
const REST_BG: Array<{ bg: [string, string]; floor: [string, string]; props: string }> = [
  // Catacumbas: nichos con calaveras
  { bg: ['#4a3a2a', '#0c0907'], floor: ['#2b241d', '#221c16'], props: [12, 132].map((x) => `<rect x="${x}" y="22" width="16" height="12" fill="#120d09"/><text x="${x + 8}" y="32" text-anchor="middle" font-size="9">💀</text><rect x="${x}" y="38" width="16" height="12" fill="#120d09"/><text x="${x + 8}" y="48" text-anchor="middle" font-size="8" opacity=".8">🦴</text>`).join('') },
  // Bosque de raíces: setas y raíces
  { bg: ['#2f4a2a', '#070b06'], floor: ['#1f2a1a', '#182114'], props: `<path d="M0 10 Q30 30 20 58 M160 6 Q128 26 140 58" stroke="#3b2a18" stroke-width="5" fill="none"/><text x="26" y="56" font-size="10">🍄</text><text x="126" y="57" font-size="9">🍄</text>${embers(10, '#a6ff7a', 10, 150, 50, 5)}` },
  // Fundición: yunque frío y brasero
  { bg: ['#5a2a14', '#0d0604'], floor: ['#2a1d17', '#211612'], props: `<rect x="16" y="46" width="20" height="5" fill="#3a3f46"/><rect x="21" y="51" width="10" height="7" fill="#2a2e33"/><rect x="128" y="40" width="10" height="18" fill="#2b2b2b"/><rect x="125" y="38" width="16" height="3" fill="#ff7a2a" class="flick"/>` },
  // Abismo: islas flotantes y estrellas
  { bg: ['#2a1f4a', '#05030c'], floor: ['#1d1a2a', '#16131f'], props: `${Array.from({ length: 18 }, (_, i) => `<rect class="star" x="${(i * 37) % 160}" y="${(i * 13) % 34}" width="1" height="1" fill="#cfc4ff" style="animation-delay:-${(i % 5) * 0.4}s"/>`).join('')}<path d="M10 30 h22 l-6 8 h-10z M128 22 h24 l-8 9 h-9z" fill="#2c2840"/>` },
];

export function restScene(zone: number): string {
  const z = REST_BG[zone] ?? REST_BG[0]!;
  const body = `${z.props}${floor(z.floor[0], z.floor[1])}${big(`
    <ellipse class="fireglow" cx="80" cy="54" rx="34" ry="14" fill="#ff9a3a" opacity=".22"/>
    <ellipse cx="80" cy="60" rx="14" ry="2.5" fill="#000" opacity=".5"/>
    ${px(FLAME, FIRE_PAL, 75, 44, 'flame')}
    ${px(LOGS, CHEST_PAL, 72, 52)}
    ${px(STONES, { s: '#6d6a66', S: '#4a4744' }, 72, 56)}
    ${embers(12, '#ffcf6a', 72, 88, 44, zone + 2)}`)}`;
  return svg(body, z.bg, `rest z${zone}`);
}

// ---------------------------------------------------------------------------
// Forja (el brillo crece con el calor)
// ---------------------------------------------------------------------------
const ANVIL = [
  'kkkkkkkkkkkkkkkkkk..',
  'kllllllllllllllmmmkk',
  '.kmmmmmmmmmmmmmmmmmk',
  '...kkmmmmmmmmmmkk...',
  '.....kmmmmmmmmk.....',
  '.....kmmmmmmmmk.....',
  '....kmmmmmmmmmmk....',
  '...kkkkkkkkkkkkkk...',
];
const CRUCIBLE = [
  '.kkkkkkkkkk.',
  'kooyyyyyyook',
  'kmooyyyyoomk',
  'kmmmmmmmmmmk',
  '.kmmmmmmmmk.',
  '..kkkkkkkk..',
];
export function forgeScene(heat: number): string {
  const t = Math.min(1, heat / 100);
  const pal = { ...CHEST_PAL, m: '#4b5058', l: '#8f969e', o: '#ff6a1a', y: '#ffd04a' };
  const body = `<rect x="0" y="0" width="160" height="72" fill="#ff4a10" opacity="${(0.05 + t * 0.35).toFixed(2)}" class="heatwash"/>
    <rect x="112" y="10" width="34" height="48" fill="#241812"/><rect x="116" y="18" width="26" height="22" fill="#ff5a1a" opacity="${(0.4 + t * 0.6).toFixed(2)}" class="flick"/>
    ${floor('#2b1d16', '#221712')}${big(`
    <ellipse cx="66" cy="58" rx="22" ry="3" fill="#000" opacity=".5"/>
    ${px(ANVIL, pal, 56, 50)}
    <g class="hammer"><rect x="44" y="34" width="3" height="16" fill="#6b3e1f"/><rect x="39" y="31" width="13" height="5" fill="#8f969e"/><rect x="39" y="31" width="13" height="1" fill="#c9ced4"/></g>
    ${px(CRUCIBLE, pal, 100, 50)}
    <ellipse class="fireglow" cx="106" cy="50" rx="${(10 + t * 14).toFixed(1)}" ry="${(6 + t * 8).toFixed(1)}" fill="#ff7a2a" opacity="${(0.25 + t * 0.4).toFixed(2)}"/>
    ${embers(8 + Math.round(t * 24), '#ffb24a', 60, 120, 50, 11)}
    <g class="sparks">${[0, 1, 2, 3, 4].map((i) => `<rect x="${62 + i * 3}" y="48" width="1" height="1" fill="#fff2a8" style="--dx:${(i - 2) * 6}px;animation-delay:${i * 0.05}s"/>`).join('')}</g>`, 1.6)}`;
  return svg(body, ['#5a2a14', '#0b0503'], `forge ${t >= 0.8 ? 'hot2' : t >= 0.4 ? 'hot1' : ''}`);
}

// ---------------------------------------------------------------------------
// Altar de Pactos
// ---------------------------------------------------------------------------
const ALTAR = [
  '..kkkkkkkkkkkkkkkkkkkkkk..',
  '.kssssssssssssssssssssssk.',
  'kSSSSSSSSSSSSSSSSSSSSSSSSk',
  '.kkkkkkkkkkkkkkkkkkkkkkkk.',
  '...kssssssrrrrrrsssssssk..',
  '...kssssssrRRRRrsssssssk..',
  '...kssssssrrrrrrsssssssk..',
  '...ksssssssssssssssssssk..',
  '..kkkkkkkkkkkkkkkkkkkkkkk.',
];
const CANDLE = ['.f.', 'fyf', '.w.', 'www', 'www', 'www', 'kkk'];
export function altarScene(lit: boolean, icons: string[] = []): string {
  const rune = lit ? '#c77dff' : '#4a4452';
  const pal = { k: '#0e0b10', s: '#5d5864', S: '#77727e', r: rune, R: lit ? '#f1d9ff' : '#625c68' };
  const cpal = { f: lit ? '#ff9a2a' : 'transparent', y: lit ? '#ffe36a' : 'transparent', w: '#d9d2c0', k: '#3a3328' };
  const body = `${floor('#211b24', '#1a151d')}
    ${lit ? '<ellipse class="fireglow" cx="80" cy="44" rx="40" ry="20" fill="#9b4dff" opacity=".25"/>' : ''}${big(`
    <ellipse cx="80" cy="60" rx="26" ry="3" fill="#000" opacity=".5"/>
    ${px(ALTAR, pal, 67, 51)}
    ${px(CANDLE, cpal, 62, 45, lit ? 'flame' : '')}${px(CANDLE, cpal, 95, 45, lit ? 'flame' : '')}`)}
    ${lit ? icons.map((ic, i) => `<text class="pactorb" x="${icons.length > 1 ? 44 + i * 72 : 80}" y="30" text-anchor="middle" font-size="13" style="animation-delay:-${i * 1.3}s">${ic}</text>`).join('') : ''}
    ${lit ? embers(14, '#d9a6ff', 64, 96, 50, 17) : ''}`;
  return svg(body, lit ? ['#3a2050', '#07040a'] : ['#2a262e', '#08070a'], `altar ${lit ? 'lit' : 'cold'}`);
}
