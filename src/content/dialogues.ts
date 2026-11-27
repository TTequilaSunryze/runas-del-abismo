// Conversaciones con los habitantes del Asentamiento. Solo ambientación: no cambian el progreso.
// Límites de canon (Fase J): nadie conoce el mecanismo del retorno ni los grandes misterios del Abismo.

/** Lo que el habitante sabe de ti en este momento. */
export interface TalkCtx {
  cls: string;
  clsName: string;
  runs: number;
  wins: number;
  bosses: number;
  kills: number;
  archivePct: number;
  maxAsc: number;
}

export interface TalkOption {
  label: string;
  /** nodo al que lleva; '' termina la conversación */
  to: string;
  /** opción visible pero cerrada, con el motivo */
  locked?: string;
}

export interface TalkNode {
  lines: (c: TalkCtx) => string[];
  options: (c: TalkCtx) => TalkOption[];
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  /** retrato del cuadro de diálogo y figura grande */
  portrait: string;
  figure: string;
  start: string;
  nodes: Record<string, TalkNode>;
}

/** Rumores de Irena: se desbloquean con lo que el jugador ha vivido. */
const IRENA_RUMORS: Array<{ need: (c: TalkCtx) => boolean; hint: string; lines: string[] }> = [
  { need: () => true, hint: '', lines: ['Dicen que en las Catacumbas los muertos no atacan por odio, sino por costumbre.', 'Yo no lo sé. Pero quien lo contó volvió sin un rasguño y no quiso volver a bajar.'] },
  { need: (c) => c.runs >= 3, hint: 'Vuelve cuando hayas bajado unas cuantas veces.', lines: ['Los que regresan de la segunda zona huelen a musgo durante días. Ni el jabón de lejía se lo quita.', 'Ten cuidado con lo que crece allí abajo. A veces crece sobre la gente.'] },
  { need: (c) => c.bosses >= 1, hint: 'Vuelve cuando hayas derrotado a un guardián.', lines: ['Desde que tumbaste a aquel guardián, la mesa del rincón brinda por ti cada noche.', 'No te lo tomes como un halago. Brindan por cualquiera que les dé una excusa para beber.'] },
  { need: (c) => c.archivePct >= 15, hint: 'Vuelve cuando el Archivo tenga más de tus hallazgos.', lines: ['Sava me pidió que le guarde los papeles que la gente olvida en las mesas.', 'Me dijo que un mapa a medio terminar vale más que diez historias completas. Creo que tiene razón.'] },
  { need: (c) => c.wins >= 1, hint: 'Vuelve cuando hayas llegado hasta el final.', lines: ['Hay quien dice que, cuando alguien vence ahí abajo, el Abismo tarda unos días en volver a respirar.', 'Las lámparas parpadean menos esas noches. O eso quiero creer.'] },
];

const HERO_REACTION: Record<string, string> = {
  zorro: 'Nueve colas y ni una sola mancha de barro. O tienes mucha suerte o no has bajado todavía.',
  esferas: 'Esas esferas tuyas zumban como colmena. Déjalas lejos de mis botellas, ¿quieres?',
  acechador: 'No te he oído entrar. No me gusta no oír entrar a la gente.',
  carcelero: 'Esa linterna no da calor. Siéntate junto al fuego, por si acaso.',
  barbaro: 'Las mesas son de roble, pero no tanto. Si te enfadas, sal a la calle.',
  arquitecto: 'Si vas a dibujar runas, que no sea en mi barra. Tardé un mes en quitar las del último.',
  pistolero: 'Las armas descargadas en la entrada. Las cargadas, también.',
  arquero: 'Los arqueros siempre se sientan de espaldas a la pared. Esa mesa está libre.',
};

const IRENA_MENU = (c: TalkCtx): TalkOption[] => {
  const open = IRENA_RUMORS.filter((r) => r.need(c));
  const next = IRENA_RUMORS.find((r) => !r.need(c));
  return [
    { label: '¿Qué es este lugar?', to: 'refugio' },
    { label: '¿Qué se cuenta de las expediciones?', to: 'expediciones' },
    { label: 'Háblame de ti.', to: 'ella' },
    open.length > 1 || !next ? { label: `¿Has oído algo nuevo? (${open.length}/${IRENA_RUMORS.length})`, to: 'rumores' } : { label: '¿Has oído algo nuevo?', to: 'rumores', ...(open.length ? {} : { locked: next.hint }) },
    { label: 'Me voy. Gracias, Irena.', to: '' },
  ];
};

export const NPCS: Record<string, Npc> = {
  irena: {
    id: 'irena',
    name: 'Irena',
    role: 'Tabernera',
    portrait: 'npc/irena_retrato.jpg',
    figure: 'npc/irena.png',
    start: 'saludo',
    nodes: {
      saludo: {
        lines: (c) => [
          c.runs === 0 ? 'Cara nueva. Siéntate donde quieras; aquí nadie pregunta de dónde vienes.' : c.runs < 5 ? `Has vuelto. ${c.runs === 1 ? 'Una expedición' : `${c.runs} expediciones`} y sigues de una pieza. Buena señal.` : 'Ya eres de la casa. La primera ronda sigue siendo para los que vuelven.',
          HERO_REACTION[c.cls] ?? `Así que ahora vas de ${c.clsName.toLowerCase()}. Te queda bien.`,
          '¿Qué te sirvo? Bebida no tengo mucha. Conversación, toda la que quieras.',
        ],
        options: IRENA_MENU,
      },
      refugio: {
        lines: () => [
          'Esto no lo fundó nadie. Se fue levantando alrededor de la entrada, tabla a tabla, con lo que bajaba y con lo que volvía.',
          'La Forja, el Archivo, la Atalaya… cada sitio lo puso alguien que necesitaba un motivo para quedarse.',
          'Nadie lo llama seguro. Simplemente, todavía sigue en pie.',
        ],
        options: IRENA_MENU,
      },
      expediciones: {
        lines: (c) => c.runs === 0
          ? ['De ti todavía no se cuenta nada. Eso es lo mejor que se puede decir de alguien aquí.', 'Cuando bajes, vuelve y cuéntamelo. O no me lo cuentes: también se nota.']
          : [
            `${c.runs} veces has cruzado esa puerta. ${c.kills ? `Dicen que ${c.kills} criaturas no volvieron a levantarse por tu culpa.` : 'Y todavía nadie sabe qué hiciste ahí abajo.'}`,
            c.wins ? `Y llegaste hasta el final ${c.wins === 1 ? 'una vez' : `${c.wins} veces`}. Darel tuvo que mirarte dos veces para reconocerte.` : c.bosses ? `Has tumbado a ${c.bosses === 1 ? 'un guardián' : `${c.bosses} guardianes`}. El final todavía te espera.` : 'Todavía no has visto a ningún guardián caer. Ya llegará.',
            c.maxAsc ? `Y ahora bajas buscando más peligro. Ascensión ${c.maxAsc}, me han dicho. No lo entiendo, pero lo respeto.` : 'Vuelve siempre. Es lo único que te pido.',
          ],
        options: IRENA_MENU,
      },
      ella: {
        lines: () => [
          '¿Yo? Sirvo, limpio y escucho. A veces las tres cosas a la vez.',
          'No pregunto qué visteis ahí abajo. Espero a que decidáis si queréis contarlo.',
          'La segunda ronda es para los que todavía no saben si se van a quedar.',
        ],
        options: IRENA_MENU,
      },
      rumores: {
        lines: (c) => {
          const open = IRENA_RUMORS.filter((r) => r.need(c));
          // el más reciente que se ha desbloqueado
          return open[open.length - 1]?.lines ?? ['Nada que no sepas ya.'];
        },
        options: IRENA_MENU,
      },
    },
  },
};
