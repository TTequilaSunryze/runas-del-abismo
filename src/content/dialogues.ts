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
  /** Archivo: expedientes investigados, total, listos para investigar y la pista más cercana */
  researched: number;
  researchTotal: number;
  researchReady: string[];
  researchNext: string;
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
  { need: (c) => c.archivePct >= 15, hint: 'Vuelve cuando el Archivo tenga más de tus hallazgos.', lines: ['Romi me pidió que le guarde los papeles que la gente olvida en las mesas.', 'Me dijo que un mapa a medio terminar vale más que diez historias completas. Creo que tiene razón.'] },
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

const ROMI_HERO: Record<string, string> = {
  zorro: 'Una hechicera zorro… ¿sabías que las colas cuentan cuántas runas ha comprendido? No, me lo acabo de inventar. Pero quiero comprobarlo.',
  esferas: 'Tus esferas siguen órbitas perfectas. Si te quedas quieta un momento podría medirlas.',
  acechador: 'Ah, eres tú. Las sombras de esta sala se han movido un poco al entrar. Muy poco. Lo he notado.',
  carcelero: 'Esa linterna… ¿las almas de dentro hablan? Si lo hacen, me encantaría transcribirlas.',
  barbaro: 'Bienvenido. Las estanterías son antiguas y frágiles, igual que mis nervios. Despacito, ¿sí?',
  arquitecto: '¡Un arquitecto rúnico! Por fin alguien que entiende por qué los trazos importan.',
  pistolero: 'Pólvora y runas. Nadie ha escrito todavía sobre eso. ¿Me dejas ser la primera?',
  arquero: 'Siempre me han dado envidia los arqueros: veis las cosas de lejos y con calma. Justo lo que hace falta aquí.',
};

const ROMI_THEORIES: Array<{ need: number; lines: string[] }> = [
  { need: 1, lines: ['Primera teoría: las runas no se inventaron. Se encontraron. Todas las familias comparten trazos que nadie enseñó.'] },
  { need: 4, lines: ['Cada región guarda un tipo de runa, como si alguien las hubiera repartido a propósito.', 'O como si el Abismo las hubiera ido soltando a medida que crecía.'] },
  { need: 8, lines: ['Los objetos que traéis no son botín. Son mensajes. Casi todos pertenecieron a alguien que intentó volver.', 'Quizá por eso pesan más de lo que deberían.'] },
  { need: 14, lines: ['Ya casi lo tengo. El Abismo no guarda las runas: las necesita. Sin ellas se cierra.', 'Y si se cierra… no sé qué pasaría con nosotros. Sigamos investigando, ¿vale?'] },
];

const ROMI_MENU = (c: TalkCtx): TalkOption[] => [
  { label: '¿Cómo funciona el Archivo?', to: 'archivo' },
  { label: c.researchReady.length ? `¿Qué puedo investigar? (${c.researchReady.length} listo${c.researchReady.length === 1 ? '' : 's'})` : '¿Qué puedo investigar?', to: 'pendiente' },
  { label: 'Háblame de ti.', to: 'ella' },
  c.researched ? { label: '¿Tienes alguna teoría?', to: 'teorias' } : { label: '¿Tienes alguna teoría?', to: 'teorias', locked: 'Investiga al menos un expediente.' },
  { label: 'Te dejo trabajar. Hasta luego, Romi.', to: '' },
];

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
  romi: {
    id: 'romi',
    name: 'Romi',
    role: 'Archivera',
    portrait: 'npc/romi_retrato.jpg',
    figure: 'npc/romi.png',
    start: 'saludo',
    nodes: {
      saludo: {
        lines: (c) => [
          c.runs === 0 ? '¡Oh! Perdona, no te había oído. Cuando leo se me va el mundo entero.' : '¡Has vuelto! Siéntate si encuentras dónde. Lo de las sillas está… en proceso de clasificación.',
          ROMI_HERO[c.cls] ?? `${c.clsName}. Nunca había tenido a alguien así delante. ¿Te importa si tomo notas?`,
          c.researchReady.length ? `Por cierto: con lo que has traído ya puedo cerrar ${c.researchReady.length === 1 ? 'un expediente' : `${c.researchReady.length} expedientes`}. Échale un ojo a la mesa.` : c.researched ? `Llevamos ${c.researched} de ${c.researchTotal} expedientes resueltos. No está mal para dos personas y una vela.` : 'Todo lo que veas en esta sala se puede examinar. Y si traes pruebas suficientes, investigar.',
        ],
        options: ROMI_MENU,
      },
      archivo: {
        lines: () => [
          'Aquí guardamos lo que bajáis a buscar y lo que subís sin querer. Runas, regiones, objetos… y los nombres de quienes los encontraron.',
          'Puedes examinar cualquier cosa de la que tengamos una pista. Eso te dice lo que ya sabemos.',
          'Investigar es otra cosa: necesito pruebas. Hechizos usados, criaturas derrotadas, objetos recuperados más de una vez. Cuando están todas, abrimos el expediente.',
          'No escribas «ocurrió». Escribe «alguien asegura que ocurrió». La diferencia ha mantenido viva a más gente que cualquier armadura.',
        ],
        options: ROMI_MENU,
      },
      pendiente: {
        lines: (c) => c.researchReady.length
          ? [`Ahora mismo puedo investigar: ${c.researchReady.slice(0, 3).join(', ')}${c.researchReady.length > 3 ? ' y alguno más' : ''}.`, 'Las vitrinas, el tablón y la mesa: todo está abierto. Tú eliges por dónde empezamos.']
          : [c.researchNext ? `Lo que tengo más cerca es esto: ${c.researchNext}.` : '¡Lo hemos investigado todo! No pensé que vería este día.', 'Tráeme eso y lo cerramos juntas. Bueno, juntos. Bueno… ya me entiendes.'],
        options: ROMI_MENU,
      },
      ella: {
        lines: () => [
          '¿Yo? Llegué buscando un libro. Uno solo. Todavía no lo he encontrado, pero por el camino me he quedado con todos los demás.',
          'Me gusta saber por qué pasan las cosas. Aquí abajo casi nunca hay respuesta, así que me conformo con hacer mejores preguntas.',
          'Y me gusta que vuelvas. Eso no lo apuntes.',
        ],
        options: ROMI_MENU,
      },
      teorias: {
        lines: (c) => ROMI_THEORIES.filter((t) => c.researched >= t.need).slice(-1)[0]?.lines ?? ['Todavía no tengo teorías. Solo preguntas bien ordenadas.'],
        options: ROMI_MENU,
      },
    },
  },
};

