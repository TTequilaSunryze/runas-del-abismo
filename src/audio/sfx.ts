// Sonido sintetizado con Web Audio: efectos y una melodía en bucle. Sin archivos.
import type { GameEvent } from '../core/state';

let ctx: AudioContext | null = null;
let muted = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let beat = 0;

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
    else if (e.t === 'trap') tone(900, 0.08, 'square', 0.05, -600, d);
    else if (e.t === 'over') (e.result === 'win' ? sfx.win : sfx.lose)();
    else continue;
    i++;
  }
}

const SCALE = [220, 261.6, 293.7, 329.6, 392, 440];
const PATTERN = [0, 2, 4, 2, 0, 3, 5, 3, 1, 3, 5, 3, 0, 2, 4, 2];

function startMusic(): void {
  if (musicTimer || muted) return;
  musicTimer = setInterval(() => {
    const f = SCALE[PATTERN[beat % PATTERN.length]!]!;
    tone(f / 2, 0.28, 'triangle', 0.022);
    if (beat % 4 === 0) tone(f / 4, 0.5, 'sine', 0.03);
    beat++;
  }, 280);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
  try { localStorage.setItem('rda_mute', muted ? '1' : '0'); } catch { /* sin almacenamiento */ }
  if (muted && musicTimer) { clearInterval(musicTimer); musicTimer = null; } else startMusic();
}

// los navegadores solo dejan sonar tras una interacción del usuario
addEventListener('pointerdown', () => { ac(); startMusic(); }, { once: true });
