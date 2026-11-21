# FASE A — Fundamentos del Archivo del Abismo

Estado: implementado, **sin commit**. Parte del árbol con los cambios sin commitear de la Fase 0 (commit base `be207e0`, rama `main`); esos cambios no se han tocado salvo lo indicado.

## 1. Arquitectura
- `src/game/archiveData.ts` (nuevo): modelo persistente y funciones puras (`normalizeArchive`, `mergeArchive`, `raise`, `levelOf`). No importa contenido, para que `Meta` pueda usarlo sin ciclos.
- `src/game/archive.ts` (nuevo): catálogos derivados del contenido real, API pública (`discover`, `setLevel`, `discovered`, `levelFor`, `completion`, `completionAll`, `entriesOf`) y registro automático (`recordArchive`).
- `Meta.archive?: Archive` (campo **opcional**, sin cambio de versión: `Meta.v` sigue en 1).
- UI: pestaña **📚 Archivo** del menú principal (`archivePanel` en `screens.ts`), con navegación Bestiario/Grimorio/Reliquias, filtros (Todo / Descubierto / Sin descubrir), barra de progreso global y por categoría, fichas desplegables y entradas bloqueadas (`???`).

## 2. Modelo de datos
```
Archive { v: 1,
  bestiary / grimoire / relics: Record<id, { lv, seen, n }>,
  cur: { k, seen[], dead[] } | null,   // combate en curso, para no contar dos veces
  seeded: boolean }                    // migración desde el Salón ya hecha
```
Niveles (0 = desconocido, y no se guarda):

| Categoría | 1 | 2 | 3 |
|---|---|---|---|
| Bestiario | Descubierto (aparece en tu partida) | Estudiado (derrotado ≥1 vez) | Documentado (derrotado `DOCUMENTED_KILLS` = 5 veces) |
| Grimorio | Descubierto (lo tienes) | Utilizado (lo lanzas en combate) | — |
| Reliquias | Descubierta | — | — |

Contadores: `seen` = combates en que apareció (bestiario) o 1 al obtenerlo; `n` = derrotas (bestiario). En el Grimorio `n` no se usa: no se cuentan lanzamientos para no depender de que cada evento llegue una sola vez.

**Catálogos (sin contenido nuevo):** Bestiario = los 54 enemigos de `ZONA1..4_ENEMIES` (sin aliados ni héroes convertidos en élite). Grimorio = 161 entradas: hechizos base, de kit y de patrón de las clases jugables, más sus bendiciones (`BLESSINGS`); las mejoras de hechizo (`BOON_MODS`) no son entradas. Reliquias = las 22 de `RELICS`. Total: 237.

## 3. Puntos de registro
Un único punto: `session.onChange` en `src/ui/app.ts` llama a `recordArchive(run, myId, eventos)` antes de pintar. Se ejecuta en todos los clientes (anfitrión y no anfitriones reciben estado y eventos), y cada uno registra **solo a su propio héroe** (`owner === myId`): no hay identidad nueva. Sin héroe propio (espectador) o en duelos de arena no registra.
- Enemigo que aparece: unidades enemigas de `run.combat` (una vez por combate).
- Enemigo derrotado: evento `death`, resuelto con una instantánea de las unidades del combate (también si llega en el mismo cambio en que el combate termina y `run.combat` ya es `null`).
- Hechizo/bendición obtenidos: `heroSpec(héroe).spells` y `héroe.boons`. Utilizado: evento `cast` de una unidad tuya.
- Reliquia: `héroe.relics`.
- Idempotencia: ids de unidad muertos y enemigos vistos por combate se guardan en `archive.cur` (persistente, sobrevive a recargas). Todo va en `try/catch`: un fallo nunca interrumpe la partida. No hay ninguna recompensa asociada al descubrimiento.

## 4. Migraciones y compatibilidad
- Meta antigua (sin `archive`): `normalizeArchive(undefined)` la completa al cargar (`meta()` y `replaceMeta`). Ecos, mejoras, maestría, logros, Salón y amigos no se tocan.
- Siembra única desde el Salón: por cada héroe guardado se marcan como descubiertos los hechizos base y de los kits que usó (se jugó su clase, así que los tuvo). Nada más se infiere de datos antiguos (p. ej. la maestría por defecto de jugadores veteranos no se usa porque no prueba que se jugara).
- Datos corruptos o de otra versión: `normalizeArchive` recorta niveles, descarta negativos/no numéricos y entradas con nivel 0.
- `mergeMeta` (primer uso de una cuenta en un navegador) une los archivos: unión de entradas, mayor nivel y mayor contador. Una Meta remota antigua sin archivo no borra el local.
- **Cambio en `src/net/account.ts`:** cuando la nube es más reciente y sustituye al local, el Archivo local se fusiona con el remoto en vez de perderse. Es la única alteración del flujo de sincronización existente; el resto del progreso sigue como antes.
- `RunState` (partidas en curso) **no cambia**. Sin cambios en Supabase: el Archivo viaja dentro de `profiles.meta` (jsonb ya existente).

## 5. Tests y resultados
- `tests/archivo.test.ts` (nuevo, 19 tests): descubrimiento nuevo y repetido; ids inexistentes; transiciones y topes por categoría; porcentajes y entradas por categoría; catálogos sin duplicados; registro de enemigos (aparición, derrota, evento repetido, recarga, muerte al terminar el combate); hechizos, bendiciones, hechizo ajeno; reliquias y jugador distinto; sin ecos ni efectos en la partida; estado anómalo sin excepción; Meta antigua; datos corruptos; guardar/cargar; siembra desde el Salón; fusión local/remota y `mergeMeta`; conservación de ecos/mejoras/maestría/logros al cobrar una partida y sin doble cobro.
- `npm test`: **24 archivos, 246 pasados, 1 omitido** (antes 227). Ningún test existente modificado.
- `npm run build`: correcto (solo el aviso habitual de chunks > 500 kB).
- Comprobación visual con navegador: pestaña Archivo con datos de ejemplo, sin errores de página.

## 6. Limitaciones y riesgos
1. **Umbrales a validar:** Documentado = 5 derrotas. Es una elección mía, fácil de cambiar (`DOCUMENTED_KILLS`).
2. **Bestiario no distingue variantes/élites** ni muestra el botín; las fichas «Estudiado» enseñan solo tipo, vida base, PA y PM.
3. **Bendiciones** solo llegan a «Descubierta»: son pasivas y no hay evento de uso.
4. Los hechizos de clases ocultas (guerrero, mago, pícaro, clérigo) no están en el Grimorio, igual que sus logros.
5. Lo que descubras jugando en una partida a la que te unes sin cuenta se guarda en el navegador; sin cuenta no hay copia en la nube.
6. Si dos dispositivos descubren cosas distintas, la fusión es por máximo: un contador (`seen`, `n`) se queda en el mayor, no en la suma.
7. No hay tests de interfaz/red; la UI se comprobó a mano con capturas.
8. Si se añade contenido nuevo (enemigos, reliquias), entra solo en el catálogo; el porcentaje de colección bajará hasta descubrirlo.
9. El nombre «Hechizos de patrón» y la lista de 161 entradas son grandes; puede convenir agrupar por clase en la Fase B (no implementado).

## 7. Supabase
No se ha modificado ni ejecutado nada en Supabase (tablas, RPC, RLS, `SECURITY DEFINER`, autenticación). Esta fase no ha hecho ninguna consulta a la base de datos.

## 8. Resumen del diff (incluye la Fase 0 sin commitear)
```
 src/content/boons.ts         |  4 ++--
 src/content/enemies.ts       |  2 +-
 src/content/relics.ts        |  8 +++----
 src/content/zona1/events.ts  |  2 +-
 src/content/zona2/content.ts |  2 +-
 src/content/zona3/content.ts |  2 +-
 src/core/items/items.ts      |  7 ++++++-
 src/game/meta.ts             | 40 ++++++++++++++++++++++++++++++-----
 src/game/run.ts              | 26 ++++++++++++++++-------
 src/net/account.ts           |  3 ++-
 src/net/transport.ts         |  5 ++++-
 src/ui/app.ts                |  9 ++++++--
 src/ui/ctx.ts                |  6 +++++-
 src/ui/panels.ts             | 10 ++++-----
 src/ui/screens.ts            | 50 ++++++++++++++++++++++++++++++++++++++------
 15 files changed, 137 insertions(+), 39 deletions(-)
```
Archivos nuevos (sin seguimiento): `FASE_0.md`, `FASE_A_ARCHIVO.md`, `src/game/archive.ts`, `src/game/archiveData.ts`, `tests/fase0.test.ts`, `tests/archivo.test.ts`.
