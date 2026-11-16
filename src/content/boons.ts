// Bendiciones de clase (estilo Hades): cada clase tiene 4 estilos. Una bendición ofrece 3 opciones de un estilo:
// mejoras de sus hechizos de clase o hechizos nuevos de esa clase. Tener 2 y 3 del mismo estilo da bonus.
import type { Stats } from '../core/items/items';
import type { ClassId } from '../core/state';
import { BOON_MODS } from '../core/boonmods';

export interface PatronDef {
  id: string;
  name: string;
  icon: string;
  cls: ClassId;
  /** opciones: hechizos nuevos (ids de SPELLS) o mejoras de hechizo (ids de BOON_MODS) */
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
    { id: 'g_acero', cls: 'guerrero', name: 'Acero', icon: '⚔️', spells: ['gm_filo', 'gm_demoledor', 'g_remolino'], two: { power: 10 }, three: {}, trait: 'execute', twoText: '+10% de daño', threeText: 'Tus críticos hacen el doble' },
    { id: 'g_sangre', cls: 'guerrero', name: 'Sangre', icon: '🩸', spells: ['gm_insaciable', 'gm_vampiro', 'g_carniceria'], two: { hp: 15 }, three: {}, trait: 'enrage', twoText: '+15 de vida', threeText: '+40% de daño con poca vida' },
    { id: 'g_muralla', cls: 'guerrero', name: 'Muralla', icon: '🛡️', spells: ['gm_escudo', 'gm_defensivo', 'g_muralla'], two: { armor: 2 }, three: {}, trait: 'guard', twoText: '+2 de armadura', threeText: 'Empiezas cada turno con escudo' },
    { id: 'g_caudillo', cls: 'guerrero', name: 'Caudillo', icon: '📯', spells: ['g_carga', 'gm_aturdidor', 'g_estandarte'], two: { initiative: 8, tackle: 4 }, three: { ap: 1 }, twoText: '+8 de iniciativa y +4 de placaje', threeText: '+1 PA' },
    { id: 'm_piro', cls: 'mago', name: 'Piromancia', icon: '🔥', spells: ['mm_voraz', 'mm_igneo', 'm_meteoro'], two: { power: 10, resFire: 20 }, three: {}, trait: 'ignite', twoText: '+10% de daño y +20% res. fuego', threeText: 'Todo tu daño quema' },
    { id: 'm_crio', cls: 'mago', name: 'Criomancia', icon: '❄️', spells: ['mm_helado', 'mm_escarcha', 'm_glaciar'], two: { armor: 1, resIce: 20 }, three: { status: 1 }, twoText: '+1 de armadura y +20% res. hielo', threeText: '+1 turno a tus estados' },
    { id: 'm_tormenta', cls: 'mago', name: 'Tormenta', icon: '⚡', spells: ['mm_cadena', 'mm_veloz', 'm_rayo_cadena'], two: { crit: 10, initiative: 6 }, three: { ap: 1 }, twoText: '+10% de crítico y +6 de iniciativa', threeText: '+1 PA' },
    { id: 'm_arcano', cls: 'mago', name: 'Arcano', icon: '🔮', spells: ['mm_sobrecarga', 'mm_doble', 'm_parpadeo'], two: { power: 8, dodge: 4 }, three: {}, trait: 'execute', twoText: '+8% de daño y +4 de huida', threeText: 'Tus críticos hacen el doble' },
    { id: 'c_sanacion', cls: 'clerigo', name: 'Sanación', icon: '💚', spells: ['cm_sanador', 'cm_compartido', 'c_milagro'], two: { hp: 15 }, three: {}, trait: 'mender', twoText: '+15 de vida', threeText: 'Tus curas y escudos son un 30% mayores' },
    { id: 'c_juicio', cls: 'clerigo', name: 'Juicio', icon: '⚖️', spells: ['cm_juicio', 'cm_cegador', 'c_martillo'], two: { power: 10 }, three: { crit: 15 }, twoText: '+10% de daño', threeText: '+15% de crítico' },
    { id: 'c_egida', cls: 'clerigo', name: 'Égida', icon: '🛡️', spells: ['cm_protector', 'cm_bendita', 'c_santuario'], two: { armor: 1, hp: 10 }, three: {}, trait: 'guard', twoText: '+1 de armadura y +10 de vida', threeText: 'Empiezas cada turno con escudo' },
    { id: 'c_penitencia', cls: 'clerigo', name: 'Penitencia', icon: '🩸', spells: ['cm_sangrienta', 'cm_ardiente', 'c_sacrificio'], two: { power: 8, crit: 5 }, three: {}, trait: 'regen', twoText: '+8% de daño y +5% de crítico', threeText: 'Te regeneras cada turno' },
    { id: 'a_franco', cls: 'arquero', name: 'Francotirador', icon: '🎯', spells: ['am_acero', 'am_aguila', 'a_letal'], two: { crit: 10 }, three: {}, trait: 'execute', twoText: '+10% de crítico', threeText: 'Tus críticos hacen el doble' },
    { id: 'a_rafaga', cls: 'arquero', name: 'Ráfaga', icon: '🏹', spells: ['am_ligera', 'am_doble', 'a_abanico'], two: { initiative: 8, dodge: 4 }, three: { ap: 1 }, twoText: '+8 de iniciativa y +4 de huida', threeText: '+1 PA' },
    { id: 'a_trampas', cls: 'arquero', name: 'Trampero', icon: '🪤', spells: ['am_enredo', 'am_veneno', 'a_campo'], two: { status: 1 }, three: {}, trait: 'venom', twoText: '+1 turno a tus estados', threeText: 'Tus venenos aplican 1 carga más' },
    { id: 'a_bestias', cls: 'arquero', name: 'Bestias', icon: '🐺', spells: ['a_halcon', 'am_salvaje', 'am_marcadora'], two: { hp: 15 }, three: {}, trait: 'regen', twoText: '+15 de vida', threeText: 'Te regeneras cada turno' },
    { id: 'z_esencia', cls: 'zorro', name: 'Esencia', icon: '🦊', spells: ['zm_orbe_intenso', 'zm_encanto_largo', 'z_drenaje'], two: { power: 8 }, three: { resShadow: 20 }, twoText: '+8% de daño', threeText: '+20% de resistencia a la sombra' },
    { id: 'z_espiritu', cls: 'zorro', name: 'Espíritu', icon: '👻', spells: ['zm_impulso_radio', 'zm_impulso_veloz', 'z_velo'], two: { dodge: 6 }, three: { mp: 1 }, twoText: '+6 de huida', threeText: '+1 PM' },
    { id: 't_dominio', cls: 'tejedora', name: 'Dominio', icon: '🔮', spells: ['tm_cinco', 'tm_pulso', 't_semilla'], two: { power: 8 }, three: { ap: 1 }, twoText: '+8% de daño', threeText: '+1 PA' },
    { id: 't_ruina', cls: 'tejedora', name: 'Ruina', icon: '💥', spells: ['tm_descarga', 'tm_dispersion', 't_implosion'], two: { crit: 10 }, three: {}, trait: 'execute', twoText: '+10% de crítico', threeText: 'Tus críticos hacen el doble' },
    { id: 'k_cadenas', cls: 'carcelero', name: 'Cadenas', icon: '⛓️', spells: ['km_gancho_largo', 'km_gancho_pesado', 'km_desollar'], two: { tackle: 4, power: 6 }, three: { ap: 1 }, twoText: '+4 de placaje y +6% de daño', threeText: '+1 PA' },
    { id: 'k_farol', cls: 'carcelero', name: 'Linterna', icon: '🏮', spells: ['km_farol_cura', 'km_farol_largo', 'k_cosecha'], two: { hp: 15 }, three: {}, trait: 'mender', twoText: '+15 de vida', threeText: 'Tus curas y escudos son un 30% mayores' },
    { id: 'p_veneno', cls: 'picaro', name: 'Veneno', icon: '🧪', spells: ['pm_untada', 'pm_cuchillo_ven', 'p_frasco'], two: { status: 1 }, three: {}, trait: 'venom', twoText: '+1 turno a tus estados', threeText: 'Tus venenos aplican 1 carga más' },
    { id: 'p_asesino', cls: 'picaro', name: 'Asesino', icon: '🗡️', spells: ['pm_letal', 'pm_emboscada', 'p_degollar'], two: { crit: 10 }, three: {}, trait: 'execute', twoText: '+10% de crítico', threeText: 'Tus críticos hacen el doble' },
    { id: 'p_sombras', cls: 'picaro', name: 'Sombras', icon: '🌑', spells: ['pm_cegador', 'pm_sombra', 'p_debilidad'], two: { dodge: 5, initiative: 6 }, three: { mp: 1 }, twoText: '+5 de huida y +6 de iniciativa', threeText: '+1 PM' },
    { id: 'p_acrobata', cls: 'picaro', name: 'Acróbata', icon: '🤸', spells: ['pm_salto', 'pm_rapido', 'p_danza'], two: { dodge: 6 }, three: { ap: 1 }, twoText: '+6 de huida', threeText: '+1 PA' },
  ] as PatronDef[]).map((p) => [p.id, p]),
);

/** Estilos de bendición de una clase. */
export const patronsOf = (cls: ClassId): PatronDef[] => Object.values(PATRONS).filter((p) => p.cls === cls);
/** ¿Es una mejora de hechizo (y no un hechizo nuevo)? */
export const isMod = (id: string): boolean => !!BOON_MODS[id];

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
export const MAX_BOONS = 6;

/** Consumibles: qué son y cuánto valen en la tienda. */
export const CONSUMABLES: Record<string, { name: string; icon: string; price: number }> = {
  c_vida: { name: 'Poción de curación', icon: '🧪', price: 30 },
  c_fuego: { name: 'Bomba de fuego', icon: '💣', price: 40 },
  c_humo: { name: 'Bomba de humo', icon: '💨', price: 35 },
  c_resu: { name: 'Poción de resurrección', icon: '🕊️', price: 90 },
};
export const MAX_CONSUMABLE = 3;
