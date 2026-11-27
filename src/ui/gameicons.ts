// Iconos del juego (public/icons, recortados de los atlas de arte): sustituyen a los emojis de la interfaz.
// Un único mapa emoji → icono y un observador que los cambia en cualquier pantalla, tooltip o ventana que se dibuje.
// Los iconos de los hechizos de los héroes son imágenes propias (spellicons) y no pasan por aquí.

/** Ruta pública de un icono (public/icons/<nombre>.png). */
export const iconUrl = (name: string): string => `${import.meta.env.BASE_URL}icons/${name}.png`;
/** Icono en línea, del tamaño del texto que lo rodea. */
export const gi = (name: string, cls = ''): string => `<img class="gi ${cls}" src="${iconUrl(name)}" alt="" draggable="false">`;

/** Emoji de la interfaz → icono. Los signos que no son iconos (flechas, ✔, ✕, ★…) se quedan como están. */
export const EMOJI_ICON: Record<string, string> = {
  '💰': 'oro', '🪙': 'oro', '✨': 'ecos', '🔔': 'escofinas', '❤': 'vida', '💗': 'vida', '💚': 'curacion', '💧': 'curacion',
  '⚔': 'combate', '🏟': 'combate', '☠': 'calavera_cuernos', '💀': 'calavera', '👑': 'nodo_jefe', '❓': 'desconocido', '❔': 'desconocido',
  '🎁': 'nodo_tesoro', '🔥': 'fuego', '🌡': 'fuego', '⚒': 'forja', '🛠': 'forja', '🔧': 'forja', '🧰': 'forja', '🕯': 'vela', '⛓': 'nodo_jaula',
  '🩸': 'sangre', '🗝': 'llave', '🔓': 'llave', '🔒': 'st_silencio', '🛡': 'escudo', '🔮': 'orbe', '🧪': 'pocion', '🎯': 'st_marca',
  '🗺': 'mapa', '📜': 'pergamino', '📖': 'libro_abierto', '📚': 'libros', '📋': 'rollo', '👥': 'grupo', '🌑': 'vacio', '🕳': 'vacio', '🌌': 'vacio',
  '🏆': 'logro', '🏅': 'logro', '🎖': 'logro', '⏳': 'reloj', '⌛': 'reloj', '⏱': 'reloj', '👁': 'amuleto_ojo', '🔷': 'runa_circulo',
  '⚡': 'estallido', '💥': 'estallido', '🧨': 'estallido', '💣': 'estallido', '🧱': 'ruina', '🎒': 'mochila', '🗡': 'daga', '🔪': 'daga',
  '❄': 'st_hielo', '🏺': 'vitrina', '📊': 'ficha', '🪞': 'espejo', '👻': 'mano_espectral', '🗿': 'obelisco', '🔨': 'st_aturdido', '🪨': 'escofinas',
  '🧭': 'brujula', '🔭': 'sextante', '🔍': 'brujula', '🔎': 'brujula', '🚪': 'salir', '🎓': 'grimorio', '🫀': 'corazon', '🪓': 'hacha', '🌀': 'espiral',
  '🥾': 'botas', '👢': 'botas', '🏮': 'farol', '🦴': 'saco_huesos', '🌟': 'st_bendicion', '✴': 'st_bendicion', '🍀': 'st_regeneracion', '🌱': 'st_regeneracion',
  '🦷': 'calavera', '🎲': 'gema', '🪶': 'velocidad', '💫': 'espiral', '🕸': 'st_raices', '🌿': 'st_raices', '📦': 'nodo_tesoro', '🪽': 'velocidad',
};

/** Icono de cada tipo de sala del mapa. */
export const NODE_ART: Record<string, string> = {
  combat: 'nodo_enemigo', elite: 'nodo_elite', boss: 'nodo_jefe', event: 'desconocido', rest: 'nodo_descanso', shop: 'nodo_comerciante',
  treasure: 'nodo_tesoro', shrine: 'santuario', forge: 'forja', altar: 'altar', cage: 'nodo_jaula', sangre: 'sangre', vault: 'nodo_sello',
};

/** Icono de cada estado alterado en combate. */
export const STATUS_ART: Record<string, string> = {
  burn: 'st_quemadura', slow: 'st_hielo', poison: 'st_veneno', bleed: 'st_sangrado', stun: 'st_aturdido', vuln: 'st_vulnerable', exposed: 'st_vulnerable',
  mark: 'st_marca', deathmark: 'st_marca', verdugo: 'st_marca', charm: 'st_maldicion', guarded: 'st_protegido', kinetic: 'st_protegido', prism: 'st_protegido',
  immune: 'st_protegido', empower: 'st_potenciado', frenzy: 'st_potenciado', reach: 'st_potenciado', hobble: 'st_raices', rooted: 'st_raices', chained: 'st_raices',
  anchor: 'st_piel_piedra', silver: 'st_debilitado', smoke: 'runa_niebla', invis: 'runa_niebla', fading: 'runa_niebla', orbita: 'espiral',
};

const KEYS = Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?`, 'gu');
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'CANVAS', 'TITLE']);

/** Cambia los emojis de un texto HTML ya escapado por iconos (para cadenas que se insertan a mano). */
export const iconize = (html: string): string => html.replace(RE, (_, e: string) => gi(EMOJI_ICON[e]!));

function swapText(t: Text): void {
  const s = t.nodeValue;
  if (!s || !RE.test(s)) return;
  RE.lastIndex = 0;
  const p = t.parentElement;
  if (!p || SKIP.has(p.tagName) || p.closest('svg, .noico, [contenteditable]')) return;
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of s.matchAll(RE)) {
    if (m.index! > last) frag.append(s.slice(last, m.index));
    const img = document.createElement('img');
    img.className = 'gi'; img.alt = m[1]!; img.draggable = false; img.src = iconUrl(EMOJI_ICON[m[1]!]!);
    frag.append(img);
    last = m.index! + m[0].length;
  }
  if (last < s.length) frag.append(s.slice(last));
  t.replaceWith(frag);
}
function swapTree(n: Node): void {
  if (n.nodeType === Node.TEXT_NODE) { swapText(n as Text); return; }
  if (n.nodeType !== Node.ELEMENT_NODE || SKIP.has((n as Element).tagName)) return;
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
  const list: Text[] = [];
  for (let x = w.nextNode(); x; x = w.nextNode()) list.push(x as Text);
  list.forEach(swapText);
}

/** Vigila el documento y cambia los emojis por iconos en todo lo que se dibuje (pantallas, tooltips, ventanas). */
export function installIcons(root: Node = document.body): void {
  if (typeof MutationObserver === 'undefined') return;
  swapTree(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') swapText(m.target as Text);
      else m.addedNodes.forEach(swapTree);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
