/**
 * Efectos de combate de las runas (runeFx de un hechizo ya transformado por core/runes.ts).
 * El motor los llama en puntos concretos de un lanzamiento: nunca al consultar una habilidad.
 * Los golpes secundarios (esquirlas, rebotes, ecos, estallidos) solo hacen daño: no vuelven a disparar efectos rúnicos,
 * así no hay bucles ni multiplicaciones accidentales.
 */
import type { SpellDef } from '../classes/spells';
import type { CombatState, Element, GameEvent, Pos, StatusKind, Unit } from '../state';
import { DOT, DOT_STATUSES, NEGATIVE_STATUSES, RESONANCE_AT, RESONANCE_DMG, STATUSES } from '../statuses';
import { alive, dist, same } from './grid';
import { key } from '../state';

/** Primitivas del motor que necesitan los efectos (las pasa engine.ts para no crear dependencias circulares). */
export interface FxCtx {
  hurt: (s: CombatState, u: Unit, raw: number, ev: GameEvent[], source: string, opts?: { pierce?: boolean; element?: Element; armorFlat?: number }) => number;
  addStatus: (u: Unit, kind: StatusKind, turns: number, stacks: number, ev: GameEvent[]) => void;
  heal: (u: Unit, amount: number, ev: GameEvent[]) => number;
}

export const fxOf = (def: SpellDef, t: string): { v: number; n?: number } | undefined => def.runeFx?.find((x) => x.t === t);
const foesOf = (s: CombatState, u: Unit): Unit[] => s.units.filter((x) => alive(x) && x.team !== u.team);
const hasDot = (t: Unit): boolean => DOT_STATUSES.some((k) => !!t.statuses[k]);
const hasNegative = (t: Unit): boolean => Object.keys(t.statuses).some((k) => NEGATIVE_STATUSES.has(k as StatusKind));

/** Daño de un tick completo de los estados de daño progresivo de `t` (para Detonación). */
export function dotTick(t: Unit): number {
  const b = t.statuses.burn, p = t.statuses.poison, l = t.statuses.bleed;
  return (b ? DOT.burn + DOT.burnPerStack * (b.stacks - 1) : 0) + (p ? DOT.poison * p.stacks * (t.statuses.corrupt ? 1.5 : 1) : 0) + (l ? DOT.bleed * l.stacks : 0);
}

/** Resonancia rúnica: al llegar al tope, estalla (a él entero y a sus vecinos la mitad). */
export function resonate(s: CombatState, u: Unit, t: Unit, ctx: FxCtx, ev: GameEvent[]): void {
  const r = t.statuses.resonance;
  if (!r || r.stacks < RESONANCE_AT || !alive(t)) return;
  delete t.statuses.resonance;
  const dmg = RESONANCE_DMG * r.stacks;
  ev.push({ t: 'note', text: `¡${t.name} estalla en Resonancia rúnica!` });
  ctx.hurt(s, t, dmg, ev, 'resonancia', { pierce: true });
  for (const o of s.units.filter((x) => x !== t && alive(x) && x.team === t.team && dist(x.pos, t.pos) <= 1)) ctx.hurt(s, o, dmg / 2, ev, 'resonancia', { pierce: true });
}

/**
 * Efectos sobre cada objetivo alcanzado por el golpe principal (una vez por objetivo y lanzamiento).
 * `got` es el daño que llegó a la vida.
 */
export function onRuneHit(s: CombatState, u: Unit, t: Unit, def: SpellDef, got: number, ctx: FxCtx, ev: GameEvent[]): void {
  if (!def.runeFx?.length || t.team === u.team) return;
  const leech = fxOf(def, 'leechDot');
  if (leech && got > 0 && hasDot(t)) ctx.heal(u, got * leech.v, ev);
  const det = fxOf(def, 'detonate');
  if (det && alive(t) && hasDot(t)) {
    const n = Math.round(dotTick(t) * det.v);
    for (const k of DOT_STATUSES) delete t.statuses[k];
    ev.push({ t: 'resist', unit: t.id, what: '¡Detonación!' });
    ctx.hurt(s, t, n, ev, 'detonacion', { pierce: true });
  }
  const ex = fxOf(def, 'execute');
  if (ex && alive(t) && hasNegative(t)) {
    if (t.ai === 'boss') ctx.hurt(s, t, ex.n ?? 20, ev, 'ejecucion', { pierce: true });
    else if (t.hp <= t.maxHp * (t.rank ? ex.v * 0.6 : ex.v)) { ev.push({ t: 'resist', unit: t.id, what: '¡Ejecutado!' }); ctx.hurt(s, t, t.hp + t.shield + 999, ev, 'ejecucion', { pierce: true }); }
  }
  const res = fxOf(def, 'resonance');
  if (res && alive(t)) { ctx.addStatus(t, 'resonance', 3, res.v, ev); resonate(s, u, t, ctx, ev); }
  const sh = fxOf(def, 'shieldPerHit');
  if (sh && alive(u)) { u.shield += sh.v; ev.push({ t: 'shield', unit: u.id, amount: sh.v }); }
}

/** Efectos sobre cada aliado curado o escudado. `healed` es la vida real recuperada y `over` la que sobró. */
export function onRuneCare(s: CombatState, u: Unit, t: Unit, def: SpellDef, healed: number, over: number, ctx: FxCtx, ev: GameEvent[]): void {
  if (!def.runeFx?.length || t.team !== u.team || !alive(t)) return;
  const regen = fxOf(def, 'regenOnHeal');
  if (regen) ctx.addStatus(t, 'regen', regen.v, regen.n ?? 1, ev);
  const cl = fxOf(def, 'cleanse');
  if (cl) {
    const bad = Object.keys(t.statuses).filter((k) => NEGATIVE_STATUSES.has(k as StatusKind)).slice(0, cl.n ?? 1);
    for (const k of bad) delete t.statuses[k as StatusKind];
    if (bad.length) ev.push({ t: 'resist', unit: t.id, what: 'Purificado' });
    if (cl.v > 0) ctx.addStatus(t, 'ward', 2, cl.v, ev);
  }
  const rf = fxOf(def, 'reflect');
  if (rf && (def.shield || def.selfShield || def.lantern)) ctx.addStatus(t, 'prism', rf.v, 1, ev);
  const burst = fxOf(def, 'healBurst');
  if (burst && healed > 0) for (const o of s.units.filter((x) => alive(x) && x.team !== u.team && dist(x.pos, t.pos) <= 1)) ctx.hurt(s, o, healed * burst.v, ev, 'floracion', { element: 'poison' });
  const ov = fxOf(def, 'overheal');
  if (ov && over > 0) { const n = Math.round(over * ov.v); t.shield += n; ev.push({ t: 'shield', unit: t.id, amount: n }); }
}

/**
 * Tras resolver todos los golpes: golpes secundarios sobre el objetivo principal, ecos y efectos de remate.
 * `mainRaw` es el daño en bruto (antes de armadura) que llevó el objetivo principal.
 */
export function afterRuneCast(s: CombatState, u: Unit, def: SpellDef, at: Pos, main: Unit | undefined, targets: Unit[], mainRaw: number, killed: Unit[], ctx: FxCtx, ev: GameEvent[]): { reset: boolean } {
  let reset = false;
  if (!def.runeFx?.length || s.over) return { reset };
  const hit = new Set(targets.map((t) => t.id));
  const second = (o: Unit, raw: number, src: string): void => { if (s.over || !alive(o)) return; hit.add(o.id); ctx.hurt(s, o, Math.max(1, raw), ev, src, { element: def.element }); };
  const origin = main ?? targets[0];
  if (origin && mainRaw > 0 && def.dmg) {
    // Perforación: atraviesa al enemigo que hay justo detrás del objetivo
    const pb = fxOf(def, 'pierceBehind');
    if (pb) {
      const dx = Math.sign(origin.pos.x - u.pos.x), dy = Math.sign(origin.pos.y - u.pos.y);
      const behind = s.units.find((x) => alive(x) && x.team !== u.team && !hit.has(x.id) && same(x.pos, { x: origin.pos.x + dx, y: origin.pos.y + dy }));
      if (behind) second(behind, mainRaw * pb.v, 'perforacion');
    }
    // Fragmentación: esquirlas a enemigos cercanos al objetivo
    const sp = fxOf(def, 'splinter');
    if (sp) for (const o of foesOf(s, u).filter((x) => !hit.has(x.id) && dist(x.pos, origin.pos) <= 2).sort((a, b) => dist(a.pos, origin.pos) - dist(b.pos, origin.pos)).slice(0, sp.n ?? 1)) second(o, mainRaw * sp.v, 'esquirla');
    // Metralla y rebotes: saltan de enemigo en enemigo
    const ch = fxOf(def, 'chain');
    if (ch) {
      let from = origin.pos;
      for (let i = 0; i < (ch.n ?? 1) && !s.over; i++) {
        const next = foesOf(s, u).filter((x) => !hit.has(x.id) && dist(x.pos, from) <= 3).sort((a, b) => dist(a.pos, from) - dist(b.pos, from))[0];
        if (!next) break;
        ev.push({ t: 'markAdd', kind: 'pulse', at: { ...next.pos } });
        second(next, mainRaw * ch.v, 'rebote');
        from = next.pos;
      }
    }
  }
  // Llamas persistentes en la casilla del objetivo y su área
  const fl = fxOf(def, 'flames');
  if (fl && def.dmg) {
    s.fire ??= {};
    const cells = [at, ...targets.map((t) => t.pos)];
    for (const p of cells) if (p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h && !s.obstacles.includes(key(p))) s.fire[key(p)] = Math.max(s.fire[key(p)] ?? 0, fl.v);
  }
  // Eco diferido: se repite al empezar tu siguiente turno (como mucho 3 ecos pendientes)
  const echo = fxOf(def, 'echo');
  if (echo && def.dmg && alive(u)) { (u.runeEchoes ??= []).push({ spell: def.id, at: { ...at }, pct: echo.v }); u.runeEchoes = u.runeEchoes.slice(-3); }
  // remates
  for (const k of killed) {
    const shat = fxOf(def, 'shatter');
    if (shat && !s.over) {
      ev.push({ t: 'explode', unit: k.id });
      for (const o of s.units.filter((x) => alive(x) && x.team === k.team && x !== k && dist(x.pos, k.pos) <= (shat.n ?? 1))) ctx.hurt(s, o, k.maxHp * shat.v, ev, 'estallido', { pierce: true });
    }
    const spr = fxOf(def, 'spreadOnKill');
    if (spr && !s.over) {
      const bad = (Object.entries(k.statuses) as Array<[StatusKind, { turns: number; stacks: number }]>).filter(([kind, v]) => v && NEGATIVE_STATUSES.has(kind) && STATUSES[kind].cat !== 'control');
      for (const o of s.units.filter((x) => alive(x) && x.team === k.team && x !== k && dist(x.pos, k.pos) <= 1)) for (const [kind, v] of bad) ctx.addStatus(o, kind, Math.max(1, v.turns), Math.max(1, Math.ceil(v.stacks / 2)), ev);
    }
  }
  if (killed.length && alive(u)) {
    const hk = fxOf(def, 'hasteOnKill');
    if (hk && !u.runeKillAp) { u.runeKillAp = true; u.ap += hk.v; ev.push({ t: 'drain', unit: u.id, ap: hk.v, mp: 0 }); }
    if (fxOf(def, 'resetOnKill') && !s.over) reset = true;
  }
  return { reset };
}

/** Ecos pendientes de `u`: se resuelven al empezar su turno (solo daño, no se vuelven a programar). */
export function runEchoes(s: CombatState, u: Unit, defOf: (id: string) => SpellDef | undefined, flat: (t: Unit) => number, roll: (a: number, b: number) => number, ctx: FxCtx, ev: GameEvent[]): void {
  const list = u.runeEchoes;
  if (!list?.length) return;
  delete u.runeEchoes;
  for (const e of list) {
    const def = defOf(e.spell);
    if (!def?.dmg || s.over || !alive(u)) continue;
    const r = def.area ?? 0;
    const foes = s.units.filter((x) => alive(x) && x.team !== u.team && (def.square ? Math.max(Math.abs(x.pos.x - e.at.x), Math.abs(x.pos.y - e.at.y)) : dist(x.pos, e.at)) <= r);
    ev.push({ t: 'markAdd', kind: 'pulse', at: { ...e.at } });
    ev.push({ t: 'note', text: `Eco de ${def.name} (${Math.round(e.pct * 100)}%).` });
    for (const t of foes) ctx.hurt(s, t, (roll(def.dmg[0], def.dmg[1]) + flat(t)) * e.pct, ev, 'eco_runa', { element: def.element, armorFlat: def.armorIgnore });
  }
}

