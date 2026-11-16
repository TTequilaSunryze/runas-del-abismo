// Zona 2: El Bosque Corrompido. Equipo y eventos de grupo.
import type { ItemTheme } from '../../core/items/items';
import { boon, healPct, losePct, type EventDef } from '../zona1/events';

export const ZONA2_ITEMS: ItemTheme = {
  names: {
    casco: ['Corona de Zarzas', 'Yelmo de Corteza'], capa: ['Manto de Musgo', 'Capa de Telaraña'],
    arma: ['Hoz de Espino', 'Bastón de Raíz Negra', 'Colmillo de Alfa'], peto: ['Coraza de Corteza', 'Jubón de Hiedra'],
    anillo: ['Anillo de Savia', 'Aro de Espina'], amuleto: ['Semilla Palpitante', 'Colgante de Ámbar'],
    botas: ['Botas de Rastreador', 'Pezuñas de Ciervo'], guantes: ['Garras de Zarza', 'Guantes de Micelio'],
  },
  suffixes: ['del Bosque Corrompido', 'de la Espesura', 'de Savia Negra', 'del Claro Marchito', 'de la Madre Raíz'],
  legendaries: [
    { slot: 'arma', name: 'Espina de la Madre Raíz', rarity: 3, stats: { power: 30, crit: 12, status: 1 }, lore: 'Sigue creciendo en la mano que la empuña.' },
    { slot: 'capa', name: 'Velo de Mil Esporas', rarity: 3, stats: { hp: 28, resPoison: 30, initiative: 10 }, lore: 'Respira cuando tú no lo haces.' },
    { slot: 'guantes', name: 'Zarpas del Alfa', rarity: 3, stats: { crit: 16, power: 18, ap: 1 }, lore: 'La manada aún las reconoce.' },
    { slot: 'peto', name: 'Corazón de Roble Viejo', rarity: 3, stats: { hp: 44, armor: 4, resFire: 15 }, lore: 'Mil inviernos, ni una grieta.' },
  ],
};

export const ZONA2_EVENTS: EventDef[] = [
  {
    id: 'claro', title: 'El Claro de las Luciérnagas',
    text: 'Un claro intacto en mitad de la podredumbre. Las luces os invitan a quedaros... demasiado.',
    options: [
      { label: 'Descansar entre las luces', hint: 'Todos recuperan el 50% de la vida, pero pierden 5 de iniciativa (somnolencia).', apply: (run) => { for (const h of run.heroes) { healPct(h, 0.5); boon(h, 'initiative', -5); } return 'Dormís más de la cuenta. Despertáis descansados y lentos.'; } },
      { label: 'Atrapar luciérnagas', hint: 'Todos ganan +8% de crítico.', apply: (run) => { for (const h of run.heroes) boon(h, 'crit', 8); return 'Su luz os afina la vista.'; } },
    ],
  },
  {
    id: 'savia', title: 'La Fuente de Savia Negra',
    text: 'Del tronco de un árbol colosal mana una savia oscura y tibia. Huele a fuerza y a enfermedad.',
    options: [
      { label: 'Beber todos', hint: 'Todos: +18 de vida máxima y +10% de daño, pero pierden el 30% de la vida actual.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 18); boon(h, 'power', 10); losePct(h, 0.3); } return 'Arde por dentro. Después, os sentís enormes.'; } },
      { label: 'Llenar los odres', hint: 'Cada uno gana 30 de oro vendiéndola más tarde.', apply: (run) => { for (const h of run.heroes) h.gold += 30; return 'Alguien pagará bien por esto.'; } },
    ],
  },
];
