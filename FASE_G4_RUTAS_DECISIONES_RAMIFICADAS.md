# Fase G4 · Nuevas rutas, decisiones y acontecimientos ramificados

Se construye sobre lo que ya existía, sin duplicarlo:
- el generador de mapas de 7 salas + jefe y sus garantías por ruta;
- los eventos de grupo (votación y resolución en el anfitrión con el generador de la partida);
- las marcas de la partida (`run.flags`);
- los mecanismos de G2: `g2_desafio` y `g2_carga_<zona>`.

No cambia el motor de combate, G3.0–G3.4, `RunState` ni su versión (9). Tampoco Supabase, RLS, Auth ni RPC.

## 1. Análisis previo

- **Mapa** (`src/game/map.ts`): un grafo por capas que se valida ruta a ruta. Cada ruta debe tener:
  - de 3 a 5 combates;
  - como mucho un élite;
  - un descanso;
  - nunca 3 combates seguidos.
  - Además, hay al menos 4 bifurcaciones y 6 rutas.
- **Eventos:** cada uno tiene opciones con `apply(run)`. Se votan; el anfitrión resuelve y el estado se sincroniza entero, así que los clientes no pueden divergir.
- **Persistencia:** todo lo que hace falta cabe en lo que ya se guarda:
  - el mapa (`map`, `links`);
  - las marcas (`flags`);
  - los eventos vistos (`eventsSeen`);
  - `ambush`, `nextOmen`, `allies`, `hexes` y `bossOffer`.
  - **No hay campos nuevos.**

## 2. Nuevas rutas

| Ruta | Qué es | Riesgo / recompensa (visible antes de elegir) |
|---|---|---|
| 🩸 **Senda de sangre** | Un combate normal (fuera de la primera fila) se convierte en endurecido. Sale en el ~70% de las zonas | Enemigos con +25% de vida y +2 de daño. A cambio, +50% de oro y una reliquia para cada uno |
| 🗝️ **Pasaje secreto** | Nodo extra al final de una fila intermedia, enlazado desde un nodo de la fila anterior hacia uno de la siguiente. Sale en el ~97% de las zonas | Sellado: se ve con 🔒 y enlace punteado. Se abre con la **llave rúnica** de la zona o si el **jefe anterior cayó sin bajas**. Lleva a la Cámara Rúnica |

**Garantías**
- La Senda de sangre cuenta como combate en las reglas de ruta.
- El pasaje solo se coloca si todas las rutas que pasan por él cumplen las garantías.
- El nodo que lleva al pasaje conserva sus otras salidas, así que sellado nunca deja a nadie sin camino.
- Ninguna fila pasa de 4 nodos.
- Elegir el pasaje gasta la llave.

## 3. Decisiones y acontecimientos ramificados

Las decisiones dejan una marca `clave@zona` en `run.flags`. Su continuación aparece, con prioridad, en la primera sala de evento de una zona **posterior**.

| Inicio (zonas) | Opciones | Continuación en otra zona |
|---|---|---|
| **El Cartógrafo Perdido** (1-3) | Escoltarlo: −15% de vida y llave rúnica | **El Refugio:** descanso del 35%, o mapa (llave y oro), o, si liberasteis al prisionero, llave y curación |
| | Quitarle el mapa: llave y +40 de oro | **Los Cazarrecompensas:** pagar 50; o plantar cara (emboscada y reliquia rara al ganar, mecanismo de G2); o devolver la llave si aún la tenéis |
| | Comprarle una copia: 35 de oro cada uno, todos o nadie | — |
| **El Prisionero de las Cadenas** (1-3) | Liberarlo: −20% de vida; aliado hasta el final de la zona | **El Regreso:** vuelve a luchar con vosotros o reparte una reliquia a cada uno |
| | Venderlo: +70 de oro | **La Venganza:** devolver el oro (quien no pueda, −20% de vida) o enfrentarlo (emboscada con el doble de oro) |
| | Interrogarlo: llave rúnica | — |
| **La Fuente de las Ánimas** (2-4) | Beber: +1 de daño | **La Sed:** −10 de vida máxima, o perder el daño, o pagar 60 de oro (quien no pueda, pierde el daño). La Cámara Rúnica puede saldar la deuda |
| | Llenar frascos: una poción cada uno | — |
| | Sellarla con sangre: −20% de vida; el jefe de la zona llega con −15% de vida | — |
| **El Heraldo del Guardián** (2-3) | Aceptar: recompensa de jefe para cada uno ahora, pero el jefe de la zona tiene +25% de vida (mecanismo de G2) | — |
| | Sangre: −8 de vida máxima y una reliquia cada uno | — |
| | Romperle el cuerno: +50 de oro, pero el próximo élite sale maldito | — |
| **La Cámara Rúnica** (tras el pasaje) | Elegir una: reliquia rara cada uno; o un hechizo o mejora cada uno; o descanso del 50% y fin de las maldiciones; o, si bebisteis de la Fuente, saldar su deuda y curaros un 25% | — |

**Opciones condicionadas**
- No cambian de posición: se muestran 🔒 con el requisito.
- No se pueden votar ni ganar por empate.
- Cuando una decisión anterior las abre, lo indican («⑂ Disponible por una decisión anterior»).

**Hay resultados de los tres tipos:**
- positivos (refugio, regreso, cámara);
- negativos (venganza, sed);
- mixtos (trato del heraldo, emboscada con premio).

**Consecuencias persistentes:** el chip «⑂ Consecuencias» del mapa y del combate lista lo que está activo:
- pasaje abierto;
- perseguidos;
- favor o venganza del prisionero;
- sed;
- guardián debilitado o reforzado;
- élite maldito;
- emboscada;
- desafío.

Los acontecimientos iniciales entran en el sorteo normal de eventos de su zona. Salen una vez por expedición y no salen en el modo arena.

## 4. Cooperativo y determinismo

- Todo se decide en el anfitrión con `rand(run)` y viaja en el estado de la partida. Los invitados solo votan.
- La disponibilidad del pasaje y de las opciones depende solo del estado sincronizado (`flags`, `zone`), así que todos ven lo mismo.
- Recuperación: una partida guardada a mitad de una cadena continúa igual, porque todo está en `flags`, `map`, `links` y `eventsSeen`.
- Las partidas anteriores a G4 siguen cargando: sus mapas simplemente no tienen los nodos nuevos.

## 5. Interfaz

- **Mapa:**
  - iconos 🩸 y 🗝️, y 🔒 con borde y enlace punteados si el pasaje está sellado;
  - el tooltip muestra el riesgo y la recompensa, y si el pasaje está sellado o abierto;
  - la leyenda incluye los dos nodos nuevos.
- **Eventos:**
  - etiqueta «⑂ Decisión con consecuencias más adelante» o «↪ Consecuencia de una decisión anterior»;
  - opciones bloqueadas en gris con su requisito;
  - el desenlace se muestra como siempre.
- **Chip de consecuencias activas**, con el mismo estilo de pergamino.

## 6. Archivos

- **Nuevos:**
  - `src/content/branching.ts`
  - `tests/g4_rutas.test.ts` (11 tests)
  - este documento
- `src/game/map.ts`: tipos `sangre` y `vault`; `addRoutes`, `vaultAt` y `SANGRE_CHANCE`; la Senda de sangre cuenta como combate.
- `src/game/run.ts`:
  - `NodeKind`, nombres y pistas;
  - `availableNodes` (pasaje sellado);
  - `chooseNode` (Senda, Cámara y prioridad de continuaciones);
  - votación y resolución con opciones bloqueadas;
  - vida y daño de la Senda, jefe debilitado, oro y reliquia de la Senda.
- `src/ui/panels.ts`: mapa, leyenda y chip de consecuencias.
- `src/ui/screens.ts`: etiquetas y opciones bloqueadas.
- `src/ui/icons.ts` y `src/ui/style.css`.

## 7. Validación automática

- `npx vitest run`: **371 pasan, 1 omitido** (antes 360). Ningún test falla.
- `npm run build`: correcto.
- **Nuevos tests:**
  - 300 mapas: todas las rutas válidas (también por el pasaje), sin callejones sin salida, filas de 4 como máximo, y frecuencia del pasaje y de la Senda;
  - el pasaje sellado no se puede elegir; con la llave sí, y la gasta; también se abre con el jefe anterior sin bajas;
  - Senda de sangre: enemigos más duros, reliquia al ganar y marca consumida;
  - todas las opciones de todos los acontecimientos sin vida ni oro negativos;
  - cadenas del cartógrafo, del prisionero y de la fuente (aparición solo en zonas posteriores y desenlaces distintos);
  - opciones bloqueadas que no se votan ni ganan y se desbloquean;
  - heraldo;
  - determinismo con la misma semilla;
  - recuperación desde una copia serializada a mitad de cadena.

## 8. Limitaciones y pruebas manuales

- **No probado en navegador desde aquí:**
  - que el 🔒 y los enlaces punteados se lean bien sobre el pergamino;
  - que el chip de consecuencias no sature la barra cuando hay muchas;
  - que las opciones bloqueadas se entiendan.
- **Cooperativo en línea:** comprobar que el invitado ve el pasaje sellado o abierto igual que el anfitrión, que no puede votar opciones bloqueadas y que, tras reconectar, las consecuencias siguen ahí.
- **Equilibrio por partidas reales:**
  - la Senda de sangre (+25% de vida, +2 de daño) frente a su recompensa;
  - el valor de la Cámara (puede ser muy fuerte si se abre en todas las zonas);
  - la frecuencia real de las cadenas, que solo continúan si el grupo pasa por una sala de evento en una zona posterior.
- **Modificador Oscuridad profunda:** también oculta el pasaje mientras esté lejos.
