// Archivo del Abismo · catálogos (derivados del contenido real, sin duplicarlo), consultas y registro automático.
import { BLESSINGS } from '../core/boonmods';
import { CLASSES, PLAYABLE } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import type { ClassId, GameEvent } from '../core/state';
import { ZONA1_ENEMIES } from '../content/zona1/enemies';
import { ZONA2_ENEMIES } from '../content/zona2/enemies';
import { ZONA3_ENEMIES } from '../content/zona3/enemies';
import { ZONA4_ENEMIES } from '../content/zona4/enemies';
import { patronsOf } from '../content/boons';
import { RELICS } from '../content/relics';
import { catalogSpells } from '../content/spellCatalog';
import { ZONES } from '../content/zones';
import { DOCUMENTED_KILLS, LV, PAST_MAX, emptyArchive, isDiscovered, levelOf, raise, type Archive, type ArchiveCat } from './archiveData';
import { trackContract, type ContractEvent } from './contracts';
import { SPECIALS, evaluateSpecials, registerSpecial } from './specials';
import { grantUnlocks } from './shop';
import { ATLAS, CHRONICLES, atlasProgress, chronicleProgress } from './atlas';
import { ATLAS_CATS, CHRONICLE_CATS } from './archiveData';
import { LIMITE_PCT, MILESTONE_CATS, MILESTONE_PCTS, RELAMPAGO_ROUNDS, registerAtlasDiscovery, registerChronicleProgress } from './atlas';
import { meta, saveMeta } from './meta';
import { heroSpec, type RunState } from './run';
import { RUNE_LIST, SYNERGY_LIST, activeSynergies } from '../core/runes';

export { DOCUMENTED_KILLS, LV, isDiscovered, levelOf, type Archive, type ArchiveCat } from './archiveData';

/** Categorías que se muestran (las Reliquias se retiraron: sus registros se conservan, pero ya no se coleccionan). */
export const CATEGORIES: ArchiveCat[] = ['bestiary', 'grimoire', 'runes'];
export const CAT_NAME: Record<ArchiveCat, string> = { bestiary: 'Bestiario', grimoire: 'Grimorio', relics: 'Reliquias', runes: 'Runas', synergies: 'Sinergias' };
/** Nombre de cada nivel según la categoría (el 0 es siempre «sin descubrir»). */
export const LEVEL_NAME: Record<ArchiveCat, string[]> = {
  bestiary: ['Desconocido', 'Descubierto', 'Estudiado', 'Documentado'],
  grimoire: ['Desconocido', 'Descubierto', 'Utilizado'],
  relics: ['No descubierta', 'Descubierta'],
  runes: ['Desconocida', 'Descubierta', 'Utilizada'],
  synergies: ['Desconocida', 'Activada'],
};

// ---------- catálogos ----------
export interface BeastRef { id: string; zone: number }
const ZONE_ENEMIES = [ZONA1_ENEMIES, ZONA2_ENEMIES, ZONA3_ENEMIES, ZONA4_ENEMIES];
/** Enemigos del juego, por zona (1-4). Los aliados y los héroes convertidos en élite no están. */
export const BESTIARY: BeastRef[] = ZONE_ENEMIES.flatMap((z, i) => Object.keys(z).map((id) => ({ id, zone: i + 1 })));
const BEAST_IDS = new Set(BESTIARY.map((b) => b.id));
export const beastDef = (id: string) => ZONE_ENEMIES.map((z) => z[id]).find(Boolean);

export interface GrimoireRef { id: string; kind: 'spell' | 'blessing'; cls: ClassId }
/** Hechizos de las clases jugables (base, kits y hechizos de patrón) y sus bendiciones. Las mejoras de hechizo no son entradas. */
export const GRIMOIRE: GrimoireRef[] = (() => {
  const out = new Map<string, GrimoireRef>();
  for (const c of PLAYABLE) {
    const def = CLASSES[c];
    const ids = [...def.base, ...def.routes.flatMap((r) => r.spells)];
    for (const id of ids) if (SPELLS[id] && !out.has(id)) out.set(id, { id, kind: 'spell', cls: c });
  }
  for (const [id, sp] of Object.entries(SPELLS)) if (sp.route === 'boon' && !out.has(id) && PLAYABLE.some((c) => patronSpells(c).has(id))) out.set(id, { id, kind: 'spell', cls: PLAYABLE.find((c) => patronSpells(c).has(id))! });
  // H1: también las habilidades del catálogo que hoy no salen en ninguna oferta (legado)
  for (const c of PLAYABLE) for (const id of catalogSpells(c)) if (SPELLS[id] && !out.has(id)) out.set(id, { id, kind: 'spell', cls: c });
  for (const b of Object.values(BLESSINGS)) if ((PLAYABLE as string[]).includes(b.cls)) out.set(b.id, { id: b.id, kind: 'blessing', cls: b.cls as ClassId });
  return [...out.values()];
})();
const GRIM_IDS = new Set(GRIMOIRE.map((g) => g.id));
function patronSpells(c: ClassId): Set<string> { return new Set(patronsOf(c).flatMap((p) => p.spells)); }

export const RELIC_IDS = Object.keys(RELICS);

export const catalogIds = (cat: ArchiveCat): string[] => (cat === 'bestiary' ? BESTIARY.map((b) => b.id) : cat === 'grimoire' ? GRIMOIRE.map((g) => g.id) : cat === 'runes' ? RUNE_LIST.map((r) => r.id) : cat === 'synergies' ? SYNERGY_LIST.map((x) => x.id) : RELIC_IDS);

// ---------- acceso al Archivo guardado ----------
/** Archivo del jugador, ya sembrado con los datos antiguos del Salón la primera vez. */
export function archive(): Archive {
  const m = meta();
  const a = (m.archive ??= emptyArchive());
  if (!a.seeded) {
    a.seeded = true;
    // migración: un héroe guardado en el Salón demuestra que su clase se ha jugado, así que sus hechizos de base y de kit ya se conocían
    for (const c of m.hall) {
      const def = CLASSES[c.cls];
      if (!def) continue;
      for (const id of [...def.base, ...def.routes.filter((r) => (c.routes ?? []).includes(r.id)).flatMap((r) => r.spells)]) if (GRIM_IDS.has(id)) raise(a, 'grimoire', id, LV.found, { seen: 1 });
    }
  }
  return a;
}

// ---------- API pública del Archivo ----------
/** Descubre una entrada (si ya la tenías no cambia nada). Devuelve true si es nueva. */
export function discover(cat: ArchiveCat, id: string): boolean {
  if (!catalogIds(cat).includes(id) || isDiscovered(archive(), cat, id)) return false;
  raise(archive(), cat, id, LV.found, { seen: 1 });
  saveMeta();
  return true;
}
/** Sube el nivel de descubrimiento (nunca lo baja ni pasa del máximo de la categoría). Devuelve true si cambió. */
export function setLevel(cat: ArchiveCat, id: string, lv: number): boolean {
  if (!catalogIds(cat).includes(id) || lv <= levelOf(archive(), cat, id)) return false;
  raise(archive(), cat, id, lv);
  saveMeta();
  return true;
}
export const discovered = (cat: ArchiveCat, id: string): boolean => isDiscovered(archive(), cat, id);
export const levelFor = (cat: ArchiveCat, id: string): number => levelOf(archive(), cat, id);

export interface Progress { found: number; total: number; pct: number }
const prog = (found: number, total: number): Progress => ({ found, total, pct: total ? Math.round((found / total) * 100) : 0 });
/** Porcentaje de colección de una categoría (entradas descubiertas sobre las del catálogo actual). */
export function completion(cat: ArchiveCat): Progress {
  const a = archive(), ids = catalogIds(cat);
  return prog(ids.filter((id) => isDiscovered(a, cat, id)).length, ids.length);
}
/** Colección global del Archivo: Bestiario, Grimorio, Reliquias, entradas del Atlas y Crónicas completadas. */
export function archiveTotal(): Progress {
  const m = meta();
  const parts = [...CATEGORIES.map(completion), ...ATLAS_CATS.map((c) => atlasProgress(m, c)), ...CHRONICLE_CATS.map((c) => chronicleProgress(m, c))];
  return prog(parts.reduce((n, p) => n + p.found, 0), parts.reduce((n, p) => n + p.total, 0));
}
export function completionAll(): Progress {
  const ps = CATEGORIES.map(completion);
  return prog(ps.reduce((n, p) => n + p.found, 0), ps.reduce((n, p) => n + p.total, 0));
}

export interface ArchiveRow { id: string; lv: number; seen: number; n: number }
/** Entradas de una categoría (todas las del catálogo, descubiertas o no) con su estado guardado. */
export function entriesOf(cat: ArchiveCat): ArchiveRow[] {
  const a = archive();
  return catalogIds(cat).map((id) => ({ id, lv: a[cat][id]?.lv ?? 0, seen: a[cat][id]?.seen ?? 0, n: a[cat][id]?.n ?? 0 }));
}

// ---------- registro automático ----------
interface Snap { k: string; units: Map<number, { kind: string; team: string; owner: string | null }>; fight: number; zone: number; kind: string; omen: string | null; round: number; myAlive: boolean }
/** Seguimiento en memoria del combate en curso, por jugador local (en el juego hay uno por cliente). */
const snaps = new Map<string, Snap>();
const combatKey = (run: RunState): string => `${run.code}:${run.zone}:${run.step}:${run.fight}`;
/** Identifica la expedición (código de sala + jefes sorteados) para no contar dos veces lo mismo en ella. */
const runId = (run: RunState): string => `${run.code}:${run.bossPick.join('')}`;

/**
 * Registra en el Archivo lo que ve el jugador `myId` en este estado de la partida: reliquias y hechizos que tiene, enemigos
 * que aparecen y caen, hechizos que lanza y, en el Atlas y las Crónicas, zonas, eventos, pactos, presagios, historias,
 * secretos de combate e hitos de colección. Es idempotente (llamarla otra vez con el mismo estado y eventos no cambia nada,
 * ni tras recargar la página) y nunca lanza: un fallo aquí no debe interrumpir la partida. No da recompensas.
 */
export function recordArchive(run: RunState | null, myId: string, events: readonly GameEvent[] = []): boolean {
  try {
    const me = run?.heroes.find((h) => h.owner === myId);
    if (!run || !me || run.arena) return false;
    const m = meta(), a = archive(), id = runId(run);
    let snap = snaps.get(myId) ?? null;
    const before = progressKeys();
    let changed = false;
    const atlas = (...args: Parameters<typeof registerAtlasDiscovery> extends [unknown, ...infer R] ? R : never): void => { changed = registerAtlasDiscovery(m, ...args) || changed; };
    const contract = (e: ContractEvent): void => { changed = trackContract(m, e) || changed; };
    const chron = (...args: Parameters<typeof registerChronicleProgress> extends [unknown, ...infer R] ? R : never): void => { changed = registerChronicleProgress(m, ...args) || changed; };
    for (const r of me.relics) {
      if (RELICS[r] && !isDiscovered(a, 'relics', r)) changed = raise(a, 'relics', r, LV.found, { seen: 1 }) || changed;
    }
    // Grimorio rúnico: las runas que llevas o te ofrecen quedan descubiertas; las que llevas en combate, utilizadas.
    // Los contratos de «reliquia» cuentan ahora cada runa obtenida (una vez por runa y expedición).
    const RUNE_IDS = new Set(RUNE_LIST.map((x) => x.id));
    for (const r of [...(me.runes ?? []), ...(me.runeBag ?? [])]) if (RUNE_IDS.has(r)) { if (!isDiscovered(a, 'runes', r)) changed = raise(a, 'runes', r, LV.found, { seen: 1 }) || changed; contract({ t: 'relic', key: `${id}:rune:${r}` }); }
    for (const o of me.runeOffers ?? []) for (const r of o.runes) if (RUNE_IDS.has(r) && !isDiscovered(a, 'runes', r)) changed = raise(a, 'runes', r, LV.found, { seen: 1 }) || changed;
    if (run.combat) {
      const unit = run.combat.units.find((u) => u.owner === myId && u.summoner === undefined);
      for (const r of unit?.runes ?? []) if (RUNE_IDS.has(r) && levelOf(a, 'runes', r) < LV.studied) changed = raise(a, 'runes', r, LV.studied) || changed;
      for (const syn of activeSynergies(unit?.runes ?? [])) if (!isDiscovered(a, 'synergies', syn.id)) changed = raise(a, 'synergies', syn.id, LV.found, { seen: 1 }) || changed;
    }
    const owned = [...heroSpec(me).spells.map((sp) => sp.id), ...me.boons];
    for (const g of owned) if (GRIM_IDS.has(g) && !isDiscovered(a, 'grimoire', g)) changed = raise(a, 'grimoire', g, LV.found, { seen: 1 }) || changed;

    // Atlas y Crónicas de la expedición
    const zid = `z${run.zone + 1}`;
    atlas('zones', zid, 'unlocked', `${id}:${run.zone}`);
    chron('stories', `zona_${run.zone + 1}`, 1, `${id}:${run.zone}:in`);
    if ((PLAYABLE as string[]).includes(me.cls)) chron('stories', `clase_${me.cls}`, 1, `${id}:play`);
    if (run.pact) atlas('pacts', run.pact, 'unlocked', id);
    // modificadores de la expedición: encontrados al jugar con ellos, completados al ganar (una vez por expedición)
    for (const md of run.mods) { atlas('mods', md, 'unlocked', id); if (run.phase === 'won') atlas('mods', md, 'explored', `${id}:won`); }
    if (run.phase === 'event' && run.event) {
      atlas('events', run.event.id, 'unlocked', `${id}:${run.zone}:${run.step}`);
      if (run.event.result) { atlas('events', run.event.id, 'explored', `${id}:${run.zone}:${run.step}`); contract({ t: 'atlas', cat: 'events', key: `${id}:ev:${run.zone}:${run.step}` }); }
    }
    if (run.phase === 'won') { changed = registerSpecial(m, { t: 'won', cls: me.cls, pact: run.pact ?? null }) || changed; chron('stories', 'final_victoria', 1, id); chron('stories', `clase_${me.cls}`, 2, `${id}:won`); }
    if (run.phase === 'lost') chron('stories', 'final_derrota', 1, id);
    if (run.flags.includes('lore_eco')) chron('stories', 'eco_perdido', 1, id);

    if (run.combat) {
      const k = combatKey(run);
      if (snap?.k !== k) { snap = { k, units: new Map(), fight: run.fight, zone: run.zone, kind: run.kind, omen: run.omen, round: 0, myAlive: true }; snaps.set(myId, snap); }
      // un combate ya cerrado que vuelve a llegar (estado antiguo repetido) no cuenta nada
      if ((a.past ?? []).includes(k)) { snaps.delete(myId); snap = null; }
      else if (a.cur?.k !== k) {
        if (a.cur) a.past = [...(a.past ?? []).filter((x) => x !== a.cur!.k), a.cur.k].slice(-PAST_MAX);
        a.cur = { k, seen: [], dead: [], done: false, down: 0, low: 100 }; changed = true;
      }
    }
    if (run.combat && snap && a.cur?.k === snap.k) {
      snap.round = run.combat.round; snap.omen = run.omen ?? snap.omen; snap.myAlive = false;
      for (const u of run.combat.units) {
        snap.units.set(u.id, { kind: u.kind, team: u.team, owner: u.owner });
        if (u.team === 'enemy' && BEAST_IDS.has(u.kind) && !a.cur.seen.includes(u.kind)) { a.cur.seen.push(u.kind); raise(a, 'bestiary', u.kind, LV.found, { seen: 1 }); changed = true; }
        if (u.team === 'hero' && u.owner === myId && u.hp > 0) {
          snap.myAlive = true;
          const pct = Math.floor((u.hp / Math.max(1, u.maxHp)) * 100);
          if (pct < (a.cur.low ?? 100)) { a.cur.low = pct; changed = true; }
        }
      }
      if (run.omen) atlas('omens', run.omen, 'unlocked', `${id}:${run.fight}`);
    }
    const castSeen = new Map<string, number>();
    if (snap && a.cur?.k === snap.k) {
      for (const e of events) {
        if (e.t === 'death') {
          const u = snap.units.get(e.unit);
          if (!u || a.cur.dead.includes(e.unit)) continue;
          if (u.team === 'hero') { if (!(u.kind in CLASSES)) continue; a.cur.dead.push(e.unit); a.cur.down = (a.cur.down ?? 0) + 1; changed = true; continue; }
          if (u.team !== 'enemy' || !BEAST_IDS.has(u.kind)) continue;
          a.cur.dead.push(e.unit);
          raise(a, 'bestiary', u.kind, LV.studied, { n: 1 });
          if ((a.bestiary[u.kind]?.n ?? 0) >= DOCUMENTED_KILLS) raise(a, 'bestiary', u.kind, LV.documented);
          contract({ t: 'kill', enemy: u.kind, zone: snap.zone + 1, key: `${snap.k}:k${e.unit}` });
          changed = true;
        } else if (e.t === 'cast' && snap.units.get(e.unit)?.owner === myId) {
          if (GRIM_IDS.has(e.spell)) changed = raise(a, 'grimoire', e.spell, LV.studied) || changed;
          // héroe propio (no invocaciones): cada lanzamiento se identifica por ronda, turno, PA que le quedan y posición en el lote
          const u = snap.units.get(e.unit)!, live = run.combat?.units.find((x) => x.id === e.unit);
          if (u.kind in CLASSES) {
            const tag = `${snap.k}:c${snap.round}:${run.combat?.turn ?? 'end'}:${e.unit}:${e.spell}:${live?.ap ?? '-'}`;
            const nth = (castSeen.get(tag) ?? 0); castSeen.set(tag, nth + 1);
            contract({ t: 'cast', cls: u.kind, key: `${tag}:${nth}` });
          }
        }
      }
      // el combate acaba en victoria cuando desaparece y la cuenta de combates ganados sube en uno
      if (!run.combat && !a.cur.done && run.fight === snap.fight + 1) {
        a.cur.done = true; changed = true;
        const fid = `${id}:${snap.fight}`;
        if (snap.omen) { atlas('omens', snap.omen, 'explored', fid); contract({ t: 'atlas', cat: 'omens', key: `${fid}:omen` }); }
        if (snap.kind === 'boss') {
          atlas('zones', `z${snap.zone + 1}`, 'explored', `${id}:${snap.zone}`);
          contract({ t: 'atlas', cat: 'zones', key: `${id}:boss:${snap.zone}` });
          const boss = ZONES[snap.zone]?.bosses[run.bossPick[snap.zone] ?? 0]?.id;
          if (boss) changed = registerSpecial(m, { t: 'boss', boss, downs: a.cur.down ?? 0, rounds: snap.round, pact: run.pact ?? null }) || changed;
          chron('stories', `zona_${snap.zone + 1}`, 2, `${id}:${snap.zone}:boss`);
          if (run.pact) atlas('pacts', run.pact, 'explored', `${id}:${snap.zone}`);
        }
        if ((snap.kind === 'elite' || snap.kind === 'boss') && !a.cur.down) chron('secrets', 'intocables', 1, fid);
        if (snap.round <= RELAMPAGO_ROUNDS) chron('secrets', 'relampago', 1, fid);
        if ((a.cur.low ?? 100) < LIMITE_PCT && snap.myAlive) chron('secrets', 'al_limite', 1, fid);
      }
    }
    if (changed) {
      evaluateMilestones(); evaluateSpecials(m);
      for (const x of grantUnlocks(m)) notices.push({ icon: '🎁', kind: 'special', text: `Desbloqueado en la tienda: ${x.name}` });
      saveMeta(); pushNotices(before, progressKeys());
    }
    return changed;
  } catch {
    return false;
  }
}

// ---------- notificaciones ----------
/** Todo lo conseguido, como claves `tipo:id`, para saber qué es nuevo tras un registro. */
function progressKeys(): Set<string> {
  const m = meta(), a = archive(), out = new Set<string>();
  for (const c of ['bestiary', 'grimoire', 'relics', 'runes', 'synergies'] as const) for (const id of Object.keys(a[c])) out.add(`${c}:${id}`);
  for (const [c, rec] of Object.entries(a.atlas)) for (const id of Object.keys(rec)) out.add(`atlas:${c}:${id}`);
  for (const [c, rec] of Object.entries(a.chronicles)) for (const [id, e] of Object.entries(rec)) if (e.state === 'completed') out.add(`chron:${c}:${id}`);
  for (const c of [...(m.contracts?.daily ?? []), ...(m.contracts?.weekly ?? [])]) if (c.completed) out.add(`contract:${c.id}`);
  for (const [id, r] of Object.entries(m.contracts?.special ?? {})) if (r.completed) out.add(`special:${id}`);
  return out;
}
export interface ArchiveNotice { icon: string; text: string; kind: 'archive' | 'chronicle' | 'contract' | 'special' }
let notices: ArchiveNotice[] = [];
function pushNotices(before: Set<string>, after: Set<string>): void {
  const fresh = [...after].filter((k) => !before.has(k));
  if (!fresh.length) return;
  const m = meta(), count = (p: string): number => fresh.filter((k) => k.startsWith(p)).length;
  for (const k of fresh) {
    const [t, x, y] = k.split(':');
    if (t === 'bestiary') notices.push({ icon: '📖', kind: 'archive', text: `Bestiario: ${beastDef(x!)?.name ?? x}` });
    else if (t === 'relics') notices.push({ icon: '🏺', kind: 'archive', text: `Reliquia: ${RELICS[x!]?.name ?? x}` });
    else if (t === 'runes') notices.push({ icon: '✧', kind: 'archive', text: `Runa descubierta: ${RUNE_LIST.find((r) => r.id === x)?.name ?? x}` });
    else if (t === 'synergies') notices.push({ icon: '🔗', kind: 'archive', text: `Sinergia descubierta: ${SYNERGY_LIST.find((r) => r.id === x)?.name ?? x}` });
    else if (t === 'atlas') { const r = ATLAS[x as keyof typeof ATLAS]?.find((e) => e.id === y); if (r) notices.push({ icon: '🗺️', kind: 'archive', text: `Atlas: ${r.name}` }); }
    else if (t === 'chron') { const r = CHRONICLES[x as keyof typeof CHRONICLES]?.find((e) => e.id === y); if (r) notices.push({ icon: x === 'secrets' ? '🔓' : x === 'milestones' ? '🏆' : '📜', kind: 'chronicle', text: `${x === 'secrets' ? 'Secreto' : x === 'milestones' ? 'Hito' : 'Crónica'}: ${r.name}` }); }
    else if (t === 'contract') { const c = [...(m.contracts?.daily ?? []), ...(m.contracts?.weekly ?? [])].find((e) => e.id === k.slice(9)); if (c) notices.push({ icon: '📋', kind: 'contract', text: `Contrato cumplido: ${c.title} (cóbralo en el Archivo)` }); }
    else if (t === 'special') { const d = SPECIALS().find((e) => e.id === x); if (d) notices.push({ icon: '🏅', kind: 'special', text: `Desafío especial: ${d.title}` }); }
  }
  const g = count('grimoire:');
  if (g) notices.push({ icon: '✨', kind: 'archive', text: `Grimorio: ${g === 1 ? '1 entrada nueva' : `${g} entradas nuevas`}` });
  notices = notices.slice(-12);
}
/** Avisos pendientes de mostrar (y los vacía). */
export function drainArchiveNotices(): ArchiveNotice[] { const n = notices; notices = []; return n; }

/** Hitos de colección: avance = % descubierto de Bestiario, Grimorio y Reliquias. */
export function evaluateMilestones(): boolean {
  let changed = false;
  for (const c of MILESTONE_CATS) {
    const pct = completion(c).pct;
    for (const p of MILESTONE_PCTS) if (pct >= 1) changed = registerChronicleProgress(meta(), 'milestones', `${c}_${p}`, pct) || changed;
  }
  return changed;
}
/** Solo para pruebas: olvida el estado de seguimiento en memoria. */
export const resetArchiveTracking = (): void => { snaps.clear(); };
