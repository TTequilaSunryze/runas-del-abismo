// Estado compartido de la interfaz y utilidades pequeñas.
import type { ClassId } from '../core/state';
import type { HeroSave, RunState } from '../game/run';
import type { Session } from '../game/session';
import type { Board } from '../render/board';

export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const params = new URLSearchParams(location.search);
export const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};
export const randomText = (n: number, chars: string): string => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => chars[b % chars.length]).join('');

const id = params.get('p') ?? store.get('rda_id') ?? randomText(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
if (!params.get('p')) store.set('rda_id', id);

export const ui = {
  root: document.getElementById('app')!,
  myId: id,
  me: { name: store.get('rda_name') ?? 'Héroe', cls: 'zorro' as ClassId, routes: ['base'] as string[] },
  session: null as Session | null,
  board: null as Board | null,
  screen: '',
  saved: null as RunState | null,
  notice: '',
  log: [] as string[],
  /** pestaña del panel lateral */
  tab: 'equipo' as 'equipo' | 'hechizos' | 'grupo',
  /** objeto seleccionado: "bag:3" o "slot:arma" */
  selItem: '',
  leaveArmed: false,
  logOpen: false,
  /** ascensión elegida (solo cuenta la del anfitrión) y reto diario */
  asc: 0,
  daily: false,
  /** pestaña de la pantalla de inicio */
  homeTab: 'jugar' as 'jugar' | 'mejoras' | 'clases' | 'logros' | 'salon' | 'diario' | 'cuenta' | 'amigos',
  /** mensajes de la pestaña de cuenta y del salón */
  acctMsg: '',
  /** lo escrito en el formulario de cuenta, para no perderlo al redibujar */
  acEmail: '',
  friendMsg: '',
  invites: [] as Array<{ from: string; code: string; at: number }>,
  /** ventana de estadísticas abierta */
  statsOpen: false,
  mapOpen: false,
  /** barras de vida visibles en el tablero */
  hpBars: true,
  /** sello del último informe de combate cerrado */
  reportClosed: -1,
  acName: '',
  hallMsg: '',
  busy: false,
  board2: null as null | Array<{ names: string; players: number; score: number; won: boolean; zone: number }> | 'cargando' | 'error',
  tutorial: 0,
  /** modificadores elegidos por el anfitrión e incluir el Abismo */
  mods: [] as string[],
  abyss: false,
  rerender: (): void => {},
};

export const mine = (run: RunState): HeroSave | undefined => run.heroes.find((h) => h.owner === ui.myId);
/** Atributo data-tip con HTML para la ayuda flotante. */
export const tip = (html: string): string => `data-tip="${esc(html)}"`;

export const today = (): string => new Date().toISOString().slice(0, 10);
