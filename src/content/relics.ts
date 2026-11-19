// Reliquias de grupo: tras vencer a un jefe, el grupo vota una mejora para el resto de la partida.
import type { Stats } from '../core/items/items';
import { boon, type EventDef } from './zona1/events';

export const RELIC_EVENTS: EventDef[] = [
  {
    id: 'reliquia_0', title: 'El relicario del Prior',
    text: 'Entre los huesos del Coloso quedan tres reliquias intactas. Solo podéis cargar con una: decidid entre todos.',
    options: [
      { label: 'Cáliz de médula', hint: 'Todos: +18 de vida máxima.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 18); h.hp += 18; } return 'Bebéis del cáliz: la médula os endurece.'; } },
      { label: 'Colmillo del osario', hint: 'Todos: +1 de daño.', apply: (run) => { for (const h of run.heroes) boon(h, 'power', 1); return 'El colmillo vibra con hambre vieja.'; } },
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

RELIC_EVENTS.push({
  id: 'reliquia_2', title: 'Lo que dejó el Rey',
  text: 'Entre las brasas quedan tres objetos que no arden. Bajo ellos, una grieta lleva al Abismo. Llevad uno.',
  options: [
    { label: 'Brasa eterna', hint: 'Todos: +2 de daño y +15% de resistencia al fuego.', apply: (run) => { for (const h of run.heroes) { boon(h, 'power', 2); boon(h, 'resFire', 15); } return 'La brasa os calienta desde dentro.'; } },
    { label: 'Velo de humo', hint: 'Todos: +25% de resistencia a la sombra y +6 de iniciativa.', apply: (run) => { for (const h of run.heroes) { boon(h, 'resShadow', 25); boon(h, 'initiative', 6); } return 'El humo os envuelve: en el Abismo os costará más veros.'; } },
    { label: 'Corona fundida', hint: 'Todos: +25 de vida máxima.', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 25); h.hp += 25; } return 'El oro fundido os endurece la sangre.'; } },
  ],
});

// ---------- reliquias personales ----------

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  rare?: boolean;
  stats?: Stats;
  /** rasgo de combate (ver Unit.traits) */
  trait?: string;
}

export const RELICS: Record<string, RelicDef> = Object.fromEntries(
  ([
    { id: 'colmillo', name: 'Colmillo de lobo', icon: '🦷', text: '+1 de daño.', stats: { power: 1 } },
    { id: 'corazon', name: 'Corazón de piedra', icon: '🫀', text: '+20 de vida máxima.', stats: { hp: 20 } },
    { id: 'caparazon', name: 'Caparazón', icon: '🐢', text: '+2 de armadura.', stats: { armor: 2 } },
    { id: 'pluma', name: 'Pluma de grifo', icon: '🪶', text: '+1 PM.', stats: { mp: 1 } },
    { id: 'reloj', name: 'Reloj sin agujas', icon: '⏳', text: '+1 PA.', stats: { ap: 1 }, rare: true },
    { id: 'trebol', name: 'Trébol de cuatro hojas', icon: '🍀', text: '+10% de crítico.', stats: { crit: 10 } },
    { id: 'cristal', name: 'Cristal de estasis', icon: '🔮', text: '+1 turno a tus estados.', stats: { status: 1 } },
    { id: 'viento', name: 'Botas de viento', icon: '🌬️', text: '+8 de iniciativa.', stats: { initiative: 8 } },
    { id: 'fe', name: 'Medalla de fe', icon: '✝️', text: '+20% de resistencia a fuego, hielo, veneno y sombra.', stats: { resFire: 20, resIce: 20, resPoison: 20, resShadow: 20 } },
    { id: 'dragon', name: 'Sangre de dragón', icon: '🐉', text: '+1 de daño y +12 de vida.', stats: { power: 1, hp: 12 }, rare: true },
    { id: 'tuerto', name: 'Ojo del tuerto', icon: '👁️', text: '+18% de crítico, pero -10 de vida.', stats: { crit: 18, hp: -10 } },
    { id: 'ascua', name: 'Ascua inextinguible', icon: '🔥', text: 'Todo tu daño quema 2 turnos.', trait: 'ignite', rare: true },
    { id: 'vibora', name: 'Glándula de víbora', icon: '🐍', text: 'Tus venenos aplican 1 carga más.', trait: 'venom' },
    { id: 'hacha', name: 'Filo del verdugo', icon: '🪓', text: 'Tus críticos hacen el doble de daño.', trait: 'execute', rare: true },
    { id: 'caliz', name: 'Cáliz de luz', icon: '🏺', text: 'Tus curaciones y escudos son un 30% mayores.', trait: 'mender' },
    { id: 'erizo', name: 'Piel de erizo', icon: '🦔', text: 'Devuelves el 30% del daño cuerpo a cuerpo.', trait: 'thorns' },
    { id: 'raiz', name: 'Raíz viva', icon: '🌱', text: 'Recuperas el 8% de tu vida en cada turno.', trait: 'regen', rare: true },
    { id: 'muralla', name: 'Piedra de muralla', icon: '🧱', text: 'Empiezas cada turno con un escudo del 15% de tu vida.', trait: 'guard', rare: true },
    { id: 'furia', name: 'Máscara de furia', icon: '👹', text: '+4 de daño por debajo de la mitad de vida.', trait: 'enrage' },
    { id: 'bolsa', name: 'Bolsa sin fondo', icon: '💰', text: '+15 de oro tras cada combate.' },
    { id: 'lupa', name: 'Lupa del tasador', icon: '🔎', text: '+1 opción en cada botín.' },
    { id: 'dado', name: 'Dado trucado', icon: '🎲', text: '+1 re-tirada de botín en cada zona.' },
  ] as RelicDef[]).map((r) => [r.id, r]),
);
