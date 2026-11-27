// Catálogo de runas universales (solo datos). La lógica que las aplica está en core/runes.ts
// y la de sus efectos en combate en core/combat/runefx.ts. Ninguna runa pertenece a una clase.
import type { Stats } from './items/items';
import type { Element, StatusKind } from './state';

export type RuneFamily = 'vida' | 'muerte' | 'tiempo' | 'materia';
export const FAMILIES: RuneFamily[] = ['vida', 'muerte', 'tiempo', 'materia'];
export const FAMILY_NAME: Record<RuneFamily, string> = { vida: 'Vida', muerte: 'Muerte', tiempo: 'Tiempo', materia: 'Materia' };
export const FAMILY_ICON: Record<RuneFamily, string> = { vida: '🌿', muerte: '💀', tiempo: '⏳', materia: '⛰️' };
export const FAMILY_COLOR: Record<RuneFamily, string> = { vida: '#7fd36a', muerte: '#c04060', tiempo: '#6fb6ff', materia: '#e0a050' };

/** 1 Común · 2 Infrecuente · 3 Rara · 4 Épica · 5 Legendaria */
export type RuneRarity = 1 | 2 | 3 | 4 | 5;
export const RARITY_NAME: Record<RuneRarity, string> = { 1: 'Común', 2: 'Infrecuente', 3: 'Rara', 4: 'Épica', 5: 'Legendaria' };

/** Tipo de efecto (para filtrar en el Grimorio). */
export type RuneKind = 'stat' | 'element' | 'status' | 'behavior' | 'mutation' | 'synergy';
export const KIND_NAME: Record<RuneKind, string> = { stat: 'Estadística', element: 'Elemental', status: 'Estados', behavior: 'Comportamiento', mutation: 'Mutación', synergy: 'Sinergia' };

/**
 * Efectos de combate que no caben en los datos del hechizo: los ejecuta el motor (core/combat/runefx.ts) una vez por
 * lanzamiento o por golpe principal. Nunca se disparan al consultar un hechizo.
 */
export type RuneTrigger =
  | 'splinter'     // el golpe salpica a `n` enemigos a 2 casillas del objetivo al `v` del daño
  | 'chain'        // el golpe rebota `n` veces al enemigo más cercano (a 3 casillas) al `v` del daño
  | 'pierceBehind' // el proyectil atraviesa y golpea al enemigo de detrás al `v` del daño
  | 'echo'         // el lanzamiento se repite al empezar tu siguiente turno en la misma casilla al `v` del daño
  | 'execute'      // si deja al objetivo con un estado negativo por debajo del `v` de su vida, lo remata (jefes: +`n` de daño)
  | 'detonate'     // consume Sangrado, Veneno y Quemadura del objetivo y los inflige de golpe ×`v`
  | 'shatter'      // al rematar, el objetivo estalla: `v` de su vida máxima a los enemigos a `n` casillas
  | 'spreadOnKill' // al rematar, sus estados negativos saltan a los enemigos pegados
  | 'leechDot'     // los golpes a objetivos con daño progresivo te curan el `v` del daño
  | 'healBurst'    // las curaciones dañan a los enemigos pegados al aliado curado (`v` de lo curado)
  | 'regenOnHeal'  // curas y escudos dan Regeneración (`n` cargas, `v` turnos)
  | 'cleanse'      // curas y escudos eliminan `n` estados negativos y dan Barrera rúnica (`v` cargas)
  | 'reflect'      // tus escudos dan Baluarte prismático `v` turnos
  | 'flames'       // deja llamas en el suelo (`v` rondas) en la casilla del objetivo y su área
  | 'hasteOnKill'  // al rematar, +`v` PA (una vez por turno)
  | 'resonance'    // los golpes aplican `v` cargas de Resonancia rúnica
  | 'overheal'     // la curación sobrante se convierte en escudo (`v` de lo sobrante)
  | 'shieldPerHit' // cada enemigo alcanzado te da `v` de escudo
  | 'resetOnKill'; // al rematar, la habilidad vuelve a estar disponible este turno

/** Transformaciones de forma completas (runas de mutación). */
export type RuneMutation =
  | 'nova'      // golpe a un objetivo → área cuadrada de radio `v` a daño completo, +1 PA
  | 'lance'     // habilidad cuerpo a cuerpo → lanza en línea recta de 2 a 5 casillas que atraviesa a todos
  | 'twin'      // sin enfriamiento y un uso más por turno, al `v` del daño
  | 'cataclysm' // área +`v`, el área recibe el daño completo, +2 PA
  | 'leech'     // la habilidad de daño pasa a robar `v` del daño y su elemento pasa a ser veneno
  | 'bulwark';  // la habilidad de daño también te da escudo igual a `v` de su daño máximo

/** Operaciones declarativas: cada una dice qué toca. Las que no encajan con una habilidad se ignoran en ella. */
export type RuneOp =
  | { op: 'dmgMul'; v: number }
  | { op: 'dmgFlat'; v: number }
  | { op: 'apCost'; v: number }
  | { op: 'range'; v: number }
  | { op: 'area'; v: number }
  | { op: 'status'; kind: StatusKind; turns: number; stacks: number }
  | { op: 'statusTurns'; v: number }
  | { op: 'element'; el: Element }
  | { op: 'armorIgnore'; v: number }
  | { op: 'lifesteal'; v: number }
  | { op: 'crit'; v: number }
  | { op: 'perTurn'; v: number }
  | { op: 'cd'; v: number }
  | { op: 'healMul'; v: number }
  | { op: 'shieldMul'; v: number }
  | { op: 'utilShield'; v: number }
  | { op: 'push'; v: number }
  | { op: 'bonusVs'; kind: StatusKind; dmg: number }
  | { op: 'selfCostPct'; v: number }
  | { op: 'trigger'; t: RuneTrigger; v: number; n?: number; kind?: StatusKind }
  | { op: 'mutate'; m: RuneMutation; v: number }
  /** estadísticas de la unidad (no del hechizo) */
  | { op: 'stats'; stats: Stats }
  /** rasgo de combate de la unidad (ver Unit.traits) */
  | { op: 'trait'; id: string };

export interface RuneDef {
  id: string;
  name: string;
  family: RuneFamily;
  rarity: RuneRarity;
  kind: RuneKind;
  /** descripción narrativa */
  lore: string;
  /** efecto mecánico, tal cual funciona */
  text: string;
  /** ejemplo de funcionamiento */
  example: string;
  ops: RuneOp[];
  /** admite equiparse varias veces (sus efectos se suman) */
  stackable?: boolean;
  /** solo la da este jefe (id de BossDef) */
  boss?: string;
  /** recompensa del jefe final */
  final?: boolean;
}

const R = (d: RuneDef): RuneDef => d;

export const RUNE_LIST: RuneDef[] = [
  // ==================== VIDA ====================
  R({ id: 'brote', name: 'Brote', family: 'vida', rarity: 1, kind: 'stat', lore: 'Un tallo verde que insiste en crecer entre las losas.', text: 'Curaciones y escudos +30%.', example: 'Un escudo de 10 pasa a 13.', ops: [{ op: 'healMul', v: 1.3 }, { op: 'shieldMul', v: 1.3 }], stackable: true }),
  R({ id: 'corazon_piedra', name: 'Corazón de piedra', family: 'vida', rarity: 1, kind: 'stat', lore: 'Late despacio, pero no se detiene.', text: '+20 de vida máxima.', example: 'Con 60 de vida pasas a 80.', ops: [{ op: 'stats', stats: { hp: 20 } }], stackable: true }),
  R({ id: 'espora', name: 'Espora', family: 'vida', rarity: 1, kind: 'status', lore: 'Polvo verde que arraiga en la herida.', text: 'Tus golpes aplican Veneno (2 cargas, 3 turnos).', example: 'Dos golpes dejan 4 cargas: 8 de daño por turno.', ops: [{ op: 'status', kind: 'poison', turns: 3, stacks: 2 }] }),
  R({ id: 'savia', name: 'Savia', family: 'vida', rarity: 1, kind: 'stat', lore: 'Bebe de lo que hiere.', text: 'Tus habilidades de daño roban el 12% del daño.', example: '20 de daño te curan 2.', ops: [{ op: 'lifesteal', v: 0.12 }], stackable: true }),
  R({ id: 'retono', name: 'Retoño', family: 'vida', rarity: 2, kind: 'status', lore: 'Donde cae la luz, algo vuelve a brotar.', text: 'Tus curas y escudos dan Regeneración (2 cargas, 3 turnos).', example: 'El aliado recupera 6 de vida al empezar cada turno.', ops: [{ op: 'trigger', t: 'regenOnHeal', v: 3, n: 2 }] }),
  R({ id: 'contagio', name: 'Contagio', family: 'vida', rarity: 2, kind: 'status', lore: 'Nada muere solo en el Abismo.', text: 'Al rematar, los estados negativos del objetivo saltan a los enemigos pegados.', example: 'Un enemigo con 6 de Veneno muere y sus vecinos heredan el Veneno.', ops: [{ op: 'trigger', t: 'spreadOnKill', v: 1 }] }),
  R({ id: 'purga', name: 'Purga', family: 'vida', rarity: 2, kind: 'status', lore: 'Savia limpia que arrastra lo podrido.', text: 'Curas y escudos eliminan 1 estado negativo y dan Barrera rúnica (1 carga).', example: 'Curas a un aliado aturdido: se libra del aturdimiento y bloquea el siguiente estado.', ops: [{ op: 'trigger', t: 'cleanse', v: 1, n: 1 }] }),
  R({ id: 'sangre_verde', name: 'Sangre verde', family: 'vida', rarity: 2, kind: 'element', lore: 'La savia corrompida quema como ácido.', text: 'Tu daño pasa a ser de veneno y hace +5 contra envenenados.', example: 'Contra un envenenado, un golpe de 10 hace 15 (de veneno).', ops: [{ op: 'element', el: 'poison' }, { op: 'bonusVs', kind: 'poison', dmg: 5 }] }),
  R({ id: 'floracion', name: 'Floración', family: 'vida', rarity: 3, kind: 'behavior', lore: 'Las flores del Abismo tienen dientes.', text: 'Tus curaciones dañan a los enemigos pegados al aliado curado (100% de lo curado).', example: 'Curas 15 a un aliado rodeado: cada enemigo pegado recibe 15.', ops: [{ op: 'trigger', t: 'healBurst', v: 1 }] }),
  R({ id: 'simbionte', name: 'Simbionte', family: 'vida', rarity: 3, kind: 'synergy', lore: 'Vive de la enfermedad de otros.', text: 'Golpear a un objetivo con daño progresivo te cura el 35% del daño. Tus golpes aplican Corrupción (1 carga, 3 turnos).', example: 'Golpeas 20 a un sangrante: te curas 7 y deja de poder curarse bien.', ops: [{ op: 'trigger', t: 'leechDot', v: 0.35 }, { op: 'status', kind: 'corrupt', turns: 3, stacks: 1 }] }),
  R({ id: 'raiz_viva', name: 'Raíz viva', family: 'vida', rarity: 3, kind: 'stat', lore: 'Echa raíces en tu carne.', text: 'Recuperas el 8% de tu vida al empezar cada turno.', example: 'Con 80 de vida, 6 por turno.', ops: [{ op: 'trait', id: 'regen' }] }),
  R({ id: 'mutageno', name: 'Mutágeno', family: 'vida', rarity: 4, kind: 'mutation', lore: 'La habilidad se hincha y revienta en esporas.', text: 'MUTACIÓN: tus golpes a un solo objetivo se convierten en área cuadrada (radio 1) con Veneno (3 cargas). +1 PA.', example: 'Un disparo único golpea al objetivo y a los 8 que lo rodean.', ops: [{ op: 'mutate', m: 'nova', v: 1 }, { op: 'status', kind: 'poison', turns: 3, stacks: 3 }] }),
  R({ id: 'transfusion', name: 'Transfusión negra', family: 'vida', rarity: 4, kind: 'mutation', lore: 'La herida se vuelve vena.', text: 'MUTACIÓN: tus habilidades de daño roban el 50% del daño y pasan a ser de veneno. La curación sobrante se vuelve escudo.', example: 'Un golpe de 30 con la vida llena te da 15 de escudo.', ops: [{ op: 'mutate', m: 'leech', v: 0.5 }, { op: 'trigger', t: 'overheal', v: 1 }] }),
  R({ id: 'corazon_raiz', name: 'Corazón de la Madre Raíz', family: 'vida', rarity: 5, kind: 'synergy', boss: 'madre', lore: 'Late aún, arrancado del tronco.', text: 'Toda curación sobrante se vuelve escudo; curas y escudos dan Regeneración (3 cargas, 4 turnos) y +60% de potencia; tus golpes dan Regeneración a ti (1 carga).', example: 'Un escudo de 10 da 16 y deja a tu aliado regenerando 9 por turno.', ops: [{ op: 'healMul', v: 1.6 }, { op: 'shieldMul', v: 1.6 }, { op: 'trigger', t: 'overheal', v: 1 }, { op: 'trigger', t: 'regenOnHeal', v: 4, n: 3 }] }),

  // ==================== MUERTE ====================
  R({ id: 'hemorragia', name: 'Hemorragia', family: 'muerte', rarity: 1, kind: 'status', lore: 'Abre lo que debería estar cerrado.', text: 'Tus golpes aplican Sangrado (2 cargas, 3 turnos). El Sangrado se acumula hasta 10.', example: 'Tres golpes: 6 cargas, 12 de daño por turno que ignora la armadura.', ops: [{ op: 'status', kind: 'bleed', turns: 3, stacks: 2 }] }),
  R({ id: 'filo_negro', name: 'Filo negro', family: 'muerte', rarity: 1, kind: 'stat', lore: 'Busca siempre la arteria.', text: '+12% de crítico en tus habilidades de daño.', example: 'Con 10% de crítico, golpeas con 22%.', ops: [{ op: 'crit', v: 12 }], stackable: true }),
  R({ id: 'cosecha', name: 'Cosecha', family: 'muerte', rarity: 1, kind: 'stat', lore: 'Corta lo que ya está maduro.', text: 'Roba el 20% del daño y +4 de daño contra objetivos que sangran.', example: 'Golpe de 15 contra un sangrante: 19 y te curas 4.', ops: [{ op: 'lifesteal', v: 0.2 }, { op: 'bonusVs', kind: 'bleed', dmg: 4 }] }),
  R({ id: 'condena', name: 'Condena', family: 'muerte', rarity: 2, kind: 'status', lore: 'El dolor de hoy se cobra mañana.', text: 'Tus golpes aplican Condena (2 turnos): guarda el 50% de todo el daño que recibe y lo recibe de golpe al acabarse.', example: 'Le hacéis 40 entre todos: al acabarse la Condena, recibe 20 más.', ops: [{ op: 'status', kind: 'doom', turns: 2, stacks: 1 }] }),
  R({ id: 'sacrificio', name: 'Sacrificio', family: 'muerte', rarity: 2, kind: 'stat', lore: 'Toda ofrenda exige sangre propia.', text: 'Tus habilidades de daño cuestan el 6% de tu vida actual y hacen +45% de daño.', example: 'Con 70 de vida pagas 4 y un golpe de 20 hace 29.', ops: [{ op: 'selfCostPct', v: 0.06 }, { op: 'dmgMul', v: 1.45 }] }),
  R({ id: 'sombra_hueca', name: 'Sombra hueca', family: 'muerte', rarity: 2, kind: 'element', lore: 'El filo se vuelve noche.', text: 'Tu daño pasa a ser de sombra e ignora 3 de armadura.', example: 'Contra 4 de armadura, solo cuenta 1.', ops: [{ op: 'element', el: 'shadow' }, { op: 'armorIgnore', v: 3 }] }),
  R({ id: 'mascara_furia', name: 'Máscara de furia', family: 'muerte', rarity: 2, kind: 'stat', lore: 'Bajo ella, la cara de quien ya ha muerto una vez.', text: '+4 de daño mientras estés por debajo de la mitad de vida.', example: 'Herido, cada golpe pega 4 más.', ops: [{ op: 'trait', id: 'enrage' }] }),
  R({ id: 'ejecucion', name: 'Ejecución', family: 'muerte', rarity: 3, kind: 'behavior', lore: 'La hoja no duda con los que ya cayeron.', text: 'Si tu golpe deja a un objetivo con un estado negativo por debajo del 20% de su vida (élites 12%), muere. Los jefes reciben +20 de daño en su lugar.', example: 'Un élite de 100 de vida, envenenado, queda a 11: muere.', ops: [{ op: 'trigger', t: 'execute', v: 0.2, n: 20 }] }),
  R({ id: 'filo_verdugo', name: 'Filo del verdugo', family: 'muerte', rarity: 3, kind: 'stat', lore: 'Lo forjó alguien que nunca falló un tajo.', text: 'Tus críticos hacen el doble de daño extra. +8% de crítico.', example: 'Un crítico pasa de +5 a +10.', ops: [{ op: 'trait', id: 'execute' }, { op: 'crit', v: 8 }] }),
  R({ id: 'detonacion', name: 'Detonación', family: 'muerte', rarity: 4, kind: 'behavior', lore: 'Todo lo que duele, de una vez.', text: 'Tus golpes consumen el Sangrado, el Veneno y la Quemadura del objetivo y los infligen de golpe ×2.', example: '8 cargas de Sangrado (16 por turno) se convierten en 32 al instante.', ops: [{ op: 'trigger', t: 'detonate', v: 2 }] }),
  R({ id: 'corona_osario', name: 'Corona del Osario', family: 'muerte', rarity: 5, kind: 'behavior', boss: 'prior', lore: 'La corona del Prior aún pesa sobre los huesos.', text: 'Al rematar, el cadáver estalla (35% de su vida máxima a los enemigos a 2 casillas) y contagia sus estados negativos.', example: 'Matas a un élite de 120 de vida: 42 de daño a todo lo que haya cerca.', ops: [{ op: 'trigger', t: 'shatter', v: 0.35, n: 2 }, { op: 'trigger', t: 'spreadOnKill', v: 1 }] }),
  R({ id: 'segador', name: 'Juicio del Segador', family: 'muerte', rarity: 5, kind: 'mutation', final: true, lore: 'El último juicio no admite apelación.', text: 'Tus golpes aplican Condena y Corrupción; rematar reinicia la habilidad (vuelve a estar disponible y gratis); la ejecución alcanza al 30%.', example: 'Encadenas tres remates seguidos con la misma habilidad.', ops: [{ op: 'status', kind: 'doom', turns: 2, stacks: 1 }, { op: 'status', kind: 'corrupt', turns: 3, stacks: 2 }, { op: 'trigger', t: 'resetOnKill', v: 1 }, { op: 'trigger', t: 'execute', v: 0.3, n: 30 }] }),

  // ==================== TIEMPO ====================
  R({ id: 'aceleracion', name: 'Aceleración', family: 'tiempo', rarity: 1, kind: 'stat', lore: 'Un latido más corto que los demás.', text: 'Tus habilidades de daño cuestan 1 PA menos (mínimo 1).', example: 'Un hechizo de 4 PA cuesta 3.', ops: [{ op: 'apCost', v: -1 }] }),
  R({ id: 'dilatacion', name: 'Dilatación', family: 'tiempo', rarity: 1, kind: 'status', lore: 'Estira el instante hasta que duele.', text: 'Los estados que aplican tus habilidades duran 1 turno más.', example: 'Un Veneno de 3 turnos dura 4.', ops: [{ op: 'statusTurns', v: 1 }], stackable: true }),
  R({ id: 'pluma', name: 'Pluma del reloj', family: 'tiempo', rarity: 1, kind: 'stat', lore: 'Pesa menos que el tiempo que ahorra.', text: '+1 PM y +6 de iniciativa.', example: 'Actúas antes y llegas más lejos.', ops: [{ op: 'stats', stats: { mp: 1, initiative: 6 } }] }),
  R({ id: 'presteza', name: 'Presteza', family: 'tiempo', rarity: 1, kind: 'behavior', lore: 'Llega antes de salir.', text: 'Tus habilidades a distancia ganan +1 de alcance máximo.', example: 'Alcance 2-5 pasa a 2-6.', ops: [{ op: 'range', v: 1 }], stackable: true }),
  R({ id: 'repeticion', name: 'Repetición', family: 'tiempo', rarity: 2, kind: 'behavior', lore: 'Lo que ya ocurrió puede volver a ocurrir.', text: 'Las habilidades limitadas por turno ganan 1 uso más; las que tienen enfriamiento, −1 turno.', example: 'Un hechizo de 2 usos por turno pasa a 3.', ops: [{ op: 'perTurn', v: 1 }, { op: 'cd', v: -1 }] }),
  R({ id: 'escarcha', name: 'Escarcha', family: 'tiempo', rarity: 2, kind: 'status', lore: 'El tiempo se detiene primero en la piel.', text: 'Tus golpes aplican Escarcha (1 carga, 3 turnos). Con 3 cargas, el objetivo queda Congelado.', example: 'Tres golpes congelan: pierde su turno (élites y jefes, 1 PA y 2 PM).', ops: [{ op: 'status', kind: 'chill', turns: 3, stacks: 1 }] }),
  R({ id: 'impulso', name: 'Impulso temporal', family: 'tiempo', rarity: 2, kind: 'behavior', lore: 'El último aliento del enemigo es tu siguiente paso.', text: 'Al rematar con una habilidad, ganas +1 PA (una vez por turno).', example: 'Rematas y aún te queda para otro hechizo.', ops: [{ op: 'trigger', t: 'hasteOnKill', v: 1 }] }),
  R({ id: 'anticipacion', name: 'Anticipación', family: 'tiempo', rarity: 2, kind: 'status', lore: 'Sabes dónde va a golpear antes que él.', text: 'Tus golpes aplican Debilitado (2 turnos): hace un 25% menos de daño.', example: 'Un jefe que pegaba 24 pega 18.', ops: [{ op: 'status', kind: 'weak', turns: 2, stacks: 1 }] }),
  R({ id: 'eco_diferido', name: 'Eco diferido', family: 'tiempo', rarity: 3, kind: 'behavior', lore: 'El golpe se queda temblando en el aire.', text: 'Al empezar tu siguiente turno, la habilidad vuelve a golpear la misma casilla y su área al 50%.', example: 'Una bola de fuego de 20 vuelve a estallar por 10 en tu siguiente turno.', ops: [{ op: 'trigger', t: 'echo', v: 0.5 }] }),
  R({ id: 'reloj_arena', name: 'Reloj de arena', family: 'tiempo', rarity: 3, kind: 'stat', lore: 'Un reloj sin agujas que aún da la hora.', text: '+1 PA.', example: 'Con 6 PA pasas a 7.', ops: [{ op: 'stats', stats: { ap: 1 } }] }),
  R({ id: 'bucle', name: 'Bucle', family: 'tiempo', rarity: 4, kind: 'mutation', lore: 'La habilidad olvida que ya la usaste.', text: 'MUTACIÓN: tus habilidades de daño no tienen enfriamiento y ganan un uso más por turno, al 80% del daño.', example: 'Un golpe de enfriamiento 2 se puede usar dos veces cada turno.', ops: [{ op: 'mutate', m: 'twin', v: 0.8 }] }),
  R({ id: 'tiempo_roto', name: 'Tiempo roto', family: 'tiempo', rarity: 5, kind: 'behavior', boss: 'rey', lore: 'Las agujas giraron hacia atrás y no se detuvieron.', text: 'Cada habilidad de daño se repite entera al empezar tu siguiente turno (100%) y los estados que aplicas duran 2 turnos más.', example: 'Lanzas tu mejor golpe una vez y lo recibes dos.', ops: [{ op: 'trigger', t: 'echo', v: 1 }, { op: 'statusTurns', v: 2 }] }),

  // ==================== MATERIA ====================
  R({ id: 'fractura', name: 'Fractura', family: 'materia', rarity: 1, kind: 'status', lore: 'Encuentra la grieta en cualquier coraza.', text: 'Ignora 2 de armadura y aplica Expuesto (1 carga, 2 turnos).', example: 'Contra 3 de armadura, solo cuenta 1, y después 0.', ops: [{ op: 'armorIgnore', v: 2 }, { op: 'status', kind: 'exposed', turns: 2, stacks: 1 }] }),
  R({ id: 'caparazon', name: 'Caparazón', family: 'materia', rarity: 1, kind: 'stat', lore: 'Piedra que se endurece contigo.', text: '+2 de armadura.', example: 'Cada golpe recibido hace 2 menos.', ops: [{ op: 'stats', stats: { armor: 2 } }] }),
  R({ id: 'bastion', name: 'Bastión', family: 'materia', rarity: 1, kind: 'stat', lore: 'Un muro siempre a mano.', text: 'Escudos +50%. Tus habilidades sin daño te dan 4 de escudo.', example: 'Un hechizo de movimiento también te protege.', ops: [{ op: 'shieldMul', v: 1.5 }, { op: 'utilShield', v: 4 }] }),
  R({ id: 'fragmentacion', name: 'Fragmentación', family: 'materia', rarity: 1, kind: 'behavior', lore: 'El impacto se rompe en esquirlas.', text: 'Tus golpes a un objetivo salpican a 1 enemigo a 2 casillas al 40% del daño.', example: 'Un golpe de 20 alcanza también a otro por 8.', ops: [{ op: 'trigger', t: 'splinter', v: 0.4, n: 1 }] }),
  R({ id: 'perforacion', name: 'Perforación', family: 'materia', rarity: 2, kind: 'behavior', lore: 'Nada se interpone dos veces.', text: 'Ignora 4 de armadura y el golpe atraviesa al enemigo de detrás (70%).', example: 'Dos enemigos en fila reciben el mismo disparo.', ops: [{ op: 'armorIgnore', v: 4 }, { op: 'trigger', t: 'pierceBehind', v: 0.7 }] }),
  R({ id: 'ignicion', name: 'Ignición', family: 'materia', rarity: 2, kind: 'element', lore: 'La materia arde cuando se le pide.', text: 'Tu daño pasa a ser de fuego y aplica Quemadura (1 carga, 2 turnos). La Quemadura crece al acumularse.', example: 'Tres golpes: Quemadura de 3 cargas (7 por turno).', ops: [{ op: 'element', el: 'fire' }, { op: 'status', kind: 'burn', turns: 2, stacks: 1 }] }),
  R({ id: 'espejo', name: 'Espejo de obsidiana', family: 'materia', rarity: 2, kind: 'behavior', lore: 'Devuelve lo que recibe, un poco peor.', text: 'Tus escudos también dan Baluarte prismático (2 turnos): devuelve el 15% del daño recibido.', example: 'Un aliado escudado devuelve 3 de cada golpe de 20.', ops: [{ op: 'trigger', t: 'reflect', v: 2 }] }),
  R({ id: 'erizo', name: 'Piel de erizo', family: 'materia', rarity: 2, kind: 'stat', lore: 'Púas de piedra bajo la piel.', text: 'Devuelves el 30% del daño cuerpo a cuerpo. +1 de armadura.', example: 'Te pegan 20 de cerca: el agresor recibe 6.', ops: [{ op: 'trait', id: 'thorns' }, { op: 'stats', stats: { armor: 1 } }] }),
  R({ id: 'metralla', name: 'Metralla', family: 'materia', rarity: 3, kind: 'behavior', lore: 'Cada impacto es una lluvia.', text: 'Tus golpes a un objetivo rebotan a 2 enemigos más (a 3 casillas) al 60%.', example: 'Un disparo de 20 alcanza a tres enemigos: 20, 12 y 12.', ops: [{ op: 'trigger', t: 'chain', v: 0.6, n: 2 }] }),
  R({ id: 'muralla', name: 'Piedra de muralla', family: 'materia', rarity: 3, kind: 'stat', lore: 'Una piedra de la primera muralla del Refugio.', text: 'Empiezas cada turno con un escudo del 15% de tu vida.', example: 'Con 80 de vida, 12 de escudo cada turno.', ops: [{ op: 'trait', id: 'guard' }] }),
  R({ id: 'brasas', name: 'Suelo de brasas', family: 'materia', rarity: 3, kind: 'behavior', lore: 'La piedra recuerda el fuego.', text: 'Tus habilidades de daño dejan llamas en el suelo (2 rondas) en el objetivo y su área: quien las pisa se quema.', example: 'Una zona de fuego cierra un pasillo durante dos rondas.', ops: [{ op: 'trigger', t: 'flames', v: 2 }] }),
  R({ id: 'supernova', name: 'Supernova', family: 'materia', rarity: 4, kind: 'mutation', lore: 'Lo pequeño estalla en grande.', text: 'MUTACIÓN: tus golpes a un solo objetivo se convierten en área cuadrada (radio 1) a daño completo. +1 PA.', example: 'Un tiro de 18 golpea por 18 a todo lo que rodea al objetivo.', ops: [{ op: 'mutate', m: 'nova', v: 1 }] }),
  R({ id: 'lanza_titan', name: 'Lanza del Titán', family: 'materia', rarity: 4, kind: 'mutation', lore: 'El brazo se alarga en piedra.', text: 'MUTACIÓN: tus golpes cuerpo a cuerpo se convierten en lanzas en línea recta (2-5 casillas) que atraviesan a todos. Tus habilidades de daño te dan escudo (30% del daño máximo).', example: 'El hachazo del Bárbaro alcanza a toda una fila.', ops: [{ op: 'mutate', m: 'lance', v: 5 }, { op: 'mutate', m: 'bulwark', v: 0.3 }] }),
  R({ id: 'cataclismo', name: 'Cataclismo', family: 'materia', rarity: 5, kind: 'mutation', boss: 'devorarunas', lore: 'La tierra no se rompe: se reescribe.', text: 'MUTACIÓN: tus habilidades de área ganan +2 de radio y todo el área recibe el daño completo (+2 PA). Tus golpes aplican Resonancia rúnica.', example: 'Una explosión de radio 1 pasa a radio 3 a daño completo.', ops: [{ op: 'mutate', m: 'cataclysm', v: 2 }, { op: 'trigger', t: 'resonance', v: 1 }] }),
  // ==================== RUNAS DE JEFE ====================
  R({ id: 'lamento', name: 'Lamento de la Plañidera', family: 'muerte', rarity: 4, kind: 'status', boss: 'planidera', lore: 'Un llanto que debilita a quien lo oye.', text: 'Tus golpes aplican Debilitado (2 turnos) y Condena (2 turnos), y hacen +6 contra debilitados.', example: 'El jefe pega un 25% menos y acumula su castigo.', ops: [{ op: 'status', kind: 'weak', turns: 2, stacks: 1 }, { op: 'status', kind: 'doom', turns: 2, stacks: 1 }, { op: 'bonusVs', kind: 'weak', dmg: 6 }] }),
  R({ id: 'cepo_cazador', name: 'Cepo del Cazador', family: 'materia', rarity: 4, kind: 'behavior', boss: 'cazador', lore: 'Dientes de hierro que nunca sueltan.', text: 'Tus golpes inmovilizan (1 turno), atraviesan al enemigo de detrás (70%) y hacen +8 contra inmovilizados.', example: 'Clavas a dos enemigos en el sitio de un solo tiro.', ops: [{ op: 'status', kind: 'rooted', turns: 1, stacks: 1 }, { op: 'trigger', t: 'pierceBehind', v: 0.7 }, { op: 'bonusVs', kind: 'rooted', dmg: 8 }] }),
  R({ id: 'crisol', name: 'Crisol de la Fundidora', family: 'materia', rarity: 4, kind: 'element', boss: 'fundidora', lore: 'El metal aún está al rojo.', text: 'Tu daño pasa a ser de fuego, aplica Quemadura (2 cargas), deja llamas en el suelo (2 rondas) y hace +6 contra quemados.', example: 'Cada golpe alimenta un incendio que crece.', ops: [{ op: 'element', el: 'fire' }, { op: 'status', kind: 'burn', turns: 2, stacks: 2 }, { op: 'trigger', t: 'flames', v: 2 }, { op: 'bonusVs', kind: 'burn', dmg: 6 }] }),
  R({ id: 'coro_caidos', name: 'Coro de los Caídos', family: 'tiempo', rarity: 5, kind: 'synergy', boss: 'eco', lore: 'Todas las voces repiten tu golpe.', text: 'Tus habilidades de daño se repiten al 60% al empezar tu siguiente turno y aplican 2 cargas de Resonancia rúnica.', example: 'Cada golpe resuena dos veces y acerca al enemigo a estallar.', ops: [{ op: 'trigger', t: 'echo', v: 0.6 }, { op: 'trigger', t: 'resonance', v: 2 }] }),
];


export const RUNES: Record<string, RuneDef> = Object.fromEntries(RUNE_LIST.map((r) => [r.id, r]));

// ==================== SINERGIAS ====================
export interface SynergyDef {
  id: string;
  name: string;
  /** familias necesarias (2, 3 o 4). Se activa si hay al menos una runa equipada de cada una. */
  families: RuneFamily[];
  text: string;
  ops: RuneOp[];
}

export const SYNERGY_LIST: SynergyDef[] = [
  { id: 'muerte+vida', name: 'Ciclo de la carne', families: ['vida', 'muerte'], text: 'Golpear a un objetivo con daño progresivo te cura el 25% del daño, y rematar contagia sus estados a los vecinos.', ops: [{ op: 'trigger', t: 'leechDot', v: 0.25 }, { op: 'trigger', t: 'spreadOnKill', v: 1 }] },
  { id: 'tiempo+vida', name: 'Savia eterna', families: ['vida', 'tiempo'], text: 'Curas y escudos dan Regeneración (1 carga, 3 turnos); los estados que aplicas duran 1 turno más.', ops: [{ op: 'trigger', t: 'regenOnHeal', v: 3, n: 1 }, { op: 'statusTurns', v: 1 }] },
  { id: 'materia+vida', name: 'Raíces de hueso', families: ['vida', 'materia'], text: 'Tus golpes inmovilizan (1 turno) y cada enemigo alcanzado te da 3 de escudo.', ops: [{ op: 'status', kind: 'rooted', turns: 1, stacks: 1 }, { op: 'trigger', t: 'shieldPerHit', v: 3 }] },
  { id: 'muerte+tiempo', name: 'Sentencia diferida', families: ['muerte', 'tiempo'], text: 'Tus golpes aplican Condena (2 turnos) y +20% de daño.', ops: [{ op: 'status', kind: 'doom', turns: 2, stacks: 1 }, { op: 'dmgMul', v: 1.2 }] },
  { id: 'materia+muerte', name: 'Metralla de huesos', families: ['muerte', 'materia'], text: 'Al rematar, el objetivo estalla: 20% de su vida máxima a los enemigos pegados.', ops: [{ op: 'trigger', t: 'shatter', v: 0.2, n: 1 }] },
  { id: 'materia+tiempo', name: 'Proyectil fractal', families: ['materia', 'tiempo'], text: 'Tus golpes a un objetivo rebotan 1 vez (50%) y se repiten al 30% al empezar tu siguiente turno.', ops: [{ op: 'trigger', t: 'chain', v: 0.5, n: 1 }, { op: 'trigger', t: 'echo', v: 0.3 }] },
  // tríadas
  { id: 'muerte+tiempo+vida', name: 'Rueda de la reencarnación', families: ['vida', 'muerte', 'tiempo'], text: 'Rematar reinicia la habilidad (vuelve a estar disponible y gratis este turno).', ops: [{ op: 'trigger', t: 'resetOnKill', v: 1 }] },
  { id: 'materia+muerte+vida', name: 'Colmena', families: ['vida', 'muerte', 'materia'], text: 'Tus golpes aplican Resonancia rúnica (1 carga) y Veneno (1 carga).', ops: [{ op: 'trigger', t: 'resonance', v: 1 }, { op: 'status', kind: 'poison', turns: 3, stacks: 1 }] },
  { id: 'materia+tiempo+vida', name: 'Jardín del reloj', families: ['vida', 'tiempo', 'materia'], text: 'Curas y escudos eliminan 1 estado negativo; tus escudos devuelven daño (2 turnos).', ops: [{ op: 'trigger', t: 'cleanse', v: 0, n: 1 }, { op: 'trigger', t: 'reflect', v: 2 }] },
  { id: 'materia+muerte+tiempo', name: 'Fin de las eras', families: ['muerte', 'tiempo', 'materia'], text: 'Tus golpes aplican 2 cargas de Resonancia rúnica y +15% de daño.', ops: [{ op: 'trigger', t: 'resonance', v: 2 }, { op: 'dmgMul', v: 1.15 }] },
  // las cuatro
  { id: 'materia+muerte+tiempo+vida', name: 'Abismo primordial', families: ['vida', 'muerte', 'tiempo', 'materia'], text: 'Las cuatro familias a la vez: +30% de daño, curas y escudos, y tus golpes aplican Resonancia rúnica.', ops: [{ op: 'dmgMul', v: 1.3 }, { op: 'healMul', v: 1.3 }, { op: 'shieldMul', v: 1.3 }, { op: 'trigger', t: 'resonance', v: 1 }] },
];
export const SYNERGIES: Record<string, SynergyDef> = Object.fromEntries(SYNERGY_LIST.map((s) => [s.id, s]));

/** Reliquias antiguas que pasan a ser runas al cargar una partida (las que no encajan se reembolsan en oro). */
export const RELIC_TO_RUNE: Record<string, string> = {
  corazon: 'corazon_piedra', caparazon: 'caparazon', pluma: 'pluma', reloj: 'reloj_arena', trebol: 'filo_negro', cristal: 'dilatacion',
  ascua: 'ignicion', vibora: 'espora', hacha: 'filo_verdugo', caliz: 'brote', erizo: 'erizo', raiz: 'raiz_viva', muralla: 'muralla', furia: 'mascara_furia',
};
/** Oro que se devuelve por cada reliquia que no tiene runa equivalente. */
export const RELIC_REFUND = 25;
