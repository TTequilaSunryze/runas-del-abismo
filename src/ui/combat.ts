// Pantalla de combate: tablero, orden de iniciativa, barra de hechizos y registro.
import { SPELLS } from '../core/classes/spells';
import { current, getUnit, spellOf } from '../core/combat/engine';
import { RUNES } from '../core/runes';
import type { GameEvent } from '../core/state';
import { Board, STATUS_NAME } from '../render/board';
import { esc, tip, ui } from './ctx';
import { spellIcon } from './icons';
import { hpBar, sysButtons } from './panels';

export function addLog(events: GameEvent[]): void {
  const c = ui.session?.run?.combat;
  if (!c) return;
  const n = (id: number): string => esc(getUnit(c, id)?.name ?? '?');
  for (const e of events) {
    let s = '';
    if (e.t === 'turn') s = `<span class="pill">▸ ${n(e.unit)}</span>`;
    else if (e.t === 'cast') s = `${n(e.unit)} usa <b>${esc(SPELLS[e.spell]?.name ?? e.spell)}</b>`;
    else if (e.t === 'damage') s = `· ${n(e.unit)} <span class="bad">-${e.amount}</span>${e.crit ? ' crítico' : ''}${e.absorbed ? ` (escudo ${e.absorbed})` : ''}`;
    else if (e.t === 'heal') s = `· ${n(e.unit)} <span class="good">+${e.amount}</span>`;
    else if (e.t === 'status') s = `· ${n(e.unit)}: ${STATUS_NAME[e.kind]}`;
    else if (e.t === 'skip') s = `· ${n(e.unit)} pierde el turno`;
    else if (e.t === 'death') s = `✝ ${n(e.unit)} cae`;
    else if (e.t === 'summon') s = `<span class="bad">Aparece ${n(e.unit)}</span>`;
    else if (e.t === 'trap') s = `· ${n(e.unit)} pisa unas púas`;
    else if (e.t === 'phase') s = `<b class="bad">¡Segunda fase: ${n(e.unit)}!</b>`;
    else if (e.t === 'over') s = `<b>${e.result === 'win' ? '¡Victoria!' : 'Derrota'}</b>`;
    if (s) ui.log.push(s);
  }
  ui.log.splice(0, Math.max(0, ui.log.length - 80));
}

const pips = (n: number, max: number, cls: string): string => `<span class="pips ${cls}">${Array.from({ length: Math.max(n, max) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

export function combatScreen(events: GameEvent[]): void {
  const s = ui.session!, run = s.run!, c = run.combat!;
  if (ui.screen !== 'combat') {
    ui.root.innerHTML = `<div id="info" class="bar"></div><div id="init" class="init"></div><div class="stage"><canvas id="cv"></canvas></div><div id="hud" class="hud"></div><div id="log" class="log" data-act="togglelog"></div>`;
    ui.board?.destroy();
    ui.board = new Board(document.getElementById('cv') as HTMLCanvasElement, s);
    ui.board.onSelect = () => ui.rerender();
  }
  const board = ui.board!;
  board.applyEvents(events);
  (document.getElementById('cv') as HTMLCanvasElement).style.setProperty('--ar', String(c.w / c.h));
  const cur = current(c), me = s.myUnit(), myTurn = s.isMyTurn();
  if (!myTurn && board.sel) board.sel = null;
  const left = s.turnEndsAt ? Math.max(0, Math.ceil((s.turnEndsAt - Date.now()) / 1000)) : 0;
  const kind = run.kind === 'boss' ? '👑 JEFE' : run.kind === 'elite' ? '☠️ Élite' : '⚔️ Combate';
  document.getElementById('info')!.innerHTML = `<b>${kind}</b><span class="dim sm">Zona ${run.zone + 1} · sala ${run.step + 1}/${run.map.length} · ronda ${c.round}</span>
    <span class="turn ${myTurn ? 'mine' : ''}">${c.over ? (c.over === 'win' ? '¡Victoria!' : 'Derrota') : myTurn ? 'TU TURNO' : cur ? `Turno de ${esc(cur.name)}` : ''}</span><span id="clock" class="dim">${left && !c.over ? `${left}s` : ''}</span>
    ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}${!s.hostPresent() ? '<span class="bad">Anfitrión desconectado: partida en pausa</span>' : ''}
    ${s.isHost && cur && !cur.ai && !myTurn && !c.over ? '<button class="mini" data-act="skip">Pasar su turno</button>' : ''}<span class="grow"></span>${sysButtons()}`;
  const heroIdx = new Map(c.units.filter((u) => u.team === 'hero').map((u, i) => [u.id, i]));
  document.getElementById('init')!.innerHTML = c.order.map((id) => getUnit(c, id)!).filter((u) => u.hp > 0)
    .map((u) => `<span class="ini ${cur?.id === u.id ? 'on' : ''} ${u.team === 'hero' ? `p${heroIdx.get(u.id)! % 4}` : 'en'}" ${tip(`<b>${esc(u.name)}</b><div class="sm">${u.hp}/${u.maxHp} PV · iniciativa ${u.initiative}</div>`)}>${esc(u.name.split(' ')[0])}<i style="width:${(u.hp / u.maxHp) * 100}%"></i></span>`).join('');
  document.getElementById('hud')!.innerHTML = me
    ? `<div class="me"><b>${esc(me.name)}</b>${hpBar(me.hp, me.maxHp, me.shield)}<div class="row"><span class="sm pill">PA</span>${pips(me.ap, me.maxAp, 'ap')}</div><div class="row"><span class="sm blu">PM</span>${pips(me.mp, me.maxMp, 'mp')}</div></div>
      <div class="spellbar">${me.spells.map((sp, i) => { const d = spellOf(me, sp.id)!; const rn = sp.rune ? RUNES[sp.rune] : undefined; const off = !myTurn || me.ap < d.ap || sp.cd > 0 || me.hp <= 0;
        const range = d.range[1] === 0 ? (d.area ? `a tu alrededor (área ${d.area})` : 'sobre ti') : `alcance ${d.range[0] === d.range[1] ? d.range[1] : `${d.range[0]}-${d.range[1]}`}${d.area ? ` · área ${d.area}` : ''}`;
        return `<button class="sbtn ${board.sel === d.id ? 'on' : ''} ${sp.cd > 0 ? 'cd' : ''}" data-act="spell" data-id="${d.id}" ${off ? 'disabled' : ''} ${tip(`<b>${esc(d.name)}</b><div class="sm">${esc(d.text)}</div><div class="sm dim">${d.ap} PA · ${range}${d.dmg ? ` · daño ${d.dmg[0]}-${d.dmg[1]}` : ''}${d.los && d.range[1] > 1 ? ' · necesita línea de visión' : ''}${d.cd ? ` · espera ${d.cd} turno(s)` : ''}</div>${rn ? `<div class="sm pill">${rn.icon} ${esc(rn.name)}: ${esc(rn.text)}</div>` : ''}${sp.cd > 0 ? `<div class="sm bad">Disponible en ${sp.cd} turno(s)</div>` : ''}`)}>
          <kbd>${i + 1}</kbd><span class="sico">${spellIcon(d)}</span><span class="cost">${d.ap}</span>${rn ? `<span class="rn">${rn.icon}</span>` : ''}${sp.cd > 0 ? `<span class="cdn">${sp.cd}</span>` : ''}<small>${esc(d.name)}</small></button>`; }).join('')}</div>
      <button class="pri endturn" data-act="end" ${myTurn ? '' : 'disabled'}>Terminar<br>turno<br><small>(E)</small></button>`
    : '<span class="dim">Estás como espectador en este combate.</span>';
  const lg = document.getElementById('log')!;
  lg.className = `log ${ui.logOpen ? 'open' : ''}`;
  lg.innerHTML = ui.log.slice(ui.logOpen ? -40 : -6).map((l) => `<span>${l}</span>`).join('');
  lg.scrollTop = 1e9;
}
