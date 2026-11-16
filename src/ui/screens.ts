// Pantallas fuera del combate: inicio, sala, mapa, tienda, evento y final.
import { CLASSES, MAX_ROUTES, blockedRoutes, findRoute } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { RUNES } from '../core/runes';
import type { ClassId } from '../core/state';
import { NODE_HINT, NODE_NAME, POTION_HEAL, POTION_PRICE, eventDef, heroMaxHp, type RunState } from '../game/run';
import { TURN_SECONDS } from '../game/session';
import { esc, mine, store, tip, ui } from './ctx';
import { NODE_ICON, itemIcon, spellIcon } from './icons';
import { diffHtml, itemHtml, lootRow, sidePanel, topBar } from './panels';

const RAR = ['r0', 'r1', 'r2', 'r3'];

export function homeScreen(msg: string): void {
  const host = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null;
  ui.root.innerHTML = `<div class="home"><h1>RUNAS DEL ABISMO</h1><p class="dim">RPG táctico por turnos · cooperativo de 1 a 4 jugadores · 3 zonas</p>
  ${msg ? `<p class="bad">${esc(msg)}</p>` : ''}
  <div class="panel"><label>Tu nombre <input id="name" maxlength="14" value="${esc(ui.me.name)}"></label></div>
  <div class="cards">
    <div class="panel"><h3>Crear sala</h3><p class="dim sm">Serás el anfitrión. Comparte el código de 4 letras.</p><button class="pri" data-act="create">Crear sala</button></div>
    <div class="panel"><h3>Unirse</h3><p class="dim sm">Con el código que te pase el anfitrión.</p><input id="code" maxlength="4" placeholder="ABCD" class="codein"> <button class="pri" data-act="join">Unirse</button></div>
    <div class="panel"><h3>Un jugador</h3><p class="dim sm">Sin conexión con otros.</p><button data-act="solo">Jugar solo</button></div>
  </div>
  ${host ? `<p><button data-act="resume">Continuar la partida guardada de la sala ${esc(host.code)}</button></p>` : ''}
  <div class="panel dim sm"><b>Cómo se juega:</b> cada unidad juega en su turno, por iniciativa. Clic en una casilla azul para moverte (PM). Elige un hechizo y haz clic en un objetivo con borde dorado (PA). Los obstáculos tapan la línea de visión. Cada turno dura como máximo ${TURN_SECONDS} segundos.</div></div>`;
}

export function lobbyScreen(): void {
  const s = ui.session!, me = ui.me;
  const players = s.lobby();
  const cls = CLASSES[me.cls];
  const blocked = blockedRoutes(me.cls, me.routes);
  const ready = players.slice(0, 4).filter((p) => p.routes.length > 0);
  const total = Math.min(4, players.length);
  ui.root.innerHTML = `<div class="bar"><span>Sala</span><b class="code">${esc(s.code)}</b>${s.t.kind === 'local' ? '<span class="dim">(local)</span>' : ''}
    <span class="dim sm">${s.isHost ? 'Comparte el código. Cuando todos tengan ruta, pulsa Comenzar.' : s.hostPresent() ? 'Elige clase y rutas. El anfitrión comienza.' : 'Buscando al anfitrión… (puede tardar unos segundos)'}</span>
    ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}<span class="grow"></span>
    ${s.isHost ? `${ui.saved ? `<button data-act="doresume">Reanudar guardada (zona ${ui.saved.zone + 1}, sala ${ui.saved.step + 1})</button>` : ''}<button class="pri" data-act="start" ${ready.length && ready.length === total ? '' : 'disabled'}>⚔️ Comenzar (${ready.length}/${total})</button>` : ''}<button data-act="home">Salir</button></div>
  <div class="cols"><section class="main">
    <div class="lbl">Tu clase</div>
    <div class="cards c4">${(Object.keys(CLASSES) as ClassId[]).map((id) => { const c = CLASSES[id]; return `<button class="pick ${id === me.cls ? 'on' : ''}" data-act="cls" data-id="${id}"><b>${c.name}</b><span class="dim sm">❤️ ${c.hp} · PA ${c.ap} · PM ${c.mp} · ⏱️ ${c.initiative}</span></button>`; }).join('')}</div>
    <div class="lbl">Tus rutas <span class="dim">· elige 1 o ${MAX_ROUTES}; cada ruta bloquea a su opuesta</span></div>
    <div class="cards c2">${cls.routes.map((r) => {
      const on = me.routes.includes(r.id), off = !on && blocked.includes(r.id);
      const why = off ? (me.routes.includes(r.opposite) ? `🔒 Bloqueada por ${findRoute(me.cls, r.opposite)!.name}` : '🔒 Ya tienes 2 rutas') : `Opuesta: ${findRoute(me.cls, r.opposite)!.name}`;
      return `<button class="pick ${on ? 'on' : ''}" data-act="route" data-id="${r.id}" ${off ? 'disabled' : ''}><b>${on ? '✔ ' : ''}${r.name}</b><span class="dim sm">${r.text}</span>
        <span class="row">${r.spells.map((id, i) => { const d = SPELLS[id]!; return `<span class="schip" ${tip(`<b>${esc(d.name)}</b> <span class="dim">nivel ${i + 1}</span><div class="sm">${esc(d.text)}</div><div class="dim sm">${d.ap} PA${d.dmg ? ` · daño ${d.dmg[0]}-${d.dmg[1]}` : ''}${d.cd ? ` · espera ${d.cd}` : ''}</div>`)}>${spellIcon(d)} ${esc(d.name)}</span>`; }).join('')}</span>
        <i class="sm ${off ? 'bad' : 'dim'}">${why}</i></button>`;
    }).join('')}</div>
  </section>
  <aside class="side"><div class="tabs"><button class="on">👥 Jugadores (${players.length}/4)</button></div><div class="tabbody">
    ${players.map((p, i) => `<div class="member ${i > 3 ? 'off' : ''}"><div class="row"><b class="p${i % 4}">${esc(p.name)}</b>${p.host ? '<span>👑</span>' : ''}${p.id === ui.myId ? '<span class="dim sm">(tú)</span>' : ''}<span class="grow"></span><span class="sm ${p.routes.length ? 'good' : 'dim'}">${p.routes.length ? 'Listo' : 'Eligiendo'}</span></div>
      <div class="sm">${esc(CLASSES[p.cls]?.name ?? '?')} <span class="dim">${p.routes.map((r) => esc(findRoute(p.cls, r)?.name ?? r)).join(' + ') || 'sin ruta'}</span></div>${i > 3 ? '<div class="bad sm">Sala llena</div>' : ''}</div>`).join('')}
  </div></aside></div>`;
}

function frame(run: RunState, main: string, selling = false): void {
  ui.root.innerHTML = `${topBar(run)}<div class="cols"><section class="main">${main}</section>${sidePanel(run, selling)}</div>`;
}

export function mapScreen(): void {
  const s = ui.session!, run = s.run!;
  const pending = Object.keys(run.offers).length;
  frame(run, `${run.note ? `<div class="panel note">${esc(run.note)}</div>` : ''}
  <div class="path">${run.map.map((nodes, i) => `<div class="step ${i === run.step ? 'on' : i < run.step ? 'done' : ''}" ${tip(`Sala ${i + 1}: ${nodes.map((n) => NODE_NAME[n]).join(' o ')}`)}>${nodes.map((n) => `<span>${NODE_ICON[n]}</span>`).join('')}</div>`).join('<i></i>')}</div>
  <div class="lbl">Sala ${run.step + 1} de ${run.map.length} · ${s.isHost ? 'elige el camino' : 'el anfitrión elige el camino'}</div>
  <div class="cards c2">${(run.map[run.step] ?? []).map((n, i) => `<button class="pick node" data-act="node" data-id="${i}" ${s.isHost ? '' : 'disabled'}><span class="nico">${NODE_ICON[n]}</span><span><b>${NODE_NAME[n].replace(/^\S+\s/, '')}</b><br><span class="dim sm">${NODE_HINT[n]}</span></span></button>`).join('')}</div>
  ${s.isHost && pending ? `<div class="dim sm">${pending} jugador${pending > 1 ? 'es' : ''} aún eligiendo botín; si avanzas lo pierden.</div>` : ''}
  ${lootRow(run)}`);
}

export function shopScreen(): void {
  const s = ui.session!, run = s.run!;
  const h = mine(run);
  frame(run, `<div class="row"><h2>💰 Mercader de reliquias</h2><span class="grow"></span>${s.isHost ? '<button class="pri" data-act="leavenode">Salir de la tienda →</button>' : '<span class="dim sm">El anfitrión decide cuándo seguir</span>'}</div>
  <div class="dim sm">Cada objeto solo puede comprarlo un jugador. Para vender, selecciona un objeto de tu mochila (un tercio de su precio).</div>
  <div class="cards c3">${(run.shop ?? []).map((sl, i) => { const rn = sl.rune ? RUNES[sl.rune] : undefined; const it = sl.item;
    return `<div class="lootcard ${rn ? (rn.rare ? 'r2' : 'r1') : RAR[it?.rarity ?? 0]} ${sl.sold ? 'off' : ''}">${rn ? `<div class="row"><div class="cell big ${rn.rare ? 'r2' : 'r1'}"><span class="emo">${rn.icon}</span></div><div><b class="${rn.rare ? 'r2' : 'r1'}">${esc(rn.name)}</b><div class="dim sm">Runa ${rn.rare ? 'rara' : 'común'}</div><div class="sm">${esc(rn.text)}</div></div></div>` : it ? `<div class="row"><div class="cell big ${RAR[it.rarity]}">${itemIcon(it)}</div><div>${itemHtml(it)}</div></div>${h ? diffHtml(it, h) : ''}` : ''}
      <button class="pri" data-act="buy" data-id="${i}" ${sl.sold || !h || h.gold < sl.price ? 'disabled' : ''}>${sl.sold ? 'Vendido' : `Comprar · ${sl.price} 💰`}</button></div>`; }).join('')}
    <div class="lootcard"><div class="row"><div class="cell big"><span class="emo">🧪</span></div><div><b>Poción de vida</b><div class="sm">Recupera el ${POTION_HEAL * 100}% de tu vida máxima.</div></div></div><button class="pri" data-act="potion" ${!h || h.gold < POTION_PRICE || h.hp >= heroMaxHp(h) ? 'disabled' : ''}>Beber · ${POTION_PRICE} 💰</button></div></div>`, true);
}

export function eventScreen(): void {
  const s = ui.session!, run = s.run!, ev = run.event!;
  const def = eventDef(run)!;
  const voters = (i: number): string => run.heroes.filter((h) => ev.votes[h.owner] === i).map((h) => esc(h.name)).join(', ');
  const canVote = !!mine(run) && !ev.result;
  frame(run, `<h2>❓ ${esc(def.title)}</h2><div class="panel note">${esc(def.text)}</div>
  <div class="dim sm">Evento de grupo: decide la mayoría y afecta a todos. En empate decide el anfitrión.</div>
  ${ev.result ? `<div class="panel note"><b>${esc(ev.result)}</b></div>` : `<div class="cards c2">${def.options.map((o, i) => `<button class="pick ${ev.votes[ui.myId] === i ? 'on' : ''}" data-act="vote" data-id="${i}" ${canVote ? '' : 'disabled'}><b>${esc(o.label)}</b><span class="dim sm">${esc(o.hint)}</span><span class="pill sm">${voters(i) ? `Votos: ${voters(i)}` : 'Sin votos'}</span></button>`).join('')}</div>`}
  <div class="row">${s.isHost ? (ev.result ? '<button class="pri" data-act="leavenode">Continuar →</button>' : `<button data-act="resolve" ${Object.keys(ev.votes).length ? '' : 'disabled'}>Cerrar la votación ya</button>`) : `<span class="dim sm">${ev.result ? 'Esperando al anfitrión…' : 'Votad todos para continuar.'}</span>`}</div>`);
}

export function endScreen(): void {
  const run = ui.session!.run!;
  ui.tab = 'grupo';
  frame(run, `<div class="home"><h1>${run.phase === 'won' ? '¡VICTORIA!' : 'HABÉIS CAÍDO'}</h1>
  <p>${run.phase === 'won' ? esc(run.note) : `La zona ${run.zone + 1} reclama a otro grupo de aventureros en la sala ${run.step + 1}.`}</p>
  <p class="dim">Combates ganados: ${run.fight}</p><button class="pri" data-act="home">Volver al inicio</button></div>`);
}
