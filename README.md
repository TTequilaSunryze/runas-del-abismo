# Runas del Abismo

RPG táctico roguelike por turnos en 2D, cooperativo online de 1 a 4 jugadores.
Zona 1: **Las Catacumbas Olvidadas**.

## Estado

| Módulo | Estado |
| --- | --- |
| `core`: azar por semilla, estado serializable, combate por iniciativa, línea de visión, estados, IA básica | Hecho, con tests |
| Clases (Guerrero, Mago, Clérigo) con 4 rutas y bloqueo de rutas opuestas | Hecho (2 hechizos por ruta) |
| Guardado en Supabase (`save_run` / `load_run`) | Base de datos lista; falta el cliente |
| Interfaz jugable (render, menús) | Pendiente |
| Online (salas con Supabase Realtime) | Pendiente |
| Equipo de 8 ranuras y loot | Pendiente |
| Mazmorra de la Zona 1, eventos de grupo y jefe | Pendiente |

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
- `src/net/` — salas y guardado online
- `src/render/`, `src/ui/`, `src/audio/` — presentación
- `supabase/migrations/` — esquema de la base de datos
- `tests/` — pruebas de `core`
