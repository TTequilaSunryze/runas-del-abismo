// Iconos de hechizo en pixel art (12×12). Cada hechizo tiene su dibujo y la paleta de su elemento o ruta.
// Letras: a = color principal, b = claro, c = oscuro, w = brillo. '.' = transparente.
import type { SpellDef } from '../core/classes/spells';

export const GLYPHS: Record<string, string[]> = {
  sword: ['..........ww', '.........wbw', '........wbw.', '.......wbw..', '......wbw...', '.....wbw....', '..c.wbw.....', '..ccbw......', '...cc.......', '..aa.cc.....', '.aa.........', '............'],
  axe: ['....cc......', '...cbbc.....', '..cbbbbc....', '..cbbbbcc...', '...cbbcac...', '....cc.ac...', '.......a....', '......a.....', '.....a......', '....a.......', '...a........', '............'],
  shield: ['............', '..cccccccc..', '..cbbbbbbc..', '..cbbaabbc..', '..cbaaaabc..', '..cbbaabbc..', '..cbbaabbc..', '...cbbbbc...', '...cbbbbc...', '....cbbc....', '.....cc.....', '............'],
  hexshield: ['....aaaa....', '..aabbbbaa..', '.abbwbbbbba.', '.abwbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....'],
  bash: ['............', '.cccc.......', '.cbbc..w....', '.cbac...w...', '.cbac....w..', '.cbac.wwwwww', '.cbac....w..', '.cbac...w...', '.cbbc..w....', '.cccc.......', '............', '............'],
  heart: ['............', '..aa....aa..', '.abba..abba.', '.abbbaabbba.', '.abwbbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....', '............', '............'],
  flame: ['.....a......', '.....aa.....', '....aba.....', '....abba.a..', '...abbba.aa.', '..abbwbbaba.', '..abwwwbbba.', '..abwwwwbba.', '..abbwwbbba.', '...abbbbba..', '....aaaaa...', '............'],
  fireball: ['............', '.........aa.', '.......aaba.', '.....aabba..', '...abbbba...', '..abwwbba...', '.abwwwwba...', '.abwwwwba...', '.abbwwbba...', '..abbbba....', '...aaaa.....', '............'],
  rain: ['a...a...a...', '.a...a...a..', '..b...b...b.', '..w...w...w.', '............', '.a...a...a..', '..a...a...a.', '...b...b...b', '...w...w...w', '............', 'cccccccccccc', '............'],
  snowflake: ['.....w......', '...w.w.w....', '....www.....', '.w..bwb..w..', '..w.bwb.w...', 'wwwwwawwwww.', '..w.bwb.w...', '.w..bwb..w..', '....www.....', '...w.w.w....', '.....w......', '............'],
  iceblock: ['............', '.cccccccccc.', '.cbbbbbbbbc.', '.cbwwbbbbbc.', '.cbwbbbbbbc.', '.cbbbbaabbc.', '.cbbbbaabbc.', '.cbbbbbbbbc.', '.cbbbbbbwbc.', '.cbbbbbbbbc.', '.cccccccccc.', '............'],
  blizzard: ['w.....w.....', '...cccc...w.', '..c....c....', '.c..bb..c...', '.c.b..b.c..w', '.c.b.ab.c...', '.c..b...c...', '..c....c..w.', 'w..cccc.....', '.......w....', '..w.........', '............'],
  bolt: ['.......aaa..', '......aba...', '.....aba....', '....abba....', '...abbbaaa..', '..aaaabba...', '.....aba....', '....aba.....', '....ab......', '...ab.......', '...a........', '............'],
  wind: ['............', '.bbbbbbb....', '........b...', '.......b....', '..bbbbb.....', '............', '.wwwwwwwwww.', '...........w', '..........w.', '..wwwwwwww..', '............', '............'],
  storm: ['............', '....cccc....', '..ccbbbbcc..', '.cbbbbbbbbc.', '.cbbbbbbbbc.', '..cccccccc..', '.....ww.....', '....ww......', '.....ww.....', '....ww......', '...w........', '............'],
  dome: ['............', '....aaaa....', '..aabbbbaa..', '.abb....bba.', '.ab......ba.', 'ab........ba', 'ab...ww...ba', 'ab..wwww..ba', 'cccccccccccc', '............', '............', '............'],
  hourglass: ['.cccccccccc.', '..abbbbbba..', '...abbbba...', '....abba....', '.....ww.....', '.....ww.....', '....a..a....', '...a.ww.a...', '..a.wwww.a..', '..awwwwwwa..', '.cccccccccc.', '............'],
  horn: ['............', '..........a.', '.........aba', '.......aabba', '.....aabbbba', 'c..aabbbbbba', 'cccbbbbbbba.', 'c..aabbbbba.', '.....aaaaa..', '............', '............', '............'],
  boot: ['............', '...cccc.....', '...cbbc.....', '...cbbc.....', '...cbbc.....', '...cbbc.....', '...cbbcccc..', '...cbbbbbbc.', '...cbbbbbbbc', '...cccccccc.', '.w..w..w....', '............'],
  broken: ['..........ww', '.........wbw', '........wbw.', '.......wbw..', '............', '.....w......', '..c...w.....', '..cc.w......', '...cc.......', '..aa.cc.....', '.aa.........', '............'],
  skull: ['............', '...wwwwww...', '..wwwwwwww..', '.wwwwwwwwww.', '.wccwwwwccw.', '.wccwwwwccw.', '.wwwwccwwww.', '..wwwwwwww..', '...w.ww.w...', '...wwwwww...', '....w..w....', '............'],
  whirl: ['............', '...aaaaa....', '..a.....a...', '.a..bbb..a..', '.a.b...b.a..', '.a.b.w.b.a..', '.a.b..b..a..', '.a..bb...a..', '..a.....a...', '...aaaaaw...', '............', '............'],
  drop: ['.....a......', '.....a......', '....aba.....', '....aba.....', '...abbba....', '..abbbbba...', '..abwbbba...', '..abwbbba...', '..abbbbba...', '...abbba....', '....aaa.....', '............'],
  mace: ['.......aaa..', '......abbba.', '......abwba.', '......abbba.', '.......aaa..', '......c.....', '.....c......', '....c.......', '...c........', '..c.........', '.c..........', '............'],
  cross: ['.....aa.....', '.....ab.....', '.....ab.....', '..aaaabaaa..', '..abbbbbbb..', '.....ab.....', '.....ab.....', '.....ab.....', '.....ab.....', '.....ab.....', '.....aa.....', '............'],
  sun: ['.....a......', '..a..a..a...', '...a...a....', '....bbb.....', 'aa.bwwwb.aa.', '...bwwwb....', '....bbb.....', '...a...a....', '..a..a..a...', '.....a......', '............', '............'],
  whip: ['cc..........', '.cc.........', '..ca........', '...a........', '....a.......', '.....aa.....', '.......a....', '........a...', '.........a..', '........a...', '.......b....', '............'],
  chalice: ['............', '.aaaaaaaaaa.', '.abbbbbbbba.', '.abwwbbbbba.', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....', '.....aa.....', '....aaaa....', '...aaaaaa...', '............'],
  circle: ['............', '...aaaaaa...', '..a......a..', '.a...ww...a.', '.a...ww...a.', '.a.wwwwww.a.', '.a.wwwwww.a.', '.a...ww...a.', '..a..ww..a..', '...aaaaaa...', '............', '............'],
  eye: ['............', '............', '...aaaaaa...', '..a......a..', '.a..bbbb..a.', 'a..bbccbb..a', 'a..bbccbb..a', '.a..bbbb..a.', '..a......a..', '...aaaaaa...', '............', '............'],
  gavel: ['............', '..cccc......', '.cbbbbc.....', '.cbbbbc.....', '..cccc.a....', '.......a....', '........a...', '.........a..', '..........a.', '............', '.aaaaaaa....', '............'],
  hammer: ['............', '.cccccc.....', '.cbbbbc.....', '.cbbbbccc...', '.cbbbbc.....', '.cccccc.....', '....a.......', '....a.......', '....a.......', '....a.......', '....a.......', '............'],
  dagger: ['............', '..........w.', '.........wb.', '........wb..', '.......wb...', '......wb....', '....cwb.....', '.....c......', '....a.c.....', '...a........', '............', '............'],
  twin: ['............', '.w........w.', '.bw......wb.', '..bw....wb..', '...bw..wb...', '....bwwb....', '....cbbc....', '...c....c...', '..a......a..', '.a........a.', '............', '............'],
  cloud: ['............', '....aaa.....', '..aabbbaa...', '.abbbbbbba..', 'abbbwbbbbba.', 'abbbbbbbbba.', '.aaaaaaaaa..', '..b..b..b...', '.b..b..b....', '............', '............', '............'],
  vial: ['....cccc....', '.....ww.....', '.....ww.....', '....awwa....', '...abbbba...', '..abbbbbba..', '..abwbbbba..', '..abbbbbba..', '..abbbbbba..', '...aaaaaa...', '............', '............'],
  dust: ['............', '.w..b...w...', '...w..b.....', '.b...w...b..', '...b...w....', '.w...b...w..', 'cc..w...b...', 'ccc...b.....', 'ccccc...w...', 'cccccc......', '............', '............'],
  fist: ['............', '............', '...aaaaa....', '..abbbbba...', '..abababa...', '..abbbbba...', '..abbbbbaa..', '..abbbbbba..', '...abbbba...', '....aaaa....', '....cccc....', '............'],
  arrow: ['............', '............', '............', 'a.........w.', '.a.......wbw', 'aaccccccccbw', '.a.......wbw', 'a.........w.', '............', '............', '............', '............'],
  crosshair: ['.....a......', '...aaaaa....', '..a..a..a...', '.a...a...a..', '.a...a...a..', 'aaaaabaaaaa.', '.a...a...a..', '.a...a...a..', '..a..a..a...', '...aaaaa....', '.....a......', '............'],
  pierce: ['............', '..w.....w...', '..w.....w...', '..w.....w...', 'aacccccccbw.', '..w.....w.bw', 'aacccccccbw.', '..w.....w...', '..w.....w...', '..w.....w...', '............', '............'],
  multi: ['............', 'a.......w...', '.acccccwbw..', 'a.......w...', '............', 'a.......w...', '.acccccwbw..', 'a.......w...', '............', 'a.......w...', '.acccccwbw..', 'a.......w...'],
  arrowrain: ['.w...w...w..', '.b...b...b..', '.c...c...c..', '.c...c...c..', '.c...c...c..', '.c...c...c..', '.c...c...c..', 'aaa.aaa.aaa.', '............', '............', 'cccccccccccc', '............'],
  leap: ['............', '....aaaa....', '..aa....a...', '.a.......a..', '.a........w.', 'a........wbw', 'a.........w.', 'a...........', '.a..........', 'cc..........', 'cc..........', '............'],
  trap: ['............', '............', '.c.c.c.c.c..', '.cacacacaca.', '.caaaaaaaac.', '.c........c.', '.caaaaaaaac.', '.cacacacaca.', '.c.c.c.c.c..', '.....b......', '.....b......', '...bbbbb....'],
  net: ['a..a..a..a..', '.ab.ab.ab.a.', '.ba.ba.ba.b.', 'a..a..a..a..', '.ab.ab.ab.a.', '.ba.ba.ba.b.', 'a..a..a..a..', '.ab.ab.ab.a.', '.ba.ba.ba.b.', 'a..a..a..a..', '............', '............'],
  wolf: ['............', '.a........a.', '.aa......aa.', '.aba....aba.', '.abbaaaabba.', '.abbbbbbbba.', '.abwbbbbwba.', '.abbbbbbbba.', '..abbccbba..', '...abbbba...', '....aaaa....', '............'],
  paw: ['............', '..aa....aa..', '..ab....ab..', '............', 'aa..aaaa..aa', 'ab.abbbba.ab', '..abbbbbba..', '..abbbbbba..', '...abbbba...', '....aaaa....', '............', '............'],
  link: ['............', '.aaa........', 'a...a.......', 'a..bbb......', 'a.b.a.b.....', '.abaa..b....', '..b..aa.b...', '...b.a..b...', '....bbb.a...', '.......a....', '....aaa.....', '............'],
  dart: ['............', '............', '.........ww.', '.......wwbw.', '.....aabbw..', '...aabbba...', '..abbbba....', '.abbba......', '.aba........', '.a..........', '............', '............'],
  banner: ['.c..........', '.caaaaaaa...', '.cabbbbbba..', '.cabwbbbba..', '.cabbbbbba..', '.caaaaaaaa..', '.c..........', '.c..........', '.c..........', '.c..........', '.c..........', 'cc..........'],
  dash: ['............', '............', 'aa......w...', '.......wbw..', 'aaaa..wbw...', '.....wbw....', 'aa..wbw.....', '...cbw......', '....c.......', '...a.c......', '............', '............'],
};

const PAL: Record<string, Record<string, string>> = {
  fire: { a: '#ff6a20', b: '#ffb040', c: '#8a2a10', w: '#fff2a0' },
  ice: { a: '#58a6ff', b: '#a8dcff', c: '#2a4a8a', w: '#ffffff' },
  poison: { a: '#3fa040', b: '#8ae060', c: '#1f4a1f', w: '#e0ffb0' },
  holy: { a: '#e8b83a', b: '#ffe08a', c: '#8a6a1a', w: '#ffffff' },
  shadow: { a: '#7a3fc0', b: '#c77dff', c: '#3a1a5a', w: '#f0d8ff' },
  steel: { a: '#8a6a2c', b: '#c8cfe0', c: '#5a4520', w: '#ffffff' },
  blood: { a: '#a02030', b: '#e04050', c: '#50101a', w: '#ffc0c0' },
  storm: { a: '#e8d040', b: '#fff08a', c: '#4a4a70', w: '#ffffff' },
  arcane: { a: '#4a5ac8', b: '#9aa8ff', c: '#2a2a6a', w: '#ffffff' },
  nature: { a: '#8a5a2c', b: '#b0d878', c: '#3a2a18', w: '#ffffff' },
  gold: { a: '#c8901a', b: '#ffd76a', c: '#6a4a10', w: '#ffffff' },
};

/** Dibujo y paleta de cada hechizo de héroe. */
const LOOK: Record<string, [string, string]> = {
  tajo: ['sword', 'steel'], muro: ['shield', 'steel'], proteger: ['hexshield', 'arcane'], embate: ['bash', 'steel'],
  frenesi: ['axe', 'blood'], sed: ['drop', 'blood'], torbellino: ['whirl', 'blood'],
  arenga: ['horn', 'gold'], avanzad: ['boot', 'gold'], grito: ['banner', 'gold'],
  estocada: ['dash', 'steel'], desarmar: ['broken', 'steel'], ejecucion: ['skull', 'blood'],
  dardo: ['dart', 'arcane'], bola: ['fireball', 'fire'], ignicion: ['flame', 'fire'], lluvia: ['rain', 'fire'],
  escarcha: ['snowflake', 'ice'], congelar: ['iceblock', 'ice'], ventisca: ['blizzard', 'ice'],
  rayo: ['bolt', 'storm'], vendaval: ['wind', 'storm'], tempestad: ['storm', 'storm'],
  barrera: ['hexshield', 'arcane'], impulso: ['hourglass', 'arcane'], cupula: ['dome', 'arcane'],
  maza: ['mace', 'steel'], sanar: ['heart', 'poison'], aura: ['sun', 'holy'], plegaria: ['cross', 'holy'],
  flagelo: ['whip', 'blood'], expiar: ['chalice', 'blood'], martirio: ['drop', 'holy'],
  consagrar: ['circle', 'holy'], custodia: ['hexshield', 'holy'], bastion: ['shield', 'holy'],
  marca: ['eye', 'holy'], sentencia: ['gavel', 'holy'], veredicto: ['hammer', 'holy'],
  punalada: ['dagger', 'steel'], daga_ven: ['dagger', 'poison'], nube: ['cloud', 'poison'], toxina: ['vial', 'poison'],
  apunalar: ['twin', 'blood'], emboscada: ['dash', 'shadow'], golpe_mortal: ['skull', 'shadow'],
  cegar: ['dust', 'shadow'], punto_debil: ['eye', 'shadow'], golpe_bajo: ['fist', 'shadow'],
  voltereta: ['leap', 'storm'], evasion: ['hexshield', 'shadow'], senal: ['banner', 'storm'],
  flecha: ['arrow', 'nature'], certero: ['crosshair', 'blood'], marca_caza: ['eye', 'fire'], perforante: ['pierce', 'steel'],
  rapido: ['multi', 'nature'], andanada: ['arrowrain', 'nature'], salto_atras: ['leap', 'nature'],
  cepo: ['trap', 'steel'], flecha_hielo: ['arrow', 'ice'], red: ['net', 'nature'],
  lobo: ['wolf', 'nature'], orden: ['paw', 'gold'], vinculo: ['link', 'poison'],
  hachazo: ['axe', 'steel'], sed_sangre: ['heart', 'blood'], chispa: ['dart', 'fire'], escudo_arcano: ['hexshield', 'storm'],
  castigo: ['bolt', 'holy'], fervor: ['sun', 'blood'], tiro_rasante: ['arrow', 'steel'], ojo_halcon: ['eye', 'nature'],
  cuchillo: ['dagger', 'storm'], desvanecer: ['cloud', 'shadow'],
  c_vida: ['vial', 'blood'], c_resu: ['chalice', 'holy'], c_fuego: ['fireball', 'fire'], c_humo: ['cloud', 'steel'],
  g_remolino: ['whirl', 'steel'], g_carniceria: ['axe', 'blood'], g_muralla: ['dome', 'steel'], g_carga: ['dash', 'gold'], g_estandarte: ['banner', 'gold'],
  m_meteoro: ['rain', 'fire'], m_glaciar: ['iceblock', 'ice'], m_rayo_cadena: ['storm', 'storm'], m_parpadeo: ['leap', 'arcane'],
  c_milagro: ['heart', 'holy'], c_martillo: ['hammer', 'gold'], c_santuario: ['dome', 'holy'], c_sacrificio: ['chalice', 'blood'],
  a_letal: ['crosshair', 'steel'], a_abanico: ['multi', 'fire'], a_campo: ['trap', 'poison'], a_halcon: ['paw', 'nature'],
  p_frasco: ['vial', 'poison'], p_degollar: ['skull', 'blood'], p_debilidad: ['eye', 'shadow'], p_danza: ['twin', 'storm'],
};

const EL_PAL: Record<string, string> = { fire: 'fire', ice: 'ice', poison: 'poison', holy: 'holy', shadow: 'shadow' };

/** Dibujo y paleta de un hechizo (los que no tienen uno propio, uno según lo que hacen). */
export function spellLook(d: SpellDef): [string, string] {
  const own = LOOK[d.id];
  if (own) return own;
  const pal = EL_PAL[d.element ?? ''] ?? 'steel';
  if (d.heal) return ['heart', 'poison'];
  if (d.shield) return ['shield', pal];
  if (d.giveAp || d.giveMp) return ['horn', 'gold'];
  if (d.status?.kind === 'stun') return ['fist', pal];
  if (d.area) return ['whirl', pal];
  return [d.range[1] > 1 ? 'arrow' : 'sword', pal];
}

const cache = new Map<string, string>();
export function spellIconUrl(d: SpellDef): string {
  const [g, p] = spellLook(d);
  const k = `${g}:${p}`;
  let url = cache.get(k);
  if (url) return url;
  const c = document.createElement('canvas');
  c.width = c.height = 12;
  const ctx = c.getContext('2d')!;
  const pal = PAL[p] ?? PAL.steel!;
  GLYPHS[g]!.forEach((row, y) => {
    for (let x = 0; x < 12; x++) {
      const col = pal[row[x]!];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  });
  url = c.toDataURL();
  cache.set(k, url);
  return url;
}

export const spellGlyphErrors = (): string[] =>
  Object.entries(GLYPHS).flatMap(([k, rows]) => (rows.length !== 12 ? [`${k}: ${rows.length} filas`] : rows.filter((r) => r.length !== 12).map((r) => `${k}: "${r}" mide ${r.length}`)))
    .concat(Object.entries(LOOK).filter(([, [g, p]]) => !GLYPHS[g] || !PAL[p]).map(([id]) => `${id}: dibujo o paleta desconocidos`));

// ---------- qué hace un hechizo, en una línea ----------
export type SpellKind = 'dmg' | 'heal' | 'shield' | 'ctrl' | 'buff' | 'summon';
export const KIND_NAME: Record<SpellKind, string> = { dmg: 'Daño', heal: 'Curación', shield: 'Escudo', ctrl: 'Control', buff: 'Apoyo', summon: 'Invocación' };

export function spellKind(d: SpellDef): SpellKind {
  if (d.summon || d.snare) return 'summon';
  if (d.heal) return 'heal';
  if (d.giveAp || d.giveMp) return 'buff';
  if (d.shield && !d.dmg) return 'shield';
  if (!d.dmg || (d.dmg[1] <= 5 && (d.status || d.drainAp))) return 'ctrl';
  return 'dmg';
}

const ST: Record<string, string> = { burn: 'quema', poison: 'envenena', slow: 'ralentiza', stun: 'aturde', mark: 'marca' };
const EL: Record<string, string> = { fire: 'de fuego', ice: 'de hielo', poison: 'de veneno', holy: 'sagrado', shadow: 'de sombra' };

/** Forma: dónde actúa. */
export function spellShape(d: SpellDef): string {
  if (d.target === 'cell') return d.summon ? 'en casilla libre' : 'trampa en casilla';
  if (d.line) return 'en línea';
  if (d.range[1] === 0) return d.area ? `a tu alrededor (radio ${d.area})` : 'sobre ti';
  return d.area ? `área ${d.area}` : 'un objetivo';
}

/** Resumen generado desde los datos: siempre coincide con lo que hace el hechizo de verdad. */
export function spellSummary(d: SpellDef): string {
  const parts: string[] = [];
  if (d.dash) parts.push('Salta junto al objetivo');
  if (d.dmg) parts.push(`${d.dash ? 'y daña' : 'Daña'} ${d.dmg[0]}-${d.dmg[1]}${d.element ? ` ${EL[d.element]}` : ''}`);
  if (d.heal) parts.push(`Cura ${d.heal}`);
  if (d.shield) parts.push(`${parts.length ? 'escudo' : 'Da escudo'} ${d.shield}`);
  for (const st of [d.status, d.extraStatus]) if (st) parts.push(`${ST[st.kind]}${st.stacks && st.stacks > 1 ? ` x${st.stacks}` : ''} ${st.turns} t.`);
  if (d.drainAp) parts.push(`quita ${d.drainAp} PA`);
  if (d.giveAp) parts.push(`da ${d.giveAp} PA`);
  if (d.giveMp) parts.push(`da ${d.giveMp} PM`);
  if (d.push) parts.push(`empuja ${d.push}`);
  if (d.pierce) parts.push('ignora armadura');
  if (d.retreat) parts.push(`retrocedes ${d.retreat}`);
  if (d.lifesteal) parts.push(`te cura el ${Math.round(d.lifesteal * 100)}%`);
  if (d.selfShield) parts.push(`ganas escudo ${d.selfShield}`);
  if (d.selfDmg) parts.push(`te cuesta ${d.selfDmg} PV`);
  if (d.crit) parts.push(`+${d.crit}% crítico`);
  if (d.snare) parts.push(`Cepo oculto: ${d.snare.dmg} de daño y detiene`);
  if (d.summon) parts.push(`Invoca: ${d.summon.name}`);
  const s = parts.join(', ');
  return (s.charAt(0).toUpperCase() + s.slice(1)) + ` (${spellShape(d)}).`;
}

export function rangeText(d: SpellDef): string {
  return d.range[1] === 0 ? 'sin alcance' : `alcance ${d.range[0] === d.range[1] ? d.range[1] : `${d.range[0]}-${d.range[1]}`}`;
}
