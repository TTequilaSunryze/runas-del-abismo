# FASE G2 — Eventos especiales y encuentros poco frecuentes

Base: `25411d0` (G1 publicada: modificadores en `content/modes.ts`, `run.mods`). Árbol limpio al empezar.

## Cómo funciona
Los eventos ya eran datos (`EventDef`: opciones con un efecto) que se votan y resuelve el anfitrión con el generador de la partida (`resolveEvent`), y el resultado viaja en `RunState`. G2 reutiliza ese sistema tal cual: los especiales son `EventDef` con una marca (`special: 'especial' | 'raro'`), zonas permitidas y un peso. No hay sistema paralelo ni cambios de forma en `RunState` (solo se usan `flags`, `eventsSeen`, `hexes`, `ambush`, `nextOmen`, que ya existían), así que las partidas antiguas siguen cargando.

## Eventos (10)
| Id | Nombre | Tipo | Zonas | Decisiones |
|---|---|---|---|---|
| `sp_mercader` | El Mercader Errante | especial | todas | 120 de oro → reliquia rara (solo quien pueda pagar) · −10 de vida máx. → +150 de oro · irse |
| `sp_altar` | El Altar Olvidado | especial | todas | +3 de daño hasta el final a cambio de Grilletes (−1 PM) 3 combates · curar 30% |
| `sp_camara` | La Cámara Sellada | especial | todas | pagar 80 → objeto raro+ · forzar: 50% objeto épico para todos / 50% −30% de vida actual · irse |
| `sp_viajero` | El Viajero del Abismo | **raro** | 2–4 | reliquia rara para cada uno, pero el jefe de la zona +25% de vida · curar 25% y +40 de oro · irse |
| `sp_eco` | Eco de una Expedición Perdida | **raro** | 1–3 | −10% de vida actual y desvela la historia «La expedición perdida» · +60 de oro y emboscada |
| `sp_forja` | La Forja Prohibida | especial | 2–4 | objeto épico+ a cambio de −12 de vida máx. · 100 de oro → objeto raro+ · irse |
| `sp_destinos` | El Santuario de Dos Destinos | especial | todas | +2 de daño **o** +15 de vida máxima (excluyentes) |
| `sp_campeon` | El Desafío del Campeón | **raro** | todas | emboscada opcional (+2 enemigos); si la ganáis, reliquia rara para cada uno · rechazar |
| `sp_anomalia` | Anomalía Rúnica | especial | todas | próximo combate con presagio Calma (+1 PA) a cambio de −15% de vida · presagio Luna de sangre · nada |
| `sp_tesoro` | El Tesoro Custodiado | **raro** | todas | arriesgar la mitad del oro (60% doblar, 40% perder; una tirada para el grupo) · +25 de oro |
Los efectos son «hasta el final de la expedición» o temporales; nada es permanente entre partidas. Ninguna opción deja a nadie a 0 de vida ni con oro negativo (probado), y siempre hay una opción sin coste o de bajo riesgo.

## Aparición y frecuencia
- Al entrar en una sala de evento: si hay candidatos (zona permitida, no vistos en la expedición) y aún no ha salido un especial en esta zona, hay un **35%** de que sea especial; si no, sale el evento normal de siempre.
- Como mucho **un especial por zona** (marca `g2z<zona>`) y ninguno se repite en la misma expedición. Los eventos normales siguen siendo la mayoría.
- Peso: especial 3, raro 1.
- **Integración con G1:** Pobreza baja el peso del Mercader; Maldición persistente sube el del Altar; Tiempos de augurio o Niebla arcana suben el de la Anomalía; Campeones o Enemigos reforzados suben el del Desafío; Oscuridad profunda sube el del Eco.
- Las reliquias de grupo de cambio de zona y los eventos normales no cambian.

## Cooperativo
Mismo camino que los eventos actuales: todos ven el mismo evento y votan, el anfitrión resuelve (incluidas las tiradas al azar, con el generador de la partida) y el resultado llega a todos en el estado. Los clientes nunca resuelven por su cuenta.

## Archivo
- Los 10 eventos están en el Atlas (categoría Eventos, con icono ✦), y se registran como el resto (desbloqueado al aparecer, explorado al resolverse), de forma idempotente.
- Nueva historia en las Crónicas: **«La expedición perdida»**, que se desvela al escuchar el Eco.

## Interfaz
La ventana del evento lleva un distintivo «✦ Evento especial» (morado) o «✦ Encuentro poco frecuente» (dorado) y un brillo del mismo color; el resto (opciones con sus costes, votos, resultado) es la ventana de siempre.

## Archivos
```
 src/content/zona1/events.ts         |  2 ++
 src/game/archive.ts                 |  1 +
 src/game/atlas.ts                   |  6 ++++--
 src/game/run.ts                     | 21 ++++++++++++++++++---
 src/ui/screens.ts                   |  4 +++-
 src/ui/style.css                    |  6 ++++++
 tests/abyss_archive_phase_b.test.ts |  2 +-
 7 files changed, 35 insertions(+), 7 deletions(-)
```
Nuevos: `src/content/specialEvents.ts`, `tests/specialEvents.test.ts`, `FASE_G2_EVENTOS_ESPECIALES.md`.

## Comprobaciones
- `npm test`: **31 archivos, 332 pasados, 1 omitido**. Nuevo `tests/specialEvents.test.ts` (5 tests: catálogo y Atlas, condiciones de zona y repetición, todas las opciones resueltas por votación sin dejar a nadie a 0, aparición real en expediciones como mucho una por zona, recompensa del Desafío). Un test de la Fase B se actualizó porque contaba las historias (ahora hay una más).
- `npm run build`: correcto.

## Limitaciones
- No he visto un evento especial en el navegador (salen al azar); la ventana es la de siempre con un distintivo y un borde nuevos.
- Los valores (35%, pesos, costes) son prudentes pero no se han medido en partidas reales.
- Las bendiciones de «hasta el final» (+2/+3 de daño, ±vida máxima) se suman a las de los eventos existentes; conviene vigilar que no se acumulen demasiado en expediciones largas.
