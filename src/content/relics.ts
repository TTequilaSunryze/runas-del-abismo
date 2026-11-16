// Reliquias de grupo: tras vencer a un jefe, el grupo vota una mejora para el resto de la partida.
import { boon, type EventDef } from './zona1/events';

export const RELIC_EVENTS: EventDef[] = [
  {
    id: 'reliquia_0', title: 'El relicario del Prior',
    text: 'Entre los huesos del Coloso quedan tres reliquias intactas. Solo podéis cargar con una: decidid entre todos.',
    options: [
      { label: 'Cáliz de médula', hint: 'Todos: +18 de vida máxima.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 18); h.hp += 18; } return 'Bebéis del cáliz: la médula os endurece.'; } },
      { label: 'Colmillo del osario', hint: 'Todos: +12% de daño.', apply: (run) => { for (const h of run.heroes) boon(h, 'power', 12); return 'El colmillo vibra con hambre vieja.'; } },
      { label: 'Reloj de arena fúnebre', hint: 'Todos: +6 de iniciativa y +1 PM.', apply: (run) => { for (const h of run.heroes) { boon(h, 'initiative', 6); boon(h, 'mp', 1); } return 'El tiempo se os hace más ancho.'; } },
    ],
  },
  {
    id: 'reliquia_1', title: 'El corazón de la Madre Raíz',
    text: 'El tronco partido guarda tres semillas que laten. Solo una germinará con vosotros.',
    options: [
      { label: 'Semilla de corteza', hint: 'Todos: +2 de armadura.', apply: (run) => { for (const h of run.heroes) boon(h, 'armor', 2); return 'La piel se os vuelve corteza.'; } },
      { label: 'Semilla de espino', hint: 'Todos: +12% de crítico.', apply: (run) => { for (const h of run.heroes) boon(h, 'crit', 12); return 'Cada golpe encuentra ahora dónde duele.'; } },
      { label: 'Semilla de savia', hint: 'Todos: +1 PA.', apply: (run) => { for (const h of run.heroes) boon(h, 'ap', 1); return 'La savia os corre por las venas: nunca os cansáis.'; } },
    ],
  },
];
