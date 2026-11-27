// Fase G2: eventos especiales y encuentros poco frecuentes. Usan el mismo sistema de eventos de grupo
// (votación, resolución por el anfitrión con el generador de la partida); solo cambian sus condiciones de aparición.
import { rand } from '../core/rng';
import type { RunState } from '../game/run';
import { giveItem, giveRuneOffer, heroMaxHp } from '../game/run';
import { boon, healPct, losePct, type EventDef } from './zona1/events';

export interface SpecialEventDef extends EventDef {
  /** especial: aparece con cierta frecuencia · raro: mucho menos (encuentro poco frecuente) */
  special: 'especial' | 'raro';
  /** zonas (0-3) en las que puede salir; sin lista, en todas */
  zones?: number[];
  /** peso al sortear (por defecto 3 los especiales y 1 los raros) */
  weight?: (run: RunState) => number;
}

const hex = (run: RunState, id: string, fights: number): void => { (run.hexes ??= []).push({ id, fights }); };
const each = (run: RunState, f: (h: RunState['heroes'][number]) => void): void => { for (const h of run.heroes) f(h); };
const relicNames = (run: RunState, rare: boolean): string => run.heroes.map((h) => giveRuneOffer(run, h, 'event', rare)).filter(Boolean).length ? 'Cada uno se lleva una runa.' : 'No queda ninguna runa por encontrar.';

export const SPECIAL_EVENTS: SpecialEventDef[] = [
  {
    id: 'sp_mercader', special: 'especial', title: 'El Mercader Errante',
    text: 'Un viajero encorvado arrastra un carro cubierto de campanillas. No vende objetos: vende cambios.',
    weight: (run) => (run.mods.includes('pobreza') ? 1 : 3),
    options: [
      { label: 'Comprar una runa rara', hint: 'Quien tenga 120 de oro paga 120 y recibe una runa rara. Quien no, no recibe nada.', apply: (run) => { let n = 0; each(run, (h) => { if (h.gold >= 120) { h.gold -= 120; if (giveRuneOffer(run, h, 'event', true)) n++; } }); return n ? `${n} de vosotros cerráis el trato.` : 'Nadie lleva oro suficiente. El mercader se encoge de hombros.'; } },
      { label: 'Venderle vida', hint: 'Todos: −10 de vida máxima hasta el final y +150 de oro.', apply: (run) => { each(run, (h) => { boon(h, 'hp', -10); h.gold += 150; }); return 'Os pesa el pecho, pero las bolsas suenan.'; } },
      { label: 'Seguir el camino', hint: 'No ocurre nada.', apply: () => 'Las campanillas se pierden a lo lejos.' },
    ],
  },
  {
    id: 'sp_altar', special: 'especial', title: 'El Altar Olvidado',
    text: 'Una figura sin rostro sostiene dos cuencos: uno rebosa luz; el otro, cadenas.',
    weight: (run) => (run.mods.includes('maldicion') ? 6 : 3),
    options: [
      { label: 'Beber de ambos cuencos', hint: 'Todos: +3 de daño hasta el final, pero Grilletes de plomo (−1 PM) durante 3 combates.', apply: (run) => { each(run, (h) => boon(h, 'power', 3)); hex(run, 'grilletes', 3); return 'La luz os quema por dentro; las cadenas, por fuera.'; } },
      { label: 'Beber solo la luz', hint: 'Todos recuperan un 30% de vida.', apply: (run) => { each(run, (h) => healPct(h, 0.3)); return 'La figura inclina la cabeza, decepcionada.'; } },
    ],
  },
  {
    id: 'sp_camara', special: 'especial', title: 'La Cámara Sellada',
    text: 'Una puerta de hierro con un mecanismo de monedas. Por la rendija se ve el brillo de un ajuar.',
    options: [
      { label: 'Pagar la cerradura', hint: 'Quien tenga 80 de oro paga 80 y recibe un objeto raro o mejor.', apply: (run) => { let n = 0; each(run, (h) => { if (h.gold >= 80) { h.gold -= 80; giveItem(run, h, 'elite', 1); n++; } }); return n ? `La cerradura se traga el oro de ${n} de vosotros y se abre.` : 'Nadie tiene oro suficiente.'; } },
      { label: 'Forzar la puerta', hint: '50%: todos reciben un objeto épico. 50%: una trampa os quita el 30% de la vida actual.', apply: (run) => { if (rand(run) < 0.5) { each(run, (h) => giveItem(run, h, 'boss', 2)); return '¡La puerta cede! El ajuar es vuestro.'; } each(run, (h) => losePct(h, 0.3)); return 'Una lluvia de dardos os recibe. La cámara estaba vacía.'; } },
      { label: 'Dejarla', hint: 'No ocurre nada.', apply: () => 'Hay puertas que es mejor no abrir.' },
    ],
  },
  {
    id: 'sp_viajero', special: 'raro', title: 'El Viajero del Abismo', zones: [1, 2, 3],
    text: 'Alguien camina en sentido contrario, hacia la superficie. Lleva un fardo que late y os pide que lo guardéis.',
    options: [
      { label: 'Aceptar el fardo', hint: 'Cada uno recibe una runa rara, pero el jefe de esta zona tendrá +25% de vida.', apply: (run) => { const t = relicNames(run, true); run.flags.push(`g2_carga_${run.zone}`); return `${t} A lo lejos, algo despierta y os huele.`; } },
      { label: 'Guiarle hacia la salida', hint: 'Todos recuperan un 25% de vida y ganan 40 de oro.', apply: (run) => { each(run, (h) => { healPct(h, 0.25); h.gold += 40; }); return 'Os da las gracias con una voz que no es humana.'; } },
      { label: 'Apartarse', hint: 'No ocurre nada.', apply: () => 'El viajero sigue subiendo sin mirar atrás.' },
    ],
  },
  {
    id: 'sp_eco', special: 'raro', title: 'Eco de una Expedición Perdida', zones: [0, 1, 2],
    weight: (run) => (run.mods.includes('oscuridad') ? 3 : 1),
    text: 'Entre los huesos de otro grupo, una runa repite sus últimas palabras una y otra vez.',
    options: [
      { label: 'Escuchar el eco', hint: 'Todos pierden el 10% de su vida actual. Se desvela una historia en las Crónicas del Archivo.', apply: (run) => { each(run, (h) => losePct(h, 0.1)); if (!run.flags.includes('lore_eco')) run.flags.push('lore_eco'); return '«No era una mazmorra. Era una boca. Y nosotros, lo que comía.» La runa se apaga.'; } },
      { label: 'Saquear sus restos', hint: 'Todos ganan 60 de oro, pero el próximo combate es una emboscada (+2 enemigos).', apply: (run) => { each(run, (h) => { h.gold += 60; }); run.ambush = true; return 'Algo os ha oído hurgar entre los huesos.'; } },
    ],
  },
  {
    id: 'sp_forja', special: 'especial', title: 'La Forja Prohibida', zones: [1, 2, 3],
    text: 'Un yunque negro arde sin fuego. Templa el metal con lo que le des de ti.',
    options: [
      { label: 'Templar con sangre', hint: 'Cada uno recibe un objeto épico o mejor; todos: −12 de vida máxima hasta el final.', apply: (run) => { each(run, (h) => { giveItem(run, h, 'boss', 2); boon(h, 'hp', -12); }); return 'El yunque bebe y devuelve acero vivo.'; } },
      { label: 'Templar con oro', hint: 'Quien tenga 100 de oro paga 100 y recibe un objeto raro o mejor.', apply: (run) => { let n = 0; each(run, (h) => { if (h.gold >= 100) { h.gold -= 100; giveItem(run, h, 'elite', 1); n++; } }); return n ? `El yunque acepta el oro de ${n} de vosotros.` : 'Nadie tiene oro suficiente.'; } },
      { label: 'No tocarla', hint: 'No ocurre nada.', apply: () => 'El yunque se enfría poco a poco.' },
    ],
  },
  {
    id: 'sp_destinos', special: 'especial', title: 'El Santuario de Dos Destinos',
    text: 'Dos estatuas se dan la espalda. Solo una puede bendeciros: la otra se derrumbará.',
    options: [
      { label: 'El destino del guerrero', hint: 'Todos: +2 de daño hasta el final.', apply: (run) => { each(run, (h) => boon(h, 'power', 2)); return 'La estatua del superviviente se hace polvo.'; } },
      { label: 'El destino del superviviente', hint: 'Todos: +15 de vida máxima hasta el final.', apply: (run) => { each(run, (h) => { boon(h, 'hp', 15); h.hp = Math.min(heroMaxHp(h), h.hp + 15); }); return 'La estatua del guerrero se hace polvo.'; } },
    ],
  },
  {
    id: 'sp_campeon', special: 'raro', title: 'El Desafío del Campeón',
    weight: (run) => (run.mods.includes('elites') || run.mods.includes('reforzados') ? 3 : 1),
    text: 'Un estandarte clavado en el suelo: quien lo arranque se enfrentará al campeón de esta zona y a su escolta.',
    options: [
      { label: 'Arrancar el estandarte', hint: 'El próximo combate es una emboscada (+2 enemigos). Si lo ganáis, cada uno recibe una runa rara.', apply: (run) => { run.ambush = true; if (!run.flags.includes('g2_desafio')) run.flags.push('g2_desafio'); return 'Un cuerno resuena en la oscuridad. Vienen a por vosotros.'; } },
      { label: 'Dejarlo en pie', hint: 'No ocurre nada.', apply: () => 'El estandarte ondea sin viento.' },
    ],
  },
  {
    id: 'sp_anomalia', special: 'especial', title: 'Anomalía Rúnica',
    weight: (run) => (run.mods.includes('presagios') || run.mods.includes('niebla') ? 6 : 3),
    text: 'Las runas del suelo giran solas. Podéis fijarlas en una forma antes de seguir.',
    options: [
      { label: 'Fijar la Calma', hint: 'El próximo combate tendrá el presagio Calma (+1 PA para los héroes), pero todos pierden el 15% de su vida actual.', apply: (run) => { run.nextOmen = 'calma'; each(run, (h) => losePct(h, 0.15)); return 'El aire se aquieta. Os cuesta respirar.'; } },
      { label: 'Fijar la Luna de sangre', hint: 'El próximo combate tendrá el presagio Luna de sangre (todos +2 de daño; los enemigos, +1).', apply: (run) => { run.nextOmen = 'sangre'; return 'Una luz roja se filtra por las grietas.'; } },
      { label: 'Dejar que giren', hint: 'No ocurre nada.', apply: () => 'Las runas se detienen en una forma que no reconocéis.' },
    ],
  },
  {
    id: 'sp_tesoro', special: 'raro', title: 'El Tesoro Custodiado',
    text: 'Un montón de monedas bajo la mirada de una estatua con espada. Los ojos de piedra siguen cada mano.',
    options: [
      { label: 'Apostar la mitad del oro', hint: 'Cada uno arriesga la mitad de su oro: 60% de doblarla, 40% de perderla (una tirada para todo el grupo).', apply: (run) => { const win = rand(run) < 0.6; each(run, (h) => { const st = Math.floor(h.gold / 2); h.gold += win ? st : -st; }); return win ? 'La estatua no se mueve. Salís con los bolsillos llenos.' : 'La espada baja. Perdéis lo apostado y la vida por poco.'; } },
      { label: 'Robar una sola moneda', hint: 'Todos ganan 25 de oro.', apply: (run) => { each(run, (h) => { h.gold += 25; }); return 'Nadie se fija en una moneda.'; } },
    ],
  },
];

/** Probabilidad de que una sala de evento sea especial (como mucho uno por zona). */
export const SPECIAL_CHANCE = 0.35;
export const specialDef = (id: string | undefined): SpecialEventDef | undefined => SPECIAL_EVENTS.find((e) => e.id === id);

/** Eventos especiales que pueden salir ahora: zona permitida y no vistos en esta expedición. */
export function specialCandidates(run: RunState): SpecialEventDef[] {
  return SPECIAL_EVENTS.filter((e) => (!e.zones || e.zones.includes(run.zone)) && !run.eventsSeen.includes(e.id));
}
export const specialWeight = (run: RunState, e: SpecialEventDef): number => e.weight?.(run) ?? (e.special === 'raro' ? 1 : 3);
