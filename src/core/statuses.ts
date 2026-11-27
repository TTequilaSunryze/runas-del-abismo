// Catálogo de estados alterados: una sola fuente de verdad para el motor, las runas y la interfaz.
// Los ids internos son estables (las partidas guardadas los llevan); lo que cambia aquí es su regla.
import type { StatusKind } from './state';

/** Para qué sirve el estado: lo usan la interfaz, las runas y las reglas de jefes. */
export type StatusCat = 'dot' | 'control' | 'debuff' | 'buff' | 'mark' | 'manip';
/**
 * Cómo se acumula al volver a aplicarlo:
 * - add: suma cargas (hasta `max`) y se queda con la duración más larga.
 * - max: se queda con las cargas y la duración más altas (no crece).
 */
export type StackRule = 'add' | 'max';
/**
 * Cómo lo reciben élites y jefes:
 * - full: igual que cualquiera.
 * - partial: versión reducida (ver `rankText`). Los jefes nunca son inmunes a todo.
 */
export type RankRule = 'full' | 'partial';

export interface StatusInfo {
  kind: StatusKind;
  name: string;
  icon: string;
  color: string;
  cat: StatusCat;
  /** perjudica a quien lo lleva (lo bloquean Inmune y Barrera, y lo elimina la purificación) */
  negative: boolean;
  stack: StackRule;
  /** tope de cargas (solo con stack = add) */
  max: number;
  rank: RankRule;
  /** regla para el jugador */
  text: string;
  /** cómo afecta a élites y jefes cuando es distinto */
  rankText?: string;
}

const S = (kind: StatusKind, name: string, icon: string, color: string, cat: StatusCat, negative: boolean, stack: StackRule, max: number, text: string, rank: RankRule = 'full', rankText?: string): StatusInfo =>
  ({ kind, name, icon, color, cat, negative, stack, max, rank, text, ...(rankText ? { rankText } : {}) });

/** Daño por carga de los estados de daño progresivo (al empezar el turno de quien los lleva). */
export const DOT = { burn: 3, burnPerStack: 2, poison: 2, bleed: 2 } as const;
/** Escarcha: cargas que congelan. */
export const FREEZE_AT = 3;
/** Resonancia rúnica: cargas que la hacen estallar y daño por carga. */
export const RESONANCE_AT = 5;
export const RESONANCE_DMG = 4;
/** Condena: fracción del daño recibido que guarda. */
export const DOOM_PCT = 0.5;
/** Debilitado: daño que deja de hacer. */
export const WEAK_PCT = 0.25;
/** Corrupción: curación que deja de recibir. */
export const CORRUPT_HEAL = 0.5;
/** Regeneración: vida por carga al empezar el turno. */
export const REGEN_PER = 3;
/** Choque térmico: daño extra al quemar a un objetivo congelado o con escarcha. */
export const THERMAL_DMG = 6;

export const STATUSES: Record<StatusKind, StatusInfo> = {
  // ---------- daño progresivo ----------
  burn: S('burn', 'Quemadura', '🔥', '#ff8c3a', 'dot', true, 'add', 5, `${DOT.burn} de daño de fuego al empezar el turno, +${DOT.burnPerStack} por carga extra (máx. 5). Quemar a un objetivo con Escarcha o Congelado provoca Choque térmico.`),
  poison: S('poison', 'Veneno', '☠️', '#7fd36a', 'dot', true, 'add', 10, `${DOT.poison} de daño de veneno por carga al empezar el turno (máx. 10). Con Corrupción, un 50% más.`),
  bleed: S('bleed', 'Sangrado', '🩸', '#d0342c', 'dot', true, 'add', 10, `${DOT.bleed} de daño por carga al empezar el turno, ignora la armadura (máx. 10).`),
  // ---------- control ----------
  stun: S('stun', 'Aturdido', '💫', '#ffe066', 'control', true, 'max', 1, 'Pierde su turno.', 'partial', 'Élites y jefes no pierden el turno: pierden 2 PA en el siguiente.'),
  slow: S('slow', 'Ralentizado', '🐌', '#9ab7ff', 'control', true, 'max', 6, 'Pierde 1 PM por carga.'),
  rooted: S('rooted', 'Inmovilizado', '🌿', '#6fae5a', 'control', true, 'max', 1, 'No puede moverse en su turno.', 'partial', 'Jefes: pierden 2 PM en vez de quedarse quietos.'),
  chill: S('chill', 'Escarcha', '❄️', '#a8e4ff', 'control', true, 'add', FREEZE_AT, `Se acumula; con ${FREEZE_AT} cargas, el objetivo queda Congelado.`),
  frozen: S('frozen', 'Congelado', '🧊', '#7fd8ff', 'control', true, 'max', 1, 'Pierde su turno. El fuego lo descongela con Choque térmico.', 'partial', 'Élites y jefes no pierden el turno: pierden 1 PA y 2 PM.'),
  charm: S('charm', 'Encantado', '💗', '#ff8fd0', 'control', true, 'max', 1, 'Recibe más daño de quien lo encantó.'),
  hobble: S('hobble', 'Atrapado', '⛓️', '#b7a37a', 'control', true, 'max', 1, 'Huye peor del placaje.'),
  chained: S('chained', 'Encadenado', '🔗', '#c9b37a', 'manip', true, 'max', 1, 'Vínculo: comparte la mitad del daño con el otro encadenado.'),
  anchor: S('anchor', 'Sello de anclaje', '⚓', '#8fb0d0', 'control', true, 'max', 1, 'Sellado por un glifo: no puede huir del sello.'),
  // ---------- debilitamientos ----------
  exposed: S('exposed', 'Expuesto', '🛡️', '#ffb37a', 'debuff', true, 'max', 8, 'Fractura de armadura: −1 de armadura por carga.'),
  vuln: S('vuln', 'Vulnerable', '🎯', '#ff6f6f', 'debuff', true, 'max', 1, 'Recibe más daño.'),
  mark: S('mark', 'Marcado', '✖️', '#ffcc4d', 'debuff', true, 'max', 1, 'Recibe daño extra de cada golpe.'),
  weak: S('weak', 'Debilitado', '🥀', '#b08ad0', 'debuff', true, 'max', 1, `Hace un ${WEAK_PCT * 100}% menos de daño.`),
  corrupt: S('corrupt', 'Corrupción', '🕳️', '#7a4fa8', 'debuff', true, 'add', 5, `Recibe un ${CORRUPT_HEAL * 100}% menos de curación y su Veneno hace un 50% más. Al morir, contagia Corrupción y Veneno a sus vecinos.`),
  // ---------- marcas y manipulación ----------
  deathmark: S('deathmark', 'Marca de la muerte', '💀', '#c04060', 'mark', true, 'max', 1, 'Guarda parte del daño del Acechador y estalla al final de su turno.'),
  doom: S('doom', 'Condena', '⌛', '#8a2be2', 'mark', true, 'max', 1, `Guarda el ${DOOM_PCT * 100}% de todo el daño que recibe; cuando se acaba, lo recibe de golpe.`),
  resonance: S('resonance', 'Resonancia rúnica', '🔆', '#ffd56a', 'mark', true, 'add', RESONANCE_AT, `Con ${RESONANCE_AT} cargas estalla: ${RESONANCE_DMG} de daño por carga a él y la mitad a sus vecinos.`),
  verdugo: S('verdugo', 'Presa', '🎯', '#ff4d4d', 'mark', true, 'max', 1, 'El Bárbaro va a por ella.'),
  // ---------- beneficios ----------
  empower: S('empower', 'Potenciado', '💪', '#ffd166', 'buff', false, 'max', 99, 'Hace más daño.'),
  reach: S('reach', 'Alcance+', '🏹', '#9ad1ff', 'buff', false, 'max', 9, 'Más alcance.'),
  invis: S('invis', 'Invisible', '👻', '#bfbfff', 'buff', false, 'max', 1, 'No se le puede apuntar.'),
  guarded: S('guarded', 'Protegido', '🛡️', '#9ad1ff', 'buff', false, 'max', 1, 'Otro recibe parte de su daño.'),
  frenzy: S('frenzy', 'Frenesí', '😡', '#ff5f5f', 'buff', false, 'max', 1, 'Inmune a aturdir.'),
  orbita: S('orbita', 'Órbita', '🌀', '#b9a6ff', 'buff', false, 'max', 1, 'El primer golpe cuerpo a cuerpo sale despedido.'),
  silver: S('silver', 'Balas de plata', '🔘', '#dfe6ee', 'buff', false, 'max', 1, 'Sus disparos ignoran la armadura.'),
  smoke: S('smoke', 'En el humo', '🌫️', '#a0a0a0', 'buff', false, 'max', 1, 'Esquiva los ataques a distancia.'),
  immune: S('immune', 'Inmune', '✨', '#fff3b0', 'buff', false, 'max', 1, 'No recibe estados negativos.'),
  kinetic: S('kinetic', 'Barrera cinética', '🧲', '#9ad1ff', 'buff', false, 'max', 1, 'Repele al primer agresor cuerpo a cuerpo.'),
  prism: S('prism', 'Baluarte prismático', '💠', '#a6f0ff', 'buff', false, 'max', 1, 'Devuelve el 15% del daño recibido.'),
  regen: S('regen', 'Regeneración', '🌱', '#7fd36a', 'buff', false, 'add', 5, `Recupera ${REGEN_PER} de vida por carga al empezar el turno (máx. 5).`),
  haste: S('haste', 'Acelerado', '⚡', '#ffe066', 'buff', false, 'max', 2, 'Empieza su turno con +1 PA y +1 PM por carga.'),
  ward: S('ward', 'Barrera rúnica', '🔰', '#c6f0ff', 'buff', false, 'add', 3, 'Cada carga bloquea el siguiente estado negativo que le llegue.'),
  fading: S('fading', 'Desvaneciéndose', '⏳', '#999', 'mark', false, 'max', 1, 'Desaparece al acabarse.'),
};

/** Estados negativos (los bloquean Inmune y Barrera rúnica, y los elimina la purificación). */
export const NEGATIVE_STATUSES: ReadonlySet<StatusKind> = new Set((Object.values(STATUSES) as StatusInfo[]).filter((x) => x.negative).map((x) => x.kind));
/** Estados de daño progresivo. */
export const DOT_STATUSES: readonly StatusKind[] = ['burn', 'poison', 'bleed'];
export const statusName = (k: string): string => STATUSES[k as StatusKind]?.name ?? k;
