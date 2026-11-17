// v9: 6 hechizos únicos y 3 bendiciones por clase, y el Bárbaro Desatado con su Furia.
import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../src/content/enemies';
import { PATRONS, patronsOf } from '../src/content/boons';
import { BLESSINGS, BOON_MODS } from '../src/core/boonmods';
import { CLASSES, PLAYABLE } from '../src/core/classes/classes';
import { makeHero } from '../src/core/classes/factory';
import { SPELLS } from '../src/core/classes/spells';
import { cast, castProblem, createCombat, current, endTurn, essenceNeed, move, type UnitSpec } from '../src/core/combat/engine';
import { addMark, marksOf } from '../src/core/combat/marks';
import { runAiTurn } from '../src/core/combat/ai';
import { buildBossOffer, finishFight, heroSpec, newRun, offerBoon } from '../src/game/run';
import type { ClassId, CombatState, Unit } from '../src/core/state';

const NEW: ClassId[] = ['zorro', 'esferas', 'carcelero', 'acechador', 'barbaro'];
const hero = (cls: ClassId, pos = { x: 2, y: 3 }, extra: string[] = [], traits: string[] = []): UnitSpec => {
  const u = makeHero({ cls, name: cls, owner: 'p0', routes: [], pos, level: 1 });
  for (const id of extra) u.spells.push({ id, cd: 0 });
  if (traits.length) u.traits = traits;
  return u;
};
const foe = (pos: { x: number; y: number }, hp = 999) => ({ ...makeEnemy('esqueleto', pos), hp, maxHp: hp, armor: 0, initiative: 1, traits: [] as string[] });
const board = (units: UnitSpec[]): CombatState => createCombat({ seed: 9, w: 14, h: 8, obstacles: [], units }).state;
const me = (s: CombatState): Unit => { const u = s.units[0]!; for (let i = 0; i < 40 && current(s)!.id !== u.id; i++) endTurn(s, current(s)!.id); u.ap = 30; return u; };
const ok = (s: CombatState, u: Unit, id: string, at: { x: number; y: number }) => { const r = cast(s, u.id, id, at); expect(r.ok, r.ok ? id : `${id}: ${r.reason}`).toBe(true); return r.ok ? r.events : []; };

describe('pool de cada clase', () => {
  it('6 hechizos únicos y 3 bendiciones por clase, solo suyos', () => {
    const seen = new Set<string>();
    for (const c of NEW) {
      const pool = patronsOf(c).flatMap((p) => p.spells);
      const spells = pool.filter((id) => SPELLS[id]), bless = pool.filter((id) => BLESSINGS[id]);
      expect(spells, c).toHaveLength(6);
      expect(bless, c).toHaveLength(3);
      for (const id of pool) { expect(seen.has(id), id).toBe(false); seen.add(id); }
      for (const id of bless) expect(BLESSINGS[id]!.cls).toBe(c);
    }
  });
  it('el santuario ofrece las bendiciones de su clase y el jefe sus hechizos únicos, al azar', () => {
    for (const c of NEW) {
      const run = newRun('T', 11, [{ owner: 'a', name: 'A', cls: c, routes: [] }]);
      const h = run.heroes[0]!;
      const pool = new Set(patronsOf(c).flatMap((p) => p.spells));
      expect(h.boonOffer, c).toBeNull();
      offerBoon(run, h);
      expect(h.boonOffer!.spells, c).toHaveLength(3);
      for (const o of h.boonOffer!.spells) expect(BLESSINGS[o]?.cls).toBe(c);
      const got = new Set<string>();
      for (let i = 0; i < 60; i++) for (const o of buildBossOffer(run, h)) { if (o.kind === 'spell') { expect(pool.has(o.id), `${c} ${o.id}`).toBe(true); expect(SPELLS[o.id]).toBeTruthy(); got.add(o.id); } }
      expect(got.size, c).toBe(6);
    }
  });
  it('sin ofertas de hechizo hasta derrotar al jefe', () => {
    for (const seed of [1, 2, 3]) {
      const run = newRun('T', seed, [{ owner: 'a', name: 'A', cls: 'barbaro', routes: [] }]);
      const h = run.heroes[0]!;
      for (const room of [0, 1]) {
        run.combat = createCombat({ seed: 1, w: 8, h: 5, obstacles: [], units: [heroSpec(h, { x: 1, y: 1 })] }).state;
        run.combat.over = 'win'; run.phase = 'combat'; run.kind = 'combat'; run.step = room;
        finishFight(run);
        expect(h.boonOffer).toBeNull(); expect(h.bossOffer).toBeNull();
      }
    }
  });
});

describe('Hechicera Zorro', () => {
  it('Fuego zorruno: 3 llamas que vuelan al acabar el turno al más cercano (empate: menos vida)', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }, ['z_fuego']), foe({ x: 5, y: 3 }, 50), foe({ x: 2, y: 6 }, 30), foe({ x: 9, y: 3 }, 5)]);
    const u = me(s);
    ok(s, u, 'z_fuego', u.pos);
    expect(marksOf(s, 'flame', u.id)).toHaveLength(3);
    const r = endTurn(s, u.id);
    expect(r.ok && r.events.filter((e) => e.t === 'flame')).toHaveLength(3);
    expect(s.units[2]!.hp).toBeLessThan(30);
    expect(s.units[1]!.hp).toBe(50);
    expect(s.units[3]!.hp).toBe(5);
    expect(marksOf(s, 'flame', u.id)).toHaveLength(0);
  });
  it('aura: con la Esencia llena, la siguiente habilidad de daño cura; Esencia desbordante pide 2', () => {
    const s = board([hero('zorro', undefined, [], ['esencia2']), foe({ x: 4, y: 3 })]);
    const u = me(s);
    expect(essenceNeed(u)).toBe(2);
    u.essence = 2; u.hp = u.maxHp;
    const ev = ok(s, u, 'z_orbe', { x: 4, y: 3 });
    expect(ev.some((e) => e.t === 'shield' && e.unit === u.id)).toBe(true);
  });
  it('Espejismo: señuelo de 1 vida en su casilla, ella retrocede 2 y los enemigos van a por el señuelo', () => {
    const s = board([hero('zorro', { x: 5, y: 3 }, ['z_espejismo']), foe({ x: 6, y: 3 })]);
    const u = me(s);
    ok(s, u, 'z_espejismo', u.pos);
    expect(u.pos).toEqual({ x: 3, y: 3 });
    const d = s.units.find((x) => x.ai === 'decoy')!;
    expect(d.pos).toEqual({ x: 5, y: 3 });
    expect(d.hp).toBe(1);
    endTurn(s, u.id);
    runAiTurn(s);
    expect(d.hp).toBe(0);
    expect(u.hp).toBe(u.maxHp);
  });
  it('Vórtice daña en cruz y atrae hacia el centro', () => {
    const s = board([hero('zorro', { x: 1, y: 3 }, ['z_vortice']), foe({ x: 5, y: 3 }), foe({ x: 7, y: 3 })]);
    const u = me(s);
    ok(s, u, 'z_vortice', { x: 5, y: 3 });
    expect(s.units[2]!.pos).toEqual({ x: 6, y: 3 });
    expect(s.units[1]!.hp).toBeLessThan(999);
  });
  it('Seducción roba 1 PA y 1 PM a un Encantado', () => {
    const s = board([hero('zorro', { x: 1, y: 3 }, ['z_seduccion']), foe({ x: 4, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    ok(s, u, 'z_encanto', e.pos);
    expect(e.statuses.charm).toBeTruthy();
    const ap = u.ap, mp = u.mp;
    ok(s, u, 'z_seduccion', e.pos);
    expect(u.ap).toBe(ap - 2 + 1);
    expect(u.mp).toBe(mp + 1);
    expect(e.apMod).toBe(-1);
  });
  it('Estallido de colas: cono que empuja y cura si alcanza a 2', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }, ['z_estallido']), foe({ x: 3, y: 3 }), foe({ x: 4, y: 4 })]);
    const u = me(s); u.hp = 20;
    ok(s, u, 'z_estallido', { x: 3, y: 3 });
    expect(u.hp).toBeGreaterThan(20);
    expect(s.units[1]!.pos.x).toBe(4);
  });
  it('Vínculo etéreo: aparece a su espalda y lo deja Vulnerable', () => {
    const s = board([hero('zorro', { x: 2, y: 3 }, ['z_vinculo']), foe({ x: 5, y: 3 })]);
    const u = me(s);
    ok(s, u, 'z_vinculo', { x: 5, y: 3 });
    expect(u.pos).toEqual({ x: 6, y: 3 });
    expect(s.units[1]!.statuses.vuln).toBeTruthy();
  });
  it('Danza de las nueve colas: tras Impulso, el siguiente hechizo cuesta 1 PA menos', () => {
    const s = board([hero('zorro', { x: 1, y: 3 }, [], ['danza']), foe({ x: 6, y: 3 })]);
    const u = me(s);
    ok(s, u, 'z_impulso', { x: 3, y: 3 });
    const ap = u.ap;
    ok(s, u, 'z_orbe', { x: 6, y: 3 });
    expect(u.ap).toBe(ap - 2);
  });
});

describe('Tejedora de Esferas', () => {
  const tej = (extra: string[], traits: string[] = []) => hero('esferas', { x: 2, y: 3 }, extra, traits);
  it('Descarga cuesta 4 PA y las esferas pegan más', () => {
    expect(SPELLS.t_descarga!.ap).toBe(4);
    expect(SPELLS.t_descarga!.consume!.per).toBeGreaterThanOrEqual(8);
  });
  it('Fuerza de voluntad: lanza la esfera, daña en cruz y quita 2 PM', () => {
    const s = board([tej(['t_voluntad']), foe({ x: 6, y: 3 }), foe({ x: 6, y: 4 })]);
    const u = me(s);
    expect(castProblem(s, u, SPELLS.t_voluntad!, { x: 6, y: 3 })).toMatch(/esfera/);
    addMark(s, { kind: 'sphere', pos: { x: 3, y: 5 }, team: 'hero', turns: 2, owner: u.id }, []);
    ok(s, u, 't_voluntad', { x: 6, y: 3 });
    expect(marksOf(s, 'sphere', u.id)[0]!.pos).toEqual({ x: 6, y: 3 });
    expect(s.units[2]!.hp).toBeLessThan(999);
    expect(s.units[1]!.statuses.slow).toBeTruthy();
  });
  it('Gravedad inversa atrae hacia la esfera; Resonancia daña sin consumir; Transfusión da 2 PA', () => {
    const s = board([tej(['t_gravedad', 't_resonancia', 't_transfusion']), foe({ x: 8, y: 3 })]);
    const u = me(s);
    addMark(s, { kind: 'sphere', pos: { x: 6, y: 3 }, team: 'hero', turns: 3, owner: u.id }, []);
    ok(s, u, 't_gravedad', { x: 6, y: 3 });
    expect(s.units[1]!.pos).toEqual({ x: 7, y: 3 });
    const hp = s.units[1]!.hp;
    ok(s, u, 't_resonancia', u.pos);
    expect(s.units[1]!.hp).toBeLessThan(hp);
    expect(marksOf(s, 'sphere', u.id)).toHaveLength(1);
    const ap = u.ap;
    ok(s, u, 't_transfusion', u.pos);
    expect(u.ap).toBe(ap - 1 + 2);
    expect(marksOf(s, 'sphere', u.id)).toHaveLength(0);
  });
  it('Singularidad 2×2 crea 2 esferas; Órbita consume una y da escudo', () => {
    const s = board([tej(['t_singularidad', 't_orbita']), foe({ x: 5, y: 3 }), foe({ x: 6, y: 4 })]);
    const u = me(s);
    ok(s, u, 't_singularidad', { x: 5, y: 3 });
    expect(s.units[2]!.hp).toBeLessThan(999);
    expect(marksOf(s, 'sphere', u.id)).toHaveLength(2);
    ok(s, u, 't_orbita', u.pos);
    expect(u.shield).toBeGreaterThanOrEqual(10);
    expect(u.statuses.orbita).toBeTruthy();
    expect(marksOf(s, 'sphere', u.id)).toHaveLength(1);
  });
  it('Poder ilimitado: hasta 5 esferas; Eco oscuro: Descarga que mata deja 2 esferas', () => {
    const s = board([tej([], ['poder', 'eco_oscuro']), foe({ x: 5, y: 3 }, 3)]);
    const u = me(s);
    for (let i = 0; i < 6; i++) { u.spells.forEach((sp) => delete sp.uses); ok(s, u, 't_pulso', [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 2, y: 6 }, { x: 2, y: 0 }][i]!); }
    expect(marksOf(s, 'sphere', u.id)).toHaveLength(5);
    ok(s, u, 't_descarga', { x: 5, y: 3 });
    expect(s.units[1]!.hp).toBe(0);
    expect(marksOf(s, 'sphere', u.id)).toHaveLength(2);
  });
});

describe('Carcelero de Almas', () => {
  const kc = (extra: string[], traits: string[] = []) => hero('carcelero', { x: 2, y: 3 }, extra, traits);
  it('cada muerte deja un alma en el suelo; Atracción las absorbe; Explosión gasta almas', () => {
    const s = board([kc(['k_atraccion', 'k_explosion']), foe({ x: 3, y: 3 }, 1), foe({ x: 2, y: 4 }, 1), foe({ x: 9, y: 1 })]);
    const u = me(s);
    ok(s, u, 'k_despellejar', u.pos);
    expect(marksOf(s, 'soul')).toHaveLength(2);
    expect(u.soulBank).toBe(2);
    ok(s, u, 'k_atraccion', u.pos);
    expect(marksOf(s, 'soul')).toHaveLength(0);
    expect(u.shield).toBeGreaterThanOrEqual(10);
    u.hp = 20;
    ok(s, u, 'k_explosion', u.pos);
    expect(u.soulBank).toBe(0);
    expect(u.hp).toBe(30);
    u.spells.find((x) => x.id === 'k_explosion')!.cd = 0;
    expect(castProblem(s, u, SPELLS.k_explosion!, u.pos)).toMatch(/almas/);
  });
  it('La caja: el enemigo que entra en sus muros sufre y se queda sin PM', () => {
    const s = board([kc(['k_caja']), foe({ x: 6, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    ok(s, u, 'k_caja', { x: 6, y: 3 });
    expect(marksOf(s, 'cage', u.id)).toHaveLength(8);
    endTurn(s, u.id);
    expect(current(s)!.id).toBe(e.id);
    e.mp = 3;
    const r = move(s, e.id, { x: 4, y: 3 });
    expect(r.ok).toBe(true);
    expect(e.pos).toEqual({ x: 5, y: 3 });
    expect(e.hp).toBeLessThan(999);
    expect(e.mp).toBe(0);
  });
  it('Cadenas vinculantes: si uno se mueve, el otro sufre y pierde 2 PM', () => {
    const s = board([kc(['k_vinculo']), foe({ x: 6, y: 3 }), foe({ x: 7, y: 4 })]);
    const u = me(s), [a, b] = [s.units[1]!, s.units[2]!];
    ok(s, u, 'k_vinculo', a.pos);
    expect(a.statuses.chained?.link).toBe(b.id);
    ok(s, u, 'k_sentencia', a.pos);
    expect(b.hp).toBeLessThan(999);
    expect(b.mpMod).toBe(-2);
    expect(b.statuses.chained).toBeUndefined();
  });
  it('Tormento reduce la Huida; Sacrificio del guardián desvía el 40% del daño', () => {
    const s = board([kc(['k_tormento', 'k_sacrificio']), foe({ x: 3, y: 3 }), hero('zorro', { x: 2, y: 5 })]);
    const u = me(s), e = s.units[1]!, z = s.units[2]!;
    ok(s, u, 'k_tormento', { x: 3, y: 3 });
    expect(e.statuses.hobble).toBeTruthy();
    ok(s, u, 'k_sacrificio', z.pos);
    expect(z.statuses.guarded?.from).toBe(u.id);
  });
  it('Guadaña segadora: tras Sentencia, el siguiente ataque suma por las almas del combate', () => {
    const s = board([kc([], ['guadana']), foe({ x: 5, y: 3 })]);
    const u = me(s);
    u.soulsFight = 5;
    ok(s, u, 'k_sentencia', { x: 5, y: 3 });
    expect(u.reaper).toBe(true);
  });
});

describe('Acechador de Sombras', () => {
  const ac = (extra: string[], traits: string[] = []) => hero('acechador', { x: 2, y: 3 }, extra, traits);
  it('Marca de la muerte: Sombra a su espalda; guarda el 35% y estalla', () => {
    const s = board([ac(['s_marca']), foe({ x: 4, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    ok(s, u, 's_marca', e.pos);
    expect(marksOf(s, 'shadow', u.id)[0]!.pos).toEqual({ x: 5, y: 3 });
    ok(s, u, 's_shuriken', e.pos);
    const stored = e.statuses.deathmark!.stacks;
    expect(stored).toBeGreaterThan(0);
    e.statuses.deathmark!.turns = 1;
    const hp = e.hp;
    endTurn(s, u.id);
    expect(e.hp).toBe(hp - stored);
  });
  it('Danza de cuchillas: tú y tus sombras, sangrado 2 turnos', () => {
    const s = board([ac(['s_danza'], ['maestro']), foe({ x: 3, y: 3 }), foe({ x: 6, y: 4 })]);
    const u = me(s);
    ok(s, u, 's_sombra', { x: 6, y: 3 });
    ok(s, u, 's_danza', u.pos);
    expect(s.units[1]!.statuses.bleed).toBeTruthy();
    expect(s.units[2]!.hp).toBeLessThan(999);
  });
  it('Paso sombrío a la espalda (+1 PM si está aislado); Velo deja una Sombra', () => {
    const s = board([ac(['s_paso', 's_velo']), foe({ x: 5, y: 3 })]);
    const u = me(s); const mp = u.mp;
    ok(s, u, 's_paso', { x: 5, y: 3 });
    expect(u.pos).toEqual({ x: 6, y: 3 });
    expect(u.mp).toBe(mp + 1);
    ok(s, u, 's_velo', u.pos);
    expect(u.statuses.invis).toBeTruthy();
    expect(marksOf(s, 'shadow', u.id)).toHaveLength(1);
  });
  it('Convergencia: flanqueando por lados opuestos, críticos; Cosecha oscura da 2 PA', () => {
    const s = board([ac(['s_convergencia', 's_cosecha']), foe({ x: 5, y: 3 })]);
    const u = me(s); u.pos = { x: 4, y: 3 };
    ok(s, u, 's_sombra', { x: 8, y: 3 });
    const ev = ok(s, u, 's_convergencia', { x: 5, y: 3 });
    expect(marksOf(s, 'shadow', u.id)[0]!.pos).toEqual({ x: 6, y: 3 });
    expect(ev.filter((e) => e.t === 'damage' && e.crit)).toHaveLength(2);
    expect(castProblem(s, u, SPELLS.s_cosecha!, u.pos)).toMatch(/Sombra/);
    ok(s, u, 's_shuriken', { x: 5, y: 3 });
    const ap = u.ap;
    ok(s, u, 's_cosecha', u.pos);
    expect(u.ap).toBe(ap - 1 + 2);
  });
  it('Maestro de las sombras: 2 a la vez; Sombra persistente: +1 turno y +2 PM al intercambiar', () => {
    const s = board([ac([], ['maestro', 'persistente']), foe({ x: 12, y: 7 })]);
    const u = me(s);
    ok(s, u, 's_sombra', { x: 4, y: 3 });
    u.spells.find((x) => x.id === 's_sombra')!.cd = 0;
    ok(s, u, 's_sombra', { x: 2, y: 5 });
    expect(marksOf(s, 'shadow', u.id)).toHaveLength(2);
    expect(marksOf(s, 'shadow', u.id)[0]!.turns).toBe(3);
    const mp = u.mp;
    ok(s, u, 's_cambio', u.pos);
    expect(u.mp).toBe(mp + 2);
  });
});

describe('Bárbaro Desatado', () => {
  const bb = (extra: string[] = [], traits: string[] = []) => hero('barbaro', { x: 2, y: 3 }, extra, traits);
  it('kit inicial y estadísticas de 60 / 6 / 3', () => {
    expect(CLASSES.barbaro.base).toEqual(['b_sed', 'b_tajo', 'b_embiste']);
    expect([CLASSES.barbaro.hp, CLASSES.barbaro.ap, CLASSES.barbaro.mp]).toEqual([60, 6, 3]);
    expect(PLAYABLE).toContain('barbaro');
  });
  it('Furia: +20 al golpear, +10 al recibir daño, pega más y se pierde si no pelea', () => {
    const s = board([bb(), foe({ x: 3, y: 3 })]);
    const u = me(s);
    expect(u.fury).toBe(0);
    ok(s, u, 'b_tajo', { x: 3, y: 3 });
    expect(u.fury).toBe(20);
    ok(s, u, 'b_tajo', { x: 3, y: 3 });
    expect(u.fury).toBe(40);
    endTurn(s, u.id);
    runAiTurn(s);
    expect(u.fury).toBeGreaterThanOrEqual(50);
    endTurn(s, u.id);
    for (let i = 0; i < 5 && current(s)!.id !== u.id; i++) endTurn(s, current(s)!.id);
    u.fury = 60; u.furyHot = false;
    endTurn(s, u.id);
    me(s);
    expect(u.fury).toBe(40);
  });
  it('Sed de batalla consume la Furia para curar (la mitad con Furia inagotable)', () => {
    const s = board([bb([], ['inagotable']), foe({ x: 9, y: 3 })]);
    const u = me(s);
    u.fury = 100; u.hp = 20;
    ok(s, u, 'b_sed', u.pos);
    expect(u.hp).toBe(20 + 2 + 12);
    expect(u.fury).toBe(50);
  });
  it('Embiste giratorio: atraviesa ignorando el placaje y daña al pasar y al aterrizar', () => {
    const s = board([bb([], ['torbellino']), foe({ x: 3, y: 3 }), foe({ x: 5, y: 4 })]);
    const u = me(s);
    const ap = u.ap;
    ok(s, u, 'b_embiste', { x: 5, y: 3 });
    expect(u.pos).toEqual({ x: 5, y: 3 });
    expect(s.units[1]!.hp).toBeLessThan(999);
    expect(s.units[2]!.hp).toBeLessThan(999);
    expect(u.fury).toBe(20);
    expect(u.ap).toBe(ap - 2 + 1);
    expect(castProblem(s, u, SPELLS.b_embiste!, { x: 6, y: 3 })).toMatch(/turno/);
  });
  it('Golpe colosal pide 50 de Furia, empuja y aturde si choca', () => {
    const s = board([bb(['b_colosal']), foe({ x: 3, y: 3 }), foe({ x: 5, y: 3 })]);
    const u = me(s), e = s.units[1]!;
    expect(castProblem(s, u, SPELLS.b_colosal!, e.pos)).toMatch(/Furia/);
    u.fury = 60;
    ok(s, u, 'b_colosal', e.pos);
    expect(e.pos).toEqual({ x: 4, y: 3 });
    expect(e.statuses.stun).toBeTruthy();
  });
  it('Grito, Pacto, Cuchillada, Mirada y Frenesí', () => {
    const s = board([bb(['b_grito', 'b_pacto', 'b_cuchillada', 'b_mirada', 'b_frenesi']), foe({ x: 3, y: 3 }), foe({ x: 3, y: 4 })]);
    const u = me(s);
    ok(s, u, 'b_grito', u.pos);
    expect(u.fury).toBe(30);
    expect(s.units[1]!.apMod).toBe(-2);
    const hp = u.hp, mp = u.mp;
    ok(s, u, 'b_pacto', u.pos);
    expect(u.hp).toBe(hp - Math.round(hp * 0.15));
    expect(u.fury).toBe(70);
    expect(u.mp).toBe(mp + 1);
    ok(s, u, 'b_cuchillada', u.pos);
    expect(u.fury).toBe(90);
    ok(s, u, 'b_mirada', { x: 3, y: 3 });
    expect(s.units[1]!.statuses.verdugo?.from).toBe(u.id);
    ok(s, u, 'b_frenesi', u.pos);
    expect(u.statuses.frenzy).toBeTruthy();
  });
  it('Negarse a morir: con 60 de Furia sobrevive con 1 de vida una vez', () => {
    const s = board([bb([], ['negarse']), { ...makeEnemy('esqueleto', { x: 3, y: 3 }), power: 900, initiative: 99 }]);
    const u = s.units[0]!;
    u.fury = 80; u.hp = 5;
    for (let i = 0; i < 3 && current(s)!.id !== u.id; i++) runAiTurn(s);
    expect(u.hp).toBe(1);
    expect(u.undying).toBe(true);
  });
});

describe('simulación corta', () => {
  it('la IA juega todas las clases nuevas con todos sus hechizos sin errores', () => {
    for (const c of NEW) {
      const all = patronsOf(c).flatMap((p) => p.spells);
      const s = board([
        { ...hero(c, { x: 2, y: 3 }, all.filter((id) => SPELLS[id]), all.map((id) => BLESSINGS[id]?.trait).filter((x): x is string => !!x)), ai: 'champ' },
        { ...hero('arquero', { x: 1, y: 5 }), ai: 'champ' },
        foe({ x: 8, y: 3 }, 80), foe({ x: 9, y: 5 }, 80), foe({ x: 10, y: 2 }, 80),
      ]);
      for (let i = 0; i < 400 && !s.over; i++) runAiTurn(s);
      expect(s.over, c).toBeTruthy();
    }
  });
  it('las bendiciones se aplican al héroe', () => {
    const run = newRun('T', 3, [{ owner: 'a', name: 'A', cls: 'esferas', routes: [] }]);
    const h = run.heroes[0]!;
    h.boons = ['tb_poder', 'tb_onda'];
    const u = heroSpec(h);
    expect(u.traits).toContain('poder');
    expect(u.spells.find((x) => x.id === 't_dispersion')!.ups).toContain('tb_onda');
    expect(PATRONS.t_tejido).toBeTruthy();
    expect(Object.keys(BOON_MODS).some((k) => BLESSINGS[k])).toBe(false);
  });
});
