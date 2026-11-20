// Salas especiales con ventana propia: Altar de Pactos, Forja, Cofre (sala del botín) y Descanso.
import { CURSES, CHEST_CURSE_CHANCE, HEAT, HEAT_MAX, HONE_COST, PACTS, REST_TEXT, SCRAP_YIELD, curseOf, heatTier, pactOf, recalibratePrice } from '../content/pacts';
import { SPELLS } from '../core/classes/spells';
import { AFFIX_NAMES, SLOT_POOL, rollAffix, type Item, type StatKey } from '../core/items/items';
import { pick, rand, shuffle } from '../core/rng';
import { schoolOf } from '../core/tuning';
import { UPGRADES } from '../core/upgrades';
import { giveItem, healOf, heroMaxHp, heroSpec, upgradeChoices, zoneOf, type HeroSave, type RunState } from './run';

export type RoomState =
  | { kind: 'altar'; pacts: string[]; votes: Record<string, number>; result?: string }
  | { kind: 'forge'; heat: number; log: string[] }
  | { kind: 'chest'; opened: boolean; cursed?: string | null; lines?: string[] }
  | { kind: 'rest'; zone: number; picks: Record<string, number>; lines: string[] }
  | { kind: 'shrine'; zone: number };

export type RoomOp =
  | { op: 'pact'; idx: number }
  | { op: 'seal' }
  | { op: 'open' }
  | { op: 'rest'; idx: number }
  | { op: 'recal'; ref: string; affix: number; stat: StatKey }
  | { op: 'scrap'; idx: number }
  | { op: 'hone'; spell: string; up: string };

/** Entra en una sala especial (cambia la fase a «room»). */
export function enterRoom(run: RunState, kind: RoomState['kind'], firstRun = false): void {
  if (kind === 'altar') run.room = { kind, pacts: firstRun ? [] : shuffle(run, PACTS.map((p) => p.id)).slice(0, 2), votes: {} };
  else if (kind === 'forge') run.room = { kind, heat: 0, log: [] };
  else if (kind === 'chest') run.room = { kind, opened: false };
  else if (kind === 'shrine') run.room = { kind, zone: run.zone };
  else run.room = { kind: 'rest', zone: run.zone, picks: {}, lines: [] };
  if (run.room.kind === 'altar' && !run.room.pacts.length) run.room.result = 'El altar está frío. Aún no conocéis los nombres de los Pactos: volved cuando hayáis bajado una vez al Abismo.';
  run.phase = 'room';
}

/** ¿Se puede salir ya de la sala? */
export function roomDone(run: RunState): boolean {
  const r = run.room;
  if (!r) return true;
  if (r.kind === 'altar') return !!r.result;
  if (r.kind === 'chest') return r.opened;
  return true;
}

/** Lo que le falta elegir a un jugador en la sala (para el «Listo»). */
export function roomPending(run: RunState, h: HeroSave): string[] {
  const r = run.room;
  if (run.phase !== 'room' || !r) return [];
  if (r.kind === 'rest' && r.picks[h.owner] === undefined) return ['descanso'];
  return [];
}

/** Opciones de la hoguera: descansar (vida) o meditar (Escofinas). */
export const REST_OPTIONS = [
  { id: 'rest', name: 'Descansar', icon: '🔥', text: 'Recuperas el 40% de tu vida máxima.' },
  { id: 'meditate', name: 'Meditar', icon: '🔔', text: 'Ganas 2 Escofinas de Eco para la Forja (3 = una mejora de hechizo a elegir).' },
];

export function roomAction(run: RunState, h: HeroSave, a: RoomOp): string | null {
  const r = run.room;
  if (run.phase !== 'room' || !r) return 'No estáis en una sala especial';
  switch (a.op) {
    case 'pact': {
      if (r.kind !== 'altar' || r.result) return 'El pacto ya está sellado';
      if (!(a.idx >= 0 && a.idx < r.pacts.length)) return 'Pacto no válido';
      r.votes[h.owner] = a.idx;
      if (run.heroes.every((x) => r.votes[x.owner] !== undefined)) sealPact(run, run.heroes[0]!.owner);
      return null;
    }
    case 'seal':
      if (r.kind !== 'altar' || r.result || !Object.keys(r.votes).length) return 'Nada que sellar';
      sealPact(run, h.owner);
      return null;
    case 'open':
      if (r.kind !== 'chest' || r.opened) return 'El cofre ya está abierto';
      openChest(run);
      return null;
    case 'rest': {
      if (r.kind !== 'rest' || r.picks[h.owner] !== undefined) return 'Ya has elegido';
      const o = REST_OPTIONS[a.idx];
      if (!o) return 'Opción no válida';
      r.picks[h.owner] = a.idx;
      if (o.id === 'rest') {
        const max = heroMaxHp(h), before = h.hp;
        h.hp = Math.min(max, h.hp + Math.ceil(max * restHeal(run, h)));
        r.lines.push(`${h.name} descansa junto al fuego: +${h.hp - before} de vida.`);
      } else {
        h.escofinas = (h.escofinas ?? 0) + 2;
        r.lines.push(`${h.name} medita y afina su eco: +2 Escofinas de Eco (tiene ${h.escofinas}).`);
      }
      return null;
    }
    case 'recal': {
      if (r.kind !== 'forge') return 'Solo en la Forja';
      const it = itemByRef(h, a.ref);
      const af = it?.affixes?.[a.affix];
      if (!it || !af) return 'Objeto no válido';
      const options = recalStats(h, it);
      if (!options.includes(a.stat) || a.stat === af.stat) return 'Esa estadística no puede salir en esta ranura';
      const price = recalibratePrice(h.forgeUses ?? 0);
      if (h.gold < price) return `Necesitas ${price} de oro`;
      const hpBefore = heroMaxHp(h);
      h.gold -= price;
      h.forgeUses = (h.forgeUses ?? 0) + 1;
      const old = af.name;
      it.stats[af.stat] = (it.stats[af.stat] ?? 0) - af.value;
      if (!it.stats[af.stat]) delete it.stats[af.stat];
      af.stat = a.stat;
      af.id = `${af.kind}_${a.stat}`;
      af.value = rollAffix(run, a.stat, it.rarity, run.zone);
      af.name = AFFIX_NAMES[a.stat][af.kind];
      it.stats[a.stat] = (it.stats[a.stat] ?? 0) + af.value;
      if (af.kind === 'suffix' && it.rarity < 3 && it.name.endsWith(' ' + old)) it.name = it.name.slice(0, -old.length) + af.name;
      h.hp = Math.max(1, Math.min(heroMaxHp(h), h.hp + heroMaxHp(h) - hpBefore));
      heat(r, run, HEAT.recalibrate, `${h.name} recalibra ${it.name}: +${af.value} ${statLabel(a.stat)} (−${price} de oro).`);
      return null;
    }
    case 'scrap': {
      if (r.kind !== 'forge') return 'Solo en la Forja';
      const it = h.bag[a.idx];
      if (!it) return 'Solo se desguazan objetos de la mochila';
      h.bag.splice(a.idx, 1);
      const n = SCRAP_YIELD[it.rarity];
      h.escofinas = (h.escofinas ?? 0) + n;
      heat(r, run, HEAT.scrap, `${h.name} desguaza ${it.name}: +${n} Escofina${n > 1 ? 's' : ''} de Eco.`);
      return null;
    }
    case 'hone': {
      if (r.kind !== 'forge') return 'Solo en la Forja';
      if ((h.escofinas ?? 0) < HONE_COST) return `Necesitas ${HONE_COST} Escofinas de Eco`;
      if (!upgradeChoices(h, a.spell).includes(a.up)) return 'Esa mejora no se puede aplicar a ese hechizo';
      h.escofinas! -= HONE_COST;
      (h.ups[a.spell] ??= []).push(a.up);
      heat(r, run, HEAT.hone, `${h.name} templa ${SPELLS[a.spell]?.name ?? a.spell}: ${UPGRADES[a.up]?.name ?? a.up}.`);
      return null;
    }
  }
  return null;
}

/** Curación de la hoguera (0 con el Pacto de la Magia Desatada). */
export const restHeal = (run: RunState, h: HeroSave): number => (run.pact === 'desatada' ? 0 : healOf(run, h, 0.4));

function heat(r: Extract<RoomState, { kind: 'forge' }>, run: RunState, n: number, line: string): void {
  r.heat = Math.min(HEAT_MAX, r.heat + n);
  r.log.push(line);
  const t = heatTier(r.heat).id;
  run.overload = t === 'calm' ? null : t;
}

const statLabel = (k: StatKey): string => ({ hp: 'de vida', armor: 'de armadura', powerPhys: 'de daño físico', powerMagic: 'de daño mágico', crit: '% de crítico', ap: 'PA', mp: 'PM', initiative: 'de iniciativa', tackle: 'de placaje', dodge: 'de huida' } as Record<string, string>)[k] ?? k;

/** Objeto por referencia: «e:arma» (equipado) o «b:3» (mochila). */
export function itemByRef(h: HeroSave, ref: string): Item | undefined {
  const [w, v] = ref.split(':');
  if (w === 'e') return h.equip[v as keyof HeroSave['equip']];
  if (w === 'b') return h.bag[Number(v)];
  return undefined;
}

/** Estadísticas a las que se puede recalibrar un afijo: las de la ranura (el daño, del tipo de tu clase) y la iniciativa. */
export function recalStats(h: Pick<HeroSave, 'cls'>, it: Item): StatKey[] {
  const dmg: StatKey = schoolOf(h.cls) === 'magic' ? 'powerMagic' : 'powerPhys';
  const pool = SLOT_POOL[it.slot].map((k) => (k === 'dmg' ? dmg : k)).filter((k) => it.rarity >= 2 || (k !== 'ap' && k !== 'mp'));
  return [...new Set<StatKey>([dmg, 'initiative', ...pool])];
}

function sealPact(run: RunState, hostId: string): void {
  const r = run.room;
  if (r?.kind !== 'altar' || r.result) return;
  const count = r.pacts.map((_, i) => Object.values(r.votes).filter((v) => v === i).length);
  const max = Math.max(...count);
  const tied = count.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  const hv = r.votes[hostId];
  const win = tied.length > 1 && hv !== undefined && tied.includes(hv) ? hv : tied.length > 1 ? pick(run, tied) : tied[0]!;
  const p = pactOf(r.pacts[win])!;
  run.pact = p.id;
  for (const h of run.heroes) applyPact(run, h);
  r.result = `Sellado: ${p.icon} ${p.name}. ${p.boon}. A cambio: ${p.bane.charAt(0).toLowerCase()}${p.bane.slice(1)}.`;
}

/** Efectos del pacto al sellarlo. */
export function applyPact(run: RunState, h: HeroSave): void {
  const p = pactOf(run.pact);
  if (!p) return;
  const before = heroMaxHp(h);
  const st = p.stats ?? {};
  for (const [k, v] of Object.entries(st)) {
    if (k === 'hpPct') continue;
    const key = k as StatKey;
    h.boon[key] = (h.boon[key] ?? 0) + (v as number);
  }
  if (st.hpPct) h.boon.hp = (h.boon.hp ?? 0) + Math.round(heroSpec(h).maxHp * st.hpPct);
  if (p.id === 'ayuno') h.bag2 = {};
  if (p.id === 'ecos') h.escofinas = (h.escofinas ?? 0) + 3;
  const after = heroMaxHp(h);
  h.hp = Math.max(1, Math.min(after, h.hp + (after - before)));
}

function openChest(run: RunState): void {
  const r = run.room;
  if (r?.kind !== 'chest') return;
  r.opened = true;
  r.lines = [];
  if (rand(run) < CHEST_CURSE_CHANCE) {
    const c = pick(run, CURSES);
    r.cursed = c.id;
    if (c.id === 'mimico') for (const h of run.heroes) { const d = Math.ceil(heroMaxHp(h) * 0.2); h.hp = Math.max(1, h.hp - d); r.lines.push(`${h.name} pierde ${d} de vida.`); }
    else if (c.id === 'avaro') for (const h of run.heroes) { const g = Math.floor(h.gold * 0.25); h.gold -= g; r.lines.push(`${h.name} pierde ${g} de oro.`); }
    else if (c.id === 'guardianes') run.ambush = true;
    else if (c.id === 'eclipse') run.nextOmen = 'eclipse';
    else (run.hexes ??= []).push({ id: c.id, fights: c.fights });
    return;
  }
  r.cursed = null;
  for (const h of run.heroes) {
    const it = giveItem(run, h, 'elite', 1);
    r.lines.push(`${h.name}: ${it.name}`);
  }
  // un pellizco de oro para todos
  const gold = 15 + 10 * run.zone;
  for (const h of run.heroes) h.gold += gold;
  r.lines.push(`Y ${gold} de oro para cada uno.`);
}

/** Texto de la hoguera según la zona. */
export const restText = (zone: number): string => REST_TEXT[zone] ?? REST_TEXT[0]!;
export const curseText = (id: string): string => curseOf(id)?.text ?? '';
export const zoneName = (run: RunState): string => zoneOf(run).name;
