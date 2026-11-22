import { boot } from './ui/app';

boot();

document.getElementById('build')!.textContent = `versión ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'} · escenario: «Stone Crypt» de dotplays y «Pixel Worlds» de SdavGha · personajes: «Skeleton Series» de MEKAI GAMES, «Tiny Enemies» de Vryell`;
