import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { cast, createCombat, current, spellOf } from '../src/core/combat/engine';
import { metaAction, newRun, heroSpec } from '../src/game/run';
import { ENEMIES } from '../src/content/enemies';
import { ZONES } from '../src/content/zones';
import { SPELLS } from '../src/core/classes/spells';
import { spriteErrors } from '../src/render/sprites';

const duel = (rune: string | undefined, enemy = 'arquero', bonus = {}) => {
  const hero = makeHero({ cls: 'mago', name: 'Leo', owner: 'p', routes: ['fuego'], pos: { x: 2, y: 2 }, bonus: [bonus] });
  hero.crit = 0;
  if (rune) hero.spells.find((s) => s.id === 'dardo')!.rune = rune;
  return createCombat({ seed: 9, w: 12, h: 7, obstacles: [], units: [hero, makeEnemy(enemy, { x: 5, y: 2 })] }).state;
};

describe('runas', () => {
  it('Veloz abarata el hechizo y Largo alcance lo alarga', () => {
    const s = duel('veloz');
    expect(spellOf(current(s)!, 'dardo')!.ap).toBe(2);
    expect(spellOf(current(duel('alcance'))!, 'dardo')!.range).toEqual([1, 7]);
  });
  it('Fuego añade quemadura y Brutal sube el daño y la espera', () => {
    const s = duel('fuego');
    const leo = current(s)!;
    expect(cast(s, leo.id, 'dardo', { x: 5, y: 2 }).ok).toBe(true);
    expect(s.units[1]!.statuses.burn).toBeDefined();
    const plain = duel(undefined), brutal = duel('brutal');
    cast(plain, current(plain)!.id, 'dardo', { x: 5, y: 2 });
    cast(brutal, current(brutal)!.id, 'dardo', { x: 5, y: 2 });
    expect(brutal.units[1]!.hp).toBeLessThan(plain.units[1]!.hp);
    expect(brutal.units[0]!.spells[0]!.cd).toBeGreaterThan(0);
  });
  it('una runa de daño no altera un hechizo sin daño', () => {
    const hero = makeHero({ cls: 'guerrero', name: 'A', owner: 'p', routes: ['baluarte'], pos: { x: 0, y: 0 } });
    hero.spells.find((s) => s.id === 'muro')!.rune = 'fuego';
    expect(spellOf({ ...hero, id: 1 }, 'muro')!.extraStatus).toBeUndefined();
  });
  it('se engarzan y se quitan desde la partida, y llegan al combate', () => {
    const run = newRun('TEST', 4, [{ owner: 'p0', name: 'A', cls: 'mago', routes: ['fuego'] }]);
    const h = run.heroes[0]!;
    h.runes = ['veloz'];
    expect(metaAction(run, 'p0', { a: 'socket', spell: 'dardo', idx: 0 })).toBeNull();
    expect(h.runes).toEqual([]);
    expect(heroSpec(h).spells.find((s) => s.id === 'dardo')!.rune).toBe('veloz');
    expect(metaAction(run, 'p0', { a: 'unsocket', spell: 'dardo' })).toBeNull();
    expect(h.runes).toEqual(['veloz']);
  });
});

describe('resistencias', () => {
  it('un enemigo resistente al fuego recibe menos daño de fuego, y uno débil recibe más', () => {
    const dmg = (enemy: string): number => {
      const s = duel(undefined, enemy);
      const leo = current(s)!, e = s.units[1]!;
      e.armor = 0; e.maxHp = e.hp = 100;
      cast(s, leo.id, 'ignicion', e.pos);
      return 100 - e.hp;
    };
    expect(dmg('acolito')).toBeLessThan(dmg('arquero'));
    expect(dmg('limo')).toBeGreaterThan(dmg('arquero'));
  });
  it('el equipo da resistencias y alarga los estados', () => {
    const hero = makeHero({ cls: 'mago', name: 'L', owner: 'p', routes: ['fuego'], pos: { x: 0, y: 0 }, bonus: [{ resFire: 20, status: 1 }] });
    expect(hero.resist.fire).toBe(20);
    const s = duel(undefined, 'arquero', { status: 1 });
    cast(s, current(s)!.id, 'ignicion', { x: 5, y: 2 });
    expect(s.units[1]!.statuses.burn!.turns).toBe(4);
  });
});

describe('zonas', () => {
  it('todos los enemigos y hechizos que nombran las zonas existen', () => {
    for (const z of ZONES)
      for (const id of [...z.pools.flat(), z.shooter, z.elite, z.boss, z.bossMinion, ...z.bossGuard]) {
        expect(ENEMIES[id], id).toBeDefined();
        for (const sp of [ENEMIES[id]!.spell, ...(ENEMIES[id]!.more ?? [])]) expect(SPELLS[sp], sp).toBeDefined();
      }
    expect(ZONES.every((z) => ENEMIES[z.boss]!.more?.length === 1)).toBe(true);
  });
});

describe('sprites', () => {
  it('todas las filas tienen el ancho correcto', () => {
    expect(spriteErrors()).toEqual([]);
  });
});
