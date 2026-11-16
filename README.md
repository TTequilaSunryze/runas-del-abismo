# Runas del Abismo

RPG táctico roguelike por turnos en 2D, cooperativo online de 1 a 4 jugadores.
Zona 1: **Las Catacumbas Olvidadas**.

## Estado

| Módulo | Estado |
| --- | --- |
| `core`: azar por semilla, estado serializable, combate por iniciativa, línea de visión, estados, IA básica | Hecho, con tests |
| Clases (Guerrero, Mago, Clérigo) con 4 rutas y bloqueo de rutas opuestas | Hecho (3 hechizos por ruta, se desbloquean por nivel) |
| Guardado en Supabase (`save_run` / `load_run`) | Se guarda tras cada combate; el anfitrión puede reanudar |
| Interfaz jugable (inicio, sala, clase y rutas, tablero) | Versión mínima |
| Online (salas con código, Supabase Realtime, anfitrión autoritativo) | Hecho; probado entre pestañas, falta prueba entre dispositivos |
| Equipo de 8 ranuras, 4 rarezas y botín temático tras cada combate | Hecho |
| Zona 1: 6 combates, élite, 4 eventos de grupo con votación, trampas y jefe en dos fases | Hecho; falta equilibrar |
| Mapa con rutas, oro y tienda, arte y sonido | Pendiente |

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
