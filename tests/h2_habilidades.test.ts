// Fase H2: habilidades alternativas en la tienda, regalos por progreso y propiedad permanente.
import { describe, expect, it } from 'vitest';
import { SPELL_CATALOG } from '../src/content/spellCatalog';
import { PLAYABLE } from '../src/core/classes/classes';
import { emptyArchive } from '../src/game/archiveData';
import { emptyContracts } from '../src/game/contractsData';
import { emptyCosmetics } from '../src/game/cosmetics';
import { MASTERY_XP, mergeMeta, mergedEcos, meta, type Meta } from '../src/game/meta';
import { heroSpec, newRun } from '../src/game/run';
import { CATALOG, GRIMOIRE_GIFT, SPELL_PRICE, buyItem, equipItem, grantUnlocks, grimoireGift, itemState, owns, ownedSpells, shopItem, spellItemId } from '../src/game/shop';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } } as Storage;
const reset = (ecos = 1000): Meta => { const m = meta(); m.ecos = ecos; m.cosmetics = emptyCosmetics(); m.achievements = []; m.mastery = {}; m.contracts = emptyContracts(); m.archive = emptyArchive(); m.unlocked = []; return m; };

describe('H2 · habilidades en la tienda', () => {
  it('todas las alternativas del catálogo se venden a su precio; las iniciales no', () => {
    const items = CATALOG().filter((x) => x.cat === 'spell');
    const alts = PLAYABLE.flatMap((c) => SPELL_CATALOG[c]!.alts.map((id) => ({ c, id })));
    expect(items).toHaveLength(alts.length);
    for (const { c, id } of alts) { const x = shopItem(spellItemId(id))!; expect(x.price).toBe(SPELL_PRICE); expect(x.cls).toBe(c); expect(x.ref).toBe(id); }
    for (const c of PLAYABLE) for (const id of SPELL_CATALOG[c]!.starters) expect(shopItem(spellItemId(id))).toBeUndefined();
  });
  it('comprar una vez: descuenta, queda para siempre y no se puede volver a cobrar', () => {
    const m = reset(400), id = spellItemId('z_drenaje');
    expect(itemState(m, shopItem(id)!)).toBe('available');
    expect(buyItem(m, id)).toEqual({ ok: true, paid: SPELL_PRICE });
    expect(m.ecos).toBe(400 - SPELL_PRICE);
    expect(owns(m, id)).toBe(true);
    expect(buyItem(m, id).ok).toBe(false);
    expect(m.ecos).toBe(400 - SPELL_PRICE);
    expect(ownedSpells(m, 'zorro')).toEqual([...SPELL_CATALOG.zorro!.starters, 'z_drenaje']);
    expect(equipItem(m, id)).toMatch(/expedición/);
    expect(buyItem(reset(100), id)).toEqual({ ok: false, error: `Te faltan ${SPELL_PRICE - 100} ecos.` });
  });
  it('fusionar dispositivos no duplica ni devuelve la compra', () => {
    const a = reset(400); buyItem(a, spellItemId('t_vacio'));
    const b = { ...reset(400), cosmetics: emptyCosmetics() };
    const aa = { ...a, ecos: 250, cosmetics: { ...emptyCosmetics(), owned: [spellItemId('t_vacio')], spent: { [spellItemId('t_vacio')]: SPELL_PRICE } } } as Meta;
    expect(mergedEcos(aa, { ecos: 400, cosmetics: emptyCosmetics() })).toBe(250);
    expect(mergeMeta(aa, b).cosmetics!.owned).toContain(spellItemId('t_vacio'));
  });
  it('regalo único del Grimorio: lo descubierto o usado se desbloquea gratis una sola vez', () => {
    const m = reset(0);
    m.archive!.grimoire = { z_drenaje: { lv: 1, seen: 1, n: 0 }, t_vacio: { lv: 2, seen: 1, n: 3 }, z_colas: { lv: 0, seen: 0, n: 0 } } as never;
    const got = grantUnlocks(m).filter((x) => x.cat === 'spell').map((x) => x.ref).sort();
    expect(got).toEqual(['t_vacio', 'z_drenaje']);
    expect(m.ecos).toBe(0);
    expect(m.unlocked).toContain(GRIMOIRE_GIFT);
    // lo que se descubra después ya se compra
    m.archive!.grimoire.z_colas = { lv: 1, seen: 1, n: 0 } as never;
    expect(grimoireGift(m)).toHaveLength(0);
    expect(owns(m, spellItemId('z_colas'))).toBe(false);
  });
  it('los kits del Arquero por maestría: sus habilidades se regalan con esa maestría', () => {
    const m = reset(0); m.unlocked = [GRIMOIRE_GIFT];
    expect(grantUnlocks(m).filter((x) => x.cat === 'spell')).toHaveLength(0);
    m.mastery.arquero = MASTERY_XP[0]!; // maestría 1: kit Francotirador
    expect(grantUnlocks(m).map((x) => x.ref)).toContain('perforante');
    m.mastery.arquero = MASTERY_XP[3]!; // maestría 4: todos los kits
    grantUnlocks(m);
    for (const id of ['perforante', 'salto_atras', 'flecha_hielo', 'red', 'orden']) expect(owns(m, spellItemId(id)), id).toBe(true);
    // las del kit también se pueden comprar antes de tener la maestría
    expect(itemState(reset(500), shopItem(spellItemId('orden'))!)).toBe('available');
  });
  it('no cambia la partida: un héroe se construye igual con o sin desbloqueos', () => {
    const run = newRun('H2', 1, [{ owner: 'a', name: 'A', cls: 'zorro', routes: ['base'] }]);
    const before = heroSpec(run.heroes[0]!).spells.map((s) => s.id);
    const m = reset(5000); for (const id of SPELL_CATALOG.zorro!.alts) buyItem(m, spellItemId(id));
    expect(heroSpec(run.heroes[0]!).spells.map((s) => s.id)).toEqual(before);
  });
});
