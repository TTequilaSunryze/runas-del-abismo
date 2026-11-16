// Tablero de combate: dibuja el estado y convierte clics en acciones.
import { SPELLS } from '../core/classes/spells';
import { castProblem, current } from '../core/combat/engine';
import { alive, dist, hasLineOfSight, reachable } from '../core/combat/grid';
import type { CombatState, GameEvent, Pos, Unit } from '../core/state';
import type { Session } from '../game/session';
import { PLAYER_COLORS, drawUnit } from './sprites';

const TILE = 56;
const STATUS_COLOR: Record<string, string> = { burn: '#ff8a30', poison: '#7fe05a', slow: '#8ae0ff', stun: '#ffe84a', mark: '#ff5ad0' };
export const STATUS_NAME: Record<string, string> = { burn: 'Quemadura', poison: 'Veneno', slow: 'Ralentizado', stun: 'Aturdido', mark: 'Marcado' };

interface Float { x: number; y: number; text: string; color: string; t0: number }

export class Board {
  /** hechizo elegido, esperando objetivo */
  sel: string | null = null;
  onSelect: () => void = () => {};
  private g: CanvasRenderingContext2D;
  private hover: Pos | null = null;
  private shown = new Map<number, Pos>();
  private flash = new Map<number, number>();
  private floats: Float[] = [];
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
    for (const e of events) {
      if (e.t === 'damage') {
        this.flash.set(e.unit, now + 180);
        float(e.unit, e.amount > 0 ? `-${e.amount}${e.crit ? '!' : ''}` : `escudo -${e.absorbed}`, e.crit ? '#ffd24a' : '#ff7080');
      } else if (e.t === 'heal') float(e.unit, `+${e.amount}`, '#5fcf80');
      else if (e.t === 'shield') float(e.unit, `escudo +${e.amount}`, '#58a6ff');
      else if (e.t === 'status') float(e.unit, STATUS_NAME[e.kind] ?? e.kind, STATUS_COLOR[e.kind] ?? '#fff');
      else if (e.t === 'skip') float(e.unit, 'Pierde el turno', '#ffe84a');
      else if (e.t === 'trap') float(e.unit, '¡Púas!', '#ff8a30');
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
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        g.fillStyle = (x + y) % 2 ? '#2b2339' : '#251e33';
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        g.fillStyle = 'rgba(0,0,0,.28)';
        g.fillRect(x * TILE, y * TILE, TILE, 2);
        g.fillRect(x * TILE, y * TILE, 2, TILE);
      }
    for (const k of c.obstacles) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const X = x * TILE, Y = y * TILE;
      g.fillStyle = '#120e1a'; g.fillRect(X + 5, Y + TILE - 14, TILE - 10, 10);
      g.fillStyle = '#5a5473'; g.fillRect(X + 8, Y + 8, TILE - 16, TILE - 20);
      g.fillStyle = '#7a7498'; g.fillRect(X + 8, Y + 8, TILE - 16, 7);
      g.fillStyle = '#3e3a52'; g.fillRect(X + TILE - 17, Y + 15, 9, TILE - 27);
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
      const def = this.sel ? SPELLS[this.sel] : undefined;
      if (def) {
        for (let y = 0; y < c.h; y++)
          for (let x = 0; x < c.w; x++) {
            const p = { x, y }, d = dist(me.pos, p);
            if (d < def.range[0] || d > def.range[1] || c.obstacles.includes(`${x},${y}`)) continue;
            const seen = !def.los || d <= 1 || hasLineOfSight(c, me.pos, p);
            fill(p, seen ? 'rgba(255,150,60,.16)' : 'rgba(120,120,140,.10)');
            if (!castProblem(c, me, def, p)) { g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.strokeRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8); }
          }
        if (this.hover && def.area) {
          for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (dist({ x, y }, this.hover) <= def.area) fill({ x, y }, 'rgba(255,60,60,.2)');
        }
      } else {
        for (const [k, cost] of reachable(c, me.pos, me.mp).cost) {
          if (!cost) continue;
          const [x, y] = k.split(',').map(Number) as [number, number];
          fill({ x, y }, 'rgba(88,166,255,.2)');
        }
      }
    }
    if (this.hover) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(this.hover.x * TILE + 2, this.hover.y * TILE + 2, TILE - 4, TILE - 4); }

    const heroIdx = new Map(c.units.filter((u) => u.team === 'hero').map((u, i) => [u.id, i]));
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
      const bob = Math.sin(now / 260 + u.id) * 1.5;
      drawUnit(g, u.kind, u.team, heroIdx.get(u.id) ?? 0, cx, by + bob, TILE, (this.flash.get(u.id) ?? 0) > now);
      this.bars(u, cx, s.y * TILE + 2, heroIdx.get(u.id));
    }
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
      g.fillStyle = PLAYER_COLORS[heroIdx % 4]!.b; g.fillText(u.name, cx, top + TILE - 2);
    }
  }

  private tooltip(c: CombatState): void {
    const h = this.hover!;
    const u = c.units.find((x) => alive(x) && x.pos.x === h.x && x.pos.y === h.y);
    if (!u) return;
    const g = this.g;
    const st = Object.entries(u.statuses).map(([k, v]) => `${STATUS_NAME[k]} ${v!.turns}`).join(', ');
    const lines = [`${u.name}  ${u.hp}/${u.maxHp} PV${u.shield ? `  escudo ${u.shield}` : ''}`, `PA ${u.maxAp} · PM ${u.maxMp} · Armadura ${u.armor}`, ...(st ? [st] : [])];
    g.font = '14px ui-monospace, monospace'; g.textAlign = 'left';
    const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 14, hh = lines.length * 18 + 8;
    const x = Math.min(c.w * TILE - w - 4, (h.x + 1) * TILE), y = Math.max(4, Math.min(c.h * TILE - hh - 4, h.y * TILE - 10));
    g.fillStyle = 'rgba(10,6,20,.93)'; g.fillRect(x, y, w, hh); g.strokeStyle = '#3b2f57'; g.lineWidth = 2; g.strokeRect(x, y, w, hh);
    lines.forEach((l, i) => { g.fillStyle = i ? '#9a8fb5' : '#e8e0f5'; g.fillText(l, x + 7, y + 18 + i * 18); });
  }
}
