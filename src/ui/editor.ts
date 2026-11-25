// Editor de salas del creador: forma, terreno, calderos, casillas de inicio, enemigos con sus ajustes, oleadas y objetivo.
// El tablero es el mismo del juego (con la vista isométrica), en modo edición.
import { AFFIXES, ENEMIES, makeEnemy } from '../content/enemies';
import { ZONES } from '../content/zones';
import { createCombat, type UnitSpec } from '../core/combat/engine';
import type { CombatState, Pos } from '../core/state';
import { dropRoom, isCreatorAccount, myRooms, putRoom } from '../game/meta';
import { allRooms, zoneOpts } from '../game/run';
import { CELL_KINDS, ENEMY_ZONE, templateRoom, KIND_NAME, ROOM_MAX, ROOM_MIN, STAT_KEYS, ZONE_SHORT, applyMod, cleanRoom, enemiesAt, newRoom, resizeRoom, roomWarnings, startAt, type CellKind, type RoomDef, type RoomEnemy, type RoomKind, type StatMod } from '../game/salas';
import type { Session } from '../game/session';
import { Board } from '../render/board';
import { esc, ui } from './ctx';
import { globalRooms, globalStamp, publishRooms } from '../net/salas';

const CELL_INFO: Record<CellKind | 'floor', { icon: string; name: string; text: string }> = {
  floor: { icon: '⬜', name: 'Suelo', text: 'Borra el terreno de la casilla.' },
  void: { icon: '⬛', name: 'Fuera de la sala', text: 'Da forma a la sala: la casilla desaparece (como un muro, pero sin dibujarse).' },
  wall: { icon: '🪨', name: 'Obstáculo', text: 'Bloquea el paso y la línea de visión (lápidas, barriles, estatuas…).' },
  brazier: { icon: '🔥', name: 'Caldero', text: 'Obstáculo que se rompe con un golpe y deja una línea de fuego.' },
  abyss: { icon: '🕳️', name: 'Abismo', text: 'No se pisa; quien cae dentro, muere. No tapa la visión.' },
  root: { icon: '🌿', name: 'Raíces', text: 'Raíces venenosas: dañan a quien las pisa.' },
  puddle: { icon: '💧', name: 'Charco', text: 'Pegajoso: el héroe que entra se detiene.' },
  trap: { icon: '📌', name: 'Púas', text: 'Dañan a quien las pisa.' },
};
const OVER_COLOR: Partial<Record<CellKind, string>> = { root: 'rgba(120,200,60,.35)', trap: 'rgba(220,220,230,.28)' };
type Tool = CellKind | 'floor' | 'start' | 'enemy' | 'move' | 'erase';

const ed = {
  room: null as RoomDef | null,
  tool: 'enemy' as Tool,
  kind: 'esqueleto',
  /** oleada en la que se colocan los enemigos nuevos (1 = desde el principio) */
  wave: 1,
  /** enemigo seleccionado (índice en room.enemies) */
  sel: -1,
  board: null as Board | null,
  fake: null as { run: { combat: CombatState; zone: number; code: string; step: number } } | null,
  msg: '',
  saveTimer: 0 as ReturnType<typeof setTimeout> | 0,
  onTest: null as ((r: RoomDef) => void) | null,
  onExit: null as (() => void) | null,
};

/** Lista de enemigos para los desplegables: por zona, con jefes, élites y pilares marcados. */
export function enemyOptions(selected: string, withAllies = true): string {
  const groups: string[] = [];
  for (let z = -1; z < 4; z++) {
    if (z < 0 && !withAllies) continue;
    const ids = Object.keys(ENEMIES).filter((id) => ENEMY_ZONE[id] === z);
    if (!ids.length) continue;
    const tag = (id: string): string => { const d = ENEMIES[id]!, zd = ZONES[z]; return d.ai === 'boss' ? '👑 ' : d.ai === 'pillar' ? '🗿 ' : zd?.elites.includes(id) ? '☠️ ' : ''; };
    groups.push(`<optgroup label="${z < 0 ? 'Aliados' : `Zona ${z + 1} · ${esc(ZONE_SHORT[z])}`}">${ids.sort((a, b) => (ENEMIES[a]!.ai === 'boss' ? 1 : 0) - (ENEMIES[b]!.ai === 'boss' ? 1 : 0)).map((id) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${tag(id)}${esc(ENEMIES[id]!.name)}</option>`).join('')}</optgroup>`);
  }
  return groups.join('');
}

/** Combate de muestra para dibujar la sala (con las casillas de inicio como zona de despliegue). */
function preview(r: RoomDef): CombatState {
  const of = (k: CellKind): Pos[] => Object.entries(r.cells).filter(([, v]) => v === k).map(([p]) => { const [x, y] = p.split(',').map(Number) as [number, number]; return { x, y }; });
  const units: UnitSpec[] = r.enemies.filter((e) => (e.wave ?? 0) <= 1).map((e) => applyMod(makeEnemy(e.kind, { x: e.x, y: e.y }, 0, 1, { ...zoneOpts(r.zone, 0, 1, e.kind), affixes: e.affixes ?? [] }), e));
  return createCombat({ seed: 1, w: r.w, h: r.h, obstacles: of('wall'), voids: of('void'), braziers: of('brazier'), abyss: of('abyss'), roots: of('root'), puddles: of('puddle'), traps: of('trap'), units, deploy: true, deployCells: r.starts }).state;
}

/** Abre el editor (con la última sala editada o una nueva). */
export function editorScreen(opts: { onTest: (r: RoomDef) => void; onExit: () => void; open?: string }): void {
  ed.onTest = opts.onTest; ed.onExit = opts.onExit;
  const list = myRooms();
  ed.room = (opts.open ? list.find((r) => r.id === opts.open) : null) ?? (ed.room ? list.find((r) => r.id === ed.room!.id) ?? ed.room : null) ?? list.at(-1) ?? newRoom();
  ed.sel = -1;
  ui.screen = 'editor';
  ui.root.classList.add('combatmode');
  ui.root.innerHTML = `<div id="edtop" class="bar cinfo edtop"></div>
    <div class="edgrid"><aside id="edleft" class="cside edside"></aside>
    <div class="stage edstage"><canvas id="edcv"></canvas><div id="edhint" class="edhint dim sm"></div></div>
    <aside id="edright" class="cside edside"></aside></div>`;
  ed.board?.destroy();
  ed.fake = { run: { combat: preview(ed.room), zone: ed.room.zone, code: `ED${ed.room.id}`, step: 0 } };
  const fakeSession = { get run() { return ed.fake!.run; }, myUnit: () => undefined, isMyTurn: () => false, act: () => {} } as unknown as Session;
  ed.board = new Board(document.getElementById('edcv') as HTMLCanvasElement, fakeSession);
  ed.board.showBars = true;
  ed.board.pick = (p, drag) => paint(p, drag);
  refresh();
}

export function closeEditor(): void {
  flush();
  ed.board?.destroy();
  ed.board = null;
  ui.root.classList.remove('combatmode');
}

/** Guarda enseguida si hay cambios pendientes. */
function flush(): void { if (ed.saveTimer) { clearTimeout(ed.saveTimer); ed.saveTimer = 0; if (ed.room) putRoom(ed.room); } }
/** Hubo un cambio: se redibuja y se guarda en un momento. */
function changed(full = true): void {
  if (!ed.room) return;
  ed.room.t = Date.now();
  if (ed.saveTimer) clearTimeout(ed.saveTimer);
  ed.saveTimer = setTimeout(() => { ed.saveTimer = 0; if (ed.room) putRoom(ed.room); }, 800);
  refresh(full);
}

function refresh(full = true): void {
  const r = ed.room!;
  ed.fake!.run.combat = preview(r);
  ed.fake!.run.zone = r.zone;
  ed.board!.roomSeed = [...r.id].reduce((a, ch) => Math.imul(a ^ ch.charCodeAt(0), 16777619), 2166136261);
  // marcas: oleadas posteriores, seleccionado, objetivos y terreno que no se ve bien en el suelo
  const over: Board['overlay'] = [];
  for (const [k, v] of Object.entries(r.cells)) { const col = OVER_COLOR[v]; if (col) { const [x, y] = k.split(',').map(Number) as [number, number]; over.push({ x, y, fill: col }); } }
  r.starts.forEach((p, i) => over.push({ x: p.x, y: p.y, fill: 'rgba(0,0,0,0)', text: String(i + 1) }));
  const byCell = new Map<string, RoomEnemy[]>();
  for (const e of r.enemies) { const k = `${e.x},${e.y}`; byCell.set(k, [...(byCell.get(k) ?? []), e]); }
  for (const [k, list] of byCell) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const later = list.filter((e) => (e.wave ?? 0) > 1).map((e) => e.wave!);
    const tags = [...(later.length ? [`R${[...new Set(later)].sort((a, b) => a - b).join(',')}`] : []), ...(list.some((e) => e.goal) ? ['★'] : []), ...(list.some((e) => (e.min ?? 1) > 1) ? [`${Math.max(...list.map((e) => e.min ?? 1))}J`] : [])];
    const sel = ed.sel >= 0 && list.includes(r.enemies[ed.sel]!);
    if (tags.length || sel) over.push({ x, y, fill: later.length && !list.some((e) => (e.wave ?? 0) <= 1) ? 'rgba(170,90,255,.35)' : 'rgba(0,0,0,0)', stroke: sel ? '#ffd24a' : undefined, text: tags.join(' ') || undefined });
  }
  ed.board!.overlay = over;
  document.getElementById('edhint')!.innerHTML = hint();
  if (!full) return;
  document.getElementById('edtop')!.innerHTML = topBar(r);
  document.getElementById('edleft')!.innerHTML = leftPanel(r);
  document.getElementById('edright')!.innerHTML = rightPanel(r);
  (document.getElementById('edcv') as HTMLCanvasElement).style.setProperty('--ar', String(ed.board!.aspect(ed.fake!.run.combat)));
}

const hint = (): string => {
  const t = ed.tool;
  if (t === 'enemy') return `Clic: coloca <b>${esc(ENEMIES[ed.kind]?.name ?? ed.kind)}</b>${ed.wave > 1 ? ` (entra en la ronda ${ed.wave})` : ''} · clic sobre un enemigo: lo selecciona`;
  if (t === 'move') return 'Clic en la casilla a la que quieres mover el enemigo seleccionado';
  if (t === 'start') return 'Clic: pone o quita una casilla de inicio de los héroes (los números son el orden en que se ocupan)';
  if (t === 'erase') return 'Clic o arrastra: borra terreno, casillas de inicio y enemigos de la oleada elegida';
  return `Clic o arrastra para pintar: <b>${CELL_INFO[t].icon} ${CELL_INFO[t].name}</b> · ${esc(CELL_INFO[t].text)}`;
};

function topBar(r: RoomDef): string {
  return `<b>🛠️ Editor de salas</b>
    <input id="edname" class="edname" value="${esc(r.name)}" maxlength="40" title="Nombre de la sala">
    <label class="sm">Zona <select data-edc="zone">${ZONE_SHORT.map((z, i) => `<option value="${i}" ${i === r.zone ? 'selected' : ''}>${i + 1} · ${esc(z)}</option>`).join('')}</select></label>
    <label class="sm">Tipo <select data-edc="kind">${(Object.keys(KIND_NAME) as RoomKind[]).map((k) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${KIND_NAME[k]}</option>`).join('')}</select></label>
    <label class="sm">Ancho <input type="number" data-edc="w" min="${ROOM_MIN.w}" max="${ROOM_MAX.w}" value="${r.w}" class="ednum"></label>
    <label class="sm">Alto <input type="number" data-edc="h" min="${ROOM_MIN.h}" max="${ROOM_MAX.h}" value="${r.h}" class="ednum"></label>
    <button class="mini" data-ed="iso">🔷 Vista</button>
    <span class="grow"></span>${ed.msg ? `<span class="sm good">${esc(ed.msg)}</span>` : ''}
    ${isCreatorAccount() ? '<button data-act="balance">⚖️ Equilibrio</button>' : ''}<button class="pri" data-ed="test">▶ Probar sala</button><button data-ed="exit">Volver</button>`;
}

function leftPanel(r: RoomDef): string {
  const list = myRooms();
  if (!list.some((x) => x.id === r.id)) list.push(r);
  const builtin = allRooms().filter((x) => !list.some((y) => y.id === x.id));
  return `<div class="cbox"><div class="cboxh">📚 Mis salas (${list.length})</div>
      <div class="edlist">${list.map((x) => `<button class="edroom ${x.id === r.id ? 'on' : ''}" data-ed="open" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>Zona ${x.zone + 1} · ${KIND_NAME[x.kind]} · ${x.w}×${x.h} · ${x.enemies.length} enem.${x.published ? ` · ${syncBadge(x)}` : ''}</small></button>`).join('')}</div>
      <div class="row" style="flex-wrap:wrap;gap:4px;margin-top:6px"><button class="mini" data-ed="new">＋ Nueva</button><button class="mini" data-ed="dup">⧉ Duplicar</button><button class="mini danger" data-ed="del">🗑 Borrar</button></div>
      <div class="row" style="gap:4px;margin-top:4px"><select id="edtpl" class="edsel">${templateOptions()}</select><button class="mini" data-ed="tpl">Crear</button></div></div>
    ${isCreatorAccount() ? globalPanel(list) : '<div class="cbox sm dim">🧪 Eres tester: tus salas solo las ves tú. Para que salgan en el juego, usa «Exportar» y pásale el archivo al creador.</div>'}
    ${builtin.length ? `<div class="cbox"><div class="cboxh">🎮 Salas del juego</div><div class="dim sm">Salen para todos. Para cambiar una, duplícala.</div><div class="edlist">${builtin.map((x) => `<button class="edroom" data-ed="copy" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>Zona ${x.zone + 1} · ${KIND_NAME[x.kind]}</small></button>`).join('')}</div></div>` : ''}
    <div class="cbox"><div class="cboxh">📦 Archivos</div>
      <div class="row" style="flex-wrap:wrap;gap:4px"><button class="mini" data-ed="export">⬇ Exportar esta</button><button class="mini" data-ed="exportall">⬇ Exportar todas</button><label class="mini btnlike">⬆ Importar<input type="file" id="edimport" accept=".json,application/json" hidden></label></div>
      <p class="dim sm">Copia de seguridad de tus salas, o para pasarlas a otro sitio.</p></div>`;
}

/** Plantillas: guaridas de cada jefe y salas de cada élite. */
function templateOptions(): string {
  return `<option value="">Plantilla de jefe o élite…</option>${ZONES.map((z, i) => `<optgroup label="Zona ${i + 1} · ${esc(ZONE_SHORT[i])}">${z.bosses.map((b) => `<option value="boss:${i}:${b.id}">👑 ${esc(ENEMIES[b.id]?.name ?? b.id)}</option>`).join('')}${z.elites.map((id) => `<option value="elite:${i}:${id}">☠️ ${esc(ENEMIES[id]?.name ?? id)}</option>`).join('')}</optgroup>`).join('')}`;
}

/** Estado de una sala publicada respecto a la versión que tienen todos los jugadores. */
function syncBadge(r: RoomDef): string {
  const g = globalRooms().find((x) => x.id === r.id);
  return !g ? '🔸 sin subir' : JSON.stringify({ ...g, t: 0 }) === JSON.stringify({ ...cleanRoom(r)!, published: true, t: 0 }) ? '🌍 en el juego' : '✎ cambios sin subir';
}

function globalPanel(list: RoomDef[]): string {
  const pub = list.filter((x) => x.published), live = globalRooms(), when = globalStamp();
  const pending = pub.filter((x) => syncBadge(x) !== '🌍 en el juego').length + live.filter((g) => !pub.some((x) => x.id === g.id)).length;
  return `<div class="cbox"><div class="cboxh">🌍 Para todos los jugadores</div>
    <div class="sm">En el juego: <b>${live.length}</b> sala${live.length === 1 ? '' : 's'}${when ? ` <span class="dim">(subidas el ${new Date(when).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})</span>` : ''}</div>
    <div class="sm">Tus publicadas: <b>${pub.length}</b>${pending ? ` · <span class="bad">${pending} cambio${pending === 1 ? '' : 's'} sin subir</span>` : ' · todo al día'}</div>
    <button class="pri mini" data-ed="publish" ${pending ? '' : 'disabled'}>🌍 Subir las publicadas a todos</button>
    <p class="dim sm">Las salas publicadas ya salen en las partidas que alojas tú. Al subirlas, salen en las de todos los jugadores; las que despublicas dejan de salir en la próxima subida.</p></div>`;
}

function rightPanel(r: RoomDef): string {
  const tools: Tool[] = ['floor', ...CELL_KINDS];
  const e = ed.sel >= 0 ? r.enemies[ed.sel] : undefined;
  const warn = roomWarnings(r);
  return `<div class="cbox"><div class="cboxh">🧱 Terreno</div><div class="edtools">${tools.map((t) => { const c = CELL_INFO[t as CellKind | 'floor']; return `<button class="mini ${ed.tool === t ? 'on' : ''}" data-ed="tool" data-id="${t}" title="${esc(c.text)}">${c.icon} ${esc(c.name)}</button>`; }).join('')}</div>
      <div class="edtools"><button class="mini ${ed.tool === 'start' ? 'on' : ''}" data-ed="tool" data-id="start">🔵 Inicio de héroe (${r.starts.length})</button><button class="mini ${ed.tool === 'erase' ? 'on' : ''}" data-ed="tool" data-id="erase">🧽 Borrar</button><button class="mini" data-ed="fill" title="Lo que no se alcanza andando desde la casilla de inicio 1 pasa a estar fuera de la sala">⬛ Quitar lo inaccesible</button><button class="mini danger" data-ed="clear">Vaciar</button></div></div>
    <div class="cbox"><div class="cboxh">👹 Enemigos (${r.enemies.length})</div>
      <select data-edc="ekind" class="edsel">${enemyOptions(ed.kind)}</select>
      <div class="row sm" style="gap:6px;flex-wrap:wrap;margin-top:4px"><button class="mini ${ed.tool === 'enemy' ? 'on' : ''}" data-ed="tool" data-id="enemy">📍 Colocar</button>
        <label>Oleada: entra en la ronda <input type="number" class="ednum" data-edc="wave" min="1" max="30" value="${ed.wave}"></label></div>
      <div class="dim sm">Ronda 1 = desde el principio. Si no queda ningún enemigo, la siguiente oleada entra enseguida.</div></div>
    ${e ? enemyPanel(e) : '<div class="cbox dim sm">Selecciona un enemigo del tablero para cambiar su vida, daño, PA, PM, modificadores, oleada…</div>'}
    <div class="cbox"><div class="cboxh">🎯 Objetivo</div>
      <select data-edc="goal" class="edsel"><option value="kill" ${r.goal.kind === 'kill' ? 'selected' : ''}>Acabar con todos los enemigos</option><option value="survive" ${r.goal.kind === 'survive' ? 'selected' : ''}>Sobrevivir unas rondas</option><option value="targets" ${r.goal.kind === 'targets' ? 'selected' : ''}>Acabar con los marcados (★)</option></select>
      ${r.goal.kind === 'survive' ? `<label class="sm">Rondas <input type="number" class="ednum" data-edc="rounds" min="1" max="30" value="${r.goal.rounds}"></label>` : ''}</div>
    <div class="cbox"><div class="cboxh">📜 Historia y recompensa</div>
      <label class="sm">Al entrar (antes de colocarse)<textarea data-edc="intro" rows="3" maxlength="600" placeholder="Opcional: lo que veis al entrar…">${esc(r.intro ?? '')}</textarea></label>
      <label class="sm">Al ganar<textarea data-edc="outro" rows="2" maxlength="600" placeholder="Opcional">${esc(r.outro ?? '')}</textarea></label>
      <div class="sm">Recompensa extra para cada héroe:</div>
      <div class="labrow sm"><label>Oro <input type="number" class="ednum" data-edc="rgold" min="0" max="500" step="5" value="${r.reward?.gold ?? 0}"></label>
        <label>Escofinas <input type="number" class="ednum" data-edc="resc" min="0" max="9" value="${r.reward?.escofinas ?? 0}"></label></div>
      <div class="labrow sm"><label>Objeto <select data-edc="ritem">${[['-1', 'Ninguno'], ['0', 'Común o mejor'], ['1', 'Poco común o mejor'], ['2', 'Raro o mejor'], ['3', 'Legendario']].map(([v, n]) => `<option value="${v}" ${String(r.reward?.item ?? -1) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Reliquia <select data-edc="rrelic">${[['0', 'Ninguna'], ['1', 'Normal'], ['2', 'Rara']].map(([v, n]) => `<option value="${v}" ${String(r.reward?.relic ?? 0) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div></div>
    ${isCreatorAccount() ? '' : '<!--'}<div class="cbox"><div class="cboxh">🌍 Expediciones</div>
      <label class="row sm"><input type="checkbox" data-edc="published" ${r.published ? 'checked' : ''}> Publicada: puede salir en las expediciones</label>
      <label class="sm">Probabilidad cuando toca un ${KIND_NAME[r.kind].toLowerCase()} de la zona ${r.zone + 1}: <input type="number" class="ednum" data-edc="chance" min="1" max="100" value="${r.chance}">%</label>
      ${r.kind === 'boss' ? '<div class="dim sm">Las salas de jefe solo salen si el jefe de la partida está colocado en ella. Con 100% sustituyen siempre a la guarida normal (si hay varias del mismo jefe, sale una al azar).</div>' : r.kind === 'event' ? '<div class="dim sm">Las salas de evento salen en las casillas ❓ de evento del mapa: un combate con su historia y su recompensa en vez de un evento normal.</div>' : r.kind === 'elite' ? '<div class="dim sm">Con 100% sustituyen siempre al combate de élite normal de la zona.</div>' : ''}</div>${isCreatorAccount() ? '' : '-->'}
    ${warn.length ? `<div class="cbox edwarn">${warn.map((w) => `<div class="sm">⚠ ${esc(w)}</div>`).join('')}</div>` : '<div class="cbox sm good">✔ Sala lista</div>'}`;
}

function enemyPanel(e: RoomEnemy): string {
  const r = ed.room!, o = { ...zoneOpts(r.zone, 0, 1, e.kind), affixes: e.affixes ?? [] };
  const base = makeEnemy(e.kind, { x: 0, y: 0 }, 0, 1, o);
  const fin = applyMod(makeEnemy(e.kind, { x: 0, y: 0 }, 0, 1, o), e);
  const val = (k: keyof StatMod, u: UnitSpec): string => {
    switch (k) {
      case 'hp': return String(u.maxHp); case 'power': return `${u.power >= 0 ? '+' : ''}${Math.round(u.power)}`; case 'ap': return String(u.maxAp); case 'mp': return String(u.maxMp); case 'armor': return String(u.armor);
      case 'initiative': return String(u.initiative); case 'tackle': return String(u.tackle ?? 0); case 'dodge': return String(u.dodge ?? 0); case 'crit': return `${u.crit}%`; case 'shield': return String(u.shield); case 'range': return `+${u.statuses.reach?.stacks ?? 0}`;
    }
  };
  const m = e.mod ?? {};
  return `<div class="cbox edenemy"><div class="cboxh">✏️ ${esc(ENEMIES[e.kind]?.name ?? e.kind)} <span class="dim sm">(${e.x + 1}, ${e.y + 1})</span></div>
    <select data-edc="setkind" class="edsel">${enemyOptions(e.kind)}</select>
    <input class="edsel" data-edc="ename" maxlength="32" placeholder="Nombre propio (opcional): p. ej. Mordrak el Roto" value="${esc(e.name ?? '')}">
    <div class="row sm" style="gap:8px;flex-wrap:wrap;margin:4px 0"><label><input type="checkbox" data-edc="elite" ${e.elite ? 'checked' : ''}> ☠️ Élite</label><label><input type="checkbox" data-edc="egoal" ${e.goal ? 'checked' : ''}> ★ Objetivo</label>
      <label>Ronda <input type="number" class="ednum" data-edc="ewave" min="1" max="30" value="${Math.max(1, e.wave ?? 1)}"></label>
      <label>Solo con <select data-edc="emin">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${(e.min ?? 1) === n ? 'selected' : ''}>${n}+ jug.</option>`).join('')}</select></label></div>
    <table class="edstats"><tr class="dim sm"><td></td><td>Normal</td><td>Ajuste</td><td>Queda</td></tr>${STAT_KEYS.map((s) => `<tr><td>${esc(s.name)}</td><td class="dim">${val(s.k, base)}</td>
      <td class="edadj"><button class="mini" data-ed="stat" data-id="${s.k}:-1">−</button><b class="${m[s.k] ? (m[s.k]! > 0 ? 'good' : 'bad') : 'dim'}">${m[s.k] ? `${m[s.k]! > 0 ? '+' : ''}${m[s.k]}${s.unit ?? ''}` : '0'}</b><button class="mini" data-ed="stat" data-id="${s.k}:1">+</button></td>
      <td><b>${val(s.k, fin)}</b></td></tr>`).join('')}</table>
    <div class="dim sm">Valores en la primera sala de su zona con 1 jugador; en la partida se escalan como el resto de enemigos (zona, jugadores, ascensión).</div>
    <div class="lbl">Modificadores</div><div class="edaff">${Object.entries(AFFIXES).map(([id, a]) => `<label class="sm" title="${esc(a.text)}"><input type="checkbox" data-edc="affix" data-id="${id}" ${e.affixes?.includes(id) ? 'checked' : ''}> ${esc(a.name)}</label>`).join('')}</div>
    <div class="row" style="gap:4px;margin-top:6px"><button class="mini ${ed.tool === 'move' ? 'on' : ''}" data-ed="tool" data-id="move">✥ Mover</button><button class="mini" data-ed="edup">⧉ Copiar</button><button class="mini" data-ed="eclear">Quitar ajustes</button><button class="mini danger" data-ed="edel">🗑 Quitar</button></div></div>`;
}

/** Clic o arrastre sobre el tablero. */
function paint(p: Pos, drag: boolean): void {
  const r = ed.room!;
  const k = `${p.x},${p.y}`, t = ed.tool;
  if (t === 'enemy') {
    if (drag) return;
    const here = enemiesAt(r, p);
    const same = here.find((e) => Math.max(1, e.wave ?? 1) === ed.wave) ?? here[0];
    if (same) { ed.sel = r.enemies.indexOf(same); return changed(); }
    if (r.enemies.length >= 40) { ed.msg = 'Máximo 40 enemigos por sala'; return refresh(); }
    if (r.cells[k] && r.cells[k] !== 'trap' && r.cells[k] !== 'puddle' && r.cells[k] !== 'root') delete r.cells[k];
    r.starts = r.starts.filter((s) => s.x !== p.x || s.y !== p.y);
    r.enemies.push({ kind: ed.kind, x: p.x, y: p.y, ...(ed.wave > 1 ? { wave: ed.wave } : {}), ...(ENEMIES[ed.kind]?.ai === 'boss' ? { goal: r.goal.kind === 'targets' } : {}) });
    ed.sel = r.enemies.length - 1;
    return changed();
  }
  if (t === 'move') {
    const e = r.enemies[ed.sel];
    if (!e) return;
    e.x = p.x; e.y = p.y;
    if (r.cells[k] && r.cells[k] !== 'trap' && r.cells[k] !== 'puddle' && r.cells[k] !== 'root') delete r.cells[k];
    r.starts = r.starts.filter((s) => s.x !== p.x || s.y !== p.y);
    ed.tool = 'enemy';
    return changed();
  }
  if (t === 'start') {
    const i = startAt(r, p);
    if (i >= 0) { if (!drag) r.starts.splice(i, 1); }
    else {
      if (r.starts.length >= 12) { ed.msg = 'Máximo 12 casillas de inicio'; return refresh(); }
      delete r.cells[k];
      r.enemies = r.enemies.filter((e) => e.x !== p.x || e.y !== p.y || (e.wave ?? 0) > 1);
      r.starts.push({ ...p });
    }
    ed.sel = -1;
    return changed(!drag);
  }
  if (t === 'erase') {
    const before = r.enemies.length;
    r.enemies = r.enemies.filter((e) => e.x !== p.x || e.y !== p.y || Math.max(1, e.wave ?? 1) !== ed.wave);
    if (r.enemies.length !== before) ed.sel = -1;
    else { delete r.cells[k]; r.starts = r.starts.filter((s) => s.x !== p.x || s.y !== p.y); }
    return changed(!drag);
  }
  // terreno
  if (t === 'floor') delete r.cells[k];
  else {
    r.cells[k] = t;
    r.starts = r.starts.filter((s) => s.x !== p.x || s.y !== p.y);
    if (t === 'void' || t === 'wall' || t === 'brazier' || t === 'abyss') { const before = r.enemies.length; r.enemies = r.enemies.filter((e) => e.x !== p.x || e.y !== p.y); if (before !== r.enemies.length) ed.sel = -1; }
  }
  changed(!drag);
}

function download(name: string, data: unknown): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'sala';

function act(el: HTMLElement): void {
  const r = ed.room!, id = el.dataset.id ?? '';
  ed.msg = '';
  switch (el.dataset.ed) {
    case 'tool': ed.tool = id as Tool; if (id !== 'move' && id !== 'enemy') ed.sel = -1; return refresh();
    case 'iso': ed.board!.setIso(!ed.board!.iso); return refresh();
    case 'test': flush(); putRoom(r); ed.onTest?.(r); return;
    case 'exit': ed.onExit?.(); return;
    case 'open': { flush(); const x = myRooms().find((q) => q.id === id); if (x) { ed.room = x; ed.sel = -1; } return refresh(); }
    case 'copy': { const x = allRooms().find((q) => q.id === id); if (!x) return; flush(); ed.room = { ...cleanRoom(x)!, id: newRoom().id, name: `${x.name} (copia)`, published: false }; ed.sel = -1; putRoom(ed.room); return refresh(); }
    case 'new': flush(); ed.room = newRoom(r.zone); ed.sel = -1; putRoom(ed.room); return refresh();
    case 'dup': flush(); ed.room = { ...cleanRoom(r)!, id: newRoom().id, name: `${r.name} (copia)`.slice(0, 40), published: false }; ed.sel = -1; putRoom(ed.room); ed.msg = 'Sala duplicada'; return refresh();
    case 'del': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = '¿Seguro? Pulsa otra vez'; return; }
      if (ed.saveTimer) { clearTimeout(ed.saveTimer); ed.saveTimer = 0; }
      dropRoom(r.id);
      ed.room = myRooms().at(-1) ?? newRoom(r.zone); ed.sel = -1; ed.msg = 'Sala borrada';
      return refresh();
    }
    case 'export': flush(); download(`sala_${slug(r.name)}.json`, r); return;
    case 'exportall': flush(); download('salas.json', myRooms()); return;
    case 'tpl': {
      const v = (document.getElementById('edtpl') as HTMLSelectElement | null)?.value ?? '';
      const [k, z, id] = v.split(':');
      if (!id) return;
      const zd = ZONES[Number(z)]!, boss = zd.bosses.find((b) => b.id === id);
      flush();
      ed.room = templateRoom(Number(z), k === 'boss' ? 'boss' : 'elite', id, boss?.guard ?? [], zd.pools[1]);
      ed.sel = -1; putRoom(ed.room); ed.msg = 'Plantilla creada: retócala y publícala';
      return refresh();
    }
    case 'publish': {
      flush();
      const list = myRooms().filter((x) => x.published);
      el.setAttribute('disabled', '');
      el.textContent = 'Subiendo…';
      void publishRooms(list).then((err) => { ed.msg = err ?? `${list.length} sala${list.length === 1 ? '' : 's'} en el juego para todos`; refresh(); });
      return;
    }
    case 'fill': {
      // rellena con «fuera de la sala» todo lo que no esté conectado con la primera casilla de inicio
      const start = r.starts[0];
      if (!start) { ed.msg = 'Pon antes una casilla de inicio'; return refresh(); }
      const seen = new Set([`${start.x},${start.y}`]), q = [start];
      while (q.length) { const p = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = { x: p.x + dx, y: p.y + dy }, k = `${n.x},${n.y}`; if (n.x < 0 || n.y < 0 || n.x >= r.w || n.y >= r.h || seen.has(k) || r.cells[k] === 'void' || r.cells[k] === 'wall') continue; seen.add(k); q.push(n); } }
      for (let x = 0; x < r.w; x++) for (let y = 0; y < r.h; y++) if (!seen.has(`${x},${y}`) && !r.cells[`${x},${y}`]) r.cells[`${x},${y}`] = 'void';
      return changed();
    }
    case 'clear':
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = '¿Vaciar todo?'; return; }
      r.cells = {}; r.enemies = []; ed.sel = -1; return changed();
    case 'stat': {
      const e = r.enemies[ed.sel]; if (!e) return;
      const [k, d] = id.split(':') as [keyof StatMod, string];
      const s = STAT_KEYS.find((x) => x.k === k)!;
      const m = (e.mod ??= {});
      m[k] = Math.max(s.min, Math.min(s.max, (m[k] ?? 0) + Number(d) * s.step));
      if (!m[k]) delete m[k];
      if (!Object.keys(m).length) delete e.mod;
      return changed();
    }
    case 'edel': r.enemies.splice(ed.sel, 1); ed.sel = -1; ed.tool = 'enemy'; return changed();
    case 'eclear': { const e = r.enemies[ed.sel]; if (e) { delete e.mod; delete e.affixes; delete e.elite; } return changed(); }
    case 'edup': { const e = r.enemies[ed.sel]; if (!e) return; r.enemies.push(JSON.parse(JSON.stringify(e)) as RoomEnemy); ed.sel = r.enemies.length - 1; ed.tool = 'move'; return changed(); }
  }
}

function onChange(el: HTMLInputElement | HTMLSelectElement): void {
  const r = ed.room!, v = el.value, e = r.enemies[ed.sel];
  const num = (lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(Number(v)) || lo));
  switch (el.dataset.edc) {
    case 'zone': r.zone = num(0, 3); break;
    case 'kind': r.kind = (v === 'elite' || v === 'boss' || v === 'event' ? v : 'combat'); break;
    case 'w': resizeRoom(r, num(ROOM_MIN.w, ROOM_MAX.w), r.h); ed.sel = -1; break;
    case 'h': resizeRoom(r, r.w, num(ROOM_MIN.h, ROOM_MAX.h)); ed.sel = -1; break;
    case 'ekind': ed.kind = ENEMIES[v] ? v : ed.kind; ed.tool = 'enemy'; return refresh();
    case 'wave': ed.wave = num(1, 30); return refresh();
    case 'goal': r.goal = v === 'survive' ? { kind: 'survive', rounds: 5 } : v === 'targets' ? { kind: 'targets' } : { kind: 'kill' }; break;
    case 'rounds': if (r.goal.kind === 'survive') r.goal.rounds = num(1, 30); break;
    case 'published': r.published = isCreatorAccount() && (el as HTMLInputElement).checked; break;
    case 'chance': r.chance = num(1, 100); break;
    case 'setkind': if (e && ENEMIES[v]) e.kind = v; break;
    case 'ename': if (e) { const n = v.trim().slice(0, 32); if (n) e.name = n; else delete e.name; } break;
    case 'intro': { const s = v.trim().slice(0, 600); if (s) r.intro = s; else delete r.intro; break; }
    case 'outro': { const s = v.trim().slice(0, 600); if (s) r.outro = s; else delete r.outro; break; }
    case 'rgold': case 'resc': case 'ritem': case 'rrelic': {
      const rw = { ...(r.reward ?? {}) }, n = Number(v) || 0;
      if (el.dataset.edc === 'rgold') { if (n > 0) rw.gold = Math.min(500, Math.round(n)); else delete rw.gold; }
      if (el.dataset.edc === 'resc') { if (n > 0) rw.escofinas = Math.min(9, Math.round(n)); else delete rw.escofinas; }
      if (el.dataset.edc === 'ritem') { if (n >= 0 && v !== '-1') rw.item = Math.min(3, n); else delete rw.item; }
      if (el.dataset.edc === 'rrelic') { if (n > 0) rw.relic = Math.min(2, n); else delete rw.relic; }
      if (Object.keys(rw).length) r.reward = rw; else delete r.reward;
      break;
    }
    case 'elite': if (e) { if ((el as HTMLInputElement).checked) e.elite = true; else delete e.elite; } break;
    case 'egoal': if (e) { if ((el as HTMLInputElement).checked) e.goal = true; else delete e.goal; } break;
    case 'ewave': if (e) { const w = num(1, 30); if (w > 1) e.wave = w; else delete e.wave; } break;
    case 'emin': if (e) { const n = num(1, 4); if (n > 1) e.min = n; else delete e.min; } break;
    case 'affix': if (e) { const id = el.dataset.id!; const on = (el as HTMLInputElement).checked; e.affixes = [...new Set([...(e.affixes ?? []).filter((a) => a !== id), ...(on ? [id] : [])])]; if (!e.affixes.length) delete e.affixes; } break;
    default: return;
  }
  changed();
}

async function importFile(f: File): Promise<void> {
  try {
    const data = JSON.parse(await f.text()) as unknown;
    const list = (Array.isArray(data) ? data : [data]).map(cleanRoom).filter((x): x is RoomDef => !!x);
    for (const x of list) putRoom(x);
    if (list.length) ed.room = list.at(-1)!;
    ed.msg = list.length ? `${list.length} sala${list.length > 1 ? 's' : ''} importada${list.length > 1 ? 's' : ''}` : 'El archivo no tiene salas válidas';
  } catch { ed.msg = 'No se pudo leer el archivo'; }
  ed.sel = -1;
  refresh();
}

// eventos del editor (una sola vez)
document.addEventListener('click', (ev) => {
  if (ui.screen !== 'editor' || !ed.room) return;
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-ed]');
  if (el && !(el as HTMLButtonElement).disabled) act(el);
});
document.addEventListener('change', (ev) => {
  if (ui.screen !== 'editor' || !ed.room) return;
  const el = ev.target as HTMLInputElement;
  if (el.id === 'edimport' && el.files?.[0]) { void importFile(el.files[0]); el.value = ''; return; }
  if (el.dataset?.edc) onChange(el);
});
document.addEventListener('input', (ev) => {
  if (ui.screen !== 'editor' || !ed.room) return;
  const el = ev.target as HTMLInputElement;
  if (el.id === 'edname') { ed.room.name = el.value.slice(0, 40) || 'Sala'; changed(false); }
});
