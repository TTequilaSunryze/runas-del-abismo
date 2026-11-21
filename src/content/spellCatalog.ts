// Fase H1: catálogo de habilidades por clase (4 iniciales + 10 alternativas = 14), hecho solo con habilidades que ya
// existen en SPELLS. Es un dato: todavía no cambia qué habilidades tiene un héroe en partida (eso llegará con el
// configurador, H3). Los huecos se marcan como `missing` y no se rellenan con contenido inventado (H5).
import type { ClassId } from '../core/state';

/** Una dependencia: la habilidad funciona mucho mejor (o solo) si llevas alguna de estas. */
export interface Need { label: string; anyOf: string[] }

export interface ClassCatalog {
  /** las 4 iniciales (disponibles desde el principio) */
  starters: string[];
  /** alternativas existentes (se desbloquearán con ecos en H2); hasta 10 */
  alts: string[];
  /** cuántas alternativas faltan para llegar a 10 (contenido por crear) */
  missing: number;
  /** existentes que se dejan fuera del catálogo por repetir una mecánica (no se borran) */
  excluded: Array<{ id: string; reason: string }>;
}

export const STARTERS = 4;
export const ALTS = 10;
export const CATALOG_SIZE = STARTERS + ALTS;

export const SPELL_CATALOG: Record<string, ClassCatalog> = {
  zorro: {
    starters: ['z_orbe', 'z_encanto', 'z_impulso', 'z_fuego'],
    alts: ['z_espejismo', 'z_vortice', 'z_seduccion', 'z_estallido', 'z_vinculo', 'z_drenaje', 'z_colas', 'z_maldicion', 'z_velo', 'z_resguardo'],
    missing: 0,
    excluded: [],
  },
  esferas: {
    starters: ['t_pulso', 't_dispersion', 't_descarga', 't_transfusion'],
    alts: ['t_voluntad', 't_gravedad', 't_orbita', 't_resonancia', 't_singularidad', 't_semilla', 't_implosion', 't_pozo', 't_vacio', 't_eclipse'],
    missing: 0,
    excluded: [],
  },
  acechador: {
    starters: ['s_shuriken', 's_tajo', 's_sombra', 's_paso'],
    alts: ['s_marca', 's_danza', 's_velo', 's_convergencia', 's_cosecha', 's_kunai', 's_hoja', 's_ejecucion', 's_garrote', 's_bruma'],
    missing: 0,
    excluded: [{ id: 's_ocaso', reason: 'Mismo efecto que Velo espectral de la Zorro (invisible y +2 PM) y que Velo de penumbra.' }],
  },
  carcelero: {
    starters: ['k_sentencia', 'k_linterna', 'k_guadana', 'k_atraccion'],
    alts: ['k_caja', 'k_explosion', 'k_vinculo', 'k_siega', 'k_sacrificio', 'k_despellejar', 'k_grilletes', 'k_condena', 'k_azote', 'k_alma'],
    missing: 0,
    excluded: [
      { id: 'k_cosecha', reason: 'Escudo por alma: lo mismo que Atracción del abismo.' },
      { id: 'k_tormento', reason: 'Arco frontal de 3 casillas: lo mismo que Corte de guadaña.' },
      { id: 'k_huesos', reason: 'Escudo plano sin relación con las almas.' },
    ],
  },
  barbaro: {
    starters: ['b_sed', 'b_tajo', 'b_embiste', 'b_grito'],
    alts: ['b_colosal', 'b_pacto', 'b_cuchillada', 'b_mirada', 'b_frenesi', 'b_salto', 'b_piel', 'b_arenga', 'b_decapitar', 'b_agarre'],
    missing: 0,
    excluded: [],
  },
  arquitecto: {
    starters: ['r_glifo', 'r_barrera', 'r_lanza', 'r_pulsar'],
    alts: ['r_gravedad', 'r_baluarte', 'r_cercado', 'r_inercia', 'r_arquitectonico', 'r_sello', 'r_sobrecarga', 'r_matriz', 'r_ciudadela', 'r_runa'],
    missing: 0,
    excluded: [],
  },
  pistolero: {
    starters: ['g_disparo', 'g_rebote', 'g_recarga', 'g_trazadora'],
    alts: ['g_abanico', 'g_rodilla', 'g_danza', 'g_mina', 'g_certero', 'g_humo', 'g_plata', 'g_gancho', 'g_tambor', 'g_bengala'],
    missing: 0,
    excluded: [],
  },
  arquero: {
    starters: ['flecha', 'tiro_rasante', 'ojo_halcon', 'a_campo'],
    alts: ['a_letal', 'a_abanico', 'a_ignea', 'a_conmocion', 'a_halcon', 'perforante', 'salto_atras', 'flecha_hielo', 'red', 'orden'],
    missing: 0,
    excluded: [
      { id: 'certero', reason: 'Disparo lejano de mucho daño: lo mismo que Disparo letal.' },
      { id: 'rapido', reason: 'Una Flecha más barata y débil.' },
      { id: 'cepo', reason: 'Campo de cepos es la versión mejorada.' },
      { id: 'lobo', reason: 'Compañero único a la vez: lo mismo que Halcón.' },
      { id: 'andanada', reason: 'Disparo en área 1: lo mismo que Abanico.' },
      { id: 'marca_caza', reason: 'Marca genérica (+2 de daño recibido) que ya tienen otras clases.' },
    ],
  },
};

/**
 * Dependencias que el configurador (H3) mostrará como aviso, nunca como bloqueo: la habilidad necesita algo que
 * genere su recurso.
 */
const SPHERES: Need = { label: 'Necesita algo que cree Esferas oscuras', anyOf: ['t_pulso', 't_singularidad', 't_semilla'] };
const SHADOW: Need = { label: 'Necesita algo que cree una Sombra', anyOf: ['s_sombra', 's_velo', 's_marca'] };
const GLYPHS: Need = { label: 'Necesita algo que dibuje glifos', anyOf: ['r_glifo', 'r_ciudadela'] };
const FURY: Need = { label: 'Necesita algo que genere Furia', anyOf: ['b_tajo', 'b_embiste', 'b_grito', 'b_cuchillada', 'b_pacto', 'b_mirada'] };
const CHARGES: Need = { label: 'Necesita disparos que llenen el cargador', anyOf: ['g_disparo', 'g_rebote', 'g_recarga'] };
const COMPANION: Need = { label: 'En solitario necesita un compañero (Halcón)', anyOf: ['a_halcon'] };
export const SPELL_NEEDS: Record<string, Need> = {
  t_descarga: SPHERES, t_voluntad: SPHERES, t_gravedad: SPHERES, t_orbita: SPHERES, t_resonancia: SPHERES, t_transfusion: SPHERES, t_implosion: SPHERES,
  s_cosecha: SHADOW, s_convergencia: SHADOW,
  r_pulsar: GLYPHS, r_arquitectonico: GLYPHS,
  b_sed: FURY, b_colosal: FURY, b_frenesi: FURY, b_piel: FURY, b_decapitar: FURY,
  g_tambor: CHARGES,
  orden: COMPANION,
};

/** Habilidades temporales: no ocupan ranura; aparecen cuando está equipada la que las da. */
export const TEMP_FROM: Record<string, string[]> = {
  s_cambio: ['s_sombra', 's_velo', 's_marca'],
  k_viaje: ['k_sentencia'],
  k_farol: ['k_linterna'],
};

export const catalogOf = (cls: ClassId): ClassCatalog | undefined => SPELL_CATALOG[cls];
/** Las 14 (o menos, si faltan alternativas) de una clase. */
export const catalogSpells = (cls: ClassId): string[] => { const c = SPELL_CATALOG[cls]; return c ? [...c.starters, ...c.alts] : []; };
/** Clase a la que pertenece una habilidad del catálogo. */
export const catalogClassOf = (id: string): ClassId | undefined => (Object.keys(SPELL_CATALOG) as ClassId[]).find((c) => catalogSpells(c).includes(id));

/** Comprueba una configuración de 4: de la clase, sin repetir y (si se da `owned`) desbloqueadas. */
export function kitProblem(cls: ClassId, ids: readonly string[], owned?: readonly string[]): string | null {
  const all = catalogSpells(cls);
  if (ids.length !== STARTERS) return `Elige ${STARTERS} habilidades.`;
  if (new Set(ids).size !== ids.length) return 'No repitas habilidades.';
  const bad = ids.find((id) => !all.includes(id));
  if (bad) return 'Esa habilidad no es de tu clase.';
  const c = SPELL_CATALOG[cls]!;
  if (owned) { const locked = ids.find((id) => !c.starters.includes(id) && !owned.includes(id)); if (locked) return 'Aún no has desbloqueado esa habilidad.'; }
  return null;
}

/** Avisos de una configuración: habilidades cuyo recurso no genera nadie del kit. */
export function kitWarnings(ids: readonly string[]): Array<{ id: string; text: string }> {
  return ids.filter((id) => SPELL_NEEDS[id] && !SPELL_NEEDS[id]!.anyOf.some((p) => ids.includes(p))).map((id) => ({ id, text: SPELL_NEEDS[id]!.label }));
}
