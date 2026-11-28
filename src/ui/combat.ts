// Pantalla de combate: tablero, orden de iniciativa, barra de hechizos y registro.
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import { allRooms, isTraining, labOn, labSceneOf, labSetupOf, type LabCheat, type LabSetup } from '../game/run';
import { MAX_LEVEL } from '../core/classes/classes';
import { ENEMIES } from '../content/enemies';
import { ZONES } from '../content/zones';
import { ZONE_SHORT } from '../game/salas';
import { enemyOptions } from './editor';
import { canRooms, isCreatorAccount } from '../game/meta';
import type { ClassId } from '../core/state';
import { SPELLS } from '../core/classes/spells';
import { MAG_MAX, SOULS_PER_ARMOR, SOUL_ARMOR, apCost, current, essenceNeed, furyCrit, furyPower, getUnit, scytheBonus, spellOf, usableMp } from '../core/combat/engine';
import { marksOf } from '../core/combat/marks';
import type { CombatState, Unit } from '../core/state';
import { OMENS } from '../content/modes';
import type { GameEvent } from '../core/state';
import { Board, STATUS_NAME } from '../render/board';
import { esc, store, tip, ui, type LogEntry } from './ctx';
import { statusGi } from './gameicons';
import { TRAIT_TEXT, statusChipHtml, statusTipHtml, unitSheet, unitThumb } from './inspect';
import { STATUSES } from '../core/statuses';
import type { StatusKind } from '../core/state';
import { spellIcon, spellTip } from './icons';
import { blessingBar, escofinas, sysButtons } from './panels';

/** Registro de combate: quién lanza qué, a quién golpea, cuánto daño y qué efectos deja (con colores y detalle al pasar el ratón). */
export function addLog(events: GameEvent[]): void {
  const c = ui.session?.run?.combat;
  if (!c) return;
  const n = (id: number): string => { const u = getUnit(c, id); return `<b class="${u?.team === 'hero' ? 'lh' : 'le'}" data-act="uinspect" data-id="${id}">${esc(u?.name ?? '?')}</b>`; };
  const at = Date.now();
  for (const e of events) {
    let s = '';
    if (e.t === 'turn') s = `<div class="lturn">— Turno de ${n(e.unit)} · ronda ${e.round} —</div>`;
    else if (e.t === 'cast') { const d = SPELLS[e.spell]; const echo = e.echo; s = `<div class="lcast ${echo ? 'lecho' : ''}" ${d ? tip(spellTip(d)) : ''}>${d ? spellIcon(d, false) : '✦'}<span>${n(e.unit)} ${echo ? 'repite (eco rúnico)' : 'lanza'} <b class="lsp">${esc(d?.name ?? e.spell)}</b></span></div>`; }
    else if (e.t === 'damage') {
      const src = e.source && !SPELLS[e.source] && e.source !== 'melee' ? (SOURCE_NAME[e.source] ?? e.source) : '';
      const detail = `<b>${e.amount} de daño</b>${e.crit ? ' · crítico' : ''}${e.absorbed ? `<div class="sm">${e.absorbed} los absorbió el escudo</div>` : ''}${src ? `<div class="sm">Origen: ${esc(src)}</div>` : ''}${e.source && STATUS_OF_SOURCE[e.source] ? `<div class="sm dim">${esc(STATUSES[STATUS_OF_SOURCE[e.source]!]!.text)}</div>` : ''}`;
      s = `<div class="lfx ${e.crit ? 'kcrit' : 'kdmg'}" ${tip(detail)}>↳ ${n(e.unit)} <b class="ldmg">−${e.amount} PV</b>${e.crit ? ' <span class="lcrit">¡crítico!</span>' : ''}${e.absorbed ? ` <span class="lsh">(${e.absorbed} al escudo)</span>` : ''}${src ? ` <span class="dim">· ${e.source && STATUS_OF_SOURCE[e.source] ? statusGi(STATUS_OF_SOURCE[e.source]!) : ''}${esc(src)}</span>` : ''}</div>`;
    }
    else if (e.t === 'heal') s = `<div class="lfx kheal">↳ ${n(e.unit)} <b class="lheal">+${e.amount} PV</b></div>`;
    else if (e.t === 'shield') s = `<div class="lfx kshield">↳ ${n(e.unit)} <b class="lsh">+${e.amount} escudo</b></div>`;
    else if (e.t === 'status') { const st = STATUSES[e.kind]; const u = getUnit(c, e.unit); s = `<div class="lfx kst" style="--st:${st?.color ?? '#c9a0ff'}" ${tip(statusTipHtml(e.kind, e.turns, u?.statuses[e.kind]?.stacks ?? 1, u))}>↳ ${n(e.unit)}: ${statusGi(e.kind, st?.icon ?? '')}<span class="lst">${esc(STATUS_NAME[e.kind] ?? e.kind)}</span> <span class="dim">(${e.turns} t.)</span> <span class="lwhy">${esc(shortRule(e.kind))}</span></div>`; }
    else if (e.t === 'push') s = `<div class="lfx">↳ ${n(e.unit)} es desplazado</div>`;
    else if (e.t === 'skip') s = `<div class="lfx kctl">↳ ${n(e.unit)} pierde el turno</div>`;
    else if (e.t === 'death') s = `<div class="ldeath">✝ ${n(e.unit)} cae</div>`;
    else if (e.t === 'summon') s = `<div class="lfx bad">✦ Aparece ${n(e.unit)}</div>`;
    else if (e.t === 'trap') s = `<div class="lfx">↳ ${n(e.unit)} pisa unas púas</div>`;
    else if (e.t === 'explode') s = `<div class="lfx bad">💥 ${n(e.unit)} explota</div>`;
    else if (e.t === 'split') s = `<div class="lfx bad">${n(e.unit)} se divide</div>`;
    else if (e.t === 'blink') s = `<div class="lfx bad">${n(e.unit)} aparece de las sombras</div>`;
    else if (e.t === 'snare') s = `<div class="lfx kctl">↳ ${n(e.unit)} cae en un cepo</div>`;
    else if (e.t === 'drain' && (e.ap < 0 || e.mp < 0)) s = `<div class="lfx kctl">↳ ${n(e.unit)} pierde ${[e.ap ? `<b class="lap">${-e.ap} PA</b>` : '', e.mp ? `<b class="lmp">${-e.mp} PM</b>` : ''].filter(Boolean).join(' y ')}</div>`;
    else if (e.t === 'drain' && (e.ap > 0 || e.mp > 0)) s = `<div class="lfx">↳ ${n(e.unit)} gana ${[e.ap ? `<b class="lap">${e.ap} PA</b>` : '', e.mp ? `<b class="lmp">${e.mp} PM</b>` : ''].filter(Boolean).join(' y ')}</div>`;
    else if (e.t === 'resist') s = `<div class="lfx">↳ ${n(e.unit)}: ${esc(e.what)}</div>`;
    else if (e.t === 'tackle') s = `<div class="lfx kctl" ${tip('Placaje: al alejarse de un enemigo pegado se pierden PM según la Huida propia y el Placaje del enemigo.')}>↳ ${n(e.unit)} queda placado y pierde <b class="lmp">${e.lost} PM</b></div>`;
    else if (e.t === 'revive') s = `<div class="lfx lheal">${n(e.unit)} vuelve a la vida</div>`;
    else if (e.t === 'stuck') s = `<div class="lfx">↳ ${n(e.unit)} queda atrapado en el charco</div>`;
    else if (e.t === 'devour') s = `<div class="lfx bad">${n(e.unit)} devora un cadáver</div>`;
    else if (e.t === 'raise') s = `<div class="lfx bad">${n(e.unit)} alza a un muerto</div>`;
    else if (e.t === 'soul') s = `<div class="lfx">💀 ${n(e.unit)} cosecha un alma${e.armor ? ` (+${e.armor} armadura)` : ''}</div>`;
    else if (e.t === 'caged') s = `<div class="lfx">↳ ${n(e.unit)} choca con la caja</div>`;
    else if (e.t === 'detonate') s = `<div class="lfx">💥 ${n(e.unit)} detona ${e.amount}</div>`;
    else if (e.t === 'note') s = `<div class="lfx lnote ${/runa|Eco|eco|sinergia|Condena/i.test(e.text) ? 'krune' : ''}">${esc(e.text)}</div>`;
    else if (e.t === 'phase') s = `<div class="lturn bad">¡Segunda fase: ${n(e.unit)}!</div>`;
    else if (e.t === 'bossEnter') s = `<div class="lturn bad">👑 ¡${n(e.unit)} entra en combate!</div>`;
    else if (e.t === 'over') s = `<div class="lturn"><b>${e.result === 'win' ? '¡Victoria!' : 'Derrota'}</b></div>`;
    if (s) ui.log.push({ at, k: 'c', html: s });
    if (e.t === 'cast') { const d = SPELLS[e.spell]; const u = getUnit(c, e.unit); if (d && u) ui.toast = { text: `${esc(u.name)} · ${esc(d.name)}${e.echo ? ' (eco)' : ''}`, team: u.team, at: Date.now() }; }
  }
  ui.log.splice(0, Math.max(0, ui.log.length - 200));
}

/** Fuentes de daño que son un estado (para explicar de dónde sale ese daño). */
const STATUS_OF_SOURCE: Record<string, StatusKind> = { burn: 'burn', poison: 'poison', bleed: 'bleed', condena: 'doom', marca: 'deathmark' };
/** La regla del estado en pocas palabras, para el propio registro (el detalle completo va en el tooltip). */
function shortRule(kind: StatusKind): string {
  const t = STATUSES[kind]?.text ?? '';
  const first = t.split(/(?<=\.)\s/)[0] ?? t;
  return first.length > 70 ? `${first.slice(0, 68)}…` : first;
}

const SOURCE_NAME: Record<string, string> = { charm: 'encanto', burn: 'quemadura', poison: 'veneno', bleed: 'sangrado', thorns: 'espinas', bomb: 'explosión', vacio: 'estallido del vacío', volcan: 'estallido', marca: 'Marca de la muerte', fire: 'fuego', abyss: 'caída al abismo', trap: 'púas' };


/** Estado del panel del laboratorio (borrador del montaje, herramienta de clic e invocación elegida). */
const lab = { draft: null as LabSetup | null, tool: null as null | 'spawn' | 'remove', kind: 'esqueleto', team: 'enemy' as 'enemy' | 'hero', room: '', html: '' };
const GEAR = ['Sin objetos', 'Comunes o mejores', 'Poco comunes o mejores', 'Raros o mejores', 'Legendarios'];

/** Texto de la sala creada que ya cerró este jugador. */
let introSeen = '';
export function closeIntro(key: string): void { introSeen = key; document.getElementById('intromodal')?.remove(); }
/** Recompensa extra de una sala creada, en palabras. */
export function rewardText(r: NonNullable<CombatState['reward']>): string {
  const RAR = ['común o mejor', 'poco común o mejor', 'raro o mejor', 'legendario'];
  return [r.gold ? `${r.gold} de oro` : '', r.item !== undefined ? `un objeto ${RAR[r.item] ?? ''}` : '', r.relic ? `una reliquia${r.relic >= 2 ? ' rara' : ''}` : '', r.escofinas ? `${r.escofinas} Escofina${r.escofinas > 1 ? 's' : ''} de Eco` : ''].filter(Boolean).join(', ') + ' para cada uno';
}

/** Objetivo y refuerzos de las salas creadas. */
function goalHtml(c: CombatState): string {
  const out: string[] = [];
  if (c.goal?.kind === 'survive') out.push(`<span class="pill sm" ${tip('Ganáis al aguantar estas rondas (o acabando antes con todos los enemigos).')}>🎯 Sobrevivid: ronda ${Math.min(c.round, c.goal.rounds)}/${c.goal.rounds}</span>`);
  if (c.goal?.kind === 'targets' && c.units.some((u) => u.goal)) out.push(`<span class="pill sm" ${tip('Ganáis al acabar con los enemigos marcados con ★.')}>★ Objetivos: ${c.units.filter((u) => u.goal && u.hp > 0).length} en pie</span>`);
  const next = c.waves?.[0];
  if (next) out.push(`<span class="pill sm bad" ${tip('Llegan más enemigos al empezar esa ronda (o en cuanto no quede ninguno).')}>⚠ Refuerzos: ronda ${next.round}${c.waves!.length > 1 ? ` (+${c.waves!.length - 1} oleada${c.waves!.length > 2 ? 's' : ''})` : ''}</span>`);
  return out.join('');
}

/** Laboratorio del creador: montaje, escenario, invocar, IA y trucos. */
function trainingTools(c: CombatState): string {
  const run = ui.session!.run!;
  const st = labSetupOf(run), sc = labSceneOf(run), d = (lab.draft ??= { ...st, heroes: [...st.heroes] });
  const dummies = c.units.filter((u) => u.hp > 0 && u.traits?.includes('dummy'));
  const dmg = dummies.reduce((n, x) => n + (x.maxHp - x.hp), 0);
  const sel = (name: string, opts: Array<[string | number, string]>, v: string | number): string => `<select data-labset="${name}">${opts.map(([k, txt]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select>`;
  const changedSetup = JSON.stringify(d) !== JSON.stringify(st);
  const rooms = allRooms();
  if (!rooms.some((r) => r.id === lab.room)) lab.room = (sc.kind === 'room' ? sc.id : rooms.at(-1)?.id) ?? '';
  const ai = labOn(run, 'puppet') ? 'puppet' : labOn(run, 'still') ? 'still' : 'normal';
  const on = (k: LabCheat): string => (labOn(run, k) ? 'on' : '');
  const sceneName = sc.kind === 'room' ? `Sala: ${rooms.find((r) => r.id === sc.id)?.name ?? '?'}` : sc.kind === 'fight' ? (sc.fight === 'boss' ? `Jefe: ${ENEMIES[ZONES[st.zone]?.bosses[sc.boss ?? 0]?.id ?? '']?.name ?? '?'}` : `${sc.fight === 'elite' ? 'Élite' : 'Combate'} de la zona ${st.zone + 1}`) : 'Muñecos';
  return `<div class="labsec"><div class="lbl">👥 Montaje</div>
      <div class="labrow">${[0, 1, 2, 3].map((i) => sel(`hero${i}`, [...(i ? [['', '—'] as [string, string]] : []), ...PLAYABLE.map((k) => [k, CLASSES[k].name] as [string, string])], d.heroes[i] ?? '')).join('')}</div>
      <div class="labrow sm">Nivel ${sel('level', Array.from({ length: MAX_LEVEL }, (_, i) => [i + 1, String(i + 1)]), d.level)} Zona ${sel('zone', ZONE_SHORT.map((z, i) => [i, `${i + 1} · ${z}`]), d.zone)}</div>
      <div class="labrow sm">Ascensión ${sel('asc', Array.from({ length: 11 }, (_, i) => [i, String(i)]), d.asc)} Profundidad ${sel('depth', Array.from({ length: 6 }, (_, i) => [i, i ? `sala ${i + 1}` : 'primera sala']), d.depth)}</div>
      <div class="labrow sm">Objetos ${sel('gear', GEAR.map((g, i) => [i - 1, g]), d.gear)}</div>
      <button class="mini ${changedSetup ? 'pri' : ''}" data-act="labsetup" ${changedSetup ? '' : 'disabled'}>Aplicar montaje</button></div>
    <div class="labsec"><div class="lbl">🗺️ Escenario <span class="dim sm">· ${esc(sceneName)}</span></div>
      <div class="labrow"><button class="mini" data-act="labscene" data-id='{"kind":"dummies"}'>🎯 Muñecos</button><button class="mini" data-act="labscene" data-id='{"kind":"fight","fight":"combat"}'>⚔️ Combate</button><button class="mini" data-act="labscene" data-id='{"kind":"fight","fight":"elite"}'>☠️ Élite</button><button class="mini" data-act="train" data-id="replay">↺ Repetir</button></div>
      <div class="labrow">${ZONES.map((z) => z.bosses.map((b, bi) => `<button class="mini" data-act="labboss" data-id="${ZONES.indexOf(z)}:${bi}" title="Zona ${ZONES.indexOf(z) + 1}">👑 ${esc(ENEMIES[b.id]?.name ?? b.id)}</button>`).join('')).join('')}</div>
      ${rooms.length ? `<div class="labrow"><select data-labset="room">${rooms.map((r) => `<option value="${esc(r.id)}" ${r.id === lab.room ? 'selected' : ''}>${esc(r.name)} · Z${r.zone + 1}</option>`).join('')}</select><button class="mini" data-act="labroom">Cargar sala</button>${sc.kind === 'room' && canRooms() ? `<button class="mini" data-act="editor" data-id="${esc(sc.id)}">🛠️ Editarla</button>` : ''}</div>` : '<div class="dim sm">Aún no has creado salas: ábrelas desde el Editor de salas.</div>'}
      <div class="dim sm">Combate, élite y jefes salen como en una expedición, con la zona y profundidad del montaje.</div></div>
    <div class="labsec"><div class="lbl">✨ Invocar</div>
      <div class="labrow"><select data-labset="kind">${enemyOptions(lab.kind)}</select>${sel('team', [['enemy', 'Enemigo'], ['hero', 'Aliado']], lab.team)}</div>
      <div class="labrow"><button class="mini ${lab.tool === 'spawn' ? 'on' : ''}" data-act="labtool" data-id="spawn">📍 Colocar con clic</button><button class="mini ${lab.tool === 'remove' ? 'on' : ''}" data-act="labtool" data-id="remove">❌ Quitar con clic</button><button class="mini" data-act="train" data-id="kill">💀 Matar enemigos</button></div>
      ${lab.tool ? `<div class="sm good">${lab.tool === 'spawn' ? 'Haz clic en el tablero para colocarlo' : 'Haz clic en un personaje para quitarlo'} · clic otra vez en el botón para volver a jugar</div>` : ''}</div>
    <div class="labsec"><div class="lbl">🤖 IA de los enemigos</div>
      <div class="labrow"><button class="mini ${ai === 'normal' ? 'on' : ''}" data-act="train" data-id="aimode:normal">Normal</button><button class="mini ${ai === 'still' ? 'on' : ''}" data-act="train" data-id="aimode:still">Quieta</button><button class="mini ${ai === 'puppet' ? 'on' : ''}" data-act="train" data-id="aimode:puppet">🎮 La llevas tú</button></div>
      ${ai !== 'normal' ? '<div class="labrow"><button class="mini" data-act="train" data-id="ai">▶ Que juegue la IA este turno</button><button class="mini" data-act="train" data-id="skip">⏭ Pasar turno</button></div>' : ''}
      <div class="dim sm">${ai === 'puppet' ? 'En el turno de cada enemigo mueves y lanzas sus ataques tú, con su barra de hechizos.' : ai === 'still' ? 'Los enemigos esperan: pasa su turno o deja que juegue la IA.' : 'Los enemigos juegan solos.'}</div></div>
    ${isCreatorAccount() ? '<div class="labsec"><div class="lbl">⚖️ Equilibrio</div><div class="labrow"><button class="mini" data-act="balance">⚖️ Ajustar héroes, habilidades y enemigos</button></div></div>' : ''}
    <div class="labsec"><div class="lbl">🧪 Trucos</div>
      <div class="labrow"><button class="mini ${on('god')}" data-act="train" data-id="flag:god">❤️ Vida infinita</button><button class="mini ${on('ap')}" data-act="train" data-id="flag:ap">⚡ PA y PM infinitos</button><button class="mini ${on('cd')}" data-act="train" data-id="flag:cd">⏱️ Sin esperas</button></div>
      <div class="labrow"><button class="mini" data-act="train" data-id="refill">⚡ Recargar</button><button class="mini" data-act="train" data-id="cd">⏱️ Reiniciar esperas</button><button class="mini" data-act="train" data-id="heal">💚 Curar todo</button></div>
      <div class="labrow sm">Muñeco a ${[1, 2, 3, 4, 6, 8].map((n) => `<button class="mini" data-act="train" data-id="dummy:${n}">${n}</button>`).join('')} · daño a muñecos: <b>${dmg}</b></div></div>`;
}

/** Repinta el panel del laboratorio (solo si cambia: así no se cierra un desplegable abierto) y engancha los clics del tablero. */
function paintLab(): void {
  const s = ui.session, c = s?.run?.combat, board = ui.board;
  if (!s || !c || !board) return;
  const tb = document.getElementById('train');
  if (!tb) { board.pick = null; return; }
  const html = trainingTools(c);
  if (html !== lab.html || !tb.innerHTML) { tb.innerHTML = html; lab.html = html; }
  board.pick = lab.tool ? (p) => { s.act({ a: 'train', op: lab.tool === 'spawn' ? `spawn:${lab.kind}:${p.x}:${p.y}:${lab.team}` : `remove:${p.x}:${p.y}` }); } : null;
}

/** Cambios en los desplegables del laboratorio. */
document.addEventListener('change', (ev) => {
  const el = ev.target as HTMLSelectElement;
  const k = el.dataset?.labset;
  if (!k || !ui.session?.run) return;
  const run = ui.session.run, d = (lab.draft ??= { ...labSetupOf(run) });
  if (k.startsWith('hero')) { const i = Number(k.slice(4)); const h = [...d.heroes]; if (el.value) h[i] = el.value as ClassId; else h.splice(i, 1); d.heroes = h.filter(Boolean).slice(0, 4); }
  else if (k === 'kind') { lab.kind = el.value; lab.tool = 'spawn'; }
  else if (k === 'team') lab.team = el.value === 'hero' ? 'hero' : 'enemy';
  else if (k === 'room') lab.room = el.value;
  else (d as unknown as Record<string, number>)[k] = Number(el.value);
  paintLab();
});

/** Botones del laboratorio que no son una acción directa sobre el combate. */
export function labClick(act: string, id: string): boolean {
  const s = ui.session, run = s?.run;
  if (!s || !run || !isTraining(run)) return false;
  if (act === 'labsetup') { if (lab.draft) s.act({ a: 'train', op: `setup:${JSON.stringify(lab.draft)}` }); lab.draft = null; }
  else if (act === 'labscene') { lab.tool = null; s.act({ a: 'train', op: `scene:${id}` }); }
  else if (act === 'labboss') { const [z, b] = id.split(':').map(Number); lab.draft = { ...(lab.draft ?? labSetupOf(run)), zone: z! }; s.act({ a: 'train', op: `setup:${JSON.stringify(lab.draft)}` }); s.act({ a: 'train', op: `scene:${JSON.stringify({ kind: 'fight', fight: 'boss', boss: b })}` }); lab.draft = null; }
  else if (act === 'labroom') { if (lab.room) s.act({ a: 'train', op: `scene:${JSON.stringify({ kind: 'room', id: lab.room })}` }); lab.draft = null; }
  else if (act === 'labtool') lab.tool = lab.tool === id ? null : id as 'spawn' | 'remove';
  else return false;
  paintLab();
  return true;
}

/** Las barras superior e inferior miden según la pantalla: el CSS las usa para colocar el tablero y las ventanas. */
function fitCombat(): void {
  const info = document.getElementById('info'), hud = document.getElementById('hud');
  if (!info || !hud) return;
  ui.root.style.setProperty('--ctop', `${info.offsetHeight}px`);
  ui.root.style.setProperty('--chud', `${hud.offsetHeight}px`);
}
if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (ui.screen === 'combat') { fitCombat(); placeLogWin(); } });

// ---------- cámara del tablero: zoom con la rueda y desplazamiento arrastrando con el botón central (o Alt + arrastrar) ----------
const view = { z: 1, x: 0, y: 0 };
const ZMIN = 1, ZMAX = 2.6;
function applyView(): void {
  const cv = document.getElementById('cv');
  if (!cv) return;
  if (view.z <= ZMIN) { view.z = ZMIN; view.x = 0; view.y = 0; }
  cv.style.transform = view.z === 1 ? '' : `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  document.getElementById('zoomlbl')?.replaceChildren(`${Math.round(view.z * 100)}%`);
}
export function zoomBoard(dir: number, cx?: number, cy?: number): void {
  const st = document.getElementById('cstage');
  if (!st) return;
  const r = st.getBoundingClientRect();
  const px = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2), py = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
  const z0 = view.z, z1 = Math.max(ZMIN, Math.min(ZMAX, dir === 0 ? 1 : z0 * (dir > 0 ? 1.15 : 1 / 1.15)));
  // el punto bajo el ratón se queda quieto al hacer zoom
  view.x = px - ((px - view.x) * z1) / z0; view.y = py - ((py - view.y) * z1) / z0; view.z = z1;
  applyView();
}
function installCamera(st: HTMLElement): void {
  st.addEventListener('wheel', (e) => { e.preventDefault(); zoomBoard(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); }, { passive: false });
  let pan: { x: number; y: number; vx: number; vy: number } | null = null;
  st.addEventListener('pointerdown', (e) => { if (e.button === 1 || (e.button === 0 && e.altKey)) { e.preventDefault(); pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; st.setPointerCapture(e.pointerId); st.classList.add('panning'); } });
  st.addEventListener('pointermove', (e) => { if (!pan) return; view.x = pan.vx + e.clientX - pan.x; view.y = pan.vy + e.clientY - pan.y; if (view.z > 1) applyView(); });
  const stop = (): void => { pan = null; st.classList.remove('panning'); };
  st.addEventListener('pointerup', stop); st.addEventListener('pointercancel', stop);
  st.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
}

// ---------- ventana del registro: se arrastra por la cabecera, cambia de tamaño y de opacidad, y se recuerda ----------
interface LogWin { x: number; y: number; w: number; h: number; op: number; tab: 'all' | 'c' | 'g' }
const LOGWIN_KEY = 'rda_logwin';
const logWin: LogWin = (() => {
  const def: LogWin = { x: -1, y: -1, w: 380, h: 250, op: 1, tab: 'all' };
  try { const v = JSON.parse(store.get(LOGWIN_KEY) ?? 'null') as Partial<LogWin> | null; return v ? { ...def, ...v, op: Math.max(0.25, Math.min(1, Number(v.op) || def.op)) } : def; } catch { return def; }
})();
const saveLogWin = (): void => store.set(LOGWIN_KEY, JSON.stringify(logWin));
/** Coloca la ventana del registro (por defecto, abajo a la izquierda encima de la barra) sin dejarla fuera de la pantalla. */
function placeLogWin(): void {
  const w = document.getElementById('clogwin');
  if (!w) return;
  const top = parseFloat(getComputedStyle(ui.root).getPropertyValue('--ctop')) || 48, hud = parseFloat(getComputedStyle(ui.root).getPropertyValue('--chud')) || 120;
  const W = Math.min(logWin.w, innerWidth - 16), H = Math.min(logWin.h, innerHeight - top - hud - 16);
  const x = logWin.x < 0 ? 8 : Math.max(0, Math.min(innerWidth - W, logWin.x));
  const y = logWin.y < 0 ? innerHeight - hud - H - 8 : Math.max(top, Math.min(innerHeight - 40, logWin.y));
  Object.assign(w.style, { left: `${x}px`, top: `${y}px`, width: `${W}px`, height: `${H}px` });
  w.style.setProperty('--lop', String(logWin.op));
}
function installLogWin(w: HTMLElement): void {
  const head = w.querySelector<HTMLElement>('.cwinh')!;
  let drag: { x: number; y: number; l: number; t: number } | null = null;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    const r = w.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, l: r.left, t: r.top };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    logWin.x = Math.round(drag.l + e.clientX - drag.x); logWin.y = Math.round(drag.t + e.clientY - drag.y);
    placeLogWin();
  });
  head.addEventListener('pointerup', () => { if (drag) { drag = null; saveLogWin(); } });
  // tamaño: el navegador lo cambia con el asa de la esquina (CSS resize); se guarda al soltar
  new ResizeObserver(() => { if (!w.offsetWidth) return; const r = w.getBoundingClientRect(); if (Math.abs(r.width - logWin.w) > 2 || Math.abs(r.height - logWin.h) > 2) { logWin.w = Math.round(r.width); logWin.h = Math.round(r.height); saveLogWin(); } }).observe(w);
  w.querySelector<HTMLInputElement>('#logop')!.addEventListener('input', (e) => { logWin.op = Number((e.target as HTMLInputElement).value) / 100; w.style.setProperty('--lop', String(logWin.op)); saveLogWin(); });
}
/** Cambia la pestaña del registro (todo, combate o grupo). */
export function logTab(t: string): void { logWin.tab = t === 'c' || t === 'g' ? t : 'all'; saveLogWin(); ui.rerender(); }
/** Entradas visibles según la pestaña, en orden de llegada. */
function logEntries(): LogEntry[] {
  if (logWin.tab === 'c') return ui.log;
  if (logWin.tab === 'g') return ui.glog;
  return [...ui.log, ...ui.glog].sort((a, b) => a.at - b.at);
}

// ---------- ficha de unidad ----------
let inspectId: number | null = null;
/** Abre (o cierra, con null) la ficha de una unidad del combate. */
export function inspectUnit(id: number | null): void { inspectId = inspectId === id ? null : id; ui.rerender(); }

/** Mis estados en la barra inferior: icono, cargas y turnos; al pasar el ratón, qué hacen y cuánto me van a quitar. */
function myStatuses(me: Unit): string {
  const list = Object.entries(me.statuses).filter(([, v]) => v) as Array<[StatusKind, { turns: number; stacks: number }]>;
  return list.length ? `<div class="mystl">${list.map(([k, v]) => statusChipHtml(k, v.turns, v.stacks, me)).join('')}</div>` : '';
}

export function combatScreen(events: GameEvent[]): void {
  const s = ui.session!, run = s.run!, c = run.combat!;
  if (ui.screen !== 'combat') {
    view.z = 1; view.x = 0; view.y = 0;
    ui.root.innerHTML = `<div id="info" class="bar cinfo"></div>
      <div class="cgrid"><div class="stage" id="cstage"><canvas id="cv"></canvas><div id="toast" class="casttoast"></div>
        <div class="czoom"><button class="sq" data-act="zoom" data-id="-1" ${tip('Alejar (rueda del ratón)')}>−</button><button class="sq zl" data-act="zoom" data-id="0" ${tip('Encuadre normal')}><span id="zoomlbl">100%</span></button><button class="sq" data-act="zoom" data-id="1" ${tip('Acercar (rueda del ratón). Con zoom, arrastra con el botón central o con Alt + clic para mover la vista.')}>+</button></div></div>
      <aside class="cside"><div class="cbox cturns"><div class="cboxh">⏳ <span id="rnd" class="dim sm"></span></div><div id="init" class="timeline"></div></div>
      ${isTraining(run) ? '<div class="cbox trainbox"><div class="cboxh">🧪 Laboratorio</div><div id="train"></div></div>' : ''}</aside>
      <nav class="crail"><button class="sq" id="logbtn" data-act="togglelog" ${tip('<b>Registro</b><div class="sm">Combate y novedades del grupo. Arrastra la ventana por su cabecera, cambia su tamaño desde la esquina y su opacidad con la barra.</div>')} aria-label="Registro">📜</button></nav></div>
      <div id="clogwin" class="cwin clogbox"><div class="cwinh"><span class="cwint">📜 Registro</span><span class="ltabs" id="ltabs"></span><span class="grow"></span><label class="lop" ${tip('Opacidad de la ventana')}>◐<input id="logop" type="range" min="25" max="100" value="${Math.round(logWin.op * 100)}"></label><button class="sq" data-act="togglelog" ${tip('Cerrar (el botón 📜 la vuelve a abrir)')}>✕</button></div><div id="log" class="clog"></div></div>
      <div id="uinspect" class="cwin uinspect"></div>
      <div id="hud" class="dhud"></div>`;
    ui.board?.destroy();
    ui.board = new Board(document.getElementById('cv') as HTMLCanvasElement, s);
    ui.board.onSelect = () => ui.rerender();
    ui.board.onInspect = (id) => { inspectId = id; ui.rerender(); };
    installCamera(document.getElementById('cstage')!);
    installLogWin(document.getElementById('clogwin')!);
    inspectId = null;
    s.onPing = (p) => {
      const run2 = ui.session?.run; const i = run2 ? run2.heroes.findIndex((h) => h.owner === p.from) : -1;
      const name = i >= 0 ? run2!.heroes[i]!.name : '?';
      ui.board?.pings.push({ x: p.x, y: p.y, at: Date.now(), col: ['#e8607a', '#5a9cf0', '#5fcf70', '#e8bd40'][Math.max(0, i) % 4]!, name });
      ui.log.push({ at: Date.now(), k: 'c', html: `<div class="lfx lnote">📍 <b class="p${Math.max(0, i) % 4}">${esc(name)}</b> señala una casilla</div>` }); ui.rerender();
    };
  }
  ui.root.classList.remove('toolmode');
  ui.root.classList.add('combatmode');
  document.getElementById('clogwin')?.classList.toggle('open', ui.logOpen);
  document.getElementById('logbtn')?.classList.toggle('on', ui.logOpen);
  const board = ui.board!;
  board.showBars = ui.hpBars;
  board.applyEvents(events);
  (document.getElementById('cv') as HTMLCanvasElement).style.setProperty('--ar', String(board.aspect(c)));
  document.getElementById('cstage')?.classList.toggle('pinging', board.pingMode);
  const cur = current(c), me = s.myUnit(), myTurn = s.isMyTurn();
  const omenDef = run.omen ? OMENS.find((o) => o.id === run.omen) : undefined;
  if (!myTurn && board.sel) board.sel = null;
  const left = s.turnEndsAt ? Math.max(0, Math.ceil((s.turnEndsAt - Date.now()) / 1000)) : 0;
  const kind = isTraining(run) ? '🧪 Laboratorio' : run.arena ? `🏟️ Duelo: ${esc(run.arena.nameA)} contra ${esc(run.arena.nameB)}` : run.kind === 'boss' ? '👑 JEFE' : run.kind === 'elite' ? '☠️ Élite' : '⚔️ Combate';
  const owners = new Set(c.units.filter((u) => u.team === 'hero' && u.owner && u.hp > 0).map((u) => u.owner));
  document.getElementById('info')!.innerHTML = `${run.arena ? '' : blessingBar(run)}<b>${kind}</b><span class="dim sm">${run.arena ? '' : `Zona ${run.zone + 1} · sala ${run.step + 1}/${run.map.length} · `}ronda ${c.round}${c.biome ? ` · ${esc(c.biome)}` : ''}</span>${goalHtml(c)}${c.round >= 30 ? `<span class="bad sm" ${tip('Muerte súbita: el Abismo consume a todos al empezar su turno (5% de la vida máxima por cada ronda desde la 30).')}>☠ El Abismo consume</span>` : c.round >= 26 ? `<span class="bad sm">☠ ronda 30: muerte súbita</span>` : ''}${c.round >= 20 ? `<span class="bad sm" ${tip('Desde la ronda 20 nadie se regenera ni recibe escudos automáticos, y los pilares dejan de curar.')}>⌛ Sin regeneración</span>` : c.round >= 16 ? `<span class="dim sm">⌛ ronda 20: fin de regeneración</span>` : ''}${(c.marks ?? []).some((m) => m.kind === 'omen') ? `<span class="bad sm" ${tip('El jefe ha marcado casillas en rojo: estallan al empezar su próximo turno. Salid de ellas (o cubríos tras un obstáculo si es una línea).')}>⚠ Ataque anunciado</span>` : ''}${omenDef ? `<span class="pill sm omen" ${tip(`<b>${omenDef.icon} ${esc(omenDef.name)}</b><div class="sm">${esc(omenDef.text)}</div>`)}>${omenDef.icon} ${esc(omenDef.name)}</span>` : ''}
    <span class="turn ${myTurn || c.deploy ? 'mine' : ''}">${c.deploy ? 'COLOCACIÓN' : c.over ? (c.over === 'win' ? '¡Victoria!' : 'Derrota') : myTurn ? 'TU TURNO' : cur ? `Turno de ${esc(cur.name)}` : ''}</span><span id="clock" class="dim">${left && !c.over ? `${left}s` : ''}</span>
    ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}${!s.t.connected() ? '<span class="bad">⚠ Conexión perdida: reconectando…</span>' : !s.hostPresent() ? '<span class="bad">Anfitrión desconectado: partida en pausa</span>' : ''}
    ${c.deploy ? `<span class="sm">Elige una de las casillas de inicio azules · listos ${c.deploy.ready.length}/${owners.size}</span>${s.isHost && c.deploy.ready.length ? '<button class="mini" data-act="readyall">Empezar ya</button>' : ''}` : ''}
    ${s.isHost && cur && !cur.ai && !myTurn && !c.over ? '<button class="mini" data-act="skip">Pasar su turno</button>' : ''}<span class="grow"></span>${sysButtons()}`;
  // orden de turnos: miniaturas con la apariencia actual; clic = ficha completa de la unidad
  const heroIdx = new Map(c.units.filter((u) => u.team === 'hero' && u.summoner === undefined).map((u, i) => [u.id, i]));
  const mineTeam = me?.team ?? 'hero';
  document.getElementById('rnd')!.textContent = `ronda ${c.round}`;
  paintLab();
  document.getElementById('init')!.innerHTML = c.order.map((id) => getUnit(c, id)!).filter((u) => u && u.hp > 0)
    .map((u) => { const tot = Math.max(u.maxHp, u.hp + u.shield); const pct = Math.max(0, Math.min(100, (u.hp / tot) * 100)); const spct = (u.shield / tot) * 100; const ally = u.team === mineTeam;
      const sts = Object.entries(u.statuses).filter(([, v]) => v) as Array<[StatusKind, { turns: number; stacks: number }]>;
      return `<div class="tl ${cur?.id === u.id ? 'on' : ''} ${ally ? 'ally' : 'foe'} ${u.id === me?.id ? 'isme' : ''} ${u.rank === 'elite' || u.ai === 'boss' ? 'big' : ''} ${inspectId === u.id ? 'insp' : ''}" data-act="uinspect" data-id="${u.id}" ${tip(`<b>${esc(u.name)}</b><div class="sm">${u.hp}/${u.maxHp} PV${u.shield ? ` · 🛡 ${u.shield}` : ''} · iniciativa ${u.initiative}</div><div class="sm"><span class="lap">${u.ap} PA</span> · <span class="lmp">${u.mp} PM</span> · armadura ${Math.floor(u.armor)}</div>${sts.map(([k, v]) => `<div class="sm">${statusGi(k)} ${esc(STATUS_NAME[k] ?? k)}${v.stacks > 1 && STATUSES[k]?.stack === 'add' ? ` ×${v.stacks}` : ''} (${v.turns} t.)</div>`).join('')}${(u.traits ?? []).map((t) => TRAIT_TEXT[t] ? `<div class="sm dim">${esc(TRAIT_TEXT[t]!)}</div>` : '').join('')}<div class="sm dim">Clic: ficha completa</div>`)}>
        <img src="${unitThumb(u, heroIdx.get(u.id) ?? 0)}" alt=""><i class="tlhp"><b style="width:${pct}%"></b>${u.shield ? `<s style="left:${pct}%;width:${spct}%"></s>` : ''}</i>${sts.length ? `<span class="tlst">${sts.slice(0, 4).map(([k]) => statusGi(k)).join('')}</span>` : ''}<span class="tln">${esc(u.name.split(' ')[0]!)}</span>${u.id === me?.id ? '<span class="tlme">TÚ</span>' : ''}</div>`; }).join('');
  // barra inferior al estilo Dofus: corazón de vida, PA y PM, hechizos, objetos y botón de turno
  const deploying = !!c.deploy;
  const ready = deploying && c.deploy!.ready.includes(s.myId);
  const endBtn = deploying
    ? `<button class="pri endturn ${ready ? 'done' : 'glow'}" data-act="deployready" ${ready || !me ? 'disabled' : ''}>${ready ? '✔ Listo' : '¡Listo!'}<small>(E)</small></button>`
    : `<button class="pri endturn ${myTurn ? 'glow' : ''}" data-act="end" ${myTurn ? '' : 'disabled'}>${myTurn ? 'Pasar turno' : 'Esperando…'}<small>(E)</small></button>`;
  document.getElementById('hud')!.innerHTML = me
    ? `<div class="dme"><img class="dport" data-act="uinspect" data-id="${me.id}" src="${unitThumb(me, heroIdx.get(me.id) ?? 0)}" alt="" ${tip('Tu ficha: estados, recursos y runas')}><div class="dmeinfo"><b>${esc(me.name)}</b>${(() => { const hs = run.heroes.find((x) => x.owner === me.owner); return hs ? `<div class="sm"><span class="pill">💰 ${hs.gold}</span> ${escofinas(hs)}</div>` : ''; })()}${resourceHtml(c, me)}${myStatuses(me)}${usableMp(c, me) < me.mp && myTurn ? `<div class="sm lmp" ${tip('Placaje: los enemigos pegados a ti te retienen. Al alejarte pierdes PM según tu Huida y su Placaje.')}>⛓ Placado: ${usableMp(c, me)}/${me.mp} PM útiles</div>` : ''}</div></div>
      <div class="dvital">${heartSvg(me.hp, me.maxHp, me.shield)}<div class="apmp"><span class="star" ${tip('Puntos de acción: se gastan al lanzar hechizos.')}>${starSvg(me.ap)}</span><span class="dia" ${tip('Puntos de movimiento: cada casilla cuesta 1.')}>${diaSvg(me.mp)}</span></div></div>
      <div class="spellbar">${me.spells.map((sp, i) => ({ sp, i })).filter(({ sp }) => sp.charges === undefined).map(({ sp, i }) => { const d = spellOf(me, sp.id)!; const cost = apCost(me, sp.id, c); const spent = !!d.perTurn && (sp.uses ?? 0) >= d.perTurn; const off = !myTurn || me.ap < cost || sp.cd > 0 || spent || me.hp <= 0;
        // Corte de Guadaña: el icono cambia de color con la carga (gris → violeta → magenta con almas)
        const chg = d.special === 'scythe' ? Math.min(3, me.scytheCharge ?? 0) : -1;
        const chgTip = chg >= 0 ? `<div class="sm" style="color:#d88bff">Carga ${chg}/3: +${scytheBonus(me)} de daño</div>` : '';
        return `<button class="sbtn ${board.sel === d.id ? 'on' : ''} ${sp.cd > 0 ? 'cd' : ''} ${chg >= 0 ? `chg${chg}` : ''}" data-act="spell" data-id="${d.id}" ${off ? 'disabled' : ''} ${tip(spellTip(d, `${chgTip}${sp.cd > 0 ? `<div class="sm bad">Disponible en ${sp.cd} turno(s)</div>` : ''}${d.perTurn ? `<div class="sm ${spent ? 'bad' : 'dim'}">Usado ${sp.uses ?? 0}/${d.perTurn} este turno</div>` : ''}${sp.free ? '<div class="sm good">¡Gratis tras rematar!</div>' : ''}`))}>
          <kbd>${i + 1}</kbd>${spellIcon(d, false)}<span class="cost ${sp.free ? 'free' : ''}">${cost}</span>${d.perTurn ? `<span class="uses">${(d.perTurn - (sp.uses ?? 0))}/${d.perTurn}</span>` : ''}${sp.cd > 0 ? `<span class="cdn">${sp.cd}</span>` : ''}<small>${esc(d.name)}</small></button>`; }).join('')}
      ${me.spells.some((sp) => sp.charges !== undefined) ? `<span class="itemsep"></span>${me.spells.filter((sp) => sp.charges !== undefined).map((sp) => { const d = spellOf(me, sp.id)!; const off = !myTurn || (sp.charges ?? 0) <= 0 || me.hp <= 0;
        return `<button class="sbtn item ${board.sel === d.id ? 'on' : ''}" data-act="spell" data-id="${d.id}" ${off ? 'disabled' : ''} ${tip(spellTip(d, `<div class="sm">Te quedan ${sp.charges}</div>`))}>${spellIcon(d, false)}<span class="cost free">0</span><span class="cdn qty">x${sp.charges}</span><small>${esc(d.name.replace('Poción de ', 'P. ').replace('Bomba de ', 'B. '))}</small></button>`; }).join('')}` : ''}</div>
      <div class="dend">${!deploying && left && !c.over ? `<span class="dclock ${left <= 10 ? 'bad' : ''}">⏱ ${left}s</span>` : ''}<button class="ping ${board.pingMode ? 'on' : ''}" data-act="pingmode" ${tip('<b>Señalar casilla</b><div class="sm">Haz clic en una casilla para marcarla a todo el grupo (también con la tecla G sobre la casilla).</div>')}>📍<small>Señalar (G)</small></button>${endBtn}</div>`
    : '<span class="dim">Estás como espectador en este combate.</span>';
  // salas creadas: texto al entrar (cada jugador lo cierra por su cuenta)
  const introKey = c.story?.intro ? `${run.code}:${run.step}:${run.zone}:${c.story.title}` : '';
  document.getElementById('intromodal')?.remove();
  if (introKey && introSeen !== introKey && c.round <= 1) ui.root.insertAdjacentHTML('beforeend', `<div class="modal" id="intromodal"><div class="panel note storybox"><h3>${esc(c.story!.title)}</h3><p>${esc(c.story!.intro!).replace(/\n/g, '<br>')}</p>${run.combat?.reward ? `<div class="sm good">Recompensa al ganar: ${rewardText(run.combat.reward)}</div>` : ''}<div class="row center"><button class="pri" data-act="introok" data-id="${esc(introKey)}">Adelante</button></div></div></div>`);
  fitCombat();
  // ficha de la unidad abierta (se cierra sola si la unidad desaparece del combate)
  const insp = document.getElementById('uinspect')!;
  const iu = inspectId !== null ? getUnit(c, inspectId) : undefined;
  if (inspectId !== null && !iu) inspectId = null;
  insp.classList.toggle('open', !!iu);
  insp.innerHTML = iu ? unitSheet(c, iu, heroIdx.get(iu.id) ?? 0) : '';
  // registro: pestañas, entradas y desplazamiento al final si ya se estaba abajo
  placeLogWin();
  const counts = { all: ui.log.length + ui.glog.length, c: ui.log.length, g: ui.glog.length };
  document.getElementById('ltabs')!.innerHTML = ([['all', 'Todo'], ['c', 'Combate'], ['g', 'Grupo']] as const).map(([k, t]) => `<button class="mini ${logWin.tab === k ? 'on' : ''}" data-act="logtab" data-id="${k}" ${tip(k === 'g' ? 'Runas, bendiciones, mejoras, objetos y niveles de cada jugador' : k === 'c' ? 'Lo que pasa en este combate' : 'Todo junto, en orden')}>${t}<small>${counts[k]}</small></button>`).join('');
  const lg = document.getElementById('log')!;
  const atBottom = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 40;
  lg.innerHTML = logEntries().map((e) => e.html).join('') || '<div class="dim sm">Aún no ha pasado nada.</div>';
  if (atBottom || events.length) lg.scrollTop = 1e9;
  // cartel flotante con el hechizo que se acaba de lanzar
  const t = ui.toast;
  const el = document.getElementById('toast')!;
  if (t && Date.now() - t.at < 1600 && el.dataset.at !== String(t.at)) { el.dataset.at = String(t.at); el.className = `casttoast ${t.team === 'hero' ? 'ally' : 'foe'}`; el.innerHTML = t.text; void el.offsetWidth; el.classList.add('show'); }
  applyView();
}

/** Corazón de vida al estilo Dofus: se vacía de arriba abajo; el escudo, como borde azul. */
function heartSvg(hp: number, max: number, shield: number): string {
  const pct = Math.max(0, Math.min(1, hp / max));
  const y = 4 + (1 - pct) * 40;
  return `<div class="heart" ${tip(`Vida ${hp}/${max}${shield ? ` · escudo ${shield}` : ''}`)}><svg viewBox="0 0 48 46"><defs><clipPath id="hclip"><path d="M24 44 C10 34 2 26 2 15 C2 7 8 2 14.5 2 C19 2 22 4.5 24 8 C26 4.5 29 2 33.5 2 C40 2 46 7 46 15 C46 26 38 34 24 44Z"/></clipPath></defs>
    <path d="M24 44 C10 34 2 26 2 15 C2 7 8 2 14.5 2 C19 2 22 4.5 24 8 C26 4.5 29 2 33.5 2 C40 2 46 7 46 15 C46 26 38 34 24 44Z" fill="#2a0c10"/>
    <rect clip-path="url(#hclip)" x="0" y="${y.toFixed(1)}" width="48" height="46" fill="url(#hgrad)"/><defs><linearGradient id="hgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a6a"/><stop offset="1" stop-color="#a0101e"/></linearGradient></defs>
    <path d="M24 44 C10 34 2 26 2 15 C2 7 8 2 14.5 2 C19 2 22 4.5 24 8 C26 4.5 29 2 33.5 2 C40 2 46 7 46 15 C46 26 38 34 24 44Z" fill="none" stroke="${shield ? '#7ad0ff' : '#f2d2a0'}" stroke-width="${shield ? 3 : 2}"/>
    <ellipse cx="14" cy="12" rx="5" ry="3" fill="#fff" opacity=".25"/></svg><span class="hv"><b>${hp}</b><small>/${max}</small>${shield ? `<em>🛡${shield}</em>` : ''}</span></div>`;
}
const starSvg = (n: number): string => `<svg viewBox="0 0 40 40"><path d="M20 2 L25 14 L38 15 L28 24 L31 37 L20 30 L9 37 L12 24 L2 15 L15 14Z" fill="#2f7fe0" stroke="#bfe0ff" stroke-width="2" stroke-linejoin="round"/></svg><b>${n}</b><small>PA</small>`;
const diaSvg = (n: number): string => `<svg viewBox="0 0 40 40"><path d="M20 2 L37 20 L20 38 L3 20Z" fill="#3fae4a" stroke="#d2ffc8" stroke-width="2" stroke-linejoin="round"/></svg><b>${n}</b><small>PM</small>`;

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
  if (me.souls !== undefined) out.push(`<div class="sm souls" ${tip(`Cosecha de almas: cuentan en toda la partida; cada ${SOULS_PER_ARMOR}, +0,5 de armadura permanente (se aplica redondeando hacia abajo). Las almas sin gastar se usan en Explosión de almas.`)}>💀 ${me.souls} almas (${me.soulBank ?? 0} para gastar) · +${Math.floor(me.souls / SOULS_PER_ARMOR) * SOUL_ARMOR} armadura · próxima en ${SOULS_PER_ARMOR - (me.souls % SOULS_PER_ARMOR)}</div>`);
  if (me.fury !== undefined) out.push(`<div class="sm res fury" ${tip('Furia: +20 al golpear, +10 al recibir daño. Cada 40: +1 de daño (máx. +2); cada 20: +6% de crítico. Si pasas un turno sin atacar ni recibir daño, pierdes 20.')}>🔥 Furia <span class="fbar"><i style="width:${me.fury}%"></i></span> ${me.fury}/100 · +${furyPower(me)} daño · +${furyCrit(me)}% crít.</div>`);
  const marked = c.units.filter((u) => u.hp > 0 && u.statuses.deathmark?.from === me.id);
  if (marked.length) out.push(`<div class="sm res bad">☠ Marca de la muerte: ${marked.map((u) => `${esc(u.name.split(' ')[0]!)} guarda ${u.statuses.deathmark!.stacks} (${u.statuses.deathmark!.turns} t.)`).join(' · ')}</div>`);
  if (me.kind === 'acechador') { const n = marksOf(c, 'shadow', me.id).length; if (n) out.push(`<div class="sm res">👤 Sombras ${n}</div>`); }
  if (me.magazine !== undefined) { const full = me.magazine >= MAG_MAX; out.push(`<div class="sm res mag ${full ? 'good' : ''}" ${tip(`Cargador arcano: cada disparo suma 1 carga. Con ${MAG_MAX}, el siguiente disparo es un crítico seguro con daño elemental extra y vacía el tambor.`)}>🔫 Cargador ${'●'.repeat(me.magazine)}${'○'.repeat(Math.max(0, MAG_MAX - me.magazine))}${full ? ' · ¡próximo disparo crítico!' : ''}</div>`); }
  if (me.kind === 'arquitecto') { const n = marksOf(c, 'glyph', me.id).length; out.push(`<div class="sm res ${me.glyphBonus ? 'good' : ''}" ${tip('Geometría Bélica: al empezar tu turno sobre o junto a un glifo tuyo, ganas 4 de escudo y tu siguiente hechizo de daño hace +2.')}>🔷 Glifos ${n}/6${me.glyphBonus ? ` · +${me.glyphBonus} al próximo daño` : ''}</div>`); }
  return out.join('');
}
