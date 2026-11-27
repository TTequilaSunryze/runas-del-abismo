// Investigaciones del Archivo (Romi). Dos interacciones:
// - Examinar: ficha con lo que ya sabes del objeto (se abre en cuanto tienes alguna pista).
// - Investigar: se desbloquea al reunir todas las evidencias; revela información nueva y queda guardada.
// Las evidencias se calculan con datos reales de tu Archivo (Grimorio, Bestiario, Atlas, reliquias).
import type { ClassId } from '../core/state';
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import { RELICS } from '../content/relics';
import { ZONES } from '../content/zones';
import { CLASS_STORY, ZONE_STORY } from '../content/story';
import { BESTIARY, GRIMOIRE, LV, levelFor } from './archive';
import { ATLAS, atlasEntry } from './atlas';
import { masteryOf, meta, saveMeta } from './meta';

export type DossierKind = 'runas' | 'regiones' | 'objetos';

export interface Evidence { text: string; have: number; need: number }
export interface Dossier {
  id: string;
  kind: DossierKind;
  icon: string;
  name: string;
  /** ¿hay alguna pista? (si no, la ficha aparece sellada) */
  known: boolean;
  /** lo que se ve al examinar */
  examine: Array<[string, string]>;
  evidence: Evidence[];
  /** lo que revela la investigación */
  finding: string;
  /** comentario de Romi al terminar */
  note: string;
}

const done = (): string[] => (meta().research ??= []);
export const investigated = (id: string): boolean => done().includes(id);
export const ready = (d: Dossier): boolean => d.evidence.every((e) => e.have >= e.need);

// ---------- familias rúnicas: cada clase jugable es una tradición rúnica ----------
const FAMILY: Record<string, { name: string; icon: string; origin: string; finding: string; note: string }> = {
  zorro: { name: 'Runas de las nueve colas', icon: '🦊', origin: 'Llegaron con los primeros espíritus zorro que bajaron por curiosidad. Se trazan en el aire, nunca en piedra.', finding: 'Las runas zorrunas no engañan a los ojos, sino a la memoria: quien las ve recuerda algo que no ha pasado. Por eso las ilusiones duran tanto como un recuerdo.', note: 'Lo he leído tres veces y cada vez me parecía un párrafo distinto. Sospecho de las colas.' },
  esferas: { name: 'Runas orbitales', icon: '🔮', origin: 'Halladas grabadas en esferas de cristal flotantes, en las salas más hondas, girando sin que nada las empuje.', finding: 'Las runas orbitales no se escriben: se colocan. Su poder depende de la distancia entre ellas, como estrellas de un cielo que nadie ha visto.', note: 'He dejado de intentar dibujarlas en papel. Necesitan aire alrededor.' },
  acechador: { name: 'Runas de umbra', icon: '🌑', origin: 'Catacumbas y Abismo. Solo se leen con poca luz; a plena luz parecen piedra lisa.', finding: 'La umbra no es oscuridad, es ausencia. Cada runa marca un hueco donde antes hubo algo, y ese hueco quiere llenarse.', note: 'Escribo estas notas con la lámpara encendida. No me preguntes por qué.' },
  carcelero: { name: 'Runas de alma', icon: '🏮', origin: 'Grabadas por dentro de linternas antiguas. Las encontraron los primeros carceleros, que no sabían que las llevaban.', finding: 'Las runas de alma no atrapan a nadie: ofrecen refugio. Lo que entra en la linterna elige quedarse, al menos al principio.', note: 'No sé si eso me tranquiliza o me inquieta más.' },
  barbaro: { name: 'Runas de sangre', icon: '🩸', origin: 'Se marcan sobre la piel, no sobre la piedra. Las trajeron los clanes de las montañas cuando el Abismo se abrió bajo sus tierras.', finding: 'La runa de sangre no da fuerza: quita el miedo. La furia es solo lo que queda cuando el miedo se va.', note: 'Me pregunto qué quedaría de mí sin miedo. Probablemente un montón de libros sin ordenar.' },
  arquitecto: { name: 'Runas de piedra', icon: '🧱', origin: 'Las más antiguas del Archivo. Están en los cimientos de cada sala del Abismo, como si alguien lo hubiera construido.', finding: 'El Abismo no es una cueva: es una obra. Las runas de piedra son los planos, y siguen dando órdenes a muros que ya nadie vigila.', note: 'Si es una obra, alguien la encargó. Esa pregunta me quita el sueño.' },
  pistolero: { name: 'Runas de pólvora', icon: '🔫', origin: 'Recientes. Un herrero del Asentamiento las grabó en un cañón por error, y el error funcionó.', finding: 'Las runas de pólvora son las únicas inventadas aquí arriba. Demuestran que se pueden escribir runas nuevas, y eso lo cambia todo.', note: 'He pedido que nadie más lo intente sin avisarme. Nadie me ha hecho caso.' },
  arquero: { name: 'Runas de viento', icon: '🏹', origin: 'Talladas en flechas encontradas clavadas en lo alto de las grietas, donde nadie pudo dispararlas.', finding: 'La runa de viento no guía la flecha: le recuerda el camino de vuelta. Por eso nunca se pierden, aunque a veces vuelvan tarde.', note: 'Me gustaría que funcionara igual con las personas.' },
};

function familyDossier(cls: ClassId): Dossier {
  const def = FAMILY[cls] ?? { name: `Runas de ${CLASSES[cls].name}`, icon: '✦', origin: CLASS_STORY[cls] ?? '', finding: 'Su origen sigue sin aclarar.', note: '' };
  const spells = GRIMOIRE.filter((g) => g.kind === 'spell' && g.cls === cls);
  const known = spells.filter((g) => levelFor('grimoire', g.id) >= LV.found).length;
  const used = spells.filter((g) => levelFor('grimoire', g.id) >= LV.studied).length;
  const lv = masteryOf(cls);
  return {
    id: `runa_${cls}`, kind: 'runas', icon: def.icon, name: def.name, known: known > 0 || lv > 0,
    examine: [
      ['Familia rúnica', `${def.name} · tradición de ${CLASSES[cls].name}`],
      ['Procedencia', def.origin],
      ['Observaciones registradas', `${known}/${spells.length} hechizos conocidos · ${used} usados en combate · maestría ${lv}/5`],
    ],
    evidence: [
      { text: 'Hechizos de la tradición en tu Grimorio', have: known, need: Math.min(4, spells.length) },
      { text: 'Hechizos de la tradición lanzados en combate', have: used, need: Math.min(2, spells.length) },
      { text: `Maestría de ${CLASSES[cls].name}`, have: lv, need: 1 },
    ],
    finding: def.finding, note: def.note,
  };
}

// ---------- regiones (zonas del Atlas) ----------
const REGION_FINDING = [
  'Las Catacumbas no fueron construidas para enterrar a nadie. Los nichos están demasiado ordenados: alguien los preparó para que los muertos siguieran trabajando.',
  'El Bosque Corrompido no se pudre: se transforma. La savia negra sigue una dirección, siempre hacia abajo, como si algo la llamara desde el fondo.',
  'El reino de las Ruinas de Ceniza no cayó en una guerra. Los registros quemados hablan de una sola noche, y de una corona que nadie quiso soltar.',
  'El Abismo no es un lugar, es una boca. Todo lo que hemos encontrado ahí abajo apunta a lo mismo: las runas salieron de aquí, y algo quiere recuperarlas.',
];
const REGION_NOTE = [
  'Darel dice que a veces oye picar piedra desde la entrada. Ahora entiendo por qué.',
  'Le pedí a Irena que no use leña de ese bosque. Me miró como si ya lo supiera.',
  'He guardado este informe en el cajón de abajo. Hay cosas que no conviene leer en voz alta.',
  'No sé si debería seguir escribiendo esto. Pero si no lo escribo yo, ¿quién?',
];
function regionDossier(i: number): Dossier {
  const z = ZONES[i]!, m = meta();
  const rec = atlasEntry(m, 'zones', `z${i + 1}`);
  const events = ATLAS.events.filter((e) => e.zone === i + 1), evFound = events.filter((e) => !!atlasEntry(m, 'events', e.id)).length;
  const beasts = BESTIARY.filter((b) => b.zone === i + 1), bFound = beasts.filter((b) => levelFor('bestiary', b.id) >= LV.found).length;
  return {
    id: `region_${i + 1}`, kind: 'regiones', icon: ['🦴', '🌲', '🔥', '🕳️'][i] ?? '🗺️', name: z.name, known: !!rec,
    examine: [
      ['Región', `Zona ${i + 1} · ${z.name}`],
      ['Descripción', ZONE_STORY[i] ?? z.intro],
      ['Registro', rec ? `${rec.encounters} visita${rec.encounters === 1 ? '' : 's'} · ${rec.completions} guardián${rec.completions === 1 ? '' : 'es'} derrotado${rec.completions === 1 ? '' : 's'}` : 'Sin visitas'],
      ['Lugares y acontecimientos', `${evFound}/${events.length} sucesos documentados · ${bFound}/${beasts.length} criaturas vistas`],
    ],
    evidence: [
      { text: 'Guardián de la región derrotado', have: rec?.completions ?? 0, need: 1 },
      { text: 'Sucesos de la región documentados', have: evFound, need: Math.max(1, Math.ceil(events.length * 0.4)) },
      { text: 'Criaturas de la región vistas', have: bFound, need: Math.max(1, Math.ceil(beasts.length * 0.5)) },
    ],
    finding: REGION_FINDING[i] ?? '', note: REGION_NOTE[i] ?? '',
  };
}

// ---------- objetos recuperados (reliquias) ----------
const RELIC_ORIGIN: Record<string, string> = {
  colmillo: 'Del lobo que guardaba la primera entrada. Nadie sabe quién lo domesticó, solo que defendía la puerta incluso muerto.',
  corazon: 'Arrancado a un gólem de las Catacumbas. Aún late una vez al día, a la misma hora.',
  caparazon: 'De una tortuga de cripta que vivió siglos bajo el agua estancada. Las marcas de la concha son runas de hierro desgastadas.',
  pluma: 'Los grifos anidaban en las torres de las Ruinas antes del incendio. Esta pluma no arde.',
  reloj: 'Perteneció a un archivero anterior. Paró sus agujas el día que bajó y nunca volvió a ponerlas.',
  trebol: 'Creció en una grieta del Bosque Corrompido, el único verde en kilómetros. Nadie se explica cómo.',
  cristal: 'Se forma donde la escarcha rúnica lleva demasiado tiempo quieta. Dentro, a veces, se ve un instante congelado.',
  viento: 'De un mensajero que corrió desde el fondo para avisar a los de arriba. Llegó él solo; las botas, también.',
  fe: 'Una medalla de los santuarios caídos. Su inscripción está borrada a propósito, con cuidado, por la misma mano que la grabó.',
  dragon: 'No hay dragones en el Abismo. Eso dicen los registros. El frasco, sin embargo, sigue caliente.',
  tuerto: 'De un vigía que juró ver el fondo del Abismo con un solo ojo. Se quedó con el otro cerrado para siempre.',
  ascua: 'Recogida en las Ruinas de Ceniza. Lleva encendida desde la noche del incendio y no consume nada.',
  vibora: 'Las víboras del Bosque producen veneno rúnico. Esta glándula aún contiene una runa de savia sin terminar.',
  hacha: 'El filo del verdugo de las Ruinas. Se dice que nunca falló, y que eso fue lo que más le pesó.',
  caliz: 'Del santuario mayor. Quien bebe de él recuerda por un momento a alguien que no conoció.',
  erizo: 'Piel de una criatura del Bosque que se defendía devolviendo cada golpe. Sigue haciéndolo.',
  raiz: 'Una raíz que se niega a morir. La plantamos en el patio y tuvimos que arrancarla antes de que llegara al pozo.',
  muralla: 'Una piedra de la primera muralla del Asentamiento. Alguien la llevó ahí abajo para no olvidar a dónde volver.',
  furia: 'De un bárbaro que nunca se rindió. La máscara no representa su cara: representa lo que veían sus enemigos.',
  bolsa: 'De un mercader que bajó a vender y nunca subió. La bolsa sigue sumando monedas que nadie recuerda haber puesto.',
  lupa: 'La usaba el tasador del Asentamiento para distinguir runas falsas. Dice que las verdaderas le devolvían la mirada.',
  dado: 'Lo encontramos junto a un esqueleto que aún sonreía. Las caras no suman lo que deberían.',
};
function relicDossier(id: string): Dossier {
  const r = RELICS[id]!;
  const e = meta().archive?.relics[id];
  return {
    id: `objeto_${id}`, kind: 'objetos', icon: r.icon, name: r.name, known: !!e && e.lv > 0,
    examine: [
      ['Objeto', `${r.icon} ${r.name}${(r as { rare?: boolean }).rare ? ' · raro' : ''}`],
      ['Efecto observado', r.text],
      ['Veces recuperado', `${e?.seen ?? 0}`],
    ],
    evidence: [{ text: 'Veces que lo has recuperado en una expedición', have: e?.seen ?? 0, need: 2 }],
    finding: RELIC_ORIGIN[id] ?? 'Su origen sigue sin aclarar.', note: 'Lo he anotado con letra pequeña. Las historias grandes no caben en los márgenes.',
  };
}

export const DOSSIER_KINDS: Record<DossierKind, { title: string; intro: string }> = {
  runas: { title: 'Familias rúnicas', intro: 'Cada héroe pertenece a una tradición rúnica. Su ficha recoge la procedencia, lo que has observado usando sus hechizos y lo que aún falta por entender.' },
  regiones: { title: 'Regiones y lugares', intro: 'Las zonas del Abismo que has pisado, con los sucesos y criaturas que has documentado en cada una.' },
  objetos: { title: 'Objetos recuperados', intro: 'Reliquias traídas de las expediciones. Examínalas; cuando las hayas recuperado varias veces, investiga su origen.' },
};

export function dossiers(kind: DossierKind): Dossier[] {
  if (kind === 'runas') return PLAYABLE.map(familyDossier);
  if (kind === 'regiones') return ZONES.map((_, i) => regionDossier(i));
  return Object.keys(RELICS).map(relicDossier);
}
export const allDossiers = (): Dossier[] => (['runas', 'regiones', 'objetos'] as DossierKind[]).flatMap(dossiers);

/** Investiga un expediente si están todas las evidencias. Devuelve true si se ha desbloqueado ahora. */
export function investigate(id: string): boolean {
  const d = allDossiers().find((x) => x.id === id);
  if (!d || investigated(id) || !ready(d)) return false;
  done().push(id);
  saveMeta();
  return true;
}
