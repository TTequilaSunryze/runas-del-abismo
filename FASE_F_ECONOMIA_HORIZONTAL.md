# FASE F — Economía horizontal, coleccionismo y personalización

Estado: implementado, **sin commit**. Base: `3511939` (Fase E publicada, rama `main`, árbol limpio al empezar).
Incluye la petición previa: **retirar el sistema de Mejoras permanentes** del menú y del código.

## 0. Retirada de las Mejoras permanentes
- Eliminados `PERKS`, `perkLevel`, `buyPerk`, la pestaña «Mejoras», la acción `perk`, las re-tiradas (`reroll`, `HeroSave.rerolls`) y `HeroSave.perks`.
- Efectos de combate que desaparecen (por petición expresa): +6% de vida por nivel de Vitalidad, oro inicial de Bolsa heredada, objeto extra de Ojo del saqueador y +8% de curación de Primeros auxilios. Es un **cambio de equilibrio**: los veteranos empiezan algo más débiles que antes.
- **Reembolso:** `refundPerks` devuelve exactamente los ecos gastados (precios originales en `LEGACY_PERKS`) una sola vez. `perksRefunded` recuerda lo devuelto, así que recargar o fusionar con otro dispositivo no paga dos veces. La tienda muestra un aviso con la cantidad devuelta hasta que el jugador lo acepta.
- `RunState`: se quitan `perks` y `rerolls` de cada héroe (consecuencia directa de la retirada pedida). Las partidas guardadas con esos campos siguen cargando (se ignoran).
- Datos reales (consulta de solo lectura): 4 cuentas, las 4 con Mejoras compradas; recibirán su reembolso al cargar.

## 1. Auditoría inicial
- `main` en `3511939`, publicado, árbol limpio. `Meta` en `v: 1` con `cosmetics` (Fase D: títulos y marcos), `archive` y `contracts`; fusión en `mergeMeta` y en `account.ts`.
- 8 clases jugables (`PLAYABLE`). Sprites dibujados por código: héroes con modelos animados de 32×32 (`models.ts`) o sprites de 16×16 con paleta (`sprites.ts`); escenas SVG de salas (`scenes.ts`).
- No existía equipamiento visual de héroes: solo título y marco en el inicio y en el Salón.

## 2. Arquitectura
- `src/game/shop.ts` (nuevo): catálogo, estados, compra (`buyItem`), desbloqueos exclusivos (`grantUnlocks`), equipar y quitar, conjuntos por clase (`saveLoadout`/`applyLoadout`/`resetLook`), apariencia enviada a la sala (`currentLook`), personalización del Archivo (`archiveLook`) y novedades.
- `src/game/cosmetics.ts` (ampliado, **no hay sistema paralelo**): `Cosmetics` gana `owned`, `eq`, `skins`, `loadouts`, `seen` y `spent`; nuevos títulos, marcos y emblemas.
- `src/render/palettes.ts` (nuevo): 8 variantes de color aplicadas a los sprites existentes (`recolor`, conserva tonos de piel) y 6 auras dibujadas bajo el héroe.
- `src/render/looks.ts` (nuevo): la apariencia de cada jugador viaja en la **presencia de la sala** (`look`), saneada con `cleanLook`. **No entra en `RunState`**: el estado autoritativo no cambia y un cosmético no puede afectar al juego.
- Render: `sprites.ts` (variante en sprites, modelos y retratos, con caché por variante), `board.ts` (aura y variante en combate), `combat.ts` (retratos de turnos y HUD).
- UI: pestaña **✨ Tienda** en el lugar de «Mejoras»; la vista «Títulos y marcos» de Contratos remite a la Tienda (un solo sitio para equipar). Emblema y título en el inicio, la sala y el Salón.

## 3. Catálogo: 94 elementos
| Categoría | Elementos | Comprables | Exclusivos |
|---|---|---|---|
| Aspectos de héroe | 25 | 16 (2 por clase) | 9 (Oro de maestría 5 por clase + Abisal) |
| Kits visuales | 8 | 8 | — |
| Efectos visuales (auras) | 6 | 4 | 2 |
| Marcos de perfil | 10 | 4 | 6 (Contratos Especiales) |
| Emblemas | 8 | 6 | 2 |
| Títulos | 22 | 5 | 17 (Contratos Especiales + Abismo) |
| Decoración del Archivo | 3 | 3 | — |
| Temas del Archivo | 4 | 3 | 1 |
| Marcos de fichas | 3 | 2 | 1 |
| Ilustraciones del Archivo | 5 | 5 | — |
Rareza de los comprables: 7 comunes, 21 poco comunes, 16 raros, 5 épicos, 8 conjuntos.

## 4. Precios y economía
Rangos aplicados: común 50–100, poco común 150–250, raro 300–450, épico 600–900, conjunto 980 (kits: dos variantes + aura + emblema con un 10% de descuento; lo que ya tengas se descuenta del precio).
- **Coste total:** 13.960 ecos comprando todo por separado.
- **Ingresos** (fórmulas reales): derrota en zona 1/2/3 ≈ 20/93/162; victoria 271 (434 en ascensión 3); contratos ≤300 por semana; logros 1.970 en total; especiales, colecciones y crónicas dan cosméticos, no ecos; reembolso de Mejoras hasta 950.
- **Jugador nuevo:** el primer cosmético (50–100) llega en 1–3 partidas o con el primer logro.
- **Veterano:** con los datos reales (máximo 636 ecos ahorrados + reembolso) puede comprar unos pocos elementos, no el catálogo. Completarlo exige unas 90 partidas medias o ~6 semanas de juego activo con contratos.
- **No he cambiado ningún precio ni ninguna recompensa** respecto a la propuesta: encajan en ambos extremos.

## 5. Sistemas visuales soportados
- Variantes de color de los 8 héroes, en el tablero, la línea de turnos, el HUD y la vista previa (comprobado en combate real).
- Auras animadas bajo los pies en combate (no tapan casillas ni números; se ocultan si el héroe es invisible).
- Emblemas junto al nombre en el inicio, la sala y el Salón; títulos y marcos (Fase D) en inicio y Salón.
- Archivo: 4 temas (fondo, fichas, pestañas, barras), 3 marcos de fichas, 5 ilustraciones (las escenas SVG existentes del Altar, la Forja, el cofre, la hoguera y el santuario) y 3 adornos. El texto mantiene su color.

## 6. No soportado (y por qué)
- **Modelos o animaciones nuevas:** el motor dibuja por código y no hay arte nuevo; las «variantes» son recoloreados de los sprites existentes, no aspectos con forma distinta.
- **Efectos en hechizos o golpes:** cambiarían la lectura del combate y exigirían tocar las animaciones de hechizos.
- **La variante en la selección de clase** del lobby: muestra el color original (usa tiras animadas aparte).
- **Ver la apariencia de amigos fuera de la sala:** solo viaja en la presencia de la sala.

## 7. Integración con Archivo, Contratos y logros
- Exclusivos por logro (Prior, Trofeo, Abismo…), maestría 5 por clase, crónicas e hitos: `grantUnlocks` los entrega en cuanto se cumple el requisito (tras cada registro del Archivo y al abrir la Tienda), una sola vez, con aviso «Desbloqueado en la tienda».
- Títulos y marcos de los Contratos Especiales aparecen en la Tienda como exclusivos y se entregan al reclamar el especial (Fase D).
- Ningún requisito depende de contenido no disponible: todos usan logros, clases jugables y crónicas existentes.

## 8. Persistencia y compatibilidad
- Compra: valida existencia, disponibilidad, requisito, propiedad y saldo; después descuenta una vez y registra `spent[id]`. Si falla, no toca nada. `spent` es una segunda barrera contra el doble cobro.
- **Fusión entre dispositivos** (`mergedEcos`): total ganado = saldo + gastado; se toma el mayor y se resta lo gastado en ambos. Una compra hecha en un dispositivo no se devuelve al fusionar con otro, ni se cobra dos veces; los objetos se unen sin duplicar.
- Meta antigua sin `cosmetics` o sin los campos nuevos: se completa al cargar. Ecos, maestría, logros, Archivo y contratos intactos.
- Supabase: sin cambios de esquema, RPC, RLS, `SECURITY DEFINER` ni autenticación. Solo una consulta de lectura para dimensionar la economía.

## 9. Pruebas
`tests/shop.test.ts` (18 tests) y ajustes en `meta`, `modes`, `archivo`, `specials` y `fullrun` por la retirada de Mejoras:
compra válida; saldo insuficiente; inexistente; exclusivo; bloqueado por requisito y comprable al cumplirlo; ya comprado y compra repetida; descuento único; kits (entrega, descuento proporcional, sin doble cobro); exclusivos por logros, maestría, crónicas, hitos y Contratos Especiales una sola vez; novedades; equipar y quitar; variantes solo en su clase; conjuntos (guardar, cambiar, predeterminado); **la ficha de combate del héroe es idéntica con todo equipado**; apariencias de otros jugadores saneadas; Meta antigua; guardar y cargar; fusión de dos dispositivos; recoloreado sin tocar la piel; reembolso de Mejoras único, también al fusionar.

## 10. Resultados
- `npm test`: **29 archivos, 321 pasados, 1 omitido**.
- `npm run build`: correcto.
- Navegador: Meta antigua con Mejoras → reembolso de 110 ecos y aviso; compra con confirmación (−200 ✨); compra sin saldo bloqueada con el aviso «Te faltan N ✨»; equipar variante y tema; inventario; exclusivo por logro marcado como NUEVO; Archivo con tema Abisal, fichas doradas, ilustración y velas; combate con variante Escarcha y aura en el tablero, la línea de turnos y el HUD; emblema en la sala. Sin errores de página.
- Corregido durante la validación: los temas apenas se notaban (ahora tiñen fichas, pestañas y barras) y los retratos de combate no mostraban la variante.

## 11. Resumen del diff
```
 src/content/modes.ts   | 27 +-------------
 src/content/story.ts   |  2 +-
 src/game/archive.ts    |  7 +++-
 src/game/cosmetics.ts  | 79 ++++++++++++++++++++++++++++++++++++----
 src/game/meta.ts       | 60 +++++++++++++++++++++++--------
 src/game/run.ts        | 40 +++++++--------------
 src/game/session.ts    | 10 +++---
 src/net/account.ts     |  4 +--
 src/render/board.ts    |  8 ++++-
 src/render/sprites.ts  | 26 +++++++++-----
 src/ui/app.ts          | 30 ++++++++++++----
 src/ui/combat.ts       |  7 ++--
 src/ui/ctx.ts          |  4 ++-
 src/ui/panels.ts       |  2 +-
 src/ui/screens.ts      | 97 +++++++++++++++++++++++++++++++++++++-------------
 src/ui/style.css       | 33 +++++++++++++++++
 tests/archivo.test.ts  |  3 +-
 tests/fullrun.test.ts  |  3 +-
 tests/meta.test.ts     | 23 ++++++++----
 tests/modes.test.ts    | 41 ++++++++++-----------
 tests/specials.test.ts |  4 +--
 21 files changed, 353 insertions(+), 157 deletions(-)
```
Nuevos: `src/game/shop.ts`, `src/render/looks.ts`, `src/render/palettes.ts`, `tests/shop.test.ts`, `FASE_F_ECONOMIA_HORIZONTAL.md`.

## 12. Pendientes conocidos
1. **Equilibrio sin Mejoras:** los héroes pierden hasta +30% de vida, oro inicial, un objeto extra y curación. Conviene medir la dificultad (Fase 1 de la auditoría).
2. Partida en línea real entre dos personas para ver la apariencia de los compañeros (la presencia de la sala no se ha probado con dos navegadores).
3. La selección de clase del lobby no muestra la variante equipada.
4. Los nombres de elementos, la elección de qué variante va a cada clase y qué exclusivos existen son decisiones mías.
