import { FEATURES, schoolOf } from '../core/tuning';
import { SPELLS } from '../core/classes/spells';
// Tablero de combate: dibuja el estado y convierte clics en acciones.
import { ZONES } from '../content/zones';
import { castProblem, current, essenceNeed, furyCrit, furyPower, movePreview, spellOf, usableMp } from '../core/combat/engine';
import { coneCells } from '../core/combat/marks';
import { alive, dist, hasLineOfSight, reachable } from '../core/combat/grid';
import type { CombatState, GameEvent, Pos, Unit } from '../core/state';
import type { Session } from '../game/session';
import { PLAYER_COLORS, drawUnit, isModel } from './sprites';
import { ANIM_FRAMES, animFor, type Anim } from './models';

const TILE = 56;
const STATUS_COLOR: Record<string, string> = { burn: '#ff8a30', poison: '#7fe05a', slow: '#8ae0ff', stun: '#ffe84a', mark: '#ff5ad0', charm: '#ff9ad8', vuln: '#c9a0ff', bleed: '#e03040', hobble: '#9ad0e8', guarded: '#7fe0b0', deathmark: '#ff3a4a', verdugo: '#ff8a30', frenzy: '#ff5030', orbita: '#b07cff', chained: '#a0a8c0' };
export const STATUS_NAME: Record<string, string> = { burn: 'Quemadura', poison: 'Veneno', slow: 'Ralentizado', stun: 'Aturdido', mark: 'Marcado', empower: 'Potenciado', reach: 'Alcance+', invis: 'Invisible', exposed: 'Expuesto', charm: 'Encantado', vuln: 'Vulnerable', bleed: 'Sangrado', hobble: 'Atrapado', guarded: 'Protegido', deathmark: 'Marca de la muerte', verdugo: 'Presa', frenzy: 'Frenesí', orbita: 'Órbita', chained: 'Encadenado' };

interface Float { x: number; y: number; text: string; color: string; t0: number }
interface Shot { x0: number; y0: number; x1: number; y1: number; color: string; t0: number; dur: number; orb?: boolean }
/** Onda expansiva (esfera nueva, golpe giratorio) */
interface Ring { x: number; y: number; color: string; t0: number; dur: number; r: number; spin?: boolean }
/** golpes giratorios: el personaje (y su Sombra) dan una vuelta */
const SPIN_SPELLS = ['s_tajo', 'k_despellejar', 'z_colas', 'g_remolino', 'torbellino'];
const SPIN_MS = 420;
interface Ghost { kind: string; team: string; idx: number; x: number; y: number; t0: number }
const ELEMENT_COLOR: Record<string, string> = { fire: '#ff8a30', ice: '#8ae0ff', poison: '#7fe05a', shadow: '#b07cff', holy: '#ffe9a0' };
const ELEMENT_NAME: Record<string, string> = { fire: 'fuego', ice: 'hielo', poison: 'veneno', shadow: 'sombra', holy: 'sagrado' };
const LUNGE_MS = 240;
/** duración de las animaciones de hechizo de los modelos animados */
const ACT_MS = 480;
/** duración de la animación de muerte de los modelos animados */
const DEATH_MS = 900;

const CLASS_KINDS = ['guerrero', 'mago', 'clerigo', 'picaro', 'arquero', 'zorro', 'esferas', 'carcelero', 'acechador', 'barbaro'];
/** Índice de color y etiqueta: héroes de jugadores, y héroes rivales (némesis, duelos) dentro de su bando. */
function teamIdx(c: CombatState): Map<number, number> {
  const m = new Map<number, number>();
  for (const team of ['hero', 'enemy'] as const) c.units.filter((u) => u.team === team && CLASS_KINDS.includes(u.kind) && u.ai !== 'decoy').forEach((u, i) => m.set(u.id, i));
  return m;
}

export class Board {
  /** hechizo elegido, esperando objetivo */
  sel: string | null = null;
  onSelect: () => void = () => {};
  private g: CanvasRenderingContext2D;
  private hover: Pos | null = null;
  private shown = new Map<number, Pos>();
  private flash = new Map<number, number>();
  private floats: Float[] = [];
  private shots: Shot[] = [];
  private rings: Ring[] = [];
  private spins = new Map<number, number>();
  private ghosts: Ghost[] = [];
  private lunge = new Map<number, { t0: number; dx: number; dy: number }>();
  /** animación de hechizo en curso (modelos animados) */
  private acts = new Map<number, { t0: number; anim: Anim }>();
  private faceLeft = new Map<number, boolean>();
  private raf = 0;

  constructor(private canvas: HTMLCanvasElement, private session: Session) {
    this.g = canvas.getContext('2d')!;
    canvas.addEventListener('mousemove', (e) => (this.hover = this.cell(e)));
    canvas.addEventListener('mouseleave', () => (this.hover = null));
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.select(null); });
    canvas.addEventListener('click', (e) => this.click(this.cell(e)));
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
    const p = { x: Math.floor(((e.clientX - r.left) / r.width) * c.w), y: Math.floor(((e.clientY - r.top) / r.height) * c.h) };
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
          } else if (len > 1.5) this.shots.push({ x0: (from.x + 0.5) * TILE, y0: (from.y + 0.4) * TILE, x1: (e.at.x + 0.5) * TILE, y1: (e.at.y + 0.4) * TILE, color: ELEMENT_COLOR[e.element ?? ''] ?? '#ffe08a', t0: now, dur: Math.min(320, 90 + len * 35) });
        }
      } else if (e.t === 'move' && u && e.path.length) {
        const last = e.path[e.path.length - 1]!;
        if (from && last.x !== Math.round(from.x)) this.faceLeft.set(u.id, last.x < from.x);
      } else if (e.t === 'death' && u && from) {
        this.ghosts.push({ kind: u.kind, team: u.team, idx: heroIdx.get(u.id) ?? 0, x: from.x, y: from.y, t0: now });
      }
      if (e.t === 'damage') {
        this.flash.set(e.unit, now + 180);
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

  private draw(): void {
    const c = this.c;
    const g = this.g;
    if (!c) return;
    if (this.canvas.width !== c.w * TILE || this.canvas.height !== c.h * TILE) {
      this.canvas.width = c.w * TILE;
      this.canvas.height = c.h * TILE;
      this.shown.clear();
    }
    const now = performance.now();
    const zone = ZONES[this.session.run?.zone ?? 0] ?? ZONES[0]!;
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        g.fillStyle = zone.floor[(x + y) % 2]!;
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        g.fillStyle = 'rgba(0,0,0,.28)';
        g.fillRect(x * TILE, y * TILE, TILE, 2);
        g.fillRect(x * TILE, y * TILE, 2, TILE);
        // losas agrietadas y algún hueso, siempre en el mismo sitio
        const h = (x * 73856093) ^ (y * 19349663);
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.fillRect(x * TILE + 6 + (h & 31), y * TILE + 8 + ((h >> 5) & 31), 8, 3);
        g.fillRect(x * TILE + 10 + ((h >> 10) & 31), y * TILE + 12 + ((h >> 15) & 31), 3, 3);
        if ((h & 7) === 3) { g.fillStyle = zone.rock[2]; g.fillRect(x * TILE + 14 + ((h >> 8) & 15), y * TILE + 34, 10, 3); g.fillRect(x * TILE + 13 + ((h >> 8) & 15), y * TILE + 33, 2, 5); }
      }
    for (const k of c.obstacles) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const X = x * TILE, Y = y * TILE;
      g.fillStyle = '#120e1a'; g.fillRect(X + 5, Y + TILE - 14, TILE - 10, 10);
      g.fillStyle = zone.rock[0]; g.fillRect(X + 8, Y + 8, TILE - 16, TILE - 20);
      g.fillStyle = zone.rock[1]; g.fillRect(X + 8, Y + 8, TILE - 16, 7);
      g.fillStyle = zone.rock[2]; g.fillRect(X + TILE - 17, Y + 15, 9, TILE - 27);
    }
    const me0 = this.session.myUnit();
    for (const k of c.puddles ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      g.fillStyle = 'rgba(70,200,90,.38)'; g.beginPath(); g.ellipse((x + 0.5) * TILE, (y + 0.6) * TILE, TILE * 0.42, TILE * 0.28, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(190,255,150,.35)'; g.beginPath(); g.ellipse((x + 0.42) * TILE, (y + 0.55) * TILE, TILE * 0.14, TILE * 0.07, 0, 0, 6.3); g.fill();
    }
    // marcadores en el suelo (esferas oscuras…)
    for (const m of c.marks ?? []) {
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
      } else {
        g.strokeStyle = '#c8c8ff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, TILE * 0.2, 0, 6.3); g.stroke();
      }
      g.fillStyle = '#f0d8ff'; g.font = 'bold 11px monospace'; g.fillText(String(m.turns), m.pos.x * TILE + TILE - 14, m.pos.y * TILE + 14);
    }
    for (const t of c.snares ?? []) {
      // los cepos rivales no se ven
      if (me0 && t.team !== me0.team) continue;
      const [x, y] = t.k.split(',').map(Number) as [number, number];
      g.strokeStyle = '#d8b060'; g.lineWidth = 3; g.beginPath(); g.arc((x + 0.5) * TILE, (y + 0.6) * TILE, TILE * 0.26, 0, 6.3); g.stroke();
      g.fillStyle = '#d8b060'; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.fillRect((x + 0.5) * TILE + Math.cos(a) * TILE * 0.26 - 2, (y + 0.6) * TILE + Math.sin(a) * TILE * 0.26 - 2, 4, 4); }
    }
    for (const k of c.traps ?? []) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      g.fillStyle = '#3a1820'; g.fillRect(x * TILE + 6, y * TILE + 6, TILE - 12, TILE - 12);
      g.fillStyle = '#c9c0d8';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const px = x * TILE + 13 + i * 13, py = y * TILE + 15 + j * 13; g.beginPath(); g.moveTo(px, py + 5); g.lineTo(px + 4, py - 5); g.lineTo(px + 8, py + 5); g.fill(); }
    }
    const me = this.session.myUnit();
    const cur = current(c);
    const fill = (p: Pos, color: string): void => { g.fillStyle = color; g.fillRect(p.x * TILE + 3, p.y * TILE + 3, TILE - 6, TILE - 6); };
    if (c.deploy) {
      for (const k of c.deploy.cells) { const [x, y] = k.split(',').map(Number) as [number, number]; fill({ x, y }, 'rgba(95,207,112,.22)'); g.strokeStyle = 'rgba(95,207,112,.6)'; g.lineWidth = 1; g.strokeRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6); }
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
        for (const [k, cost] of reachable(c, me.pos, usableMp(c, me)).cost) {
          if (!cost) continue;
          const [x, y] = k.split(',').map(Number) as [number, number];
          fill({ x, y }, 'rgba(88,166,255,.2)');
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
    for (const u of c.units.filter(alive).sort((a, b) => a.pos.y - b.pos.y)) {
      // posición mostrada: se acerca suavemente a la real
      const s = this.shown.get(u.id) ?? { ...u.pos };
      s.x += (u.pos.x - s.x) * 0.25; s.y += (u.pos.y - s.y) * 0.25;
      if (Math.abs(u.pos.x - s.x) < 0.02) s.x = u.pos.x;
      if (Math.abs(u.pos.y - s.y) < 0.02) s.y = u.pos.y;
      this.shown.set(u.id, s);
      const cx = (s.x + 0.5) * TILE, by = (s.y + 1) * TILE - 6;
      if (cur?.id === u.id) { g.strokeStyle = u.team === 'hero' ? '#f2c14e' : '#e0475b'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.36, 8, 0, 0, 6.3); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, by - 2, TILE * 0.3, 6, 0, 0, 6.3); g.fill();
      const moving = s.x !== u.pos.x || s.y !== u.pos.y;
      const model = isModel(u.kind);
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
      drawUnit(g, u.kind, u.team, heroIdx.get(u.id) ?? 0, cx + (lg ? lg.dx * swing * TILE * 0.3 : 0), by + bob + (lg ? lg.dy * swing * TILE * 0.3 : 0), TILE,
        { flash: (this.flash.get(u.id) ?? 0) > now, swing, flip: def0 ? left : !left, alpha: u.statuses.invis ? 0.4 : u.ai === 'decoy' ? 0.55 : 1, anim, frame });
      // Marca de la muerte: calavera con el daño guardado
      const dmk = u.statuses.deathmark;
      if (dmk) {
        const mx = cx + TILE * 0.32, my = s.y * TILE + 18;
        g.fillStyle = '#1a0610'; g.fillRect(mx - 9, my - 9, 18 + String(dmk.stacks).length * 7, 16);
        g.fillStyle = '#ff3a4a'; g.font = 'bold 12px ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(`☠${dmk.stacks}`, mx - 7, my + 3);
      }
      this.bars(u, cx, s.y * TILE + 2, heroIdx.get(u.id));
    }
    // caídos: se desvanecen hacia arriba
    this.ghosts = this.ghosts.filter((d) => now - d.t0 < (isModel(d.kind) ? DEATH_MS : 600));
    for (const d of this.ghosts) {
      if (isModel(d.kind)) {
        // modelos animados: animación de muerte y luego se desvanecen
        const k = (now - d.t0) / DEATH_MS;
        drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6, TILE, { anim: 'death', frame: Math.min(ANIM_FRAMES.death - 1, Math.floor(k * 1.4 * ANIM_FRAMES.death)), alpha: k < 0.7 ? 1 : (1 - k) / 0.3 });
        continue;
      }
      const k = (now - d.t0) / 600;
      drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6 - k * 14, TILE, { alpha: 1 - k, flash: k < 0.3 });
    }
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
    // luz de antorchas en las esquinas y viñeta
    const W = c.w * TILE, H = c.h * TILE, fl = 0.1 + 0.03 * Math.sin(now / 130);
    for (const [lx, ly] of [[0, 0], [W, 0], [0, H], [W, H]] as const) {
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
      g.globalAlpha = 1 - k * k; g.lineWidth = 4; g.strokeStyle = '#000';
      g.strokeText(f.text, f.x, f.y - k * 30); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - k * 30);
    }
    g.globalAlpha = 1;
    if (this.hover) this.tooltip(c);
  }

  /** se pueden ocultar las barras de vida (botón ❤️ o tecla V) */
  showBars = true;

  private bars(u: Unit, cx: number, top: number, heroIdx: number | undefined): void {
    const g = this.g, w = TILE - 14, x = cx - w / 2;
    if (this.showBars) {
    g.fillStyle = '#000'; g.fillRect(x - 1, top - 1, w + 2, 7);
    g.fillStyle = u.team === 'hero' ? '#4cb85a' : '#e0475b'; g.fillRect(x, top, (w * u.hp) / u.maxHp, 5);
    if (u.shield > 0) { g.fillStyle = '#58a6ff'; g.fillRect(x, top + 5, Math.min(w, (w * u.shield) / u.maxHp), 3); }
    if (u.fury !== undefined) { g.fillStyle = '#000'; g.fillRect(x - 1, top - 6, w + 2, 5); g.fillStyle = '#ff6a20'; g.fillRect(x, top - 5, (w * u.fury) / 100, 3); }
    if (u.essence !== undefined) for (let i = 0; i < essenceNeed(u); i++) { g.fillStyle = i < u.essence ? '#ff8ad0' : '#3a2040'; g.fillRect(x + i * 7, top - 6, 5, 4); }
    }
    let ix = x;
    for (const k of Object.keys(u.statuses)) { g.fillStyle = STATUS_COLOR[k] ?? '#fff'; g.fillRect(ix, top + 9, 6, 6); ix += 8; }
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
      const f = (1 + (me.power + school + (me.statuses.empower?.stacks ?? 0)) / 100) * (u.statuses.mark ? 1.3 : 1) * (1 - res / 100);
      const arm = def.pierce ? 0 : Math.max(0, u.armor - (u.statuses.exposed?.stacks ?? 0));
      const lo = Math.max(1, Math.round(def.dmg[0] * f) - arm), hi = Math.max(1, Math.round(def.dmg[1] * f) - arm);
      est = `${def.name}: ${lo}-${hi} de daño${lo >= u.hp + u.shield ? ' · ¡LO MATA!' : hi >= u.hp + u.shield ? ' · puede matarlo' : ''}`;
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
    const x = Math.min(c.w * TILE - w - 4, (h.x + 1) * TILE), y = Math.max(4, Math.min(c.h * TILE - hh - 4, h.y * TILE - 10));
    g.fillStyle = 'rgba(10,6,20,.93)'; g.fillRect(x, y, w, hh); g.strokeStyle = '#3b2f57'; g.lineWidth = 2; g.strokeRect(x, y, w, hh);
    L.forEach(([l, col], i) => { g.fillStyle = col; g.fillText(l, x + 7, y + 18 + i * 18); });
  }
}
