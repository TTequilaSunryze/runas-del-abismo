// Fase G4: rutas alternativas, decisiones con consecuencias y acontecimientos ramificados.
import { describe, expect, it } from 'vitest';
import { BRANCH_EVENTS, consequences, followUps, hasMark, keyFlag, weakBossFlag } from '../src/content/branching';
import { createCombat } from '../src/core/combat/engine';
import { makeActMap, mapOk } from '../src/game/map';
import { buildFight, chooseNode, eventDef, finishFight, heroMaxHp, newRun, resolveEvent, vote, type RunState } from '../src/game/run';
import { roomStep } from './helpers';

const box = (rng: number) => ({ rng });
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } } as Storage;
const P = [{ owner: 'a', name: 'A', cls: 'arquero' as const, routes: [] as string[] }, { owner: 'b', name: 'B', cls: 'barbaro' as const, routes: [] as string[] }];
const mk = (seed = 4): RunState => { const r = roomStep(newRun('G4', seed, P)); for (const h of r.heroes) h.gold = 300; return r; };
/** Resuelve un evento con todos votando la opción `i`. */
const decide = (r: RunState, id: string, i: number): void => { r.phase = 'event'; r.event = { id, votes: {} }; for (const h of r.heroes) vote(r, h.owner, i); resolveEvent(r, 'a'); };
/** Coloca al grupo ante la fila `l` del mapa con el nodo `i` disponible, como si viniera del nodo `from`. */
const at = (r: RunState, l: number, from: number): void => { r.phase = 'map'; r.step = l; r.at = from; r.trail = Array.from({ length: l }, () => 0); r.trail[l - 1] = from; };

describe('G4 · rutas', () => {
  it('el mapa solo muestra la leyenda; la Senda de sangre sale detrás de un «?» como mucho una vez por zona', () => {
    let sangre = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const m = makeActMap(box(seed * 7919));
      expect(mapOk(m)).toBe(true);
      expect(m.layers.flat().some((k) => k === 'vault' || k === 'sangre' || k === 'cage')).toBe(false);
      const r = mk(seed);
      for (let n = 0; n < 6; n++) { r.phase = 'map'; r.map[r.step] = ['event']; r.at = -1; chooseNode(r, 0); if (r.flags.includes('g4_sangre')) { sangre++; break; } }
      expect(r.flags.filter((f) => f === `sangre_z${r.zone}`).length).toBeLessThanOrEqual(1);
    }
    expect(sangre).toBeGreaterThan(20);
  });
  it('la Cámara Rúnica: con la llave de la zona, el siguiente «?» lleva a ella (y gasta la llave)', () => {
    const r = mk(5);
    r.phase = 'map'; r.map[r.step] = ['event']; r.at = -1;
    r.flags.push(keyFlag(r.zone));
    chooseNode(r, 0);
    expect(r.phase).toBe('event');
    expect(r.event?.id).toBe('g4_camara');
    expect(r.flags).not.toContain(keyFlag(r.zone));
  });
  it('Senda de sangre: enemigos más duros, recompensa conocida y se cobra al ganar', () => {
    const r = mk();
    r.kind = 'combat'; r.zoneFight = 1;
    const rng = r.rng;
    const plain = createCombat({ ...buildFight(r) }).state.units.filter((u) => u.team === 'enemy');
    r.flags.push('g4_sangre'); r.rng = rng;
    const hard = createCombat({ ...buildFight(r) }).state.units.filter((u) => u.team === 'enemy');
    expect(hard[0]!.maxHp).toBeGreaterThan(plain[0]!.maxHp);
    expect(hard[0]!.power).toBeGreaterThan(plain[0]!.power);
    r.combat = createCombat({ ...buildFight(r) }).state;
    r.combat.over = 'win';
    const relics = r.heroes.map((h) => h.relics.length);
    finishFight(r);
    expect(r.flags).not.toContain('g4_sangre');
    r.heroes.forEach((h, i) => expect(h.relics.length).toBe(relics[i]! + 1));
  });
});

describe('G4 · decisiones y acontecimientos ramificados', () => {
  it('cada opción de cada acontecimiento se resuelve sin dejar a nadie sin vida ni oro negativo', () => {
    for (const e of BRANCH_EVENTS) for (let i = 0; i < e.options.length; i++) {
      const r = mk(); r.zone = 1;
      // abre todas las condiciones
      r.flags.push('g4_preso_libre@0', 'g4_fuente_bebida@0', keyFlag(1));
      decide(r, e.id, i);
      expect(eventDef(r)?.id).toBe(e.id);
      expect(r.event!.result, `${e.id}/${i}`).toBeTruthy();
      for (const h of r.heroes) { expect(h.hp).toBeGreaterThan(0); expect(h.hp).toBeLessThanOrEqual(heroMaxHp(h)); expect(h.gold).toBeGreaterThanOrEqual(0); }
    }
  });
  it('robarle el mapa al cartógrafo: llave ahora, cazarrecompensas en la zona siguiente', () => {
    const r = mk();
    decide(r, 'g4_cartografo', 1);
    expect(r.flags).toContain(keyFlag(0));
    expect(hasMark(r, 'g4_carto_robado')).toBe(true);
    // en la misma zona aún no vienen
    expect(followUps(r).map((e) => e.id)).not.toContain('g4_cazarrecompensas');
    r.zone = 1;
    expect(followUps(r).map((e) => e.id)).toContain('g4_cazarrecompensas');
    expect(consequences(r).some((c) => c.name === 'Perseguidos')).toBe(true);
    // la siguiente sala de evento es su continuación
    const l = r.map.findIndex((row) => row.includes('event'));
    if (l > 0) {
      const i = r.map[l]!.indexOf('event');
      const from = r.links[l - 1]!.findIndex((to) => to.includes(i));
      at(r, l, from);
      chooseNode(r, i);
      expect(r.event?.id).toBe('g4_cazarrecompensas');
    }
    decide(r, 'g4_cazarrecompensas', 1);
    expect(r.ambush).toBe(true);
    expect(r.flags).toContain('g2_desafio');
    expect(hasMark(r, 'g4_carto_robado')).toBe(false);
    expect(followUps(r).map((e) => e.id)).not.toContain('g4_cazarrecompensas');
  });
  it('liberar o vender al prisionero lleva a desenlaces distintos', () => {
    const a = mk(); decide(a, 'g4_prisionero', 0); a.zone = 1;
    const b = mk(); decide(b, 'g4_prisionero', 1); b.zone = 1;
    expect(a.allies.length).toBe(1);
    expect(followUps(a).map((e) => e.id)).toEqual(['g4_preso_regreso']);
    expect(followUps(b).map((e) => e.id)).toEqual(['g4_preso_venganza']);
    const gold = b.heroes.map((h) => h.gold);
    decide(b, 'g4_preso_venganza', 0);
    b.heroes.forEach((h, i) => expect(h.gold).toBe(gold[i]! - 70));
  });
  it('las opciones bloqueadas no se pueden votar ni ganar; se desbloquean por decisiones anteriores', () => {
    const r = mk(); r.zone = 1;
    r.flags.push('g4_carto_amigo@0');
    const def = BRANCH_EVENTS.find((e) => e.id === 'g4_carto_refugio')!;
    const locked = def.options.findIndex((o) => !!o.when);
    r.phase = 'event'; r.event = { id: def.id, votes: {} };
    for (const h of r.heroes) vote(r, h.owner, locked);
    expect(Object.keys(r.event.votes)).toHaveLength(0);
    resolveEvent(r, 'a');
    expect(r.event.result).not.toContain(def.options[locked]!.label);
    // con el prisionero liberado, la opción se abre
    const s = mk(); s.zone = 1; s.flags.push('g4_carto_amigo@0', 'g4_preso_libre@0');
    decide(s, def.id, locked);
    expect(s.event!.result).toContain(def.options[locked]!.label);
    expect(s.flags).toContain(keyFlag(1));
  });
  it('sellar la Fuente debilita al jefe de la zona; beber obliga a pagar más adelante', () => {
    const r = mk(); r.zone = 1; r.zoneFight = 5; r.kind = 'boss';
    const hp = (x: RunState): number => createCombat({ ...buildFight(x) }).state.units.find((u) => u.rank === 'boss')!.maxHp;
    const rng = r.rng;
    const before = hp(r);
    decide(r, 'g4_fuente', 2);
    r.rng = rng;
    expect(r.flags).toContain(weakBossFlag(1));
    expect(hp(r)).toBeLessThan(before);
    const d = mk(); d.zone = 1;
    const pw = d.heroes.map((h) => h.boon.power ?? 0);
    decide(d, 'g4_fuente', 0);
    d.heroes.forEach((h, i) => expect(h.boon.power ?? 0).toBe(pw[i]! + 1));
    expect(followUps(d)).toHaveLength(0);
    d.zone = 2;
    expect(followUps(d).map((e) => e.id)).toEqual(['g4_sed']);
  });
  it('el trato del heraldo da una recompensa de jefe a cada uno y refuerza al jefe', () => {
    const r = mk(); r.zone = 1;
    decide(r, 'g4_heraldo', 0);
    expect(r.heroes.every((h) => !!h.boonOffer || !!h.bossOffer)).toBe(true);
    expect(r.flags).toContain('g2_carga_1');
  });
});

describe('G4 · determinismo y recuperación', () => {
  const script = (r: RunState): string => {
    decide(r, 'g4_cartografo', 1);
    decide(r, 'g4_camara', 0);
    r.zone = 1;
    decide(r, 'g4_cazarrecompensas', 1);
    return JSON.stringify({ flags: r.flags, heroes: r.heroes.map((h) => [h.hp, h.gold, h.relics]), ambush: r.ambush, rng: r.rng });
  };
  it('misma semilla y mismas decisiones: mismo resultado', () => {
    expect(script(mk(9))).toBe(script(mk(9)));
  });
  it('una partida guardada a mitad de la cadena continúa igual', () => {
    const a = mk(9);
    decide(a, 'g4_cartografo', 1);
    const b = JSON.parse(JSON.stringify(a)) as RunState;
    for (const r of [a, b]) { decide(r, 'g4_camara', 0); r.zone = 1; decide(r, 'g4_cazarrecompensas', 1); }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
