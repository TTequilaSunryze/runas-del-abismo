// Sets de equipo: 3 piezas con relación entre sí. Llevar 2 da un bonus; llevar las 3, otro mayor con un efecto propio.
import type { Item, Slot, Stats } from './items';

export interface SetDef {
  id: string;
  name: string;
  icon: string;
  /** las 3 piezas: ranura → nombre */
  pieces: Partial<Record<Slot, string>>;
  two: Stats;
  three: Stats;
  /** rasgo que da el set completo (ver Unit.traits) */
  trait?: string;
  twoText: string;
  threeText: string;
}

export const SETS: Record<string, SetDef> = Object.fromEntries(
  ([
    { id: 'vibora', name: 'Colmillos de la Víbora', icon: '🐍', pieces: { arma: 'Colmillo de Víbora', guantes: 'Garras de Víbora', anillo: 'Ojo de Víbora' },
      two: { status: 1, resPoison: 20 }, three: { power: 10 }, trait: 'venom',
      twoText: '+1 turno a tus estados, +20% res. veneno', threeText: 'Tus venenos aplican 1 carga más y +10% de daño' },
    { id: 'pira', name: 'Herederos de la Pira', icon: '🔥', pieces: { amuleto: 'Ascua de la Pira', capa: 'Manto de la Pira', casco: 'Corona de la Pira' },
      two: { power: 10, resFire: 20 }, three: { power: 6 }, trait: 'ignite',
      twoText: '+10% de daño, +20% res. fuego', threeText: 'Todo tu daño aplica Quemadura 2 turnos y +6% de daño' },
    { id: 'bastion', name: 'Guardia del Bastión', icon: '🛡️', pieces: { peto: 'Coraza del Bastión', casco: 'Yelmo del Bastión', botas: 'Grebas del Bastión' },
      two: { armor: 2, hp: 12 }, three: { hp: 10 }, trait: 'guard',
      twoText: '+2 de armadura, +12 de vida', threeText: 'Empiezas cada turno con un escudo del 15% de tu vida y +10 de vida' },
    { id: 'verdugo', name: 'Oficio del Verdugo', icon: '🗡️', pieces: { arma: 'Hacha del Verdugo', capa: 'Capucha del Verdugo', guantes: 'Puños del Verdugo' },
      two: { crit: 10 }, three: { crit: 8 }, trait: 'execute',
      twoText: '+10% de crítico', threeText: 'Tus críticos hacen el doble de daño (en vez de x1,5) y +8% de crítico' },
    { id: 'peregrino', name: 'Senda del Peregrino', icon: '👣', pieces: { botas: 'Sandalias del Peregrino', amuleto: 'Concha del Peregrino', anillo: 'Sello del Peregrino' },
      two: { initiative: 6, mp: 1 }, three: { ap: 1 },
      twoText: '+6 de iniciativa, +1 PM', threeText: '+1 PA' },
    { id: 'santuario', name: 'Voto del Santuario', icon: '🕊️', pieces: { casco: 'Mitra del Santuario', amuleto: 'Lágrima del Santuario', guantes: 'Manos del Santuario' },
      two: { hp: 12, resShadow: 20 }, three: { hp: 8 }, trait: 'mender',
      twoText: '+12 de vida, +20% res. sombra', threeText: 'Tus curaciones y escudos son un 30% mayores y +8 de vida' },
  ] as SetDef[]).map((s) => [s.id, s]),
);

/** Cuántas piezas de cada set hay equipadas. */
export function setCounts(equip: Partial<Record<Slot, Item>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of Object.values(equip)) if (it?.set && SETS[it.set]) out[it.set] = (out[it.set] ?? 0) + 1;
  return out;
}

/** Estadísticas y rasgos que dan los sets equipados. */
export function setBonus(equip: Partial<Record<Slot, Item>>): { stats: Stats[]; traits: string[] } {
  const stats: Stats[] = [], traits: string[] = [];
  for (const [id, n] of Object.entries(setCounts(equip))) {
    const def = SETS[id]!;
    if (n >= 2) stats.push(def.two);
    if (n >= 3) { stats.push(def.three); if (def.trait) traits.push(def.trait); }
  }
  return { stats, traits };
}
