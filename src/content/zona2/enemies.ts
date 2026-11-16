// Zona 2: El Bosque Corrompido. Enemigos.
import type { EnemyDef } from '../enemies';

export const ZONA2_ENEMIES: Record<string, EnemyDef> = {
  lobo: { id: 'lobo', name: 'Lobo corrupto', hp: 30, armor: 0, ap: 3, mp: 5, initiative: 15, ai: 'melee', spell: 'e_mordida', traits: ['pack'] },
  arana: { id: 'arana', name: 'Araña de zarza', hp: 26, armor: 0, ap: 3, mp: 4, initiative: 13, ai: 'melee', spell: 'e_zarpazo', resist: { poison: 75, fire: -30 }, traits: ['puddle'] },
  tejedora: { id: 'tejedora', name: 'Tejedora', hp: 24, armor: 0, ap: 3, mp: 2, initiative: 12, ai: 'ranged', spell: 'e_telarana', resist: { poison: 50, fire: -30 } },
  chaman: { id: 'chaman', name: 'Chamán de esporas', hp: 27, armor: 0, ap: 3, mp: 2, initiative: 11, ai: 'ranged', spell: 'e_espora', more: ['e_escudo'], resist: { poison: 75 } },
  ent: { id: 'ent', name: 'Ent podrido', hp: 56, armor: 2, ap: 3, mp: 2, initiative: 4, ai: 'melee', spell: 'e_raiz', resist: { poison: 50, fire: -40 }, traits: ['guard'] },
  alfa: { id: 'alfa', name: 'Lobo alfa', hp: 100, armor: 1, ap: 6, mp: 5, initiative: 14, ai: 'melee', spell: 'e_mordida', scales: true, traits: ['pack', 'guard'] },
  madre: { id: 'madre', name: 'La Madre Raíz', hp: 180, armor: 1, ap: 6, mp: 2, initiative: 6, ai: 'boss', spell: 'e_latigo', more: ['e_aplastar'], scales: true, resist: { poison: 60, fire: -30 } },
  hongo: { id: 'hongo', name: 'Hongo hinchado', hp: 34, armor: 0, ap: 3, mp: 2, initiative: 6, ai: 'melee', spell: 'e_zarpazo', resist: { poison: 75, fire: -40 }, traits: ['split'] },
  pantera: { id: 'pantera', name: 'Pantera sombría', hp: 30, armor: 0, ap: 3, mp: 4, initiative: 18, ai: 'melee', spell: 'e_zarpa', resist: { shadow: 40 }, traits: ['blink', 'hunter'] },
  zarzal: { id: 'zarzal', name: 'Zarzal andante', hp: 44, armor: 2, ap: 3, mp: 2, initiative: 5, ai: 'melee', spell: 'e_espinas', resist: { poison: 60, fire: -40 }, traits: ['thorns'] },
  druida: { id: 'druida', name: 'Druida corrupto', hp: 28, armor: 0, ap: 4, mp: 2, initiative: 11, ai: 'ranged', spell: 'e_espora', more: ['e_savia'], resist: { poison: 60 }, traits: ['regen'] },
  reina: { id: 'reina', name: 'Reina de la zarza', hp: 95, armor: 1, ap: 6, mp: 4, initiative: 13, ai: 'melee', spell: 'e_zarpazo', scales: true, resist: { poison: 75, fire: -30 }, traits: ['puddle', 'trapper'] },
  cazador: { id: 'cazador', name: 'El Cazador Silvano', hp: 170, armor: 1, ap: 6, mp: 4, initiative: 15, ai: 'boss', spell: 'e_saeta', more: ['e_mordida'], scales: true, resist: { poison: 40, fire: -20 }, traits: ['trapper'] },
  brote: { id: 'brote', name: 'Raíz sanadora', hp: 44, armor: 2, ap: 0, mp: 0, initiative: 1, ai: 'pillar', spell: 'e_raiz', resist: { poison: 75, fire: -40 } },
};
