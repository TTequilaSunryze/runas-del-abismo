// Zona 2: El Bosque Corrompido. Equipo y eventos de grupo.
import type { ItemTheme } from '../../core/items/items';
import { boon, healPct, losePct, type EventDef } from '../zona1/events';
import { addAlly, giveItem, giveRelic } from '../../game/run';

export const ZONA2_ITEMS: ItemTheme = {
  names: {
    casco: ['Corona de Zarzas', 'Yelmo de Corteza'], capa: ['Manto de Musgo', 'Capa de Telaraña'],
    arma: ['Hoz de Espino', 'Bastón de Raíz Negra', 'Colmillo de Alfa'], peto: ['Coraza de Corteza', 'Jubón de Hiedra'],
    anillo: ['Anillo de Savia', 'Aro de Espina'], amuleto: ['Semilla Palpitante', 'Colgante de Ámbar'],
    botas: ['Botas de Rastreador', 'Pezuñas de Ciervo'], guantes: ['Garras de Zarza', 'Guantes de Micelio'],
  },
  suffixes: ['del Bosque Corrompido', 'de la Espesura', 'de Savia Negra', 'del Claro Marchito', 'de la Madre Raíz'],
  legendaries: [
    { slot: 'arma', name: 'Espina de la Madre Raíz', rarity: 3, stats: { power: 30, crit: 12, status: 1 }, lore: 'Sigue creciendo en la mano que la empuña.', passive: { trait: 'espina', text: 'Tus golpes envenenan al objetivo (1 carga, 2 turnos).' } },
    { slot: 'capa', name: 'Velo de Mil Esporas', rarity: 3, stats: { hp: 28, resPoison: 30, initiative: 10 }, lore: 'Respira cuando tú no lo haces.', passive: { trait: 'esporas', text: 'Quien te golpea cuerpo a cuerpo queda Ralentizado (−1 PM).' } },
    { slot: 'guantes', name: 'Zarpas del Alfa', rarity: 3, stats: { crit: 16, power: 18, ap: 1 }, lore: 'La manada aún las reconoce.', passive: { trait: 'alfa', text: 'Cada golpe crítico te cura 4 de vida.' } },
    { slot: 'peto', name: 'Corazón de Roble Viejo', rarity: 3, stats: { hp: 44, armor: 4, resFire: 15 }, lore: 'Mil inviernos, ni una grieta.', passive: { trait: 'thorns', text: 'Devuelves el 30% del daño cuerpo a cuerpo que recibes.' } },
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
      { label: 'Beber todos', hint: 'Todos: +18 de vida máxima y +10% de daño (físico y mágico), pero pierden el 30% de la vida actual.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 18); boon(h, 'power', 10); losePct(h, 0.3); } return 'Arde por dentro. Después, os sentís enormes.'; } },
      { label: 'Llenar los odres', hint: 'Cada uno gana 30 de oro vendiéndola más tarde.', apply: (run) => { for (const h of run.heroes) h.gold += 30; return 'Alguien pagará bien por esto.'; } },
    ],
  },
  {
    id: 'ermitano', title: 'La Cabaña del Ermitaño',
    text: 'Un anciano cubierto de musgo cocina algo que huele a gloria. Tiene sitio para uno más en la mesa… o en su ejército.',
    options: [
      { label: 'Pedirle ayuda', hint: 'Una sacerdotisa del bosque os acompaña hasta el final de la zona (cura y dispara).', apply: (run) => { addAlly(run, 'sacerdotisa'); return 'Su nieta coge el arco y la bolsa de hierbas.'; } },
      { label: 'Comer con él', hint: 'Todos se curan un 40% y ganan +10 de vida máxima.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 10); healPct(h, 0.4); } return 'Mejor guiso que habéis probado nunca. No preguntéis de qué era.'; } },
    ],
  },
  {
    id: 'nido', title: 'El Nido de las Arañas',
    text: 'Un nido enorme cuelga entre dos árboles. Dentro brilla el ajuar de alguien que no tuvo suerte.',
    options: [
      { label: 'Saquearlo', hint: 'Cada uno gana una reliquia común; el próximo combate tiene presagio de Ciénaga.', apply: (run) => { for (const h of run.heroes) giveRelic(run, h, false); run.nextOmen = 'pantano'; return 'Salís pegajosos y con los bolsillos llenos.'; } },
      { label: 'Quemarlo', hint: 'Todos: +15% de resistencia al veneno y +5% de daño (físico y mágico).', apply: (run) => { for (const h of run.heroes) { boon(h, 'resPoison', 15); boon(h, 'power', 5); } return 'Arde rápido. Las arañas, también.'; } },
    ],
  },
  {
    id: 'espiritu', title: 'El Espíritu del Ciervo',
    text: 'Un ciervo blanco os observa desde la niebla. Promete volver cuando más lo necesitéis.',
    options: [
      { label: 'Seguirlo', hint: 'En el combate contra el jefe de esta zona, el espíritu lucha a vuestro lado.', apply: (run) => { run.flags.push(`espiritu_${run.zone}`); return 'El ciervo inclina la cabeza y desaparece entre los árboles.'; } },
      { label: 'Cazarlo', hint: 'Cada uno gana 50 de oro, pero todos pierden 5% de crítico (mala suerte).', apply: (run) => { for (const h of run.heroes) { h.gold += 50; boon(h, 'crit', -5); } return 'Nadie dice nada mientras volvéis. Nadie.'; } },
    ],
  },
  {
    id: 'semillas', title: 'Las Semillas Susurrantes',
    text: 'Tres semillas negras laten en un tocón. Cada una promete algo distinto.',
    options: [
      { label: 'La semilla del fuego', hint: 'Todos ganan un objeto Uncommon o mejor.', apply: (run) => { for (const h of run.heroes) giveItem(run, h, 'combat', 1); return 'La semilla arde y deja algo en cada mano.'; } },
      { label: 'La semilla del veneno', hint: 'Todos ganan un objeto.', apply: (run) => { for (const h of run.heroes) giveItem(run, h); return 'La semilla se pudre y deja algo en cada mano.'; } },
      { label: 'La semilla del eco', hint: 'Todos ganan un objeto Rare o mejor, pero pierden el 20% de la vida actual.', apply: (run) => { for (const h of run.heroes) { losePct(h, 0.2); giveItem(run, h, 'combat', 2); } return 'La semilla grita. Os zumban los oídos un buen rato.'; } },
    ],
  },
  {
    id: 'lobo_herido', title: 'El Lobo Herido',
    text: 'Un lobo enorme, con una flecha en el costado, os gruñe sin fuerzas.',
    options: [
      { label: 'Curarlo', hint: 'El lobo os acompaña hasta el final de la zona.', apply: (run) => { addAlly(run, 'lobo_aliado'); return 'El lobo os lame la mano y se pone a vuestro lado.'; } },
      { label: 'Dejarlo en paz', hint: 'Todos recuperan un 15% de vida (paráis a descansar).', apply: (run) => { for (const h of run.heroes) healPct(h, 0.15); return 'Os alejáis despacio.'; } },
    ],
  },
];
