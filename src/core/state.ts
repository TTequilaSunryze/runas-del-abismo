// Tipos del estado del juego. Todo es JSON plano: guardar = JSON.stringify.
import type { RngBox } from './rng';

export interface Pos {
  x: number;
  y: number;
}

export type Team = 'hero' | 'enemy';
export type StatusKind = 'burn' | 'poison' | 'slow' | 'stun' | 'mark';
export type ClassId = 'guerrero' | 'mago' | 'clerigo' | 'picaro';

export interface StatusState {
  turns: number;
  stacks: number;
}

export type Element = 'fire' | 'ice' | 'poison' | 'shadow' | 'holy';

export interface SpellSlot {
  id: string;
  cd: number;
  /** runa engarzada */
  rune?: string;
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
  ai: 'melee' | 'ranged' | 'boss' | null;
  /** fase del jefe (1 o 2) */
  phase?: number;
}

export interface CombatState extends RngBox {
  version: 1;
  w: number;
  h: number;
  /** casillas bloqueadas, como "x,y" */
  obstacles: string[];
  /** casillas con púas: dañan a quien las pisa */
  traps: string[];
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
