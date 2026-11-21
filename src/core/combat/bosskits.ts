// G3.1 + G3.2: identidad táctica de cada jefe. Solo datos: la IA (ai.ts) los interpreta.
// Cada jefe tiene un ataque anunciado (se marca en el suelo un turno antes y estalla al empezar su siguiente turno),
// una forma propia de invocar y, a veces, una ventana de vulnerabilidad. No tocan la vida ni el daño general (G3.0).
import type { StatusKind } from '../state';

/** Forma del ataque anunciado. */
export type OmenShape =
  /** cruz de 5 casillas sobre un héroe */
  | 'cross'
  /** cuadrado 3×3 sobre un héroe */
  | 'square'
  /** línea recta desde el jefe hacia un héroe (los obstáculos la cortan) */
  | 'line'
  /** anillo a 1-2 casillas alrededor del jefe */
  | 'ring'
  /** la casilla de cada héroe */
  | 'heroes'
  /** cruces sobre dos héroes distintos */
  | 'twin';

/** A quién apunta el ataque anunciado. */
export type OmenTarget = 'cluster' | 'far' | 'frail' | 'marked' | 'near';

/** Efecto extra de quien no se aparta a tiempo. */
export type OmenEffect = 'root' | 'strip' | 'fire' | 'drainap';

export interface OmenDef {
  name: string;
  shape: OmenShape;
  target: OmenTarget;
  /** cada cuántas rondas (y en cuál: ronda % every === at) */
  every: number;
  at: number;
  /** multiplicador sobre el daño medio de su golpe en área (segundo hechizo) */
  mul: number;
  /** largo de la línea */
  len?: number;
  effect?: OmenEffect;
  /** texto para el registro: qué hacer para esquivarlo */
  hint: string;
}

/** Categorías de invocación (G3.2). */
export type MinionRole = 'esbirro' | 'guardian' | 'manifestacion';

export interface BossKit {
  id: string;
  /** ataque anunciado en la fase 1 y, si cambia, en la 2 */
  omen: OmenDef;
  omen2?: OmenDef;
  /** ventana de vulnerabilidad tras soltar el ataque anunciado */
  after?: { kind: Extract<StatusKind, 'exposed' | 'vuln'>; stacks: number; turns: number; text: string };
  minion: {
    role: MinionRole;
    /** vida respecto a la del esbirro de zona (que ya es el 60% de un enemigo normal, G3.0) */
    hp: number;
    /** fases en las que invoca */
    phases: number[];
    /** cada cuántas rondas (ronda % every === at) */
    every: number;
    at: number;
    /** turnos propios que dura una manifestación antes de desvanecerse */
    fade?: number;
    /** rasgos que gana o pierde la invocación */
    add?: string[];
    drop?: string[];
    /** máximo vivo a la vez (si no, el de la zona) */
    cap?: number;
    /** aparece sobre un cadáver (lo consume) si hay alguno cerca */
    fromCorpse?: boolean;
    /** cuántas invoca de golpe al cambiar de fase (si no, ⌈jugadores/2⌉) */
    burst?: number;
    text: string;
  };
  /** pilares de la fase 2: undefined = los de la zona; 0 = ninguno */
  pillars?: number;
  /** rasgos que pierde al empezar el combate y que gana o pierde en la fase 2 */
  dropStart?: string[];
  phase2?: { add?: string[]; drop?: string[]; text: string };
  /** se cura este % de su vida por cada invocación suya viva al empezar su turno */
  healPerMinion?: number;
}

export const BOSS_KITS: Record<string, BossKit> = {
  // Zona 1 · El Prior Hueco: castiga al grupo amontonado y obliga a derribar los pilares de hueso
  prior: {
    id: 'prior',
    omen: { name: 'Campana fúnebre', shape: 'cross', target: 'cluster', every: 3, at: 2, mul: 1.2, hint: 'Separaos: estalla en cruz sobre el grupo más apiñado.' },
    minion: { role: 'guardian', hp: 0.85, phases: [1], every: 3, at: 0, fromCorpse: true, text: 'alza un esqueleto guardián' },
    phase2: { text: 'El Coloso del Osario levanta pilares de hueso que lo curan: cada pilar derribado lo deja Expuesto.' },
  },
  // Zona 1 · La Plañidera: manifestaciones que se desvanecen y un llanto en línea que se esquiva cambiando de fila
  planidera: {
    id: 'planidera',
    omen: { name: 'Llanto desgarrador', shape: 'line', target: 'frail', every: 3, at: 1, len: 6, mul: 1.2, hint: 'Salid de la línea marcada (o poneos tras un obstáculo).' },
    omen2: { name: 'Gemido', shape: 'ring', target: 'near', every: 2, at: 0, mul: 1.0, effect: 'drainap', hint: 'Alejaos a 3 casillas o más de ella.' },
    after: { kind: 'vuln', stacks: 1, turns: 1, text: 'se queda sin aliento: Vulnerable' },
    minion: { role: 'manifestacion', hp: 0.8, phases: [1, 2], every: 3, at: 0, fade: 2, add: ['wail'], burst: 0, text: 'convoca un espectro (se desvanece en 2 turnos; matarlo le quita 1 PA)' },
    pillars: 0,
    phase2: { text: 'La Plañidera Desatada gime a su alrededor: alejaos de ella.' },
  },
  // Zona 2 · La Madre Raíz: castiga a la retaguardia con raíces y se protege con brotes sanadores
  madre: {
    id: 'madre',
    omen: { name: 'Raíces del subsuelo', shape: 'square', target: 'far', every: 3, at: 2, mul: 0.9, effect: 'root', hint: 'Salid del cuadro: quien se quede, queda Inmovilizado.' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1], every: 3, at: 0, text: 'pare una araña de zarza' },
    phase2: { text: 'La Raíz Desatada brota sanadores: cada brote derribado la deja Expuesta.' },
  },
  // Zona 2 · El Cazador Silvano: dispara en línea a su presa marcada, pone cepos y luego salta encima de ella
  cazador: {
    id: 'cazador',
    omen: { name: 'Tiro cargado', shape: 'line', target: 'marked', every: 3, at: 1, len: 7, mul: 1.5, hint: 'Apártate de la línea o ponte tras un obstáculo.' },
    after: { kind: 'exposed', stacks: 3, turns: 1, text: 'recarga el arco: Expuesto' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1, 2], every: 3, at: 0, cap: 1, burst: 0, text: 'silba a un lobo' },
    pillars: 0,
    phase2: { add: ['blink', 'hunter'], text: 'El Cazador Sin Rostro salta junto a su presa más frágil.' },
  },
  // Zona 3 · El Rey Calcinado: lluvia de fuego que deja el suelo ardiendo
  rey: {
    id: 'rey',
    omen: { name: 'Lluvia de pira', shape: 'twin', target: 'cluster', every: 3, at: 2, mul: 0.9, effect: 'fire', hint: 'Salid de las cruces: el suelo quedará ardiendo.' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1], every: 3, at: 0, text: 'llama a un sabueso de ceniza' },
    phase2: { text: 'El Avatar de la Pira enciende braseros que lo curan: cada uno derribado lo deja Expuesto.' },
  },
  // Zona 3 · La Fundidora: vierte metal a su alrededor y después queda sin armadura mientras se enfría
  fundidora: {
    id: 'fundidora',
    omen: { name: 'Vertido del crisol', shape: 'ring', target: 'near', every: 3, at: 0, mul: 1.2, effect: 'fire', hint: 'Alejaos a 3 casillas o más; después volved: queda sin armadura.' },
    after: { kind: 'exposed', stacks: 4, turns: 1, text: 'el crisol se enfría: Expuesta (−4 de armadura)' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1], every: 3, at: 1, burst: 0, text: 'escupe una salamandra' },
    pillars: 0,
    phase2: { text: 'La Fundidora al Rojo se enfurece: su vertido sigue abriendo ventanas para castigarla.' },
  },
  // Zona 4 · El Devorador de Runas: se come los escudos de quien quede en sus fauces
  devorarunas: {
    id: 'devorarunas',
    omen: { name: 'Fauces del vacío', shape: 'square', target: 'cluster', every: 3, at: 1, mul: 1.0, effect: 'strip', hint: 'Salid del cuadro: devora todo el escudo.' },
    after: { kind: 'vuln', stacks: 1, turns: 1, text: 'queda ahíto: Vulnerable' },
    minion: { role: 'esbirro', hp: 0.5, phases: [1], every: 3, at: 0, drop: ['split'], text: 'regurgita una larva (no se divide)' },
    phase2: { text: 'El Hambre Sin Fondo alza obeliscos que lo curan: cada uno derribado lo deja Expuesto.' },
  },
  // Zona 4 · El Eco de los Caídos: sus ecos lo curan mientras vivan y lo hieren al morir
  eco: {
    id: 'eco',
    omen: { name: 'Coro de los caídos', shape: 'heroes', target: 'near', every: 3, at: 2, mul: 1.0, hint: 'Moveos: estalla donde estáis ahora.' },
    minion: { role: 'manifestacion', hp: 0.6, phases: [1, 2], every: 3, at: 0, fade: 2, add: ['echo'], burst: 0, text: 'proyecta un eco (lo cura mientras viva; matarlo lo hiere)' },
    pillars: 0,
    dropStart: ['regen'],
    healPerMinion: 0.04,
    phase2: { text: 'El Coro de los Caídos: sus ecos siguen curándolo, cazadlos.' },
  },
};

/** Kit del jefe por su id de enemigo (undefined = comportamiento genérico). */
export const bossKit = (kind: string): BossKit | undefined => BOSS_KITS[kind];
