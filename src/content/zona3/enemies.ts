// Zona 3: Las Ruinas de Ceniza. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA3_ENEMIES: Record<string, EnemyDef> = {
  sabueso: { id: 'sabueso', name: 'Sabueso de ceniza', hp: 34, armor: 0, ap: 3, mp: 5, initiative: 16, ai: 'melee', spell: 'e_dentellada', resist: { fire: 60, ice: -30 } },
  ceniciento: { id: 'ceniciento', name: 'Ceniciento', hp: 46, armor: 2, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_espadazo', resist: { fire: 40 } },
  piromante: { id: 'piromante', name: 'Piromante', hp: 30, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_bola', resist: { fire: 75, ice: -30 } },
  escoria: { id: 'escoria', name: 'Gólem de escoria', hp: 72, armor: 3, ap: 3, mp: 2, initiative: 3, ai: 'melee', spell: 'e_escoria', resist: { fire: 75, ice: -40 } },
  verdugo: { id: 'verdugo', name: 'Verdugo de ceniza', hp: 130, armor: 3, ap: 6, mp: 3, initiative: 10, ai: 'melee', spell: 'e_espadazo', scales: true, resist: { fire: 50 } },
  rey: { id: 'rey', name: 'El Rey Calcinado', hp: 240, armor: 2, ap: 6, mp: 2, initiative: 7, ai: 'boss', spell: 'e_pira', more: ['e_cataclismo'], scales: true, resist: { fire: 75, ice: -30 } },
};
