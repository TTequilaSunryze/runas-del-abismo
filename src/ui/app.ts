// Pantallas: inicio, sala, combate, entre combates y final.
import { CLASSES, blockedRoutes, canPickRoute, findRoute, MAX_ROUTES } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { current, getUnit } from '../core/combat/engine';
import type { ClassId, GameEvent } from '../core/state';
import type { RunState } from '../game/run';
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
  session?.t.setPresence({ name: me.name, cls: me.cls, routes: me.routes, host: session.isHost });
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
    if (run && run.version === 1 && run.phase === 'between') saved = run;
    else notice = 'No se encontró una partida guardada que se pueda continuar.';
  }
  session.onChange = (ev) => { addLog(ev); render(ev); };
  session.onError = (text) => { notice = text; render([]); setTimeout(() => { notice = ''; render([]); }, 2500); };
  session.t.onPeers(() => render([]));
  publish();
  render([]);
  // sala inexistente: nadie es anfitrión
  if (!isHost) setTimeout(() => { if (session && !session.run && !session.hostPresent()) home(`No hay ninguna sala abierta con el código ${code}.`); }, 6000);
}

// ---------- sala ----------
function lobby(): void {
  const s = session!;
  const players = s.lobby();
  const cls = CLASSES[me.cls];
  const blocked = blockedRoutes(me.cls, me.routes);
  const ready = players.slice(0, 4).filter((p) => p.routes.length > 0);
  root.innerHTML = `<h2>Sala <span class="code">${esc(s.code)}</span> ${s.t.kind === 'local' ? '<span class="dim">(local)</span>' : ''}</h2>
  <p class="dim">${s.isHost ? 'Comparte el código. Cuando todos tengan clase y ruta, pulsa Comenzar.' : s.hostPresent() ? 'Elige clase y rutas. El anfitrión comienza la partida.' : 'Buscando al anfitrión…'}</p>
  ${notice ? `<p class="bad">${esc(notice)}</p>` : ''}
  <div class="grid">${players.map((p, i) => `<div class="card ${i > 3 ? 'off' : ''}"><b class="p${i % 4}">${esc(p.name)}</b> ${p.host ? '👑' : ''} ${p.id === myId ? '<span class="dim">(tú)</span>' : ''}<br>${esc(CLASSES[p.cls]?.name ?? '?')}<br><span class="dim">${p.routes.map((r) => esc(findRoute(p.cls, r)?.name ?? r)).join(' + ') || 'sin ruta todavía'}</span>${i > 3 ? '<br><span class="bad">Sala llena</span>' : ''}</div>`).join('')}</div>
  <h3>Tu clase</h3>
  <div class="grid">${(Object.keys(CLASSES) as ClassId[]).map((id) => { const c = CLASSES[id]; return `<button class="card pickc ${id === me.cls ? 'on' : ''}" data-act="cls" data-id="${id}"><b>${c.name}</b><br><span class="dim">PV ${c.hp} · PA ${c.ap} · PM ${c.mp} · Iniciativa ${c.initiative}</span></button>`; }).join('')}</div>
  <h3>Tus rutas <span class="dim">(elige 1 o ${MAX_ROUTES}; cada ruta bloquea a su opuesta)</span></h3>
  <div class="grid">${cls.routes.map((r) => {
    const on = me.routes.includes(r.id), off = !on && blocked.includes(r.id);
    const why = off ? (me.routes.includes(r.opposite) ? `Bloqueada por ${findRoute(me.cls, r.opposite)!.name}` : 'Ya tienes 2 rutas') : `Opuesta: ${findRoute(me.cls, r.opposite)!.name}`;
    return `<button class="card pickc ${on ? 'on' : ''} ${off ? 'off' : ''}" data-act="route" data-id="${r.id}" ${off ? 'disabled' : ''}><b>${r.name}</b> ${on ? '✔' : ''}<br><span class="dim">${r.text}</span><br>${r.spells.map((id) => `<span class="sp">${esc(SPELLS[id]!.name)}: ${esc(SPELLS[id]!.text)}</span>`).join('<br>')}<br><i class="${off ? 'bad' : 'dim'}">${why}</i></button>`;
  }).join('')}</div>
  <p>${s.isHost ? `<button class="pri" data-act="start" ${ready.length && ready.length === Math.min(4, players.length) ? '' : 'disabled'}>⚔️ Comenzar (${ready.length} de ${Math.min(4, players.length)} listos)</button> ${saved ? `<button data-act="doresume">Reanudar partida guardada (combate ${saved.fight + 1} de ${saved.total})</button>` : ''}` : ''} <button data-act="home">Salir</button></p>`;
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
    board.onSelect = () => combat([]);
  }
  board!.applyEvents(events);
  const cur = current(c), mine = s.myUnit(), myTurn = s.isMyTurn();
  if (!myTurn && board!.sel) board!.sel = null;
  const left = s.turnEndsAt ? Math.max(0, Math.ceil((s.turnEndsAt - Date.now()) / 1000)) : 0;
  document.getElementById('info')!.innerHTML = `<b>Combate ${run.fight + 1} de ${run.total}</b><span>Ronda ${c.round}</span>
    <span class="${myTurn ? 'pill' : ''}">${c.over ? (c.over === 'win' ? '¡Victoria!' : 'Derrota') : myTurn ? 'TU TURNO' : cur ? `Turno de ${esc(cur.name)}` : ''}</span><span id="clock" class="dim">${left && !c.over ? `${left}s` : ''}</span>
    ${notice ? `<span class="bad">${esc(notice)}</span>` : ''}${!s.hostPresent() ? '<span class="bad">Anfitrión desconectado: la partida está en pausa</span>' : ''}
    ${s.isHost && cur && !cur.ai && !myTurn && !c.over ? '<button data-act="skip">Pasar su turno</button>' : ''}`;
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

function between(): void {
  const s = session!, run = s.run!;
  const end = run.phase !== 'between';
  root.innerHTML = `<div class="c"><h1>${run.phase === 'won' ? '¡VICTORIA!' : run.phase === 'lost' ? 'HABÉIS CAÍDO' : `Combate ${run.fight} de ${run.total} superado`}</h1>
  <p class="dim">${run.phase === 'won' ? 'El Caballero sepulcral cae. Las Catacumbas guardan silencio... por ahora.' : run.phase === 'lost' ? 'Las Catacumbas reclaman a otro grupo de aventureros.' : 'Los caídos vuelven con el 30% de vida; los demás recuperan un 25%. La partida queda guardada.'}</p></div>
  <div class="grid">${run.heroes.map((h, i) => `<div class="card"><b class="p${i % 4}">${esc(h.name)}</b><br>${CLASSES[h.cls].name} · ${h.routes.map((r) => findRoute(h.cls, r)?.name).join(' + ')}<br>PV ${h.hp}/${CLASSES[h.cls].hp}</div>`).join('')}</div>
  <p class="c">${end ? '' : s.isHost ? '<button class="pri" data-act="next">Siguiente combate →</button>' : '<span class="dim">Esperando al anfitrión…</span>'} <button data-act="home">${end ? 'Volver al inicio' : 'Salir'}</button></p>`;
}

function render(events: GameEvent[]): void {
  if (!session) return;
  const run = session.run;
  const want = !run ? 'lobby' : run.phase === 'combat' && run.combat ? 'combat' : 'end';
  if (want === 'combat') combat(events);
  else {
    board?.destroy();
    board = null;
    if (want === 'lobby') lobby(); else between();
  }
  screen = want;
}

// ---------- entrada ----------
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const id = el.dataset.id ?? '';
  switch (el.dataset.act) {
    case 'create': void enter(randomText(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ'), true, false); break;
    case 'solo': void enter(randomText(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ'), true, true); break;
    case 'join': { const code = (document.getElementById('code') as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''); if (code.length === 4) void enter(code, false, false); break; }
    case 'resume': { const h = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null; if (h) void enter(h.code, true, false, true); break; }
    case 'doresume': if (saved) { log.length = 0; session?.resume(saved); } break;
    case 'home': home(); break;
    case 'cls': me.cls = id as ClassId; me.routes = []; publish(); lobby(); break;
    case 'route':
      if (me.routes.includes(id)) me.routes = me.routes.filter((r) => r !== id);
      else if (canPickRoute(me.cls, me.routes, id)) me.routes = [...me.routes, id];
      publish(); lobby(); break;
    case 'start': log.length = 0; session?.startRun(); break;
    case 'next': log.length = 0; session?.nextFight(); break;
    case 'skip': session?.skipTurn(); break;
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
