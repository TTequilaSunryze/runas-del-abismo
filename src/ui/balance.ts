// Pantalla de equilibrio del creador: estadísticas de cada clase, cada número de cada hechizo y cada enemigo.
// Los cambios se aplican al momento (para probarlos en el laboratorio) y se suben para todos con un botón.
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { ENEMIES } from '../content/enemies';
import { catalogSpells } from '../content/spellCatalog';
import { CLASS_STATS, ENEMY_STATS, SPELL_FLAGS, SPELL_LABEL, balanceSize, getPath, groupOf, originals, spellPaths, stepOf, type Balance, type Group } from '../game/balance';
import { ENEMY_ZONE, ZONE_SHORT } from '../game/salas';
import { discardDraft, draftBalance, draftPending, liveBalance, publishBalance, setDraft, testDraft } from '../net/balance';
import type { ClassId } from '../core/state';
import { esc, tip, ui } from './ctx';
import { spellIcon, spellTip } from './icons';
import { ANIM_KEYS, animMul, type AnimKey } from '../content/animSpeed';
import { sheetPreview } from '../render/board';

const st = {
  tab: 'heroes' as 'heroes' | 'enemies',
  cls: 'zorro' as ClassId,
  enemy: 'esqueleto',
  spell: '',
  find: '',
  /** animación de la vista previa */
  panim: 'idle' as AnimKey,
  msg: '',
  onTest: null as ((cls: ClassId) => void) | null,
  onExit: null as (() => void) | null,
};
const GROUP_NAME: Record<Group, string> = { common: 'Comunes', elite: 'Élites', boss: 'Jefes' };

export function balanceScreen(opts: { onTest: (cls: ClassId) => void; onExit: () => void; cls?: ClassId }): void {
  st.onTest = opts.onTest; st.onExit = opts.onExit;
  if (opts.cls && (PLAYABLE as string[]).includes(opts.cls)) st.cls = opts.cls;
  testDraft(true);
  ui.screen = 'balance';
  requestAnimationFrame(previewLoop);
  ui.root.classList.add('combatmode');
  ui.root.innerHTML = `<div id="batop" class="bar cinfo edtop"></div><div class="bagrid"><aside id="baleft" class="cside edside"></aside><main id="bamain" class="bamain"></main></div>`;
  paint();
}

export function closeBalance(): void { testDraft(false); ui.root.classList.remove('combatmode'); }

function paint(): void {
  const b = draftBalance(), n = balanceSize(b), pending = draftPending(), live = liveBalance();
  document.getElementById('batop')!.innerHTML = `<b>⚖️ Equilibrio</b>
    <button class="mini ${st.tab === 'heroes' ? 'on' : ''}" data-ba="tab" data-id="heroes">🧙 Héroes y habilidades</button><button class="mini ${st.tab === 'enemies' ? 'on' : ''}" data-ba="tab" data-id="enemies">👹 Enemigos</button>
    <span class="sm dim">${n} valor${n === 1 ? '' : 'es'} cambiado${n === 1 ? '' : 's'}${live.t ? ` · subido el ${new Date(live.t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
    ${pending ? '<span class="sm bad">Cambios sin subir (ya se aplican en tus pruebas)</span>' : '<span class="sm good">Todo subido</span>'}
    <span class="grow"></span>${st.msg ? `<span class="sm good">${esc(st.msg)}</span>` : ''}
    <button data-ba="test">🧪 Probar en el laboratorio</button>
    <button class="pri" data-ba="publish" ${pending ? '' : 'disabled'}>🌍 Subir a todos</button>
    <button class="mini" data-ba="discard" ${pending ? '' : 'disabled'}>Descartar cambios</button>
    <button data-ba="exit">Volver</button>`;
  document.getElementById('baleft')!.innerHTML = st.tab === 'heroes' ? heroList(b) : enemyList(b);
  document.getElementById('bamain')!.innerHTML = st.tab === 'heroes' ? heroMain(b) : enemyMain(b);
}

const changedCount = (r: Record<string, unknown> | undefined): number => Object.keys(r ?? {}).length;
const spellChanges = (b: Balance, ids: string[]): number => ids.reduce((s, id) => s + changedCount(b.spells[id]), 0);

function heroList(b: Balance): string {
  return `<div class="cbox"><div class="cboxh">Clases</div><div class="edlist">${PLAYABLE.map((c) => { const k = changedCount(b.classes[c]) + spellChanges(b, catalogSpells(c));
    return `<button class="edroom ${c === st.cls ? 'on' : ''}" data-ba="cls" data-id="${c}"><b>${esc(CLASSES[c].name)}</b><small>${k ? `✎ ${k} cambio${k === 1 ? '' : 's'}` : 'sin cambios'}</small></button>`; }).join('')}</div></div>`;
}

function enemyList(b: Balance): string {
  const f = st.find.trim().toLowerCase();
  const groups = ([0, 1, 2, 3, -1] as const).map((z) => {
    const ids = Object.keys(ENEMIES).filter((id) => ENEMY_ZONE[id] === z && (!f || ENEMIES[id]!.name.toLowerCase().includes(f)));
    if (!ids.length) return '';
    return `<div class="lbl">${z < 0 ? 'Aliados' : `Zona ${z + 1} · ${esc(ZONE_SHORT[z])}`}</div>${ids.map((id) => { const e = ENEMIES[id]!, k = changedCount(b.enemies[id]) + spellChanges(b, [e.spell, ...(e.more ?? [])]); const g = groupOf(id);
      return `<button class="edroom ${id === st.enemy ? 'on' : ''}" data-ba="enemy" data-id="${id}"><b>${g === 'boss' ? '👑 ' : g === 'elite' ? '☠️ ' : ''}${esc(e.name)}</b><small>${k ? `✎ ${k} cambio${k === 1 ? '' : 's'}` : 'sin cambios'}</small></button>`; }).join('')}`;
  }).join('');
  return `<div class="cbox"><div class="cboxh">Enemigos</div><input class="edsel" id="bafind" placeholder="Buscar…" value="${esc(st.find)}"><div class="edlist" style="max-height:none">${groups}</div></div>`;
}

/** Fila de un valor: original, botones −/+, valor y volver al original. */
function row(scope: string, id: string, path: string, label: string, orig: number, cur: number, step = 1): string {
  const changed = Math.abs(cur - orig) > 1e-9;
  const fmt = (v: number): string => (step < 1 ? v.toFixed(2) : String(v));
  return `<tr class="${changed ? 'bach' : ''}"><td>${esc(label)}</td><td class="dim">${fmt(orig)}</td>
    <td class="edadj"><button class="mini" data-ba="add" data-id="${scope}|${id}|${path}|${-step}">−</button><input type="number" class="ednum" data-bav="${scope}|${id}|${path}" step="${step}" value="${fmt(cur)}"><button class="mini" data-ba="add" data-id="${scope}|${id}|${path}|${step}">+</button></td>
    <td>${changed ? `<span class="${cur > orig ? 'good' : 'bad'}">${cur > orig ? '▲' : '▼'} ${fmt(Math.abs(cur - orig))}</span> <button class="mini" data-ba="reset" data-id="${scope}|${id}|${path}" title="Volver al original">↺</button>` : ''}</td></tr>`;
}

function heroMain(b: Balance): string {
  const c = st.cls, o = originals().classes[c] as Record<string, number>;
  const spells = catalogSpells(c);
  if (!spells.includes(st.spell)) st.spell = spells[0] ?? '';
  return `<div class="bacols"><div class="cbox"><div class="cboxh">${esc(CLASSES[c].name)} · estadísticas <button class="mini" data-ba="resetall" data-id="class|${c}">↺ Todo</button></div>
      <table class="edstats batable"><tr class="dim sm"><td></td><td>Original</td><td>Valor</td><td></td></tr>${CLASS_STATS.map(([k, name]) => row('class', c, k, name, o[k] ?? 0, b.classes[c]?.[k] ?? o[k] ?? 0)).join('')}</table>
      <div class="dim sm">La vida es la del nivel 1 (cada nivel suma un 8%). Daño = daño plano de la clase, que se suma al de cada nivel y al del equipo.</div></div>
    ${spellBlock(b, spells, 'Habilidades de la clase')}</div>${animBlock(b, c, true)}`;
}

function enemyMain(b: Balance): string {
  const id = ENEMIES[st.enemy] ? st.enemy : 'esqueleto', o = originals().enemies[id] as Record<string, unknown>, e = ENEMIES[id]!;
  const ov = (path: string): number => { const v = getPath(o, path); if (typeof v === 'number') return v; return path === 'power' || path === 'crit' || path.startsWith('resist.') ? 0 : path === 'tackle' ? (o.ai === 'boss' ? 10 : o.ai === 'melee' ? 5 : o.ai === 'pillar' ? 0 : 2) : path === 'dodge' ? (o.ai === 'boss' ? 6 : o.ai === 'ranged' ? 5 : 3) : 0; };
  const spells = [String(o.spell), ...((o.more as string[] | undefined) ?? [])];
  if (!spells.includes(st.spell)) st.spell = spells[0]!;
  const g = groupOf(id), gv = b.groups[g] ?? {};
  return `<div class="bacols"><div><div class="cbox"><div class="cboxh">${esc(e.name)} · estadísticas <button class="mini" data-ba="resetall" data-id="enemy|${id}">↺ Todo</button></div>
      <table class="edstats batable"><tr class="dim sm"><td></td><td>Original</td><td>Valor</td><td></td></tr>${ENEMY_STATS.map(([k, name]) => row('enemy', id, k, name, ov(k), b.enemies[id]?.[k] ?? ov(k))).join('')}</table>
      <div class="dim sm">Valores base: en la partida la vida se multiplica (×2,75 y según zona, sala, jugadores y ascensión) y el daño crece con la profundidad. El placaje de los cuerpo a cuerpo sube 1 cada 3 salas si no lo fijas.</div></div>
    <div class="cbox"><div class="cboxh">Todos los ${GROUP_NAME[g].toLowerCase()} a la vez</div>
      <table class="edstats batable">${row('group', g, 'hp', 'Vida extra %', 0, gv.hp ?? 0, 5)}${row('group', g, 'power', 'Daño extra', 0, gv.power ?? 0)}</table>
      <div class="dim sm">Se suma a lo de cada enemigo. Grupos: ${(['common', 'elite', 'boss'] as Group[]).map((x) => `${GROUP_NAME[x]}${b.groups[x] ? ` (${b.groups[x]!.hp ? `${b.groups[x]!.hp! > 0 ? '+' : ''}${b.groups[x]!.hp}% vida` : ''}${b.groups[x]!.power ? ` ${b.groups[x]!.power! > 0 ? '+' : ''}${b.groups[x]!.power} daño` : ''})` : ''}`).join(' · ')}</div></div></div>
    ${spellBlock(b, spells, 'Ataques del enemigo')}</div>${animBlock(b, id, false)}`;
}

const ANIM_NAME: Record<AnimKey, string> = { idle: 'Quieto (reposo)', walk: 'Caminar', attack: 'Ataque / hechizo', hurt: 'Herido', death: 'Muerte' };
/** Velocidad de las animaciones de un personaje (y, en enemigos, de todos a la vez), con vista previa. */
function animBlock(b: Balance, kind: string, hero: boolean): string {
  const rowA = (k: string, a: AnimKey): string => {
    const v = b.anim?.[k]?.[a] ?? 1;
    return `<tr class="${v !== 1 ? 'bach' : ''}"><td>${ANIM_NAME[a]}</td><td class="edadj"><button class="mini" data-ba="anim" data-id="${k}|${a}|-0.25">−</button><b>×${v.toFixed(2)}</b><button class="mini" data-ba="anim" data-id="${k}|${a}|0.25">+</button></td>
      <td class="sm dim">${v === 1 ? 'normal' : v > 1 ? `${Math.round((v - 1) * 100)}% más lenta` : `${Math.round((1 - v) * 100)}% más rápida`}</td><td>${v !== 1 ? `<button class="mini" data-ba="anim" data-id="${k}|${a}|reset">↺</button>` : ''}</td></tr>`;
  };
  const has = !!sheetPreview(kind, hero);
  return `<div class="bacols" style="margin-top:8px"><div class="cbox"><div class="cboxh">🎞️ Velocidad de animaciones${hero ? '' : ` · ${esc(ENEMIES[kind]?.name ?? kind)}`}</div>
      ${has ? '' : '<div class="dim sm">Este personaje aún no tiene hoja de animación propia.</div>'}
      <table class="edstats batable">${ANIM_KEYS.map((a) => rowA(kind, a)).join('')}</table>
      <div class="dim sm">×2 = dura el doble (más lenta). Afecta a las dos fases de los jefes.</div>
      ${hero ? '' : `<div class="lbl">Todos los enemigos a la vez</div><table class="edstats batable">${ANIM_KEYS.map((a) => rowA('*', a)).join('')}</table>`}</div>
    <div class="cbox"><div class="cboxh">Vista previa</div>
      <div class="labrow">${ANIM_KEYS.map((a) => `<button class="mini ${st.panim === a ? 'on' : ''}" data-ba="panim" data-id="${a}">${ANIM_NAME[a].split(' ')[0]}</button>`).join('')}</div>
      <canvas id="baprev" width="320" height="320" data-kind="${esc(kind)}" data-hero="${hero ? 1 : 0}" class="baprev"></canvas></div></div>`;
}

/** Dibuja la vista previa con los mismos tiempos que el tablero. */
function previewLoop(): void {
  const cv = document.getElementById('baprev') as HTMLCanvasElement | null;
  if (ui.screen !== 'balance') return;
  requestAnimationFrame(previewLoop);
  if (!cv) return;
  const kind = cv.dataset.kind ?? '', hero = cv.dataset.hero === '1', s = sheetPreview(kind, hero), g = cv.getContext('2d')!;
  g.fillStyle = '#1a1620'; g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0, cv.height - 30); g.lineTo(cv.width, cv.height - 30); g.stroke();
  if (!s) return;
  const a = st.panim, en = !hero, mul = animMul(kind, a, en), now = performance.now();
  const name = a === 'attack' && !s.frames.attack ? 'cast' : a, img = s.img[name] ?? s.img.idle, n = s.frames[name] ?? s.frames.idle ?? 1;
  if (!img || !img.complete || !img.naturalWidth) return;
  let fr = 0;
  if (a === 'idle') { const ms = Math.max(280, 3000 / n) * mul, loop = n > 2 ? n * 2 - 2 : n, k = Math.floor(now / ms) % loop; fr = k < n ? k : loop - k; }
  else if (a === 'walk') fr = Math.floor(now / ((2 * 380 * mul) / n)) % n;
  else { const total = (a === 'attack' ? 800 : a === 'hurt' ? 120 * n : 1000) * mul, k = (now % (total + 700)) / total; fr = Math.min(n - 1, Math.floor(k * n)); }
  const k = Math.min(2, (cv.height - 40) / s.size);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, fr * s.size, 0, s.size, s.size, (cv.width - s.size * k) / 2, cv.height - 30 - s.size * k + 4 * k, s.size * k, s.size * k);
}

function spellBlock(b: Balance, ids: string[], title: string): string {
  const id = st.spell, d = SPELLS[id], o = originals().spells[id] as Record<string, unknown> | undefined;
  const grid = `<div class="baspells">${ids.filter((x) => SPELLS[x]).map((x) => { const k = changedCount(b.spells[x]); return `<button class="kpick ${x === id ? 'on' : ''}" data-ba="spell" data-id="${x}" ${tip(spellTip(SPELLS[x]!))}>${spellIcon(SPELLS[x]!)}<small>${esc(SPELLS[x]!.name)}${k ? ` ✎${k}` : ''}</small></button>`; }).join('')}</div>`;
  if (!d || !o) return `<div><div class="cbox"><div class="cboxh">${title}</div>${grid}</div></div>`;
  const paths = spellPaths(id);
  const ov = (p: string): number => { const v = getPath(o, p); return typeof v === 'number' ? v : p === 'range.0' || p === 'range.1' ? 0 : 0; };
  const cur = (p: string): number => { const v = b.spells[id]?.[p]; return typeof v === 'number' ? v : ov(p); };
  const flag = (k: string): boolean => { const v = b.spells[id]?.[k]; return typeof v === 'boolean' ? v : !!o[k]; };
  return `<div><div class="cbox"><div class="cboxh">${title}</div>${grid}</div>
    <div class="bacols2"><div class="cbox"><div class="cboxh">${spellIcon(d, false)} ${esc(d.name)} <button class="mini" data-ba="resetall" data-id="spell|${id}">↺ Todo</button></div>
      <table class="edstats batable"><tr class="dim sm"><td></td><td>Original</td><td>Valor</td><td></td></tr>${paths.map((p) => row('spell', id, p, SPELL_LABEL[p] ?? p, ov(p), cur(p), stepOf(p, ov(p)))).join('')}</table>
      <div class="labrow sm">${SPELL_FLAGS.map(([k, name]) => `<label><input type="checkbox" data-bac="spell|${id}|${k}" ${flag(k) ? 'checked' : ''}> ${esc(name)}</label>`).join('')}</div>
      <label class="sm">Descripción<textarea data-bat="${id}" rows="3" maxlength="600">${esc(String(b.spells[id]?.text ?? o.text ?? ''))}</textarea></label>
      <div class="dim sm">Algunas mecánicas especiales (semillas, cargador, furia…) tienen números propios del motor que no salen aquí. Si cambias un número que aparece en la descripción, actualízala también.</div></div>
    <div class="cbox"><div class="cboxh">Así queda</div><div class="tipcard">${spellTip(d)}</div></div></div></div>`;
}

/** Cambia un valor del borrador (si vuelve al original, se quita el ajuste). */
function setVal(scope: string, id: string, path: string, v: number | boolean | string | null): void {
  const b = draftBalance();
  const o = originals();
  if (scope === 'group') {
    const g = (b.groups[id as Group] ??= {});
    if (v === null || v === 0) delete g[path as 'hp' | 'power']; else g[path as 'hp' | 'power'] = v as number;
    if (!Object.keys(g).length) delete b.groups[id as Group];
  } else {
    const reg = scope === 'class' ? b.classes : scope === 'enemy' ? b.enemies : b.spells;
    const origObj = scope === 'class' ? o.classes[id] : scope === 'enemy' ? o.enemies[id] : o.spells[id];
    const ov = getPath(origObj, path);
    const rec = ((reg as Record<string, Record<string, unknown>>)[id] ??= {});
    const same = v === null || (typeof v === 'boolean' ? v === !!ov : typeof v === 'number' ? v === origNum(scope, id, path) : v === ov);
    if (same) delete rec[path]; else rec[path] = v;
    if (!Object.keys(rec).length) delete (reg as Record<string, unknown>)[id];
  }
  setDraft(b);
  st.msg = '';
  paint();
}

function curVal(scope: string, id: string, path: string): number {
  const b = draftBalance();
  if (scope === 'group') return b.groups[id as Group]?.[path as 'hp' | 'power'] ?? 0;
  const reg = scope === 'class' ? b.classes : scope === 'enemy' ? b.enemies : b.spells;
  const v = (reg as Record<string, Record<string, unknown>>)[id]?.[path];
  return typeof v === 'number' ? v : origNum(scope, id, path);
}
/** Valor original (o el que se usa por defecto si el registro no lo trae). */
function origNum(scope: string, id: string, path: string): number {
  if (scope === 'group') return 0;
  const o = originals(), ov = getPath(scope === 'class' ? o.classes[id] : scope === 'enemy' ? o.enemies[id] : o.spells[id], path);
  if (typeof ov === 'number') return ov;
  if (scope === 'enemy' && (path === 'tackle' || path === 'dodge')) { const e = o.enemies[id] as { ai?: string }; return path === 'tackle' ? (e.ai === 'boss' ? 10 : e.ai === 'melee' ? 5 : e.ai === 'pillar' ? 0 : 2) : (e.ai === 'boss' ? 6 : e.ai === 'ranged' ? 5 : 3); }
  return 0;
}

document.addEventListener('click', (ev) => {
  if (ui.screen !== 'balance') return;
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-ba]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const id = el.dataset.id ?? '';
  switch (el.dataset.ba) {
    case 'tab': st.tab = id === 'enemies' ? 'enemies' : 'heroes'; st.spell = ''; return paint();
    case 'cls': st.cls = id as ClassId; st.spell = ''; return paint();
    case 'enemy': st.enemy = id; st.spell = ''; return paint();
    case 'spell': st.spell = id; return paint();
    case 'panim': st.panim = id as AnimKey; return paint();
    case 'anim': {
      const [k, a, d] = id.split('|') as [string, AnimKey, string];
      const b = draftBalance(), cur = b.anim?.[k]?.[a] ?? 1, v = d === 'reset' ? 1 : Math.max(0.25, Math.min(6, Math.round((cur + Number(d)) * 100) / 100));
      const rec = ((b.anim ??= {})[k] ??= {});
      if (v === 1) delete rec[a]; else rec[a] = v;
      if (!Object.keys(rec).length) delete b.anim[k];
      st.panim = a;
      setDraft(b); return paint();
    }
    case 'add': { const [scope, x, path, d] = id.split('|') as [string, string, string, string]; const v = Math.round((curVal(scope, x, path) + Number(d)) * 100) / 100; return setVal(scope, x, path, v); }
    case 'reset': { const [scope, x, path] = id.split('|') as [string, string, string]; return setVal(scope, x, path, null); }
    case 'resetall': {
      const [scope, x] = id.split('|') as [string, string];
      const b = draftBalance();
      if (scope === 'class') delete b.classes[x]; else if (scope === 'enemy') delete b.enemies[x]; else delete b.spells[x];
      setDraft(b); return paint();
    }
    case 'test': st.onTest?.(st.cls); return;
    case 'exit': st.onExit?.(); return;
    case 'discard':
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = '¿Seguro? Pulsa otra vez'; return; }
      discardDraft(); st.msg = 'Borrador descartado'; return paint();
    case 'publish':
      el.setAttribute('disabled', ''); el.textContent = 'Subiendo…';
      void publishBalance().then((err) => { st.msg = err ?? 'Equilibrio subido: ya lo tienen todos los jugadores'; paint(); });
      return;
  }
});
document.addEventListener('change', (ev) => {
  if (ui.screen !== 'balance') return;
  const el = ev.target as HTMLInputElement;
  if (el.dataset.bav) { const [scope, x, path] = el.dataset.bav.split('|') as [string, string, string]; const n = Number(el.value); if (Number.isFinite(n)) setVal(scope, x, path, Math.round(n * 100) / 100); }
  else if (el.dataset.bac) { const [, x, k] = el.dataset.bac.split('|') as [string, string, string]; setVal('spell', x, k, el.checked); }
  else if (el.dataset.bat) { const x = el.dataset.bat, o = originals().spells[x] as { text?: string }; const v = el.value.trim(); setVal('spell', x, 'text', !v || v === o.text ? null : v); }
});
document.addEventListener('input', (ev) => {
  if (ui.screen !== 'balance') return;
  const el = ev.target as HTMLInputElement;
  if (el.id === 'bafind') { st.find = el.value; const left = document.getElementById('baleft'); if (left) { left.innerHTML = enemyList(draftBalance()); const f = document.getElementById('bafind') as HTMLInputElement; f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
});
