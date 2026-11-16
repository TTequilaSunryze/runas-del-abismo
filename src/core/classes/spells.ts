// Definición de hechizos (datos). El motor los interpreta en combat/engine.ts.
import type { StatusKind } from '../state';

export interface SpellDef {
  id: string;
  name: string;
  /** ruta a la que pertenece; 'base' = lo tiene la clase siempre; 'enemy' = de monstruos */
  route: string;
  ap: number;
  cd: number;
  /** alcance mínimo y máximo en casillas; [0,0] = sobre uno mismo */
  range: [number, number];
  /** necesita línea de visión */
  los: boolean;
  target: 'enemy' | 'ally' | 'self';
  /** radio del área alrededor del objetivo (0 = solo el objetivo) */
  area?: number;
  dmg?: [number, number];
  heal?: number;
  shield?: number;
  status?: { kind: StatusKind; turns: number; stacks?: number };
  /** casillas que empuja al objetivo */
  push?: number;
  /** PA que da al objetivo aliado */
  giveAp?: number;
  /** PM que da al objetivo aliado */
  giveMp?: number;
  /** PA que quita al objetivo en su próximo turno */
  drainAp?: number;
  /** vida que paga el lanzador */
  selfDmg?: number;
  /** fracción del daño hecho que cura al lanzador */
  lifesteal?: number;
  /** el lanzador salta junto al objetivo antes de golpear */
  dash?: boolean;
  text: string;
}

const S = (d: SpellDef): SpellDef => d;

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(
  [
    // ---------- Guerrero ----------
    S({ id: 'tajo', name: 'Tajo', route: 'base', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [8, 11], text: 'Golpe cuerpo a cuerpo.' }),
    S({ id: 'muro', name: 'Muro de escudos', route: 'baluarte', ap: 2, cd: 2, range: [0, 0], los: false, target: 'self', shield: 12, text: 'Ganas 12 de escudo.' }),
    S({ id: 'proteger', name: 'Proteger', route: 'baluarte', ap: 2, cd: 2, range: [1, 3], los: true, target: 'ally', shield: 10, text: 'Da 10 de escudo a un aliado.' }),
    S({ id: 'frenesi', name: 'Frenesí', route: 'berserker', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [13, 17], selfDmg: 4, text: 'Golpe brutal que te cuesta 4 de vida.' }),
    S({ id: 'sed', name: 'Sed de sangre', route: 'berserker', ap: 4, cd: 2, range: [1, 1], los: false, target: 'enemy', dmg: [9, 12], lifesteal: 0.5, text: 'Te curas la mitad del daño hecho.' }),
    S({ id: 'arenga', name: 'Arenga', route: 'caudillo', ap: 2, cd: 3, range: [1, 4], los: true, target: 'ally', giveAp: 2, text: 'Un aliado gana 2 PA.' }),
    S({ id: 'avanzad', name: '¡Avanzad!', route: 'caudillo', ap: 2, cd: 2, range: [1, 4], los: true, target: 'ally', giveMp: 3, text: 'Un aliado gana 3 PM.' }),
    S({ id: 'estocada', name: 'Estocada', route: 'duelista', ap: 3, cd: 2, range: [2, 4], los: true, target: 'enemy', dmg: [8, 11], dash: true, text: 'Saltas junto al enemigo y golpeas.' }),
    S({ id: 'desarmar', name: 'Desarmar', route: 'duelista', ap: 3, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [5, 7], drainAp: 3, text: 'El enemigo pierde 3 PA en su turno.' }),
    // ---------- Mago ----------
    S({ id: 'dardo', name: 'Dardo arcano', route: 'base', ap: 3, cd: 0, range: [1, 5], los: true, target: 'enemy', dmg: [6, 9], text: 'Proyectil mágico básico.' }),
    S({ id: 'bola', name: 'Bola de fuego', route: 'fuego', ap: 4, cd: 1, range: [2, 6], los: true, target: 'enemy', area: 1, dmg: [8, 12], status: { kind: 'burn', turns: 3 }, text: 'Explota en área 1 y quema.' }),
    S({ id: 'ignicion', name: 'Ignición', route: 'fuego', ap: 2, cd: 0, range: [1, 5], los: true, target: 'enemy', dmg: [3, 5], status: { kind: 'burn', turns: 3 }, text: 'Daño leve y Quemadura.' }),
    S({ id: 'escarcha', name: 'Escarcha', route: 'hielo', ap: 3, cd: 0, range: [1, 5], los: true, target: 'enemy', dmg: [5, 8], status: { kind: 'slow', turns: 2, stacks: 2 }, text: 'Quita 2 PM durante 2 turnos.' }),
    S({ id: 'congelar', name: 'Congelar', route: 'hielo', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [3, 5], status: { kind: 'stun', turns: 1 }, text: 'Congela: pierde su próximo turno.' }),
    S({ id: 'rayo', name: 'Rayo', route: 'tormenta', ap: 3, cd: 0, range: [1, 6], los: true, target: 'enemy', dmg: [7, 10], drainAp: 1, text: 'Quita 1 PA al objetivo.' }),
    S({ id: 'vendaval', name: 'Vendaval', route: 'tormenta', ap: 3, cd: 2, range: [1, 3], los: true, target: 'enemy', dmg: [4, 6], push: 3, text: 'Empuja 3 casillas; chocar hace daño extra.' }),
    S({ id: 'barrera', name: 'Barrera arcana', route: 'arcano', ap: 2, cd: 2, range: [0, 4], los: true, target: 'ally', shield: 9, text: 'Da 9 de escudo a ti o a un aliado.' }),
    S({ id: 'impulso', name: 'Impulso temporal', route: 'arcano', ap: 3, cd: 3, range: [1, 4], los: true, target: 'ally', giveAp: 3, text: 'Un aliado gana 3 PA.' }),
    // ---------- Clérigo ----------
    S({ id: 'maza', name: 'Maza', route: 'base', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [6, 9], text: 'Golpe cuerpo a cuerpo.' }),
    S({ id: 'sanar', name: 'Sanar', route: 'luz', ap: 3, cd: 0, range: [0, 4], los: true, target: 'ally', heal: 12, text: 'Cura 12 a ti o a un aliado.' }),
    S({ id: 'aura', name: 'Aura de luz', route: 'luz', ap: 4, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, heal: 8, text: 'Cura 8 a todos los aliados en área 2.' }),
    S({ id: 'flagelo', name: 'Flagelo', route: 'penitencia', ap: 3, cd: 0, range: [1, 4], los: true, target: 'enemy', dmg: [11, 14], selfDmg: 3, text: 'Daño sagrado que te cuesta 3 de vida.' }),
    S({ id: 'expiar', name: 'Expiación', route: 'penitencia', ap: 4, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [8, 11], lifesteal: 0.6, text: 'Te curas el 60% del daño hecho.' }),
    S({ id: 'consagrar', name: 'Consagrar', route: 'egida', ap: 3, cd: 2, range: [0, 0], los: false, target: 'ally', area: 2, shield: 7, text: 'Escudo 7 a todos los aliados en área 2.' }),
    S({ id: 'custodia', name: 'Custodia', route: 'egida', ap: 2, cd: 1, range: [1, 4], los: true, target: 'ally', shield: 11, text: 'Escudo 11 a un aliado.' }),
    S({ id: 'marca', name: 'Marca del juicio', route: 'juicio', ap: 2, cd: 1, range: [1, 5], los: true, target: 'enemy', status: { kind: 'mark', turns: 2 }, text: 'El objetivo recibe +30% de daño 2 turnos.' }),
    S({ id: 'sentencia', name: 'Sentencia', route: 'juicio', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [6, 8], status: { kind: 'stun', turns: 1 }, text: 'Daña y aturde 1 turno.' }),
    // ---------- Enemigos (Zona 1) ----------
    S({ id: 'e_golpe', name: 'Golpe', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [5, 7], text: '' }),
    S({ id: 'e_tajo', name: 'Tajo sepulcral', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [8, 10], text: '' }),
    S({ id: 'e_mordisco', name: 'Mordisco', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [3, 5], lifesteal: 0.5, text: '' }),
    S({ id: 'e_flecha', name: 'Flecha de hueso', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [5, 7], text: '' }),
    S({ id: 'e_zarpazo', name: 'Zarpazo pútrido', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [6, 8], status: { kind: 'poison', turns: 3, stacks: 1 }, text: '' }),
  ].map((d) => [d.id, d]),
);
