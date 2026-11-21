// Variantes de color de los héroes y auras: solo apariencia. Se aplican al hornear los sprites (caché por variante).

/** Paleta de una variante: tono objetivo (grados) para la ropa y el equipo, y multiplicadores de saturación y luz. */
export interface PaletteDef { id: string; name: string; hue: number | null; sat: number; light: number }
export const PALETTES: PaletteDef[] = [
  { id: 'escarcha', name: 'Escarcha', hue: 200, sat: 0.85, light: 1.08 },
  { id: 'brasa', name: 'Brasa', hue: 14, sat: 1.1, light: 1 },
  { id: 'jade', name: 'Jade', hue: 145, sat: 0.9, light: 1 },
  { id: 'sombra', name: 'Sombra', hue: null, sat: 0.12, light: 0.72 },
  { id: 'ceniza', name: 'Ceniza', hue: null, sat: 0.18, light: 1.15 },
  { id: 'sangre', name: 'Sangre', hue: 352, sat: 1, light: 0.85 },
  { id: 'oro', name: 'Oro', hue: 44, sat: 1.05, light: 1.12 },
  { id: 'abisal', name: 'Abisal', hue: 272, sat: 1, light: 0.9 },
];
export const paletteDef = (id: string | null | undefined): PaletteDef | undefined => PALETTES.find((p) => p.id === id);

type HSL = [number, number, number];
function hexToHsl(hex: string): HSL | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex([h, s, l]: HSL): string {
  const k = (n: number): number => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number): number => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
/** Tonos de piel: no se tocan (la variante cambia ropa, pelo y equipo, no la cara). */
const isSkin = ([h, s, l]: HSL): boolean => h >= 12 && h <= 42 && s >= 0.25 && s <= 0.75 && l >= 0.55 && l <= 0.86;

/**
 * Aplica una variante a un color: los colores con saturación se tiñen con el tono de la variante conservando su luz
 * (así el dibujo mantiene sus volúmenes); la piel y los grises no cambian. Las variantes sin tono (sombra, ceniza) desaturan.
 */
export function recolor(hex: string, pal: PaletteDef): string {
  const hsl = hexToHsl(hex);
  if (!hsl || isSkin(hsl)) return hex;
  const [h, s, l] = hsl;
  if (s < 0.12) return pal.hue === null ? hslToHex([h, s, clamp01(l * pal.light)]) : hex;
  if (pal.hue === null) return hslToHex([h, clamp01(s * pal.sat), clamp01(l * pal.light)]);
  return hslToHex([pal.hue, clamp01(Math.max(s, 0.35) * pal.sat), clamp01(l * pal.light)]);
}

// ---------- auras (efectos bajo el héroe en combate) ----------
export interface AuraDef { id: string; name: string; color: string; glow: string; motes: number; style: 'ring' | 'motes' | 'flame' | 'runes' }
export const AURAS: AuraDef[] = [
  { id: 'brasas', name: 'Brasas tenues', color: '#ff8a3a', glow: '#ff8a3a55', motes: 3, style: 'motes' },
  { id: 'runas', name: 'Runas orbitantes', color: '#c9a0ff', glow: '#9b5cff44', motes: 4, style: 'runes' },
  { id: 'escarcha', name: 'Halo de escarcha', color: '#9fe3ff', glow: '#5cc8ff55', motes: 0, style: 'ring' },
  { id: 'corona', name: 'Corona de ecos', color: '#f2c14e', glow: '#f2c14e55', motes: 6, style: 'runes' },
  { id: 'prior', name: 'Velo del Prior', color: '#d8d0b8', glow: '#d8d0b844', motes: 0, style: 'ring' },
  { id: 'ecos', name: 'Eco del descenso', color: '#ff5fd2', glow: '#ff5fd244', motes: 5, style: 'flame' },
];
export const auraDef = (id: string | null | undefined): AuraDef | undefined => AURAS.find((a) => a.id === id);

/** Dibuja un aura bajo los pies (centro cx, cy; radio rx/ry). Solo decoración: no tapa casillas ni números. */
export function drawAura(g: CanvasRenderingContext2D, a: AuraDef, cx: number, cy: number, rx: number, ry: number, now: number): void {
  const t = now / 1000, pulse = 0.85 + 0.15 * Math.sin(t * 3);
  g.save();
  g.globalAlpha = 0.8;
  g.fillStyle = a.glow;
  g.beginPath(); g.ellipse(cx, cy, rx * 1.15 * pulse, ry * 1.15 * pulse, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = a.color; g.lineWidth = a.style === 'ring' ? 2 : 1;
  g.beginPath(); g.ellipse(cx, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < a.motes; i++) {
    const ang = t * (a.style === 'runes' ? 1.2 : 0.6) + (i / a.motes) * Math.PI * 2;
    const rise = a.style === 'flame' || a.style === 'motes' ? ((t * 0.7 + i / a.motes) % 1) : 0;
    const x = cx + Math.cos(ang) * rx * 0.9, y = cy + Math.sin(ang) * ry * 0.9 - rise * ry * 3;
    g.globalAlpha = 0.9 * (1 - rise);
    g.fillStyle = a.color;
    if (a.style === 'runes') g.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 4);
    else { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}
