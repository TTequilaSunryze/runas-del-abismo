// G3.1 + G3.2: identidad táctica de cada jefe. Solo datos: la IA (ai.ts) los interpreta.
// Cada jefe tiene un ataque anunciado (se marca en el suelo un turno antes y estalla al empezar su siguiente turno),
// una forma propia de invocar y, a veces, una ventana de vulnerabilidad. No tocan la vida ni el daño general (G3.0).
import type { ObjectiveMech, StatusKind } from '../state';

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
  /** Q1: radio del anillo (por defecto 2) */
  radius?: number;
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
  /** Q1: formato del encuentro, composición y objetivos estructurales */
  encounter: EncounterDef;
}

/**
 * Q1 · Objetivo estructural de un encuentro (sellos, raíces, puestos, braseros, válvulas, fragmentos, almas).
 * Es un enemigo con ai 'pillar' (inmóvil, con vida, golpeable, no cuenta para ganar). Su efecto lo resuelve encounter.ts.
 */
export interface ObjectiveDef {
  /** id de enemigo (ai 'pillar') */
  kind: string;
  mech: ObjectiveMech;
  /** obligatorio: sostiene una protección del jefe; opcional: destruirlo da ventaja */
  role: 'required' | 'optional';
  /** cuántos hay al empezar, con 1, 2, 3 y 4 jugadores */
  count: readonly [number, number, number, number];
  /** fracción de daño que le quita al jefe cada uno en pie (se suman hasta WARD_CAP) */
  ward?: number;
  /** cuándo aparecen: al empezar el combate (por defecto) o junto al jefe (desgaste) */
  with?: 'start' | 'boss';
  /** qué hace, en una línea, para el registro y la ficha */
  text: string;
}

/** Q1 · Oleadas del encuentro de desgaste: ronda 1, ronda 3 y ronda 5 (llega el jefe). */
export interface AttritionDef {
  first: readonly string[];
  second: readonly string[];
  /** acompañantes del jefe (además del subordinado especial) */
  third: readonly string[];
  /** subordinado especial: un élite de la zona con nombre propio */
  lieutenant: string;
  lieutenantName: string;
}

export interface EncounterDef {
  format: 'classic' | 'attrition';
  /** clásico: escolta por papeles (3 → mínimo de 4 hostiles con el jefe); con 4 jugadores se suma `extra` */
  escorts?: readonly string[];
  extra?: string;
  waves?: AttritionDef;
  objectives?: readonly ObjectiveDef[];
  /** daño plano que pierde el jefe por cada objetivo suyo destruido */
  breakPower?: number;
  /** presentación al empezar el combate */
  intro: string;
}

/** Q1: protección máxima del jefe por objetivos en pie (nunca es inmunidad). */
export const WARD_CAP = 0.6;
/** Q1: rondas de las oleadas del desgaste (la 3.ª trae al jefe). */
export const ATTRITION_ROUNDS = [3, 5] as const;
/** Q1: hostiles mínimos de un encuentro de jefe, contando al jefe. */
export const MIN_HOSTILES = 4;

export const BOSS_KITS: Record<string, BossKit> = {
  // Zona 1 · El Prior Hueco: castiga al grupo amontonado y obliga a derribar los pilares de hueso
  prior: {
    id: 'prior',
    omen: { name: 'Campana fúnebre', shape: 'cross', target: 'cluster', every: 3, at: 2, mul: 1.35, hint: 'Separaos: estalla en cruz sobre el grupo más apiñado.' },
    // Q1: el Coloso tañe más a menudo
    omen2: { name: 'Campana del Coloso', shape: 'cross', target: 'cluster', every: 2, at: 0, mul: 1.35, hint: 'Separaos: la cruz cae sobre el grupo más apiñado (y el suelo se agrieta).' },
    minion: { role: 'guardian', hp: 0.85, phases: [1], every: 3, at: 0, fromCorpse: true, text: 'alza un esqueleto guardián' },
    phase2: { text: 'El Coloso del Osario levanta pilares de hueso que lo curan: cada pilar derribado lo deja Expuesto.' },
    encounter: {
      format: 'classic', escorts: ['esqueleto', 'arquero', 'acolito'], extra: 'necrofago', breakPower: 2,
      objectives: [{ kind: 'sello', mech: 'seal', role: 'required', count: [3, 3, 4, 4], ward: 0.15, text: 'Cada sello en pie le quita al Prior un 15% del daño; romperlo lo deja Expuesto y le quita fuerza.' }],
      intro: 'Sellos funerarios protegen al Prior: rompedlos para herirlo de verdad.',
    },
  },
  // Zona 1 · La Plañidera: manifestaciones que se desvanecen y un llanto en línea que se esquiva cambiando de fila
  planidera: {
    id: 'planidera',
    omen: { name: 'Llanto desgarrador', shape: 'line', target: 'frail', every: 3, at: 1, len: 6, mul: 1.3, hint: 'Salid de la línea marcada (o poneos tras un obstáculo).' },
    omen2: { name: 'Gemido', shape: 'ring', target: 'near', every: 2, at: 0, mul: 1.15, effect: 'drainap', hint: 'Alejaos a 3 casillas o más de ella.' },
    after: { kind: 'vuln', stacks: 1, turns: 1, text: 'se queda sin aliento: Vulnerable' },
    minion: { role: 'manifestacion', hp: 0.8, phases: [1, 2], every: 3, at: 0, fade: 2, add: ['wail'], burst: 0, text: 'convoca un espectro (se desvanece en 2 turnos; matarlo le quita 1 PA)' },
    pillars: 0,
    phase2: { text: 'La Plañidera Desatada gime a su alrededor: alejaos de ella.' },
    encounter: {
      format: 'attrition', breakPower: 0,
      waves: { first: ['espectro', 'espectro', 'esqueleto', 'murcielago'], second: ['limo', 'sepulturero', 'calavera', 'calavera'], third: ['acolito', 'momia'], lieutenant: 'caballero', lieutenantName: 'Caballero del Lamento' },
      intro: 'Las Catacumbas lloran: resistid las oleadas. La Plañidera llegará en la 5.ª ronda.',
    },
  },
  // Zona 2 · La Madre Raíz: castiga a la retaguardia con raíces y se protege con brotes sanadores
  madre: {
    id: 'madre',
    omen: { name: 'Raíces del subsuelo', shape: 'square', target: 'far', every: 3, at: 2, mul: 1.1, effect: 'root', hint: 'Salid del cuadro: quien se quede, queda Inmovilizado.' },
    omen2: { name: 'Estrangulamiento', shape: 'square', target: 'frail', every: 2, at: 1, mul: 1.15, effect: 'root', hint: 'Salid del cuadro: atrapa al más débil y lo inmoviliza.' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1], every: 3, at: 0, text: 'pare una araña de zarza' },
    phase2: { text: 'La Raíz Desatada brota sanadores: cada brote derribado la deja Expuesta.' },
    encounter: {
      format: 'classic', escorts: ['arana', 'chaman', 'ent'], extra: 'tejedora', breakPower: 2,
      objectives: [{ kind: 'raiz_madre', mech: 'root', role: 'required', count: [4, 4, 4, 4], ward: 0.15, text: 'Cada raíz principal le quita a la Madre un 15% del daño y la regenera; cortarla la debilita.' }],
      intro: 'Cuatro raíces principales alimentan a la Madre Raíz: cortadlas.',
    },
  },
  // Zona 2 · El Cazador Silvano: dispara en línea a su presa marcada, pone cepos y luego salta encima de ella
  cazador: {
    id: 'cazador',
    omen: { name: 'Tiro cargado', shape: 'line', target: 'marked', every: 3, at: 1, len: 7, mul: 1.6, hint: 'Apártate de la línea o ponte tras un obstáculo.' },
    omen2: { name: 'Tiro de gracia', shape: 'line', target: 'marked', every: 2, at: 1, len: 8, mul: 1.6, hint: 'Apártate de la línea o cúbrete: busca a la presa marcada.' },
    after: { kind: 'exposed', stacks: 3, turns: 1, text: 'recarga el arco: Expuesto' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1, 2], every: 3, at: 0, cap: 1, burst: 0, text: 'silba a un lobo' },
    pillars: 0,
    phase2: { add: ['blink', 'hunter'], text: 'El Cazador Sin Rostro salta junto a su presa más frágil.' },
    encounter: {
      format: 'classic', escorts: ['lobo', 'pantera', 'tejedora'], extra: 'lobo', breakPower: 1,
      objectives: [{ kind: 'puesto_caza', mech: 'post', role: 'optional', count: [2, 2, 3, 3], text: 'El Cazador se esconde junto a sus puestos de caza; sin puestos no puede emboscaros.' }],
      intro: 'El Cazador acecha desde sus puestos de caza. No os separéis.',
    },
  },
  // Zona 3 · El Rey Calcinado: lluvia de fuego que deja el suelo ardiendo
  rey: {
    id: 'rey',
    omen: { name: 'Lluvia de pira', shape: 'twin', target: 'cluster', every: 3, at: 2, mul: 1.05, effect: 'fire', hint: 'Salid de las cruces: el suelo quedará ardiendo.' },
    omen2: { name: 'Diluvio de brasas', shape: 'twin', target: 'far', every: 2, at: 0, mul: 1.1, effect: 'fire', hint: 'Salid de las cruces: castiga a quien se aleja del fuego.' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1], every: 3, at: 0, text: 'llama a un sabueso de ceniza' },
    phase2: { text: 'El Avatar de la Pira enciende braseros que lo curan: cada uno derribado lo deja Expuesto.' },
    encounter: {
      format: 'attrition', breakPower: 2,
      waves: { first: ['sabueso', 'sabueso', 'ceniciento', 'salamandra'], second: ['piromante', 'tirador', 'escoria', 'salamandra'], third: ['piromante', 'forjador'], lieutenant: 'verdugo', lieutenantName: 'Verdugo de la Pira' },
      objectives: [{ kind: 'brasero_pira', mech: 'pyre', role: 'optional', count: [2, 2, 3, 3], text: 'Cada brasero aviva la Pira Real y prende el suelo; apagadlo para frenar el incendio.' }],
      intro: 'Los braseros alimentan la Pira Real. El Rey Calcinado llegará en la 5.ª ronda.',
    },
  },
  // Zona 3 · La Fundidora: vierte metal a su alrededor y después queda sin armadura mientras se enfría
  fundidora: {
    id: 'fundidora',
    omen: { name: 'Vertido del crisol', shape: 'ring', target: 'near', every: 3, at: 0, mul: 1.3, effect: 'fire', hint: 'Alejaos a 3 casillas o más; después volved: queda sin armadura.' },
    after: { kind: 'exposed', stacks: 4, turns: 1, text: 'el crisol se enfría: Expuesta (−4 de armadura)' },
    minion: { role: 'esbirro', hp: 0.6, phases: [1], every: 3, at: 1, burst: 0, text: 'escupe una salamandra' },
    pillars: 0,
    phase2: { text: 'La Fundidora al Rojo se enfurece: su vertido sigue abriendo ventanas para castigarla.' },
    encounter: {
      format: 'classic', escorts: ['forjador', 'tirador', 'piromante'], extra: 'escoria', breakPower: 0,
      objectives: [{ kind: 'valvula', mech: 'valve', role: 'optional', count: [2, 2, 3, 3], text: 'Abrir una válvula baja la presión del crisol, corta la colada y escalda a la Fundidora si está cerca.' }],
      intro: 'El crisol acumula presión. Usad las válvulas antes de que estalle la colada.',
    },
  },
  // Zona 4 · El Devorador de Runas: se come los escudos de quien quede en sus fauces
  devorarunas: {
    id: 'devorarunas',
    omen: { name: 'Fauces del vacío', shape: 'square', target: 'cluster', every: 3, at: 1, mul: 1.15, effect: 'strip', hint: 'Salid del cuadro: devora todo el escudo.' },
    omen2: { name: 'Hambre sin fondo', shape: 'square', target: 'near', every: 2, at: 1, mul: 1.2, effect: 'strip', hint: 'Salid del cuadro: devora el escudo de quien esté más cerca.' },
    after: { kind: 'vuln', stacks: 1, turns: 1, text: 'queda ahíto: Vulnerable' },
    minion: { role: 'esbirro', hp: 0.5, phases: [1], every: 3, at: 0, drop: ['split'], text: 'regurgita una larva (no se divide)' },
    phase2: { text: 'El Hambre Sin Fondo alza obeliscos que lo curan: cada uno derribado lo deja Expuesto.' },
    encounter: {
      format: 'classic', escorts: ['guardian', 'heraldo', 'ojo'], extra: 'devorador', breakPower: 0,
      objectives: [{ kind: 'fragmento', mech: 'shard', role: 'optional', count: [2, 2, 2, 3], text: 'El Devorador se come los fragmentos rúnicos para crecer; rompedlos antes y su poder es vuestro.' }],
      intro: 'Fragmentos rúnicos flotan en la sala: si el Devorador se los come, desata su hambre.',
    },
  },
  // Zona 4 · El Eco de los Caídos: sus ecos lo curan mientras vivan y lo hieren al morir
  eco: {
    id: 'eco',
    omen: { name: 'Coro de los caídos', shape: 'heroes', target: 'near', every: 3, at: 2, mul: 1.1, hint: 'Moveos: estalla donde estáis ahora.' },
    omen2: { name: 'Coro desatado', shape: 'heroes', target: 'near', every: 2, at: 0, mul: 1.1, hint: 'Moveos: estalla donde estáis (cada alma viva lo hace más fuerte).' },
    minion: { role: 'manifestacion', hp: 0.6, phases: [1, 2], every: 3, at: 0, fade: 2, add: ['echo'], burst: 0, text: 'proyecta un eco (lo cura mientras viva; matarlo lo hiere)' },
    pillars: 0,
    dropStart: ['regen'],
    healPerMinion: 0.04,
    phase2: { text: 'El Coro de los Caídos: sus ecos siguen curándolo, cazadlos.' },
    encounter: {
      format: 'attrition', breakPower: 1,
      waves: { first: ['vacio', 'vacio', 'larva', 'ojo'], second: ['vacio', 'vacio', 'ojo', 'heraldo'], third: ['heraldo', 'devorador'], lieutenant: 'centinela', lieutenantName: 'Centinela del Coro' },
      objectives: [{ kind: 'alma_caida', mech: 'soul', role: 'required', count: [2, 2, 3, 3], ward: 0.1, with: 'boss', text: 'Cada alma caída le quita al Eco un 10% del daño, lo regenera y potencia su coro.' }],
      intro: 'Las voces del Abismo se acercan en oleadas. El Eco de los Caídos llegará en la 5.ª ronda.',
    },
  },
};

/** Kit del jefe por su id de enemigo (undefined = comportamiento genérico). */
export const bossKit = (kind: string): BossKit | undefined => BOSS_KITS[kind];
