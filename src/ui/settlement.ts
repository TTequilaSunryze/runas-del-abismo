// El Asentamiento: panorama vivo con edificios clicables, interiores (Taberna, Archivo)
// con sus habitantes y conversaciones, y las fichas de investigación del Archivo.
import { CLASSES } from '../core/classes/classes';
import { NPCS, type TalkCtx } from '../content/dialogues';
import { archiveTotal } from '../game/archive';
import { meta } from '../game/meta';
import { DOSSIER_KINDS, allDossiers, dossiers, investigated, ready, type Dossier, type DossierKind } from '../game/research';
import { CHRONICLES, CHRONICLE_NAME, chronicleState } from '../game/atlas';
import type { MenuScene } from '../render/menubg';
import { esc, tip, ui } from './ctx';
import { volumeControl } from './panels';
import { metaPanel } from './screens';

const BASE = (): string => import.meta.env.BASE_URL;
/** Ruta absoluta (las variables CSS con url() se resolverían respecto a la hoja de estilos). */
const abs = (p: string): string => new URL(BASE() + p, document.baseURI).href;

/** Lugares del panorama (coordenadas de bg/asentamiento.jpg, 1376×768). */
interface Spot { id: string; name: string; poly: string; at: [number, number]; act?: string; arg?: string; locked?: boolean; hint?: string }
const SPOTS: Spot[] = [
  { id: 'taberna', name: 'Taberna', poly: '295,395 355,322 445,328 505,398 562,420 562,565 330,585 200,565 212,402', at: [380, 322], act: 'place', arg: 'taberna', hint: 'Irena y las noticias de quienes vuelven' },
  { id: 'archivo', name: 'Archivo', poly: '495,240 520,192 722,192 742,250 742,332 500,342', at: [620, 194], act: 'place', arg: 'archivo', hint: 'Romi y las investigaciones del Abismo' },
  { id: 'mercader', name: 'Mercader de ecos', poly: '0,418 70,398 155,438 162,600 0,612', at: [86, 402], act: 'htab', arg: 'tienda', hint: 'Habilidades y aspectos' },
  { id: 'memorial', name: 'Memorial de los héroes', poly: '600,125 640,60 760,40 885,88 905,205 625,205', at: [752, 96], act: 'htab', arg: 'salon', hint: 'Tus campeones guardados y los duelos' },
  { id: 'barracones', name: 'Barracones', poly: '0,0 232,0 252,62 205,135 0,142', at: [116, 100], act: 'htab', arg: 'clases', hint: 'Maestría de cada clase' },
  { id: 'atalaya', name: 'Atalaya', poly: '905,40 960,5 1000,40 1000,180 990,270 905,270', at: [952, 112], act: 'htab', arg: 'logros', hint: 'Logros y estadísticas' },
  { id: 'palomar', name: 'Palomar', poly: '430,0 625,0 625,150 600,205 470,205 430,120', at: [528, 110], act: 'htab', arg: 'amigos', hint: 'Amigos e invitaciones' },
  { id: 'tablon', name: 'Tablón del reto', poly: '725,285 820,262 905,300 905,470 760,480 720,420', at: [815, 266], act: 'htab', arg: 'diario', hint: 'Clasificación del reto del día' },
  { id: 'puerta', name: 'La Puerta del Abismo', poly: '1008,200 1100,140 1165,250 1140,500 1172,700 1000,745 1030,450', at: [1088, 150], act: 'gate', hint: 'Comenzar la expedición' },
  { id: 'forja', name: 'La Forja', poly: '395,600 500,530 560,535 605,598 670,598 705,640 705,768 395,768', at: [550, 534], locked: true },
  { id: 'santuario', name: 'El Santuario', poly: '80,250 100,165 170,138 262,168 300,228 300,372 90,382', at: [190, 142], locked: true },
  { id: 'guardia', name: 'Puesto de guardia', poly: '1255,320 1376,290 1376,560 1265,560', at: [1316, 330], locked: true },
];

/** Escena animada de fondo (menubg) según dónde esté el jugador dentro de la sala. */
export function lobbyScene(): MenuScene {
  if (ui.lobbyStage !== 'settlement') return 'home';
  return ui.place ? PLACES[ui.place].scene : 'settle';
}

/** Acción de la Puerta: el anfitrión desciende; los demás avisan de que están listos. */
function gateAct(): { act: string; disabled: boolean; label: string; sub: string } {
  const s = ui.session!, players = s.lobby();
  const ready = players.slice(0, 4).filter((p) => p.routes.length > 0 && (p.host || p.ready));
  const total = Math.min(4, players.length);
  if (s.isHost) return { act: 'start', disabled: !ready.length, label: 'Descender al Abismo', sub: total > 1 ? `Listos ${ready.length}/${total}` : '' };
  return { act: 'lready', disabled: false, label: ui.lobbyReady ? '✔ Listo (deshacer)' : 'Estoy listo', sub: 'El anfitrión abre la Puerta' };
}

function hud(title: string, kicker: string, back: string, backTip: string): string {
  const s = ui.session!, m = meta();
  return `<header class="shud"><button class="raw fback" data-act="${back}" ${tip(backTip)}>↩</button>
    <div class="shud-title"><span class="hero-kicker">${kicker}</span><h1>${title}</h1></div><span class="grow"></span>
    ${ui.notice ? `<span class="bad sm">${esc(ui.notice)}</span>` : ''}
    ${s.isHost && ui.saved ? `<button data-act="doresume">Reanudar guardada (zona ${ui.saved.zone + 1}, sala ${ui.saved.step + 1})</button>` : ''}
    ${s.t.kind === 'online' ? `<span class="pill">Sala ${esc(s.code)} · ${s.lobby().length}/4</span>` : ''}
    <span class="pill">${m.ecos} ✨</span>${volumeControl()}<button data-act="home">Salir</button></header>`;
}

/** Caja que reproduce el encuadre «cover» del fondo: lo que se coloca dentro en % cae sobre la imagen. */
const coverBox = (ar: number, inner: string, cls: string): string => `<div class="stscene ${cls}" style="--ar:${ar}">${inner}</div>`;

function panorama(): string {
  const s = ui.session!;
  const g = gateAct();
  const lbl = (p: Spot): string => `<div class="slbl ${p.locked ? 'locked' : ''}" data-lbl="${p.id}" style="left:${(p.at[0] / 1376) * 100}%;top:${(p.at[1] / 768) * 100}%;--tx:${p.at[0] < 170 ? '-12%' : p.at[0] > 1200 ? '-88%' : '-50%'}"><b>${p.locked ? '🔒 ' : ''}${esc(p.name)}</b><small>${p.locked ? 'Próximamente' : esc(p.hint ?? '')}</small></div>`;
  const spot = (p: Spot): string => {
    const act = p.locked ? '' : p.act === 'gate' ? (g.disabled ? '' : `data-act="${g.act}"`) : `data-act="${p.act}" data-id="${p.arg}"`;
    return `<polygon class="spot ${p.locked ? 'locked' : ''} ${p.id === 'puerta' ? 'abyss' : ''}" data-spot="${p.id}" points="${p.poly}" ${act}><title>${esc(p.name)}</title></polygon>`;
  };
  const hover = SPOTS.map((p) => `.stscene:has([data-spot="${p.id}"]:hover) [data-lbl="${p.id}"]`).join(',');
  const hoverLit = SPOTS.map((p) => `.stscene:has([data-spot="${p.id}"]:hover) [data-lit="${p.id}"]`).join(',');
  // luz: aclara la imagen de fondo justo dentro del contorno del edificio
  const lit = (p: Spot): string => `<div class="spotlit ${p.locked ? 'locked' : ''} ${p.id === 'puerta' ? 'abyss' : ''}" data-lit="${p.id}" style="background-image:url(${abs('bg/asentamiento.jpg')});clip-path:polygon(${p.poly.split(' ').map((xy) => { const [x, y] = xy.split(',').map(Number); return `${((x! / 1376) * 100).toFixed(2)}% ${((y! / 768) * 100).toFixed(2)}%`; }).join(',')})"></div>`;
  return `${coverBox(1376 / 768, `${SPOTS.map(lit).join('')}<svg class="spots" viewBox="0 0 1376 768" preserveAspectRatio="none">${SPOTS.map(spot).join('')}</svg>${SPOTS.map(lbl).join('')}`, 'settle-scene')}
    <style>${hover}{opacity:1;transform:translate(var(--tx,-50%),-4px)}${hoverLit}{opacity:1}</style>
    ${hud('El Asentamiento', `${esc(CLASSES[ui.me.cls].name)} · ${s.t.kind === 'local' ? 'un jugador' : `sala ${esc(s.code)}`}${ui.daily ? ' · reto del día' : ui.asc ? ` · ascensión ${ui.asc}` : ''}`, 'herochange', 'Cambiar de héroe')}
    <div class="sgate"><span class="dim sm shint">Pasa el ratón por los edificios · haz clic para entrar</span>
      <button class="pri sgate-btn" data-act="${g.act}" ${g.disabled ? 'disabled' : ''}>${g.label}${g.sub ? `<small>${g.sub}</small>` : ''}</button></div>
    <nav class="slist">${SPOTS.filter((p) => !p.locked && p.act !== 'gate').map((p) => `<button class="mini" data-act="${p.act}" data-id="${p.arg}">${esc(p.name)}</button>`).join('')}</nav>`;
}

/** Habitante dentro de un lugar: caja en % de la imagen y tiras de 4 fotogramas (reposo y saludo). */
interface PlaceNpc { id: string; box: [number, number, number, number]; inner: number; idle: string; wave: string; lbl: [number, number] }
/** Objeto clicable dentro de un lugar (coordenadas en píxeles de la imagen de referencia). */
interface PlaceSpot { id: string; name: string; hint: string; poly: string; at: [number, number]; act: string; arg: string }
interface PlaceDef { title: string; scene: MenuScene; bg: string; w: number; h: number; npcs: PlaceNpc[]; spots: PlaceSpot[] }
const PLACES: Record<'taberna' | 'archivo', PlaceDef> = {
  // Irena tras la barra, entre las jarras y el mortero: solo se ve por encima del mostrador
  taberna: { title: 'La Taberna', scene: 'tavern', bg: 'bg/taberna.jpg', w: 2576, h: 1438, spots: [],
    npcs: [{ id: 'irena', box: [43.48, 46.70, 12.42, 12.55], inner: 212.7, idle: 'npc/irena_wipe.png', wave: 'npc/irena_wave.png', lbl: [49.7, 38.5] }] },
  // Romi de pie junto a la mesa, leyendo
  archivo: { title: 'El Archivo', scene: 'archive', bg: 'bg/archivo.jpg', w: 2576, h: 1438,
    npcs: [{ id: 'romi', box: [61.22, 49.86, 13.59, 28.72], inner: 100, idle: 'npc/romi_read.png', wave: 'npc/romi_wave.png', lbl: [68.0, 47.5] }],
    spots: [
      { id: 'registro', name: 'Registro de expediciones', hint: 'Aventuras, descubrimientos y acontecimientos', poly: '960,945 1080,880 1370,900 1372,905 1620,930 1665,1000 1600,1150 1000,1150 960,1000', at: [1180, 870], act: 'dossier', arg: 'registro' },
      { id: 'runas', name: 'Vitrinas rúnicas', hint: 'Fichas de investigación de cada familia rúnica', poly: '1375,900 1385,800 1450,750 1510,740 1570,760 1610,800 1615,900', at: [1495, 730], act: 'dossier', arg: 'runas' },
      { id: 'regiones', name: 'Tablón de regiones', hint: 'Regiones, lugares y sucesos descubiertos', poly: '1895,590 2245,590 2245,830 1895,830', at: [2070, 580], act: 'dossier', arg: 'regiones' },
      { id: 'objetos', name: 'Vitrinas de objetos', hint: 'Reliquias recuperadas y su origen', poly: '1845,880 2100,860 2160,790 2310,800 2345,920 2345,1100 1850,1080', at: [2220, 780], act: 'dossier', arg: 'objetos' },
      { id: 'estantes', name: 'Estanterías', hint: 'Bestiario, Grimorio y el Archivo completo', poly: '80,380 300,300 560,360 830,420 830,1020 560,1090 300,1070 80,1080', at: [450, 300], act: 'htab', arg: 'archivo' },
    ] },
};

/** Interior de un lugar: fondo animado, habitantes y objetos clicables. */
function placeView(id: 'taberna' | 'archivo'): string {
  const p = PLACES[id];
  const npcs = p.npcs.map((n) => { const d = NPCS[n.id]!;
    return `<button class="raw npc" data-act="talk" data-id="${n.id}" style="left:${n.box[0]}%;top:${n.box[1]}%;width:${n.box[2]}%;height:${n.box[3]}%;--wipe:url(${abs(n.idle)});--wave:url(${abs(n.wave)});--inner:${n.inner}%" aria-label="Hablar con ${d.name}"><span class="npc-spr"></span></button>
    <div class="slbl npclbl" data-lbl="${n.id}" style="left:${n.lbl[0]}%;top:${n.lbl[1]}%"><b>${d.name}</b><small>${d.role} · haz clic para hablar</small></div>`; }).join('');
  const pct = (x: number, y: number): string => `${((x / p.w) * 100).toFixed(2)}% ${((y / p.h) * 100).toFixed(2)}%`;
  const lit = p.spots.map((sp) => `<div class="spotlit" data-lit="${sp.id}" style="background-image:url(${abs(p.bg)});clip-path:polygon(${sp.poly.split(' ').map((xy) => { const [x, y] = xy.split(',').map(Number); return pct(x!, y!); }).join(',')})"></div>`).join('');
  const svg = p.spots.length ? `<svg class="spots" viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="none">${p.spots.map((sp) => `<polygon class="spot" data-spot="${sp.id}" points="${sp.poly}" data-act="${sp.act}" data-id="${sp.arg}"><title>${esc(sp.name)}</title></polygon>`).join('')}</svg>` : '';
  const lbls = p.spots.map((sp) => `<div class="slbl" data-lbl="${sp.id}" style="left:${(sp.at[0] / p.w) * 100}%;top:${(sp.at[1] / p.h) * 100}%"><b>${esc(sp.name)}</b><small>${esc(sp.hint)}</small></div>`).join('');
  const hover = [...p.spots.map((sp) => `.stscene:has([data-spot="${sp.id}"]:hover) [data-lbl="${sp.id}"]`), ...p.npcs.map((n) => `.stscene:has(.npc[data-id="${n.id}"]:hover) [data-lbl="${n.id}"]`)].join(',');
  const hoverLit = p.spots.map((sp) => `.stscene:has([data-spot="${sp.id}"]:hover) [data-lit="${sp.id}"]`).join(',');
  return `${coverBox(p.w / p.h, `${lit}${svg}${npcs}${lbls}`, `${id}-scene`)}
    <style>${hover}{opacity:1;transform:translate(var(--tx,-50%),-4px)}${hoverLit ? `${hoverLit}{opacity:1}` : ''}</style>
    ${hud(p.title, 'EL ASENTAMIENTO', 'placeexit', 'Volver al Asentamiento')}`;
}

function talkCtx(): TalkCtx {
  const m = meta();
  const all = allDossiers();
  const open = all.filter((d) => !investigated(d.id));
  const rd = open.filter(ready);
  // la pista más cercana: el expediente con pista al que le falten menos evidencias
  const next = open.filter((d) => d.known && !ready(d)).map((d) => ({ d, miss: d.evidence.find((e) => e.have < e.need)!, left: d.evidence.reduce((n, e) => n + Math.max(0, e.need - e.have), 0) })).sort((a, b) => a.left - b.left)[0];
  return { cls: ui.me.cls, clsName: CLASSES[ui.me.cls].name, runs: m.stats.runs, wins: m.stats.wins, bosses: m.stats.bosses, kills: m.stats.kills, archivePct: archiveTotal().pct, maxAsc: m.maxAsc,
    researched: all.length - open.length, researchTotal: all.length, researchReady: rd.map((d) => d.name), researchNext: next ? `${next.d.name}: ${next.miss.text.toLowerCase()} (${next.miss.have}/${next.miss.need})` : '' };
}

/** Líneas del nodo actual (para avanzar sin pasarse). */
export function talkLines(): string[] {
  const t = ui.talk;
  const node = t ? NPCS[t.npc]?.nodes[t.node] : undefined;
  return node ? node.lines(talkCtx()) : [];
}

function talkOverlay(): string {
  const t = ui.talk!;
  const n = NPCS[t.npc]!, node = n.nodes[t.node]!, c = talkCtx();
  const lines = node.lines(c), line = lines[Math.min(t.line, lines.length - 1)] ?? '';
  const last = t.line >= lines.length - 1;
  const opts = last ? node.options(c) : [];
  return `<div class="talk">
    <div class="talk-shade" data-act="dlgnext"></div>
    <img class="talk-fig" src="${BASE()}${n.figure}" alt="">
    ${opts.length ? `<div class="talk-opts">${opts.map((o) => `<button class="raw topt ${o.locked ? 'locked' : ''}" ${o.locked ? `disabled ${tip(esc(o.locked))}` : `data-act="dlgopt" data-id="${o.to}"`}>${o.locked ? '🔒 ' : '› '}${esc(o.label)}</button>`).join('')}</div>` : ''}
    <div class="talk-box" data-act="dlgnext">
      <div class="talk-port"><img src="${BASE()}${n.portrait}" alt="${esc(n.name)}"></div>
      <div class="talk-main"><div class="talk-name">${esc(n.name)} <small>${esc(n.role)}</small></div>
        <p id="dlgtext" data-full="${esc(line)}" data-key="${esc(`${t.npc}:${t.node}:${t.line}`)}"></p></div>
      <span class="talk-more">${last ? '' : '▼'}</span>
    </div>
  </div>`;
}

// máquina de escribir: el texto aparece letra a letra; un clic lo completa
let typing = 0, typedKey = '';
function startTyping(): void {
  const el = document.getElementById('dlgtext');
  if (typing) { clearInterval(typing); typing = 0; }
  if (!el) return;
  const full = el.dataset.full ?? '', key = el.dataset.key ?? '';
  const opts = document.querySelector('.talk-opts');
  if (key === typedKey) { el.textContent = full; opts?.classList.add('show'); return; }
  let i = 0;
  el.textContent = '';
  typing = window.setInterval(() => {
    i += 2;
    el.textContent = full.slice(0, i);
    if (i >= full.length) { clearInterval(typing); typing = 0; typedKey = key; opts?.classList.add('show'); }
  }, 22);
}
/** Si la línea aún se está escribiendo, la completa y devuelve true. */
export function finishTyping(): boolean {
  if (!typing) return false;
  clearInterval(typing); typing = 0;
  const el = document.getElementById('dlgtext');
  if (el) { el.textContent = el.dataset.full ?? ''; typedKey = el.dataset.key ?? ''; }
  document.querySelector('.talk-opts')?.classList.add('show');
  return true;
}

/** Fundido a negro entre escenas. */
export function fadeTo(fn: () => void): void {
  let f = document.getElementById('fade');
  if (!f) { document.body.insertAdjacentHTML('beforeend', '<div id="fade"></div>'); f = document.getElementById('fade')!; void f.offsetWidth; }
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f!.classList.remove('on'), 60); }, 380);
}

export function settlementScreen(): void {
  ui.root.innerHTML = `<div class="settle2">${ui.place ? placeView(ui.place) : panorama()}
    ${ui.talk ? talkOverlay() : ''}
    ${ui.dossier ? dossierView() : ''}
    ${ui.bldgOpen ? `<div class="fover"><div class="fover-box wide"><div class="row"><span class="grow"></span><button data-act="bldgclose">Volver al Asentamiento</button></div>${metaPanel()}</div></div>` : ''}
  </div>`;
  if (ui.talk) startTyping();
}

// ---------- fichas de investigación del Archivo ----------
const STATE = (d: Dossier): { cls: string; text: string } => investigated(d.id) ? { cls: 'done', text: '✔ Investigado' } : ready(d) ? { cls: 'ready', text: '🔍 Listo para investigar' } : d.known ? { cls: 'known', text: '👁 Examinable' } : { cls: 'sealed', text: '🔒 Sin pistas' };

function sheet(d: Dossier): string {
  const st = STATE(d), isDone = investigated(d.id), ok = ready(d);
  const evid = `<div class="dsec"><h4>Evidencias</h4>${d.evidence.map((e) => { const got = Math.min(e.have, e.need); return `<div class="devi ${e.have >= e.need ? 'ok' : ''}"><span>${e.have >= e.need ? '✔' : '○'} ${esc(e.text)}</span><b>${got}/${e.need}</b><i style="width:${e.need ? (got / e.need) * 100 : 100}%"></i></div>`; }).join('')}</div>`;
  return `<div class="dsheet">
    <div class="dhead"><span class="dicon">${d.icon}</span><div><h3>${esc(d.name)}</h3><span class="dstate ${st.cls}">${st.text}</span></div></div>
    ${d.known ? `<div class="dsec"><h4>Examinar</h4><dl>${d.examine.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : '<div class="dsec dim">Todavía no hay ninguna pista sobre esto. Sigue explorando el Abismo.</div>'}
    ${evid}
    ${isDone ? `<div class="dsec dfind"><h4>Hallazgo</h4><p>${esc(d.finding)}</p><p class="dnote">«${esc(d.note)}» <span>— Romi</span></p></div>`
      : `<button class="pri dinv" data-act="investigate" data-id="${d.id}" ${ok ? '' : `disabled ${tip('Reúne todas las evidencias para investigar')}`}>🔍 Investigar</button>`}
  </div>`;
}

function registro(): string {
  const m = meta(), s = m.stats, all = allDossiers(), n = all.filter((d) => investigated(d.id)).length;
  const story = (['stories', 'secrets', 'milestones'] as const).map((cat) => {
    const list = CHRONICLES[cat], open = list.filter((c) => chronicleState(m, cat, c.id) !== 'locked');
    return `<div class="dsec"><h4>${CHRONICLE_NAME[cat]} <span class="dim">${open.length}/${list.length}</span></h4>${open.length ? open.slice(-6).reverse().map((c) => `<div class="dline"><b>${esc(c.name)}</b>${cat === 'milestones' ? '' : `<span>${esc(c.text).slice(0, 180)}${c.text.length > 180 ? '…' : ''}</span>`}</div>`).join('') : '<div class="dim sm">Nada registrado todavía.</div>'}</div>`;
  }).join('');
  return `<div class="dsheet wide">
    <div class="dhead"><span class="dicon">📖</span><div><h3>Registro de expediciones</h3><span class="dstate known">Lo que el Asentamiento sabe de ti</span></div></div>
    <div class="dstats"><span><b>${s.runs}</b>expediciones</span><span><b>${s.wins}</b>victorias</span><span><b>${s.bosses}</b>guardianes</span><span><b>${s.kills}</b>criaturas abatidas</span><span><b>${m.maxAsc}</b>ascensión máx.</span><span><b>${n}/${all.length}</b>investigaciones</span></div>
    ${story}
    <div class="row"><button data-act="htab" data-id="archivo">Abrir el Archivo completo</button></div>
  </div>`;
}

function dossierView(): string {
  const kind = ui.dossier as DossierKind | 'registro';
  const tabs = ([['registro', '📖 Registro'], ['runas', '🔮 Familias rúnicas'], ['regiones', '🗺️ Regiones'], ['objetos', '🏺 Objetos']] as const)
    .map(([k, n]) => `<button class="raw dtab ${kind === k ? 'on' : ''}" data-act="dossier" data-id="${k}">${n}</button>`).join('');
  let body = '';
  if (kind === 'registro') body = registro();
  else {
    const list = dossiers(kind), sel = list.find((d) => d.id === ui.dossierSel) ?? list.find((d) => ready(d) && !investigated(d.id)) ?? list.find((d) => d.known) ?? list[0]!;
    body = `<div class="dgrid"><div class="dlist">${list.map((d) => { const st = STATE(d); return `<button class="raw ditem ${st.cls} ${d.id === sel.id ? 'on' : ''}" data-act="dossel" data-id="${d.id}"><span>${d.known ? d.icon : '❔'}</span><b>${d.known ? esc(d.name) : 'Desconocido'}</b><i>${st.text}</i></button>`; }).join('')}</div>${sheet(sel)}</div>`;
  }
  const intro = kind === 'registro' ? 'Aventuras anteriores, descubrimientos y acontecimientos importantes.' : DOSSIER_KINDS[kind].intro;
  return `<div class="fover"><div class="dossier">
    <div class="dtop"><div><span class="hero-kicker">ARCHIVO DEL ABISMO · ROMI</span><h2>${kind === 'registro' ? 'Registro de expediciones' : DOSSIER_KINDS[kind].title}</h2><p class="dim sm">${intro}</p></div><span class="grow"></span><button data-act="dossierclose">Cerrar</button></div>
    <div class="dtabs">${tabs}</div>${body}
  </div></div>`;
}
