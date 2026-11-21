// Clases y sus kits iniciales: cada héroe empieza con 3 habilidades (el kit Clásico o uno desbloqueado con maestría).
import type { ClassId } from '../state';

export interface RouteDef {
  id: string;
  name: string;
  /** (sin uso: ya no hay rutas opuestas) */
  opposite: string;
  spells: string[];
  text: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  hp: number;
  armor: number;
  power: number;
  crit: number;
  ap: number;
  mp: number;
  initiative: number;
  /** las 3 habilidades iniciales: 2 de daño y 1 de potenciación propia */
  base: string[];
  /** placaje (retener al que huye) y huida (escapar del placaje) */
  tackle: number;
  dodge: number;
  routes: RouteDef[];
  /** retirada de la selección (sus hechizos se conservan para el futuro) */
  hidden?: boolean;
}

const R = (id: string, name: string, opposite: string, spells: string[], text: string): RouteDef => ({ id, name, opposite, spells, text });

export const CLASSES: Record<ClassId, ClassDef> = {
  guerrero: {
    hidden: true, id: 'guerrero', name: 'Guerrero', hp: 64, armor: 2, power: 0, crit: 5, ap: 6, mp: 3, initiative: 10, base: ['tajo', 'hachazo', 'sed_sangre'], tackle: 8, dodge: 2,
    routes: [
      R('base', 'Clásico', '', ['tajo', 'hachazo', 'sed_sangre'], 'El kit inicial: dos ataques y una potenciación propia.'),
      R('baluarte', 'Baluarte', '', ['tajo', 'embate', 'muro'], 'Tanque: escudos y protección de aliados.'),
      R('berserker', 'Berserker', '', ['frenesi', 'sed', 'torbellino'], 'Daño bruto pagado con tu propia vida.'),
      R('caudillo', 'Caudillo', '', ['tajo', 'hachazo', 'arenga'], 'Apoyo: da PA y PM al grupo.'),
      R('duelista', 'Duelista', '', ['estocada', 'desarmar', 'ejecucion'], 'Un solo objetivo: movilidad y anulación.'),
    ],
  },
  mago: {
    hidden: true, id: 'mago', name: 'Mago', hp: 42, armor: 0, power: 1, crit: 5, ap: 6, mp: 3, initiative: 14, base: ['dardo', 'chispa', 'escudo_arcano'], tackle: 2, dodge: 4,
    routes: [
      R('base', 'Clásico', '', ['dardo', 'chispa', 'escudo_arcano'], 'El kit inicial: dos ataques y una potenciación propia.'),
      R('fuego', 'Fuego', '', ['ignicion', 'bola', 'lluvia'], 'Daño en área y Quemadura.'),
      R('hielo', 'Hielo', '', ['escarcha', 'congelar', 'ventisca'], 'Control: quita PM y congela.'),
      R('tormenta', 'Tormenta', '', ['rayo', 'vendaval', 'tempestad'], 'Quita PA y recoloca enemigos.'),
      R('arcano', 'Arcano', '', ['dardo', 'barrera', 'impulso'], 'Escudos y PA para los aliados.'),
    ],
  },
  picaro: {
    hidden: true, id: 'picaro', name: 'Pícaro', hp: 50, armor: 1, power: 0, crit: 15, ap: 7, mp: 4, initiative: 16, base: ['punalada', 'cuchillo', 'desvanecer'], tackle: 3, dodge: 9,
    routes: [
      R('base', 'Clásico', '', ['punalada', 'cuchillo', 'desvanecer'], 'El kit inicial: dos ataques y una potenciación propia.'),
      R('veneno', 'Veneno', '', ['daga_ven', 'nube', 'toxina'], 'Daño por turno que se acumula.'),
      R('asesino', 'Asesino', '', ['apunalar', 'emboscada', 'golpe_mortal'], 'Daño directo a un objetivo.'),
      R('sombras', 'Sombras', '', ['punalada', 'punto_debil', 'golpe_bajo'], 'Debilita: quita PA, marca y aturde.'),
      R('acrobata', 'Acróbata', '', ['punalada', 'voltereta', 'evasion'], 'Movilidad, evasión y apoyo.'),
    ],
  },
  clerigo: {
    hidden: true, id: 'clerigo', name: 'Clérigo', hp: 56, armor: 1, power: 0, crit: 5, ap: 6, mp: 3, initiative: 8, base: ['maza', 'castigo', 'fervor'], tackle: 4, dodge: 3,
    routes: [
      R('base', 'Clásico', '', ['maza', 'castigo', 'fervor'], 'El kit inicial: dos ataques y una potenciación propia.'),
      R('luz', 'Luz', '', ['maza', 'sanar', 'aura'], 'Curación directa y en área.'),
      R('penitencia', 'Penitencia', '', ['flagelo', 'expiar', 'martirio'], 'Daño sagrado con robo de vida.'),
      R('egida', 'Égida', '', ['maza', 'custodia', 'consagrar'], 'Escudos para todo el grupo.'),
      R('juicio', 'Juicio', '', ['marca', 'sentencia', 'veredicto'], 'Marca, debilita y aturde.'),
    ],
  },
  arquero: {
    id: 'arquero', name: 'Arquero', hp: 60, armor: 0, power: 0, crit: 10, ap: 6, mp: 3, initiative: 15, base: ['flecha', 'tiro_rasante', 'ojo_halcon'], tackle: 2, dodge: 6,
    routes: [
      R('base', 'Clásico', '', ['flecha', 'tiro_rasante', 'ojo_halcon'], 'El kit inicial: dos ataques y una potenciación propia.'),
      R('francotirador', 'Francotirador', '', ['certero', 'marca_caza', 'perforante'], 'Un disparo lejano y devastador.'),
      R('rafaga', 'Ráfaga', '', ['rapido', 'andanada', 'salto_atras'], 'Muchos disparos baratos y movilidad.'),
      R('trampero', 'Trampero', '', ['flecha_hielo', 'cepo', 'red'], 'Control: cepos, escarcha y redes.'),
      R('bestias', 'Señor de bestias', '', ['flecha', 'lobo', 'orden'], 'Un lobo lucha a tu lado.'),
    ],
  },
  zorro: {
    id: 'zorro', name: 'Hechicera Zorro', hp: 60, armor: 0, power: 0, crit: 8, ap: 6, mp: 3, initiative: 15, base: ['z_orbe', 'z_encanto', 'z_impulso'], tackle: 1, dodge: 7,
    routes: [
      R('base', 'Clásico', '', ['z_orbe', 'z_encanto', 'z_impulso'], 'El kit inicial: un orbe que rebota, un encanto y un salto espiritual.'),
    ],
  },
  esferas: {
    id: 'esferas', name: 'Tejedora de Esferas', hp: 60, armor: 0, power: 0, crit: 5, ap: 6, mp: 4, initiative: 12, base: ['t_pulso', 't_dispersion', 't_descarga'], tackle: 1, dodge: 5,
    routes: [
      R('base', 'Clásico', '', ['t_pulso', 't_dispersion', 't_descarga'], 'El kit inicial: siembra esferas, dispérsalas contra el enemigo y descárgalas todas de golpe.'),
    ],
  },
  acechador: {
    id: 'acechador', name: 'Acechador de Sombras', hp: 60, armor: 0, power: 0, crit: 8, ap: 6, mp: 3, initiative: 16, base: ['s_shuriken', 's_tajo', 's_sombra'], tackle: 3, dodge: 6,
    routes: [
      R('base', 'Clásico', '', ['s_shuriken', 's_tajo', 's_sombra'], 'El kit inicial: un shuriken, un tajo a tu alrededor y una Sombra que repite tus golpes.'),
    ],
  },
  barbaro: {
    id: 'barbaro', name: 'Bárbaro Desatado', hp: 60, armor: 1, power: 0, crit: 5, ap: 6, mp: 3, initiative: 11, base: ['b_sed', 'b_tajo', 'b_embiste'], tackle: 8, dodge: 3,
    routes: [
      R('base', 'Clásico', '', ['b_sed', 'b_tajo', 'b_embiste'], 'El kit inicial: cúrate con tu Furia, golpea con el Tajo y entra en combate con el Embiste.'),
    ],
  },
  arquitecto: {
    id: 'arquitecto', name: 'Arquitecto Rúnico', hp: 60, armor: 1, power: 0, crit: 5, ap: 6, mp: 3, initiative: 9, base: ['r_glifo', 'r_barrera', 'r_lanza'], tackle: 4, dodge: 3,
    routes: [
      R('base', 'Clásico', '', ['r_glifo', 'r_barrera', 'r_lanza'], 'El kit inicial: un glifo explosivo, una barrera para el grupo y una lanza que perfora armadura.'),
    ],
  },
  pistolero: {
    id: 'pistolero', name: 'Pistolero Arcano', hp: 60, armor: 0, power: 0, crit: 12, ap: 6, mp: 4, initiative: 17, base: ['g_disparo', 'g_rebote', 'g_recarga'], tackle: 2, dodge: 7,
    routes: [
      R('base', 'Clásico', '', ['g_disparo', 'g_rebote', 'g_recarga'], 'El kit inicial: un disparo que carga el tambor, un tiro que rebota y una recarga acrobática.'),
    ],
  },
  carcelero: {
    id: 'carcelero', name: 'Carcelero de Almas', hp: 60, armor: 1, power: 0, crit: 5, ap: 6, mp: 4, initiative: 9, base: ['k_sentencia', 'k_linterna', 'k_guadana'], tackle: 6, dodge: 2,
    routes: [
      R('base', 'Clásico', '', ['k_sentencia', 'k_linterna', 'k_guadana'], 'El kit inicial: un gancho que hace sangrar, una linterna salvavidas y una guadaña que se carga.'),
    ],
  },
};

/** Pasiva propia de cada clase (para la ficha y la comparación del grupo). */
export const CLASS_PASSIVE: Partial<Record<ClassId, { name: string; icon: string; text: string }>> = {
  zorro: { name: 'Robo de esencia', icon: '🦊', text: 'Cada habilidad que acierta da 1 carga de esencia. Con las cargas completas, tu siguiente habilidad de daño te cura el 15% de la vida.' },
  esferas: { name: 'Esferas oscuras', icon: '🔮', text: 'Tus hechizos dejan esferas oscuras en el tablero (máx. 3). Otros hechizos las usan para golpear desde ellas o detonarlas.' },
  acechador: { name: 'Sombra viviente', icon: '👤', text: 'Tus Sombras replican tus golpes y puedes intercambiarte con ellas ignorando el placaje. Rematar a un enemigo marcado te da ventaja.' },
  carcelero: { name: 'Cosecha de almas', icon: '💀', text: 'Cada enemigo que muere cerca deja un alma. Cada 5 almas de la partida: +0,5 de armadura permanente. Las almas sin gastar alimentan hechizos como la Guadaña o la Siega.' },
  barbaro: { name: 'Furia', icon: '🔥', text: '+20 de Furia al golpear y +10 al recibir daño. Cada 40: +1 de daño; cada 20: +6% de crítico. Si pasas un turno sin pelear, pierdes 20.' },
  arquitecto: { name: 'Geometría Bélica', icon: '🔷', text: 'Al empezar tu turno sobre o junto a uno de tus glifos: ganas 4 de escudo y tu siguiente hechizo de daño hace +2.' },
  pistolero: { name: 'Cargador arcano', icon: '🔫', text: 'Cada disparo suma 1 carga (máx. 4). Con el cargador lleno, el siguiente disparo es un crítico seguro con +6 de daño elemental y vacía el tambor.' },
  arquero: { name: 'Distancia letal', icon: '🏹', text: 'Tus golpes hacen +1 de daño por cada casilla de distancia más allá de 3 (máx. +3 a 6 casillas o más). Colocarte lejos es tu recurso.' },
};

/** Se elige un solo kit inicial. */
export const MAX_ROUTES = 1;

export function findRoute(cls: ClassId, routeId: string): RouteDef | undefined {
  return CLASSES[cls].routes.find((r) => r.id === routeId);
}

/** Ya no hay rutas bloqueadas: solo se elige un kit. */
export function blockedRoutes(_cls: ClassId, _chosen: readonly string[]): string[] {
  return [];
}

export function canPickRoute(cls: ClassId, chosen: readonly string[], routeId: string): boolean {
  return !!findRoute(cls, routeId) && chosen.length === 0;
}

export const MAX_LEVEL = 12;

/** Las 3 habilidades del kit elegido (por defecto, el Clásico). */
export function spellsFor(cls: ClassId, chosen: readonly string[], _level = 1): string[] {
  const c = CLASSES[cls];
  return [...(chosen.map((r) => findRoute(cls, r)).find((r) => r)?.spells ?? c.base)];
}

/** Clases que se pueden elegir. */
export const PLAYABLE: ClassId[] = (['zorro', 'esferas', 'acechador', 'carcelero', 'barbaro', 'arquitecto', 'pistolero', 'arquero'] as ClassId[]).filter((c) => !CLASSES[c].hidden);
