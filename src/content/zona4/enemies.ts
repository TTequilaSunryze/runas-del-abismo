// Zona 4: El Abismo. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA4_ENEMIES: Record<string, EnemyDef> = {
  vacio: { id: 'vacio', name: 'Errante del vacío', hp: 38, armor: 0, ap: 3, mp: 4, initiative: 18, ai: 'melee', spell: 'e_zarpa', resist: { shadow: 75, holy: -40 }, traits: ['blink', 'ghost', 'hunter'] },
  ojo: { id: 'ojo', name: 'Ojo del abismo', hp: 34, armor: 0, ap: 3, mp: 2, initiative: 14, ai: 'ranged', spell: 'e_mirada', resist: { shadow: 60, holy: -40 } },
  devorador: { id: 'devorador', name: 'Devorador', hp: 62, armor: 2, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_mordaza', resist: { shadow: 50 }, traits: ['devour', 'enrage'] },
  heraldo: { id: 'heraldo', name: 'Heraldo del vacío', hp: 40, armor: 1, ap: 4, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_vacio', more: ['e_avivar', 'e_escudo'], resist: { shadow: 60, holy: -30 } },
  larva: { id: 'larva', name: 'Larva abisal', hp: 30, armor: 0, ap: 3, mp: 4, initiative: 15, ai: 'melee', spell: 'e_mordisco', resist: { shadow: 50, fire: -30 }, traits: ['split', 'bomb'] },
  guardian: { id: 'guardian', name: 'Guardián rúnico', hp: 70, armor: 4, ap: 3, mp: 2, initiative: 5, ai: 'melee', spell: 'e_aplastar', resist: { fire: 30, ice: 30, poison: 30 }, traits: ['thorns', 'guard'] },
  centinela: { id: 'centinela', name: 'Centinela del Vacío', hp: 150, armor: 3, ap: 6, mp: 3, initiative: 13, ai: 'melee', spell: 'e_mordaza', scales: true, resist: { shadow: 60 }, traits: ['guard', 'regen'] },
  mimico: { id: 'mimico', name: 'Mímico de runas', hp: 120, armor: 2, ap: 6, mp: 4, initiative: 16, ai: 'melee', spell: 'e_zarpa', scales: true, resist: { shadow: 40 }, traits: ['blink', 'thorns'] },
  devorarunas: { id: 'devorarunas', name: 'El Devorador de Runas', hp: 320, armor: 3, ap: 6, mp: 2, initiative: 10, ai: 'boss', spell: 'e_vacio', more: ['e_devorar'], scales: true, resist: { shadow: 75, holy: -25 } },
  eco: { id: 'eco', name: 'El Eco de los Caídos', hp: 290, armor: 2, ap: 6, mp: 3, initiative: 14, ai: 'boss', spell: 'e_eco', more: ['e_mordaza'], scales: true, resist: { shadow: 60, poison: 50 }, traits: ['regen'] },
  obelisco: { id: 'obelisco', name: 'Obelisco hambriento', hp: 70, armor: 4, ap: 0, mp: 0, initiative: 1, ai: 'pillar', spell: 'e_golpe', resist: { shadow: 75, poison: 75 } },
};
