// Ganchos de diseño: interruptores y números que se reajustarán en las próximas fases.

/**
 * Sistemas desactivados a la espera de rediseño.
 * - resistances: resistencias elementales (fuego, hielo, veneno, sombra, sagrado). Apagadas hasta que vuelvan los daños con efecto.
 * - runes: sistema de runas (eliminado en v10; reservado para el rediseño).
 * - effectDamage: nuevos daños con efecto (quemadura, congelación… como tipo de daño propio).
 */
export const FEATURES = { resistances: false, runes: false, effectDamage: false };

/** Escalado de los enemigos por profundidad (3 × zona + combates de la zona). Punto único para rebalancear enemigos comunes. */
export const ENEMY_SCALING = {
  /** vida extra por punto de profundidad */
  hpPerDepth: 0.2,
  /** % de daño extra por punto de profundidad */
  powerPerDepth: 13,
  /** multiplicador de vida base de los enemigos comunes (no jefes, élites ni pilares) */
  commonHp: 1.1,
};

/** Clases cuyo daño escala con el % de daño mágico; el resto escalan con el físico. */
export const MAGIC_CLASSES: readonly string[] = ['zorro', 'esferas', 'carcelero', 'mago', 'clerigo'];
export const schoolOf = (kind: string): 'magic' | 'phys' => (MAGIC_CLASSES.includes(kind) ? 'magic' : 'phys');
