// Iconos: objetos en pixel art (12×12, dibujados por código) y símbolos para hechizos y nodos.
import type { SpellDef } from '../core/classes/spells';
import type { Item, Slot } from '../core/items/items';
import type { NodeKind } from '../game/run';

const ICON: Record<Slot, string[]> = {
  casco: ['............', '....mmmm....', '...mmmmmm...', '..mmhhmmmm..', '..mmmmmmmm..', '..mmmmmmmm..', '..mkkmmkkm..', '..mm.mm.mm..', '..mm.mm.mm..', '...m....m...', '............', '............'],
  capa: ['............', '...cc..cc...', '..cccccccc..', '..cchccccc..', '..cccccccc..', '..cccccccc..', '..cccccccc..', '.cccccccccc.', '.cccccccccc.', '.cc.cccc.cc.', '.c...cc...c.', '............'],
  arma: ['..........mm', '.........mhm', '........mhm.', '.......mhm..', '......mhm...', '.....mhm....', '..g.mhm.....', '..ggmm......', '...ggg......', '..bb.gg.....', '.bb.........', '............'],
  peto: ['............', '..mm....mm..', '.mmmm..mmmm.', '.mmmmmmmmmm.', '..mmmmmmmm..', '..mmhmmmmm..', '..mmhmmmmm..', '..mmmmmmmm..', '..mmmmmmmm..', '...mmmmmm...', '............', '............'],
  anillo: ['............', '.....jj.....', '....jhjj....', '....jjjj....', '...gggggg...', '..gg....gg..', '..g......g..', '..g......g..', '..gg....gg..', '...gggggg...', '............', '............'],
  amuleto: ['..g......g..', '..g......g..', '...g....g...', '...g....g...', '....g..g....', '.....gg.....', '....gjjg....', '...gjhjjg...', '...gjjjjg...', '....gjjg....', '.....gg.....', '............'],
  botas: ['............', '...bbb......', '...bbb......', '...bhb......', '...bbb......', '...bbb......', '...bbbb.....', '...bbbbbbb..', '...bbbbbbbb.', '...kkkkkkkk.', '............', '............'],
  guantes: ['............', '..b.b.b.b...', '..b.b.b.b...', '..b.b.b.b.b.', '..bbbbbbb.b.', '..bbhbbbbbb.', '..bbbbbbbbb.', '...bbbbbbb..', '...bbbbbbb..', '...mmmmmmm..', '...mmmmmmm..', '............'],
};
// el metal, la tela y la gema cambian con la rareza
const TINT = [
  { m: '#aab0c0', c: '#8a8fa3', j: '#c9d0e0' },
  { m: '#7fb2f0', c: '#3f6fb8', j: '#58a6ff' },
  { m: '#c79aff', c: '#7a3fc0', j: '#c77dff' },
  { m: '#ffd76a', c: '#c8901a', j: '#ff6a4a' },
];
const FIXED: Record<string, string> = { h: '#ffffff', g: '#e8b83a', b: '#8a5a2c', k: '#2a2030' };

const cache = new Map<string, string>();

/** Imagen (data URL) del icono de una ranura con el tinte de su rareza. */
export function slotIconUrl(slot: Slot, rarity: number): string {
  const k = `${slot}${rarity}`;
  let url = cache.get(k);
  if (url) return url;
  const c = document.createElement('canvas');
  c.width = c.height = 12;
  const g = c.getContext('2d')!;
  const pal: Record<string, string> = { ...FIXED, ...TINT[rarity]! };
  ICON[slot].forEach((row, y) => {
    for (let x = 0; x < 12; x++) {
      const col = pal[row[x]!];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  url = c.toDataURL();
  cache.set(k, url);
  return url;
}

export function itemIcon(it: Item | undefined, slot?: Slot): string {
  if (it) return `<img class="ico" src="${slotIconUrl(it.slot, it.rarity)}" alt="">`;
  return slot ? `<img class="ico ghost" src="${slotIconUrl(slot, 0)}" alt="">` : '';
}

export function iconErrors(): string[] {
  return Object.entries(ICON).flatMap(([k, rows]) => (rows.length !== 12 ? [`${k}: ${rows.length} filas`] : rows.filter((r) => r.length !== 12).map((r) => `${k}: "${r}"`)));
}

/** Símbolo de un hechizo según lo que hace. */
export function spellIcon(d: SpellDef): string {
  if (d.heal) return '💚';
  if (d.giveAp || d.giveMp) return '📣';
  if (d.shield && !d.dmg) return '🛡️';
  if (d.status?.kind === 'stun') return '💫';
  if (d.status?.kind === 'mark') return '👁️';
  if (d.element === 'fire') return '🔥';
  if (d.element === 'ice') return '❄️';
  if (d.element === 'poison') return '☠️';
  if (d.element === 'holy') return '✨';
  if (d.drainAp) return '⚡';
  if (d.push) return '💥';
  if (d.dash) return '💨';
  if (d.area) return '🌀';
  return d.range[1] > 1 ? '🏹' : '⚔️';
}

export const NODE_ICON: Record<NodeKind, string> = { combat: '⚔️', elite: '☠️', event: '❓', rest: '🔥', shop: '💰', treasure: '🎁', boss: '👑' };
