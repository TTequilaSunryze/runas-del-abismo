// v11: 10 bendiciones por clase (salvo el Arquero).
// @ts-expect-error: módulo de Node en los tests
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLESSINGS } from '../src/core/boonmods';
import { SPELLS } from '../src/core/classes/spells';
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
    // H5: el Arquero ya tiene sus 10 bendiciones propias
    expect(Object.values(BLESSINGS).filter((b) => b.cls === 'arquero')).toHaveLength(10);
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

describe('v12 daño plano', () => {
  it('sin dados: los hechizos hacen un daño fijo y el daño final es fijo + bonos − armadura', () => {
    for (const d of Object.values(SPELLS)) if (d.dmg) expect(d.dmg[0]).toBe(d.dmg[1]);
    const s = fight([hero('barbaro', 2, 2), foe(3, 2)]);
    const b = s.units[0]!, e = s.units[1]!;
    e.armor = 3; b.powerPhys = 4; b.crit = 0;
    const before = e.hp;
    expect(cast(s, b.id, 'b_tajo', { x: 3, y: 2 }).ok).toBe(true);
    // Tajo despiadado suma además la Furia (0 aquí)
    expect(before - e.hp).toBe(SPELLS.b_tajo!.dmg![0] + 4 - 3);
  });
});

describe('v13 iniciativa intercalada', () => {
  it('alterna aliado y enemigo, cada bando de mayor a menor, empezando por la mayor absoluta', async () => {
    const { interleave } = await import('../src/core/combat/engine');
    const u = (id: number, team: 'hero' | 'enemy', initiative: number) => ({ id, team, initiative });
    expect(interleave([u(1, 'hero', 10), u(2, 'hero', 8), u(3, 'hero', 5), u(4, 'enemy', 12), u(5, 'enemy', 3)])).toEqual([4, 1, 5, 2, 3]);
    expect(interleave([u(1, 'hero', 14), u(2, 'enemy', 9), u(3, 'enemy', 11), u(4, 'enemy', 2)])).toEqual([1, 3, 2, 4]);
  });
});

describe('v13 mapas por bioma y terreno', () => {
  it('cada zona usa sus biomas y todos los combates son transitables', async () => {
    const { newRun, buildFight } = await import('../src/game/run');
    const { BIOMES } = await import('../src/game/terrain');
    const { reachable } = await import('../src/core/combat/grid');
    let corridors = 0;
    for (let zone = 0; zone < 4; zone++) for (let seed = 1; seed <= 25; seed++) {
      const run = newRun('T', seed * 31 + zone, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }, { owner: 'b', name: 'B', cls: 'zorro', routes: [] }]);
      run.zone = Math.min(zone, 2); run.kind = 'combat'; run.zoneFight = 2;
      if (zone === 3) { run.mods = [...run.mods]; run.zone = 3; }
      const setup = buildFight(run);
      const st = createCombat(setup).state;
      if (st.biome?.includes('pasillo')) corridors++;
      if (st.biome && !st.biome.includes('pasillo')) expect(BIOMES.filter((b) => b.zone === Math.min(run.zone, 3)).map((b) => b.name), st.biome).toContain(st.biome);
      const walk = reachable(st, st.units[0]!.pos, 99, true).cost;
      for (const u of st.units) expect(walk.has(`${u.pos.x},${u.pos.y}`)).toBe(true);
    }
    expect(corridors).toBeGreaterThan(0);
  });
  it('abismo: un enemigo normal empujado cae y muere; un élite recibe 20 y vuelve', () => {
    for (const rank of [undefined, 'elite'] as const) {
      const e = foe(4, 2); if (rank) e.rank = rank;
      const s = createCombat({ seed: 3, w: 10, h: 6, obstacles: [], abyss: [{ x: 5, y: 2 }], units: [hero('carcelero', 3, 2), e] }).state;
      while (current(s)!.team !== 'hero') endTurn(s, current(s)!.id);
      const k = s.units[0]!, f = s.units[1]!; f.shield = 0;
      const hp = f.hp;
      expect(cast(s, k.id, 'k_guadana', { x: 4, y: 2 }).ok).toBe(true);
      if (rank) { expect(f.hp).toBeGreaterThan(0); expect(f.pos).not.toEqual({ x: 5, y: 2 }); expect(hp - f.hp).toBeGreaterThanOrEqual(20); }
      else expect(f.hp).toBe(0);
    }
  });
  it('braseros: un golpe los rompe y deja una línea de fuego que quema; las raíces envenenan', () => {
    const s = createCombat({ seed: 3, w: 10, h: 6, obstacles: [], braziers: [{ x: 4, y: 2 }], roots: [{ x: 2, y: 3 }], units: [hero('zorro', 2, 2), foe(6, 2)] }).state;
    while (current(s)!.team !== 'hero') endTurn(s, current(s)!.id);
    const z = s.units[0]!, e = s.units[1]!;
    expect(cast(s, z.id, 'z_orbe', { x: 4, y: 2 }).ok).toBe(true);
    expect(s.braziers).toEqual([]);
    expect(s.obstacles).not.toContain('4,2');
    expect(s.fire?.['6,2']).toBeGreaterThan(0);
    expect(e.statuses.burn).toBeTruthy();
    expect(move(s, z.id, { x: 2, y: 3 }).ok).toBe(true);
    expect(z.statuses.poison).toBeTruthy();
  });
});
