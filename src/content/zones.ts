// Las tres zonas de la partida: enemigos, jefe, equipo, eventos y aspecto.
import type { ItemTheme } from '../core/items/items';
import { ZONA1_EVENTS, type EventDef } from './zona1/events';
import { ZONA1_ITEMS } from './zona1/items';
import { ZONA2_EVENTS, ZONA2_ITEMS } from './zona2/content';
import { ZONA3_EVENTS, ZONA3_ITEMS } from './zona3/content';

export interface ZoneDef {
  name: string;
  intro: string;
  /** enemigos normales según lo avanzado de la zona: primeras salas, mitad, final */
  pools: [string[], string[], string[]];
  /** un tirador que siempre aparece en grupo */
  shooter: string;
  elite: string;
  boss: string;
  /** compañía inicial del jefe y lo que invoca */
  bossGuard: string[];
  bossMinion: string;
  bossPhase2: string;
  bossWin: string;
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
    pools: [['limo', 'murcielago', 'esqueleto'], ['limo', 'murcielago', 'esqueleto', 'arquero'], ['murcielago', 'esqueleto', 'arquero', 'necrofago', 'acolito']],
    shooter: 'arquero', elite: 'caballero', boss: 'prior', bossGuard: ['esqueleto', 'arquero'], bossMinion: 'esqueleto', bossPhase2: 'Coloso del Osario',
    bossWin: 'El Coloso del Osario se desmorona. Una escalera de raíces sube hacia la superficie.',
    items: ZONA1_ITEMS, events: ZONA1_EVENTS, floor: ['#2b2339', '#251e33'], rock: ['#5a5473', '#7a7498', '#3e3a52'], light: '255,150,60',
  },
  {
    name: 'El Bosque Corrompido', intro: 'Salís a un bosque enfermo: la savia es negra y los árboles os miran.',
    pools: [['lobo', 'arana', 'tejedora'], ['lobo', 'arana', 'tejedora', 'chaman'], ['lobo', 'arana', 'chaman', 'ent', 'tejedora']],
    shooter: 'tejedora', elite: 'alfa', boss: 'madre', bossGuard: ['arana', 'chaman'], bossMinion: 'arana', bossPhase2: 'La Raíz Desatada',
    bossWin: 'La Madre Raíz se seca y se parte. Tras ella, el horizonte arde.',
    items: ZONA2_ITEMS, events: ZONA2_EVENTS, floor: ['#22321f', '#1c2a1b'], rock: ['#4a5a3a', '#66784e', '#313f28'], light: '120,220,120',
  },
  {
    name: 'Las Ruinas de Ceniza', intro: 'Un reino entero convertido en brasas. Algo sigue reinando sobre ellas.',
    pools: [['sabueso', 'ceniciento', 'piromante'], ['sabueso', 'ceniciento', 'piromante'], ['sabueso', 'ceniciento', 'piromante', 'escoria']],
    shooter: 'piromante', elite: 'verdugo', boss: 'rey', bossGuard: ['ceniciento', 'piromante'], bossMinion: 'sabueso', bossPhase2: 'Avatar de la Pira',
    bossWin: 'El Avatar de la Pira se apaga. Por primera vez en siglos, llueve sobre las ruinas.',
    items: ZONA3_ITEMS, events: ZONA3_EVENTS, floor: ['#3a2622', '#30201d'], rock: ['#6a5048', '#8a6a5c', '#473430'], light: '255,110,50',
  },
];
