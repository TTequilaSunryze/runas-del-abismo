// Arranque de la interfaz: conexión a la sala, redibujado y entrada del usuario.
import { isMuted, playEvents, sfx, toggleMute } from '../audio/sfx';
import { PLAYABLE, canPickRoute } from '../core/classes/classes';
import { apCost, spellOf } from '../core/combat/engine';
import type { Slot } from '../core/items/items';
import type { ClassId, GameEvent } from '../core/state';
import type { RunState } from '../game/run';
import { Session } from '../game/session';
import { dailyScore, dailyZone, loadable } from '../game/run';
import { joinRoom, loadRun, submitDaily, topDaily } from '../net/transport';
import { clearSnapshot, readSnapshot } from '../game/snapshot';
import { descendFx, fadeTo, finishTyping, lobbyScene, placeParent, talkLines } from './settlement';
import { NPCS } from '../content/dialogues';
import { investigate } from '../game/research';
import { addLog, closeIntro, combatScreen, inspectUnit, labClick, logTab, zoomBoard } from './combat';
import { trackGroup } from './grouplog';
import { closeEditor, editorScreen } from './editor';
import { balanceScreen, closeBalance } from './balance';
import { testDraft } from '../net/balance';
import { fetchGlobalRooms, globalRooms } from '../net/salas';
import { initBalance } from '../net/balance';
import { fetchTesters, saveTesters, validEmail } from '../net/testers';
import { setRoomSource, type LabScene, type LabSetup } from '../game/run';
import { esc, mine, params, randomText, store, today, ui } from './ctx';
import { BAG_SIZE, PRICE } from '../core/items/items';
import { archive, drainArchiveNotices, recordArchive, type ArchiveNotice } from '../game/archive';
import { grantUnlocks, kitFor, resetKit, setKitSlot } from '../game/shop';
import { claimContractReward } from '../game/contracts';
import { applyLoadout, buyItem, currentLook, emblemOf, deleteLoadout, equipItem, resetLook, saveLoadout, unequip } from '../game/shop';
import { setLooks } from '../render/looks';
import { setCombatBg, setMenuScene, setSceneHeat, type MenuScene } from '../render/menubg';
import { HEAT_MAX } from '../content/pacts';
import { eventDef, type RunState as RunS } from '../game/run';
import { claimSpecialReward, equipCosmetic } from '../game/specials';
import { canRooms, canTest, onRoleChange, creatorOn, isCreatorAccount, maxAscOf, masteryOf, meta, myNemesis, myRooms, myTeam, openRoutes, removeChampion, saveChampion, saveMeta, toggleTeam } from '../game/meta';
import { currentAccount, fetchTeam, restoreAccount, signIn, signOut, signUp } from '../net/account';
import { addFriend, invite, removeFriend, setRoom, socialHandlers } from '../net/social';
import { championOf } from '../game/run';
import { MAX_ASC, MAX_MODS, modConflict } from '../content/modes';
import { setMusicVolume, setZoneMusic } from '../audio/sfx';
import { gotFromBoss, gotModal, itemHtml, mapModal, statsModal, victoryModal } from './panels';
import { installIcons } from './gameicons';
import { installDragDrop } from './dragdrop';
import { endScreen, eventScreen, homeScreen, lobbyScreen, mapScreen, residentModal, roomScreen, shopScreen } from './screens';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function publish(): void {
  const m = meta();
  ui.session?.announce({ name: ui.me.name, cls: ui.me.cls, routes: ui.me.routes, kit: kitFor(m, ui.me.cls), host: ui.session.isHost, look: currentLook(m, ui.me.cls), unlocked: m.unlocked, asc: Math.min(ui.asc, maxAscOf(m), MAX_ASC), daily: ui.daily ? today() : null,
    mastery: masteryOf(ui.me.cls), nem: myNemesis(), hasTeam: myTeam().length > 0,
    mods: ui.daily ? [] : ui.mods, abyss: !ui.daily && (m.stats.wins > 0 || creatorOn(m)), ready: ui.session.isHost || !!ui.lobbyReady });
}

function home(msg = ''): void {
  testDraft(false);
  setZoneMusic('menu');
  setRoom(null);
  ui.session?.leave();
  ui.session = null;
  ui.board?.destroy();
  ui.board = null;
  ui.screen = 'home';
  ui.front = 'menu';
  ui.daily = false;
  ui.abandonArmed = false;
  hideTip();
  homeScreen(msg);
  unlockGifts();
}

/** H2: entrega lo que se regala (Grimorio una vez, maestría del Arquero, exclusivos) y avisa. */
function unlockGifts(): void {
  try {
    archive();
    const got = grantUnlocks(meta());
    if (!got.length) return;
    saveMeta();
    const spells = got.filter((x) => x.cat === 'spell');
    showArchiveNotices([
      ...(spells.length ? [{ icon: '🎁', kind: 'special', text: `${spells.length} habilidad${spells.length > 1 ? 'es' : ''} desbloqueada${spells.length > 1 ? 's' : ''} gratis por tu progreso: búscalas en la Tienda › Habilidades` }] : []),
      ...got.filter((x) => x.cat !== 'spell').map((x) => ({ icon: '🎁', kind: 'special', text: `Desbloqueado en la tienda: ${x.name}` })),
    ] as ArchiveNotice[]);
  } catch { /* sin progreso cargado */ }
}

async function enter(code: string, isHost: boolean, local: boolean, resume = false): Promise<void> {
  const nameEl = document.getElementById('name') as HTMLInputElement | null;
  ui.me.name = (nameEl?.value ?? ui.me.name).trim().slice(0, 14) || 'Héroe';
  store.set('rda_name', ui.me.name);
  ui.lobbyReady = false;
  ui.lobbyStage = 'hero';
  ui.overlay = '';
  ui.bldgOpen = false;
  ui.place = '';
  ui.talk = null;
  ui.inspect = '';
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
    recordArchive(session.run, ui.myId, ev);
    const found = drainArchiveNotices();
    if (found.length && session.run) { if (ui.runFinds.code !== session.run.code) ui.runFinds = { code: session.run.code, list: [] }; ui.runFinds.list.push(...found.filter((n) => n.kind !== 'contract')); showArchiveNotices(found); }
    addLog(ev);
    trackGroup(session.run);
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

/** Avisos del Archivo: pila discreta arriba a la derecha que se desvanece sola (no bloquea clics). */
function showArchiveNotices(list: ArchiveNotice[]): void {
  let box = document.getElementById('archnotes');
  if (!box) { document.body.insertAdjacentHTML('beforeend', '<div id="archnotes" class="archnotes"></div>'); box = document.getElementById('archnotes')!; }
  const shown = list.slice(0, 4), rest = list.length - shown.length;
  const items = [...shown.map((n) => `<div class="archnote ${n.kind}">${n.icon} ${esc(n.text)}</div>`), ...(rest > 0 ? [`<div class="archnote">📚 y ${rest} descubrimiento${rest > 1 ? 's' : ''} más</div>`] : [])];
  for (const html of items) {
    box.insertAdjacentHTML('beforeend', html);
    const el = box.lastElementChild as HTMLElement;
    setTimeout(() => el.remove(), 5200);
  }
  while (box.children.length > 6) box.firstElementChild!.remove();
}

/** Clase para la que se equipan aspectos en la tienda: la del filtro o la elegida para jugar. */
const shopClass = (): ClassId => ((PLAYABLE as string[]).includes(ui.shopCls) ? ui.shopCls : ui.me.cls) as ClassId;

/** Fondo de las pantallas de la partida: el Altar, la Forja del Abismo, el Santuario y el Descanso tienen ilustración propia; el resto, la sala. */
function runScene(run: RunS, want: string): MenuScene {
  if (want === 'room' && run.room?.kind === 'altar') return 'altar';
  if (want === 'room' && run.room?.kind === 'forge') return 'abyssforge';
  if (want === 'room' && run.room?.kind === 'shrine') return 'shrine';
  if (want === 'room' && run.room?.kind === 'blessing') return 'altar';
  if (want === 'room' && run.room?.kind === 'rest') return 'rest';
  if (want === 'event' && eventDef(run)?.scene) return eventDef(run)!.scene!;
  return 'game';
}

let lastKey = '';
/** Escena dibujada (pantalla + zona + sala) y cambios retenidos mientras dura el fundido. */
let lastScene = '', fadeHold = false, held: GameEvent[] = [];
function render(events: GameEvent[]): void {
  const s = ui.session;
  if (!s) return;
  setLooks(s.lobby().map((p) => [p.id, p.look]));
  const run = s.run;
  const want = !run ? 'lobby' : run.phase === 'combat' && run.combat ? 'combat' : run.phase === 'event' && run.event ? 'event' : run.phase === 'shop' ? 'shop' : run.phase === 'room' && run.room ? 'room' : run.phase === 'map' ? 'map' : 'end';
  // sin cambios reales no se redibuja: así un latido de red no interrumpe un clic
  const key = want + JSON.stringify([meta().ecos, ui.asc, ui.daily, ui.mods, ui.abyss, run, run ? null : s.lobby(), ui.me, ui.notice, s.hostPresent(), s.t.connected(), ui.board?.sel ?? null, s.isMyTurn(), ui.saved?.step, ui.leaveArmed, isMuted(), ui.selItem, ui.tab, ui.logOpen, ui.statsOpen, ui.mapOpen, ui.forgeRef, ui.forgeAffix, ui.forgeSpell, ui.sideOpen, ui.picked, ui.lobbyReady, ui.lobbyStage, ui.overlay, ui.bldgOpen, ui.homeTab, ui.place, ui.talk, ui.dossier, ui.dossierSel, (meta().research ?? []).length, ui.inspect, ui.wallKind, meta().hall.length]);
  if (key === lastKey && want === ui.screen && !events.length) return;
  // fundido a negro en cada cambio de pantalla y al pasar de sala en sala (el descenso desde el Refugio tiene el suyo)
  if (fadeHold) { held.push(...events); return; }
  const scene = want === 'lobby' ? `lobby:${ui.lobbyStage}` : `${want}:${run?.zone ?? 0}:${run?.step ?? 0}`;
  const own = ui.screen === 'lobby' && want !== 'lobby' && !!run && !run.arena;
  if (lastScene && scene !== lastScene && !own) {
    lastScene = scene; fadeHold = true; held.push(...events);
    fadeTo(() => { fadeHold = false; const ev = held; held = []; lastKey = ''; render(ev); });
    return;
  }
  lastScene = scene;
  lastKey = key;
  if (want !== ui.screen) hideTip();
  const meH = run?.heroes.find((h) => h.owner === ui.myId);
  setZoneMusic(!run ? (ui.lobbyStage === 'settlement' && ui.place ? ({ taberna: 'tavern', archivo: 'archive', puerta: 'gate', puesto: 'gate', salon: 'hall', forja: 'gate' } as const)[ui.place] : 'lobby') : want === 'combat' ? (run.kind === 'boss' ? 'boss' : 'combat') : want === 'end' ? 'end' : want === 'shop' ? 'calm'
    : want === 'event' || want === 'room' || meH?.boonOffer || meH?.bossOffer ? 'choice' : `map${Math.min(3, run.zone)}`);
  if (want === 'combat') combatScreen(events);
  else {
    ui.root.classList.remove('combatmode');
    ui.board?.destroy();
    ui.board = null;
    ({ lobby: lobbyScreen, event: eventScreen, shop: shopScreen, room: roomScreen, map: mapScreen, end: endScreen })[want]();
  }
  // al descender desde la sala: fundido a negro (y vídeo de entrada, si lo hay)
  if (ui.screen === 'lobby' && want !== 'lobby' && run && !run.arena) descendFx();
  ui.screen = want;
  setMenuScene(want === 'combat' ? null : want === 'lobby' ? lobbyScene() : runScene(run!, want));
  setSceneHeat(run?.phase === 'room' && run.room?.kind === 'forge' ? run.room.heat / HEAT_MAX : run?.phase === 'event' && eventDef(run)?.scene === 'abyssforge' ? 0.35 : 0);
  document.body.classList.toggle('menu-dim', want === 'lobby' && ui.lobbyStage === 'hero');
  setCombatBg(want === 'combat' ? run?.zone ?? null : null);
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
    if (k !== submitted) { submitted = k; void submitDaily({ day: run.daily, code: run.code, names: run.heroes.map((h) => h.name).join(', ').slice(0, 60), players: run.heroes.length, score: dailyScore(run), won: run.phase === 'won', zone: dailyZone(run) }); }
  }
}
let submitted = '';
// iconos del arte del juego en lugar de emojis, en cualquier pantalla
if (typeof document !== 'undefined') installIcons(document.body);
ui.rerender = () => { lastKey = ''; render([]); };
// solo en desarrollo: acceso al estado para las pruebas visuales
if (import.meta.env.DEV) (window as unknown as { __ui: typeof ui }).__ui = ui;
ui.refreshLobby = () => { lastKey = ''; render([]); };

// las salas creadas por el creador pueden salir en las expediciones que aloje
setRoomSource(() => {
  // las de todos y, para el creador, las suyas (su versión manda)
  // los testers ven sus salas en el laboratorio, pero nunca salen en las expediciones (no pueden publicar)
  const mine = isCreatorAccount() ? myRooms() : canRooms() ? myRooms().map((r) => ({ ...r, published: false })) : [];
  return [...globalRooms().filter((r) => !mine.some((x) => x.id === r.id)), ...mine];
});
void fetchGlobalRooms();
void initBalance();
void fetchTesters();
// al saber que la cuenta es de tester (o deja de serlo), se repinta la portada
onRoleChange(() => { if (ui.screen === 'home') home(''); });

/** Laboratorio: partida local con todas las habilidades de la clase, muñecos, salas creadas, jefes e invocaciones. */
async function training(cls: ClassId, setup?: Partial<LabSetup>, scene?: LabScene): Promise<void> {
  if (!canTest()) return;
  if (ui.screen === 'editor') closeEditor();
  await enter(randomText(4, CODE_CHARS), true, true);
  ui.log.length = 0;
  ui.me.cls = cls;
  ui.session?.startTraining(currentAccount()?.name ?? ui.me.name, cls, setup, scene);
}

/** Pantalla de equilibrio (solo cuentas de creador). */
function openBalance(cls?: ClassId): void {
  if (!isCreatorAccount()) return;
  if (ui.screen === 'editor') closeEditor();
  if (ui.session) { ui.session.leave(); ui.session = null; ui.board?.destroy(); ui.board = null; setRoom(null); }
  hideTip();
  setMenuScene(null);
  setCombatBg(0);
  balanceScreen({ cls, onTest: (c) => void training(c), onExit: () => { closeBalance(); home(''); } });
}

/** Editor de salas (solo cuentas de creador). Sale de la partida o del laboratorio en el que esté. */
function openEditor(id?: string): void {
  if (!canRooms()) return;
  if (ui.session) { ui.session.leave(); ui.session = null; ui.board?.destroy(); ui.board = null; setRoom(null); }
  hideTip();
  setMenuScene(null);
  setCombatBg(0);
  editorScreen({ open: id, onTest: (r) => void training(ui.me.cls, { zone: r.zone }, { kind: 'room', id: r.id }), onExit: () => { closeEditor(); home(''); } });
}

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
  // todas se lanzan con clic, también las que son sobre ti (se ilumina tu casilla y el área que alcanzan)
  ui.board.select(ui.board.sel === id ? null : id);
}

// arrastrar objetos entre la mochila y el equipo
installDragDrop((from, to) => {
  const s = ui.session;
  if (!s) return;
  const [kind, key] = from.split(':');
  // runas: entre los espacios equipados y la reserva; soltar sobre una ocupada las intercambia
  if (kind === 'req' || kind === 'rbag') {
    const h = s.run ? mine(s.run) : undefined;
    if (!h) return;
    const [tk, tv] = to.split(':'), i = Number(key), j = Number(tv);
    const eq = h.runes ?? [], bag = h.runeBag ?? [];
    if (kind === 'rbag' && tk === 'req') s.act({ a: 'rune', op: 'equip', idx: i, ...(eq[j] ? { slot: j } : {}) });
    else if (kind === 'req' && tk === 'rbag') { if (bag[j]) s.act({ a: 'rune', op: 'equip', idx: j, slot: i }); else s.act({ a: 'rune', op: 'unequip', slot: i }); }
    else if (kind === 'req' && tk === 'req' && eq[j]) s.act({ a: 'rune', op: 'swap', from: i, to: j });
    else return;
    sfx.click();
    ui.selRune = '';
    return;
  }
  if (kind === 'bag' && to === 'equip') s.act({ a: 'equip', idx: Number(key) });
  else if (kind === 'slot' && to === 'bag') s.act({ a: 'unequip', slot: key as Slot });
  else return;
  sfx.click();
  ui.selItem = '';
});
document.addEventListener('rda:hidetip', () => hideTip());

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
    // portada y flujo previo a la expedición
    case 'front': ui.front = (id || 'menu') as typeof ui.front; ui.abandonArmed = false; homeScreen(''); break;
    case 'abandon':
      if (!ui.abandonArmed) { ui.abandonArmed = true; homeScreen(''); setTimeout(() => { if (ui.abandonArmed) { ui.abandonArmed = false; if (ui.screen === 'home') homeScreen(''); } }, 4000); break; }
      ui.abandonArmed = false; clearSnapshot(); try { localStorage.removeItem('rda_host'); } catch { /* sin almacenamiento */ } homeScreen('Partida abandonada.'); break;
    case 'abyssgo': ui.daily = false; void enter(randomText(4, CODE_CHARS), true, true); break;
    case 'dailygo': ui.daily = true; ui.mods = []; void enter(randomText(4, CODE_CHARS), true, true); break;
    case 'herook': ui.lobbyStage = 'settlement'; ui.overlay = ''; ui.refreshLobby(); break;
    case 'herochange': ui.lobbyStage = 'hero'; ui.bldgOpen = false; ui.place = ''; ui.talk = null; ui.dossier = ''; ui.inspect = ''; ui.refreshLobby(); break;
    // El Asentamiento: entrar y salir de un lugar (con fundido) y conversaciones
    case 'place': fadeTo(() => { ui.place = id as typeof ui.place; ui.talk = null; ui.bldgOpen = false; ui.dossier = ''; ui.refreshLobby(); }); break;
    case 'placeexit': fadeTo(() => { ui.place = ui.place ? placeParent(ui.place) : ''; ui.talk = null; ui.dossier = ''; ui.inspect = ''; ui.refreshLobby(); }); break;
    // la Puerta: ventanas de inspección del puesto de vigilancia
    case 'inspect': ui.inspect = id as typeof ui.inspect; ui.refreshLobby(); break;
    case 'inspectclose': ui.inspect = ''; ui.refreshLobby(); break;
    case 'wallkind': ui.wallKind = id; ui.refreshLobby(); break;
    // Archivo: fichas de investigación (examinar / investigar)
    case 'dossier': ui.dossier = id as typeof ui.dossier; ui.dossierSel = ''; ui.refreshLobby(); break;
    case 'dossel': ui.dossierSel = id; ui.refreshLobby(); break;
    case 'dossierclose': ui.dossier = ''; ui.refreshLobby(); break;
    case 'investigate': if (investigate(id)) { sfx.myTurn(); ui.dossierSel = id; } ui.refreshLobby(); break;
    case 'talk': {
      // el habitante recuerda lo que vio la última vez; la conversación reacciona a lo ocurrido desde entonces
      const m = meta(), seen = (m.npcSeen ??= {});
      ui.talkBase = seen[id] ? { ...seen[id]! } : null;
      seen[id] = { runs: m.stats.runs, wins: m.stats.wins, bosses: m.stats.bosses, bestZone: m.stats.bestZone };
      saveMeta();
      const open = (): void => { ui.talk = { npc: id, node: NPCS[id]?.start ?? '', line: 0 }; ui.refreshLobby(); };
      // los que saludan al seleccionarlos: primero el saludo, luego la conversación
      if (el.classList.contains('clickwave')) { el.classList.add('waving'); setTimeout(open, 1150); } else open();
      break;
    }
    case 'dlgnext': if (finishTyping() || !ui.talk) break; if (ui.talk.line < talkLines().length - 1) { ui.talk = { ...ui.talk, line: ui.talk.line + 1 }; ui.refreshLobby(); } break;
    case 'dlgopt': ui.talk = id && ui.talk ? { npc: ui.talk.npc, node: id, line: 0 } : null; ui.refreshLobby(); break;
    case 'overlay': ui.overlay = (id || '') as typeof ui.overlay; ui.refreshLobby(); break;
    case 'bldgclose': ui.bldgOpen = false; ui.refreshLobby(); break;
    case 'create': void enter(randomText(4, CODE_CHARS), true, false); break;
    // modo creador (solo cuentas de creador) y sala de pruebas
    case 'testeradd': case 'testerdel': case 'testerrooms': {
      if (!isCreatorAccount()) break;
      const m = meta(), list = [...(m.testers ?? [])];
      if (el.dataset.act === 'testeradd') {
        const mail = (document.getElementById('testermail') as HTMLInputElement | null)?.value ?? '';
        if (!validEmail(mail)) { ui.testerMsg = 'Escribe el email de la cuenta del tester'; home(''); break; }
        list.push({ email: mail, rooms: !!(document.getElementById('testerroomsnew') as HTMLInputElement | null)?.checked });
      } else if (el.dataset.act === 'testerdel') list.splice(Number(id), 1);
      else { const x = list[Number(id)]; if (x) list[Number(id)] = { ...x, rooms: !x.rooms }; }
      void saveTesters(list).then((err) => { ui.testerMsg = err ?? '✔ Lista de testers guardada y publicada'; home(''); });
      break;
    }
    case 'creator': { if (!canTest()) break; const m = meta(); m.creator = !m.creator; saveMeta(); homeScreen(''); break; }
    case 'trainstart': void training(id as ClassId); break;
    case 'editor': openEditor(id || undefined); break;
    case 'balance': openBalance((ui.session?.run?.heroes[0]?.cls ?? undefined) as ClassId | undefined); break;
    case 'introok': closeIntro(id); break;
    case 'labsetup': case 'labscene': case 'labboss': case 'labroom': case 'labtool': labClick(el.dataset.act, id); break;
    case 'train': s?.act({ a: 'train', op: id }); break;
    // H3: configurador de 4 habilidades (gratis; se guarda por clase y se anuncia a la sala)
    case 'kitslot': ui.kitSlot = Number(id) || 0; render([]); break;
    case 'kitpick': { const err = setKitSlot(meta(), ui.me.cls, ui.kitSlot, id); if (err) { ui.notice = err; setTimeout(() => { ui.notice = ''; render([]); }, 2000); } else { saveMeta(); ui.kitSlot = (ui.kitSlot + 1) % 4; publish(); } render([]); break; }
    case 'kitreset': resetKit(meta(), ui.me.cls); saveMeta(); ui.kitSlot = 0; publish(); render([]); break;
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
    case 'home': fadeTo(() => home()); break;
    case 'statsof': ui.statsOf = String(id); lastKey = ''; render([]); break;
    case 'lready': ui.lobbyReady = !ui.lobbyReady; publish(); render([]); break;
    case 'cls': ui.picked = { cls: String(id), from: ui.me.cls, at: Date.now() }; ui.me.cls = id as ClassId; ui.me.routes = ['base']; publish(); render([]); setTimeout(() => { ui.picked = null; lastKey = ''; render([]); }, 1500); break;
    case 'route':
      // un solo kit: elegir otro lo sustituye
      if (canPickRoute(ui.me.cls, [], id) && openRoutes(ui.me.cls).includes(id)) ui.me.routes = [id];
      publish(); render([]); break;
    case 'start': ui.log.length = 0; ui.tab = 'equipo'; s?.startRun(); break;
    case 'node': ui.log.length = 0; s?.choose(Number(id)); break;
    case 'mapgo': ui.log.length = 0; s?.goNow(); break;
    case 'leavenode': s?.leaveNode(); break;
    case 'resolve': s?.resolve(); break;
    case 'skip': s?.skipTurn(); break;
    case 'pick': s?.act({ a: 'pick', idx: Number(id) }); break;
    case 'vote': s?.act({ a: 'vote', idx: Number(id) }); break;
    case 'pact': s?.act({ a: 'room', op: 'pact', idx: Number(id) }); break;
    case 'seal': s?.act({ a: 'room', op: 'seal' }); break;
    case 'openchest': s?.act({ a: 'room', op: 'open' }); break;
    case 'restpick': s?.act({ a: 'room', op: 'rest', idx: Number(id) }); break;
    case 'fsel': ui.forgeRef = ui.forgeRef === id ? '' : String(id); ui.forgeAffix = -1; render([]); break;
    case 'faff': ui.forgeAffix = Number(id); render([]); break;
    case 'frecal': s?.act({ a: 'room', op: 'recal', ref: ui.forgeRef, affix: ui.forgeAffix, stat: id as never }); ui.forgeAffix = -1; break;
    case 'fscrap': s?.act({ a: 'room', op: 'scrap', idx: Number(id) }); ui.forgeRef = ''; break;
    case 'fspell': ui.forgeSpell = ui.forgeSpell === id ? '' : String(id); render([]); break;
    case 'fhone': s?.act({ a: 'room', op: 'hone', spell: ui.forgeSpell, up: String(id) }); break;
    case 'tab': ui.tab = id as typeof ui.tab; if (id === 'runas') ui.sideOpen = true; lastKey = ''; render([]); break;
    case 'selrune': ui.selRune = ui.selRune === id ? '' : id; lastKey = ''; render([]); break;
    case 'runef': { const [k, v] = id.split(':') as ['fam' | 'rar' | 'kind', string]; ui.runeF = { ...ui.runeF, [k]: ui.runeF[k] === v ? '' : v }; homeScreen(''); break; }
    case 'rune': {
      // gestión de runas: elegir de una oferta, equipar, sustituir, quitar, intercambiar o soltar
      const op = el.dataset.op ?? '', n = Number(id), slot = el.dataset.slot !== undefined ? Number(el.dataset.slot) : undefined;
      if (op === 'take') s?.act({ a: 'rune', op: 'take', idx: n, ...(slot !== undefined ? { slot } : {}), ...(el.dataset.bag ? { bag: true } : {}) });
      else if (op === 'skip') s?.act({ a: 'rune', op: 'skip' });
      else if (op === 'equip') s?.act({ a: 'rune', op: 'equip', idx: n, ...(slot !== undefined ? { slot } : {}) });
      else if (op === 'unequip' && slot !== undefined) s?.act({ a: 'rune', op: 'unequip', slot });
      else if (op === 'swap' && slot !== undefined) s?.act({ a: 'rune', op: 'swap', from: slot, to: Number(el.dataset.to) });
      else if (op === 'drop') s?.act({ a: 'rune', op: 'drop', idx: n });
      ui.selRune = '';
      break;
    }
    case 'selitem': ui.selItem = ui.selItem === id ? '' : id; render([]); break;
    case 'equip': s?.act({ a: 'equip', idx: Number(id) }); ui.selItem = ''; break;
    case 'unequip': s?.act({ a: 'unequip', slot: id as Slot }); ui.selItem = ''; break;
    case 'give': s?.act({ a: 'give', idx: Number(id), to: el.dataset.to ?? '' }); ui.selItem = ''; break;
    case 'sell': s?.act({ a: 'sell', idx: Number(id) }); ui.selItem = ''; sfx.coin(); break;
    case 'drop': s?.act({ a: 'drop', idx: Number(id) }); ui.selItem = ''; break;
    case 'buy': s?.act({ a: 'buy', idx: Number(id) }); sfx.coin(); break;
    case 'potion': s?.act({ a: 'potion' }); break;
    case 'arccat': ui.arcCat = id as typeof ui.arcCat; ui.arcOpen = ''; ui.arcSub = ''; ui.arcF2 = ''; homeScreen(''); break;
    case 'shopcat': ui.shopCat = id; ui.shopConfirm = ''; ui.shopMsg = ''; homeScreen(''); break;
    case 'shoprar': ui.shopRar = id; homeScreen(''); break;
    case 'shopcls': ui.shopCls = id; homeScreen(''); break;
    case 'shopmine': ui.shopMine = !ui.shopMine; homeScreen(''); break;
    case 'shopbuy': ui.shopConfirm = id; ui.shopMsg = ''; homeScreen(''); break;
    case 'shopno': ui.shopConfirm = ''; homeScreen(''); break;
    case 'shopyes': { const r = buyItem(meta(), id); ui.shopConfirm = ''; if (r.ok) { saveMeta(); sfx.myTurn(); ui.shopMsg = `Comprado por ${r.paid} ✨.`; } else ui.shopMsg = r.error; homeScreen(''); break; }
    case 'shopeq': { const e = equipItem(meta(), id, shopClass()); if (e) ui.shopMsg = e; else saveMeta(); homeScreen(''); break; }
    case 'shopun': unequip(meta(), id as never, shopClass()); saveMeta(); homeScreen(''); break;
    case 'lsave': { const e = saveLoadout(meta(), shopClass(), `Conjunto ${(meta().cosmetics?.loadouts?.[shopClass()]?.length ?? 0) + 1}`); if (e) ui.shopMsg = e; else saveMeta(); homeScreen(''); break; }
    case 'lapply': applyLoadout(meta(), shopClass(), Number(id)); saveMeta(); homeScreen(''); break;
    case 'ldel': deleteLoadout(meta(), shopClass(), Number(id)); saveMeta(); homeScreen(''); break;
    case 'lreset': resetLook(meta(), shopClass()); saveMeta(); homeScreen(''); break;
    case 'refundok': meta().refundSeen = true; saveMeta(); homeScreen(''); break;
    case 'cview': ui.cview = id as typeof ui.cview; homeScreen(''); break;
    case 'sclaim': { if (claimSpecialReward(meta(), id)) { saveMeta(); sfx.myTurn(); } homeScreen(''); break; }
    case 'ctitle': if (equipCosmetic(meta(), 'title', id || null)) saveMeta(); homeScreen(''); break;
    case 'cframe': if (equipCosmetic(meta(), 'frame', id || null)) saveMeta(); homeScreen(''); break;
    case 'cclaim': { if (claimContractReward(meta(), id)) { saveMeta(); sfx.myTurn(); } homeScreen(''); break; }
    case 'arcsub': ui.arcSub = id; ui.arcOpen = ''; homeScreen(''); break;
    case 'arcf2': ui.arcF2 = id; homeScreen(''); break;
    case 'arcfilter': ui.arcFilter = id as typeof ui.arcFilter; homeScreen(''); break;
    case 'arcopen': ui.arcOpen = ui.arcOpen === id ? '' : id; homeScreen(''); break;
    case 'resident': ui.root.insertAdjacentHTML('beforeend', residentModal(id)); break;
    case 'residentclose': ui.root.querySelector('.resident-modal')?.remove(); break;
    case 'htab':
      ui.root.querySelector('.resident-modal')?.remove();
      if (id === 'jugar' || id === 'refugio') { ui.bldgOpen = false; if (ui.session) ui.refreshLobby(); else { ui.front = 'play'; homeScreen(''); } break; }
      if (!ui.session) { if (id === 'cuenta') { ui.front = 'account'; homeScreen(''); } break; }
      ui.homeTab = id as typeof ui.homeTab;
      ui.bldgOpen = true;
      ui.dossier = '';
      ui.inspect = '';
      if (ui.homeTab === 'diario' && ui.board2 !== 'cargando') { ui.board2 = 'cargando'; void topDaily(today()).then((r) => { ui.board2 = r ?? 'error'; if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen(''); }); }
      homeScreen(''); break;
    case 'tuto': ui.tutorial = 0; meta().seenTutorial = false; homeScreen(''); break;
    case 'tutonext': ui.tutorial++; if (ui.tutorial >= 5) { meta().seenTutorial = true; saveMeta(); } homeScreen(''); break;
    case 'tutoskip': meta().seenTutorial = true; saveMeta(); homeScreen(''); break;
    case 'ascup': ui.asc = Math.min(maxAscOf(), ui.asc + 1); publish(); render([]); break;
    case 'ascdown': ui.asc = Math.max(0, ui.asc - 1); publish(); render([]); break;
    case 'again': ui.log.length = 0; ui.lobbyStage = 'settlement'; ui.bldgOpen = false; ui.place = ''; ui.talk = null; s?.backToLobby(); break;
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
      void addFriend(name).then((err) => { ui.friendMsg = err ?? 'Amigo añadido. Pídele que te añada también para recibir sus invitaciones.'; if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen(''); });
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
        if (op === 'split') ui.got = { title: 'Vendido', html: `${itemHtml(it, true)}<p class="good">+${Math.floor(PRICE[it.rarity] / 2)} de oro.</p>` };
        else if (!(op === 'bag' ? full : full && me.equip[it.slot])) ui.got = { title: '¡Has obtenido!', html: `${itemHtml(it, true)}<p class="dim sm">${op === 'equip' ? 'Equipado ahora mismo.' : 'Guardado en tu mochila.'}</p>` };
      }
      s?.act({ a: 'stash', idx: Number(id), op });
      break;
    }
    case 'gotok': ui.got = null; lastKey = ''; render([]); break;
    case 'deployready': s?.act({ a: 'deployready' }); break;
    case 'readyall': s?.act({ a: 'deployready', force: true }); break;
    case 'isoview': if (ui.board) { ui.board.setIso(!ui.board.iso); } lastKey = ''; render([]); break;
    case 'bars': ui.hpBars = !ui.hpBars; if (ui.board) ui.board.showBars = ui.hpBars; lastKey = ''; render([]); break;
    case 'side': ui.sideOpen = !ui.sideOpen; lastKey = ''; render([]); break;
    case 'sidetab': if (ui.sideOpen && ui.tab === id) ui.sideOpen = false; else { ui.tab = id as typeof ui.tab; ui.sideOpen = true; } lastKey = ''; render([]); break;
    case 'map': ui.mapOpen = !ui.mapOpen; lastKey = ''; render([]); break;
    case 'stats': ui.statsOpen = !ui.statsOpen; lastKey = ''; render([]); break;
    case 'mod': ui.mods = ui.mods.includes(id) ? ui.mods.filter((x) => x !== id) : ui.mods.length < MAX_MODS && !modConflict(id, ui.mods) ? [...ui.mods, id] : ui.mods; publish(); render([]); break;
    case 'modsclear': ui.mods = []; publish(); render([]); break;
    case 'champsave': { const h = s?.run?.heroes.find((x) => x.owner === ui.myId); if (s?.run && h) { saveChampion({ ...championOf(s.run, h), by: currentAccount()?.name ?? ui.me.name, ...(meta().cosmetics?.title ? { title: meta().cosmetics!.title! } : {}), ...(meta().cosmetics?.frame ? { frame: meta().cosmetics!.frame! } : {}), ...(emblemOf(meta()) ? { emblem: emblemOf(meta()) } : {}) }); publish(); lastKey = ''; render([]); } break; }
    case 'champdel': removeChampion(id); homeScreen(''); break;
    case 'champteam': toggleTeam(id); homeScreen(''); break;
    case 'duelmirror': void duel({ name: 'Tu reflejo', team: myTeam() }); break;
    case 'duelai': {
      const name = (document.getElementById('foe') as HTMLInputElement).value.trim();
      if (!name) break;
      ui.busy = true; ui.hallMsg = `Buscando el equipo de ${name}…`; homeScreen('');
      void fetchTeam(name).then((t) => {
        ui.busy = false;
        if (!t) { ui.hallMsg = `No se encontró un equipo guardado para “${name}”. Tiene que tener cuenta, haber entrado y tener héroes en su equipo.`; if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen(''); return; }
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
        if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen('');
      });
      break;
    }
    case 'logout': ui.busy = true; void signOut().then(() => { ui.busy = false; ui.acctMsg = 'Sesión cerrada. Tu progreso sigue en este navegador.'; if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen(''); }); break;
    case 'end': s?.act({ a: 'end' }); break;
    case 'spell': pickSpell(id); break;
    case 'togglelog': ui.logOpen = !ui.logOpen; store.set('rda_logopen', ui.logOpen ? '1' : '0'); render([]); break;
    case 'logtab': logTab(id); break;
    case 'uinspect': inspectUnit(id === '' ? null : Number(id)); break;
    case 'pingmode': if (ui.board) { ui.board.pingMode = !ui.board.pingMode; lastKey = ''; render([]); } break;
    case 'zoom': zoomBoard(Number(id)); break;
    case 'mute': toggleMute(); if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen(''); else { lastKey = ''; render([]); } break;
    case 'leave':
      if (ui.leaveArmed) { ui.leaveArmed = false; fadeTo(() => home()); }
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
  if (ui.talk && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement).tagName !== 'INPUT') {
    e.preventDefault();
    if (e.key === 'Escape') { ui.talk = null; ui.refreshLobby(); } else (document.querySelector('.talk-box') as HTMLElement | null)?.click();
    return;
  }
  const s = ui.session;
  if ((e.target as HTMLElement).tagName !== 'INPUT' && s?.run && !s.run.arena && (e.key === 'm' || e.key === 'M' || (e.key === 'Escape' && ui.mapOpen))) { ui.mapOpen = e.key === 'Escape' ? false : !ui.mapOpen; lastKey = ''; render([]); return; }
  if ((e.target as HTMLElement).tagName !== 'INPUT' && s?.run && !s.run.arena && (e.key === 's' || e.key === 'S' || (e.key === 'Escape' && ui.statsOpen))) { ui.statsOpen = e.key === 'Escape' ? false : !ui.statsOpen; lastKey = ''; render([]); return; }
  if (ui.screen === 'combat' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.key === 'i' || e.key === 'I') && ui.board) { ui.board.setIso(!ui.board.iso); lastKey = ''; render([]); return; }
  if (ui.screen === 'combat' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.key === 'v' || e.key === 'V')) { ui.hpBars = !ui.hpBars; if (ui.board) ui.board.showBars = ui.hpBars; lastKey = ''; render([]); return; }
  // G: señal táctica en la casilla bajo el ratón (la ven todos)
  // G: señal táctica en la casilla bajo el ratón (la ven todos); sin casilla debajo, activa el modo «señalar» del botón
  if (ui.screen === 'combat' && (e.key === 'g' || e.key === 'G') && (e.target as HTMLElement).tagName !== 'INPUT') { const p = ui.board?.hoverCell(); if (p && s) s.ping(p.x, p.y); else if (ui.board) { ui.board.pingMode = !ui.board.pingMode; lastKey = ''; render([]); } return; }
  // Escape en combate: cancela el modo señalar y cierra la ficha de unidad
  if (ui.screen === 'combat' && e.key === 'Escape' && ui.board?.pingMode) { ui.board.pingMode = false; lastKey = ''; render([]); return; }
  if (ui.screen === 'combat' && e.key === 'Escape' && document.getElementById('uinspect')?.classList.contains('open')) { inspectUnit(null); return; }
  // fase de colocación: E = «¡Listo!»
  if (ui.screen === 'combat' && s?.run?.combat?.deploy && (e.target as HTMLElement).tagName !== 'INPUT' && (e.key === 'e' || e.key === 'E')) { if (!s.run.combat.deploy.ready.includes(s.myId)) s.act({ a: 'deployready' }); return; }
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
socialHandlers(() => { if (ui.screen === 'home' || ui.screen === 'lobby') homeScreen(''); else if (ui.screen === 'lobby') { lastKey = ''; render([]); } }, (inv) => {
  ui.invites = [...ui.invites.filter((x) => x.code !== inv.code), inv].slice(-3);
  drawInvites();
  sfx.coin();
});

export function boot(): void {
  home();
  // si había sesión de cuenta, se recupera y se refresca la pantalla de inicio
  void restoreAccount().then(() => { if (ui.screen === 'home' && currentAccount()) { homeScreen(''); unlockGifts(); } });
}
