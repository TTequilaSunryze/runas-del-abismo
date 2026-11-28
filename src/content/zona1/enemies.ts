// Zona 1: Las Catacumbas Olvidadas. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA1_ENEMIES: Record<string, EnemyDef> = {
  limo: { id: 'limo', name: 'Limo de osario', hp: 20, armor: 0, ap: 3, mp: 2, initiative: 4, ai: 'melee', spell: 'e_golpe', resist: { poison: 50, fire: -30 }, traits: ['puddle'] },
  murcielago: { id: 'murcielago', name: 'Murciélago de cripta', hp: 13, armor: 0, ap: 3, mp: 5, initiative: 16, ai: 'melee', spell: 'e_mordisco' },
  esqueleto: { id: 'esqueleto', name: 'Esqueleto guardián', hp: 24, armor: 1, ap: 3, mp: 3, initiative: 9, ai: 'melee', spell: 'e_golpe', resist: { poison: 60, holy: -30 }, traits: ['guard'] },
  acolito: { id: 'acolito', name: 'Acólito hereje', hp: 19, armor: 0, ap: 5, mp: 2, initiative: 13, ai: 'ranged', spell: 'e_llama', resist: { fire: 60, ice: -30 }, traits: ['raise'] },
  arquero: { id: 'arquero', name: 'Arquero óseo', hp: 17, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_flecha' },
  caballero: { id: 'caballero', name: 'Caballero sepulcral', hp: 70, armor: 2, ap: 6, mp: 3, initiative: 11, ai: 'melee', spell: 'e_tajo', scales: true },
  prior: { id: 'prior', name: 'El Prior Hueco', hp: 120, armor: 1, ap: 6, mp: 2, initiative: 6, ai: 'boss', spell: 'e_maldicion', more: ['e_barrido'], scales: true, resist: { shadow: 50, poison: 40, holy: -25 } },
  necrofago: { id: 'necrofago', name: 'Necrófago', hp: 30, armor: 1, ap: 3, mp: 3, initiative: 7, ai: 'melee', spell: 'e_zarpazo', resist: { poison: 75, fire: -30 }, traits: ['devour'] },
  espectro: { id: 'espectro', name: 'Espectro', hp: 22, armor: 0, ap: 3, mp: 4, initiative: 15, ai: 'melee', spell: 'e_toque', resist: { poison: 75, shadow: 50, holy: -40 }, traits: ['ghost', 'hunter'] },
  momia: { id: 'momia', name: 'Momia del osario', hp: 36, armor: 1, ap: 3, mp: 2, initiative: 6, ai: 'melee', spell: 'e_vendaje', resist: { poison: 75, fire: -40 }, traits: ['regen'] },
  calavera: { id: 'calavera', name: 'Calavera ígnea', hp: 14, armor: 0, ap: 3, mp: 5, initiative: 17, ai: 'melee', spell: 'e_golpe', resist: { fire: 75 }, traits: ['bomb', 'hunter'] },
  sepulturero: { id: 'sepulturero', name: 'Sepulturero', hp: 26, armor: 1, ap: 4, mp: 3, initiative: 10, ai: 'ranged', spell: 'e_pala', traits: ['trapper'] },
  gargola: { id: 'gargola', name: 'Gárgola', hp: 34, armor: 3, ap: 3, mp: 3, initiative: 8, ai: 'melee', spell: 'e_garra', resist: { poison: 75, ice: 30 }, traits: ['thorns'] },
  abominacion: { id: 'abominacion', name: 'Abominación de huesos', hp: 80, armor: 1, ap: 6, mp: 3, initiative: 9, ai: 'melee', spell: 'e_tajo', scales: true, resist: { poison: 60, holy: -30 }, traits: ['devour', 'split'] },
  planidera: { id: 'planidera', name: 'La Plañidera', hp: 115, armor: 0, ap: 6, mp: 3, initiative: 12, ai: 'boss', spell: 'e_lamento', more: ['e_toque'], scales: true, resist: { shadow: 60, poison: 50, holy: -30 } },
  pilar: { id: 'pilar', name: 'Pilar de huesos', hp: 32, armor: 2, ap: 0, mp: 0, initiative: 1, ai: 'pillar', spell: 'e_golpe', resist: { poison: 75, holy: -30 } },
  // Q1: objetivos estructurales de los jefes de la zona
  sello: { id: 'sello', name: 'Sello funerario', hp: 28, armor: 1, ap: 0, mp: 0, initiative: 1, ai: 'pillar', spell: 'e_golpe', resist: { poison: 75, holy: -30 } },
  eco_lamento: { id: 'eco_lamento', name: 'Eco del lamento', hp: 10, armor: 0, ap: 0, mp: 0, initiative: 13, ai: 'pillar', spell: 'e_toque', resist: { poison: 75, holy: -40 } },
};
