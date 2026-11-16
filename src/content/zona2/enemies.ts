// Zona 2: El Bosque Corrompido. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA2_ENEMIES: Record<string, EnemyDef> = {
  lobo: { id: 'lobo', name: 'Lobo corrupto', hp: 30, armor: 0, ap: 3, mp: 5, initiative: 15, ai: 'melee', spell: 'e_mordida' },
  arana: { id: 'arana', name: 'Araña de zarza', hp: 26, armor: 0, ap: 3, mp: 4, initiative: 13, ai: 'melee', spell: 'e_zarpazo', resist: { poison: 75, fire: -30 } },
  tejedora: { id: 'tejedora', name: 'Tejedora', hp: 24, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_telarana', resist: { poison: 50, fire: -30 } },
  chaman: { id: 'chaman', name: 'Chamán de esporas', hp: 27, armor: 0, ap: 3, mp: 2, initiative: 11, ai: 'ranged', spell: 'e_espora', resist: { poison: 75 } },
  ent: { id: 'ent', name: 'Ent podrido', hp: 56, armor: 2, ap: 3, mp: 2, initiative: 4, ai: 'melee', spell: 'e_raiz', resist: { poison: 50, fire: -40 } },
  alfa: { id: 'alfa', name: 'Lobo alfa', hp: 100, armor: 1, ap: 6, mp: 5, initiative: 14, ai: 'melee', spell: 'e_mordida', scales: true },
  madre: { id: 'madre', name: 'La Madre Raíz', hp: 180, armor: 1, ap: 6, mp: 2, initiative: 6, ai: 'boss', spell: 'e_latigo', more: ['e_aplastar'], scales: true, resist: { poison: 60, fire: -30 } },
};
