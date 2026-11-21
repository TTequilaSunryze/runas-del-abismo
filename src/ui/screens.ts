// Pantallas fuera del combate: inicio, sala, mapa, tienda, evento y final.
import { CLASSES, PLAYABLE, findRoute } from '../core/classes/classes';
import { classStripUrl } from '../render/sprites';
import { SPELLS } from '../core/classes/spells';
import type { ClassId } from '../core/state';
import { POTION_HEAL, POTION_PRICE, eventDef, heroMaxHp, type RunState } from '../game/run';
import { TURN_SECONDS } from '../game/session';
import { HALL_SIZE, achievementCount, listedAchievements, MASTERY_XP, ecosFor, masteryOf, masteryProgress, masteryText, meta, myTeam, saveMeta, openRoutes, routeNeeds, settle } from '../game/meta';
import { currentAccount } from '../net/account';
import { friendsStatus } from '../net/social';
import type { Champion } from '../game/run';
import { ASCENSION, DAILY_MODS, MAX_MODS, OMENS, modConflict, modDef, modEcos } from '../content/modes';
import { ALLIES } from '../content/enemies';
import { readSnapshot } from '../game/snapshot';
import { RELICS } from '../content/relics';
import { championOf, dailyOf, dailyScore, lastZone } from '../game/run';
import { CLASS_STORY, ENDING_LOST, ENDING_WON, TUTORIAL, ZONE_STORY } from '../content/story';
import { esc, mine, store, tip, today, ui } from './ctx';
import { NODE_ICON, itemIcon, spellIcon, spellTip } from './icons';
import { advanceBar, blessingBar, boonRow, diffHtml, itemHtml, mapSvg, pendingRows, sidePanel, topBar, volumeControl } from './panels';
import { CONSUMABLES, MAX_CONSUMABLE } from '../content/boons';
import { CHEST_CURSE_CHANCE, HEAT, HEAT_HOT, HEAT_MAX, HEAT_OVERLOAD, HONE_COST, SCRAP_YIELD, curseOf, heatTier, pactOf, recalibratePrice } from '../content/pacts';
import { REST_OPTIONS, itemByRef, recalStats, restHeal, restText } from '../game/rooms';
import { altarScene, chestScene, forgeScene, restScene, shrineScene } from './scenes';
import { STAT_NAME, type Item } from '../core/items/items';
import { MAX_SPELL_UPS, UPGRADES } from '../core/upgrades';
import { archiveTotal, BESTIARY, CATEGORIES, CAT_NAME, DOCUMENTED_KILLS, GRIMOIRE, LEVEL_NAME, beastDef, completion, entriesOf } from '../game/archive';
import { activeContracts, refreshContracts, type Contract } from '../game/contracts';
import { CATALOG, CAT_NAME as SHOP_CAT, RARITY_NAME, archiveLook, currentLook, emblemOf, grantUnlocks, itemState, markSeen, owns, priceFor, reqMet, reqText, shopItem, unseenOwned, type ShopCat, type ShopItem } from '../game/shop';
import { auraDef, paletteDef } from '../render/palettes';
import { SPECIALS, SPECIAL_TYPE_NAME, evaluateSpecials, rewardName, specialRows } from '../game/specials';
import { frameDef, titleName } from '../game/cosmetics';
import { ATLAS_CATS, CHRONICLE_CATS, MAX_LV, MASTERED_AT, type AtlasCat, type ChronicleCat } from '../game/archiveData';
import { ATLAS, ATLAS_DONE_TEXT, ATLAS_NAME, ATLAS_STATE_NAME, CHRONICLES, CHRONICLE_NAME, CHRONICLE_STATE_NAME, atlasEntry, atlasProgress, chronicleEntry, chronicleProgress } from '../game/atlas';
import { BLESSINGS } from '../core/boonmods';
import { unitPortraitUrl } from '../render/sprites';
import { setCombatBg, setMenuScene } from '../render/menubg';
import { NODE_NAME, heroSpec, upCount, upgradeChoices } from '../game/run';

const RAR = ['ir0', 'ir1', 'ir2', 'ir3'];

/** Renueva los contratos si cambió el día o la semana y lo guarda en el momento. */
const ensureContracts = (m: ReturnType<typeof meta>): Contract[] => { if (refreshContracts(m)) saveMeta(); return activeContracts(m); };
/** Cabecera común del Archivo: colección global y navegación entre todas sus secciones (incluidos los Contratos). */
function archiveHeader(desc: string): string {
  const m = meta(), t = archiveTotal(), pend = contractsReady(m) + specialReady(m);
  const nav: Array<[typeof ui.arcCat, string]> = [
    ...CATEGORIES.map((c): [typeof ui.arcCat, string] => { const p = completion(c); return [c, `${CAT_NAME[c]} ${p.found}/${p.total}`]; }),
    ['atlas', '🗺️ Atlas'], ['chronicles', '📜 Crónicas'], ['contracts', `📋 Contratos${pend ? ` (${pend}!)` : ''}`],
  ];
  const al = archiveLook(m), deco = al.deco ? `<span class="arcdeco">${esc(al.deco)}</span>` : '';
  return `<div class="panel arc ${al.theme ? `arc-t-${al.theme}` : ''} ${al.card ? `arc-c-${al.card}` : ''}"><div class="row"><h3>${deco}📚 Archivo del Abismo${deco}</h3>${al.bg ? `<span class="arcbg">${sceneOf(al.bg)}</span>` : ''}<span class="grow"></span><b class="pill" ${tip('<b>Colección global</b><div class="sm">Bestiario, Grimorio, Reliquias, entradas del Atlas y Crónicas completadas.</div>')}>${t.pct}% · ${t.found}/${t.total}</b></div>
  <span class="mbar"><i style="width:${t.pct}%"></i><b>Colección global ${t.pct}%</b></span><div class="dim sm">${esc(desc)}</div>
  <div class="tabs">${nav.map(([c, n]) => `<button class="${ui.arcCat === c ? 'on' : ''}" data-act="arccat" data-id="${c}">${n}</button>`).join('')}</div>`;
}

const contractsReady = (m: ReturnType<typeof meta>): number => ensureContracts(m).filter((c) => c.completed && !c.claimed).length;
const leftText = (ms: number): string => { const h = Math.max(0, Math.floor(ms / 3_600_000)); return h >= 48 ? `${Math.floor(h / 24)} días` : h >= 1 ? `${h} h` : `${Math.max(1, Math.ceil(ms / 60_000))} min`; };

/** Contratos del Abismo: diarios y semanales, con avance y cobro de ecos. */
function contractsPanel(): string {
  const m = meta();
  ensureContracts(m);
  const b = m.contracts!, now = Date.now();
  const card = (c: Contract): string => {
    const pct = Math.round((c.progress / c.requiredCount) * 100);
    const btn = c.claimed ? '<span class="pill good sm">✔ Cobrado</span>' : c.completed ? `<button class="pri" data-act="cclaim" data-id="${esc(c.id)}">Cobrar ${c.rewardEcos} ✨</button>` : `<span class="dim sm">${c.rewardEcos} ✨ al completarlo</span>`;
    return `<div class="lootcard ${c.claimed ? 'off' : c.completed ? 'r3' : ''}"><b>${esc(c.title)}</b><div class="sm">${esc(c.description)}</div><span class="mbar"><i style="width:${pct}%"></i><b>${c.progress}/${c.requiredCount}</b></span><div class="row">${btn}</div></div>`;
  };
  const section = (name: string, list: Contract[]): string => `<div class="row"><h3>${name}</h3><span class="grow"></span><span class="dim sm">Se renuevan en ${leftText((list[0]?.expiresAt ?? now) - now)} (UTC)</span></div><div class="cards c3">${list.map(card).join('')}</div>`;
  const views = ([['periodic', 'Diarios y semanales'], ['special', `Especiales ${specialRows(m).filter((r) => r.claimed).length}/${SPECIALS().length}`], ['cosmetic', '🎖️ Títulos y marcos']] as const)
    .map(([v, n]) => `<button class="mini ${ui.cview === v ? 'on' : ''}" data-act="cview" data-id="${v}">${n}${v === 'special' && specialReady(m) ? ` (${specialReady(m)}!)` : ''}</button>`).join('');
  const head = `${archiveHeader('Objetivos diarios, semanales y especiales. Avanzan solos mientras juegas.')}<div class="row"><b>📋 Contratos</b><span class="grow"></span>${views}<b class="pill">✨ ${m.ecos} ecos</b></div>`;
  if (ui.cview === 'special') return head + specialsView(m) + '</div>';
  if (ui.cview === 'cosmetic') return head + cosmeticView(m) + '</div>';
  return `${head}
  <div class="dim sm">Cambian cada día y cada semana (iguales para todos). Cobra sus ecos aquí; lo que no cobres antes de la renovación se pierde.</div>
  ${section('Diarios', b.daily)}${section('Semanales', b.weekly)}</div>`;
}

const specialReady = (m: ReturnType<typeof meta>): number => specialRows(m).filter((r) => r.completed && !r.claimed).length;

/** Vista previa de un elemento con los recursos existentes (sprites con su variante, auras, escenas, emojis, colores). */
function shopPreview(x: ShopItem, cls: ClassId): string {
  const c = (x.cls ?? cls) as ClassId;
  if (x.cat === 'skin') return `<img class="parch" width="56" height="56" src="${unitPortraitUrl(c, 'hero', 0, x.ref)}" alt="">`;
  if (x.cat === 'kit') return (x.includes ?? []).filter((i) => i.startsWith('skin_')).map((i) => `<img class="parch" width="44" height="44" src="${unitPortraitUrl(c, 'hero', 0, shopItem(i)!.ref)}" alt="">`).join('');
  if (x.cat === 'fx') { const a = auraDef(x.ref)!; return `<span class="fxprev" style="--c:${a.color};--g:${a.glow}"></span>`; }
  if (x.cat === 'frame') { const f = frameDef(x.ref)!; return `<span class="frprev" style="border-color:${f.color};box-shadow:0 0 8px ${f.color}88"></span>`; }
  if (x.cat === 'emblem' || x.cat === 'deco') return `<span class="emo big">${x.ref}</span>`;
  if (x.cat === 'title') return `<i class="good">${esc(titleName(x.ref))}</i>`;
  if (x.cat === 'theme') return `<span class="thprev arc-t-${x.ref}"><b>Aa</b></span>`;
  if (x.cat === 'card') return `<span class="lootcard cdprev arc-c-${x.ref}">Ficha</span>`;
  return `<span class="bgprev">${sceneOf(x.ref)}</span>`;
}
const sceneOf = (id: string): string => (id === 'altar' ? altarScene(true) : id === 'forja' ? forgeScene(30) : id === 'cofre' ? chestScene('loot') : id === 'descanso' ? restScene(0) : id === 'santuario' ? shrineScene(1) : '');

/** Tienda de ecos: categorías, filtros, vista previa, compra con confirmación, inventario, equipamiento y conjuntos. */
function shopPanel(): string {
  const m = meta();
  if (grantUnlocks(m).length) saveMeta();
  const cls = ((PLAYABLE as string[]).includes(ui.shopCls) ? ui.shopCls : ui.me.cls) as ClassId;
  const fresh = new Set(unseenOwned(m).map((x) => x.id));
  const cats = (Object.keys(SHOP_CAT) as ShopCat[]).map((c) => {
    const all = CATALOG().filter((x) => x.cat === c), n = all.filter((x) => owns(m, x.id)).length, nw = all.filter((x) => fresh.has(x.id)).length;
    return `<button class="${ui.shopCat === c ? 'on' : ''}" data-act="shopcat" data-id="${c}">${SHOP_CAT[c]} ${n}/${all.length}${nw ? ' <b class="newtag">NUEVO</b>' : ''}</button>`;
  }).join('');
  const rar = ([['', 'Todas'], ...Object.entries(RARITY_NAME)] as Array<[string, string]>).map(([k, n]) => `<button class="mini ${ui.shopRar === k ? 'on' : ''}" data-act="shoprar" data-id="${k}">${n}</button>`).join('');
  const clsF = ([['', 'Todas las clases'], ...PLAYABLE.map((c): [string, string] => [c, CLASSES[c].name])]).map(([k, n]) => `<button class="mini ${ui.shopCls === k ? 'on' : ''}" data-act="shopcls" data-id="${k}">${esc(n)}</button>`).join('');
  const list = CATALOG().filter((x) => x.cat === ui.shopCat && x.available && (!ui.shopRar || x.rarity === ui.shopRar) && (!ui.shopCls || !x.cls || x.cls === ui.shopCls) && (!ui.shopMine || owns(m, x.id)));
  const card = (x: ShopItem): string => {
    const st = itemState(m, x, cls), price = priceFor(m, x), poor = m.ecos < price;
    let act = '';
    if (st === 'equipped') act = `<span class="pill good sm">✔ Equipado</span> <button class="mini" data-act="shopun" data-id="${x.cat === 'skin' ? 'skin' : x.cat === 'title' ? 'title' : x.cat === 'frame' ? 'frame' : SLOT_OF_CAT[x.cat] ?? ''}">Quitar</button>`;
    else if (st === 'owned') act = x.cat === 'kit' ? '<span class="pill good sm">✔ Completo</span>' : x.cat === 'skin' && x.cls && x.cls !== cls ? `<span class="dim sm">Adquirido · elige ${esc(CLASSES[x.cls].name)} para equiparlo</span>` : `<span class="pill sm">Adquirido</span> <button class="pri mini" data-act="shopeq" data-id="${x.id}">Equipar${x.cat === 'skin' ? ` en ${esc(CLASSES[cls].name)}` : ''}</button>`;
    else if (st === 'locked') act = `<span class="dim sm">🔒 ${esc(reqText(x.req!))}</span>`;
    else if (st === 'exclusive') act = `<span class="dim sm">🏅 Exclusivo: ${esc(reqText(x.req!))}</span>`;
    else if (ui.shopConfirm === x.id) act = `<span class="sm">¿Gastar <b>${price} ✨</b>?</span> <button class="pri mini" data-act="shopyes" data-id="${x.id}" ${poor ? 'disabled' : ''}>Confirmar</button> <button class="mini" data-act="shopno">Cancelar</button>${poor ? `<div class="bad sm">Te faltan ${price - m.ecos} ecos.</div>` : ''}`;
    else act = `<button class="${poor ? '' : 'pri'} mini" data-act="shopbuy" data-id="${x.id}">${poor ? `Te faltan ${price - m.ecos} ✨` : `Comprar · ${price} ✨`}</button>${x.cat === 'kit' && price !== x.price ? ` <span class="dim sm">(antes ${x.price})</span>` : ''}`;
    return `<div class="lootcard shopcard ${st === 'equipped' ? 'r3' : st === 'owned' ? 'r1' : st === 'locked' ? 'off' : ''}"><div class="row"><div class="cell big shopprev">${shopPreview(x, cls)}</div><div class="grow"><b>${esc(x.name)}</b>${fresh.has(x.id) ? ' <b class="newtag">NUEVO</b>' : ''}<div class="pill sm rar-${x.rarity}">${RARITY_NAME[x.rarity]}${x.cls ? ` · ${esc(CLASSES[x.cls].name)}` : ''}</div></div></div><div class="sm">${esc(x.desc)}</div>${x.req && x.price !== null ? `<div class="sm dim">Requisito: ${esc(reqText(x.req))}${reqMet(m, x.req) ? ' ✔' : ''}</div>` : ''}<div class="row" style="flex-wrap:wrap;gap:4px">${act}</div></div>`;
  };
  // conjuntos de la clase elegida (aspecto, aura y emblema)
  const lo = m.cosmetics?.loadouts?.[cls] ?? [], look = currentLook(m, cls);
  const lookCard = ['skin', 'kit', 'fx', 'emblem'].includes(ui.shopCat) ? `<div class="panel note"><div class="row"><img class="parch" width="48" height="48" src="${unitPortraitUrl(cls, 'hero', 0, look.skin)}" alt="">${look.aura ? `<span class="fxprev" style="--c:${auraDef(look.aura)!.color};--g:${auraDef(look.aura)!.glow}"></span>` : ''}<span class="emo">${look.emblem ?? ''}</span>
    <div class="grow"><b>Aspecto de ${esc(CLASSES[cls].name)}</b><div class="dim sm">${look.skin ? esc(paletteDef(look.skin)!.name) : 'Predeterminado'}${look.aura ? ` · ${esc(auraDef(look.aura)!.name)}` : ''}. Elige otra clase en el filtro para cambiar la suya.</div></div>
    <button class="mini" data-act="lsave">Guardar conjunto</button><button class="mini" data-act="lreset">Predeterminado</button></div>
    ${lo.length ? `<div class="row sm" style="flex-wrap:wrap;gap:4px">${lo.map((l, i) => `<span class="chip">${esc(l.name)} <button class="mini" data-act="lapply" data-id="${i}">Usar</button><button class="mini" data-act="ldel" data-id="${i}">✕</button></span>`).join('')}</div>` : ''}</div>` : '';
  const refund = m.perksRefundEcos && !m.refundSeen ? `<div class="panel note"><div class="row"><span class="emo">♻️</span><div class="grow"><b>Las Mejoras permanentes se han retirado.</b><div class="sm">Te hemos devuelto los <b>${m.perksRefundEcos} ecos</b> que gastaste en ellas. Ahora los ecos sirven para personalizar, nunca para ganar poder.</div></div><button class="mini" data-act="refundok">Entendido</button></div></div>` : '';
  // lo propio de esta categoría ya se ha visto
  setTimeout(() => { if (markSeen(m, list.filter((x) => owns(m, x.id)).map((x) => x.id))) saveMeta(); }, 0);
  return `${refund}<div class="panel"><div class="row"><h3>✨ Tienda de ecos</h3><span class="grow"></span><b class="pill">✨ ${m.ecos} ecos</b></div>
  <div class="dim sm">Solo apariencia: nada de la tienda cambia el combate. Sin compras al azar ni ofertas por tiempo.</div>
  <div class="tabs">${cats}</div><div class="row sm" style="flex-wrap:wrap;gap:4px">${rar}<span class="grow"></span><button class="mini ${ui.shopMine ? 'on' : ''}" data-act="shopmine">🎒 Solo lo mío (inventario)</button></div>
  <div class="row sm" style="flex-wrap:wrap;gap:4px">${clsF}</div>
  ${ui.shopMsg ? `<div class="${/^Comprado/.test(ui.shopMsg) ? 'good' : 'bad'} sm">${esc(ui.shopMsg)}</div>` : ''}${lookCard}
  <div class="cards c3">${list.map(card).join('') || '<div class="dim sm">Nada con estos filtros.</div>'}</div></div>`;
}
const SLOT_OF_CAT: Partial<Record<ShopCat, string>> = { emblem: 'emblem', fx: 'aura', theme: 'theme', card: 'card', bg: 'bg', deco: 'deco' };

/** Contratos Especiales: permanentes, por tipo, con requisitos, avance y recompensa visual. */
function specialsView(m: ReturnType<typeof meta>): string {
  if (evaluateSpecials(m)) saveMeta();
  const rows = specialRows(m);
  return `<div class="dim sm">Desafíos permanentes. No caducan ni dan poder: cada uno desbloquea un título para tu nombre o un marco para tus héroes del Salón.</div>` +
    (Object.keys(SPECIAL_TYPE_NAME) as Array<keyof typeof SPECIAL_TYPE_NAME>).map((t) => `<h3>${SPECIAL_TYPE_NAME[t]}</h3><div class="cards c3">${rows.filter((r) => r.def.type === t).map((r) => {
      const btn = r.claimed ? '<span class="pill good sm">✔ Desbloqueado</span>' : r.completed ? `<button class="pri" data-act="sclaim" data-id="${esc(r.def.id)}">Reclamar</button>` : '<span class="dim sm">🔒 Requisito pendiente</span>';
      const bar = r.def.requiredCount > 1 ? `<span class="mbar"><i style="width:${Math.round((r.progress / r.def.requiredCount) * 100)}%"></i><b>${r.progress}/${r.def.requiredCount}</b></span>` : '';
      return `<div class="lootcard ${r.claimed ? 'r3' : r.completed ? 'r1' : 'off'}"><b>${esc(r.def.title)}</b><div class="sm">${esc(r.def.description)}</div>${bar}<div class="sm dim">Recompensa: ${esc(rewardName(r.def.reward))}</div><div class="row">${btn}</div></div>`;
    }).join('')}</div>`).join('');
}

/** Títulos y marcos se equipan en la Tienda (un solo sitio para toda la personalización). */
function cosmeticView(m: ReturnType<typeof meta>): string {
  const c = m.cosmetics;
  return `<div class="dim sm">Tienes ${c?.titles.length ?? 0} títulos y ${c?.frames.length ?? 0} marcos. Se equipan, junto con el resto de tu apariencia, en la Tienda.</div>
  <div class="row"><button class="pri" data-act="htab" data-id="tienda">Ir a la Tienda ✨</button></div>`;
}

/** Atlas (zonas, eventos, pactos, presagios) y Crónicas (historias, secretos, hitos): mismas fichas, estados propios. */
function archiveExtra(): string {
  const m = meta(), mbar = (v: number, max: number): string => `<span class="mbar"><i style="width:${Math.min(100, Math.round((v / Math.max(1, max)) * 100))}%"></i><b>${Math.min(v, max)}/${max}</b></span>`;
  const atlas = ui.arcCat === 'atlas';
  const subs = (atlas ? ATLAS_CATS : CHRONICLE_CATS) as readonly string[];
  const sub = subs.includes(ui.arcSub) ? ui.arcSub : subs[0]!;
  const subTabs = subs.map((c) => { const p = atlas ? atlasProgress(m, c as AtlasCat) : chronicleProgress(m, c as ChronicleCat); return `<button class="mini ${sub === c ? 'on' : ''}" data-act="arcsub" data-id="${c}">${(atlas ? ATLAS_NAME : CHRONICLE_NAME)[c as never]} ${p.found}/${p.total}</button>`; }).join('');
  const cards = atlas ? ATLAS[sub as AtlasCat].map((r) => {
    const e = atlasEntry(m, r.cat, r.id), open = ui.arcOpen === `${sub}:${r.id}`;
    const body = e ? `<div class="sm">${esc(r.text)}</div><div class="sm dim">${r.zone ? `Zona ${r.zone === 4 ? 'del Abismo' : r.zone} · ` : ''}encontrado ${e.encounters} vez/veces · completado ${e.completions} (${esc(ATLAS_DONE_TEXT[r.cat])}; ${MASTERED_AT} para dominarlo)</div>` : '<div class="sm">Aún no lo has encontrado.</div>';
    return `<div class="lootcard ${e ? (e.state === 'mastered' ? 'r3' : 'r1') : 'off'}" data-act="arcopen" data-id="${sub}:${r.id}"><div class="row"><div class="cell big"><span class="emo">${e ? r.icon : '❔'}</span></div><div class="grow"><b>${e ? esc(r.name) : '???'}</b><div class="pill sm">${e ? '' : '🔒 '}${e ? ATLAS_STATE_NAME[e.state] : 'Sin descubrir'}</div></div></div>${open || !e ? body : ''}</div>`;
  }) : CHRONICLES[sub as ChronicleCat].map((r) => {
    const e = chronicleEntry(m, r.cat, r.id), st = e?.state ?? 'locked', open = ui.arcOpen === `${sub}:${r.id}`;
    const shown = r.cat === 'milestones' || st !== 'locked', secretLocked = r.cat === 'secrets' && st === 'locked';
    const body = secretLocked ? `<div class="sm dim">${esc(r.hint ?? 'Un secreto por descubrir.')}</div>` : st === 'locked' ? '<div class="sm">Aún no la has descubierto.</div>' : `<div class="sm">${esc(r.text)}</div>`;
    return `<div class="lootcard ${st === 'completed' ? 'r3' : st === 'discovered' ? 'r1' : 'off'}" data-act="arcopen" data-id="${sub}:${r.id}"><div class="row"><div class="grow"><b>${shown ? esc(r.name) : '???'}</b><div class="pill sm">${st === 'locked' ? '🔒 ' : ''}${CHRONICLE_STATE_NAME[st]}</div></div></div>${r.cat === 'milestones' || r.goal > 1 ? mbar(e?.progress ?? 0, r.goal) : ''}${open || st === 'locked' || r.cat !== 'stories' ? body : ''}</div>`;
  });
  return `${archiveHeader(atlas ? 'El mapa de lo que has encontrado: zonas, eventos, pactos y presagios.' : 'Historias que se desvelan al jugar, secretos de combate y hitos de tu colección.')}<div class="row sm">${subTabs}</div><div class="cards c3">${cards.join('')}</div></div>`;
}

/** Archivo del Abismo: Bestiario, Grimorio y Reliquias con filtros, progreso y fichas (lo no descubierto sale bloqueado). */
function archivePanel(): string {
  if (ui.arcCat === 'contracts') return contractsPanel();
  if (ui.arcCat === 'atlas' || ui.arcCat === 'chronicles') return archiveExtra();
  const cat = ui.arcCat;
  const f2: Array<[string, string]> = cat === 'bestiary' ? [['', 'Todas las zonas'], ['z1', 'Zona 1'], ['z2', 'Zona 2'], ['z3', 'Zona 3'], ['z4', 'Abismo']]
    : cat === 'grimoire' ? [['', 'Todas las clases'], ...PLAYABLE.map((c): [string, string] => [c, CLASSES[c].name]), ['blessing', 'Solo bendiciones']]
    : [['', 'Todas'], ['rare', 'Raras'], ['common', 'Comunes']];
  const pass2 = (id: string): boolean => {
    const f = ui.arcF2;
    if (!f || !f2.some(([k]) => k === f)) return true;
    if (cat === 'bestiary') return `z${BESTIARY.find((b) => b.id === id)?.zone}` === f;
    if (cat === 'grimoire') { const g = GRIMOIRE.find((x) => x.id === id); return f === 'blessing' ? g?.kind === 'blessing' : g?.cls === f; }
    return f === 'rare' ? !!RELICS[id]?.rare : !RELICS[id]?.rare;
  };
  const subFilters = f2.map(([k, n]) => `<button class="mini ${(ui.arcF2 || '') === k || (!f2.some(([x]) => x === ui.arcF2) && !k) ? 'on' : ''}" data-act="arcf2" data-id="${k}">${esc(n)}</button>`).join('');
  const rows = entriesOf(cat).filter((r) => (ui.arcFilter === 'all' || (ui.arcFilter === 'found') === (r.lv > 0)) && pass2(r.id));
  const filters = ([['all', 'Todo'], ['found', 'Descubierto'], ['missing', 'Sin descubrir']] as const).map(([f, n]) => `<button class="mini ${ui.arcFilter === f ? 'on' : ''}" data-act="arcfilter" data-id="${f}">${n}</button>`).join('');
  const cur = completion(cat);
  const card = (r: { id: string; lv: number; seen: number; n: number }): string => {
    const open = ui.arcOpen === `${cat}:${r.id}`, lvName = LEVEL_NAME[cat][r.lv] ?? '', on = r.lv > 0;
    let icon = '<span class="emo">❔</span>', name = '???', text = 'Aún no la has encontrado.', extra = '';
    if (cat === 'bestiary') {
      const b = beastDef(r.id)!, z = BESTIARY.find((x) => x.id === r.id)!.zone;
      if (on) { icon = `<img class="parch" width="44" height="44" src="${unitPortraitUrl(r.id, 'enemy')}" alt="">`; name = b.name; text = r.lv >= 2 ? `${b.ai === 'boss' ? 'Jefe' : b.ai === 'pillar' ? 'Pilar' : b.ai === 'ranged' ? 'A distancia' : 'Cuerpo a cuerpo'} · ${b.hp} de vida base · ${b.ap} PA · ${b.mp} PM.` : 'Lo has visto en combate. Derrota a uno para estudiarlo.'; }
      else text = 'Aún no lo has visto en combate.';
      extra = `<div class="sm dim">Zona ${z === 4 ? 'del Abismo' : z}${on ? ` · visto en ${r.seen} combate(s) · derrotado ${r.n} vez/veces${r.lv < 3 ? ` (${DOCUMENTED_KILLS} para documentarlo)` : ''}` : ''}</div>`;
    } else if (cat === 'grimoire') {
      const g = GRIMOIRE.find((x) => x.id === r.id)!, sp = SPELLS[r.id], bl = BLESSINGS[r.id];
      if (on) { icon = g.kind === 'spell' && sp ? spellIcon(sp) : `<span class="emo">${bl?.icon ?? '✨'}</span>`; name = sp?.name ?? bl?.name ?? r.id; text = sp?.text ?? bl?.text ?? ''; }
      else text = g.kind === 'blessing' ? 'Una bendición de clase todavía por descubrir.' : 'Un hechizo todavía por descubrir.';
      extra = `<div class="sm dim">${g.kind === 'blessing' ? 'Bendición' : 'Hechizo'} · ${CLASSES[g.cls].name}</div>`;
    } else {
      const rl = RELICS[r.id]!;
      if (on) { icon = `<span class="emo">${rl.icon}</span>`; name = rl.name; text = rl.text; } else text = 'Una reliquia todavía por encontrar.';
      extra = rl.rare && on ? '<div class="sm dim">Rara</div>' : '';
    }
    return `<div class="lootcard ${on ? (r.lv >= (cat === 'bestiary' ? 3 : MAX_LV[cat]) ? 'r3' : 'r1') : 'off'}" data-act="arcopen" data-id="${cat}:${r.id}"><div class="row"><div class="cell big">${icon}</div><div class="grow"><b>${esc(name)}</b><div class="pill sm">${on ? '' : '🔒 '}${esc(lvName)}</div></div></div>${open || !on ? `<div class="sm">${esc(text)}</div>${extra}` : ''}</div>`;
  };
  return `${archiveHeader('Lo que descubres en tus partidas se guarda aquí para siempre.')}<div class="row sm"><span class="dim">${CAT_NAME[cat]}: ${cur.pct}% (${cur.found}/${cur.total})</span><span class="grow"></span>${filters}</div>
  <div class="row sm" style="flex-wrap:wrap;gap:4px">${subFilters}</div>
  <div class="cards c3">${rows.map(card).join('') || '<div class="dim sm">Nada con este filtro.</div>'}</div></div>`;
}

function metaPanel(): string {
  const m = meta();
  if (ui.homeTab === 'logros') {
    return `<div class="panel"><div class="row"><h3>Logros</h3><span class="grow"></span><span class="dim sm">${achievementCount(m)}</span></div>
    <div class="dim sm">Partidas: ${m.stats.runs} · Victorias: ${m.stats.wins} · Bajas: ${m.stats.kills} · Jefes: ${m.stats.bosses} · Ascensión máxima: ${m.maxAsc}</div>
    <div class="cards c2">${listedAchievements(m).map((a) => { const on = m.achievements.includes(a.id);
      return `<div class="lootcard ${on ? 'r3' : 'off'}"><b>${on ? '🏆' : '🔒'} ${esc(a.name)}</b><div class="sm">${esc(a.text)}</div><div class="sm dim">${[a.ecos ? `+${a.ecos} ✨` : ''].filter(Boolean).join(' · ') || ' '}</div></div>`; }).join('')}</div></div>`;
  }
  if (ui.homeTab === 'archivo') return archivePanel();
  if (ui.homeTab === 'tienda') return shopPanel();
  if (ui.homeTab === 'clases') {
    return `<div class="panel"><h3>Maestría de clase</h3><div class="dim sm">Jugar con una clase le da experiencia de maestría (más cuanto más lejos llegues y más alta sea la ascensión). Cada nivel abre rutas y ventajas de esa clase.</div>
    <div class="cards c2">${PLAYABLE.map((id) => { const c = CLASSES[id], { lv } = masteryProgress(id);
      return `<div class="lootcard ${lv >= 5 ? 'r3' : lv ? 'r1' : ''}"><div class="row"><b>${c.name}</b><span class="grow"></span><b class="pill">Maestría ${lv}/5</b></div>
      ${masteryBar(id)}
      ${c.routes.length > 1 ? `<div class="sm">${c.routes.map((r) => { const need = routeNeeds(id, r.id); return `<span class="${lv >= need ? 'good' : 'dim'}">${lv >= need ? '✔' : '🔒'} ${esc(r.name)}${lv < need ? ` (maestría ${need})` : ''}</span>`; }).join(' · ')}</div>` : ''}
      <div class="sm">${[0, 1, 2, 3, 4].map((i) => `<div class="${lv > i ? 'good' : 'dim'}">${lv > i ? '✔' : '○'} ${i + 1}. ${esc(masteryText(id, i))}</div>`).join('')}</div></div>`; }).join('')}</div></div>`;
  }
  if (ui.homeTab === 'salon') {
    const team = m.team;
    return `<div class="panel"><div class="row"><h3>Salón de héroes</h3><span class="grow"></span><span class="dim sm">${m.hall.length}/${HALL_SIZE} · equipo ${team.length}/3</span></div>
    <div class="dim sm">Al terminar una partida puedes guardar aquí a tu héroe, con su equipo y mejoras. Elige 3 para tu equipo de duelo. Tu mejor héroe puede aparecer como <b>Némesis</b> (un élite) en las partidas que juegues con otros.</div>
    ${ui.hallMsg ? `<div class="pill sm">${esc(ui.hallMsg)}</div>` : ''}
    ${m.hall.length ? `<div class="cards c2">${m.hall.map((c) => champCard(c, team.includes(c.id))).join('')}</div>` : '<div class="dim">Aún no has guardado ningún héroe. Termina una partida y pulsa “Guardar en el Salón”.</div>'}</div>
    <div class="panel"><h3>🏟️ Duelos 3 contra 3</h3><div class="dim sm">En los duelos todos tienen más vida para que duren: cuenta la clase, el kit, el equipo, las runas y las mejoras. No dan ecos.</div>
      <div class="cards c3">
        <div class="lootcard"><b>Contra el equipo de un amigo</b><div class="sm dim">Su equipo lo lleva la IA: no hace falta que esté conectado. Necesita tener cuenta y equipo guardado.</div><input id="foe" maxlength="14" placeholder="Nombre de su cuenta"><button class="pri" data-act="duelai" ${team.length && !ui.busy ? '' : 'disabled'}>Buscar y combatir</button></div>
        <div class="lootcard"><b>Entrenamiento</b><div class="sm dim">Contra una copia de tu propio equipo, llevada por la IA.</div><button data-act="duelmirror" ${team.length ? '' : 'disabled'}>Entrenar</button></div>
        <div class="lootcard"><b>En vivo</b><div class="sm dim">Entra en una sala con tu amigo: el anfitrión verá el botón “Retar a duelo” junto a quien tenga equipo. Cada uno mueve a sus 3 héroes.</div></div>
      </div></div>`;
  }
  if (ui.homeTab === 'amigos') {
    if (!currentAccount()) return `<div class="panel"><h3>Amigos</h3><p class="dim">Para tener amigos e invitarles a tus partidas necesitas una cuenta. <button class="mini" data-act="htab" data-id="cuenta">Crear cuenta o entrar</button></p></div>`;
    const list = friendsStatus();
    return `<div class="panel"><h3>👥 Amigos</h3><div class="dim sm">Añade a tus amigos por su nombre de cuenta. Cuando estés en una sala podrás invitarles con un clic (solo les llega si ellos también te tienen añadido). Tu nombre: <b>${esc(currentAccount()!.name)}</b></div>
    <div class="row"><input id="friend" maxlength="14" placeholder="Nombre de cuenta"><button class="pri" data-act="addfriend">Añadir</button></div>${ui.friendMsg ? `<div class="pill sm">${esc(ui.friendMsg)}</div>` : ''}
    ${list.length ? list.map((f) => `<div class="row"><span class="dot ${f.online ? 'on' : ''}"></span><b>${esc(f.name)}</b><span class="dim sm">${f.online ? (f.room ? `en la sala ${esc(f.room)}` : 'en línea') : 'desconectado'}</span><span class="grow"></span>${f.online && f.room ? `<button class="mini pri" data-act="joinfriend" data-id="${esc(f.room)}">Unirme</button>` : ''}<button class="mini" data-act="delfriend" data-id="${esc(f.name)}">Quitar</button></div>`).join('') : '<div class="dim">Todavía no tienes amigos añadidos.</div>'}</div>`;
  }
  if (ui.homeTab === 'cuenta') {
    const a = currentAccount();
    return `<div class="panel"><h3>Cuenta</h3>${ui.acctMsg ? `<div class="pill sm">${esc(ui.acctMsg)}</div>` : ''}
    ${a ? `<p>Has entrado como <b>${esc(a.name)}</b> <span class="dim sm">(${esc(a.email)})</span>.</p><div class="dim sm">Tu progreso (ecos, mejoras, maestrías, logros y Salón) se guarda en la cuenta y te sigue a cualquier dispositivo. Tus amigos pueden retar a tu equipo buscando “${esc(a.name)}”.</div><p><button data-act="logout" ${ui.busy ? 'disabled' : ''}>Cerrar sesión</button></p>`
      : `<div class="dim sm">Opcional. Sin cuenta, tu progreso vive solo en este navegador. Con cuenta se guarda en la nube; al entrar por primera vez se une con lo que ya tengas aquí.</div>
      <div class="form"><label>Email <input id="acemail" type="email" autocomplete="email" value="${esc(ui.acEmail)}"></label><label>Contraseña <input id="acpass" type="password" autocomplete="current-password" minlength="6"></label>
      <label>Nombre de cuenta <span class="dim sm">(solo al crearla; así te encuentran tus amigos)</span> <input id="acname" maxlength="14" value="${esc(ui.acName || ui.me.name.replace(/[^A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ-]/g, ''))}"></label></div>
      <div class="row"><button class="pri" data-act="login" ${ui.busy ? 'disabled' : ''}>Entrar</button><button data-act="signup" ${ui.busy ? 'disabled' : ''}>Crear cuenta</button></div>`}</div>`;
  }
  if (ui.homeTab === 'diario') {
    const day = today(), d = dailyOf(day);
    const rows = Array.isArray(ui.board2) ? ui.board2 : [];
    return `<div class="panel"><h3>Reto diario · ${day}</h3><div class="dim sm">Misma semilla para todo el mundo, ascensión 3 y dos modificadores. Para jugarlo, créalo en una sala marcando “Reto diario”.</div>
    <div class="cards c2">${d.mods.map((id) => { const mod = DAILY_MODS.find((x) => x.id === id)!; return `<div class="lootcard r2"><b>${esc(mod.name)}</b><div class="sm">${esc(mod.text)}</div></div>`; }).join('')}</div>
    <div class="lbl">Clasificación de hoy</div>
    ${ui.board2 === 'cargando' ? '<div class="dim">Cargando…</div>' : ui.board2 === 'error' ? '<div class="bad sm">No se pudo cargar la clasificación.</div>' : rows.length ? `<div class="rank">${rows.map((r, i) => `<div class="row"><b>${i + 1}.</b><span class="grow">${esc(r.names)} <span class="dim sm">(${r.players}J)</span></span><span class="${r.won ? 'good' : 'dim'} sm">${r.won ? 'Victoria' : `Zona ${r.zone}`}</span><b class="pill">${r.score}</b></div>`).join('')}</div>` : '<div class="dim sm">Nadie ha jugado todavía hoy. ¡Sé el primero!</div>'}</div>`;
  }
  return '';
}

/** Ficha de un héroe guardado. */
export function champCard(c: Champion, inTeam: boolean, actions = true): string {
  const ups = Object.values(c.ups).reduce((a, l) => a + l.length, 0);
  const fr = frameDef(c.frame);
  return `<div class="lootcard ${c.won ? 'r3' : 'r1'}"${fr ? ` style="border-color:${fr.color};box-shadow:0 0 8px ${fr.color}66"` : ''}><div class="row"><b>${c.emblem ? `${c.emblem} ` : ''}${esc(c.name)}</b>${c.title ? `<i class="sm good">${esc(titleName(c.title))}</i>` : ''}<span class="dim sm">${CLASSES[c.cls].name}</span><span class="grow"></span>${c.won ? '<span>🏆</span>' : ''}${c.asc ? `<span class="pill sm">A${c.asc}</span>` : ''}</div>
  <div class="sm dim">${c.routes.map((r) => esc(findRoute(c.cls, r)?.name ?? r)).join(' + ')}</div>
  <div class="cells tiny">${Object.values(c.equip).map((it) => `<span class="cell ${RAR[it.rarity]}" ${tip(itemHtml(it, true))}>${itemIcon(it)}</span>`).join('')}</div>
  <div class="sm dim">✨ ${ups} mejoras</div>
  ${actions ? `<div class="row"><button class="mini ${inTeam ? 'pri' : ''}" data-act="champteam" data-id="${esc(c.id)}">${inTeam ? '✔ En el equipo' : 'Añadir al equipo'}</button><span class="grow"></span><button class="mini" data-act="champdel" data-id="${esc(c.id)}">Borrar</button></div>` : ''}</div>`;
}

/** Aviso para volver a una partida interrumpida (desconexión o recarga) de hace menos de 30 minutos. */
function reconnectBanner(): string {
  const snap = readSnapshot();
  if (!snap) return '';
  const mins = Math.max(0, Math.round((Date.now() - snap.at) / 60000));
  const where = snap.run ? ` · zona ${snap.run.zone + 1}, sala ${snap.run.step + 1}` : '';
  return `<div class="panel reconnect"><div class="row"><span class="emo big">🔌</span><div class="grow"><b>Tienes una partida a medias</b><div class="dim sm">Sala ${esc(snap.code)}${where} · hace ${mins} min${snap.host ? '' : ' · el anfitrión debe seguir en la sala'}</div></div><button class="pri" data-act="reconnect">Volver a la partida</button></div></div>`;
}

export function homeScreen(msg: string): void {
  setMenuScene('home');
  setCombatBg(null);
  const host = JSON.parse(store.get('rda_host') ?? 'null') as { code: string } | null;
  const m = meta();
  const pend = contractsReady(m) + specialReady(m), shopNew = unseenOwned(m).length || (m.perksRefundEcos && !m.refundSeen);
  const tabs: Array<[typeof ui.homeTab, string, string]> = [
    ['jugar', 'Jugar', ''], ['tienda', 'Tienda', `${m.ecos} ✨${shopNew ? ' !' : ''}`], ['clases', 'Maestría', ''], ['logros', 'Logros', achievementCount(m)],
    ['archivo', 'Archivo', `${archiveTotal().pct}%${pend ? ` · ${pend}!` : ''}`], ['salon', 'Salón y duelos', ''], ['diario', 'Reto diario', ''], ['amigos', 'Amigos', ''], ['cuenta', 'Cuenta', ''],
  ];
  const acct = currentAccount(), em = emblemOf(m), title = m.cosmetics?.title ? titleName(m.cosmetics.title) : '';
  const badge = `<div class="acctbadge" data-act="htab" data-id="cuenta" ${tip(acct ? 'Tu cuenta' : 'Sin cuenta: tu progreso se guarda en este navegador')}><div class="acctname">${em ? `${em} ` : ''}<b>${esc(acct?.name ?? ui.me.name)}</b>${title ? `<i>${esc(title)}</i>` : ''}</div><img class="acctport" src="${unitPortraitUrl(ui.me.cls, 'hero', 0, currentLook(m, ui.me.cls).skin)}" alt=""></div>`;
  const play = `<div class="panel orn namebox"><label>Tu nombre <input id="name" maxlength="14" value="${esc(ui.me.name)}"></label></div>
    <div class="panel orn playbox"><h3>Crear sala</h3><p class="dim sm">Serás el anfitrión. Comparte el código de 4 letras.</p><button class="pri" data-act="create">Crear sala</button></div>
    <div class="panel orn playbox"><h3>Unirse</h3><p class="dim sm">Con el código que te pase el anfitrión.</p><div class="row center"><input id="code" maxlength="4" placeholder="ABCD" class="codein"><button class="pri" data-act="join">Unirse</button></div></div>
    <div class="panel orn playbox"><h3>Un jugador</h3><p class="dim sm">Sin conexión con otros.</p><button data-act="solo">Jugar solo</button></div>
    ${host ? `<button class="resumebtn" data-act="resume">Continuar la partida guardada de la sala ${esc(host.code)}</button>` : ''}`;
  ui.root.innerHTML = `<div class="home2">
  <header class="hhead"><div><h1 class="ptitle">RUNAS DEL ABISMO</h1><p class="sub">RPG táctico por turnos · cooperativo de 1 a 4 jugadores · 3 zonas</p></div><span class="grow"></span><div class="hright">${volumeControl()}${badge}</div></header>
  ${msg ? `<p class="bad">${esc(msg)}</p>` : ''}
  ${reconnectBanner()}
  <div class="hbody">
    <nav class="hnav">${tabs.map(([id, n, b]) => `<button class="hbtn ${ui.homeTab === id ? 'on' : ''}" data-act="htab" data-id="${id}"><span>${n}${b ? `<i>${esc(b)}</i>` : ''}</span></button>`).join('')}
      <button class="hbtn tuto" data-act="tuto"><span>Ver tutorial</span></button></nav>
    <section class="hmain ${ui.homeTab === 'jugar' ? 'narrow' : ''}">${ui.homeTab === 'jugar' ? play : metaPanel()}</section>
  </div>
  ${ui.homeTab === 'jugar' ? `<div class="panel howto sm"><b>Cómo se juega:</b> cada unidad juega en su turno, por iniciativa. Clic en una casilla azul para moverte (PM). Elige un hechizo y haz clic en un objetivo con borde dorado (PA). Los obstáculos tapan la línea de visión. Cada turno dura como máximo ${TURN_SECONDS} segundos.</div>` : ''}
  </div>${tutorialHtml()}`;
}

export function tutorialHtml(): string {
  if (meta().seenTutorial || ui.tutorial < 0) return '';
  const st = TUTORIAL[ui.tutorial];
  if (!st) return '';
  return `<div class="modal"><div class="panel"><div class="dim sm">Tutorial ${ui.tutorial + 1}/${TUTORIAL.length}</div><h2>${esc(st.title)}</h2><p>${esc(st.text)}</p>
  <div class="row"><button class="mini" data-act="tutoskip">Saltar</button><span class="grow"></span><button class="pri" data-act="tutonext">${ui.tutorial + 1 >= TUTORIAL.length ? '¡A jugar!' : 'Siguiente →'}</button></div></div></div>`;
}

/** Barra de maestría: nivel, experiencia y cuánto falta para el siguiente nivel. */
function masteryBar(cls: ClassId): string {
  const p = masteryProgress(cls);
  return `<span class="mbar" ${tip(p.next ? `<b>Maestría ${p.lv}/5</b><div class="sm">${p.xp}/${p.next} de experiencia: faltan ${p.next - p.xp} para el nivel ${p.lv + 1}.</div><div class="sm good">Nivel ${p.lv + 1}: ${esc(masteryText(cls, p.lv))}</div>` : '<b>Maestría máxima</b>')}><i style="width:${p.pct}%"></i><b>Maestría ${p.lv}/5${p.next ? ` · ${p.pct}%` : ''}</b></span><span class="dim sm mnext">${p.next ? `Faltan ${p.next - p.xp} exp para el nivel ${p.lv + 1}` : 'Maestría máxima'}</span>`;
}

/** Ficha emergente de un modificador: efecto, riesgo, ecos e incompatibilidades. */
function modTip(id: string, why: string | null): string {
  const m = modDef(id)!, ex = DAILY_MODS.filter((o) => m.excl?.includes(o.id) || o.excl?.includes(id));
  return `<b>${esc(m.name)}</b><div class="sm">${esc(m.text)}</div><div class="sm dim">Riesgo ${['', 'leve', 'medio', 'alto'][m.tier ?? 2]} · +${Math.round(modEcos(id) * 100)}% de ecos</div>${ex.length ? `<div class="sm dim">No se combina con: ${ex.map((o) => esc(o.name)).join(', ')}</div>` : ''}${why ? `<div class="sm bad">${esc(why)}</div>` : ''}`;
}
/** Resumen de los modificadores activos (lo ven todos los jugadores de la sala). */
function modsSummary(list: readonly string[], host: boolean): string {
  if (!list.length) return host ? '<div class="dim sm">Sin modificadores: expedición normal.</div>' : '';
  const bonus = Math.round(list.reduce((n, id) => n + modEcos(id), 0) * 100);
  return `<div class="modsum"><b>⚠ Activos:</b> ${list.map((id) => `<span class="chip r2" ${tip(modTip(id, null))}>${esc(modDef(id)?.name ?? id)}</span>`).join(' ')} <span class="good">+${bonus}% de ecos</span>${host ? ' <button class="mini" data-act="modsclear">Quitar todos</button>' : ''}</div>`;
}

export function lobbyScreen(): void {
  const s = ui.session!, me = ui.me;
  const players = s.lobby();
  const cls = CLASSES[me.cls];
  const open = openRoutes(me.cls), mlv = masteryOf(me.cls);
  const canDuel = s.isHost && myTeam().length > 0;
  const ready = players.slice(0, 4).filter((p) => p.routes.length > 0 && (p.host || p.ready));
  const total = Math.min(4, players.length);
  ui.root.innerHTML = `<div class="bar"><span>Sala</span><b class="code">${esc(s.code)}</b>${s.t.kind === 'local' ? '<span class="dim">(local)</span>' : ''}
    <span class="dim sm">${!s.t.connected() ? '<b class="bad">⚠ Conexión perdida: reconectando…</b> ' : ''}${s.isHost ? 'Comparte el código. Cuando todos estén listos, pulsa Comenzar.' : s.hostPresent() ? 'Elige clase y kit inicial. El anfitrión comienza.' : 'Buscando al anfitrión… (puede tardar unos segundos)'}</span>
    ${ui.notice ? `<span class="bad">${esc(ui.notice)}</span>` : ''}<span class="grow"></span>
    ${s.isHost ? `${ui.saved ? `<button data-act="doresume">Reanudar guardada (zona ${ui.saved.zone + 1}, sala ${ui.saved.step + 1})</button>` : ''}<span class="pill ${ready.length === total ? 'good' : ''}">Listos ${ready.length}/${total}</span><button class="pri" data-act="start" ${ready.length ? '' : 'disabled'} ${ready.length < total ? tip('Aún no están todos listos: si comienzas, entran con lo que tengan elegido') : ''}>⚔️ Comenzar</button>` : `<button class="${ui.lobbyReady ? 'readyon' : 'pri'}" data-act="lready">${ui.lobbyReady ? '✔ Listo (deshacer)' : '✋ Estoy listo'}</button><span class="pill">Listos ${ready.length}/${total}</span>`}<button data-act="home">Salir</button></div>
  <div class="cols"><section class="main">
    ${s.isHost ? `<div class="panel"><div class="row"><b>Dificultad</b><span class="grow"></span><button class="mini" data-act="ascdown" ${ui.asc <= 0 || ui.daily ? 'disabled' : ''}>−</button><b class="pill">Ascensión ${ui.daily ? 3 : ui.asc}</b><button class="mini" data-act="ascup" ${ui.asc >= meta().maxAsc || ui.daily ? 'disabled' : ''}>+</button><label class="sm"><input type="checkbox" data-act="dailytoggle" ${ui.daily ? 'checked' : ''}> Reto diario</label></div>
      <div class="dim sm">${ui.daily ? dailyOf(today()).mods.map((id) => esc(DAILY_MODS.find((x) => x.id === id)!.name)).join(' + ') + ' · ranking compartido' : esc(ASCENSION.slice(0, ui.asc + 1).slice(-2).join(' '))}${meta().maxAsc < 1 && !ui.daily ? ' · Gana una partida para desbloquear la ascensión 1.' : ''}</div>
      ${ui.daily ? '' : `<div class="lbl">Modificadores de expedición <span class="dim">· opcionales, hasta ${MAX_MODS} · más riesgo, más ecos</span></div>
      <div class="chips">${DAILY_MODS.map((m) => { const on = ui.mods.includes(m.id), why = on ? null : ui.mods.length >= MAX_MODS ? `Ya tienes ${MAX_MODS} activos` : modConflict(m.id, ui.mods);
        return `<button class="chip modchip t${m.tier ?? 2} ${on ? 'r2 sel' : ''}" data-act="mod" data-id="${m.id}" ${why ? 'disabled' : ''} ${tip(modTip(m.id, why))}>${on ? '✔ ' : ''}${esc(m.name)} <span class="risk">${'●'.repeat(m.tier ?? 2)}</span></button>`; }).join('')}</div>
      ${modsSummary(ui.mods, true)}`}</div>` : players.find((p) => p.host) ? (() => { const hp = players.find((p) => p.host)!; return `<div class="panel dim sm">Dificultad del anfitrión: ${hp.daily ? 'Reto diario' : `Ascensión ${hp.asc}${hp.abyss ? ' · con El Abismo' : ''}`}${hp.daily ? '' : modsSummary(hp.mods, false)}</div>`; })() : ''}
    ${currentAccount() && s.t.kind === 'online' ? (() => { const fr = friendsStatus().filter((f) => f.online && f.room !== s.code); return fr.length ? `<div class="panel sm"><b>👥 Invitar:</b> ${fr.map((f) => `<button class="mini" data-act="invite" data-id="${esc(f.name)}">✉ ${esc(f.name)}</button>`).join(' ')}</div>` : ''; })() : ''}
    <div class="lbl">Tu clase <span class="dim">· maestría ${mlv}/5 con ${cls.name}</span></div>
    <div class="cards c5">${PLAYABLE.map((id) => { const c = CLASSES[id];
      // compañeros que han elegido esta clase (con su color)
      const mates = players.slice(0, 4).map((p, i) => ({ p, i })).filter(({ p }) => p.id !== ui.myId && p.cls === id);
      const mateCls = mates.length ? `mate m${mates[0]!.i % 4}` : '';
      const myIdx = players.findIndex((p) => p.id === ui.myId);
      const burst = id === me.cls && ui.picked?.cls === id && Date.now() - ui.picked.at < 1500;
      const st = classStripUrl(id, burst ? 'special' : 'idle');
      return `<button class="pick ${id === me.cls ? `on p${Math.max(0, myIdx) % 4}c` : ''} ${mateCls} ${burst ? 'burst' : ''}" data-act="cls" data-id="${id}"><b>${c.name}</b>
        <span class="portrait anim ${st.n > 1 ? '' : 'bob'}" style="--n:${st.n};background-image:url(${st.url})"></span>${burst ? '<span class="pickfx"></span>' : ''}
        ${mates.length || id === me.cls ? `<span class="mates">${id === me.cls ? `<span class="mtag p${Math.max(0, myIdx) % 4}b">Tú</span>` : ''}${mates.map(({ p, i }) => `<span class="mtag p${i % 4}b">${esc(p.name)}</span>`).join('')}</span>` : ''}<span class="dim sm">❤️ ${c.hp} · PA ${c.ap} · PM ${c.mp} · ⏱️ ${c.initiative}</span><span class="dim sm"><i>${esc(CLASS_STORY[id] ?? '')}</i></span>${masteryBar(id)}</button>`; }).join('')}</div>
    <div class="lbl">Tu kit inicial <span class="dim">· 3 habilidades; durante la partida las mejoras con bendiciones. Más kits con maestría.</span></div>
    <div class="cards c2">${cls.routes.map((r) => {
      const locked = !open.includes(r.id);
      const on = me.routes.includes(r.id);
      return `<button class="pick ${on ? 'on' : ''}" data-act="route" data-id="${r.id}" ${locked ? 'disabled' : ''}><b>${on ? '✔ ' : ''}${r.name}</b><span class="dim sm">${r.text}</span>
        <span class="row">${r.spells.map((id) => { const d = SPELLS[id]!; return `<span class="schip" ${tip(spellTip(d))}>${spellIcon(d)} ${esc(d.name)}</span>`; }).join('')}</span>
        ${locked ? `<i class="sm bad">🔒 Se desbloquea con maestría ${routeNeeds(me.cls, r.id)} de ${cls.name}: juega partidas con esta clase</i>` : ''}</button>`;
    }).join('')}</div>
  </section>
  <aside class="side"><div class="tabs"><button class="on">👥 Jugadores (${players.length}/4)</button></div><div class="tabbody">
    ${players.map((p, i) => `<div class="member ${i > 3 ? 'off' : ''} ${p.ready && !p.host ? 'isready' : ''}"><div class="row"><b class="p${i % 4}">${p.look.emblem ? `${p.look.emblem} ` : ''}${esc(p.name)}</b>${p.host ? '<span>👑</span>' : ''}${p.id === ui.myId ? '<span class="dim sm">(tú)</span>' : ''}<span class="grow"></span>${p.host ? '<span class="rdy host">👑 Anfitrión</span>' : p.ready ? '<span class="rdy on">✔ LISTO</span>' : '<span class="rdy">⏳ Eligiendo…</span>'}</div>
      <div class="sm">${esc(CLASSES[p.cls]?.name ?? '?')} <span class="dim">${p.routes.map((r) => esc(findRoute(p.cls, r)?.name ?? r)).join(' + ') || 'eligiendo kit'}</span></div>${i > 3 ? '<div class="bad sm">Sala llena</div>' : ''}${canDuel && p.id !== ui.myId && p.hasTeam ? `<button class="mini" data-act="duel" data-id="${esc(p.id)}">🏟️ Retar a duelo 3 contra 3</button>` : p.hasTeam ? '<div class="dim sm">🏟️ Tiene equipo de duelo</div>' : ''}</div>`).join('')}
  </div></aside></div>`;
}

function frame(run: RunState, main: string, selling = false): void {
  ui.root.innerHTML = `${topBar(run)}<div class="cols ${ui.sideOpen ? 'sideopen' : ''}"><section class="main">${main}</section>${sidePanel(run, selling)}</div>`;
}

export function mapScreen(): void {
  const s = ui.session!, run = s.run!;
  const pending = Object.keys(run.offers).length;
  frame(run, `${run.step === 0 && ZONE_STORY[run.zone] ? `<div class="panel note story"><i>${esc(ZONE_STORY[run.zone]!)}</i></div>` : ''}${run.note ? `<div class="panel note">${esc(run.note)}</div>` : ''}
  ${run.allies.length ? `<div class="panel sm">🤝 Os acompañan: ${run.allies.map((a) => `<b>${esc(ALLIES[a]?.name ?? a)}</b>`).join(', ')} <span class="dim">(hasta el final de la zona)</span></div>` : ''}
  ${run.nextOmen ? `<div class="panel sm">Próximo combate: ${OMENS.find((o) => o.id === run.nextOmen)?.icon} <b>${esc(OMENS.find((o) => o.id === run.nextOmen)?.name ?? '')}</b></div>` : ''}
  ${blessingBar(run)}
  <div class="lbl">Zona ${run.zone + 1}/${lastZone(run) + 1} · Sala ${run.step + 1} de ${run.map.length} · ${run.heroes.length > 1 ? 'votad a dónde queréis ir: cuando votéis todos, el grupo va a la más votada (en empate, la del anfitrión)' : 'pulsa en el mapa a dónde vas'}</div>
  ${mapSvg(run, true)}
  ${run.heroes.length > 1 ? voteRow(run) : ''}
  ${s.isHost && pending ? `<div class="dim sm">${pending} jugador${pending > 1 ? 'es' : ''} aún eligiendo botín: los caminos se desbloquean cuando todos estén listos.</div>` : ''}
  ${pendingRows(run)}`);
}

/** Quién ha votado qué camino (con su color) y botón del anfitrión para decidir ya. */
function voteRow(run: RunState): string {
  const s = ui.session!;
  const PCLS = ['p0', 'p1', 'p2', 'p3'];
  const row = run.map[run.step] ?? [];
  const chips = run.heroes.map((h, k) => { const v = run.mapVotes?.[h.owner]; return `<span class="pill sm ${PCLS[k % 4]}">${esc(h.name)}: ${v === undefined ? '<span class="dim">pensando…</span>' : `${NODE_ICON[row[v]!]} ${esc(NODE_NAME[row[v]!].replace(/^\S+\s/, ''))}`}</span>`; }).join(' ');
  const any = Object.keys(run.mapVotes ?? {}).length > 0;
  return `<div class="row advance votes">🗳️ ${chips}<span class="grow"></span>${s.isHost ? `<button class="pri" data-act="mapgo" ${any ? '' : 'disabled'}>Ir ya a la más votada</button>` : ''}</div>`;
}

export function shopScreen(): void {
  const s = ui.session!, run = s.run!;
  const h = mine(run);
  frame(run, `<div class="row"><h2>💰 Mercader de reliquias</h2></div>${advanceBar(run, 'Salir de la tienda →')}
  <div class="dim sm">Cada objeto solo puede comprarlo un jugador. Para vender, selecciona un objeto de tu mochila (un tercio de su precio).</div>
  <div class="cards c3">${(run.shop ?? []).map((sl, i) => { const it = sl.item; const rl = sl.relic ? RELICS[sl.relic] : undefined;
    const cs = sl.consumable ? CONSUMABLES[sl.consumable] : undefined;
    if (cs) { const have = h?.bag2[sl.consumable!] ?? 0; const d = SPELLS[sl.consumable!]!; return `<div class="lootcard r1"><div class="row">${spellIcon(d)}<div><b>${esc(cs.name)}</b><div class="dim sm">Consumible de combate · llevas ${have}/${MAX_CONSUMABLE}</div><div class="sm">${esc(d.text)}</div></div></div><button class="pri" data-act="buy" data-id="${i}" ${!h || h.gold < sl.price || have >= MAX_CONSUMABLE ? 'disabled' : ''}>Comprar · ${sl.price} 💰</button></div>`; }
    if (rl) return `<div class="lootcard ${rl.rare ? 'r3' : 'r2'} ${sl.sold ? 'off' : ''}"><div class="row"><div class="cell big ${rl.rare ? 'r3' : 'r2'}"><span class="emo">${rl.icon}</span></div><div><b>${esc(rl.name)}</b><div class="dim sm">Reliquia ${rl.rare ? 'rara' : 'común'} · para toda la partida</div><div class="sm">${esc(rl.text)}</div></div></div><button class="pri" data-act="buy" data-id="${i}" ${sl.sold || !h || h.gold < sl.price || h.relics.includes(rl.id) ? 'disabled' : ''}>${sl.sold ? 'Vendido' : h?.relics.includes(rl.id) ? 'Ya la tienes' : `Comprar · ${sl.price} 💰`}</button></div>`;
    return `<div class="lootcard ${RAR[it?.rarity ?? 0]} ${sl.sold ? 'off' : ''}">${it ? `<div class="row"><div class="cell big ${RAR[it.rarity]}">${itemIcon(it)}</div><div>${itemHtml(it)}</div></div>${h ? diffHtml(it, h) : ''}` : ''}
      <button class="pri" data-act="buy" data-id="${i}" ${sl.sold || !h || h.gold < sl.price ? 'disabled' : ''}>${sl.sold ? 'Vendido' : `Comprar · ${sl.price} 💰`}</button></div>`; }).join('')}
    ${''}<div class="lootcard"><div class="row"><div class="cell big"><span class="emo">🧪</span></div><div><b>Poción de vida</b><div class="sm">Recupera el ${POTION_HEAL * 100}% de tu vida máxima.</div></div></div><button class="pri" data-act="potion" ${!h || h.gold < POTION_PRICE || h.hp >= heroMaxHp(h) ? 'disabled' : ''}>Beber · ${POTION_PRICE} 💰</button></div></div>${pendingRows(run)}`, true);
}

/** Ilustración del evento: icono y color de luz según de qué trate. */
function eventArt(key: string): { i: string; c: string } {
  const k = key.toLowerCase();
  const table: Array<[RegExp, string, string]> = [
    [/fuente|manantial|agua|lago|pozo/, '⛲', '#5fb4ff'], [/fuego|brasa|llama|volc|ceniza|forja|horno/, '🔥', '#ff7a3a'], [/altar|santuario|vela|oraci|templo/, '🕯️', '#ffd27a'],
    [/espejo|reflej/, '🪞', '#b9a6ff'], [/hongo|seta|espora|semilla|raíz|bosque|árbol|roble/, '🍄', '#7fd36a'], [/cofre|tesoro|oro|mercader|comerci/, '💰', '#ffcc4d'],
    [/espíritu|fantasma|alma|eco|susurro/, '👻', '#9fe0ff'], [/libro|pergamino|runa|oráculo|biblioteca/, '📜', '#e8c27a'], [/sangre|pacto|demonio|maldi/, '🩸', '#ff4a5a'],
    [/prision|jaula|cadena|preso/, '⛓️', '#c0c0c0'], [/lobo|bestia|criatura|nido/, '🐺', '#d0a070'], [/estatua|ídolo|reliquia/, '🗿', '#d8c8a0'],
  ];
  for (const [re, i, c] of table) if (re.test(k)) return { i, c };
  return { i: '🔮', c: '#c58aff' };
}

/** Pista de una opción partida en ganancias (verde) y riesgos (rojo). */
function outcomeList(hint: string): string {
  const parts = hint.replace(/^Todos:\s*/i, '').replace(/^Cada uno:\s*/i, '').split(/,?\s+pero\s+|\.\s+|;\s+|,\s+(?=(?:pierde|pierden|cuesta|te cuesta|recibe|reciben|-|−))/i).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean);
  const risky = /pierde|pierden|pierdes|cuesta|−\d|-\d|menos|daño a|maldi|veneno a|riesgo|puede salir mal|nada/i;
  return `<ul>${parts.map((p) => `<li class="${risky.test(p) ? 'down' : 'up'}">${esc(p[0]!.toUpperCase() + p.slice(1))}</li>`).join('')}</ul>`;
}

export function eventScreen(): void {
  const s = ui.session!, run = s.run!, ev = run.event!;
  const def = eventDef(run)!;
  const voters = (i: number): string => run.heroes.filter((h) => ev.votes[h.owner] === i).map((h) => esc(h.name)).join(', ');
  const canVote = !!mine(run) && !ev.result;
  const art = eventArt(def.id + ' ' + def.title);
  const sp = def.special;
  frame(run, `<div class="panel evwin ${sp ? `evspecial ev-${sp}` : ''}">
  ${sp ? `<div class="evbadge">${sp === 'raro' ? '✦ Encuentro poco frecuente' : '✦ Evento especial'}</div>` : ''}
  <div class="evart" style="--evc:${art.c}"><span>${art.i}</span></div>
  <h2 class="evtitle">${esc(def.title)}</h2>
  <p class="evtext">${esc(def.text)}</p>
  ${ev.result ? `<div class="panel note evresult"><b>${esc(ev.result)}</b></div>${advanceBar(run, 'Continuar →')}` : `
  <div class="dim sm evhint">Evento de grupo: decide la mayoría y afecta a todos. En empate decide el anfitrión.</div>
  <div class="evopts">${def.options.map((o, i) => `<button class="evcard ${ev.votes[ui.myId] === i ? 'on' : ''}" data-act="vote" data-id="${i}" ${canVote ? '' : 'disabled'}><b>${esc(o.label)}</b>${outcomeList(o.hint)}<span class="votes">${voters(i) ? `🗳️ ${voters(i)}` : 'Sin votos'}</span></button>`).join('')}</div>
  <div class="row">${s.isHost ? `<button data-act="resolve" ${Object.keys(ev.votes).length ? '' : 'disabled'}>Cerrar la votación ya</button>` : '<span class="dim sm">Votad todos para continuar.</span>'}</div>`}
  </div>${pendingRows(run)}`);
}

export function endScreen(): void {
  const s = ui.session!, run = s.run!;
  ui.tab = 'grupo';
  if (run.arena) {
    const iWon = (run.phase === 'won') === (run.arena.a === ui.myId);
    const playing = run.arena.a === ui.myId || run.arena.b === ui.myId;
    ui.root.innerHTML = `${topBar(run)}<div class="home"><h1>${playing ? (iWon ? '¡VICTORIA!' : 'DERROTA') : 'FIN DEL DUELO'}</h1><p>${esc(run.note)}</p>
    <div class="row">${s.t.kind === 'local' ? '' : s.isHost ? '<button class="pri" data-act="again">Volver a la sala</button>' : '<span class="dim sm">Esperando al anfitrión…</span>'}<button data-act="home">Volver al inicio</button></div></div>`;
    return;
  }
  const won = run.phase === 'won';
  const myHero = mine(run);
  const saved = !!myHero && meta().hall.some((c) => c.id === championOf(run, myHero).id);
  const res = settle(run, ui.myId);
  const total = run.heroes.reduce((a, h) => a + h.stats.dmg, 0) || 1;
  const m = meta();
  const score = run.daily ? dailyScore(run) : 0;
  frame(run, `<div class="home"><h1>${won ? '¡VICTORIA!' : 'HABÉIS CAÍDO'}</h1>
  <p>${won ? esc(ENDING_WON) : `${esc(ENDING_LOST)} <span class="dim">(Zona ${run.zone + 1}, sala ${run.step + 1}.)</span>`}</p>
  ${run.daily ? `<p class="pill">Reto diario ${esc(run.daily)}: ${score} puntos</p>` : run.asc ? `<p class="dim">Ascensión ${run.asc}</p>` : ''}
  <div class="panel"><div class="row"><h3>Tu recompensa</h3><span class="grow"></span><b class="pill">+${res?.ecos ?? ecosFor(run)} ✨ ecos</b><span class="dim sm">(tienes ${m.ecos})</span></div>
    ${res?.asc ? `<div class="good">🔓 Ascensión ${res.asc} desbloqueada: la próxima partida puede ser más difícil y dar más ecos.</div>` : ''}
    ${res?.achievements.length ? res.achievements.map((a) => `<div class="lootcard r3"><b>🏆 ${esc(a.name)}</b> <span class="sm">${esc(a.text)}</span><div class="sm good">${[a.ecos ? `+${a.ecos} ✨` : ''].filter(Boolean).join(' · ')}</div></div>`).join('') : ''}
    ${res ? `<div class="row sm"><b>🎓 Maestría de ${CLASSES[res.mastery.cls].name}</b><span class="good">+${res.mastery.xp} exp</span><span class="grow"></span><span class="pill">Nivel ${res.mastery.after}/5</span></div>${res.mastery.after > res.mastery.before ? Array.from({ length: res.mastery.after - res.mastery.before }, (_, k) => res.mastery.before + k).map((i) => `<div class="good">🔓 ${esc(masteryText(res.mastery.cls, i))}</div>`).join('') : `<div class="dim sm">${MASTERY_XP[res.mastery.after] ? `Faltan ${MASTERY_XP[res.mastery.after]! - res.mastery.total} de experiencia para el nivel ${res.mastery.after + 1}: ${esc(masteryText(res.mastery.cls, res.mastery.after))}` : 'Maestría máxima.'}</div>`}${masteryBar(res.mastery.cls)}` : ''}
    <div class="dim sm">Gasta tus ecos en la <b>Tienda</b> (pantalla de inicio): aspectos, efectos, títulos y personalización. Nunca dan poder en combate.</div></div>
  ${ui.runFinds.code === run.code && ui.runFinds.list.length ? `<div class="panel"><div class="row"><h3>📚 Descubierto en esta expedición</h3><span class="grow"></span><span class="dim sm">Consúltalo en el Archivo (pantalla de inicio)</span></div><div class="row" style="flex-wrap:wrap;gap:6px">${ui.runFinds.list.slice(0, 40).map((n) => `<span class="chip">${n.icon} ${esc(n.text)}</span>`).join('')}${ui.runFinds.list.length > 40 ? `<span class="dim sm">y ${ui.runFinds.list.length - 40} más</span>` : ''}</div></div>` : ''}
  <div class="panel"><h3>Resumen del grupo</h3>${run.heroes.map((h, i) => `<div class="row sm"><b class="p${i % 4}">${esc(h.name)}</b><span class="dim">${CLASSES[h.cls].name}</span><span class="grow"></span><span>⚔️ ${h.stats.dmg} (${Math.round((h.stats.dmg / total) * 100)}%)</span><span>☠️ ${h.stats.kills}</span><span>✚ ${h.stats.heal}</span><span class="${h.stats.falls ? 'bad' : 'good'}">💀 ${h.stats.falls}</span></div>`).join('')}</div>
  ${myHero ? `<div class="panel"><div class="row"><div><b>🏟️ Salón de héroes</b><div class="dim sm">Guarda a ${esc(myHero.name)} tal como está para tus duelos 3 contra 3 y para que vuelva como Némesis.</div></div><span class="grow"></span><button data-act="champsave" ${saved ? 'disabled' : ''}>${saved ? '✔ Guardado' : 'Guardar en el Salón'}</button></div></div>` : ''}
  <div class="row">${s.isHost ? '<button class="pri" data-act="again">⚔️ Jugar otra partida</button>' : '<span class="dim sm">Esperando al anfitrión para otra partida…</span>'}<button data-act="home">Volver al inicio</button></div></div>`);
}

// ---------------------------------------------------------------------------
// Salas especiales (v14): Altar, Forja, Cofre y Descanso
// ---------------------------------------------------------------------------
function roomWin(scene: string, title: string, text: string, inner: string, cls = ''): string {
  return `<div class="panel evwin roomwin ${cls}"><div class="evart scenebox">${scene}</div><h2 class="evtitle">${title}</h2>${text ? `<p class="evtext">${text}</p>` : ''}${inner}</div>`;
}

export function roomScreen(): void {
  const s = ui.session!, run = s.run!, r = run.room!;
  const h = mine(run);
  if (r.kind === 'altar') {
    const pacts = r.pacts.map((id) => pactOf(id)!).filter(Boolean);
    const voters = (i: number): string => run.heroes.filter((x) => r.votes[x.owner] === i).map((x) => esc(x.name)).join(', ');
    const chosen = pactOf(run.pact);
    const inner = r.result
      ? `<div class="panel note evresult">${chosen ? `<div class="pactseal">${chosen.icon}</div>` : ''}<b>${esc(r.result)}</b></div>${chosen ? `<div class="evopts one"><div class="evcard on"><b>${chosen.icon} ${esc(chosen.name)}</b><ul><li class="up">${esc(chosen.boon)}</li><li class="down">${esc(chosen.bane)}</li></ul><span class="votes">Dura toda la partida</span></div></div>` : ''}${advanceBar(run, 'Descender a la mazmorra →')}`
      : `<div class="dim sm evhint">Pacto Mayor: decide la mayoría y cambia las reglas de toda la partida. En empate decide el anfitrión.</div>
      <div class="evopts">${pacts.map((p, i) => `<button class="evcard pactcard ${r.votes[ui.myId] === i ? 'on' : ''}" data-act="pact" data-id="${i}" ${h ? '' : 'disabled'}><b>${p.icon} ${esc(p.name)}</b><ul><li class="up">${esc(p.boon)}</li><li class="down">${esc(p.bane)}</li></ul><span class="votes">${voters(i) ? `🗳️ ${voters(i)}` : 'Sin votos'}</span></button>`).join('')}</div>
      <div class="row">${s.isHost ? `<button data-act="seal" ${Object.keys(r.votes).length ? '' : 'disabled'}>Sellar el pacto ya</button>` : '<span class="dim sm">Votad todos para sellarlo.</span>'}</div>`;
    frame(run, roomWin(altarScene(!!pacts.length, pacts.map((p) => p.icon)), 'El Altar de los Pactos',
      pacts.length ? 'Antes de bajar, la piedra exige un precio. Dos pactos arden sobre el altar: elegid uno y la mazmorra entera obedecerá sus reglas.' : '', inner, 'altarwin') + pendingRows(run));
    return;
  }
  if (r.kind === 'chest') {
    const curse = r.cursed ? curseOf(r.cursed) : undefined;
    const scene = chestScene(!r.opened ? 'closed' : curse ? 'cursed' : 'loot');
    const inner = !r.opened
      ? `<div class="dim sm evhint">Un solo cofre para todo el grupo: botín para cada uno… o una maldición para todos (${Math.round(CHEST_CURSE_CHANCE * 100)}%).</div><div class="row center"><button class="pri big" data-act="openchest" ${h ? '' : 'disabled'}>🗝️ Abrir el cofre</button></div>`
      : curse
        ? `<div class="cursebox"><div class="curseicon">${curse.icon}</div><div><b class="bad">Maldición: ${esc(curse.name)}</b><div>${esc(curse.text)}</div>${(r.lines ?? []).map((l) => `<div class="sm bad">${esc(l)}</div>`).join('')}</div></div>${advanceBar(run, 'Seguir adelante →')}`
        : `<div class="lootbox"><b class="good">¡Botín!</b><ul>${(r.lines ?? []).map((l) => `<li class="up">${esc(l)}</li>`).join('')}</ul><div class="dim sm">Cada objeto es tuyo: va a tu equipo o mochila (si no cabe, aparece abajo para que decidas).</div></div>${advanceBar(run, 'Seguir adelante →')}`;
    frame(run, roomWin(scene, r.opened ? (curse ? 'El cofre estaba maldito' : 'El cofre se abre') : 'Un cofre en la penumbra',
      r.opened ? '' : 'Entre el polvo, un cofre con herrajes de hierro. La cerradura cede al primer toque… demasiado fácil.', inner, 'chestwin') + pendingRows(run));
    return;
  }
  if (r.kind === 'shrine') {
    const status = run.heroes.map((x) => `<span class="pill sm ${x.boonOffer ? 'dim' : 'good'}">${x.boonOffer ? '⏳' : '✔'} ${esc(x.name)}</span>`).join(' ');
    const inner = `${h?.boonOffer ? boonRow(run) : `<div class="panel note"><b class="good">${h ? 'Ya has recibido la bendición del santuario.' : 'Estás mirando el santuario.'}</b></div>`}
      <div class="row">${status}</div>${advanceBar(run, 'Continuar →')}`;
    frame(run, roomWin(shrineScene(r.zone), 'El Santuario', 'Una estatua sin rostro vela entre cirios que nunca se consumen. Ante ella, el poder dormido de cada clase despierta: elige una bendición pasiva.', inner, 'shrinewin'));
    return;
  }
  if (r.kind === 'rest') {
    const mine2 = h ? r.picks[h.owner] : undefined;
    const who = (i: number): string => run.heroes.filter((x) => r.picks[x.owner] === i).map((x) => esc(x.name)).join(', ');
    const heal = h ? Math.ceil(heroMaxHp(h) * restHeal(run, h)) : 0;
    const inner = `<div class="evopts">${REST_OPTIONS.map((o, i) => `<button class="evcard ${mine2 === i ? 'on' : ''}" data-act="restpick" data-id="${i}" ${h && mine2 === undefined ? '' : 'disabled'}><b>${o.icon} ${esc(o.name)}</b><ul><li class="${o.id === 'rest' && !heal ? 'down' : 'up'}">${o.id === 'rest' ? (heal ? `Recuperas ${heal} de vida (${h ? `${h.hp}/${heroMaxHp(h)}` : ''})` : 'El pacto no te deja curarte') : esc(o.text)}</li></ul><span class="votes">${who(i) ? `✔ ${who(i)}` : '—'}</span></button>`).join('')}</div>
      ${r.lines.length ? `<div class="panel note">${r.lines.map((l) => `<div class="sm good">${esc(l)}</div>`).join('')}</div>` : ''}
      <div class="row"><button data-act="side" class="mobonly">🎒 Revisar inventario</button><button data-act="stats">📊 Ver ficha</button><span class="dim sm deskonly">Tu equipo y mochila están en el panel de la derecha.</span></div>
      ${advanceBar(run, 'Continuar →')}`;
    frame(run, roomWin(restScene(r.zone), 'Descanso', esc(restText(r.zone)), inner, 'restwin') + pendingRows(run));
    return;
  }
  // forja
  const tier = heatTier(r.heat);
  const pct = Math.round((r.heat / HEAT_MAX) * 100);
  const heat = `<div class="heat ${tier.id}"><div class="row"><b>🌡️ Calor del Crisol: ${r.heat}</b><span class="grow"></span><span class="pill heattier">${esc(tier.name)}</span></div>
    <div class="heatbar"><i style="width:${pct}%"></i><s style="left:${(HEAT_HOT / HEAT_MAX) * 100}%" title="Ardiente"></s><s style="left:${(HEAT_OVERLOAD / HEAT_MAX) * 100}%" title="Sobrecarga"></s></div>
    <div class="sm">${esc(tier.text)}</div><div class="dim sm">Recalibrar +${HEAT.recalibrate} · Desguazar +${HEAT.scrap} · Templar +${HEAT.hone}. El calor se reparte entre todo el grupo.</div></div>`;
  let tools = '<div class="dim">Estás mirando la forja.</div>';
  if (h) {
    const refs: Array<[string, Item]> = [...(Object.entries(h.equip) as Array<[string, Item]>).map(([k, it]): [string, Item] => [`e:${k}`, it]), ...h.bag.map((it, i): [string, Item] => [`b:${i}`, it])];
    const sel = itemByRef(h, ui.forgeRef);
    const price = recalibratePrice(h.forgeUses ?? 0);
    const recal = `<div class="forgecol"><h3>⚒️ Recalibrar</h3><div class="dim sm">Cambia un prefijo o sufijo por una estadística de tu clase. ${price} 💰 (sube con cada uso).</div>
      <div class="forgeitems">${refs.map(([ref, it]) => `<button class="cell ${RAR[it.rarity]} ${ui.forgeRef === ref ? 'on' : ''}" data-act="fsel" data-id="${ref}" ${tip(itemHtml(it, true))}>${itemIcon(it)}</button>`).join('') || '<span class="dim sm">No llevas objetos.</span>'}</div>
      ${sel ? `<div class="sm"><b class="${RAR[sel.rarity]}">${esc(sel.name)}</b></div><div class="affrow">${(sel.affixes ?? []).map((a, i) => `<button class="mini ${ui.forgeAffix === i ? 'on' : ''}" data-act="faff" data-id="${i}">${a.kind === 'prefix' ? 'Prefijo' : 'Sufijo'}: +${a.value} ${esc(STAT_NAME[a.stat])}</button>`).join('')}</div>
        ${ui.forgeAffix >= 0 && sel.affixes?.[ui.forgeAffix] ? `<div class="sm dim">Cambiar a:</div><div class="affrow">${recalStats(h, sel).filter((k) => k !== sel.affixes![ui.forgeAffix]!.stat).map((k) => `<button class="mini pri" data-act="frecal" data-id="${k}" ${h.gold < price ? 'disabled' : ''}>${esc(STAT_NAME[k])}</button>`).join('')}</div>` : ''}` : '<div class="dim sm">Elige un objeto.</div>'}</div>`;
    const scrap = `<div class="forgecol"><h3>🔨 Desguace de Ecos</h3><div class="dim sm">Rompe un objeto de la mochila y extrae Escofinas de Eco: Common 1, Uncommon 2, Rare 3, Legendary 5.</div>
      <div class="forgeitems">${h.bag.map((it, i) => `<button class="cell ${RAR[it.rarity]}" data-act="fscrap" data-id="${i}" ${tip(`${itemHtml(it, true)}<div class="sm good">Desguazar: +${SCRAP_YIELD[it.rarity]} Escofina(s)</div>`)}>${itemIcon(it)}<span class="qty">+${SCRAP_YIELD[it.rarity]}</span></button>`).join('') || '<span class="dim sm">Tu mochila está vacía (lo equipado no se puede desguazar).</span>'}</div></div>`;
    const spells = heroSpec(h).spells.filter((sp) => sp.charges === undefined).map((sp) => sp.id);
    const spSel = spells.includes(ui.forgeSpell) ? ui.forgeSpell : '';
    const hone = `<div class="forgecol"><h3>🔔 Templar hechizo</h3><div class="dim sm">Con ${HONE_COST} Escofinas eliges tú la mejora exacta de un hechizo (máx. ${MAX_SPELL_UPS} por hechizo). Tienes <b class="gold">${h.escofinas ?? 0}</b>.</div>
      <div class="forgeitems">${spells.map((id) => `<button class="cell ${spSel === id ? 'on' : ''} ${upgradeChoices(h, id).length ? '' : 'off'}" data-act="fspell" data-id="${id}" ${tip(spellTip(SPELLS[id]!))}>${spellIcon(SPELLS[id]!, false)}</button>`).join('')}</div>
      ${spSel ? `<div class="sm"><b>${esc(SPELLS[spSel]!.name)}</b> <span class="dim">(${upCount(h, spSel)}/${MAX_SPELL_UPS} mejoras)</span></div><div class="affrow">${upgradeChoices(h, spSel).map((up) => `<button class="mini pri" data-act="fhone" data-id="${up}" ${(h.escofinas ?? 0) < HONE_COST ? 'disabled' : ''} ${tip(esc(UPGRADES[up]!.text))}>${UPGRADES[up]!.icon} ${esc(UPGRADES[up]!.name)}</button>`).join('') || '<span class="dim sm">Este hechizo ya no admite más mejoras.</span>'}</div>` : '<div class="dim sm">Elige un hechizo.</div>'}</div>`;
    tools = `<div class="forgegrid">${recal}${scrap}${hone}</div>`;
  }
  const inner = `${heat}${tools}${r.log.length ? `<div class="panel note forgelog">${r.log.slice(-6).map((l) => `<div class="sm">🔥 ${esc(l)}</div>`).join('')}</div>` : ''}${advanceBar(run, 'Salir de la forja →')}`;
  frame(run, roomWin(forgeScene(r.heat), 'La Forja del Crisol', 'Yunques de transformación y un crisol que nunca se enfría. Cada golpe de martillo aviva el fuego… y lo que espera en la siguiente sala lo sentirá.', inner, `forgewin ${tier.id}`) + pendingRows(run));
}
