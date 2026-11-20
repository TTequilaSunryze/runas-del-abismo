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

/** v12: «más daño» es un bono plano (+1 por cada 10% del antiguo multiplicador). */
const more = (d: SpellDef, k: number): void => { const add = Math.round((k - 1) * 10); if (d.dmg) d.dmg = [d.dmg[0] + add, d.dmg[1] + add]; };
const M = (id: string, target: string, name: string, text: string, apply: (d: SpellDef) => void): BoonMod => ({ id, target, name, text, apply });

export const BOON_MODS: Record<string, BoonMod> = Object.fromEntries(([
  // Guerrero
  M('gm_filo', 'tajo', 'Filo templado', '+3 de daño y +15% de crítico.', (d) => { more(d, 1.3); d.crit = (d.crit ?? 0) + 15; }),
  M('gm_demoledor', 'hachazo', 'Hachazo demoledor', 'Deja al objetivo Expuesto: −3 de armadura durante 2 turnos.', (d) => { d.extraStatus = { kind: 'exposed', turns: 2, stacks: 3 }; }),
  M('gm_insaciable', 'sed_sangre', 'Sed insaciable', 'El bonus de daño sube a +5.', (d) => { d.buff = { kind: 'empower', turns: 2, stacks: 5 }; }),
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
  M('mm_sobrecarga', 'escudo_arcano', 'Sobrecarga', 'El bonus de daño sube a +3.', (d) => { d.buff = { kind: 'empower', turns: 2, stacks: 3 }; }),
  M('mm_doble', 'dardo', 'Proyectil doble', '+4 de daño.', (d) => { more(d, 1.4); }),
  // Clérigo
  M('cm_sanador', 'castigo', 'Castigo sanador', 'Te curas la mitad del daño que haces.', (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.5; }),
  M('cm_compartido', 'fervor', 'Fervor compartido', 'También cura a los aliados a 2 casillas.', (d) => { d.area = 2; }),
  M('cm_juicio', 'maza', 'Maza del juicio', 'Marca al objetivo 2 turnos (+2 de daño recibido).', (d) => { d.status = { kind: 'mark', turns: 2 }; }),
  M('cm_cegador', 'castigo', 'Castigo cegador', 'Quita 1 PA al objetivo.', (d) => { d.drainAp = (d.drainAp ?? 0) + 1; }),
  M('cm_protector', 'fervor', 'Fervor protector', 'Además te da un escudo de 15.', (d) => { d.shield = (d.shield ?? 0) + 15; }),
  M('cm_bendita', 'maza', 'Maza bendita', 'Además ganas un escudo de 8.', (d) => { d.selfShield = (d.selfShield ?? 0) + 8; }),
  M('cm_sangrienta', 'maza', 'Maza sangrienta', 'Te curas el 40% del daño que haces.', (d) => { d.lifesteal = (d.lifesteal ?? 0) + 0.4; }),
  M('cm_ardiente', 'castigo', 'Castigo abrasador', 'Quema 2 turnos.', (d) => { d.status = { kind: 'burn', turns: 2 }; }),
  // Arquero
  M('am_acero', 'flecha', 'Punta de acero', 'Ignora la armadura.', (d) => { d.pierce = true; }),
  M('am_aguila', 'ojo_halcon', 'Ojo de águila', '+3 de alcance (en vez de +2) y +10% de crítico al disparar.', (d) => { d.buff = { kind: 'reach', turns: 2, stacks: 3 }; d.crit = (d.crit ?? 0) + 10; }),
  M('am_ligera', 'flecha', 'Flecha ligera', 'Cuesta 1 PA menos.', (d) => { d.ap = Math.max(1, d.ap - 1); }),
  M('am_doble', 'tiro_rasante', 'Rasante doble', '+3 de daño y empuja 2 casillas.', (d) => { more(d, 1.3); d.push = 2; }),
  M('am_enredo', 'tiro_rasante', 'Rasante enredador', 'Quita 2 PM al objetivo.', (d) => { d.status = { kind: 'slow', turns: 1, stacks: 2 }; }),
  M('am_veneno', 'flecha', 'Flecha venenosa', 'Envenena x2 durante 2 turnos.', (d) => { d.status = { kind: 'poison', turns: 2, stacks: 2 }; }),
  M('am_salvaje', 'ojo_halcon', 'Vínculo salvaje', 'Además te cura 10.', (d) => { d.heal = (d.heal ?? 0) + 10; }),
  M('am_ignea', 'a_ignea', 'Brasa', 'La flecha ígnea explota en área 1.', (d) => { d.area = 1; }),
  M('am_marcadora', 'flecha', 'Flecha marcadora', 'Marca al objetivo 2 turnos.', (d) => { d.extraStatus = { kind: 'mark', turns: 2 }; }),
  // Hechicera Zorro
  M('zm_orbe_intenso', 'z_orbe', 'Orbe intenso', '+2 de daño.', (d) => { more(d, 1.25); }),
  M('zm_encanto_largo', 'z_encanto', 'Encanto irresistible', 'Atrae 3 casillas en vez de 2 y quita 1 PM.', (d) => { d.pull = 3; d.status = { kind: 'slow', turns: 1, stacks: 1 }; }),
  M('zm_impulso_radio', 'z_impulso', 'Rastreo espiritual', 'El proyectil busca enemigos a 6 casillas en vez de 4.', (d) => { if (d.followUp) d.followUp = { ...d.followUp, radius: 6 }; }),
  M('zm_impulso_veloz', 'z_impulso', 'Impulso amplio', 'Puedes desplazarte hasta 4 casillas.', (d) => { d.range = [1, 4]; }),
  M('zm_fuego_vivo', 'z_fuego', 'Fuego vivo', '+2 de daño y quema 3 turnos.', (d) => { more(d, 1.2); d.status = { kind: 'burn', turns: 3 }; }),
  // Tejedora de Esferas
  M('tm_cinco', 't_pulso', 'Constelación', 'Hasta 4 esferas a la vez y duran 3 turnos.', (d) => { d.sphere = { turns: 3, max: 4 }; }),
  M('tm_pulso', 't_pulso', 'Pulso profundo', '+2 de daño.', (d) => { more(d, 1.25); }),
  M('tm_descarga', 't_descarga', 'Descarga total', '+4 de daño extra por esfera.', (d) => { d.consume = { per: (d.consume?.per ?? 16) + 4 }; }),
  M('tm_dispersion', 't_dispersion', 'Dispersión rápida', 'Cuesta 1 PA menos.', (d) => { d.ap = Math.max(1, d.ap - 1); }),
  M('tm_vacio', 't_vacio', 'Vacío profundo', 'Ignora la armadura.', (d) => { d.pierce = true; }),
  // Acechador de Sombras
  M('sm_shuriken', 's_shuriken', 'Shuriken afilado', '+2 de daño y +10% de crítico.', (d) => { more(d, 1.25); d.crit = (d.crit ?? 0) + 10; }),
  M('sm_tajo', 's_tajo', 'Tajo lisiador', 'Quita 2 PM en vez de 1.', (d) => { d.status = { kind: 'slow', turns: 1, stacks: 2 }; }),
  M('sm_sombra_larga', 's_sombra', 'Sombra persistente', 'La Sombra dura 3 turnos.', (d) => { if (d.shadow) d.shadow = { ...d.shadow, turns: 3 }; }),
  M('sm_eco', 's_sombra', 'Eco profundo', 'La Sombra replica al 65% en vez del 50%.', (d) => { if (d.shadow) d.shadow = { ...d.shadow, echo: 0.65 }; }),
  M('sm_hoja', 's_hoja', 'Veneno letal', 'Envenena x3 en vez de x2.', (d) => { d.status = { kind: 'poison', turns: 3, stacks: 3 }; }),
  // Carcelero de Almas
  M('km_gancho_largo', 'k_sentencia', 'Cadena larga', 'Alcance 1-6.', (d) => { d.range = [1, 6]; }),
  M('km_gancho_pesado', 'k_sentencia', 'Cadena de plomo', 'Quita 3 PA en vez de 2.', (d) => { d.drainAp = 3; }),
  M('km_desollar', 'k_guadana', 'Desollar', '+2 de daño y deja Expuesto: −2 de armadura 2 turnos.', (d) => { more(d, 1.25); d.extraStatus = { kind: 'exposed', turns: 2, stacks: 2 }; }),
  M('km_farol_cura', 'k_linterna', 'Linterna de vida', 'Además cura 10 a los aliados pegados a ella.', (d) => { if (d.lantern) d.lantern = { ...d.lantern, heal: 10 }; }),
  M('km_farol_largo', 'k_linterna', 'Linterna eterna', 'Dura un turno más y alcance 1-6.', (d) => { if (d.lantern) d.lantern = { ...d.lantern, turns: d.lantern.turns + 1 }; d.range = [1, 6]; }),
  M('km_azote', 'k_azote', 'Azote pesado', 'Además quita 1 PM a todos los alcanzados.', (d) => { d.status = { kind: 'slow', turns: 1, stacks: 1 }; }),
  // Pícaro
  M('pm_untada', 'punalada', 'Hoja untada', 'Envenena x2 durante 2 turnos.', (d) => { d.status = { kind: 'poison', turns: 2, stacks: 2 }; }),
  M('pm_cuchillo_ven', 'cuchillo', 'Cuchillo envenenado', 'Envenena 3 turnos.', (d) => { d.status = { kind: 'poison', turns: 3, stacks: 1 }; }),
  M('pm_letal', 'punalada', 'Puñalada letal', '+25% de crítico.', (d) => { d.crit = (d.crit ?? 0) + 25; }),
  M('pm_emboscada', 'desvanecer', 'Emboscada', 'Además ganas +4 de daño mientras dura.', (d) => { d.extraStatus = undefined; d.buff = { kind: 'invis', turns: 2 }; d.selfBuff2 = { kind: 'empower', turns: 2, stacks: 4 }; }),
  M('pm_cegador', 'cuchillo', 'Cuchillo cegador', 'Quita 1 PA al objetivo.', (d) => { d.drainAp = (d.drainAp ?? 0) + 1; }),
  M('pm_sombra', 'desvanecer', 'Sombra veloz', 'Además ganas +2 PM.', (d) => { d.selfMp = (d.selfMp ?? 0) + 2; }),
  M('pm_salto', 'punalada', 'Golpe y salto', 'Tras golpear retrocedes 2 casillas.', (d) => { d.retreat = 2; }),
  M('pm_rapido', 'cuchillo', 'Lanzamiento rápido', 'Cuesta 1 PA menos.', (d) => { d.ap = Math.max(1, d.ap - 1); }),
] as BoonMod[]).map((m) => [m.id, m]));

/** Bendiciones de clase (pasivas): un rasgo para el motor y, a veces, un cambio en un hechizo. No cuentan como mejora del hechizo. */
export interface BlessingDef {
  id: string;
  cls: string;
  name: string;
  icon: string;
  text: string;
  trait?: string;
  mod?: { target: string; apply: (d: SpellDef) => void };
}
const B = (d: BlessingDef): BlessingDef => d;
export const BLESSINGS: Record<string, BlessingDef> = Object.fromEntries(([
  // Hechicera Zorro
  B({ id: 'zb_esencia', cls: 'zorro', name: 'Esencia desbordante', icon: '💗', trait: 'esencia2', text: 'El Robo de esencia se activa con 2 cargas en vez de 3; si tienes la vida al máximo, la curación sobrante se vuelve escudo.' }),
  B({ id: 'zb_danza', cls: 'zorro', name: 'Danza de las nueve colas', icon: '🦊', trait: 'danza', text: 'Tras usar Impulso espiritual, tu siguiente hechizo de ese turno cuesta 1 PA menos.' }),
  B({ id: 'zb_mirada', cls: 'zorro', name: 'Mirada hipnótica', icon: '👁️', trait: 'mirada', text: 'Encanto dura 1 turno más en enemigos normales y da 1 carga de Robo de esencia al impactar.' }),
  // Tejedora de Esferas
  B({ id: 'tb_poder', cls: 'esferas', name: 'Poder ilimitado', icon: '🔮', trait: 'poder', text: 'Hasta 5 Esferas oscuras a la vez y duran 1 turno más.' }),
  B({ id: 'tb_onda', cls: 'esferas', name: 'Onda expansiva', icon: '🌊', text: 'Dispersión llega 1 casilla más lejos y las esferas empujadas hacen +3 de daño al chocar.',
    mod: { target: 't_dispersion', apply: (d) => { if (d.cone) d.cone++; if (d.sphereHit) d.sphereHit = { ...d.sphereHit, dmg: [d.sphereHit.dmg[0] + 3, d.sphereHit.dmg[1] + 3] }; } } }),
  B({ id: 'tb_eco', cls: 'esferas', name: 'Eco oscuro', icon: '🌑', trait: 'eco_oscuro', text: 'Cada vez que Descarga desatada mata a un enemigo, caen 2 Esferas oscuras en su casilla y alrededor.' }),
  // Carcelero de Almas
  B({ id: 'kb_condena', cls: 'carcelero', name: 'Condenación eterna', icon: '⛓️', trait: 'condena', text: 'Los enemigos que engancha, empuja o aturde tienen un 50% de soltar un Alma aunque no mueran.' }),
  B({ id: 'kb_faro', cls: 'carcelero', name: 'Faro de las sombras', icon: '🏮', trait: 'faro', text: 'La Linterna espectral dura 2 turnos y cura 10 al aliado que la toma para teletransportarse.',
    mod: { target: 'k_linterna', apply: (d) => { if (d.lantern) d.lantern = { ...d.lantern, turns: 2 }; } } }),
  B({ id: 'kb_guadana', cls: 'carcelero', name: 'Guadaña segadora', icon: '💀', trait: 'guadana', text: 'Tras Sentencia de muerte o Corte de Guadaña, tu siguiente ataque de ese turno hace +2 de daño por cada Alma de este combate (máx. +20).' }),
  // Acechador de Sombras
  B({ id: 'sb_maestro', cls: 'acechador', name: 'Maestro de las sombras', icon: '👥', trait: 'maestro', text: 'Hasta 2 Sombras a la vez, y todas replican tus habilidades de daño.' }),
  B({ id: 'sb_desprecio', cls: 'acechador', name: 'Desprecio por los débiles', icon: '🗡️', trait: 'desprecio', text: 'Tú y tus sombras hacéis +3 de daño a enemigos por debajo de la mitad de su vida.' }),
  B({ id: 'sb_persistente', cls: 'acechador', name: 'Sombra persistente', icon: '⏳', trait: 'persistente', text: 'Tus Sombras duran 1 turno más y cada intercambio con una Sombra te da +2 PM.' }),
  // Bárbaro Desatado
  B({ id: 'bb_inagotable', cls: 'barbaro', name: 'Furia inagotable', icon: '🔥', trait: 'inagotable', text: 'Sed de batalla solo consume la mitad de tu Furia.' }),
  B({ id: 'bb_negarse', cls: 'barbaro', name: 'Negarse a morir', icon: '💢', trait: 'negarse', text: 'Una vez por combate, si recibes un golpe letal con al menos 60 de Furia, sobrevives con 1 de vida y gastas esa Furia.' }),
  B({ id: 'bb_torbellino', cls: 'barbaro', name: 'Torbellino sangriento', icon: '🌀', trait: 'torbellino', text: 'Embiste giratorio cuesta 1 PA menos si golpea a 2 o más enemigos.' }),
  // --- v11: 7 bendiciones más por clase ---
  // Hechicera Zorro
  B({ id: 'zb_fuego', cls: 'zorro', name: 'Zorro de fuego', icon: '🔥', trait: 'zfuego', text: 'Tus hechizos en línea recta (como Orbe del engaño) queman al objetivo 2 turnos.' }),
  B({ id: 'zb_reflejo', cls: 'zorro', name: 'Reflejo ilusorio', icon: '🪞', trait: 'reflejo', text: 'Al recibir un ataque cuerpo a cuerpo, creas un señuelo que atrae el siguiente golpe y empujas 1 casilla al atacante (1 vez por ronda).' }),
  B({ id: 'zb_niebla', cls: 'zorro', name: 'Caminante de la niebla', icon: '🌫️', trait: 'niebla', text: 'Tras usar un hechizo de desplazamiento, el placaje no te afecta el resto del turno.' }),
  B({ id: 'zb_sinfonia', cls: 'zorro', name: 'Sinfonía mística', icon: '🎶', trait: 'sinfonia', text: 'Cada vez que llenas la Esencia, tu próximo hechizo de 3 PA o más cuesta 1 PA menos.' }),
  B({ id: 'zb_cola', cls: 'zorro', name: 'Cola de zorro espectral', icon: '🦊', text: 'Vínculo etéreo además ralentiza al enemigo −1 PM en su siguiente turno.',
    mod: { target: 'z_vinculo', apply: (d) => { d.extraStatus = { kind: 'slow', turns: 1, stacks: 1 }; } } }),
  B({ id: 'zb_voluntad', cls: 'zorro', name: 'Voluntad indómita', icon: '💪', trait: 'indomita', text: 'Si empiezas tu turno por debajo del 25% de vida, ganas 1 carga de Esencia.' }),
  B({ id: 'zb_aura', cls: 'zorro', name: 'Aura de astucia', icon: '✨', trait: 'astucia', text: 'Los enemigos pegados a ti tienen un 10% menos de probabilidad de crítico.' }),
  // Tejedora de Esferas
  B({ id: 'tb_vortice', cls: 'esferas', name: 'Vórtice resonante', icon: '💫', trait: 'resonante', text: 'Cuando una esfera tuya queda pegada a otra (al crearla o al empujarla), estallan: 4-6 de daño a los enemigos a 1 casilla.' }),
  B({ id: 'tb_orbita', cls: 'esferas', name: 'Órbita protectora', icon: '🛡️', trait: 'orbitaprot', text: 'Si tienes 2 o más esferas al empezar tu turno, ganas un escudo del 10% de tu vida máxima.' }),
  B({ id: 'tb_gravedad', cls: 'esferas', name: 'Gravedad alterada', icon: '🧲', trait: 'gravedad', text: 'Los enemigos que se mueven junto a una de tus esferas pierden 1 PM (1 vez por turno).' }),
  B({ id: 'tb_traccion', cls: 'esferas', name: 'Tracción astral', icon: '🌌', trait: 'traccion', text: 'Transfusión de vacío además atrae 1 casilla hacia la esfera consumida al enemigo más cercano.' }),
  B({ id: 'tb_singularidad', cls: 'esferas', name: 'Singularidad perfecta', icon: '🕳️', trait: 'singperfecta', text: 'Singularidad atrae hacia su centro a los enemigos a 2 casillas antes de hacer daño.' }),
  B({ id: 'tb_nucleo', cls: 'esferas', name: 'Núcleo inestable', icon: '💥', trait: 'nucleo', text: 'Cuando consumes una esfera (Descarga desatada, Transfusión, Órbita defensiva), estalla: 3-4 de daño mágico a los enemigos pegados a ella.' }),
  B({ id: 'tb_dominio', cls: 'esferas', name: 'Dominio esférico', icon: '🎯', trait: 'dominio', text: 'Tus hechizos de esferas cuestan 1 PA menos si estás a 2 casillas o menos de una esfera tuya.' }),
  // Acechador de Sombras
  B({ id: 'sb_doble', cls: 'acechador', name: 'Doble filo letal', icon: '⚔️', trait: 'doblefilo', text: 'Si una Sombra tuya está al otro lado del objetivo, tus críticos contra él ignoran la armadura (también en Convergencia letal).' }),
  B({ id: 'sb_medianoche', cls: 'acechador', name: 'Paso de medianoche', icon: '🌙', trait: 'medianoche', text: 'Al volverte invisible con un hechizo, te curas el 5% de tu vida máxima.' }),
  B({ id: 'sb_ejecucion', cls: 'acechador', name: 'Ejecución sigilosa', icon: '🔪', trait: 'ejecsig', text: 'Si rematas a un enemigo cuerpo a cuerpo siendo invisible o tras aparecer a su espalda, ganas 1 PM y el placaje no te afecta el resto del turno.' }),
  B({ id: 'sb_reflejo', cls: 'acechador', name: 'Reflejo oscuro', icon: '🌑', trait: 'reflejoscuro', text: 'Una vez por combate, si un golpe te iba a matar y tienes una Sombra, la Sombra lo recibe y estalla en humo: no recibes daño y el atacante queda Vulnerable y pierde 1 PA.' }),
  B({ id: 'sb_cuchillas', cls: 'acechador', name: 'Cuchillas gemelas', icon: '🗡️', trait: 'gemelas', text: 'Tras aparecer a la espalda de un enemigo, tu siguiente ataque cuerpo a cuerpo de ese turno hace sangrar 2 turnos.' }),
  B({ id: 'sb_manto', cls: 'acechador', name: 'Manto de la noche', icon: '🦇', trait: 'manto', text: 'Sin aliados a 3 casillas o menos, tienes +3 de Huida.' }),
  B({ id: 'sb_caceria', cls: 'acechador', name: 'Cacería coordinada', icon: '🐺', trait: 'caceria', text: 'Si una Sombra tuya remata a un enemigo, recuperas 2 PA (1 vez por turno).' }),
  // Carcelero de Almas
  B({ id: 'kb_cosecha', cls: 'carcelero', name: 'Cosecha voraz', icon: '👻', trait: 'voraz', text: 'Cada alma que absorbes con Atracción del abismo te da +1 de daño hasta el final del combate.' }),
  B({ id: 'kb_armadura', cls: 'carcelero', name: 'Armadura de los condenados', icon: '🦴', trait: 'condenados', text: 'Cada 2 almas sin gastar te dan +1 de armadura (máx. +6).' }),
  B({ id: 'kb_cadenas', cls: 'carcelero', name: 'Cadenas pesadas', icon: '⛓️', trait: 'pesadas', text: 'Tu placaje es +2 contra enemigos ralentizados, encadenados o con la Huida reducida.' }),
  B({ id: 'kb_custodia', cls: 'carcelero', name: 'Custodia espectral', icon: '🛡️', trait: 'custodia', text: 'El daño que desvías con Sacrificio del guardián te llega un 15% reducido.' }),
  B({ id: 'kb_prision', cls: 'carcelero', name: 'Prisión ineludible', icon: '🔒', trait: 'prision', text: 'Los enemigos que enganchas o aturdes quedan con la Huida reducida a la mitad 1 turno.' }),
  B({ id: 'kb_eco', cls: 'carcelero', name: 'Eco de los caídos', icon: '💀', trait: 'ecocaidos', text: 'Si un enemigo muere a 3 casillas o menos de ti y estás por debajo del 50% de vida, te curas el 8% de tu vida máxima.' }),
  B({ id: 'kb_juicio', cls: 'carcelero', name: 'Juicio del inframundo', icon: '⚖️', trait: 'juicio', text: 'Tu hechizo de mayor coste en PA te da 1 alma extra si alcanza a un élite o jefe.' }),
  // Bárbaro Desatado
  B({ id: 'bb_sangre', cls: 'barbaro', name: 'Sangre caliente', icon: '🩸', trait: 'sangrecal', text: 'Por debajo del 50% de vida, tus habilidades generan el doble de Furia.' }),
  B({ id: 'bb_imparable', cls: 'barbaro', name: 'Imparable', icon: '🐂', trait: 'imparable', text: 'Durante Frenesí imparable, cada paso desestabiliza a los enemigos normales pegados a ti: −1 PM en su turno.' }),
  B({ id: 'bb_titanico', cls: 'barbaro', name: 'Golpe titánico', icon: '🔨', trait: 'titanico', text: 'Con más de 80 de Furia, el placaje no te afecta y tus golpes cuerpo a cuerpo atraviesan el 20% de la armadura.' }),
  B({ id: 'bb_reaccion', cls: 'barbaro', name: 'Reacción visceral', icon: '😤', trait: 'visceral', text: 'Al recibir un golpe crítico ganas +15 de Furia.' }),
  B({ id: 'bb_carga', cls: 'barbaro', name: 'Carga berserker', icon: '🏃', trait: 'carga', text: 'Si empiezas tu turno con un enemigo visible en línea recta, ganas +1 PM.' }),
  B({ id: 'bb_resiliencia', cls: 'barbaro', name: 'Resiliencia salvaje', icon: '🪨', trait: 'resiliencia', text: 'Cada 20 de Furia reduce en 1 el daño físico que recibes (cada 40 de Furia, máx. 2).' }),
  B({ id: 'bb_matasangre', cls: 'barbaro', name: 'Matasangre', icon: '🩸', trait: 'matasangre', text: 'Si rematas a un enemigo cuerpo a cuerpo con la Furia al máximo, recuperas 2 PA (1 vez por turno).' }),
] as BlessingDef[]).map((b) => [b.id, b]));
