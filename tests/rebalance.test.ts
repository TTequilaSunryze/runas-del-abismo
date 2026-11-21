import { describe, expect, it } from 'vitest';
import { runAiTurn } from '../src/core/combat/ai';
import { createCombat } from '../src/core/combat/engine';
import { bossEscorts, bossInfo, buildFight, minionCap, newRun, zoneBoost } from '../src/game/run';

const P = (n: number) => Array.from({ length: n }, (_, i) => ({ owner: 'p' + i, name: 'P', cls: 'arquero' as const, routes: [] as string[] }));
const bossRun = (n: number, z = 1, asc = 0) => { const r = newRun('G3', 7, P(n), { asc }); r.zone = z; r.zoneFight = 5; r.kind = 'boss'; return r; };

describe('G3.0 · reequilibrio del combate', () => {
  it('escoltas: n − 1 (mínimo 1) y a la profundidad del jefe', () => {
    expect([1, 2, 3, 4].map(bossEscorts)).toEqual([1, 1, 2, 3]);
    for (const n of [1, 2, 3, 4]) {
      const f = buildFight(bossRun(n) as never) as { units: Array<{ team: string; rank?: string; power: number }> };
      const en = f.units.filter((u) => u.team === 'enemy');
      expect(en.length).toBe(1 + bossEscorts(n));
    }
  });
  it('esbirros: tope a la vez (1,1,2,2), total n + 1, y nunca más vida que un enemigo normal de la zona', () => {
    expect([1, 2, 3, 4].map(minionCap)).toEqual([1, 1, 2, 2]);
    for (const z of [0, 1, 2, 3]) {
      const r = bossRun(2, z), info = bossInfo(r), m = info.minion({ x: 0, y: 0 });
      expect(info.minionTotal).toBe(3);
      const normal = newRun('G3', 7, P(2)); normal.zone = z; normal.zoneFight = 0; normal.kind = 'combat';
      const f = buildFight(normal as never) as { units: Array<{ team: string; kind: string; maxHp: number }> };
      const same = f.units.find((u) => u.team === 'enemy' && u.kind === m.kind);
      if (same) expect(m.maxHp).toBeLessThanOrEqual(same.maxHp);
    }
  });
  it('las ascensiones siguen sumando: más refuerzo y más pilares en la 10', () => {
    const a0 = bossRun(2, 2, 0), a10 = bossRun(2, 2, 10);
    expect(zoneBoost(a10)).toBeGreaterThan(zoneBoost(a0));
    expect(bossInfo(a10).pillars).toBe(2 * bossInfo(a0).pillars!);
  });
  it('el jefe no invoca más de lo permitido en 30 rondas y sus invocaciones quedan marcadas como suyas', () => {
    const r = bossRun(4, 0);
    const state = createCombat({ ...buildFight(r as never) }).state;
    const boss = state.units.find((u) => u.rank === 'boss')!;
    const info = bossInfo(r);
    for (let round = 1; round <= 30; round++) { state.round = round; boss.ap = boss.maxAp; state.over = null; state.turn = state.order.indexOf(boss.id); runAiTurn(state, info); }
    const mine = state.units.filter((u) => u.summoner === boss.id && u.ai !== 'pillar');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThanOrEqual(info.minionTotal!);
  });
  it('determinista: misma semilla, mismo combate', () => {
    expect(JSON.stringify(buildFight(bossRun(3, 2) as never))).toBe(JSON.stringify(buildFight(bossRun(3, 2) as never)));
  });
});
