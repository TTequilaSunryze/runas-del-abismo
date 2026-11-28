// Registro del grupo: lo que consigue o cambia cada jugador durante la expedición (runas, bendiciones, mejoras de hechizo,
// hechizos nuevos, objetos equipados y niveles). Se calcula comparando el estado de la partida que ya reciben todos los
// clientes, así funciona igual en cooperativo sin tocar la red ni el guardado (solo lectura; nada de esto se guarda).
import { SPELLS } from '../core/classes/spells';
import { BLESSINGS, BOON_MODS } from '../core/boonmods';
import { RARITY_NAME as ITEM_RARITY, SLOT_NAME, type Item } from '../core/items/items';
import { RARITY_NAME, RUNES } from '../core/runes';
import { UPGRADES } from '../core/upgrades';
import type { HeroSave, RunState } from '../game/run';
import { esc, tip, ui } from './ctx';
import { itemHtml } from './panels';
import { runeTip } from './runes';

interface Snap { level: number; runes: string[]; bag: string[]; boons: string[]; ups: Record<string, string[]>; equip: Record<string, string> }
const ITEM_CLS = ['ir0', 'ir1', 'ir2', 'ir3'];

let runCode = '';
let snaps = new Map<string, Snap>();

const itemKey = (it: Item): string => `${it.name}|${it.rarity}`;
const snapOf = (h: HeroSave): Snap => ({
  level: h.level, runes: [...(h.runes ?? [])], bag: [...(h.runeBag ?? [])], boons: [...h.boons],
  ups: Object.fromEntries(Object.entries(h.ups ?? {}).map(([k, v]) => [k, [...v]])),
  equip: Object.fromEntries(Object.entries(h.equip).filter(([, it]) => it).map(([k, it]) => [k, itemKey(it as Item)])),
});
/** Elementos de `b` que no estaban en `a` (respetando repeticiones). */
function added(a: readonly string[], b: readonly string[]): string[] {
  const left = [...a], out: string[] = [];
  for (const x of b) { const i = left.indexOf(x); if (i >= 0) left.splice(i, 1); else out.push(x); }
  return out;
}

function push(html: string): void {
  ui.glog.push({ at: Date.now(), k: 'g', html });
  ui.glog.splice(0, Math.max(0, ui.glog.length - 120));
}

/** Nombre del jugador con su color de grupo (y «tú» si es el propio). */
function who(run: RunState, h: HeroSave): string {
  const i = run.heroes.indexOf(h);
  return `<b class="p${i % 4}">${esc(h.name)}</b>${h.owner === ui.myId ? ' <span class="dim">(tú)</span>' : ''}`;
}
const runeName = (id: string): string => {
  const r = RUNES[id];
  return r ? `<span class="rr${r.rarity}t" ${tip(runeTip(r))}>${esc(r.name)}</span> <span class="dim sm">(${RARITY_NAME[r.rarity]})</span>` : esc(id);
};

/** Compara la partida con la última vista y anota en el registro del grupo lo que ha cambiado en cada héroe. */
export function trackGroup(run: RunState | null | undefined): void {
  if (!run || run.arena) return;
  // partida nueva: se toma la foto inicial sin anotar nada
  if (run.code !== runCode) { runCode = run.code; snaps = new Map(run.heroes.map((h) => [h.owner, snapOf(h)])); ui.glog.length = 0; return; }
  for (const h of run.heroes) {
    const was = snaps.get(h.owner), now = snapOf(h);
    snaps.set(h.owner, now);
    if (!was) continue;
    const name = who(run, h);
    if (now.level > was.level) push(`<div class="lg lvl">⬆ ${name} sube a <b>nivel ${now.level}</b></div>`);
    // runas: equipadas, a la reserva, de la reserva al espacio, soltadas
    const eqIn = added(was.runes, now.runes), eqOut = added(now.runes, was.runes);
    const bagIn = added(was.bag, now.bag), bagOut = added(now.bag, was.bag);
    for (const id of eqIn) push(`<div class="lg rune">✧ ${name} ${bagOut.includes(id) ? 'pasa de la reserva a sus runas' : 'equipa la runa'} ${runeName(id)}</div>`);
    for (const id of bagIn) if (!eqOut.includes(id)) push(`<div class="lg rune">✧ ${name} guarda en la reserva ${runeName(id)}</div>`);
    for (const id of eqOut) if (!bagIn.includes(id)) push(`<div class="lg rune dim">✧ ${name} se deshace de ${runeName(id)}</div>`);
    for (const id of bagOut) if (!eqIn.includes(id)) push(`<div class="lg rune dim">✧ ${name} suelta ${runeName(id)}</div>`);
    // bendiciones de clase, mejoras de bendición y hechizos nuevos
    for (const b of added(was.boons, now.boons)) {
      const bl = BLESSINGS[b], mod = BOON_MODS[b], sp = SPELLS[b];
      if (bl) push(`<div class="lg boon">🌟 ${name} recibe la bendición <b class="gold" ${tip(`<b>${esc(bl.name)}</b><div class="sm">${esc(bl.text)}</div>`)}>${esc(bl.name)}</b></div>`);
      else if (mod) push(`<div class="lg up">🔧 ${name} mejora <b>${esc(SPELLS[mod.target]?.name ?? mod.target)}</b>: <span class="good" ${tip(`<b>${esc(mod.name)}</b><div class="sm">${esc(mod.text)}</div>`)}>${esc(mod.name)}</span></div>`);
      else if (sp) push(`<div class="lg spell">📖 ${name} aprende <b class="good" ${tip(`<b>${esc(sp.name)}</b><div class="sm">${esc(sp.text)}</div>`)}>${esc(sp.name)}</b></div>`);
    }
    // mejoras de hechizo (Santuario, Forja, jefes)
    for (const [spell, list] of Object.entries(now.ups)) for (const up of added(was.ups[spell] ?? [], list)) {
      const g = UPGRADES[up] ?? BOON_MODS[up];
      push(`<div class="lg up">🔧 ${name} mejora <b>${esc(SPELLS[spell]?.name ?? spell)}</b>: <span class="good" ${tip(`<b>${esc(g?.name ?? up)}</b><div class="sm">${esc(g?.text ?? '')}</div>`)}>${esc(g?.name ?? up)}</span></div>`);
    }
    // objetos equipados
    for (const [slot, key] of Object.entries(now.equip)) {
      if (was.equip[slot] === key) continue;
      const it = h.equip[slot as keyof HeroSave['equip']];
      if (!it) continue;
      push(`<div class="lg item">🎒 ${name} equipa <b class="${ITEM_CLS[it.rarity]}" ${tip(itemHtml(it, true))}>${esc(it.name)}</b> <span class="dim sm">(${esc(SLOT_NAME[it.slot])} · ${ITEM_RARITY[it.rarity]})</span></div>`);
    }
  }
}
