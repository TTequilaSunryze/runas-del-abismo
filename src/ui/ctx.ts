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
  /** aviso del panel de testers */
  testerMsg: '',
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
  homeTab: 'refugio' as 'refugio' | 'jugar' | 'tienda' | 'clases' | 'logros' | 'archivo' | 'salon' | 'diario' | 'cuenta' | 'amigos',
  /** Archivo del Abismo: categoría, filtro de estado y entrada abierta */
  arcCat: 'bestiary' as 'bestiary' | 'grimoire' | 'relics' | 'atlas' | 'chronicles' | 'contracts',
  /** filtro secundario: zona (z1…z4) en el Bestiario, clase en el Grimorio, rareza en las Reliquias */
  arcF2: '',
  /** subcategoría del Atlas (zones/events/pacts/omens) o de las Crónicas (stories/secrets/milestones) */
  arcSub: '',
  arcFilter: 'all' as 'all' | 'found' | 'missing',
  arcOpen: '',
  /** Contratos: periódicos, especiales o títulos y marcos */
  /** descubrimientos de la expedición en curso (para la pantalla final): código de sala → avisos */
  runFinds: { code: '', list: [] as Array<{ icon: string; text: string }> },
  /** tienda: categoría, filtros, clase para equipar, confirmación pendiente y mensaje */
  kitSlot: 0, shopCat: 'skin' as string, shopRar: '' as string, shopCls: '' as string, shopMine: false, shopConfirm: '', shopMsg: '',
  cview: 'periodic' as 'periodic' | 'special' | 'cosmetic',
  /** mensajes de la pestaña de cuenta y del salón */
  acctMsg: '',
  /** lo escrito en el formulario de cuenta, para no perderlo al redibujar */
  acEmail: '',
  friendMsg: '',
  invites: [] as Array<{ from: string; code: string; at: number }>,
  /** ventana de estadísticas abierta */
  statsOpen: false,
  /** cartel «Has obtenido…» tras recoger botín o una recompensa */
  got: null as null | { title: string; html: string },
  mapOpen: false,
  /** móvil: ficha lateral (equipo, hechizos, grupo) desplegada */
  sideOpen: false,
  /** ficha abierta: dueño del héroe o «*» para comparar el grupo */
  statsOf: '',
  /** «Estoy listo» en la sala de espera */
  lobbyReady: false,
  /** forja: objeto, afijo y hechizo elegidos */
  forgeRef: '',
  forgeAffix: -1,
  forgeSpell: '',
  /** clase recién elegida (animación de selección) */
  picked: null as null | { cls: string; at: number },
  /** último hechizo lanzado (cartel flotante sobre el tablero) */
  toast: null as null | { text: string; team: string; at: number },
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
  /** fuerza el redibujado de la sala (selección de héroe / Asentamiento) */
  refreshLobby: (): void => {},
  /** portada: menú principal o una de sus pantallas */
  front: 'menu' as 'menu' | 'play' | 'multi' | 'settings' | 'account',
  /** «Abandonar partida» pide un segundo clic */
  abandonArmed: false,
  /** dentro de la sala: elegir héroe o el Asentamiento */
  lobbyStage: 'hero' as 'hero' | 'settlement',
  /** capa abierta sobre la selección de héroe: habilidades o modificadores */
  overlay: '' as '' | 'kit' | 'mods',
  /** edificio abierto en el Asentamiento (muestra el panel de ui.homeTab) */
  bldgOpen: false,
  /** lugar del Asentamiento en el que se ha entrado ('' = panorama) */
  place: '' as '' | 'taberna',
  /** conversación abierta: habitante, nodo y línea */
  talk: null as null | { npc: string; node: string; line: number },
};

export const mine = (run: RunState): HeroSave | undefined => run.heroes.find((h) => h.owner === ui.myId);
/** Atributo data-tip con HTML para la ayuda flotante. */
export const tip = (html: string): string => `data-tip="${esc(html)}"`;

export const today = (): string => new Date().toISOString().slice(0, 10);
