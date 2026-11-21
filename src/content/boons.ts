// Bendiciones de clase (estilo Hades): cada clase tiene 4 estilos. Una bendición ofrece 3 opciones de un estilo:
// mejoras de sus hechizos de clase o hechizos nuevos de esa clase. Tener 2 y 3 del mismo estilo da bonus.
import type { Stats } from '../core/items/items';
import type { ClassId } from '../core/state';
import { BLESSINGS, BOON_MODS } from '../core/boonmods';

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
  /** sin bonus por tener varias (las clases con hechizos únicos y bendiciones) */
  noSet?: boolean;
}

export const PATRONS: Record<string, PatronDef> = Object.fromEntries(
  ([
    { id: 'g_acero', cls: 'guerrero', name: 'Acero', icon: '⚔️', spells: ['gm_filo', 'gm_demoledor', 'g_remolino'], two: { power: 1 }, three: {}, trait: 'execute', twoText: '+1 de daño', threeText: 'Tus críticos hacen el doble' },
    { id: 'g_sangre', cls: 'guerrero', name: 'Sangre', icon: '🩸', spells: ['gm_insaciable', 'gm_vampiro', 'g_carniceria'], two: { hp: 15 }, three: {}, trait: 'enrage', twoText: '+15 de vida', threeText: '+4 de daño con poca vida' },
    { id: 'g_muralla', cls: 'guerrero', name: 'Muralla', icon: '🛡️', spells: ['gm_escudo', 'gm_defensivo', 'g_muralla'], two: { armor: 2 }, three: {}, trait: 'guard', twoText: '+2 de armadura', threeText: 'Empiezas cada turno con escudo' },
    { id: 'g_caudillo', cls: 'guerrero', name: 'Caudillo', icon: '📯', spells: ['g_carga', 'gm_aturdidor', 'g_estandarte'], two: { initiative: 8, tackle: 4 }, three: { ap: 1 }, twoText: '+8 de iniciativa y +4 de placaje', threeText: '+1 PA' },
    { id: 'm_piro', cls: 'mago', name: 'Piromancia', icon: '🔥', spells: ['mm_voraz', 'mm_igneo', 'm_meteoro'], two: { power: 1, resFire: 20 }, three: {}, trait: 'ignite', twoText: '+1 de daño y +20% res. fuego', threeText: 'Todo tu daño quema' },
    { id: 'm_crio', cls: 'mago', name: 'Criomancia', icon: '❄️', spells: ['mm_helado', 'mm_escarcha', 'm_glaciar'], two: { armor: 1, resIce: 20 }, three: { status: 1 }, twoText: '+1 de armadura y +20% res. hielo', threeText: '+1 turno a tus estados' },
    { id: 'm_tormenta', cls: 'mago', name: 'Tormenta', icon: '⚡', spells: ['mm_cadena', 'mm_veloz', 'm_rayo_cadena'], two: { crit: 10, initiative: 6 }, three: { ap: 1 }, twoText: '+10% de crítico y +6 de iniciativa', threeText: '+1 PA' },
    { id: 'm_arcano', cls: 'mago', name: 'Arcano', icon: '🔮', spells: ['mm_sobrecarga', 'mm_doble', 'm_parpadeo'], two: { power: 1, dodge: 4 }, three: {}, trait: 'execute', twoText: '+1 de daño y +4 de huida', threeText: 'Tus críticos hacen el doble' },
    { id: 'c_sanacion', cls: 'clerigo', name: 'Sanación', icon: '💚', spells: ['cm_sanador', 'cm_compartido', 'c_milagro'], two: { hp: 15 }, three: {}, trait: 'mender', twoText: '+15 de vida', threeText: 'Tus curas y escudos son un 30% mayores' },
    { id: 'c_juicio', cls: 'clerigo', name: 'Juicio', icon: '⚖️', spells: ['cm_juicio', 'cm_cegador', 'c_martillo'], two: { power: 1 }, three: { crit: 15 }, twoText: '+1 de daño', threeText: '+15% de crítico' },
    { id: 'c_egida', cls: 'clerigo', name: 'Égida', icon: '🛡️', spells: ['cm_protector', 'cm_bendita', 'c_santuario'], two: { armor: 1, hp: 10 }, three: {}, trait: 'guard', twoText: '+1 de armadura y +10 de vida', threeText: 'Empiezas cada turno con escudo' },
    { id: 'c_penitencia', cls: 'clerigo', name: 'Penitencia', icon: '🩸', spells: ['cm_sangrienta', 'cm_ardiente', 'c_sacrificio'], two: { power: 1, crit: 5 }, three: {}, trait: 'regen', twoText: '+1 de daño y +5% de crítico', threeText: 'Te regeneras cada turno' },
    { id: 'a_franco', cls: 'arquero', name: 'Francotirador', icon: '🎯', spells: ['am_acero', 'am_aguila', 'a_letal'], two: { crit: 8 }, three: { power: 1 }, twoText: '+8% de crítico', threeText: '+1 de daño' },
    { id: 'a_rafaga', cls: 'arquero', name: 'Ráfaga', icon: '🏹', spells: ['am_ligera', 'am_doble', 'a_abanico', 'a_ignea', 'am_ignea'], two: { initiative: 8, dodge: 4 }, three: { ap: 1 }, twoText: '+8 de iniciativa y +4 de huida', threeText: '+1 PA' },
    { id: 'a_trampas', cls: 'arquero', name: 'Trampero', icon: '🪤', spells: ['am_enredo', 'am_veneno', 'a_campo', 'a_conmocion'], two: { status: 1 }, three: { tackle: 4, armor: 1 }, twoText: '+1 turno a tus estados', threeText: '+4 de placaje y +1 de armadura' },
    { id: 'a_bestias', cls: 'arquero', name: 'Bestias', icon: '🐺', spells: ['a_halcon', 'am_salvaje', 'am_marcadora'], two: { hp: 12 }, three: {}, trait: 'regen', twoText: '+12 de vida', threeText: 'Te regeneras cada turno' },
    { id: 'z_kitsune', cls: 'zorro', name: 'Kitsune', icon: '🦊', noSet: true, spells: ['z_fuego', 'z_espejismo', 'z_vortice', 'z_seduccion', 'z_estallido', 'z_vinculo', 'zb_esencia', 'zb_danza', 'zb_mirada', 'zb_fuego', 'zb_reflejo', 'zb_niebla', 'zb_sinfonia', 'zb_cola', 'zb_voluntad', 'zb_aura'], two: {}, three: {}, twoText: '', threeText: '' },
    { id: 't_tejido', cls: 'esferas', name: 'Vacío', icon: '🔮', noSet: true, spells: ['t_voluntad', 't_gravedad', 't_orbita', 't_resonancia', 't_singularidad', 't_transfusion', 'tb_poder', 'tb_onda', 'tb_eco', 'tb_vortice', 'tb_orbita', 'tb_gravedad', 'tb_traccion', 'tb_singularidad', 'tb_nucleo', 'tb_dominio'], two: {}, three: {}, twoText: '', threeText: '' },
    { id: 'r_runas', cls: 'arquitecto', name: 'Runas', icon: '🔷', noSet: true, spells: ['r_gravedad', 'r_baluarte', 'r_pulsar', 'r_cercado', 'r_inercia', 'r_arquitectonico', 'r_sello', 'r_sobrecarga', 'r_matriz', 'r_ciudadela', 'rb_persistente', 'rb_blindaje', 'rb_resonancia', 'rb_gelidos', 'rb_compartida', 'rb_geometria', 'rb_cimientos', 'rb_red', 'rb_lanza', 'rb_alcance'], two: {}, three: {}, twoText: '', threeText: '' },
    { id: 'g_polvora', cls: 'pistolero', name: 'Pólvora', icon: '🔫', noSet: true, spells: ['g_abanico', 'g_trazadora', 'g_rodilla', 'g_danza', 'g_mina', 'g_certero', 'g_humo', 'g_plata', 'g_gancho', 'g_tambor', 'gb_polvora', 'gb_tirador', 'gb_duelo', 'gb_encantado', 'gb_explosiva', 'gb_doble', 'gb_pies', 'gb_gatillo', 'gb_incendiaria', 'gb_recarga'], two: {}, three: {}, twoText: '', threeText: '' },
    { id: 'k_almas', cls: 'carcelero', name: 'Almas', icon: '⛓️', noSet: true, spells: ['k_caja', 'k_explosion', 'k_vinculo', 'k_atraccion', 'k_siega', 'k_sacrificio', 'kb_condena', 'kb_faro', 'kb_guadana', 'kb_cosecha', 'kb_armadura', 'kb_cadenas', 'kb_custodia', 'kb_prision', 'kb_eco', 'kb_juicio'], two: {}, three: {}, twoText: '', threeText: '' },
    { id: 's_sombras', cls: 'acechador', name: 'Sombras', icon: '👤', noSet: true, spells: ['s_marca', 's_danza', 's_paso', 's_velo', 's_convergencia', 's_cosecha', 'sb_maestro', 'sb_desprecio', 'sb_persistente', 'sb_doble', 'sb_medianoche', 'sb_ejecucion', 'sb_reflejo', 'sb_cuchillas', 'sb_manto', 'sb_caceria'], two: {}, three: {}, twoText: '', threeText: '' },
    { id: 'b_furia', cls: 'barbaro', name: 'Furia', icon: '🔥', noSet: true, spells: ['b_grito', 'b_colosal', 'b_pacto', 'b_cuchillada', 'b_mirada', 'b_frenesi', 'bb_inagotable', 'bb_negarse', 'bb_torbellino', 'bb_sangre', 'bb_imparable', 'bb_titanico', 'bb_reaccion', 'bb_carga', 'bb_resiliencia', 'bb_matasangre'], two: {}, three: {}, twoText: '', threeText: '' },
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
/** ¿Es una bendición pasiva? */
export const isBlessing = (id: string): boolean => !!BLESSINGS[id];

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
export const MAX_BOONS = 9;

/** Consumibles: qué son y cuánto valen en la tienda. */
export const CONSUMABLES: Record<string, { name: string; icon: string; price: number }> = {
  c_vida: { name: 'Poción de curación', icon: '🧪', price: 30 },
  c_fuego: { name: 'Bomba de fuego', icon: '💣', price: 40 },
  c_humo: { name: 'Bomba de humo', icon: '💨', price: 35 },
  c_resu: { name: 'Poción de resurrección', icon: '🕊️', price: 90 },
};
export const MAX_CONSUMABLE = 3;
