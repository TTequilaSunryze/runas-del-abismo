// Arranque de la interfaz: conexión a la sala, redibujado y entrada del usuario.
import { isMuted, playEvents, sfx, toggleMute } from '../audio/sfx';
import { canPickRoute } from '../core/classes/classes';
import { apCost, spellOf } from '../core/combat/engine';
import type { Slot } from '../core/items/items';
import type { ClassId, GameEvent } from '../core/state';
import type { RunState } from '../game/run';
import { Session } from '../game/session';
import { dailyScore, loadable } from '../game/run';
import { joinRoom, loadRun, submitDaily, topDaily } from '../net/transport';
import { readSnapshot } from '../game/snapshot';
import { addLog, combatScreen } from './combat';
import { esc, mine, params, randomText, store, today, ui } from './ctx';
import { BAG_SIZE, PRICE } from '../core/items/items';
import { buyPerk, masteryOf, meta, myNemesis, myTeam, openRoutes, removeChampion, saveChampion, saveMeta, toggleTeam } from '../game/meta';
import { currentAccount, fetchTeam, restoreAccount, signIn, signOut, signUp } from '../net/account';
import { addFriend, invite, removeFriend, setRoom, socialHandlers } from '../net/social';
import { championOf } from '../game/run';
import { MAX_ASC } from '../content/modes';
import { setMusicVolume, setZoneMusic } from '../audio/sfx';
import { gotFromBoss, gotModal, itemHtml, mapModal, statsModal, victoryModal } from './panels';
import { endScreen, eventScreen, homeScreen, lobbyScreen, mapScreen, shopScreen } from './screens';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function publish(): void {
  const m = meta();
  ui.session?.announce({ name: ui.me.name, cls: ui.me.cls, routes: ui.me.routes, host: ui.session.isHost, perks: m.perks, unlocked: m.unlocked, asc: Math.min(ui.asc, m.maxAsc, MAX_ASC), daily: ui.daily ? today() : null,
    mastery: masteryOf(ui.me.cls), nem: myNemesis(), hasTeam: myTeam().length > 0,
    mods: ui.daily ? [] : ui.mods, abyss: !ui.daily && m.stats.wins > 0 });
}

function home(msg = ''): void {
  setZoneMusic('menu');
  setRoom(null);
  ui.session?.leave();
  ui.session = null;
  ui.board?.destroy();
  ui.board = null;
  ui.screen = 'home';
  hideTip();
  homeScreen(msg);
}

async function enter(code: string, isHost: boolean, local: boolean, resume = false): Promise<void> {
  const nameEl = document.getElementById('name') as HTMLInputElement | null;
  ui.me.name = (nameEl?.value ?? ui.me.name).trim().slice(0, 14) || 'Héroe';
  store.set('rda_name', ui.me.name);
  ui.root.innerHTML = `<div class="home"><p>Conectando a la sala ${code}…</p></div>`;
  let secret = '';
  if (isHost) {
    const old = JSON.parse(store.get('rda_host') ?? 'null') as { code: string; secret: string } | null;
    secret = resume && old ? old.secret : randomText(24, 'abcdefghijklmnopqrstuvwxyz0123456789');
    if (!local) store.set('rda_host', JSON.stringify({ code, secret }));
  }
  let session: Session;
  try {
    session = new Session(await joinRoom(code, ui.myId, local || params.has('local')), ui.myId, code, isHost, secret);
  } catch (e) {
    home(`${(e as Error).message}. Revisa tu conexión e inténtalo de nuevo.`);
    return;
  }
  ui.session = session;
  session.teamProvider = () => myTeam();
  if (session.t.kind === 'online') setRoom(code);
  ui.saved = null;
  ui.notice = '';
  if (resume && isHost) {
    // primero la copia local (la más reciente); si no, la de la nube
    const snap = readSnapshot();
    const localRun = snap?.code === code && snap.run && loadable(snap.run) ? snap.run : null;
    const run = localRun ?? (local ? null : ((await loadRun(code)) as RunState | null));
    if (loadable(run) && run.phase !== 'won' && run.phase !== 'lost') ui.saved = run;
    else ui.notice = 'No se encontró una partida guardada que se pueda continuar.';
  }
  let wasMyTurn = false;
  session.onChange = (ev) => {
    addLog(ev);
    playEvents(ev);
    const now = session.isMyTurn();
    if (now && !wasMyTurn) sfx.myTurn();
    wasMyTurn = now;
    render(ev);
  };
  session.onError = (text) => { ui.notice = text; render([]); setTimeout(() => { ui.notice = ''; render([]); }, 2500); };
  session.onLobby = () => render([]);
  publish();
  render([]);
  // sala inexistente: nadie es anfitrión
  if (!isHost) setTimeout(() => { if (ui.session === session && !session.run && !session.hostPresent()) home(`No hay ninguna sala abierta con el código ${code}. Comprueba el código y que el anfitrión siga en la sala.`); }, 15000);
}

let lastKey = '';
function render(events: GameEvent[]): void {
  const s = ui.session;
  if (!s) return;
  const run = s.run;
  const want = !run ? 'lobby' : run.phase === 'combat' && run.combat ? 'combat' : run.phase === 'event' && run.event ? 'event' : run.phase === 'shop' ? 'shop' : run.phase === 'map' ? 'map' : 'end';
  // sin cambios reales no se redibuja: así un latido de red no interrumpe un clic
  const key = want + JSON.stringify([meta().ecos, ui.asc, ui.daily, ui.mods, ui.abyss, run, run ? null : s.lobby(), ui.me, ui.notice, s.hostPresent(), s.t.connected(), ui.board?.sel ?? null, s.isMyTurn(), ui.saved?.step, ui.leaveArmed, isMuted(), ui.selItem, ui.tab, ui.logOpen, ui.statsOpen, ui.mapOpen]);
  if (key === lastKey && want === ui.screen && !events.length) return;
  lastKey = key;
  if (want !== ui.screen) hideTip();
  const meH = run?.heroes.find((h) => h.owner === ui.myId);
  setZoneMusic(!run ? 'lobby' : want === 'combat' ? (run.kind === 'boss' ? 'boss' : 'combat') : want === 'end' ? 'end' : want === 'shop' ? 'calm'
    : want === 'event' || meH?.boonOffer || meH?.bossOffer ? 'choice' : `map${Math.min(3, run.zone)}`);
  if (want === 'combat') combatScreen(events);
  else {
    ui.board?.destroy();
    ui.board = null;
    ({ lobby: lobbyScreen, event: eventScreen, shop: shopScreen, map: mapScreen, end: endScreen })[want]();
  }
  ui.screen = want;
  // ficha del personaje por encima de cualquier pantalla
  document.getElementById('statsmodal')?.remove();
  if (ui.statsOpen && run) ui.root.insertAdjacentHTML('beforeend', statsModal(run));
  document.getElementById('gotmodal')?.remove();
  if (ui.got) ui.root.insertAdjacentHTML('beforeend', gotModal(ui.got));
  document.getElementById('victorymodal')?.remove();
  if (run && run.phase === 'map' && run.report && !run.arena && ui.reportClosed !== run.report.stamp) ui.root.insertAdjacentHTML('beforeend', victoryModal(run));
  document.getElementById('mapmodal')?.remove();
  if (ui.mapOpen && run && !run.arena) ui.root.insertAdjacentHTML('beforeend', mapModal(run));
  if (want === 'end' && run && run.daily && s.isHost && run.heroes.length) {
    const k = `${run.code}:${run.daily}:${run.zone}:${run.step}:${run.phase}`;
    if (k !== submitted) { submitted = k; void submitDaily({ day: run.daily, code: run.code, names: run.heroes.map((h) => h.name).join(', ').slice(0, 60), players: run.heroes.length, score: dailyScore(run), won: run.phase === 'won', zone: Math.min(2, run.zone) }); }
  }
}
let submitted = '';
ui.rerender = () => render([]);

/** Duelo contra un equipo llevado por la IA, en una sala local. */
async function duel(foe: { name: string; team: unknown[] }): Promise<void> {
  await enter(randomText(4, CODE_CHARS), true, true);
  ui.log.length = 0;
  if (!ui.session?.startArena(currentAccount()?.name ?? ui.me.name, myTeam(), { owner: null, name: foe.name, team: foe.team })) home('No se pudo empezar el duelo: algún equipo no tiene héroes válidos.');
}

function pickSpell(id: string): void {
  const s = ui.session, u = s?.myUnit();
  const d = u && spellOf(u, id);
  if (!d || !u || !ui.board || !s?.isMyTurn()) return;
  if (d.range[1] === 0) s.act({ a: 'cast', spell: id, at: u.pos });
  else ui.board.select(ui.board.sel === id ? null : id);
}

document.addEventListener('click', (e) => {
  // clic en el fondo de un cartel: lo cierra
  const bg = e.target as HTMLElement;
  if (bg.id === 'mapmodal') { ui.mapOpen = false; lastKey = ''; render([]); return; }
  if (bg.id === 'statsmodal') { ui.statsOpen = false; lastKey = ''; render([]); return; }
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const id = el.dataset.id ?? '';
  const s = ui.session;
  if (el.dataset.act !== 'togglelog') sfx.click();
  switch (el.dataset.act) {
    case 'create': void enter(randomText(4, CODE_CHARS), true, false); break;
    case 'solo': void enter(randomText(4, CODE_CHARS), true, true); break;
    case 'join': { const code = (document.getElementById('code') as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''); if (code.length === 4) void enter(code, false, false); break; }
    case 'reconnect': {
      const snap = readSnapshot();
      if (!snap) break;
      void enter(snap.code, snap.host, snap.local, snap.host).then(() => { if (snap.host && ui.saved) { ui.log.length = 0; ui.session?.resume(ui.saved); } });
      break;
    }
    case 'resume': { const h = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null; if (h) void enter(h.code, true, false, true); break; }
    case 'doresume': if (ui.saved) { ui.log.length = 0; s?.resume(ui.saved); } break;
    case 'home': home(); break;
    case 'cls': ui.me.cls = id as ClassId; ui.me.routes = ['base']; publish(); render([]); break;
    case 'route':
      // un solo kit: elegir otro lo sustituye
      if (canPickRoute(ui.me.cls, [], id) && openRoutes(ui.me.cls).includes(id)) ui.me.routes = [id];
      publish(); render([]); break;
    case 'start': ui.log.length = 0; ui.tab = 'equipo'; s?.startRun(); break;
    case 'node': ui.log.length = 0; s?.choose(Number(id)); break;
    case 'leavenode': s?.leaveNode(); break;
    case 'resolve': s?.resolve(); break;
    case 'skip': s?.skipTurn(); break;
    case 'pick': s?.act({ a: 'pick', idx: Number(id) }); break;
    case 'vote': s?.act({ a: 'vote', idx: Number(id) }); break;
    case 'tab': ui.tab = id as typeof ui.tab; render([]); break;
    case 'selitem': ui.selItem = ui.selItem === id ? '' : id; render([]); break;
    case 'equip': s?.act({ a: 'equip', idx: Number(id) }); ui.selItem = ''; break;
    case 'unequip': s?.act({ a: 'unequip', slot: id as Slot }); ui.selItem = ''; break;
    case 'give': s?.act({ a: 'give', idx: Number(id), to: el.dataset.to ?? '' }); ui.selItem = ''; break;
    case 'sell': s?.act({ a: 'sell', idx: Number(id) }); ui.selItem = ''; sfx.coin(); break;
    case 'drop': s?.act({ a: 'drop', idx: Number(id) }); ui.selItem = ''; break;
    case 'buy': s?.act({ a: 'buy', idx: Number(id) }); sfx.coin(); break;
    case 'potion': s?.act({ a: 'potion' }); break;
    case 'htab':
      ui.homeTab = id as typeof ui.homeTab;
      if (ui.homeTab === 'diario' && ui.board2 !== 'cargando') { ui.board2 = 'cargando'; void topDaily(today()).then((r) => { ui.board2 = r ?? 'error'; if (ui.screen === 'home') homeScreen(''); }); }
      homeScreen(''); break;
    case 'perk': buyPerk(id); homeScreen(''); break;
    case 'tuto': ui.tutorial = 0; meta().seenTutorial = false; homeScreen(''); break;
    case 'tutonext': ui.tutorial++; if (ui.tutorial >= 5) { meta().seenTutorial = true; saveMeta(); } homeScreen(''); break;
    case 'tutoskip': meta().seenTutorial = true; saveMeta(); homeScreen(''); break;
    case 'ascup': ui.asc = Math.min(meta().maxAsc, ui.asc + 1); publish(); render([]); break;
    case 'ascdown': ui.asc = Math.max(0, ui.asc - 1); publish(); render([]); break;
    case 'again': ui.log.length = 0; s?.backToLobby(); break;
    case 'reroll': s?.act({ a: 'reroll' }); break;
    case 'bossreward': {
      const o = s?.run ? mine(s.run)?.bossOffer?.[Number(id)] : undefined;
      if (o) ui.got = gotFromBoss(o);
      s?.act({ a: 'bossreward', idx: Number(id) });
      break;
    }
    case 'report': ui.reportClosed = s?.run?.report?.stamp ?? -1; lastKey = ''; render([]); break;
    case 'boon': s?.act({ a: 'boon', idx: Number(id) }); break;
    case 'ready': s?.act({ a: 'ready' }); break;
    case 'forceready': s?.forceReady(); break;
    case 'addfriend': {
      const name = (document.getElementById('friend') as HTMLInputElement).value;
      ui.friendMsg = 'Buscando…'; homeScreen('');
      void addFriend(name).then((err) => { ui.friendMsg = err ?? 'Amigo añadido. Pídele que te añada también para recibir sus invitaciones.'; if (ui.screen === 'home') homeScreen(''); });
      break;
    }
    case 'delfriend': removeFriend(id); homeScreen(''); break;
    case 'joinfriend': case 'acceptinv': ui.invites = ui.invites.filter((x) => x.code !== id); drawInvites(); void enter(id, false, false); break;
    case 'dropinv': ui.invites = ui.invites.filter((x) => x.code !== id); drawInvites(); break;
    case 'invite': if (s) { invite(id, s.code); ui.notice = `Invitación enviada a ${id}`; render([]); setTimeout(() => { ui.notice = ''; render([]); }, 2500); } break;
    case 'stash': {
      const op = (el.dataset.op ?? 'bag') as 'equip' | 'bag' | 'split';
      const it = s?.run?.stash?.[Number(id)], me = s?.run ? mine(s.run) : undefined;
      if (it && me) {
        const full = me.bag.length >= BAG_SIZE;
        if (op === 'split') ui.got = { title: 'Botín repartido', html: `${itemHtml(it, true)}<p class="good">Vendido por ${Math.floor(PRICE[it.rarity] / 2)} de oro, repartido entre el grupo.</p>` };
        else if (!(op === 'bag' ? full : full && me.equip[it.slot])) ui.got = { title: '¡Has obtenido!', html: `${itemHtml(it, true)}<p class="dim sm">${op === 'equip' ? 'Equipado ahora mismo.' : 'Guardado en tu mochila.'}</p>` };
      }
      s?.act({ a: 'stash', idx: Number(id), op });
      break;
    }
    case 'gotok': ui.got = null; lastKey = ''; render([]); break;
    case 'deployready': s?.act({ a: 'deployready' }); break;
    case 'readyall': s?.act({ a: 'deployready', force: true }); break;
    case 'bars': ui.hpBars = !ui.hpBars; if (ui.board) ui.board.showBars = ui.hpBars; lastKey = ''; render([]); break;
    case 'side': ui.sideOpen = !ui.sideOpen; lastKey = ''; render([]); break;
    case 'map': ui.mapOpen = !ui.mapOpen; lastKey = ''; render([]); break;
    case 'stats': ui.statsOpen = !ui.statsOpen; lastKey = ''; render([]); break;
    case 'mod': ui.mods = ui.mods.includes(id) ? ui.mods.filter((x) => x !== id) : ui.mods.length < 3 ? [...ui.mods, id] : ui.mods; publish(); render([]); break;
    case 'champsave': { const h = s?.run?.heroes.find((x) => x.owner === ui.myId); if (s?.run && h) { saveChampion({ ...championOf(s.run, h), by: currentAccount()?.name ?? ui.me.name }); publish(); lastKey = ''; render([]); } break; }
    case 'champdel': removeChampion(id); homeScreen(''); break;
    case 'champteam': toggleTeam(id); homeScreen(''); break;
    case 'duelmirror': void duel({ name: 'Tu reflejo', team: myTeam() }); break;
    case 'duelai': {
      const name = (document.getElementById('foe') as HTMLInputElement).value.trim();
      if (!name) break;
      ui.busy = true; ui.hallMsg = `Buscando el equipo de ${name}…`; homeScreen('');
      void fetchTeam(name).then((t) => {
        ui.busy = false;
        if (!t) { ui.hallMsg = `No se encontró un equipo guardado para “${name}”. Tiene que tener cuenta, haber entrado y tener héroes en su equipo.`; if (ui.screen === 'home') homeScreen(''); return; }
        ui.hallMsg = '';
        void duel(t);
      });
      break;
    }
    case 'duel': s?.challenge(id); break;
    case 'login': case 'signup': {
      const v = (k: string): string => (document.getElementById(k) as HTMLInputElement | null)?.value ?? '';
      const signup = el.dataset.act === 'signup';
      // se leen los campos ANTES de redibujar (al redibujar se vacían)
      const email = v('acemail').trim(), pass = v('acpass'), name = v('acname').trim();
      ui.acEmail = email; ui.acName = name;
      if (!email || !pass) { ui.acctMsg = 'Escribe tu email y tu contraseña.'; homeScreen(''); break; }
      if (signup && pass.length < 6) { ui.acctMsg = 'La contraseña debe tener al menos 6 caracteres.'; homeScreen(''); break; }
      ui.busy = true; ui.acctMsg = 'Conectando…'; homeScreen('');
      void (signup ? signUp(email, pass, name) : signIn(email, pass)).then((err) => {
        ui.busy = false; ui.acctMsg = err ?? 'Has entrado. Tu progreso ya se guarda en la cuenta.';
        if (ui.screen === 'home') homeScreen('');
      });
      break;
    }
    case 'logout': ui.busy = true; void signOut().then(() => { ui.busy = false; ui.acctMsg = 'Sesión cerrada. Tu progreso sigue en este navegador.'; if (ui.screen === 'home') homeScreen(''); }); break;
    case 'end': s?.act({ a: 'end' }); break;
    case 'spell': pickSpell(id); break;
    case 'togglelog': ui.logOpen = !ui.logOpen; render([]); break;
    case 'mute': toggleMute(); if (ui.screen === 'home') homeScreen(''); else { lastKey = ''; render([]); } break;
    case 'leave':
      if (ui.leaveArmed) { ui.leaveArmed = false; home(); }
      else { ui.leaveArmed = true; render([]); setTimeout(() => { ui.leaveArmed = false; render([]); }, 4000); }
      break;
  }
  hideTip();
});

document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'vol') setMusicVolume(Number(el.value) / 100);
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset?.act === 'dailytoggle') { ui.daily = el.checked; publish(); render([]); }
  if (el.dataset?.act === 'abysstoggle') { ui.abyss = el.checked; publish(); render([]); }
});

document.addEventListener('keydown', (e) => {
  const s = ui.session;
  if ((e.target as HTMLElement).tagName !== 'INPUT' && s?.run && !s.run.arena && (e.key === 'm' || e.key === 'M' || (e.key === 'Escape' && ui.mapOpen))) { ui.mapOpen = e.key === 'Escape' ? false : !ui.mapOpen; lastKey = ''; render([]); return; }
  if ((e.target as HTMLElement).tagName !== 'INPUT' && s?.run && !s.run.arena && (e.key === 's' || e.key === 'S' || (e.key === 'Escape' && ui.statsOpen))) { ui.statsOpen = e.key === 'Escape' ? false : !ui.statsOpen; lastKey = ''; render([]); return; }
  if (ui.screen === 'combat' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.key === 'v' || e.key === 'V')) { ui.hpBars = !ui.hpBars; if (ui.board) ui.board.showBars = ui.hpBars; lastKey = ''; render([]); return; }
  if (ui.screen !== 'combat' || !s?.isMyTurn() || (e.target as HTMLElement).tagName === 'INPUT') return;
  const u = s.myUnit();
  const n = Number(e.key);
  if (u && n >= 1 && n <= u.spells.length) {
    const sp = u.spells[n - 1]!;
    if (sp.cd === 0 && (sp.charges === undefined || sp.charges > 0) && u.ap >= apCost(u, sp.id, s.run?.combat ?? undefined)) pickSpell(sp.id);
  } else if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); s.act({ a: 'end' }); }
  else if (e.key === 'Escape') ui.board?.select(null);
});

// ---------- ayuda flotante ----------
const tipEl = document.createElement('div');
tipEl.id = 'tip';
document.body.appendChild(tipEl);
function hideTip(): void {
  tipEl.style.display = 'none';
}
// en pantallas táctiles el tooltip sale al tocar y se quita solo
let lastTouch = 0, tipTimer = 0, pressTimer = 0, pressed = false;

/** Muestra el tooltip de `el` encima (o debajo si no cabe). */
function showTip(el: HTMLElement): void {
  tipEl.innerHTML = el.dataset.tip ?? '';
  tipEl.style.display = 'block';
  const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
  const x = Math.max(6, Math.min(innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2));
  const above = r.top - t.height - 8;
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${above > 4 ? above : r.bottom + 8}px`;
}

// táctil: un toque normal NO enseña la descripción (para no tapar el tablero);
// se ve manteniendo pulsado medio segundo, y ese toque largo no activa el botón
document.addEventListener('touchstart', (e) => {
  lastTouch = Date.now();
  pressed = false;
  clearTimeout(pressTimer);
  hideTip();
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (el) pressTimer = window.setTimeout(() => { pressed = true; showTip(el); clearTimeout(tipTimer); tipTimer = window.setTimeout(hideTip, 4000); }, 450);
}, { passive: true });
document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
document.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
document.addEventListener('click', (e) => { if (pressed) { pressed = false; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('contextmenu', (e) => { if (Date.now() - lastTouch < 1000 && (e.target as HTMLElement).closest('[data-tip]')) e.preventDefault(); });
document.addEventListener('scroll', () => hideTip(), { passive: true, capture: true });
document.addEventListener('mouseover', (e) => {
  if (Date.now() - lastTouch < 1000) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (!el) { hideTip(); return; }
  showTip(el);
});

// el reloj del turno
setInterval(() => {
  const el = document.getElementById('clock'), s = ui.session;
  if (!el || !s) return;
  const left = s.turnEndsAt ? Math.max(0, Math.ceil((s.turnEndsAt - Date.now()) / 1000)) : 0;
  el.textContent = left && !s.run?.combat?.over ? `${left}s` : '';
}, 500);

// Acceso para pruebas automáticas (no lo usa el juego).
(window as unknown as { __rda: unknown }).__rda = { get session() { return ui.session; } };

/** Invitaciones recibidas: aviso flotante con «Unirme». */
function drawInvites(): void {
  document.getElementById('invites')?.remove();
  const fresh = ui.invites.filter((i) => Date.now() - i.at < 120000);
  if (!fresh.length) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="invites" class="toast">${fresh.map((i) => `<div class="panel"><b>✉ ${esc(i.from)}</b> te invita a su sala <b>${i.code}</b><div class="row"><button class="pri mini" data-act="acceptinv" data-id="${i.code}">Unirme</button><button class="mini" data-act="dropinv" data-id="${i.code}">Ahora no</button></div></div>`).join('')}</div>`);
}
socialHandlers(() => { if (ui.screen === 'home') homeScreen(''); else if (ui.screen === 'lobby') { lastKey = ''; render([]); } }, (inv) => {
  ui.invites = [...ui.invites.filter((x) => x.code !== inv.code), inv].slice(-3);
  drawInvites();
  sfx.coin();
});

export function boot(): void {
  home();
  // si había sesión de cuenta, se recupera y se refresca la pantalla de inicio
  void restoreAccount().then(() => { if (ui.screen === 'home' && currentAccount()) homeScreen(''); });
}
