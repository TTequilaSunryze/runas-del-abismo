import { afterEach, describe, expect, it } from 'vitest';
import { applyBalance, cleanBalance, emptyBalance, spellPaths } from '../src/game/balance';
import { CLASSES } from '../src/core/classes/classes';
import { SPELLS } from '../src/core/classes/spells';
import { ENEMIES, makeEnemy } from '../src/content/enemies';
import { heroSpec, newRun } from '../src/game/run';

afterEach(() => applyBalance(null));

describe('equilibrio del creador', () => {
  it('cambia clases, hechizos y enemigos y vuelve a los originales', () => {
    const hp0 = CLASSES.zorro.hp, ap0 = SPELLS.z_orbe!.ap, r0 = SPELLS.z_orbe!.range[1], ehp = ENEMIES.esqueleto!.hp;
    const b = cleanBalance({ ...emptyBalance(), classes: { zorro: { hp: hp0 + 20, mp: 5 } }, spells: { z_orbe: { ap: 2, 'range.1': 7, 'dmg.0': 9, area: 1, los: false, text: 'Nuevo' } }, enemies: { esqueleto: { hp: 99, tackle: 1, 'resist.fire': 50 } }, groups: { boss: { hp: 50, power: 2 } } });
    applyBalance(b);
    const run = newRun('B', 1, [{ owner: 'me', name: 'Yo', cls: 'zorro', routes: ['base'] }]);
    const u = heroSpec(run.heroes[0]!);
    expect(u.maxHp).toBeGreaterThanOrEqual(hp0 + 20);
    expect(u.maxMp).toBe(5);
    expect(SPELLS.z_orbe!.ap).toBe(2);
    expect(SPELLS.z_orbe!.range).toEqual([1, 7]);
    expect(SPELLS.z_orbe!.dmg![0]).toBe(9);
    expect(SPELLS.z_orbe!.area).toBe(1);
    expect(SPELLS.z_orbe!.los).toBe(false);
    expect(SPELLS.z_orbe!.text).toBe('Nuevo');
    const e = makeEnemy('esqueleto', { x: 0, y: 0 });
    expect(ENEMIES.esqueleto!.hp).toBe(99);
    expect(e.tackle).toBe(1);
    expect(e.resist.fire).toBe(50);
    expect(ENEMIES.prior!.hp).toBe(180);
    expect(makeEnemy('prior', { x: 0, y: 0 }).power).toBe(2);
    applyBalance(null);
    expect(CLASSES.zorro.hp).toBe(hp0);
    expect(SPELLS.z_orbe!.ap).toBe(ap0);
    expect(SPELLS.z_orbe!.range[1]).toBe(r0);
    expect(SPELLS.z_orbe!.area).toBeUndefined();
    expect(ENEMIES.esqueleto!.hp).toBe(ehp);
    expect(ENEMIES.prior!.power).toBeUndefined();
  });

  it('descarta ids y campos que no existen y encuentra los números anidados', () => {
    const b = cleanBalance({ classes: { nadie: { hp: 5 }, zorro: { vuela: 3 } }, spells: { z_impulso: { 'followUp.dmg.0': 12, 'inventado': 3 } }, enemies: { x: { hp: 1 } } });
    expect(b.classes).toEqual({});
    expect(b.spells).toEqual({ z_impulso: { 'followUp.dmg.0': 12 } });
    expect(spellPaths('z_impulso')).toContain('followUp.radius');
  });
});

describe('velocidad de animaciones', () => {
  it('se limpia, se aplica y se quita', async () => {
    const { ANIM_SPEED, animMul } = await import('../src/content/animSpeed');
    const b = cleanBalance({ anim: { reina: { idle: 2, vuela: 3 }, '*': { walk: 1.5 }, nadie: { idle: 2 }, zorro: { attack: 99 } } });
    expect(b.anim).toEqual({ reina: { idle: 2 }, '*': { walk: 1.5 }, zorro: { attack: 6 } });
    applyBalance(b);
    expect(animMul('reina', 'idle')).toBe(2);
    expect(animMul('lobo', 'walk')).toBe(1.5);
    expect(animMul('zorro', 'walk', false)).toBe(1);
    applyBalance(null);
    expect(Object.keys(ANIM_SPEED)).toHaveLength(0);
  });
});
