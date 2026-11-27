/**
 * Sistema rúnico universal: aplica las runas equipadas (y sus sinergias de familia) a una habilidad.
 * - Es una función pura: clona la definición, nunca muta SPELLS ni la definición recibida.
 * - Consultar una habilidad no dispara nada: los efectos de combate (runeFx) solo los ejecuta el motor al lanzar.
 * - Sin restricciones de clase: cada operación decide si encaja con la habilidad por lo que la habilidad hace.
 */
import type { Stats } from './items/items';
import type { SpellDef } from './classes/spells';
import type { StatusKind, Unit } from './state';
import { STATUSES } from './statuses';
import {
  FAMILIES, FAMILY_NAME, RARITY_NAME, RUNES, RUNE_LIST, SYNERGY_LIST,
  type RuneDef, type RuneFamily, type RuneOp, type RuneRarity, type SynergyDef,
} from './runeCatalog';

export { RUNES, RUNE_LIST, SYNERGIES, SYNERGY_LIST, FAMILIES, FAMILY_NAME, FAMILY_ICON, FAMILY_COLOR, RARITY_NAME, KIND_NAME } from './runeCatalog';
export type { RuneDef, RuneFamily, RuneRarity, RuneKind, RuneOp, SynergyDef } from './runeCatalog';

/** Espacios de runas por personaje. */
export const RUNE_SLOTS = 4;
/** Runas de reserva que se pueden llevar sin equipar (para cambiar de configuración sin perderlas). */
export const RUNE_RESERVE = 3;

// ---------- utilidades de lectura ----------
export const runeDef = (id: string): RuneDef | undefined => RUNES[id];
export const isRune = (id: unknown): id is string => typeof id === 'string' && !!RUNES[id];
/** Runas válidas y sin duplicados indebidos, en su orden (como mucho RUNE_SLOTS). */
export function cleanRunes(ids: readonly unknown[] | undefined, max = RUNE_SLOTS): string[] {
  const out: string[] = [];
  for (const id of ids ?? []) {
    if (!isRune(id)) continue;
    if (out.includes(id) && !RUNES[id]!.stackable) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
export function unitRunes(unit: Pick<Unit, 'runes'>): string[] { return cleanRunes(unit.runes); }
export function runeNames(ids: string[]): string[] { return ids.map((id) => RUNES[id]?.name).filter((x): x is string => !!x); }
/** Cualquier clase puede equipar cualquier runa: solo hace falta que exista. */
export function canEquipRune(id: string): boolean { return !!RUNES[id]; }
/** ¿Se puede añadir `id` a estas runas equipadas? Devuelve el motivo si no. */
export function equipProblem(equipped: readonly string[], id: string, slot?: number): string | null {
  const r = RUNES[id];
  if (!r) return 'Esa runa no existe';
  const others = equipped.filter((_, i) => i !== slot);
  if (!r.stackable && others.includes(id)) return `${r.name} no se puede equipar dos veces`;
  if (slot === undefined && equipped.length >= RUNE_SLOTS) return `Ya llevas ${RUNE_SLOTS} runas: sustituye una`;
  if (slot !== undefined && (slot < 0 || slot >= RUNE_SLOTS)) return 'Espacio no válido';
  return null;
}

/** Familias con al menos una runa equipada. */
export function familiesOf(ids: readonly string[]): RuneFamily[] {
  const set = new Set(cleanRunes(ids).map((id) => RUNES[id]!.family));
  return FAMILIES.filter((f) => set.has(f));
}
/** Sinergias activas: todas las combinaciones (de 2, 3 o 4 familias) que cubren las runas equipadas. */
export function activeSynergies(ids: readonly string[]): SynergyDef[] {
  const fam = new Set(familiesOf(ids));
  return SYNERGY_LIST.filter((s) => s.families.every((f) => fam.has(f)));
}
/** Sinergias que activaría una familia más (para la interfaz). */
export function nearSynergies(ids: readonly string[]): Array<{ syn: SynergyDef; missing: RuneFamily }> {
  const fam = new Set(familiesOf(ids));
  return SYNERGY_LIST.flatMap((s) => { const miss = s.families.filter((f) => !fam.has(f)); return miss.length === 1 ? [{ syn: s, missing: miss[0]! }] : []; });
}

// ---------- bonificaciones de unidad (estadísticas y rasgos) ----------
/** Estadísticas y rasgos que dan las runas a la unidad (no a las habilidades). */
export function runeUnitBonus(ids: readonly string[]): { stats: Stats[]; traits: string[] } {
  const stats: Stats[] = [], traits: string[] = [];
  for (const op of allOps(ids).map((x) => x.op)) {
    if (op.op === 'stats') stats.push(op.stats);
    else if (op.op === 'trait' && !traits.includes(op.id)) traits.push(op.id);
  }
  return { stats, traits };
}

// ---------- aplicación a una habilidad ----------
export interface RuneTrace {
  /** id de runa o de sinergia */
  from: string;
  name: string;
  /** qué cambió (o por qué no se aplica) */
  text: string;
  applied: boolean;
}
export interface RuneResult { spell: SpellDef; traces: RuneTrace[]; mutated: boolean }

const isDamaging = (s: SpellDef): boolean => !!s.dmg || !!s.followUp || !!s.detonate || !!s.sphereHit || !!s.consume;
const healsOrShields = (s: SpellDef): boolean => !!s.heal || !!s.healPct || !!s.shield || !!s.selfShield || !!s.lantern || !!s.sphereShield || !!s.soulShield;
const heals = (s: SpellDef): boolean => !!s.heal || !!s.healPct || !!s.lantern?.heal;
const shields = (s: SpellDef): boolean => !!s.shield || !!s.selfShield || !!s.lantern || !!s.sphereShield || !!s.soulShield;
const singleTarget = (s: SpellDef): boolean => !!s.dmg && (s.target === 'enemy' || s.target === 'ground') && !s.area && !s.line && !s.cone && !s.special && s.range[1] > 0;
const melee = (s: SpellDef): boolean => !!s.dmg && s.target === 'enemy' && s.range[1] <= 1 && !s.cone && !s.area && !s.special && s.range[1] > 0;
const mulPair = (p: [number, number], f: number): [number, number] => [Math.round(p[0] * f), Math.round(p[1] * f)];

function scaleDamage(s: SpellDef, f: number): void {
  if (s.dmg) s.dmg = mulPair(s.dmg, f);
  if (s.followUp) s.followUp = { ...s.followUp, dmg: mulPair(s.followUp.dmg, f) };
  if (s.detonate) s.detonate = { ...s.detonate, dmg: mulPair(s.detonate.dmg, f) };
  if (s.sphereHit) s.sphereHit = { ...s.sphereHit, dmg: mulPair(s.sphereHit.dmg, f) };
  if (s.consume) s.consume = { per: Math.round(s.consume.per * f) };
}
function addRuneStatus(s: SpellDef, kind: StatusKind, turns: number, stacks: number): void {
  const list = (s.runeStatus ??= []);
  const cur = list.find((x) => x.kind === kind);
  if (cur) { cur.turns = Math.max(cur.turns, turns); cur.stacks = STATUSES[kind].stack === 'add' ? cur.stacks + stacks : Math.max(cur.stacks, stacks); }
  else list.push({ kind, turns, stacks });
}

/** Fase de cada operación: primero cambian la forma (mutaciones), luego los números, luego los estados y efectos. */
const PHASE: Record<RuneOp['op'], number> = { mutate: 0, dmgMul: 1, dmgFlat: 1, apCost: 1, range: 1, area: 1, element: 1, armorIgnore: 1, lifesteal: 1, crit: 1, perTurn: 1, cd: 1, healMul: 1, shieldMul: 1, utilShield: 1, push: 1, bonusVs: 1, selfCostPct: 1, status: 2, statusTurns: 3, trigger: 4, stats: 5, trait: 5 };

interface Src { from: string; name: string; op: RuneOp }
function allOps(ids: readonly string[]): Src[] {
  const runes = cleanRunes(ids);
  const out: Src[] = [];
  for (const id of runes) for (const op of RUNES[id]!.ops) out.push({ from: id, name: RUNES[id]!.name, op });
  for (const syn of activeSynergies(runes)) for (const op of syn.ops) out.push({ from: syn.id, name: syn.name, op });
  return out;
}

/** Aplica una operación. Devuelve el texto del cambio, o null si no encaja con la habilidad. */
function applyOp(s: SpellDef, op: RuneOp): string | null {
  const dmg = isDamaging(s);
  switch (op.op) {
    case 'dmgMul': if (!dmg) return null; scaleDamage(s, op.v); return `daño ×${op.v}`;
    case 'dmgFlat': if (!s.dmg) return null; s.dmg = [s.dmg[0] + op.v, s.dmg[1] + op.v]; return `+${op.v} de daño`;
    case 'apCost': { if (!dmg || s.ap <= 1) return null; const next = Math.max(1, s.ap + op.v); if (next === s.ap) return null; s.ap = next; return `cuesta ${s.ap} PA`; }
    case 'range': if (s.range[1] < 2 || s.target === 'self') return null; s.range = [s.range[0], s.range[1] + op.v]; return `alcance ${s.range[0]}-${s.range[1]}`;
    case 'area': if (!s.area) return null; s.area += op.v; return `área ${s.area}`;
    case 'element': if (!dmg) return null; s.element = op.el; if (s.followUp) s.followUp = { ...s.followUp, element: op.el }; return `daño de ${op.el === 'fire' ? 'fuego' : op.el === 'ice' ? 'hielo' : op.el === 'poison' ? 'veneno' : op.el === 'shadow' ? 'sombra' : 'luz'}`;
    case 'armorIgnore': if (!dmg) return null; s.armorIgnore = (s.armorIgnore ?? 0) + op.v; return `ignora ${s.armorIgnore} de armadura`;
    case 'lifesteal': if (!dmg) return null; s.lifesteal = Math.min(1, (s.lifesteal ?? 0) + op.v); return `roba ${Math.round(s.lifesteal * 100)}% del daño`;
    case 'crit': if (!s.dmg) return null; s.crit = (s.crit ?? 0) + op.v; return `+${op.v}% de crítico`;
    case 'perTurn': if (!s.perTurn) return null; s.perTurn += op.v; return `${s.perTurn} usos por turno`;
    case 'cd': if (s.cd < 2) return null; s.cd = Math.max(1, s.cd + op.v); return `enfriamiento ${s.cd}`;
    case 'healMul': {
      if (!heals(s)) return null;
      if (s.heal) s.heal = Math.round(s.heal * op.v);
      if (s.healPct) s.healPct *= op.v;
      if (s.lantern?.heal) s.lantern = { ...s.lantern, heal: Math.round(s.lantern.heal * op.v) };
      return `curación ×${op.v}`;
    }
    case 'shieldMul': {
      if (!shields(s)) return null;
      if (s.shield) s.shield = Math.round(s.shield * op.v);
      if (s.selfShield) s.selfShield = Math.round(s.selfShield * op.v);
      if (s.lantern) s.lantern = { ...s.lantern, shield: Math.round(s.lantern.shield * op.v) };
      if (s.sphereShield) s.sphereShield = Math.round(s.sphereShield * op.v);
      if (s.soulShield) s.soulShield = Math.round(s.soulShield * op.v);
      return `escudo ×${op.v}`;
    }
    case 'utilShield': if (dmg || s.route === 'item') return null; s.selfShield = (s.selfShield ?? 0) + op.v; return `te da ${op.v} de escudo`;
    case 'push': if (!s.push) return null; s.push += op.v; return `empuja ${s.push}`;
    case 'bonusVs': if (!dmg) return null; { const list = (s.runeBonusVs ??= []); const cur = list.find((x) => x.kind === op.kind); if (cur) cur.dmg += op.dmg; else list.push({ kind: op.kind, dmg: op.dmg }); } return `+${op.dmg} contra ${STATUSES[op.kind].name}`;
    case 'selfCostPct': if (!dmg) return null; s.selfDmgPct = Math.min(0.5, (s.selfDmgPct ?? 0) + op.v); return `cuesta el ${Math.round(s.selfDmgPct * 100)}% de tu vida`;
    case 'status': if (!dmg) return null; addRuneStatus(s, op.kind, op.turns, op.stacks); return `aplica ${STATUSES[op.kind].name}`;
    case 'statusTurns': {
      let any = false;
      for (const st of [s.status, s.extraStatus, s.buff, s.selfBuff2]) if (st && st.kind !== 'stun' && st.kind !== 'frozen') { st.turns += op.v; any = true; }
      for (const st of s.runeStatus ?? []) { st.turns += op.v; any = true; }
      return any ? `estados +${op.v} turno${op.v > 1 ? 's' : ''}` : null;
    }
    case 'trigger': {
      const needHeal = op.t === 'healBurst' || op.t === 'overheal';
      const needCare = op.t === 'regenOnHeal' || op.t === 'cleanse';
      const needShield = op.t === 'reflect';
      if (needHeal ? !heals(s) && !(op.t === 'overheal' && s.lifesteal) : needCare ? !healsOrShields(s) : needShield ? !shields(s) : !dmg) return null;
      // el mismo efecto de varias fuentes no se duplica: se queda con el más fuerte
      const list = (s.runeFx ??= []);
      const cur = list.find((x) => x.t === op.t);
      if (cur) { cur.v = Math.max(cur.v, op.v); if (op.n !== undefined) cur.n = Math.max(cur.n ?? 0, op.n); }
      else list.push({ t: op.t, v: op.v, ...(op.n !== undefined ? { n: op.n } : {}) });
      return FX_TEXT[op.t];
    }
    case 'mutate': {
      if (op.m === 'nova') { if (!singleTarget(s)) return null; s.area = op.v; s.square = true; s.fullArea = true; s.ap += 1; return `MUTACIÓN: área ${op.v} a daño completo (+1 PA)`; }
      if (op.m === 'lance') { if (!melee(s)) return null; s.range = [2, op.v]; s.line = true; s.straight = true; s.los = true; delete s.dash; delete s.behind; return `MUTACIÓN: lanza en línea recta 2-${op.v} que atraviesa`; }
      if (op.m === 'twin') {
        if (!dmg) return null;
        if (s.perTurn) s.perTurn += 1; else if (s.cd > 0) s.perTurn = 2; else return null;
        s.cd = 0; scaleDamage(s, op.v);
        return `MUTACIÓN: sin enfriamiento, ${s.perTurn} usos por turno, daño ×${op.v}`;
      }
      if (op.m === 'cataclysm') { if (!s.dmg || !s.area) return null; s.area += op.v; s.fullArea = true; s.ap += 2; return `MUTACIÓN: área ${s.area} a daño completo (+2 PA)`; }
      if (op.m === 'leech') { if (!dmg) return null; s.lifesteal = Math.min(1, (s.lifesteal ?? 0) + op.v); s.element = 'poison'; return `MUTACIÓN: roba ${Math.round(s.lifesteal * 100)}% y pasa a veneno`; }
      if (op.m === 'bulwark') { if (!s.dmg) return null; s.selfShield = (s.selfShield ?? 0) + Math.round(s.dmg[1] * op.v); return `te da ${Math.round(s.dmg[1] * op.v)} de escudo`; }
      return null;
    }
    case 'stats': case 'trait': return null;
  }
}

export const FX_TEXT: Record<string, string> = {
  splinter: 'salpica a enemigos cercanos', chain: 'rebota a otros enemigos', pierceBehind: 'atraviesa al de detrás', echo: 'se repite en tu siguiente turno',
  execute: 'ejecuta a los debilitados', detonate: 'detona el daño progresivo', shatter: 'los rematados estallan', spreadOnKill: 'los rematados contagian sus estados',
  leechDot: 'roba vida a los que sufren daño progresivo', healBurst: 'la curación daña a los enemigos pegados', regenOnHeal: 'da Regeneración', cleanse: 'purifica',
  reflect: 'da Baluarte prismático', flames: 'deja llamas en el suelo', hasteOnKill: '+PA al rematar', resonance: 'aplica Resonancia rúnica', overheal: 'la curación sobrante es escudo',
  shieldPerHit: 'escudo por enemigo alcanzado', resetOnKill: 'se reinicia al rematar',
};

/** Habilidad transformada por las runas, con el registro de qué cambió y qué no se aplicó. */
export function runeResult(base: SpellDef, ids: readonly string[]): RuneResult {
  const spell: SpellDef = structuredClone(base);
  const traces: RuneTrace[] = [];
  let mutated = false;
  if (spell.route === 'item' || spell.route === 'enemy') return { spell, traces, mutated };
  const ops = allOps(ids).filter((x) => x.op.op !== 'stats' && x.op.op !== 'trait').sort((a, b) => PHASE[a.op.op] - PHASE[b.op.op]);
  for (const { from, name, op } of ops) {
    const text = applyOp(spell, op);
    if (op.op === 'mutate' && text) mutated = true;
    traces.push({ from, name, text: text ?? 'no afecta a esta habilidad', applied: !!text });
  }
  return { spell, traces, mutated };
}
/** La habilidad con las runas aplicadas (lo que usa el motor). */
export function applyRunes(base: SpellDef, ids: readonly string[]): SpellDef {
  return ids.length ? runeResult(base, ids).spell : base;
}

/** Resumen de una runa para la interfaz. */
export function runeLabel(id: string): string {
  const r = RUNES[id];
  return r ? `${r.name} · ${FAMILY_NAME[r.family]} · ${RARITY_NAME[r.rarity]}` : id;
}
/** Estados relacionados con una runa (los que aplica o sobre los que actúa). */
export function runeStatuses(id: string): StatusKind[] {
  const r = RUNES[id];
  if (!r) return [];
  const out = new Set<StatusKind>();
  for (const op of r.ops) {
    if (op.op === 'status' || op.op === 'bonusVs') out.add(op.kind);
    if (op.op === 'trigger') {
      if (op.t === 'regenOnHeal') out.add('regen');
      if (op.t === 'cleanse') out.add('ward');
      if (op.t === 'reflect') out.add('prism');
      if (op.t === 'resonance') out.add('resonance');
      if (op.t === 'detonate' || op.t === 'leechDot') { out.add('bleed'); out.add('poison'); out.add('burn'); }
      if (op.t === 'flames') out.add('burn');
      if (op.t === 'execute') out.add('weak');
    }
  }
  return [...out];
}
/** Runas por rareza (excluye las de jefe y la del jefe final salvo que se pidan). */
export function runePool(min: RuneRarity, max: RuneRarity, opts: { boss?: boolean } = {}): RuneDef[] {
  return RUNE_LIST.filter((r) => r.rarity >= min && r.rarity <= max && (opts.boss || (!r.boss && !r.final)));
}
