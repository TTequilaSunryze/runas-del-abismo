// Zona 3: Las Ruinas de Ceniza. Equipo y eventos de grupo.
import type { ItemTheme } from '../../core/items/items';
import { boon, healPct, losePct, type EventDef } from '../zona1/events';

export const ZONA3_ITEMS: ItemTheme = {
  names: {
    casco: ['Yelmo Calcinado', 'Máscara de Hollín'], capa: ['Capa de Humo', 'Manto de Brasas'],
    arma: ['Espada de Escoria', 'Cetro de Pavesas', 'Hacha del Verdugo'], peto: ['Coraza Fundida', 'Cota de Ceniza'],
    anillo: ['Anillo de Ascua', 'Sello Ennegrecido'], amuleto: ['Carbón que No se Apaga', 'Lágrima de Vidrio'],
    botas: ['Grebas de Obsidiana', 'Botas de Caminante de Brasas'], guantes: ['Guanteletes de Forja', 'Manoplas de Hollín'],
  },
  suffixes: ['de las Ruinas', 'de la Pira', 'del Rey Calcinado', 'de Ceniza Viva', 'del Último Incendio'],
  legendaries: [
    { slot: 'arma', name: 'Corona Rota del Rey Calcinado', rarity: 3, stats: { power: 40, crit: 14, ap: 1 }, lore: 'Dejó de ser corona el día que ardió el reino.' },
    { slot: 'peto', name: 'Égida de Obsidiana', rarity: 3, stats: { hp: 55, armor: 5, resFire: 35 }, lore: 'Nació de un incendio y no teme a otro.' },
    { slot: 'botas', name: 'Huellas de Pavesa', rarity: 3, stats: { mp: 1, initiative: 14, resFire: 25 }, lore: 'Quien las calza no deja de moverse.' },
    { slot: 'amuleto', name: 'Ojo del Volcán', rarity: 3, stats: { power: 26, hp: 26, status: 1, ap: 1 }, lore: 'Mira hacia dentro.' },
  ],
};

export const ZONA3_EVENTS: EventDef[] = [
  {
    id: 'forja', title: 'La Forja que Aún Arde',
    text: 'Entre los escombros, una fragua sigue encendida sin nadie que la alimente. El yunque espera.',
    options: [
      { label: 'Templar las armas', hint: 'Todos: +15% de daño. El calor cuesta el 20% de la vida actual.', apply: (run) => { for (const h of run.heroes) { boon(h, 'power', 15); losePct(h, 0.2); } return 'El acero canta. Vuestra piel, también.'; } },
      { label: 'Reforzar las armaduras', hint: 'Todos: +2 de armadura y +15% de resistencia al fuego.', apply: (run) => { for (const h of run.heroes) { boon(h, 'armor', 2); boon(h, 'resFire', 15); } return 'Salís de la forja más pesados y más seguros.'; } },
    ],
  },
  {
    id: 'superviviente', title: 'El Último Superviviente',
    text: 'Un anciano cubierto de ceniza custodia un cofre. «Lleváoslo todo», dice, «o dejadme algo para comer».',
    options: [
      { label: 'Darle provisiones', hint: 'Cada uno paga 20 de oro (si lo tiene). Todos se curan por completo con su ungüento.', apply: (run) => { for (const h of run.heroes) { h.gold = Math.max(0, h.gold - 20); healPct(h, 1); } return 'Os unta las quemaduras con manos expertas.'; } },
      { label: 'Aceptar el cofre', hint: 'Cada uno gana 50 de oro.', apply: (run) => { for (const h of run.heroes) h.gold += 50; return 'El anciano os ve marchar sin decir nada.'; } },
    ],
  },
];
