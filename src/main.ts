import { boot } from './ui/app';

boot();

document.getElementById('build')!.textContent = `versión ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'} · escenario isométrico: «Fantasy Isometric Pixel Art Pack» de Kabukidanshi`;
