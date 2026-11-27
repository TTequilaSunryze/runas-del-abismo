// Eventos comunes del «?»: pueden salir en cualquier zona (además de los propios de cada zona), para que las casillas
// Desconocido tengan variedad suficiente. Se vota y el resultado afecta a todos por igual, como el resto de eventos.
import { MAX_CONSUMABLE } from './boons';
import { OMENS } from './modes';
import { giveItem, giveRuneOffer, type HeroSave, type RuneOffer, type RunState } from '../game/run';
import { rand, pick } from '../core/rng';
import { boon, healPct, losePct, type EventDef } from './zona1/events';

const addConsumable = (h: HeroSave, id: string): boolean => {
  const n = h.bag2[id] ?? 0;
  if (n >= MAX_CONSUMABLE) return false;
  h.bag2[id] = n + 1;
  return true;
};
const relicNames = (run: RunState, ids: Array<RuneOffer | null>): string => ids.some(Boolean) ? `Cada uno elegirá una runa: ${ids.map((o, i) => (o ? `${run.heroes[i]!.name} (${o.runes.length} opciones)` : '')).filter(Boolean).join(' · ')}.` : '';
const itemNames = (run: RunState, f: (h: HeroSave) => { name: string }): string => run.heroes.map((h) => `${h.name}: ${f(h).name}`).join(' · ');

export const COMMON_EVENTS: EventDef[] = [
  {
    id: 'c_despojos', title: 'El Montón de Despojos',
    text: 'Una montaña de armas rotas, abalorios y huesos que otros dejaron atrás. La pila se mueve y emite un ruido sordo, como si algo creciera dentro. Si rebuscas en la superficie, puede que encuentres algo decente. Si te zambulles, quizá algo antiguo.',
    options: [
      { label: 'Zambullirse', hint: 'Cada uno: pierde el 15% de su vida actual. Gana una runa a elegir', apply: (run) => { const got = run.heroes.map((h) => { losePct(h, 0.15); return giveRuneOffer(run, h, 'event'); }); return `Salís arañados, con algo olvidado entre las manos. ${relicNames(run, got)}`; } },
      { label: 'Rebuscar en la superficie', hint: 'Cada uno: gana 60 de oro y un objeto aleatorio', apply: (run) => { const t = itemNames(run, (h) => { h.gold += 60; return giveItem(run, h, 'combat'); }); return `Entre la chatarra aparece algo útil. ${t}`; } },
    ],
  },
  {
    id: 'c_fuente', title: 'La Fuente de Runas Apagadas',
    text: 'Un pilón de piedra rúnica gotea un agua que brilla apenas. Las runas del borde parpadean como si quisieran despertar.',
    options: [
      { label: 'Beber', hint: 'Todos recuperan un 35% de vida', apply: (run) => { for (const h of run.heroes) healPct(h, 0.35); return 'El agua sabe a hierro y a algo más viejo. Las heridas se cierran.'; } },
      { label: 'Llenar los frascos', hint: 'Cada uno gana una Poción de curación para el combate', apply: (run) => { for (const h of run.heroes) addConsumable(h, 'c_vida'); return 'Guardáis el agua para cuando más falte.'; } },
    ],
  },
  {
    id: 'c_mercader_ciego', title: 'El Mercader Ciego',
    text: 'Un viejo con los ojos vendados vende «cosas que aún no han caído» sobre una manta. Sabe cuántos sois sin mirar.',
    options: [
      { label: 'Pagarle 50 de oro', hint: 'Cada uno que pueda: paga 50 de oro y gana un objeto Rare o mejor', apply: (run) => { const t = run.heroes.map((h) => { if (h.gold < 50) return `${h.name}: sin oro`; h.gold -= 50; return `${h.name}: ${giveItem(run, h, 'elite', 2).name}`; }).join(' · '); return `El viejo sonríe y os da exactamente lo que buscabais. ${t}`; } },
      { label: 'Robarle', hint: 'Cada uno: +90 de oro, pero el próximo combate es una emboscada', apply: (run) => { for (const h of run.heroes) h.gold += 90; run.ambush = true; return 'El viejo no grita. Silba. Algo le contesta desde la oscuridad.'; } },
    ],
  },
  {
    id: 'c_eco_caido', title: 'El Eco de un Héroe Caído',
    text: 'Una silueta de luz repite una y otra vez el último golpe que dio antes de morir. Su arma sigue clavada en la roca.',
    options: [
      { label: 'Escuchar al eco', hint: 'Cada uno gana 2 Escofinas de Eco', apply: (run) => { for (const h of run.heroes) h.escofinas = (h.escofinas ?? 0) + 2; return 'El eco os enseña su golpe antes de apagarse. Guardáis el recuerdo como un filo.'; } },
      { label: 'Arrancar su arma', hint: 'Cada uno: pierde el 10% de su vida actual. Gana un objeto Uncommon o mejor', apply: (run) => { const t = itemNames(run, (h) => { losePct(h, 0.1); return giveItem(run, h, 'combat', 1); }); return `La roca suelta el metal a regañadientes. ${t}`; } },
    ],
  },
  {
    id: 'c_ojos_gema', title: 'La Estatua de Ojos de Gema',
    text: 'Una estatua sin nombre mira al pasillo con dos gemas rojas por ojos. A sus pies, ofrendas de gente que nunca volvió.',
    options: [
      { label: 'Arrancar las gemas', hint: 'Cada uno: +120 de oro, pero el próximo combate llega con un presagio', apply: (run) => { for (const h of run.heroes) h.gold += 120; run.nextOmen = pick(run, OMENS).id; return 'Las cuencas vacías siguen mirándoos. Algo, más adelante, ya lo sabe.'; } },
      { label: 'Dejar una ofrenda', hint: 'Todos: +8 de vida máxima y recuperan un 10% de vida', apply: (run) => { for (const h of run.heroes) { boon(h, 'hp', 8); h.hp += 8; healPct(h, 0.1); } return 'La piedra parece entibiarse bajo vuestras manos.'; } },
    ],
  },
  {
    id: 'c_explorador', title: 'El Explorador Perdido',
    text: 'Un cuerpo apoyado contra la pared, con el mapa aún en la mano. En el margen, una nota: «No bajéis por la grieta del este».',
    options: [
      { label: 'Registrar su mochila', hint: 'Cada uno: +40 de oro y una Bomba de humo para el combate', apply: (run) => { for (const h of run.heroes) { h.gold += 40; addConsumable(h, 'c_humo'); } return 'Llevaba lo justo para huir. No le bastó.'; } },
      { label: 'Darle sepultura', hint: 'Todos recuperan un 15% de vida y ganan +2 de iniciativa', apply: (run) => { for (const h of run.heroes) { healPct(h, 0.15); boon(h, 'initiative', 2); } return 'Le cerráis los ojos. Seguís con el paso más ligero.'; } },
    ],
  },
  {
    id: 'c_hongos', title: 'Los Hongos de Luz',
    text: 'Un tapiz de hongos azules ilumina la caverna. Huelen a pan recién hecho… y a algo podrido debajo.',
    options: [
      { label: 'Comérselos', hint: 'Todos: a la suerte. Puede curar un 40% de vida o costar un 15%', apply: (run) => { const ok = rand(run) < 0.6; for (const h of run.heroes) (ok ? healPct(h, 0.4) : losePct(h, 0.15)); return ok ? 'Una calidez os recorre de pies a cabeza.' : 'El estómago se revuelve. Vomitáis luz azul durante un rato.'; } },
      { label: 'Recoger esporas', hint: 'Cada uno gana una Bomba de fuego para el combate', apply: (run) => { for (const h of run.heroes) addConsumable(h, 'c_fuego'); return 'Las esporas secas arden con solo mirarlas. Útiles.'; } },
    ],
  },
  {
    id: 'c_cofre_cadenas', title: 'El Cofre Encadenado',
    text: 'Un cofre envuelto en cadenas que alguien quiso que nadie abriera. Las cadenas están calientes al tacto.',
    options: [
      { label: 'Romper las cadenas', hint: 'Cada uno: pierde el 20% de su vida actual. Gana un objeto Rare o mejor', apply: (run) => { const t = itemNames(run, (h) => { losePct(h, 0.2); return giveItem(run, h, 'elite', 2); }); return `Las cadenas os muerden al caer, pero el cofre cede. ${t}`; } },
      { label: 'Forzar la cerradura', hint: 'Cada uno gana un objeto aleatorio', apply: (run) => { const t = itemNames(run, (h) => giveItem(run, h, 'combat')); return `Un clic discreto. Dentro, lo justo. ${t}`; } },
    ],
  },
  {
    id: 'c_grieta', title: 'La Grieta que Susurra',
    text: 'Una fisura en el suelo exhala un aire tibio. Si acercáis el oído, oís vuestros nombres pronunciados al revés.',
    options: [
      { label: 'Asomarse', hint: 'Todos: +5% de crítico, pero pierden el 10% de su vida actual', apply: (run) => { for (const h of run.heroes) { boon(h, 'crit', 5); losePct(h, 0.1); } return 'Por un instante veis lo que hay abajo. Ya no lo olvidaréis.'; } },
      { label: 'Sellarla con piedras', hint: 'Todos: +1 de armadura', apply: (run) => { for (const h of run.heroes) boon(h, 'armor', 1); return 'Los susurros se apagan. Os sentís un poco más firmes.'; } },
    ],
  },
  {
    id: 'c_campamento', title: 'El Campamento Abandonado',
    text: 'Brasas aún tibias, petates revueltos y una olla a medio hacer. Quien estaba aquí se fue con prisa. O no se fue.',
    options: [
      { label: 'Descansar un rato', hint: 'Todos recuperan un 25% de vida', apply: (run) => { for (const h of run.heroes) healPct(h, 0.25); return 'Nadie vuelve a por sus cosas. Dormís a turnos.'; } },
      { label: 'Saquear el campamento', hint: 'Cada uno: +70 de oro', apply: (run) => { for (const h of run.heroes) h.gold += 70; return 'Bolsas de monedas escondidas bajo los petates. Quien fuera, ya no las necesita.'; } },
    ],
  },
];
