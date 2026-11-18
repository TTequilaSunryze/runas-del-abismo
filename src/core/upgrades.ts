// Mejoras de hechizo: se eligen al subir de nivel y duran toda la partida.
import type { SpellDef } from './classes/spells';
import { withImbue } from './imbue';
import type { SpellSlot } from './state';
import { BLESSINGS, BOON_MODS } from './boonmods';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  /** veces que se puede aplicar al mismo hechizo */
  max: number;
  /** mejora elemental: solo una por hechizo */
  elemental?: boolean;
  fits: (d: SpellDef) => boolean;
  apply: (d: SpellDef) => void;
}

const mul = (v: number, m: number): number => Math.round(v * m);
/** Añade un estado al hechizo sin pisar el que ya tenga. */
function addEffect(d: SpellDef, st: NonNullable<SpellDef['status']>): void {
  if (!d.status || d.status.kind === st.kind) d.status = st;
  else if (!d.extraStatus) d.extraStatus = st;
}
/** Un mismo hechizo se puede mejorar como mucho estas veces por partida (bendiciones incluidas). */
export const MAX_SPELL_UPS = 3;

export const UPGRADES: Record<string, UpgradeDef> = Object.fromEntries(
  ([
    { id: 'pot', name: 'Potenciado', icon: '💪', text: '+20% de daño, curación y escudo.', max: 1, fits: (d) => !!(d.dmg || d.heal || d.shield || d.snare),
      apply: (d) => { if (d.dmg) d.dmg = [mul(d.dmg[0], 1.2), mul(d.dmg[1], 1.2)]; if (d.heal) d.heal = mul(d.heal, 1.2); if (d.shield) d.shield = mul(d.shield, 1.2); if (d.snare) d.snare = { ...d.snare, dmg: mul(d.snare.dmg, 1.2) }; } },
    { id: 'efi', name: 'Eficiente', icon: '⚡', text: 'Cuesta 1 PA menos.', max: 1, fits: (d) => d.ap >= 3, apply: (d) => { d.ap = Math.max(1, d.ap - 1); } },
    { id: 'rap', name: 'Presto', icon: '⏳', text: '1 turno menos de espera.', max: 1, fits: (d) => d.cd >= 1, apply: (d) => { d.cd = Math.max(0, d.cd - 1); } },
    { id: 'alc', name: 'Lejano', icon: '🎯', text: '+1 de alcance.', max: 1, fits: (d) => d.range[1] >= 2, apply: (d) => { d.range = [d.range[0], d.range[1] + 1]; } },
    { id: 'amp', name: 'Amplio', icon: '💥', text: '+1 de área.', max: 1, fits: (d) => (d.area ?? 0) >= 1, apply: (d) => { d.area = (d.area ?? 0) + 1; } },
    { id: 'dur', name: 'Persistente', icon: '☠️', text: 'Sus estados duran 1 turno más.', max: 1, fits: (d) => !!d.status && d.status.kind !== 'stun', apply: (d) => { if (d.status) d.status = { ...d.status, turns: d.status.turns + 1 }; } },
    { id: 'cri', name: 'Certero', icon: '✴️', text: '+15% de crítico.', max: 1, fits: (d) => !!d.dmg, apply: (d) => { d.crit = (d.crit ?? 0) + 15; } },
    // mejoras elementales: cambian el elemento del daño y añaden su efecto (solo una por hechizo)
    { id: 'el_fuego', name: 'Ígneo', icon: '🔥', text: 'Su daño pasa a ser de fuego y quema 2 turnos.', max: 1, elemental: true, fits: (d) => !!d.dmg, apply: (d) => { d.element = 'fire'; addEffect(d, { kind: 'burn', turns: 2 }); } },
    { id: 'el_hielo', name: 'Gélido', icon: '❄️', text: 'Su daño pasa a ser de hielo y quita 1 PM.', max: 1, elemental: true, fits: (d) => !!d.dmg, apply: (d) => { d.element = 'ice'; addEffect(d, { kind: 'slow', turns: 1, stacks: 1 }); } },
    { id: 'el_veneno', name: 'Tóxico', icon: '🧪', text: 'Su daño pasa a ser de veneno y envenena x2 durante 2 turnos.', max: 1, elemental: true, fits: (d) => !!d.dmg, apply: (d) => { d.element = 'poison'; addEffect(d, { kind: 'poison', turns: 2, stacks: 2 }); } },
    { id: 'el_sombra', name: 'Umbrío', icon: '🌑', text: 'Su daño pasa a ser de sombra y te cura el 20% de lo que hace.', max: 1, elemental: true, fits: (d) => !!d.dmg, apply: (d) => { d.element = 'shadow'; d.lifesteal = (d.lifesteal ?? 0) + 0.2; } },
  ] as UpgradeDef[]).map((u) => [u.id, u]),
);

/** El hechizo tal como queda con las mejoras y el efecto innato de su ranura (sin modificar el original). */
export function tuned(def: SpellDef, slot: Pick<SpellSlot, 'imbue' | 'ups'> | undefined): SpellDef {
  let d = def;
  if (slot?.ups?.length) {
    d = { ...def, range: [...def.range] as [number, number] };
    // primero las mejoras de bendición (cambian el efecto), luego las de nivel (lo potencian)
    for (const id of slot.ups) { const bm = BOON_MODS[id] ?? BLESSINGS[id]?.mod; if (bm && bm.target === def.id) bm.apply(d); }
    for (const id of slot.ups) { const up = UPGRADES[id]; if (up?.fits(d)) up.apply(d); }
  }
  // GANCHO RUNAS (FEATURES.runes): aquí se aplicará la runa engarzada en el hechizo, igual que el efecto innato
  return withImbue(d, slot?.imbue);
}

/** ¿Se puede aplicar otra vez esta mejora a este hechizo? */
export const canUpgrade = (def: SpellDef, ups: readonly string[], id: string): boolean => {
  const up = UPGRADES[id];
  if (!up || !up.fits(def) || ups.length >= MAX_SPELL_UPS || ups.filter((x) => x === id).length >= up.max) return false;
  return !up.elemental || !ups.some((x) => UPGRADES[x]?.elemental);
};
