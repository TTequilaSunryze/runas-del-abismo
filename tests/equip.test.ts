import { describe, expect, it } from 'vitest';
import { ZONA1_ITEMS } from '../src/content/zona1/items';
import { SLOTS, genItem, rarityWeights, rollRarity, type Rarity } from '../src/core/items/items';
import { cast, createCombat, current, endTurn } from '../src/core/combat/engine';
import { makeHero } from '../src/core/classes/factory';
import { makeEnemy } from '../src/content/enemies';
import { dropChance, heroSpec, newRun } from '../src/game/run';

const box = (n: number) => ({ rng: n >>> 0 });

describe('equipamiento con afijos', () => {
  it('Common 1 afijo, Uncommon 1+1, Rare 2+1 o 1+2, Legendary 2+2', () => {
    for (let n = 1; n <= 400; n++) {
      for (const [min, want] of [[0, 0], [1, 1], [2, 2], [3, 3]] as Array<[Rarity, Rarity]>) {
        const b = box(n * 17 + min);
        const it = genItem(b, ZONA1_ITEMS, 0, 'combat', min, SLOTS[n % SLOTS.length]);
        if (it.rarity !== want) continue;
        const p = it.affixes!.filter((a) => a.kind === 'prefix').length, s = it.affixes!.filter((a) => a.kind === 'suffix').length;
        if (want === 0) expect(p + s).toBe(1);
        if (want === 1) expect([p, s]).toEqual([1, 1]);
        if (want === 2) expect([[2, 1], [1, 2]]).toContainEqual([p, s]);
        if (want === 3) expect([p, s]).toEqual([2, 2]);
        // un mismo prefijo/sufijo no se repite; PA y PM nunca dos veces
        expect(new Set(it.affixes!.map((a) => a.id)).size).toBe(it.affixes!.length);
        expect(it.affixes!.filter((a) => a.stat === 'ap' || a.stat === 'mp').length).toBeLessThanOrEqual(2);
        expect(it.stats.ap ?? 0).toBeLessThanOrEqual(1); expect(it.stats.mp ?? 0).toBeLessThanOrEqual(1);
      }
    }
  });
  it('las estadísticas del objeto son la suma de sus afijos', () => {
    const it = genItem(box(9), ZONA1_ITEMS, 1, 'boss', 3, 'arma');
    const sum: Record<string, number> = {};
    for (const a of it.affixes!) sum[a.stat] = (sum[a.stat] ?? 0) + a.value;
    expect(it.stats).toEqual(sum);
  });
  it('la curva de rareza es estricta y sube con el acto, las élites y los jefes', () => {
    const count = (act: number, kind: 'combat' | 'elite' | 'boss') => {
      const c = [0, 0, 0, 0]; const b = box(77);
      for (let i = 0; i < 20000; i++) c[rollRarity(b, act, kind)]!++;
      return c.map((x) => x / 20000);
    };
    const [c, u, r, l] = count(0, 'combat') as [number, number, number, number];
    expect(c).toBeGreaterThan(u); expect(u).toBeGreaterThan(r); expect(r).toBeGreaterThan(l);
    expect(c).toBeGreaterThan(0.7); expect(l).toBeLessThan(0.01);
    expect(count(3, 'combat')[3]!).toBeGreaterThan(l);
    expect(count(0, 'elite')[2]!).toBeGreaterThan(r);
    expect(count(0, 'boss')[3]!).toBeGreaterThan(count(0, 'elite')[3]!);
    expect(rarityWeights(2, 'combat')[3]).toBeGreaterThan(rarityWeights(0, 'combat')[3]);
  });
  it('la probabilidad de soltar objeto sube con el acto y élites y jefes siempre sueltan', () => {
    expect(dropChance(3, 'combat')).toBeGreaterThan(dropChance(0, 'combat'));
    expect(dropChance(0, 'elite')).toBe(1); expect(dropChance(0, 'boss')).toBe(1);
  });
  it('PA y PM solo salen en Rare o mejor', () => {
    for (let n = 0; n < 600; n++) {
      const it = genItem(box(n + 1), ZONA1_ITEMS, 0, 'combat', 0);
      if (it.rarity < 2) expect(it.stats.ap ?? 0).toBe(0), expect(it.stats.mp ?? 0).toBe(0);
    }
  });
  it('el daño físico y el mágico solo suben su tipo de hechizo', () => {
    const run = (cls: 'barbaro' | 'zorro', bonus: object, spell: string): number => {
      const hero = makeHero({ cls, name: 'A', owner: 'p', routes: [], pos: { x: 2, y: 2 }, bonus: [bonus] });
      hero.crit = 0;
      const foe = makeEnemy('arquero', { x: 3, y: 2 });
      const s = createCombat({ seed: 3, w: 10, h: 7, obstacles: [], units: [hero, foe] }).state;
      s.units[1]!.armor = 0; s.units[1]!.maxHp = s.units[1]!.hp = 500;
      const me = s.units[0]!;
      while (current(s)!.id !== me.id) endTurn(s, current(s)!.id);
      me.ap = 6;
      const r = cast(s, me.id, spell, { x: 3, y: 2 });
      if (!r.ok) throw new Error(String(JSON.stringify(r)));
      return 500 - s.units[1]!.hp;
    };
    const phys = run('barbaro', {}, 'b_tajo'), physBoost = run('barbaro', { powerPhys: 50 }, 'b_tajo'), physMagic = run('barbaro', { powerMagic: 50 }, 'b_tajo');
    expect(physBoost).toBeGreaterThan(phys); expect(physMagic).toBe(phys);
    const mag = run('zorro', {}, 'z_orbe'), magBoost = run('zorro', { powerMagic: 50 }, 'z_orbe'), magPhys = run('zorro', { powerPhys: 50 }, 'z_orbe');
    expect(magBoost).toBeGreaterThan(mag); expect(magPhys).toBe(mag);
  });
  it('el equipo con afijos llega al héroe', () => {
    const r = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }]);
    const h = r.heroes[0]!;
    const before = heroSpec(h);
    h.equip.arma = { slot: 'arma', name: 'X', rarity: 1, stats: { powerPhys: 10, hp: 8 } };
    const after = heroSpec(h);
    expect(after.powerPhys).toBe(10);
    expect(after.maxHp).toBe(before.maxHp + 8);
  });
});

describe('rework de equipo v11', () => {
  const allowed: Record<string, string[]> = { arma: ['dmg', 'crit', 'ap'], casco: ['hp', 'armor', 'tackle'], capa: ['hp', 'dodge', 'crit', 'mp'], peto: ['hp', 'armor', 'tackle', 'dodge'], anillo: ['dmg', 'crit', 'ap', 'hp'], amuleto: ['dmg', 'ap', 'hp'], botas: ['mp', 'dodge', 'hp', 'tackle'], guantes: ['crit', 'dmg', 'tackle', 'ap'] };
  it('cada ranura solo da sus estadísticas y el daño es del tipo de la clase', () => {
    for (let n = 1; n <= 500; n++) for (const school of ['phys', 'magic'] as const) {
      const it = genItem(box(n * 13), ZONA1_ITEMS, 1, 'elite', (n % 4) as Rarity, SLOTS[n % SLOTS.length], school);
      for (const k of Object.keys(it.stats)) {
        const kk = k === 'powerPhys' || k === 'powerMagic' ? 'dmg' : k;
        expect(allowed[it.slot], `${it.slot} ${k}`).toContain(kk);
        expect(k).not.toBe(school === 'phys' ? 'powerMagic' : 'powerPhys');
        expect(k.startsWith('res') || k === 'power').toBe(false);
      }
    }
  });
  it('Rare garantiza la estadística principal y los legendarios traen su pasiva', () => {
    for (let n = 1; n <= 300; n++) {
      const it = genItem(box(n * 7), ZONA1_ITEMS, 0, 'combat', 2, SLOTS[n % SLOTS.length], 'magic');
      if (it.rarity !== 2) continue;
      expect((it.stats.powerMagic ?? 0) + (it.stats.hp ?? 0), it.slot).toBeGreaterThan(0);
    }
    const leg = genItem(box(5), ZONA1_ITEMS, 0, 'boss', 3, 'arma', 'phys');
    expect(leg.passive?.trait).toBeTruthy();
  });
  it('alijo de grupo: equipar, mochila y repartir al 50%; vender en tienda al 50%', async () => {
    const { metaAction } = await import('../src/game/run');
    const r = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }, { owner: 'b', name: 'B', cls: 'zorro', routes: [] }]);
    r.phase = 'map';
    const mk = (rarity: Rarity) => ({ slot: 'arma' as const, name: 'X', rarity, stats: { crit: 3 } });
    r.stash = [mk(0), mk(1), mk(3)];
    const [a, b] = r.heroes as [typeof r.heroes[0], typeof r.heroes[0]];
    const g0 = a.gold, gb = b.gold;
    expect(metaAction(r, 'a', { a: 'stash', idx: 2, op: 'split' })).toBeNull();
    expect(a.gold - g0).toBe(50); expect(b.gold - gb).toBe(50);
    expect(metaAction(r, 'b', { a: 'stash', idx: 0, op: 'equip' })).toBeNull();
    expect(b.equip.arma?.rarity).toBe(0);
    expect(metaAction(r, 'a', { a: 'stash', idx: 0, op: 'bag' })).toBeNull();
    expect(a.bag).toHaveLength(1); expect(r.stash).toHaveLength(0);
    r.phase = 'shop'; const g1 = a.gold;
    expect(metaAction(r, 'a', { a: 'sell', idx: 0 })).toBeNull();
    expect(a.gold - g1).toBe(30);
  });
});
