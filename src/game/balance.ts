// Equilibrio del creador: cambia las estadísticas de las clases, los números de cada hechizo (de héroes y enemigos)
// y las estadísticas de cada enemigo, para todos los jugadores. Se aplica sobre los registros del juego (CLASSES,
// SPELLS, ENEMIES) en el sitio: todo lo que los lee (combate, IA, descripciones) usa los valores nuevos.
import { CLASSES } from '../core/classes/classes';
import { SPELLS } from '../core/classes/spells';
import { ENEMIES } from '../content/enemies';
import { ZONES } from '../content/zones';
import { ANIM_KEYS, ANIM_SPEED } from '../content/animSpeed';

export type Group = 'common' | 'elite' | 'boss';
export interface Balance {
  v: 1;
  t: number;
  /** clase → estadística → valor */
  classes: Record<string, Record<string, number>>;
  /** hechizo → ruta del campo («ap», «range.1», «dmg.0», «status.turns», «los», «text») → valor */
  spells: Record<string, Record<string, number | boolean | string>>;
  /** enemigo → campo («hp», «resist.fire», «tackle»…) → valor */
  enemies: Record<string, Record<string, number>>;
  /** ajuste por grupo de enemigos: vida en % y daño plano */
  groups: Partial<Record<Group, { hp?: number; power?: number }>>;
  /** duración de las animaciones: personaje (o «*», todos los enemigos) → animación → multiplicador */
  anim?: Record<string, Record<string, number>>;
}
export const emptyBalance = (): Balance => ({ v: 1, t: 0, classes: {}, spells: {}, enemies: {}, groups: {} });

/** Estadísticas que se pueden tocar de cada clase. */
export const CLASS_STATS: Array<[string, string]> = [['hp', 'Vida'], ['armor', 'Armadura'], ['power', 'Daño'], ['crit', '% Crítico'], ['ap', 'PA'], ['mp', 'PM'], ['initiative', 'Iniciativa'], ['tackle', 'Placaje'], ['dodge', 'Huida']];
/** De cada enemigo (las de placaje, huida, daño y crítico, si no se tocan, salen de su forma de luchar). */
export const ENEMY_STATS: Array<[string, string]> = [['hp', 'Vida'], ['armor', 'Armadura'], ['power', 'Daño'], ['crit', '% Crítico'], ['ap', 'PA'], ['mp', 'PM'], ['initiative', 'Iniciativa'], ['tackle', 'Placaje'], ['dodge', 'Huida'],
  ['resist.fire', 'Resist. fuego %'], ['resist.ice', 'Resist. hielo %'], ['resist.poison', 'Resist. veneno %'], ['resist.shadow', 'Resist. sombra %'], ['resist.holy', 'Resist. sagrado %']];
/** Interruptores de los hechizos. */
export const SPELL_FLAGS: Array<[string, string]> = [['los', 'Necesita línea de visión'], ['straight', 'Solo en línea recta'], ['pierce', 'Ignora la armadura'], ['line', 'Golpea a toda la línea'], ['dash', 'Salta junto al objetivo']];
/** Campos numéricos que se pueden añadir aunque el hechizo no los tenga. */
export const SPELL_EXTRA = ['ap', 'cd', 'perTurn', 'range.0', 'range.1', 'area', 'crit'];
export const SPELL_LABEL: Record<string, string> = {
  ap: 'PA', cd: 'Espera (turnos)', perTurn: 'Usos por turno', 'range.0': 'Alcance mínimo', 'range.1': 'Alcance máximo', area: 'Área (radio)', 'dmg.0': 'Daño mínimo', 'dmg.1': 'Daño máximo',
  heal: 'Curación', shield: 'Escudo', crit: '% Crítico extra', push: 'Empuje (casillas)', selfShield: 'Escudo propio', drainAp: 'Quita PA', drainMp: 'Quita PM', giveAp: 'Da PA', giveMp: 'Da PM',
  'status.turns': 'Estado: turnos', 'status.stacks': 'Estado: cargas', 'extraStatus.turns': '2.º estado: turnos', 'extraStatus.stacks': '2.º estado: cargas', 'buff.turns': 'Efecto propio: turnos', 'buff.stacks': 'Efecto propio: cargas',
  lifesteal: 'Robo de vida (fracción)', healPct: 'Cura (fracción de vida)', revive: 'Resucita con (fracción)', selfMp: 'PM para ti', selfDmg: 'Vida que pagas', selfDmgPct: '% de vida que pagas', retreat: 'Retroceso',
  bounce: 'Rebotes', cone: 'Cono (casillas)', ricochet: 'Rebote a (casillas)', armorIgnore: 'Ignora armadura', critMul: 'Multiplica el crítico', 'followUp.dmg.0': 'Remate: daño mín.', 'followUp.dmg.1': 'Remate: daño máx.', 'followUp.radius': 'Remate: radio',
  'sphere.turns': 'Esfera: turnos', 'sphere.max': 'Esferas máx.', 'consume.per': 'Daño por esfera', 'sphereHit.dmg.0': 'Choque de esfera: daño mín.', 'sphereHit.dmg.1': 'Choque de esfera: daño máx.', 'snare.dmg': 'Cepo: daño', 'bonusVs.dmg': 'Daño extra contra el estado',
  'summon.hpPct': 'Invocación: vida (fracción)', 'summon.armor': 'Invocación: armadura', 'summon.ap': 'Invocación: PA', 'summon.mp': 'Invocación: PM', 'summon.initiative': 'Invocación: iniciativa',
};
const FRACTION = new Set(['lifesteal', 'healPct', 'revive', 'summon.hpPct', 'critMul']);
export const stepOf = (path: string, orig: number): number => (FRACTION.has(path) || !Number.isInteger(orig) ? 0.05 : 1);

type AnyRec = Record<string, unknown>;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
let ORIG: { classes: AnyRec; spells: AnyRec; enemies: AnyRec } | null = null;
/** Valores originales del juego (antes de cualquier ajuste). */
export function originals(): { classes: AnyRec; spells: AnyRec; enemies: AnyRec } {
  return (ORIG ??= { classes: clone(CLASSES) as AnyRec, spells: clone(SPELLS) as AnyRec, enemies: clone(ENEMIES) as AnyRec });
}

export function getPath(o: unknown, path: string): unknown {
  let cur = o as AnyRec | undefined;
  for (const k of path.split('.')) { if (cur === null || typeof cur !== 'object') return undefined; cur = cur[k] as AnyRec | undefined; }
  return cur;
}
function setPath(o: AnyRec, path: string, v: unknown): void {
  const ks = path.split('.');
  let cur = o;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = ks[i]!;
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(ks[i + 1]!) ? [] : {};
    cur = cur[k] as AnyRec;
  }
  cur[ks.at(-1)!] = v;
}

/** Rutas de todos los números de un objeto (hechizos: también los que van dentro de estados, remates, invocaciones…). */
export function numericPaths(o: unknown, pre = ''): string[] {
  if (o === null || typeof o !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(o as AnyRec)) {
    const p = pre ? `${pre}.${k}` : k;
    if (typeof v === 'number') out.push(p);
    else if (v && typeof v === 'object') out.push(...numericPaths(v, p));
  }
  return out;
}
/** Campos numéricos editables de un hechizo: los suyos y los básicos aunque no los tenga. */
export function spellPaths(id: string): string[] {
  const o = originals().spells[id];
  return [...new Set([...SPELL_EXTRA, ...numericPaths(o)])];
}

/** El grupo de un enemigo: jefe, élite (de alguna zona) o común. */
export function groupOf(id: string): Group {
  if (ENEMIES[id]?.ai === 'boss') return 'boss';
  return ZONES.some((z) => z.elites.includes(id)) ? 'elite' : 'common';
}

const restore = (reg: AnyRec, orig: AnyRec): void => {
  for (const [id, o] of Object.entries(orig)) {
    const cur = reg[id] as AnyRec | undefined;
    if (!cur) continue;
    for (const k of Object.keys(cur)) delete cur[k];
    Object.assign(cur, clone(o));
  }
};
const num = (v: unknown, lo = -999, hi = 999): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 100) / 100)) : null; };

/** Deja un ajuste con forma correcta: solo ids y campos que existen, números acotados. */
export function cleanBalance(x: unknown): Balance {
  const b = emptyBalance(), r = (x ?? {}) as Partial<Balance>;
  b.t = Number(r.t) || 0;
  const o = originals();
  for (const [id, f] of Object.entries(r.classes ?? {})) if (o.classes[id] && f && typeof f === 'object') for (const [k, v] of Object.entries(f)) { const n = num(v, -50, 999); if (n !== null && CLASS_STATS.some(([s]) => s === k)) (b.classes[id] ??= {})[k] = n; }
  for (const [id, f] of Object.entries(r.enemies ?? {})) if (o.enemies[id] && f && typeof f === 'object') for (const [k, v] of Object.entries(f)) { const n = num(v, -100, 9999); if (n !== null && ENEMY_STATS.some(([s]) => s === k)) (b.enemies[id] ??= {})[k] = n; }
  for (const [id, f] of Object.entries(r.spells ?? {})) {
    if (!o.spells[id] || !f || typeof f !== 'object') continue;
    const ok = new Set(spellPaths(id));
    for (const [k, v] of Object.entries(f)) {
      if (k === 'text' && typeof v === 'string') (b.spells[id] ??= {}).text = v.slice(0, 600);
      else if (SPELL_FLAGS.some(([s]) => s === k) && typeof v === 'boolean') (b.spells[id] ??= {})[k] = v;
      else if (ok.has(k)) { const n = num(v, -99, 999); if (n !== null) (b.spells[id] ??= {})[k] = n; }
    }
  }
  for (const g of ['common', 'elite', 'boss'] as Group[]) { const v = r.groups?.[g]; if (!v) continue; const hp = num(v.hp, -90, 500), power = num(v.power, -20, 50); if (hp || power) b.groups[g] = { ...(hp ? { hp } : {}), ...(power ? { power } : {}) }; }
  for (const [id, f] of Object.entries(r.anim ?? {})) {
    if ((id !== '*' && !o.enemies[id] && !o.classes[id]) || !f || typeof f !== 'object') continue;
    for (const [k, v] of Object.entries(f)) { const n = num(v, 0.25, 6); if (n !== null && n !== 1 && (ANIM_KEYS as readonly string[]).includes(k)) ((b.anim ??= {})[id] ??= {})[k] = n; }
  }
  return b;
}

/** Aplica un ajuste: primero todo vuelve a los valores originales y luego se cambian los campos ajustados. */
export function applyBalance(x: Balance | null): void {
  const o = originals();
  restore(CLASSES as unknown as AnyRec, o.classes);
  restore(SPELLS as unknown as AnyRec, o.spells);
  restore(ENEMIES as unknown as AnyRec, o.enemies);
  for (const k of Object.keys(ANIM_SPEED)) delete ANIM_SPEED[k];
  if (!x) return;
  for (const [id, f] of Object.entries(x.anim ?? {})) ANIM_SPEED[id] = { ...f };
  for (const [id, f] of Object.entries(x.classes)) for (const [k, v] of Object.entries(f)) setPath((CLASSES as unknown as AnyRec)[id] as AnyRec, k, v);
  for (const [id, f] of Object.entries(x.spells)) {
    const sp = (SPELLS as unknown as AnyRec)[id] as AnyRec;
    for (const [k, v] of Object.entries(f)) {
      setPath(sp, k, v);
      // un rango o daño a medias (añadido) se completa con el otro extremo
      if (k === 'range.1' && sp.range && (sp.range as number[])[0] === undefined) (sp.range as number[])[0] = 1;
      if (k === 'range.0' && sp.range && (sp.range as number[])[1] === undefined) (sp.range as number[])[1] = v as number;
    }
    const r = sp.range as number[] | undefined;
    if (r && r[0]! > r[1]!) r[1] = r[0]!;
    const d = sp.dmg as number[] | undefined;
    if (d && d[0]! > d[1]!) d[1] = d[0]!;
  }
  for (const [id, f] of Object.entries(x.enemies)) for (const [k, v] of Object.entries(f)) setPath((ENEMIES as unknown as AnyRec)[id] as AnyRec, k, v);
  // ajustes por grupo, encima de los individuales
  for (const id of Object.keys(ENEMIES)) {
    const g = x.groups[groupOf(id)];
    if (!g) continue;
    const e = ENEMIES[id]!;
    if (g.hp) e.hp = Math.max(1, Math.round(e.hp * (1 + g.hp / 100)));
    if (g.power) e.power = (e.power ?? 0) + g.power;
  }
}

/** Número de valores cambiados en un ajuste. */
export const balanceSize = (b: Balance): number => [b.classes, b.spells, b.enemies, b.anim ?? {}].reduce((n, r) => n + Object.values(r).reduce((m, f) => m + Object.keys(f).length, 0), 0) + Object.keys(b.groups).length;
