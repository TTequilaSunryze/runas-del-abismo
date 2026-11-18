// Tipos del estado del juego. Todo es JSON plano: guardar = JSON.stringify.
import type { RngBox } from './rng';

export interface Pos {
  x: number;
  y: number;
}

export type Team = 'hero' | 'enemy';
/** empower: +daño (stacks = %); reach: +alcance; invis: no se le puede apuntar; exposed: -armadura (stacks). */
export type StatusKind = 'burn' | 'poison' | 'slow' | 'stun' | 'mark' | 'empower' | 'reach' | 'invis' | 'exposed' | 'charm'
  | 'vuln' | 'bleed' | 'hobble' | 'guarded' | 'deathmark' | 'verdugo' | 'frenzy' | 'orbita' | 'chained';
export type ClassId = 'guerrero' | 'mago' | 'clerigo' | 'picaro' | 'arquero' | 'zorro' | 'esferas' | 'carcelero' | 'acechador' | 'barbaro';

export interface StatusState {
  turns: number;
  stacks: number;
  /** unidad que aplicó el estado (Encantado, Marca de la muerte, Guardián, Verdugo…) */
  from?: number;
  /** Cadenas vinculantes: la otra unidad encadenada */
  link?: number;
}

export type Element = 'fire' | 'ice' | 'poison' | 'shadow' | 'holy';

export interface SpellSlot {
  id: string;
  cd: number;
  /** runa engarzada */
  imbue?: 'fuego' | 'vampiro' | 'veneno';
  /** mejoras elegidas al subir de nivel (ids de UPGRADES) */
  ups?: string[];
  /** consumibles: usos que quedan (sin definir = hechizo normal) */
  charges?: number;
  /** acción temporal (Recorrer la cadena, Tomar la linterna): desaparece cuando deja de servir */
  temp?: boolean;
  /** veces que se ha lanzado en este turno */
  uses?: number;
  /** el próximo lanzamiento no cuesta PA (Impulso espiritual tras rematar) */
  free?: boolean;
}

export interface Unit {
  id: number;
  team: Team;
  /** id de clase (héroes) o de enemigo (ver content/) */
  kind: string;
  name: string;
  /** jugador que lo controla; null = IA */
  owner: string | null;
  pos: Pos;
  hp: number;
  maxHp: number;
  shield: number;
  armor: number;
  /** % de daño extra */
  power: number;
  /** % de daño extra con hechizos físicos o mágicos (equipo) */
  powerPhys?: number;
  powerMagic?: number;
  /** % de crítico */
  crit: number;
  ap: number;
  maxAp: number;
  mp: number;
  maxMp: number;
  initiative: number;
  /** PA/PM extra (o de menos, si es negativo) que se aplican al empezar su próximo turno */
  apMod: number;
  mpMod: number;
  /** % de daño que resiste de cada elemento (negativo = debilidad) */
  resist: Partial<Record<Element, number>>;
  /** turnos extra de los estados que aplica */
  statusBonus: number;
  statuses: Partial<Record<StatusKind, StatusState>>;
  spells: SpellSlot[];
  ai: 'melee' | 'ranged' | 'boss' | 'pillar' | 'champ' | 'decoy' | null;
  /**
   * Rasgos especiales: puddle (al morir deja una casilla pegajosa), guard (empieza su turno con escudo),
   * devour (se cura comiendo cadáveres), raise (alza muertos), ghost (atraviesa obstáculos),
   * hunter (persigue al héroe más frágil), pack (más daño por cada compañero de manada vivo).
   * De sets de equipo: venom (+1 carga a sus venenos), ignite (su daño quema), execute (críticos x2),
   * mender (+30% a curas y escudos que da).
   * Más rasgos: bomb (explota al morir), split (se divide al morir), regen (se cura cada turno),
   * thorns (devuelve daño cuerpo a cuerpo), enrage (más daño por debajo de la mitad), trapper (pone cepos),
   * blink (aparece junto a su presa).
   */
  traits?: string[];
  /** cadáver ya usado (devorado o alzado) */
  used?: boolean;
  /** fase del jefe (1 o 2) */
  phase?: number;
  /** unidad que lo invocó */
  summoner?: number;
  /** Robo de esencia (Hechicera Zorro): 0 a 3 cargas */
  essence?: number;
  /** Cosecha de almas (Carcelero): almas de toda la partida (dan armadura) */
  souls?: number;
  /** almas que puede gastar (Explosión de almas) */
  soulBank?: number;
  /** almas gastadas en el lanzamiento en curso */
  spentSouls?: number;
  /** almas cosechadas en este combate (Guadaña segadora) */
  soulsFight?: number;
  /** Guadaña segadora: el próximo ataque de este turno pega más */
  reaper?: boolean;
  /** v11 bendiciones: banderas de turno o de combate */
  reflexRound?: number;
  mistWalk?: boolean;
  symphony?: boolean;
  gravHit?: boolean;
  twinBlades?: boolean;
  huntUsed?: boolean;
  shadowSaved?: boolean;
  bloodUsed?: boolean;
  behindNow?: boolean;
  egidaRound?: number;
  firstCast?: boolean;
  tearUsed?: boolean;
  /** Furia del Bárbaro (0 a 100) */
  fury?: number;
  /** ha atacado o recibido daño desde su último turno (si no, pierde Furia) */
  furyHot?: boolean;
  /** Negarse a morir ya usado en este combate */
  undying?: boolean;
  /** PA de descuento en su próximo hechizo de este turno (Danza de las nueve colas) */
  discount?: number;
  /** este turno su Sombra y él golpearon al mismo enemigo (Cosecha oscura) */
  syncHit?: boolean;
  /** enemigo enganchado este turno por Sentencia de muerte */
  hooked?: number;
  /** élites y jefes: inmunes a aturdir y resisten la pérdida de PA/PM y los empujones */
  rank?: 'elite' | 'boss';
  /** placaje (retiene a quien se aleja) y huida (escapa del placaje) */
  tackle?: number;
  dodge?: number;
}

/** Cepo colocado por una unidad: daña y detiene al primer rival que lo pisa. */
export interface Snare {
  k: string;
  team: Team;
  dmg: number;
}

/**
 * Marcador en el suelo vinculado a una unidad (Esferas oscuras, Almas, Linternas…).
 * No bloquea el paso ni la visión y no tiene turno. Caduca al empezar los turnos de su dueño
 * (o al empezar cada ronda si no tiene dueño) y desaparece si su dueño muere.
 */
export interface BoardMark {
  id: number;
  kind: string;
  pos: Pos;
  team: Team;
  /** unidad dueña; sin dueño = caduca por rondas */
  owner?: number;
  /** turnos que le quedan */
  turns: number;
}

export interface CombatState extends RngBox {
  version: 1;
  /** fase de colocación inicial: casillas de despliegue ("x,y") y jugadores listos; mientras exista, no hay turno */
  deploy?: { cells: string[]; ready: string[] } | null;
  w: number;
  h: number;
  /** casillas bloqueadas, como "x,y" */
  obstacles: string[];
  /** casillas con púas: dañan a quien las pisa */
  traps: string[];
  /** casillas pegajosas: detienen al héroe que entra */
  puddles: string[];
  snares?: Snare[];
  /** marcadores en el suelo (ver BoardMark) */
  marks?: BoardMark[];
  units: Unit[];
  /** ids de unidad en orden de iniciativa */
  order: number[];
  turn: number;
  round: number;
  over: null | 'win' | 'lose';
  nextId: number;
}

/** Lo que pasó al ejecutar una acción; el render lo anima y la red lo reenvía. */
export type GameEvent =
  | { t: 'turn'; unit: number; round: number }
  | { t: 'move'; unit: number; path: Pos[] }
  | { t: 'cast'; unit: number; spell: string; at: Pos; element?: Element }
  | { t: 'damage'; unit: number; amount: number; absorbed: number; crit: boolean; source: string }
  | { t: 'heal'; unit: number; amount: number }
  | { t: 'shield'; unit: number; amount: number }
  | { t: 'status'; unit: number; kind: StatusKind; turns: number }
  | { t: 'push'; unit: number; to: Pos }
  | { t: 'skip'; unit: number; reason: StatusKind }
  | { t: 'death'; unit: number }
  | { t: 'summon'; unit: number }
  | { t: 'phase'; unit: number; phase: number }
  | { t: 'trap'; unit: number }
  | { t: 'stuck'; unit: number }
  | { t: 'snare'; unit: number }
  | { t: 'drain'; unit: number; ap: number; mp: number }
  | { t: 'resist'; unit: number; what: string }
  | { t: 'tackle'; unit: number; lost: number }
  | { t: 'revive'; unit: number }
  | { t: 'explode'; unit: number }
  | { t: 'split'; unit: number }
  | { t: 'blink'; unit: number; to: Pos }
  | { t: 'devour'; unit: number; corpse: number }
  | { t: 'raise'; unit: number; corpse: number }
  | { t: 'soul'; unit: number; armor: number }
  /** la Sombra replica un hechizo desde su casilla */
  | { t: 'echo'; unit: number; from: Pos; at: Pos; element?: Element }
  | { t: 'reset'; unit: number; spell: string }
  | { t: 'fury'; unit: number; value: number }
  | { t: 'flame'; unit: number; from: Pos; at: Pos }
  | { t: 'detonate'; unit: number; amount: number }
  | { t: 'caged'; unit: number }
  | { t: 'markAdd'; kind: string; at: Pos }
  | { t: 'markGone'; kind: string; at: Pos }
  | { t: 'markMove'; kind: string; from: Pos; to: Pos }
  | { t: 'over'; result: 'win' | 'lose' };

export const key = (p: Pos): string => `${p.x},${p.y}`;

export function serialize(state: CombatState): string {
  return JSON.stringify(state);
}

export function deserialize(text: string): CombatState {
  const s = JSON.parse(text) as CombatState;
  if (s.version !== 1) throw new Error('Versión de guardado no compatible');
  return s;
}
