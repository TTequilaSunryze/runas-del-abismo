/** Sistema rúnico universal: transforma habilidades sin restricciones de clase. */
import type { Element, StatusKind, Unit } from './state';
import type { SpellDef } from './classes/spells';
export type RuneFamily = 'vida' | 'muerte' | 'tiempo' | 'materia';
export interface RuneDef { id: string; name: string; family: RuneFamily; description: string; apply: (spell: SpellDef) => SpellDef; }
const addStatus = (s: SpellDef, kind: StatusKind, turns = 2, stacks = 1): void => {
  if (!s.dmg) return;
  if (!s.status) s.status = { kind, turns, stacks };
  else if (s.status.kind === kind) s.status = { ...s.status, turns: Math.max(s.status.turns, turns), stacks: (s.status.stacks ?? 1) + stacks };
  else if (!s.extraStatus) s.extraStatus = { kind, turns, stacks };
};
const scaleDamage = (s: SpellDef, factor: number): void => {
  if (s.dmg) s.dmg = s.dmg.map((n) => Math.round(n * factor)) as [number, number];
  if (s.followUp?.dmg) s.followUp.dmg = s.followUp.dmg.map((n) => Math.round(n * factor)) as [number, number];
};
export const RUNES: Record<string, RuneDef> = {
  fractura: { id: 'fractura', name: 'Fractura', family: 'materia', description: 'Perfora un 25% de armadura y aplica Expuesto.', apply: s => { s.armorIgnore = Math.min(1, (s.armorIgnore ?? 0) + .25); addStatus(s, 'exposed'); return s; } },
  fragmentacion: { id: 'fragmentacion', name: 'Fragmentación', family: 'materia', description: 'Aumenta un 35% el daño.', apply: s => { scaleDamage(s, 1.35); return s; } },
  bastion: { id: 'bastion', name: 'Bastión', family: 'materia', description: 'Aumenta un 50% los escudos generados.', apply: s => { if (s.shield) s.shield = Math.round(s.shield * 1.5); if (s.selfShield) s.selfShield = Math.round(s.selfShield * 1.5); return s; } },
  perforacion: { id: 'perforacion', name: 'Perforación', family: 'materia', description: 'Ignora un 60% de armadura.', apply: s => { s.armorIgnore = Math.min(1, (s.armorIgnore ?? 0) + .6); return s; } },
  hemorragia: { id: 'hemorragia', name: 'Hemorragia', family: 'muerte', description: 'Los impactos dañinos aplican Sangrado.', apply: s => { addStatus(s, 'bleed', 3, 2); return s; } },
  condena: { id: 'condena', name: 'Condena', family: 'muerte', description: 'Añade daño contra objetivos marcados por Sangrado.', apply: s => { s.bonusVs = { kind: 'bleed', dmg: (s.bonusVs?.dmg ?? 0) + 6 }; return s; } },
  cosecha: { id: 'cosecha', name: 'Cosecha', family: 'muerte', description: 'Roba un 30% del daño infligido.', apply: s => { s.lifesteal = Math.min(1, (s.lifesteal ?? 0) + .3); return s; } },
  veneno_vivo: { id: 'veneno_vivo', name: 'Veneno vivo', family: 'vida', description: 'Los impactos dañinos aplican Veneno.', apply: s => { addStatus(s, 'poison', 3, 2); return s; } },
  simbiosis: { id: 'simbiosis', name: 'Simbiosis', family: 'vida', description: 'Las habilidades dañinas roban un 15% de vida.', apply: s => { s.lifesteal = Math.min(1, (s.lifesteal ?? 0) + .15); return s; } },
  germinacion: { id: 'germinacion', name: 'Germinación', family: 'vida', description: 'Aumenta un 40% la curación.', apply: s => { if (s.heal) s.heal = Math.round(s.heal * 1.4); if (s.healPct) s.healPct *= 1.4; return s; } },
  dilatacion: { id: 'dilatacion', name: 'Dilatación', family: 'tiempo', description: 'Los estados aplicados duran un turno más.', apply: s => { if (s.status) s.status.turns++; if (s.extraStatus) s.extraStatus.turns++; if (s.buff) s.buff.turns++; return s; } },
  repeticion: { id: 'repeticion', name: 'Repetición', family: 'tiempo', description: 'Permite un lanzamiento adicional por turno en habilidades repetibles.', apply: s => { if (s.perTurn) s.perTurn++; return s; } },
  aceleracion: { id: 'aceleracion', name: 'Aceleración', family: 'tiempo', description: 'Reduce en 1 PA el coste de habilidades dañinas.', apply: s => { if (s.dmg) s.ap = Math.max(0, s.ap - 1); return s; } },
  ignicion: { id: 'ignicion', name: 'Ignición', family: 'vida', description: 'Convierte el daño en fuego y aplica Quemadura.', apply: s => { if (s.dmg) s.element = 'fire' as Element; addStatus(s, 'burn', 2, 2); return s; } },
  eco_sombrio: { id: 'eco_sombrio', name: 'Eco sombrío', family: 'tiempo', description: 'Aumenta un 50% el daño de sombra.', apply: s => { if (s.dmg && s.element === 'shadow') scaleDamage(s, 1.5); return s; } },
  mutacion: { id: 'mutacion', name: 'Mutación', family: 'vida', description: 'Aumenta un 20% el daño y añade Veneno.', apply: s => { scaleDamage(s, 1.2); addStatus(s, 'poison', 2, 1); return s; } },
};
const SYNERGIES: Record<string, (s: SpellDef) => void> = {
  'muerte+tiempo': s => { if (s.dmg) { scaleDamage(s, 1.5); addStatus(s, 'deathmark'); } },
  'materia+tiempo': s => { if (s.dmg) { s.bounce = Math.max(1, s.bounce ?? 0); scaleDamage(s, 1.35); } },
  'materia+vida': s => { if (s.dmg) { scaleDamage(s, 1.25); addStatus(s, 'rooted'); } },
  'muerte+vida': s => { if (s.dmg) { s.lifesteal = Math.min(1, (s.lifesteal ?? 0) + .25); addStatus(s, 'bleed'); } },
};
export function applyRunes(base: SpellDef, ids: string[]): SpellDef {
  const spell: SpellDef = structuredClone(base);
  const known = ids.map(id => RUNES[id]).filter((r): r is RuneDef => !!r);
  for (const rune of known) rune.apply(spell);
  const families = [...new Set(known.map(r => r.family))].sort();
  if (families.length >= 2) SYNERGIES[families.join('+')]?.(spell);
  return spell;
}
export function runeNames(ids: string[]): string[] { return ids.map(id => RUNES[id]?.name).filter((x): x is string => !!x); }
export function canEquipRune(id: string): boolean { return !!RUNES[id]; }
export function unitRunes(unit: Pick<Unit, 'runes'>): string[] { return (unit.runes ?? []).filter(id => !!RUNES[id]); }