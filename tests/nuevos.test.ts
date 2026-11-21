import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { makeHero } from '../src/core/classes/factory';
import { CLASSES } from '../src/core/classes/classes';
import { BLESSINGS } from '../src/core/boonmods';
import { SPELLS } from '../src/core/classes/spells';
import { MAG_MAX, cast, createCombat, current, endTurn, move, type UnitSpec } from '../src/core/combat/engine';
import { marksOf } from '../src/core/combat/marks';
import { PATRONS } from '../src/content/boons';

const hero = (cls: 'arquitecto' | 'pistolero', pos = { x: 1, y: 3 }, traits: string[] = []): UnitSpec => ({ ...makeHero({ cls, name: cls, owner: 'p0', routes: [], pos, level: 1 }), traits });
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp, armor: 0, shield: 0, traits: [] });
const board = (units: UnitSpec[]) => createCombat({ seed: 5, w: 14, h: 7, obstacles: [], units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 40 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('Arquitecto Rúnico y Pistolero Arcano', () => {
  it('estadísticas y 10 hechizos de jefe + 10 bendiciones por clase', () => {
    expect([CLASSES.arquitecto.hp, CLASSES.arquitecto.armor, CLASSES.arquitecto.crit, CLASSES.arquitecto.ap, CLASSES.arquitecto.mp, CLASSES.arquitecto.initiative, CLASSES.arquitecto.tackle, CLASSES.arquitecto.dodge]).toEqual([60, 1, 5, 6, 3, 9, 4, 3]);
    expect([CLASSES.pistolero.hp, CLASSES.pistolero.armor, CLASSES.pistolero.crit, CLASSES.pistolero.ap, CLASSES.pistolero.mp, CLASSES.pistolero.initiative, CLASSES.pistolero.tackle, CLASSES.pistolero.dodge]).toEqual([60, 0, 12, 6, 4, 17, 2, 7]);
    for (const [cls, pid] of [['arquitecto', 'r_runas'], ['pistolero', 'g_polvora']] as const) {
      const list = PATRONS[pid]!.spells;
      expect(list.filter((id) => SPELLS[id]).length, cls).toBe(10);
      expect(list.filter((id) => BLESSINGS[id]?.cls === cls).length, cls).toBe(10);
    }
  });

  it('Glifo fulminante: explota al pisarlo, quita PM y se gasta', () => {
    const s = board([hero('arquitecto'), foe({ x: 5, y: 3 })]);
    const [a, e] = s.units;
    turnOf(s, a!.id);
    expect(cast(s, a!.id, 'r_glifo', { x: 4, y: 3 }).ok).toBe(true);
    expect(marksOf(s, 'glyph', a!.id)).toHaveLength(1);
    turnOf(s, e!.id);
    e!.mp = 3;
    const hp = e!.hp;
    move(s, e!.id, { x: 3, y: 3 });
    expect(e!.hp).toBeLessThan(hp);
    expect(e!.statuses.slow).toBeTruthy();
    expect(e!.pos).toEqual({ x: 4, y: 3 });
    expect(marksOf(s, 'glyph', a!.id)).toHaveLength(0);
  });

  it('Geometría Bélica: junto a un glifo propio, escudo y +2 al siguiente daño', () => {
    const s = board([hero('arquitecto'), foe({ x: 9, y: 3 })]);
    const [a] = s.units;
    turnOf(s, a!.id);
    cast(s, a!.id, 'r_glifo', { x: 2, y: 3 });
    endTurn(s, a!.id);
    turnOf(s, a!.id);
    expect(a!.shield).toBeGreaterThanOrEqual(4);
    expect(a!.glyphBonus).toBe(2);
  });

  it('Barrera cinética da escudo y Sobrecarga defensiva lo convierte en daño', () => {
    const s = board([hero('arquitecto'), foe({ x: 2, y: 3 })]);
    const [a, e] = s.units;
    a!.spells.push({ id: 'r_sobrecarga', cd: 0 });
    turnOf(s, a!.id);
    expect(cast(s, a!.id, 'r_barrera', a!.pos).ok).toBe(true);
    expect(a!.shield).toBe(12);
    const hp = e!.hp;
    expect(cast(s, a!.id, 'r_sobrecarga', a!.pos).ok).toBe(true);
    expect(a!.shield).toBe(0);
    expect(hp - e!.hp).toBe(48);
  });

  it('Cercado de púas bloquea casillas y desaparece al acabar', () => {
    const s = board([hero('arquitecto'), foe({ x: 9, y: 3 })]);
    const [a] = s.units;
    a!.spells.push({ id: 'r_cercado', cd: 0 });
    turnOf(s, a!.id);
    expect(cast(s, a!.id, 'r_cercado', { x: 3, y: 3 }).ok).toBe(true);
    expect(s.obstacles).toEqual(expect.arrayContaining(['3,2', '3,3', '3,4']));
    for (let i = 0; i < 3; i++) { endTurn(s, current(s)!.id); turnOf(s, a!.id); }
    expect(s.obstacles).not.toContain('3,3');
  });

  it('Cargador arcano: 4 disparos lo llenan y el siguiente es crítico seguro y lo vacía', () => {
    const s = board([hero('pistolero'), foe({ x: 5, y: 3 })]);
    const [p, e] = s.units;
    turnOf(s, p!.id);
    for (let i = 0; i < MAG_MAX; i++) { p!.ap = 6; p!.spells.forEach((x) => { x.cd = 0; x.uses = 0; }); cast(s, p!.id, 'g_disparo', e!.pos); }
    expect(p!.magazine).toBe(MAG_MAX);
    p!.ap = 6;
    const r = cast(s, p!.id, 'g_disparo', e!.pos);
    expect(r.ok).toBe(true);
    expect(r.ok && r.events.some((x) => x.t === 'damage' && x.crit)).toBe(true);
    expect(p!.magazine).toBe(0);
  });

  it('Recarga acrobática llena el cargador y da 1 PM', () => {
    const s = board([hero('pistolero'), foe({ x: 9, y: 3 })]);
    const [p] = s.units;
    turnOf(s, p!.id);
    const mp = p!.mp;
    expect(cast(s, p!.id, 'g_recarga', p!.pos).ok).toBe(true);
    expect(p!.magazine).toBe(MAG_MAX);
    expect(p!.mp).toBe(mp + 1);
  });

  it('Tiro rebotado alcanza a un segundo enemigo cercano', () => {
    const s = board([hero('pistolero'), foe({ x: 4, y: 3 }), foe({ x: 5, y: 4 })]);
    const [p, a, b] = s.units;
    turnOf(s, p!.id);
    const ha = a!.hp, hb = b!.hp;
    expect(cast(s, p!.id, 'g_rebote', a!.pos).ok).toBe(true);
    expect(a!.hp).toBeLessThan(ha);
    expect(b!.hp).toBeLessThan(hb);
  });

  it('Cortina de humo: los ataques a distancia fallan dentro de la nube', () => {
    const s = board([hero('pistolero'), { ...makeEnemy('arquero', { x: 5, y: 3 }), hp: 99, maxHp: 99 }]);
    const [p, e] = s.units;
    p!.spells.push({ id: 'g_humo', cd: 0 });
    turnOf(s, p!.id);
    expect(cast(s, p!.id, 'g_humo', p!.pos).ok).toBe(true);
    const sp = e!.spells[0]!.id;
    turnOf(s, e!.id);
    e!.ap = 9;
    const hp = p!.hp;
    cast(s, e!.id, sp, p!.pos);
    expect(p!.hp).toBe(hp);
  });

  it('Disparo a la rodilla inmoviliza: 0 PM en su turno', () => {
    const s = board([hero('pistolero'), foe({ x: 4, y: 3 })]);
    const [p, e] = s.units;
    p!.spells.push({ id: 'g_rodilla', cd: 0 });
    turnOf(s, p!.id);
    expect(cast(s, p!.id, 'g_rodilla', e!.pos).ok).toBe(true);
    turnOf(s, e!.id);
    expect(e!.mp).toBe(0);
  });

  it('Disparo de gancho: atrae al enemigo normal hasta ti', () => {
    const s = board([hero('pistolero'), foe({ x: 5, y: 3 })]);
    const [p, e] = s.units;
    p!.spells.push({ id: 'g_gancho', cd: 0 });
    turnOf(s, p!.id);
    expect(cast(s, p!.id, 'g_gancho', e!.pos).ok).toBe(true);
    expect(e!.pos).toEqual({ x: 2, y: 3 });
  });
});
