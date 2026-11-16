// Definición de hechizos (datos). El motor los interpreta en combat/engine.ts.
import type { Element, StatusKind } from '../state';

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
  /** 'cell' = una casilla libre (cepos e invocaciones) */
  target: 'enemy' | 'ally' | 'self' | 'cell';
  /** radio del área alrededor del objetivo (0 = solo el objetivo) */
  area?: number;
  dmg?: [number, number];
  heal?: number;
  shield?: number;
  status?: { kind: StatusKind; turns: number; stacks?: number };
  /** segundo estado (lo añaden las runas) */
  extraStatus?: { kind: StatusKind; turns: number; stacks?: number };
  /** elemento del daño: lo reducen las resistencias */
  element?: Element;
  /** % de crítico extra */
  crit?: number;
  /** escudo que gana el lanzador */
  selfShield?: number;
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
  /** efecto sobre el propio lanzador (potenciarse, alcance, invisibilidad…) */
  buff?: { kind: StatusKind; turns: number; stacks?: number };
  /** cuesta este % de tu vida actual */
  selfDmgPct?: number;
  /** cura un % de la vida máxima del objetivo */
  healPct?: number;
  /** resucita a un aliado caído con este % de vida */
  revive?: number;
  /** PM que gana el lanzador */
  selfMp?: number;
  /** segundo efecto sobre el propio lanzador */
  selfBuff2?: { kind: StatusKind; turns: number; stacks?: number };
  /** te teletransportas a la casilla (objetivo: casilla libre) */
  teleport?: boolean;
  /** ignora la armadura */
  pierce?: boolean;
  /** alcanza a todos los enemigos en la línea hasta el objetivo */
  line?: boolean;
  /** casillas que retrocede el lanzador, alejándose del objetivo */
  retreat?: number;
  /** coloca un cepo en la casilla */
  snare?: { dmg: number };
  /** solo se puede apuntar en línea recta (misma fila o columna) */
  straight?: boolean;
  /** veces que golpea a los enemigos de la línea (el orbe rebota) */
  bounce?: number;
  /** tras teletransportarte, golpea al enemigo más cercano en `radius` casillas */
  followUp?: { dmg: [number, number]; element?: Element; radius: number };
  /** invoca un aliado controlado por la IA (uno a la vez) */
  summon?: { kind: string; name: string; hpPct: number; armor: number; ap: number; mp: number; initiative: number; spell: string };
  text: string;
}

const S = (d: SpellDef): SpellDef => d;

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(
  [
    // ---------- Hechicera Zorro ----------
    S({ id: 'z_orbe', name: 'Orbe del engaño', route: 'base', ap: 3, cd: 0, range: [1, 5], los: true, straight: true, line: true, bounce: 2, target: 'enemy', dmg: [6, 8], element: 'shadow', text: 'Un orbe en línea recta. Golpea a los enemigos del camino al ir y al volver.' }),
    S({ id: 'z_encanto', name: 'Encanto', route: 'base', ap: 2, cd: 2, range: [1, 5], los: true, straight: true, target: 'enemy', status: { kind: 'charm', turns: 1 }, text: 'Encanta al primer enemigo de la línea: en su próximo turno no ataca y se acerca a ti en línea recta gastando todos sus PM.' }),
    S({ id: 'z_impulso', name: 'Impulso espiritual', route: 'base', ap: 3, cd: 0, range: [1, 3], los: false, straight: true, target: 'cell', teleport: true, followUp: { dmg: [5, 7], element: 'shadow', radius: 4 }, text: 'Te desplazas hasta 3 casillas en línea recta ignorando el placaje y lanzas un proyectil al enemigo más cercano a 4 casillas.' }),
    S({ id: 'z_drenaje', name: 'Drenaje de esencia', route: 'boon', ap: 2, cd: 1, range: [1, 3], los: true, target: 'enemy', dmg: [4, 6], element: 'shadow', lifesteal: 1, text: 'Te curas todo el daño que haces.' }),
    S({ id: 'z_velo', name: 'Velo espectral', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', buff: { kind: 'invis', turns: 1 }, selfMp: 2, text: 'Invisible durante 1 turno y ganas 2 PM.' }),
    // ---------- Guerrero ----------
    S({ id: 'tajo', name: 'Tajo', route: 'base', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [8, 11], text: 'Golpe cuerpo a cuerpo.' }),
    S({ id: 'muro', name: 'Muro de escudos', route: 'baluarte', ap: 2, cd: 2, range: [0, 0], los: false, target: 'self', shield: 12, text: 'Ganas 12 de escudo.' }),
    S({ id: 'proteger', name: 'Proteger', route: 'baluarte', ap: 2, cd: 2, range: [1, 3], los: true, target: 'ally', shield: 10, text: 'Da 10 de escudo a un aliado.' }),
    S({ id: 'embate', name: 'Embate de escudo', route: 'baluarte', ap: 3, cd: 2, range: [1, 1], los: false, target: 'enemy', dmg: [6, 8], push: 2, text: 'Golpea y empuja 2 casillas.' }),
    S({ id: 'frenesi', name: 'Frenesí', route: 'berserker', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [13, 17], selfDmg: 4, text: 'Golpe brutal que te cuesta 4 de vida.' }),
    S({ id: 'sed', name: 'Sed de sangre', route: 'berserker', ap: 4, cd: 2, range: [1, 1], los: false, target: 'enemy', dmg: [9, 12], lifesteal: 0.5, text: 'Te curas la mitad del daño hecho.' }),
    S({ id: 'torbellino', name: 'Torbellino', route: 'berserker', ap: 4, cd: 2, range: [0, 0], los: false, target: 'enemy', area: 1, dmg: [9, 12], selfDmg: 3, text: 'Golpea a todos los enemigos a 1 casilla. Te cuesta 3 de vida.' }),
    S({ id: 'arenga', name: 'Arenga', route: 'caudillo', ap: 2, cd: 3, range: [1, 4], los: true, target: 'ally', giveAp: 2, text: 'Un aliado gana 2 PA.' }),
    S({ id: 'avanzad', name: '¡Avanzad!', route: 'caudillo', ap: 2, cd: 2, range: [1, 4], los: true, target: 'ally', giveMp: 3, text: 'Un aliado gana 3 PM.' }),
    S({ id: 'grito', name: 'Grito de guerra', route: 'caudillo', ap: 4, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, giveAp: 1, shield: 5, text: 'Aliados en área 2 (y tú): +1 PA y escudo 5.' }),
    S({ id: 'estocada', name: 'Estocada', route: 'duelista', ap: 3, cd: 2, range: [2, 4], los: true, target: 'enemy', dmg: [8, 11], dash: true, text: 'Saltas junto al enemigo y golpeas.' }),
    S({ id: 'desarmar', name: 'Desarmar', route: 'duelista', ap: 3, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [5, 7], drainAp: 3, text: 'El enemigo pierde 3 PA en su turno.' }),
    S({ id: 'ejecucion', name: 'Ejecución', route: 'duelista', ap: 4, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [14, 18], text: 'Un golpe devastador.' }),
    // ---------- Mago ----------
    S({ id: 'dardo', name: 'Dardo arcano', route: 'base', ap: 3, cd: 0, range: [1, 5], los: true, target: 'enemy', dmg: [6, 9], text: 'Proyectil mágico básico.' }),
    S({ id: 'bola', name: 'Bola de fuego', route: 'fuego', ap: 4, cd: 1, range: [2, 6], los: true, target: 'enemy', area: 1, dmg: [8, 12], status: { kind: 'burn', turns: 3 }, text: 'Explota en área 1 y quema.' }),
    S({ id: 'ignicion', name: 'Ignición', route: 'fuego', ap: 2, cd: 0, range: [1, 5], los: true, target: 'enemy', dmg: [3, 5], status: { kind: 'burn', turns: 3 }, text: 'Daño leve y Quemadura.' }),
    S({ id: 'lluvia', name: 'Lluvia de ascuas', route: 'fuego', ap: 5, cd: 3, range: [2, 6], los: true, target: 'enemy', area: 2, dmg: [6, 8], status: { kind: 'burn', turns: 3 }, text: 'Área 2: daña y quema a todos.' }),
    S({ id: 'escarcha', name: 'Escarcha', route: 'hielo', ap: 3, cd: 0, range: [1, 5], los: true, target: 'enemy', dmg: [5, 8], status: { kind: 'slow', turns: 2, stacks: 2 }, text: 'Quita 2 PM durante 2 turnos.' }),
    S({ id: 'congelar', name: 'Congelar', route: 'hielo', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [3, 5], status: { kind: 'stun', turns: 1 }, text: 'Congela: pierde su próximo turno.' }),
    S({ id: 'ventisca', name: 'Ventisca', route: 'hielo', ap: 4, cd: 3, range: [0, 0], los: false, target: 'enemy', area: 2, dmg: [4, 6], status: { kind: 'slow', turns: 2, stacks: 2 }, text: 'Enemigos en área 2 a tu alrededor: daño y -2 PM.' }),
    S({ id: 'rayo', name: 'Rayo', route: 'tormenta', ap: 3, cd: 0, range: [1, 6], los: true, target: 'enemy', dmg: [7, 10], drainAp: 1, text: 'Quita 1 PA al objetivo.' }),
    S({ id: 'vendaval', name: 'Vendaval', route: 'tormenta', ap: 3, cd: 2, range: [1, 3], los: true, target: 'enemy', dmg: [4, 6], push: 3, text: 'Empuja 3 casillas; chocar hace daño extra.' }),
    S({ id: 'tempestad', name: 'Tempestad', route: 'tormenta', ap: 5, cd: 3, range: [1, 6], los: true, target: 'enemy', area: 1, dmg: [7, 9], drainAp: 1, text: 'Área 1: daña y quita 1 PA a cada uno.' }),
    S({ id: 'barrera', name: 'Barrera arcana', route: 'arcano', ap: 2, cd: 2, range: [0, 4], los: true, target: 'ally', shield: 9, text: 'Da 9 de escudo a ti o a un aliado.' }),
    S({ id: 'impulso', name: 'Impulso temporal', route: 'arcano', ap: 3, cd: 3, range: [1, 4], los: true, target: 'ally', giveAp: 3, text: 'Un aliado gana 3 PA.' }),
    S({ id: 'cupula', name: 'Cúpula arcana', route: 'arcano', ap: 4, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, shield: 8, text: 'Aliados en área 2 (y tú): escudo 8.' }),
    // ---------- Clérigo ----------
    S({ id: 'maza', name: 'Maza', route: 'base', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [6, 9], text: 'Golpe cuerpo a cuerpo.' }),
    S({ id: 'sanar', name: 'Sanar', route: 'luz', ap: 3, cd: 0, range: [0, 4], los: true, target: 'ally', heal: 12, text: 'Cura 12 a ti o a un aliado.' }),
    S({ id: 'aura', name: 'Aura de luz', route: 'luz', ap: 4, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, heal: 8, text: 'Cura 8 a todos los aliados en área 2.' }),
    S({ id: 'plegaria', name: 'Plegaria mayor', route: 'luz', ap: 4, cd: 3, range: [0, 5], los: true, target: 'ally', heal: 20, shield: 5, text: 'Cura 20 y da escudo 5.' }),
    S({ id: 'flagelo', name: 'Flagelo', route: 'penitencia', ap: 3, cd: 0, range: [1, 4], los: true, target: 'enemy', dmg: [11, 14], selfDmg: 3, text: 'Daño sagrado que te cuesta 3 de vida.' }),
    S({ id: 'expiar', name: 'Expiación', route: 'penitencia', ap: 4, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [8, 11], lifesteal: 0.6, text: 'Te curas el 60% del daño hecho.' }),
    S({ id: 'martirio', name: 'Martirio', route: 'penitencia', ap: 4, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [16, 20], selfDmg: 8, text: 'Daño enorme que te cuesta 8 de vida.' }),
    S({ id: 'consagrar', name: 'Consagrar', route: 'egida', ap: 3, cd: 2, range: [0, 0], los: false, target: 'ally', area: 2, shield: 7, text: 'Escudo 7 a todos los aliados en área 2.' }),
    S({ id: 'custodia', name: 'Custodia', route: 'egida', ap: 2, cd: 1, range: [1, 4], los: true, target: 'ally', shield: 11, text: 'Escudo 11 a un aliado.' }),
    S({ id: 'bastion', name: 'Bastión', route: 'egida', ap: 3, cd: 3, range: [0, 4], los: true, target: 'ally', shield: 16, text: 'Escudo 16 a ti o a un aliado.' }),
    S({ id: 'marca', name: 'Marca del juicio', route: 'juicio', ap: 2, cd: 1, range: [1, 5], los: true, target: 'enemy', status: { kind: 'mark', turns: 2 }, text: 'El objetivo recibe +30% de daño 2 turnos.' }),
    S({ id: 'sentencia', name: 'Sentencia', route: 'juicio', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [6, 8], status: { kind: 'stun', turns: 1 }, text: 'Daña y aturde 1 turno.' }),
    S({ id: 'veredicto', name: 'Veredicto', route: 'juicio', ap: 4, cd: 2, range: [1, 5], los: true, target: 'enemy', dmg: [10, 13], status: { kind: 'slow', turns: 2, stacks: 1 }, text: 'Daño sagrado y -1 PM.' }),
    // ---------- Pícaro ----------
    S({ id: 'punalada', name: 'Puñalada', route: 'base', ap: 2, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [5, 8], text: 'Golpe rápido y barato.' }),
    S({ id: 'daga_ven', name: 'Daga envenenada', route: 'veneno', ap: 3, cd: 0, range: [1, 4], los: true, target: 'enemy', dmg: [4, 6], status: { kind: 'poison', turns: 3, stacks: 2 }, text: 'Aplica 2 cargas de veneno.' }),
    S({ id: 'nube', name: 'Nube tóxica', route: 'veneno', ap: 4, cd: 2, range: [2, 5], los: true, target: 'enemy', area: 1, dmg: [2, 4], status: { kind: 'poison', turns: 3, stacks: 2 }, text: 'Área 1: envenena a todos.' }),
    S({ id: 'toxina', name: 'Toxina paralizante', route: 'veneno', ap: 4, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [6, 8], status: { kind: 'stun', turns: 1 }, text: 'Daña y paraliza 1 turno.' }),
    S({ id: 'apunalar', name: 'Apuñalar', route: 'asesino', ap: 3, cd: 1, range: [1, 1], los: false, target: 'enemy', dmg: [10, 13], text: 'Golpe certero.' }),
    S({ id: 'emboscada', name: 'Emboscada', route: 'asesino', ap: 3, cd: 2, range: [2, 5], los: true, target: 'enemy', dmg: [9, 12], dash: true, text: 'Saltas junto al enemigo y golpeas.' }),
    S({ id: 'golpe_mortal', name: 'Golpe mortal', route: 'asesino', ap: 5, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [18, 24], text: 'El remate.' }),
    S({ id: 'cegar', name: 'Polvo cegador', route: 'sombras', ap: 2, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [2, 3], drainAp: 2, text: 'El enemigo pierde 2 PA.' }),
    S({ id: 'punto_debil', name: 'Punto débil', route: 'sombras', ap: 2, cd: 2, range: [1, 5], los: true, target: 'enemy', dmg: [3, 4], status: { kind: 'mark', turns: 3 }, text: 'El objetivo recibe +30% de daño 3 turnos.' }),
    S({ id: 'golpe_bajo', name: 'Golpe bajo', route: 'sombras', ap: 3, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [4, 6], status: { kind: 'stun', turns: 1 }, text: 'Aturde 1 turno.' }),
    S({ id: 'voltereta', name: 'Voltereta', route: 'acrobata', ap: 2, cd: 1, range: [2, 4], los: true, target: 'enemy', dmg: [5, 7], dash: true, text: 'Saltas junto al enemigo y golpeas.' }),
    S({ id: 'evasion', name: 'Evasión', route: 'acrobata', ap: 2, cd: 2, range: [0, 0], los: false, target: 'self', shield: 10, text: 'Ganas 10 de escudo.' }),
    S({ id: 'senal', name: 'Señal de avance', route: 'acrobata', ap: 3, cd: 3, range: [1, 4], los: true, target: 'ally', giveMp: 2, giveAp: 1, text: 'Un aliado gana 2 PM y 1 PA.' }),
    // ---------- Arquero ----------
    S({ id: 'flecha', name: 'Flecha', route: 'base', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [6, 9], text: 'Disparo básico. No alcanza a enemigos pegados a ti.' }),
    S({ id: 'certero', name: 'Disparo certero', route: 'francotirador', ap: 4, cd: 1, range: [3, 7], los: true, target: 'enemy', dmg: [12, 16], crit: 10, text: 'Disparo lejano de mucho daño.' }),
    S({ id: 'marca_caza', name: 'Marca del cazador', route: 'francotirador', ap: 2, cd: 2, range: [1, 7], los: true, target: 'enemy', dmg: [2, 3], status: { kind: 'mark', turns: 3 }, text: 'El objetivo recibe +30% de daño 3 turnos.' }),
    S({ id: 'perforante', name: 'Tiro perforante', route: 'francotirador', ap: 5, cd: 3, range: [2, 7], los: true, target: 'enemy', dmg: [13, 17], pierce: true, line: true, text: 'Atraviesa a todos los enemigos en línea e ignora la armadura.' }),
    S({ id: 'rapido', name: 'Disparo rápido', route: 'rafaga', ap: 2, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [4, 6], text: 'Barato: se puede repetir varias veces por turno.' }),
    S({ id: 'andanada', name: 'Lluvia de flechas', route: 'rafaga', ap: 4, cd: 2, range: [3, 6], los: true, target: 'enemy', area: 1, dmg: [7, 10], text: 'Área 1 alrededor del objetivo.' }),
    S({ id: 'salto_atras', name: 'Salto atrás', route: 'rafaga', ap: 2, cd: 2, range: [1, 3], los: true, target: 'enemy', dmg: [5, 7], retreat: 2, text: 'Disparas y retrocedes 2 casillas.' }),
    S({ id: 'cepo', name: 'Cepo', route: 'trampero', ap: 2, cd: 1, range: [1, 4], los: true, target: 'cell', snare: { dmg: 9 }, text: 'Trampa en una casilla libre: daña y detiene al primer enemigo que la pise.' }),
    S({ id: 'flecha_hielo', name: 'Flecha de escarcha', route: 'trampero', ap: 3, cd: 0, range: [2, 6], los: true, target: 'enemy', dmg: [5, 7], status: { kind: 'slow', turns: 2, stacks: 2 }, text: 'Quita 2 PM durante 2 turnos.' }),
    S({ id: 'red', name: 'Red', route: 'trampero', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [3, 4], status: { kind: 'stun', turns: 1 }, text: 'Atrapa al objetivo: pierde su próximo turno.' }),
    S({ id: 'lobo', name: 'Invocar lobo', route: 'bestias', ap: 4, cd: 4, range: [1, 2], los: true, target: 'cell', summon: { kind: 'lobo', name: 'Lobo', hpPct: 0.6, armor: 1, ap: 6, mp: 5, initiative: 12, spell: 'e_mordida' }, text: 'Un lobo lucha a tu lado (uno a la vez). Hereda tu % de daño.' }),
    S({ id: 'orden', name: 'Orden de caza', route: 'bestias', ap: 2, cd: 2, range: [1, 6], los: false, target: 'ally', giveAp: 3, giveMp: 2, text: 'Tu lobo (o un aliado) gana 3 PA y 2 PM en su próximo turno.' }),
    S({ id: 'vinculo', name: 'Vínculo', route: 'bestias', ap: 3, cd: 3, range: [0, 0], los: false, target: 'ally', area: 3, heal: 10, text: 'Cura 10 a ti y a los aliados en área 3.' }),
    // ---------- Kit inicial: segunda habilidad de daño y potenciación propia ----------
    S({ id: 'hachazo', name: 'Hachazo', route: 'base', ap: 4, cd: 1, range: [1, 1], los: false, target: 'enemy', dmg: [11, 15], text: 'Golpe pesado cuerpo a cuerpo.' }),
    S({ id: 'sed_sangre', name: 'Sed de sangre', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', selfDmgPct: 0.15, buff: { kind: 'empower', turns: 2, stacks: 35 }, text: 'Pierdes el 15% de tu vida actual: +35% de daño este turno y el siguiente.' }),
    S({ id: 'chispa', name: 'Chispa ígnea', route: 'base', ap: 3, cd: 1, range: [1, 4], los: true, target: 'enemy', dmg: [7, 10], status: { kind: 'burn', turns: 1 }, text: 'Daño de fuego que quema 1 turno.' }),
    S({ id: 'escudo_arcano', name: 'Escudo arcano', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', shield: 14, buff: { kind: 'empower', turns: 2, stacks: 15 }, text: 'Escudo de 14 y +15% de daño este turno y el siguiente.' }),
    S({ id: 'castigo', name: 'Castigo divino', route: 'base', ap: 3, cd: 1, range: [1, 4], los: true, target: 'enemy', dmg: [7, 10], text: 'Rayo de luz a distancia.' }),
    S({ id: 'fervor', name: 'Fervor', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', heal: 8, buff: { kind: 'empower', turns: 2, stacks: 20 }, text: 'Te curas 8 y ganas +20% de daño este turno y el siguiente.' }),
    S({ id: 'tiro_rasante', name: 'Tiro rasante', route: 'base', ap: 3, cd: 1, range: [1, 4], los: true, target: 'enemy', dmg: [6, 9], push: 1, text: 'Disparo corto que sí alcanza a los pegados y los empuja 1 casilla.' }),
    S({ id: 'ojo_halcon', name: 'Ojo de halcón', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', buff: { kind: 'reach', turns: 2, stacks: 2 }, text: '+2 de alcance a tus ataques a distancia este turno y el siguiente.' }),
    S({ id: 'cuchillo', name: 'Cuchillo arrojadizo', route: 'base', ap: 3, cd: 1, range: [2, 4], los: true, target: 'enemy', dmg: [6, 9], text: 'Lanzas un cuchillo a media distancia.' }),
    S({ id: 'desvanecer', name: 'Desvanecerse', route: 'base', ap: 3, cd: 4, range: [0, 0], los: false, target: 'self', buff: { kind: 'invis', turns: 2 }, text: 'Invisible este turno y el siguiente: no te pueden apuntar ni placar. Atacar te hace visible.' }),
    // ---------- Consumibles ----------
    S({ id: 'c_vida', name: 'Poción de curación', route: 'item', ap: 2, cd: 0, range: [0, 0], los: false, target: 'self', healPct: 0.35, text: 'Recuperas el 35% de tu vida.' }),
    S({ id: 'c_resu', name: 'Poción de resurrección', route: 'item', ap: 4, cd: 0, range: [1, 2], los: false, target: 'ally', revive: 0.4, text: 'Levanta a un aliado caído con el 40% de su vida. Apunta a su casilla.' }),
    S({ id: 'c_fuego', name: 'Bomba de fuego', route: 'item', ap: 3, cd: 0, range: [1, 4], los: true, target: 'enemy', area: 1, dmg: [12, 16], status: { kind: 'burn', turns: 2 }, text: 'Explota en área 1 y quema 2 turnos.' }),
    S({ id: 'c_humo', name: 'Bomba de humo', route: 'item', ap: 2, cd: 0, range: [0, 0], los: false, target: 'self', selfMp: 2, buff: { kind: 'invis', turns: 2 }, text: 'Te vuelves invisible y ganas +2 PM para escapar.' }),
    // ---------- Bendiciones de clase: hechizos nuevos ----------
    S({ id: 'g_remolino', name: 'Remolino de acero', route: 'boon', ap: 4, cd: 2, range: [0, 0], los: false, target: 'enemy', area: 1, dmg: [10, 13], text: 'Golpea a todos los enemigos pegados a ti.' }),
    S({ id: 'g_carniceria', name: 'Carnicería', route: 'boon', ap: 4, cd: 2, range: [1, 1], los: false, target: 'enemy', dmg: [16, 20], selfDmgPct: 0.1, text: 'Golpe brutal que te cuesta el 10% de tu vida actual.' }),
    S({ id: 'g_muralla', name: 'Muralla viviente', route: 'boon', ap: 4, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, shield: 12, text: 'Escudo de 12 a ti y a los aliados a 2 casillas.' }),
    S({ id: 'g_carga', name: 'Carga', route: 'boon', ap: 3, cd: 2, range: [2, 4], los: true, target: 'enemy', dash: true, dmg: [9, 12], push: 1, text: 'Cargas contra el objetivo, lo golpeas y lo empujas.' }),
    S({ id: 'g_estandarte', name: 'Estandarte', route: 'boon', ap: 3, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, giveAp: 1, text: 'Tú y los aliados a 2 casillas ganáis 1 PA en el próximo turno.' }),
    S({ id: 'm_meteoro', name: 'Meteoro', route: 'boon', ap: 5, cd: 3, range: [3, 7], los: true, target: 'enemy', area: 1, dmg: [16, 20], status: { kind: 'burn', turns: 2 }, text: 'Cae del cielo en área 1 y quema.' }),
    S({ id: 'm_glaciar', name: 'Glaciar', route: 'boon', ap: 4, cd: 4, range: [1, 5], los: true, target: 'enemy', dmg: [6, 8], status: { kind: 'stun', turns: 1 }, text: 'Encierra al objetivo en hielo: pierde su turno (los élites y jefes son inmunes).' }),
    S({ id: 'm_rayo_cadena', name: 'Cadena de rayos', route: 'boon', ap: 4, cd: 2, range: [2, 6], los: true, target: 'enemy', area: 1, dmg: [9, 12], drainAp: 1, text: 'Salta a los pegados al objetivo y quita 1 PA.' }),
    S({ id: 'm_parpadeo', name: 'Parpadeo', route: 'boon', ap: 2, cd: 3, range: [1, 4], los: true, target: 'cell', teleport: true, text: 'Te teletransportas a una casilla libre.' }),
    S({ id: 'c_milagro', name: 'Milagro', route: 'boon', ap: 4, cd: 3, range: [0, 5], los: false, target: 'ally', heal: 26, text: 'Gran curación a un aliado (o a ti).' }),
    S({ id: 'c_martillo', name: 'Martillo celestial', route: 'boon', ap: 4, cd: 2, range: [1, 5], los: true, target: 'enemy', dmg: [12, 15], text: 'Un martillo de luz cae sobre el objetivo.' }),
    S({ id: 'c_santuario', name: 'Santuario', route: 'boon', ap: 4, cd: 3, range: [0, 0], los: false, target: 'ally', area: 2, shield: 14, heal: 6, text: 'Escudo de 14 y cura 6 a ti y a los aliados a 2 casillas.' }),
    S({ id: 'c_sacrificio', name: 'Sacrificio', route: 'boon', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', area: 1, dmg: [14, 18], selfDmgPct: 0.2, text: 'Das el 20% de tu vida para castigar un área.' }),
    S({ id: 'a_letal', name: 'Disparo letal', route: 'boon', ap: 5, cd: 3, range: [4, 8], los: true, target: 'enemy', dmg: [18, 22], crit: 10, text: 'El disparo más lejano y potente.' }),
    S({ id: 'a_abanico', name: 'Abanico', route: 'boon', ap: 3, cd: 2, range: [1, 4], los: true, target: 'enemy', area: 1, dmg: [7, 10], text: 'Varias flechas a la vez en área 1.' }),
    S({ id: 'a_campo', name: 'Campo de cepos', route: 'boon', ap: 2, cd: 2, range: [1, 5], los: true, target: 'cell', snare: { dmg: 12 }, text: 'Otro cepo oculto, más fuerte.' }),
    S({ id: 'a_halcon', name: 'Halcón', route: 'boon', ap: 3, cd: 4, range: [1, 2], los: true, target: 'cell', summon: { kind: 'halcon', name: 'Halcón', hpPct: 0.4, armor: 0, ap: 6, mp: 6, initiative: 18, spell: 'e_mordida' }, text: 'Un halcón rápido lucha a tu lado (uno a la vez).' }),
    S({ id: 'p_frasco', name: 'Frasco tóxico', route: 'boon', ap: 3, cd: 2, range: [1, 4], los: true, target: 'enemy', area: 1, dmg: [3, 5], status: { kind: 'poison', turns: 3, stacks: 2 }, text: 'Envenena x2 en área 1 durante 3 turnos.' }),
    S({ id: 'p_degollar', name: 'Degollar', route: 'boon', ap: 4, cd: 2, range: [1, 1], los: false, target: 'enemy', dmg: [16, 21], crit: 15, text: 'Golpe letal cuerpo a cuerpo.' }),
    S({ id: 'p_debilidad', name: 'Señalar debilidad', route: 'boon', ap: 2, cd: 3, range: [1, 5], los: true, target: 'enemy', dmg: [2, 3], status: { kind: 'exposed', turns: 2, stacks: 4 }, extraStatus: { kind: 'mark', turns: 2 }, text: 'Marca y deja Expuesto (−4 de armadura) 2 turnos.' }),
    S({ id: 'p_danza', name: 'Danza de cuchillas', route: 'boon', ap: 3, cd: 2, range: [0, 0], los: false, target: 'enemy', area: 1, dmg: [9, 12], text: 'Golpea a todos los enemigos pegados a ti.' }),
    // ---------- Enemigos (Zona 1) ----------
    S({ id: 'e_golpe', name: 'Golpe', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [5, 7], text: '' }),
    S({ id: 'e_tajo', name: 'Tajo sepulcral', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [8, 10], text: '' }),
    S({ id: 'e_maldicion', name: 'Maldición del Prior', route: 'enemy', ap: 3, cd: 0, range: [2, 7], los: true, target: 'enemy', dmg: [6, 8], status: { kind: 'mark', turns: 2 }, text: '' }),
    S({ id: 'e_barrido', name: 'Barrido del coloso', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', area: 1, dmg: [9, 12], text: '' }),
    S({ id: 'e_llama', name: 'Llama hereje', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [4, 6], status: { kind: 'burn', turns: 2 }, text: '' }),
    S({ id: 'e_toque', name: 'Toque helado', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [7, 9], status: { kind: 'mark', turns: 1 }, text: '' }),
    S({ id: 'e_escudo', name: 'Corteza protectora', route: 'enemy', ap: 2, cd: 2, range: [1, 4], los: true, target: 'ally', shield: 10, text: '' }),
    S({ id: 'e_avivar', name: 'Avivar las brasas', route: 'enemy', ap: 2, cd: 2, range: [1, 4], los: true, target: 'ally', giveAp: 2, text: '' }),
    S({ id: 'e_mordida', name: 'Mordida', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [7, 9], text: '' }),
    S({ id: 'e_telarana', name: 'Telaraña', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [4, 6], status: { kind: 'slow', turns: 2, stacks: 2 }, text: '' }),
    S({ id: 'e_espora', name: 'Esporas', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [3, 5], status: { kind: 'poison', turns: 3, stacks: 2 }, text: '' }),
    S({ id: 'e_raiz', name: 'Golpe de raíz', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [10, 13], text: '' }),
    S({ id: 'e_latigo', name: 'Látigo de zarzas', route: 'enemy', ap: 3, cd: 0, range: [2, 6], los: true, target: 'enemy', dmg: [8, 10], status: { kind: 'slow', turns: 2, stacks: 1 }, text: '' }),
    S({ id: 'e_aplastar', name: 'Aplastar', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', area: 1, dmg: [12, 15], text: '' }),
    S({ id: 'e_dentellada', name: 'Dentellada ardiente', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [8, 10], status: { kind: 'burn', turns: 2 }, text: '' }),
    S({ id: 'e_espadazo', name: 'Espadazo', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [11, 14], text: '' }),
    S({ id: 'e_bola', name: 'Bola de ceniza', route: 'enemy', ap: 3, cd: 0, range: [2, 6], los: true, target: 'enemy', area: 1, dmg: [8, 10], status: { kind: 'burn', turns: 2 }, text: '' }),
    S({ id: 'e_escoria', name: 'Puño de escoria', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [13, 16], text: '' }),
    S({ id: 'e_pira', name: 'Pira real', route: 'enemy', ap: 3, cd: 0, range: [2, 7], los: true, target: 'enemy', dmg: [10, 12], status: { kind: 'burn', turns: 3 }, text: '' }),
    S({ id: 'e_cataclismo', name: 'Cataclismo', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', area: 1, dmg: [15, 18], text: '' }),
    S({ id: 'e_mordisco', name: 'Mordisco', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [3, 5], lifesteal: 0.5, text: '' }),
    S({ id: 'e_flecha', name: 'Flecha de hueso', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [5, 7], text: '' }),
    S({ id: 'e_savia', name: 'Savia curativa', route: 'enemy', ap: 2, cd: 2, range: [1, 4], los: true, target: 'ally', heal: 14, text: '' }),
    S({ id: 'e_vendaje', name: 'Vendas pútridas', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [6, 8], status: { kind: 'slow', turns: 1, stacks: 1 }, text: '' }),
    S({ id: 'e_garra', name: 'Garra de piedra', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [7, 9], text: '' }),
    S({ id: 'e_pala', name: 'Palada', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [5, 7], text: '' }),
    S({ id: 'e_espinas', name: 'Latigazo de espinas', route: 'enemy', ap: 3, cd: 0, range: [1, 2], los: true, target: 'enemy', dmg: [7, 9], status: { kind: 'poison', turns: 2, stacks: 1 }, text: '' }),
    S({ id: 'e_zarpa', name: 'Zarpa sombría', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [9, 11], crit: 15, text: '' }),
    S({ id: 'e_martillo', name: 'Martillo de forja', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [10, 13], text: '' }),
    S({ id: 'e_ascua', name: 'Escupir ascuas', route: 'enemy', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [6, 8], status: { kind: 'burn', turns: 2 }, text: '' }),
    S({ id: 'e_lamento', name: 'Lamento', route: 'enemy', ap: 3, cd: 0, range: [2, 6], los: true, target: 'enemy', area: 1, dmg: [7, 9], drainAp: 1, text: '' }),
    S({ id: 'e_saeta', name: 'Saeta del cazador', route: 'enemy', ap: 3, cd: 0, range: [2, 7], los: true, target: 'enemy', dmg: [9, 12], status: { kind: 'mark', turns: 1 }, text: '' }),
    S({ id: 'e_fundir', name: 'Colada de metal', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', area: 1, dmg: [13, 16], status: { kind: 'burn', turns: 2 }, text: '' }),
    S({ id: 'e_vacio', name: 'Rayo del vacío', route: 'enemy', ap: 3, cd: 0, range: [2, 6], los: true, target: 'enemy', dmg: [10, 13], status: { kind: 'slow', turns: 1, stacks: 1 }, text: '' }),
    S({ id: 'e_mirada', name: 'Mirada abisal', route: 'enemy', ap: 3, cd: 0, range: [2, 7], los: true, target: 'enemy', dmg: [7, 9], status: { kind: 'mark', turns: 2 }, text: '' }),
    S({ id: 'e_mordaza', name: 'Mordaza del abismo', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [12, 15], lifesteal: 0.4, text: '' }),
    S({ id: 'e_devorar', name: 'Devorar runas', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', area: 1, dmg: [17, 21], drainAp: 1, text: '' }),
    S({ id: 'e_eco', name: 'Eco de los caídos', route: 'enemy', ap: 3, cd: 0, range: [2, 7], los: true, target: 'enemy', area: 1, dmg: [11, 14], status: { kind: 'mark', turns: 1 }, text: '' }),
    S({ id: 'e_zarpazo', name: 'Zarpazo pútrido', route: 'enemy', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [6, 8], status: { kind: 'poison', turns: 3, stacks: 1 }, text: '' }),
  ].map((d) => [d.id, d]),
);

// Elemento del daño según la ruta (o el hechizo, en los enemigos).
const ROUTE_ELEMENT: Record<string, Element> = { fuego: 'fire', hielo: 'ice', veneno: 'poison', luz: 'holy', penitencia: 'holy', juicio: 'holy',  };
const SPELL_ELEMENT: Record<string, Element> = {
  chispa: 'fire', castigo: 'holy', c_fuego: 'fire', m_meteoro: 'fire', m_glaciar: 'ice', c_martillo: 'holy', c_sacrificio: 'holy', p_frasco: 'poison', p_debilidad: 'shadow',
  e_maldicion: 'shadow', e_toque: 'shadow', e_zarpazo: 'poison', e_llama: 'fire', e_mordisco: 'shadow', e_espora: 'poison', e_latigo: 'poison',
  e_dentellada: 'fire', e_bola: 'fire', e_pira: 'fire', e_cataclismo: 'fire',
  e_espinas: 'poison', e_zarpa: 'shadow', e_ascua: 'fire', e_lamento: 'shadow', e_fundir: 'fire', e_vacio: 'shadow', e_mirada: 'shadow', e_mordaza: 'shadow', e_devorar: 'shadow', e_eco: 'shadow',
};
for (const d of Object.values(SPELLS)) d.element = SPELL_ELEMENT[d.id] ?? ROUTE_ELEMENT[d.route];
SPELLS.flecha_hielo!.element = 'ice';
