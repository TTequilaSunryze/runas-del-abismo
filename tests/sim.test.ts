// Simulación de equilibrio: partidas completas con héroes llevados por la IA de campeón.
// Larga: solo corre con SIMN=<partidas> (p. ej. `SIMN=60 npx vitest run tests/sim.test.ts`).
// La versión corta comprueba siempre que las clases nuevas no atascan los combates.
import { expect, it } from 'vitest';
import { availableNodes, DIFF, bossInfo, chooseNode, finishFight, leaveNode, metaAction, newRun, resolveEvent, type RunState } from '../src/game/run';
import { autoplay } from './helpers';
import type { ClassId } from '../src/core/state';

function play(classes: ClassId[], seed: number): { run: RunState; stalls: number } {
  const run = newRun('SIM', seed, classes.map((cls, i) => ({ owner: `p${i}`, name: `H${i}`, cls, routes: ['base'] })));
  let stalls = 0;
  for (let step = 0; step < 200 && run.phase !== 'won' && run.phase !== 'lost'; step++) {
    for (const h of run.heroes) {
      for (let k = 0; k < 6 && h.upOffer; k++) metaAction(run, h.owner, { a: 'upgrade', idx: 0 });
      for (let k = 0; k < 6 && h.boonOffer; k++) metaAction(run, h.owner, { a: 'boon', idx: k % 3 } as never);
    }
    if (run.phase === 'map') {
      for (const h of run.heroes) { if (run.offers[h.owner]) metaAction(run, h.owner, { a: 'pick', idx: 0 }); if (h.bag.length) metaAction(run, h.owner, { a: 'equip', idx: 0 }); }
      const nodes = run.map[run.step]!, av = availableNodes(run);
      chooseNode(run, av.find((i) => nodes[i] === 'combat') ?? av[0]!);
    } else if (run.phase === 'event') {
      for (const h of run.heroes) metaAction(run, h.owner, { a: 'vote', idx: 0 });
      resolveEvent(run, 'p0'); leaveNode(run);
    } else if (run.phase === 'camp') {
      for (const h of run.heroes) { const k = run.camp!.kind; if (k === 'forge') metaAction(run, h.owner, { a: 'forge', slot: (Object.keys(h.equip)[0] ?? 'arma') as never }); else if (k === 'altar') metaAction(run, h.owner, { a: 'altar', opt: 2 }); }
      leaveNode(run);
    } else if (run.phase === 'shop') {
      for (const h of run.heroes) metaAction(run, h.owner, { a: 'potion' });
      leaveNode(run);
    } else {
      // todos los héroes los juega la IA de campeón: usa todos los hechizos (también los de suelo y cono)
      for (const u of run.combat!.units) if (u.team === 'hero' && u.ai === null) u.ai = 'champ';
      autoplay(run.combat!, 1500, bossInfo(run));
      if (!run.combat!.over) { stalls++; run.combat!.over = 'lose'; }
      finishFight(run);
    }
  }
  return { run, stalls };
}

it.skipIf(!(globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.SIMN)('simulación de equilibrio (3 y 4 jugadores)', () => {
  const comps: Record<string, ClassId[][]> = {
    '3 arq+carc+arq': [['arquero', 'carcelero', 'arquero']],
    '3 arq+carc+zorro': [['arquero', 'carcelero', 'zorro']],
    '3 arq+carc+esferas': [['arquero', 'carcelero', 'esferas']],
    '3 arq+carc+acechador': [['arquero', 'carcelero', 'acechador']],
    '3 arq+carc+barbaro': [['arquero', 'carcelero', 'barbaro']],
    '3 nuevas zorro+esferas+barbaro': [['zorro', 'esferas', 'barbaro']],
    '4 nuevas carc+esferas+zorro+acechador': [['carcelero', 'esferas', 'zorro', 'acechador']],
    '4 nuevas barbaro+acechador+zorro+carc': [['barbaro', 'acechador', 'zorro', 'carcelero']],
  };
  const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  if (env.DBASE) DIFF.base = Number(env.DBASE);
  if (env.DZONE) DIFF.perZone = Number(env.DZONE);
  const only = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.SIMONLY;
  if (only) for (const k of Object.keys(comps)) if (!k.includes(only)) delete comps[k];
  const N = Number((globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env.SIMN ?? 30);
  for (const [name, list] of Object.entries(comps)) {
    let wins = 0, stalls = 0; const zones = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= N; seed++) {
      const { run, stalls: st } = play(list[0]!, seed * 7919);
      stalls += st;
      if (run.phase === 'won') wins++; else zones[run.zone]!++;
    }
    console.log(`SIM ${name}: victorias ${wins}/${N} (${Math.round((100 * wins) / N)}%) · derrotas por zona ${zones.slice(0, 4).join('/')} · atascos ${stalls}`);
  }
}, 600000);

it('partidas con las clases nuevas terminan sin atascos (3 y 4 jugadores)', () => {
  for (const [list, seed] of [[['esferas', 'zorro', 'barbaro'], 101], [['carcelero', 'esferas', 'barbaro', 'acechador'], 202]] as const) {
    const { run, stalls } = play([...list] as ClassId[], seed);
    expect(['won', 'lost']).toContain(run.phase);
    expect(stalls).toBe(0);
  }
}, 120000);
