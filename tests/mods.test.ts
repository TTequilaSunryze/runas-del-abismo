import { describe, expect, it } from 'vitest';
import { DAILY_MODS, DAILY_POOL, MOD_ECOS, cleanMods, modConflict, modEcos } from '../src/content/modes';
import { ecosFor } from '../src/game/meta';
import { chooseNode, heroMaxHp, newRun, shrineSize } from '../src/game/run';
import { roomStep } from './helpers';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } } as Storage;
const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }];

describe('Fase G1 · modificadores de expedición', () => {
  it('catálogo: ids únicos; los originales y el reto diario no cambian', () => {
    expect(new Set(DAILY_MODS.map((m) => m.id)).size).toBe(DAILY_MODS.length);
    for (const id of ['llamas', 'horda', 'codicia', 'cristal', 'frenesi', 'elites', 'presagios', 'veloces', 'sin_descanso', 'jefes', 'pobreza']) expect(modEcos(id)).toBe(MOD_ECOS);
    expect(DAILY_POOL).toEqual(['llamas', 'horda', 'codicia', 'cristal', 'frenesi']);
  });
  it('incompatibilidades en los dos sentidos y limpieza de listas', () => {
    expect(modConflict('ecos_inestables', ['codicia'])).toMatch(/Codicia/);
    expect(modConflict('codicia', ['ecos_inestables'])).toMatch(/Ecos inestables/);
    expect(modConflict('oscuridad', ['codicia'])).toBeNull();
    expect(cleanMods(['codicia', 'ecos_inestables', 'x', 'codicia', 'riesgo', 'horda', 'llamas'])).toEqual(['codicia', 'riesgo', 'horda']);
    expect(newRun('MODS', 1, P, { mods: ['maldicion', 'cristal'] }).mods).toEqual(['maldicion']);
  });
  it('sin modificadores la expedición es la de siempre', () => {
    const a = newRun('NORM', 5, P), b = newRun('NORM', 5, P, { mods: [] });
    expect(a.mods).toEqual([]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    a.zone = 1; a.step = 3; a.phase = 'lost';
    const base = ecosFor(a);
    a.mods = ['oscuridad']; expect(Math.abs(ecosFor(a) - base * 1.1)).toBeLessThanOrEqual(1);
  });
  it('maldición persistente: menos vida máxima y una reliquia por héroe', () => {
    const n = newRun('MAL', 3, P), m = newRun('MAL', 3, P, { mods: ['maldicion'] });
    expect(heroMaxHp(m.heroes[0]!)).toBeLessThan(heroMaxHp(n.heroes[0]!));
    expect(m.heroes[0]!.relics.length).toBe(n.heroes[0]!.relics.length + 1);
  });
  it('enemigos reforzados empiezan con escudo; riesgo creciente sube con la zona', () => {
    const r = roomStep(newRun('REF', 3, P, { mods: ['reforzados'] })); chooseNode(r, 0);
    const e = r.combat!.units.find((u) => u.team === 'enemy')!;
    expect(e.shield).toBeGreaterThanOrEqual(Math.round(e.maxHp * 0.15));
    const z0 = roomStep(newRun('RSK', 3, P, { mods: ['riesgo'] })); chooseNode(z0, 0);
    const n0 = roomStep(newRun('RSK', 3, P)); chooseNode(n0, 0);
    expect(z0.combat!.units.filter((u) => u.team === 'enemy').map((u) => u.maxHp)).toEqual(n0.combat!.units.filter((u) => u.team === 'enemy').map((u) => u.maxHp));
  });
  it('santuario agrietado: una opción menos (mínimo 2)', () => {
    const P2 = [{ owner: 'a', name: 'A', cls: 'arquitecto' as const, routes: [] as string[] }];
    const n = newRun('SAN', 3, P2), m = newRun('SAN', 3, P2, { mods: ['agrietado'] });
    expect(shrineSize(m, m.heroes[0]!)).toBe(Math.max(2, shrineSize(n, n.heroes[0]!) - 1));
  });
});
