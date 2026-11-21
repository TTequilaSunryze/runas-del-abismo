# FASE C — Contratos del Abismo

Estado: implementado, **sin commit**. Base: `58941d0` (Fases 0, A y B ya subidas).

## 1. Arquitectura
- `src/game/contractsData.ts` (nuevo): interfaz `Contract`, libreta `ContractBook`, saneado (`normalizeContracts`) y fusión (`mergeContracts`). No importa contenido, para que `Meta` lo use sin ciclos.
- `src/game/contracts.ts` (nuevo): periodos UTC, generación determinista, rotación, seguimiento (`trackContract`) y cobro (`claimContractReward`).
- `src/game/meta.ts`: `Meta.contracts?: ContractBook` (campo **opcional**; `Meta.v` sigue en 1) y reexporta los tipos `Contract`, `ContractBook`, `ContractPeriod`, `ContractTarget`. Se normaliza al cargar y se fusiona en `mergeMeta`.
- `src/net/account.ts`: si la nube es más reciente, los contratos se fusionan con los locales (como el Archivo).
- `src/game/archive.ts`: `recordArchive` alimenta los contratos desde los mismos puntos de registro del Archivo.
- UI: pestaña **📋 Contratos** en el menú principal (avisa con «(N!)» si hay recompensas por cobrar).

## 2. Modelo de datos
```
Contract { id, title, description, category: 'daily'|'weekly', targetType: 'kill'|'cast'|'relic'|'atlas',
           targetId, requiredCount, rewardEcos, expiresAt, completed, progress, claimed }
ContractBook { v: 1, day: 'YYYY-MM-DD', week: 'YYYY-MM-DD' (lunes), daily: Contract[], weekly: Contract[],
               seen: string[]   // claves de acontecimientos ya contados (máx. 2000, se vacía cada semana)
               paid: string[] } // ids ya cobrados (máx. 60): segunda barrera contra cobros dobles
```
`category` es el periodo (diario/semanal), tal como pedía el enunciado. `progress` y `claimed` son campos añadidos que hacen falta para el seguimiento y el cobro.

## 3. Generación y renovación
- Semilla = `contratos:<periodo>:<fecha UTC>` con el generador del juego (`seedFrom` + mulberry32): todos los jugadores tienen los mismos contratos ese día o semana.
- Diarios (3): una caza de un enemigo común de la zona 1, lanzar hechizos con una clase jugable, y uno al azar entre resolver un evento, conseguir una reliquia o ganar bajo un presagio.
- Semanales (3): purga de N enemigos de la zona 1 o 2, y dos al azar entre caza de un enemigo de la zona 2, hechizos con una clase, derrotar 2 jefes, conseguir 3 reliquias y resolver 3 eventos.
- Los objetivos salen del contenido real: enemigos de la **primera lista de encuentros** de cada zona (siempre aparecen), clases de `PLAYABLE`, categorías del Atlas.
- `expiresAt` es el final del día (00:00 UTC del siguiente) o de la semana (lunes 00:00 UTC). `refreshContracts` sustituye los de un periodo terminado; **lo no cobrado se pierde** al rotar.

## 4. Seguimiento (silencioso e idempotente)
| Contrato | Acontecimiento | Clave única |
|---|---|---|
| Caza (`kill`) | muerte de un enemigo (mismo punto que el Bestiario) | combate + id de unidad |
| Hechizos (`cast`) | evento `cast` de tu héroe (no de invocaciones) | combate + ronda + turno + unidad + hechizo + PA restantes + posición en el lote |
| Reliquias (`relic`) | reliquias de tu héroe en la partida | expedición + id de reliquia |
| Atlas: eventos | evento de grupo resuelto | expedición + zona + sala |
| Atlas: jefes (`zones`) | jefe derrotado | expedición + zona |
| Atlas: presagios | combate ganado bajo presagio | expedición + combate |
Una clave ya contada no vuelve a sumar (repetir estado, recargar la página o reconectar). Solo registra al jugador local con su héroe.

## 5. Cobro
`claimContractReward(meta, contractId)` acredita ecos solo si el contrato existe, está completado, no ha caducado, no está marcado como cobrado **y** su id no figura en `paid`. Marca ambos antes de devolver. Devuelve los ecos acreditados (0 si no procede). Generar, rotar o avanzar no dan ecos.

## 6. Economía (decisión mía, a validar)
- 10 ecos por diario y 30 por semanal: como mucho 30/día + 90/semana ≈ 300 ecos/semana. Una victoria completa da ~271 y una derrota en la zona 1 ~16.
- **Riesgo conocido:** la auditoría mostró que los ecos no tienen en qué gastarse más allá de 950 (todas las mejoras). Los contratos añaden una fuente pequeña pero no un sumidero; no he creado ninguno (estaba fuera del alcance). Conviene decidir el sumidero en la fase siguiente.

## 7. Compatibilidad y migración
- Meta sin `contracts`: se completa con una libreta vacía; los contratos se generan al abrir la pestaña. Ecos, mejoras, maestría, logros y Archivo no se tocan (probado).
- Fusión entre dispositivos: mismo periodo → mayor avance y cobrado si lo estaba en cualquiera; periodo distinto → gana el más reciente. `paid` se une. `mergeMeta` toma el mayor de los ecos (comportamiento existente), así que un contrato cobrado en dos dispositivos sin sincronizar no suma dos veces.
- Supabase: nada modificado ni consultado. Los contratos viajan dentro de `profiles.meta` (jsonb existente).

## 8. Tests y resultados
- `tests/contracts.test.ts` (nuevo, 17 tests): claves UTC de día y semana; generación determinista con objetivos válidos e ids únicos; rotación; avance una vez por clave; filtrado por objetivo (enemigo y zona); **cobro idempotente** (completado, una vez, barrera de `paid`, caducado, id inexistente); rotar sin dar ecos; conexión real con combate (muertes, hechizos, reliquias, jefes, jugador ajeno); Meta antigua y datos corruptos; guardar/cargar; fusión; conservación de ecos, mejoras, maestría, logros y Archivo.
- `npm test`: **26 archivos, 286 pasados, 1 omitido** (antes 269). Ningún test existente modificado.
- `npm run build`: correcto.
- Prueba en navegador: generación, contrato completado, cobro (+10 ecos, botón desaparece). Destapó un fallo (la etiqueta de la pestaña generaba contratos sin guardarlos), ya corregido.

## 9. Limitaciones y riesgos
1. **El reloj es el del dispositivo.** Cambiar la fecha del sistema permite contratos nuevos (como mucho 30 ecos por «día» falso). Evitarlo requiere hora del servidor (Supabase), fuera del alcance.
2. Si los contratos rotan a mitad de partida, las reliquias que el héroe ya llevaba cuentan para el contrato nuevo.
3. El contrato de hechizos es por clase, no por hechizo concreto: así es alcanzable con cualquier kit. Un contrato para una clase que no juegas no se puede completar ese periodo (es intencionado para variar).
4. Si un dispositivo sin conexión cobra y luego otro más reciente sustituye el progreso, ese cobro puede perderse (nunca duplicarse).
5. Lo no cobrado se pierde al rotar: decisión mía.
6. Sin tests de interfaz; la UI se revisó con capturas.

## 10. Resumen del diff
```
 src/game/archive.ts | 25 ++++++++++++++++++++-----
 src/game/meta.ts    | 11 ++++++++---
 src/net/account.ts  |  3 ++-
 src/ui/app.ts       |  2 ++
 src/ui/ctx.ts       |  2 +-
 src/ui/screens.ts   | 27 +++++++++++++++++++++++++--
 6 files changed, 58 insertions(+), 12 deletions(-)
```
Nuevos: `src/game/contracts.ts`, `src/game/contractsData.ts`, `tests/contracts.test.ts`, `FASE_C_CONTRATOS.md`.
