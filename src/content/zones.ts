// Las zonas de la partida: enemigos, jefes (uno de dos, al azar), élites, equipo, eventos y aspecto.
// Los objetos y eventos se leen al usarlos (getters): sus módulos dependen de game/run, que a su vez carga este.
// La zona 4 (El Abismo) solo se juega si el anfitrión la tiene desbloqueada y la incluye.
import type { ItemTheme } from '../core/items/items';
import { ZONA1_EVENTS, type EventDef } from './zona1/events';
import { ZONA1_ITEMS } from './zona1/items';
import { ZONA2_EVENTS, ZONA2_ITEMS } from './zona2/content';
import { ZONA3_EVENTS, ZONA3_ITEMS } from './zona3/content';
import { ZONA4_EVENTS, ZONA4_ITEMS } from './zona4/content';

export interface BossDef {
  id: string;
  /** compañía inicial del jefe */
  guard: string[];
  /** lo que invoca en combate */
  minion: string;
  /** pilar que levanta en su segunda fase: lo cura mientras siga en pie */
  pillar: string;
  phase2: string;
  win: string;
}

export interface ZoneDef {
  name: string;
  intro: string;
  /** enemigos normales según lo avanzado de la zona: primeras salas, mitad, final */
  pools: [string[], string[], string[]];
  /** un tirador que siempre aparece en grupo */
  shooter: string;
  /** élites posibles: cada combate de élite usa uno al azar */
  elites: string[];
  /** jefes posibles: cada partida usa uno al azar */
  bosses: BossDef[];
  items: ItemTheme;
  events: EventDef[];
  /** colores del suelo, del obstáculo y de la luz ambiente */
  floor: [string, string];
  rock: [string, string, string];
  light: string;
}

export const ZONES: ZoneDef[] = [
  {
    name: 'Las Catacumbas Olvidadas', intro: 'Las Catacumbas Olvidadas se abren ante vosotros.',
    pools: [['limo', 'murcielago', 'esqueleto', 'calavera'], ['limo', 'murcielago', 'esqueleto', 'arquero', 'espectro', 'momia', 'gargola'], ['murcielago', 'esqueleto', 'arquero', 'necrofago', 'acolito', 'espectro', 'momia', 'sepulturero', 'calavera', 'gargola']],
    shooter: 'arquero', elites: ['caballero', 'abominacion'],
    bosses: [
      { id: 'prior', guard: ['esqueleto', 'arquero'], minion: 'esqueleto', pillar: 'pilar', phase2: 'Coloso del Osario', win: 'El Coloso del Osario se desmorona. Una escalera de raíces sube hacia la superficie.' },
      { id: 'planidera', guard: ['espectro', 'momia'], minion: 'espectro', pillar: 'pilar', phase2: 'La Plañidera Desatada', win: 'El lamento se apaga por fin. Entre el silencio, una escalera de raíces sube hacia la superficie.' },
    ],
    get items() { return ZONA1_ITEMS; }, get events() { return ZONA1_EVENTS; }, floor: ['#2b2339', '#251e33'], rock: ['#5a5473', '#7a7498', '#3e3a52'], light: '255,150,60',
  },
  {
    name: 'El Bosque Corrompido', intro: 'Salís a un bosque enfermo: la savia es negra y los árboles os miran.',
    pools: [['lobo', 'arana', 'tejedora', 'hongo'], ['lobo', 'arana', 'tejedora', 'chaman', 'pantera', 'zarzal'], ['lobo', 'arana', 'chaman', 'ent', 'tejedora', 'pantera', 'zarzal', 'druida', 'hongo']],
    shooter: 'tejedora', elites: ['alfa', 'reina'],
    bosses: [
      { id: 'madre', guard: ['arana', 'chaman'], minion: 'arana', pillar: 'brote', phase2: 'La Raíz Desatada', win: 'La Madre Raíz se seca y se parte. Tras ella, el horizonte arde.' },
      { id: 'cazador', guard: ['lobo', 'pantera'], minion: 'lobo', pillar: 'brote', phase2: 'El Cazador Sin Rostro', win: 'El Cazador cae en su propio cepo. Tras el bosque, el horizonte arde.' },
    ],
    get items() { return ZONA2_ITEMS; }, get events() { return ZONA2_EVENTS; }, floor: ['#22321f', '#1c2a1b'], rock: ['#4a5a3a', '#66784e', '#313f28'], light: '120,220,120',
  },
  {
    name: 'Las Ruinas de Ceniza', intro: 'Un reino entero convertido en brasas. Algo sigue reinando sobre ellas.',
    pools: [['sabueso', 'ceniciento', 'piromante', 'salamandra'], ['sabueso', 'ceniciento', 'piromante', 'forjador', 'tirador'], ['sabueso', 'ceniciento', 'piromante', 'escoria', 'forjador', 'tirador', 'ascua', 'salamandra']],
    shooter: 'piromante', elites: ['verdugo', 'inquisidor'],
    bosses: [
      { id: 'rey', guard: ['ceniciento', 'piromante'], minion: 'sabueso', pillar: 'brasero', phase2: 'Avatar de la Pira', win: 'El Avatar de la Pira se apaga. Por primera vez en siglos, llueve sobre las ruinas.' },
      { id: 'fundidora', guard: ['forjador', 'tirador'], minion: 'salamandra', pillar: 'brasero', phase2: 'La Fundidora al Rojo', win: 'El crisol se resquebraja y el metal se enfría. Por primera vez en siglos, llueve sobre las ruinas.' },
    ],
    get items() { return ZONA3_ITEMS; }, get events() { return ZONA3_EVENTS; }, floor: ['#3a2622', '#30201d'], rock: ['#6a5048', '#8a6a5c', '#473430'], light: '255,110,50',
  },
  {
    name: 'El Abismo', intro: 'La lluvia no llega hasta aquí. Bajo las ruinas se abre el lugar de donde salieron las runas… y algo que se alimenta de ellas.',
    pools: [['vacio', 'ojo', 'larva'], ['vacio', 'ojo', 'larva', 'devorador', 'heraldo'], ['vacio', 'ojo', 'larva', 'devorador', 'heraldo', 'guardian']],
    shooter: 'ojo', elites: ['centinela', 'mimico'],
    bosses: [
      { id: 'devorarunas', guard: ['guardian', 'heraldo'], minion: 'larva', pillar: 'obelisco', phase2: 'El Hambre Sin Fondo', win: 'El Devorador estalla en mil runas que vuelven a brillar. Habéis cerrado el Abismo.' },
      { id: 'eco', guard: ['vacio', 'ojo'], minion: 'vacio', pillar: 'obelisco', phase2: 'El Coro de los Caídos', win: 'Las voces de todos los que cayeron antes que vosotros se callan, por fin en paz. Habéis cerrado el Abismo.' },
    ],
    get items() { return ZONA4_ITEMS; }, get events() { return ZONA4_EVENTS; }, floor: ['#16121f', '#120e1a'], rock: ['#3a2f57', '#5a4a8a', '#241c38'], light: '170,90,255',
  },
];

/** Zonas de la partida normal (sin el Abismo). */
export const BASE_ZONES = 3;
