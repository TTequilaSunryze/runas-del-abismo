# FASE G1 — Modificadores de expedición

Base: `b901c4b` (Fase F y estética publicadas, árbol limpio).

## Qué se ha implementado
El juego ya tenía «Modificadores» en la sala (11, hasta 3, +15% de ecos cada uno), guardados en `run.mods` y repartidos por el anfitrión. **No se ha creado un sistema paralelo**: se ha ampliado ese, con 7 modificadores nuevos, nivel de riesgo, bono de ecos por modificador, incompatibilidades, interfaz más clara, aviso en partida y registro en el Atlas del Archivo.

## Modificadores nuevos
| Id | Nombre | Riesgo | Ecos | Efecto | No se combina con |
|---|---|---|---|---|---|
| `oscuridad` | Oscuridad profunda | ● leve | +10% | En el mapa solo se ve qué hay en las 2 capas siguientes; el resto aparece como ❔ (el jefe siempre se ve) | — |
| `ecos_inestables` | Ecos inestables | ● leve | +5% | Combates normales −30% de oro; élites y jefes +50% (economía casi neutra) | Codicia, Pobreza |
| `agrietado` | Santuario agrietado | ● leve | +10% | Los santuarios ofrecen una bendición menos (mínimo 2) pero curan un 20% al entrar | — |
| `niebla` | Niebla arcana | ● leve | +10% | En combates con presagio, enemigos +20% de vida | — |
| `reforzados` | Enemigos reforzados | ●● medio | +15% | Los enemigos empiezan cada combate con un escudo del 15% de su vida | — |
| `maldicion` | Maldición persistente | ●● medio | +10% | −10% de vida máxima toda la partida; a cambio, cada héroe empieza con una reliquia | Cañón de cristal |
| `riesgo` | Riesgo creciente | ●●● alto | +20% | Desde la zona 2, enemigos +12% de vida y +1 de daño por zona superada | Tiranos |
Los 11 originales siguen igual (riesgo medio, +15%). El reto diario usa los mismos 5 de siempre.

«Reliquias inestables» no se ha hecho: no había una regla clara sobre las reliquias que no exigiera inventar mecánica nueva.

## Cómo se activan
En la sala, el anfitrión elige hasta 3 en «Modificadores de expedición». Cada uno muestra su riesgo (●) y, al pasar el ratón, efecto, ecos e incompatibilidades. Los incompatibles o los que superan el máximo salen desactivados con el motivo. Debajo hay un resumen de los activos con el bono total y el botón «Quitar todos». Sin modificadores se indica «expedición normal».

## Cooperativo y persistencia
- El anfitrión los anuncia en la sala y los invitados ven el resumen. Al empezar, `newRun` los valida (`cleanMods`: desconocidos, repetidos, incompatibles y más de 3 fuera) y los guarda en `run.mods`, que ya formaba parte del estado autoritativo. Todos los clientes reciben la misma lista y se conserva al reconectar o reanudar.
- **`RunState` no cambia de forma**: las partidas antiguas siguen cargando.
- En partida, un aviso «⚠ N modificadores» junto al pacto los lista todos.

## Recompensas
Ecos = base × (1 + suma de los bonos). Sin modificadores no cambia nada (probado). Los originales mantienen su +15%. No hay ventajas permanentes.

## Archivo
El Atlas tiene una categoría nueva, **Modificadores** (18 entradas): desbloqueado al jugar con él, explorado al ganar una expedición con él (una vez por expedición) y dominado tras 3 victorias. Queda listo para contratos de G2 (`registerAtlasDiscovery('mods', …)`).

## Sistemas modificados
`content/modes.ts` (catálogo, `modDef`, `modEcos`, `modConflict`, `cleanMods`), `game/run.ts` (validación al crear la partida; efectos en enemigos, oro, vida inicial y santuarios), `game/rooms.ts` (curación del santuario), `game/meta.ts` (ecos), `game/archive.ts`, `game/archiveData.ts` y `game/atlas.ts` (Atlas), `ui/screens.ts` (sala), `ui/panels.ts` (aviso en partida y mapa a oscuras), `ui/app.ts`, `ui/style.css`.

## Comprobaciones
- `npm test`: **30 archivos, 327 pasados, 1 omitido**. Nuevo `tests/mods.test.ts` (6 tests). Un test de la Fase B se actualizó porque comprobaba la forma exacta del Atlas, que ahora tiene la categoría `mods`.
- `npm run build`: correcto.
- Navegador: selección, bloqueo de incompatibles, resumen de bonos, aviso en partida, mapa en sombra y registro en el Atlas; sin errores.

## Limitaciones
- No se ha medido la dificultad de cada modificador ni de sus combinaciones; los valores son prudentes y fáciles de ajustar en `modes.ts`.
- Oscuridad profunda solo oculta información del mapa: el contenido de las salas es el mismo.
- No probado en una partida en línea real con dos navegadores (usa el mismo camino que los modificadores originales).

## Archivos
```
 src/content/modes.ts                | 33 +++++++++++++++++++++++++++++++++
 src/game/archive.ts                 |  2 ++
 src/game/archiveData.ts             |  6 +++---
 src/game/atlas.ts                   |  7 ++++---
 src/game/meta.ts                    |  4 ++--
 src/game/rooms.ts                   |  6 +++++-
 src/game/run.ts                     | 18 +++++++++++-------
 src/ui/app.ts                       |  5 +++--
 src/ui/panels.ts                    |  8 ++++++--
 src/ui/screens.ts                   | 20 +++++++++++++++++---
 src/ui/style.css                    |  7 +++++++
 tests/abyss_archive_phase_b.test.ts |  2 +-
 12 files changed, 94 insertions(+), 24 deletions(-)
```
Nuevos: `tests/mods.test.ts`, `FASE_G1_MODIFICADORES.md`.
