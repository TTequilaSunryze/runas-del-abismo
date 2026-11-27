// Fase G4: acontecimientos ramificados. Usan el sistema de eventos de grupo de siempre (votación y resolución en el anfitrión
// con el generador de la partida). Lo nuevo:
// - decisiones que dejan una marca en `run.flags` (`clave@zona`) y que, en una zona posterior, hacen aparecer su continuación;
// - opciones que solo están disponibles si el grupo tomó antes cierta decisión (`when`, se muestran bloqueadas si no);
// - la llave rúnica que abre el pasaje secreto de la zona y la Cámara a la que lleva.
import { CAGE_ALLY } from './enemies';
import type { RunState } from '../game/run';
import { addAlly, giveRuneOffer, offerBossReward } from '../game/run';
import { MAX_CONSUMABLE } from './boons';
import { boon, healPct, losePct, type EventDef, type EventOption } from './zona1/events';

export interface BranchOption extends EventOption {
  /** solo se puede elegir si se cumple (las demás opciones no cambian de posición) */
  when?: (run: RunState) => boolean;
  /** por qué está bloqueada */
  need?: string;
}

export interface BranchEventDef extends EventDef {
  options: BranchOption[];
  /** acontecimiento inicial de una cadena: entra en el sorteo normal de las zonas indicadas */
  starter?: boolean;
  /** continuación: aparece (con prioridad) en cuanto se cumple */
  requires?: (run: RunState) => boolean;
  zones?: number[];
}

// --- marcas de decisión: `clave@zona` en run.flags ---
const tag = (key: string, zone: number): string => `${key}@${zone}`;
/** ¿Tomó el grupo esa decisión (en cualquier zona)? */
export const hasMark = (run: Pick<RunState, 'flags'>, key: string): boolean => run.flags.some((f) => f.startsWith(`${key}@`));
/** Zona en la que se tomó la decisión (o −1). */
export const markZone = (run: Pick<RunState, 'flags'>, key: string): number => { const f = run.flags.find((x) => x.startsWith(`${key}@`)); return f ? Number(f.split('@')[1]) : -1; };
const mark = (run: RunState, key: string): void => { if (!hasMark(run, key)) run.flags.push(tag(key, run.zone)); };
const clear = (run: RunState, key: string): void => { run.flags = run.flags.filter((f) => !f.startsWith(`${key}@`)); };
/** Decisión tomada en una zona anterior y todavía sin resolver. */
const pendingFrom = (run: RunState, key: string): boolean => { const z = markZone(run, key); return z >= 0 && z < run.zone; };

/** Llave rúnica de la zona actual: abre su pasaje secreto. */
export const keyFlag = (zone: number): string => `g4_llave_${zone}`;
const giveKey = (run: RunState): void => { if (!run.flags.includes(keyFlag(run.zone))) run.flags.push(keyFlag(run.zone)); };
/** El próximo jefe de esta zona llega con un 15% menos de vida. */
export const weakBossFlag = (zone: number): string => `g4_jefe_debil_${zone}`;

const each = (run: RunState, f: (h: RunState['heroes'][number]) => void): void => { for (const h of run.heroes) f(h); };
/** Cobra `n` de oro a todos si todos pueden; si no, no cobra a nadie. */
const allPay = (run: RunState, n: number): boolean => { if (run.heroes.some((h) => h.gold < n)) return false; each(run, (h) => { h.gold -= n; }); return true; };

export const BRANCH_EVENTS: BranchEventDef[] = [
  // ---------------- El Cartógrafo perdido ----------------
  {
    id: 'g4_cartografo', starter: true, zones: [0, 1, 2], title: 'El Cartógrafo Perdido',
    text: 'Un anciano con la linterna apagada aprieta un rollo de pergamino contra el pecho. Dice conocer un pasaje que nadie más ha pisado.',
    options: [
      { label: 'Escoltarlo hasta su refugio', hint: 'Todos pierden el 15% de su vida actual. Os da la llave rúnica del pasaje sellado de esta zona. Os esperará más adelante.', apply: (run) => { each(run, (h) => losePct(h, 0.15)); giveKey(run); mark(run, 'g4_carto_amigo'); return 'Lo dejáis a salvo. Antes de despedirse os entrega una llave grabada con runas.'; } },
      { label: 'Quitarle el mapa', hint: 'Llave rúnica de esta zona y +40 de oro cada uno, pero alguien vendrá a cobrárselo.', apply: (run) => { giveKey(run); each(run, (h) => { h.gold += 40; }); mark(run, 'g4_carto_robado'); return 'El anciano grita un nombre mientras huís. No suena a amenaza vacía.'; } },
      { label: 'Comprarle una copia', hint: 'Cuesta 35 de oro a cada uno (si alguien no puede pagar, no hay trato). Llave rúnica de esta zona.', apply: (run) => { if (!allPay(run, 35)) return 'No reunís el oro. El anciano se aleja murmurando.'; giveKey(run); return 'Copia en mano, sabéis dónde buscar la grieta.'; } },
    ],
  },
  {
    id: 'g4_carto_refugio', title: 'El Refugio del Cartógrafo',
    text: 'Una lámpara encendida en la roca: el anciano al que escoltasteis ha preparado un fuego y os hace sitio.',
    requires: (run) => pendingFrom(run, 'g4_carto_amigo'),
    options: [
      { label: 'Descansar junto al fuego', hint: 'Todos recuperan un 35% de vida.', apply: (run) => { each(run, (h) => healPct(h, 0.35)); clear(run, 'g4_carto_amigo'); return 'Dormís sin sobresaltos por primera vez en días.'; } },
      { label: 'Pedirle el mapa de esta zona', hint: 'Llave rúnica de esta zona y +25 de oro cada uno.', apply: (run) => { giveKey(run); each(run, (h) => { h.gold += 25; }); clear(run, 'g4_carto_amigo'); return 'Marca con su dedo una grieta que nadie más conoce.'; } },
      { label: 'Presentarle al prisionero liberado', hint: 'Juntos trazan la ruta: llave rúnica de esta zona y todos recuperan un 15% de vida.', need: 'Requiere haber liberado al prisionero encadenado.', when: (run) => hasMark(run, 'g4_preso_libre') || run.flags.includes('g4_preso_libre_ok'),
        apply: (run) => { giveKey(run); each(run, (h) => healPct(h, 0.15)); clear(run, 'g4_carto_amigo'); return 'Los dos viejos se ríen de lo mismo. Salís con mapa y ánimo.'; } },
    ],
  },
  {
    id: 'g4_cazarrecompensas', title: 'Los Cazarrecompensas',
    text: 'Tres figuras os cierran el paso. Una lleva el retrato del cartógrafo al que robasteis.',
    requires: (run) => pendingFrom(run, 'g4_carto_robado'),
    options: [
      { label: 'Pagar la recompensa', hint: 'Cuesta 50 de oro a cada uno. Si alguien no puede, os emboscan igualmente en el próximo combate.', apply: (run) => { clear(run, 'g4_carto_robado'); if (allPay(run, 50)) return 'Cuentan las monedas y se apartan.'; run.ambush = true; return 'No basta. Se retiran… para esperaros más adelante.'; } },
      { label: 'Plantarles cara', hint: 'El próximo combate es una emboscada (más enemigos), pero al ganarla cada uno recibe una runa rara.', apply: (run) => { clear(run, 'g4_carto_robado'); run.ambush = true; if (!run.flags.includes('g2_desafio')) run.flags.push('g2_desafio'); return 'Desenfundan. Será en el próximo claro.'; } },
      { label: 'Devolverles la llave', hint: 'Perdéis la llave rúnica de esta zona y todos recuperan un 10% de vida.', need: 'Requiere tener la llave rúnica de esta zona.', when: (run) => run.flags.includes(keyFlag(run.zone)),
        apply: (run) => { clear(run, 'g4_carto_robado'); run.flags = run.flags.filter((f) => f !== keyFlag(run.zone)); each(run, (h) => healPct(h, 0.1)); return 'La llave cambia de manos y el asunto queda zanjado.'; } },
    ],
  },
  // ---------------- El Prisionero encadenado ----------------
  {
    id: 'g4_prisionero', starter: true, zones: [0, 1, 2], title: 'El Prisionero de las Cadenas',
    text: 'Un guerrero cuelga de cadenas al rojo. Los carceleros han dejado una bolsa de monedas para quien lo entregue.',
    options: [
      { label: 'Liberarlo', hint: 'Todos pierden el 20% de su vida actual. Lucha a vuestro lado hasta el final de la zona y no olvidará el favor.', apply: (run) => { each(run, (h) => losePct(h, 0.2)); addAlly(run, CAGE_ALLY[run.zone] ?? 'mercenario'); mark(run, 'g4_preso_libre'); return 'Las cadenas os queman las manos. Él se levanta y recoge su arma.'; } },
      { label: 'Entregarlo a los carceleros', hint: '+70 de oro cada uno. Puede que vuelva.', apply: (run) => { each(run, (h) => { h.gold += 70; }); mark(run, 'g4_preso_vendido'); return 'La bolsa pesa. Su mirada, más.'; } },
      { label: 'Interrogarlo y seguir', hint: 'Os cuenta dónde está el pasaje sellado: llave rúnica de esta zona.', apply: (run) => { giveKey(run); return 'Habla a cambio de nada. Lo dejáis colgando.'; } },
    ],
  },
  {
    id: 'g4_preso_regreso', title: 'El Regreso del Prisionero',
    text: 'El guerrero al que liberasteis os espera junto a un fuego, con su botín de guerra al lado.',
    requires: (run) => pendingFrom(run, 'g4_preso_libre'),
    options: [
      { label: 'Que vuelva a luchar con vosotros', hint: 'Se une al grupo hasta el final de esta zona.', apply: (run) => { addAlly(run, CAGE_ALLY[run.zone] ?? 'mercenario'); clear(run, 'g4_preso_libre'); run.flags.push('g4_preso_libre_ok'); return 'Choca su arma con la vuestra: deuda pagada.'; } },
      { label: 'Aceptar su botín', hint: 'Cada uno recibe una runa.', apply: (run) => { const n = run.heroes.map((h) => giveRuneOffer(run, h, 'event')).filter(Boolean).length; clear(run, 'g4_preso_libre'); run.flags.push('g4_preso_libre_ok'); return n ? 'Reparte lo que saqueó a sus carceleros.' : 'No queda nada que no tengáis ya.'; } },
    ],
  },
  {
    id: 'g4_preso_venganza', title: 'La Venganza del Prisionero',
    text: 'El guerrero que vendisteis ha escapado. Os ha seguido hasta aquí, y no viene solo.',
    requires: (run) => pendingFrom(run, 'g4_preso_vendido'),
    options: [
      { label: 'Devolverle el oro', hint: 'Quien tenga 70 de oro lo paga; quien no, pierde el 20% de su vida actual.', apply: (run) => { each(run, (h) => { if (h.gold >= 70) h.gold -= 70; else losePct(h, 0.2); }); clear(run, 'g4_preso_vendido'); return 'Acepta lo que hay. Lo que no hay, lo cobra en sangre.'; } },
      { label: 'Enfrentarlo', hint: 'El próximo combate es una emboscada, pero sus enemigos llevan el doble de oro.', apply: (run) => { run.ambush = true; run.nextOmen = 'oro'; clear(run, 'g4_preso_vendido'); return 'Sus compañeros se dispersan entre las sombras. Os esperan.'; } },
    ],
  },
  // ---------------- La Fuente de las Ánimas ----------------
  {
    id: 'g4_fuente', starter: true, zones: [1, 2, 3], title: 'La Fuente de las Ánimas',
    text: 'Agua negra que brilla sin luz. Las almas que flotan en ella os ofrecen fuerza; la fuente, siempre, cobra.',
    options: [
      { label: 'Beber', hint: 'Todos: +1 de daño hasta el final. La fuente vendrá a cobrar en otra zona.', apply: (run) => { each(run, (h) => boon(h, 'power', 1)); mark(run, 'g4_fuente_bebida'); return 'El agua sabe a hierro y a recuerdos ajenos.'; } },
      { label: 'Llenar frascos', hint: 'Cada uno recibe una Poción de curación (si le cabe).', apply: (run) => { each(run, (h) => { h.bag2.c_vida = Math.min(MAX_CONSUMABLE, (h.bag2.c_vida ?? 0) + 1); }); return 'Tapáis los frascos antes de que las almas protesten.'; } },
      { label: 'Sellarla con sangre', hint: 'Todos pierden el 20% de su vida actual, pero el jefe de esta zona llega con un 15% menos de vida.', apply: (run) => { each(run, (h) => losePct(h, 0.2)); if (!run.flags.includes(weakBossFlag(run.zone))) run.flags.push(weakBossFlag(run.zone)); return 'Las almas se hunden. Algo, más adelante, se debilita con ellas.'; } },
    ],
  },
  {
    id: 'g4_sed', title: 'La Sed de las Ánimas',
    text: 'Una voz que conocéis os habla desde un charco: lo que bebisteis en la fuente se paga ahora.',
    requires: (run) => pendingFrom(run, 'g4_fuente_bebida'),
    options: [
      { label: 'Pagar con sangre', hint: 'Todos: −10 de vida máxima hasta el final. Conserváis el daño.', apply: (run) => { each(run, (h) => boon(h, 'hp', -10)); clear(run, 'g4_fuente_bebida'); return 'El charco se tiñe y se seca.'; } },
      { label: 'Devolver el poder', hint: 'Todos pierden el +1 de daño de la fuente.', apply: (run) => { each(run, (h) => boon(h, 'power', -1)); clear(run, 'g4_fuente_bebida'); return 'Sentís cómo se os escapa algo por los dedos.'; } },
      { label: 'Pagar con oro', hint: 'Quien tenga 60 de oro lo paga y conserva el daño; quien no, lo pierde.', apply: (run) => { each(run, (h) => { if (h.gold >= 60) h.gold -= 60; else boon(h, 'power', -1); }); clear(run, 'g4_fuente_bebida'); return 'La voz cuenta las monedas una a una.'; } },
    ],
  },
  // ---------------- El Heraldo del Jefe (pacto) ----------------
  {
    id: 'g4_heraldo', starter: true, zones: [1, 2], title: 'El Heraldo del Guardián',
    text: 'Un emisario del guardián de la zona os ofrece un trato: conocimiento a cambio de que su señor os reciba en plena forma.',
    options: [
      { label: 'Aceptar el trato', hint: 'Cada uno elige ahora una bendición de su clase (como la recompensa de un jefe), pero el jefe de esta zona tendrá +25% de vida.', apply: (run) => { each(run, (h) => offerBossReward(run, h)); if (!run.flags.includes(`g2_carga_${run.zone}`)) run.flags.push(`g2_carga_${run.zone}`); return 'El heraldo sonríe y desaparece. Su señor os estará esperando.'; } },
      { label: 'Ofrecer sangre en su lugar', hint: 'Todos: −8 de vida máxima hasta el final; cada uno recibe una runa.', apply: (run) => { each(run, (h) => { boon(h, 'hp', -8); giveRuneOffer(run, h, 'event'); }); return 'Acepta el pago con una reverencia burlona.'; } },
      { label: 'Romperle el cuerno', hint: '+50 de oro cada uno, pero el próximo élite sale con dos modificadores más.', apply: (run) => { each(run, (h) => { h.gold += 50; }); if (!run.flags.includes('cursed_elite')) run.flags.push('cursed_elite'); return 'El cuerno se parte. A lo lejos, algo responde con un rugido.'; } },
    ],
  },
  // ---------------- La Cámara del pasaje secreto ----------------
  {
    id: 'g4_camara', title: 'La Cámara Rúnica',
    text: 'Tras el pasaje sellado, una sala que nadie ha pisado en siglos. Tres cosas brillan; solo hay tiempo para una.',
    options: [
      { label: 'Llevarse el ajuar', hint: 'Cada uno recibe una runa rara.', apply: (run) => { const n = run.heroes.map((h) => giveRuneOffer(run, h, 'event', true)).filter(Boolean).length; return n ? 'Cada uno sale con algo que no debería existir.' : 'Las vitrinas están vacías para vosotros.'; } },
      { label: 'Leer los grabados', hint: 'Cada uno elige una bendición de su clase (como la recompensa de un jefe).', apply: (run) => { each(run, (h) => offerBossReward(run, h)); return 'Las runas se graban también en vuestra memoria.'; } },
      { label: 'Ofrecerle la sed de la fuente', hint: 'La fuente ya no os cobrará: conserváis el daño y todos recuperan un 25% de vida.', need: 'Requiere haber bebido de la Fuente de las Ánimas.', when: (run) => hasMark(run, 'g4_fuente_bebida'),
        apply: (run) => { clear(run, 'g4_fuente_bebida'); each(run, (h) => healPct(h, 0.25)); return 'La cámara bebe por vosotros. La deuda se borra.'; } },
      { label: 'Descansar en la cámara', hint: 'Todos recuperan un 50% de vida y se rompen las maldiciones activas.', apply: (run) => { each(run, (h) => healPct(h, 0.5)); run.hexes = []; return 'El silencio de la cámara deshace lo que os perseguía.'; } },
    ],
  },
];

export const branchDef = (id: string | undefined): BranchEventDef | undefined => BRANCH_EVENTS.find((e) => e.id === id);

/** ¿Se puede elegir esa opción ahora? (las opciones sin condición, siempre) */
export const optionOpen = (run: RunState, o: EventOption): boolean => !(o as BranchOption).when || !!(o as BranchOption).when!(run);

/** Continuaciones listas para aparecer (por orden de la lista). */
export const followUps = (run: RunState): BranchEventDef[] => BRANCH_EVENTS.filter((e) => e.requires && !run.eventsSeen.includes(e.id) && e.requires(run));

/** Acontecimientos iniciales que pueden salir en esta zona (una vez por expedición). */
export const branchStarters = (run: RunState): BranchEventDef[] => BRANCH_EVENTS.filter((e) => e.starter && (!e.zones || e.zones.includes(run.zone)) && !run.eventsSeen.includes(e.id));

/** ¿Está abierto el pasaje secreto de la zona? Con la llave rúnica, o si el jefe anterior cayó sin bajas. */
export const secretOpen = (run: Pick<RunState, 'flags' | 'zone'>): boolean => run.flags.includes(keyFlag(run.zone)) || (run.zone > 0 && run.flags.includes(`flawless_${run.zone - 1}`));

export interface Consequence { icon: string; name: string; text: string; tone: 'good' | 'bad' | 'mixed' }

/** Consecuencias activas de decisiones anteriores (para la interfaz). */
export function consequences(run: RunState): Consequence[] {
  const out: Consequence[] = [];
  if (secretOpen(run) && !run.flags.includes(`g4_camara_${run.zone}`)) out.push({ icon: '🗝️', name: 'Pasaje abierto', text: run.flags.includes(keyFlag(run.zone)) ? 'Tenéis la llave rúnica: el pasaje sellado de esta zona se puede elegir en el mapa.' : 'El jefe anterior cayó sin bajas: el pasaje sellado de esta zona está abierto.', tone: 'good' });
  if (hasMark(run, 'g4_carto_amigo')) out.push({ icon: '🧭', name: 'Amigo del cartógrafo', text: 'Os espera en una zona posterior con refugio y mapas.', tone: 'good' });
  if (hasMark(run, 'g4_carto_robado')) out.push({ icon: '🎯', name: 'Perseguidos', text: 'Los cazarrecompensas del cartógrafo os buscan en la próxima zona.', tone: 'bad' });
  if (hasMark(run, 'g4_preso_libre')) out.push({ icon: '⛓️', name: 'Favor del prisionero', text: 'El guerrero liberado volverá a ayudaros en otra zona.', tone: 'good' });
  if (hasMark(run, 'g4_preso_vendido')) out.push({ icon: '🗡️', name: 'Venganza pendiente', text: 'El prisionero vendido os buscará en la próxima zona.', tone: 'bad' });
  if (hasMark(run, 'g4_fuente_bebida')) out.push({ icon: '💧', name: 'Sed de las Ánimas', text: '+1 de daño; la fuente vendrá a cobrar en otra zona (o se lo puede quedar la Cámara Rúnica).', tone: 'mixed' });
  if (run.flags.includes(weakBossFlag(run.zone))) out.push({ icon: '🩸', name: 'Guardián debilitado', text: 'El jefe de esta zona llega con un 15% menos de vida.', tone: 'good' });
  if (run.flags.includes(`g2_carga_${run.zone}`)) out.push({ icon: '☠️', name: 'Guardián reforzado', text: 'El jefe de esta zona tendrá +25% de vida.', tone: 'bad' });
  if (run.flags.includes('cursed_elite')) out.push({ icon: '👹', name: 'Élite maldito', text: 'El próximo élite sale con dos modificadores más.', tone: 'bad' });
  if (run.ambush) out.push({ icon: '⚠️', name: 'Emboscada', text: 'El próximo combate tendrá más enemigos (y mejor botín).', tone: 'mixed' });
  if (run.flags.includes('g2_desafio')) out.push({ icon: '🏆', name: 'Desafío', text: 'Ganad el próximo combate y cada uno recibirá una runa rara.', tone: 'good' });
  return out;
}
