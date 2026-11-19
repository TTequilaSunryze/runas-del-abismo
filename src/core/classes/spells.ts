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
  /** 'cell' = una casilla libre (cepos e invocaciones); 'ground' = cualquier casilla sin obstáculo (daña al enemigo que haya) */
  target: 'enemy' | 'ally' | 'self' | 'cell' | 'ground';
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
  /** deja una Esfera oscura en la casilla: dura `turns` turnos tuyos, como mucho `max` a la vez */
  sphere?: { turns: number; max: number };
  /** consume todas tus esferas: +`per` de daño por cada una */
  consume?: { per: number };
  /** cono frontal de este largo (apuntas a la casilla de al lado para elegir dirección) */
  cone?: number;
  /** las esferas empujadas que chocan con un enemigo lo dañan y aturden */
  sphereHit?: { dmg: [number, number]; stun: number };
  /** detona todas tus esferas: daño en área alrededor de cada una */
  detonate?: { dmg: [number, number]; area: number };
  /** el área es un cuadrado (3×3 con radio 1) en vez de un rombo */
  square?: boolean;
  /** empuja a todos los alcanzados, no solo al objetivo principal */
  pushAll?: boolean;
  /** gancho: engancha al primer enemigo de la línea y lo arrastra estas casillas hacia ti */
  hook?: { pull: number };
  /** solo sobre el enemigo enganchado este turno (Recorrer la cadena) */
  hookOnly?: boolean;
  /** linterna en una casilla libre: escudo (y cura) a los aliados pegados; permite Tomar la linterna */
  lantern?: { turns: number; shield: number; heal?: number };
  /** te lleva junto al dueño de la linterna que tienes al lado */
  lanternJump?: boolean;
  /** escudo por cada alma cosechada en este combate */
  soulShield?: number;
  /** golpea al primer enemigo de la línea recta */
  firstHit?: boolean;
  /** coloca tu Sombra (una a la vez) `turns` turnos tuyos; replica tus hechizos de daño al `echo` del daño */
  shadow?: { turns: number; echo: number };
  /** intercambias tu posición con la de tu Sombra */
  swapShadow?: boolean;
  /** veces que se puede lanzar por turno */
  perTurn?: number;
  /** si remata a un enemigo, se puede volver a usar este turno gratis */
  resetOnKill?: boolean;
  /** atrae al objetivo estas casillas hacia ti */
  pull?: number;
  /** escudo extra por cada esfera tuya en el tablero */
  sphereShield?: number;
  /** efecto propio de un hechizo concreto (ver `special` en combat/engine.ts) */
  special?: string;
  /** necesita al menos una esfera tuya en el tablero */
  needSphere?: boolean;
  /** se apunta a una de tus esferas */
  atSphere?: boolean;
  /** Furia que consume (y que hay que tener) */
  furyCost?: number;
  /** Furia que genera por cada enemigo golpeado (si no, +20 por lanzamiento que golpee) */
  furyPer?: number;
  /** daño extra por cada punto de Furia (sobre el objetivo principal) */
  furyScale?: number;
  /** todo el área recibe el daño completo (no el 50% de los secundarios) */
  fullArea?: boolean;
  /** apareces a la espalda del objetivo antes de golpear */
  behind?: boolean;
  /** la Sombra no lo replica */
  noEcho?: boolean;
  /** detonar sin consumir las esferas */
  keepSpheres?: boolean;
  /** invoca un aliado controlado por la IA (uno a la vez) */
  summon?: { kind: string; name: string; hpPct: number; armor: number; ap: number; mp: number; initiative: number; spell: string };
  text: string;
}

const S = (d: SpellDef): SpellDef => d;

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(
  [
    // ---------- Hechicera Zorro ----------
    S({ id: 'z_orbe', name: 'Orbe del engaño', route: 'base', ap: 3, cd: 0, perTurn: 2, range: [1, 5], los: true, straight: true, line: true, bounce: 2, target: 'enemy', dmg: [4, 6], element: 'shadow', text: 'Un orbe en línea recta: golpea a los enemigos del camino al ir y otra vez al volver. Sus efectos se aplican una sola vez.' }),
    S({ id: 'z_encanto', name: 'Encanto', route: 'base', ap: 2, cd: 2, range: [1, 7], los: true, straight: true, firstHit: true, pull: 2, status: { kind: 'charm', turns: 1 }, target: 'enemy', text: 'Encanta al primer enemigo de la línea y lo atrae 2 casillas hacia ti. Queda Encantado 1 turno.' }),
    S({ id: 'z_impulso', name: 'Impulso espiritual', route: 'base', ap: 3, cd: 0, perTurn: 1, resetOnKill: true, range: [1, 3], los: false, straight: true, target: 'cell', teleport: true, followUp: { dmg: [5, 7], element: 'shadow', radius: 4 }, text: 'Te desplazas hasta 3 casillas en línea recta ignorando el placaje y lanzas un proyectil al enemigo más cercano a 4 casillas. Si lo remata, puedes volver a usarlo gratis (0 PA).' }),
    S({ id: 'z_drenaje', name: 'Drenaje de esencia', route: 'boon', ap: 2, cd: 1, range: [1, 3], los: true, target: 'enemy', dmg: [4, 6], element: 'shadow', lifesteal: 1, text: 'Te curas todo el daño que haces.' }),
    S({ id: 'z_velo', name: 'Velo espectral', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', buff: { kind: 'invis', turns: 1 }, selfMp: 2, text: 'Invisible durante 1 turno y ganas 2 PM.' }),
    S({ id: 'z_colas', name: 'Danza de colas', route: 'boon', ap: 4, cd: 2, range: [0, 0], los: false, target: 'enemy', area: 1, dmg: [6, 8], element: 'shadow', push: 1, pushAll: true, text: 'Giras con tus nueve colas: daña y empuja 1 casilla a los enemigos pegados a ti.' }),
    S({ id: 'z_maldicion', name: 'Maldición kitsune', route: 'boon', ap: 2, cd: 2, range: [1, 5], los: true, target: 'enemy', dmg: [3, 4], element: 'shadow', status: { kind: 'mark', turns: 2 }, text: 'Marca al objetivo: recibe +2 de daño 2 turnos.' }),
    // ---------- Tejedora de Esferas ----------
    S({ id: 't_pulso', name: 'Pulso oscuro', route: 'base', ap: 3, cd: 0, perTurn: 2, range: [1, 5], los: true, target: 'ground', dmg: [4, 6], element: 'shadow', sphere: { turns: 2, max: 3 }, text: 'Daña al enemigo de la casilla (si lo hay) y deja una Esfera oscura 2 turnos. Máximo 3 esferas: la 4.ª borra la más antigua.' }),
    S({ id: 't_dispersion', name: 'Dispersión', route: 'base', ap: 3, cd: 1, range: [1, 1], los: false, straight: true, target: 'ground', cone: 2, dmg: [4, 6], element: 'shadow', push: 3, sphereHit: { dmg: [9, 11], stun: 1 }, text: 'Onda en cono de 2 casillas: empuja 3 casillas a enemigos y esferas. Una esfera que choca con un enemigo lo daña y lo aturde 1 turno.' }),
    S({ id: 't_descarga', name: 'Descarga desatada', route: 'base', ap: 4, cd: 0, perTurn: 1, range: [1, 5], los: true, target: 'enemy', dmg: [7, 9], element: 'shadow', consume: { per: 8 }, special: 'descarga', text: 'Golpea a un solo objetivo y consume todas tus esferas: +16 de daño por cada una.' }),
    S({ id: 't_semilla', name: 'Semilla oscura', route: 'boon', ap: 1, cd: 1, range: [1, 4], los: true, target: 'ground', sphere: { turns: 2, max: 3 }, text: 'Deja una Esfera oscura sin hacer daño.' }),
    S({ id: 't_implosion', name: 'Implosión', route: 'boon', ap: 3, cd: 2, range: [0, 0], los: false, target: 'self', detonate: { dmg: [6, 8], area: 1 }, element: 'shadow', text: 'Detona todas tus esferas: cada una daña a los enemigos pegados a ella.' }),
    S({ id: 't_pozo', name: 'Pozo gravitatorio', route: 'boon', ap: 3, cd: 2, range: [2, 5], los: true, target: 'enemy', area: 1, dmg: [3, 5], element: 'shadow', status: { kind: 'slow', turns: 1, stacks: 2 }, text: 'Un pozo en área 1: daña y quita 2 PM.' }),
    S({ id: 't_vacio', name: 'Rayo del vacío', route: 'boon', ap: 4, cd: 1, range: [1, 6], los: true, straight: true, line: true, target: 'enemy', dmg: [6, 8], element: 'shadow', text: 'Un rayo en línea recta que atraviesa a todos los enemigos.' }),
    S({ id: 't_eclipse', name: 'Eclipse', route: 'boon', ap: 3, cd: 3, range: [1, 5], los: true, target: 'enemy', dmg: [4, 6], element: 'shadow', drainAp: 2, text: 'Apaga la luz del objetivo: daña y le quita 2 PA.' }),
    // ---------- Acechador de Sombras ----------
    S({ id: 's_shuriken', name: 'Shuriken sombrío', route: 'base', ap: 3, cd: 0, perTurn: 2, range: [1, 5], los: true, straight: true, firstHit: true, target: 'enemy', dmg: [7, 9], text: 'Proyectil en línea recta al primer enemigo. Tu Sombra lanza otro al mismo enemigo si lo ve.' }),
    S({ id: 's_tajo', name: 'Tajo de sombra', route: 'base', ap: 3, cd: 0, perTurn: 2, range: [0, 0], los: false, target: 'enemy', area: 1, dmg: [5, 7], status: { kind: 'slow', turns: 1, stacks: 1 }, text: 'Giras sobre ti: daña a los enemigos pegados a ti y a tu Sombra y les quita 1 PM.' }),
    S({ id: 's_sombra', name: 'Sombra viviente', route: 'base', ap: 2, cd: 2, range: [1, 4], los: false, target: 'cell', shadow: { turns: 2, echo: 0.5 }, text: 'Pones tu Sombra en una casilla libre durante 2 turnos. Replica tus hechizos de daño al 50%. Mientras exista, Intercambiar (1 PA) te cambia de sitio con ella ignorando el placaje.' }),
    S({ id: 's_cambio', name: 'Intercambiar', route: 'temp', ap: 1, cd: 0, range: [0, 0], los: false, target: 'self', swapShadow: true, text: 'Te cambias de sitio con tu Sombra, ignorando el placaje.' }),
    S({ id: 's_ocaso', name: 'Ocaso', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', buff: { kind: 'invis', turns: 1 }, selfMp: 2, text: 'Te fundes en la sombra: invisible 1 turno y +2 PM.' }),
    S({ id: 's_kunai', name: 'Lluvia de kunai', route: 'boon', ap: 4, cd: 2, range: [2, 5], los: true, target: 'enemy', area: 1, dmg: [6, 8], text: 'Una lluvia de kunai en área 1.' }),
    S({ id: 's_hoja', name: 'Hoja envenenada', route: 'boon', ap: 3, cd: 1, range: [1, 1], los: false, target: 'enemy', dmg: [5, 7], element: 'poison', status: { kind: 'poison', turns: 3, stacks: 2 }, text: 'Cuerpo a cuerpo: envenena x2 durante 3 turnos.' }),
    S({ id: 's_ejecucion', name: 'Ejecución silenciosa', route: 'boon', ap: 4, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [12, 15], crit: 20, text: 'Un golpe cuerpo a cuerpo devastador, con +20% de crítico.' }),
    // ---------- Carcelero de Almas ----------
    S({ id: 'k_sentencia', name: 'Sentencia de muerte', route: 'base', ap: 3, cd: 0, perTurn: 1, range: [1, 5], los: true, straight: true, target: 'enemy', dmg: [5, 7], element: 'shadow', drainAp: 2, hook: { pull: 2 }, text: 'Cadena en línea recta: engancha al primer enemigo, le quita 2 PA y lo arrastra 2 casillas hacia ti. Este turno puedes usar Recorrer la cadena (1 PA) para saltar junto a él.' }),
    S({ id: 'k_viaje', name: 'Recorrer la cadena', route: 'temp', ap: 1, cd: 0, range: [1, 14], los: false, target: 'enemy', dash: true, hookOnly: true, text: 'Saltas junto al enemigo enganchado, ignorando el placaje.' }),
    S({ id: 'k_linterna', name: 'Linterna espectral', route: 'base', ap: 2, cd: 2, range: [1, 4], los: true, target: 'cell', lantern: { turns: 1, shield: 8 }, text: 'Linterna en una casilla libre hasta tu próximo turno: da 8 de escudo a los aliados pegados. Un aliado junto a ella puede Tomar la linterna (1 PA) para aparecer a tu lado, ignorando el placaje.' }),
    S({ id: 'k_farol', name: 'Tomar la linterna', route: 'temp', ap: 1, cd: 0, range: [0, 0], los: false, target: 'self', lanternJump: true, text: 'Apareces junto al Carcelero, ignorando el placaje. Necesitas tener su linterna al lado.' }),
    S({ id: 'k_despellejar', name: 'Despellejar', route: 'base', ap: 3, cd: 1, range: [0, 0], los: false, target: 'enemy', area: 1, square: true, pushAll: true, dmg: [6, 8], status: { kind: 'slow', turns: 1, stacks: 2 }, push: 1, text: 'Barrido 3×3 a tu alrededor: daña, quita 2 PM y empuja 1 casilla a todos los enemigos.' }),
    S({ id: 'k_cosecha', name: 'Cosecha', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', soulShield: 2, text: 'Ganas 2 de escudo por cada alma cosechada en la partida (máx. 20).' }),
    S({ id: 'k_grilletes', name: 'Grilletes', route: 'boon', ap: 3, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [4, 6], element: 'shadow', status: { kind: 'slow', turns: 2, stacks: 2 }, text: 'Encadena al objetivo: daña y le quita 2 PM durante 2 turnos.' }),
    S({ id: 'k_condena', name: 'Condena', route: 'boon', ap: 2, cd: 3, range: [1, 5], los: true, target: 'enemy', status: { kind: 'mark', turns: 2 }, extraStatus: { kind: 'exposed', turns: 2, stacks: 2 }, text: 'Marca al objetivo (+2 de daño recibido) y le quita 2 de armadura durante 2 turnos.' }),
    S({ id: 'k_azote', name: 'Azote de cadenas', route: 'boon', ap: 4, cd: 2, range: [1, 4], los: true, straight: true, line: true, target: 'enemy', dmg: [6, 8], element: 'shadow', text: 'Las cadenas barren la línea: dañan a todos los enemigos en ella.' }),
    S({ id: 'k_huesos', name: 'Coraza de huesos', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', shield: 12, text: 'Ganas 12 de escudo.' }),
    S({ id: 'k_alma', name: 'Alma en pena', route: 'boon', ap: 3, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [6, 8], element: 'shadow', lifesteal: 0.5, text: 'Arrancas un trozo de alma: te curas la mitad del daño.' }),
    // ---------- Hechizos únicos (v9): Hechicera Zorro ----------
    S({ id: 'z_fuego', name: 'Fuego zorruno', route: 'boon', ap: 2, cd: 0, perTurn: 1, range: [0, 0], los: false, target: 'self', dmg: [4, 5], element: 'fire', special: 'fatuo', text: '3 llamas azules giran a tu alrededor. Al acabar tu turno, cada una vuela al enemigo más cercano (a 3 casillas; si empatan, al de menos vida y luego al de menos resistencias) y suma Esencia.' }),
    S({ id: 'z_espejismo', name: 'Espejismo ilusorio', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', special: 'decoy', text: 'Dejas un señuelo con 1 de vida en tu casilla y retrocedes 2 casillas ignorando el placaje. Los enemigos cercanos atacan antes al señuelo.' }),
    S({ id: 'z_vortice', name: 'Vórtice espiritual', route: 'boon', ap: 3, cd: 2, range: [2, 5], los: true, target: 'ground', area: 1, fullArea: true, dmg: [4, 6], element: 'shadow', special: 'vortex', text: 'Un remolino daña en cruz y atrae 1 casilla hacia el centro a los enemigos de alrededor. Ideal para alinearlos antes del Orbe.' }),
    S({ id: 'z_seduccion', name: 'Seducción arcana', route: 'boon', ap: 2, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [3, 4], element: 'shadow', special: 'seduce', text: 'Si el objetivo está Encantado o por debajo de la mitad de su vida, le robas 1 PA y 1 PM para este turno.' }),
    S({ id: 'z_estallido', name: 'Estallido de colas', route: 'boon', ap: 3, cd: 2, range: [1, 1], los: false, straight: true, target: 'ground', cone: 2, dmg: [5, 7], element: 'shadow', push: 1, special: 'tails', text: 'Cono frontal de 2 casillas: daña y empuja 1. Si alcanza a 2 o más enemigos, te curas al instante como con el Robo de esencia.' }),
    S({ id: 'z_vinculo', name: 'Vínculo etéreo', route: 'boon', ap: 3, cd: 2, range: [1, 4], los: true, target: 'enemy', behind: true, dmg: [4, 6], element: 'shadow', status: { kind: 'vuln', turns: 1 }, text: 'Apareces a la espalda del enemigo, lo golpeas y lo dejas Vulnerable: +2 de daño recibido hasta su turno.' }),
    // ---------- Tejedora de Esferas ----------
    S({ id: 't_voluntad', name: 'Fuerza de voluntad', route: 'boon', ap: 2, cd: 1, range: [1, 5], los: true, target: 'ground', needSphere: true, special: 'throwsphere', area: 1, fullArea: true, dmg: [5, 7], element: 'shadow', status: { kind: 'slow', turns: 1, stacks: 2 }, text: 'Agarras tu esfera más antigua y la arrojas a la casilla: daña en cruz y quita 2 PM.' }),
    S({ id: 't_gravedad', name: 'Gravedad inversa', route: 'boon', ap: 3, cd: 2, range: [0, 9], los: false, target: 'ground', atSphere: true, special: 'gravity', fullArea: true, dmg: [3, 4], element: 'shadow', text: 'Elige una de tus esferas: atrae 1 casilla hacia ella a los enemigos a 2 casillas y les hace daño ligero.' }),
    S({ id: 't_orbita', name: 'Órbita defensiva', route: 'boon', ap: 2, cd: 2, range: [0, 0], los: false, target: 'self', needSphere: true, special: 'orbit', shield: 10, text: 'Consumes tu esfera más cercana: escudo de 10 y el primer enemigo que te golpee cuerpo a cuerpo sale despedido 1 casilla.' }),
    S({ id: 't_resonancia', name: 'Resonancia oscura', route: 'boon', ap: 3, cd: 2, range: [0, 0], los: false, target: 'self', needSphere: true, detonate: { dmg: [6, 8], area: 1 }, keepSpheres: true, element: 'shadow', text: 'Todas tus esferas emiten un pulso: dañan a los enemigos pegados a ellas sin consumirse.' }),
    S({ id: 't_singularidad', name: 'Singularidad', route: 'boon', ap: 4, cd: 3, range: [2, 5], los: true, target: 'ground', special: 'singularity', dmg: [9, 12], element: 'shadow', text: 'Un agujero negro de 2×2: daño alto a los enemigos de dentro y crea 2 esferas.' }),
    S({ id: 't_transfusion', name: 'Transfusión de vacío', route: 'boon', ap: 1, cd: 0, perTurn: 1, range: [0, 0], los: false, target: 'self', needSphere: true, special: 'transfuse', text: 'Consumes tu esfera más antigua y recuperas 2 PA. Una vez por turno.' }),
    // ---------- Carcelero de Almas ----------
    S({ id: 'k_caja', name: 'La caja', route: 'boon', ap: 4, cd: 3, range: [2, 5], los: true, target: 'ground', special: 'cage', text: 'Muros espectrales en las 8 casillas alrededor de la elegida, hasta tu próximo turno. El enemigo que entre en ellas sufre daño y pierde todos sus PM.' }),
    S({ id: 'k_explosion', name: 'Explosión de almas', route: 'boon', ap: 2, cd: 2, range: [0, 0], los: false, target: 'enemy', area: 1, square: true, dmg: [5, 7], element: 'shadow', special: 'soulburst', text: 'Gastas hasta 3 almas: onda 3×3 a tu alrededor con +6 de daño y 5 de curación por cada alma gastada.' }),
    S({ id: 'k_vinculo', name: 'Cadenas vinculantes', route: 'boon', ap: 3, cd: 2, range: [1, 4], los: true, target: 'enemy', dmg: [3, 4], element: 'shadow', special: 'chainlink', text: 'Encadenas al objetivo con otro enemigo a 2 casillas de él. Si uno de los dos se mueve o lo empujan, el otro sufre daño y pierde 2 PM.' }),
    S({ id: 'k_atraccion', name: 'Atracción del abismo', route: 'boon', ap: 2, cd: 1, range: [0, 0], los: false, target: 'self', special: 'absorb', text: 'Absorbes todas las almas que haya en el tablero, sin caminar hasta ellas: 5 de escudo por cada una.' }),
    S({ id: 'k_tormento', name: 'Tormento espectral', route: 'boon', ap: 3, cd: 1, range: [1, 1], los: false, straight: true, target: 'ground', cone: 3, dmg: [5, 7], element: 'shadow', status: { kind: 'hobble', turns: 2 }, text: 'Arco frontal de 3 casillas con la guadaña: daña y reduce a la mitad la Huida de los golpeados (quedan atrapados por tu placaje).' }),
    S({ id: 'k_sacrificio', name: 'Sacrificio del guardián', route: 'boon', ap: 2, cd: 3, range: [1, 4], los: true, target: 'ally', special: 'guardian', text: 'Te vinculas a un aliado hasta su turno: el 40% del daño que reciba lo recibes tú (con tu armadura).' }),
    // ---------- Acechador de Sombras ----------
    S({ id: 's_marca', name: 'Marca de la muerte', route: 'boon', ap: 4, cd: 3, range: [1, 3], los: true, target: 'enemy', dmg: [5, 7], status: { kind: 'deathmark', turns: 2 }, special: 'deathmark', text: 'Dejas una Sombra a su espalda. Durante 2 turnos guarda el 35% de todo el daño que le hagáis tú y tus sombras; al acabar, estalla con todo ese daño.' }),
    S({ id: 's_danza', name: 'Danza de cuchillas', route: 'boon', ap: 3, cd: 2, range: [0, 0], los: false, target: 'enemy', area: 1, dmg: [4, 6], status: { kind: 'bleed', turns: 2, stacks: 1 }, text: 'Tú y todas tus sombras giráis a la vez: corte en cruz que hace sangrar 2 turnos.' }),
    S({ id: 's_paso', name: 'Paso sombrío', route: 'boon', ap: 2, cd: 2, range: [1, 4], los: false, target: 'enemy', behind: true, special: 'isolated', text: 'Te teletransportas a la espalda de un enemigo ignorando el placaje. Si está aislado (sin aliados a 2 casillas), ganas 1 PM.' }),
    S({ id: 's_velo', name: 'Velo de penumbra', route: 'boon', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', buff: { kind: 'invis', turns: 1 }, special: 'veil', text: 'Invisible 1 turno (o hasta que ataques) y dejas una Sombra en tu casilla.' }),
    S({ id: 's_convergencia', name: 'Convergencia letal', route: 'boon', ap: 3, cd: 2, range: [1, 5], los: true, target: 'enemy', dmg: [6, 8], noEcho: true, special: 'converge', text: 'Tu Sombra se lanza junto al objetivo y lo golpeáis los dos a la vez. Si lo flanqueáis por lados opuestos, ambos golpes son críticos (+5 de daño cada uno).' }),
    S({ id: 's_cosecha', name: 'Cosecha oscura', route: 'boon', ap: 1, cd: 0, perTurn: 1, range: [0, 0], los: false, target: 'self', special: 'reap', text: 'Si tu Sombra y tú habéis golpeado al mismo enemigo este turno, recuperas 2 PA. Una vez por turno.' }),
    // ---------- Bárbaro Desatado ----------
    S({ id: 'b_sed', name: 'Sed de batalla', route: 'base', ap: 2, cd: 0, perTurn: 1, range: [0, 0], los: false, target: 'self', special: 'thirst', text: 'Consumes toda tu Furia para curarte: 2 de vida, más 12 por cada 100 de Furia. Reinicia la Furia a 0.' }),
    S({ id: 'b_tajo', name: 'Tajo despiadado', route: 'base', ap: 3, cd: 0, range: [1, 1], los: false, target: 'enemy', dmg: [7, 9], furyScale: 0.04, text: 'Golpe cuerpo a cuerpo que pega más cuanta más Furia tengas (+8 con 100). Genera 20 de Furia.' }),
    S({ id: 'b_embiste', name: 'Embiste giratorio', route: 'base', ap: 2, cd: 0, perTurn: 1, range: [1, 3], los: false, straight: true, target: 'cell', dmg: [3, 5], special: 'charge', text: 'Te lanzas en línea recta hasta 3 casillas ignorando el placaje: dañas a los enemigos que atraviesas y a los pegados al aterrizar. Genera 20 de Furia.' }),
    S({ id: 'b_grito', name: 'Grito desmoralizador', route: 'boon', ap: 2, cd: 2, range: [0, 0], los: false, target: 'self', special: 'roar', text: 'Rugido 3×3 a tu alrededor: quita 2 PA a los enemigos y ganas 15 de Furia por cada uno.' }),
    S({ id: 'b_colosal', name: 'Golpe colosal', route: 'boon', ap: 4, cd: 2, range: [1, 1], los: false, target: 'enemy', dmg: [16, 20], furyCost: 50, special: 'colossal', text: 'Consume 50 de Furia: golpe devastador que empuja 2 casillas; si choca contra algo, lo aturde 1 turno.' }),
    S({ id: 'b_pacto', name: 'Pacto de sangre', route: 'boon', ap: 1, cd: 0, perTurn: 1, range: [0, 0], los: false, target: 'self', selfDmgPct: 0.15, special: 'pact', text: 'Sacrificas el 15% de tu vida actual: +40 de Furia y +1 PM este turno.' }),
    S({ id: 'b_cuchillada', name: 'Cuchillada giratoria', route: 'boon', ap: 3, cd: 1, range: [0, 0], los: false, target: 'enemy', area: 1, square: true, dmg: [5, 7], furyPer: 10, text: 'Golpeas las 8 casillas de alrededor: 10 de Furia por cada enemigo golpeado.' }),
    S({ id: 'b_mirada', name: 'Mirada del verdugo', route: 'boon', ap: 2, cd: 3, range: [1, 4], los: true, target: 'enemy', status: { kind: 'verdugo', turns: 2 }, text: 'Marcas a tu presa 2 turnos: empiezas tus turnos con +1 PM y tus ataques contra ella generan el doble de Furia.' }),
    S({ id: 'b_frenesi', name: 'Frenesí imparable', route: 'boon', ap: 3, cd: 4, range: [0, 0], los: false, target: 'self', buff: { kind: 'frenzy', turns: 2 }, text: 'Durante 2 turnos eres inmune al placaje y al aturdimiento, pero recibes +1 de daño de cada golpe.' }),
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
    S({ id: 'marca', name: 'Marca del juicio', route: 'juicio', ap: 2, cd: 1, range: [1, 5], los: true, target: 'enemy', status: { kind: 'mark', turns: 2 }, text: 'El objetivo recibe +2 de daño 2 turnos.' }),
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
    S({ id: 'punto_debil', name: 'Punto débil', route: 'sombras', ap: 2, cd: 2, range: [1, 5], los: true, target: 'enemy', dmg: [3, 4], status: { kind: 'mark', turns: 3 }, text: 'El objetivo recibe +2 de daño 3 turnos.' }),
    S({ id: 'golpe_bajo', name: 'Golpe bajo', route: 'sombras', ap: 3, cd: 3, range: [1, 1], los: false, target: 'enemy', dmg: [4, 6], status: { kind: 'stun', turns: 1 }, text: 'Aturde 1 turno.' }),
    S({ id: 'voltereta', name: 'Voltereta', route: 'acrobata', ap: 2, cd: 1, range: [2, 4], los: true, target: 'enemy', dmg: [5, 7], dash: true, text: 'Saltas junto al enemigo y golpeas.' }),
    S({ id: 'evasion', name: 'Evasión', route: 'acrobata', ap: 2, cd: 2, range: [0, 0], los: false, target: 'self', shield: 10, text: 'Ganas 10 de escudo.' }),
    S({ id: 'senal', name: 'Señal de avance', route: 'acrobata', ap: 3, cd: 3, range: [1, 4], los: true, target: 'ally', giveMp: 2, giveAp: 1, text: 'Un aliado gana 2 PM y 1 PA.' }),
    // ---------- Arquero ----------
    S({ id: 'flecha', name: 'Flecha', route: 'base', ap: 3, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [6, 9], text: 'Disparo básico. No alcanza a enemigos pegados a ti.' }),
    S({ id: 'certero', name: 'Disparo certero', route: 'francotirador', ap: 4, cd: 1, range: [3, 7], los: true, target: 'enemy', dmg: [12, 16], crit: 10, text: 'Disparo lejano de mucho daño.' }),
    S({ id: 'marca_caza', name: 'Marca del cazador', route: 'francotirador', ap: 2, cd: 2, range: [1, 7], los: true, target: 'enemy', dmg: [2, 3], status: { kind: 'mark', turns: 3 }, text: 'El objetivo recibe +2 de daño 3 turnos.' }),
    S({ id: 'perforante', name: 'Tiro perforante', route: 'francotirador', ap: 5, cd: 3, range: [2, 7], los: true, target: 'enemy', dmg: [13, 17], pierce: true, line: true, text: 'Atraviesa a todos los enemigos en línea e ignora la armadura.' }),
    S({ id: 'rapido', name: 'Disparo rápido', route: 'rafaga', ap: 2, cd: 0, range: [2, 5], los: true, target: 'enemy', dmg: [4, 6], text: 'Barato: se puede repetir varias veces por turno.' }),
    S({ id: 'andanada', name: 'Lluvia de flechas', route: 'rafaga', ap: 4, cd: 2, range: [3, 6], los: true, target: 'enemy', area: 1, dmg: [7, 10], text: 'Área 1 alrededor del objetivo.' }),
    S({ id: 'salto_atras', name: 'Salto atrás', route: 'rafaga', ap: 2, cd: 2, range: [1, 3], los: true, target: 'enemy', dmg: [5, 7], retreat: 2, text: 'Disparas y retrocedes 2 casillas.' }),
    S({ id: 'cepo', name: 'Cepo', route: 'trampero', ap: 2, cd: 1, range: [1, 4], los: true, target: 'cell', snare: { dmg: 9 }, text: 'Trampa en una casilla libre: daña y detiene al primer enemigo que la pise.' }),
    S({ id: 'flecha_hielo', name: 'Flecha de escarcha', route: 'trampero', ap: 3, cd: 0, range: [2, 6], los: true, target: 'enemy', dmg: [5, 7], status: { kind: 'slow', turns: 2, stacks: 2 }, text: 'Quita 2 PM durante 2 turnos.' }),
    S({ id: 'red', name: 'Red', route: 'trampero', ap: 4, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [3, 4], status: { kind: 'stun', turns: 1 }, text: 'Atrapa al objetivo: pierde su próximo turno.' }),
    S({ id: 'lobo', name: 'Invocar lobo', route: 'bestias', ap: 4, cd: 4, range: [1, 2], los: true, target: 'cell', summon: { kind: 'lobo', name: 'Lobo', hpPct: 0.6, armor: 1, ap: 6, mp: 5, initiative: 12, spell: 'e_mordida' }, text: 'Un lobo lucha a tu lado (uno a la vez). Hereda tu daño extra.' }),
    S({ id: 'orden', name: 'Orden de caza', route: 'bestias', ap: 2, cd: 2, range: [1, 6], los: false, target: 'ally', giveAp: 3, giveMp: 2, text: 'Tu lobo (o un aliado) gana 3 PA y 2 PM en su próximo turno.' }),
    S({ id: 'vinculo', name: 'Vínculo', route: 'bestias', ap: 3, cd: 3, range: [0, 0], los: false, target: 'ally', area: 3, heal: 10, text: 'Cura 10 a ti y a los aliados en área 3.' }),
    // ---------- Kit inicial: segunda habilidad de daño y potenciación propia ----------
    S({ id: 'hachazo', name: 'Hachazo', route: 'base', ap: 4, cd: 1, range: [1, 1], los: false, target: 'enemy', dmg: [11, 15], text: 'Golpe pesado cuerpo a cuerpo.' }),
    S({ id: 'sed_sangre', name: 'Sed de sangre', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', selfDmgPct: 0.15, buff: { kind: 'empower', turns: 2, stacks: 35 }, text: 'Pierdes el 15% de tu vida actual: +4 de daño este turno y el siguiente.' }),
    S({ id: 'chispa', name: 'Chispa ígnea', route: 'base', ap: 3, cd: 1, range: [1, 4], los: true, target: 'enemy', dmg: [7, 10], status: { kind: 'burn', turns: 1 }, text: 'Daño de fuego que quema 1 turno.' }),
    S({ id: 'escudo_arcano', name: 'Escudo arcano', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', shield: 14, buff: { kind: 'empower', turns: 2, stacks: 15 }, text: 'Escudo de 14 y +2 de daño este turno y el siguiente.' }),
    S({ id: 'castigo', name: 'Castigo divino', route: 'base', ap: 3, cd: 1, range: [1, 4], los: true, target: 'enemy', dmg: [7, 10], text: 'Rayo de luz a distancia.' }),
    S({ id: 'fervor', name: 'Fervor', route: 'base', ap: 2, cd: 3, range: [0, 0], los: false, target: 'self', heal: 8, buff: { kind: 'empower', turns: 2, stacks: 20 }, text: 'Te curas 8 y ganas +2 de daño este turno y el siguiente.' }),
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
    S({ id: 'a_ignea', name: 'Flecha ígnea', route: 'boon', ap: 3, cd: 1, range: [2, 6], los: true, target: 'enemy', dmg: [5, 7], element: 'fire', status: { kind: 'burn', turns: 2 }, text: 'Una flecha en llamas que quema 2 turnos.' }),
    S({ id: 'a_conmocion', name: 'Disparo conmocionante', route: 'boon', ap: 3, cd: 3, range: [1, 4], los: true, target: 'enemy', dmg: [4, 6], drainAp: 2, text: 'Aturde los sentidos: daña y quita 2 PA.' }),
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

// ---------------------------------------------------------------------------
// v12: daño plano. Sin dados: cada hechizo hace un daño fijo (la media de su antiguo rango).
// Los hechizos de los héroes (y aliados) hacen el doble; los de los enemigos se quedan igual.
// El potenciado pasa de % a daño plano (+1 por cada 10% antiguo).
// ---------------------------------------------------------------------------
export const HERO_DMG_MULT = 2;
const fixed = (r: readonly [number, number], m: number): [number, number] => { const v = Math.max(1, Math.round(((r[0] + r[1]) / 2) * m)); return [v, v]; };
const flatEmpower = (b: SpellDef['buff']): SpellDef['buff'] => (b?.kind === 'empower' && b.stacks ? { ...b, stacks: Math.max(1, Math.round(b.stacks / 10)) } : b);
for (const d of Object.values(SPELLS)) {
  const m = d.route === 'enemy' ? 1 : HERO_DMG_MULT;
  if (d.dmg) d.dmg = fixed(d.dmg, m);
  if (d.followUp) d.followUp = { ...d.followUp, dmg: fixed(d.followUp.dmg, m) };
  if (d.detonate) d.detonate = { ...d.detonate, dmg: fixed(d.detonate.dmg, m) };
  if (d.sphereHit) d.sphereHit = { ...d.sphereHit, dmg: fixed(d.sphereHit.dmg, m) };
  if (d.consume) d.consume = { ...d.consume, per: d.consume.per * m };
  if (d.furyScale) d.furyScale *= m;
  if (d.snare) d.snare = { ...d.snare, dmg: d.snare.dmg * m };
  d.buff = flatEmpower(d.buff);
  d.selfBuff2 = flatEmpower(d.selfBuff2);
}

/** Texto de un daño fijo («12») o de un rango si alguna mejora lo deja desigual («10-12»). */
export const dmgText = (r: readonly [number, number]): string => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);
