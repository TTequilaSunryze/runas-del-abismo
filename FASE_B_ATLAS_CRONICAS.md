# FASE B — Atlas y Crónicas

Estado: implementado, **sin commit**. Sigue sobre la Fase 0 y la Fase A (también sin commitear; base `be207e0`). Sin recompensas, monedas, cosméticos ni poder permanente.

## 1. Arquitectura
- `src/game/archiveData.ts` (ampliado): modelo y saneado/fusión de `Archive`, con `atlas` y `chronicles`.
- `src/game/atlas.ts` (nuevo): catálogos del Atlas y de las Crónicas, `registerAtlasDiscovery`, `registerChronicleProgress` y consultas.
- `src/game/archive.ts` (ampliado): `recordArchive` conecta los acontecimientos de la partida; `evaluateMilestones` calcula los hitos.
- `src/game/meta.ts`: reexporta los tipos (`AtlasEntryRecord`, `ChronicleEntryRecord`, estados, categorías). Las **funciones de registro viven en `atlas.ts`** (no en `meta.ts`): `atlas.ts` importa el contenido del juego y `meta.ts` ya es importado por casi todo, así que ponerlas allí crearía ciclos. Reciben `meta` como primer argumento, como pedía el enunciado (solo usan `meta.archive`).
- UI: la pestaña Archivo gana **🗺️ Atlas** y **📜 Crónicas** con subpestañas, fichas y barras de avance.

## 2. Modelo de datos (dentro de `Meta.archive`)
```
Archive += {
  atlas:      { zones | events | pacts | omens: Record<id, AtlasEntryRecord> },
  chronicles: { stories | secrets | milestones: Record<id, ChronicleEntryRecord> } }
AtlasEntryRecord      { state: 'unlocked'|'explored'|'mastered', encounters, completions, lastSeen?, lastDone? }
ChronicleEntryRecord  { state: 'discovered'|'completed', progress, last? }   // 'locked' = sin registro
```
**Atlas** (catálogos del contenido real): 4 zonas (`z1`..`z4`), eventos de grupo (los de cada zona y los de reliquia), 13 pactos, presagios (`OMENS`). Significado: *unlocked* = encontrado; *explored* = completado una vez; *mastered* = completado `MASTERED_AT` = 3 veces. «Completar» es: zona → derrotar a su jefe; evento → resolverlo; pacto → derrotar a un jefe con él activo; presagio → ganar un combate bajo él.

**Crónicas** (14 historias, 3 secretos, 12 hitos):
- Historias, con textos ya existentes en `story.ts`: 4 de zona (descubierta al entrar, completada al derrotar a su jefe), 8 de clase jugable (descubierta al jugarla, completada al ganar con ella) y los 2 finales (victoria/derrota).
- Hitos: 25/50/75/100% de Bestiario, Grimorio y Reliquias (avance = % descubierto de Fase A).
- Secretos (**contenido nuevo mío, a validar**; su condición solo se ve al cumplirlos, antes hay una pista vaga): *Intocables* (ganar un élite o jefe sin que caiga ningún héroe), *Relámpago* (ganar un combate en ≤3 rondas), *Al límite* (ganar con un héroe tuyo que llegó a <10% de vida y sigue en pie). Los umbrales son `RELAMPAGO_ROUNDS` y `LIMITE_PCT`.

## 3. Funciones de registro
- `registerAtlasDiscovery(meta, category, id, initialState = 'unlocked', key?)`: lleva la entrada a ese estado sin bajarla nunca. `unlocked` cuenta un encuentro; `explored` cuenta una compleción (y el encuentro si era nueva); a las 3 compleciones pasa a `mastered`. Con `key` (expedición + sala/combate), repetir la llamada no cuenta nada. Ignora ids que no existen.
- `registerChronicleProgress(meta, category, id, targetValue, key?)`: guarda el máximo avance; `discovered` con avance >0 y `completed` al llegar al objetivo de la entrada. Solo escribe si hay avance real.
- Las dos devuelven `true` si cambió algo.

## 4. Puntos de registro (todo en `recordArchive`, llamado desde `session.onChange`)
| Acontecimiento | Cómo se detecta | Registro |
|---|---|---|
| Entrar en una zona | `run.zone` | zona *unlocked*; historia de zona 1/2 |
| Jugar una clase | héroe propio | historia de clase 1/2 |
| Pacto elegido | `run.pact` | pacto *unlocked* |
| Evento especial | `phase==='event'`, `event.result` | evento *unlocked* → *explored* |
| Presagio | `run.omen` en combate | presagio *unlocked* |
| Combate ganado | el combate desaparece y `run.fight` sube 1 | presagio *explored*; si es jefe: zona *explored*, historia de zona 2/2, pacto *explored* |
| Secretos | al ganar, con rondas, bajas y vida mínima del combate (persistidas en `archive.cur`) | secretos |
| Victoria / derrota | `phase` | finales; historia de clase 2/2 al ganar |
| Hitos | tras cualquier cambio | `evaluateMilestones` |
Una expedición se identifica por código de sala + jefes sorteados, así que repetir estado, recargar la página o reconectar no duplica nada. Todo va en `try/catch`.

## 5. Migración y compatibilidad
- Archivo de la Fase A (sin `atlas`/`chronicles`): `normalizeArchive` lo completa, conservando todo lo anterior (probado). `Meta.v` sigue en 1; `RunState` no cambia.
- Ecos, mejoras, maestría, logros, Salón y amigos no se tocan; descubrir no da ecos (probado, incluyendo el cobro de partida sin doble pago).
- Fusión (cuenta, `mergeMeta`, nube más reciente): unión de entradas, estado más alto y contadores mayores.
- Datos corruptos: estados inválidos descartados, números saneados.
- Supabase: nada modificado ni consultado; todo viaja dentro de `profiles.meta` (jsonb existente).

## 6. Tests y resultados
- `tests/abyss_archive_phase_b.test.ts` (nuevo, 23 tests): descubrimiento nuevo, repetición con la misma clave y encuentros con claves distintas; transiciones Atlas y Crónicas (sin bajar); ids inexistentes; hitos; puntos de registro reales (zona, pacto, presagio, evento, jefe, secretos, finales, jugador ajeno, estado anómalo); migración desde el Archivo de la Fase A; datos corruptos; guardar/cargar; fusión; conservación de ecos, mejoras, maestría y logros.
- Los tests detectaron un fallo real de idempotencia en las Crónicas (la clave del último avance se reescribía en cada llamada), ya corregido.
- `npm test`: **25 archivos, 269 pasados, 1 omitido** (antes 246). Ningún test existente modificado.
- `npm run build`: correcto (solo el aviso de chunks > 500 kB). Comprobación visual con navegador, sin errores de página.

## 7. Limitaciones y riesgos
1. **Los 3 secretos y sus umbrales son decisión mía**; el enunciado no los definía. Fáciles de cambiar o quitar (`SECRETS`).
2. Un combate ganado se detecta por el cambio de estado; si un cliente se reconecta justo en ese instante puede perderse esa compleción (no se duplica nada, solo se pierde ese registro). Los eventos de victoria no se persisten en el estado de la partida.
3. Las compleciones de pacto cuentan solo al derrotar a un jefe; no hay «pactos» de partida perdida.
4. Los eventos de tienda o de sala (forja, descanso, santuario…) no están en el Atlas: no son `GroupEvent`. Si se quieren, hay que decidir su definición.
5. Reutilizar el mismo código de sala con los mismos jefes sorteados (1 entre 16) en una partida posterior podría no contar sus encuentros de pacto/zona.
6. Los hitos usan el % de la Fase A; si se añade contenido, el avance baja y un hito ya completado se mantiene completado.
7. No hay tests de interfaz; la UI se revisó con capturas.

## 8. Supabase
Sin cambios ni consultas en Supabase (tablas, RPC, RLS, `SECURITY DEFINER`, autenticación).

## 9. Resumen del diff (acumulado con Fase 0 y A, sin commitear)
```
 15 files changed, 166 insertions(+), 39 deletions(-)
```
Nuevos: `src/game/atlas.ts`, `tests/abyss_archive_phase_b.test.ts`, `FASE_B_ATLAS_CRONICAS.md` (además de los de fases anteriores).
