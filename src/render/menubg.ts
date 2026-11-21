// Fondo de los menús: una ilustración (public/bg) con una capa animada encima en pixel art
// (luz de antorchas que parpadea, ascuas, chispas rúnicas y niebla). Solo decoración.

export type MenuScene = 'home' | 'game';
/** La capa animada mide 1/4 de la ilustración (1376×768): sus coordenadas son las de la imagen / 4. */
const W = 344, H = 192, FPS = 20;

interface Light { x: number; y: number; r: number; col: string }
interface SceneDef {
  img: string;
  /** antorchas y fuegos de la ilustración (luz que parpadea y suelta ascuas) */
  fires: Light[];
  /** brillos fijos que laten (runas, portales) */
  glows: Light[];
  /** de dónde salen las chispas frías (runas) */
  sparks?: { x: number; y: number; w: number; h: number; col: string };
  fog: string;
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
  game: {
    img: 'bg/sala.jpg',
    fires: [{ x: 33, y: 73, r: 30, col: FIRE }, { x: 310, y: 73, r: 30, col: FIRE }],
    glows: [{ x: 172, y: 150, r: 70, col: '60,200,230' }],
    fog: '70,200,230',
  },
};

let canvas: HTMLCanvasElement | null = null;
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
  m.cold = !!sp && Math.random() < 0.45;
  if (m.cold && sp) Object.assign(m, { x: sp.x + Math.random() * sp.w, y: sp.y + Math.random() * sp.h, vx: (Math.random() - 0.5) * 0.15, vy: -0.08 - Math.random() * 0.15, life: 0.5 + Math.random() * 0.8 });
  else { const f = d.fires[Math.floor(Math.random() * d.fires.length)]!; Object.assign(m, { x: f.x + (Math.random() - 0.5) * 3, y: f.y - 3, vx: (Math.random() - 0.5) * 0.25, vy: -0.25 - Math.random() * 0.45, life: 0.5 + Math.random() * 0.7 }); }
}
function frame(now: number): void {
  if (!ctx || !scene) return;
  const g = ctx, t = now / 1000, d = SCENES[scene];
  g.clearRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of d.fires) glow(g, f, 0.16 + 0.07 * Math.sin(t * 9 + f.x) + 0.04 * Math.sin(t * 23 + f.y));
  for (const l of d.glows) glow(g, l, 0.12 + 0.07 * Math.sin(t * 1.6));
  g.restore();
  for (const m of motes) {
    m.x += m.vx + Math.sin(t * 2 + m.y * 0.15) * 0.12; m.y += m.vy; m.life -= m.cold ? 0.008 : 0.012;
    if (m.life <= 0 || m.y < 0) respawn(m, d);
    const a = Math.min(1, m.life * 1.4);
    g.fillStyle = m.cold ? `rgba(${d.sparks!.col},${a})` : `rgba(255,${150 + Math.round(m.life * 80)},60,${a})`;
    g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
  }
  // niebla baja que se desplaza
  for (let i = 0; i < 7; i++) {
    const x = ((t * (4 + i * 1.5) + i * 60) % (W + 120)) - 60, y = 160 + (i % 3) * 9;
    const grd = g.createRadialGradient(x, y, 0, x, y, 55);
    grd.addColorStop(0, `rgba(${d.fog},.10)`); grd.addColorStop(1, `rgba(${d.fog},0)`);
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
  if (!s) { if (raf) cancelAnimationFrame(raf); raf = 0; if (canvas) canvas.style.display = 'none'; return; }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'menubg'; canvas.width = W; canvas.height = H; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    document.addEventListener('visibilitychange', () => { if (!document.hidden && scene && !raf) raf = requestAnimationFrame(loop); });
  }
  const d = SCENES[s];
  canvas.style.display = 'block';
  canvas.style.backgroundImage = `url(${import.meta.env.BASE_URL}${d.img})`;
  motes = Array.from({ length: 46 }, () => { const m = { x: 0, y: 0, vx: 0, vy: 0, life: 0, cold: false }; respawn(m, d); m.life = Math.random(); return m; });
  frame(performance.now());
  if (!raf && !reduce) raf = requestAnimationFrame(loop);
}
