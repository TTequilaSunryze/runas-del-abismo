import { beforeEach, describe, expect, it } from 'vitest';
import { PLAYABLE } from '../src/core/classes/classes';
import { emptyCosmetics, mergeCosmetics, normalizeCosmetics } from '../src/game/cosmetics';
import { mergeMeta, meta, replaceMeta, saveMeta, type Meta } from '../src/game/meta';
import { heroSpec, newRun } from '../src/game/run';
import { registerSpecial, claimSpecialReward } from '../src/game/specials';
import { emptyContracts } from '../src/game/contractsData';
import { emptyArchive } from '../src/game/archiveData';
import {
  CATALOG, PRICE_RANGE, applyLoadout, buyItem, currentLook, equipItem, grantUnlocks, itemState, owns, priceFor, resetLook, saveLoadout, shopItem, unequip, unseenOwned, markSeen,
} from '../src/game/shop';
import { PALETTES, recolor } from '../src/render/palettes';
import { cleanLook } from '../src/render/looks';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
} as Storage;

const reset = (ecos = 1000): Meta => { const m = meta(); m.ecos = ecos; m.cosmetics = emptyCosmetics(); m.achievements = []; m.mastery = {}; m.contracts = emptyContracts(); m.archive = emptyArchive(); return m; };
const cheap = (): string => CATALOG().find((x) => x.price !== null && !x.req && x.cat === 'emblem')!.id;

describe('Fase F · catálogo', () => {
  it('ids estables y únicos, precios dentro de su rango, todas las clases con aspectos', () => {
    const c = CATALOG();
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
    for (const x of c) {
      if (x.price === null) expect(x.req, x.id).toBeTruthy();
      else { const [lo, hi] = PRICE_RANGE[x.rarity]; expect(x.price, x.id).toBeGreaterThanOrEqual(lo); expect(x.price, x.id).toBeLessThanOrEqual(hi); }
    }
    for (const cls of PLAYABLE) expect(c.filter((x) => x.cat === 'skin' && x.cls === cls).length).toBeGreaterThanOrEqual(2);
    for (const cat of ['skin', 'kit', 'fx', 'frame', 'emblem', 'title', 'deco', 'theme', 'card', 'bg']) expect(c.some((x) => x.cat === cat), cat).toBe(true);
    // los kits incluyen elementos que existen y cuestan menos que comprarlos por separado
    for (const k of c.filter((x) => x.cat === 'kit')) { const sum = k.includes!.reduce((n, i) => n + shopItem(i)!.price!, 0); expect(k.price!).toBeLessThan(sum); }
  });
});

describe('Fase F · compras', () => {
  beforeEach(() => reset());
  it('compra válida: descuenta una vez, registra propiedad y el gasto', () => {
    const id = cheap(), p = shopItem(id)!.price!;
    expect(buyItem(meta(), id)).toEqual({ ok: true, paid: p });
    expect(meta().ecos).toBe(1000 - p);
    expect(owns(meta(), id)).toBe(true);
    expect(meta().cosmetics!.spent![id]).toBe(p);
  });
  it('compra repetida o ya comprado: error y sin cobrar', () => {
    const id = cheap();
    buyItem(meta(), id);
    const e = meta().ecos;
    expect(buyItem(meta(), id)).toEqual({ ok: false, error: 'Ya lo tienes.' });
    expect(buyItem(meta(), id).ok).toBe(false);
    expect(meta().ecos).toBe(e);
  });
  it('saldo insuficiente, inexistente, exclusivo y bloqueado por requisitos: nada cambia', () => {
    const before = JSON.stringify(meta());
    meta().ecos = 10;
    expect(buyItem(meta(), cheap())).toMatchObject({ ok: false, error: expect.stringContaining('Te faltan') });
    expect(buyItem(meta(), 'no_existe')).toEqual({ ok: false, error: 'Ese elemento no existe.' });
    meta().ecos = 5000;
    expect(buyItem(meta(), 'em_trofeo')).toMatchObject({ ok: false });
    expect(buyItem(meta(), 'theme_abisal')).toMatchObject({ ok: false, error: expect.stringContaining('Requisito') });
    expect(meta().ecos).toBe(5000);
    expect(meta().cosmetics!.owned).toEqual([]);
    void before;
  });
  it('con el requisito cumplido el elemento bloqueado se puede comprar', () => {
    meta().ecos = 5000;
    meta().archive!.chronicles.stories.zona_4 = { state: 'discovered', progress: 1 };
    expect(itemState(meta(), shopItem('theme_abisal')!)).toBe('available');
    expect(buyItem(meta(), 'theme_abisal').ok).toBe(true);
  });
  it('kit: entrega todo, descuenta lo que ya tienes y no se cobra dos veces', () => {
    meta().ecos = 5000;
    const kit = shopItem(`kit_${PLAYABLE[0]}`)!, skin = kit.includes![0]!;
    buyItem(meta(), skin);
    const p = priceFor(meta(), kit);
    expect(p).toBeLessThan(kit.price!);
    const e = meta().ecos;
    expect(buyItem(meta(), kit.id)).toEqual({ ok: true, paid: p });
    expect(meta().ecos).toBe(e - p);
    for (const i of kit.includes!) expect(owns(meta(), i)).toBe(true);
    expect(buyItem(meta(), kit.id).ok).toBe(false);
    expect(buyItem(meta(), kit.includes![1]!).ok).toBe(false);
  });
});

describe('Fase F · desbloqueos exclusivos', () => {
  beforeEach(() => reset());
  it('logros, maestría, crónicas e hitos entregan sus exclusivos una sola vez', () => {
    expect(grantUnlocks(meta())).toEqual([]);
    meta().achievements = ['victoria', 'jefe1', 'abismo'];
    meta().mastery = { [PLAYABLE[0]!]: 600 };
    meta().archive!.chronicles.milestones.bestiary_50 = { state: 'completed', progress: 50 };
    const got = grantUnlocks(meta()).map((x) => x.id);
    expect(got).toEqual(expect.arrayContaining(['em_trofeo', 'fx_prior', 'skin_abisal', 'title_domador', `skin_${PLAYABLE[0]}_oro`, 'card_bestia']));
    expect(grantUnlocks(meta())).toEqual([]);
    expect(meta().ecos).toBe(1000);
  });
  it('contratos especiales: su título se entrega al reclamarlo y aparece como propio en la tienda', () => {
    registerSpecial(meta(), { t: 'won', cls: 'arquero', pact: 'sangre' });
    expect(owns(meta(), 'title_leyenda_arquero')).toBe(false);
    claimSpecialReward(meta(), 'class_arquero');
    expect(owns(meta(), 'title_leyenda_arquero')).toBe(true);
    expect(buyItem(meta(), 'title_leyenda_arquero').ok).toBe(false);
  });
  it('lo nuevo se marca hasta que se ve', () => {
    meta().achievements = ['victoria'];
    grantUnlocks(meta());
    expect(unseenOwned(meta()).map((x) => x.id)).toContain('em_trofeo');
    markSeen(meta(), ['em_trofeo']);
    expect(unseenOwned(meta()).map((x) => x.id)).not.toContain('em_trofeo');
  });
});

describe('Fase F · equipamiento, clases y kits', () => {
  beforeEach(() => reset(5000));
  it('equipar y quitar; solo lo propio; las variantes solo en su clase', () => {
    const [a, b] = PLAYABLE as [typeof PLAYABLE[number], typeof PLAYABLE[number]];
    const skin = CATALOG().find((x) => x.cat === 'skin' && x.cls === a && x.price !== null)!.id;
    expect(equipItem(meta(), skin, a)).toBe('No lo tienes.');
    buyItem(meta(), skin);
    expect(equipItem(meta(), skin, b)).toContain('Solo para');
    expect(equipItem(meta(), skin, a)).toBeNull();
    expect(meta().cosmetics!.skins![a]).toBe(skin);
    expect(currentLook(meta(), a).skin).toBe(shopItem(skin)!.ref);
    expect(currentLook(meta(), b).skin).toBeUndefined();
    unequip(meta(), 'skin', a);
    expect(meta().cosmetics!.skins![a]).toBeNull();
    buyItem(meta(), 'fx_brasas'); equipItem(meta(), 'fx_brasas');
    expect(itemState(meta(), shopItem('fx_brasas')!)).toBe('equipped');
    unequip(meta(), 'aura');
    expect(itemState(meta(), shopItem('fx_brasas')!)).toBe('owned');
  });
  it('conjuntos: guardar varios, cambiar y volver al predeterminado', () => {
    const cls = PLAYABLE[1]!;
    const [s1, s2] = CATALOG().filter((x) => x.cat === 'skin' && x.cls === cls && x.price !== null).map((x) => x.id) as [string, string];
    buyItem(meta(), s1); buyItem(meta(), s2); buyItem(meta(), 'fx_brasas'); buyItem(meta(), 'em_vela');
    equipItem(meta(), s1, cls); equipItem(meta(), 'fx_brasas');
    expect(saveLoadout(meta(), cls, 'Fuego')).toBeNull();
    equipItem(meta(), s2, cls); equipItem(meta(), 'em_vela'); unequip(meta(), 'aura');
    saveLoadout(meta(), cls, 'Vela');
    saveLoadout(meta(), cls, 'Otro');
    expect(saveLoadout(meta(), cls, 'Sobra')).toContain('Como mucho');
    applyLoadout(meta(), cls, 0);
    expect(currentLook(meta(), cls)).toMatchObject({ skin: shopItem(s1)!.ref, aura: 'brasas' });
    resetLook(meta(), cls);
    expect(currentLook(meta(), cls)).toEqual({ cls });
    expect(owns(meta(), s1)).toBe(true);
  });
  it('ningún cosmético cambia al héroe: misma ficha de combate con todo equipado', () => {
    const run = newRun('SHOP', 3, [{ owner: 'a', name: 'A', cls: 'arquero', routes: [] }]);
    const before = JSON.stringify(heroSpec(run.heroes[0]!));
    meta().ecos = 100000;
    for (const x of CATALOG()) if (x.price !== null) buyItem(meta(), x.id);
    for (const x of CATALOG()) if (owns(meta(), x.id) && x.cat !== 'kit') equipItem(meta(), x.id, 'arquero');
    expect(JSON.stringify(heroSpec(run.heroes[0]!))).toBe(before);
    expect(JSON.stringify(heroSpec(newRun('SHOP', 3, [{ owner: 'a', name: 'A', cls: 'arquero', routes: [] }]).heroes[0]!))).toBe(before);
    // los datos de apariencia no tienen ningún campo de estadísticas
    expect(Object.keys(currentLook(meta(), 'arquero')).sort()).toEqual(['aura', 'cls', 'emblem', 'skin']);
  });
  it('apariencia de otros jugadores: solo ids válidos', () => {
    expect(cleanLook({ cls: 'zorro', skin: 'escarcha', aura: 'runas', emblem: '🐉', power: 99 })).toEqual({ cls: 'zorro', skin: 'escarcha', aura: 'runas', emblem: '🐉' });
    expect(cleanLook({ skin: '<x>', aura: 'nada', emblem: '💣' })).toEqual({ cls: undefined });
  });
});

describe('Fase F · persistencia y fusión', () => {
  beforeEach(() => reset(1000));
  it('Meta antigua sin cosmetics (ni campos de la Fase F) se completa', () => {
    const c = normalizeCosmetics({ v: 1, titles: ['cronista'], frames: [], title: 'cronista', frame: null });
    expect(c).toMatchObject({ titles: ['cronista'], owned: [], eq: {}, skins: {}, loadouts: {}, spent: {} });
    expect(normalizeCosmetics(undefined)).toEqual(emptyCosmetics());
    // lo equipado que no se tiene se descarta
    expect(normalizeCosmetics({ owned: ['em_vela'], eq: { emblem: 'em_dragon', aura: 'x' }, skins: { zorro: 'skin_zorro_x' } })).toMatchObject({ eq: {}, skins: {} });
  });
  it('guardar y cargar conserva compras y equipamiento', () => {
    buyItem(meta(), 'em_vela'); equipItem(meta(), 'em_vela');
    saveMeta();
    replaceMeta(JSON.parse(store.rda_meta!));
    expect(owns(meta(), 'em_vela')).toBe(true);
    expect(meta().cosmetics!.eq!.emblem).toBe('em_vela');
    expect(buyItem(meta(), 'em_vela').ok).toBe(false);
  });
  it('fusión de dos dispositivos: sin duplicar objetos ni devolver ni regalar ecos', () => {
    const base = JSON.parse(JSON.stringify(meta())) as Meta; // 1000 ecos, nada comprado
    // dispositivo A compra la vela (90); B no ha comprado nada y ganó 50 más en una partida
    buyItem(meta(), 'em_vela');
    const a = JSON.parse(JSON.stringify(meta())) as Meta;
    const b = { ...base, ecos: 1050 } as Meta;
    const m = mergeMeta(a, b);
    expect(m.cosmetics!.owned).toEqual(['em_vela']);
    expect(m.ecos).toBe(1050 - 90);
    // los dos compraron lo mismo por separado: un solo objeto y un solo cobro
    const both = mergeMeta(a, a);
    expect(both.cosmetics!.owned).toEqual(['em_vela']);
    expect(both.ecos).toBe(910);
    // B compró otra cosa: se conservan ambas compras y ambos gastos
    replaceMeta(b); buyItem(meta(), 'em_calavera');
    const b2 = JSON.parse(JSON.stringify(meta())) as Meta;
    const m2 = mergeMeta(a, b2);
    expect(m2.cosmetics!.owned!.sort()).toEqual(['em_calavera', 'em_vela']);
    expect(m2.ecos).toBe(1050 - 90 - 60);
    expect(mergeCosmetics(a.cosmetics, b2.cosmetics).spent).toEqual({ em_vela: 90, em_calavera: 60 });
  });
});

describe('Fase F · variantes de color', () => {
  it('cambian ropa y equipo pero no la piel; cada variante existe', () => {
    const p = PALETTES.find((x) => x.id === 'escarcha')!;
    // rojo de la ropa → azul (tono 200); la piel y los grises no cambian
    expect(recolor('#d8485f', p)).toMatch(/^#[0-9a-f]{6}$/);
    expect(recolor('#d8485f', p)).not.toBe('#d8485f');
    const b = parseInt(recolor('#d8485f', p).slice(5, 7), 16), r = parseInt(recolor('#d8485f', p).slice(1, 3), 16);
    expect(b).toBeGreaterThan(r);
    expect(recolor('#f0c8a0', p)).toBe('#f0c8a0');
    expect(recolor('#808080', p)).toBe('#808080');
    for (const x of CATALOG().filter((i) => i.cat === 'skin')) expect(PALETTES.some((q) => q.id === x.ref), x.id).toBe(true);
  });
});
