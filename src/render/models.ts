// Modelos animados de 32×32 para las clases nuevas (Hechicera Zorro, Tejedora de Esferas,
// Carcelero de Almas y Acechador de Sombras). Las clases antiguas siguen usando sus sprites de 16×16.
//
// Cada fotograma se pinta por código en una cuadrícula de colores (sin DOM, así se puede probar)
// y después se le pone un contorno oscuro automático, como en el resto del pixel art del juego.
// Los colores que empiezan por '~' son brillos: no generan contorno.

export type Anim = 'idle' | 'walk' | 'attack' | 'cast' | 'special' | 'death';
export type Grid = (string | null)[][];

export const MODEL_SIZE = 32;
export const MODEL_CLASSES = ['zorro', 'esferas', 'carcelero', 'acechador', 'barbaro', 'arquitecto', 'pistolero'];
export const ANIM_FRAMES: Record<Anim, number> = { idle: 4, walk: 4, attack: 4, cast: 4, special: 4, death: 5 };

/** Qué animación usa cada hechizo (por defecto: ataque si daña, lanzamiento si no). */
const SPELL_ANIM: Record<string, Anim> = {
  z_orbe: 'attack', z_encanto: 'special', z_impulso: 'cast', z_drenaje: 'attack', z_velo: 'cast',
  t_pulso: 'cast', t_dispersion: 'special', t_descarga: 'attack', t_semilla: 'cast', t_implosion: 'special',
  k_sentencia: 'attack', k_viaje: 'walk', k_linterna: 'cast', k_despellejar: 'attack', k_guadana: 'attack', k_cosecha: 'cast',
  s_shuriken: 'cast', s_tajo: 'attack', s_sombra: 'special', s_cambio: 'special', s_marca: 'cast', s_ocaso: 'special',
  z_fuego: 'special', z_espejismo: 'cast', z_vortice: 'cast', z_seduccion: 'special', z_estallido: 'attack', z_vinculo: 'cast',
  t_voluntad: 'attack', t_gravedad: 'special', t_orbita: 'cast', t_resonancia: 'special', t_singularidad: 'special', t_transfusion: 'cast',
  k_caja: 'cast', k_explosion: 'attack', k_vinculo: 'attack', k_atraccion: 'cast', k_tormento: 'attack', k_siega: 'attack', k_sacrificio: 'cast',
  s_danza: 'attack', s_paso: 'special', s_velo: 'special', s_convergencia: 'attack', s_cosecha: 'cast',
  r_glifo: 'cast', r_barrera: 'cast', r_lanza: 'attack', r_gravedad: 'special', r_baluarte: 'cast', r_pulsar: 'special', r_cercado: 'cast', r_inercia: 'special',
  r_arquitectonico: 'attack', r_sello: 'cast', r_sobrecarga: 'special', r_matriz: 'special', r_ciudadela: 'special',
  g_disparo: 'attack', g_rebote: 'attack', g_recarga: 'special', g_abanico: 'attack', g_trazadora: 'attack', g_rodilla: 'attack', g_danza: 'special',
  g_mina: 'cast', g_certero: 'attack', g_humo: 'cast', g_plata: 'cast', g_gancho: 'attack', g_tambor: 'attack',
  // H1: habilidades del catálogo que no tenían gesto propio
  z_colas: 'attack', z_maldicion: 'cast', t_pozo: 'special', t_vacio: 'attack', t_eclipse: 'cast',
  s_kunai: 'special', s_hoja: 'attack', s_ejecucion: 'attack', k_grilletes: 'attack', k_condena: 'cast', k_azote: 'attack', k_alma: 'attack',
  flecha: 'attack', tiro_rasante: 'attack', ojo_halcon: 'cast', a_letal: 'attack', a_abanico: 'attack', a_ignea: 'attack', a_campo: 'cast',
  a_conmocion: 'attack', a_halcon: 'cast', perforante: 'attack', salto_atras: 'special', flecha_hielo: 'attack', red: 'cast', orden: 'cast',
  b_salto: 'attack', b_piel: 'special', b_arenga: 'special', b_decapitar: 'attack', b_agarre: 'attack', s_garrote: 'attack', s_bruma: 'cast', z_resguardo: 'cast', r_runa: 'cast', g_bengala: 'attack',
  b_sed: 'special', b_tajo: 'attack', b_embiste: 'attack', b_grito: 'special', b_colosal: 'attack', b_pacto: 'special', b_cuchillada: 'attack', b_mirada: 'cast', b_frenesi: 'special',
};

export function animFor(spell: string, dealsDamage: boolean): Anim {
  return SPELL_ANIM[spell] ?? (dealsDamage ? 'attack' : 'cast');
}

// ---------------------------------------------------------------------------
// Pincel sobre la cuadrícula
// ---------------------------------------------------------------------------

class Pen {
  g: Grid = Array.from({ length: MODEL_SIZE }, () => Array<string | null>(MODEL_SIZE).fill(null));
  px(x: number, y: number, c: string): void {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < MODEL_SIZE && y < MODEL_SIZE) this.g[y]![x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  disc(cx: number, cy: number, r: number, c: string): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6) this.px(x, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  /** Trapecio vertical: de ancho w0 arriba a w1 abajo, centrado en cx. */
  trap(cx: number, y0: number, y1: number, w0: number, w1: number, c: string): void {
    for (let y = y0; y <= y1; y++) {
      const w = w0 + ((w1 - w0) * (y - y0)) / Math.max(1, y1 - y0);
      this.rect(Math.round(cx - w / 2), y, Math.round(w), 1, c);
    }
  }
  /** Contorno oscuro alrededor de todo lo opaco (los brillos '~' no cuentan). */
  outline(c: string): void {
    const solid = (x: number, y: number): boolean => { const v = this.g[y]?.[x]; return !!v && v[0] !== '~' && v !== c; };
    const add: [number, number][] = [];
    for (let y = 0; y < MODEL_SIZE; y++) for (let x = 0; x < MODEL_SIZE; x++) {
      const v = this.g[y]![x];
      if (v && v[0] !== '~') continue;
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.g[y]![x] = c;
  }
  /** Brillo suave alrededor de un punto (debajo de lo que ya hay). */
  glow(cx: number, cy: number, r: number, rgba: string): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= 0 && y >= 0 && x < MODEL_SIZE && y < MODEL_SIZE && !this.g[y]![x]) this.g[y]![x] = '~' + rgba;
  }
}

const TAU = Math.PI * 2;
const wave = (p: number, ph = 0): number => Math.sin(TAU * p + ph);

// ---------------------------------------------------------------------------
// Hechicera Zorro: zorra de nueve colas, cuerpo cuadrado y orbe azul
// ---------------------------------------------------------------------------

const ZC = { body: '#e2503a', dark: '#a8321f', light: '#f27a52', tip: '#f8b878', cream: '#fbe0c0', eye: '#2a1210', ear: '#f8a070', out: '#2a1210', orb: '#58c8ff', orbL: '#e0f6ff', heart: '#ff6ab0' };

function zorro(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  const bob = a === 'idle' ? (f % 2) : a === 'walk' ? (f % 2 ? -1 : 0) : 0;
  const lean = a === 'cast' ? 2 : a === 'attack' && f === 1 ? 1 : 0;
  const by = 26 + bob + Math.round(death * 3);
  const bh = Math.round(12 - death * 5);
  const bx = 11 + lean;
  // nueve colas en abanico detrás del cuerpo, cada una con su borde para que se distingan
  const angles = [-172, -150, -130, -110, -90, -70, -50, -30, -8];
  const lens = [13, 15, 16, 17, 17, 17, 16, 15, 13];
  const order = angles.map((_, i) => i).sort((i, j) => Math.abs(angles[j]! + 90) - Math.abs(angles[i]! + 90));
  for (const i of order) {
    let ang = angles[i]!;
    let len = lens[i]!;
    if (a === 'idle') ang += wave(t, i * 0.7) * 4;
    if (a === 'walk') ang += wave(t, i) * 6 - 5;
    if (a === 'cast') ang = ang * 0.75 - 45;
    if (a === 'special') ang += wave(t, i * 0.4) * 8;
    if (a === 'death') { ang = ang + (ang < -90 ? -1 : 1) * death * 55; len *= 1 - death * 0.4; }
    const rad = (ang * Math.PI) / 180;
    const ox = bx + 5, oy = by - 4;
    const pts: [number, number, number, number][] = [];
    for (let k = 0.15; k <= 1.0001; k += 0.05) {
      const curl = Math.sin(k * Math.PI) * 1.8;
      const x = ox + Math.cos(rad) * len * k - Math.sin(rad) * curl;
      const y = oy + Math.sin(rad) * len * k + Math.cos(rad) * curl;
      const r = 0.5 + 2.9 * Math.sin(Math.PI * Math.min(1, k * 1.05)) * (1 - k * 0.25);
      pts.push([x, y, r, k]);
    }
    for (const [x, y, r] of pts) p.disc(x, y, r + 0.9, ZC.out);
    for (const [x, y, r, k] of pts) p.disc(x, y, r, k > 0.78 ? ZC.tip : k > 0.55 ? ZC.light : ZC.body);
    for (const [x, y, r, k] of pts) if (k > 0.25 && k < 0.6) p.disc(x + 0.7, y + 0.7, Math.max(0, r - 1.5), ZC.dark);
  }
  // cuerpo cuadrado
  const top = by - bh;
  p.rect(bx, top, 10, bh, ZC.body);
  p.rect(bx, top, 10, 1, ZC.light);
  p.rect(bx + 9, top + 1, 1, bh - 1, ZC.dark);
  p.rect(bx, by - 1, 10, 1, ZC.dark);
  // orejas
  if (death < 0.7) {
    for (const ex of [bx, bx + 7]) { p.rect(ex, top - 3, 3, 3, ZC.body); p.px(ex + 1, top - 4, ZC.body); p.px(ex + 1, top - 2, ZC.ear); }
  }
  // cara (mira a la derecha)
  const fy = top + 4;
  if (a === 'special') { p.rect(bx + 4, fy, 2, 1, ZC.eye); p.rect(bx + 7, fy, 2, 1, ZC.eye); }
  else if (a === 'death' && death > 0.4) { p.px(bx + 4, fy, ZC.eye); p.px(bx + 5, fy + 1, ZC.eye); p.px(bx + 7, fy, ZC.eye); p.px(bx + 8, fy + 1, ZC.eye); }
  else { p.rect(bx + 4, fy, 1, 2, ZC.eye); p.rect(bx + 7, fy, 1, 2, ZC.eye); }
  p.rect(bx + 5, fy + 3, 4, 2, ZC.cream);
  p.px(bx + 8, fy + 3, ZC.eye);
  // patitas
  if (death < 0.6) {
    const up = a === 'walk' ? f % 2 : 0;
    p.rect(bx + 1, by, 2, 3 - up, ZC.dark);
    p.rect(bx + 6, by, 2, 2 + up, ZC.dark);
  }
  // orbe del engaño
  if (a === 'attack') {
    const ox = [bx + 11, bx + 15, bx + 19, bx + 13][f]!, oy = by - 6;
    p.disc(ox, oy, 2.2, ZC.orb); p.px(ox - 1, oy - 1, ZC.orbL);
  } else if (a !== 'death') {
    const oy = by - 9 + Math.round(wave(t) * 1);
    p.disc(bx + 12, oy, 1.6, ZC.orb); p.px(bx + 12, oy - 1, ZC.orbL);
  }
  // encanto: corazón que crece
  if (a === 'special') {
    const s = 1 + (f >= 2 ? 1 : 0), hx = bx + 5, hy = top - 6 - f;
    p.disc(hx - s, hy, s, ZC.heart); p.disc(hx + s, hy, s, ZC.heart); p.trap(hx, hy, hy + 2 + s, 4 * s + 1, 1, ZC.heart);
  }
  p.outline(ZC.out);
  if (a === 'attack') p.glow([bx + 11, bx + 15, bx + 19, bx + 13][f]!, by - 6, 4, 'rgba(88,200,255,.35)');
  else if (a !== 'death') p.glow(bx + 12, by - 9, 3, 'rgba(88,200,255,.3)');
}

// ---------------------------------------------------------------------------
// Tejedora de Esferas: encapuchada morada, ojos cian y cuatro orbes
// ---------------------------------------------------------------------------

const TC = { hood: '#6a3fa8', hoodL: '#9a6ad8', hoodD: '#40246a', face: '#120a1e', eye: '#7ef4ff', robe: '#5a3494', robeD: '#3a2064', trim: '#e0904a', inner: '#3a5ab8', gem: '#7ef4ff', hand: '#58d8ff', out: '#140a24', cyan: '#58d8ff', violet: '#c060ff', core: '#ffffff' };

function tejedora(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  const bob = a === 'idle' ? Math.round(wave(t)) : a === 'walk' ? (f % 2 ? -1 : 0) : 0;
  const sink = Math.round(death * 8);
  const cx = 16;
  // órbita de las esferas
  let rx = 13, ry = 8, spin = t * 0.25;
  if (a === 'cast') { rx = 9 + f; ry = 6; }
  if (a === 'special') { rx = 10 + f * 2; ry = 7 + f; }
  if (a === 'attack') { rx = 12 - f * 3; ry = 8 - f * 2; }
  if (a === 'death') { rx = 13 + death * 3; ry = 8; }
  const orbs = [0, 1, 2, 3].map((k) => {
    const ang = TAU * (k / 4 + spin) + Math.PI / 4;
    let x = cx + Math.cos(ang) * rx, y = 15 + bob + Math.sin(ang) * ry;
    if (a === 'attack' && f >= 2) { x = cx + 8 + Math.cos(ang) * rx; y = 15 + Math.sin(ang) * ry; }
    if (a === 'idle' || a === 'walk') {
      // como en la ficha: dos cian arriba y dos violetas a los lados, flotando
      const fixed = [[6, 8], [26, 8], [3, 17], [29, 17]][k]!;
      x = fixed[0]!; y = fixed[1]! + Math.round(wave(t, k * 1.6) * 1);
      return { x, y, behind: false, col: k < 2 ? TC.cyan : TC.violet };
    }
    if (a === 'death') y += death * 12;
    return { x, y, behind: Math.sin(ang) < -0.2, col: k % 2 ? TC.violet : TC.cyan };
  });
  const orb = (o: { x: number; y: number; col: string }): void => { p.disc(o.x, o.y, 1.8, o.col); p.px(o.x, o.y, TC.core); };
  for (const o of orbs) if (o.behind) orb(o);
  // túnica
  const top = 17 + bob + sink;
  if (death < 1) {
    p.trap(cx, top, 30, 9, 16 + Math.round(death * 4), TC.robe);
    p.trap(cx - 4, top + 1, 30, 1, 2, TC.robeD);
    for (let y = top + 1; y <= 30; y++) { const w = 9 + ((16 - 9) * (y - top)) / Math.max(1, 30 - top); p.px(Math.round(cx - w / 2), y, TC.trim); p.px(Math.round(cx + w / 2) - 1, y, TC.trim); }
    p.rect(cx - 1, top + 2, 3, 30 - top - 1, TC.inner);
    const hem = a === 'walk' ? f % 2 : 0;
    p.rect(cx - 8, 30, 16, 1, TC.trim); if (hem) p.px(cx + 7, 29, TC.trim);
    // mangas y manos
    const handUp = a === 'cast' ? 6 : a === 'special' ? 2 : 0;
    p.rect(cx - 7, top + 2 - handUp, 3, 5, TC.robe); p.rect(cx + 4, top + 2 - handUp, 3, 5, TC.robe);
    p.px(cx - 7, top + 2 - handUp, TC.trim); p.px(cx + 6, top + 2 - handUp, TC.trim);
    if (death < 0.5) { p.rect(cx - 8, top + 6 - handUp, 2, 2, TC.hand); p.rect(cx + 6, top + 6 - handUp, 2, 2, TC.hand); }
    p.disc(cx, top + 1, 1.2, TC.gem);
  }
  // capucha
  const hy = 11 + bob + sink;
  p.disc(cx, hy, 5.6, TC.hood);
  p.rect(cx - 1, hy - 7, 2, 2, TC.hood);
  p.disc(cx - 1, hy - 1, 3.5, TC.hoodL);
  p.disc(cx, hy, 3.6, TC.hood);
  p.disc(cx + 1, hy + 1, 3.2, TC.face);
  p.rect(cx - 5, hy + 4, 11, 2, TC.hoodD);
  if (death < 0.8) { p.rect(cx - 1, hy + 1, 2, 1, TC.eye); p.rect(cx + 2, hy + 1, 2, 1, TC.eye); }
  for (const o of orbs) if (!o.behind) orb(o);
  p.outline(TC.out);
  for (const o of orbs) p.glow(o.x, o.y, 3.4, o.col === TC.cyan ? 'rgba(88,216,255,.3)' : 'rgba(192,96,255,.3)');
  if (death < 0.8) p.glow(cx + 1, hy + 1, 4, 'rgba(126,244,255,.12)');
}

// ---------------------------------------------------------------------------
// Carcelero de Almas: armadura espectral verde azulada, cadena y linterna
// ---------------------------------------------------------------------------

const KC = { arm: '#5fc8b0', armL: '#a8f0e0', armD: '#2a7a70', armDD: '#1a4a48', hole: '#0a1416', cloth: '#3a3a48', clothD: '#24242e', chain: '#9aa0b0', chainD: '#5a6070', lamp: '#2a2a30', light: '#e8fff8', wisp: '#5fc8b0', out: '#0c1a1c' };

function carcelero(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  const bob = a === 'idle' || a === 'walk' ? Math.round(wave(t) * 1) : 0;
  const sink = Math.round(death * 9);
  const y0 = 4 + bob + sink;
  // estela espectral (sin pies)
  if (death < 1) for (let i = 0; i < 4; i++) { const wx = 13 + i * 2 + Math.round(wave(t, i) * 1), wy = 26 + (i % 2); p.rect(wx, wy, 2, 4 - (i % 2) - Math.round(death * 2), i % 2 ? KC.armD : KC.wisp); }
  // tela raída
  p.trap(16, y0 + 17, y0 + 23, 9, 11, KC.cloth);
  for (let x = 11; x <= 21; x += 2) p.px(x, y0 + 24, KC.clothD);
  // torso
  p.rect(11, y0 + 8, 11, 9, KC.arm);
  p.rect(11, y0 + 8, 11, 1, KC.armL);
  p.rect(20, y0 + 9, 2, 8, KC.armD);
  for (let y = y0 + 10; y <= y0 + 15; y += 2) p.rect(13, y, 6, 1, KC.armD);
  p.rect(11, y0 + 16, 11, 2, KC.cloth);
  // hombreras grandes con tres pinchos
  for (const sx of [6, 20]) {
    p.rect(sx, y0 + 7, 6, 5, KC.arm); p.rect(sx, y0 + 7, 6, 1, KC.armL); p.rect(sx, y0 + 11, 6, 1, KC.armD);
    for (const k of [0, 2, 4]) { p.px(sx + k, y0 + 6, KC.armL); if (k !== 2) p.px(sx + k, y0 + 5, KC.armL); }
    p.px(sx + 2, y0 + 4, KC.armL);
  }
  // casco-calavera: cuencas negras grandes con un destello cian
  p.rect(12, y0, 9, 8, KC.arm);
  p.rect(13, y0 - 1, 7, 1, KC.armL);
  p.rect(12, y0, 9, 1, KC.armL);
  p.px(11, y0 + 1, KC.armL); p.px(21, y0 + 1, KC.armL);
  p.rect(13, y0 + 2, 3, 3, KC.hole); p.rect(17, y0 + 2, 3, 3, KC.hole);
  p.px(16, y0 + 4, KC.hole);
  p.rect(14, y0 + 6, 5, 1, KC.hole); p.px(15, y0 + 7, KC.hole); p.px(17, y0 + 7, KC.hole);
  const lit = a === 'attack' || a === 'cast' ? '#ffffff' : '#7ef4ff';
  p.px(14, y0 + 3, lit); p.px(18, y0 + 3, lit);
  // brazo de la cadena (detrás) o lanzando el gancho hacia delante
  const throwing = a === 'attack' && f >= 1 && f <= 2;
  if (throwing) {
    p.rect(21, y0 + 11, 5, 2, KC.arm);
    const reach = f === 1 ? 29 : 31;
    for (let x = 26; x <= reach; x++) p.px(x, y0 + 12, x % 2 ? KC.chain : KC.chainD);
    p.rect(reach - 1, y0 + 10, 2, 2, KC.chain); p.px(reach - 2, y0 + 9, KC.chain);
  } else {
    p.rect(8, y0 + 11, 2, 6, KC.arm);
    const sw = Math.round(wave(t) * (a === 'walk' ? 2 : 1));
    for (let i = 0; i < 6; i++) p.px(8 - Math.round(i * 0.5) + (i > 3 ? sw : 0), y0 + 17 + i, i % 2 ? KC.chain : KC.chainD);
    p.rect(3 + sw, y0 + 22, 3, 1, KC.chain); p.px(3 + sw, y0 + 21, KC.chain); p.px(6 + sw, y0 + 21, KC.chainD);
  }
  // brazo de la linterna
  const raise = a === 'cast' ? 7 : 0;
  if (!throwing) p.rect(22, y0 + 11 - raise, 2, 6, KC.arm);
  const lx = 22 + (throwing ? 3 : 0), ly = y0 + 17 - raise + (a === 'idle' ? (f % 2) : 0);
  p.rect(lx + 1, ly, 1, 1, KC.lamp);
  p.rect(lx - 1, ly + 1, 5, 1, KC.lamp);
  p.rect(lx - 1, ly + 2, 5, 4, KC.lamp);
  p.rect(lx, ly + 2, 3, 4, KC.light);
  p.rect(lx - 1, ly + 6, 5, 1, KC.lamp);
  p.outline(KC.out);
  if (death < 0.9) p.glow(lx + 1, ly + 4, a === 'cast' ? 5.5 : 4.5, a === 'cast' ? 'rgba(170,255,225,.45)' : 'rgba(170,255,225,.3)');
  for (let i = 0; i < 4; i++) p.glow(14 + i * 2, 29, 2, 'rgba(140,240,210,.3)');
}

// ---------------------------------------------------------------------------
// Acechador de Sombras: ninja oscuro, máscara, ojos rojos, bufanda roja y cuchillas
// ---------------------------------------------------------------------------

const AC = { suit: '#2e2e48', suitL: '#4a4a6e', suitD: '#1a1a2c', mask: '#c8ccd8', maskD: '#8a8ea0', eye: '#ff3a4a', scarf: '#c8303a', scarfD: '#8a1a24', blade: '#dce4f4', bladeD: '#8a94aa', wrap: '#5a5a7a', out: '#0a0a14' };

function acechador(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  const crouch = a === 'special' ? 3 : a === 'death' ? Math.round(death * 7) : 0;
  const bob = a === 'idle' ? (f % 2) : a === 'walk' ? (f % 2 ? -1 : 0) : 0;
  const y0 = 5 + bob + crouch;
  // bufanda ondeando detrás
  for (let i = 0; i < 7; i++) {
    const sx = 12 - i, sy = y0 + 8 + Math.round(wave(t + i * 0.12) * (a === 'walk' ? 2 : 1)) + Math.floor(i / 3);
    p.rect(sx, sy, 1, 2, i % 3 === 2 ? AC.scarfD : AC.scarf);
  }
  // piernas
  if (a === 'walk') {
    const s = f % 2 ? 2 : -2;
    p.rect(14 + s, y0 + 16, 2, 8, AC.suit); p.rect(18 - s, y0 + 16, 2, 8, AC.suitD);
    p.rect(14 + s, y0 + 21, 3, 3, AC.wrap); p.rect(18 - s, y0 + 21, 3, 3, AC.wrap);
  } else if (death < 0.6) {
    const spread = a === 'special' ? 2 : 0;
    p.rect(13 - spread, y0 + 16, 3, 8 - crouch, AC.suit); p.rect(18 + spread, y0 + 16, 3, 8 - crouch, AC.suitD);
    p.rect(13 - spread, y0 + 22 - crouch, 3, 2, AC.wrap); p.rect(18 + spread, y0 + 22 - crouch, 3, 2, AC.wrap);
  }
  // torso
  p.rect(12, y0 + 8, 9, 9, AC.suit);
  p.rect(12, y0 + 8, 9, 1, AC.suitL);
  p.rect(19, y0 + 9, 2, 8, AC.suitD);
  p.rect(12, y0 + 14, 9, 1, AC.scarfD);
  // brazo de atrás con cuchilla
  p.rect(10, y0 + 10, 2, 5, AC.suitD);
  p.line(9, y0 + 15, 7, y0 + 19, AC.bladeD);
  // cabeza con capucha y máscara
  p.rect(13, y0, 7, 8, AC.suit);
  p.rect(14, y0 - 1, 5, 1, AC.suitL);
  p.rect(13, y0 + 3, 7, 2, AC.mask);
  p.rect(13, y0 + 5, 7, 1, AC.maskD);
  if (death < 0.7) { p.px(17, y0 + 3, AC.eye); p.px(18, y0 + 3, AC.eye); }
  // bufanda al cuello
  p.rect(12, y0 + 7, 9, 2, AC.scarf);
  // brazo de delante y su cuchilla según la animación
  if (a === 'attack') {
    // tajo: de arriba a abajo en arco
    const pts = [[22, y0 + 6, 27, y0 + 1], [23, y0 + 10, 30, y0 + 8], [22, y0 + 13, 28, y0 + 18], [21, y0 + 11, 25, y0 + 14]][f]!;
    p.rect(20, y0 + 9, 3, 2, AC.suit);
    p.line(pts[0]!, pts[1]!, pts[2]!, pts[3]!, AC.blade);
    if (f === 1) { p.line(26, y0 + 4, 30, y0 + 12, '~rgba(255,80,100,.5)'); }
  } else if (a === 'cast') {
    // lanzar shuriken
    p.rect(20, y0 + 9, 5, 2, AC.suit);
    const sx = [24, 27, 30, 25][f]!, sy = y0 + 9;
    p.px(sx, sy - 1, AC.blade); p.px(sx, sy + 1, AC.blade); p.px(sx - 1, sy, AC.blade); p.px(sx + 1, sy, AC.blade); p.px(sx, sy, AC.bladeD);
  } else {
    p.rect(20, y0 + 10, 2, 5, AC.suit);
    p.line(22, y0 + 15, 25, y0 + 11, AC.blade);
  }
  p.outline(AC.out);
  if (death < 0.7) p.glow(17.5, y0 + 3, 2.5, 'rgba(255,58,74,.35)');
  if (a === 'special') for (let i = 0; i < 5; i++) p.glow(10 + i * 3, 29, 2.5, 'rgba(60,20,90,.45)');
}

// ---------------------------------------------------------------------------
// Bárbaro Desatado: casco con cuernos, pieles, calavera en el hombro y espadón con runas rojas
// ---------------------------------------------------------------------------

const BC = { skin: '#c98a62', skinD: '#9a5f40', skinL: '#e2ac84', paint: '#b02a2a', helm: '#8a8f9a', helmD: '#555963', helmL: '#b8bcc6', horn: '#e8dcc0', hornD: '#a89a7a', fur: '#8a7a68', furD: '#5e5040', furL: '#b4a48c', skull: '#ece4d0', skullD: '#a8a08a', kilt: '#6a4a30', kiltD: '#4a3220', belt: '#3a2a1c', boot: '#5a4632', bootD: '#3e3022', blade: '#b8bcc8', bladeD: '#767a86', bladeL: '#eef0f6', rune: '#ff4a3a', hilt: '#4a3424', beard: '#5a3a24', eye: '#2a1410', out: '#1a0f0a' };

/** Espadón: empuñadura en (hx, hy), hoja en el ángulo `deg` (0 = derecha, positivo hacia abajo). */
function greatsword(p: Pen, hx: number, hy: number, deg: number, len = 15): void {
  const r = (deg * Math.PI) / 180, dx = Math.cos(r), dy = Math.sin(r), nx = -dy, ny = dx;
  for (let k = -3; k < 0; k++) p.px(hx + dx * k, hy + dy * k, BC.hilt);
  for (let w = -2; w <= 2; w++) p.px(hx + dx * 1 + nx * w, hy + dy * 1 + ny * w, BC.hilt);
  for (let k = 2; k <= len; k++) {
    const x = hx + dx * k, y = hy + dy * k, wdt = k > len - 2 ? 0 : k > len - 4 ? 1 : 1.6;
    for (let w = -wdt; w <= wdt + 0.01; w += 0.5) p.px(x + nx * w, y + ny * w, w < -0.6 ? BC.bladeL : w > 0.6 ? BC.bladeD : BC.blade);
    if (k >= 4 && k <= len - 3 && k % 2 === 0) p.px(x, y, BC.rune);
  }
}

function barbaro(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  if (death >= 0.7) {
    // tendido en el suelo, con el espadón al lado
    const y = 25;
    p.rect(6, y, 20, 4, BC.skin); p.rect(6, y + 3, 20, 1, BC.skinD);
    p.rect(14, y - 1, 6, 5, BC.kilt);
    p.rect(22, y - 1, 6, 5, BC.fur);
    p.rect(26, y - 2, 4, 4, BC.helm); p.px(29, y - 4, BC.horn); p.px(30, y - 5, BC.horn); p.px(26, y - 3, BC.horn);
    p.rect(3, y, 4, 3, BC.boot);
    greatsword(p, 9, y + 5, -4, 14);
    p.outline(BC.out);
    return;
  }
  const kneel = a === 'death' ? Math.round(death * 8) : 0;
  const bob = a === 'idle' ? (f % 2) : a === 'walk' ? (f % 2 ? -1 : 0) : a === 'special' ? -(f % 2) : 0;
  const y0 = 4 + bob + kneel;
  const lean = a === 'attack' ? [0, -1, 2, 1][f]! : a === 'walk' ? 1 : 0;
  // piernas y botas de piel
  if (a === 'walk') {
    const st = f % 2 ? 2 : -2;
    p.rect(12 + st, y0 + 19, 3, 6, BC.skinD); p.rect(17 - st, y0 + 19, 3, 6, BC.skin);
    p.rect(11 + st, y0 + 23, 5, 4, BC.boot); p.rect(16 - st, y0 + 23, 5, 4, BC.boot);
  } else {
    const spread = a === 'attack' || a === 'special' ? 1 : 0;
    p.rect(12 - spread, y0 + 19, 3, 6 - kneel, BC.skinD); p.rect(17 + spread, y0 + 19, 3, 6 - kneel, BC.skin);
    p.rect(11 - spread, y0 + 23 - kneel, 5, 4, BC.boot); p.rect(16 + spread, y0 + 23 - kneel, 5, 4, BC.boot);
    p.rect(11 - spread, y0 + 23 - kneel, 5, 1, BC.bootD); p.rect(16 + spread, y0 + 23 - kneel, 5, 1, BC.bootD);
  }
  // falda de cuero con tiras de piel
  p.trap(16 + lean, y0 + 16, y0 + 21, 10, 12, BC.kilt);
  for (let i = 0; i < 4; i++) p.rect(11 + lean + i * 3, y0 + 20, 1, 2, BC.kiltD);
  p.rect(11 + lean, y0 + 16, 10, 1, BC.belt);
  // brazo de atrás
  p.rect(8 + lean, y0 + 10, 3, 7, BC.skinD);
  p.rect(8 + lean, y0 + 14, 3, 2, BC.fur);
  // torso musculoso con pintura de guerra y correa cruzada
  const tx = 11 + lean;
  p.rect(tx, y0 + 9, 10, 8, BC.skin);
  p.rect(tx, y0 + 9, 10, 1, BC.skinL);
  p.rect(tx + 4, y0 + 10, 1, 4, BC.skinD);
  p.rect(tx + 1, y0 + 13, 8, 1, BC.skinD);
  p.line(tx + 1, y0 + 11, tx + 3, y0 + 13, BC.paint); p.line(tx + 6, y0 + 11, tx + 8, y0 + 13, BC.paint);
  p.line(tx, y0 + 10, tx + 9, y0 + 16, BC.belt); p.line(tx + 1, y0 + 10, tx + 9, y0 + 15, BC.belt);
  // hombreras de piel y calavera en el hombro del arma
  p.disc(tx - 0.5, y0 + 9.5, 2.6, BC.fur); p.disc(tx - 0.5, y0 + 9, 1.4, BC.furL);
  p.disc(tx + 10, y0 + 9.5, 2.8, BC.fur); p.disc(tx + 10, y0 + 9, 1.6, BC.furL);
  p.rect(tx + 9, y0 + 5, 4, 3, BC.skull); p.rect(tx + 9, y0 + 8, 3, 1, BC.skullD);
  p.px(tx + 10, y0 + 6, BC.out); p.px(tx + 12, y0 + 6, BC.out); p.px(tx + 13, y0 + 4, BC.horn); p.px(tx + 8, y0 + 4, BC.horn);
  // cabeza con barba
  const hx = 13 + lean;
  p.rect(hx, y0 + 3, 6, 6, BC.skin);
  p.rect(hx, y0 + 7, 6, 3, BC.beard);
  p.rect(hx + 1, y0 + 9, 4, 1, BC.beard);
  const angry = a === 'special' || a === 'attack';
  p.px(hx + 3, y0 + 5, angry ? BC.rune : BC.eye); p.px(hx + 5, y0 + 5, angry ? BC.rune : BC.eye);
  p.px(hx + 2, y0 + 6, BC.paint); p.px(hx + 5, y0 + 6, BC.paint);
  // casco con cuernos
  p.rect(hx - 1, y0, 8, 4, BC.helm);
  p.rect(hx - 1, y0, 8, 1, BC.helmL);
  p.rect(hx - 1, y0 + 3, 8, 1, BC.helmD);
  p.rect(hx + 3, y0 + 3, 1, 3, BC.helmD);
  for (const [x, y, c] of [[-2, 2, BC.horn], [-3, 1, BC.horn], [-4, 0, BC.horn], [-4, -1, BC.hornD], [-3, -2, BC.hornD], [7, 2, BC.horn], [8, 1, BC.horn], [9, 0, BC.horn], [9, -1, BC.hornD], [8, -2, BC.hornD]] as const) p.px(hx + x, y0 + y, c);
  // brazo del arma y espadón según la animación
  const ang = a === 'attack' ? [-130, -75, 15, 55][f]! : a === 'special' ? -100 + wave(t) * 6 : a === 'cast' ? [-60, -90, -90, -60][f]! : a === 'walk' ? 25 + wave(t) * 6 : a === 'death' ? 80 : 60 + f * 3;
  const handX = 21 + lean + (a === 'attack' && f >= 2 ? 2 : 0), handY = y0 + (a === 'attack' && f < 2 ? 9 : a === 'special' || a === 'cast' ? 8 : 14);
  p.line(20 + lean, y0 + 10, handX, handY, BC.skin);
  p.line(21 + lean, y0 + 10, handX + 1, handY, BC.skinD);
  greatsword(p, handX, handY, ang, 16);
  p.rect(handX - 1, handY - 1, 2, 2, BC.skin);
  p.outline(BC.out);
  // brillo de las runas y aura de furia
  const rr = (ang * Math.PI) / 180;
  p.glow(handX + Math.cos(rr) * 9, handY + Math.sin(rr) * 9, a === 'attack' && f === 2 ? 5 : 3, 'rgba(255,74,58,.35)');
  if (a === 'special') { for (let i = 0; i < 4; i++) p.glow(8 + i * 5 + (f % 2), y0 - 1 + (i % 2) * 2, 2.2, 'rgba(255,90,40,.5)'); p.glow(16, y0 + 14, 9, 'rgba(255,60,30,.18)'); }
}

// ---------------------------------------------------------------------------
// Pistolero Arcano: sombrero ancho con pluma, pañuelo rojo, gabardina de forro rojo y revólver arcano
// ---------------------------------------------------------------------------

const PC = { hat: '#2a2a44', hatD: '#1a1a2e', hatL: '#3e3e62', band: '#c0283a', feather: '#f0e8f0', featherD: '#b8a8c8', skin: '#c08a68', mask: '#c0283a', maskD: '#8a1a28', eye: '#7ad0ff', coat: '#2e2a4a', coatD: '#1e1a34', coatL: '#46406a', lining: '#b8243a', belt: '#4a3424', buckle: '#d8b060', pants: '#2a2230', boot: '#4a3426', bootD: '#30221a', gun: '#8a8aa0', gunD: '#4a4a60', gunL: '#d8d8f0', magic: '#b070ff', out: '#120c18' };

/** Revólver: empuñadura en (hx, hy), cañón hacia la derecha inclinado `up` píxeles. */
function revolver(p: Pen, hx: number, hy: number, up = 0, glow = false): void {
  p.rect(hx - 1, hy, 2, 3, PC.belt);
  p.rect(hx - 1, hy - 2, 5, 2, PC.gunD);
  p.px(hx + 1, hy - 3, PC.gunL);
  for (let k = 0; k < 6; k++) p.px(hx + 4 + k, hy - 2 - Math.round((up * k) / 6), k % 2 ? PC.gun : PC.gunL);
  p.px(hx + 10, hy - 2 - up, PC.magic);
  if (glow) p.glow(hx + 11, hy - 2 - up, 3, 'rgba(176,112,255,.55)');
}

function pistolero(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  if (death >= 0.7) {
    const y = 25;
    p.rect(5, y, 20, 4, PC.coat); p.rect(5, y + 3, 20, 1, PC.coatD); p.rect(8, y + 1, 6, 2, PC.lining);
    p.rect(24, y - 1, 5, 4, PC.skin); p.rect(24, y + 1, 5, 2, PC.mask);
    p.rect(22, y - 3, 9, 2, PC.hat); p.rect(25, y - 5, 4, 2, PC.hat);
    p.rect(2, y + 1, 4, 3, PC.boot);
    revolver(p, 14, y + 5, 0);
    p.outline(PC.out);
    return;
  }
  const kneel = a === 'death' ? Math.round(death * 7) : 0;
  const bob = a === 'idle' ? (f % 2) : a === 'walk' ? (f % 2 ? -1 : 0) : a === 'special' ? -[0, 2, 3, 1][f]! : 0;
  const y0 = 3 + bob + kneel;
  const recoil = a === 'attack' ? [0, -1, 1, 0][f]! : 0;
  // gabardina que ondea detrás (forro rojo)
  const sway = a === 'walk' ? Math.round(wave(t) * 2) : a === 'special' ? Math.round(wave(t) * 3) : Math.round(wave(t, 1) * 1);
  p.trap(14 + recoil, y0 + 14, y0 + 24 - kneel, 8, 12 + Math.abs(sway), PC.coatD);
  for (let y = y0 + 16; y <= y0 + 23 - kneel; y++) p.px(9 + recoil - sway + Math.floor((y - y0 - 16) / 3), y, PC.lining);
  // piernas y botas
  if (a === 'walk') {
    const st = f % 2 ? 2 : -2;
    p.rect(13 + st, y0 + 19, 3, 6, PC.pants); p.rect(17 - st, y0 + 19, 3, 6, PC.pants);
    p.rect(12 + st, y0 + 23, 5, 3, PC.boot); p.rect(17 - st, y0 + 23, 5, 3, PC.boot);
  } else {
    p.rect(13, y0 + 19, 3, 6 - kneel, PC.pants); p.rect(17, y0 + 19, 3, 6 - kneel, PC.pants);
    p.rect(12, y0 + 23 - kneel, 5, 3, PC.boot); p.rect(17, y0 + 23 - kneel, 5, 3, PC.boot);
    p.rect(12, y0 + 23 - kneel, 5, 1, PC.bootD); p.rect(17, y0 + 23 - kneel, 5, 1, PC.bootD);
  }
  // torso con gabardina, solapas rojas y cinturón con hebilla
  const tx = 12 + recoil;
  p.rect(tx, y0 + 10, 9, 10, PC.coat);
  p.rect(tx, y0 + 10, 9, 1, PC.coatL);
  p.rect(tx + 3, y0 + 10, 3, 6, PC.lining);
  p.rect(tx + 4, y0 + 10, 1, 6, PC.maskD);
  p.rect(tx, y0 + 16, 9, 2, PC.belt); p.rect(tx + 3, y0 + 16, 3, 2, PC.buckle);
  p.rect(tx + 7, y0 + 11, 2, 8, PC.coatD);
  // brazo de atrás
  p.rect(tx - 2, y0 + 11, 2, 6, PC.coatD); p.rect(tx - 2, y0 + 17, 2, 1, PC.skin);
  // cabeza: pañuelo rojo y ojos que brillan
  const hx = 13 + recoil;
  p.rect(hx, y0 + 5, 7, 5, PC.skin);
  p.rect(hx, y0 + 8, 7, 2, PC.mask); p.rect(hx, y0 + 9, 7, 1, PC.maskD);
  p.px(hx + 6, y0 + 10, PC.mask); p.px(hx + 7, y0 + 11, PC.maskD);
  if (death < 0.6) { p.px(hx + 3, y0 + 6, PC.eye); p.px(hx + 5, y0 + 6, PC.eye); }
  // sombrero de ala ancha con cinta roja y pluma
  p.rect(hx - 4, y0 + 4, 15, 2, PC.hat); p.rect(hx - 4, y0 + 5, 15, 1, PC.hatD);
  p.rect(hx, y0, 7, 4, PC.hat); p.rect(hx + 1, y0, 5, 1, PC.hatL);
  p.rect(hx, y0 + 3, 7, 1, PC.band);
  const fl = a === 'idle' ? (f % 2) : a === 'walk' ? (f % 2) : 0;
  p.line(hx - 1, y0 + 3, hx - 4, y0 - 3 + fl, PC.feather); p.line(hx - 2, y0 + 3, hx - 5, y0 - 2 + fl, PC.featherD);
  p.px(hx - 3, y0 - 1 + fl, PC.featherD);
  // brazo del arma y revólver según la animación
  if (a === 'attack') {
    p.rect(tx + 8, y0 + 11, 3, 2, PC.coat); p.rect(tx + 10, y0 + 11, 2, 2, PC.skin);
    revolver(p, tx + 10, y0 + 12, f === 1 ? 2 : 0, f === 1 || f === 2);
    p.outline(PC.out);
    if (f === 1) { p.glow(tx + 19, y0 + 8, 3.5, 'rgba(255,210,120,.85)'); p.glow(tx + 18, y0 + 8, 2, 'rgba(176,112,255,.7)'); }
    return;
  }
  if (a === 'cast') {
    // recarga: el tambor se abre y brilla
    p.rect(tx + 7, y0 + 12, 4, 2, PC.coat); p.rect(tx + 10, y0 + 12, 2, 2, PC.skin);
    revolver(p, tx + 11, y0 + 14, -2 + f, true);
    p.outline(PC.out);
    for (let i = 0; i < 3; i++) p.glow(tx + 13 + ((f + i) % 3) * 2, y0 + 10 - i, 1.6, 'rgba(176,112,255,.6)');
    return;
  }
  if (a === 'special') {
    // voltereta acrobática: el revólver gira en la mano y deja estela violeta
    p.rect(tx + 8, y0 + 11, 3, 2, PC.coat);
    revolver(p, tx + 10, y0 + 12 - f, [2, -2, 1, 0][f]!, true);
    p.outline(PC.out);
    for (let i = 0; i < 4; i++) p.glow(6 + i * 6, y0 + 22 - ((f + i) % 2) * 2, 2, 'rgba(150,90,230,.4)');
    return;
  }
  // reposo / andar: revólver bajo, junto a la cadera
  p.rect(tx + 8, y0 + 11, 2, 6, PC.coat); p.rect(tx + 8, y0 + 17, 2, 1, PC.skin);
  revolver(p, tx + 9, y0 + 19, a === 'walk' ? (f % 2) : 0);
  p.outline(PC.out);
  p.glow(tx + 19, y0 + 17, 2, 'rgba(176,112,255,.35)');
}

// ---------------------------------------------------------------------------
// Arquitecto Rúnico: túnica con capucha azul, runa brillante en el rostro, báculo rúnico y losas flotantes
// ---------------------------------------------------------------------------

const RC = { robe: '#24305e', robeD: '#161e40', robeL: '#3a4c8e', trim: '#5ac8ff', face: '#0a0e20', rune: '#7ae8ff', runeL: '#e0fbff', staff: '#6a4a2c', staffD: '#45301c', head: '#3a8ad8', tile: '#1e3c78', tileL: '#58b8ff', hand: '#9a8070', out: '#070a18' };

/** Losa rúnica flotante (3×4) con su letra brillante. */
function runeTile(p: Pen, x: number, y: number, lit: boolean): void {
  p.rect(x, y, 3, 4, RC.tile);
  p.px(x + 1, y + 1, lit ? RC.runeL : RC.tileL); p.px(x + 1, y + 2, RC.tileL);
}

function arquitecto(p: Pen, a: Anim, f: number): void {
  const n = ANIM_FRAMES[a], t = f / n;
  const death = a === 'death' ? f / (n - 1) : 0;
  if (death >= 0.7) {
    const y = 25;
    p.rect(5, y, 21, 4, RC.robe); p.rect(5, y + 3, 21, 1, RC.robeD); p.rect(5, y, 21, 1, RC.trim);
    p.rect(24, y - 2, 6, 5, RC.robe); p.rect(25, y - 1, 3, 3, RC.face);
    p.line(3, y + 5, 28, y + 5, RC.staff); p.rect(1, y + 3, 3, 3, RC.head);
    p.outline(RC.out);
    return;
  }
  const kneel = a === 'death' ? Math.round(death * 7) : 0;
  const bob = a === 'idle' ? (f % 2) : a === 'walk' ? (f % 2 ? -1 : 0) : 0;
  const y0 = 3 + bob + kneel;
  const lift = a === 'cast' ? [0, 2, 3, 2][f]! : a === 'special' ? 3 : 0;
  // losas rúnicas que orbitan detrás
  const orbit = a === 'special' ? 2 : 1;
  for (let i = 0; i < 3; i++) {
    const ang = t * TAU * (a === 'special' ? 1 : 0.5) + i * 2.1;
    const rx = 15 + Math.cos(ang) * (11 + orbit), ry = y0 + 12 + Math.sin(ang) * 5 - lift;
    if (Math.sin(ang) < 0) runeTile(p, Math.round(rx), Math.round(ry), a !== 'idle' || f % 2 === i % 2);
  }
  // túnica en trapecio con ribete luminoso
  p.trap(16, y0 + 9, y0 + 25 - kneel, 9, 15, RC.robe);
  p.trap(16, y0 + 9, y0 + 25 - kneel, 3, 5, RC.robeL);
  for (let y = y0 + 12; y <= y0 + 24 - kneel; y += 3) p.px(16, y, RC.trim);
  p.rect(9, y0 + 25 - kneel, 15, 1, RC.trim);
  if (a === 'walk') { const st = f % 2 ? 2 : -2; p.rect(13 + st, y0 + 25, 3, 1, RC.robeD); p.rect(17 - st, y0 + 25, 3, 1, RC.robeD); }
  p.rect(20, y0 + 11, 3, 13 - kneel, RC.robeD);
  // capucha con la runa en el rostro
  p.rect(12, y0 + 1, 9, 9, RC.robe); p.rect(13, y0, 7, 1, RC.robeL); p.rect(12, y0 + 1, 1, 8, RC.robeD);
  p.rect(14, y0 + 3, 5, 6, RC.face);
  const glowOn = death < 0.6;
  if (glowOn) { p.rect(15, y0 + 4, 3, 1, RC.rune); p.rect(16, y0 + 5, 1, 3, RC.rune); p.px(16, y0 + 4, RC.runeL); }
  // runas del pecho
  p.px(15, y0 + 13, RC.trim); p.px(17, y0 + 13, RC.trim); p.px(16, y0 + 14, RC.rune);
  // brazo y báculo rúnico
  const sx = a === 'attack' ? [24, 25, 27, 25][f]! : 24;
  const top = y0 + 1 - lift - (a === 'attack' && f === 2 ? 1 : 0);
  p.rect(20, y0 + 11, 4, 2, RC.robe); p.rect(sx - 1, y0 + 11, 2, 2, RC.hand);
  p.line(sx, top + 4, sx - (a === 'attack' ? 1 : 0), y0 + 26 - kneel, RC.staff);
  p.line(sx + 1, top + 5, sx, y0 + 26 - kneel, RC.staffD);
  // cabeza del báculo: anillo con la runa
  p.rect(sx - 2, top, 5, 1, RC.head); p.rect(sx - 2, top + 4, 5, 1, RC.head); p.rect(sx - 2, top, 1, 5, RC.head); p.rect(sx + 2, top, 1, 5, RC.head);
  p.px(sx, top + 2, RC.runeL); p.px(sx, top + 1, RC.rune); p.px(sx, top + 3, RC.rune);
  // losas por delante
  for (let i = 0; i < 3; i++) {
    const ang = t * TAU * (a === 'special' ? 1 : 0.5) + i * 2.1;
    const rx = 15 + Math.cos(ang) * (11 + orbit), ry = y0 + 12 + Math.sin(ang) * 5 - lift;
    if (Math.sin(ang) >= 0) runeTile(p, Math.round(rx), Math.round(ry), a !== 'idle' || f % 2 === i % 2);
  }
  p.outline(RC.out);
  // brillos: rostro, báculo y círculo rúnico a los pies
  if (glowOn) p.glow(16.5, y0 + 5.5, 3, 'rgba(122,232,255,.35)');
  p.glow(sx, top + 2, a === 'cast' || a === 'attack' ? 4.5 : 3, 'rgba(90,200,255,.45)');
  if (a === 'attack' && f >= 1 && f <= 2) for (let k = 0; k < 4; k++) p.glow(sx + 3 + k * 2, top + 2, 1.6, 'rgba(160,230,255,.7)');
  if (a === 'special' || a === 'cast') for (let i = 0; i < 6; i++) { const ang = i * 1.047 + t * TAU; p.glow(16 + Math.cos(ang) * 9, 28 + Math.sin(ang) * 2, 1.8, 'rgba(90,200,255,.5)'); }
}

const DRAW: Record<string, (p: Pen, a: Anim, f: number) => void> = { zorro, esferas: tejedora, carcelero, acechador, barbaro, pistolero, arquitecto };

/** Paleta de la Sombra del Acechador: todo morado oscuro, solo los ojos siguen rojos. */
function shadowTint(c: string): string {
  if (c[0] === '~') return c.includes('255,58,74') ? c : '~rgba(40,10,60,.35)';
  if (c === AC.eye) return c;
  const n = parseInt(c.slice(1), 16);
  const l = (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
  const v = (k: number): string => Math.round(k).toString(16).padStart(2, '0');
  return `#${v(20 + l * 60)}${v(8 + l * 25)}${v(40 + l * 80)}`;
}

const cache = new Map<string, Grid>();

/** Fotograma de un modelo como cuadrícula de colores (32×32). */
export function modelFrame(cls: string, anim: Anim, frame: number, tint?: 'shadow'): Grid {
  const f = Math.max(0, Math.min(ANIM_FRAMES[anim] - 1, Math.floor(frame)));
  const key = `${cls}:${anim}:${f}:${tint ?? ''}`;
  let g = cache.get(key);
  if (!g) {
    const p = new Pen();
    DRAW[cls]!(p, anim, f);
    g = tint === 'shadow' ? p.g.map((row) => row.map((c) => (c ? shadowTint(c) : c))) : p.g;
    cache.set(key, g);
  }
  return g;
}
