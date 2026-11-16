// Piezas comunes: barra superior, celdas de objeto con icono, ficha lateral (equipo, runas, grupo) y botín.
import { isMuted } from '../audio/sfx';
import { CLASSES, MAX_LEVEL, findRoute } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { BAG_SIZE, PRICE, RARITY_NAME, SLOTS, SLOT_NAME, STAT_NAME, statDiff, statsText, type Item, type Slot, type StatKey } from '../core/items/items';
import { SETS, setCounts } from '../core/items/sets';
import { RELICS } from '../content/relics';
import { RUNES } from '../core/runes';
import { UPGRADES, tuned } from '../core/upgrades';
import { heroMaxHp, heroSpec, zoneOf, type HeroSave, type RunState } from '../game/run';
import { esc, mine, tip, ui } from './ctx';
import { itemIcon, spellIcon, spellTip } from './icons';

const RAR = ['r0', 'r1', 'r2', 'r3'];

export function sysButtons(): string {
  const s = ui.session;
  const warn = s?.isHost && s.t.kind === 'online' ? '¿Seguro? Termina para todos' : '¿Seguro? Pulsa otra vez';
  return `<button class="sq" data-act="mute" ${tip('Sonido y música')}>${isMuted() ? '🔇' : '🔊'}</button><button data-act="leave" class="${ui.leaveArmed ? 'danger' : ''}">${ui.leaveArmed ? warn : 'Abandonar'}</button>`;
}

export function hpBar(hp: number, max: number, shield = 0): string {
  return `<span class="hp"><i style="width:${Math.max(0, Math.min(100, (hp / max) * 100))}%"></i>${shield ? `<u style="width:${Math.min(100, (shield / max) * 100)}%"></u>` : ''}<b>${hp}/${max}</b></span>`;
}

export function topBar(run: RunState): string {
  const h = mine(run);
  if (run.arena) return `<div class="bar"><span class="zone">🏟️ Duelo: ${esc(run.arena.nameA)} contra ${esc(run.arena.nameB)}</span><span class="grow"></span>${sysButtons()}</div>`;
  return `<div class="bar"><b class="code-s">${esc(run.code)}</b><span class="zone">Zona ${run.zone + 1} · ${esc(zoneOf(run).name)}</span>
  ${h ? `<span class="pill">💰 ${h.gold}</span>${hpBar(h.hp, heroMaxHp(h))}<span>Nv ${h.level}</span>` : '<span class="dim">Espectador</span>'}
  ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}${!ui.session!.hostPresent() ? '<span class="bad">Anfitrión desconectado</span>' : ''}<span class="grow"></span>${sysButtons()}</div>`;
}

/** Qué cambia si me pongo `it` en lugar de lo que llevo en esa ranura. */
export function diffHtml(it: Item, h: HeroSave): string {
  const old = h.equip[it.slot];
  if (old === it) return '';
  if (!old) return '<div class="good sm">Ranura libre: todo es mejora</div>';
  const d = statDiff(it.stats, old.stats);
  const keys = Object.keys(d) as StatKey[];
  if (!keys.length) return '<div class="dim sm">Igual que lo que llevas</div>';
  return `<div class="sm"><span class="dim">Frente a ${esc(old.name)}:</span><br>${keys.map((k) => `<span class="${d[k]! > 0 ? 'good' : 'bad'}">${d[k]! > 0 ? '+' : ''}${d[k]} ${STAT_NAME[k]}</span>`).join('<br>')}</div>`;
}

/** Datos del set de una pieza: qué piezas tiene, cuáles llevas y qué dan 2 y 3. */
export function setHtml(id: string, equip?: Partial<Record<Slot, Item>>): string {
  const def = SETS[id];
  if (!def) return '';
  const n = equip ? setCounts(equip)[id] ?? 0 : 0;
  const pieces = (Object.keys(def.pieces) as Slot[]).map((sl) => { const on = equip?.[sl]?.set === id; return `<span class="${on ? 'good' : 'dim'}">${on ? '✔' : '○'} ${esc(def.pieces[sl]!)}</span>`; }).join('<br>');
  return `<div class="setbox sm"><b class="setn">${def.icon} ${esc(def.name)}${equip ? ` (${n}/3)` : ''}</b><br>${pieces}<br><span class="${n >= 2 ? 'good' : 'dim'}">2 piezas: ${esc(def.twoText)}</span><br><span class="${n >= 3 ? 'good' : 'dim'}">3 piezas: ${esc(def.threeText)}</span></div>`;
}

export function itemHtml(it: Item, equip?: Partial<Record<Slot, Item>>): string {
  const run = ui.session?.run;
  const eq = equip ?? (run ? mine(run)?.equip : undefined);
  return `<b class="${RAR[it.rarity]}">${esc(it.name)}</b><div class="dim sm">${SLOT_NAME[it.slot]} · ${RARITY_NAME[it.rarity]}${it.set ? ' · pieza de set' : ''}</div><div class="sm">${statsText(it.stats).split(' · ').join('<br>')}</div>${it.set ? setHtml(it.set, eq) : ''}${it.lore ? `<i class="dim sm">${esc(it.lore)}</i>` : ''}`;
}

/** Casilla con el icono del objeto; al pasar el ratón muestra sus datos y la comparación. */
export function cell(it: Item | undefined, attrs: string, h?: HeroSave, slot?: Slot, sel = false): string {
  const t = it ? itemHtml(it) + (h ? diffHtml(it, h) : '') : slot ? `<span class="dim">${SLOT_NAME[slot]}: vacío</span>` : '';
  return `<button class="cell ${it ? RAR[it.rarity] : 'empty'} ${it?.set ? 'inset' : ''} ${sel ? 'sel' : ''}" ${attrs} ${t ? tip(t) : ''}>${itemIcon(it, slot)}</button>`;
}

function statsLine(h: HeroSave): string {
  const u = heroSpec(h);
  const res = (Object.entries(u.resist) as Array<[string, number]>).filter(([, v]) => v).map(([k, v]) => `${{ fire: 'fuego', ice: 'hielo', poison: 'veneno', shadow: 'sombra', holy: 'sagrado' }[k]} ${v}%`).join(', ');
  return `<div class="stats sm"><span>❤️ ${u.maxHp}</span><span>🛡️ ${u.armor}</span><span>⚔️ +${u.power}%</span><span>🎯 ${u.crit}%</span><span class="pill">PA ${u.maxAp}</span><span class="blu">PM ${u.maxMp}</span><span>⏱️ ${u.initiative}</span></div>${res ? `<div class="sm dim">Resistencias: ${res}</div>` : ''}`;
}

function gearTab(run: RunState, h: HeroSave, selling: boolean): string {
  const others = run.heroes.filter((o) => o !== h);
  const [kind, key] = ui.selItem.split(':');
  const bagIdx = kind === 'bag' ? Number(key) : -1;
  const selIt = kind === 'bag' ? h.bag[bagIdx] : kind === 'slot' ? h.equip[key as Slot] : undefined;
  if (!selIt) ui.selItem = '';
  const sets = Object.entries(setCounts(h.equip));
  return `${statsLine(h)}
  ${sets.length ? `<div class="lbl">Sets</div>${sets.map(([id, n]) => { const d = SETS[id]!; return `<div class="sm ${n >= 2 ? 'good' : 'dim'}" ${tip(setHtml(id, h.equip))}>${d.icon} ${esc(d.name)} ${n}/3${n >= 3 ? ` · ${esc(d.threeText)}` : n >= 2 ? ` · ${esc(d.twoText)}` : ' · falta 1 pieza para el primer bonus'}</div>`; }).join('')}` : ''}
  ${h.relics.length ? `<div class="lbl">Reliquias <span class="dim">${h.relics.length}</span></div><div class="chips">${h.relics.map((r) => RELICS[r]).filter(Boolean).map((r) => `<span class="chip ${r!.rare ? 'r3' : 'r2'}" ${tip(`<b>${r!.icon} ${esc(r!.name)}</b><div class="sm">${esc(r!.text)}</div>`)}>${r!.icon} ${esc(r!.name)}</span>`).join('')}</div>` : ''}
  <div class="lbl">Equipado</div>
  <div class="cells">${SLOTS.map((sl) => `<div class="slotbox">${cell(h.equip[sl], `data-act="selitem" data-id="slot:${sl}"`, undefined, sl, ui.selItem === `slot:${sl}`)}<small>${SLOT_NAME[sl]}</small></div>`).join('')}</div>
  <div class="lbl">Mochila <span class="dim">${h.bag.length}/${BAG_SIZE}</span></div>
  <div class="cells">${Array.from({ length: BAG_SIZE }, (_, i) => cell(h.bag[i], h.bag[i] ? `data-act="selitem" data-id="bag:${i}"` : 'disabled', h, undefined, bagIdx === i)).join('')}</div>
  ${selIt ? `<div class="detail"><div class="row"><div class="cell ${RAR[selIt.rarity]} big">${itemIcon(selIt)}</div><div>${itemHtml(selIt)}</div></div>${kind === 'bag' ? diffHtml(selIt, h) : ''}
    <div class="acts">${kind === 'bag'
      ? `<button class="pri" data-act="equip" data-id="${bagIdx}">Equipar</button>${others.map((o) => `<button data-act="give" data-id="${bagIdx}" data-to="${esc(o.owner)}">Dar a ${esc(o.name)}</button>`).join('')}${selling ? `<button data-act="sell" data-id="${bagIdx}">Vender +${Math.floor(PRICE[selIt.rarity] / 3)} 💰</button>` : ''}<button data-act="drop" data-id="${bagIdx}">Tirar</button>`
      : `<button data-act="unequip" data-id="${key}">Quitar (a la mochila)</button>`}</div></div>`
    : '<div class="dim sm hint">Pasa el ratón por un objeto para ver sus datos. Haz clic para equiparlo, quitarlo, dárselo a un compañero o venderlo (en la tienda).</div>'}`;
}

function runeTab(h: HeroSave): string {
  const all = heroSpec({ ...h, level: MAX_LEVEL }).spells;
  const known = new Set(heroSpec(h).spells.map((sp) => sp.id));
  if (ui.selRune >= h.runes.length) ui.selRune = -1;
  const sel = ui.selRune >= 0 ? RUNES[h.runes[ui.selRune]!] : undefined;
  return `<div class="lbl">Runas sueltas <span class="dim">${h.runes.length}</span></div>
  <div class="chips">${h.runes.length ? h.runes.map((r, i) => { const d = RUNES[r]!; return `<button class="chip ${d.rare ? 'r2' : 'r1'} ${ui.selRune === i ? 'sel' : ''}" data-act="selrune" data-id="${i}" ${tip(`<b>${d.icon} ${esc(d.name)}</b><div class="sm">${esc(d.text)}</div><div class="dim sm">${d.rare ? 'Rara' : 'Común'}${d.needsDamage ? ' · solo hechizos de daño' : ''}</div>`)}>${d.icon} ${esc(d.name)}</button>`; }).join('') : '<span class="dim sm">Ninguna. Se ganan en combates, élites, tesoros y tiendas.</span>'}</div>
  <div class="sm ${sel ? 'pill' : 'dim'} hint">${sel ? `${sel.icon} ${esc(sel.name)}: elige el hechizo donde engarzarla.` : 'Una runa por hechizo. Pulsa una runa y luego un hechizo.'}</div>
  <div class="lbl">Tus hechizos</div>
  <div class="spells">${all.map((sp) => { const d = tuned(SPELLS[sp.id]!, { ups: h.ups[sp.id] }); const ups = (h.ups[sp.id] ?? []).map((u) => UPGRADES[u]?.icon ?? '').join(''); const cur = h.sockets[sp.id] ? RUNES[h.sockets[sp.id]!] : undefined; const bad = !!sel && sel.needsDamage && !d.dmg;
    return `<div class="srow ${known.has(sp.id) ? '' : 'off'}" ${tip(spellTip(d, known.has(sp.id) ? '' : '<div class="dim sm">Aún bloqueado: se desbloquea al subir de nivel</div>'))}>${spellIcon(d)}<span class="grow">${esc(d.name)} ${ups}</span>${
      sel ? `<button class="mini pri" data-act="socket" data-id="${sp.id}" ${bad ? 'disabled' : ''}>${bad ? 'No aplica' : 'Engarzar'}</button>`
      : cur ? `<button class="chip ${cur.rare ? 'r2' : 'r1'}" data-act="unsocket" data-id="${sp.id}" ${tip(`<b>${cur.icon} ${esc(cur.name)}</b><div class="sm">${esc(cur.text)}</div><div class="dim sm">Clic para quitarla</div>`)}>${cur.icon} ${esc(cur.name)} ✕</button>` : '<span class="dim sm">sin runa</span>'}</div>`; }).join('')}</div>`;
}

function groupTab(run: RunState): string {
  return run.heroes.map((h, i) => `<div class="member"><div class="row"><b class="p${i % 4}">${esc(h.name)}</b><span class="dim sm">${CLASSES[h.cls].name} Nv ${h.level}</span><span class="grow"></span><span class="pill sm">💰 ${h.gold}</span></div>
    <div class="dim sm">${h.routes.map((r) => findRoute(h.cls, r)?.name).join(' + ')}${h.relics.length ? ` · ${h.relics.map((r) => RELICS[r]?.icon ?? '').join('')}` : ''}</div>${hpBar(h.hp, heroMaxHp(h))}
    <div class="cells tiny">${SLOTS.map((sl) => cell(h.equip[sl], 'disabled', undefined, sl)).join('')}</div></div>`).join('');
}

/** Ficha lateral con pestañas. */
export function sidePanel(run: RunState, selling = false): string {
  const h = mine(run);
  const tabs: Array<[typeof ui.tab, string]> = [['equipo', '🎒 Equipo'], ['runas', `🔮 Runas${h?.runes.length ? ` (${h.runes.length})` : ''}`], ['grupo', '👥 Grupo']];
  const tab = h ? ui.tab : 'grupo';
  return `<aside class="side"><div class="tabs">${tabs.map(([id, name]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-id="${id}" ${h || id === 'grupo' ? '' : 'disabled'}>${name}</button>`).join('')}</div>
  <div class="tabbody">${tab === 'grupo' || !h ? groupTab(run) : tab === 'runas' ? runeTab(h) : gearTab(run, h, selling)}</div></aside>`;
}

/** Mejora de hechizo pendiente: se elige una. */
export function upgradeRow(run: RunState): string {
  const h = mine(run);
  if (!h?.upOffer) return '';
  return `<div class="panel loot"><div class="row"><h3>✨ Mejora de hechizo: elige una</h3><span class="grow"></span><span class="dim sm">${h.upPending > 1 ? `Te quedan ${h.upPending} elecciones` : 'Dura toda la partida'}</span></div>
  <div class="cards">${h.upOffer.map((o, i) => { const d = SPELLS[o.spell]!, up = UPGRADES[o.up]!; const now = tuned(d, { ups: h.ups[o.spell] }), next = tuned(d, { ups: [...(h.ups[o.spell] ?? []), o.up] });
    const ch = [now.ap !== next.ap ? `PA ${now.ap} → ${next.ap}` : '', now.dmg && next.dmg && now.dmg[1] !== next.dmg[1] ? `daño ${now.dmg[0]}-${now.dmg[1]} → ${next.dmg[0]}-${next.dmg[1]}` : '', now.heal !== next.heal ? `cura ${now.heal} → ${next.heal}` : '', now.shield !== next.shield ? `escudo ${now.shield} → ${next.shield}` : '', now.cd !== next.cd ? `espera ${now.cd} → ${next.cd}` : '', now.range[1] !== next.range[1] ? `alcance ${now.range[1]} → ${next.range[1]}` : '', (now.area ?? 0) !== (next.area ?? 0) ? `área ${now.area ?? 0} → ${next.area}` : ''].filter(Boolean).join(' · ');
    return `<div class="lootcard r2"><div class="row">${spellIcon(d)}<div><b>${esc(d.name)}</b><div class="pill sm">${up.icon} ${esc(up.name)}</div><div class="sm">${esc(up.text)}</div>${ch ? `<div class="good sm">${ch}</div>` : ''}</div></div><button class="pri" data-act="upgrade" data-id="${i}">Elegir</button></div>`; }).join('')}</div></div>`;
}

/** Botín pendiente: tarjetas grandes con icono, datos y comparación. */
export function lootRow(run: RunState): string {
  const h = mine(run);
  const offer = h ? run.offers[ui.myId] : undefined;
  if (!offer || !h) return '';
  return `<div class="panel loot"><div class="row"><h3>🎁 Botín: elige uno</h3><span class="grow"></span>${h.rerolls > 0 ? `<button class="mini" data-act="reroll">🎲 Re-tirar (${h.rerolls})</button>` : ''}<button class="mini" data-act="pick" data-id="-1">No quiero ninguno</button></div>
  <div class="cards">${offer.map((it, i) => `<div class="lootcard ${RAR[it.rarity]}"><div class="row"><div class="cell ${RAR[it.rarity]} big">${itemIcon(it)}</div><div>${itemHtml(it)}</div></div>${diffHtml(it, h)}<button class="pri" data-act="pick" data-id="${i}">Quedármelo</button></div>`).join('')}</div>
  <div class="dim sm">Si la ranura está ocupada, va a tu mochila y decides después.</div></div>`;
}
