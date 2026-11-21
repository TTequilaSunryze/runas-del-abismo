// Fase H6: efectos visuales de las habilidades con «recetas» por hechizo y primitivas reutilizables.
// Solo es presentación: no toca el estado del combate y usa Math.random (nada de esto se sincroniza).
//
// Una receta dice cómo se ve un hechizo: cómo viaja (línea, arco, haz o instantáneo), qué proyectil lleva, cómo impacta
// (estallido, anillo o tajo), si ilumina su área y cuánto tiembla la pantalla. Cada clase tiene una paleta y un proyectil
// propios (identidad visual) y cada hechizo puede afinar su receta en SPELL_FX. Lo que no está en SPELL_FX se deduce de
// la propia definición del hechizo (alcance, área, objetivo, elemento).
import type { SpellDef } from '../core/classes/spells';
import type { Pos } from '../core/state';

export type Travel = 'line' | 'arc' | 'beam' | 'instant' | 'none';
export type ProjKind = 'bolt' | 'arrow' | 'orb' | 'bullet' | 'blade' | 'chain' | 'spark';
export type Impact = 'burst' | 'ring' | 'slash' | 'none';

export interface FxRecipe {
  travel: Travel;
  proj: ProjKind;
  color: string;
  glow: string;
  impact: Impact;
  /** ilumina las casillas afectadas al impactar */
  area: boolean;
  /** partículas del impacto */
  particles: number;
  /** temblor de pantalla (píxeles) */
  shake: number;
  /** efecto sobre el lanzador (hechizos propios o de apoyo) */
  onSelf: 'aura' | 'burst' | 'none';
}

/** Paleta y proyectil de cada clase: la identidad visual de sus habilidades. */
export const CLASS_FX: Record<string, { color: string; glow: string; proj: ProjKind }> = {
  zorro: { color: '#4ad0ff', glow: '#e0f6ff', proj: 'orb' },
  esferas: { color: '#a070ff', glow: '#e8d8ff', proj: 'orb' },
  acechador: { color: '#8a4ad8', glow: '#ff5a6a', proj: 'blade' },
  carcelero: { color: '#5fc8b0', glow: '#e8fff8', proj: 'chain' },
  barbaro: { color: '#ff5a3a', glow: '#ffd8a0', proj: 'spark' },
  arquitecto: { color: '#5ac8ff', glow: '#e0fbff', proj: 'bolt' },
  pistolero: { color: '#b070ff', glow: '#ffd27a', proj: 'bullet' },
  arquero: { color: '#d8c080', glow: '#fff4c8', proj: 'arrow' },
};
const ELEMENT_FX: Record<string, string> = { fire: '#ff8a30', ice: '#8ae0ff', poison: '#7fe05a', shadow: '#b07cff', holy: '#ffe9a0' };

/** Ajustes por hechizo sobre la receta deducida (los principales de cada clase). */
export const SPELL_FX: Record<string, Partial<FxRecipe>> = {
  // Zorro
  z_encanto: { proj: 'spark', color: '#ff8ad8', impact: 'ring' }, z_vortice: { travel: 'arc', impact: 'ring', particles: 18 },
  z_estallido: { impact: 'burst', particles: 20, shake: 2 }, z_resguardo: { color: '#4ad0ff', impact: 'ring' },
  // Tejedora
  t_singularidad: { travel: 'arc', impact: 'ring', particles: 28, shake: 4, color: '#c060ff' }, t_vacio: { travel: 'beam', shake: 2 },
  t_descarga: { particles: 24, shake: 3 }, t_pozo: { travel: 'arc', impact: 'ring' }, t_eclipse: { impact: 'ring', color: '#5a3a9a' },
  // Acechador
  s_shuriken: { proj: 'blade' }, s_bruma: { travel: 'arc', impact: 'ring', color: '#5a3a8a', particles: 20 }, s_ejecucion: { shake: 4, particles: 18 },
  s_kunai: { travel: 'arc', particles: 16 }, s_marca: { impact: 'ring', color: '#ff3a4a' },
  // Carcelero
  k_sentencia: { proj: 'chain' }, k_siega: { proj: 'chain', particles: 14 }, k_explosion: { impact: 'ring', particles: 26, shake: 3 },
  k_caja: { travel: 'arc', impact: 'ring' }, k_azote: { travel: 'beam', proj: 'chain' },
  // Bárbaro
  b_colosal: { shake: 6, particles: 22, impact: 'ring' }, b_decapitar: { shake: 5, particles: 20 }, b_grito: { onSelf: 'burst', shake: 3 },
  b_salto: { shake: 3, impact: 'ring' }, b_cuchillada: { particles: 16 }, b_agarre: { shake: 2 },
  // Arquitecto
  r_lanza: { travel: 'beam' }, r_glifo: { travel: 'arc', impact: 'ring' }, r_pulsar: { onSelf: 'burst', shake: 2 }, r_ciudadela: { onSelf: 'burst', shake: 3 },
  r_arquitectonico: { travel: 'arc', particles: 18, shake: 2 }, r_gravedad: { travel: 'arc', impact: 'ring' },
  // Pistolero
  g_tambor: { travel: 'beam', particles: 26, shake: 5, color: '#ff8a30' }, g_certero: { travel: 'beam', shake: 3 }, g_abanico: { particles: 18, shake: 2 },
  g_bengala: { travel: 'arc', impact: 'ring', particles: 22, color: '#ff8a30' }, g_mina: { travel: 'arc', impact: 'none' }, g_gancho: { proj: 'chain' },
  // Arquero
  a_letal: { travel: 'beam', shake: 4, particles: 16 }, perforante: { travel: 'beam', shake: 3 }, a_abanico: { travel: 'arc', particles: 18 },
  a_ignea: { color: '#ff8a30', particles: 14 }, flecha_hielo: { color: '#8ae0ff' }, red: { travel: 'arc', impact: 'ring', color: '#c8b070' },
  a_conmocion: { impact: 'ring', shake: 2 }, a_campo: { travel: 'arc', impact: 'none' }, ojo_halcon: { onSelf: 'aura', color: '#ffe08a' },
};

/** Receta final de un hechizo: la de su clase, deducida de su definición y con los ajustes de SPELL_FX. */
export function recipeFor(def: SpellDef, cls?: string): FxRecipe {
  const c = CLASS_FX[cls ?? ''] ?? { color: '#ffe08a', glow: '#ffffff', proj: 'bolt' as ProjKind };
  const color = def.element ? ELEMENT_FX[def.element] ?? c.color : c.color;
  const self = def.target === 'self';
  const ally = def.target === 'ally';
  const melee = def.range[1] <= 1 && !self;
  const area = !!(def.area || def.cone || def.line || def.square);
  const base: FxRecipe = {
    travel: self ? 'none' : melee ? 'instant' : ally ? 'line' : 'line',
    proj: ally ? 'spark' : c.proj,
    color: ally ? (def.shield ? '#58a6ff' : def.heal ? '#5fcf80' : color) : color,
    glow: c.glow,
    impact: self ? 'none' : melee ? 'slash' : ally ? 'ring' : 'burst',
    area,
    particles: def.dmg ? (area ? 14 : 10) : 6,
    shake: def.dmg && def.dmg[1] >= 20 ? 2 : 0,
    onSelf: self ? (def.shield || def.buff ? 'aura' : 'burst') : 'none',
  };
  return { ...base, ...SPELL_FX[def.id] };
}

/** Casillas que se iluminan al impactar (aproximación visual del área del hechizo). */
export function fxCells(def: SpellDef, from: Pos, at: Pos, w: number, h: number): Pos[] {
  const out: Pos[] = [];
  const inside = (p: Pos): boolean => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
  if (def.line) {
    const dx = Math.sign(at.x - from.x), dy = Math.sign(at.y - from.y);
    for (let i = 1; i <= def.range[1]; i++) { const p = { x: from.x + dx * i, y: from.y + dy * i }; if (inside(p)) out.push(p); }
    return out;
  }
  const r = def.cone ?? def.area ?? 0;
  const c = def.range[1] === 0 ? from : at;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (!def.square && Math.abs(dx) + Math.abs(dy) > r) continue;
    const p = { x: c.x + dx, y: c.y + dy };
    if (inside(p) && !(def.range[1] === 0 && dx === 0 && dy === 0 && r > 0)) out.push(p);
  }
  return out.length ? out : [at];
}

interface Particle { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string; size: number; grav: number }
interface Projectile { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; kind: ProjKind; color: string; glow: string; arc: boolean }
interface Beam { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; color: string; glow: string }
interface Flash { cells: Pos[]; t0: number; dur: number; color: string }
interface Slash { x: number; y: number; t0: number; dur: number; color: string; ang: number }
interface Wave { x: number; y: number; t0: number; dur: number; color: string; r: number }

/** Capa de efectos del tablero. Todo en píxeles del tablero (casilla = `tile`). */
export class FxLayer {
  private parts: Particle[] = [];
  private projs: Projectile[] = [];
  private beams: Beam[] = [];
  private flashes: Flash[] = [];
  private slashes: Slash[] = [];
  private waves: Wave[] = [];
  private shakeUntil = 0;
  private shakeAmp = 0;

  constructor(private tile: number) {}

  private px(p: Pos, dy = 0.45): [number, number] { return [(p.x + 0.5) * this.tile, (p.y + dy) * this.tile]; }

  /** Estallido de partículas. */
  burst(x: number, y: number, color: string, n: number, t0: number, speed = 0.18, grav = 0.0004): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, t0, life: 380 + Math.random() * 320, color: i % 3 ? color : '#ffffff', size: 2 + Math.random() * 3, grav });
    }
  }

  shake(amp: number, now: number, ms = 220): void { if (amp > 0) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeUntil = Math.max(this.shakeUntil, now + ms); } }

  /** Desplazamiento de pantalla de este fotograma. */
  offset(now: number): [number, number] {
    if (now > this.shakeUntil) { this.shakeAmp = 0; return [0, 0]; }
    const k = (this.shakeUntil - now) / 220, a = this.shakeAmp * Math.min(1, k);
    return [(Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a];
  }

  /** Lanza los efectos de un hechizo de `from` a `at`. Devuelve cuándo impacta (ms). */
  cast(r: FxRecipe, from: Pos, at: Pos, cells: Pos[], now: number): number {
    const [x0, y0] = this.px(from, 0.4), [x1, y1] = this.px(at, 0.45);
    const len = Math.hypot(x1 - x0, y1 - y0) / this.tile;
    let hit = now;
    if (r.onSelf !== 'none') {
      this.waves.push({ x: x0, y: y0 + this.tile * 0.15, t0: now, dur: 520, color: r.color, r: this.tile * 0.75 });
      if (r.onSelf === 'burst') this.burst(x0, y0, r.color, 18, now, 0.22);
      else for (let i = 0; i < 12; i++) this.parts.push({ x: x0 + (Math.random() - 0.5) * this.tile * 0.7, y: y0 + this.tile * 0.35, vx: 0, vy: -0.05 - Math.random() * 0.06, t0: now + i * 25, life: 600, color: i % 2 ? r.color : r.glow, size: 2 + Math.random() * 2, grav: 0 });
    }
    if (r.travel === 'line' || r.travel === 'arc') {
      if (len > 0.6) {
        const dur = Math.min(420, 110 + len * (r.travel === 'arc' ? 55 : 38));
        this.projs.push({ x0, y0, x1, y1, t0: now, dur, kind: r.proj, color: r.color, glow: r.glow, arc: r.travel === 'arc' });
        hit = now + dur;
      }
    } else if (r.travel === 'beam' && len > 0.6) {
      this.beams.push({ x0, y0, x1, y1, t0: now + 60, dur: 260, color: r.color, glow: r.glow });
      hit = now + 90;
    }
    if (r.travel !== 'none') {
      if (r.impact === 'burst') this.burst(x1, y1, r.color, r.particles, hit);
      else if (r.impact === 'ring') { this.waves.push({ x: x1, y: y1, t0: hit, dur: 460, color: r.color, r: this.tile * (r.area ? 1.4 : 0.8) }); this.burst(x1, y1, r.color, Math.round(r.particles / 2), hit); }
      else if (r.impact === 'slash') this.slashes.push({ x: x1, y: y1, t0: hit, dur: 260, color: r.glow, ang: Math.atan2(y1 - y0, x1 - x0) });
      if (r.area && cells.length > 1) this.flashes.push({ cells, t0: hit, dur: 420, color: r.color });
    }
    this.shake(r.shake, hit);
    return hit;
  }

  /** Golpe recibido: chispas en la víctima (más y doradas si es crítico). */
  hit(p: Pos, crit: boolean, now: number): void {
    const [x, y] = this.px(p, 0.5);
    this.burst(x, y, crit ? '#ffd24a' : '#ff7080', crit ? 14 : 6, now, crit ? 0.22 : 0.14);
    if (crit) this.shake(2, now, 160);
  }

  /** ¿Hay algo que dibujar? (para no repintar en vano) */
  busy(now: number): boolean { return this.parts.length + this.projs.length + this.beams.length + this.flashes.length + this.slashes.length + this.waves.length > 0 || now < this.shakeUntil; }

  draw(g: CanvasRenderingContext2D, now: number): void {
    const T = this.tile;
    // destellos de área: las casillas afectadas se iluminan y se apagan
    this.flashes = this.flashes.filter((f) => now - f.t0 < f.dur);
    for (const f of this.flashes) {
      if (now < f.t0) continue;
      const k = (now - f.t0) / f.dur;
      g.globalAlpha = 0.45 * (1 - k); g.fillStyle = f.color;
      for (const c of f.cells) g.fillRect(c.x * T + 3, c.y * T + 3, T - 6, T - 6);
    }
    g.globalAlpha = 1;
    // ondas
    this.waves = this.waves.filter((w) => now - w.t0 < w.dur);
    for (const w of this.waves) {
      if (now < w.t0) continue;
      const k = (now - w.t0) / w.dur;
      g.globalAlpha = 1 - k; g.strokeStyle = w.color; g.lineWidth = 3 * (1 - k) + 1;
      g.beginPath(); g.ellipse(w.x, w.y, w.r * (0.25 + k * 0.75), w.r * (0.25 + k * 0.75) * 0.55, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    // haces: línea gruesa con núcleo blanco que se estrecha
    this.beams = this.beams.filter((b) => now - b.t0 < b.dur);
    for (const b of this.beams) {
      if (now < b.t0) continue;
      const k = (now - b.t0) / b.dur;
      g.lineCap = 'round';
      g.globalAlpha = 0.5 * (1 - k); g.strokeStyle = b.color; g.lineWidth = 14 * (1 - k) + 2; g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); g.stroke();
      g.globalAlpha = 1 - k; g.strokeStyle = b.glow; g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); g.stroke();
      g.lineCap = 'butt';
    }
    g.globalAlpha = 1;
    // proyectiles (en línea o en arco), con estela
    this.projs = this.projs.filter((p) => now - p.t0 < p.dur);
    for (const p of this.projs) {
      if (now < p.t0) continue;
      const at = (k: number): [number, number] => {
        const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k;
        return [x, p.arc ? y - Math.sin(Math.PI * k) * T * 0.9 : y];
      };
      const k = (now - p.t0) / p.dur;
      for (let i = 4; i >= 1; i--) { const [tx, ty] = at(Math.max(0, k - i * 0.05)); g.globalAlpha = 0.35 - i * 0.06; g.fillStyle = p.color; g.beginPath(); g.arc(tx, ty, 5 - i * 0.6, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      const [x, y] = at(k), [px, py] = at(Math.max(0, k - 0.03)), ang = Math.atan2(y - py, x - px);
      g.save(); g.translate(x, y); g.rotate(ang);
      drawProj(g, p.kind, p.color, p.glow, now);
      g.restore();
    }
    // tajos: arco brillante que barre
    this.slashes = this.slashes.filter((s) => now - s.t0 < s.dur);
    for (const s of this.slashes) {
      if (now < s.t0) continue;
      const k = (now - s.t0) / s.dur;
      g.globalAlpha = 1 - k; g.strokeStyle = s.color; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { g.lineWidth = 5 - i * 1.5; g.beginPath(); g.arc(s.x, s.y, T * (0.3 + i * 0.07), s.ang - 1.2 + k * 1.4, s.ang - 0.2 + k * 1.4); g.stroke(); }
      g.lineCap = 'butt';
    }
    g.globalAlpha = 1;
    // partículas
    this.parts = this.parts.filter((q) => now - q.t0 < q.life);
    for (const q of this.parts) {
      if (now < q.t0) continue;
      const t = now - q.t0, k = t / q.life;
      const x = q.x + q.vx * t, y = q.y + q.vy * t + q.grav * t * t;
      g.globalAlpha = 1 - k; g.fillStyle = q.color;
      const s = q.size * (1 - k * 0.6);
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }
}

/** Dibuja un proyectil apuntando a la derecha (ya girado y trasladado). */
function drawProj(g: CanvasRenderingContext2D, kind: ProjKind, color: string, glow: string, now: number): void {
  g.globalAlpha = 0.35; g.fillStyle = color; g.beginPath(); g.arc(0, 0, kind === 'orb' ? 13 : 8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  if (kind === 'arrow') {
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(6, 0); g.stroke();
    g.fillStyle = glow; g.beginPath(); g.moveTo(10, 0); g.lineTo(4, -4); g.lineTo(4, 4); g.closePath(); g.fill();
    g.fillStyle = color; g.fillRect(-16, -3, 4, 2); g.fillRect(-16, 1, 4, 2);
  } else if (kind === 'bullet') {
    g.fillStyle = glow; g.fillRect(-4, -2, 8, 4); g.fillStyle = '#ffffff'; g.fillRect(2, -1, 3, 2);
  } else if (kind === 'blade') {
    g.rotate(now / 40);
    g.fillStyle = glow; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(8, -2); g.lineTo(0, 3); g.closePath(); g.fill(); }
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, 2.5, 0, Math.PI * 2); g.fill();
  } else if (kind === 'chain') {
    g.strokeStyle = color; g.lineWidth = 2; for (let i = -12; i <= 4; i += 5) { g.beginPath(); g.ellipse(i, 0, 3, 2, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = glow; g.beginPath(); g.moveTo(10, 0); g.lineTo(5, -4); g.lineTo(5, 4); g.closePath(); g.fill();
  } else if (kind === 'orb') {
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-1, -1, 3.5, 0, Math.PI * 2); g.fill();
  } else if (kind === 'spark') {
    g.fillStyle = glow; g.rotate(now / 90); g.fillRect(-5, -1.5, 10, 3); g.fillRect(-1.5, -5, 3, 10);
  } else {
    g.fillStyle = color; g.fillRect(-7, -3, 12, 6); g.fillStyle = glow; g.fillRect(-2, -2, 8, 4);
  }
}
