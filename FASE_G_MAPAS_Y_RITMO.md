# FASE G · Mapas y ritmo de expedición

Base: `f82bc13` (G1 y G2 publicadas), árbol limpio.

## Cómo era antes
- `src/game/map.ts`: 10 salas + jefe por zona (11 capas; 12 en la zona 1 con el Altar).
- El generador rellenaba todo de combates y luego exigía entre un **60 y un 70% de combates** y **al menos 5 peleas en cualquier camino** (`minFightsOnPath ≥ 5`).
- Estructura fija: la capa 1 era siempre santuario, la penúltima siempre tenía descanso, exactamente 2 tiendas y 1 botín en el centro, y la primera fila toda de combates.
- En la práctica, cada ruta tenía unos 6-8 combates antes del jefe. La sala Jaula existía, pero **nunca se generaba**.

## Nueva estructura
- **7 salas jugables + jefe** por zona (`ACT_ROOMS = 7`; 9 capas en la zona 1 contando el Altar), de **2 a 4 nodos por capa** (3 en la primera, 2-3 en la anterior al jefe).
- **Ritmo por filas**: cada una de las 6 primeras filas recibe un papel al azar:
  - *de combate*: sobre todo combates, élites y jaulas;
  - *mixta*: de todo un poco;
  - *tranquila*: eventos, tiendas, santuarios, botín y forja.
  - Hay 2-4 filas de combate y nunca 3 seguidas; la primera nunca es tranquila y nunca lleva santuario.
  - El tipo de cada nodo se sortea con pesos según ese papel, así que ninguna fila tiene siempre lo mismo.
- **Fila anterior al jefe**: casi siempre descansos (alguna tienda o evento).
- **Conexiones**: cada nodo enlaza con 1-2 de la capa siguiente; los caminos se separan y vuelven a unirse.

## Garantías (se validan sobre todas las rutas completas)
`allPaths` recorre todas las rutas de la primera capa al jefe y `pathOk` exige en cada una:
- **3 a 5 combates normales** (las jaulas cuentan como combate);
- **como mucho 1 élite** (siempre opcional: ninguna ruta lo exige);
- **al menos 1 descanso** antes del jefe;
- **nunca 3 salas de combate seguidas** (combate, élite o jaula).

En el mapa completo exige además:
- al menos una forja, una tienda y un evento;
- **4 o más bifurcaciones y 6 o más rutas distintas** (para evitar carriles paralelos).

Si un mapa no cumple, se genera otro con la misma semilla (reproducible). Si la zona no tiene élite, se intenta convertir un combate en élite sin romper ninguna ruta. Hay un mapa de reserva ramificado y válido para cualquier camino; en 600 semillas probadas no hizo falta.

Resultado medio por zona: ~29 rutas distintas; ~8 combates, 1 élite, 1,3 jaulas, 2,7 descansos, 2,3 eventos, 1,6 tiendas, 1,1 santuarios, 1,6 forjas y 0,5 salas de botín.

## Otras salas
Se mezclan **eventos** (y los **especiales de G2**, que salen al entrar en una sala de evento), **tiendas**, **santuarios**, **botín**, **forja**, **jaula** y **descansos**, sin posiciones fijas salvo los descansos antes del jefe.

## Progresión, escalado y economía
- **El nivel no sube por combate** (los héroes son de nivel 1 y crecen con objetos, bendiciones y reliquias), así que menos combates no deja a los héroes con menos nivel ante el jefe.
- **Escalado de enemigos**: depende del número de combate en la zona (`zoneFight`); con 3-5 combates sigue llegando a las listas de enemigos más fuertes y a los mismos tamaños de grupo. No se ha tocado.
- **Jefes**: sin cambios de vida ni de daño.
- **Oro**: los combates normales y de élite dan un **20% más** (no el jefe), para compensar en parte que hay menos combates.
- **Ecos y maestría**: cada sala vale 11/8 de lo que valía, así que una zona completa da lo mismo que antes. Una victoria sigue dando ~271 ecos.
- Los contratos, logros y recompensas no dependen de hacer 10 combates.

## Compatibilidad
- **G1**: los modificadores actúan igual. Excepción: *Sin descanso* convierte los descansos en combates, así que con él activo las rutas pueden superar los 5 combates y quedarse sin descanso. Es el objetivo de ese modificador; las garantías se aplican antes de los modificadores.
- **G2**: los eventos especiales salen en las salas de evento.
- **Cooperativo**: el mapa lo genera el anfitrión con la semilla de la partida y viaja en `RunState` (`map`, `links`), así que todos ven el mismo. La elección de ruta funciona igual.
- **Partidas antiguas**: guardan su propio mapa y siguen con él. `RunState` no cambia de forma.
- **Interfaz**: el mapa de pergamino ya mostraba tipos, conexiones y nodos accesibles; con menos capas cada nodo tiene más espacio.

## Tests y build
- `npm test`: **31 archivos, 333 pasados, 1 omitido**.
- `tests/map.test.ts` reescrito para el nuevo diseño:
  - 300 semillas con todas las garantías por ruta;
  - nodos alcanzables y conectados al jefe, ramas y variedad;
  - reproducible por semilla;
  - solo se avanza por las aristas.
- `tests/fase0.test.ts` ajustado al factor 11/8, comprobando que una victoria sigue dando ~271 ecos.
- `npm run build`: correcto. El mapa se revisó en el navegador.

## Archivos
```
 src/game/map.ts     | 146 +++++++++++++++++++++++++++++++++++++---------------
 src/game/meta.ts    |   7 ++-
 src/game/run.ts     |   3 +-
 tests/fase0.test.ts |  25 +++++----
 tests/map.test.ts   |  59 +++++++++++----------
 5 files changed, 157 insertions(+), 83 deletions(-)
```

## Limitaciones
- No se ha medido en partidas reales si 3-5 combates con +20% de oro dejan a los grupos bien equipados ante el jefe. Habrá menos objetos de botín por zona (menos combates); la sala de botín y las tiendas compensan en parte. Es lo primero que conviene vigilar.
- Con *Sin descanso* las garantías no se mantienen (es el propósito del modificador).
