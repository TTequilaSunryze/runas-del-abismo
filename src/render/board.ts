import { FEATURES, schoolOf } from '../core/tuning';
import { SPELLS } from '../core/classes/spells';
// Tablero de combate: dibuja el estado y convierte clics en acciones.
import { ZONES } from '../content/zones';
import { CRIT_FLAT, castProblem, current, essenceNeed, furyCrit, furyPower, movePreview, spellOf, usableMp } from '../core/combat/engine';
import { coneCells } from '../core/combat/marks';
import { alive, dist, hasLineOfSight, reachable } from '../core/combat/grid';
import type { CombatState, GameEvent, Pos, Unit } from '../core/state';
import type { Session } from '../game/session';
import { PLAYER_COLORS, drawUnit, isModel, lookKind } from './sprites';
import { lookOf } from './looks';
import { auraDef, drawAura } from './palettes';
import { ANIM_FRAMES, animFor, type Anim } from './models';
import { FxLayer, fxCells, recipeFor } from './fx';

const TILE = 56;
/** margen superior: los muros y los personajes sobresalen por arriba de su casilla */
const PAD = 42;

// ---------- vista isométrica (prototipo) ----------
// La lógica sigue en casillas. Solo cambia la proyección: el suelo se dibuja con una transformación afín
// (cada casilla cuadrada se convierte en un rombo 2:1) y lo que está «de pie» (personajes, pilares, textos)
// se dibuja sin deformar, anclado al centro de su rombo.
/** ancho y alto del rombo de una casilla */
export const ISO_W = TILE * 2, ISO_H = TILE;
/** espacio por encima del rombo más alto, para muros y personajes */
const ISO_PAD = 215;
/** margen inferior */
const ISO_BOTTOM = 24;
/** escala de lo que está de pie respecto a la vista plana */
const ISO_UP = 1.4;
/** el pie de los personajes queda un poco por debajo del centro del rombo */
const ISO_FOOT = ISO_H * 0.18;
const ISO_KEY = 'runas.iso';
const isoPref = (): boolean => { try { return localStorage.getItem(ISO_KEY) !== '0'; } catch { return true; } };
/** Tamaño del lienzo isométrico para un mapa de w×h casillas. */
export const isoSize = (w: number, h: number): { w: number; h: number } => ({ w: ((w + h) * ISO_W) / 2, h: ((w + h) * ISO_H) / 2 + ISO_PAD + ISO_BOTTOM });
/** Casilla → punto de pantalla (centro del rombo), en un mapa de h filas. Coordenadas de casilla con decimales. */
export function isoPoint(x: number, y: number, h: number): { x: number; y: number } {
  return { x: (h * ISO_W) / 2 + ((x - y) * ISO_W) / 2, y: ISO_PAD + ((x + y) * ISO_H) / 2 };
}
/** Punto de pantalla → casilla (la inversa de isoPoint, sin redondear). */
export function isoCell(sx: number, sy: number, h: number): { x: number; y: number } {
  const u = (sx - (h * ISO_W) / 2) / (ISO_W / 2), v = (sy - ISO_PAD) / (ISO_H / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/** Arte ilustrado de la zona 1 (Catacumbas): losas (hoja 4×4 de 64 px) y pilar. Si aún no ha cargado, se dibuja lo de siempre. */
const art = (src: string): HTMLImageElement | null => { if (typeof Image === 'undefined') return null; const i = new Image(); i.src = `${import.meta.env.BASE_URL}${src}`; return i; };
const Z1 = { floor: art('tiles/z1_floor.png'), pillar: art('tiles/z1_pillar.png') };
const ready = (i: HTMLImageElement | null): i is HTMLImageElement => !!i && i.complete && i.naturalWidth > 0;
/** Arte isométrico de la zona 1 (lote 1): pilares de 256 px de ancho con la base en el borde inferior. */
const ISO1 = { pillars: [art('iso/z1/pillar_01.png'), art('iso/z1/pillar_02.png')], floors: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => art(`iso/z1/floor_0${n}.png`)) };
/**
 * Muros del fondo (zona 1). Imágenes de 360 px de alto que suben hacia la derecha (borde izquierdo del tablero);
 * el borde derecho usa las mismas, volteadas. foot = altura (en la imagen) del pie del muro en su extremo izquierdo;
 * cells = casillas de borde que cubre.
 */
const WALLS1: Array<{ img: HTMLImageElement | null; foot: number; cells: number; w: number; torch?: [number, number]; lit?: boolean }> = [
  // torch: posición de la antorcha (fracción del ancho y del alto de la imagen); lit: la llama ya viene pintada
  { img: art('iso/z1/wall_01.png'), foot: 340, cells: 2, w: 3, torch: [0.54, 0.33], lit: true },
  { img: art('iso/z1/wall_02.png'), foot: 314, cells: 2, w: 2, torch: [0.68, 0.3], lit: true },
  { img: art('iso/z1/wall_torch.png'), foot: 349, cells: 1, w: 3, torch: [0.585, 0.42] },
  { img: art('iso/z1/wall_arch.png'), foot: 320, cells: 1, w: 1, torch: [0.825, 0.28], lit: true },
];
/** solape entre tramos de muro, para que no se vean las juntas */
const WALL_OVERLAP = 38;
/** alto de los muros en pantalla */
const WALL_H = 195;
/** Frecuencia de cada losa (índices de ISO1.floors): las lisas y la de piedrecitas son las normales; musgo, huesos y runa, raras. */
const FLOOR_MIX = [0, 1, 2, 0, 1, 2, 0, 1, 2, 5, 5, 5, 0, 1, 2, 3, 4, 6, 7];
/** variante fija por casilla */
const pick = <T,>(list: T[], x: number, y: number): T => list[(((x * 73856093) ^ (y * 19349663)) >>> 0) % list.length]!;
const STATUS_COLOR: Record<string, string> = { burn: '#ff8a30', poison: '#7fe05a', slow: '#8ae0ff', stun: '#ffe84a', mark: '#ff5ad0', charm: '#ff9ad8', vuln: '#c9a0ff', bleed: '#e03040', hobble: '#9ad0e8', guarded: '#7fe0b0', deathmark: '#ff3a4a', verdugo: '#ff8a30', frenzy: '#ff5030', orbita: '#b07cff', chained: '#a0a8c0', rooted: '#c89a5a', anchor: '#5ac8ff', silver: '#e0e8ff', smoke: '#9a8ab8', immune: '#7ae8ff', kinetic: '#58a6ff', prism: '#c8a0ff', fading: '#b0b8d0' };
export const STATUS_NAME: Record<string, string> = { burn: 'Quemadura', poison: 'Veneno', slow: 'Ralentizado', stun: 'Aturdido', mark: 'Marcado', empower: 'Potenciado', reach: 'Alcance+', invis: 'Invisible', exposed: 'Expuesto', charm: 'Encantado', vuln: 'Vulnerable', bleed: 'Sangrado', hobble: 'Atrapado', guarded: 'Protegido', deathmark: 'Marca de la muerte', verdugo: 'Presa', frenzy: 'Frenesí', orbita: 'Órbita', chained: 'Encadenado', rooted: 'Inmovilizado', anchor: 'Sello de anclaje', silver: 'Balas de plata', smoke: 'En el humo', immune: 'Inmune', kinetic: 'Barrera cinética', prism: 'Baluarte prismático', fading: 'Desvaneciéndose' };

interface Float { x: number; y: number; text: string; color: string; t0: number }
interface Shot { x0: number; y0: number; x1: number; y1: number; color: string; t0: number; dur: number; orb?: boolean }
/** Onda expansiva (esfera nueva, golpe giratorio) */
interface Ring { x: number; y: number; color: string; t0: number; dur: number; r: number; spin?: boolean }
/** golpes giratorios: el personaje (y su Sombra) dan una vuelta */
const SPIN_SPELLS = ['s_tajo', 'k_despellejar', 'k_guadana', 'z_colas', 'g_remolino', 'torbellino'];
const SPIN_MS = 420;
interface Ghost { kind: string; team: string; idx: number; x: number; y: number; t0: number }
const ELEMENT_COLOR: Record<string, string> = { fire: '#ff8a30', ice: '#8ae0ff', poison: '#7fe05a', shadow: '#b07cff', holy: '#ffe9a0' };
const ELEMENT_NAME: Record<string, string> = { fire: 'fuego', ice: 'hielo', poison: 'veneno', shadow: 'sombra', holy: 'sagrado' };
const LUNGE_MS = 240;
/** duración de las animaciones de hechizo de los modelos animados */
const ACT_MS = 480;
/** duración de la animación de muerte de los modelos animados */
const DEATH_MS = 900;

const CLASS_KINDS = ['guerrero', 'mago', 'clerigo', 'picaro', 'arquero', 'zorro', 'esferas', 'carcelero', 'acechador', 'barbaro', 'arquitecto', 'pistolero'];
/** Índice de color y etiqueta: héroes de jugadores, y héroes rivales (némesis, duelos) dentro de su bando. */
function teamIdx(c: CombatState): Map<number, number> {
  const m = new Map<number, number>();
  for (const team of ['hero', 'enemy'] as const) c.units.filter((u) => u.team === team && CLASS_KINDS.includes(lookKind(u)) && u.ai !== 'decoy').forEach((u, i) => m.set(u.id, i));
  return m;
}

export class Board {
  /** hechizo elegido, esperando objetivo */
  sel: string | null = null;
  onSelect: () => void = () => {};
  private g: CanvasRenderingContext2D;
  private hover: Pos | null = null;
  /** señales tácticas (tecla G) */
  pings: Array<{ x: number; y: number; at: number; col: string; name: string }> = [];
  /** Casilla bajo el ratón (para la tecla G). */
  hoverCell(): Pos | null { return this.hover; }
  private shown = new Map<number, Pos>();
  private flash = new Map<number, number>();
  private floats: Float[] = [];
  private shots: Shot[] = [];
  private fx = new FxLayer(TILE);
  private rings: Ring[] = [];
  private spins = new Map<number, number>();
  private ghosts: Ghost[] = [];
  private lunge = new Map<number, { t0: number; dx: number; dy: number }>();
  /** animación de hechizo en curso (modelos animados) */
  private acts = new Map<number, { t0: number; anim: Anim }>();
  private faceLeft = new Map<number, boolean>();
  private raf = 0;
  /** antorchas de los muros del fondo en este fotograma (coordenadas de pantalla) */
  private torches: Array<{ x: number; y: number; side: number; lit: boolean }> = [];
  /** este fotograma el suelo se ha dibujado con losas isométricas */
  private isoFloor = false;
  /** vista isométrica (se recuerda en el navegador) */
  iso = isoPref();
  setIso(on: boolean): void { this.iso = on; try { localStorage.setItem(ISO_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ } }
  /** temblor de pantalla del fotograma actual */
  private shake: [number, number] = [0, 0];
  /** Proporción ancho/alto del lienzo, para el CSS. */
  aspect(c: CombatState): number { if (this.iso) { const s = isoSize(c.w, c.h); return s.w / s.h; } return (c.w * TILE) / (c.h * TILE + 22); }
  /** Dibujo sobre el suelo: en isométrico, la casilla cuadrada se proyecta en un rombo. */
  private ground(): void {
    const [sx, sy] = this.shake, c = this.c;
    if (!this.iso || !c) { this.g.setTransform(1, 0, 0, 1, sx, PAD + sy); return; }
    const o = isoPoint(0, 0, c.h), a = ISO_W / 2 / TILE, b = ISO_H / 2 / TILE;
    this.g.setTransform(a, b, -a, b, o.x + sx, o.y + sy);
  }
  /** Dibujo de pie sobre la casilla (x, y): el código de la vista plana se reutiliza tal cual, desplazado al rombo y sin deformar. */
  private upright(x: number, y: number): void {
    const [sx, sy] = this.shake, c = this.c;
    if (!this.iso || !c) { this.g.setTransform(1, 0, 0, 1, sx, PAD + sy); return; }
    const p = isoPoint(x + 0.5, y + 0.5, c.h), fx = (x + 0.5) * TILE, fy = (y + 1) * TILE, k = ISO_UP;
    this.g.setTransform(k, 0, 0, k, p.x - fx * k + sx, p.y + ISO_FOOT - fy * k + sy);
  }
  /** Sin transformación (luces, avisos y ventanas que ocupan todo el lienzo). */
  private screen(): void { this.g.setTransform(1, 0, 0, 1, 0, 0); }

  constructor(private canvas: HTMLCanvasElement, private session: Session) {
    this.g = canvas.getContext('2d')!;
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.hover = this.cell(e); });
    canvas.addEventListener('mouseleave', () => { if (!this.touch) this.hover = null; });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.select(null); });
    window.addEventListener('pointerdown', (e) => { this.touch = e.pointerType !== 'mouse'; });
    canvas.addEventListener('click', (e) => {
      const p = this.cell(e);
      // en pantallas táctiles no hay «pasar el ratón»: el primer toque enseña la previsualización y el segundo confirma
      if (this.touch && p && !(this.hover && this.hover.x === p.x && this.hover.y === p.y) && !this.c?.deploy) { this.hover = p; return; }
      this.click(p);
      if (this.touch) this.hover = null;
    });
    const loop = (): void => { this.raf = requestAnimationFrame(loop); this.draw(); };
    loop();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  select(id: string | null): void {
    this.sel = id;
    this.onSelect();
  }

  private get c(): CombatState | null {
    return this.session.run?.combat ?? null;
  }

  private cell(e: MouseEvent): Pos | null {
    const c = this.c;
    if (!c) return null;
    const r = this.canvas.getBoundingClientRect();
    if (this.iso) {
      const q = isoCell(((e.clientX - r.left) / r.width) * this.canvas.width, ((e.clientY - r.top) / r.height) * this.canvas.height, c.h);
      const p = { x: Math.floor(q.x), y: Math.floor(q.y) };
      return p.x >= 0 && p.y >= 0 && p.x < c.w && p.y < c.h ? p : null;
    }
    const p = { x: Math.floor(((e.clientX - r.left) / r.width) * c.w), y: Math.floor((((e.clientY - r.top) / r.height) * (c.h * TILE + PAD) - PAD) / TILE) };
    return p.x >= 0 && p.y >= 0 && p.x < c.w && p.y < c.h ? p : null;
  }

  private click(p: Pos | null): void {
    const c = this.c;
    if (!c || !p) return;
    if (c.deploy) { this.session.act({ a: 'deploy', to: p }); return; }
    if (!this.session.isMyTurn()) return;
    if (this.sel) {
      this.session.act({ a: 'cast', spell: this.sel, at: p });
      this.select(null);
    } else {
      this.session.act({ a: 'move', to: p });
    }
  }

  /** Efectos visuales de lo que acaba de pasar. */
  applyEvents(events: GameEvent[]): void {
    const c = this.c;
    if (!c) return;
    const now = performance.now();
    const float = (id: number, text: string, color: string): void => {
      const u = c.units.find((x) => x.id === id);
      const p = this.shown.get(id) ?? u?.pos;
      if (p) this.floats.push({ x: (p.x + 0.5) * TILE + (Math.random() * 16 - 8), y: p.y * TILE + 8 - this.floats.filter((f) => now - f.t0 < 200).length * 14, text, color, t0: now });
    };
    const heroIdx = teamIdx(c);
    for (const e of events) {
      const u = 'unit' in e ? c.units.find((x) => x.id === e.unit) : undefined;
      const from = u ? this.shown.get(u.id) ?? u.pos : undefined;
      if (e.t === 'cast' && u) this.acts.set(u.id, { t0: now, anim: animFor(e.spell, !!SPELLS[e.spell]?.dmg) });
      if (e.t === 'cast' && u && from && SPIN_SPELLS.includes(e.spell)) {
        // giro: el personaje da una vuelta y un tajo circular le rodea (también a su Sombra)
        this.spins.set(u.id, now);
        const sh = c.marks?.find((m) => m.kind === 'shadow' && m.owner === u.id);
        for (const p of [from, ...(sh ? [sh.pos] : [])]) this.rings.push({ x: (p.x + 0.5) * TILE, y: (p.y + 0.55) * TILE, color: e.element ? ELEMENT_COLOR[e.element] ?? '#e8e0ff' : '#e8e0ff', t0: now, dur: SPIN_MS, r: TILE * 0.85, spin: true });
      }
      if (e.t === 'markAdd' && e.kind === 'pulse') this.rings.push({ x: (e.at.x + 0.5) * TILE, y: (e.at.y + 0.45) * TILE, color: '#c9a0ff', t0: now, dur: 420, r: TILE * 1.2 });
      if (e.t === 'flame') this.shots.push({ x0: (e.from.x + 0.5) * TILE, y0: (e.from.y + 0.4) * TILE, x1: (e.at.x + 0.5) * TILE, y1: (e.at.y + 0.4) * TILE, color: '#4ad0ff', t0: now, dur: 300, orb: true });
      if (e.t === 'markAdd' && e.kind === 'sphere') {
        // la esfera aparece con una pequeña explosión
        const x = (e.at.x + 0.5) * TILE, y = (e.at.y + 0.45) * TILE;
        this.rings.push({ x, y, color: '#c9a0ff', t0: now + 150, dur: 380, r: TILE * 0.55 });
        for (let i = 0; i < 8; i++) this.shots.push({ x0: x, y0: y, x1: x + Math.cos(i * 0.785) * TILE * 0.6, y1: y + Math.sin(i * 0.785) * TILE * 0.6, color: '#a070ff', t0: now + 150, dur: 300 });
      }
      if (e.t === 'echo') {
        // la Sombra replica el golpe: un proyectil sale de su casilla
        const dx = e.at.x - e.from.x, dy = e.at.y - e.from.y, len = Math.hypot(dx, dy);
        this.shots.push({ x0: (e.from.x + 0.5) * TILE, y0: (e.from.y + 0.4) * TILE, x1: (e.at.x + 0.5) * TILE, y1: (e.at.y + 0.4) * TILE, color: '#7a3fc0', t0: now + 120, dur: Math.min(320, 90 + len * 35) });
      }
      if (e.t === 'cast' && u && from) {
        const dx = e.at.x - from.x, dy = e.at.y - from.y, len = Math.hypot(dx, dy);
        if (len > 0) {
          this.lunge.set(u.id, { t0: now, dx: dx / len, dy: dy / len });
          if (dx !== 0) this.faceLeft.set(u.id, dx < 0);
          const bounce = SPELLS[e.spell]?.bounce;
          if (bounce) {
            // el orbe va hasta el final de la línea y vuelve a la mano
            const dur = Math.min(380, 120 + len * 40), x0 = (from.x + 0.5) * TILE, y0 = (from.y + 0.4) * TILE, x1 = (e.at.x + 0.5) * TILE, y1 = (e.at.y + 0.4) * TILE;
            const col = e.spell === 'z_orbe' ? '#4ad0ff' : ELEMENT_COLOR[e.element ?? ''] ?? '#ffe08a';
            this.shots.push({ x0, y0, x1, y1, color: col, t0: now, dur, orb: true }, { x0: x1, y0: y1, x1: x0, y1: y0, color: col, t0: now + dur, dur, orb: true });
          }
        }
        // H6: el resto de hechizos se dibuja con su receta de efectos (proyectil, haz, arco, área, impacto, temblor)
        const def = SPELLS[e.spell];
        if (def && !def.bounce && !SPIN_SPELLS.includes(e.spell)) this.fx.cast(recipeFor(def, u.kind), from, e.at, fxCells(def, from, e.at, c.w, c.h), now);
      } else if (e.t === 'move' && u && e.path.length) {
        const last = e.path[e.path.length - 1]!;
        if (from && last.x !== Math.round(from.x)) this.faceLeft.set(u.id, last.x < from.x);
      } else if (e.t === 'death' && u && from) {
        this.ghosts.push({ kind: lookKind(u), team: u.team, idx: heroIdx.get(u.id) ?? 0, x: from.x, y: from.y, t0: now });
      }
      if (e.t === 'damage') {
        this.flash.set(e.unit, now + 180);
        if (from && e.amount > 0) this.fx.hit(from, e.crit, now);
        float(e.unit, e.amount > 0 ? `-${e.amount}${e.crit ? '!' : ''}` : `escudo -${e.absorbed}`, e.crit ? '#ffd24a' : '#ff7080');
      } else if (e.t === 'heal') float(e.unit, `+${e.amount}`, '#5fcf80');
      else if (e.t === 'shield') float(e.unit, `escudo +${e.amount}`, '#58a6ff');
      else if (e.t === 'status') float(e.unit, STATUS_NAME[e.kind] ?? e.kind, STATUS_COLOR[e.kind] ?? '#fff');
      else if (e.t === 'skip') float(e.unit, 'Pierde el turno', '#ffe84a');
      else if (e.t === 'soul') float(e.unit, e.armor ? 'Alma +1 armadura' : 'Alma', '#9ad0e8');
      else if (e.t === 'trap') float(e.unit, '¡Púas!', '#ff8a30');
      else if (e.t === 'stuck') float(e.unit, '¡Atrapado!', '#7fe05a');
      else if (e.t === 'snare') float(e.unit, '¡Cepo!', '#d8b060');
      else if (e.t === 'drain') { if (e.mp) float(e.unit, `${e.mp > 0 ? '+' : ''}${e.mp} PM`, '#58a6ff'); if (e.ap) float(e.unit, `${e.ap > 0 ? '+' : ''}${e.ap} PA`, '#f2c14e'); }
      else if (e.t === 'resist') float(e.unit, e.what, '#c8c8d8');
      else if (e.t === 'tackle') float(e.unit, `¡Placado! -${e.lost} PM`, '#58a6ff');
      else if (e.t === 'revive') float(e.unit, '¡Resucita!', '#7fe05a');
      else if (e.t === 'explode') { float(e.unit, '¡BUM!', '#ff8a30'); if (from) for (let i = 0; i < 6; i++) this.shots.push({ x0: (from.x + 0.5) * TILE, y0: (from.y + 0.5) * TILE, x1: (from.x + 0.5 + Math.cos(i * 1.05) * 1.3) * TILE, y1: (from.y + 0.5 + Math.sin(i * 1.05) * 1.3) * TILE, color: '#ff8a30', t0: now, dur: 260 }); }
      else if (e.t === 'split') float(e.unit, 'Se divide', '#c9a0ff');
      else if (e.t === 'blink') { this.shown.set(e.unit, { ...e.to }); float(e.unit, 'Salto sombrío', '#c77dff'); }
      else if (e.t === 'devour') float(e.unit, 'Devora', '#c9a0ff');
      else if (e.t === 'raise') float(e.unit, 'Alza muertos', '#c9a0ff');
      else if (e.t === 'summon') float(e.unit, 'Invocado', '#c77dff');
      else if (e.t === 'phase') float(e.unit, '¡FASE 2!', '#ff3060');
      else if (e.t === 'detonate') float(e.unit, `¡Marca de la muerte! ${e.amount}`, '#ff3a4a');
      else if (e.t === 'caged') float(e.unit, '¡La caja!', '#7fe0b0');
      else if (e.t === 'reset') float(e.unit, `¡Remate! ${SPELLS[e.spell]?.name ?? ''} gratis`, '#4ad0ff');
    }
  }

  /** Suelo en damero con ruido pixel-art, abismos, raíces, fuego y la sombra que proyectan los muros. */
  private drawFloor(c: CombatState, zone: (typeof ZONES)[number], now: number): void {
    const g = this.g;
    const wall = new Set(c.obstacles), pit = new Set(c.abyss ?? []);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const X = x * TILE, Y = y * TILE, k = `${x},${y}`;
        if (pit.has(k)) {
          // abismo: hueco negro con el borde de piedra iluminado y algún brillo lejano
          const gr = g.createLinearGradient(0, Y, 0, Y + TILE);
          gr.addColorStop(0, '#000'); gr.addColorStop(1, '#0a0614');
          g.fillStyle = gr; g.fillRect(X, Y, TILE, TILE);
          if (!pit.has(`${x},${y - 1}`)) { g.fillStyle = zone.rock[0]; g.fillRect(X, Y, TILE, 9); g.fillStyle = zone.rock[1]; g.fillRect(X, Y, TILE, 3); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(X, Y + 9, TILE, 6); }
          const tw = 0.3 + 0.3 * Math.sin(now / 700 + x * 3 + y);
          g.fillStyle = `rgba(150,90,255,${tw * 0.5})`; g.fillRect(X + ((x * 17 + y * 7) % 40) + 6, Y + 26 + ((x * 5) % 18), 2, 2);
          continue;
        }
        const light = (x + y) % 2 === 0;
        if (this.isoFloor) {
          // losas isométricas ya dibujadas: solo el damero suave para leer las casillas y la sombra de los muros
          g.fillStyle = light ? 'rgba(255,240,210,.035)' : 'rgba(0,0,0,.16)'; g.fillRect(X, Y, TILE, TILE);
          if (wall.has(`${x},${y - 1}`)) { const sg = g.createLinearGradient(0, Y, 0, Y + TILE * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(X, Y, TILE, TILE * 0.45); }
          continue;
        }
        if (zone === ZONES[0] && ready(Z1.floor)) {
          // losas ilustradas: una de las 16 variantes, fija por casilla; el damero se conserva para leer las casillas
          const v = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 16;
          g.drawImage(Z1.floor, (v % 4) * 64, Math.floor(v / 4) * 64, 64, 64, X, Y, TILE, TILE);
          g.fillStyle = light ? 'rgba(255,240,210,.04)' : 'rgba(0,0,0,.2)'; g.fillRect(X, Y, TILE, TILE);
          if (wall.has(`${x},${y - 1}`)) { const sg = g.createLinearGradient(0, Y, 0, Y + TILE * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(X, Y, TILE, TILE * 0.45); }
          continue;
        }
        // damero: casillas claras y oscuras con ruido fijo
        g.fillStyle = zone.floor[light ? 0 : 1]!;
        g.fillRect(X, Y, TILE, TILE);
        // damero marcado: las casillas oscuras se oscurecen y las claras reciben un poco de luz
        g.fillStyle = light ? 'rgba(255,240,210,.05)' : 'rgba(0,0,0,.22)'; g.fillRect(X, Y, TILE, TILE);
        const h = (x * 73856093) ^ (y * 19349663);
        for (let i = 0; i < 10; i++) {
          const r = Math.imul(h ^ (i * 2654435761), 2246822519) >>> 0;
          g.fillStyle = (r & 1) ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)';
          g.fillRect(X + 2 + ((r >>> 4) % (TILE - 6)), Y + 2 + ((r >>> 12) % (TILE - 6)), 4, 4);
        }
        // juntas de las losas: luz arriba-izquierda, sombra abajo-derecha
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(X, Y, TILE, 2); g.fillRect(X, Y, 2, TILE);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X, Y + TILE - 2, TILE, 2); g.fillRect(X + TILE - 2, Y, 2, TILE);
        if ((h & 15) === 3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X + 10 + ((h >> 6) & 15), Y + 18 + ((h >> 10) & 15), 12, 2); g.fillRect(X + 20 + ((h >> 6) & 15), Y + 20 + ((h >> 10) & 15), 2, 7); }
        // sombra proyectada por el muro de arriba
        if (wall.has(`${x},${y - 1}`)) { const sg = g.createLinearGradient(0, Y, 0, Y + TILE * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(X, Y, TILE, TILE * 0.45); }
      }
    // raíces venenosas: zarzas violáceas con espinas verdes
    for (const k of c.roots ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const X = x * TILE, Y = y * TILE;
      g.strokeStyle = '#2a1028'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(X + 6, Y + 40); g.bezierCurveTo(X + 18, Y + 18, X + 34, Y + 46, X + 50, Y + 16); g.stroke();
      g.strokeStyle = '#b04aa0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(X + 6, Y + 40); g.bezierCurveTo(X + 18, Y + 18, X + 34, Y + 46, X + 50, Y + 16); g.stroke();
      g.beginPath(); g.moveTo(X + 10, Y + 12); g.quadraticCurveTo(X + 26, Y + 30, X + 20, Y + 50); g.stroke();
      g.fillStyle = `rgba(140,255,120,${0.6 + 0.3 * Math.sin(now / 300 + x)})`;
      for (const [a, b] of [[16, 26], [30, 36], [42, 22], [22, 44]] as const) g.fillRect(X + a, Y + b, 3, 3);
    }
    // fuego en el suelo (brasero roto)
    for (const [k, t] of Object.entries(c.fire ?? {})) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const X = x * TILE, Y = y * TILE;
      g.fillStyle = 'rgba(255,90,20,.22)'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
      for (let i = 0; i < 4; i++) {
        const fx = X + 10 + i * 11, fl = 10 + 6 * Math.sin(now / 90 + i * 1.7 + x);
        g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(fx - 5, Y + TILE - 8); g.quadraticCurveTo(fx, Y + TILE - 8 - fl * 2, fx + 5, Y + TILE - 8); g.fill();
        g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(fx - 2, Y + TILE - 8); g.quadraticCurveTo(fx, Y + TILE - 8 - fl, fx + 2, Y + TILE - 8); g.fill();
      }
      g.fillStyle = '#fff3c0'; g.font = 'bold 11px monospace'; g.textAlign = 'left'; g.fillText(String(t), X + TILE - 13, Y + 13);
    }
  }

  /** Muro con volumen: cara superior iluminada (sobresale hacia arriba) y cara frontal de ladrillo más oscura. */
  private drawWall(c: CombatState, zone: (typeof ZONES)[number], x: number, y: number): void {
    const g = this.g, X = x * TILE, Y = y * TILE, lift = Math.round(TILE * 0.4);
    if (zone === ZONES[0] && ready(Z1.pillar)) {
      // pilar ilustrado: ocupa su casilla y sobresale hacia arriba (tapa lo que hay detrás, no lo de delante)
      const h = Math.round(TILE * (Z1.pillar.naturalHeight / Z1.pillar.naturalWidth));
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(X + TILE / 2, Y + TILE - 4, TILE * 0.46, 7, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(Z1.pillar, X, Y + TILE - h, TILE, h);
      return;
    }
    const front = !c.obstacles.includes(`${x},${y + 1}`);
    const topY = Y - lift, topH = TILE - 2;
    // cara frontal de ladrillo (la que mira hacia abajo, si no hay otro muro delante)
    if (front) {
      const fy = topY + topH, fh = Y + TILE - fy;
      g.fillStyle = zone.rock[2]; g.fillRect(X, fy, TILE, fh);
      g.fillStyle = 'rgba(0,0,0,.28)';
      for (let r = 0; r < fh; r += 8) {
        g.fillRect(X, fy + r, TILE, 1);
        const off = (r / 8) % 2 ? 0 : 14;
        for (let bx = off; bx < TILE; bx += 28) g.fillRect(X + bx, fy + r, 1, 8);
      }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(X, Y + TILE - 3, TILE, 3);
    }
    // cara superior: más clara, biselada y con grietas
    g.fillStyle = zone.rock[1]; g.fillRect(X, topY, TILE, topH);
    g.fillStyle = zone.rock[0]; g.fillRect(X + 3, topY + 3, TILE - 6, topH - 7);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(X + 3, topY + 3, TILE - 6, 3);
    const h = (x * 92821) ^ (y * 68917);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X + 8 + (h & 15), topY + 12 + ((h >> 4) & 15), 10, 2); g.fillRect(X + 22 + ((h >> 8) & 15), topY + 20 + ((h >> 12) & 7), 2, 8);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.strokeRect(X + 1, topY + 1, TILE - 2, (front ? Y + TILE : topY + topH) - topY - 2);
  }

  /** Objeto isométrico ilustrado: la base (un rombo del ancho de la imagen) se apoya en el rombo de la casilla. */
  private drawIsoProp(c: CombatState, img: HTMLImageElement, x: number, y: number, scale = 0.74): void {
    const g = this.g, [sx, sy] = this.shake, p = isoPoint(x + 0.5, y + 0.5, c.h);
    const w = ISO_W * scale, h = (w * img.naturalHeight) / img.naturalWidth;
    // la punta inferior de la base queda w/4 por debajo del centro del rombo
    const bottom = p.y + w / 4 + sy;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(p.x + sx, p.y + sy + 4, w * 0.55, w * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(img, p.x - w / 2 + sx, bottom - h, w, h);
  }

  /** Muros del fondo por los dos bordes de atrás del tablero, de la esquina de arriba hacia fuera (lo de atrás primero). */
  private drawIsoWalls(c: CombatState): void {
    this.torches = [];
    const g = this.g, [sx, sy] = this.shake, s = WALL_H / 360;
    const bag = WALLS1.flatMap((w) => Array<typeof w>(w.w).fill(w));
    for (const side of ['left', 'right'] as const) {
      const len = side === 'left' ? c.h : c.w;
      let i = 0, n = 0;
      while (i < len) {
        const wl = pick(bag, side === 'left' ? 101 : 7, n++ * 13 + (side === 'left' ? 0 : 50));
        const k = Math.min(wl.cells, len - i), img = wl.img!;
        // ancho: el del tramo más un solape (se estira un poco si hace falta)
        const w = Math.max(img.naturalWidth * s, (k * ISO_W) / 2 + WALL_OVERLAP);
        const dir = side === 'left' ? 1 : -1;
        const p = side === 'left' ? isoPoint(0, i + k, c.h) : isoPoint(i + k, 0, c.h);
        const ox = p.x + sx, oy = p.y + sy - wl.foot * s;
        g.save();
        // borde x = 0: el muro sube hacia la derecha y su pie izquierdo va en el extremo de abajo del tramo;
        // borde y = 0: la misma imagen volteada, con el pie en el extremo de abajo a la derecha
        g.translate(ox, oy); g.scale(dir, 1);
        g.drawImage(img, 0, 0, w, WALL_H);
        g.restore();
        if (wl.torch) this.torches.push({ x: ox + dir * wl.torch[0] * w, y: oy + wl.torch[1] * WALL_H, side: dir, lit: !!wl.lit });
        i += k;
      }
    }
  }

  /** Luz de las antorchas: halo cálido que parpadea sobre el muro y sobre el suelo de delante, y llama en los soportes apagados. */
  private drawTorchLight(now: number): void {
    const g = this.g;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [i, t] of this.torches.entries()) {
      const fl = 0.85 + 0.15 * Math.sin(now / 110 + i * 1.7) + 0.06 * Math.sin(now / 37 + i);
      // halo en el muro
      let gr = g.createRadialGradient(t.x, t.y, 2, t.x, t.y, 70);
      gr.addColorStop(0, `rgba(255,150,60,${(0.28 * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(t.x - 70, t.y - 70, 140, 140);
      // charco de luz en el suelo, delante del muro (elipse aplastada como el suelo)
      const fx = t.x + t.side * 70, fy = t.y + 150;
      g.save(); g.translate(fx, fy); g.scale(1, 0.5);
      gr = g.createRadialGradient(0, 0, 4, 0, 0, 190);
      gr.addColorStop(0, `rgba(255,140,50,${(0.2 * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,110,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 190, 0, 6.3); g.fill(); g.restore();
    }
    g.restore();
    // llama en los soportes que venían apagados
    for (const [i, t] of this.torches.entries()) {
      if (t.lit) continue;
      const h = 13 + 4 * Math.sin(now / 80 + i * 2), x = t.x, y = t.y;
      g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x, y - h * 1.7, x + 6, y); g.fill();
      g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(x - 3, y); g.quadraticCurveTo(x, y - h, x + 3, y); g.fill();
      g.fillStyle = '#fff6d0'; g.fillRect(x - 1, y - 4, 2, 3);
    }
  }

  /** Suelo con losas isométricas (rombo 256×128): una variante fija por casilla, girada a veces para que no se repita. */
  private drawIsoFloor(c: CombatState): void {
    const g = this.g, [sx, sy] = this.shake, pit = new Set(c.abyss ?? []);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        if (pit.has(`${x},${y}`)) continue;
        const img = ISO1.floors[pick(FLOOR_MIX, x, y)]!, p = isoPoint(x + 0.5, y + 0.5, c.h);
        const flip = ((x * 31 + y * 17) & 1) === 1;
        g.save(); g.translate(p.x + sx, p.y + sy); if (flip) g.scale(-1, 1);
        // un píxel de más para que no se vean juntas finas entre rombos
        g.drawImage(img, -ISO_W / 2 - 0.5, -ISO_H / 2 - 0.5, ISO_W + 1, ISO_H + 1);
        g.restore();
      }
  }

  /** Grosor del suelo en isométrico: los dos bordes delanteros del tablero son un bloque de roca. */
  private drawSlab(c: CombatState, zone: (typeof ZONES)[number]): void {
    const g = this.g, [sx, sy] = this.shake, D = Math.round(ISO_H * 0.55);
    const P = (x: number, y: number): [number, number] => { const q = isoPoint(x, y, c.h); return [q.x + sx, q.y + sy]; };
    const [lx, ly] = P(0, c.h), [bx, by] = P(c.w, c.h), [rx, ry] = P(c.w, 0);
    const face = (ax: number, ay: number, bx2: number, by2: number, col: string): void => {
      const gr = g.createLinearGradient(0, Math.min(ay, by2), 0, Math.max(ay, by2) + D);
      gr.addColorStop(0, col); gr.addColorStop(1, '#050307');
      g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.lineTo(bx2, by2 + D); g.lineTo(ax, ay + D); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke();
    };
    face(lx, ly, bx, by, zone.rock[1]);
    face(bx, by, rx, ry, zone.rock[2]);
  }

  /** Muro en isométrico: un bloque de piedra con cara superior iluminada y dos caras laterales en sombra. */
  private drawIsoBlock(c: CombatState, zone: (typeof ZONES)[number], x: number, y: number): void {
    const g = this.g, [sx, sy] = this.shake, p = isoPoint(x + 0.5, y + 0.5, c.h), hw = ISO_W / 2, hh = ISO_H / 2, L = Math.round(ISO_H * 1.1);
    const X = p.x + sx, Y = p.y + sy, T = Y - L;
    const poly = (pts: number[], fill: string): void => { g.fillStyle = fill; g.beginPath(); g.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!); g.closePath(); g.fill(); };
    // cara izquierda (más clara que la derecha: la luz llega por la izquierda)
    poly([X - hw, T, X, T + hh, X, Y + hh, X - hw, Y], zone.rock[1]);
    poly([X, T + hh, X + hw, T, X + hw, Y, X, Y + hh], zone.rock[2]);
    // juntas de los sillares
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
    for (let r = 1; r < 4; r++) {
      const k = (L * r) / 4;
      g.beginPath(); g.moveTo(X - hw, T + k); g.lineTo(X, T + hh + k); g.lineTo(X + hw, T + k); g.stroke();
    }
    // cara superior con bisel claro
    poly([X, T - hh, X + hw, T, X, T + hh, X - hw, T], zone.rock[0]);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X - hw + 3, T); g.lineTo(X, T - hh + 2); g.lineTo(X + hw - 3, T); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X, T - hh); g.lineTo(X + hw, T); g.lineTo(X + hw, Y); g.lineTo(X, Y + hh); g.lineTo(X - hw, Y); g.lineTo(X - hw, T); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(X - hw, T); g.lineTo(X, T + hh); g.lineTo(X + hw, T); g.moveTo(X, T + hh); g.lineTo(X, Y + hh); g.stroke();
  }

  /** Brasero: cuenco de hierro con llamas; se rompe con un golpe y deja una línea de fuego. */
  /** Cercado de púas del Arquitecto: cristales de runas azules. */
  private drawFence(x: number, y: number, now: number): void {
    const g = this.g, bx = x * TILE, by = y * TILE;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(bx + TILE / 2, by + TILE * 0.82, TILE * 0.42, TILE * 0.14, 0, 0, 6.3); g.fill();
    const glow = 0.6 + 0.3 * Math.sin(now / 260 + x * 2 + y);
    for (const [ox, h, w] of [[0.18, 0.62, 0.2], [0.42, 0.85, 0.24], [0.68, 0.55, 0.2]] as const) {
      const cx = bx + TILE * (ox + w / 2), top = by + TILE * (0.85 - h), base = by + TILE * 0.85;
      g.fillStyle = '#1a3a70'; g.beginPath(); g.moveTo(cx - TILE * w / 2, base); g.lineTo(cx, top); g.lineTo(cx + TILE * w / 2, base); g.closePath(); g.fill();
      g.fillStyle = `rgba(110,200,255,${glow.toFixed(2)})`; g.beginPath(); g.moveTo(cx - TILE * w / 4, base); g.lineTo(cx, top + 4); g.lineTo(cx + 1, base); g.closePath(); g.fill();
      g.fillStyle = '#e0f4ff'; g.fillRect(cx - 1, top + TILE * h * 0.45, 2, 4);
    }
  }

  private drawBrazier(x: number, y: number, now: number): void {
    const g = this.g, cx = (x + 0.5) * TILE, base = (y + 1) * TILE - 8;
    const sh = g.createRadialGradient(cx, base, 1, cx, base, TILE * 0.35); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(cx, base, TILE * 0.35, 8, 0, 0, 6.3); g.fill();
    const glow = g.createRadialGradient(cx, base - 30, 2, cx, base - 30, TILE * 0.7);
    glow.addColorStop(0, 'rgba(255,140,40,.35)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, base - 30, TILE * 0.7, 0, 6.3); g.fill();
    g.fillStyle = '#2a2420'; g.fillRect(cx - 3, base - 18, 6, 16); g.fillRect(cx - 12, base - 3, 24, 4);
    g.fillStyle = '#4a4038'; g.beginPath(); g.moveTo(cx - 16, base - 24); g.lineTo(cx + 16, base - 24); g.lineTo(cx + 10, base - 14); g.lineTo(cx - 10, base - 14); g.fill();
    g.fillStyle = '#8a7a68'; g.fillRect(cx - 16, base - 26, 32, 3);
    for (let i = 0; i < 3; i++) {
      const fx = cx - 9 + i * 9, fl = 12 + 5 * Math.sin(now / 80 + i * 2 + x);
      g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(fx - 6, base - 25); g.quadraticCurveTo(fx, base - 25 - fl * 1.6, fx + 6, base - 25); g.fill();
      g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(fx - 3, base - 25); g.quadraticCurveTo(fx, base - 25 - fl, fx + 3, base - 25); g.fill();
    }
  }

  private draw(): void {
    const c = this.c;
    const g = this.g;
    if (!c) return;
    const size = this.iso ? isoSize(c.w, c.h) : { w: c.w * TILE, h: c.h * TILE + PAD };
    if (this.canvas.width !== size.w || this.canvas.height !== size.h) {
      this.canvas.width = size.w;
      this.canvas.height = size.h;
      this.shown.clear();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07050a';
    if (this.iso) g.fillRect(0, 0, size.w, size.h); else g.fillRect(0, 0, this.canvas.width, PAD);
    const now = performance.now();
    // H6: temblor de pantalla de los golpes fuertes
    this.shake = this.fx.offset(now);
    if (this.iso) this.drawSlab(c, ZONES[this.session.run?.zone ?? 0] ?? ZONES[0]!);
    this.isoFloor = this.iso && (this.session.run?.zone ?? 0) === 0 && ISO1.floors.every(ready);
    if (this.isoFloor && WALLS1.every((w) => ready(w.img))) this.drawIsoWalls(c);
    if (this.isoFloor) this.drawIsoFloor(c);
    if (this.isoFloor && this.torches.length) this.drawTorchLight(now);
    this.ground();
    const zone = ZONES[this.session.run?.zone ?? 0] ?? ZONES[0]!;
    this.drawFloor(c, zone, now);
    const me0 = this.session.myUnit();
    for (const k of c.puddles ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      g.fillStyle = 'rgba(70,200,90,.38)'; g.beginPath(); g.ellipse((x + 0.5) * TILE, (y + 0.6) * TILE, TILE * 0.42, TILE * 0.28, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(190,255,150,.35)'; g.beginPath(); g.ellipse((x + 0.42) * TILE, (y + 0.55) * TILE, TILE * 0.14, TILE * 0.07, 0, 0, 6.3); g.fill();
    }
    // aliados caídos: charco, lápida y su nombre donde cayeron
    for (const d of c.units.filter((x) => x.hp <= 0 && x.team === 'hero' && x.summoner === undefined && x.ai !== 'decoy' && !c.units.some((o) => o.hp > 0 && o.pos.x === x.pos.x && o.pos.y === x.pos.y))) {
      this.upright(d.pos.x, d.pos.y);
      const cx = (d.pos.x + 0.5) * TILE, cy = (d.pos.y + 0.5) * TILE;
      g.fillStyle = 'rgba(110,10,18,.55)'; g.beginPath(); g.ellipse(cx + 3, cy + 12, TILE * 0.36, TILE * 0.17, 0.2, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, cy + 14, 13, 4, 0, 0, 6.3); g.fill();
      // lápida
      g.fillStyle = '#1a1714'; g.fillRect(cx - 10, cy - 12, 20, 26); g.beginPath(); g.arc(cx, cy - 12, 10, Math.PI, 0); g.fill();
      g.fillStyle = '#7a7268'; g.fillRect(cx - 8, cy - 11, 16, 23); g.beginPath(); g.arc(cx, cy - 11, 8, Math.PI, 0); g.fill();
      g.fillStyle = '#9c948a'; g.fillRect(cx - 8, cy - 11, 3, 23);
      g.fillStyle = '#3a342e'; g.fillRect(cx - 1, cy - 14, 3, 13); g.fillRect(cx - 5, cy - 10, 11, 3);
      g.font = 'bold 9px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(`✝ ${d.name}`, cx, cy + 24); g.fillStyle = '#ff9a9a'; g.fillText(`✝ ${d.name}`, cx, cy + 24);
    }
    // marcadores en el suelo (esferas oscuras…); los que flotan o están de pie no se deforman
    for (const m of c.marks ?? []) {
      if (['sphere', 'shadow', 'flame', 'soul', 'lantern'].includes(m.kind)) this.upright(m.pos.x, m.pos.y); else this.ground();
      const cx = (m.pos.x + 0.5) * TILE, cy = (m.pos.y + 0.45) * TILE, pulse = 1 + Math.sin(performance.now() / 260 + m.id) * 0.06;
      if (m.kind === 'sphere') {
        // esfera oscura como en la ficha: halo violeta, anillo claro y núcleo brillante que flota
        const fy = cy + Math.sin(now / 300 + m.id) * 3;
        const gl = g.createRadialGradient(cx, fy, 2, cx, fy, TILE * 0.42 * pulse);
        gl.addColorStop(0, 'rgba(200,150,255,.55)'); gl.addColorStop(1, 'rgba(122,63,192,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(cx, fy, TILE * 0.42 * pulse, 0, 6.3); g.fill();
        g.fillStyle = '#2a1050'; g.beginPath(); g.arc(cx, fy, TILE * 0.19, 0, 6.3); g.fill();
        g.strokeStyle = '#b07cff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, fy, TILE * 0.19, 0, 6.3); g.stroke();
        g.fillStyle = '#9a5cf0'; g.beginPath(); g.arc(cx, fy, TILE * 0.11 * pulse, 0, 6.3); g.fill();
        g.fillStyle = '#f6eaff'; g.beginPath(); g.arc(cx - 2, fy - 2, TILE * 0.05, 0, 6.3); g.fill();
      } else if (m.kind === 'shadow') {
        // la Sombra: un clon oscuro del Acechador, quieto en su casilla
        const o = c.units.find((x) => x.id === m.owner);
        const sk = o && this.spins.has(o.id) ? (now - this.spins.get(o.id)!) / SPIN_MS : 1;
        if (o) drawUnit(g, o.kind, o.team, 0, cx, (m.pos.y + 1) * TILE - 6, TILE, { anim: sk < 1 ? 'attack' : 'idle', frame: sk < 1 ? Math.floor(sk * ANIM_FRAMES.attack) : Math.floor(now / 260) % ANIM_FRAMES.idle, tint: 'shadow', alpha: 0.85, flip: sk < 1 ? Math.floor(sk * 6) % 2 === 0 : this.faceLeft.get(o.id) ?? false });
      } else if (m.kind === 'flame') {
        // llama azul del Fuego zorruno
        const fy = cy + Math.sin(now / 160 + m.id) * 3, fl = 1 + Math.sin(now / 90 + m.id) * 0.12;
        g.fillStyle = 'rgba(74,208,255,.25)'; g.beginPath(); g.arc(cx, fy, TILE * 0.26, 0, 6.3); g.fill();
        g.fillStyle = '#2a7ad8'; g.beginPath(); g.moveTo(cx - 7, fy + 6); g.quadraticCurveTo(cx, fy - 16 * fl, cx + 7, fy + 6); g.fill();
        g.fillStyle = '#7ae8ff'; g.beginPath(); g.moveTo(cx - 4, fy + 5); g.quadraticCurveTo(cx, fy - 9 * fl, cx + 4, fy + 5); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(cx - 1, fy, 2, 4);
        continue;
      } else if (m.kind === 'cage') {
        // muro espectral de La caja
        const X = m.pos.x * TILE, Y = m.pos.y * TILE;
        g.fillStyle = 'rgba(127,224,176,.16)'; g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.strokeStyle = `rgba(160,255,210,${0.55 + 0.25 * Math.sin(now / 200 + m.id)})`; g.lineWidth = 2;
        for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(X + (i * TILE) / 4, Y + 6); g.lineTo(X + (i * TILE) / 4, Y + TILE - 6); g.stroke(); }
        g.strokeRect(X + 5, Y + 5, TILE - 10, TILE - 10);
        continue;
      } else if (m.kind === 'soul') {
        // alma suelta: un fuego fatuo verdoso
        const fy = cy + Math.sin(now / 300 + m.id) * 4;
        g.fillStyle = 'rgba(140,240,210,.25)'; g.beginPath(); g.arc(cx, fy, TILE * 0.2, 0, 6.3); g.fill();
        g.fillStyle = '#9af0d0'; g.beginPath(); g.arc(cx, fy, 5, 0, 6.3); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(cx - 2, fy - 2, 3, 3);
        continue;
      } else if (m.kind === 'lantern') {
        g.fillStyle = 'rgba(127,224,90,.18)'; g.beginPath(); g.arc(cx, cy + 4, TILE * 0.45 * pulse, 0, 6.3); g.fill();
        g.fillStyle = '#6a6a78'; g.fillRect(cx - 1, cy - TILE * 0.3, 2, TILE * 0.12);
        g.fillStyle = '#3a3a2a'; g.fillRect(cx - TILE * 0.14, cy - TILE * 0.18, TILE * 0.28, TILE * 0.36);
        g.fillStyle = '#7fe05a'; g.fillRect(cx - TILE * 0.08, cy - TILE * 0.1, TILE * 0.16, TILE * 0.2 * pulse);
        g.fillStyle = '#e0ffb0'; g.fillRect(cx - 2, cy - 2, 4, 4);
      } else if (m.kind === 'glyph' || m.kind === 'gravglyph') {
        // glifos del Arquitecto: círculo rúnico que gira (fulminante cian, matriz magenta, gravedad violeta)
        const col = m.sub === 'matriz' ? '255,90,220' : m.kind === 'gravglyph' ? '170,110,255' : '90,210,255';
        const rot = now / (m.sub === 'matriz' ? 700 : 1100) + m.id;
        const r = TILE * (m.sub === 'matriz' ? 0.42 : 0.34);
        const gy = (m.pos.y + 0.55) * TILE;
        const gl = g.createRadialGradient(cx, gy, 2, cx, gy, r * 1.2); gl.addColorStop(0, `rgba(${col},.35)`); gl.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gl; g.beginPath(); g.arc(cx, gy, r * 1.2, 0, 6.3); g.fill();
        g.save(); g.translate(cx, gy); g.scale(1, 0.62); g.rotate(rot);
        g.strokeStyle = `rgba(${col},.95)`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, 6.3); g.stroke();
        g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= (m.sub === 'matriz' ? 6 : 4); i++) { const a = (i / (m.sub === 'matriz' ? 6 : 4)) * 6.283; const px = Math.cos(a) * r * 0.8, py = Math.sin(a) * r * 0.8; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke();
        g.fillStyle = `rgba(${col},1)`; for (let i = 0; i < 4; i++) { const a = i * 1.571; g.fillRect(Math.cos(a) * r - 2, Math.sin(a) * r - 2, 4, 4); }
        g.restore();
      } else if (m.kind === 'inertia') {
        g.fillStyle = `rgba(80,170,255,${(0.12 + 0.05 * Math.sin(now / 400)).toFixed(3)})`; g.fillRect(m.pos.x * TILE + 2, m.pos.y * TILE + 2, TILE - 4, TILE - 4);
        g.strokeStyle = 'rgba(140,210,255,.45)'; g.setLineDash([4, 4]); g.strokeRect(m.pos.x * TILE + 3, m.pos.y * TILE + 3, TILE - 6, TILE - 6); g.setLineDash([]);
      } else if (m.kind === 'smoke') {
        for (let i = 0; i < 4; i++) { const a = now / 900 + i * 1.6 + m.id; g.fillStyle = 'rgba(150,120,190,.32)'; g.beginPath(); g.arc(cx + Math.cos(a) * 9, (m.pos.y + 0.5) * TILE + Math.sin(a) * 6, TILE * 0.24, 0, 6.3); g.fill(); }
      } else if (m.kind === 'omen') {
        // G3.1: ataque anunciado del jefe: casilla roja que late; estalla al empezar su siguiente turno
        const X = m.pos.x * TILE, Y = m.pos.y * TILE, a = 0.22 + 0.14 * Math.sin(now / 160 + m.id);
        g.fillStyle = `rgba(255,40,40,${a.toFixed(3)})`; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.strokeStyle = 'rgba(255,90,70,.9)'; g.lineWidth = 2; g.strokeRect(X + 3, Y + 3, TILE - 6, TILE - 6);
        g.save(); g.beginPath(); g.rect(X + 3, Y + 3, TILE - 6, TILE - 6); g.clip();
        g.strokeStyle = 'rgba(255,120,90,.35)'; g.lineWidth = 2;
        for (let k = -TILE; k < TILE; k += 10) { g.beginPath(); g.moveTo(X + k, Y + TILE); g.lineTo(X + k + TILE, Y); g.stroke(); }
        g.restore();
        g.save(); g.fillStyle = '#ffe0d0'; g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText('!', cx, cy + 6); g.restore();
        continue;
      } else if (m.kind === 'fence') {
        // se dibuja como obstáculo (drawFence)
      } else {
        g.strokeStyle = '#c8c8ff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, TILE * 0.2, 0, 6.3); g.stroke();
      }
      if (m.kind !== 'inertia' && m.kind !== 'smoke' && m.kind !== 'fence' && m.kind !== 'gravglyph') { g.fillStyle = '#f0d8ff'; g.font = 'bold 11px monospace'; g.fillText(String(m.turns), m.pos.x * TILE + TILE - 14, m.pos.y * TILE + 14); }
    }
    this.ground();
    for (const t of c.snares ?? []) {
      // los cepos rivales no se ven
      if (me0 && t.team !== me0.team) continue;
      const [x, y] = t.k.split(',').map(Number) as [number, number];
      if (t.burn) {
        // mina de proximidad: disco metálico con luces rojas
        const mx = (x + 0.5) * TILE, my = (y + 0.6) * TILE;
        g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(mx, my, TILE * 0.24, TILE * 0.14, 0, 0, 6.3); g.fill();
        g.fillStyle = '#4a4a54'; g.beginPath(); g.ellipse(mx, my - 3, TILE * 0.17, TILE * 0.09, 0, 0, 6.3); g.fill();
        const on = Math.sin(now / 200) > 0;
        g.fillStyle = on ? '#ff3a3a' : '#7a1a1a'; for (const dx of [-8, 0, 8]) g.fillRect(mx + dx - 1.5, my + 1, 3, 3);
        continue;
      }
      g.strokeStyle = '#d8b060'; g.lineWidth = 3; g.beginPath(); g.arc((x + 0.5) * TILE, (y + 0.6) * TILE, TILE * 0.26, 0, 6.3); g.stroke();
      g.fillStyle = '#d8b060'; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.fillRect((x + 0.5) * TILE + Math.cos(a) * TILE * 0.26 - 2, (y + 0.6) * TILE + Math.sin(a) * TILE * 0.26 - 2, 4, 4); }
    }
    for (const k of c.traps ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      // púas: placa hundida con borde rojo encendido y pinchos con brillo
      g.fillStyle = '#1a0c10'; g.fillRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
      g.strokeStyle = `rgba(255,80,70,${0.55 + 0.25 * Math.sin(now / 240 + x + y)})`; g.lineWidth = 2; g.strokeRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const px = x * TILE + 12 + i * 13, py = y * TILE + 15 + j * 13;
        g.fillStyle = '#8a8098'; g.beginPath(); g.moveTo(px, py + 5); g.lineTo(px + 4, py - 6); g.lineTo(px + 8, py + 5); g.fill();
        g.fillStyle = '#f0ecff'; g.fillRect(px + 3, py - 4, 2, 4);
      }
    }
    const me = this.session.myUnit();
    const cur = current(c);
    const fill = (p: Pos, color: string): void => { g.fillStyle = color; g.fillRect(p.x * TILE + 3, p.y * TILE + 3, TILE - 6, TILE - 6); };
    if (c.deploy) {
      // casillas de inicio: azules y con pulso, bien visibles (al estilo Dofus)
      const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 300);
      for (const k of c.deploy.cells) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        fill({ x, y }, `rgba(60,140,255,${(0.28 * pulse + 0.12).toFixed(3)})`);
        g.strokeStyle = `rgba(150,200,255,${pulse.toFixed(3)})`; g.lineWidth = 2; g.strokeRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
        g.fillStyle = 'rgba(210,235,255,.85)'; g.beginPath(); g.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 3, 0, Math.PI * 2); g.fill();
      }
      if (me) { g.strokeStyle = '#5fcf70'; g.lineWidth = 3; g.strokeRect(me.pos.x * TILE + 2, me.pos.y * TILE + 2, TILE - 4, TILE - 4); }
    }
    if (me && cur?.id === me.id && !c.over) {
      const def = this.sel ? spellOf(me, this.sel) : undefined;
      if (def) {
        for (let y = 0; y < c.h; y++)
          for (let x = 0; x < c.w; x++) {
            const p = { x, y }, d = dist(me.pos, p);
            // el alcance extra (Ojo de halcón y similares) cuenta en cuanto se aplica
            const reach = def.range[1] + (def.range[1] > 1 ? me.statuses.reach?.stacks ?? 0 : 0);
            if (d < def.range[0] || d > reach || c.obstacles.includes(`${x},${y}`)) continue;
            // solo las casillas que respetan la geometría del hechizo: línea recta y línea de visión
            if (def.straight && d > 0 && x !== me.pos.x && y !== me.pos.y) continue;
            if (def.los && d > 1 && !hasLineOfSight(c, me.pos, p)) continue;
            fill(p, 'rgba(255,150,60,.18)');
            if (!castProblem(c, me, SPELLS[def.id]!, p)) { g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.strokeRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8); }
          }
        if (this.hover && def.cone && !castProblem(c, me, SPELLS[def.id]!, this.hover)) for (const p of coneCells(me.pos, this.hover, def.cone)) if (!c.obstacles.includes(`${p.x},${p.y}`)) fill(p, 'rgba(255,60,60,.25)');
        if (this.hover && def.area) {
          for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if ((def.square ? Math.max(Math.abs(x - this.hover.x), Math.abs(y - this.hover.y)) : dist({ x, y }, this.hover)) <= def.area) fill({ x, y }, 'rgba(255,60,60,.2)');
        }
      } else {
        const reach = reachable(c, me.pos, usableMp(c, me));
        for (const [k, cost] of reach.cost) {
          if (!cost) continue;
          const [x, y] = k.split(',').map(Number) as [number, number];
          fill({ x, y }, 'rgba(120,255,170,.24)');
          // borde iluminado en el contorno de la zona de movimiento
          g.strokeStyle = 'rgba(200,255,215,.95)'; g.lineWidth = 3;
          const edge = (nx: number, ny: number): boolean => !reach.cost.has(`${nx},${ny}`) && !(nx === me.pos.x && ny === me.pos.y);
          g.beginPath();
          if (edge(x, y - 1)) { g.moveTo(x * TILE + 1, y * TILE + 1); g.lineTo((x + 1) * TILE - 1, y * TILE + 1); }
          if (edge(x, y + 1)) { g.moveTo(x * TILE + 1, (y + 1) * TILE - 1); g.lineTo((x + 1) * TILE - 1, (y + 1) * TILE - 1); }
          if (edge(x - 1, y)) { g.moveTo(x * TILE + 1, y * TILE + 1); g.lineTo(x * TILE + 1, (y + 1) * TILE - 1); }
          if (edge(x + 1, y)) { g.moveTo((x + 1) * TILE - 1, y * TILE + 1); g.lineTo((x + 1) * TILE - 1, (y + 1) * TILE - 1); }
          g.stroke();
          // zona de placaje: salir de aquí costará PM (rojo translúcido)
          if (c.units.some((o) => o.team !== me.team && o.hp > 0 && o.ai !== 'pillar' && (o.tackle ?? 0) > 0 && !o.statuses.invis && Math.abs(o.pos.x - x) + Math.abs(o.pos.y - y) === 1)) fill({ x, y }, 'rgba(220,60,50,.16)');
        }
        // previsualización del camino: en rojo las casillas en las que el placaje te quitará PM al salir
        const pv = this.hover ? movePreview(c, me, this.hover) : null;
        if (pv) {
          for (const t of pv.tackled) { fill(t, 'rgba(230,50,50,.45)'); g.strokeStyle = '#ff4a4a'; g.lineWidth = 2; g.strokeRect(t.x * TILE + 4, t.y * TILE + 4, TILE - 8, TILE - 8); }
          const pts = [me.pos, ...pv.path];
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1]!, b = pts[i]!, cut = i > pv.stop;
            g.strokeStyle = cut ? 'rgba(255,74,74,.7)' : pv.tackled.length ? '#ff7a5a' : '#8fd0ff';
            g.lineWidth = 4; g.setLineDash(cut ? [6, 6] : []);
            g.beginPath(); g.moveTo(a.x * TILE + TILE / 2, a.y * TILE + TILE / 2); g.lineTo(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2); g.stroke();
          }
          g.setLineDash([]);
          if (pv.stop < pv.path.length) { const e = pv.path[Math.max(0, pv.stop - 1)] ?? me.pos; g.fillStyle = '#ff4a4a'; g.font = 'bold 14px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText('✋', e.x * TILE + TILE / 2, e.y * TILE + 16); }
        }
      }
    }
    if (this.hover) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(this.hover.x * TILE + 2, this.hover.y * TILE + 2, TILE - 4, TILE - 4); }

    const heroIdx = teamIdx(c);
    // 2.5D: muros y braseros se dibujan por filas junto a las unidades, para que lo de delante tape lo de detrás
    const fences = new Set((c.marks ?? []).filter((m) => m.kind === 'fence').map((m) => `${m.pos.x},${m.pos.y}`));
    // profundidad: en plano, por filas; en isométrico, por diagonales (x + y)
    const depth = (p: Pos): number => (this.iso ? p.x + p.y : p.y);
    const props = [...c.obstacles].map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y, brazier: (c.braziers ?? []).includes(k), fence: fences.has(k) }; }).sort((a, b) => depth(a) - depth(b) || a.x - b.x);
    let pi = 0;
    const flushProps = (row: number): void => {
      while (pi < props.length && depth(props[pi]!) <= row) {
        const p = props[pi++]!;
        // en isométrico, un muro que tapa a alguien que está justo detrás se vuelve translúcido
        g.globalAlpha = this.iso && c.units.some((u) => alive(u) && (() => { const d = p.x - u.pos.x + (p.y - u.pos.y); return d >= 1 && d <= 4 && Math.abs(p.x - p.y - (u.pos.x - u.pos.y)) <= 1; })()) ? 0.42 : 1;
        const isoPillar = this.iso && zone === ZONES[0] ? pick(ISO1.pillars, p.x, p.y) : null;
        if (this.iso && !p.brazier && !p.fence && ready(isoPillar)) { this.screen(); this.drawIsoProp(c, isoPillar, p.x, p.y); g.globalAlpha = 1; continue; }
        if (this.iso && !p.brazier && !p.fence && !(zone === ZONES[0] && ready(Z1.pillar))) { this.screen(); this.drawIsoBlock(c, zone, p.x, p.y); g.globalAlpha = 1; continue; }
        this.upright(p.x, p.y);
        if (p.brazier) this.drawBrazier(p.x, p.y, now); else if (p.fence) this.drawFence(p.x, p.y, now); else this.drawWall(c, zone, p.x, p.y);
        g.globalAlpha = 1;
      }
    };
    for (const u of c.units.filter(alive).sort((a, b) => depth(a.pos) - depth(b.pos))) {
      flushProps(depth(u.pos));
      // posición mostrada: se acerca suavemente a la real
      const s = this.shown.get(u.id) ?? { ...u.pos };
      s.x += (u.pos.x - s.x) * 0.25; s.y += (u.pos.y - s.y) * 0.25;
      if (Math.abs(u.pos.x - s.x) < 0.02) s.x = u.pos.x;
      if (Math.abs(u.pos.y - s.y) < 0.02) s.y = u.pos.y;
      this.shown.set(u.id, s);
      this.upright(s.x, s.y);
      const cx = (s.x + 0.5) * TILE, by = (s.y + 1) * TILE - 6;
      if (cur?.id === u.id) { g.strokeStyle = u.team === 'hero' ? '#f2c14e' : '#e0475b'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.36, 8, 0, 0, 6.3); g.stroke(); }
      // sombra bajo los pies (más oscura en el centro)
      const sh = g.createRadialGradient(cx, by - 1, 1, cx, by - 1, TILE * 0.36);
      sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(cx, by - 1, TILE * 0.36, 9, 0, 0, 6.3); g.fill();
      const moving = s.x !== u.pos.x || s.y !== u.pos.y;
      const model = isModel(lookKind(u));
      // modelos animados: hechizo en curso, andar o reposo (sin el balanceo de los sprites antiguos)
      let anim: Anim = 'idle', frame = Math.floor(now / 220 + u.id) % ANIM_FRAMES.idle;
      if (model) {
        const ac = this.acts.get(u.id), ak = ac ? (now - ac.t0) / ACT_MS : 1;
        if (ac && ak < 1) { anim = ac.anim; frame = Math.floor(ak * ANIM_FRAMES[anim]); }
        else if (moving) { anim = 'walk'; frame = Math.floor(now / 110) % ANIM_FRAMES.walk; }
        // anillo con el color del jugador (los modelos tienen colores propios)
        if (u.team === 'hero' && u.summoner === undefined) { const pc = PLAYER_COLORS[(heroIdx.get(u.id) ?? 0) % 4]!; g.strokeStyle = pc.b; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.33, 7, 0, 0, 6.3); g.stroke(); }
      }
      const bob = model ? 0 : moving ? -Math.abs(Math.sin(now / 70)) * 5 : Math.sin(now / 260 + u.id) * 1.5;
      const lg = this.lunge.get(u.id);
      const lk = lg ? (now - lg.t0) / LUNGE_MS : 1;
      const swing = lk < 1 ? Math.sin(lk * Math.PI) : 0;
      const def0 = u.team === 'hero';
      const sp0 = this.spins.get(u.id), spk = sp0 === undefined ? 1 : (now - sp0) / SPIN_MS;
      // durante el giro mira alternativamente a cada lado
      const left = spk < 1 ? Math.floor(spk * 6) % 2 === 0 : this.faceLeft.get(u.id) ?? !def0;
      // aura: la siguiente habilidad de daño de la Zorra la curará (Robo de esencia lleno)
      if (u.essence !== undefined && u.essence >= essenceNeed(u)) {
        const k = 0.5 + 0.5 * Math.sin(now / 180);
        const gr = g.createRadialGradient(cx, by - TILE * 0.35, 4, cx, by - TILE * 0.35, TILE * 0.62);
        gr.addColorStop(0, `rgba(255,120,200,${0.35 + 0.2 * k})`); gr.addColorStop(1, 'rgba(255,120,200,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, by - TILE * 0.35, TILE * 0.62, 0, 6.3); g.fill();
        g.strokeStyle = `rgba(255,170,220,${0.6 + 0.3 * k})`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.38, 9, 0, 0, 6.3); g.stroke();
      }
      // Furia alta: el Bárbaro arde
      if ((u.fury ?? 0) >= 60) { g.fillStyle = `rgba(255,70,30,${0.12 + ((u.fury ?? 0) / 100) * 0.18})`; g.beginPath(); g.arc(cx, by - TILE * 0.4, TILE * 0.5, 0, 6.3); g.fill(); }
      // cosméticos del jugador (solo apariencia): aura bajo los pies y variante de color de su héroe
      const look = u.team === 'hero' && u.summoner === undefined ? lookOf(u.owner) : undefined;
      const aura = auraDef(look?.aura);
      if (aura && !u.statuses.invis) drawAura(g, aura, cx, by - 2, TILE * 0.36, 8, now);
      drawUnit(g, lookKind(u), u.team, heroIdx.get(u.id) ?? 0, cx + (lg ? lg.dx * swing * TILE * 0.3 : 0), by + bob + (lg ? lg.dy * swing * TILE * 0.3 : 0), Math.round(TILE * 1.18),
        { flash: (this.flash.get(u.id) ?? 0) > now, swing, flip: def0 ? left : !left, alpha: u.statuses.invis ? 0.4 : u.ai === 'decoy' ? 0.55 : 1, anim, frame, skin: look?.cls === u.kind ? look.skin : undefined });
      // Marca de la muerte: calavera con el daño guardado
      const dmk = u.statuses.deathmark;
      if (dmk) {
        const mx = cx + TILE * 0.32, my = s.y * TILE + 18;
        g.fillStyle = '#1a0610'; g.fillRect(mx - 9, my - 9, 18 + String(dmk.stacks).length * 7, 16);
        g.fillStyle = '#ff3a4a'; g.font = 'bold 12px ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(`☠${dmk.stacks}`, mx - 7, my + 3);
      }
      this.bars(u, cx, s.y * TILE - 8, heroIdx.get(u.id));
    }
    flushProps(this.iso ? c.w + c.h : c.h);
    // caídos: se desvanecen hacia arriba
    this.ghosts = this.ghosts.filter((d) => now - d.t0 < (isModel(d.kind) ? DEATH_MS : 600));
    for (const d of this.ghosts) {
      if (isModel(d.kind)) {
        // modelos animados: animación de muerte y luego se desvanecen
        const k = (now - d.t0) / DEATH_MS;
        this.upright(d.x, d.y);
        drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6, TILE, { anim: 'death', frame: Math.min(ANIM_FRAMES.death - 1, Math.floor(k * 1.4 * ANIM_FRAMES.death)), alpha: k < 0.7 ? 1 : (1 - k) / 0.3 });
        continue;
      }
      const k = (now - d.t0) / 600;
      this.upright(d.x, d.y);
      drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6 - k * 14, TILE, { alpha: 1 - k, flash: k < 0.3 });
    }
    this.ground();
    // ondas: un aro que se abre; los giros, un tajo en arco que da la vuelta
    this.rings = this.rings.filter((r) => now - r.t0 < r.dur);
    for (const r of this.rings) {
      if (now < r.t0) continue;
      const k = (now - r.t0) / r.dur;
      g.globalAlpha = 1 - k; g.strokeStyle = r.color;
      if (r.spin) {
        const a0 = -Math.PI / 2 + k * Math.PI * 2;
        for (let i = 0; i < 3; i++) { g.lineWidth = 6 - i * 2; g.beginPath(); g.ellipse(r.x, r.y, r.r * (0.7 + i * 0.12), r.r * (0.45 + i * 0.08), 0, a0 - 1.6 + i * 0.3, a0); g.stroke(); }
      } else { g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, r.r * (0.2 + k * 0.8), 0, 6.3); g.stroke(); }
      g.globalAlpha = 1;
    }
    // proyectiles con estela
    this.shots = this.shots.filter((p) => now - p.t0 < p.dur);
    for (const p of this.shots) {
      if (now < p.t0) continue;
      if (p.orb) {
        // orbe brillante: halo, núcleo blanco y una estela de chispas
        const k = (now - p.t0) / p.dur, x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k;
        for (let i = 1; i <= 4; i++) { const kk = Math.max(0, k - i * 0.06); g.globalAlpha = 0.5 - i * 0.1; g.fillStyle = p.color; g.beginPath(); g.arc(p.x0 + (p.x1 - p.x0) * kk, p.y0 + (p.y1 - p.y0) * kk, 7 - i, 0, 6.3); g.fill(); }
        g.globalAlpha = 0.35; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, 14, 0, 6.3); g.fill();
        g.globalAlpha = 1; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, 8, 0, 6.3); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 1, y - 1, 4, 0, 6.3); g.fill();
        continue;
      }
      for (let i = 4; i >= 0; i--) {
        const k = Math.max(0, (now - p.t0) / p.dur - i * 0.05);
        g.globalAlpha = 1 - i * 0.2; g.fillStyle = i ? p.color : '#fff';
        const sz = 10 - i * 1.5;
        g.fillRect(p.x0 + (p.x1 - p.x0) * k - sz / 2, p.y0 + (p.y1 - p.y0) * k - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;
    }
    // H6: efectos de habilidades (recetas)
    this.fx.draw(g, now);
    // luz de antorchas en las esquinas y viñeta
    if (this.iso) this.screen();
    const W = this.iso ? size.w : c.w * TILE, H = this.iso ? size.h : c.h * TILE, fl = 0.1 + 0.03 * Math.sin(now / 130);
    for (const [lx, ly] of (this.isoFloor && this.torches.length ? [] : [[0, 0], [W, 0], [0, H], [W, H]]) as Array<readonly [number, number]>) {
      const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 280);
      gr.addColorStop(0, `rgba(${zone.light},${fl})`); gr.addColorStop(1, `rgba(${zone.light},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.floats = this.floats.filter((f) => now - f.t0 < 1100);
    g.font = 'bold 16px ui-monospace, monospace'; g.textAlign = 'center';
    for (const f of this.floats) {
      const k = (now - f.t0) / 1100;
      if (this.iso) { this.upright(Math.floor(f.x / TILE), Math.floor(f.y / TILE)); g.font = 'bold 16px ui-monospace, monospace'; g.textAlign = 'center'; }
      g.globalAlpha = 1 - k * k; g.lineWidth = 4; g.strokeStyle = '#000';
      g.strokeText(f.text, f.x, f.y - k * 30); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - k * 30);
    }
    g.globalAlpha = 1;
    if (this.hover) { if (this.iso) this.screen(); else this.ground(); this.tooltip(c); }
    // táctil: recordatorio de que el segundo toque confirma
    if (this.touch && this.session.isMyTurn() && !c.over && (this.hover || this.sel)) {
      const d = this.sel && me ? spellOf(me, this.sel) : undefined;
      const g = this.g, txt = this.hover ? (this.sel ? 'Toca otra vez la casilla para lanzar' : 'Toca otra vez la casilla para moverte') : `${d?.name ?? ''}: toca una casilla iluminada`;
      g.font = 'bold 16px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center';
      if (this.iso) this.screen();
      const w = g.measureText(txt).width + 24, X = this.iso ? size.w / 2 : (c.w * TILE) / 2;
      // el aviso va abajo, salvo que tape la casilla que estás mirando
      const Y = this.iso ? size.h - 14 : this.hover && this.hover.y >= c.h - 2 ? 26 : c.h * TILE - 14;
      g.fillStyle = 'rgba(10,8,6,.85)'; g.fillRect(X - w / 2, Y - 18, w, 26);
      g.strokeStyle = '#e3b04b'; g.lineWidth = 2; g.strokeRect(X - w / 2, Y - 18, w, 26);
      g.fillStyle = '#ffe2a0'; g.fillText(txt, X, Y);
    }
    // señales tácticas: anillo que pulsa con el color y el nombre de quien marca
    const tnow = Date.now();
    this.pings = this.pings.filter((p) => tnow - p.at < 4000);
    for (const p of this.pings) {
      this.upright(p.x, p.y);
      const t = (tnow - p.at) / 1000, cx = (p.x + 0.5) * TILE, cy = (p.y + 0.5) * TILE;
      for (let r = 0; r < 2; r++) { const k = ((t * 1.3 + r * 0.5) % 1); g.strokeStyle = p.col; g.globalAlpha = 1 - k; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 8 + k * TILE * 0.6, 0, 6.3); g.stroke(); }
      g.globalAlpha = 1;
      g.fillStyle = p.col; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx - 9, cy - 24); g.lineTo(cx + 9, cy - 24); g.closePath(); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke();
      g.font = 'bold 10px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeText(`❗ ${p.name}`, cx, cy - 28); g.fillStyle = '#fff'; g.fillText(`❗ ${p.name}`, cx, cy - 28);
    }
  }

  /** el último toque fue con el dedo (o lápiz) y no con el ratón */
  private touch = false;

  /** se pueden ocultar las barras de vida (botón ❤️ o tecla V) */
  showBars = true;

  private bars(u: Unit, cx: number, top: number, heroIdx: number | undefined): void {
    const g = this.g, w = TILE - 14, x = cx - w / 2;
    if (this.showBars) {
    // barra con borde de hierro, vida actual/total centrada y la vida que falta en rojo oscuro
    const bh = 10;
    g.fillStyle = '#0a0806'; g.fillRect(x - 2, top - 2, w + 4, bh + 4);
    g.fillStyle = '#5d544b'; g.fillRect(x - 1, top - 1, w + 2, bh + 2);
    g.fillStyle = '#2a0f0c'; g.fillRect(x, top, w, bh);
    // el escudo va en azul a continuación de la vida (si la supera, la barra se escala)
    const total = Math.max(u.maxHp, u.hp + u.shield);
    const hw = Math.max(0, (w * u.hp) / total);
    g.fillStyle = u.team === 'hero' ? '#3f9a4a' : '#c23b3b'; g.fillRect(x, top, hw, bh);
    g.fillStyle = u.team === 'hero' ? '#6fd07a' : '#ef6a5e'; g.fillRect(x, top, hw, 3);
    if (u.shield > 0) { const sw = Math.max(2, (w * u.shield) / total); g.fillStyle = '#2f7fe0'; g.fillRect(x + hw, top, sw, bh); g.fillStyle = '#8cc8ff'; g.fillRect(x + hw, top, sw, 3); g.fillStyle = '#d8ecff'; g.fillRect(x + hw, top, 1, bh); }
    g.font = 'bold 9px "Pixelify Sans", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = `${u.hp}/${u.maxHp}`;
    const lx = u.shield > 0 ? cx - 8 : cx;
    g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(label, lx, top + bh / 2 + 0.5);
    g.fillStyle = '#fff'; g.fillText(label, lx, top + bh / 2 + 0.5);
    if (u.shield > 0) { const sl = `+${u.shield}`; const sx = lx + g.measureText(label).width / 2 + 3 + g.measureText(sl).width / 2; g.strokeText(sl, sx, top + bh / 2 + 0.5); g.fillStyle = '#9fd4ff'; g.fillText(sl, sx, top + bh / 2 + 0.5); }
    g.textBaseline = 'alphabetic';
    if (u.fury !== undefined) { g.fillStyle = '#000'; g.fillRect(x - 1, top - 6, w + 2, 5); g.fillStyle = '#ff6a20'; g.fillRect(x, top - 5, (w * u.fury) / 100, 3); }
    if (u.essence !== undefined) for (let i = 0; i < essenceNeed(u); i++) { g.fillStyle = i < u.essence ? '#ff8ad0' : '#3a2040'; g.fillRect(x + i * 7, top - 6, 5, 4); }
    }
    let ix = x;
    for (const k of Object.keys(u.statuses)) { g.fillStyle = STATUS_COLOR[k] ?? '#fff'; g.fillRect(ix, top + 14, 6, 6); ix += 8; }
    if (heroIdx !== undefined) {
      g.font = '12px ui-monospace, monospace'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(u.name, cx, top + TILE - 2);
      g.fillStyle = u.team === 'hero' ? PLAYER_COLORS[heroIdx % 4]!.b : '#e8a0b0'; g.fillText(u.name.replace('Némesis: ', '☠ '), cx, top + TILE - 2);
    }
  }

  private tooltip(c: CombatState): void {
    const h = this.hover!;
    const u = c.units.find((x) => alive(x) && x.pos.x === h.x && x.pos.y === h.y);
    if (!u) return;
    const g = this.g;
    const st = [...Object.entries(u.statuses).map(([k, v]) => `${STATUS_NAME[k]} ${v!.turns}${k === 'deathmark' ? ` (guarda ${v!.stacks})` : ''}`), ...(u.essence !== undefined ? [`Esencia ${u.essence}/${essenceNeed(u)}${u.essence >= essenceNeed(u) ? ' ¡cura!' : ''}`] : []), ...(u.souls !== undefined ? [`Almas ${u.souls} (${u.soulBank ?? 0} para gastar)`] : []), ...(u.fury !== undefined ? [`Furia ${u.fury}: +${furyPower(u)}% daño, +${furyCrit(u)}% crít.`] : [])].join(', ');
    const res = !FEATURES.resistances ? '' : Object.entries(u.resist ?? {}).filter(([, v]) => v).map(([k, v]) => (v! > 0 ? `Resiste ${ELEMENT_NAME[k]} ${v}%` : `Débil a ${ELEMENT_NAME[k]} ${-v!}%`)).join(' · ');
    // daño estimado del hechizo elegido sobre esta unidad
    let est = '';
    const me = this.session.myUnit();
    const def = me && this.sel ? spellOf(me, this.sel) : undefined;
    if (me && def?.dmg && u.team !== me.team) {
      const res = FEATURES.resistances && def.element ? Math.min(75, u.resist[def.element] ?? 0) : 0;
      const school = me.team === 'hero' ? (schoolOf(me.kind) === 'magic' ? me.powerMagic ?? 0 : me.powerPhys ?? 0) : 0;
      // daño plano: fijo del hechizo + daño del personaje y de su tipo + potenciado + Marcado/Vulnerable − armadura
      const bonus = me.power + school + (me.statuses.empower?.stacks ?? 0) + (u.statuses.mark ? 2 : 0) + (u.statuses.vuln ? 2 : 0) + (u.statuses.frenzy ? 1 : 0);
      const arm = def.pierce ? 0 : Math.max(0, u.armor - (u.statuses.exposed?.stacks ?? 0));
      const v = Math.max(1, Math.round((def.dmg[0] + bonus) * (1 - res / 100)) - arm);
      const crit = Math.max(1, Math.round((def.dmg[0] + bonus + CRIT_FLAT) * (1 - res / 100)) - arm);
      est = `${def.name}: ${v} de daño (crítico ${crit})${v >= u.hp + u.shield ? ' · ¡LO MATA!' : crit >= u.hp + u.shield ? ' · lo mata con crítico' : ''}`;
    }
    // PA y PM: los de ahora si es su turno; si no, los que tendrá en su próximo turno (con lo que le han quitado)
    const isCur = current(c)?.id === u.id;
    const apNow = isCur ? u.ap : Math.max(0, u.maxAp + u.apMod);
    const mpNow = isCur ? u.mp : Math.max(0, u.maxMp + u.mpMod - (u.statuses.slow?.stacks ?? 0));
    const armorNow = Math.max(0, u.armor - (u.statuses.exposed?.stacks ?? 0));
    const tk = me && u.team !== me.team && u.ai !== 'pillar' ? ` · Placaje ${u.tackle ?? 0}` : '';
    const L: Array<[string, string]> = [];
    if (est) L.push([est, '#f2c14e']);
    L.push([`${u.name}  ${u.hp}/${u.maxHp} PV${u.shield ? `  escudo ${u.shield}` : ''}`, '#e8e0f5']);
    if (u.rank) L.push([`${u.rank === 'boss' ? 'Jefe' : 'Élite'}: inmune a aturdir · resiste PA/PM y empujones`, '#c9a0ff']);
    L.push([`PA ${apNow}${apNow !== u.maxAp ? `/${u.maxAp}` : ''}${isCur ? '' : ' (próx. turno)'}`, apNow < u.maxAp ? '#f2c14e' : '#9a8fb5']);
    L.push([`PM ${mpNow}${mpNow !== u.maxMp ? `/${u.maxMp}` : ''}${mpNow < u.maxMp ? ` (−${u.maxMp - mpNow})` : ''}`, mpNow < u.maxMp ? '#58a6ff' : '#9a8fb5']);
    L.push([`Armadura ${armorNow}${armorNow !== u.armor ? ` (−${u.armor - armorNow})` : ''} · Huida ${u.dodge ?? 0}${tk}`, '#9a8fb5']);
    if (res) L.push([res, '#9a8fb5']);
    if (st) L.push([st, '#9a8fb5']);
    const lines = L.map((l) => l[0]);
    g.font = '14px ui-monospace, monospace'; g.textAlign = 'left';
    const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 14, hh = lines.length * 18 + 8;
    let x = Math.min(c.w * TILE - w - 4, (h.x + 1) * TILE), y = Math.max(4, Math.min(c.h * TILE - hh - 4, h.y * TILE - 10));
    if (this.iso) {
      // en isométrico la ventana va junto al rombo, en coordenadas de pantalla
      const p = isoPoint(h.x + 1, h.y, c.h);
      x = Math.max(4, Math.min(this.canvas.width - w - 4, p.x + 10)); y = Math.max(4, Math.min(this.canvas.height - hh - 4, p.y - 90));
    }
    g.fillStyle = 'rgba(10,6,20,.93)'; g.fillRect(x, y, w, hh); g.strokeStyle = '#3b2f57'; g.lineWidth = 2; g.strokeRect(x, y, w, hh);
    L.forEach(([l, col], i) => { g.fillStyle = col; g.fillText(l, x + 7, y + 18 + i * 18); });
  }
}
