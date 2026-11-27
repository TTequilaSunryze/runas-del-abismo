// El Salón de los Héroes: el Muro de los Recuerdos, el Libro de regresos y las Placas de los ausentes.
// No guarda nada propio: todo se lee de lo que el juego ya registra (estadísticas, Atlas, Crónicas, logros,
// Salón de héroes, investigaciones del Archivo y rumores de la Taberna). Nadie queda marcado como muerto.
import { CLASSES } from '../core/classes/classes';
import { IRENA_RUMORS, type TalkCtx } from '../content/dialogues';
import { ZONES } from '../content/zones';
import { CHRONICLES, atlasEntry, chronicleRef, chronicleState } from '../game/atlas';
import { ACHIEVEMENTS, meta, myNemesis } from '../game/meta';
import { allDossiers, investigated } from '../game/research';
import { esc, ui } from './ctx';

export type MemoryKind = 'hecho' | 'testimonio' | 'teoria' | 'rumor' | 'contradiccion';
export interface Memory { kind: MemoryKind; title: string; text: string; source: string }
export const KIND_NAME: Record<MemoryKind, string> = { hecho: 'Hecho confirmado', testimonio: 'Testimonio', teoria: 'Teoría', rumor: 'Rumor', contradiccion: 'Contradicción' };
const KIND_ICON: Record<MemoryKind, string> = { hecho: '▣', testimonio: '❝', teoria: '✦', rumor: '~', contradiccion: '⚠' };

/** Todo lo que hay grabado en el Muro, a partir de los datos reales del juego. */
export function memories(ctx: TalkCtx): Memory[] {
  const m = meta(), s = m.stats, out: Memory[] = [];
  const losses = Math.max(0, s.runs - s.wins);
  // hechos confirmados: lo que ve la Puerta y confirma más de una fuente
  ZONES.forEach((z, i) => {
    const e = atlasEntry(m, 'zones', `z${i + 1}`);
    if (e?.completions) out.push({ kind: 'hecho', title: `Cayó el guardián de ${z.name}`, text: `${e.completions === 1 ? 'Una vez' : `${e.completions} veces`}. Lo confirman el registro de la Puerta y quienes volvieron.`, source: 'Registro de la Puerta' });
  });
  if (s.wins) out.push({ kind: 'hecho', title: s.wins === 1 ? 'Una expedición llegó al final' : `${s.wins} expediciones llegaron al final`, text: 'Volvieron por la Puerta, con sus nombres y con sus recuerdos.', source: 'Registro de la Puerta' });
  for (const id of m.achievements) { const a = ACHIEVEMENTS.find((x) => x.id === id); if (a) out.push({ kind: 'hecho', title: a.name, text: a.text, source: 'Gestas' }); }
  // testimonios: lo que alguien jura
  if (losses) out.push({ kind: 'testimonio', title: losses === 1 ? 'Un regreso tras caer' : `${losses} regresos tras caer`, text: 'Cayeron ahí abajo y despertaron en el Asentamiento. Ninguno recuerda con claridad el final.', source: 'Libro de regresos' });
  for (const c of m.hall) out.push({ kind: 'testimonio', title: `${c.name} · ${CLASSES[c.cls]?.name ?? ''}`, text: c.won ? `Volvió por la Puerta (${c.date}). Dejó su equipo en el armero.` : `Cayó en el Abismo y regresó al Asentamiento (${c.date}). Recuerda la entrada; no la caída.`, source: 'Armero del Salón' });
  for (const ref of CHRONICLES.stories) {
    if (chronicleState(m, 'stories', ref.id) === 'locked' || ref.id.startsWith('clase_')) continue;
    out.push({ kind: 'testimonio', title: ref.name, text: ref.text, source: 'Crónicas' });
  }
  // teorías: lo que Romi ha investigado
  for (const d of allDossiers()) if (investigated(d.id)) out.push({ kind: 'teoria', title: d.name, text: d.finding, source: 'Archivo · Romi' });
  // rumores: los de la Taberna que ya circulan
  IRENA_RUMORS.filter((r) => r.need(ctx)).forEach((r) => out.push({ kind: 'rumor', title: 'Se cuenta en la Taberna', text: r.lines.join(' '), source: 'Irena' }));
  // contradicciones: cuando dos verdades no encajan
  if (losses) out.push({ kind: 'contradiccion', title: 'Salidas sin regreso', text: `El registro de Darel anota ${losses === 1 ? 'una salida' : `${losses} salidas`} sin regreso por la Puerta. Y sin embargo, quienes las hicieron siguen en el Asentamiento.`, source: 'Registro de la Puerta · Libro de regresos' });
  if (chronicleState(m, 'stories', 'eco_perdido') !== 'locked') out.push({ kind: 'contradiccion', title: 'La expedición perdida', text: 'Su runa habla de «nosotros», pero nadie en el Asentamiento recuerda haber bajado con ellos.', source: 'Crónicas' });
  return out;
}

/** Lo que sigue sin resolverse: ausencias, señales y lo que nadie ha vuelto para contar. */
function absences(): Array<{ title: string; text: string }> {
  const m = meta(), out: Array<{ title: string; text: string }> = [];
  const nem = myNemesis();
  if (nem) out.push({ title: `${nem.name}, visto ahí abajo`, text: 'Otros grupos dicen haberse cruzado con alguien con su cara, luchando contra ellos. Aquí sigue su placa. No sabemos cuál de los dos es el verdadero.' });
  const known = ZONES.filter((_, i) => !!atlasEntry(m, 'zones', `z${i + 1}`)).length;
  if (known < ZONES.length) out.push({ title: 'Más allá de lo conocido', text: known ? `Más allá de ${known === 1 ? 'la región conocida' : `las ${known} regiones conocidas`}, nadie de este Asentamiento ha vuelto para contarlo.` : 'Nadie de este Asentamiento ha vuelto todavía de ninguna región.' });
  const secrets = CHRONICLES.secrets.filter((c) => chronicleState(m, 'secrets', c.id) === 'locked').length;
  if (secrets) out.push({ title: `${secrets === 1 ? 'Un suceso' : `${secrets} sucesos`} sin explicar`, text: 'Hay huecos en el muro reservados para ellos. Todavía no sabemos qué grabar.' });
  if (chronicleState(m, 'stories', 'eco_perdido') === 'locked' && m.stats.runs >= 3) out.push({ title: 'Los que bajaron antes', text: 'Se habla de un grupo anterior a todos. Nadie sabe quiénes eran ni si volvieron. La placa está en blanco.' });
  const lost = chronicleRef('stories', 'eco_perdido');
  if (lost && chronicleState(m, 'stories', 'eco_perdido') !== 'locked') out.push({ title: lost.name, text: 'Sus nombres siguen sin aparecer. Su runa, en cambio, sí.' });
  return out;
}

function muro(ctx: TalkCtx): string {
  const all = memories(ctx), kinds = Object.keys(KIND_NAME) as MemoryKind[];
  const f = ui.wallKind as MemoryKind | '', list = f ? all.filter((x) => x.kind === f) : all;
  return `<div class="dtabs">${[['', `Todo (${all.length})`] as const, ...kinds.map((k) => [k, `${KIND_ICON[k]} ${KIND_NAME[k]} (${all.filter((x) => x.kind === k).length})`] as const)].map(([k, n]) => `<button class="raw dtab ${f === k ? 'on' : ''}" data-act="wallkind" data-id="${k}">${n}</button>`).join('')}</div>
    <div class="mwall">${list.length ? list.map((x) => `<div class="mplaque k-${x.kind}"><span class="mkind">${KIND_ICON[x.kind]} ${KIND_NAME[x.kind]}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p><small>${esc(x.source)}</small></div>`).join('') : '<div class="dim">Nada grabado todavía. El muro espera.</div>'}</div>
    <p class="dnote">«Guardo lo que sabemos, y cómo lo sabemos. No es lo mismo.» <span>— El Custodio</span></p>`;
}

function libro(): string {
  const m = meta(), s = m.stats, losses = Math.max(0, s.runs - s.wins);
  const fallen = m.hall.filter((c) => !c.won).slice(-8).reverse();
  const lost = chronicleRef('stories', 'final_derrota');
  return `<div class="dstats"><span><b>${s.runs}</b>salidas</span><span><b>${s.wins}</b>regresos por la Puerta</span><span><b>${losses}</b>regresos tras caer</span><span><b>${m.hall.length}</b>nombres guardados</span></div>
    <div class="dsec"><h4>Recuerdos incompletos</h4>${fallen.length ? fallen.map((c) => `<div class="dline"><b>${esc(c.name)} · ${esc(CLASSES[c.cls]?.name ?? '')}</b><span>${esc(c.date)} · cayó y volvió. Recuerda la entrada; no la caída.</span></div>`).join('') : '<div class="dim sm">Ningún nombre guardado ha vuelto así.</div>'}</div>
    ${lost && chronicleState(m, 'stories', 'final_derrota') !== 'locked' ? `<div class="dsec"><h4>${esc(lost.name)}</h4><p>${esc(lost.text)}</p></div>` : ''}
    <p class="dnote">«No escribo cómo volvéis. Escribo que volvéis.» <span>— El Custodio</span></p>`;
}

function placas(): string {
  const list = absences();
  return `<div class="dsec">${list.length ? list.map((x) => `<div class="dline"><b>${esc(x.title)}</b><span>${esc(x.text)}</span></div>`).join('') : '<div class="dim sm">No hay ausencias que lamentar. Por ahora.</div>'}</div>
    <p class="dnote">«Una placa en blanco no es un olvido. Es una pregunta.» <span>— El Custodio</span></p>`;
}

const VIEWS: Record<string, { icon: string; title: string; sub: string; body: (ctx: TalkCtx) => string }> = {
  muro: { icon: '🧱', title: 'Muro de los Recuerdos', sub: 'Expediciones, regresos, ausencias y lo que aún no encaja', body: muro },
  libro: { icon: '📖', title: 'Libro de regresos', sub: 'Quienes cayeron y volvieron, y lo que no recuerdan', body: libro },
  placas: { icon: '🕯️', title: 'Placas de los ausentes', sub: 'Lo que sigue sin resolverse', body: placas },
};
export const isHallView = (id: string): boolean => id in VIEWS;

export function hallView(ctx: TalkCtx): string {
  const v = VIEWS[ui.inspect];
  if (!v) return '';
  return `<div class="fover"><div class="dossier inspect ${ui.inspect === 'muro' ? 'wall' : ''}">
    <div class="dtop"><div><span class="hero-kicker">SALÓN DE LOS HÉROES · EL CUSTODIO</span><h2>${v.icon} ${v.title}</h2><p class="dim sm">${v.sub}</p></div><span class="grow"></span><button data-act="inspectclose">Cerrar</button></div>
    <div class="dsheet wide">${v.body(ctx)}</div>
  </div></div>`;
}
