// Zona 1: Las Catacumbas Olvidadas. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA1_ENEMIES: Record<string, EnemyDef> = {
  limo: { id: 'limo', name: 'Limo de osario', hp: 20, armor: 0, ap: 3, mp: 2, initiative: 4, ai: 'melee', spell: 'e_golpe', resist: { poison: 50, fire: -30 } },
  murcielago: { id: 'murcielago', name: 'Murciélago de cripta', hp: 13, armor: 0, ap: 3, mp: 5, initiative: 16, ai: 'melee', spell: 'e_mordisco' },
  esqueleto: { id: 'esqueleto', name: 'Esqueleto guardián', hp: 24, armor: 1, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_golpe', resist: { poison: 60, holy: -30 } },
  acolito: { id: 'acolito', name: 'Acólito hereje', hp: 19, armor: 0, ap: 3, mp: 2, initiative: 13, ai: 'ranged', spell: 'e_llama', resist: { fire: 60, ice: -30 } },
  arquero: { id: 'arquero', name: 'Arquero óseo', hp: 17, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_flecha' },
  caballero: { id: 'caballero', name: 'Caballero sepulcral', hp: 70, armor: 2, ap: 6, mp: 3, initiative: 11, ai: 'melee', spell: 'e_tajo', scales: true },
  prior: { id: 'prior', name: 'El Prior Hueco', hp: 120, armor: 1, ap: 6, mp: 2, initiative: 6, ai: 'boss', spell: 'e_maldicion', more: ['e_barrido'], scales: true, resist: { shadow: 50, poison: 40, holy: -25 } },
  necrofago: { id: 'necrofago', name: 'Necrófago', hp: 30, armor: 1, ap: 3, mp: 3, initiative: 7, ai: 'melee', spell: 'e_zarpazo', resist: { poison: 75, fire: -30 } },
};
