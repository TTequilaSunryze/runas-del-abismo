// Efectos sintetizados con Web Audio y música en archivos (public/music).
import type { GameEvent } from '../core/state';

let ctx: AudioContext | null = null;
let muted = false;

try { muted = localStorage.getItem('rda_mute') === '1'; } catch { /* sin almacenamiento */ }

function ac(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.05, slide = 0, delay = 0): void {
  const a = muted ? null : ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  click: (): void => tone(660, 0.05, 'square', 0.03),
  myTurn: (): void => { tone(523, 0.1, 'triangle', 0.06); tone(784, 0.16, 'triangle', 0.06, 0, 0.1); },
  win: (): void => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'square', 0.045, 0, i * 0.1)),
  lose: (): void => [330, 262, 196, 131].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.05, 0, i * 0.2)),
  coin: (): void => { tone(988, 0.06, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0, 0.06); },
};

/** Efectos para lo que acaba de pasar en combate. */
export function playEvents(events: GameEvent[]): void {
  let i = 0;
  for (const e of events) {
    const d = Math.min(0.5, i * 0.06);
    if (e.t === 'cast') tone(420, 0.2, 'triangle', 0.05, 500, d);
    else if (e.t === 'damage') e.crit ? tone(300, 0.18, 'sawtooth', 0.07, -200, d) : tone(200, 0.13, 'sawtooth', 0.06, -140, d);
    else if (e.t === 'heal') { tone(520, 0.1, 'sine', 0.06, 0, d); tone(780, 0.15, 'sine', 0.06, 0, d + 0.09); }
    else if (e.t === 'shield') tone(300, 0.2, 'triangle', 0.05, 200, d);
    else if (e.t === 'death') tone(220, 0.4, 'sawtooth', 0.06, -180, d);
    else if (e.t === 'move') tone(100, 0.05, 'square', 0.025, -30, d);
    else if (e.t === 'summon' || e.t === 'phase') tone(110, 0.5, 'sawtooth', 0.07, 220, d);
    else if (e.t === 'bossEnter') { tone(80, 0.8, 'sawtooth', 0.09, 160, d); tone(55, 1.1, 'square', 0.05, 110, d + 0.15); }
    else if (e.t === 'stuck' || e.t === 'devour' || e.t === 'raise') tone(150, 0.25, 'sawtooth', 0.06, 120, d);
    else if (e.t === 'explode') tone(80, 0.45, 'sawtooth', 0.09, -40, d);
    else if (e.t === 'blink') tone(1200, 0.15, 'sine', 0.04, -900, d);
    else if (e.t === 'snare') tone(700, 0.1, 'square', 0.06, -500, d);
    else if (e.t === 'trap') tone(900, 0.08, 'square', 0.05, -600, d);
    else if (e.t === 'over') (e.result === 'win' ? sfx.win : sfx.lose)();
    else continue;
    i++;
  }
}

// Música: pistas propias (public/music) en listas por situación. Dentro de cada lista suenan en orden
// aleatorio, sin repetir la misma seguida; al cambiar de situación, fundido a otra pista de la nueva lista
// (si la que suena también pertenece a ella, sigue sonando).
const POOLS: Record<string, string[]> = {
  menu: ['menu', 'aldea', 'torre', 'descanso', 'ruta_nocturna', 'bosque_nocturno', 'final'],
  lobby: ['aldea', 'descanso', 'menu', 'torre'],
  tavern: ['descanso', 'aldea'],
  archive: ['torre', 'descanso'],
  gate: ['ruta_nocturna', 'bosque_nocturno'],
  hall: ['torre', 'final', 'descanso'],
  map0: ['ruta_nocturna', 'bosque_nocturno'], map1: ['bosque_nocturno', 'ruta_nocturna'], map2: ['isla_volcanica', 'bosque_acido'], map3: ['bosque_acido', 'isla_volcanica'],
  combat: ['combate', 'isla_volcanica', 'bosque_acido'], boss: ['jefe', 'combate'],
  calm: ['descanso', 'aldea'], choice: ['torre', 'descanso'], end: ['final', 'descanso'],
};
export const TRACK_TITLE: Record<string, string> = {
  menu: 'Aventura nocturna', aldea: 'La aldea', ruta_nocturna: 'Ruta nocturna', bosque_nocturno: 'Bosque de noche', isla_volcanica: 'Isla volcánica',
  bosque_acido: 'Bosque ácido', combate: 'Combate', jefe: 'El campeón', descanso: 'Descanso', torre: 'La torre', final: 'Final del camino',
};
let VOL = 0.4;
try { const v = Number(localStorage.getItem('rda_vol')); if (localStorage.getItem('rda_vol') !== null && v >= 0 && v <= 1) VOL = v; } catch { /* sin almacenamiento */ }
/** Volumen de la música (0 a 1). */
export const musicVolume = (): number => VOL;
export function setMusicVolume(v: number): void {
  VOL = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('rda_vol', String(VOL)); } catch { /* sin almacenamiento */ }
  if (playing && !muted) playing.volume = VOL;
}
const FADE_MS = 1200;
const players = new Map<string, HTMLAudioElement>();
let wanted = 'menu';
let playing: HTMLAudioElement | null = null;
let unlocked = false;

const fading = new WeakMap<HTMLAudioElement, number>();
function fade(a: HTMLAudioElement, to: number, then?: () => void): void {
  const from = a.volume, t0 = performance.now();
  const token = (fading.get(a) ?? 0) + 1;
  fading.set(a, token);
  const step = (): void => {
    if (fading.get(a) !== token) return; // otro fundido más reciente manda
    const k = Math.min(1, (performance.now() - t0) / FADE_MS);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step); else then?.();
  };
  requestAnimationFrame(step);
}

let current = '';
/** Elige la siguiente pista de la lista (la primera de la lista al entrar en una zona de mapa; si no, al azar sin repetir). */
function pick(pool: string[], avoid: string, first = false): string {
  if (first || pool.length === 1) return pool[0]!;
  const opts = pool.filter((f) => f !== avoid);
  return opts[Math.floor(Math.random() * opts.length)] ?? pool[0]!;
}
function start(file: string): void {
  let a = players.get(file);
  if (!a) {
    a = new Audio(`${import.meta.env.BASE_URL}music/${file}.mp3`);
    a.preload = 'auto';
    // al acabar, otra pista de la misma lista (sin bucles)
    a.addEventListener('ended', () => { if (playing === a) { current = ''; playWanted(true); } });
    players.set(file, a);
  }
  a.loop = false;
  const old = playing;
  if (old && old !== a) fade(old, 0, () => old.pause());
  if (a !== old) { try { if (a.ended || a.duration - a.currentTime < 3) a.currentTime = 0; } catch { /* aún sin cargar */ } }
  playing = a;
  current = file;
  a.volume = a === old ? a.volume : 0;
  void a.play().then(() => fade(a!, ducked ? 0 : VOL)).catch(() => { /* el navegador aún no deja sonar */ });
}

function playWanted(next = false): void {
  if (!unlocked || muted) return;
  const pool = POOLS[wanted] ?? POOLS.menu!;
  // la que suena sigue si pertenece a la nueva lista (y no ha terminado)
  if (!next && playing && pool.includes(current)) { if (playing.paused || playing.volume < VOL) void playing.play().then(() => fade(playing!, ducked ? 0 : VOL)).catch(() => {}); return; }
  start(pick(pool, current, !next && wanted.startsWith('map')));
}

/** Contextos: menu, lobby, tavern, archive, gate, hall, map0..map3, combat, boss, calm, choice, end. */
export function setZoneMusic(name: string): void {
  if (!POOLS[name] || name === wanted) return;
  wanted = name;
  playWanted();
}

export function nowPlaying(): string {
  return TRACK_TITLE[current] ?? '';
}

/** Baja la música a cero (p. ej. mientras suena el vídeo de entrada) o la devuelve a su volumen. */
let ducked = false;
export function duckMusic(on: boolean): void {
  ducked = on;
  if (!playing || muted) return;
  fade(playing, on ? 0 : VOL);
}
export const isDucked = (): boolean => ducked;

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
  try { localStorage.setItem('rda_mute', muted ? '1' : '0'); } catch { /* sin almacenamiento */ }
  if (muted) { const p = playing; if (p) fade(p, 0, () => { if (muted) p.pause(); }); } else playWanted();
}

// los navegadores solo dejan sonar tras una interacción del usuario
addEventListener('pointerdown', () => { ac(); unlocked = true; playWanted(); }, { once: true });
addEventListener('keydown', () => { ac(); unlocked = true; playWanted(); }, { once: true });
