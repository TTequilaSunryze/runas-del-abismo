import { describe, expect, it } from 'vitest';
import { makeEnemy, ENEMIES, AFFIXES, ALLIES } from '../src/content/enemies';
import { OMENS } from '../src/content/modes';
import { RELICS } from '../src/content/relics';
import { ZONES } from '../src/content/zones';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { runAiTurn } from '../src/core/combat/ai';
import { cast, createCombat, current, endTurn, type UnitSpec } from '../src/core/combat/engine';
import { bossOf, buildFight, chooseNode, finishFight, heroSpec, lastZone, newRun } from '../src/game/run';
import { spellGlyphErrors, spellSummary } from '../src/ui/spellicons';

const hero = (pos = { x: 1, y: 3 }): UnitSpec => makeHero({ cls: 'guerrero', name: 'H', owner: 'p0', routes: ['baluarte'], pos, level: 3 });
const board = (units: UnitSpec[]) => createCombat({ seed: 5, w: 12, h: 7, obstacles: [], units }).state;
const turnOf = (s: ReturnType<typeof board>, id: number) => { for (let i = 0; i < 20 && current(s)!.id !== id; i++) endTurn(s, current(s)!.id); };

describe('rasgos nuevos', () => {
  it('la calavera explota al morir y daña a los pegados', () => {
    const s = board([hero(), makeEnemy('calavera', { x: 2, y: 3 })]);
    const h = s.units[0]!, foe = s.units[1]!;
    foe.hp = 1;
    turnOf(s, h.id);
    const hp = h.hp;
    const r = cast(s, h.id, 'tajo', foe.pos);
    expect(r.ok && r.events.some((e) => e.t === 'explode')).toBe(true);
    expect(h.hp).toBeLessThan(hp);
  });
  it('el hongo se divide en dos al morir', () => {
    const s = board([hero(), makeEnemy('hongo', { x: 2, y: 3 }), makeEnemy('limo', { x: 9, y: 0 })]);
    const h = s.units[0]!, foe = s.units[1]!;
    foe.hp = 1;
    turnOf(s, h.id);
    cast(s, h.id, 'tajo', foe.pos);
    const kids = s.units.filter((u) => u.name.endsWith('menor') && u.hp > 0);
    expect(kids).toHaveLength(2);
    expect(kids.every((k) => !k.traits?.includes('split'))).toBe(true);
  });
  it('la momia se regenera y la gárgola devuelve daño', () => {
    const s = board([hero(), makeEnemy('momia', { x: 9, y: 0 }), makeEnemy('gargola', { x: 2, y: 3 })]);
    const h = s.units[0]!, momia = s.units[1]!, garg = s.units[2]!;
    momia.hp = 10;
    turnOf(s, momia.id);
    expect(momia.hp).toBeGreaterThan(10);
    turnOf(s, h.id);
    const hp = h.hp;
    cast(s, h.id, 'tajo', garg.pos);
    expect(h.hp).toBeLessThan(hp);
  });
  it('el sepulturero esconde cepos y la pantera salta junto a su presa', () => {
    const s = board([hero(), makeEnemy('sepulturero', { x: 9, y: 3 }), makeEnemy('pantera', { x: 10, y: 6 })]);
    const sep = s.units[1]!, pan = s.units[2]!;
    turnOf(s, sep.id);
    runAiTurn(s);
    expect((s.snares ?? []).some((t) => t.team === 'enemy')).toBe(true);
    while (s.round % 2 === 1) endTurn(s, current(s)!.id);
    turnOf(s, pan.id);
    const ev = runAiTurn(s);
    expect(ev.some((e) => e.t === 'blink') || Math.abs(pan.pos.x - 1) + Math.abs(pan.pos.y - 3) <= 1).toBe(true);
  });
  it('los afijos nuevos dan su rasgo', () => {
    expect(Object.keys(AFFIXES).length).toBeGreaterThanOrEqual(12);
    expect(makeEnemy('limo', { x: 0, y: 0 }, 0, 1, { affixes: ['explosivo', 'regenerador'] }).traits).toEqual(expect.arrayContaining(['bomb', 'regen']));
  });
});

describe('contenido', () => {
  it('cada zona tiene 2 jefes, 2 élites y al menos 6 eventos', () => {
    expect(ZONES).toHaveLength(4);
    for (const z of ZONES) { expect(z.bosses).toHaveLength(2); expect(z.elites.length).toBeGreaterThanOrEqual(2); expect(z.events.length).toBeGreaterThanOrEqual(6); }
    expect(Object.keys(ENEMIES).length).toBeGreaterThanOrEqual(50);
  });
  it('los aliados y sus hechizos existen', () => {
    for (const a of Object.values(ALLIES)) for (const sp of [a.spell, ...(a.more ?? [])]) expect(SPELLS[sp], sp).toBeDefined();
  });
  it('cada hechizo de héroe tiene icono y un resumen', () => {
    expect(spellGlyphErrors()).toEqual([]);
    for (const d of Object.values(SPELLS).filter((x) => x.route !== 'enemy')) expect(spellSummary(d).length).toBeGreaterThan(8);
  });
  it('el jefe varía entre partidas', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 30; seed++) seen.add(bossOf(newRun('T', seed, [{ owner: 'a', name: 'A', cls: 'guerrero', routes: ['baluarte'] }])).id);
    expect(seen.size).toBe(2);
  });
});

const P = [{ owner: 'a', name: 'A', cls: 'guerrero' as const, routes: ['baluarte'] }];
describe('salas, reliquias y presagios', () => {
  it('runas (antes reliquias): cambian estadísticas y rasgos', () => {
    const run = roomStep(newRun('T', 3, P));
    const h = run.heroes[0]!;
    h.runes = ['caparazon', 'raiz_viva'];
    const u = heroSpec(h);
    expect(u.armor).toBe(heroSpec({ ...h, runes: [] }).armor + 2);
    expect(u.traits).toContain('regen');
    // las reliquias antiguas ya no cuentan en combate (se migran a runas al cargar)
    expect(heroSpec({ ...h, runes: [], relics: ['caparazon'] }).armor).toBe(heroSpec({ ...h, runes: [] }).armor);
    expect(Object.keys(RELICS).length).toBeGreaterThanOrEqual(20);
  });
  it('jaula: el aliado lucha con el grupo y no cuenta para perder', () => {
    const run = roomStep(newRun('T', 3, P));
    run.map[run.step] = ['cage'];
    chooseNode(run, 0);
    // la jaula es un combate: el aliado se une al ganarlo
    expect(run.phase).toBe('combat');
    expect(run.allies).toHaveLength(0);
    run.combat!.over = 'win';
    finishFight(run);
    expect(run.allies).toHaveLength(1);
    run.kind = 'combat';
    const ally = buildFight(run).units.find((u) => u.summoner === -1)!;
    expect(ally.team).toBe('hero');
  });
  it('los presagios cambian el combate', () => {
    expect(OMENS.length).toBeGreaterThanOrEqual(8);
    const run = roomStep(newRun('T', 3, P));
    run.kind = 'combat';
    run.omen = 'pantano';
    expect(buildFight(run).puddles!.length).toBeGreaterThan(0);
    run.omen = 'calma';
    const u = buildFight(run).units[0]!;
    expect(u.ap).toBe(heroSpec(run.heroes[0]!).ap + 1);
  });
  it('el modificador sin descanso quita las hogueras', () => {
    for (let seed = 1; seed < 10; seed++) expect(newRun('T', seed, P, { mods: ['sin_descanso'] }).map.flat()).not.toContain('rest');
  });
});

describe('zona 4', () => {
  it('con el Abismo la partida sigue tras la zona 3', () => {
    const run = newRun('T', 3, P, { abyss: true });
    expect(lastZone(run)).toBe(3);
    expect(lastZone(newRun('T', 3, P))).toBe(2);
    run.zone = 2; run.kind = 'boss'; run.phase = 'combat';
    run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(run.heroes[0]!, { x: 1, y: 1 })] }).state;
    run.combat.over = 'win';
    finishFight(run);
    expect(run.zone).toBe(3);
    expect(run.phase).toBe('event');
    expect(run.event!.id).toBe('reliquia_2');
  });
  it('el reto diario nunca incluye el Abismo', () => {
    expect(newRun('T', 3, P, { abyss: true, daily: '2026-11-16' }).abyss).toBe(false);
  });
});

import { roomStep } from './helpers';
