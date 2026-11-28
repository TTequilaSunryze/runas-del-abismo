// Interfaz del sistema rúnico: piedras rúnicas, ofertas, la pestaña de runas de la expedición y el Grimorio rúnico del Archivo.
import { SPELLS } from '../core/classes/spells';
import { spellOf } from '../core/combat/engine';
import { tuned } from '../core/upgrades';
import {
  FAMILIES, FAMILY_COLOR, FAMILY_ICON, FAMILY_NAME, KIND_NAME, RARITY_NAME, RUNES, RUNE_LIST, RUNE_RESERVE, RUNE_SLOTS, SYNERGIES, SYNERGY_LIST,
  activeSynergies, nearSynergies, runeResult, runeStatuses, type RuneDef, type RuneKind,
} from '../core/runes';
import { STATUSES } from '../core/statuses';
import type { StatusKind } from '../core/state';
import { entriesOf, completion } from '../game/archive';
import { heroSpec, type HeroSave, type RunState } from '../game/run';
import { SOURCE_NAME } from '../game/runeLoot';
import { esc, mine, tip, ui } from './ctx';
import { spellIcon, spellTip } from './icons';
import { spellSummary } from './spellicons';

/** Glifos del futhark antiguo: cada runa tiene el suyo (estable por id). */
const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const glyph = (id: string): string => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return [...GLYPHS][h % [...GLYPHS].length]!; };

/** Piedra rúnica: color de la familia, borde de la rareza, glifo propio. */
export function runeStone(id: string | undefined, attrs = '', big = false, sel = false): string {
  const r = id ? RUNES[id] : undefined;
  if (!r) return `<button class="runestone empty ${big ? 'big' : ''}" ${attrs || 'disabled'}><i>+</i></button>`;
  return `<button class="runestone rr${r.rarity} ${big ? 'big' : ''} ${sel ? 'sel' : ''}" style="--fam:${FAMILY_COLOR[r.family]}" ${attrs} ${tip(runeTip(r))}><i>${glyph(r.id)}</i><small>${'◆'.repeat(r.rarity)}</small></button>`;
}

export function statusChip(kind: StatusKind): string {
  const s = STATUSES[kind];
  return s ? `<span class="chip stchip" style="--st:${s.color}" ${tip(`<b>${s.icon} ${esc(s.name)}</b><div class="sm">${esc(s.text)}</div>${s.rankText ? `<div class="sm dim">${esc(s.rankText)}</div>` : ''}`)}>${s.icon} ${esc(s.name)}</span>` : '';
}

/** Sinergias en las que participa la familia de una runa (solo las reales). */
const synergiesOfFamily = (r: RuneDef) => SYNERGY_LIST.filter((s) => s.families.includes(r.family));

type Syn = (typeof SYNERGY_LIST)[number];
/** Familias de una sinergia en palabras («Muerte + Tiempo»). */
const famWords = (s: Syn): string => s.families.map((f) => `${FAMILY_ICON[f]} ${FAMILY_NAME[f]}`).join(' + ');
/**
 * Qué es una sinergia, qué hace y si ya la tienes: con tus runas equipadas (`eq`) dice si está activa o qué familia falta.
 * Las sinergias no son runas: se activan solas al llevar a la vez runas de varias familias.
 */
export function synTip(s: Syn, eq?: readonly string[], extra?: string): string {
  const on = eq ? activeSynergies(eq).some((x) => x.id === s.id) : false;
  const have = new Set((eq ?? []).map((id) => RUNES[id]?.family).filter(Boolean));
  const miss = s.families.filter((f) => !have.has(f));
  const state = !eq ? '' : on ? '<div class="sm good">✔ La tienes activa.</div>' : `<div class="sm">Te falta${miss.length > 1 ? 'n' : ''}: ${miss.map((f) => `<b style="color:${FAMILY_COLOR[f]}">${FAMILY_ICON[f]} una runa de ${FAMILY_NAME[f]}</b>`).join(' y ')}.</div>`;
  return `<b>🔗 Sinergia: ${esc(s.name)}</b><div class="sm dim">${famWords(s)}</div><div class="sm">${esc(s.text)}</div>${extra ?? ''}${state}<div class="sm dim">Las sinergias no se equipan: se activan solas al llevar a la vez runas de esas familias.</div>`;
}
/** Nombre de sinergia con su explicación al pasar el ratón y la marca ✔ si ya está activa. */
export function synLink(s: Syn, eq?: readonly string[]): string {
  const on = eq ? activeSynergies(eq).some((x) => x.id === s.id) : false;
  return `<span class="synlink ${on ? 'on' : ''}" ${tip(synTip(s, eq))}>${on ? '✔ ' : ''}${esc(s.name)}</span>`;
}

export function runeTip(r: RuneDef): string {
  return `<b style="color:${FAMILY_COLOR[r.family]}">${esc(r.name)}</b><div class="sm dim">${FAMILY_ICON[r.family]} ${FAMILY_NAME[r.family]} · <span class="rr${r.rarity}t">${RARITY_NAME[r.rarity]}</span> · ${KIND_NAME[r.kind]}${r.stackable ? ' · acumulable' : ''}${r.boss ? ' · de jefe' : ''}</div><div class="sm">${esc(r.text)}</div><i class="sm dim">${esc(r.lore)}</i>`;
}

/** Ficha completa de una runa: efecto, ejemplo, estados, sinergias y qué cambia en las habilidades del héroe. */
export function runeSheet(r: RuneDef, h?: HeroSave): string {
  const sts = runeStatuses(r.id);
  const syn = synergiesOfFamily(r).filter((s) => s.families.length === 2);
  let spells = '';
  if (h) {
    const unit = heroSpec(h);
    const rows = unit.spells.filter((sp) => sp.charges === undefined).map((sp) => {
      const base = tuned(SPELLS[sp.id]!, sp);
      const res = runeResult(base, [r.id]);
      const on = res.traces.filter((t) => t.applied);
      return on.length ? `<li class="${res.mutated ? 'mut' : 'up'}">${spellIcon(res.spell, false)} <b>${esc(base.name)}</b>: ${on.map((t) => esc(t.text)).join(' · ')}</li>` : `<li class="dim">${esc(base.name)}: no le afecta</li>`;
    });
    const unitOps = r.ops.filter((o) => o.op === 'stats' || o.op === 'trait');
    const own = unitOps.length ? `<li class="up">🧍 Al personaje: ${esc(r.text)}</li>` : '';
    spells = `<div class="lbl">En tus habilidades</div><ul class="rspells">${own}${unitOps.length === r.ops.length ? '<li class="dim">No cambia tus habilidades: mejora al personaje.</li>' : rows.join('')}</ul>`;
  }
  return `<div class="runesheet" style="--fam:${FAMILY_COLOR[r.family]}"><div class="row">${runeStone(r.id, 'tabindex="-1"', true)}<div class="grow"><b class="rname">${esc(r.name)}</b><div class="sm dim">${FAMILY_ICON[r.family]} ${FAMILY_NAME[r.family]} · <span class="rr${r.rarity}t">${RARITY_NAME[r.rarity]}</span> · ${KIND_NAME[r.kind]}${r.stackable ? ' · se puede equipar varias veces' : ''}</div></div></div>
    <i class="sm dim">${esc(r.lore)}</i>
    <div class="sm"><b>Efecto:</b> ${esc(r.text)}</div>
    <div class="sm dim"><b>Ejemplo:</b> ${esc(r.example)}</div>
    ${sts.length ? `<div class="chips">${sts.map(statusChip).join('')}</div>` : ''}
    <div class="sm dim"><b ${tip('<b>Sinergias</b><div class="sm">Si llevas a la vez esta runa y una runa de la otra familia, se activa la sinergia: un efecto extra que no ocupa espacio. Pasa el ratón por cada una para ver qué hace.</div>')}>Sinergias posibles:</b> ${syn.map((s) => `${FAMILY_ICON[s.families.find((f) => f !== r.family)!]} ${synLink(s, h?.runes)}`).join(' · ')}</div>
    ${spells}</div>`;
}

// ---------- oferta de runas (pendiente de elegir) ----------
export function runeOfferRow(run: RunState, modal = false): string {
  const h = mine(run);
  const o = h?.runeOffers?.[0];
  if (!h || !o) return '';
  const eq = h.runes ?? [], full = eq.length >= RUNE_SLOTS;
  const card = (id: string, i: number): string => {
    const r = RUNES[id]!;
    const after = activeSynergies([...eq, id]).filter((s) => !activeSynergies(eq).some((x) => x.id === s.id));
    const actions = full
      ? `<div class="sm dim">Espacios llenos: sustituye una</div><div class="affrow">${eq.map((e, slot) => `<button class="mini" data-act="rune" data-op="take" data-id="${i}" data-slot="${slot}" ${tip(`Sustituir <b>${esc(RUNES[e]!.name)}</b> (va a la reserva si cabe)`)}>⟲ ${esc(RUNES[e]!.name)}</button>`).join('')}</div><button class="mini" data-act="rune" data-op="take" data-id="${i}" data-bag="1" ${(h.runeBag?.length ?? 0) >= RUNE_RESERVE ? 'disabled' : ''}>A la reserva (${h.runeBag?.length ?? 0}/${RUNE_RESERVE})</button>`
      : `<button class="pri" data-act="rune" data-op="take" data-id="${i}">Equipar</button>`;
    return `<div class="lootcard runecard rr${r.rarity}" style="--fam:${FAMILY_COLOR[r.family]}">${runeSheet(r, h)}${after.length ? after.map((sy) => `<div class="synnew" ${tip(synTip(sy, [...eq, id]))}><b>🔗 Al equiparla activas la sinergia ${esc(sy.name)}</b><div class="sm">${esc(sy.text)}</div></div>`).join('') : ''}${actions}</div>`;
  };
  const more = (h.runeOffers?.length ?? 1) - 1;
  const body = `<div class="panel loot boon runeoffer ${modal ? 'wide' : ''}"><div class="row"><h3>✧ ${esc(SOURCE_NAME[o.src])}${o.src === 'start' ? ': elige la runa con la que empiezas' : ': elige una'}</h3><span class="grow"></span>${more ? `<span class="pill sm">+${more} pendiente${more > 1 ? 's' : ''}</span>` : ''}${o.src === 'start' ? '' : '<button class="mini" data-act="rune" data-op="skip">Renunciar</button>'}</div>
  <div class="dim sm">Las runas valen para cualquier clase y modifican todas tus habilidades compatibles. Tienes ${RUNE_SLOTS} espacios; se pierden al terminar la expedición, pero el Grimorio rúnico recuerda lo descubierto.</div>
  <div class="cards c${Math.min(3, o.runes.length)}">${o.runes.map(card).join('')}</div></div>`;
  // fuera del combate se muestra encima de todo: es una decisión que no se puede pasar por alto
  return modal ? `<div class="modal runemodal">${body}</div>` : body;
}

// ---------- pestaña de runas de la expedición ----------
export function runesTab(h: HeroSave, canManage: boolean): string {
  const eq = h.runes ?? [], bag = h.runeBag ?? [];
  const [kind, key] = ui.selRune.split(':');
  const idx = Number(key);
  const selId = kind === 'eq' ? eq[idx] : kind === 'bag' ? bag[idx] : undefined;
  if (!selId) ui.selRune = '';
  const syn = activeSynergies(eq), near = nearSynergies(eq);
  const unit = heroSpec(h);
  const spells = unit.spells.filter((sp) => sp.charges === undefined).map((sp) => {
    const base = tuned(SPELLS[sp.id]!, sp), res = runeResult(base, eq), d = spellOf(unit, sp.id) ?? base;
    const on = res.traces.filter((t) => t.applied);
    const changed = on.length > 0;
    return `<div class="srow rspell ${res.mutated ? 'mut' : changed ? 'mod' : ''}" ${tip(`${spellTip(d)}${changed ? `<div class="sm dim">Original: ${esc(spellSummary(base))}</div><div class="sm good">Con runas: ${esc(spellSummary(d))}</div><ul class="sm">${on.map((t) => `<li><b>${esc(t.name)}</b>: ${esc(t.text)}</li>`).join('')}</ul>` : ''}`)}>${spellIcon(d)}<span class="grow">${esc(d.name)}${res.mutated ? ' <span class="badge mut">MUTADA</span>' : changed ? ` <span class="badge">✧ ${on.length}</span>` : ''}</span><span class="dim sm">${d.ap} PA</span></div>`;
  });
  const act = (label: string, attrs: string, pri = false): string => `<button class="mini ${pri ? 'pri' : ''}" ${attrs} ${canManage ? '' : 'disabled'}>${label}</button>`;
  let detail = '<div class="dim sm hint">Selecciona una runa para ver qué cambia en tus habilidades. Las runas no se pueden cambiar en combate.</div>';
  if (selId) {
    const r = RUNES[selId]!;
    const acts = kind === 'eq'
      ? `${act('Quitar (a la reserva)', `data-act="rune" data-op="unequip" data-slot="${idx}"`)}${eq.map((_, j) => (j === idx ? '' : act(`↔ Espacio ${j + 1}`, `data-act="rune" data-op="swap" data-slot="${idx}" data-to="${j}"`))).join('')}`
      : `${eq.length < RUNE_SLOTS ? act('Equipar', `data-act="rune" data-op="equip" data-id="${idx}"`, true) : ''}${eq.map((e, j) => {
          const next = eq.map((x, k) => (k === j ? selId : x));
          const gain = activeSynergies(next).filter((s) => !syn.some((x) => x.id === s.id)).map((s) => s.name), lose = syn.filter((s) => !activeSynergies(next).some((x) => x.id === s.id)).map((s) => s.name);
          return act(`⟲ ${esc(RUNES[e]!.name)}`, `data-act="rune" data-op="equip" data-id="${idx}" data-slot="${j}" ${tip(`<b>Sustituir ${esc(RUNES[e]!.name)}</b>${gain.length ? `<div class="sm good">Ganas: ${esc(gain.join(', '))}</div>` : ''}${lose.length ? `<div class="sm bad">Pierdes: ${esc(lose.join(', '))}</div>` : ''}${!gain.length && !lose.length ? '<div class="sm dim">Mismas sinergias</div>' : ''}`)}`);
        }).join('')}${act('Soltar', `data-act="rune" data-op="drop" data-id="${idx}"`)}`;
    detail = `<div class="detail">${runeSheet(r, h)}<div class="acts">${acts}</div></div>`;
  }
  return `<div class="lbl">Runas equipadas <span class="dim">${eq.length}/${RUNE_SLOTS}</span></div>
  <div class="runeslots">${Array.from({ length: RUNE_SLOTS }, (_, i) => `<div class="slotbox" ${canManage ? `data-drop="req:${i}"` : ''}>${runeStone(eq[i], eq[i] ? `data-act="selrune" data-id="eq:${i}"${canManage ? ` data-drag="req:${i}"` : ''}` : '', false, ui.selRune === `eq:${i}`)}<small>${eq[i] ? esc(RUNES[eq[i]!]!.name) : `Espacio ${i + 1}`}</small></div>`).join('')}</div>
  <div class="lbl">Reserva <span class="dim">${bag.length}/${RUNE_RESERVE}</span></div>
  ${canManage ? '<div class="dim sm">Arrastra una runa entre la reserva y tus espacios: si el hueco está ocupado, se intercambian.</div>' : ''}
  <div class="runeslots small">${Array.from({ length: RUNE_RESERVE }, (_, i) => `<div class="slotbox" ${canManage ? `data-drop="rbag:${i}"` : ''}>${runeStone(bag[i], bag[i] ? `data-act="selrune" data-id="bag:${i}"${canManage ? ` data-drag="rbag:${i}"` : ''}` : '', false, ui.selRune === `bag:${i}`)}</div>`).join('')}</div>
  <div class="lbl">Familias</div>
  <div class="famrow">${FAMILIES.map((f) => { const n = eq.filter((id) => RUNES[id]?.family === f).length; return `<span class="fam ${n ? 'on' : ''}" style="--fam:${FAMILY_COLOR[f]}" ${tip(`${FAMILY_NAME[f]}: ${n} runa${n === 1 ? '' : 's'}`)}>${FAMILY_ICON[f]} ${n}</span>`; }).join('')}</div>
  <div class="lbl">Sinergias activas <span class="dim">${syn.length}</span></div>
  ${syn.length ? syn.map((s) => `<div class="syn on" ${tip(synTip(s, eq))}>🔗 <b>${esc(s.name)}</b> <span class="dim sm">${famWords(s)}</span><div class="sm">${esc(s.text)}</div></div>`).join('') : '<div class="dim sm">Combina runas de dos familias distintas para activar una sinergia (un efecto extra que no ocupa espacio).</div>'}
  ${near.length ? `<div class="sm dim">A una runa de activar: ${near.slice(0, 4).map((n) => `<span ${tip(synTip(n.syn, eq))}>${FAMILY_ICON[n.missing]} ${synLink(n.syn, eq)}</span>`).join(' · ')} <span class="dim">(pasa el ratón para ver qué hacen)</span></div>` : ''}
  ${detail}
  <div class="lbl">Tus habilidades con runas</div>
  <div class="spells">${spells.join('')}</div>`;
}

// ---------- Grimorio rúnico (Archivo del Refugio) ----------
const KINDS = Object.keys(KIND_NAME) as RuneKind[];
export function runeArchivePanel(header: string): string {
  const rows = new Map(entriesOf('runes').map((r) => [r.id, r]));
  const synRows = new Map(entriesOf('synergies').map((r) => [r.id, r]));
  const f = ui.runeF;
  // lo no descubierto no revela su familia, rareza ni tipo: con un filtro activo, solo salen las descubiertas
  const pass = (r: RuneDef): boolean => (!(f.fam || f.rar || f.kind) || (rows.get(r.id)?.lv ?? 0) > 0) && (!f.fam || r.family === f.fam) && (!f.rar || r.rarity === Number(f.rar)) && (!f.kind || r.kind === f.kind)
    && (ui.arcFilter === 'all' || (ui.arcFilter === 'found') === ((rows.get(r.id)?.lv ?? 0) > 0));
  const btn = (k: 'fam' | 'rar' | 'kind', v: string, label: string): string => `<button class="mini ${f[k] === v ? 'on' : ''}" data-act="runef" data-id="${k}:${v}">${label}</button>`;
  const filters = `<div class="row sm wrap">${btn('fam', '', 'Todas')}${FAMILIES.map((x) => btn('fam', x, `${FAMILY_ICON[x]} ${FAMILY_NAME[x]}`)).join('')}</div>
  <div class="row sm wrap">${btn('rar', '', 'Toda rareza')}${([1, 2, 3, 4, 5] as const).map((x) => btn('rar', String(x), RARITY_NAME[x])).join('')}</div>
  <div class="row sm wrap">${btn('kind', '', 'Todo efecto')}${KINDS.map((x) => btn('kind', x, KIND_NAME[x])).join('')}</div>`;
  const cards = RUNE_LIST.filter(pass).map((r) => {
    const e = rows.get(r.id), on = (e?.lv ?? 0) > 0, open = ui.arcOpen === `runes:${r.id}`;
    if (!on) return `<div class="lootcard off runecard" data-act="arcopen" data-id="runes:${r.id}"><div class="row">${runeStone(undefined)}<div class="grow"><b>???</b><div class="pill sm">🔒 Por descubrir</div></div></div><div class="sm dim">${r.boss ? 'La guarda un jefe del Abismo.' : r.final ? 'Solo quien cierra el Abismo la verá.' : 'Una runa que aún no has encontrado.'}</div></div>`;
    return `<div class="lootcard runecard rr${r.rarity}" style="--fam:${FAMILY_COLOR[r.family]}" data-act="arcopen" data-id="runes:${r.id}">${open ? runeSheet(r) : `<div class="row">${runeStone(r.id, 'tabindex="-1"')}<div class="grow"><b>${esc(r.name)}</b><div class="pill sm">${e!.lv >= 2 ? '✔ Utilizada' : 'Descubierta'} · ${RARITY_NAME[r.rarity]}</div></div></div><div class="sm">${esc(r.text)}</div>`}</div>`;
  });
  const syns = SYNERGY_LIST.map((s) => {
    const on = (synRows.get(s.id)?.lv ?? 0) > 0;
    return `<div class="syn ${on ? 'on' : 'off'}">${s.families.map((x) => FAMILY_ICON[x]).join('')} <b>${on ? esc(s.name) : '???'}</b><div class="sm ${on ? '' : 'dim'}">${on ? esc(s.text) : `Activa ${s.families.map((x) => FAMILY_NAME[x]).join(' + ')} a la vez para descubrirla.`}</div></div>`;
  });
  const cr = completion('runes'), cs = completion('synergies');
  const stFilters = ([['all', 'Todo'], ['found', 'Descubierto'], ['missing', 'Sin descubrir']] as const).map(([k, n]) => `<button class="mini ${ui.arcFilter === k ? 'on' : ''}" data-act="arcfilter" data-id="${k}">${n}</button>`).join('');
  return `${header}<div class="row sm"><span class="dim">Runas: ${cr.found}/${cr.total} · Sinergias: ${cs.found}/${cs.total}</span><span class="grow"></span>${stFilters}</div>${filters}
  <div class="cards c3">${cards.join('') || '<div class="dim sm">Nada con este filtro.</div>'}</div>
  <div class="lbl">Sinergias de familia</div><div class="cards c3">${syns.join('')}</div>
  <div class="lbl">Estados alterados</div><div class="chips">${(Object.keys(STATUSES) as StatusKind[]).filter((k) => k !== 'fading').map(statusChip).join('')}</div></div>`;
}
export { SYNERGIES };
