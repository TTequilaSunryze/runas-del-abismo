import { boot } from './ui/app';

boot();

document.getElementById('build')!.textContent = `versión ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'}`;
