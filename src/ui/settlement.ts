// El Asentamiento: panorama vivo con edificios clicables, interiores (Taberna, Archivo)
// con sus habitantes y conversaciones, y las fichas de investigación del Archivo.
import { CLASSES } from '../core/classes/classes';
import { NPCS, type TalkCtx } from '../content/dialogues';
import { archiveTotal } from '../game/archive';
import { meta } from '../game/meta';
import { DOSSIER_KINDS, allDossiers, dossiers, investigated, ready, type Dossier, type DossierKind } from '../game/research';
import { CHRONICLES, CHRONICLE_NAME, chronicleState } from '../game/atlas';
import { deepestName, inspectView, seenZones } from './watch';
import { hallView, isHallView } from './hall';
import { atlasEntry } from '../game/atlas';
import { ZONES } from '../content/zones';
import type { MenuScene } from '../render/menubg';
import { esc, tip, ui } from './ctx';
import { volumeControl } from './panels';
import { duckMusic } from '../audio/sfx';
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
  { id: 'memorial', name: 'Campo de las espadas', poly: '600,125 640,60 760,40 885,88 905,205 625,205', at: [752, 96], locked: true },
  { id: 'barracones', name: 'Barracones', poly: '0,0 232,0 252,62 205,135 0,142', at: [116, 100], act: 'htab', arg: 'clases', hint: 'Maestría de cada clase' },
  { id: 'atalaya', name: 'Atalaya', poly: '905,40 960,5 1000,40 1000,180 990,270 905,270', at: [952, 112], act: 'htab', arg: 'logros', hint: 'Logros y estadísticas' },
  { id: 'palomar', name: 'Palomar', poly: '430,0 625,0 625,150 600,205 470,205 430,120', at: [528, 110], act: 'htab', arg: 'amigos', hint: 'Amigos e invitaciones' },
  { id: 'tablon', name: 'Tablón del reto', poly: '725,285 820,262 905,300 905,470 760,480 720,420', at: [815, 266], act: 'htab', arg: 'diario', hint: 'Clasificación del reto del día' },
  { id: 'puerta', name: 'La Puerta del Abismo', poly: '1008,200 1100,140 1165,250 1140,500 1172,700 1000,745 1030,450', at: [1088, 150], act: 'place', arg: 'puerta', hint: 'Darel, el puesto de vigilancia y la salida al Abismo' },
  { id: 'forja', name: 'La Forja', poly: '395,600 500,530 560,535 605,598 670,598 705,640 705,768 395,768', at: [550, 534], locked: true },
  { id: 'salon', name: 'Salón de los Héroes', poly: '80,250 100,165 170,138 262,168 300,228 300,372 90,382', at: [190, 142], act: 'place', arg: 'salon', hint: 'El Custodio, el Muro de los Recuerdos y los duelos' },
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
  const lbl = (p: Spot): string => `<div class="slbl ${p.locked ? 'locked' : ''}" data-lbl="${p.id}" style="left:${(p.at[0] / 1376) * 100}%;top:${(p.at[1] / 768) * 100}%;--tx:${p.at[0] < 170 ? '-12%' : p.at[0] > 1200 ? '-88%' : '-50%'}"><b>${p.locked ? '🔒 ' : ''}${esc(p.name)}</b><small>${p.locked ? 'Próximamente' : esc(p.hint ?? '')}</small></div>`;
  const spot = (p: Spot): string => {
    const act = p.locked ? '' : `data-act="${p.act}" data-id="${p.arg}"`;
    return `<polygon class="spot ${p.locked ? 'locked' : ''} ${p.id === 'puerta' ? 'abyss' : ''}" data-spot="${p.id}" points="${p.poly}" ${act}><title>${esc(p.name)}</title></polygon>`;
  };
  const hover = SPOTS.map((p) => `.stscene:has([data-spot="${p.id}"]:hover) [data-lbl="${p.id}"]`).join(',');
  const hoverLit = SPOTS.map((p) => `.stscene:has([data-spot="${p.id}"]:hover) [data-lit="${p.id}"]`).join(',');
  // luz: aclara la imagen de fondo justo dentro del contorno del edificio
  const lit = (p: Spot): string => `<div class="spotlit ${p.locked ? 'locked' : ''} ${p.id === 'puerta' ? 'abyss' : ''}" data-lit="${p.id}" style="background-image:url(${abs('bg/asentamiento.jpg')});clip-path:polygon(${p.poly.split(' ').map((xy) => { const [x, y] = xy.split(',').map(Number); return `${((x! / 1376) * 100).toFixed(2)}% ${((y! / 768) * 100).toFixed(2)}%`; }).join(',')})"></div>`;
  return `${coverBox(1376 / 768, `${SPOTS.map(lit).join('')}<svg class="spots" viewBox="0 0 1376 768" preserveAspectRatio="none">${SPOTS.map(spot).join('')}</svg>${SPOTS.map(lbl).join('')}`, 'settle-scene')}
    <style>${hover}{opacity:1;transform:translate(var(--tx,-50%),-4px)}${hoverLit}{opacity:1}</style>
    ${hud('El Asentamiento', `${esc(CLASSES[ui.me.cls].name)} · ${s.t.kind === 'local' ? 'un jugador' : `sala ${esc(s.code)}`}${ui.daily ? ' · reto del día' : ui.asc ? ` · ascensión ${ui.asc}` : ''}`, 'herochange', 'Cambiar de héroe')}
    <div class="sgate"><span class="dim sm shint">Pasa el ratón por los edificios · haz clic para entrar · para descender, ve a la Puerta</span></div>
    <nav class="slist">${SPOTS.filter((p) => !p.locked && p.act !== 'gate').map((p) => `<button class="mini" data-act="${p.act}" data-id="${p.arg}">${esc(p.name)}</button>`).join('')}</nav>`;
}

/** Habitante dentro de un lugar: caja en % de la imagen y tiras de 4 fotogramas (reposo y saludo). */
interface PlaceNpc { id: string; box: [number, number, number, number]; inner: number; idle: string; wave: string; lbl: [number, number]; /** fotogramas de la tira de reposo (4 por defecto) */ frames?: number; /** saluda al hacer clic (no al pasar el ratón) */ waveOnClick?: boolean }
/** Objeto clicable dentro de un lugar (coordenadas en píxeles de la imagen de referencia). */
interface PlaceSpot { id: string; name: string; hint: string; poly: string; at: [number, number]; act: string; arg: string }
interface PlaceDef { title: string; scene: MenuScene; bg: string; w: number; h: number; npcs: PlaceNpc[]; spots: PlaceSpot[]; /** lugar al que se vuelve (por defecto, el panorama) */ parent?: Place }
type Place = 'taberna' | 'archivo' | 'puerta' | 'puesto' | 'salon';
export const placeParent = (p: Place): Place | '' => PLACES[p].parent ?? '';
const PLACES: Record<Place, PlaceDef> = {
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
  // la Puerta del Refugio: Darel junto al brasero, al pie del puesto de vigilancia
  puerta: { title: 'La Puerta del Refugio', scene: 'gate', bg: 'bg/puerta.jpg', w: 2576, h: 1438,
    npcs: [{ id: 'darel', box: [56.17, 42.42, 14.95, 29.90], inner: 100, idle: 'npc/darel_look.png', wave: 'npc/darel_wave.png', lbl: [63.66, 40.5], waveOnClick: true }],
    spots: [
      { id: 'porton', name: 'El portón', hint: 'Descender al Abismo', poly: '470,1010 470,560 520,470 650,435 780,470 835,560 835,990', at: [652, 420], act: 'gate', arg: '' },
      { id: 'puesto', name: 'Puesto de vigilancia', hint: 'El registro, el catalejo y el tablero de Darel', poly: '1100,420 1290,255 1455,330 1440,560 1425,600 1300,600 1290,880 1180,890 1150,560', at: [1280, 245], act: 'place', arg: 'puesto' },
      { id: 'campana', name: 'Campana de alarma', hint: 'La cuerda baja de la torre: alertas y advertencias', poly: '1350,600 1425,600 1425,800 1350,800', at: [1388, 805], act: 'inspect', arg: 'campana' },
    ] },
  // dentro del puesto de vigilancia
  puesto: { title: 'Puesto de vigilancia', scene: 'post', bg: 'bg/puesto.jpg', w: 2576, h: 1438, parent: 'puerta', npcs: [],
    spots: [
      { id: 'registro', name: 'Registro de salidas', hint: 'Quién cruza la Puerta y quién vuelve', poly: '1300,960 1320,880 1700,890 1700,1050 1320,1050', at: [1500, 870], act: 'inspect', arg: 'registro' },
      { id: 'tablero', name: 'Tablero de avisos', hint: 'Avisos y noticias del Refugio', poly: '1320,480 1775,480 1775,830 1320,830', at: [1548, 470], act: 'inspect', arg: 'tablero' },
      { id: 'catalejo', name: 'Catalejo', hint: 'El territorio exterior', poly: '2030,820 2050,740 2240,690 2310,720 2300,780 2230,820 2200,1000 2290,1290 2080,1290 2160,1000 2140,850', at: [2170, 680], act: 'inspect', arg: 'catalejo' },
    ] },
  // el Salón de los Héroes: el Custodio trabaja junto a la mesa pequeña, a la derecha del altar
  salon: { title: 'Salón de los Héroes', scene: 'hall', bg: 'bg/salon.jpg', w: 1376, h: 768,
    npcs: [{ id: 'custodio', box: [79.43, 64.06, 13.37, 25.78], inner: 100, idle: 'npc/custodio_loop.png', wave: 'npc/custodio_greet.png', lbl: [86.1, 62.5], waveOnClick: true, frames: 24 }],
    spots: [
      { id: 'muro', name: 'Muro de los Recuerdos', hint: 'Hechos, testimonios, teorías, rumores y contradicciones', poly: '550,220 850,220 850,470 550,470', at: [700, 212], act: 'inspect', arg: 'muro' },
      { id: 'libro', name: 'Libro de regresos', hint: 'Quienes cayeron y volvieron', poly: '620,538 785,538 790,588 615,588', at: [702, 530], act: 'inspect', arg: 'libro' },
      { id: 'armero', name: 'Armero de los héroes', hint: 'Héroes guardados y duelos 3 contra 3', poly: '230,395 520,395 520,600 300,610 230,600', at: [375, 388], act: 'htab', arg: 'salon' },
      { id: 'objetos', name: 'Estantes de objetos', hint: 'Lo que trajeron de vuelta', poly: '860,395 1145,395 1150,600 860,600', at: [1000, 388], act: 'dossier', arg: 'objetos' },
      { id: 'placas', name: 'Placas de los ausentes', hint: 'Lo que sigue sin resolverse', poly: '285,248 485,248 485,350 285,350', at: [385, 240], act: 'inspect', arg: 'placas' },
    ] },
};

/** Interior de un lugar: fondo animado, habitantes y objetos clicables. */
function placeView(id: Place): string {
  const p = PLACES[id];
  const npcs = p.npcs.map((n) => { const d = NPCS[n.id]!;
    return `<button class="raw npc ${n.waveOnClick ? 'clickwave' : ''} ${n.frames === 24 ? 'f24' : ''}" data-act="talk" data-id="${n.id}" style="left:${n.box[0]}%;top:${n.box[1]}%;width:${n.box[2]}%;height:${n.box[3]}%;--wipe:url(${abs(n.idle)});--wave:url(${abs(n.wave)});--inner:${n.inner}%" aria-label="Hablar con ${d.name}"><span class="npc-spr"></span></button>
    <div class="slbl npclbl" data-lbl="${n.id}" style="left:${n.lbl[0]}%;top:${n.lbl[1]}%"><b>${d.name}</b><small>${d.role} · haz clic para hablar</small></div>`; }).join('');
  const pct = (x: number, y: number): string => `${((x / p.w) * 100).toFixed(2)}% ${((y / p.h) * 100).toFixed(2)}%`;
  const lit = p.spots.map((sp) => `<div class="spotlit" data-lit="${sp.id}" style="background-image:url(${abs(p.bg)});clip-path:polygon(${sp.poly.split(' ').map((xy) => { const [x, y] = xy.split(',').map(Number); return pct(x!, y!); }).join(',')})"></div>`).join('');
  const g = gateAct();
  const spotAct = (sp: PlaceSpot): string => sp.act === 'gate' ? (g.disabled ? '' : `data-act="${g.act}"`) : `data-act="${sp.act}" data-id="${sp.arg}"`;
  const svg = p.spots.length ? `<svg class="spots" viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="none">${p.spots.map((sp) => `<polygon class="spot" data-spot="${sp.id}" points="${sp.poly}" ${spotAct(sp)}><title>${esc(sp.name)}</title></polygon>`).join('')}</svg>` : '';
  const lbls = p.spots.map((sp) => `<div class="slbl" data-lbl="${sp.id}" style="left:${(sp.at[0] / p.w) * 100}%;top:${(sp.at[1] / p.h) * 100}%"><b>${esc(sp.name)}</b><small>${esc(sp.hint)}</small></div>`).join('');
  const hover = [...p.spots.map((sp) => `.stscene:has([data-spot="${sp.id}"]:hover) [data-lbl="${sp.id}"]`), ...p.npcs.map((n) => `.stscene:has(.npc[data-id="${n.id}"]:hover) [data-lbl="${n.id}"]`)].join(',');
  const hoverLit = p.spots.map((sp) => `.stscene:has([data-spot="${sp.id}"]:hover) [data-lit="${sp.id}"]`).join(',');
  return `${coverBox(p.w / p.h, `${lit}${svg}${npcs}${lbls}`, `${id}-scene`)}
    <style>${hover}{opacity:1;transform:translate(var(--tx,-50%),-4px)}${hoverLit ? `${hoverLit}{opacity:1}` : ''}</style>
    ${hud(p.title, p.parent ? PLACES[p.parent].title.toUpperCase() : 'EL ASENTAMIENTO', 'placeexit', p.parent ? `Volver a ${PLACES[p.parent].title}` : 'Volver al Asentamiento')}
    ${id === 'puerta' ? (warmIntro(), '') : ''}
    ${id === 'puerta' ? (() => { const g = gateAct(); return `<div class="sgate"><button class="pri sgate-btn" data-act="${g.act}" ${g.disabled ? 'disabled' : ''}>${g.label}${g.sub ? `<small>${g.sub}</small>` : ''}</button></div>`; })() : ''}`;
}

function talkCtx(): TalkCtx {
  const m = meta();
  const all = allDossiers();
  const open = all.filter((d) => !investigated(d.id));
  const rd = open.filter(ready);
  // la pista más cercana: el expediente con pista al que le falten menos evidencias
  const next = open.filter((d) => d.known && !ready(d)).map((d) => ({ d, miss: d.evidence.find((e) => e.have < e.need)!, left: d.evidence.reduce((n, e) => n + Math.max(0, e.need - e.have), 0) })).sort((a, b) => a.left - b.left)[0];
  return { cls: ui.me.cls, clsName: CLASSES[ui.me.cls].name, runs: m.stats.runs, wins: m.stats.wins, bosses: m.stats.bosses, kills: m.stats.kills, archivePct: archiveTotal().pct, maxAsc: m.maxAsc,
    since: (ui.talk?.npc === 'darel' || ui.talk?.npc === 'custodio') && ui.talkBase !== undefined ? (ui.talkBase === null ? null : { runs: m.stats.runs - ui.talkBase.runs, wins: m.stats.wins - ui.talkBase.wins, losses: (m.stats.runs - m.stats.wins) - (ui.talkBase.runs - ui.talkBase.wins), bosses: m.stats.bosses - ui.talkBase.bosses, deeper: m.stats.bestZone > ui.talkBase.bestZone }) : null,
    losses: Math.max(0, m.stats.runs - m.stats.wins), bestZone: m.stats.bestZone, deepest: deepestName(m.stats.bestZone),
    regionsSeen: seenZones().length, regionNames: seenZones().map((i) => ZONES[i]!.name),
    hallCount: m.hall.length, hallFallen: m.hall.filter((c) => !c.won).length,
    lastBossZone: [...ZONES.keys()].reverse().map((i) => (atlasEntry(m, 'zones', `z${i + 1}`)?.completions ? ZONES[i]!.name : '')).find(Boolean) ?? '',
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
    ${ui.inspect ? (isHallView(ui.inspect) ? hallView(talkCtx()) : inspectView()) : ''}
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

// ---------- descenso al Abismo: fundido a negro y, si existe, vídeo de entrada que se puede saltar ----------
/** Vídeo opcional (public/video/intro_abismo.mp4). Si no está, solo hay fundido. */
const INTRO = 'video/intro_abismo.mp4';
let introOk: boolean | null = null;
function probeIntro(): Promise<boolean> {
  if (introOk !== null) return Promise.resolve(introOk);
  return fetch(BASE() + INTRO, { method: 'HEAD' }).then((r) => (introOk = r.ok && (r.headers.get('content-type') ?? '').startsWith('video'))).catch(() => (introOk = false));
}
/** Al llegar a la Puerta se descarga el vídeo, para que al descender empiece al instante. */
let warmed = false;
function warmIntro(): void { if (warmed) return; warmed = true; void probeIntro().then((ok) => { if (ok) void fetch(BASE() + INTRO).catch(() => {}); }); }
export function descendFx(): void {
  let f = document.getElementById('fade');
  if (!f) { document.body.insertAdjacentHTML('beforeend', '<div id="fade"></div>'); f = document.getElementById('fade')!; }
  f.style.transition = 'none'; f.classList.add('on'); void f.offsetWidth; f.style.transition = '';
  const reveal = (): void => { setTimeout(() => f!.classList.remove('on'), 120); };
  void probeIntro().then((ok) => {
    if (!ok) { setTimeout(reveal, 700); return; }
    document.body.insertAdjacentHTML('beforeend', `<div id="introvid"><video src="${BASE()}${INTRO}" playsinline autoplay></video><button class="introskip">Saltar ⏭</button></div>`);
    const box = document.getElementById('introvid')!, v = box.querySelector('video')!;
    duckMusic(true);
    const end = (): void => { removeEventListener('keydown', key); box.remove(); duckMusic(false); reveal(); };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(); } };
    addEventListener('keydown', key);
    box.addEventListener('click', end);
    v.addEventListener('ended', end);
    v.addEventListener('error', end);
    void v.play().catch(() => { v.muted = true; void v.play().catch(end); });
  });
}
