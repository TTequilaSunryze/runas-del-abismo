// Mejoras de hechizo de las bendiciones de clase: cambian un hechizo concreto que el héroe ya tiene.
import type { SpellDef } from './classes/spells';

export interface BoonMod {
  id: string;
  /** hechizo al que se aplica */
  target: string;
  name: string;
  text: string;
  apply: (d: SpellDef) => void;
}

const more = (d: SpellDef, k: number): void => { if (d.dmg) d.dmg = [Math.round(d.dmg[0] * k), Math.round(d.dmg[1] * k)]; };
const M = (id: string, target: string, name: string, text: string, apply: (d: SpellDef) => void): BoonMod => ({ id, target, name, text, apply });

export const BOON_MODS: Record<string, BoonMod> = Object.fromEntries(([
  // Guerrero
  M('gm_filo', 'tajo', 'Filo templado', '+30% de daño y +15% de crítico.', (d) => { more(d, 1.3); d.crit = (d.crit ?? 0) + 15; }),
  M('gm_demoledor', 'hachazo', 'Hachazo demoledor', 'Deja al objetivo Expuesto: −3 de armadura durante 2 turnos.', (d) => { d.extraStatus = { kind: 'exposed', turns: 2, stacks: 3 }; }),
  M('gm_insaciable', 'sed_sangre', 'Sed insaciable', 'El bonus de daño sube a +50%.', (d) => { d.buff = { kind: 'empower', turns: 2, stacks: 50 }; }),
  M('gm_vampiro', 'tajo', 'Tajo vampírico', 'Te curas el 35% del daño que haces.', (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.35; }),
  M('gm_escudo', 'hachazo', 'Golpe de escudo', 'Además ganas un escudo de 10.', (d) => { d.selfShield = (d.selfShield ?? 0) + 10; }),
  M('gm_defensivo', 'tajo', 'Tajo defensivo', 'Además ganas un escudo de 8.', (d) => { d.selfShield = (d.selfShield ?? 0) + 8; }),
  M('gm_aturdidor', 'hachazo', 'Hachazo pesado', 'Quita 2 PM al objetivo.', (d) => { d.status = { kind: 'slow', turns: 1, stacks: 2 }; }),
  // Mago
  M('mm_voraz', 'chispa', 'Chispa voraz', 'Explota en área 1 y quema 3 turnos.', (d) => { d.area = 1; d.status = { kind: 'burn', turns: 3 }; }),
  M('mm_igneo', 'dardo', 'Dardo ígneo', 'Pasa a ser de fuego y quema 1 turno.', (d) => { d.element = 'fire'; d.status = { kind: 'burn', turns: 1 }; }),
  M('mm_helado', 'dardo', 'Dardo de hielo', 'Pasa a ser de hielo y quita 1 PM.', (d) => { d.element = 'ice'; d.status = { kind: 'slow', turns: 1, stacks: 1 }; }),
  M('mm_escarcha', 'escudo_arcano', 'Escudo de escarcha', 'El escudo sube a 24.', (d) => { d.shield = 24; }),
  M('mm_cadena', 'chispa', 'Chispa encadenada', 'Quita 1 PA al objetivo.', (d) => { d.drainAp = (d.drainAp ?? 0) + 1; }),
  M('mm_veloz', 'dardo', 'Dardo veloz', 'Cuesta 1 PA menos.', (d) => { d.ap = Math.max(1, d.ap - 1); }),
  M('mm_sobrecarga', 'escudo_arcano', 'Sobrecarga', 'El bonus de daño sube a +30%.', (d) => { d.buff = { kind: 'empower', turns: 2, stacks: 30 }; }),
  M('mm_doble', 'dardo', 'Proyectil doble', '+40% de daño.', (d) => { more(d, 1.4); }),
  // Clérigo
  M('cm_sanador', 'castigo', 'Castigo sanador', 'Te curas la mitad del daño que haces.', (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.5; }),
  M('cm_compartido', 'fervor', 'Fervor compartido', 'También cura a los aliados a 2 casillas.', (d) => { d.area = 2; }),
  M('cm_juicio', 'maza', 'Maza del juicio', 'Marca al objetivo 2 turnos (+30% de daño recibido).', (d) => { d.status = { kind: 'mark', turns: 2 }; }),
  M('cm_cegador', 'castigo', 'Castigo cegador', 'Quita 1 PA al objetivo.', (d) => { d.drainAp = (d.drainAp ?? 0) + 1; }),
  M('cm_protector', 'fervor', 'Fervor protector', 'Además te da un escudo de 15.', (d) => { d.shield = (d.shield ?? 0) + 15; }),
  M('cm_bendita', 'maza', 'Maza bendita', 'Además ganas un escudo de 8.', (d) => { d.selfShield = (d.selfShield ?? 0) + 8; }),
  M('cm_sangrienta', 'maza', 'Maza sangrienta', 'Te curas el 40% del daño que haces.', (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.4; }),
  M('cm_ardiente', 'castigo', 'Castigo abrasador', 'Quema 2 turnos.', (d) => { d.status = { kind: 'burn', turns: 2 }; }),
  // Arquero
  M('am_acero', 'flecha', 'Punta de acero', 'Ignora la armadura.', (d) => { d.pierce = true; }),
  M('am_aguila', 'ojo_halcon', 'Ojo de águila', '+3 de alcance (en vez de +2) y +10% de crítico al disparar.', (d) => { d.buff = { kind: 'reach', turns: 2, stacks: 3 }; d.crit = (d.crit ?? 0) + 10; }),
  M('am_ligera', 'flecha', 'Flecha ligera', 'Cuesta 1 PA menos.', (d) => { d.ap = Math.max(1, d.ap - 1); }),
  M('am_doble', 'tiro_rasante', 'Rasante doble', '+30% de daño y empuja 2 casillas.', (d) => { more(d, 1.3); d.push = 2; }),
  M('am_enredo', 'tiro_rasante', 'Rasante enredador', 'Quita 2 PM al objetivo.', (d) => { d.status = { kind: 'slow', turns: 1, stacks: 2 }; }),
  M('am_veneno', 'flecha', 'Flecha venenosa', 'Envenena x2 durante 2 turnos.', (d) => { d.status = { kind: 'poison', turns: 2, stacks: 2 }; }),
  M('am_salvaje', 'ojo_halcon', 'Vínculo salvaje', 'Además te cura 10.', (d) => { d.heal = (d.heal ?? 0) + 10; }),
  M('am_marcadora', 'flecha', 'Flecha marcadora', 'Marca al objetivo 2 turnos.', (d) => { d.extraStatus = { kind: 'mark', turns: 2 }; }),
  // Hechicera Zorro
  M('zm_orbe_intenso', 'z_orbe', 'Orbe intenso', '+30% de daño.', (d) => { more(d, 1.3); }),
  M('zm_encanto_largo', 'z_encanto', 'Encanto prolongado', 'El encanto dura 2 turnos: el enemigo lo sufre dos veces seguidas.', (d) => { d.status = { kind: 'charm', turns: 2 }; }),
  M('zm_impulso_radio', 'z_impulso', 'Rastreo espiritual', 'El proyectil busca enemigos a 6 casillas en vez de 4.', (d) => { if (d.followUp) d.followUp = { ...d.followUp, radius: 6 }; }),
  M('zm_impulso_veloz', 'z_impulso', 'Impulso amplio', 'Puedes desplazarte hasta 4 casillas.', (d) => { d.range = [1, 4]; }),
  // Pícaro
  M('pm_untada', 'punalada', 'Hoja untada', 'Envenena x2 durante 2 turnos.', (d) => { d.status = { kind: 'poison', turns: 2, stacks: 2 }; }),
  M('pm_cuchillo_ven', 'cuchillo', 'Cuchillo envenenado', 'Envenena 3 turnos.', (d) => { d.status = { kind: 'poison', turns: 3, stacks: 1 }; }),
  M('pm_letal', 'punalada', 'Puñalada letal', '+25% de crítico.', (d) => { d.crit = (d.crit ?? 0) + 25; }),
  M('pm_emboscada', 'desvanecer', 'Emboscada', 'Además ganas +40% de daño mientras dura.', (d) => { d.extraStatus = undefined; d.buff = { kind: 'invis', turns: 2 }; d.selfBuff2 = { kind: 'empower', turns: 2, stacks: 40 }; }),
  M('pm_cegador', 'cuchillo', 'Cuchillo cegador', 'Quita 1 PA al objetivo.', (d) => { d.drainAp = (d.drainAp ?? 0) + 1; }),
  M('pm_sombra', 'desvanecer', 'Sombra veloz', 'Además ganas +2 PM.', (d) => { d.selfMp = (d.selfMp ?? 0) + 2; }),
  M('pm_salto', 'punalada', 'Golpe y salto', 'Tras golpear retrocedes 2 casillas.', (d) => { d.retreat = 2; }),
  M('pm_rapido', 'cuchillo', 'Lanzamiento rápido', 'Cuesta 1 PA menos.', (d) => { d.ap = Math.max(1, d.ap - 1); }),
] as BoonMod[]).map((m) => [m.id, m]));
