# FASE G3.0 — Auditoría y reequilibrio del combate

Base: `cd7675e`, árbol limpio. Cambios pequeños y localizados; sin tocar el motor, las clases, la economía ni `RunState`.

## 1. Fórmulas encontradas (código real)
**Vida de un enemigo** (`content/enemies.ts · makeEnemy`):
`vida = base × 2,75 × [1,1 comunes] × [1,15 listas 2-3] × (1 + 0,2·prof) × [jefes/élites/pilares: 1 + 0,35·(n−1)] × hpMul`
**Daño plano**: `poder = 0,65·prof + opts.power`.
**Refuerzo** (`run.ts · enemyOpts`):
`boost = −0,4 + 0,45·zona + [Abismo +0,4] + [asc≥1 +0,1] + [asc≥9 +0,1] − 0,12·máx(0, 3−n)`; `hpMul = 1 + boost (+ pactos, modificadores, asc 6 jefe +0,2)`; `poder += boost × 5`.
**Profundidad**: `mín(5, combates ya hechos en la zona)`; el jefe y el líder élite, `mín(2, …)`.
**Combate de jefe**: jefe + **n escoltas**.
**Invocaciones del jefe** (`core/combat/ai.ts · bossTurn`): fase 1, cada 2 rondas si hay menos de n enemigos además del jefe, 1 esbirro; fase 2 (al 50%), `máx(1, n−1)` esbirros + 2-3 pilares (×2 en asc 10).
**Esbirro**: `makeEnemy(esbirro, prof 1, 1 jugador, hpMul 1 + asc)`, **sin refuerzo de zona**.
**Pilares**: curan al jefe un 5% de su vida máxima en cada turno de cada pilar, hasta la ronda 20.
**Alzar muertos** (enemigos con `raise`): hasta que haya `héroes + 4` enemigos vivos.

## 2. Problemas concretos (números de A0, 5 combates previos en la zona)
| Problema | Dato | Por qué |
|---|---|---|
| **Escoltas más fuertes que el jefe en proporción** | zona 3, 4 jugadores: 4 escoltas, dos *cenicientos* de 417 de vida y +6 de daño | Las escoltas usaban profundidad 5 mientras el jefe usa 2, y había una por jugador |
| **Esbirros con demasiada vida al principio** | zona 1: esqueleto invocado 87 de vida frente a 63 de una momia normal | Los esbirros no recibían el refuerzo de zona, que en la zona 1 es negativo |
| **Invocación casi continua** | cada 2 rondas, sin límite total; al matar uno, sale otro | Solo había un tope de vivos y contaba también las escoltas |
| **Invocaciones que sobreviven al jefe** | no estaban marcadas como suyas | Alargaban el final del combate |
| **Pilares** | con 3 pilares, el jefe se cura un 15% por ronda | 5% por pilar y turno |
| **Alzar muertos** | hasta `héroes + 4` enemigos | Se suma a las escoltas y a los esbirros |
| **Coop: efectos que se multiplican** | n=4: jefe ×2,05 de vida, más 4 escoltas, más 4 esbirros a la vez, más 3 pilares con más vida | Cada sistema escalaba con n por separado |
| **Pico de vida entre zonas** | jefe de 2 jugadores: 299 → 870 → 1721 → 3709 | La vida base del jefe crece ×1,5-1,8 por zona y el refuerzo sube 0,45 por zona |

## 3. Cambios
| Sistema | Antes | Ahora | Motivo |
|---|---|---|---|
| Escoltas del jefe | n | **máx(1, n−1)** → 1, 1, 2, 3 | Menos cuerpos que repartir en grupo; el jefe ya gana vida por jugador |
| Profundidad de las escoltas | mín(5, combates) | **la del jefe, mín(2, …)** | Escoltas a la altura del jefe, no por encima |
| Vida de los esbirros | base × 2,75 × 1,1 × 1,2 × (1 + asc), sin zona | **base × … × máx(0,3; (1+boost) × 0,6)**, daño `boost × 2,5` | Siguen la curva de su zona y siempre tienen menos vida que un enemigo normal de la zona |
| Frecuencia de invocación | cada 2 rondas | **cada 3 rondas** | Dar margen para centrarse en el jefe |
| Esbirros vivos a la vez | n (contando escoltas) | **1, 1, 2, 2** y además menos de n+1 enemigos sin contar el jefe | Evitar la acumulación |
| Esbirros por combate | sin límite | **n + 1** en total (fases 1 y 2) | Que matarlos sirva |
| Esbirros al pasar a fase 2 | máx(1, n−1) | **⌈n/2⌉** (dentro del total) | Menos pico al 50% |
| Esbirros del jefe al morir él | seguían | **mueren con él** (marcados como invocaciones suyas) | Igual que ya pasaba con las demás invocaciones |
| Curación de pilares | 5% por pilar | **3%** | Con 3 pilares, 9% por ronda en vez de 15%; siguen obligando a repartirse |
| Alzar muertos | hasta héroes + 4 | **hasta héroes + 2** | Mismo motivo |
| Vida del jefe | 1 + boost | **1 + boost × 0,85 cuando boost > 0** | Suaviza el pico de las zonas 3 y 4 sin tocar las primeras |

No se han tocado: vida base de los enemigos, daño de los hechizos, escalado de enemigos normales y élites, número de enemigos en combates normales, pilares por jugador, ascensiones, recompensas, clases.

## 4. Resultado por jugadores (A0, 5 combates previos; vida/daño plano)
| | Antes | Ahora |
|---|---|---|
| Zona 1, 1 jugador | jefe 166 · escolta 37 · esbirro 87 | jefe 166 · escolta 26 · esbirro 22 (máx. 1 a la vez, 2 en total) |
| Zona 1, 4 jugadores | jefe 568 · 4 escoltas 56-87 · esbirros 87 ×4 | jefe 568 · 3 escoltas 39-61 · esbirros 26 (2 a la vez, 5 en total) |
| Zona 2, 2 jugadores | jefe 870 · 2 escoltas 152/+3 · esbirro 94 | jefe 870 · 1 escolta 106/+1 · esbirro 44 |
| Zona 3, 4 jugadores | jefe 2841 · 4 escoltas 248-417/+6 · esbirro 123 | jefe 2699 · 3 escoltas 173-266/+4 · esbirro 93 |
| Abismo, 4 jugadores | jefe 5935 · 4 escoltas 517-905/+10 · esbirro 109 | jefe 5424 · 3 escoltas 362-633/+8 · esbirro 128 |
En el Abismo el esbirro tiene ahora algo más de vida que antes (sigue la curva de la zona), pero menos que un enemigo normal de esa zona, y hay muchos menos.

## 5. Ascensiones
Sin cambios en su lista: siguen sumando refuerzo (A1 y A9), modificadores de élite (A2, A5), menos curación (A3), precios (A4), jefe +20% (A6), un enemigo más (A7), vida inicial (A8) y pilares ×2 (A10). Como los cambios actúan sobre la base, cada ascensión añade lo mismo que antes sobre un A0 más razonable. En A10 los pilares siguen siendo el doble, pero curan un 3% cada uno.

## 6. Validado automáticamente y pendiente de jugar
**Validado** (`tests/rebalance.test.ts`, 5 tests):
- escoltas 1/1/2/3 y combate de jefe con jefe + escoltas;
- topes de esbirros (1, 1, 2, 2 a la vez; n+1 en total);
- un esbirro nunca tiene más vida que un enemigo normal de su zona;
- en 30 rondas el jefe no supera su total de invocaciones;
- las ascensiones siguen sumando (refuerzo, pilares en A10);
- determinismo: misma semilla, mismo combate.

`npm test`: **32 archivos, 338 pasados, 1 omitido**. `npm run build`: correcto.

**No validado (necesita partidas reales):**
- si A0 es ganable para vuestro grupo;
- cuánto duran ahora los jefes;
- si el daño de los enemigos de las zonas 3 y 4 (+7/+8 por golpe) sigue matando sin margen;
- cómo afectan las zonas cortas de la fase anterior (menos objetos antes del jefe).

No he hecho simulaciones con bots porque no juegan como personas.

## 7. Riesgos y siguiente paso
- **El salto de la zona 1 a la 2** (jefe ×2,9 de vida) sigue ahí: depende de cuánto crecen los héroes con objetos y bendiciones entre zonas, que no se puede medir sin datos de partidas. Si os atascáis en la zona 2, es lo siguiente a revisar.
- **El daño plano de las zonas 3 y 4** (`boost × 5`) no se ha tocado; si notáis muertes sin respuesta allí, reducir ese ×5 es la palanca más directa.
- **Recomendación**: jugar 2-3 partidas en A0 con 2-4 jugadores y anotar dónde muere el grupo y cuántas rondas dura cada jefe.

## Archivos
```
 src/core/combat/ai.ts | 19 ++++++++++++++-----
 src/game/run.ts       | 30 +++++++++++++++++++++++-------
 2 files changed, 37 insertions(+), 12 deletions(-)
```
Nuevo: `tests/rebalance.test.ts`.
