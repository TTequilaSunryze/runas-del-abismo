// Zona 1: equipo temático de Las Catacumbas Olvidadas.
import type { ItemTheme } from '../../core/items/items';

export const ZONA1_ITEMS: ItemTheme = {
  names: {
    casco: ['Capucha del Sepulturero', 'Yelmo de Cripta', 'Cráneo Hueco'],
    capa: ['Sudario Raído', 'Manto de Polvo', 'Capa del Velatorio'],
    arma: ['Hoz del Osario', 'Fémur Afilado', 'Cirio Negro', 'Maza de Lápida'],
    peto: ['Cota del Penitente', 'Peto de Costillas', 'Hábito Remendado'],
    anillo: ['Sello del Prior', 'Anillo de Falange', 'Aro de Cera'],
    amuleto: ['Relicario Agrietado', 'Colgante de Diente', 'Rosario de Huesos'],
    botas: ['Sandalias de Peregrino', 'Botas de Enterrador', 'Grebas Roídas'],
    guantes: ['Guanteletes de Hueso', 'Vendas del Embalsamador', 'Mitones de Sacristán'],
  },
  suffixes: ['del Osario', 'de la Cripta', 'del Velatorio', 'Olvidado', 'del Último Rezo', 'de Ceniza Fría'],
  legendaries: [
    { slot: 'arma', name: 'Guadaña del Prior Hueco', rarity: 3, stats: { power: 22, crit: 10, ap: 1 }, lore: 'Segó más plegarias que vidas.', passive: { trait: 'execute', text: 'Tus críticos hacen el doble de daño.' } },
    { slot: 'peto', name: 'Coraza del Osario Viviente', rarity: 3, stats: { hp: 30, armor: 3 }, lore: 'Cruje cuando su dueño duda.', passive: { trait: 'guard', text: 'Empiezas cada turno con un escudo del 15% de tu vida (máx. 24).' } },
    { slot: 'botas', name: 'Pasos del Que No Descansa', rarity: 3, stats: { mp: 1, initiative: 10, hp: 12 }, lore: 'Nunca dejaron huella.', passive: { trait: 'incansable', text: 'Si empiezas tu turno pegado a un enemigo, ganas +1 PM.' } },
    { slot: 'amuleto', name: 'Corazón Embalsamado', rarity: 3, stats: { hp: 20, power: 14, ap: 1 }, lore: 'Aún late, muy despacio.', passive: { trait: 'regen', text: 'Recuperas el 8% de tu vida máxima al empezar cada turno.' } },
    { slot: 'casco', name: 'Corona de las Mil Velas', rarity: 3, stats: { hp: 18, armor: 2, initiative: 8 }, lore: 'La cera nunca termina de caer.', passive: { trait: 'ignite', text: 'Tus golpes queman al objetivo 2 turnos.' } },
    { slot: 'anillo', name: 'Alianza de la Viuda Eterna', rarity: 3, stats: { crit: 14, power: 12, ap: 1 }, lore: 'Prometió esperar. Sigue esperando.', passive: { trait: 'viuda', text: 'Si cae un aliado, ganas +20% de daño hasta el final del combate.' } },
  ],
};
