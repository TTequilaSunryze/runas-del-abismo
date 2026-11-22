// Fase H3: configurador de 4 habilidades, de la sala a la partida y al Salón.
import { describe, expect, it } from 'vitest';
import { SPELL_CATALOG, catalogSpells } from '../src/content/spellCatalog';
import { CLASSES, PLAYABLE } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, createCombat, current, endTurn } from '../src/core/combat/engine';
import { makeEnemy } from '../src/content/enemies';
import { emptyArchive } from '../src/game/archiveData';
import { emptyCosmetics } from '../src/game/cosmetics';
import { cleanKits, mergeMeta, meta, type Meta } from '../src/game/meta';
import { championOf, championUnit, cleanChampion, cleanKit, heroSpec, newRun } from '../src/game/run';
import { buyItem, kitFor, ownedSpells, resetKit, setKitSlot, spellItemId } from '../src/game/shop';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } } as Storage;
const reset = (ecos = 2000): Meta => { const m = meta(); m.ecos = ecos; m.cosmetics = emptyCosmetics(); m.archive = emptyArchive(); m.unlocked = ['h2_grimorio']; m.mastery = {}; m.kits = {}; return m; };
const ids = (spells: Array<{ id: string; charges?: number }>): string[] => spells.filter((s) => s.charges === undefined).map((s) => s.id);
const KIT = ['t_pulso', 't_vacio', 't_descarga', 't_singularidad'];

describe('H3 · el héroe empieza con sus 4 habilidades', () => {
  it('una configuración válida sustituye al kit de ruta; una inválida no', () => {
    const at = { x: 0, y: 0 };
    expect(ids(makeHero({ cls: 'esferas', name: 'x', owner: 'x', routes: ['base'], pos: at, kit: KIT }).spells)).toEqual(KIT);
    for (const bad of [['t_pulso', 't_pulso', 't_descarga', 't_vacio'], ['z_orbe', 't_vacio', 't_descarga', 't_pulso'], ['t_pulso', 't_vacio']])
      expect(ids(makeHero({ cls: 'esferas', name: 'x', owner: 'x', routes: ['base'], pos: at, kit: bad }).spells)).toEqual(CLASSES.esferas.base);
  });
  it('la sala pasa la configuración a la partida y queda fija en el héroe', () => {
    const run = newRun('H3', 3, [{ owner: 'a', name: 'A', cls: 'esferas', routes: ['base'], kit: KIT }, { owner: 'b', name: 'B', cls: 'zorro', routes: ['base'], kit: ['z_orbe', 'hackeo', 'x', 'y'] }]);
    expect(run.heroes[0]!.kit).toEqual(KIT);
    expect(run.heroes[1]!.kit).toBeUndefined();
    expect(ids(heroSpec(run.heroes[0]!).spells)).toEqual(KIT);
    expect(ids(heroSpec(run.heroes[1]!).spells)).toEqual(CLASSES.zorro.base);
    expect(run.version).toBe(9);
    expect(cleanKit('esferas', KIT)).toEqual(KIT);
    expect(cleanKit('esferas', 'nope')).toBeUndefined();
  });
  it('compatibilidad: héroes de partidas guardadas sin configuración siguen con su kit de ruta', () => {
    const run = newRun('H3', 3, [{ owner: 'a', name: 'A', cls: 'arquero', routes: ['base'] }]);
    const old = JSON.parse(JSON.stringify(run));
    delete old.heroes[0].kit;
    expect(ids(heroSpec(old.heroes[0]).spells)).toEqual(CLASSES.arquero.base);
  });
  it('las habilidades aprendidas en la partida se suman a las 4', () => {
    const run = newRun('H3', 3, [{ owner: 'a', name: 'A', cls: 'esferas', routes: ['base'], kit: KIT }]);
    run.heroes[0]!.boons.push('t_orbita');
    expect(ids(heroSpec(run.heroes[0]!).spells)).toEqual([...KIT, 't_orbita']);
  });
  it('las temporales aparecen con la habilidad que las da aunque no sea la del kit clásico', () => {
    const u = makeHero({ cls: 'acechador', name: 'a', owner: 'a', routes: ['base'], pos: { x: 2, y: 2 }, kit: ['s_shuriken', 's_tajo', 's_velo', 's_paso'] });
    const s = createCombat({ seed: 1, w: 10, h: 6, obstacles: [], units: [u, makeEnemy('esqueleto', { x: 8, y: 4 })] }).state;
    for (let i = 0; i < 10 && current(s)!.owner !== 'a'; i++) endTurn(s, current(s)!.id);
    const me = current(s)!;
    expect(cast(s, me.id, 's_velo', me.pos).ok).toBe(true);
    expect(me.spells.some((sp) => sp.id === 's_cambio')).toBe(true);
  });
});

describe('H3 · configuración guardada (gratis)', () => {
  it('por defecto, las 4 iniciales; cambiar una ranura no cuesta ecos y respeta lo desbloqueado', () => {
    const m = reset(500);
    expect(kitFor(m, 'esferas')).toEqual(SPELL_CATALOG.esferas!.starters);
    expect(setKitSlot(m, 'esferas', 1, 't_vacio')).toMatch(/desbloqueado/);
    buyItem(m, spellItemId('t_vacio'));
    const ecos = m.ecos;
    expect(setKitSlot(m, 'esferas', 1, 't_vacio')).toBeNull();
    expect(kitFor(m, 'esferas')).toEqual(['t_pulso', 't_vacio', 't_descarga', 't_transfusion']);
    expect(m.ecos).toBe(ecos);
    // poner una ya equipada en otra ranura las intercambia
    expect(setKitSlot(m, 'esferas', 0, 't_descarga')).toBeNull();
    expect(kitFor(m, 'esferas')).toEqual(['t_descarga', 't_vacio', 't_pulso', 't_transfusion']);
    resetKit(m, 'esferas');
    expect(kitFor(m, 'esferas')).toEqual(SPELL_CATALOG.esferas!.starters);
  });
  it('una configuración guardada con algo que ya no tienes vuelve a las iniciales', () => {
    const m = reset(0);
    m.kits = { esferas: KIT };
    expect(kitFor(m, 'esferas')).toEqual(SPELL_CATALOG.esferas!.starters);
    expect(ownedSpells(m, 'esferas')).toEqual(SPELL_CATALOG.esferas!.starters);
  });
  it('al fusionar dispositivos se conservan las configuraciones (manda la de este dispositivo)', () => {
    const a = { ...reset(0), kits: { esferas: KIT } } as Meta;
    const merged = mergeMeta(a, { kits: { esferas: ['t_pulso', 't_dispersion', 't_descarga', 't_transfusion'], zorro: SPELL_CATALOG.zorro!.starters } });
    expect(merged.kits!.esferas).toEqual(KIT);
    expect(merged.kits!.zorro).toEqual(SPELL_CATALOG.zorro!.starters);
    expect(cleanKits({ esferas: ['a'], nada: ['a', 'b', 'c', 'd'], zorro: 5 })).toEqual({});
  });
});

describe('H3 · Salón de héroes', () => {
  it('el campeón guarda su configuración y la usa; los antiguos usan su kit de ruta', () => {
    const run = newRun('H3', 3, [{ owner: 'a', name: 'A', cls: 'esferas', routes: ['base'], kit: KIT }]);
    const c = championOf(run, run.heroes[0]!);
    expect(c.kit).toEqual(KIT);
    const back = cleanChampion(JSON.parse(JSON.stringify(c)))!;
    expect(back.kit).toEqual(KIT);
    expect(ids(championUnit(back, { x: 0, y: 0 }, 'enemy', null).spells)).toEqual(KIT);
    const old = cleanChampion({ ...c, kit: undefined })!;
    expect(old.kit).toBeUndefined();
    expect(ids(championUnit(old, { x: 0, y: 0 }, 'enemy', null).spells)).toEqual(CLASSES.esferas.base);
    expect(cleanChampion({ ...c, kit: ['z_orbe', 'b', 'c', 'd'] })!.kit).toBeUndefined();
  });
});

describe('H3 · alternativas sin tiempo de espera', () => {
  it('todas las alternativas del catálogo tienen enfriamiento 0; las iniciales no cambian', () => {
    const rework = new Set(['k_caja', 'k_sacrificio', 'k_condena', 'z_espejismo', 'z_drenaje', 'z_velo', 'z_resguardo', 't_singularidad', 's_velo', 's_ejecucion']);
    for (const c of PLAYABLE) for (const id of SPELL_CATALOG[c]!.alts) if (!rework.has(id)) expect(SPELLS[id]!.cd, id).toBe(0);
    expect(SPELLS.z_encanto!.cd).toBe(2);
    expect(SPELLS.ojo_halcon!.cd).toBe(3);
    expect(catalogSpells('barbaro')).toHaveLength(14);
  });
});
