// La Puerta del Refugio: ventanas de inspección del puesto de vigilancia (Darel).
// Todo sale de lo que el juego ya guarda: estadísticas, Atlas, Salón de héroes, contratos, ascensión y logros.
import { CLASSES } from '../core/classes/classes';
import { ASCENSION, DAILY_MODS, OMENS } from '../content/modes';
import { ZONES } from '../content/zones';
import { ZONE_STORY } from '../content/story';
import { ATLAS, atlasEntry } from '../game/atlas';
import { activeContracts } from '../game/contracts';
import { ACHIEVEMENTS, meta } from '../game/meta';
import { dailyOf } from '../game/run';
import { esc, today, ui } from './ctx';

export type InspectId = 'registro' | 'catalejo' | 'campana' | 'tablero';

/** Nombre de la zona más honda alcanzada (stats.bestZone: 1-4 zonas, 5 = fondo del Abismo). */
export function deepestName(best: number): string {
  if (best >= 5) return 'el fondo del Abismo';
  return best >= 1 ? ZONES[best - 1]?.name ?? '' : '';
}
/** Zonas del Atlas ya descubiertas (las únicas que Darel distingue desde la torre). */
export const seenZones = (): number[] => ZONES.map((_, i) => i).filter((i) => !!atlasEntry(meta(), 'zones', `z${i + 1}`));

function registro(): string {
  const m = meta(), s = m.stats, losses = Math.max(0, s.runs - s.wins);
  const zones = seenZones();
  const hall = [...m.hall].slice(-8).reverse();
  return `<div class="dstats"><span><b>${s.runs}</b>salidas</span><span><b>${s.wins}</b>regresos por la Puerta</span><span><b>${losses}</b>sin regreso anotado</span><span><b>${s.bosses}</b>guardianes caídos</span><span><b>${s.kills}</b>criaturas abatidas</span><span class="txt"><b>${esc(deepestName(s.bestZone) || '—')}</b>mayor profundidad</span></div>
    <div class="dsec"><h4>Por región</h4>${zones.length ? zones.map((i) => { const e = atlasEntry(m, 'zones', `z${i + 1}`)!; return `<div class="dline"><b>${esc(ZONES[i]!.name)}</b><span>${e.encounters} visita${e.encounters === 1 ? '' : 's'} · ${e.completions} guardián${e.completions === 1 ? '' : 'es'} derrotado${e.completions === 1 ? '' : 's'}</span></div>`; }).join('') : '<div class="dim sm">Aún no hay regiones anotadas.</div>'}</div>
    <div class="dsec"><h4>Nombres anotados</h4>${hall.length ? hall.map((c) => `<div class="dline"><b>${esc(c.name)} · ${esc(CLASSES[c.cls]?.name ?? '')}</b><span>${esc(c.date)} · ${c.won ? 'volvió por la Puerta' : 'no volvió por la Puerta'}${c.asc ? ` · ascensión ${c.asc}` : ''}</span></div>`).join('') : '<div class="dim sm">Ningún héroe guardado en el Salón todavía.</div>'}</div>
    <p class="dnote">«Apunto lo que veo en la Puerta. Lo que pasa ahí abajo lo cuentan otros.» <span>— Darel</span></p>`;
}

function catalejo(): string {
  const m = meta();
  return `<div class="dsec"><h4>Territorio exterior</h4>${ZONES.map((z, i) => {
    const e = atlasEntry(m, 'zones', `z${i + 1}`);
    if (!e) return `<div class="dline"><b>Niebla</b><span>Nada que distinguir desde aquí.</span></div>`;
    const state = e.state === 'mastered' ? 'dominada' : e.state === 'explored' ? 'explorada' : 'avistada';
    return `<div class="dline"><b>${esc(z.name)} <span class="dim">· ${state}</span></b><span>${esc(ZONE_STORY[i] ?? z.intro)}</span></div>`;
  }).join('')}</div>
    <p class="dnote">«La lente no miente, pero tampoco lo cuenta todo.» <span>— Darel</span></p>`;
}

function campana(): string {
  const m = meta(), losses = Math.max(0, m.stats.runs - m.stats.wins);
  const omens = ATLAS.omens.filter((o) => !!atlasEntry(m, 'omens', o.id));
  const unknown = OMENS.length - omens.length;
  const asc = ASCENSION.slice(1, m.maxAsc + 1);
  return `<div class="dstats"><span><b>${losses}</b>toques por ti</span><span><b>${omens.length}</b>presagios identificados</span><span><b>${m.maxAsc}</b>nivel de amenaza</span></div>
    <div class="dsec"><h4>Advertencias registradas</h4>${asc.length ? asc.map((t, i) => `<div class="dline"><b>Amenaza ${i + 1}</b><span>${esc(t)}</span></div>`).join('') : '<div class="dim sm">Ninguna. Vence una expedición para que el Abismo empiece a responder.</div>'}</div>
    <div class="dsec"><h4>Presagios</h4>${omens.length ? omens.map((o) => `<div class="dline"><b>${o.icon} ${esc(o.name)}</b><span>${esc(o.text)}</span></div>`).join('') : '<div class="dim sm">Nadie ha descrito todavía ningún presagio.</div>'}${unknown > 0 && omens.length ? `<div class="dim sm">${unknown} señal${unknown === 1 ? '' : 'es'} sin identificar.</div>` : ''}</div>
    <p class="dnote">«Tres toques: algo sube. Dos: alguien no vuelve. Uno solo… alguien vuelve distinto.» <span>— Darel</span></p>`;
}

function tablero(): string {
  const m = meta();
  const cs = activeContracts(m);
  const d = dailyOf(today());
  const news = m.achievements.slice(-5).reverse().map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  return `<div class="dsec"><h4>Avisos · contratos</h4>${cs.length ? cs.map((c) => `<div class="devi ${c.completed ? 'ok' : ''}"><span>${c.completed ? '✔' : '○'} <b>${esc(c.title)}</b> · ${esc(c.description)} <i class="dim">(${c.category === 'daily' ? 'diario' : 'semanal'})</i></span><b>${Math.min(c.progress, c.requiredCount)}/${c.requiredCount}</b><i style="width:${(Math.min(c.progress, c.requiredCount) / c.requiredCount) * 100}%"></i></div>`).join('') : '<div class="dim sm">No hay avisos clavados.</div>'}</div>
    <div class="dsec"><h4>Reto del día · ${today()}</h4><div class="dline"><span>${d.mods.map((id) => esc(DAILY_MODS.find((x) => x.id === id)?.name ?? id)).join(' · ')}</span></div></div>
    <div class="dsec"><h4>Noticias</h4>${news.length ? news.map((a) => `<div class="dline"><b>${esc(a.name)}</b><span>${esc(a.text)}</span></div>`).join('') : '<div class="dim sm">Nada nuevo que contar.</div>'}</div>`;
}

const VIEWS: Record<InspectId, { icon: string; title: string; sub: string; body: () => string }> = {
  registro: { icon: '📜', title: 'Registro de salidas', sub: 'Quién cruza la Puerta y quién vuelve', body: registro },
  catalejo: { icon: '🔭', title: 'Catalejo', sub: 'El territorio exterior que ya conoces', body: catalejo },
  campana: { icon: '🔔', title: 'Campana de alarma', sub: 'Alertas y advertencias registradas', body: campana },
  tablero: { icon: '📌', title: 'Tablero de avisos', sub: 'Avisos y noticias del Refugio', body: tablero },
};

export function inspectView(): string {
  const v = VIEWS[ui.inspect as InspectId];
  if (!v) return '';
  return `<div class="fover"><div class="dossier inspect">
    <div class="dtop"><div><span class="hero-kicker">LA PUERTA DEL REFUGIO · DAREL</span><h2>${v.icon} ${v.title}</h2><p class="dim sm">${v.sub}</p></div><span class="grow"></span><button data-act="inspectclose">Cerrar</button></div>
    <div class="dsheet wide">${v.body()}</div>
  </div></div>`;
}
