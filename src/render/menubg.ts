// Fondo de los menús: una ilustración (public/bg) con una capa animada encima en pixel art
// (luz de antorchas que parpadea, ascuas, chispas rúnicas y niebla). Solo decoración.

export type MenuScene = 'home' | 'game' | 'settle' | 'tavern' | 'archive' | 'gate' | 'post' | 'hall' | 'altar' | 'abyssforge' | 'forge';
/** La capa animada mide 1/4 de la ilustración (1376×768): sus coordenadas son las de la imagen / 4. */
const W = 344, H = 192, FPS = 20;

interface Light { x: number; y: number; r: number; col: string; /** suelta ascuas (los faroles no) */ ember?: boolean }
interface SceneDef {
  img: string;
  /** antorchas y fuegos de la ilustración (luz que parpadea y suelta ascuas) */
  fires: Light[];
  /** brillos fijos que laten (runas, portales) */
  glows: Light[];
  /** de dónde salen las chispas frías (runas) */
  sparks?: { x: number; y: number; w: number; h: number; col: string };
  fog: string;
  /** columnas de humo (chimeneas, hogueras) */
  smoke?: Array<{ x: number; y: number }>;
  /** 'contain': la imagen se ve entera (bandas laterales desenfocadas) en vez de recortarse */
  fit?: 'contain';
  /** intensidad de la niebla baja (0 la quita) */
  fogA?: number;
  /** destellos que saltan de vez en cuando (relámpagos entre las piedras rúnicas) */
  flashes?: Light[];
  /** los fuegos crecen con el calor de la forja (setSceneHeat) */
  heated?: boolean;
}
const FIRE = '255,150,60';
const SCENES: Record<MenuScene, SceneDef> = {
  // cueva con el arco rúnico (menú principal)
  home: {
    img: 'bg/inicio.jpg',
    fires: [{ x: 98, y: 82, r: 26, col: FIRE }, { x: 182, y: 80, r: 22, col: FIRE }, { x: 265, y: 80, r: 22, col: FIRE }, { x: 308, y: 87, r: 26, col: FIRE }, { x: 120, y: 73, r: 10, col: FIRE }, { x: 148, y: 71, r: 10, col: FIRE }],
    glows: [{ x: 226, y: 80, r: 46, col: '120,120,255' }],
    sparks: { x: 196, y: 30, w: 62, h: 100, col: '150,170,255' },
    fog: '120,140,170',
  },
  // puerta rúnica de la mazmorra (sala y menús de la partida)
  // el Asentamiento al borde del Abismo (panorama tras elegir héroe)
  settle: {
    img: 'bg/asentamiento.jpg',
    fires: [
      { x: 155.5, y: 31, r: 12, col: FIRE }, { x: 208, y: 24, r: 12, col: FIRE }, { x: 255.5, y: 43, r: 12, col: FIRE }, { x: 235, y: 52.5, r: 11, col: FIRE },
      { x: 313, y: 44.5, r: 12, col: FIRE }, { x: 331, y: 54, r: 11, col: FIRE }, { x: 257, y: 122, r: 13, col: FIRE }, { x: 314.5, y: 139, r: 12, col: FIRE },
      { x: 119, y: 137, r: 16, col: FIRE }, { x: 95, y: 145, r: 14, col: FIRE }, { x: 130.5, y: 168, r: 24, col: FIRE },
      { x: 107.5, y: 96, r: 8, col: FIRE, ember: false }, { x: 85, y: 116, r: 8, col: FIRE, ember: false }, { x: 99, y: 117.5, r: 7, col: FIRE, ember: false },
      { x: 45, y: 77.5, r: 22, col: '255,190,90', ember: false }, { x: 135, y: 66, r: 7, col: FIRE, ember: false }, { x: 160, y: 67.5, r: 7, col: FIRE, ember: false },
      { x: 197.5, y: 145, r: 8, col: FIRE, ember: false }, { x: 32.5, y: 122.5, r: 8, col: FIRE, ember: false },
    ],
    glows: [{ x: 270, y: 87, r: 62, col: '130,150,255' }, { x: 270, y: 162, r: 52, col: '160,120,255' }],
    sparks: { x: 255, y: 40, w: 35, h: 150, col: '170,190,255' },
    smoke: [{ x: 149, y: 134 }, { x: 119, y: 133 }],
    fog: '110,130,180',
    fit: 'contain',
  },
  // interior de la Taberna
  tavern: {
    img: 'bg/taberna.jpg',
    fires: [{ x: 263.7, y: 112, r: 34, col: FIRE }, { x: 50.5, y: 62.8, r: 16, col: FIRE, ember: false }, { x: 112, y: 66, r: 16, col: FIRE, ember: false }, { x: 196, y: 55.4, r: 16, col: FIRE, ember: false }, { x: 288, y: 66.8, r: 16, col: FIRE, ember: false }],
    glows: [],
    fog: '150,100,60',
    fogA: 0.05,
    fit: 'contain',
  },
  // el Archivo: velas sobre la mesa, faroles y el brillo frío de las vitrinas rúnicas
  archive: {
    img: 'bg/archivo.jpg',
    fires: [
      { x: 147.6, y: 109.5, r: 12, col: FIRE, ember: false }, { x: 152.2, y: 106.8, r: 12, col: FIRE, ember: false }, { x: 180.3, y: 113.5, r: 11, col: FIRE, ember: false },
      { x: 217.7, y: 124.2, r: 11, col: FIRE, ember: false }, { x: 243.7, y: 76.1, r: 11, col: FIRE, ember: false }, { x: 285.1, y: 118.9, r: 10, col: FIRE, ember: false },
      { x: 95.9, y: 46.7, r: 16, col: FIRE, ember: false }, { x: 273.1, y: 62.8, r: 16, col: FIRE, ember: false },
    ],
    glows: [{ x: 200.3, y: 109.5, r: 24, col: '120,200,255' }, { x: 303.1, y: 114.8, r: 14, col: '140,200,255' }],
    sparks: { x: 190, y: 98, w: 22, h: 14, col: '150,215,255' },
    fog: '120,110,100',
    fogA: 0.04,
    fit: 'contain',
  },
  // la Puerta del Refugio: faroles, el brasero de Darel y la niebla del exterior
  gate: {
    img: 'bg/puerta.jpg',
    fires: [
      { x: 160.2, y: 24.0, r: 13, col: FIRE, ember: false }, { x: 31.4, y: 46.1, r: 11, col: FIRE, ember: false }, { x: 35.0, y: 69.4, r: 11, col: FIRE, ember: false },
      { x: 70.1, y: 73.4, r: 13, col: FIRE, ember: false }, { x: 125.5, y: 74.1, r: 13, col: FIRE, ember: false }, { x: 195.9, y: 83.5, r: 13, col: FIRE, ember: false },
      { x: 201.6, y: 110.8, r: 14, col: FIRE },
    ],
    glows: [{ x: 293.8, y: 93.5, r: 34, col: '150,190,230' }],
    smoke: [{ x: 201.6, y: 106 }],
    fog: '120,130,150',
    fogA: 0.13,
    fit: 'contain',
  },
  // dentro del puesto de vigilancia
  post: {
    img: 'bg/puesto.jpg',
    fires: [{ x: 234.8, y: 112.2, r: 32, col: FIRE, ember: false }],
    glows: [{ x: 300.5, y: 64.1, r: 42, col: '120,150,200' }],
    fog: '90,90,100',
    fogA: 0.03,
    fit: 'contain',
  },
  // el Salón de los Héroes: decenas de velas
  hall: {
    img: 'bg/salon.jpg',
    fires: [{ x: 40.75, y: 82.5, r: 9, col: FIRE, ember: false }, { x: 61.25, y: 96.25, r: 7, col: FIRE, ember: false }, { x: 67.5, y: 96.25, r: 7, col: FIRE, ember: false }, { x: 123.75, y: 96.25, r: 9, col: FIRE, ember: false }, { x: 132.5, y: 100, r: 7, col: FIRE, ember: false }, { x: 101.25, y: 136.25, r: 7, col: FIRE, ember: false }, { x: 96.25, y: 160, r: 9, col: FIRE, ember: false }, { x: 146.25, y: 160, r: 7, col: FIRE, ember: false }, { x: 151.25, y: 137.5, r: 7, col: FIRE, ember: false }, { x: 161.25, y: 125, r: 9, col: FIRE, ember: false }, { x: 185, y: 126.25, r: 7, col: FIRE, ember: false }, { x: 200, y: 137.5, r: 7, col: FIRE, ember: false }, { x: 211.25, y: 100, r: 9, col: FIRE, ember: false }, { x: 220, y: 97.5, r: 7, col: FIRE, ember: false }, { x: 243.75, y: 137.5, r: 7, col: FIRE, ember: false }, { x: 246.25, y: 158.75, r: 9, col: FIRE, ember: false }, { x: 295, y: 106.25, r: 7, col: FIRE, ember: false }, { x: 303.75, y: 136.25, r: 7, col: FIRE, ember: false }, { x: 36.25, y: 157.5, r: 9, col: FIRE, ember: false }, { x: 308.75, y: 121.25, r: 7, col: FIRE, ember: false }, { x: 37, y: 115, r: 7, col: FIRE, ember: false }, { x: 192.5, y: 160, r: 9, col: FIRE, ember: false }],
    glows: [{ x: 175, y: 140, r: 60, col: '255,170,90' }],
    fog: '140,100,70',
    fogA: 0.04,
    fit: 'contain',
  },
  // el Altar de los Pactos: círculo rúnico en una caverna, un cristal flotante y menhires que se lanzan rayos
  altar: {
    img: 'bg/altar.jpg',
    fires: [],
    glows: [{ x: 172, y: 82, r: 34, col: '150,110,255' }, { x: 172, y: 146, r: 70, col: '120,90,220' }, { x: 74, y: 104, r: 14, col: '150,110,255' }, { x: 119, y: 72, r: 14, col: '90,200,230' }, { x: 225, y: 72, r: 14, col: '90,200,230' }, { x: 270, y: 108, r: 14, col: '150,110,255' }],
    flashes: [{ x: 146, y: 84, r: 40, col: '140,220,255' }, { x: 200, y: 86, r: 40, col: '190,150,255' }, { x: 172, y: 82, r: 56, col: '200,170,255' }],
    sparks: { x: 150, y: 50, w: 44, h: 70, col: '190,170,255' },
    fog: '110,100,150',
    fogA: 0.12,
  },
  // la Forja del Abismo: una fragua improvisada alrededor de una fuente de calor antigua (la salida, a la izquierda)
  abyssforge: {
    img: 'bg/forja_abismo.jpg',
    fires: [{ x: 252, y: 120, r: 40, col: FIRE }, { x: 249, y: 44, r: 16, col: FIRE }, { x: 244, y: 135, r: 22, col: '255,110,40' }],
    glows: [{ x: 250, y: 144, r: 36, col: '80,220,230' }, { x: 207, y: 145, r: 18, col: '80,220,230' }, { x: 290, y: 144, r: 18, col: '80,220,230' }],
    sparks: { x: 225, y: 60, w: 50, h: 60, col: '255,190,110' },
    smoke: [{ x: 249, y: 30 }],
    fog: '120,90,70',
    fogA: 0.06,
    heated: true,
  },
  // la Forja del Refugio: el horno rúnico de Odran
  forge: {
    img: 'bg/forja.jpg',
    fires: [{ x: 216, y: 106, r: 40, col: FIRE }, { x: 224, y: 40, r: 16, col: FIRE }, { x: 212, y: 130, r: 18, col: '255,110,40' }],
    glows: [{ x: 216, y: 70, r: 30, col: '80,220,230' }, { x: 194, y: 96, r: 12, col: '80,220,230' }, { x: 240, y: 96, r: 12, col: '80,220,230' }],
    sparks: { x: 205, y: 24, w: 36, h: 40, col: '255,190,110' },
    smoke: [{ x: 224, y: 26 }],
    fog: '130,90,60',
    fogA: 0.04,
  },
  game: {
    img: 'bg/sala.jpg',
    fires: [{ x: 33, y: 73, r: 30, col: FIRE }, { x: 310, y: 73, r: 30, col: FIRE }],
    glows: [{ x: 172, y: 150, r: 70, col: '60,200,230' }],
    fog: '70,200,230',
  },
};

let canvas: HTMLCanvasElement | null = null;
/** Calor de la forja (0 a 1): aviva las llamas, suelta más ascuas y tiñe la escena. */
let heat = 0;
export function setSceneHeat(x: number): void { heat = Math.max(0, Math.min(1, x)); document.body.style.setProperty('--heat', heat.toFixed(2)); }
let flashAt = 0, flashIdx = 0;
/** relleno desenfocado detrás de las escenas que se ven enteras */
let fill: HTMLDivElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let scene: MenuScene | null = null;
let raf = 0, last = 0;
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Mote { x: number; y: number; vx: number; vy: number; life: number; cold: boolean }
let motes: Mote[] = [];

function glow(g: CanvasRenderingContext2D, l: Light, a: number): void {
  const grd = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
  grd.addColorStop(0, `rgba(${l.col},${a})`); grd.addColorStop(1, `rgba(${l.col},0)`);
  g.fillStyle = grd; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
}
function respawn(m: Mote, d: SceneDef): void {
  const sp = d.sparks;
  m.cold = !!sp && (Math.random() < 0.45 || d.fires.every((x) => x.ember === false));
  if (m.cold && sp) Object.assign(m, { x: sp.x + Math.random() * sp.w, y: sp.y + Math.random() * sp.h, vx: (Math.random() - 0.5) * 0.15, vy: -0.08 - Math.random() * 0.15, life: 0.5 + Math.random() * 0.8 });
  else { const pool = d.fires.filter((x) => x.ember !== false); if (!pool.length) { Object.assign(m, { x: -9, y: -9, vx: 0, vy: 0, life: 0.3 + Math.random() }); return; } const f = pool[Math.floor(Math.random() * pool.length)]!; Object.assign(m, { x: f.x + (Math.random() - 0.5) * 3, y: f.y - 3, vx: (Math.random() - 0.5) * 0.25, vy: -0.25 - Math.random() * 0.45, life: 0.5 + Math.random() * 0.7 }); }
}
function frame(now: number): void {
  if (!ctx || !scene) return;
  const g = ctx, t = now / 1000, d = SCENES[scene];
  g.clearRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter';
  const hk = d.heated ? heat : 0;
  for (const f of d.fires) glow(g, hk ? { ...f, r: f.r * (1 + hk * 0.9) } : f, (0.16 + 0.07 * Math.sin(t * 9 + f.x) + 0.04 * Math.sin(t * 23 + f.y)) * (1 + hk * 1.6));
  // destellos: cada pocos segundos salta un rayo entre las piedras (con un segundo parpadeo)
  if (d.flashes?.length) {
    if (t > flashAt + 3.2 + ((flashIdx * 7) % 5)) { flashAt = t; flashIdx++; }
    const k = t - flashAt, a = k < 0.08 ? 0.55 : k < 0.14 ? 0.1 : k < 0.22 ? 0.4 : Math.max(0, 0.25 - k);
    if (a > 0) glow(g, d.flashes[flashIdx % d.flashes.length]!, a);
  }
  for (const l of d.glows) glow(g, l, 0.12 + 0.07 * Math.sin(t * 1.6));
  g.restore();
  for (const m of motes) {
    m.x += m.vx + Math.sin(t * 2 + m.y * 0.15) * 0.12; m.y += m.vy; m.life -= m.cold ? 0.008 : 0.012;
    if (hk) { m.y += m.vy * hk * 1.2; }
    if (m.life <= 0 || m.y < 0) respawn(m, d);
    const a = Math.min(1, m.life * 1.4);
    g.fillStyle = m.cold ? `rgba(${d.sparks!.col},${a})` : `rgba(255,${150 + Math.round(m.life * 80)},60,${a})`;
    g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
  }
  // humo: columnas que suben, se ensanchan y se desvanecen
  for (const sm of d.smoke ?? []) for (let i = 0; i < 6; i++) {
    const k = ((t * 0.18 + i / 6) % 1), x = sm.x + Math.sin(t * 0.9 + i * 1.7) * 3 * k + k * 6, y = sm.y - k * 42, r = 3 + k * 11;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(150,150,160,${0.16 * (1 - k)})`); grd.addColorStop(1, 'rgba(150,150,160,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // niebla baja que se desplaza
  const fogA = d.fogA ?? 0.10;
  for (let i = 0; i < (fogA ? 7 : 0); i++) {
    const x = ((t * (4 + i * 1.5) + i * 60) % (W + 120)) - 60, y = 160 + (i % 3) * 9;
    const grd = g.createRadialGradient(x, y, 0, x, y, 55);
    grd.addColorStop(0, `rgba(${d.fog},${fogA})`); grd.addColorStop(1, `rgba(${d.fog},0)`);
    g.fillStyle = grd; g.fillRect(x - 55, y - 35, 110, 70);
  }
}
function loop(now: number): void {
  raf = 0;
  if (!scene) return;
  if (now - last >= 1000 / FPS) { last = now; frame(now); }
  if (!reduce && !document.hidden) raf = requestAnimationFrame(loop);
}

/** Pone (o quita, con null) el fondo de los menús. */
export function setMenuScene(s: MenuScene | null): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('has-menubg', !!s);
  if (s) document.body.dataset.scene = s; else delete document.body.dataset.scene;
  if (s === scene) { if (s && !raf && !reduce) raf = requestAnimationFrame(loop); return; }
  scene = s;
  if (!s) { if (raf) cancelAnimationFrame(raf); raf = 0; if (canvas) canvas.style.display = 'none'; if (fill) fill.style.display = 'none'; return; }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'menubg'; canvas.width = W; canvas.height = H; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    document.addEventListener('visibilitychange', () => { if (!document.hidden && scene && !raf) raf = requestAnimationFrame(loop); });
  }
  const d = SCENES[s];
  canvas.style.display = 'block';
  const url = `url(${import.meta.env.BASE_URL}${d.img})`;
  canvas.style.backgroundImage = url;
  canvas.style.objectFit = d.fit ?? 'cover';
  canvas.style.backgroundSize = d.fit ?? 'cover';
  if (!fill) { fill = document.createElement('div'); fill.id = 'menubgfill'; fill.setAttribute('aria-hidden', 'true'); document.body.prepend(fill); }
  fill.style.display = d.fit ? 'block' : 'none';
  fill.style.backgroundImage = url;
  motes = Array.from({ length: 46 }, () => { const m = { x: 0, y: 0, vx: 0, vy: 0, life: 0, cold: false }; respawn(m, d); m.life = Math.random(); return m; });
  frame(performance.now());
  if (!raf && !reduce) raf = requestAnimationFrame(loop);
}

/** Fondo ilustrado detrás del tablero de combate (por ahora, la zona 1). null lo quita. */
const COMBAT_BG: Record<number, string> = { 0: 'bg/zona1.jpg' };
export function setCombatBg(zone: number | null): void {
  if (typeof document === 'undefined') return;
  const img = zone === null ? undefined : COMBAT_BG[zone], b = document.body;
  b.classList.toggle('combatbg', !!img);
  if (img) { b.style.backgroundImage = `linear-gradient(rgba(5,6,10,.45), rgba(5,6,10,.7)), url(${import.meta.env.BASE_URL}${img})`; b.style.backgroundSize = 'cover'; b.style.backgroundPosition = 'center'; b.style.backgroundAttachment = 'fixed'; }
  else { b.style.backgroundImage = ''; b.style.backgroundSize = ''; b.style.backgroundPosition = ''; b.style.backgroundAttachment = ''; }
}
