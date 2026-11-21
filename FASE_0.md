# FASE 0 — Coherencia y correcciones

## 1. Estado inicial
- Commit: `be207e0` (el mismo de la auditoría). Árbol limpio; no había commits posteriores (no hay remoto `origin/main` en este clon).
- Tests antes: **22 archivos, 212 pasados, 1 omitido**.
- Los cambios de esta fase están **sin commitear**, a la espera de tu revisión.

## 2. Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/game/run.ts` | `dailyZone()`; `offerSize()`/`OFFER_BASE`/`OFFER_MASTER`/`MASTER_LEVEL`; `offerBoon` y `buildBossOffer` usan el tamaño de oferta |
| `src/game/meta.ts` | `roomsCleared()`; `ecosFor` y `masteryXpFor` la usan; `listedAchievements()` y `achievementCount()` |
| `src/ui/app.ts` | el reto diario envía `dailyZone(run)` |
| `src/ui/screens.ts` | clasificación muestra `Zona ${zone}` (antes `zone + 1`); logros listados con los nuevos helpers; texto de mejoras sin «re-tiradas» |
| `src/net/transport.ts` | `submitDaily` registra con `console.warn` el error RPC o el rechazo (antes silencioso) |
| `src/ui/panels.ts` | cartas de oferta con 3 o 4 columnas; no se muestran estadísticas de resistencia inertes |
| `src/core/items/items.ts` | `RES_STATS`, `statShown()`; `statsText` filtra resistencias |
| `src/content/relics.ts`, `zona2/content.ts`, `zona3/content.ts`, `boons.ts`, `enemies.ts`, `zona1/events.ts` | textos corregidos (ver §3) |
| `tests/fase0.test.ts` | **nuevo**, 15 tests |

## 3. Problemas y soluciones

### A. Reto diario
- **Causa:** `run.zone` es base 0 (0 = primera zona). El cliente enviaba `Math.min(2, run.zone)` y la tabla `daily_scores` exige `zone` entre 1 y 3 (comprobado en la base de datos, solo lectura). Una partida de la primera zona enviaba 0 y se rechazaba; el error se tragaba (`return false`).
- **Solución:** `dailyZone(run) = clamp(run.zone + 1, 1, 3)` (el Abismo, zonas 4-5, se envía como 3). La clasificación mostraba `zone + 1`; ahora muestra `zone`, que ya es 1-based. `submitDaily` avisa por consola con el error RPC o si la función devuelve `false`.
- **Dato histórico:** hay 1 fila anterior (`2026-11-16`, zone = 2, enviada con el mapeo antiguo, es decir, la 3.ª zona). Con el mapeo nuevo se leería como «Zona 2». No se ha tocado; el ranking es por día, así que solo afecta a ese día pasado.
- **Pendiente de verificar:** el envío real a Supabase (los tests son unitarios; no se ha hecho una partida diaria en producción).

### B. Ecos y XP de maestría
- **Dato fiable:** `run.trail` se reinicia en cada mapa (`setMap`) y `run.step` también al cambiar de zona, así que ninguno guarda las zonas anteriores. Los mapas tienen tamaño fijo: `ACT_ROOMS + 1 = 11` capas por zona (la última es el jefe) y, en la primera zona, el Altar de Pactos delante (12). Nuevo `roomsCleared(run)` = capas de las zonas completadas + `step` actual (acotado al tamaño del mapa). `step` solo sube al cerrar una sala, así que la sala en la que se pierde no cuenta, y cada capa (altar y jefe incluidos) cuenta una vez.
- Sin cambios: multiplicadores de ascensión y reto diario, bonus por jefes (25), por victoria (60 ecos / 50 XP), Abismo, formato de `Meta`. No se tocan ecos ni XP ya acumulados.
- **Ejemplos** (ascensión 0, sin modificadores):

| Partida | Salas antes → ahora | Ecos antes → ahora | XP antes → ahora |
|---|---|---|---|
| Derrota en zona 1, sala 4 | 4 → 4 | 16 → 16 | 20 → 20 |
| Derrota en zona 2, sala 5, 1 jefe | 12 → 17 | 73 → 93 | 85 → 110 |
| Derrota en zona 3, sala 3, 2 jefes | 17 → 26 | 118 → 154 | 135 → 180 |
| Victoria (3 zonas, 3 jefes) | 25 → 34 | 235 → 271 | 250 → 295 |

  La zona 1 no cambia; el cambio crece con cada zona completada.

### C. Maestría 5: cuatro opciones
- **Dónde se promete:** `MASTERY_TEXT[4]`: «tus ofertas de hechizos y bendiciones muestran 4 opciones». Aplica a `buildBossOffer` (recompensa del jefe y oráculo de la zona 3, que reutiliza la función) y a `offerBoon` (santuario).
- **Solución:** `offerSize(h)` = 4 si `h.mastery >= 5`, si no 3. Sin duplicados (hechizos distintos del pool; una mejora por hechizo).
- **Fallback documentado:** la 4.ª opción nunca se rellena con oro o curación. Si no hay un hechizo o mejora distintos, la oferta queda en 3 (comportamiento anterior, con su relleno de oro/curación hasta 3). En el santuario, si quedan menos de 4 bendiciones, se muestran las que haya.
- Interfaz: la rejilla pasa a 4 columnas cuando hay 4 cartas.
- Relacionado: la opción «Romper el sello» (zona 1) prometía «botín épico o mejor y con 4 opciones». El botín ya no se ofrece a elegir, así que se quitó «con 4 opciones» (queda «botín de élite»). **No he verificado** que el botín de ese combate sea «épico o mejor»; lo dejé como «de élite (mejor calidad)».

### D. Resistencias elementales (`FEATURES.resistances = false`)
Textos corregidos (los efectos reales se conservan; los datos de resistencia siguen en el código, inertes):
- Eventos: «Brasa eterna» (ahora «+2 de daño»), «Velo de humo» («+6 de iniciativa»), «Reforzar las armaduras» («+2 de armadura»), «Quemarlo» («+1 de daño»).
- Bendiciones Piromancia y Criomancia: `twoText` sin «% res.».
- Reliquia «Medalla de fe»: solo daba resistencias; ahora dice «Sin efecto por ahora».
- Modificador de élite «Ardiente»: ya no dice «resiste el fuego».
- Objetos (legendarios de zonas 2-4 con `resFire`…): las líneas «% Res. …» ya no se muestran en tooltips, comparaciones ni afijos (`statShown`). Los datos no se tocan.
- Las resistencias de los enemigos no se muestran (ya estaban tras `FEATURES.resistances`).

### E. Referencias muertas
- **`reroll`:** no existe en `PERKS`; `perkLevel(..., 'reroll')` siempre da 0. Además, las re-tiradas solo actúan sobre `run.offers`, que ninguna parte del código rellena (el botín es individual y directo). Se corrigió solo lo visible: pantalla de resultado («vida, oro, botines y curación permanentes», antes citaba re-tiradas) y reliquia «Dado trucado» («Sin efecto por ahora: ya no hay re-tiradas de botín»). El código muerto (`rerolls`, acción `reroll`, `lootRow`) **no se ha tocado**.
- **Sala `cage`:** el generador no la crea, pero hay dependencias activas (`chooseNode`, `CAGE_ALLY`, `run.cage`, iconos, `NODE_NAME`, un test en `v4.test.ts`). No se elimina nada; no aparece en la leyenda del mapa, así que no hay promesa visible.
- **Logros de clases ocultas** (guerrero, mago, pícaro, clérigo): `listedAchievements()` oculta esos 4 de la pestaña y del contador, salvo que el jugador ya los tenga. Siguen en `ACHIEVEMENTS` y en los datos guardados; no se borra ni reinicia nada.

## 4. Tests
- Antes: 212 pasados, 1 omitido (22 archivos).
- Después: **227 pasados, 1 omitido (23 archivos)**; +15 tests nuevos en `tests/fase0.test.ts` (zonas 0–5 del reto diario, salas/ecos/XP en 1-2-3 zonas con derrota y victoria, arena, maestría <5 y ≥5, fallback, textos sin resistencias ni «4 opciones», logros ocultos). No se modificó ningún test existente.
- Cobertura de regresión por inspección: combate, clases, mapas, forja y persistencia no se tocaron y sus tests siguen en verde. No hay tests de red ni de UI (ya señalado en la auditoría).

## 5. Build
`npm run build` (`tsc --noEmit && vite build`): correcto. Solo el aviso habitual de chunks > 500 kB.

## 6. Riesgos y pendientes
1. **Decisiones de diseño sin tomar:** «Medalla de fe» y «Dado trucado» quedan sin efecto (solo texto honesto). Habría que decidir si se les da un efecto real, se retiran de los pools o se rediseñan. No lo he inventado.
2. **Recompensas algo mayores** en partidas largas (ver tabla). Es la corrección pedida; conviene vigilar el ritmo de ecos al medir dificultad (Fase 1).
3. Partidas guardadas antes de esta fase siguen cargando (no hay campos nuevos en `RunState` ni en `Meta`).
4. El heroe con maestría 5 se lee de `HeroSave.mastery` (lo envía cada jugador al unirse, como antes): un cliente modificado podría declararse maestría 5. Mismo modelo de confianza que ya existía para el resto de datos.
5. Código muerto de re-tiradas y de `lootRow`/`run.offers` sigue presente.
6. Sin verificar en producción: envío real del reto diario.

## 7. Supabase y seguridad
No se cambió ni ejecutó nada que modifique Supabase: ni esquema, ni migraciones, ni RLS, ni permisos, ni funciones `SECURITY DEFINER`, ni autenticación. Solo se hicieron **consultas de lectura** (`pg_get_functiondef` de `submit_daily`/`top_daily`, restricciones de `daily_scores` y un `SELECT` de las filas) para confirmar el rango de `zone`. Los avisos de seguridad siguen aplazados.

## 8. Resumen del diff
```
 src/content/boons.ts         |  4 ++--
 src/content/enemies.ts       |  2 +-
 src/content/relics.ts        |  8 ++++----
 src/content/zona1/events.ts  |  2 +-
 src/content/zona2/content.ts |  2 +-
 src/content/zona3/content.ts |  2 +-
 src/core/items/items.ts      |  7 ++++++-
 src/game/meta.ts             | 30 ++++++++++++++++++++++++++++--
 src/game/run.ts              | 26 +++++++++++++++++++-------
 src/net/transport.ts         |  5 ++++-
 src/ui/app.ts                |  4 ++--
 src/ui/panels.ts             | 10 +++++-----
 src/ui/screens.ts            | 12 ++++++------
 13 files changed, 80 insertions(+), 34 deletions(-)
```
