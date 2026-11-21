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
  /** daño plano extra por punto de profundidad (v12) */
  powerPerDepth: 0.65,
  /** multiplicador de vida base de los enemigos comunes (no jefes, élites ni pilares) */
  commonHp: 1.1,
  /** v12: vida plana de todos los enemigos, élites y jefes (compensa quitar el azar y el daño ×2 de los héroes) */
  flatHp: 2.75,
  /** +15% de vida a los enemigos comunes de las listas 2 y 3 de cada zona */
  laterListHp: 1.15,
};

/** Clases que suman el Daño mágico a sus golpes; el resto suman el Daño físico. */
export const MAGIC_CLASSES: readonly string[] = ['zorro', 'esferas', 'carcelero', 'arquitecto', 'mago', 'clerigo'];
export const schoolOf = (kind: string): 'magic' | 'phys' => (MAGIC_CLASSES.includes(kind) ? 'magic' : 'phys');
