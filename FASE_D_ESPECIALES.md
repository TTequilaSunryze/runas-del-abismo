# FASE D — Contratos Especiales, títulos y marcos

Estado: implementado, **sin commit**. Base: `58941d0` + Fase C (también sin commitear).

## 1. Arquitectura
- `src/game/cosmetics.ts` (nuevo, sin dependencias): catálogo de **16 títulos** y **6 marcos**, `Cosmetics` (desbloqueados y equipados), saneado y fusión.
- `src/game/specials.ts` (nuevo): catálogo de **22 Contratos Especiales**, validación (`registerSpecial`, `evaluateSpecials`), cobro (`claimSpecialReward`) y equipar (`equipCosmetic`).
- `src/game/contractsData.ts`: `SpecialType` (`boss_challenge`, `class_mastery`, `collection_milestone`, `narrative_lore`), `SpecialRecord` y `ContractBook.special` (opcional).
- `src/game/meta.ts`: `Meta.cosmetics?` (opcional, `Meta.v` sigue en 1); reexporta los tipos nuevos; normaliza y fusiona.
- `src/game/run.ts`: `Champion.title?` y `Champion.frame?`; `cleanChampion` solo acepta ids del catálogo (los héroes de amigos llegan por red).
- `src/game/archive.ts`: la validación se hace en `recordArchive`, en el mismo punto donde ya se detectan jefes derrotados y expediciones ganadas. **No se ha tocado el motor de combate ni la lógica de `run.ts`**: leer el estado basta y así no hay riesgo para el combate.
- `src/net/account.ts`: fusión de cosméticos cuando la nube es más reciente.

## 2. Catálogo (derivado del contenido)
| Tipo | Contratos | Condición | Recompensa |
|---|---|---|---|
| Desafíos de jefes | 8 (los 2 jefes de cada una de las 4 zonas) | derrotarlo **sin bajas**, **en ≤8 rondas** o **con un pacto activo** (una condición por jefe) | 4 marcos de zona y 4 títulos |
| Pruebas de clase | 8 (una por clase jugable) | ganar una expedición completa con esa clase y un pacto activo | título «Leyenda de …» |
| Colecciones | 3 | 100% de Bestiario, Reliquias o Grimorio (barra con el recuento real) | título Bestiólogo, marcos de reliquias y del grimorio |
| Crónicas | 3 | historias de las 3 zonas, todos los secretos, todas las historias | títulos Cronista, Guardasecretos, Archivero |
Cada recompensa es única (ninguna se repite entre contratos). Los nombres de títulos y marcos son míos.

## 3. Validación e idempotencia
- Jefe: al detectar la victoria contra un jefe (combate que desaparece y `run.fight` +1), se toma el jefe sorteado de esa zona (`run.bossPick`), las bajas del combate (ya persistidas en `archive.cur`), las rondas y el pacto. `bossConditionMet` decide.
- Clase: con `run.phase === 'won'`, clase del héroe propio y pacto válido.
- Colecciones y crónicas: `evaluateSpecials` recalcula desde el Archivo tras cada cambio; el avance solo sube.
- Un especial completado no vuelve a cambiar. `claimSpecialReward` exige completado y no reclamado, marca `claimed` y añade el título/marco sin duplicarlo. No da ecos ni efectos de juego (probado: `heroSpec` idéntico antes y después).

## 4. Títulos y marcos (solo visuales)
- Pestaña **Contratos** con tres vistas: *Diarios y semanales*, *Especiales* (requisitos, bloqueados, barras, botón «Reclamar»), *Títulos y marcos* (equipar/quitar; lo no desbloqueado sale como «🔒 ???»). El aviso «(N!)» de la pestaña suma recompensas periódicas y especiales pendientes.
- El título equipado aparece bajo el nombre del juego en el inicio. Al **guardar un héroe en el Salón** se graban el título y el marco equipados: la ficha muestra el título y el borde del color del marco (también en las fichas de amigos, validadas).

## 5. Compatibilidad
- Meta sin `cosmetics` y libretas sin `special` se completan vacías; ids desconocidos se descartan; lo equipado debe estar desbloqueado.
- Ecos, mejoras, maestría, logros, Archivo y contratos periódicos no se tocan (probado).
- Fusión: desbloqueos unidos; avance máximo y reclamado si lo estaba en cualquiera.
- Supabase: nada modificado ni consultado. Todo viaja en `profiles.meta` y, el título/marco de los héroes, en `profiles.team` (jsonb ya existentes).

## 6. Tests y resultados
- `tests/specials.test.ts` (nuevo, 14 tests): catálogo (4 tipos, ids y recompensas únicas, jefes reales); condiciones sin bajas, rápida y de pacto; prueba de clase; colecciones y crónicas que solo suben; validación desde una partida real (jefe con y sin bajas, victoria con pacto); reclamar una sola vez sin ecos ni poder; equipar solo lo desbloqueado; títulos/marcos inventados descartados en héroes del Salón; migración; guardar/cargar; fusión; conservación del resto de la Meta.
- `npm test`: **27 archivos, 300 pasados, 1 omitido** (antes 286). Ningún test existente modificado.
- `npm run build`: correcto. Prueba en navegador: reclamar dos especiales, equipar título y marco, ver el título en el inicio; sin errores de página.

## 7. Limitaciones y riesgos
1. **Decisiones mías a validar:** qué condición lleva cada jefe, el umbral de 8 rondas (`BOSS_FAST_ROUNDS`, sin datos reales de duración de jefes), las pruebas de clase con pacto y los nombres de títulos y marcos.
2. Los pactos no salen en la primera partida del jugador (el Altar está apagado), así que las pruebas de clase y los desafíos «bajo pacto» requieren haber jugado antes.
3. Las colecciones al 100% son metas muy largas; el Grimorio tiene 161 entradas y algunas bendiciones son difíciles de ver.
4. El título no se muestra a los demás en la sala ni en combate: eso cambiaría el protocolo de red. Solo se ve en el inicio y en las fichas del Salón.
5. Si cambia el contenido (nuevos jefes o clases), los desafíos se recalculan del catálogo; los ya conseguidos se conservan por id.
6. Sin tests de interfaz; la UI se revisó con capturas.

## 8. Resumen del diff (incluye Fase C sin commitear)
```
 src/game/archive.ts | 33 +++++++++++++++++++++------
 src/game/meta.ts    | 16 ++++++++++---
 src/game/run.ts     |  6 ++++-
 src/net/account.ts  |  4 +++-
 src/ui/app.ts       |  9 +++++++-
 src/ui/ctx.ts       |  4 +++-
 src/ui/screens.ts   | 65 +++++++++++++++++++++++++++++++++++++++++++++++++----
 7 files changed, 119 insertions(+), 18 deletions(-)
```
Nuevos (además de los de la Fase C): `src/game/cosmetics.ts`, `src/game/specials.ts`, `tests/specials.test.ts`, `FASE_D_ESPECIALES.md`.
