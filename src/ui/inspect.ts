// Ficha de unidad en combate (clic en una miniatura del orden de turnos o en el tablero) y explicación de los estados.
// Todo sale del catálogo único de estados (core/statuses) y del estado del combate: aquí no se decide nada del juego.
import { DOOM_PCT, DOT, REGEN_PER, RESONANCE_AT, RESONANCE_DMG, STATUSES } from '../core/statuses';
import { essenceNeed, furyCrit, furyPower, spellOf } from '../core/combat/engine';
import { RUNES } from '../core/runes';
import type { CombatState, StatusKind, Unit } from '../core/state';
import { unitThumbUrl } from '../render/board';
import { lookOf } from '../render/looks';
import { lookKind, unitPortraitUrl } from '../render/sprites';
import { esc, tip, ui } from './ctx';
import { statusGi } from './gameicons';
import { spellIcon, spellTip } from './icons';

/** Rasgos de los enemigos, en palabras (los ids son los del motor). */
export const TRAIT_TEXT: Record<string, string> = {
  incansable: 'Pegado a un enemigo al empezar el turno: +1 PM.', viuda: 'Si cae un aliado: +2 de daño.', espina: 'Sus golpes envenenan.', esporas: 'Quien le golpea cuerpo a cuerpo queda ralentizado.', alfa: 'Sus críticos le curan 4.', egida: 'El primer golpe de cada ronda le hace 6 menos.', pavesa: 'Quema a los enemigos pegados al empezar su turno.', volcan: 'Los enemigos que remata estallan.', primera: 'Su primer hechizo del turno cuesta 1 PA menos.', devorador: 'Rematar le cura el 5%.', lagrima: 'Una vez, al bajar del 30% se cura el 25%.', entremundos: 'El placaje no le afecta.',
  bomb: 'Explota al morir: daña a todo lo que tenga pegado.', split: 'Al morir se divide en dos copias menores.', regen: 'Recupera el 8% de su vida cada turno.', thorns: 'Devuelve el 30% del daño cuerpo a cuerpo.', enrage: '+40% de daño por debajo de la mitad de vida.', trapper: 'Esconde cepos junto a los héroes.', blink: 'Aparece junto a su presa más frágil.',
  venom: 'Sus venenos aplican una carga más.', ignite: 'Su daño quema.', execute: 'Sus críticos hacen el doble.', mender: 'Cura y protege un 30% más.',
  puddle: 'Al morir deja un charco que inmoviliza.', guard: 'Empieza su turno con escudo (15% de su vida, máx. 24).', devour: 'Se cura devorando cadáveres.',
  raise: 'Alza a los muertos como aliados.', ghost: 'Atraviesa obstáculos.', hunter: 'Persigue al héroe más frágil.', pack: 'Más daño por cada compañero de manada.',
};

/** Miniatura con la apariencia actual (retrato ilustrado o fotograma de su hoja); si no hay arte nuevo, el retrato dibujado. */
export function unitThumb(u: Unit, heroIdx = 0): string {
  const look = u.team === 'hero' && u.summoner === undefined ? lookOf(u.owner) : undefined;
  return unitThumbUrl(u) ?? unitPortraitUrl(lookKind(u), u.team, u.team === 'hero' ? heroIdx % 4 : 0, look?.cls === u.kind ? look.skin : undefined);
}

/** Daño (o curación) que un estado hará al empezar el turno de quien lo lleva, con la cuenta en palabras. */
export function statusTick(u: Pick<Unit, 'statuses'>, kind: StatusKind): { dmg: number; heal: number; why: string } | null {
  const v = u.statuses[kind];
  if (!v) return null;
  const n = Math.max(1, v.stacks);
  if (kind === 'burn') { const d = DOT.burn + DOT.burnPerStack * (n - 1); return { dmg: d, heal: 0, why: `${DOT.burn}${n > 1 ? ` + ${DOT.burnPerStack} × ${n - 1} cargas extra` : ''} de fuego` }; }
  if (kind === 'poison') { const k = u.statuses.corrupt ? 1.5 : 1; return { dmg: Math.round(DOT.poison * n * k), heal: 0, why: `${DOT.poison} × ${n} carga${n > 1 ? 's' : ''}${k > 1 ? ' × 1,5 por Corrupción' : ''}` }; }
  if (kind === 'bleed') return { dmg: DOT.bleed * n, heal: 0, why: `${DOT.bleed} × ${n} carga${n > 1 ? 's' : ''}, ignora la armadura` };
  if (kind === 'regen') return { dmg: 0, heal: REGEN_PER * n, why: `${REGEN_PER} × ${n} carga${n > 1 ? 's' : ''}` };
  return null;
}

/** Lo que hace ahora mismo un estado concreto en esta unidad (cifras reales: cargas, lo guardado, lo que falta…). */
function statusNow(u: Unit, kind: StatusKind): string {
  const v = u.statuses[kind]!;
  const t = statusTick(u, kind);
  if (t?.dmg) return `Al empezar su turno recibirá <b class="bad">${t.dmg}</b> de daño (${esc(t.why)}).`;
  if (t?.heal) return `Al empezar su turno recuperará <b class="good">${t.heal}</b> de vida (${esc(t.why)}).`;
  if (kind === 'doom') return `Guarda <b class="bad">${v.stacks}</b> de daño (el ${DOOM_PCT * 100}% de lo que recibe). Cuando se acabe${v.turns <= 1 ? ', al empezar su próximo turno,' : ` (en ${v.turns} turnos)`} lo recibirá todo de golpe.`;
  if (kind === 'deathmark') return `Guarda <b class="bad">${v.stacks}</b> de daño: estalla al final del turno del Acechador que la puso.`;
  if (kind === 'resonance') return `${v.stacks}/${RESONANCE_AT} cargas: al llegar a ${RESONANCE_AT} estalla por ${RESONANCE_DMG * RESONANCE_AT} (${RESONANCE_DMG} por carga) y la mitad a sus vecinos.`;
  if (kind === 'exposed') return `Pierde ${v.stacks} de armadura.`;
  if (kind === 'slow') return `Empezará su turno con ${v.stacks} PM menos.`;
  if (kind === 'chill') return `Lleva ${v.stacks} de 3 cargas.`;
  if (kind === 'ward') return `Bloqueará los próximos ${v.stacks} estados negativos.`;
  if (kind === 'haste') return `Empezará su turno con +1 PA y +${v.stacks} PM.`;
  return '';
}

/** Tooltip de un estado: qué es, qué hace, cuánto dura y (si se pasa la unidad) qué le va a hacer ahora. */
export function statusTipHtml(kind: string, turns?: number, stacks?: number, u?: Unit): string {
  const s = STATUSES[kind as StatusKind];
  if (!s) return esc(kind);
  const boss = u && (u.rank === 'elite' || u.rank === 'boss' || u.ai === 'boss');
  const now = u?.statuses[kind as StatusKind] ? statusNow(u, kind as StatusKind) : '';
  return `<div class="row">${statusGi(kind, s.icon)} <b style="color:${s.color}">${esc(s.name)}</b><span class="grow"></span><span class="dim sm">${s.negative ? 'perjudicial' : 'beneficioso'}</span></div>
    <div class="sm">${esc(s.text)}</div>
    ${turns !== undefined ? `<div class="sm">⏳ Dura <b>${turns}</b> turno${turns === 1 ? '' : 's'} más${stacks && stacks > 1 && s.stack === 'add' ? ` · ${stacks} cargas` : ''}.</div>` : ''}
    ${now ? `<div class="sm">${now}</div>` : ''}
    ${s.rankText && (boss || !u) ? `<div class="sm dim">${esc(s.rankText)}</div>` : ''}`;
}

/** Estado en una línea (icono, nombre, cargas y turnos) con su explicación al pasar el ratón. */
export function statusChipHtml(kind: string, turns: number, stacks: number, u?: Unit): string {
  const s = STATUSES[kind as StatusKind];
  return `<span class="stline" style="--st:${s?.color ?? '#ccc'}" ${tip(statusTipHtml(kind, turns, stacks, u))}>${statusGi(kind, s?.icon ?? '•')}<b>${esc(s?.name ?? kind)}</b>${stacks > 1 && s?.stack === 'add' ? `<i>×${stacks}</i>` : ''}<small>${turns}t</small></span>`;
}

/** Previsión del inicio de turno: todo el daño y la curación que le harán sus estados, con el porqué. */
export function turnForecast(u: Unit): string {
  const parts = (['burn', 'poison', 'bleed', 'regen'] as StatusKind[]).map((k) => ({ k, t: statusTick(u, k) })).filter((x) => x.t);
  const dmg = parts.reduce((a, x) => a + x.t!.dmg, 0), heal = parts.reduce((a, x) => a + x.t!.heal, 0);
  const doom = u.statuses.doom && u.statuses.doom.turns <= 1 ? u.statuses.doom.stacks : 0;
  if (!dmg && !heal && !doom) return '';
  const rows = parts.map(({ k, t }) => `<li>${statusGi(k)} ${esc(STATUSES[k].name)}: ${t!.dmg ? `<b class="bad">−${t!.dmg}</b>` : `<b class="good">+${t!.heal}</b>`} <span class="dim">(${esc(t!.why)})</span></li>`);
  if (doom) rows.push(`<li>${statusGi('doom')} Condena: <b class="bad">−${doom}</b> <span class="dim">(se cumple: recibe lo guardado)</span></li>`);
  const total = dmg + doom;
  return `<div class="fcast"><b>Al empezar su turno:</b> ${total ? `<b class="bad">−${total}</b> de daño` : ''}${total && heal ? ' · ' : ''}${heal ? `<b class="good">+${heal}</b> de vida` : ''}${total >= u.hp ? ' <b class="bad">· ¡no lo aguantará!</b>' : ''}<ul>${rows.join('')}</ul></div>`;
}

/**
 * Ficha completa de una unidad: retrato, vida, recursos, estados con su explicación y previsión, rasgos, habilidades
 * y (héroes) runas equipadas. Sirve para aliados, enemigos, uno mismo y cadáveres.
 */
export function unitSheet(c: CombatState, u: Unit, heroIdx: number): string {
  const run = ui.session?.run;
  const alive = u.hp > 0;
  const tot = Math.max(u.maxHp, u.hp + u.shield);
  const pct = Math.max(0, Math.min(100, (u.hp / tot) * 100)), spct = (u.shield / tot) * 100;
  const kind = u.ai === 'boss' || u.rank === 'boss' ? '👑 Jefe' : u.rank === 'elite' ? '☠ Élite' : u.team === 'hero' ? (u.summoner !== undefined ? 'Invocación aliada' : u.owner === ui.myId ? 'Tú' : 'Aliado') : u.summoner !== undefined ? 'Invocación enemiga' : 'Enemigo';
  const sts = Object.entries(u.statuses).filter(([, v]) => v) as Array<[StatusKind, { turns: number; stacks: number }]>;
  const spells = u.spells.filter((sp) => sp.charges === undefined && !sp.temp).map((sp) => spellOf(u, sp.id)).filter((d): d is NonNullable<typeof d> => !!d);
  const res: string[] = [];
  if (u.fury !== undefined) res.push(`🔥 Furia ${u.fury}/100 (+${furyPower(u)} daño, +${furyCrit(u)}% crít.)`);
  if (u.essence !== undefined) res.push(`🦊 Esencia ${u.essence}/${essenceNeed(u)}`);
  if (u.souls !== undefined) res.push(`💀 ${u.souls} almas (${u.soulBank ?? 0} para gastar)`);
  if (u.magazine !== undefined) res.push(`🔫 Cargador ${u.magazine}`);
  const hero = u.team === 'hero' && u.summoner === undefined ? run?.heroes.find((h) => h.owner === u.owner) : undefined;
  const runes = hero?.runes ?? [];
  return `<div class="uhead"><img class="uport ${u.team}" src="${unitThumb(u, heroIdx)}" alt=""><div class="grow"><b class="uname ${u.team === 'hero' ? 'lh' : 'le'}">${esc(u.name)}</b><div class="dim sm">${kind}${alive ? '' : ' · <span class="bad">caído</span>'}</div></div><button class="sq" data-act="uinspect" data-id="" ${tip('Cerrar')}>✕</button></div>
  <div class="ubar"><i style="width:${pct}%"></i>${u.shield ? `<s style="left:${pct}%;width:${spct}%"></s>` : ''}<b>${u.hp}/${u.maxHp}${u.shield ? ` · 🛡 ${u.shield}` : ''}</b></div>
  <div class="ustats sm"><span class="lap" ${tip('Puntos de acción')}>${u.ap} PA</span><span class="lmp" ${tip('Puntos de movimiento')}>${u.mp} PM</span><span ${tip('Armadura: resta daño a cada golpe')}>🛡 ${Math.max(0, Math.floor(u.armor) - (u.statuses.exposed?.stacks ?? 0))}</span><span ${tip('Iniciativa: orden en la ronda')}>⚡ ${u.initiative}</span>${u.tackle ? `<span ${tip('Placaje: retiene a quien se aleja de su lado')}>⛓ ${u.tackle}</span>` : ''}</div>
  ${res.length ? `<div class="sm">${res.join(' · ')}</div>` : ''}
  <div class="lbl">Estados <span class="dim">${sts.length}</span></div>
  ${sts.length ? `<div class="ustlist">${sts.map(([k, v]) => `<div class="ust" style="--st:${STATUSES[k]?.color ?? '#ccc'}">${statusGi(k, STATUSES[k]?.icon ?? '•', 'big')}<div><b>${esc(STATUSES[k]?.name ?? k)}</b>${v.stacks > 1 && STATUSES[k]?.stack === 'add' ? ` <i>×${v.stacks}</i>` : ''} <span class="dim sm">· ${v.turns} turno${v.turns === 1 ? '' : 's'}</span><div class="sm">${esc(STATUSES[k]?.text ?? '')}</div>${alive ? `<div class="sm">${statusNow(u, k)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="dim sm">Sin estados.</div>'}
  ${alive ? turnForecast(u) : ''}
  ${(u.traits ?? []).some((t) => TRAIT_TEXT[t]) ? `<div class="lbl">Rasgos</div>${(u.traits ?? []).filter((t) => TRAIT_TEXT[t]).map((t) => `<div class="sm">· ${esc(TRAIT_TEXT[t]!)}</div>`).join('')}` : ''}
  ${spells.length ? `<div class="lbl">Habilidades</div><div class="uspells">${spells.map((d) => `<span ${tip(spellTip(d))}>${spellIcon(d, false)}</span>`).join('')}</div>` : ''}
  ${runes.length ? `<div class="lbl">Runas</div><div class="sm">${runes.map((id) => RUNES[id] ? `<span class="rr${RUNES[id]!.rarity}t" ${tip(`<b>${esc(RUNES[id]!.name)}</b><div class="sm">${esc(RUNES[id]!.text)}</div>`)}>${esc(RUNES[id]!.name)}</span>` : '').join(' · ')}</div>` : ''}
  ${c.round >= 30 && alive ? `<div class="sm bad">☠ Muerte súbita: el Abismo le quitará el ${5 * (c.round - 29)}% de su vida máxima al empezar su turno.</div>` : ''}`;
}
