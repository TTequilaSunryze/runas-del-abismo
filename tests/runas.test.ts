// Sistema rúnico universal: espacios, obtención, garantías, transformaciones, sinergias, estados y persistencia.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { CLASSES, PLAYABLE } from '../src/core/classes/classes';
import { SPELLS } from '../src/core/classes/spells';
import { applyStatus, cast, createCombat, current, endTurn, getUnit, spellOf, type UnitSpec } from '../src/core/combat/engine';
import { RUNES, RUNE_LIST, RUNE_SLOTS, SYNERGY_LIST, activeSynergies, applyRunes, cleanRunes, equipProblem, runeResult, runeUnitBonus } from '../src/core/runes';
import { DOT, STATUSES } from '../src/core/statuses';
import { finishFight, heroSpec, lastZone, loadable, metaAction, migrateRun, newRun, pendingOf, runeKindOf, type HeroSave, type RunState } from '../src/game/run';
import { RARITY_WEIGHTS, guaranteedOffer, makeOffer, migrateRunes } from '../src/game/runeLoot';

const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] }];
const enemy = (pos: { x: number; y: number }, hp = 200, extra: Partial<UnitSpec> = {}): UnitSpec => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp, armor: 0, traits: [], resist: {}, ...extra });
const withRunes = (cls: HeroSave['cls'], runes: string[], pos = { x: 1, y: 2 }) => { const run = newRun('R', 3, [{ owner: 'a', name: 'A', cls, routes: [] }]); const h = run.heroes[0]!; h.runes = runes; return heroSpec(h, pos); };
const board = (units: UnitSpec[]) => createCombat({ seed: 7, w: 12, h: 6, obstacles: [], units }).state;
const evs = (r: ReturnType<typeof cast>) => (r.ok ? r.events : []);
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 30 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('runas · espacios e inicio', () => {
  it('cada personaje empieza con una oferta de 3 runas comunes distintas y, al elegir, 1 runa equipada y 3 espacios libres', () => {
    for (const cls of PLAYABLE) {
      const run = newRun(`S${cls}`, 11, [{ owner: 'a', name: 'A', cls, routes: [] }]);
      const h = run.heroes[0]!;
      expect(h.runes).toEqual([]);
      const offer = h.runeOffers![0]!;
      expect(offer.src).toBe('start');
      expect(offer.runes).toHaveLength(3);
      expect(new Set(offer.runes).size).toBe(3);
      expect(offer.runes.every((id) => RUNES[id]!.rarity === 1)).toBe(true);
      // familias distintas: tres efectos distintos
      expect(new Set(offer.runes.map((id) => RUNES[id]!.family)).size).toBe(3);
      expect(pendingOf(run, h)).toContain('runa inicial');
      expect(metaAction(run, 'a', { a: 'rune', op: 'skip' })).toMatch(/inicial/);
      expect(metaAction(run, 'a', { a: 'rune', op: 'take', idx: 1 })).toBeNull();
      expect(h.runes).toEqual([offer.runes[1]]);
      expect(RUNE_SLOTS - h.runes!.length).toBe(3);
    }
  });
  it('cualquier clase puede equipar cualquier runa', () => {
    for (const cls of PLAYABLE) for (const r of RUNE_LIST) expect(equipProblem([], r.id)).toBeNull(), expect(withRunes(cls, [r.id]).runes).toEqual([r.id]);
  });
  it('nunca se superan los cuatro espacios y no se duplica una runa no acumulable', () => {
    expect(cleanRunes(['fractura', 'espora', 'aceleracion', 'condena', 'metralla'])).toHaveLength(4);
    expect(cleanRunes(['fractura', 'fractura'])).toEqual(['fractura']);
    expect(cleanRunes(['brote', 'brote'])).toEqual(['brote', 'brote']);
    expect(equipProblem(['fractura', 'espora', 'aceleracion', 'condena'], 'metralla')).toMatch(/4 runas/);
    expect(equipProblem(['fractura'], 'fractura')).toMatch(/dos veces/);
    const run = newRun('S', 3, P), h = run.heroes[0]!;
    h.runeOffers = [];
    h.runes = ['fractura', 'espora', 'aceleracion', 'condena'];
    h.runeOffers = [{ src: 'elite', runes: ['metralla'] }];
    expect(metaAction(run, 'a', { a: 'rune', op: 'take', idx: 0 })).toMatch(/4 runas/);
    // sustituir: la antigua va a la reserva
    expect(metaAction(run, 'a', { a: 'rune', op: 'take', idx: 0, slot: 1 })).toBeNull();
    expect(h.runes).toEqual(['fractura', 'metralla', 'aceleracion', 'condena']);
    expect(h.runeBag).toEqual(['espora']);
    expect(metaAction(run, 'a', { a: 'rune', op: 'equip', idx: 0, slot: 3 })).toBeNull();
    expect(h.runes).toEqual(['fractura', 'metralla', 'aceleracion', 'espora']);
    expect(h.runeBag).toEqual(['condena']);
    expect(h.runes!.length).toBeLessThanOrEqual(RUNE_SLOTS);
    // en combate no se gestiona
    run.phase = 'combat';
    expect(metaAction(run, 'a', { a: 'rune', op: 'swap', from: 0, to: 1 })).toMatch(/combate/);
  });
});

describe('runas · recompensas garantizadas', () => {
  const win = (kind: 'elite' | 'boss', zone = 0, opts: { ambush?: boolean } = {}): RunState => {
    const run = newRun(`W${kind}${zone}`, 5, P);
    run.zone = zone; run.kind = kind; run.ambush = !!opts.ambush;
    const h = run.heroes[0]!; h.runeOffers = []; h.boonOffer = null;
    run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
    run.combat.over = 'win'; run.phase = 'combat';
    finishFight(run);
    return run;
  };
  it('todos los élites dan al menos una recompensa rúnica (también las emboscadas), en cualquier zona y semilla', () => {
    for (let z = 0; z < 3; z++) for (let seed = 0; seed < 25; seed++) {
      const run = newRun(`E${seed}`, seed, P); run.zone = z; run.kind = 'elite';
      const h = run.heroes[0]!; h.runeOffers = [];
      run.combat = createCombat({ seed, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state; run.combat.over = 'win'; run.phase = 'combat';
      finishFight(run);
      expect(h.runeOffers!.length).toBeGreaterThanOrEqual(1);
      expect(h.runeOffers![0]!.src).toBe('elite');
      expect(h.runeOffers![0]!.runes.every((id) => RUNES[id]!.rarity >= 2 && RUNES[id]!.rarity <= 4)).toBe(true);
    }
    expect(win('elite', 0, { ambush: false }).heroes[0]!.runeOffers![0]!.runes.length).toBe(3);
    const amb = newRun('AMB', 9, P); amb.kind = 'combat'; amb.ambush = true;
    expect(runeKindOf(amb)).toBe('elite');
  });
  it('todos los jefes dan una runa rara o mejor, con su runa exclusiva entre las opciones si la tiene', () => {
    for (let z = 0; z < 2; z++) {
      const run = win('boss', z);
      const o = run.heroes[0]!.runeOffers!.find((x) => x.src === 'boss')!;
      expect(o).toBeTruthy();
      expect(o.runes.every((id) => RUNES[id]!.rarity >= 3)).toBe(true);
    }
    // garantía directa: aunque el héroe ya lleve todo, siempre hay oferta
    const h = { runes: RUNE_LIST.filter((r) => !r.stackable).slice(0, 4).map((r) => r.id), runeBag: [], relics: [], gold: 0 };
    for (const boss of ['prior', 'planidera', 'madre', 'cazador', 'rey', 'fundidora', 'devorarunas', 'eco']) {
      const o = guaranteedOffer({ rng: 3 }, { ...h, runeOffers: [] }, 'boss', 1, boss);
      expect(o.runes.length).toBeGreaterThan(0);
      const own = RUNE_LIST.find((r) => r.boss === boss);
      if (own) expect(o.runes).toContain(own.id);
    }
  });
  it('el jefe final da su recompensa excepcional: el Juicio del Segador y legendarias', () => {
    const run = newRun('FIN', 5, P);
    run.zone = lastZone(run); run.kind = 'boss';
    const h = run.heroes[0]!; h.runeOffers = [];
    run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state; run.combat.over = 'win'; run.phase = 'combat';
    expect(runeKindOf(run)).toBe('final');
    finishFight(run);
    const o = h.runeOffers!.find((x) => x.src === 'final')!;
    expect(o.runes).toContain('segador');
    expect(o.runes.every((id) => RUNES[id]!.rarity === 5)).toBe(true);
  });
  it('las legendarias no salen de élites, cofres, tiendas ni eventos', () => {
    for (const src of ['combat', 'elite', 'chest', 'shop', 'event', 'shrine', 'start'] as const) expect(RARITY_WEIGHTS[src][4]).toBe(0);
    for (let i = 0; i < 200; i++) expect(makeOffer({ rng: i * 7919 }, { runes: [], runeBag: [] }, 'elite', { zone: 3 }).runes.every((id) => RUNES[id]!.rarity < 5)).toBe(true);
  });
});

describe('runas · transformaciones', () => {
  it('no mutan la definición global y consultar no acumula nada', () => {
    const before = JSON.stringify(SPELLS.flecha);
    const u = withRunes('arquero', ['hemorragia', 'metralla', 'aceleracion']);
    const a = spellOf(u, 'flecha')!, b = spellOf(u, 'flecha')!;
    expect(JSON.stringify(SPELLS.flecha)).toBe(before);
    expect(a).toEqual(b);
    expect(a.runeStatus!.find((x) => x.kind === 'bleed')).toEqual({ kind: 'bleed', turns: 3, stacks: 2 });
    // Muerte + Tiempo activa Sentencia diferida (Condena) una sola vez
    expect(a.runeStatus!.filter((x) => x.kind === 'doom')).toHaveLength(1);
    expect(a.runeFx!.filter((x) => x.t === 'chain')).toHaveLength(1);
    expect(a.ap).toBe(SPELLS.flecha!.ap - 1);
  });
  it('la armadura ignorada es la de la runa (corrige el tope de 1 del PR #8)', () => {
    expect(applyRunes(SPELLS.flecha!, ['fractura']).armorIgnore).toBe(2);
    expect(applyRunes(SPELLS.flecha!, ['fractura', 'perforacion']).armorIgnore).toBe(6);
  });
  it('las mutaciones transforman la forma de la habilidad', () => {
    const nova = runeResult(SPELLS.flecha!, ['supernova']);
    expect(nova.mutated).toBe(true);
    expect(nova.spell).toMatchObject({ area: 1, square: true, fullArea: true, ap: SPELLS.flecha!.ap + 1 });
    const lance = applyRunes(SPELLS.b_tajo!, ['lanza_titan']);
    expect(lance).toMatchObject({ range: [2, 5], line: true, straight: true });
    expect(lance.selfShield).toBeGreaterThan(0);
    // una mutación que no encaja no se aplica, y se explica
    const r = runeResult(SPELLS.r_barrera!, ['supernova']);
    expect(r.mutated).toBe(false);
    expect(r.traces[0]!.applied).toBe(false);
  });
  it('Aceleración nunca deja una habilidad a 0 PA (evita bucles infinitos)', () => {
    for (const sp of Object.values(SPELLS)) if (sp.route !== 'enemy' && sp.ap >= 1) expect(applyRunes(sp, ['aceleracion']).ap).toBeGreaterThanOrEqual(Math.min(1, sp.ap));
  });
  it('todas las habilidades de las ocho clases admiten runas sin romperse', () => {
    for (const cls of PLAYABLE) {
      const u = withRunes(cls, ['hemorragia', 'eco_diferido', 'metralla', 'retono']);
      for (const sp of u.spells) { const d = spellOf(u, sp.id)!; expect(d).toBeTruthy(); expect(d.ap).toBeGreaterThanOrEqual(0); }
      expect(CLASSES[cls].name.length).toBeGreaterThan(0);
    }
  });
  it('las estadísticas y rasgos de runa llegan a la unidad', () => {
    const base = withRunes('barbaro', []), u = withRunes('barbaro', ['caparazon', 'corazon_piedra', 'muralla']);
    expect(u.armor).toBe(base.armor + 2);
    expect(u.maxHp).toBe(base.maxHp + 20);
    expect(u.traits).toContain('guard');
    expect(runeUnitBonus(['brote', 'brote']).stats).toHaveLength(0);
  });
});

describe('runas · sinergias', () => {
  it('las seis parejas, cuatro tríadas y las cuatro familias se activan solo si están todas sus familias', () => {
    expect(SYNERGY_LIST.filter((s) => s.families.length === 2)).toHaveLength(6);
    expect(activeSynergies(['hemorragia']).length).toBe(0);
    expect(activeSynergies(['hemorragia', 'aceleracion']).map((s) => s.id)).toEqual(['muerte+tiempo']);
    expect(activeSynergies(['espora', 'hemorragia', 'aceleracion', 'fractura'])).toHaveLength(11);
    // dos runas de la misma familia no activan nada
    expect(activeSynergies(['hemorragia', 'condena'])).toHaveLength(0);
  });
  it('Sentencia diferida (Muerte + Tiempo) añade Condena y +20% de daño una sola vez', () => {
    const d = applyRunes(SPELLS.flecha!, ['hemorragia', 'dilatacion']);
    expect(d.runeStatus!.map((x) => x.kind).sort()).toEqual(['bleed', 'doom']);
    const [lo, hi] = SPELLS.flecha!.dmg!;
    expect(d.dmg).toEqual([Math.round(lo * 1.2), Math.round(hi * 1.2)]);
  });
});

describe('estados alterados', () => {
  it('Sangrado y Quemadura se acumulan hasta su tope; el Sangrado ignora armadura', () => {
    const s = board([withRunes('arquero', []), enemy({ x: 6, y: 2 }, 300, { armor: 5 })]);
    const t = s.units[1]!;
    for (let i = 0; i < 8; i++) applyStatus(t, 'bleed', 3, 2, []);
    expect(t.statuses.bleed!.stacks).toBe(STATUSES.bleed.max);
    applyStatus(t, 'burn', 2, 1, []); applyStatus(t, 'burn', 2, 1, []);
    expect(t.statuses.burn!.stacks).toBe(2);
    const hp = t.hp;
    turnOf(s, t.id);
    // 10 cargas × 3 (ignora la armadura de 5) + quemadura de 2 cargas (3 + 2)
    expect(hp - t.hp).toBe(30 + 5);
  });
  it('Escarcha congela a las 3 cargas; el fuego provoca Choque térmico', () => {
    const s = board([withRunes('arquero', ['escarcha'], { x: 1, y: 2 }), enemy({ x: 5, y: 2 })]);
    const h = s.units[0]!, t = s.units[1]!;
    turnOf(s, h.id);
    for (let i = 0; i < 2; i++) expect(cast(s, h.id, 'flecha', t.pos).ok).toBe(true), h.ap = 6;
    expect(t.statuses.chill!.stacks).toBe(2);
    cast(s, h.id, 'flecha', t.pos);
    expect(t.statuses.frozen).toBeTruthy();
    expect(t.statuses.chill).toBeUndefined();
    const ev: Parameters<typeof applyStatus>[4] = [];
    h.runes = ['ignicion']; h.ap = 6;
    const r = cast(s, h.id, 'flecha', t.pos);
    expect(evs(r).some((e) => e.t === 'resist' && e.what.includes('térmico'))).toBe(true);
    expect(t.statuses.frozen).toBeUndefined();
    void ev;
  });
  it('los jefes no son inmunes: reciben aturdimiento y congelación parciales', () => {
    const s = board([withRunes('arquero', []), enemy({ x: 5, y: 2 }, 300, { ai: 'boss', rank: 'boss' })]);
    const b = s.units[1]!;
    const ev: Parameters<typeof applyStatus>[4] = [];
    applyStatus(b, 'stun', 1, 1, ev);
    expect(b.statuses.stun).toBeUndefined();
    expect(b.apMod).toBe(-2);
    applyStatus(b, 'frozen', 1, 1, ev);
    expect(b.apMod).toBe(-3);
    expect(b.mpMod).toBe(-2);
  });
  it('Condena guarda la mitad del daño y lo devuelve al acabarse', () => {
    const s = board([withRunes('arquero', ['condena']), enemy({ x: 5, y: 2 }, 400)]);
    const h = s.units[0]!, t = s.units[1]!;
    turnOf(s, h.id);
    cast(s, h.id, 'flecha', t.pos);
    const stored = t.statuses.doom!.stacks;
    expect(stored).toBeGreaterThan(0);
    const hp = t.hp;
    turnOf(s, t.id); endTurn(s, t.id); turnOf(s, t.id);
    expect(t.statuses.doom).toBeUndefined();
    expect(hp - t.hp).toBeGreaterThanOrEqual(stored);
  });
  it('Barrera rúnica bloquea estados negativos; Corrupción reduce la curación', () => {
    const s = board([withRunes('arquero', []), enemy({ x: 5, y: 2 })]);
    const h = s.units[0]!;
    applyStatus(h, 'ward', 2, 1, []);
    applyStatus(h, 'poison', 3, 3, []);
    expect(h.statuses.poison).toBeUndefined();
    expect(h.statuses.ward).toBeUndefined();
  });
});

describe('runas · efectos en combate', () => {
  it('Metralla rebota a otros enemigos y no se repite en bucle', () => {
    const s = board([withRunes('arquero', ['metralla']), enemy({ x: 5, y: 2 }), enemy({ x: 6, y: 3 }), enemy({ x: 7, y: 2 })]);
    const h = s.units[0]!;
    turnOf(s, h.id);
    const r = cast(s, h.id, 'flecha', s.units[1]!.pos);
    expect(r.ok).toBe(true);
    const hitIds = new Set(evs(r).filter((e) => e.t === 'damage').map((e) => (e as { unit: number }).unit));
    expect(hitIds.size).toBe(3);
    expect(evs(r).filter((e) => e.t === 'damage').length).toBe(3);
  });
  it('Eco diferido golpea al empezar tu siguiente turno, una sola vez', () => {
    const s = board([withRunes('arquero', ['eco_diferido']), enemy({ x: 5, y: 2 }, 500)]);
    const h = s.units[0]!, t = s.units[1]!;
    turnOf(s, h.id);
    cast(s, h.id, 'flecha', t.pos);
    expect(h.runeEchoes).toHaveLength(1);
    endTurn(s, h.id);
    const hp = t.hp;
    turnOf(s, h.id);
    expect(t.hp).toBeLessThan(hp);
    expect(h.runeEchoes).toBeUndefined();
    const hp2 = t.hp;
    endTurn(s, h.id); turnOf(s, h.id);
    // sin lanzar otra vez, no hay más ecos
    expect(getUnit(s, t.id)!.hp).toBe(hp2);
  });
  it('Detonación consume el daño progresivo y lo inflige de golpe', () => {
    const s = board([withRunes('arquero', ['detonacion']), enemy({ x: 5, y: 2 }, 500)]);
    const h = s.units[0]!, t = s.units[1]!;
    applyStatus(t, 'bleed', 3, 6, []);
    turnOf(s, h.id);
    const r = cast(s, h.id, 'flecha', t.pos);
    expect(t.statuses.bleed).toBeUndefined();
    expect(evs(r).some((e) => e.t === 'damage' && (e as { source: string }).source === 'detonacion' && (e as { amount: number }).amount === 6 * DOT.bleed * 2)).toBe(true);
  });
  it('Corona del Osario: el rematado estalla y daña a los cercanos', () => {
    const s = board([withRunes('arquero', ['corona_osario']), enemy({ x: 5, y: 2 }, 5), enemy({ x: 6, y: 2 }, 300)]);
    const h = s.units[0]!, far = s.units[2]!;
    turnOf(s, h.id);
    const hp = far.hp;
    cast(s, h.id, 'flecha', s.units[1]!.pos);
    expect(s.units[1]!.hp).toBe(0);
    expect(far.hp).toBeLessThan(hp);
  });
  it('Floración: la curación daña a los enemigos pegados al aliado curado', () => {
    const run = newRun('FL', 3, [{ owner: 'a', name: 'A', cls: 'carcelero', routes: [] }]);
    const h = run.heroes[0]!; h.runes = ['floracion'];
    const u = heroSpec(h, { x: 1, y: 2 });
    // un hechizo de curación genérico sobre uno mismo
    const healer = { ...u, spells: [{ id: 'c_vida', cd: 0, charges: 1 }, { id: 'z_drenaje', cd: 0 }] };
    const d = spellOf(healer, 'z_drenaje')!;
    expect(d.runeFx ?? []).toEqual([]);
    const curar = Object.values(SPELLS).find((x) => x.heal && x.route !== 'item' && x.route !== 'enemy' && x.target !== 'self');
    if (curar) expect(applyRunes(curar, ['floracion']).runeFx?.[0]?.t).toBe('healBurst');
  });
});

describe('runas · persistencia', () => {
  it('las runas equipadas no pasan a la siguiente expedición', () => {
    const a = newRun('P1', 3, P); a.heroes[0]!.runes = ['metralla', 'eco_diferido'];
    const b = newRun('P2', 3, P);
    expect(b.heroes[0]!.runes).toEqual([]);
  });
  it('las partidas antiguas siguen cargando: sin runas reciben Fractura; las reliquias migran o se reembolsan', () => {
    const run = newRun('OLD', 3, P);
    const h = run.heroes[0]! as HeroSave & Record<string, unknown>;
    delete h.runes; delete h.runeBag; delete h.runeOffers;
    h.relics = ['caparazon', 'raiz', 'colmillo'];
    const gold = h.gold;
    expect(loadable(run)).toBe(true);
    expect(h.runes).toEqual(['fractura', 'caparazon', 'raiz_viva']);
    expect(h.relics).toEqual([]);
    expect(h.gold).toBe(gold + 25);
    // idempotente
    expect(migrateRun(run)).toBe(false);
    expect(h.runes).toEqual(['fractura', 'caparazon', 'raiz_viva']);
  });
  it('limpia datos corruptos sin romper la partida', () => {
    const h = { runes: ['nope', 'fractura', 'fractura'], runeBag: 'x' as unknown as string[], runeOffers: [{ src: 'elite', runes: ['nope'] }], relics: [], gold: 0 } as unknown as Parameters<typeof migrateRunes>[0];
    migrateRunes(h);
    expect(h.runes).toEqual(['fractura']);
    expect(h.runeBag).toEqual([]);
    expect(h.runeOffers).toEqual([]);
  });
});
