import { SPELLS } from '../core/classes/spells';
// Tablero de combate: dibuja el estado y convierte clics en acciones.
import { ZONES } from '../content/zones';
import { castProblem, current, spellOf, usableMp } from '../core/combat/engine';
import { alive, dist, hasLineOfSight, reachable } from '../core/combat/grid';
import type { CombatState, GameEvent, Pos, Unit } from '../core/state';
import type { Session } from '../game/session';
import { PLAYER_COLORS, drawUnit } from './sprites';

const TILE = 56;
const STATUS_COLOR: Record<string, string> = { burn: '#ff8a30', poison: '#7fe05a', slow: '#8ae0ff', stun: '#ffe84a', mark: '#ff5ad0' };
export const STATUS_NAME: Record<string, string> = { burn: 'Quemadura', poison: 'Veneno', slow: 'Ralentizado', stun: 'Aturdido', mark: 'Marcado', empower: 'Potenciado', reach: 'Alcance+', invis: 'Invisible', exposed: 'Expuesto' };

interface Float { x: number; y: number; text: string; color: string; t0: number }
interface Shot { x0: number; y0: number; x1: number; y1: number; color: string; t0: number; dur: number }
interface Ghost { kind: string; team: string; idx: number; x: number; y: number; t0: number }
const ELEMENT_COLOR: Record<string, string> = { fire: '#ff8a30', ice: '#8ae0ff', poison: '#7fe05a', shadow: '#b07cff', holy: '#ffe9a0' };
const ELEMENT_NAME: Record<string, string> = { fire: 'fuego', ice: 'hielo', poison: 'veneno', shadow: 'sombra', holy: 'sagrado' };
const LUNGE_MS = 240;

const CLASS_KINDS = ['guerrero', 'mago', 'clerigo', 'picaro', 'arquero'];
/** Índice de color y etiqueta: héroes de jugadores, y héroes rivales (némesis, duelos) dentro de su bando. */
function teamIdx(c: CombatState): Map<number, number> {
  const m = new Map<number, number>();
  for (const team of ['hero', 'enemy'] as const) c.units.filter((u) => u.team === team && CLASS_KINDS.includes(u.kind)).forEach((u, i) => m.set(u.id, i));
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
  private ghosts: Ghost[] = [];
  private lunge = new Map<number, { t0: number; dx: number; dy: number }>();
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
    if (!c || !p || !this.session.isMyTurn()) return;
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
      if (e.t === 'cast' && u && from) {
        const dx = e.at.x - from.x, dy = e.at.y - from.y, len = Math.hypot(dx, dy);
        if (len > 0) {
          this.lunge.set(u.id, { t0: now, dx: dx / len, dy: dy / len });
          if (dx !== 0) this.faceLeft.set(u.id, dx < 0);
          if (len > 1.5) this.shots.push({ x0: (from.x + 0.5) * TILE, y0: (from.y + 0.4) * TILE, x1: (e.at.x + 0.5) * TILE, y1: (e.at.y + 0.4) * TILE, color: ELEMENT_COLOR[e.element ?? ''] ?? '#ffe08a', t0: now, dur: Math.min(320, 90 + len * 35) });
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
    if (me && cur?.id === me.id && !c.over) {
      const def = this.sel ? spellOf(me, this.sel) : undefined;
      if (def) {
        for (let y = 0; y < c.h; y++)
          for (let x = 0; x < c.w; x++) {
            const p = { x, y }, d = dist(me.pos, p);
            if (d < def.range[0] || d > def.range[1] || c.obstacles.includes(`${x},${y}`)) continue;
            const seen = !def.los || d <= 1 || hasLineOfSight(c, me.pos, p);
            fill(p, seen ? 'rgba(255,150,60,.16)' : 'rgba(120,120,140,.10)');
            if (!castProblem(c, me, SPELLS[def.id]!, p)) { g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.strokeRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8); }
          }
        if (this.hover && def.area) {
          for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (dist({ x, y }, this.hover) <= def.area) fill({ x, y }, 'rgba(255,60,60,.2)');
        }
      } else {
        for (const [k, cost] of reachable(c, me.pos, usableMp(c, me)).cost) {
          if (!cost) continue;
          const [x, y] = k.split(',').map(Number) as [number, number];
          fill({ x, y }, 'rgba(88,166,255,.2)');
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
      const bob = moving ? -Math.abs(Math.sin(now / 70)) * 5 : Math.sin(now / 260 + u.id) * 1.5;
      const lg = this.lunge.get(u.id);
      const lk = lg ? (now - lg.t0) / LUNGE_MS : 1;
      const swing = lk < 1 ? Math.sin(lk * Math.PI) : 0;
      const def0 = u.team === 'hero';
      const left = this.faceLeft.get(u.id) ?? !def0;
      drawUnit(g, u.kind, u.team, heroIdx.get(u.id) ?? 0, cx + (lg ? lg.dx * swing * TILE * 0.3 : 0), by + bob + (lg ? lg.dy * swing * TILE * 0.3 : 0), TILE,
        { flash: (this.flash.get(u.id) ?? 0) > now, swing, flip: def0 ? left : !left, alpha: u.statuses.invis ? 0.4 : 1 });
      this.bars(u, cx, s.y * TILE + 2, heroIdx.get(u.id));
    }
    // caídos: se desvanecen hacia arriba
    this.ghosts = this.ghosts.filter((d) => now - d.t0 < 600);
    for (const d of this.ghosts) {
      const k = (now - d.t0) / 600;
      drawUnit(g, d.kind, d.team, d.idx, (d.x + 0.5) * TILE, (d.y + 1) * TILE - 6 - k * 14, TILE, { alpha: 1 - k, flash: k < 0.3 });
    }
    // proyectiles con estela
    this.shots = this.shots.filter((p) => now - p.t0 < p.dur);
    for (const p of this.shots) {
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

  private bars(u: Unit, cx: number, top: number, heroIdx: number | undefined): void {
    const g = this.g, w = TILE - 14, x = cx - w / 2;
    g.fillStyle = '#000'; g.fillRect(x - 1, top - 1, w + 2, 7);
    g.fillStyle = u.team === 'hero' ? '#4cb85a' : '#e0475b'; g.fillRect(x, top, (w * u.hp) / u.maxHp, 5);
    if (u.shield > 0) { g.fillStyle = '#58a6ff'; g.fillRect(x, top + 5, Math.min(w, (w * u.shield) / u.maxHp), 3); }
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
    const st = Object.entries(u.statuses).map(([k, v]) => `${STATUS_NAME[k]} ${v!.turns}`).join(', ');
    const res = Object.entries(u.resist ?? {}).filter(([, v]) => v).map(([k, v]) => (v! > 0 ? `Resiste ${ELEMENT_NAME[k]} ${v}%` : `Débil a ${ELEMENT_NAME[k]} ${-v!}%`)).join(' · ');
    // daño estimado del hechizo elegido sobre esta unidad
    let est = '';
    const me = this.session.myUnit();
    const def = me && this.sel ? spellOf(me, this.sel) : undefined;
    if (me && def?.dmg && u.team !== me.team) {
      const res = def.element ? Math.min(75, u.resist[def.element] ?? 0) : 0;
      const f = (1 + (me.power + (me.statuses.empower?.stacks ?? 0)) / 100) * (u.statuses.mark ? 1.3 : 1) * (1 - res / 100);
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
