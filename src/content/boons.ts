// Bendiciones (estilo Hades): un patrón ofrece 3 habilidades de su estilo; tener varias del mismo patrón da bonus.
import type { Stats } from '../core/items/items';

export interface PatronDef {
  id: string;
  name: string;
  icon: string;
  /** las habilidades que ofrece (ids de SPELLS) */
  spells: string[];
  two: Stats;
  three: Stats;
  /** rasgo con 3 habilidades del patrón */
  trait?: string;
  twoText: string;
  threeText: string;
}

export const PATRONS: Record<string, PatronDef> = Object.fromEntries(
  ([
    { id: 'tormenta_p', name: 'Tormenta', icon: '⚡', spells: ['b_relampago', 'b_cadena', 'b_trueno'], two: { crit: 10, initiative: 6 }, three: { ap: 1 }, twoText: '+10% de crítico y +6 de iniciativa', threeText: '+1 PA' },
    { id: 'llama_p', name: 'Llama', icon: '🔥', spells: ['b_llamarada', 'b_infierno', 'b_fenix'], two: { power: 10, resFire: 20 }, three: {}, trait: 'ignite', twoText: '+10% de daño y +20% de res. fuego', threeText: 'Todo tu daño quema' },
    { id: 'escarcha_p', name: 'Escarcha', icon: '❄️', spells: ['b_lanza', 'b_prision', 'b_coraza'], two: { armor: 1, resIce: 20 }, three: {}, trait: 'guard', twoText: '+1 de armadura y +20% de res. hielo', threeText: 'Empiezas cada turno con escudo' },
    { id: 'sombra_p', name: 'Sombra', icon: '🌑', spells: ['b_drenar', 'b_paso', 'b_maldicion'], two: { crit: 8, dodge: 4 }, three: {}, trait: 'execute', twoText: '+8% de crítico y +4 de huida', threeText: 'Tus críticos hacen el doble' },
    { id: 'vida_p', name: 'Vida', icon: '🌿', spells: ['b_espinas', 'b_brote', 'b_corteza'], two: { hp: 15 }, three: {}, trait: 'regen', twoText: '+15 de vida', threeText: 'Te regeneras cada turno' },
  ] as PatronDef[]).map((p) => [p.id, p]),
);

/** Patrón al que pertenece una habilidad de bendición. */
export const patronOf = (spell: string): PatronDef | undefined => Object.values(PATRONS).find((p) => p.spells.includes(spell));

/** Bonus de los patrones según cuántas habilidades de cada uno tienes. */
export function patronBonus(boons: readonly string[]): { stats: Stats[]; traits: string[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const b of boons) { const p = patronOf(b); if (p) counts[p.id] = (counts[p.id] ?? 0) + 1; }
  const stats: Stats[] = [], traits: string[] = [];
  for (const [id, n] of Object.entries(counts)) {
    const p = PATRONS[id]!;
    if (n >= 2) stats.push(p.two);
    if (n >= 3) { stats.push(p.three); if (p.trait) traits.push(p.trait); }
  }
  return { stats, traits, counts };
}

/** Habilidades extra que puede llevar un héroe. */
export const MAX_BOONS = 4;

/** Consumibles: qué son y cuánto valen en la tienda. */
export const CONSUMABLES: Record<string, { name: string; icon: string; price: number }> = {
  c_vida: { name: 'Poción de curación', icon: '🧪', price: 30 },
  c_fuego: { name: 'Bomba de fuego', icon: '💣', price: 40 },
  c_humo: { name: 'Bomba de humo', icon: '💨', price: 35 },
  c_resu: { name: 'Poción de resurrección', icon: '🕊️', price: 90 },
};
export const MAX_CONSUMABLE = 3;
