// Runas: se engarzan en un hechizo (una por hechizo) y cambian cómo funciona.
import type { SpellDef } from './classes/spells';

export interface RuneDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  rare: boolean;
  /** solo tiene efecto en hechizos que hacen daño */
  needsDamage: boolean;
  apply: (d: SpellDef) => void;
}

const R = (id: string, name: string, icon: string, text: string, rare: boolean, needsDamage: boolean, apply: (d: SpellDef) => void): RuneDef => ({ id, name, icon, text, rare, needsDamage, apply });

export const RUNES: Record<string, RuneDef> = Object.fromEntries(
  [
    R('fuego', 'Fuego', '🔥', 'Añade Quemadura 3 turnos.', false, true, (d) => { d.extraStatus = { kind: 'burn', turns: 3 }; }),
    R('hielo', 'Hielo', '❄️', 'Añade -1 PM durante 2 turnos.', false, true, (d) => { d.extraStatus = { kind: 'slow', turns: 2, stacks: 1 }; }),
    R('veneno', 'Veneno', '🧪', 'Añade 2 cargas de veneno.', false, true, (d) => { d.extraStatus = { kind: 'poison', turns: 3, stacks: 2 }; }),
    R('veloz', 'Veloz', '💨', 'Cuesta 1 PA menos (mínimo 1).', false, false, (d) => { d.ap = Math.max(1, d.ap - 1); }),
    R('alcance', 'Largo alcance', '🎯', '+2 de alcance (hechizos a distancia).', false, false, (d) => { if (d.range[1] >= 2) d.range = [d.range[0], d.range[1] + 2]; }),
    R('empuje', 'Empuje', '💥', 'Empuja al objetivo 2 casillas.', false, true, (d) => { d.push = Math.max(d.push ?? 0, 2); }),
    R('egida', 'Égida', '🛡️', 'Ganas 5 de escudo al lanzarlo.', false, false, (d) => { d.selfShield = (d.selfShield ?? 0) + 5; }),
    R('cazador', 'Cazador', '🏹', '+25% de probabilidad de crítico.', false, true, (d) => { d.crit = (d.crit ?? 0) + 25; }),
    R('vampiro', 'Vampiro', '🦇', 'Te curas el 40% del daño hecho.', true, true, (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.4; }),
    R('brutal', 'Brutal', '🪓', '+40% de daño, +1 turno de espera.', true, true, (d) => { if (d.dmg) d.dmg = [Math.round(d.dmg[0] * 1.4), Math.round(d.dmg[1] * 1.4)]; d.cd += 1; }),
    R('eco', 'Eco', '🌟', 'Área +1: alcanza a los enemigos cercanos al objetivo.', true, true, (d) => { d.area = (d.area ?? 0) + 1; }),
    R('marca', 'Sentencia', '👁️', 'Marca al objetivo: recibe +30% de daño 2 turnos.', true, true, (d) => { d.extraStatus = { kind: 'mark', turns: 2 }; }),
  ].map((r) => [r.id, r]),
);

/** El hechizo tal como queda con su runa (sin modificar el original). */
export function withRune(def: SpellDef, rune: string | undefined): SpellDef {
  const r = rune ? RUNES[rune] : undefined;
  if (!r || (r.needsDamage && !def.dmg)) return def;
  const d: SpellDef = { ...def, range: [...def.range] as [number, number] };
  r.apply(d);
  return d;
}
