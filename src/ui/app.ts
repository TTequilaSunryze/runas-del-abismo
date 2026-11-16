// Pantallas: inicio, sala, combate, entre combates y final.
import { ZONA1_EVENTS } from '../content/zona1/events';
import { CLASSES, blockedRoutes, canPickRoute, findRoute, MAX_ROUTES } from '../core/classes/classes';
import { isMuted, playEvents, sfx, toggleMute } from '../audio/sfx';
import { BAG_SIZE, PRICE, RARITY_NAME, SLOTS, SLOT_NAME, STAT_NAME, statDiff, statsText, type Item, type Slot, type StatKey } from '../core/items/items';
import { SPELLS } from '../core/classes/spells';
import { current, getUnit } from '../core/combat/engine';
import type { ClassId, GameEvent } from '../core/state';
import { NODE_HINT, NODE_NAME, POTION_HEAL, POTION_PRICE, heroMaxHp, type HeroSave, type RunState } from '../game/run';
import { Session, TURN_SECONDS } from '../game/session';
import { joinRoom, loadRun } from '../net/transport';
import { Board, STATUS_NAME } from '../render/board';

const root = document.getElementById('app')!;
const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const params = new URLSearchParams(location.search);
const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};
const randomText = (n: number, chars: string): string => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => chars[b % chars.length]).join('');
const myId = params.get('p') ?? store.get('rda_id') ?? randomText(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
if (!params.get('p')) store.set('rda_id', myId);

const me = { name: store.get('rda_name') ?? 'Héroe', cls: 'guerrero' as ClassId, routes: [] as string[] };
let session: Session | null = null;
let board: Board | null = null;
let screen = '';
let saved: RunState | null = null;
let notice = '';
const log: string[] = [];

function publish(): void {
  session?.announce({ name: me.name, cls: me.cls, routes: me.routes, host: session.isHost });
}

// ---------- inicio ----------
function home(msg = ''): void {
  session?.leave();
  session = null;
  board?.destroy();
  board = null;
  screen = 'home';
  const host = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null;
  root.innerHTML = `<div class="c"><h1>RUNAS DEL ABISMO</h1><p class="dim">Zona 1 · Las Catacumbas Olvidadas · cooperativo de 1 a 4 jugadores</p></div>
  ${msg ? `<p class="bad c">${esc(msg)}</p>` : ''}
  <div class="card"><label>Tu nombre <input id="name" maxlength="14" value="${esc(me.name)}"></label></div>
  <div class="grid">
    <div class="card"><h3>Crear sala</h3><p class="dim">Serás el anfitrión. Comparte el código con los demás.</p><button class="pri" data-act="create">Crear sala</button></div>
    <div class="card"><h3>Unirse</h3><p class="dim">Escribe el código de 4 letras.</p><input id="code" maxlength="4" placeholder="ABCD" style="width:90px;text-transform:uppercase"> <button class="pri" data-act="join">Unirse</button></div>
    <div class="card"><h3>Un jugador</h3><p class="dim">Juega sin conexión con otros.</p><button data-act="solo">Jugar solo</button></div>
  </div>
  ${host ? `<p class="c"><button data-act="resume">Continuar la partida guardada de la sala ${esc(host.code)}</button></p>` : ''}
  <div class="card dim"><b>Cómo se juega:</b> cada unidad juega en su turno, por orden de iniciativa. Clic en una casilla azul para moverte (PM). Elige un hechizo y haz clic en un objetivo con borde dorado (PA). Los obstáculos tapan la línea de visión. Cada turno dura como máximo ${TURN_SECONDS} segundos.</div>`;
}

async function enter(code: string, isHost: boolean, local: boolean, resume = false): Promise<void> {
  const nameEl = document.getElementById('name') as HTMLInputElement | null;
  me.name = (nameEl?.value ?? me.name).trim().slice(0, 14) || 'Héroe';
  store.set('rda_name', me.name);
  root.innerHTML = `<p class="c">Conectando a la sala ${esc(code)}…</p>`;
  let secret = '';
  if (isHost) {
    const old = JSON.parse(store.get('rda_host') ?? 'null') as { code: string; secret: string } | null;
    secret = resume && old ? old.secret : randomText(24, 'abcdefghijklmnopqrstuvwxyz0123456789');
    if (!local) store.set('rda_host', JSON.stringify({ code, secret }));
  }
  try {
    const t = await joinRoom(code, myId, local || params.has('local'));
    session = new Session(t, myId, code, isHost, secret);
  } catch (e) {
    home(`${(e as Error).message}. Revisa tu conexión e inténtalo de nuevo.`);
    return;
  }
  saved = null;
  if (resume) {
    const run = (await loadRun(code)) as RunState | null;
    if (run && run.version === 3 && run.phase === 'map') saved = run;
    else notice = 'No se encontró una partida guardada que se pueda continuar.';
  }
  let wasMyTurn = false;
  session.onChange = (ev) => {
    addLog(ev);
    playEvents(ev);
    const mine = !!session?.isMyTurn();
    if (mine && !wasMyTurn) sfx.myTurn();
    wasMyTurn = mine;
    render(ev);
  };
  session.onError = (text) => { notice = text; render([]); setTimeout(() => { notice = ''; render([]); }, 2500); };
  session.onLobby = () => render([]);
  publish();
  render([]);
  // sala inexistente: nadie es anfitrión
  if (!isHost) setTimeout(() => { if (session && !session.run && !session.hostPresent()) home(`No hay ninguna sala abierta con el código ${code}. Comprueba el código y que el anfitrión siga en la sala.`); }, 15000);
}

// ---------- sala ----------
function lobby(): void {
  const s = session!;
  const players = s.lobby();
  const cls = CLASSES[me.cls];
  const blocked = blockedRoutes(me.cls, me.routes);
  const ready = players.slice(0, 4).filter((p) => p.routes.length > 0);
  root.innerHTML = `<h2>Sala <span class="code">${esc(s.code)}</span> ${s.t.kind === 'local' ? '<span class="dim">(local)</span>' : ''}</h2>
  <p class="dim">${s.isHost ? 'Comparte el código. Cuando todos tengan clase y ruta, pulsa Comenzar.' : s.hostPresent() ? 'Elige clase y rutas. El anfitrión comienza la partida.' : 'Buscando al anfitrión… (puede tardar unos segundos)'}</p>
  ${notice ? `<p class="bad">${esc(notice)}</p>` : ''}
  <div class="grid">${players.map((p, i) => `<div class="card ${i > 3 ? 'off' : ''}"><b class="p${i % 4}">${esc(p.name)}</b> ${p.host ? '👑' : ''} ${p.id === myId ? '<span class="dim">(tú)</span>' : ''}<br>${esc(CLASSES[p.cls]?.name ?? '?')}<br><span class="dim">${p.routes.map((r) => esc(findRoute(p.cls, r)?.name ?? r)).join(' + ') || 'sin ruta todavía'}</span>${i > 3 ? '<br><span class="bad">Sala llena</span>' : ''}</div>`).join('')}</div>
  <h3>Tu clase</h3>
  <div class="grid">${(Object.keys(CLASSES) as ClassId[]).map((id) => { const c = CLASSES[id]; return `<button class="card pickc ${id === me.cls ? 'on' : ''}" data-act="cls" data-id="${id}"><b>${c.name}</b><br><span class="dim">PV ${c.hp} · PA ${c.ap} · PM ${c.mp} · Iniciativa ${c.initiative}</span></button>`; }).join('')}</div>
  <h3>Tus rutas <span class="dim">(elige 1 o ${MAX_ROUTES}; cada ruta bloquea a su opuesta)</span></h3>
  <div class="grid">${cls.routes.map((r) => {
    const on = me.routes.includes(r.id), off = !on && blocked.includes(r.id);
    const why = off ? (me.routes.includes(r.opposite) ? `Bloqueada por ${findRoute(me.cls, r.opposite)!.name}` : 'Ya tienes 2 rutas') : `Opuesta: ${findRoute(me.cls, r.opposite)!.name}`;
    return `<button class="card pickc ${on ? 'on' : ''} ${off ? 'off' : ''}" data-act="route" data-id="${r.id}" ${off ? 'disabled' : ''}><b>${r.name}</b> ${on ? '✔' : ''}<br><span class="dim">${r.text}</span><br>${r.spells.map((id, i) => `<span class="sp"><span class="dim">Nv ${i + 1}</span> ${esc(SPELLS[id]!.name)}: ${esc(SPELLS[id]!.text)}</span>`).join('<br>')}<br><i class="${off ? 'bad' : 'dim'}">${why}</i></button>`;
  }).join('')}</div>
  <p>${s.isHost ? `<button class="pri" data-act="start" ${ready.length && ready.length === Math.min(4, players.length) ? '' : 'disabled'}>⚔️ Comenzar (${ready.length} de ${Math.min(4, players.length)} listos)</button> ${saved ? `<button data-act="doresume">Reanudar partida guardada (sala ${saved.step + 1} de ${saved.map.length})</button>` : ''}` : ''} <button data-act="home">Salir</button></p>`;
}

// ---------- combate ----------
function addLog(events: GameEvent[]): void {
  const c = session?.run?.combat;
  if (!c) return;
  const n = (id: number): string => esc(getUnit(c, id)?.name ?? '?');
  for (const e of events) {
    let s = '';
    if (e.t === 'turn') s = `<span class="pill">Turno de ${n(e.unit)}</span>`;
    else if (e.t === 'cast') s = `${n(e.unit)} usa <b>${esc(SPELLS[e.spell]?.name ?? e.spell)}</b>`;
    else if (e.t === 'damage') s = `· ${n(e.unit)} pierde <span class="bad">${e.amount}</span>${e.crit ? ' (crítico)' : ''}${e.absorbed ? ` · escudo ${e.absorbed}` : ''}`;
    else if (e.t === 'heal') s = `· ${n(e.unit)} recupera <span class="good">${e.amount}</span>`;
    else if (e.t === 'status') s = `· ${n(e.unit)}: ${STATUS_NAME[e.kind]}`;
    else if (e.t === 'skip') s = `· ${n(e.unit)} pierde el turno`;
    else if (e.t === 'death') s = `✝ ${n(e.unit)} cae`;
    else if (e.t === 'summon') s = `<span class="bad">Aparece ${n(e.unit)}</span>`;
    else if (e.t === 'trap') s = `· ${n(e.unit)} pisa unas púas`;
    else if (e.t === 'phase') s = `<b class="bad">El Prior se funde con el osario: ¡${n(e.unit)}!</b>`;
    else if (e.t === 'over') s = `<b>${e.result === 'win' ? '¡Victoria!' : 'Derrota'}</b>`;
    if (s) log.push(s);
  }
  log.splice(0, Math.max(0, log.length - 60));
}

function combat(events: GameEvent[]): void {
  const s = session!, run = s.run!, c = run.combat!;
  if (screen !== 'combat') {
    root.innerHTML = `<div id="info" class="row"></div><div id="init" class="row"></div><canvas id="cv"></canvas><div id="bar" class="row"></div><div id="log"></div>`;
    board?.destroy();
    board = new Board(document.getElementById('cv') as HTMLCanvasElement, s);
    board.onSelect = () => render([]);
  }
  board!.applyEvents(events);
  const cur = current(c), mine = s.myUnit(), myTurn = s.isMyTurn();
  if (!myTurn && board!.sel) board!.sel = null;
  const left = s.turnEndsAt ? Math.max(0, Math.ceil((s.turnEndsAt - Date.now()) / 1000)) : 0;
  document.getElementById('info')!.innerHTML = `<b>${run.kind === 'boss' ? 'JEFE' : run.kind === 'elite' ? 'ÉLITE' : 'Combate'} · sala ${run.step + 1} de ${run.map.length}</b><span>Ronda ${c.round}</span>
    <span class="${myTurn ? 'pill' : ''}">${c.over ? (c.over === 'win' ? '¡Victoria!' : 'Derrota') : myTurn ? 'TU TURNO' : cur ? `Turno de ${esc(cur.name)}` : ''}</span><span id="clock" class="dim">${left && !c.over ? `${left}s` : ''}</span>
    ${notice ? `<span class="bad">${esc(notice)}</span>` : ''}${!s.hostPresent() ? '<span class="bad">Anfitrión desconectado: la partida está en pausa</span>' : ''}
    ${s.isHost && cur && !cur.ai && !myTurn && !c.over ? '<button data-act="skip">Pasar su turno</button>' : ''}<span class="sp-r"></span>${sysButtons()}`;
  const heroIdx = new Map(c.units.filter((u) => u.team === 'hero').map((u, i) => [u.id, i]));
  document.getElementById('init')!.innerHTML = c.order.map((id) => getUnit(c, id)!).filter((u) => u.hp > 0)
    .map((u) => `<span class="ini ${cur?.id === u.id ? 'on' : ''} ${u.team === 'hero' ? `p${heroIdx.get(u.id)! % 4}` : 'en'}">${esc(u.name)}<br><small>${u.hp}/${u.maxHp}</small></span>`).join('<span class="dim">›</span>');
  document.getElementById('bar')!.innerHTML = mine
    ? `<div class="card res"><span class="pill">PA ${mine.ap}/${mine.maxAp}</span><br><span class="blu">PM ${mine.mp}/${mine.maxMp}</span><br>PV ${mine.hp}/${mine.maxHp}</div>` +
      mine.spells.map((sp, i) => { const d = SPELLS[sp.id]!; const off = !myTurn || mine.ap < d.ap || sp.cd > 0 || mine.hp <= 0;
        return `<button class="spell ${board!.sel === d.id ? 'on' : ''}" data-act="spell" data-id="${d.id}" ${off ? 'disabled' : ''} title="${esc(d.text)}"><b>${i + 1}. ${esc(d.name)}</b><small>${d.ap} PA · ${d.range[1] === 0 ? 'propio' : `alcance ${d.range[0] === d.range[1] ? d.range[1] : `${d.range[0]}-${d.range[1]}`}`}${d.dmg ? ` · daño ${d.dmg[0]}-${d.dmg[1]}` : ''}${sp.cd > 0 ? ` · espera ${sp.cd}` : ''}</small><small class="dim">${esc(d.text)}</small></button>`; }).join('') +
      `<button class="pri" data-act="end" ${myTurn ? '' : 'disabled'}>Terminar turno</button>`
    : '<span class="dim">Estás como espectador en este combate.</span>';
  const lg = document.getElementById('log')!;
  lg.innerHTML = log.slice(-30).map((l) => `<div>${l}</div>`).join('');
  lg.scrollTop = 1e9;
}

const RAR = ['r0', 'r1', 'r2', 'r3'];
let leaveArmed = false;

/** Botones de sistema: sonido y abandonar (con confirmación en dos clics). */
function sysButtons(): string {
  const warn = session?.isHost && session.t.kind === 'online' ? '¿Seguro? Termina para todos' : '¿Seguro? Pulsa otra vez';
  return `<button data-act="mute" title="Sonido">${isMuted() ? '🔇' : '🔊'}</button><button data-act="leave" class="${leaveArmed ? 'danger' : ''}">${leaveArmed ? warn : 'Abandonar'}</button>`;
}

function topBar(run: RunState): string {
  const mine = run.heroes.find((h) => h.owner === myId);
  return `<div id="info" class="row"><b>Sala ${esc(run.code)}</b><span>Las Catacumbas Olvidadas</span>${mine ? `<span class="pill">Oro: ${mine.gold}</span><span>PV ${mine.hp}/${heroMaxHp(mine)}</span><span>Nivel ${mine.level}</span>` : '<span class="dim">Espectador</span>'}
  ${notice ? `<span class="bad">${esc(notice)}</span>` : ''}${!session!.hostPresent() ? '<span class="bad">Anfitrión desconectado: partida en pausa</span>' : ''}<span class="sp-r"></span>${sysButtons()}</div>`;
}

function itemHtml(it: Item | undefined, empty = 'vacío'): string {
  return it ? `<b class="${RAR[it.rarity]}">${esc(it.name)}</b> <span class="dim">${RARITY_NAME[it.rarity]}</span><br><span class="sp">${statsText(it.stats)}</span>${it.lore ? `<br><i class="dim sp">${esc(it.lore)}</i>` : ''}` : `<span class="dim">${empty}</span>`;
}

/** Qué cambia si me pongo `it` en lugar de lo que llevo en esa ranura. */
function diffHtml(it: Item, h: HeroSave): string {
  const old = h.equip[it.slot];
  if (!old) return '<span class="good sp">Ranura libre: todo es mejora</span>';
  const d = statDiff(it.stats, old.stats);
  const keys = Object.keys(d) as StatKey[];
  if (!keys.length) return '<span class="dim sp">Igual que lo que llevas</span>';
  return `<span class="sp dim">Frente a ${esc(old.name)}:</span><br>` + keys.map((k) => `<span class="sp ${d[k]! > 0 ? 'good' : 'bad'}">${d[k]! > 0 ? '+' : ''}${d[k]} ${STAT_NAME[k]}</span>`).join(' · ');
}

function heroCards(run: RunState): string {
  return `<div class="grid">${run.heroes.map((h, i) => `<div class="card"><b class="p${i % 4}">${esc(h.name)}</b> <span class="dim">Nv ${h.level}</span> <span class="pill sp">${h.gold} oro</span><br>${CLASSES[h.cls].name} · ${h.routes.map((r) => findRoute(h.cls, r)?.name).join(' + ')}<br>PV ${h.hp}/${heroMaxHp(h)}
    <div class="sp">${SLOTS.map((sl) => `<span class="dim">${SLOT_NAME[sl]}:</span> ${h.equip[sl] ? `<span class="${RAR[h.equip[sl]!.rarity]}" title="${esc(statsText(h.equip[sl]!.stats))}">${esc(h.equip[sl]!.name)}</span>` : '<span class="dim">—</span>'}`).join('<br>')}</div></div>`).join('')}</div>`;
}

function lootPanel(run: RunState, mine: HeroSave | undefined): string {
  const offer = mine ? run.offers[myId] : undefined;
  if (!offer || !mine) return '';
  return `<h3>Botín: elige un objeto <span class="dim">(si la ranura está ocupada va a tu mochila y decides después)</span></h3>
  <div class="grid">${offer.map((it, i) => `<div class="card"><span class="dim">${SLOT_NAME[it.slot]}</span><br>${itemHtml(it)}<hr>${diffHtml(it, mine)}<br><button class="pri" data-act="pick" data-id="${i}">Quedármelo</button></div>`).join('')}</div>
  <p><button data-act="pick" data-id="-1">No quiero ninguno</button></p>`;
}

/** Mi equipo: 8 ranuras, mochila, y dar o vender objetos. */
function gearPanel(run: RunState, mine: HeroSave | undefined, selling: boolean): string {
  if (!mine) return '';
  const others = run.heroes.filter((h) => h !== mine);
  const spec = { hp: heroMaxHp(mine) };
  return `<h3>Tu equipo <span class="dim">(PV máx. ${spec.hp})</span></h3>
  <div class="grid g4">${SLOTS.map((sl) => { const it = mine.equip[sl]; return `<div class="card slot"><span class="dim">${SLOT_NAME[sl]}</span><br>${itemHtml(it)}${it ? `<br><button class="mini" data-act="unequip" data-id="${sl}">Quitar</button>` : ''}</div>`; }).join('')}</div>
  <h3>Mochila <span class="dim">(${mine.bag.length}/${BAG_SIZE})</span></h3>
  ${mine.bag.length ? `<div class="grid">${mine.bag.map((it, i) => `<div class="card"><span class="dim">${SLOT_NAME[it.slot]}</span><br>${itemHtml(it)}<hr>${diffHtml(it, mine)}<br>
    <button class="mini pri" data-act="equip" data-id="${i}">Equipar</button>${others.map((o) => `<button class="mini" data-act="give" data-id="${i}" data-to="${esc(o.owner)}">Dar a ${esc(o.name)}</button>`).join('')}${selling ? `<button class="mini" data-act="sell" data-id="${i}">Vender (+${Math.floor(PRICE[it.rarity] / 3)} oro)</button>` : ''}</div>`).join('')}</div>` : '<p class="dim">Vacía. Los objetos que no equipes al momento se guardan aquí; puedes dárselos a un compañero o venderlos en la tienda.</p>'}`;
}

function mapScreen(): void {
  const s = session!, run = s.run!;
  const mine = run.heroes.find((h) => h.owner === myId);
  const pending = Object.keys(run.offers).length;
  root.innerHTML = `${topBar(run)}
  ${run.note ? `<div class="card c">${esc(run.note)}</div>` : ''}
  <div class="row map">${run.map.map((nodes, i) => `<div class="step ${i === run.step ? 'on' : i < run.step ? 'done' : ''}"><small>Sala ${i + 1}</small>${nodes.map((n) => `<span>${NODE_NAME[n]}</span>`).join('')}</div>`).join('<span class="dim">›</span>')}</div>
  <h3>Sala ${run.step + 1}: ${s.isHost ? 'elige el camino' : 'el anfitrión elige el camino'}</h3>
  <div class="grid">${(run.map[run.step] ?? []).map((n, i) => `<button class="card pickc" data-act="node" data-id="${i}" ${s.isHost ? '' : 'disabled'}><b>${NODE_NAME[n]}</b><br><span class="dim">${NODE_HINT[n]}</span></button>`).join('')}</div>
  ${s.isHost && pending ? `<p class="dim">${pending} jugador${pending > 1 ? 'es' : ''} aún eligiendo botín; si avanzas lo pierden.</p>` : ''}
  ${lootPanel(run, mine)}${gearPanel(run, mine, false)}
  <h3>El grupo</h3>${heroCards(run)}`;
}

function shopScreen(): void {
  const s = session!, run = s.run!;
  const mine = run.heroes.find((h) => h.owner === myId);
  root.innerHTML = `${topBar(run)}
  <div class="c"><h1>Mercader de reliquias</h1><p class="dim">Cada objeto solo puede comprarlo un jugador. Vende lo que te sobre de la mochila por un tercio de su precio.</p></div>
  <div class="grid">${(run.shop ?? []).map((sl, i) => `<div class="card ${sl.sold ? 'off' : ''}"><span class="dim">${SLOT_NAME[sl.item.slot]}</span><br>${itemHtml(sl.item)}<hr>${mine ? diffHtml(sl.item, mine) : ''}<br>
    <button class="pri" data-act="buy" data-id="${i}" ${sl.sold || !mine || mine.gold < sl.price ? 'disabled' : ''}>${sl.sold ? 'Vendido' : `Comprar · ${sl.price} oro`}</button></div>`).join('')}
    <div class="card"><b>Poción de vida</b><br><span class="sp">Recupera el ${POTION_HEAL * 100}% de tu vida máxima.</span><br><button class="pri" data-act="potion" ${!mine || mine.gold < POTION_PRICE || mine.hp >= heroMaxHp(mine) ? 'disabled' : ''}>Beber · ${POTION_PRICE} oro</button></div></div>
  <p class="c">${s.isHost ? '<button class="pri" data-act="leavenode">Salir de la tienda →</button>' : '<span class="dim">El anfitrión decide cuándo seguir.</span>'}</p>
  ${gearPanel(run, mine, true)}
  <h3>El grupo</h3>${heroCards(run)}`;
}

function endScreen(): void {
  const run = session!.run!;
  root.innerHTML = `${topBar(run)}<div class="c"><h1>${run.phase === 'won' ? '¡VICTORIA!' : 'HABÉIS CAÍDO'}</h1>
  <p class="dim">${run.phase === 'won' ? 'El Coloso del Osario se desmorona. Las Catacumbas guardan silencio... por ahora.' : `Las Catacumbas reclaman a otro grupo de aventureros en la sala ${run.step + 1}.`}</p></div>
  <h3>El grupo</h3>${heroCards(run)}<p class="c"><button class="pri" data-act="home">Volver al inicio</button></p>`;
}

function eventScreen(): void {
  const s = session!, run = s.run!, ev = run.event!;
  const def = ZONA1_EVENTS.find((e) => e.id === ev.id)!;
  const voters = (i: number): string => run.heroes.filter((h) => ev.votes[h.owner] === i).map((h) => esc(h.name)).join(', ');
  const canVote = run.heroes.some((h) => h.owner === myId) && !ev.result;
  root.innerHTML = `${topBar(run)}<div class="c"><h1>${esc(def.title)}</h1><p>${esc(def.text)}</p><p class="dim">Evento de grupo: decide la mayoría y afecta a todos. En caso de empate decide el anfitrión.</p></div>
  ${ev.result ? `<div class="card c"><b>${esc(ev.result)}</b></div>` : `<div class="grid">${def.options.map((o, i) => `<button class="card pickc ${ev.votes[myId] === i ? 'on' : ''}" data-act="vote" data-id="${i}" ${canVote ? '' : 'disabled'}><b>${esc(o.label)}</b><br><span class="dim">${esc(o.hint)}</span><br><span class="pill">${voters(i) ? `Votos: ${voters(i)}` : 'Sin votos'}</span></button>`).join('')}</div>`}
  <p class="c">${s.isHost ? (ev.result ? '<button class="pri" data-act="leavenode">Continuar →</button>' : `<button data-act="resolve" ${Object.keys(ev.votes).length ? '' : 'disabled'}>Cerrar la votación ya</button>`) : `<span class="dim">${ev.result ? 'Esperando al anfitrión…' : 'Votad todos para continuar.'}</span>`}</p>
  <h3>El grupo</h3>${heroCards(run)}`;
}

let lastKey = '';
function render(events: GameEvent[]): void {
  if (!session) return;
  const run = session.run;
  const want = !run ? 'lobby' : run.phase === 'combat' && run.combat ? 'combat' : run.phase === 'event' && run.event ? 'event' : run.phase === 'shop' ? 'shop' : run.phase === 'map' ? 'map' : 'end';
  // sin cambios reales no se redibuja: así un latido de red no interrumpe un clic
  const key = want + JSON.stringify([run, run ? null : session.lobby(), me, notice, session.hostPresent(), board?.sel ?? null, session.isMyTurn(), saved?.step, leaveArmed, isMuted()]);
  if (key === lastKey && want === screen && !events.length) return;
  lastKey = key;
  if (want === 'combat') combat(events);
  else {
    board?.destroy();
    board = null;
    if (want === 'lobby') lobby(); else if (want === 'event') eventScreen(); else if (want === 'shop') shopScreen(); else if (want === 'map') mapScreen(); else endScreen();
  }
  screen = want;
}

// ---------- entrada ----------
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const id = el.dataset.id ?? '';
  sfx.click();
  switch (el.dataset.act) {
    case 'create': void enter(randomText(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ'), true, false); break;
    case 'solo': void enter(randomText(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ'), true, true); break;
    case 'join': { const code = (document.getElementById('code') as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''); if (code.length === 4) void enter(code, false, false); break; }
    case 'resume': { const h = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null; if (h) void enter(h.code, true, false, true); break; }
    case 'doresume': if (saved) { log.length = 0; session?.resume(saved); } break;
    case 'home': home(); break;
    case 'cls': me.cls = id as ClassId; me.routes = []; publish(); render([]); break;
    case 'route':
      if (me.routes.includes(id)) me.routes = me.routes.filter((r) => r !== id);
      else if (canPickRoute(me.cls, me.routes, id)) me.routes = [...me.routes, id];
      publish(); render([]); break;
    case 'start': log.length = 0; session?.startRun(); break;
    case 'node': log.length = 0; session?.choose(Number(id)); break;
    case 'leavenode': session?.leaveNode(); break;
    case 'equip': session?.act({ a: 'equip', idx: Number(id) }); break;
    case 'unequip': session?.act({ a: 'unequip', slot: id as Slot }); break;
    case 'give': session?.act({ a: 'give', idx: Number(id), to: el.dataset.to ?? '' }); break;
    case 'sell': session?.act({ a: 'sell', idx: Number(id) }); sfx.coin(); break;
    case 'buy': session?.act({ a: 'buy', idx: Number(id) }); sfx.coin(); break;
    case 'potion': session?.act({ a: 'potion' }); break;
    case 'mute': toggleMute(); render([]); break;
    case 'leave':
      if (leaveArmed) { leaveArmed = false; home(); }
      else { leaveArmed = true; render([]); setTimeout(() => { leaveArmed = false; render([]); }, 4000); }
      break;
    case 'skip': session?.skipTurn(); break;
    case 'pick': session?.act({ a: 'pick', idx: Number(id) }); break;
    case 'vote': session?.act({ a: 'vote', idx: Number(id) }); break;
    case 'resolve': session?.resolve(); break;
    case 'end': session?.act({ a: 'end' }); break;
    case 'spell': pickSpell(id); break;
  }
});

function pickSpell(id: string): void {
  const d = SPELLS[id], u = session?.myUnit();
  if (!d || !u || !board || !session?.isMyTurn()) return;
  if (d.range[1] === 0) session.act({ a: 'cast', spell: id, at: u.pos });
  else board.select(board.sel === id ? null : id);
}

document.addEventListener('keydown', (e) => {
  if (screen !== 'combat' || !session?.isMyTurn() || (e.target as HTMLElement).tagName === 'INPUT') return;
  const u = session.myUnit();
  const n = Number(e.key);
  if (u && n >= 1 && n <= u.spells.length) {
    const sp = u.spells[n - 1]!;
    if (sp.cd === 0 && u.ap >= SPELLS[sp.id]!.ap) pickSpell(sp.id);
  } else if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); session.act({ a: 'end' }); }
  else if (e.key === 'Escape') board?.select(null);
});

// el reloj del turno
setInterval(() => {
  const el = document.getElementById('clock');
  if (!el || !session) return;
  const left = session.turnEndsAt ? Math.max(0, Math.ceil((session.turnEndsAt - Date.now()) / 1000)) : 0;
  el.textContent = left && !session.run?.combat?.over ? `${left}s` : '';
}, 500);

export function boot(): void {
  home();
}

// Acceso para pruebas automáticas (no lo usa el juego).
(window as unknown as { __rda: unknown }).__rda = { get session() { return session; } };
