// Arrastrar objetos entre la mochila y el equipo (ratón y táctil). Los botones siguen funcionando igual.
// - Mochila → zona «Equipado»: se equipa en su ranura (lo que había vuelve a la mochila).
// - Equipado → zona «Mochila»: se quita y va a la mochila.
// Marcado: las casillas arrastrables llevan data-drag="bag:i" | "slot:ranura" y data-dslot con su ranura; las zonas
// de destino llevan data-drop="equip" | "bag".

type DropFn = (from: string, to: 'equip' | 'bag') => void;

const MOVE = 6;
let start: { x: number; y: number; el: HTMLElement; id: string; pid: number } | null = null;
let ghost: HTMLElement | null = null;
let over: HTMLElement | null = null;
/** tras soltar, se ignora el clic que el navegador lanza a continuación */
let swallow = false;

function zoneAt(x: number, y: number): HTMLElement | null {
  ghost?.style.setProperty('display', 'none');
  const z = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null;
  ghost?.style.removeProperty('display');
  return z;
}
const validFor = (id: string, z: HTMLElement | null): boolean => !!z && ((id.startsWith('bag:') && z.dataset.drop === 'equip') || (id.startsWith('slot:') && z.dataset.drop === 'bag'));

function cleanup(): void {
  ghost?.remove(); ghost = null;
  over?.classList.remove('dropok'); over = null;
  document.body.classList.remove('dragging');
  document.querySelectorAll('.dragsrc,.slotfit').forEach((e) => e.classList.remove('dragsrc', 'slotfit'));
  start = null;
}

export function installDragDrop(onDrop: DropFn): void {
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    start = { x: e.clientX, y: e.clientY, el, id: el.dataset.drag!, pid: e.pointerId };
  });
  document.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.pid) return;
    if (!ghost) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < MOVE) return;
      // empieza el arrastre: copia del icono que sigue al puntero
      ghost = start.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-act'); ghost.removeAttribute('data-tip');
      const r = start.el.getBoundingClientRect();
      ghost.className += ' dragghost';
      Object.assign(ghost.style, { width: `${r.width}px`, height: `${r.height}px` });
      document.body.appendChild(ghost);
      document.body.classList.add('dragging');
      start.el.classList.add('dragsrc');
      // resalta la ranura donde caerá el objeto de la mochila
      const slot = start.el.dataset.dslot;
      if (start.id.startsWith('bag:') && slot) document.querySelectorAll<HTMLElement>(`[data-drag="slot:${slot}"],[data-eslot="${slot}"]`).forEach((x) => x.classList.add('slotfit'));
      document.dispatchEvent(new CustomEvent('rda:hidetip'));
    }
    e.preventDefault();
    ghost.style.transform = `translate(${e.clientX - ghost.offsetWidth / 2}px, ${e.clientY - ghost.offsetHeight / 2}px) scale(1.08)`;
    const z = zoneAt(e.clientX, e.clientY);
    const ok = validFor(start.id, z) ? z : null;
    if (ok !== over) { over?.classList.remove('dropok'); over = ok; over?.classList.add('dropok'); }
  });
  const end = (e: PointerEvent): void => {
    if (!start || e.pointerId !== start.pid) return;
    if (ghost) {
      swallow = true;
      setTimeout(() => { swallow = false; }, 0);
      const z = zoneAt(e.clientX, e.clientY);
      const id = start.id;
      cleanup();
      if (validFor(id, z)) onDrop(id, z!.dataset.drop as 'equip' | 'bag');
      return;
    }
    start = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', () => cleanup());
  // las imágenes de los iconos se arrastrarían solas (arrastre nativo del navegador) y cortarían el nuestro
  document.addEventListener('dragstart', (e) => { if ((e.target as HTMLElement).closest?.('[data-drag]')) e.preventDefault(); });
  document.addEventListener('click', (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  // en táctil, que el arrastre no desplace la página
  document.addEventListener('touchmove', (e) => { if (ghost) e.preventDefault(); }, { passive: false });
}
