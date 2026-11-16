// Mejoras de hechizo: se eligen al subir de nivel y duran toda la partida.
import type { SpellDef } from './classes/spells';
import { withRune } from './runes';
import type { SpellSlot } from './state';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  /** veces que se puede aplicar al mismo hechizo */
  max: number;
  fits: (d: SpellDef) => boolean;
  apply: (d: SpellDef) => void;
}

const mul = (v: number, m: number): number => Math.round(v * m);

export const UPGRADES: Record<string, UpgradeDef> = Object.fromEntries(
  ([
    { id: 'pot', name: 'Potenciado', icon: '💪', text: '+25% de daño, curación y escudo.', max: 2, fits: (d) => !!(d.dmg || d.heal || d.shield || d.snare),
      apply: (d) => { if (d.dmg) d.dmg = [mul(d.dmg[0], 1.25), mul(d.dmg[1], 1.25)]; if (d.heal) d.heal = mul(d.heal, 1.25); if (d.shield) d.shield = mul(d.shield, 1.25); if (d.snare) d.snare = { ...d.snare, dmg: mul(d.snare.dmg, 1.25) }; } },
    { id: 'efi', name: 'Eficiente', icon: '⚡', text: 'Cuesta 1 PA menos.', max: 1, fits: (d) => d.ap >= 3, apply: (d) => { d.ap = Math.max(1, d.ap - 1); } },
    { id: 'rap', name: 'Presto', icon: '⏳', text: '1 turno menos de espera.', max: 1, fits: (d) => d.cd >= 1, apply: (d) => { d.cd = Math.max(0, d.cd - 1); } },
    { id: 'alc', name: 'Lejano', icon: '🎯', text: '+1 de alcance.', max: 2, fits: (d) => d.range[1] >= 2, apply: (d) => { d.range = [d.range[0], d.range[1] + 1]; } },
    { id: 'amp', name: 'Amplio', icon: '💥', text: '+1 de área.', max: 1, fits: (d) => (d.area ?? 0) >= 1, apply: (d) => { d.area = (d.area ?? 0) + 1; } },
    { id: 'dur', name: 'Persistente', icon: '☠️', text: 'Sus estados duran 1 turno más.', max: 1, fits: (d) => !!d.status && d.status.kind !== 'stun', apply: (d) => { if (d.status) d.status = { ...d.status, turns: d.status.turns + 1 }; } },
    { id: 'cri', name: 'Certero', icon: '✴️', text: '+20% de crítico.', max: 1, fits: (d) => !!d.dmg, apply: (d) => { d.crit = (d.crit ?? 0) + 20; } },
  ] as UpgradeDef[]).map((u) => [u.id, u]),
);

/** El hechizo tal como queda con las mejoras y la runa de su ranura (sin modificar el original). */
export function tuned(def: SpellDef, slot: Pick<SpellSlot, 'rune' | 'ups'> | undefined): SpellDef {
  let d = def;
  if (slot?.ups?.length) {
    d = { ...def, range: [...def.range] as [number, number] };
    for (const id of slot.ups) { const up = UPGRADES[id]; if (up?.fits(def)) up.apply(d); }
  }
  return withRune(d, slot?.rune);
}

/** ¿Se puede aplicar otra vez esta mejora a este hechizo? */
export const canUpgrade = (def: SpellDef, ups: readonly string[], id: string): boolean => {
  const up = UPGRADES[id];
  return !!up && up.fits(def) && ups.filter((x) => x === id).length < up.max;
};
