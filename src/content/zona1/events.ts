// Zona 1: eventos de grupo. Se vota y el resultado afecta a todos por igual.
import type { StatKey } from '../../core/items/items';
import type { HeroSave, RunState } from '../../game/run';
import { heroMaxHp } from '../../game/run';

export interface EventOption {
  label: string;
  hint: string;
  /** aplica el efecto y devuelve el texto del desenlace */
  apply: (run: RunState) => string;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

export const boon = (h: HeroSave, k: StatKey, v: number): void => { h.boon[k] = (h.boon[k] ?? 0) + v; };
export const healPct = (h: HeroSave, pct: number): void => { h.hp = Math.min(heroMaxHp(h), h.hp + Math.ceil(heroMaxHp(h) * pct)); };
export const losePct = (h: HeroSave, pct: number): void => { h.hp = Math.max(1, h.hp - Math.ceil(h.hp * pct)); };

export const ZONA1_EVENTS: EventDef[] = [
  {
    id: 'pacto', title: 'El Pacto del Osario',
    text: 'Un muro de calaveras susurra al unísono: os ofrece fuerza, a cambio de una parte de vosotros que no volverá.',
    options: [
      { label: 'Aceptar el pacto', hint: 'Todos: +20% de daño y -12 de vida máxima, hasta el final.', apply: (run) => { for (const h of run.heroes) { boon(h, 'power', 20); boon(h, 'hp', -12); } return 'Las calaveras ríen. Os sentís más fuertes y más vacíos.'; } },
      { label: 'Rechazarlo', hint: 'Todos recuperan un 15% de vida.', apply: (run) => { for (const h of run.heroes) healPct(h, 0.15); return 'El muro calla. Aprovecháis el silencio para descansar.'; } },
    ],
  },
  {
    id: 'ofrendas', title: 'La Puerta de las Ofrendas',
    text: 'Una puerta de bronce con un cuenco seco. La inscripción dice: «Lo que se da en sangre, se devuelve en hierro».',
    options: [
      { label: 'Ofrecer sangre', hint: 'Todos pierden el 25% de su vida actual y ganan +2 de armadura y +5% de crítico.', apply: (run) => { for (const h of run.heroes) { losePct(h, 0.25); boon(h, 'armor', 2); boon(h, 'crit', 5); } return 'El cuenco se llena y el bronce os reconoce.'; } },
      { label: 'Pasar de largo', hint: 'No ocurre nada.', apply: () => 'La puerta permanece cerrada.' },
    ],
  },
  {
    id: 'cripta', title: 'La Cripta Sellada',
    text: 'Tras una losa agrietada brilla el metal de un ajuar funerario. También se oye algo que respira.',
    options: [
      { label: 'Romper el sello', hint: 'El próximo combate es una emboscada (+2 enemigos), pero su botín será épico o mejor y con 4 opciones.', apply: (run) => { run.ambush = true; return 'La losa cede. Algo se despierta al otro lado.'; } },
      { label: 'Dejarla en paz', hint: 'No ocurre nada.', apply: () => 'Algunos muertos merecen seguir dormidos.' },
    ],
  },
  {
    id: 'juicio', title: 'El Juicio de los Muertos',
    text: 'Un tribunal de espectros exige que alguien cargue con las culpas del grupo.',
    options: [
      { label: 'Que cargue el más fuerte', hint: 'El héroe con más vida pierde el 40% de la suya; el resto se cura por completo.', apply: (run) => { const top = [...run.heroes].sort((a, b) => b.hp - a.hp)[0]!; for (const h of run.heroes) { if (h === top && run.heroes.length > 1) losePct(h, 0.4); else healPct(h, 1); } return `${top.name} acepta la sentencia y los demás quedan absueltos.`; } },
      { label: 'Repartir la culpa', hint: 'Todos recuperan un 10% de vida y ganan +3 de iniciativa.', apply: (run) => { for (const h of run.heroes) { healPct(h, 0.1); boon(h, 'initiative', 3); } return 'El tribunal se disuelve entre murmullos.'; } },
    ],
  },
];
