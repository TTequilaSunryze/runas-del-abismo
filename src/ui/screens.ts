// Pantallas fuera del combate: inicio, sala, mapa, tienda, evento y final.
import { CLASSES, PLAYABLE, findRoute } from '../core/classes/classes';
import { classPortraitUrl } from '../render/sprites';
import { SPELLS } from '../core/classes/spells';
import type { ClassId } from '../core/state';
import { NODE_HINT, NODE_NAME, POTION_HEAL, availableNodes, POTION_PRICE, eventDef, heroMaxHp, type RunState } from '../game/run';
import { TURN_SECONDS } from '../game/session';
import { ACHIEVEMENTS, HALL_SIZE, MASTERY_XP, ecosFor, masteryOf, masteryProgress, masteryText, meta, myTeam, openRoutes, routeNeeds, settle } from '../game/meta';
import { currentAccount } from '../net/account';
import { friendsStatus } from '../net/social';
import type { Champion } from '../game/run';
import { ASCENSION, DAILY_MODS, MOD_ECOS, OMENS, PERKS, perkLevel } from '../content/modes';
import { ALLIES } from '../content/enemies';
import { RELICS } from '../content/relics';
import { championOf, dailyOf, dailyScore, lastZone } from '../game/run';
import { CLASS_STORY, ENDING_LOST, ENDING_WON, TUTORIAL, ZONE_STORY } from '../content/story';
import { esc, mine, store, tip, today, ui } from './ctx';
import { NODE_ICON, itemIcon, spellIcon, spellTip } from './icons';
import { advanceBar, diffHtml, itemHtml, pendingRows, sidePanel, topBar, volumeControl } from './panels';
import { CONSUMABLES, MAX_CONSUMABLE } from '../content/boons';

const RAR = ['ir0', 'ir1', 'ir2', 'ir3'];

function metaPanel(): string {
  const m = meta();
  if (ui.homeTab === 'mejoras') {
    return `<div class="panel"><div class="row"><h3>Mejoras permanentes</h3><span class="grow"></span><b class="pill">✨ ${m.ecos} ecos</b></div>
    <div class="dim sm">Se compran con ecos (se ganan en cada partida) y valen para todas tus partidas, también online.</div>
    <div class="cards c3">${PERKS.map((p) => { const l = perkLevel(m.perks, p.id), full = l >= p.max, c = p.cost(l);
      return `<div class="lootcard"><div class="row"><div class="cell big"><span class="emo">${p.icon}</span></div><div><b>${p.name}</b> <span class="dim sm">${l}/${p.max}</span><div class="sm ${l ? 'good' : 'dim'}">${esc(p.text(l || 1))}</div>${!full ? `<div class="dim sm">Siguiente: ${esc(p.text(l + 1))}</div>` : ''}</div></div>
      <button class="pri" data-act="perk" data-id="${p.id}" ${full || m.ecos < c ? 'disabled' : ''}>${full ? 'Máximo' : `Mejorar · ${c} ✨`}</button></div>`; }).join('')}</div></div>`;
  }
  if (ui.homeTab === 'logros') {
    return `<div class="panel"><div class="row"><h3>Logros</h3><span class="grow"></span><span class="dim sm">${m.achievements.length}/${ACHIEVEMENTS.length}</span></div>
    <div class="dim sm">Partidas: ${m.stats.runs} · Victorias: ${m.stats.wins} · Bajas: ${m.stats.kills} · Jefes: ${m.stats.bosses} · Ascensión máxima: ${m.maxAsc}</div>
    <div class="cards c2">${ACHIEVEMENTS.map((a) => { const on = m.achievements.includes(a.id);
      return `<div class="lootcard ${on ? 'r3' : 'off'}"><b>${on ? '🏆' : '🔒'} ${esc(a.name)}</b><div class="sm">${esc(a.text)}</div><div class="sm dim">${[a.ecos ? `+${a.ecos} ✨` : ''].filter(Boolean).join(' · ') || ' '}</div></div>`; }).join('')}</div></div>`;
  }
  if (ui.homeTab === 'clases') {
    return `<div class="panel"><h3>Maestría de clase</h3><div class="dim sm">Jugar con una clase le da experiencia de maestría (más cuanto más lejos llegues y más alta sea la ascensión). Cada nivel abre rutas y ventajas de esa clase.</div>
    <div class="cards c2">${PLAYABLE.map((id) => { const c = CLASSES[id], { lv } = masteryProgress(id);
      return `<div class="lootcard ${lv >= 5 ? 'r3' : lv ? 'r1' : ''}"><div class="row"><b>${c.name}</b><span class="grow"></span><b class="pill">Maestría ${lv}/5</b></div>
      ${masteryBar(id)}
      ${c.routes.length > 1 ? `<div class="sm">${c.routes.map((r) => { const need = routeNeeds(id, r.id); return `<span class="${lv >= need ? 'good' : 'dim'}">${lv >= need ? '✔' : '🔒'} ${esc(r.name)}${lv < need ? ` (maestría ${need})` : ''}</span>`; }).join(' · ')}</div>` : ''}
      <div class="sm">${[0, 1, 2, 3, 4].map((i) => `<div class="${lv > i ? 'good' : 'dim'}">${lv > i ? '✔' : '○'} ${i + 1}. ${esc(masteryText(id, i))}</div>`).join('')}</div></div>`; }).join('')}</div></div>`;
  }
  if (ui.homeTab === 'salon') {
    const team = m.team;
    return `<div class="panel"><div class="row"><h3>Salón de héroes</h3><span class="grow"></span><span class="dim sm">${m.hall.length}/${HALL_SIZE} · equipo ${team.length}/3</span></div>
    <div class="dim sm">Al terminar una partida puedes guardar aquí a tu héroe, con su equipo y mejoras. Elige 3 para tu equipo de duelo. Tu mejor héroe puede aparecer como <b>Némesis</b> (un élite) en las partidas que juegues con otros.</div>
    ${ui.hallMsg ? `<div class="pill sm">${esc(ui.hallMsg)}</div>` : ''}
    ${m.hall.length ? `<div class="cards c2">${m.hall.map((c) => champCard(c, team.includes(c.id))).join('')}</div>` : '<div class="dim">Aún no has guardado ningún héroe. Termina una partida y pulsa “Guardar en el Salón”.</div>'}</div>
    <div class="panel"><h3>🏟️ Duelos 3 contra 3</h3><div class="dim sm">En los duelos todos tienen más vida para que duren: cuenta la clase, el kit, el equipo, las runas y las mejoras. No dan ecos.</div>
      <div class="cards c3">
        <div class="lootcard"><b>Contra el equipo de un amigo</b><div class="sm dim">Su equipo lo lleva la IA: no hace falta que esté conectado. Necesita tener cuenta y equipo guardado.</div><input id="foe" maxlength="14" placeholder="Nombre de su cuenta"><button class="pri" data-act="duelai" ${team.length && !ui.busy ? '' : 'disabled'}>Buscar y combatir</button></div>
        <div class="lootcard"><b>Entrenamiento</b><div class="sm dim">Contra una copia de tu propio equipo, llevada por la IA.</div><button data-act="duelmirror" ${team.length ? '' : 'disabled'}>Entrenar</button></div>
        <div class="lootcard"><b>En vivo</b><div class="sm dim">Entra en una sala con tu amigo: el anfitrión verá el botón “Retar a duelo” junto a quien tenga equipo. Cada uno mueve a sus 3 héroes.</div></div>
      </div></div>`;
  }
  if (ui.homeTab === 'amigos') {
    if (!currentAccount()) return `<div class="panel"><h3>Amigos</h3><p class="dim">Para tener amigos e invitarles a tus partidas necesitas una cuenta. <button class="mini" data-act="htab" data-id="cuenta">Crear cuenta o entrar</button></p></div>`;
    const list = friendsStatus();
    return `<div class="panel"><h3>👥 Amigos</h3><div class="dim sm">Añade a tus amigos por su nombre de cuenta. Cuando estés en una sala podrás invitarles con un clic (solo les llega si ellos también te tienen añadido). Tu nombre: <b>${esc(currentAccount()!.name)}</b></div>
    <div class="row"><input id="friend" maxlength="14" placeholder="Nombre de cuenta"><button class="pri" data-act="addfriend">Añadir</button></div>${ui.friendMsg ? `<div class="pill sm">${esc(ui.friendMsg)}</div>` : ''}
    ${list.length ? list.map((f) => `<div class="row"><span class="dot ${f.online ? 'on' : ''}"></span><b>${esc(f.name)}</b><span class="dim sm">${f.online ? (f.room ? `en la sala ${esc(f.room)}` : 'en línea') : 'desconectado'}</span><span class="grow"></span>${f.online && f.room ? `<button class="mini pri" data-act="joinfriend" data-id="${esc(f.room)}">Unirme</button>` : ''}<button class="mini" data-act="delfriend" data-id="${esc(f.name)}">Quitar</button></div>`).join('') : '<div class="dim">Todavía no tienes amigos añadidos.</div>'}</div>`;
  }
  if (ui.homeTab === 'cuenta') {
    const a = currentAccount();
    return `<div class="panel"><h3>Cuenta</h3>${ui.acctMsg ? `<div class="pill sm">${esc(ui.acctMsg)}</div>` : ''}
    ${a ? `<p>Has entrado como <b>${esc(a.name)}</b> <span class="dim sm">(${esc(a.email)})</span>.</p><div class="dim sm">Tu progreso (ecos, mejoras, maestrías, logros y Salón) se guarda en la cuenta y te sigue a cualquier dispositivo. Tus amigos pueden retar a tu equipo buscando “${esc(a.name)}”.</div><p><button data-act="logout" ${ui.busy ? 'disabled' : ''}>Cerrar sesión</button></p>`
      : `<div class="dim sm">Opcional. Sin cuenta, tu progreso vive solo en este navegador. Con cuenta se guarda en la nube; al entrar por primera vez se une con lo que ya tengas aquí.</div>
      <div class="form"><label>Email <input id="acemail" type="email" autocomplete="email" value="${esc(ui.acEmail)}"></label><label>Contraseña <input id="acpass" type="password" autocomplete="current-password" minlength="6"></label>
      <label>Nombre de cuenta <span class="dim sm">(solo al crearla; así te encuentran tus amigos)</span> <input id="acname" maxlength="14" value="${esc(ui.acName || ui.me.name.replace(/[^A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ-]/g, ''))}"></label></div>
      <div class="row"><button class="pri" data-act="login" ${ui.busy ? 'disabled' : ''}>Entrar</button><button data-act="signup" ${ui.busy ? 'disabled' : ''}>Crear cuenta</button></div>`}</div>`;
  }
  if (ui.homeTab === 'diario') {
    const day = today(), d = dailyOf(day);
    const rows = Array.isArray(ui.board2) ? ui.board2 : [];
    return `<div class="panel"><h3>Reto diario · ${day}</h3><div class="dim sm">Misma semilla para todo el mundo, ascensión 3 y dos modificadores. Para jugarlo, créalo en una sala marcando “Reto diario”.</div>
    <div class="cards c2">${d.mods.map((id) => { const mod = DAILY_MODS.find((x) => x.id === id)!; return `<div class="lootcard r2"><b>${esc(mod.name)}</b><div class="sm">${esc(mod.text)}</div></div>`; }).join('')}</div>
    <div class="lbl">Clasificación de hoy</div>
    ${ui.board2 === 'cargando' ? '<div class="dim">Cargando…</div>' : ui.board2 === 'error' ? '<div class="bad sm">No se pudo cargar la clasificación.</div>' : rows.length ? `<div class="rank">${rows.map((r, i) => `<div class="row"><b>${i + 1}.</b><span class="grow">${esc(r.names)} <span class="dim sm">(${r.players}J)</span></span><span class="${r.won ? 'good' : 'dim'} sm">${r.won ? 'Victoria' : `Zona ${r.zone + 1}`}</span><b class="pill">${r.score}</b></div>`).join('')}</div>` : '<div class="dim sm">Nadie ha jugado todavía hoy. ¡Sé el primero!</div>'}</div>`;
  }
  return '';
}

/** Ficha de un héroe guardado. */
export function champCard(c: Champion, inTeam: boolean, actions = true): string {
  const ups = Object.values(c.ups).reduce((a, l) => a + l.length, 0);
  return `<div class="lootcard ${c.won ? 'r3' : 'r1'}"><div class="row"><b>${esc(c.name)}</b><span class="dim sm">${CLASSES[c.cls].name}</span><span class="grow"></span>${c.won ? '<span>🏆</span>' : ''}${c.asc ? `<span class="pill sm">A${c.asc}</span>` : ''}</div>
  <div class="sm dim">${c.routes.map((r) => esc(findRoute(c.cls, r)?.name ?? r)).join(' + ')}</div>
  <div class="cells tiny">${Object.values(c.equip).map((it) => `<span class="cell ${RAR[it.rarity]}" ${tip(itemHtml(it))}>${itemIcon(it)}</span>`).join('')}</div>
  <div class="sm dim">✨ ${ups} mejoras</div>
  ${actions ? `<div class="row"><button class="mini ${inTeam ? 'pri' : ''}" data-act="champteam" data-id="${esc(c.id)}">${inTeam ? '✔ En el equipo' : 'Añadir al equipo'}</button><span class="grow"></span><button class="mini" data-act="champdel" data-id="${esc(c.id)}">Borrar</button></div>` : ''}</div>`;
}

export function homeScreen(msg: string): void {
  const host = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null;
  const m = meta();
  const tabs: Array<[typeof ui.homeTab, string]> = [['jugar', '⚔️ Jugar'], ['mejoras', `✨ Mejoras (${m.ecos})`], ['clases', '🎓 Maestría'], ['logros', `🏆 Logros ${m.achievements.length}/${ACHIEVEMENTS.length}`], ['salon', `🏟️ Salón y duelos`], ['diario', '📅 Reto diario'], ['amigos', `👥 Amigos${currentAccount() ? ` (${friendsStatus().filter((f) => f.online).length}/${m.friends.length})` : ''}`], ['cuenta', currentAccount() ? `👤 ${esc(currentAccount()!.name)}` : '👤 Cuenta']];
  ui.root.innerHTML = `<div class="home"><div class="row"><span class="grow"></span>${volumeControl()}</div><h1>RUNAS DEL ABISMO</h1><p class="dim">RPG táctico por turnos · cooperativo de 1 a 4 jugadores · 3 zonas</p>
  ${msg ? `<p class="bad">${esc(msg)}</p>` : ''}
  <div class="tabs htabs">${tabs.map(([id, n]) => `<button class="${ui.homeTab === id ? 'on' : ''}" data-act="htab" data-id="${id}">${n}</button>`).join('')}</div>
  ${ui.homeTab === 'jugar' ? `<div class="panel"><label>Tu nombre <input id="name" maxlength="14" value="${esc(ui.me.name)}"></label></div>
  <div class="cards">
    <div class="panel"><h3>Crear sala</h3><p class="dim sm">Serás el anfitrión. Comparte el código de 4 letras.</p><button class="pri" data-act="create">Crear sala</button></div>
    <div class="panel"><h3>Unirse</h3><p class="dim sm">Con el código que te pase el anfitrión.</p><input id="code" maxlength="4" placeholder="ABCD" class="codein"> <button class="pri" data-act="join">Unirse</button></div>
    <div class="panel"><h3>Un jugador</h3><p class="dim sm">Sin conexión con otros.</p><button data-act="solo">Jugar solo</button></div>
  </div>
  ${host ? `<p><button data-act="resume">Continuar la partida guardada de la sala ${esc(host.code)}</button></p>` : ''}
  <div class="panel dim sm"><b>Cómo se juega:</b> cada unidad juega en su turno, por iniciativa. Clic en una casilla azul para moverte (PM). Elige un hechizo y haz clic en un objetivo con borde dorado (PA). Los obstáculos tapan la línea de visión. Cada turno dura como máximo ${TURN_SECONDS} segundos. <button class="mini" data-act="tuto">Ver tutorial</button></div>` : metaPanel()}</div>${tutorialHtml()}`;
}

export function tutorialHtml(): string {
  if (meta().seenTutorial || ui.tutorial < 0) return '';
  const st = TUTORIAL[ui.tutorial];
  if (!st) return '';
  return `<div class="modal"><div class="panel"><div class="dim sm">Tutorial ${ui.tutorial + 1}/${TUTORIAL.length}</div><h2>${esc(st.title)}</h2><p>${esc(st.text)}</p>
  <div class="row"><button class="mini" data-act="tutoskip">Saltar</button><span class="grow"></span><button class="pri" data-act="tutonext">${ui.tutorial + 1 >= TUTORIAL.length ? '¡A jugar!' : 'Siguiente →'}</button></div></div></div>`;
}

/** Barra de maestría: nivel, experiencia y cuánto falta para el siguiente nivel. */
function masteryBar(cls: ClassId): string {
  const p = masteryProgress(cls);
  return `<span class="mbar" ${tip(p.next ? `<b>Maestría ${p.lv}/5</b><div class="sm">${p.xp}/${p.next} de experiencia: faltan ${p.next - p.xp} para el nivel ${p.lv + 1}.</div><div class="sm good">Nivel ${p.lv + 1}: ${esc(masteryText(cls, p.lv))}</div>` : '<b>Maestría máxima</b>')}><i style="width:${p.pct}%"></i><b>Maestría ${p.lv}/5${p.next ? ` · ${p.pct}%` : ''}</b></span><span class="dim sm mnext">${p.next ? `Faltan ${p.next - p.xp} exp para el nivel ${p.lv + 1}` : 'Maestría máxima'}</span>`;
}

export function lobbyScreen(): void {
  const s = ui.session!, me = ui.me;
  const players = s.lobby();
  const cls = CLASSES[me.cls];
  const open = openRoutes(me.cls), mlv = masteryOf(me.cls);
  const canDuel = s.isHost && myTeam().length > 0;
  const ready = players.slice(0, 4).filter((p) => p.routes.length > 0);
  const total = Math.min(4, players.length);
  ui.root.innerHTML = `<div class="bar"><span>Sala</span><b class="code">${esc(s.code)}</b>${s.t.kind === 'local' ? '<span class="dim">(local)</span>' : ''}
    <span class="dim sm">${!s.t.connected() ? '<b class="bad">⚠ Conexión perdida: reconectando…</b> ' : ''}${s.isHost ? 'Comparte el código. Cuando todos estén listos, pulsa Comenzar.' : s.hostPresent() ? 'Elige clase y kit inicial. El anfitrión comienza.' : 'Buscando al anfitrión… (puede tardar unos segundos)'}</span>
    ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}<span class="grow"></span>
    ${s.isHost ? `${ui.saved ? `<button data-act="doresume">Reanudar guardada (zona ${ui.saved.zone + 1}, sala ${ui.saved.step + 1})</button>` : ''}<button class="pri" data-act="start" ${ready.length && ready.length === total ? '' : 'disabled'}>⚔️ Comenzar (${ready.length}/${total})</button>` : ''}<button data-act="home">Salir</button></div>
  <div class="cols"><section class="main">
    ${s.isHost ? `<div class="panel"><div class="row"><b>Dificultad</b><span class="grow"></span><button class="mini" data-act="ascdown" ${ui.asc <= 0 || ui.daily ? 'disabled' : ''}>−</button><b class="pill">Ascensión ${ui.daily ? 3 : ui.asc}</b><button class="mini" data-act="ascup" ${ui.asc >= meta().maxAsc || ui.daily ? 'disabled' : ''}>+</button><label class="sm"><input type="checkbox" data-act="dailytoggle" ${ui.daily ? 'checked' : ''}> Reto diario</label></div>
      <div class="dim sm">${ui.daily ? dailyOf(today()).mods.map((id) => esc(DAILY_MODS.find((x) => x.id === id)!.name)).join(' + ') + ' · ranking compartido' : esc(ASCENSION.slice(0, ui.asc + 1).slice(-2).join(' '))}${meta().maxAsc < 1 && !ui.daily ? ' · Gana una partida para desbloquear la ascensión 1.' : ''}</div>
      ${ui.daily ? '' : `<div class="lbl">Modificadores <span class="dim">· hasta 3, +${Math.round(MOD_ECOS * 100)}% de ecos cada uno</span></div>
      <div class="chips">${DAILY_MODS.map((m) => `<button class="chip ${ui.mods.includes(m.id) ? 'r2 sel' : ''}" data-act="mod" data-id="${m.id}" ${tip(`<b>${esc(m.name)}</b><div class="sm">${esc(m.text)}</div>`)}>${ui.mods.includes(m.id) ? '✔ ' : ''}${esc(m.name)}</button>`).join('')}</div>`}</div>` : players.find((p) => p.host) ? (() => { const hp = players.find((p) => p.host)!; return `<div class="panel dim sm">Dificultad del anfitrión: ${hp.daily ? 'Reto diario' : `Ascensión ${hp.asc}${hp.abyss ? ' · con El Abismo' : ''}${hp.mods.length ? ` · ${hp.mods.map((id) => esc(DAILY_MODS.find((d) => d.id === id)?.name ?? id)).join(', ')}` : ''}`}</div>`; })() : ''}
    ${currentAccount() && s.t.kind === 'online' ? (() => { const fr = friendsStatus().filter((f) => f.online && f.room !== s.code); return fr.length ? `<div class="panel sm"><b>👥 Invitar:</b> ${fr.map((f) => `<button class="mini" data-act="invite" data-id="${esc(f.name)}">✉ ${esc(f.name)}</button>`).join(' ')}</div>` : ''; })() : ''}
    <div class="lbl">Tu clase <span class="dim">· maestría ${mlv}/5 con ${cls.name}</span></div>
    <div class="cards c5">${PLAYABLE.map((id) => { const c = CLASSES[id]; return `<button class="pick ${id === me.cls ? 'on' : ''}" data-act="cls" data-id="${id}"><b>${c.name}</b><img class="portrait" src="${classPortraitUrl(id)}" alt="${esc(c.name)}"><span class="dim sm">❤️ ${c.hp} · PA ${c.ap} · PM ${c.mp} · ⏱️ ${c.initiative}</span><span class="dim sm"><i>${esc(CLASS_STORY[id] ?? '')}</i></span>${masteryBar(id)}</button>`; }).join('')}</div>
    <div class="lbl">Tu kit inicial <span class="dim">· 3 habilidades; durante la partida las mejoras con bendiciones. Más kits con maestría.</span></div>
    <div class="cards c2">${cls.routes.map((r) => {
      const locked = !open.includes(r.id);
      const on = me.routes.includes(r.id);
      return `<button class="pick ${on ? 'on' : ''}" data-act="route" data-id="${r.id}" ${locked ? 'disabled' : ''}><b>${on ? '✔ ' : ''}${r.name}</b><span class="dim sm">${r.text}</span>
        <span class="row">${r.spells.map((id) => { const d = SPELLS[id]!; return `<span class="schip" ${tip(spellTip(d))}>${spellIcon(d)} ${esc(d.name)}</span>`; }).join('')}</span>
        ${locked ? `<i class="sm bad">🔒 Se desbloquea con maestría ${routeNeeds(me.cls, r.id)} de ${cls.name}: juega partidas con esta clase</i>` : ''}</button>`;
    }).join('')}</div>
  </section>
  <aside class="side"><div class="tabs"><button class="on">👥 Jugadores (${players.length}/4)</button></div><div class="tabbody">
    ${players.map((p, i) => `<div class="member ${i > 3 ? 'off' : ''}"><div class="row"><b class="p${i % 4}">${esc(p.name)}</b>${p.host ? '<span>👑</span>' : ''}${p.id === ui.myId ? '<span class="dim sm">(tú)</span>' : ''}<span class="grow"></span><span class="sm ${p.routes.length ? 'good' : 'dim'}">${p.routes.length ? 'Listo' : 'Eligiendo'}</span></div>
      <div class="sm">${esc(CLASSES[p.cls]?.name ?? '?')} <span class="dim">${p.routes.map((r) => esc(findRoute(p.cls, r)?.name ?? r)).join(' + ') || 'eligiendo kit'}</span></div>${i > 3 ? '<div class="bad sm">Sala llena</div>' : ''}${canDuel && p.id !== ui.myId && p.hasTeam ? `<button class="mini" data-act="duel" data-id="${esc(p.id)}">🏟️ Retar a duelo 3 contra 3</button>` : p.hasTeam ? '<div class="dim sm">🏟️ Tiene equipo de duelo</div>' : ''}</div>`).join('')}
  </div></aside></div>`;
}

function frame(run: RunState, main: string, selling = false): void {
  ui.root.innerHTML = `${topBar(run)}<div class="cols"><section class="main">${main}</section>${sidePanel(run, selling)}</div>`;
}

export function mapScreen(): void {
  const s = ui.session!, run = s.run!;
  const pending = Object.keys(run.offers).length;
  frame(run, `${run.step === 0 && ZONE_STORY[run.zone] ? `<div class="panel note story"><i>${esc(ZONE_STORY[run.zone]!)}</i></div>` : ''}${run.note ? `<div class="panel note">${esc(run.note)}</div>` : ''}
  ${run.allies.length ? `<div class="panel sm">🤝 Os acompañan: ${run.allies.map((a) => `<b>${esc(ALLIES[a]?.name ?? a)}</b>`).join(', ')} <span class="dim">(hasta el final de la zona)</span></div>` : ''}
  ${run.nextOmen ? `<div class="panel sm">Próximo combate: ${OMENS.find((o) => o.id === run.nextOmen)?.icon} <b>${esc(OMENS.find((o) => o.id === run.nextOmen)?.name ?? '')}</b></div>` : ''}
  <div class="lbl">Zona ${run.zone + 1}/${lastZone(run) + 1} · Sala ${run.step + 1} de ${run.map.length} · ${s.isHost ? 'elige el camino' : 'el anfitrión elige el camino'}</div>
  ${advanceBar(run, '', '')}
  <div class="cards c2">${availableNodes(run).map((i) => { const n = run.map[run.step]![i]!; return `<button class="pick node" data-act="node" data-id="${i}" ${s.isHost && !s.waiting().length ? '' : 'disabled'}><span class="nico">${NODE_ICON[n]}</span><span><b>${NODE_NAME[n].replace(/^\S+\s/, '')}</b><br><span class="dim sm">${NODE_HINT[n]}</span></span></button>`; }).join('')}</div>
  ${s.isHost && pending ? `<div class="dim sm">${pending} jugador${pending > 1 ? 'es' : ''} aún eligiendo botín: los caminos se desbloquean cuando todos estén listos.</div>` : ''}
  ${pendingRows(run)}`);
}

export function shopScreen(): void {
  const s = ui.session!, run = s.run!;
  const h = mine(run);
  frame(run, `<div class="row"><h2>💰 Mercader de reliquias</h2></div>${advanceBar(run, 'Salir de la tienda →')}
  <div class="dim sm">Cada objeto solo puede comprarlo un jugador. Para vender, selecciona un objeto de tu mochila (un tercio de su precio).</div>
  <div class="cards c3">${(run.shop ?? []).map((sl, i) => { const it = sl.item; const rl = sl.relic ? RELICS[sl.relic] : undefined;
    const cs = sl.consumable ? CONSUMABLES[sl.consumable] : undefined;
    if (cs) { const have = h?.bag2[sl.consumable!] ?? 0; const d = SPELLS[sl.consumable!]!; return `<div class="lootcard r1"><div class="row">${spellIcon(d)}<div><b>${esc(cs.name)}</b><div class="dim sm">Consumible de combate · llevas ${have}/${MAX_CONSUMABLE}</div><div class="sm">${esc(d.text)}</div></div></div><button class="pri" data-act="buy" data-id="${i}" ${!h || h.gold < sl.price || have >= MAX_CONSUMABLE ? 'disabled' : ''}>Comprar · ${sl.price} 💰</button></div>`; }
    if (rl) return `<div class="lootcard ${rl.rare ? 'r3' : 'r2'} ${sl.sold ? 'off' : ''}"><div class="row"><div class="cell big ${rl.rare ? 'r3' : 'r2'}"><span class="emo">${rl.icon}</span></div><div><b>${esc(rl.name)}</b><div class="dim sm">Reliquia ${rl.rare ? 'rara' : 'común'} · para toda la partida</div><div class="sm">${esc(rl.text)}</div></div></div><button class="pri" data-act="buy" data-id="${i}" ${sl.sold || !h || h.gold < sl.price || h.relics.includes(rl.id) ? 'disabled' : ''}>${sl.sold ? 'Vendido' : h?.relics.includes(rl.id) ? 'Ya la tienes' : `Comprar · ${sl.price} 💰`}</button></div>`;
    return `<div class="lootcard ${RAR[it?.rarity ?? 0]} ${sl.sold ? 'off' : ''}">${it ? `<div class="row"><div class="cell big ${RAR[it.rarity]}">${itemIcon(it)}</div><div>${itemHtml(it)}</div></div>${h ? diffHtml(it, h) : ''}` : ''}
      <button class="pri" data-act="buy" data-id="${i}" ${sl.sold || !h || h.gold < sl.price ? 'disabled' : ''}>${sl.sold ? 'Vendido' : `Comprar · ${sl.price} 💰`}</button></div>`; }).join('')}
    ${''}<div class="lootcard"><div class="row"><div class="cell big"><span class="emo">🧪</span></div><div><b>Poción de vida</b><div class="sm">Recupera el ${POTION_HEAL * 100}% de tu vida máxima.</div></div></div><button class="pri" data-act="potion" ${!h || h.gold < POTION_PRICE || h.hp >= heroMaxHp(h) ? 'disabled' : ''}>Beber · ${POTION_PRICE} 💰</button></div></div>${pendingRows(run)}`, true);
}

export function eventScreen(): void {
  const s = ui.session!, run = s.run!, ev = run.event!;
  const def = eventDef(run)!;
  const voters = (i: number): string => run.heroes.filter((h) => ev.votes[h.owner] === i).map((h) => esc(h.name)).join(', ');
  const canVote = !!mine(run) && !ev.result;
  frame(run, `<h2>❓ ${esc(def.title)}</h2><div class="panel note">${esc(def.text)}</div>
  <div class="dim sm">Evento de grupo: decide la mayoría y afecta a todos. En empate decide el anfitrión.</div>
  ${ev.result ? `<div class="panel note"><b>${esc(ev.result)}</b></div>` : `<div class="cards c2">${def.options.map((o, i) => `<button class="pick ${ev.votes[ui.myId] === i ? 'on' : ''}" data-act="vote" data-id="${i}" ${canVote ? '' : 'disabled'}><b>${esc(o.label)}</b><span class="dim sm">${esc(o.hint)}</span><span class="pill sm">${voters(i) ? `Votos: ${voters(i)}` : 'Sin votos'}</span></button>`).join('')}</div>`}
  ${ev.result ? advanceBar(run, 'Continuar →') : `<div class="row">${s.isHost ? `<button data-act="resolve" ${Object.keys(ev.votes).length ? '' : 'disabled'}>Cerrar la votación ya</button>` : '<span class="dim sm">Votad todos para continuar.</span>'}</div>`}${pendingRows(run)}`);
}

export function endScreen(): void {
  const s = ui.session!, run = s.run!;
  ui.tab = 'grupo';
  if (run.arena) {
    const iWon = (run.phase === 'won') === (run.arena.a === ui.myId);
    const playing = run.arena.a === ui.myId || run.arena.b === ui.myId;
    ui.root.innerHTML = `${topBar(run)}<div class="home"><h1>${playing ? (iWon ? '¡VICTORIA!' : 'DERROTA') : 'FIN DEL DUELO'}</h1><p>${esc(run.note)}</p>
    <div class="row">${s.t.kind === 'local' ? '' : s.isHost ? '<button class="pri" data-act="again">Volver a la sala</button>' : '<span class="dim sm">Esperando al anfitrión…</span>'}<button data-act="home">Volver al inicio</button></div></div>`;
    return;
  }
  const won = run.phase === 'won';
  const myHero = mine(run);
  const saved = !!myHero && meta().hall.some((c) => c.id === championOf(run, myHero).id);
  const res = settle(run, ui.myId);
  const total = run.heroes.reduce((a, h) => a + h.stats.dmg, 0) || 1;
  const m = meta();
  const score = run.daily ? dailyScore(run) : 0;
  frame(run, `<div class="home"><h1>${won ? '¡VICTORIA!' : 'HABÉIS CAÍDO'}</h1>
  <p>${won ? esc(ENDING_WON) : `${esc(ENDING_LOST)} <span class="dim">(Zona ${run.zone + 1}, sala ${run.step + 1}.)</span>`}</p>
  ${run.daily ? `<p class="pill">Reto diario ${esc(run.daily)}: ${score} puntos</p>` : run.asc ? `<p class="dim">Ascensión ${run.asc}</p>` : ''}
  <div class="panel"><div class="row"><h3>Tu recompensa</h3><span class="grow"></span><b class="pill">+${res?.ecos ?? ecosFor(run)} ✨ ecos</b><span class="dim sm">(tienes ${m.ecos})</span></div>
    ${res?.asc ? `<div class="good">🔓 Ascensión ${res.asc} desbloqueada: la próxima partida puede ser más difícil y dar más ecos.</div>` : ''}
    ${res?.achievements.length ? res.achievements.map((a) => `<div class="lootcard r3"><b>🏆 ${esc(a.name)}</b> <span class="sm">${esc(a.text)}</span><div class="sm good">${[a.ecos ? `+${a.ecos} ✨` : ''].filter(Boolean).join(' · ')}</div></div>`).join('') : ''}
    ${res ? `<div class="row sm"><b>🎓 Maestría de ${CLASSES[res.mastery.cls].name}</b><span class="good">+${res.mastery.xp} exp</span><span class="grow"></span><span class="pill">Nivel ${res.mastery.after}/5</span></div>${res.mastery.after > res.mastery.before ? Array.from({ length: res.mastery.after - res.mastery.before }, (_, k) => res.mastery.before + k).map((i) => `<div class="good">🔓 ${esc(masteryText(res.mastery.cls, i))}</div>`).join('') : `<div class="dim sm">${MASTERY_XP[res.mastery.after] ? `Faltan ${MASTERY_XP[res.mastery.after]! - res.mastery.total} de experiencia para el nivel ${res.mastery.after + 1}: ${esc(masteryText(res.mastery.cls, res.mastery.after))}` : 'Maestría máxima.'}</div>`}${masteryBar(res.mastery.cls)}` : ''}
    <div class="dim sm">Gasta tus ecos en <b>Mejoras</b> (pantalla de inicio): vida, oro y re-tiradas permanentes.</div></div>
  <div class="panel"><h3>Resumen del grupo</h3>${run.heroes.map((h, i) => `<div class="row sm"><b class="p${i % 4}">${esc(h.name)}</b><span class="dim">${CLASSES[h.cls].name}</span><span class="grow"></span><span>⚔️ ${h.stats.dmg} (${Math.round((h.stats.dmg / total) * 100)}%)</span><span>☠️ ${h.stats.kills}</span><span>✚ ${h.stats.heal}</span><span class="${h.stats.falls ? 'bad' : 'good'}">💀 ${h.stats.falls}</span></div>`).join('')}</div>
  ${myHero ? `<div class="panel"><div class="row"><div><b>🏟️ Salón de héroes</b><div class="dim sm">Guarda a ${esc(myHero.name)} tal como está para tus duelos 3 contra 3 y para que vuelva como Némesis.</div></div><span class="grow"></span><button data-act="champsave" ${saved ? 'disabled' : ''}>${saved ? '✔ Guardado' : 'Guardar en el Salón'}</button></div></div>` : ''}
  <div class="row">${s.isHost ? '<button class="pri" data-act="again">⚔️ Jugar otra partida</button>' : '<span class="dim sm">Esperando al anfitrión para otra partida…</span>'}<button data-act="home">Volver al inicio</button></div></div>`);
}
