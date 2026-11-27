// El Asentamiento: panorama vivo con edificios clicables, interiores (de momento la Taberna)
// y conversaciones con sus habitantes.
import { CLASSES } from '../core/classes/classes';
import { NPCS, type TalkCtx } from '../content/dialogues';
import { archiveTotal } from '../game/archive';
import { meta } from '../game/meta';
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
  { id: 'archivo', name: 'Archivo', poly: '495,240 520,192 722,192 742,250 742,332 500,342', at: [620, 194], act: 'htab', arg: 'archivo', hint: 'Bestiario, grimorio, atlas y crónicas' },
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
  return ui.place === 'taberna' ? 'tavern' : 'settle';
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

/** Interior de la Taberna: Irena trabaja detrás de la barra. */
function tavern(): string {
  const n = NPCS.irena!;
  // posición en bg/taberna.jpg (referencia 2576×1438): tras la barra, entre las jarras y el mortero
  const npc = `<button class="raw npc" data-act="talk" data-id="irena" style="left:43.48%;top:46.70%;width:12.42%;height:12.55%;--wipe:url(${abs('npc/irena_wipe.png')});--wave:url(${abs('npc/irena_wave.png')})" aria-label="Hablar con ${n.name}"><span class="npc-spr"></span></button>
    <div class="slbl npclbl" data-lbl="irena" style="left:49.7%;top:38.5%"><b>${n.name}</b><small>${n.role} · haz clic para hablar</small></div>`;
  return `${coverBox(2576 / 1438, npc, 'tavern-scene')}
    <style>.stscene:has(.npc:hover) [data-lbl="irena"]{opacity:1;transform:translate(var(--tx,-50%),-4px)}</style>
    ${hud('La Taberna', 'EL ASENTAMIENTO', 'placeexit', 'Volver al Asentamiento')}`;
}

function talkCtx(): TalkCtx {
  const m = meta();
  return { cls: ui.me.cls, clsName: CLASSES[ui.me.cls].name, runs: m.stats.runs, wins: m.stats.wins, bosses: m.stats.bosses, kills: m.stats.kills, archivePct: archiveTotal().pct, maxAsc: m.maxAsc };
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
  ui.root.innerHTML = `<div class="settle2">${ui.place === 'taberna' ? tavern() : panorama()}
    ${ui.talk ? talkOverlay() : ''}
    ${ui.bldgOpen ? `<div class="fover"><div class="fover-box wide"><div class="row"><span class="grow"></span><button data-act="bldgclose">Volver al Asentamiento</button></div>${metaPanel()}</div></div>` : ''}
  </div>`;
  if (ui.talk) startTyping();
}
