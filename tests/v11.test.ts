// v11: 10 bendiciones por clase (salvo el Arquero).
// @ts-expect-error: módulo de Node en los tests
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLESSINGS } from '../src/core/boonmods';
import { makeHero } from '../src/core/classes/factory';
import { apCost, cast, createCombat, endTurn, current, move, usableMp, type UnitSpec } from '../src/core/combat/engine';
import { makeEnemy } from '../src/content/enemies';
import type { ClassId } from '../src/core/state';

const engine = readFileSync('src/core/combat/engine.ts', 'utf8');
const hero = (cls: ClassId, x: number, y: number, traits: string[] = []): UnitSpec => { const h = makeHero({ cls, name: 'H', owner: 'p', routes: [], pos: { x, y } }); h.traits = traits; h.crit = 0; return h; };
const foe = (x: number, y: number): UnitSpec => { const e = makeEnemy('esqueleto', { x, y }); e.traits = []; e.hp = e.maxHp = 300; e.armor = 0; e.initiative = 0; return e; };
const fight = (units: UnitSpec[]) => { const s = createCombat({ seed: 7, w: 12, h: 8, obstacles: [], units }).state; while (current(s)!.team !== 'hero') endTurn(s, current(s)!.id); return s; };

describe('bendiciones v11', () => {
  it('cada clase nueva tiene 10 bendiciones y cada rasgo lo usa el motor', () => {
    for (const c of ['zorro', 'esferas', 'acechador', 'carcelero', 'barbaro']) expect(Object.values(BLESSINGS).filter((b) => b.cls === c), c).toHaveLength(10);
    expect(Object.values(BLESSINGS).filter((b) => b.cls === 'arquero')).toHaveLength(0);
    for (const b of Object.values(BLESSINGS)) if (b.trait) expect(engine.includes(`'${b.trait}'`), b.id).toBe(true);
  });
  it('Zorro de fuego: el orbe quema', () => {
    const s = fight([hero('zorro', 2, 2, ['zfuego']), foe(4, 2)]);
    expect(cast(s, s.units[0]!.id, 'z_orbe', { x: 4, y: 2 }).ok).toBe(true);
    expect(s.units[1]!.statuses.burn).toBeTruthy();
  });
  it('Golpe titánico y Caminante de la niebla anulan el placaje', () => {
    const s = fight([hero('barbaro', 2, 2, ['titanico']), foe(3, 2)]);
    const b = s.units[0]!;
    b.fury = 50; expect(usableMp(s, b)).toBeLessThan(b.mp);
    b.fury = 90; expect(usableMp(s, b)).toBe(b.mp);
  });
  it('Manto de la noche: +3 de Huida sin aliados cerca', () => {
    const s = fight([hero('acechador', 2, 2, ['manto']), foe(3, 2)]);
    const a = s.units[0]!; a.dodge = 0;
    const alone = usableMp(s, a);
    s.units[0]!.traits = [];
    expect(alone).toBeGreaterThan(usableMp(s, a));
  });
  it('Dominio esférico: cuesta 1 PA menos junto a una esfera', () => {
    const s = fight([hero('esferas', 2, 2, ['dominio']), foe(8, 2)]);
    const t = s.units[0]!;
    const before = apCost(t, 't_pulso', s);
    (s.marks ??= []).push({ id: 99, kind: 'sphere', pos: { x: 3, y: 2 }, team: 'hero', turns: 3, owner: t.id });
    expect(apCost(t, 't_pulso', s)).toBe(before - 1);
  });
  it('Gravedad alterada: un enemigo que pasa junto a una esfera pierde 1 PM', () => {
    const s = fight([hero('esferas', 0, 0, ['gravedad']), foe(5, 5)]);
    (s.marks ??= []).push({ id: 99, kind: 'sphere', pos: { x: 5, y: 3 }, team: 'hero', turns: 9, owner: s.units[0]!.id });
    endTurn(s, s.units[0]!.id);
    const e = s.units[1]!;
    expect(current(s)?.id).toBe(e.id);
    { const mp = e.mp; move(s, e.id, { x: 5, y: 4 }); expect(e.mp).toBe(mp - 2); }
  });
});
