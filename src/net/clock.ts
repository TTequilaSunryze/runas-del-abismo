// Temporizadores que siguen funcionando con la pestaña en segundo plano: el navegador frena mucho los
// setTimeout de las pestañas ocultas (hasta 1 por minuto), y el anfitrión es quien mueve la partida.
// Un worker no sufre ese freno. Si no hay workers, se usan los temporizadores normales.
type Id = number;
const cbs = new Map<Id, { fn: () => void; every: boolean }>();
let next = 1;
let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined' || typeof Blob === 'undefined') return worker;
  try {
    const src = `const t=new Map();onmessage=(e)=>{const m=e.data;if(m.c==='set'){const f=()=>postMessage(m.id);t.set(m.id,m.every?setInterval(f,m.ms):setTimeout(()=>{t.delete(m.id);f();},m.ms));}else{const h=t.get(m.id);if(h!==undefined){clearTimeout(h);clearInterval(h);t.delete(m.id);}}};`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e: MessageEvent<number>) => { const c = cbs.get(e.data); if (!c) return; if (!c.every) cbs.delete(e.data); c.fn(); };
  } catch { worker = null; }
  return worker;
}

export interface Timer { id: Id; native?: ReturnType<typeof setTimeout> }

function start(fn: () => void, ms: number, every: boolean): Timer {
  const w = getWorker();
  if (!w) return { id: 0, native: every ? setInterval(fn, ms) : setTimeout(fn, ms) };
  const id = next++;
  cbs.set(id, { fn, every });
  w.postMessage({ c: 'set', id, ms, every });
  return { id };
}
export const later = (fn: () => void, ms: number): Timer => start(fn, ms, false);
export const every = (fn: () => void, ms: number): Timer => start(fn, ms, true);
export function cancel(t: Timer | null | undefined): void {
  if (!t) return;
  if (t.native !== undefined) { clearTimeout(t.native); clearInterval(t.native); return; }
  cbs.delete(t.id);
  worker?.postMessage({ c: 'clear', id: t.id });
}
