// Efectos innatos de ciertos monstruos (Ardiente, Vampírico, Venenoso): cambian cómo funciona su primer hechizo.
import type { SpellDef } from './classes/spells';

export const IMBUES: Record<string, (d: SpellDef) => void> = {
  fuego: (d) => { d.extraStatus = { kind: 'burn', turns: 3 }; },
  veneno: (d) => { d.extraStatus = { kind: 'poison', turns: 3, stacks: 2 }; },
  vampiro: (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.4; },
};

/** El hechizo tal como queda con su efecto innato (sin modificar el original). */
export function withImbue(def: SpellDef, imbue: string | undefined): SpellDef {
  const f = imbue ? IMBUES[imbue] : undefined;
  if (!f || !def.dmg) return def;
  const d: SpellDef = { ...def, range: [...def.range] as [number, number] };
  f(d);
  return d;
}
