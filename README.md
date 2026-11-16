# Runas del Abismo

RPG táctico roguelike por turnos en 2D, cooperativo online de 1 a 4 jugadores.
Zona 1: **Las Catacumbas Olvidadas**.

## Estado

| Módulo | Estado |
| --- | --- |
| `core`: azar por semilla, estado serializable, combate por iniciativa, línea de visión, estados, IA básica | Hecho, con tests |
| Clases (Guerrero, Mago, Clérigo, Pícaro) con 4 rutas y bloqueo de rutas opuestas | Hecho (3 hechizos por ruta, se desbloquean por nivel) |
| Guardado en Supabase (`save_run` / `load_run`) | Se guarda tras cada combate; el anfitrión puede reanudar |
| Interfaz jugable (inicio, sala, clase y rutas, tablero) | Versión mínima |
| Online (salas con código, Supabase Realtime, anfitrión autoritativo) | Hecho; probado entre pestañas, falta prueba entre dispositivos |
| Equipo de 8 ranuras, 4 rarezas, mochila, comparación, dar objetos a compañeros | Hecho |
| Zona 1: mapa de 9 salas con caminos a elegir, élite, eventos de grupo, descanso, tesoro, tienda con oro, trampas y jefe en dos fases | Hecho; falta equilibrar |
| Sonido sintetizado (efectos y música) | Hecho |
| Runas (12, una por hechizo), elementos y resistencias, estados más largos por equipo | Hecho |
| Sprites por clase, animaciones de ataque, proyectiles, muerte e iluminación | Hecho (dibujados por código) |
| Tres zonas (Catacumbas, Bosque Corrompido, Ruinas de Ceniza) con enemigos, élite, jefe, equipo y eventos propios | Hecho; falta equilibrar |
| Interfaz en columnas: ficha con iconos de equipo y mochila, runas, grupo, ayudas flotantes y barra de hechizos compacta | Hecho |

## Desarrollo

```bash
npm install
npm run dev     # servidor local
npm test        # tests del motor
npm run build   # genera dist/
```

Cada `push` a `main` pasa los tests y publica en GitHub Pages.

## Estructura

- `src/core/` — lógica pura, sin DOM ni red (lo único que decide qué pasa en el juego)
- `src/content/zona1/` — enemigos, objetos y eventos de la zona
- `src/game/` — partida (run) y sesión anfitrión/cliente
- `src/net/` — salas y guardado online
- `src/render/`, `src/ui/`, `src/audio/` — presentación
- `supabase/migrations/` — esquema de la base de datos
- `tests/` — pruebas de `core`

## Pruebas locales del online

Añade `?local=1&p=nombre` a la URL en varias pestañas del mismo navegador: las salas funcionan sin servidor.


## Progresión (v2)
Ecos, mejoras permanentes, 17 logros, ascensión 0–10, reto diario con ranking, tutorial, música por zona y adaptación a móvil. Ver `docs/GDD.md`. Las partidas guardadas de versiones anteriores no son compatibles.

## v3
Cuenta con email y contraseña, maestría por clase que desbloquea rutas, mejoras de hechizo, sets de 3 piezas, clase Arquero, reliquias de grupo, Salón de héroes, Némesis y duelos 3 contra 3. Las partidas guardadas anteriores no son compatibles.

## v4
Iconos de hechizo en pixel art, 31 enemigos nuevos, jefes alternativos, zona 4 (El Abismo), forja, altar, apostador, jaulas con aliados, 22 reliquias, presagios, 14 eventos nuevos y modificadores elegibles. Las partidas guardadas anteriores no son compatibles.

## v5
Placaje, élites y jefes resistentes al control, 3 habilidades iniciales por clase, bendiciones estilo Hades, consumibles, forja de pago con vista previa, jaula con combate, botón «Listo», ficha de estadísticas, amigos con invitaciones y música propia. La música (carpeta `public/music`) es de Lucho y se usa con su permiso. Las partidas guardadas anteriores no son compatibles.
