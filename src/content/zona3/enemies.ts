// Zona 3: Las Ruinas de Ceniza. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA3_ENEMIES: Record<string, EnemyDef> = {
  sabueso: { id: 'sabueso', name: 'Sabueso de ceniza', hp: 34, armor: 0, ap: 3, mp: 5, initiative: 16, ai: 'melee', spell: 'e_dentellada', resist: { fire: 60, ice: -30 }, traits: ['pack'] },
  ceniciento: { id: 'ceniciento', name: 'Ceniciento', hp: 46, armor: 2, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_espadazo', resist: { fire: 40 }, traits: ['devour'] },
  piromante: { id: 'piromante', name: 'Piromante', hp: 30, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_bola', more: ['e_avivar'], resist: { fire: 75, ice: -30 } },
  escoria: { id: 'escoria', name: 'Gólem de escoria', hp: 72, armor: 3, ap: 3, mp: 2, initiative: 3, ai: 'melee', spell: 'e_escoria', resist: { fire: 75, ice: -40 }, traits: ['puddle', 'guard'] },
  verdugo: { id: 'verdugo', name: 'Verdugo de ceniza', hp: 130, armor: 3, ap: 6, mp: 3, initiative: 10, ai: 'melee', spell: 'e_espadazo', scales: true, resist: { fire: 50 }, traits: ['guard'] },
  rey: { id: 'rey', name: 'El Rey Calcinado', hp: 240, armor: 2, ap: 6, mp: 2, initiative: 7, ai: 'boss', spell: 'e_pira', more: ['e_cataclismo'], scales: true, resist: { fire: 75, ice: -30 } },
  salamandra: { id: 'salamandra', name: 'Salamandra', hp: 26, armor: 0, ap: 3, mp: 4, initiative: 14, ai: 'melee', spell: 'e_dentellada', resist: { fire: 75, ice: -40 }, traits: ['bomb'] },
  forjador: { id: 'forjador', name: 'Forjador caído', hp: 52, armor: 2, ap: 3, mp: 3, initiative: 8, ai: 'melee', spell: 'e_martillo', resist: { fire: 60 }, traits: ['enrage', 'guard'] },
  tirador: { id: 'tirador', name: 'Tirador de ceniza', hp: 30, armor: 0, ap: 4, mp: 3, initiative: 13, ai: 'ranged', spell: 'e_ascua', resist: { fire: 60, ice: -30 }, traits: ['trapper'] },
  ascua: { id: 'ascua', name: 'Ascua viva', hp: 40, armor: 0, ap: 3, mp: 3, initiative: 11, ai: 'melee', spell: 'e_dentellada', resist: { fire: 75, ice: -40 }, traits: ['split', 'regen'] },
  inquisidor: { id: 'inquisidor', name: 'Inquisidor de ceniza', hp: 115, armor: 2, ap: 6, mp: 3, initiative: 12, ai: 'ranged', spell: 'e_bola', more: ['e_avivar'], scales: true, resist: { fire: 60 }, traits: ['enrage', 'trapper'] },
  fundidora: { id: 'fundidora', name: 'La Fundidora', hp: 230, armor: 3, ap: 6, mp: 2, initiative: 8, ai: 'boss', spell: 'e_ascua', more: ['e_fundir'], scales: true, resist: { fire: 75, ice: -30 }, traits: ['enrage'] },
  brasero: { id: 'brasero', name: 'Brasero eterno', hp: 56, armor: 3, ap: 0, mp: 0, initiative: 1, ai: 'pillar', spell: 'e_escoria', resist: { fire: 75, ice: -40 } },
};
