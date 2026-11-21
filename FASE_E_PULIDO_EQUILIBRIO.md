# FASE E — Pulido, equilibrio y validación final

Estado: implementado, **sin commit**. Base: `0327917` (fases 0 a D publicadas).

## 1. Interfaz del Archivo
- **Navegación unificada:** una sola pestaña **📚 Archivo** en el inicio con Bestiario, Grimorio, Reliquias, Atlas, Crónicas y **Contratos** (antes era una pestaña aparte; ahora es una sección del Archivo). La pestaña del inicio muestra el % global y «(N!)» si hay recompensas por cobrar.
- **Cabecera común** (`archiveHeader`): colección global con barra (Bestiario + Grimorio + Reliquias + entradas del Atlas + Crónicas completadas: 321 entradas), descripción de la sección y navegación.
- **Filtros avanzados:** además de Todo / Descubierto / Sin descubrir, un filtro secundario por **zona** (Bestiario), por **clase** o «solo bendiciones» (Grimorio) y por **rareza** (Reliquias). Cada sección indica su % y recuento.
- Fichas con estados bloqueado/desbloqueado como en las fases A–D (sin cambios de diseño).

## 2. Notificaciones de descubrimiento
- `recordArchive` compara lo conseguido antes y después de cada registro y deja avisos en cola (`drainArchiveNotices`): criatura nueva, reliquia, entrada del Atlas, grimorio (agrupado: «3 entradas nuevas»), crónica, secreto o hito completados, contrato cumplido y desafío especial completado.
- Se muestran en una **pila discreta arriba a la derecha** (`.archnotes`), máximo 4 por tanda más «y N más», se desvanecen en ~5 s y **no capturan clics** (no tapan el juego ni el combate). Colores por tipo con el estilo actual.
- **Pantalla de resultados:** nuevo panel «📚 Descubierto en esta expedición» con todo lo nuevo de la partida.

## 3. Equilibrio de recompensas (análisis con las fórmulas reales)
| Fuente | Ecos |
|---|---|
| Derrota en zona 1 / 2 / 3 (a mitad) | 20 / 93 / 162 |
| Victoria (asc. 0 / asc. 3) | 271 / 434 |
| Contratos: máximo semanal (21 diarios + 3 semanales) | 300 |
| Contratos especiales, hitos, Atlas, Crónicas | 0 |
| **Logros (total)** | **1.970** |
| **Mejoras permanentes (todo lo comprable)** | **950** |

Conclusiones:
- Los contratos son una fuente pequeña: el máximo semanal es ~1,1 victorias, y para un jugador que juega dos partidas al día (~150 ecos de media cada una) es un ~14% de sus ingresos. **No he cambiado sus valores** ni las fórmulas de partida (corregidas en la Fase 0). Un test fija ese límite para que no se dispare en cambios futuros.
- **El desequilibrio real es el sumidero, no la fuente:** solo los logros ya dan el doble de lo que se puede gastar. Reducir recompensas no lo arregla; hace falta un destino para los ecos (desbloqueos horizontales: kits, cosméticos comprables, variantes del Archivo…). Es una **decisión de diseño pendiente** que no he inventado.

## 4. Pruebas de partidas completas y compatibilidad (`tests/fullrun.test.ts`)
- **Expedición completa de 2 jugadores, de la zona 1 al jefe del Abismo** (con pacto del Altar, salas, eventos, tienda, recompensas de jefe y santuario), partiendo de una **Meta antigua** sin `archive`/`contracts`/`cosmetics`:
  - Cada cliente tiene su propia Meta. El anfitrión registra sobre el estado original y el invitado sobre una copia recibida por red (JSON), como en `session.ts`.
  - El registro **nunca altera el estado autoritativo** de la partida (comprobado en cada paso): no puede desincronizar.
  - Zonas 1-4 exploradas, final de victoria, historia de clase, pacto en el Atlas, bestiario estudiado, prueba de clase completada; los hechizos solo cuentan para quien los lanza.
  - Ecos, mejoras, maestría, logros, amigos y estadísticas antiguas intactos; el cobro final es único.
- **Repetir todos los registros** de una partida (reconexiones/recargas): ni el Archivo ni los contratos ni los ecos cambian.
- **Guardado local y persistencia remota:** fusión con una Meta antigua de otro dispositivo sin perder nada; un especial reclamado no se puede volver a reclamar tras fusionar; guardar y cargar.
- **Partida perdida:** registra la derrota y cobra una sola vez.
- Equilibrio: contratos acotados y sin ecos al generarlos.

### Fallo encontrado y corregido
La prueba de repetición destapó un hueco: el Archivo solo recordaba el **combate en curso**, así que volver a recibir el estado de un combate ya cerrado lo contaba otra vez (enemigos vistos y derrotados). Ahora guarda las claves de los últimos 80 combates cerrados (`archive.past`) y los ignora si reaparecen. Además, el seguimiento en memoria pasa a ser por jugador local (sin efecto en el juego, donde hay uno por cliente).

## 5. Multijugador y transporte
- `session.ts`, `snapshot.ts` y `transport.ts` **no se han modificado**. `RunState` no ha cambiado en ninguna fase, así que las partidas guardadas y las copias de reconexión siguen siendo compatibles.
- Todo el registro ocurre en el cliente, después de recibir el estado del anfitrión, y es de solo lectura sobre la partida.
- **No verificado:** una sesión real en línea con dos navegadores contra Supabase tras estos cambios (la emulación de anfitrión/invitado sí pasa). Recomiendo una partida de prueba entre dos personas tras publicar.

## 6. Resultados
- `npm test`: **28 archivos, 305 pasados, 1 omitido** (antes 300). Ningún test existente modificado.
- `npm run build`: correcto (aviso habitual de chunks > 500 kB).
- Navegador: navegación unificada, filtros, Contratos dentro del Archivo y avisos al entrar en una partida en solitario («Atlas: Las Catacumbas Olvidadas», «Grimorio: 3 entradas nuevas»); sin errores de página.

## 7. Compatibilidad de datos
Meta sigue en `v: 1`; los campos nuevos (`archive`, `contracts`, `cosmetics`) son opcionales y se completan al cargar. `archive.past` es nuevo y opcional. Sin cambios en Supabase (ni esquema, RPC, RLS, `SECURITY DEFINER` ni autenticación); todo viaja en `profiles.meta`.

## 8. Pendiente
1. **Sumidero de ecos** (decisión de diseño; ver §3).
2. Partida real en línea entre dos jugadores tras publicar.
3. Los avisos solo se ven en la partida en curso; si recargas a mitad, la lista de la pantalla final empieza de nuevo (el Archivo sí lo conserva todo).

## 9. Resumen del diff
```
 src/game/archive.ts     | 65 +++++++++++++++++++++++++++++++++++++++++++------
 src/game/archiveData.ts |  5 ++++
 src/ui/app.ts           | 21 ++++++++++++++--
 src/ui/ctx.ts           |  8 ++++--
 src/ui/screens.ts       | 57 ++++++++++++++++++++++++++++---------------
 src/ui/style.css        |  8 ++++++
 6 files changed, 134 insertions(+), 30 deletions(-)
```
Nuevos: `tests/fullrun.test.ts`, `FASE_E_PULIDO_EQUILIBRIO.md`.
