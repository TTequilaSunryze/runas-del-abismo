// Zona 4: El Abismo. Equipo y eventos de grupo.
import type { ItemTheme } from '../../core/items/items';
import { addAlly, giveItem, giveRelic } from '../../game/run';
import { boon, healPct, losePct, type EventDef } from '../zona1/events';

export const ZONA4_ITEMS: ItemTheme = {
  names: {
    casco: ['Corona del Vacío', 'Yelmo sin Rostro'], capa: ['Manto de Estrellas Muertas', 'Capa de Sombra Líquida'],
    arma: ['Hoja Rúnica', 'Cetro del Abismo', 'Guadaña de Eco'], peto: ['Coraza de Obsidiana Viva', 'Vestimenta del Heraldo'],
    anillo: ['Anillo de Runa Rota', 'Sello del Abismo'], amuleto: ['Fragmento de Runa', 'Ojo Cerrado'],
    botas: ['Pasos del Errante', 'Grebas del Vacío'], guantes: ['Garras del Devorador', 'Guantes de Eco'],
  },
  suffixes: ['del Abismo', 'del Vacío', 'de las Runas Primeras', 'del Último Eco', 'sin Fondo'],
  legendaries: [
    { slot: 'arma', name: 'Primera Runa', rarity: 3, stats: { power: 45, crit: 15, status: 1, ap: 1 }, lore: 'De ella nacieron todas las demás.' },
    { slot: 'peto', name: 'Piel del Devorador', rarity: 3, stats: { hp: 65, armor: 5, resShadow: 35 }, lore: 'Aún tiene hambre.' },
    { slot: 'amuleto', name: 'Lágrima del Eco', rarity: 3, stats: { hp: 30, power: 25, ap: 1, resShadow: 20 }, lore: 'Lloran por ti los que cayeron antes.' },
    { slot: 'botas', name: 'Pasos entre Mundos', rarity: 3, stats: { mp: 1, initiative: 18, crit: 10 }, lore: 'Nunca pisan el mismo suelo dos veces.' },
  ],
};

export const ZONA4_EVENTS: EventDef[] = [
  {
    id: 'fuente_runas', title: 'La Fuente de las Runas',
    text: 'Un manantial de luz donde flotan tesoros sin dueño. Tocarlo duele; no tocarlo, también.',
    options: [
      { label: 'Sumergir las manos', hint: 'Cada uno: un objeto Rare o mejor, pero pierde el 30% de la vida actual.', apply: (run) => { for (const h of run.heroes) { losePct(h, 0.3); giveItem(run, h, 'elite', 2); } return 'Los tesoros se os pegan a la piel como brasas frías.'; } },
      { label: 'Beber de la fuente', hint: 'Todos se curan por completo.', apply: (run) => { for (const h of run.heroes) healPct(h, 1); return 'La luz os llena y se apaga despacio.'; } },
    ],
  },
  {
    id: 'espejo', title: 'El Espejo Oscuro',
    text: 'Un espejo que no refleja lo que sois, sino lo que podríais ser. Vuestro reflejo os tiende la mano.',
    options: [
      { label: 'Aceptar el trato', hint: 'Cada uno: una reliquia rara. El próximo combate tiene un presagio de Luna de sangre.', apply: (run) => { for (const h of run.heroes) giveRelic(run, h, true); run.nextOmen = 'sangre'; return 'Vuestro reflejo sonríe. Algo rojo se asoma en el cielo.'; } },
      { label: 'Romper el espejo', hint: 'Todos: +10% de crítico.', apply: (run) => { for (const h of run.heroes) boon(h, 'crit', 10); return 'Los pedazos os enseñan dónde golpear.'; } },
    ],
  },
  {
    id: 'caidos', title: 'Los Caídos',
    text: 'Aventureros de otras partidas, atrapados en el Abismo. Uno de ellos aún puede luchar.',
    options: [
      { label: 'Liberarlo', hint: 'Un aliado lucha con vosotros hasta el final de la zona.', apply: (run) => { addAlly(run, 'caido'); return 'Un paladín sin nombre se pone en pie y desenvaina.'; } },
      { label: 'Tomar sus pertenencias', hint: 'Cada uno gana 70 de oro.', apply: (run) => { for (const h of run.heroes) h.gold += 70; return 'Él ya no las va a necesitar. Eso os decís.'; } },
    ],
  },
  {
    id: 'hambre', title: 'El Hambre',
    text: 'Una boca sin cuerpo pide comida. Acepta ofrendas.',
    options: [
      { label: 'Alimentarla', hint: 'Cada uno pierde 30 de oro (si tiene) y gana +20 de vida máxima.', apply: (run) => { for (const h of run.heroes) { h.gold = Math.max(0, h.gold - 30); boon(h, 'hp', 20); h.hp += 20; } return 'La boca mastica y escupe algo parecido a la gratitud.'; } },
      { label: 'Huir', hint: 'El próximo combate es una emboscada (más enemigos, mejor botín).', apply: (run) => { run.ambush = true; return 'La boca os sigue. Y trae compañía.'; } },
    ],
  },
  {
    id: 'cartografo', title: 'El Cartógrafo Ciego',
    text: 'Dibuja mapas del Abismo de memoria. Por un precio, os enseña un atajo.',
    options: [
      { label: 'Pagar 60 de oro cada uno', hint: 'Todos +1 PM y +6 de iniciativa (si alguno no puede pagar, no hay trato).', apply: (run) => { if (run.heroes.some((h) => h.gold < 60)) return 'No os llega a todos. El cartógrafo se encoge de hombros.'; for (const h of run.heroes) { h.gold -= 60; boon(h, 'mp', 1); boon(h, 'initiative', 6); } return 'Sus mapas son exactos. Inquietantemente exactos.'; } },
      { label: 'Escuchar sus historias', hint: 'Todos recuperan un 25% de vida.', apply: (run) => { for (const h of run.heroes) healPct(h, 0.25); return 'Os quedáis dormidos oyendo hablar de otros que bajaron antes.'; } },
    ],
  },
  {
    id: 'trono', title: 'El Trono Vacío',
    text: 'Un trono hecho de runas apagadas. Quien se siente en él verá el final del camino.',
    options: [
      { label: 'Sentarse por turnos', hint: 'Todos: +15% de daño (físico y mágico) y -15 de vida máxima.', apply: (run) => { for (const h of run.heroes) { boon(h, 'power', 15); boon(h, 'hp', -15); } return 'Habéis visto el final. No os gusta, pero sabéis cómo llegar.'; } },
      { label: 'Destruirlo', hint: 'Cada uno gana una reliquia común.', apply: (run) => { for (const h of run.heroes) giveRelic(run, h, false); return 'Entre los restos brillan objetos olvidados.'; } },
    ],
  },
];
