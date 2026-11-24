import { boot } from './ui/app';

boot();

document.getElementById('build')!.textContent = `versión ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'} · escenario: «Stone Crypt» de dotplays , «Pixel Worlds» de SdavGha y «Forest» de Rafael Sewa (CC BY-NC-SA 4.0)`;
