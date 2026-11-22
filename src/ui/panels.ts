// Piezas comunes: barra superior, celdas de objeto con icono, ficha lateral (equipo, hechizos, grupo) y botín.
import { HEAT_HOT, HEAT_OVERLOAD, curseOf, heatTier, pactOf } from '../content/pacts';
import { modDef } from '../content/modes';
import { FEATURES, schoolOf } from '../core/tuning';
import { isMuted, musicVolume } from '../audio/sfx';
import { CLASS_PASSIVE, CLASSES, findRoute } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { BAG_SIZE, PRICE, RARITY_NAME, SLOTS, SLOT_NAME, STAT_NAME, statDiff, statShown, statsText, type Item, type Slot, type StatKey } from '../core/items/items';
import { RELICS } from '../content/relics';
import { PATRONS, patronBonus, patronOf } from '../content/boons';
import { BLESSINGS, BOON_MODS } from '../core/boonmods';
import { MAX_SPELL_UPS, UPGRADES, tuned } from '../core/upgrades';
import { SOULS_PER_ARMOR, SOUL_ARMOR } from '../core/combat/engine';
import { consequences, secretOpen } from '../content/branching';
import { NODE_HINT, NODE_NAME, availableNodes, heroMaxHp, heroSpec, pendingOf, statBreakdown, upCount, zoneOf, type BossOption, type HeroSave, type RunState } from '../game/run';
import { esc, mine, tip, ui } from './ctx';
import { NODE_ICON, itemIcon, spellIcon, spellTip } from './icons';
import { rangeText, spellSummary } from './spellicons';

const RAR = ['ir0', 'ir1', 'ir2', 'ir3'];

/** Botón de silencio y barra de volumen de la música. */
export function volumeControl(): string {
  return `<span class="vol"><button class="sq" data-act="mute" ${tip('Silenciar o activar el sonido')}>${isMuted() ? '🔇' : '🔊'}</button><input type="range" id="vol" min="0" max="100" value="${Math.round(musicVolume() * 100)}" ${tip('Volumen de la música')} ${isMuted() ? 'disabled' : ''}></span>`;
}

export function sysButtons(): string {
  const s = ui.session;
  const warn = s?.isHost && s.t.kind === 'online' ? '¿Seguro? Termina para todos' : '¿Seguro? Pulsa otra vez';
  return `${ui.screen !== 'combat' && ui.session?.run && !ui.session.run.arena ? `<button class="sq mobonly ${ui.sideOpen ? 'on' : ''}" data-act="side" ${tip('Equipo, hechizos y grupo')}>🎒</button>` : ''}${ui.screen === 'combat' ? `<button class="sq ${ui.hpBars ? '' : 'off'}" data-act="bars" ${tip('Mostrar u ocultar las barras de vida (V)')}>❤️</button><button class="sq ${ui.board?.iso ? 'on' : ''}" data-act="isoview" ${tip('Vista isométrica o plana (I)')}>🔷</button>` : ''}${ui.session?.run && !ui.session.run.arena ? `<button class="sq" data-act="map" ${tip('Mapa del acto (M)')}>🗺️<span class="deskonly"> Mapa</span></button>` : ''}${ui.session?.run && !ui.session.run.arena ? `<button class="sq" data-act="stats" ${tip('Ficha del personaje: estadísticas totales (S)')}>📊</button>` : ''}${volumeControl()}<button data-act="leave" class="${ui.leaveArmed ? 'danger' : ''}">${ui.leaveArmed ? warn : 'Abandonar'}</button>`;
}

export function hpBar(hp: number, max: number, shield = 0): string {
  const total = Math.max(max, hp + shield);
  return `<span class="hp"><i style="width:${Math.max(0, Math.min(100, (hp / total) * 100))}%"></i>${shield ? `<u style="left:${(hp / total) * 100}%;width:${Math.min(100, (shield / total) * 100)}%"></u>` : ''}<b>${hp}/${max}${shield ? ` <span class="shv">+${shield}🛡</span>` : ''}${max - hp > 0 ? ` <span class="miss">(−${max - hp})</span>` : ''}</b></span>`;
}

/** Escofinas de Eco (siempre a la vista). */
export const escofinas = (h: HeroSave): string => `<span class="pill esc" ${tip('<b>🔔 Escofinas de Eco</b><div class="sm">Se consiguen desguazando objetos en la Forja, meditando en el descanso o con el Pacto de los Ecos. En la Forja, 3 Escofinas = una mejora de hechizo a elegir.</div>')}>🔔 ${h.escofinas ?? 0}</span>`;

export function topBar(run: RunState): string {
  const h = mine(run);
  if (run.arena) return `<div class="bar"><span class="zone">🏟️ Duelo: ${esc(run.arena.nameA)} contra ${esc(run.arena.nameB)}</span><span class="grow"></span>${sysButtons()}</div>`;
  return `<div class="bar"><b class="code-s">${esc(run.code)}</b><span class="zone">Zona ${run.zone + 1} · ${esc(zoneOf(run).name)}</span>
  ${h ? `<span class="pill">💰 ${h.gold}</span>${escofinas(h)}${hpBar(h.hp, heroMaxHp(h))}` : '<span class="dim">Espectador</span>'}
  ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}${!ui.session!.t.connected() ? '<span class="bad">⚠ Conexión perdida: reconectando…</span>' : !ui.session!.hostPresent() ? '<span class="bad">Anfitrión desconectado</span>' : ''}<span class="grow"></span>${sysButtons()}</div>`;
}

/** Qué cambia si me pongo `it` en lugar de lo que llevo en esa ranura. */
export function diffHtml(it: Item, h: HeroSave): string {
  const old = h.equip[it.slot];
  if (old === it) return '';
  if (!old) return '<div class="good sm">Ranura libre: todo es mejora</div>';
  const d = statDiff(it.stats, old.stats);
  const keys = (Object.keys(d) as StatKey[]).filter(statShown);
  if (!keys.length) return '<div class="dim sm">Igual que lo que llevas</div>';
  return `<div class="sm"><span class="dim">Frente a ${esc(old.name)}:</span><br>${keys.map((k) => `<span class="${d[k]! > 0 ? 'good' : 'bad'}">${d[k]! > 0 ? '+' : ''}${d[k]} ${STAT_NAME[k]}</span>`).join('<br>')}</div>`;
}

export function itemHtml(it: Item, withIcon = false): string {
  const aff = it.affixes?.length
    ? it.affixes.filter((x) => statShown(x.stat)).map((x) => `<div class="sm affix"><span class="dim">${x.kind === 'prefix' ? 'Prefijo' : 'Sufijo'} · ${esc(x.name)}:</span> <span class="good">+${x.value} ${STAT_NAME[x.stat]}</span></div>`).join('')
    : `<div class="sm">${statsText(it.stats).split(' · ').join('<br>')}</div>`;
  return `<div class="row">${withIcon ? `<span class="cell ${RAR[it.rarity]}" style="width:44px;height:44px">${itemIcon(it)}</span>` : ''}<div><b class="${RAR[it.rarity]}">${esc(it.name)}</b><div class="dim sm">${SLOT_NAME[it.slot]} · <span class="${RAR[it.rarity]}">${RARITY_NAME[it.rarity]}</span></div></div></div>${aff}${it.passive ? `<div class="sm ir3">★ ${esc(it.passive.text)}</div>` : ''}${it.lore ? `<i class="dim sm">${esc(it.lore)}</i>` : ''}`;
}

/** Casilla con el icono del objeto; al pasar el ratón muestra sus datos y la comparación. */
export function cell(it: Item | undefined, attrs: string, h?: HeroSave, slot?: Slot, sel = false): string {
  const t = it ? itemHtml(it, true) + (h ? diffHtml(it, h) : '') : slot ? `<span class="dim">${SLOT_NAME[slot]}: vacío</span>` : '';
  return `<button class="cell ${it ? RAR[it.rarity] : 'empty'} ${sel ? 'sel' : ''}" ${attrs} ${t ? tip(t) : ''}>${itemIcon(it, slot)}</button>`;
}

function statsLine(h: HeroSave): string {
  const u = heroSpec(h);
  const res = !FEATURES.resistances ? '' : (Object.entries(u.resist) as Array<[string, number]>).filter(([, v]) => v).map(([k, v]) => `${{ fire: 'fuego', ice: 'hielo', poison: 'veneno', shadow: 'sombra', holy: 'sagrado' }[k]} ${v}%`).join(', ');
  return `<div class="stats sm"><span>❤️ ${u.maxHp}</span><span>🛡️ ${u.armor}</span><span ${tip(schoolOf(h.cls) === 'magic' ? 'Clase mágica: suma su Daño mágico y su Daño (físico y mágico) a cada golpe' : 'Clase física: suma su Daño físico y su Daño (físico y mágico) a cada golpe')}>⚔️ +${u.power + ((schoolOf(h.cls) === 'magic' ? u.powerMagic : u.powerPhys) ?? 0)} ${schoolOf(h.cls) === 'magic' ? 'mág.' : 'fís.'}</span><span>🎯 ${u.crit}%</span><span class="pill">PA ${u.maxAp}</span><span class="blu">PM ${u.maxMp}</span><span>⏱️ ${u.initiative}</span></div>${res ? `<div class="sm dim">Resistencias: ${res}</div>` : ''}`;
}

function gearTab(run: RunState, h: HeroSave, selling: boolean): string {
  const others = run.heroes.filter((o) => o !== h);
  const [kind, key] = ui.selItem.split(':');
  const bagIdx = kind === 'bag' ? Number(key) : -1;
  const selIt = kind === 'bag' ? h.bag[bagIdx] : kind === 'slot' ? h.equip[key as Slot] : undefined;
  if (!selIt) ui.selItem = '';
  return `${statsLine(h)}
  ${h.relics.length ? `<div class="lbl">Reliquias <span class="dim">${h.relics.length}</span></div><div class="chips">${h.relics.map((r) => RELICS[r]).filter(Boolean).map((r) => `<span class="chip ${r!.rare ? 'r3' : 'r2'}" ${tip(`<b>${r!.icon} ${esc(r!.name)}</b><div class="sm">${esc(r!.text)}</div>`)}>${r!.icon} ${esc(r!.name)}</span>`).join('')}</div>` : ''}
  <div class="lbl">Equipado</div>
  <div class="cells">${SLOTS.map((sl) => `<div class="slotbox">${cell(h.equip[sl], `data-act="selitem" data-id="slot:${sl}"`, undefined, sl, ui.selItem === `slot:${sl}`)}<small>${SLOT_NAME[sl]}</small></div>`).join('')}</div>
  <div class="lbl">Mochila <span class="dim">${h.bag.length}/${BAG_SIZE}</span></div>
  <div class="cells">${Array.from({ length: BAG_SIZE }, (_, i) => cell(h.bag[i], h.bag[i] ? `data-act="selitem" data-id="bag:${i}"` : 'disabled', h, undefined, bagIdx === i)).join('')}</div>
  ${selIt ? `<div class="detail"><div class="row"><div class="cell ${RAR[selIt.rarity]} big">${itemIcon(selIt)}</div><div>${itemHtml(selIt)}</div></div>${kind === 'bag' ? diffHtml(selIt, h) : ''}
    <div class="acts">${kind === 'bag'
      ? `<button class="pri" data-act="equip" data-id="${bagIdx}">Equipar</button>${others.map((o) => `<button data-act="give" data-id="${bagIdx}" data-to="${esc(o.owner)}">Dar a ${esc(o.name)}</button>`).join('')}${selling ? `<button data-act="sell" data-id="${bagIdx}">Vender +${Math.floor(PRICE[selIt.rarity] / 2)} 💰</button>` : ''}<button data-act="drop" data-id="${bagIdx}">Tirar</button>`
      : `<button data-act="unequip" data-id="${key}">Quitar (a la mochila)</button>`}</div></div>`
    : '<div class="dim sm hint">Pasa el ratón por un objeto para ver sus datos. Haz clic para equiparlo, quitarlo, dárselo a un compañero o venderlo (en la tienda).</div>'}`;
}

function spellsTab(h: HeroSave): string {
  const all = heroSpec(h).spells.filter((sp) => sp.charges === undefined);
  return `<div class="lbl">Tus hechizos</div>
  <div class="spells">${all.map((sp) => { const d = tuned(SPELLS[sp.id]!, { ups: h.ups[sp.id] }); const ups = (h.ups[sp.id] ?? []).map((u) => UPGRADES[u]?.icon ?? '').join('');
    return `<div class="srow" ${tip(spellTip(d))}>${spellIcon(d)}<span class="grow">${esc(d.name)} ${ups}</span></div>`; }).join('')}</div>`;
}

/** Indicador de almas del Carcelero (cuentan en toda la partida). */
export function soulsHtml(h: HeroSave): string {
  if (h.cls !== 'carcelero') return '';
  const n = h.souls ?? 0;
  return `<div class="sm souls" ${tip(`Cosecha de almas: cada ${SOULS_PER_ARMOR} almas de la partida, +0,5 de armadura permanente.`)}>💀 ${n} almas · +${Math.floor(n / SOULS_PER_ARMOR) * SOUL_ARMOR} armadura · próxima en ${SOULS_PER_ARMOR - (n % SOULS_PER_ARMOR)}</div>`;
}

function groupTab(run: RunState): string {
  return run.heroes.map((h, i) => `<div class="member"><div class="row"><b class="p${i % 4}">${esc(h.name)}</b><span class="dim sm">${CLASSES[h.cls].name}</span><span class="grow"></span><span class="pill sm">💰 ${h.gold}</span>${escofinas(h)}</div>${soulsHtml(h)}
    <div class="dim sm">${h.routes.map((r) => findRoute(h.cls, r)?.name).join(' + ')}${h.relics.length ? ` · ${h.relics.map((r) => RELICS[r]?.icon ?? '').join('')}` : ''}</div>${hpBar(h.hp, heroMaxHp(h))}
    <div class="cells tiny">${SLOTS.map((sl) => cell(h.equip[sl], 'disabled', undefined, sl)).join('')}</div></div>`).join('');
}

/** Ficha lateral con pestañas. */
export function sidePanel(run: RunState, selling = false): string {
  const h = mine(run);
  const tabs: Array<[typeof ui.tab, string]> = [['equipo', '🎒 Equipo'], ['hechizos', '✨ Hechizos'], ['grupo', '👥 Grupo']];
  const tab = h ? ui.tab : 'grupo';
  return `<aside class="side"><div class="tabs">${tabs.map(([id, name]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-id="${id}" ${h || id === 'grupo' ? '' : 'disabled'}>${name}</button>`).join('')}</div>
  <div class="tabbody">${tab === 'grupo' || !h ? groupTab(run) : tab === 'hechizos' ? spellsTab(h) : gearTab(run, h, selling)}</div></aside>`;
}

/** Carta de una opción de la recompensa del jefe. */
function bossCard(h: HeroSave, o: BossOption, i: number): string {
  const n = i + 1;
  if (o.kind === 'gold') return `<div class="lootcard r1"><div class="row"><span class="emo big">💰</span><div><b>Oro</b><div class="pill sm">Opción ${n}</div></div></div><div class="sm">Recibes ${o.amount} de oro.</div><button class="pri" data-act="bossreward" data-id="${i}">Elegir</button></div>`;
  if (o.kind === 'heal') return `<div class="lootcard r1"><div class="row"><span class="emo big">❤️</span><div><b>Curación</b><div class="pill sm">Opción ${n}</div></div></div><div class="sm">Recuperas el 50% de tu vida máxima.</div><button class="pri" data-act="bossreward" data-id="${i}">Elegir</button></div>`;
  if (o.kind === 'spell') {
    const d = SPELLS[o.id]!;
    return `<div class="lootcard r3" ${tip(spellTip(d))}><div class="row">${spellIcon(d)}<div><b>${esc(d.name)}</b><div class="pill sm">Opción ${n} · Hechizo nuevo de ${esc(CLASSES[h.cls].name)}</div></div></div><div class="sm">${esc(d.text)}</div><div class="dim sm">${d.ap} PA · ${rangeText(d)}${d.perTurn ? ` · ${d.perTurn} por turno` : ''}${d.cd ? ` · espera ${d.cd + 1}` : ''}</div><button class="pri" data-act="bossreward" data-id="${i}">Aprender</button></div>`;
  }
  const d = SPELLS[o.spell]!, g = UPGRADES[o.up], m = BOON_MODS[o.up];
  const have = [...h.boons.filter((b) => BOON_MODS[b]?.target === o.spell), ...(h.ups[o.spell] ?? [])];
  const now = tuned(d, { ups: have }), next = tuned(d, { ups: [...have, o.up] });
  const lvl = upCount(h, o.spell);
  return `<div class="lootcard r2"><div class="row">${spellIcon(next)}<div><b>${esc(d.name)}</b><div class="pill sm">Opción ${n} · Mejora: ${g?.icon ?? '✨'} ${esc((g ?? m)?.name ?? o.up)}</div></div></div><div class="sm">${esc((g ?? m)?.text ?? '')}</div><div class="dim sm">Ahora: ${now.ap} PA · ${esc(spellSummary(now))}</div><div class="good sm">Después: ${next.ap} PA · ${esc(spellSummary(next))}</div><div class="dim sm">Nivel del hechizo: ${lvl + 1} → ${lvl + 2} de ${MAX_SPELL_UPS + 1}</div><button class="pri" data-act="bossreward" data-id="${i}">Elegir</button></div>`;
}

/** Recompensa del jefe pendiente: mejora, mejora y hechizo nuevo. */
export function bossRow(run: RunState): string {
  const h = mine(run);
  if (!h?.bossOffer) return '';
  // H4: el Santuario y la recompensa de jefe sin bendiciones disponibles ofrecen mejoras de hechizo
  const shrine = run.room?.kind === 'shrine', spells = h.bossOffer.some((o) => o.kind === 'spell');
  return `<div class="panel loot boon"><div class="row"><h3>${shrine ? '✨ Santuario: mejora un hechizo' : spells ? '👑 Recompensa: elige una' : '🔧 Mejora de hechizo: elige una'}</h3><span class="grow"></span></div>
  <div class="dim sm">${spells ? `Hechizos nuevos de ${esc(CLASSES[h.cls].name)}.` : 'Mejora para una de tus habilidades equipadas: dura toda la expedición.'}</div>
  <div class="cards c${Math.min(4, h.bossOffer.length)}">${h.bossOffer.map((o, i) => bossCard(h, o, i)).join('')}</div></div>`;
}

/** Modal de victoria: botín en iconos con tooltip, recompensa del jefe, resumen y «Continuar». */
export function victoryModal(run: RunState): string {
  const r = run.report, h = mine(run);
  if (!r) return '';
  const chip = (icon: string, tipHtml: string, cls = ''): string => `<span class="cell big ${cls}" ${tip(tipHtml)}><span class="emo">${icon}</span></span>`;
  const mineLoot = r.loot.filter((l) => !h || l.owner === h.owner);
  const found = r.items.filter((x) => !h || x.owner === h.owner).map((x) => x.item);
  const items = found.map((it) => `<span class="cell big ${RAR[it.rarity]}" ${tip(`${itemHtml(it, true)}<div class="sm good">Ya es tuyo: equipado si tenías la ranura libre, si no en la mochila.</div>`)}>${itemIcon(it)}</span>`).join('');
  const total = Math.max(1, ...r.damage.map((x) => x.dmg));
  return `<div class="modal victory" id="victorymodal"><div class="panel wide">
  <h2 class="vtitle">FIN DEL COMBATE - ¡HAS GANADO!</h2>
  <div class="lbl">Has encontrado…</div>
  <div class="cells loot-icons">${chip('💰', `<b>Oro</b><div class="sm">+${r.gold} de oro para cada uno.</div>`)}${items}${mineLoot.map((l) => chip(l.icon, `<b>${esc(l.name)}</b><div class="sm">${esc(l.text)}</div>`, l.rare ? 'ir3' : 'ir1')).join('')}</div>
  ${stashRow(run)}
  ${boonRow(run)}
  ${bossRow(run)}
  <div class="lbl">Resumen</div>
  <div class="vsum sm"><span>⏱️ ${r.turns} ronda${r.turns === 1 ? '' : 's'}</span><span>⚔️ ${r.damage.reduce((a, x) => a + x.dmg, 0)} de daño</span></div>
  ${r.damage.map((x) => `<div class="vbar sm"><span>${esc(x.name)}</span><i style="width:${Math.round((x.dmg / total) * 100)}%"></i><b>${x.dmg}</b></div>`).join('')}
  <div class="row"><span class="grow"></span><button class="pri" data-act="report">Continuar</button></div></div></div>`;
}

/** Bendición pendiente: 3 habilidades de un patrón (las del mismo patrón se potencian entre sí). */
export function boonRow(run: RunState): string {
  const h = mine(run);
  if (!h?.boonOffer) return '';
  const p = PATRONS[h.boonOffer.patron]!;
  const counts = patronBonus(h.boons).counts;
  const card = (id: string, i: number): string => {
    const pp = patronOf(id)!, n = (counts[pp.id] ?? 0) + 1;
    const syn = n >= 2 && !pp.noSet ? `<div class="good sm">Con esta: ${n} de ${esc(pp.name)} → ${esc(n >= 3 ? pp.threeText : pp.twoText)}</div>` : '';
    const bl = BLESSINGS[id];
    if (bl) return `<div class="lootcard r3"><div class="row"><span class="emo big">${bl.icon}</span><div><b>${esc(bl.name)}</b><div class="pill sm">Bendición de clase (pasiva)</div></div></div><div class="sm">${esc(bl.text)}</div><button class="pri" data-act="boon" data-id="${i}">Elegir</button></div>`;
    const mod = BOON_MODS[id];
    if (mod) {
      const base = SPELLS[mod.target]!, now = tuned(base, { ups: [...h.boons.filter((b) => BOON_MODS[b]?.target === mod.target), ...(h.ups[mod.target] ?? [])] }), next = tuned(base, { ups: [id, ...h.boons.filter((b) => BOON_MODS[b]?.target === mod.target), ...(h.ups[mod.target] ?? [])] });
      return `<div class="lootcard r2"><div class="row">${spellIcon(next)}<div><b>${esc(mod.name)}</b><div class="pill sm">Mejora: ${esc(base.name)}</div></div></div><div class="sm">${esc(mod.text)}</div><div class="dim sm">Ahora: ${now.ap} PA · ${esc(spellSummary(now))}</div><div class="good sm">Después: ${next.ap} PA · ${esc(spellSummary(next))}</div>${syn}<button class="pri" data-act="boon" data-id="${i}">Elegir</button></div>`;
    }
    const d = SPELLS[id]!;
    return `<div class="lootcard r2" ${tip(spellTip(d))}><div class="row">${spellIcon(d)}<div><b>${esc(d.name)}</b><div class="pill sm">Hechizo nuevo de ${esc(CLASSES[h.cls].name)}</div></div></div><div class="sm">${esc(d.text)}</div><div class="dim sm">${d.ap} PA · ${rangeText(d)}${d.perTurn ? ` · ${d.perTurn} por turno` : ''}${d.cd ? ` · espera ${d.cd + 1}` : ''}</div>${syn}<button class="pri" data-act="boon" data-id="${i}">Elegir</button></div>`;
  };
  const nBless = h.boons.filter((b) => BLESSINGS[b] || BOON_MODS[b]).length;
  return `<div class="panel loot boon"><div class="row"><h3>🌟 Bendición de ${esc(CLASSES[h.cls].name)}: elige una</h3><span class="grow"></span><span class="dim sm">Bendiciones: ${nBless}</span></div>
  <div class="dim sm">Modifican tus mecánicas de clase o tus habilidades equipadas y duran toda la expedición.${p.noSet ? '' : ` Con 2 de ${esc(p.name)}: ${esc(p.twoText)} · con 3: ${esc(p.threeText)}.`}</div>
  <div class="cards c${Math.min(4, h.boonOffer.spells.length)}">${h.boonOffer.spells.map(card).join('')}</div>
  </div>`;
}

/** Todo lo que el jugador tiene pendiente de elegir. */
export const pendingRows = (run: RunState): string => `${boonRow(run)}${bossRow(run)}${stashRow(run)}${lootRow(run)}`;

/** Control para cambiar de sala: el anfitrión espera a que todos estén listos; los demás pulsan «Listo». */
export function advanceBar(run: RunState, label: string, act = 'leavenode'): string {
  const s = ui.session!;
  const h = mine(run);
  const wait = s.waiting();
  const others = run.heroes.filter((x) => x.owner !== s.myId);
  const status = others.length ? `<span class="sm">${others.map((x) => { const p = pendingOf(run, x); const ok = !p.length && run.ready[x.owner] === run.stamp; return `<span class="${ok ? 'good' : 'dim'}" ${tip(p.length ? `Le falta elegir: ${p.join(', ')}` : ok ? 'Listo' : 'Aún no ha pulsado Listo')}>${ok ? '✔' : '⏳'} ${esc(x.name)}</span>`; }).join(' ')}</span>` : '';
  if (s.isHost) {
    // si a nadie le queda nada por elegir (solo falta que pulsen «Listo»), el anfitrión puede seguir igualmente
    const onlyReady = wait.length > 0 && wait.every((x) => !pendingOf(run, x).length);
    const who = wait.map((x) => `${esc(x.name)}${pendingOf(run, x).length ? ` (eligiendo ${pendingOf(run, x).join(', ')})` : ' (debe pulsar «Estoy listo»)'}`).join(', ');
    return `<div class="row advance">${status}<span class="grow"></span>${wait.length ? `<span class="sm">⏳ Esperando a ${who}</span>` : ''}${onlyReady ? '<button data-act="forceready">Seguir sin esperar</button>' : ''}${act ? `<button class="pri" data-act="${act}" ${wait.length ? 'disabled' : ''}>${label}</button>` : ''}</div>`;
  }
  const pend = h ? pendingOf(run, h) : [];
  const ready = !!h && run.ready[h.owner] === run.stamp;
  return `<div class="row advance ${ready || pend.length ? '' : 'callout'}">${status}<span class="grow"></span>${h ? `<button class="${ready ? '' : 'pri'}" data-act="ready" ${pend.length ? 'disabled' : ''} ${pend.length ? tip(`Antes elige: ${pend.join(', ')}`) : ''}>${ready ? '✔ Listo (deshacer)' : pend.length ? `Elige tu ${pend[0]}` : 'Estoy listo'}</button>` : ''}<span class="dim sm">${ready ? 'Esperando al anfitrión…' : 'Pulsa «Estoy listo» para que el anfitrión pueda seguir'}</span></div>`;
}

/** Botín pendiente: tarjetas grandes con icono, datos y comparación. */
/** Botín propio que no cabía: equiparlo, guardarlo o venderlo. */
export function stashRow(run: RunState): string {
  const h = mine(run);
  const list = (run.stash ?? []).map((it, i) => ({ it, i })).filter(({ it }) => !it.owner || it.owner === h?.owner);
  if (!list.length || !h) return '';
  return `<div class="panel loot"><div class="row"><h3>🧰 Tu botín sin guardar (${list.length})</h3><span class="grow"></span><span class="dim sm">Mochila ${h.bag.length}/${BAG_SIZE}</span></div>
  <div class="dim sm">No te cabía en la mochila. Es solo tuyo: equípalo, guárdalo (haz sitio antes) o véndelo al 50%.</div>
  <div class="stash">${list.map(({ it, i }) => `<div class="stashitem"><span class="cell ${RAR[it.rarity]}" ${tip(itemHtml(it, true) + diffHtml(it, h))}>${itemIcon(it)}</span><div class="sm"><b class="${RAR[it.rarity]}">${esc(it.name)}</b><div class="dim">${SLOT_NAME[it.slot]}</div></div>
    <span class="grow"></span><button class="mini" data-act="stash" data-id="${i}" data-op="equip">Equipar</button><button class="mini" data-act="stash" data-id="${i}" data-op="bag">Mochila</button><button class="mini" data-act="stash" data-id="${i}" data-op="split">Vender · ${Math.floor(PRICE[it.rarity] / 2)} 💰</button></div>`).join('')}</div></div>`;
}

export function lootRow(run: RunState): string {
  const h = mine(run);
  const offer = h ? run.offers[ui.myId] : undefined;
  if (!offer || !h) return '';
  return `<div class="panel loot"><div class="row"><h3>🎁 Botín: elige uno</h3><span class="grow"></span><button class="mini" data-act="pick" data-id="-1">No quiero ninguno</button></div>
  <div class="cards">${offer.map((it, i) => `<div class="lootcard ${RAR[it.rarity]}"><div class="row"><div class="cell ${RAR[it.rarity]} big">${itemIcon(it)}</div><div>${itemHtml(it)}</div></div>${diffHtml(it, h)}<button class="pri" data-act="pick" data-id="${i}">Quedármelo</button></div>`).join('')}</div>
  <div class="dim sm">Si la ranura está ocupada, va a tu mochila y decides después.</div></div>`;
}

/** Ficha del personaje: estadísticas base + todo lo que las modifica, habilidades, reliquias y bendiciones. */
export function statsModal(run: RunState): string {
  const me = mine(run);
  const h = run.heroes.find((x) => x.owner === ui.statsOf) ?? me ?? run.heroes[0];
  if (!h) return '';
  const tabs = `<div class="tabs stabs">${run.heroes.map((x, i) => `<button class="${ui.statsOf !== '*' && x === h ? 'on' : ''}" data-act="statsof" data-id="${esc(x.owner)}"><span class="p${i % 4}">${esc(x.name)}</span>${x === me ? ' (tú)' : ''}</button>`).join('')}${run.heroes.length > 1 ? `<button class="${ui.statsOf === '*' ? 'on' : ''}" data-act="statsof" data-id="*">👥 Comparar grupo</button>` : ''}</div>`;
  const passive = (x: HeroSave): string => { const p = CLASS_PASSIVE[x.cls]; return p ? `<div class="passive"><b>${p.icon} Pasiva: ${esc(p.name)}</b><div class="sm">${esc(p.text)}</div></div>` : ''; };
  if (ui.statsOf === '*') {
    const all = run.heroes.map((x) => ({ x, rows: statBreakdown(x) }));
    const keys = all[0]!.rows.map((r) => r.key);
    return `<div class="modal" id="statsmodal"><div class="panel wide">
    <div class="row"><h2>👥 Comparar grupo</h2><span class="grow"></span><button class="mini" data-act="stats">Cerrar ✕</button></div>${tabs}
    <table class="stattab cmp"><tr><th>Estadística</th>${all.map(({ x }, i) => `<th class="p${i % 4}">${esc(x.name)}<div class="dim sm">${esc(CLASSES[x.cls].name)}</div></th>`).join('')}</tr>
    ${keys.map((k) => { const vals = all.map(({ x, rows }) => { const r = rows.find((y) => y.key === k)!; return { r, x }; }); const best = Math.max(...vals.map((v) => v.r.total)); return `<tr><td>${esc(vals[0]!.r.name)}</td>${vals.map(({ r, x }) => `<td class="${r.total === best && vals.length > 1 ? 'good' : ''}"><b>${k === 'hp' ? `${x.hp}/${r.total}` : r.total}</b></td>`).join('')}</tr>`; }).join('')}
    <tr><td>Oro · Escofinas</td>${all.map(({ x }) => `<td>💰 ${x.gold} · 🔔 ${x.escofinas ?? 0}</td>`).join('')}</tr>
    </table>
    <div class="cards c${Math.min(4, run.heroes.length)}">${all.map(({ x }) => `<div class="panel">${passive(x)}<div class="lbl">Bendiciones</div>${x.boons.filter((b) => BLESSINGS[b]).map((b) => `<div class="sm good" ${tip(esc(BLESSINGS[b]!.text))}>${BLESSINGS[b]!.icon} ${esc(BLESSINGS[b]!.name)}</div>`).join('') || '<div class="dim sm">Ninguna</div>'}<div class="lbl">Habilidades</div><div class="chips">${heroSpec(x).spells.filter((sp) => sp.charges === undefined).map((sp) => { const d = tuned(SPELLS[sp.id]!, sp); return `<span class="chip" ${tip(spellTip(d))}>${spellIcon(d, false)}</span>`; }).join('')}</div></div>`).join('')}</div>
    </div></div>`;
  }
  const rows = statBreakdown(h);
  const spec = heroSpec(h);
  const pat = patronBonus(h.boons);
  return `<div class="modal" id="statsmodal"><div class="panel wide">
  <div class="row"><h2>📊 ${esc(h.name)}</h2><span class="dim">${esc(CLASSES[h.cls].name)} · ${esc(findRoute(h.cls, h.routes[0] ?? '')?.name ?? '')}</span><span class="grow"></span><button class="mini" data-act="stats">Cerrar ✕</button></div>${tabs}${passive(h)}
  <table class="stattab"><tr><th>Estadística</th><th>Base</th><th>Modificadores</th><th>Total</th></tr>
  ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="dim">${r.base}</td><td class="sm">${r.parts.map(([n, v]) => `<span class="${v > 0 ? 'good' : 'bad'}">${v > 0 ? '+' : ''}${v} ${esc(n)}</span>`).join(' · ') || '<span class="dim">—</span>'}</td><td><b>${r.key === 'hp' ? `${h.hp}/${r.total}` : r.total}</b></td></tr>`).join('')}
  </table>
  <div class="cards c2">
    <div><div class="lbl">Habilidades</div><div class="chips">${spec.spells.filter((x) => x.charges === undefined).map((sp) => { const d = tuned(SPELLS[sp.id]!, sp); return `<span class="chip" ${tip(spellTip(d))}>${spellIcon(d)} ${esc(d.name)}</span>`; }).join('')}</div>
    ${Object.values(h.bag2).some((n) => n > 0) ? `<div class="lbl">Consumibles</div><div class="chips">${Object.entries(h.bag2).filter(([, n]) => n > 0).map(([id, n]) => `<span class="chip" ${tip(spellTip(SPELLS[id]!))}>${spellIcon(SPELLS[id]!, false)} ${esc(SPELLS[id]!.name)} x${n}</span>`).join('')}</div>` : ''}</div>
    <div>${h.relics.length ? `<div class="lbl">Reliquias</div><div class="chips">${h.relics.map((r) => RELICS[r]).filter(Boolean).map((r) => `<span class="chip" ${tip(esc(r!.text))}>${r!.icon} ${esc(r!.name)}</span>`).join('')}</div>` : ''}
    ${h.boons.some((b) => BLESSINGS[b]) ? `<div class="lbl">Bendiciones de clase</div>${h.boons.filter((b) => BLESSINGS[b]).map((b) => `<div class="sm good" ${tip(esc(BLESSINGS[b]!.text))}>${BLESSINGS[b]!.icon} ${esc(BLESSINGS[b]!.name)}</div>`).join('')}` : ''}
    ${Object.keys(pat.counts).some((id) => !PATRONS[id]!.noSet) ? `<div class="lbl">Bendiciones</div>${Object.entries(pat.counts).filter(([id]) => !PATRONS[id]!.noSet).map(([id, n]) => { const p = PATRONS[id]!; return `<div class="sm ${n >= 2 ? 'good' : 'dim'}">${p.icon} ${esc(p.name)} ${n}/3 · ${n >= 3 ? esc(p.threeText) : n >= 2 ? esc(p.twoText) : `con 2: ${esc(p.twoText)}`}</div>`; }).join('')}` : ''}
    ${h.boons.some((b) => BOON_MODS[b]) ? `<div class="lbl">Hechizos mejorados</div>${h.boons.filter((b) => BOON_MODS[b]).map((b) => `<div class="sm" ${tip(esc(BOON_MODS[b]!.text))}>✨ ${esc(BOON_MODS[b]!.name)} <span class="dim">(${esc(SPELLS[BOON_MODS[b]!.target]!.name)})</span></div>`).join('')}` : ''}
    ${(spec.traits ?? []).filter((t) => !Object.values(BLESSINGS).some((b) => b.trait === t)).length ? `<div class="lbl">Efectos especiales</div>${(spec.traits ?? []).filter((t) => !Object.values(BLESSINGS).some((b) => b.trait === t)).map((t) => `<div class="sm">${esc(TRAIT_LABEL[t] ?? t)}</div>`).join('')}` : ''}</div>
  </div></div></div>`;
}
const TRAIT_LABEL: Record<string, string> = { venom: 'Tus venenos aplican 1 carga más', ignite: 'Todo tu daño quema', execute: 'Tus críticos hacen el doble', mender: 'Curas y escudos +30%', guard: 'Empiezas cada turno con escudo', thorns: 'Devuelves el 30% del daño cuerpo a cuerpo', regen: 'Te regeneras cada turno', enrage: '+40% de daño con poca vida' };

/** Dibujo del mapa: capas de abajo (inicio) a arriba (jefe). Con `pick`, los nodos disponibles se pulsan para ir a ellos. */
export function mapSvg(run: RunState, pick = false): string {
  // de izquierda (inicio) a derecha (jefe)
  const L = run.map.length, colW = 78, H = 300, W = L * colW;
  const pos = (l: number, i: number): [number, number] => [colW / 2 + l * colW, 10 + ((i + 0.5) / run.map[l]!.length) * (H - 40)];
  const avail = run.phase === 'map' ? availableNodes(run) : [];
  const here = (l: number, i: number): boolean => run.trail[l] === i && l < run.step;
  const current = (l: number, i: number): boolean => run.phase !== 'map' && l === run.step && run.trail[l] === i;
  const me = mine(run);
  const canPick = pick && !!me && !(me && pendingOf(run, me).length);
  const PCOL = ['#e8607a', '#5a9cf0', '#5fcf70', '#e8bd40'];
  const votesAt = (i: number): Array<{ name: string; col: string; mine: boolean }> => run.heroes.map((h, k) => ({ h, k })).filter(({ h }) => run.mapVotes?.[h.owner] === i).map(({ h, k }) => ({ name: h.name, col: PCOL[k % 4]!, mine: h.owner === ui.myId }));
  const lines = run.links.map((rows, l) => rows.map((to, i) => to.map((j) => {
    const [x1, y1] = pos(l, i), [x2, y2] = pos(l + 1, j);
    const walked = run.trail[l] === i && (run.trail[l + 1] === j && l + 1 < run.step || (l + 1 === run.step && avail.includes(j)));
    const toSealed = run.map[l + 1]![j] === 'vault' && !secretOpen(run);
    if (toSealed && !walked) return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a3622" stroke-width="2" stroke-dasharray="3 5" opacity=".55"/>`;
    return walked ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffd36a" stroke-width="4" filter="url(#mglow)"/>`
      : `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a3622" stroke-width="3" stroke-linecap="round" opacity=".75"/>`;
  }).join('')).join('')).join('');
  const nodes = run.map.map((row, l) => row.map((k, i) => {
    const [x, y] = pos(l, i);
    const can = l === run.step && avail.includes(i), done = here(l, i) || current(l, i);
    // Oscuridad profunda: más allá de las 2 capas siguientes no se sabe qué hay (salvo el jefe)
    const dark = run.mods.includes('oscuridad') && l > run.step + 1 && l < run.map.length - 1;
    // G4: pasaje secreto sellado
    const sealed = k === 'vault' && !secretOpen(run);
    const stroke = can ? '#ffcf5a' : done ? '#7fe07a' : '#7a6a52';
    const click = pick && can ? `data-act="node" data-id="${i}" style="cursor:${canPick ? 'pointer' : 'not-allowed'}"` : '';
    const label = can ? `<text x="${x}" y="${y + 37}" text-anchor="middle" font-size="12" font-weight="700" fill="#3a2410" class="mlabel">${esc(NODE_NAME[k].replace(/^\S+\s/, ''))}</text>` : '';
    const vs = can ? votesAt(i) : [];
    const voteMarks = vs.map((v, n) => `<g><circle cx="${x - 18 + n * 12}" cy="${y - 24}" r="7" fill="${v.col}" stroke="#000" stroke-width="2"/><text x="${x - 18 + n * 12}" y="${y - 20.5}" text-anchor="middle" font-size="9" font-weight="bold" fill="#000" pointer-events="none">${esc(v.name.charAt(0).toUpperCase())}</text></g>`).join('');
    const ring = vs.length ? `<circle cx="${x}" cy="${y}" r="29" fill="none" stroke="${vs.find((v) => v.mine)?.col ?? vs[0]!.col}" stroke-width="2" stroke-dasharray="4 3" class="voting"/>` : '';
    const tipHtml = dark ? '<b>❔ En sombra</b><div class="sm">La Oscuridad profunda no deja ver qué hay aquí.</div>' : `<b>${esc(NODE_NAME[k])}</b><div class="sm">${esc(NODE_HINT[k] ?? '')}</div>${k === 'vault' ? `<div class="sm ${sealed ? 'bad' : 'good'}">${sealed ? '🔒 Sellado: aún no podéis entrar.' : '🔓 Abierto: podéis tomar este camino.'}</div>` : ''}${vs.length ? `<div class="sm">Quieren ir: ${vs.map((v) => `<b style="color:${v.col}">${esc(v.name)}</b>`).join(', ')}</div>` : ''}${can && pick ? '<div class="sm good">Haz clic para votar este camino</div>' : ''}`;
    return `<g ${click} ${tip(tipHtml)} opacity="${l < run.step && !done ? 0.35 : 1}">${ring}${can ? `<circle cx="${x}" cy="${y}" r="27" fill="#ff9a3a" opacity=".35" class="mpulse"/>` : ''}<circle cx="${x}" cy="${y}" r="${can ? 23 : 19}" fill="${can ? '#3b2a18' : '#24201c'}" stroke="${stroke}" stroke-width="${can || done ? 3 : 2}"${sealed ? ' stroke-dasharray="4 3"' : ''}${can || done ? ' filter="url(#mglow)"' : ''}/><circle cx="${x}" cy="${y}" r="${can ? 18 : 15}" fill="none" stroke="#000" stroke-opacity=".45"/><text x="${x}" y="${y + 7}" text-anchor="middle" font-size="20" pointer-events="none">${dark ? '❔' : sealed ? '🔒' : NODE_ICON[k]}</text>${label}${voteMarks}</g>`;
  }).join('')).join('');
  const grid = Array.from({ length: Math.ceil(W / 40) }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="${H}"/>`).join('') + Array.from({ length: Math.ceil(H / 40) }, (_, i) => `<line x1="0" y1="${i * 40}" x2="${W}" y2="${i * 40}"/>`).join('');
  const defs = '<defs><filter id="mglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  return `<div class="mapscroll parchment"><svg class="actmap" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${defs}<g class="mgrid">${grid}</g>${lines}${nodes}</svg></div>`;
}

const mapLegend = (): string => (['combat', 'elite', 'sangre', 'event', 'shrine', 'shop', 'treasure', 'forge', 'rest', 'vault', 'altar', 'boss'] as const).map((k) => `<span class="chip">${NODE_ICON[k]} ${esc(NODE_NAME[k].replace(/^\S+\s/, ''))}</span>`).join('');

/** Mapa del acto como cartel (para consultarlo desde cualquier pantalla). */
export function mapModal(run: RunState): string {
  const L = run.map.length;
  return `<div class="modal" id="mapmodal"><div class="panel wide">
  <div class="row"><h2>🗺️ Mapa · Zona ${run.zone + 1}</h2><span class="dim sm">Sala ${Math.min(run.step + 1, L)} de ${L}</span><span class="grow"></span><button class="mini" data-act="map">Cerrar ✕</button></div>
  ${mapSvg(run)}
  <div class="dim sm">Dorado: caminos disponibles · Verde: ruta recorrida. Pasa el ratón por una sala para ver qué es. El jefe está a la derecha.</div></div></div>`;
}

export { mapLegend };

/** Iconos de las bendiciones activas de cada héroe (esquina superior izquierda). */
/** Pacto, calor de la forja y maldiciones activas: chips siempre visibles. */
export function runChips(run: RunState): string {
  const out: string[] = [];
  const p = pactOf(run.pact);
  if (run.mods.length) out.push(`<span class="pill chip mods" ${tip(`<b>⚠ Modificadores de la expedición</b>${run.mods.map((id) => { const m = modDef(id); return m ? `<div class="sm"><b>${esc(m.name)}</b>: ${esc(m.text)}</div>` : ''; }).join('')}`)}>⚠ ${run.mods.length === 1 ? esc(modDef(run.mods[0]!)?.name ?? run.mods[0]!) : `${run.mods.length} modificadores`}</span>`);
  if (p) out.push(`<span class="pill chip pact" ${tip(`<b>${p.icon} ${esc(p.name)}</b><div class="sm good">▲ ${esc(p.boon)}</div><div class="sm bad">▼ ${esc(p.bane)}</div>`)}>${p.icon} ${esc(p.name.replace('Pacto ', ''))}</span>`);
  if (run.overload) { const t = heatTier(run.overload === 'overload' ? HEAT_OVERLOAD : HEAT_HOT); out.push(`<span class="pill chip heatchip ${run.overload}" ${tip(`<b>🔥 ${esc(t.name)}</b><div class="sm">${esc(t.text)}</div>`)}>🔥 ${esc(t.name)}</span>`); }
  // G4: consecuencias activas de decisiones anteriores
  const cons = consequences(run);
  if (cons.length) out.push(`<span class="pill chip conseq" ${tip(`<b>⑂ Consecuencias de vuestras decisiones</b>${cons.map((c) => `<div class="sm ${c.tone === 'good' ? 'good' : c.tone === 'bad' ? 'bad' : ''}">${c.icon} <b>${esc(c.name)}</b>: ${esc(c.text)}</div>`).join('')}`)}>⑂ ${cons.length === 1 ? `${cons[0]!.icon} ${esc(cons[0]!.name)}` : `${cons.length} consecuencias`}</span>`);
  for (const x of run.hexes ?? []) { const c = curseOf(x.id); if (c) out.push(`<span class="pill chip curse" ${tip(`<b>${c.icon} ${esc(c.name)}</b><div class="sm">${esc(c.text)}</div><div class="sm dim">Quedan ${x.fights} combate(s)</div>`)}>${c.icon} ${esc(c.name)} · ${x.fights}</span>`); }
  return out.length ? `<span class="runchips">${out.join('')}</span>` : '';
}

export function blessingBar(run: RunState): string {
  const chips = runChips(run);
  const rows = run.heroes.map((h, i) => {
    const bl = h.boons.filter((b) => BLESSINGS[b]).map((b) => BLESSINGS[b]!);
    if (!bl.length) return '';
    return `<span class="bless p${i % 4}"><span class="sm">${esc(h.name)}</span>${bl.map((b) => `<span class="bicon" ${tip(`<b>${b.icon} ${esc(b.name)}</b><div class="sm">${esc(b.text)}</div>`)}>${b.icon}</span>`).join('')}</span>`;
  }).join('');
  return rows || chips ? `<div class="blessbar">${chips}${rows}</div>` : '';
}

/** Cartel central «Has obtenido…» con el objeto o el hechizo recibido. */
export function gotModal(g: { title: string; html: string }): string {
  return `<div class="modal got" id="gotmodal"><div class="panel frame gotcard"><div class="gotglow"></div><h2 class="vtitle">${esc(g.title)}</h2><div class="gotbody">${g.html}</div>
  <div class="row"><span class="grow"></span><button class="pri" data-act="gotok">Aceptar</button></div></div></div>`;
}

/** Contenido del cartel para una recompensa de jefe. */
export function gotFromBoss(o: BossOption): { title: string; html: string } {
  if (o.kind === 'spell') { const d = SPELLS[o.id]!; return { title: '¡Hechizo aprendido!', html: `<div class="row">${spellIcon(d)}<div><b>${esc(d.name)}</b><div class="sm">${esc(d.text)}</div></div></div>` }; }
  if (o.kind === 'up') { const d = SPELLS[o.spell]!, g = UPGRADES[o.up] ?? BOON_MODS[o.up]; return { title: '¡Hechizo mejorado!', html: `<div class="row">${spellIcon(d)}<div><b>${esc(d.name)}</b><div class="sm">${esc(g?.name ?? '')}: ${esc(g?.text ?? '')}</div></div></div>` }; }
  if (o.kind === 'gold') return { title: '¡Has obtenido!', html: `<p class="big">💰 ${o.amount} de oro</p>` };
  return { title: '¡Te has curado!', html: '<p class="big">❤️ Recuperas el 50% de tu vida.</p>' };
}
