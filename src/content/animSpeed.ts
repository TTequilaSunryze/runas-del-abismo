// Velocidad de las animaciones (ajuste del creador, para todos): duración de cada animación por personaje.
// 1 = normal; 2 = el doble de lenta; 0,5 = el doble de rápida. «*» se aplica a todos los enemigos.
export const ANIM_KEYS = ['idle', 'walk', 'attack', 'hurt', 'death'] as const;
export type AnimKey = (typeof ANIM_KEYS)[number];
export const ANIM_SPEED: Record<string, Partial<Record<AnimKey, number>>> = {};
/** Multiplicador de duración de la animación `a` del personaje `kind` (los enemigos también llevan el de «*»). */
export const animMul = (kind: string, a: AnimKey, enemy = true): number => (ANIM_SPEED[kind]?.[a] ?? 1) * (enemy ? ANIM_SPEED['*']?.[a] ?? 1 : 1);
