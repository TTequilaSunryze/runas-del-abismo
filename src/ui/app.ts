// Arranque de la interfaz: conexión a la sala, redibujado y entrada del usuario.
import { isMuted, playEvents, sfx, toggleMute } from '../audio/sfx';
import { canPickRoute } from '../core/classes/classes';
import { spellOf } from '../core/combat/engine';
import type { Slot } from '../core/items/items';
import type { ClassId, GameEvent } from '../core/state';
import type { RunState } from '../game/run';
import { Session } from '../game/session';
import { dailyScore } from '../game/run';
import { joinRoom, loadRun, submitDaily, topDaily } from '../net/transport';
import { addLog, combatScreen } from './combat';
import { params, randomText, store, today, ui } from './ctx';
import { buyPerk, masteryOf, meta, myNemesis, myTeam, openRoutes, removeChampion, saveChampion, saveMeta, toggleTeam } from '../game/meta';
import { currentAccount, fetchTeam, restoreAccount, signIn, signOut, signUp } from '../net/account';
import { championOf } from '../game/run';
import { MAX_ASC } from '../content/modes';
import { setZoneMusic } from '../audio/sfx';
import { endScreen, eventScreen, homeScreen, lobbyScreen, mapScreen, shopScreen } from './screens';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function publish(): void {
  const m = meta();
  ui.session?.announce({ name: ui.me.name, cls: ui.me.cls, routes: ui.me.routes, host: ui.session.isHost, perks: m.perks, unlocked: m.unlocked, asc: Math.min(ui.asc, m.maxAsc, MAX_ASC), daily: ui.daily ? today() : null,
    mastery: masteryOf(ui.me.cls), nem: myNemesis(), hasTeam: myTeam().length > 0 });
}

function home(msg = ''): void {
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
  ui.saved = null;
  ui.notice = '';
  if (resume) {
    const run = (await loadRun(code)) as RunState | null;
    if (run && run.version === 7 && run.phase === 'map') ui.saved = run;
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
  const key = want + JSON.stringify([meta().ecos, ui.asc, ui.daily, run, run ? null : s.lobby(), ui.me, ui.notice, s.hostPresent(), ui.board?.sel ?? null, s.isMyTurn(), ui.saved?.step, ui.leaveArmed, isMuted(), ui.selRune, ui.selItem, ui.tab, ui.logOpen]);
  if (key === lastKey && want === ui.screen && !events.length) return;
  lastKey = key;
  if (want !== ui.screen) hideTip();
  setZoneMusic(want === 'combat' && run?.kind === 'boss' ? 'boss' : want === 'lobby' || !run ? 'menu' : String(run.zone));
  if (want === 'combat') combatScreen(events);
  else {
    ui.board?.destroy();
    ui.board = null;
    ({ lobby: lobbyScreen, event: eventScreen, shop: shopScreen, map: mapScreen, end: endScreen })[want]();
  }
  ui.screen = want;
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
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const id = el.dataset.id ?? '';
  const s = ui.session;
  if (el.dataset.act !== 'togglelog') sfx.click();
  switch (el.dataset.act) {
    case 'create': void enter(randomText(4, CODE_CHARS), true, false); break;
    case 'solo': void enter(randomText(4, CODE_CHARS), true, true); break;
    case 'join': { const code = (document.getElementById('code') as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''); if (code.length === 4) void enter(code, false, false); break; }
    case 'resume': { const h = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null; if (h) void enter(h.code, true, false, true); break; }
    case 'doresume': if (ui.saved) { ui.log.length = 0; s?.resume(ui.saved); } break;
    case 'home': home(); break;
    case 'cls': ui.me.cls = id as ClassId; ui.me.routes = []; publish(); render([]); break;
    case 'route':
      if (ui.me.routes.includes(id)) ui.me.routes = ui.me.routes.filter((r) => r !== id);
      else if (canPickRoute(ui.me.cls, ui.me.routes, id) && openRoutes(ui.me.cls).includes(id)) ui.me.routes = [...ui.me.routes, id];
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
    case 'selrune': ui.selRune = ui.selRune === Number(id) ? -1 : Number(id); render([]); break;
    case 'socket': s?.act({ a: 'socket', spell: id, idx: ui.selRune }); ui.selRune = -1; break;
    case 'unsocket': s?.act({ a: 'unsocket', spell: id }); break;
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
    case 'upgrade': s?.act({ a: 'upgrade', idx: Number(id) }); break;
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
      ui.busy = true; ui.acctMsg = 'Conectando…'; homeScreen('');
      void (signup ? signUp(v('acemail'), v('acpass'), v('acname')) : signIn(v('acemail'), v('acpass'))).then((err) => {
        ui.busy = false; ui.acctMsg = err ?? 'Has entrado. Tu progreso ya se guarda en la cuenta.';
        if (ui.screen === 'home') homeScreen('');
      });
      break;
    }
    case 'logout': ui.busy = true; void signOut().then(() => { ui.busy = false; ui.acctMsg = 'Sesión cerrada. Tu progreso sigue en este navegador.'; if (ui.screen === 'home') homeScreen(''); }); break;
    case 'end': s?.act({ a: 'end' }); break;
    case 'spell': pickSpell(id); break;
    case 'togglelog': ui.logOpen = !ui.logOpen; render([]); break;
    case 'mute': toggleMute(); render([]); break;
    case 'leave':
      if (ui.leaveArmed) { ui.leaveArmed = false; home(); }
      else { ui.leaveArmed = true; render([]); setTimeout(() => { ui.leaveArmed = false; render([]); }, 4000); }
      break;
  }
  hideTip();
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset?.act === 'dailytoggle') { ui.daily = el.checked; publish(); render([]); }
});

document.addEventListener('keydown', (e) => {
  const s = ui.session;
  if (ui.screen !== 'combat' || !s?.isMyTurn() || (e.target as HTMLElement).tagName === 'INPUT') return;
  const u = s.myUnit();
  const n = Number(e.key);
  if (u && n >= 1 && n <= u.spells.length) {
    const sp = u.spells[n - 1]!;
    if (sp.cd === 0 && u.ap >= spellOf(u, sp.id)!.ap) pickSpell(sp.id);
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
document.addEventListener('mouseover', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (!el) { hideTip(); return; }
  tipEl.innerHTML = el.dataset.tip ?? '';
  tipEl.style.display = 'block';
  const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
  const x = Math.max(6, Math.min(innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2));
  const above = r.top - t.height - 8;
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${above > 4 ? above : r.bottom + 8}px`;
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

export function boot(): void {
  home();
  // si había sesión de cuenta, se recupera y se refresca la pantalla de inicio
  void restoreAccount().then(() => { if (ui.screen === 'home' && currentAccount()) homeScreen(''); });
}
