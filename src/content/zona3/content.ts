// Zona 3: Las Ruinas de Ceniza. Equipo y eventos de grupo.
import type { ItemTheme } from '../../core/items/items';
import { boon, healPct, losePct, type EventDef } from '../zona1/events';
import { addAlly, giveItem, giveRelic } from '../../game/run';

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
  {
    id: 'cofre', title: 'El Cofre Maldito',
    text: 'Un cofre al rojo vivo. Dentro brilla algo legendario. Encima, una inscripción: «El próximo campeón te lo reclamará».',
    options: [
      { label: 'Abrirlo', hint: 'Cada uno gana una reliquia rara; el próximo élite tendrá 2 modificadores más.', apply: (run) => { for (const h of run.heroes) giveRelic(run, h, true); run.flags.push('cursed_elite'); return 'El cofre se abre con un chasquido. A lo lejos, algo despierta.'; } },
      { label: 'Dejarlo', hint: 'No ocurre nada.', apply: () => 'Algunas cosas es mejor que sigan ardiendo.' },
    ],
  },
  {
    id: 'herrero', title: 'El Último Herrero',
    text: 'Un enano de ceniza sigue trabajando aunque su reino ya no exista. Os ofrece afilar algo.',
    options: [
      { label: 'Afilar las armas', hint: 'Todos: +8% de daño y +6% de crítico.', apply: (run) => { for (const h of run.heroes) { boon(h, 'power', 8); boon(h, 'crit', 6); } return 'Os devuelve las armas sin mirarlas. Sabe lo que hace.'; } },
      { label: 'Contratarlo', hint: 'Un guardia de forja lucha con vosotros hasta el final de la zona.', apply: (run) => { addAlly(run, 'guardia_forja'); return 'Coge su martillo y os sigue sin decir palabra.'; } },
    ],
  },
  {
    id: 'oraculo', title: 'El Oráculo de Hollín',
    text: 'Una mujer con los ojos cosidos lee el humo. Por oro, os dice qué os espera.',
    options: [
      { label: 'Pagar 40 de oro cada uno', hint: 'Todos eligen una mejora de hechizo extra (si alguno no puede pagar, no hay trato).', apply: (run) => { if (run.heroes.some((h) => h.gold < 40)) return 'El oráculo no fía.'; for (const h of run.heroes) { h.gold -= 40; h.upPending++; } return 'El humo dibuja formas que solo vosotros entendéis.'; } },
      { label: 'Preguntar gratis', hint: 'El próximo combate tiene presagio de Bendición.', apply: (run) => { run.nextOmen = 'bendicion'; return '«Lo próximo será fácil», dice. Mentir no le cuesta nada.'; } },
    ],
  },
  {
    id: 'rio', title: 'El Río de Lava',
    text: 'Un puente de piedra cruza un río de lava. Está a medio derrumbar.',
    options: [
      { label: 'Cruzar corriendo', hint: 'Todos pierden el 20% de la vida actual, pero ganan +6 de iniciativa.', apply: (run) => { for (const h of run.heroes) { losePct(h, 0.2); boon(h, 'initiative', 6); } return 'Llegáis al otro lado chamuscados y con prisa.'; } },
      { label: 'Buscar otro camino', hint: 'El próximo combate es una emboscada (más enemigos, mejor botín).', apply: (run) => { run.ambush = true; return 'El otro camino estaba ocupado.'; } },
    ],
  },
  {
    id: 'trono_ceniza', title: 'El Trono de Ceniza',
    text: 'El trono del Rey, vacío. Quien se siente en él gana su favor… o su ira.',
    options: [
      { label: 'Sentarse', hint: 'Cada uno gana un objeto Rare o mejor, pero todos pierden -10 de vida máxima.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', -10); giveItem(run, h, 'combat', 2); } return 'Por un momento, el reino entero os pertenece.'; } },
      { label: 'Saquear sus joyas', hint: 'Cada uno gana 60 de oro.', apply: (run) => { for (const h of run.heroes) h.gold += 60; return 'Las joyas aún están calientes.'; } },
    ],
  },
];
