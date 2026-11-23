import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, current } from '../src/core/combat/engine';
import { cleanRoom, mergeRooms, newRoom, roomSetup, roomWarnings, type RoomDef } from '../src/game/salas';
import { labAction, labOn, labSceneOf, newTraining, buildFight, newRun, setRoomSource } from '../src/game/run';
import { heroSpec } from '../src/game/run';

const hero = (): ReturnType<typeof heroSpec> => heroSpec(newRun('H', 1, [{ owner: 'me', name: 'Yo', cls: 'carcelero', routes: ['base'] }]).heroes[0]!);

function room(): RoomDef {
  const r = newRoom(0);
  r.w = 8; r.h = 5;
  r.cells = { '7,0': 'void', '7,4': 'void', '4,2': 'brazier', '3,1': 'wall', '5,3': 'trap' };
  r.starts = [{ x: 0, y: 1 }, { x: 0, y: 3 }];
  r.enemies = [{ kind: 'esqueleto', x: 6, y: 2, mod: { hp: 100, power: 3, ap: 1 } }, { kind: 'arquero', x: 6, y: 1, wave: 3 }, { kind: 'limo', x: 6, y: 3, min: 2 }];
  return r;
}

describe('salas creadas', () => {
  it('limpia datos malos y conserva lo válido', () => {
    const r = cleanRoom({ ...room(), w: 99, cells: { '1,1': 'lava', '2,2': 'wall' }, enemies: [{ kind: 'nadie', x: 1, y: 1 }, { kind: 'esqueleto', x: 2, y: 3, mod: { hp: 9999 } }] })!;
    expect(r.w).toBe(16);
    expect(r.cells).toEqual({ '2,2': 'wall' });
    expect(r.enemies).toHaveLength(1);
    expect(r.enemies[0]!.mod!.hp).toBe(500);
  });

  it('monta el combate: forma, calderos, ajustes, oleadas y jugadores mínimos', () => {
    const setup = roomSetup(room(), [hero()], { players: 1, depth: 0 }, 5, false);
    const s = createCombat(setup).state;
    expect(s.voids).toEqual(['7,0', '7,4']);
    expect(s.obstacles).toContain('7,0');
    expect(s.braziers).toContain('4,2');
    expect(s.traps).toContain('5,3');
    const enemies = s.units.filter((u) => u.team === 'enemy');
    expect(enemies.map((u) => u.kind)).toEqual(['esqueleto']);
    expect(enemies[0]!.ap).toBe(4);
    expect(s.waves).toHaveLength(1);
    expect(s.units.find((u) => u.team === 'hero')!.pos).toEqual({ x: 0, y: 1 });
    expect(roomSetup(room(), [hero(), hero()], { players: 2, depth: 0 }, 5, false).units.filter((u) => u.team === 'enemy')).toHaveLength(2);
  });

  it('las oleadas entran en su ronda o en cuanto no queda nadie', () => {
    const setup = roomSetup(room(), [hero()], { players: 1, depth: 0 }, 5, false);
    const s = createCombat(setup).state;
    const sk = s.units.find((u) => u.kind === 'esqueleto')!;
    sk.hp = 0;
    // al acabar el turno se comprueba el combate: entra la oleada en vez de ganar
    const h = s.units.find((u) => u.team === 'hero')!;
    for (let i = 0; i < 6 && !s.over && current(s)?.id === h.id; i++) endTurn(s, h.id);
    // forzamos la comprobación con un golpe al esqueleto muerto: la manera más simple es avanzar rondas
    for (let i = 0; i < 10 && !s.over && !s.units.some((u) => u.kind === 'arquero'); i++) { const c = current(s); if (!c) break; endTurn(s, c.id); }
    expect(s.units.some((u) => u.kind === 'arquero')).toBe(true);
    expect(s.over).toBeNull();
  });

  it('objetivo sobrevivir: se gana al pasar las rondas', () => {
    const r = room(); r.goal = { kind: 'survive', rounds: 2 }; r.enemies = [{ kind: 'pilar', x: 6, y: 2 }];
    const s = createCombat(roomSetup(r, [hero()], { players: 1, depth: 0 }, 5, false)).state;
    for (let i = 0; i < 20 && !s.over; i++) { const c = current(s); if (!c) break; endTurn(s, c.id); }
    expect(s.over).toBe('win');
    expect(s.round).toBe(3);
  });

  it('avisos y fusión entre dispositivos', () => {
    const r = room(); r.starts = [{ x: 0, y: 0 }];
    expect(roomWarnings(r).join(' ')).toContain('casillas de inicio');
    const a = { ...room(), id: 'x', t: 1, name: 'vieja' }, b = { ...room(), id: 'x', t: 2, name: 'nueva' };
    expect(mergeRooms([a], [b]).map((q) => q.name)).toEqual(['nueva']);
    expect(mergeRooms([a], [b], ['x'])).toHaveLength(0);
  });

  it('las salas publicadas pueden salir en las expediciones', () => {
    const r = { ...room(), published: true, chance: 100, starts: [{ x: 0, y: 1 }, { x: 0, y: 3 }, { x: 1, y: 2 }, { x: 0, y: 0 }] };
    setRoomSource(() => [r]);
    const run = newRun('T', 9, [{ owner: 'me', name: 'Yo', cls: 'carcelero', routes: ['base'] }]);
    run.kind = 'combat';
    const setup = buildFight(run);
    expect(setup.biome).toBe(r.name);
    expect(setup.voids).toHaveLength(2);
    setRoomSource(() => []);
  });
});

describe('laboratorio', () => {
  it('invoca, quita, trucos, control de la IA y escenarios', () => {
    const run = newTraining('L', 3, 'me', 'Yo', 'carcelero', { heroes: ['carcelero', 'zorro'], level: 6, zone: 1, asc: 0, gear: 2, depth: 2 });
    expect(run.heroes).toHaveLength(2);
    expect(run.heroes[0]!.level).toBe(6);
    expect(Object.keys(run.heroes[0]!.equip)).toHaveLength(8);
    const c = run.combat!;
    const free = { x: 8, y: 4 };
    expect(labAction(run, 'me', `spawn:lobo:${free.x}:${free.y}:enemy`).err).toBeNull();
    expect(c.units.some((u) => u.kind === 'lobo' && u.team === 'enemy')).toBe(true);
    expect(labAction(run, 'me', 'spawn:prior:10:2:enemy').err).toBeNull();
    expect(run.zone).toBe(0);
    expect(labAction(run, 'me', `remove:${free.x}:${free.y}`).err).toBeNull();
    expect(c.units.find((u) => u.kind === 'lobo')!.hp).toBe(0);
    labAction(run, 'me', 'flag:god');
    expect(labOn(run, 'god')).toBe(true);
    labAction(run, 'me', 'aimode:puppet');
    expect(labOn(run, 'puppet')).toBe(true);
    expect(labAction(run, 'me', 'scene:{"kind":"fight","fight":"boss","boss":1}').err).toBeNull();
    expect(labSceneOf(run).kind).toBe('fight');
    expect(run.combat!.units.some((u) => u.ai === 'boss')).toBe(true);
    // los trucos se conservan al cambiar de escenario
    expect(labOn(run, 'god')).toBe(true);
    expect(run.combat!.units.filter((u) => u.owner === 'me')).toHaveLength(2);
  });
});
