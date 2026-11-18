// Pantalla de combate: tablero, orden de iniciativa, barra de hechizos y registro.
import { SPELLS } from '../core/classes/spells';
import { SOULS_PER_ARMOR, apCost, current, essenceNeed, furyCrit, furyPower, getUnit, spellOf, usableMp } from '../core/combat/engine';
import { marksOf } from '../core/combat/marks';
import type { CombatState, Unit } from '../core/state';
import { OMENS } from '../content/modes';
import type { GameEvent } from '../core/state';
import { Board, STATUS_NAME } from '../render/board';
import { esc, tip, ui } from './ctx';
import { spellIcon, spellTip } from './icons';
import { blessingBar, hpBar, sysButtons } from './panels';

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
    else if (e.t === 'explode') s = `<span class="bad">${n(e.unit)} explota</span>`;
    else if (e.t === 'split') s = `<span class="bad">${n(e.unit)} se divide</span>`;
    else if (e.t === 'blink') s = `<span class="bad">${n(e.unit)} aparece de las sombras</span>`;
    else if (e.t === 'snare') s = `· ${n(e.unit)} cae en un cepo`;
    else if (e.t === 'drain' && (e.ap < 0 || e.mp < 0)) s = `· ${n(e.unit)} pierde ${[e.ap ? `${-e.ap} PA` : '', e.mp ? `${-e.mp} PM` : ''].filter(Boolean).join(' y ')}`;
    else if (e.t === 'resist') s = `· ${n(e.unit)}: ${esc(e.what)}`;
    else if (e.t === 'tackle') s = `· ${n(e.unit)} queda placado y pierde ${e.lost} PM`;
    else if (e.t === 'revive') s = `<span class="good">${n(e.unit)} vuelve a la vida</span>`;
    else if (e.t === 'stuck') s = `· ${n(e.unit)} queda atrapado en el charco`;
    else if (e.t === 'devour') s = `<span class="bad">${n(e.unit)} devora un cadáver</span>`;
    else if (e.t === 'raise') s = `<span class="bad">${n(e.unit)} alza a un muerto</span>`;
    else if (e.t === 'phase') s = `<b class="bad">¡Segunda fase: ${n(e.unit)}!</b>`;
    else if (e.t === 'over') s = `<b>${e.result === 'win' ? '¡Victoria!' : 'Derrota'}</b>`;
    if (s) ui.log.push(s);
  }
  ui.log.splice(0, Math.max(0, ui.log.length - 80));
}

const TRAIT_TEXT: Record<string, string> = {
  bomb: 'Explota al morir: daña a todo lo que tenga pegado.', split: 'Al morir se divide en dos copias menores.', regen: 'Recupera el 8% de su vida cada turno.', thorns: 'Devuelve el 30% del daño cuerpo a cuerpo.', enrage: '+40% de daño por debajo de la mitad de vida.', trapper: 'Esconde cepos junto a los héroes.', blink: 'Aparece junto a su presa más frágil.',
  venom: 'Sus venenos aplican una carga más.', ignite: 'Su daño quema.', execute: 'Sus críticos hacen el doble.', mender: 'Cura y protege un 30% más.',
  puddle: 'Al morir deja un charco que inmoviliza.', guard: 'Empieza su turno con escudo (15% de su vida, máx. 24).', devour: 'Se cura devorando cadáveres.',
  raise: 'Alza a los muertos como aliados.', ghost: 'Atraviesa obstáculos.', hunter: 'Persigue al héroe más frágil.', pack: 'Más daño por cada compañero de manada.',
};
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
  board.showBars = ui.hpBars;
  board.applyEvents(events);
  (document.getElementById('cv') as HTMLCanvasElement).style.setProperty('--ar', String(c.w / c.h));
  const cur = current(c), me = s.myUnit(), myTurn = s.isMyTurn();
  const omenDef = run.omen ? OMENS.find((o) => o.id === run.omen) : undefined;
  if (!myTurn && board.sel) board.sel = null;
  const left = s.turnEndsAt ? Math.max(0, Math.ceil((s.turnEndsAt - Date.now()) / 1000)) : 0;
  const kind = run.arena ? `🏟️ Duelo: ${esc(run.arena.nameA)} contra ${esc(run.arena.nameB)}` : run.kind === 'boss' ? '👑 JEFE' : run.kind === 'elite' ? '☠️ Élite' : '⚔️ Combate';
  document.getElementById('info')!.innerHTML = `${run.arena ? '' : blessingBar(run)}<b>${kind}</b><span class="dim sm">${run.arena ? '' : `Zona ${run.zone + 1} · sala ${run.step + 1}/${run.map.length} · `}ronda ${c.round}</span>${c.round >= 30 ? `<span class="bad sm" ${tip('Muerte súbita: el Abismo consume a todos al empezar su turno (5% de la vida máxima por cada ronda desde la 30).')}>☠ El Abismo consume</span>` : c.round >= 26 ? `<span class="bad sm">☠ ronda 30: muerte súbita</span>` : ''}${c.round >= 20 ? `<span class="bad sm" ${tip('Desde la ronda 20 nadie se regenera ni recibe escudos automáticos, y los pilares dejan de curar.')}>⌛ Sin regeneración</span>` : c.round >= 16 ? `<span class="dim sm">⌛ ronda 20: fin de regeneración</span>` : ''}${omenDef ? `<span class="pill sm omen" ${tip(`<b>${omenDef.icon} ${esc(omenDef.name)}</b><div class="sm">${esc(omenDef.text)}</div>`)}>${omenDef.icon} ${esc(omenDef.name)}</span>` : ''}
    <span class="turn ${myTurn ? 'mine' : ''}">${c.over ? (c.over === 'win' ? '¡Victoria!' : 'Derrota') : myTurn ? 'TU TURNO' : cur ? `Turno de ${esc(cur.name)}` : ''}</span><span id="clock" class="dim">${left && !c.over ? `${left}s` : ''}</span>
    ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}${!s.t.connected() ? '<span class="bad">⚠ Conexión perdida: reconectando…</span>' : !s.hostPresent() ? '<span class="bad">Anfitrión desconectado: partida en pausa</span>' : ''}
    ${s.isHost && cur && !cur.ai && !myTurn && !c.over ? '<button class="mini" data-act="skip">Pasar su turno</button>' : ''}<span class="grow"></span>${sysButtons()}`;
  const heroIdx = new Map(c.units.filter((u) => u.team === 'hero').map((u, i) => [u.id, i]));
  const mineTeam = me?.team ?? 'hero';
  document.getElementById('init')!.innerHTML = c.order.map((id) => getUnit(c, id)!).filter((u) => u.hp > 0)
    .map((u) => `<span class="ini ${cur?.id === u.id ? 'on' : ''} ${u.team === mineTeam ? `p${(heroIdx.get(u.id) ?? 0) % 4}` : 'en'}" ${tip(`<b>${esc(u.name)}</b><div class="sm">${u.hp}/${u.maxHp} PV · iniciativa ${u.initiative}</div>${(u.traits ?? []).map((t) => `<div class="sm dim">${esc(TRAIT_TEXT[t] ?? t)}</div>`).join('')}`)}>${esc(u.name.split(' ')[0])}<i style="width:${(u.hp / u.maxHp) * 100}%"></i></span>`).join('');
  document.getElementById('hud')!.innerHTML = me
    ? `<div class="me"><b>${esc(me.name)}</b>${hpBar(me.hp, me.maxHp, me.shield)}<div class="row"><span class="sm pill">PA</span>${pips(me.ap, me.maxAp, 'ap')}</div><div class="row"><span class="sm blu">PM</span>${pips(me.mp, me.maxMp, 'mp')}</div>${resourceHtml(c, me)}</div>
      ${usableMp(c, me) < me.mp && myTurn ? `<div class="sm blu" ${tip('Placaje: los enemigos pegados a ti te retienen. Al alejarte pierdes PM según tu Huida y su Placaje.')}>⛓ Placado: ${usableMp(c, me)}/${me.mp} PM útiles</div>` : ''}
      <div class="spellbar">${me.spells.map((sp, i) => ({ sp, i })).filter(({ sp }) => sp.charges === undefined).map(({ sp, i }) => { const d = spellOf(me, sp.id)!; const cost = apCost(me, sp.id); const spent = !!d.perTurn && (sp.uses ?? 0) >= d.perTurn; const off = !myTurn || me.ap < cost || sp.cd > 0 || spent || me.hp <= 0;
        return `<button class="sbtn ${board.sel === d.id ? 'on' : ''} ${sp.cd > 0 ? 'cd' : ''}" data-act="spell" data-id="${d.id}" ${off ? 'disabled' : ''} ${tip(spellTip(d, `${sp.cd > 0 ? `<div class="sm bad">Disponible en ${sp.cd} turno(s)</div>` : ''}${d.perTurn ? `<div class="sm ${spent ? 'bad' : 'dim'}">Usado ${sp.uses ?? 0}/${d.perTurn} este turno</div>` : ''}${sp.free ? '<div class="sm good">¡Gratis tras rematar!</div>' : ''}`))}>
          <kbd>${i + 1}</kbd>${spellIcon(d, false)}<span class="cost ${sp.free ? 'free' : ''}">${cost}</span>${d.perTurn ? `<span class="uses">${(d.perTurn - (sp.uses ?? 0))}/${d.perTurn}</span>` : ''}${sp.cd > 0 ? `<span class="cdn">${sp.cd}</span>` : ''}<small>${esc(d.name)}</small></button>`; }).join('')}
      ${me.spells.some((sp) => sp.charges !== undefined) ? `<span class="itemsep"></span>${me.spells.filter((sp) => sp.charges !== undefined).map((sp) => { const d = spellOf(me, sp.id)!; const off = !myTurn || me.ap < d.ap || (sp.charges ?? 0) <= 0 || me.hp <= 0;
        return `<button class="sbtn item ${board.sel === d.id ? 'on' : ''}" data-act="spell" data-id="${d.id}" ${off ? 'disabled' : ''} ${tip(spellTip(d, `<div class="sm">Te quedan ${sp.charges}</div>`))}>${spellIcon(d, false)}<span class="cost">${d.ap}</span><span class="cdn qty">x${sp.charges}</span><small>${esc(d.name.replace('Poción de ', 'P. ').replace('Bomba de ', 'B. '))}</small></button>`; }).join('')}` : ''}</div>
      <button class="pri endturn" data-act="end" ${myTurn ? '' : 'disabled'}>Terminar<br>turno<br><small>(E)</small></button>`
    : '<span class="dim">Estás como espectador en este combate.</span>';
  const lg = document.getElementById('log')!;
  lg.className = `log ${ui.logOpen ? 'open' : ''}`;
  lg.innerHTML = ui.log.slice(ui.logOpen ? -40 : -6).map((l) => `<span>${l}</span>`).join('');
  lg.scrollTop = 1e9;
}

/** Recursos propios de cada clase, a la vista: Esencia, Esferas, Almas, Furia y Marcas de la muerte. */
function resourceHtml(c: CombatState, me: Unit): string {
  const out: string[] = [];
  if (me.essence !== undefined) {
    const need = essenceNeed(me), full = me.essence >= need;
    out.push(`<div class="sm res ${full ? 'good' : ''}" ${tip(`Robo de esencia: cada habilidad que acierta da 1 carga. Con ${need}, la siguiente habilidad de daño te cura el 15% (verás un aura rosa).`)}>🦊 Esencia ${'●'.repeat(me.essence)}${'○'.repeat(Math.max(0, need - me.essence))}${full ? ' · ¡la próxima cura!' : ''}</div>`);
  }
  if (me.kind === 'esferas') {
    const n = marksOf(c, 'sphere', me.id).length, max = me.traits?.includes('poder') ? 5 : 3;
    out.push(`<div class="sm res" ${tip('Esferas oscuras tuyas en el tablero.')}>🔮 Esferas ${n}/${max}</div>`);
  }
  if (me.souls !== undefined) out.push(`<div class="sm souls" ${tip(`Cosecha de almas: cuentan en toda la partida; cada ${SOULS_PER_ARMOR}, +1 de armadura permanente. Las almas sin gastar se usan en Explosión de almas.`)}>💀 ${me.souls} almas (${me.soulBank ?? 0} para gastar) · +${Math.floor(me.souls / SOULS_PER_ARMOR)} armadura · próxima en ${SOULS_PER_ARMOR - (me.souls % SOULS_PER_ARMOR)}</div>`);
  if (me.fury !== undefined) out.push(`<div class="sm res fury" ${tip('Furia: +20 al golpear, +10 al recibir daño. Cada 20: +2% de daño y +6% de crítico. Si pasas un turno sin atacar ni recibir daño, pierdes 20.')}>🔥 Furia <span class="fbar"><i style="width:${me.fury}%"></i></span> ${me.fury}/100 · +${furyPower(me)}% daño · +${furyCrit(me)}% crít.</div>`);
  const marked = c.units.filter((u) => u.hp > 0 && u.statuses.deathmark?.from === me.id);
  if (marked.length) out.push(`<div class="sm res bad">☠ Marca de la muerte: ${marked.map((u) => `${esc(u.name.split(' ')[0]!)} guarda ${u.statuses.deathmark!.stacks} (${u.statuses.deathmark!.turns} t.)`).join(' · ')}</div>`);
  if (me.kind === 'acechador') { const n = marksOf(c, 'shadow', me.id).length; if (n) out.push(`<div class="sm res">👤 Sombras ${n}</div>`); }
  return out.join('');
}
