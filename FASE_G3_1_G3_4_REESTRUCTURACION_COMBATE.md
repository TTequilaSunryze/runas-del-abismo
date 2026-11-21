# Fases G3.1 a G3.4 · Reestructuración del combate

Se trabaja sobre G3.0 (commit 15bbb66), que no se toca. Siguen igual:
- vida, daño, profundidad, escalado cooperativo y ascensiones;
- `MINION_HP`, `minionCap`, `minionTotal`, `bossEscorts`;
- el 3% de curación por pilar.

## 1. Diagnóstico inicial

**Jefes**
- Los ocho usaban el mismo `bossTurn`. En la fase 1 atacaban a distancia e invocaban cada 3 rondas.
- Al 50% todos hacían lo mismo: +2 de armadura, cuerpo a cuerpo, ⌈n/2⌉ invocaciones y pilares que curan.
- Solo cambiaban sus dos hechizos y sus rasgos. No había ataques anunciados, ventanas de vulnerabilidad ni objetivos con recompensa.
- El Eco se regeneraba un 8% por turno pasara lo que pasara. Con su vida, eso lo convertía en un saco de vida.
- Las larvas del Devorador se dividían al morir: más saturación.

**Invocaciones**
- G3.0 ya limitó cuántas y con cuánta vida.
- Seguían siendo todas iguales: esbirro genérico, sin papel, sin duración y sin ventaja al matarlas.
- Los acólitos podían alzar sin límite propio. Sus alzados no dependían de ellos.

**Clases**
- **Arquero:** no tenía mecánica propia; su pasiva decía «sin recurso propio».
- **Arquitecto:** la Lanza de energía (2 PA, 16 de daño, perfora) se podía repetir 3 veces por turno. Era el mejor daño por PA del juego y eclipsaba sus glifos.
- **Bárbaro:** Sed de batalla gastaba toda la Furia para curar como mucho 14. Casi nunca compensaba.

**Habilidades de jefe** (las que ofrece la recompensa del jefe: hechizos `boon` del patrón de cada clase)
- Son 56 en las 8 clases.
- Enfriamiento N significa que la habilidad no se puede usar durante N turnos propios.
- 3 tenían enfriamiento 4 (Frenesí imparable, Halcón y Ciudadela de cristal, que además costaba 5 PA) y 11 tenían 3.
- Varias de ellas eran apoyo o preparación y no justificaban esa espera.

## 2. Jefes (G3.1)

Nuevo `src/core/combat/bosskits.ts` (solo datos) y lógica en `ai.ts`.

**Ataque anunciado.** El jefe gasta 3 PA en marcar casillas en rojo con «!». Estallan al empezar su siguiente turno. El grupo tiene una ronda entera para apartarse.
- Las líneas se cortan con los obstáculos: cubrirse funciona.
- Si el jefe muere, el anuncio desaparece.
- Las marcas usan los marcadores del suelo que ya existían (`marks`, de tipo `omen`). No hay campos nuevos de estado.
- El registro avisa con el nombre del ataque y cómo esquivarlo.
- Un aviso «⚠ Ataque anunciado» aparece en la barra del combate.

**Reglas comunes**
- Nunca hay dos anuncios seguidos (cada 2 o 3 rondas).
- En la ronda del anuncio el jefe no invoca.
- Derribar un pilar deja al jefe Expuesto (−2 de armadura) 2 rondas.

| Jefe | Ataque anunciado | Ventana / objetivo | Invocaciones | Fase 2 |
|---|---|---|---|---|
| Prior Hueco | Campana fúnebre: cruz sobre el grupo más apiñado (×1,2) | Pilares: cada uno derribado lo expone | Guardián: alza un esqueleto **sobre un cadáver**, solo en fase 1 | Coloso con pilares |
| Plañidera | Llanto: línea de 6 hacia el más frágil (×1,2). Fase 2: Gemido, anillo a 1-2 casillas que quita 1 PA | Tras el gemido, Vulnerable 1 ronda | Manifestación: espectros que se desvanecen en 2 turnos; matarlos le quita 1 PA | **Sin pilares** |
| Madre Raíz | Raíces del subsuelo: 3×3 sobre el más lejano; inmoviliza (×0,9) | Brotes sanadores: derribarlos la expone | Esbirro: araña, solo en fase 1 | Brotes |
| Cazador Silvano | Tiro cargado: línea de 7 hacia el héroe Marcado (×1,5) | Tras el tiro, Expuesto −3 una ronda | Esbirro: un solo lobo vivo | **Sin pilares**; salta junto al más frágil y pone cepos |
| Rey Calcinado | Lluvia de pira: cruces sobre dos héroes; el suelo arde 2 rondas (×0,9) | Braseros | Esbirro: sabueso, solo en fase 1 | Braseros |
| Fundidora | Vertido del crisol: anillo a 1-2 casillas; deja fuego (×1,2) | **Después, Expuesta −4 una ronda**: hay que alejarse y volver | Esbirro: salamandra, solo en fase 1 | **Sin pilares** |
| Devorador de Runas | Fauces: 3×3 sobre el grupo; devora todo el escudo (×1,0) | Tras tragar, Vulnerable 1 ronda | Esbirro: larva que **ya no se divide**, solo en fase 1 | Obeliscos |
| Eco de los Caídos | Coro: estalla en la casilla de cada héroe; basta con moverse (×1,0) | Sus ecos: matarlos lo hiere un 4% | Manifestación: ecos que duran 2 turnos y lo curan un 4% cada uno mientras vivan | **Sin pilares**, ya no se regenera |

El daño del anuncio es el daño medio del golpe en área del jefe (su segundo hechizo) por el multiplicador de la tabla, más su daño plano (que ya escala con la zona, G3.0).

## 3. Invocaciones y esbirros (G3.2)

**Tres papeles**
- **Esbirro:** presión barata.
- **Guardián:** el Prior, sobre cadáveres.
- **Manifestación:** dura 2 turnos propios y luego se desvanece sola, sin dejar cadáver. Lleva el estado «Desvaneciéndose».

**Vida sobre el esbirro de zona** (que ya es el 60% de un enemigo normal, G3.0)

| Papel | Vida del esbirro de zona | Vida de un enemigo normal |
|---|---|---|
| Esbirro | ×0,6 | ≈36% |
| Larva | ×0,5 | ≈30% |
| Manifestación | ×0,6-0,8 | ≈36-48%, compensado porque dura poco |
| Guardián | ×0,85 | ≈51%, porque protege |

**Frecuencia**
- Cada jefe invoca en sus propias rondas (cada 3) y solo en las fases que indica su kit.
- Al cambiar de fase, la Plañidera, el Cazador, la Fundidora y el Eco ya no sueltan ⌈n/2⌉ de golpe.
- Se mantienen los topes de G3.0: ⌈n/2⌉ vivos a la vez y n+1 por combate. El Cazador, 1 vivo como máximo.

**Ventajas por matarlas**
- Espectro de la Plañidera: −1 PA al jefe.
- Eco: le hace al Eco el 4% de su vida y deja de curarlo.
- Todo lo que invoca el jefe muere con él.

**Nigromantes (acólitos)**
- Como mucho 2 alzados vivos cada uno.
- Los alzados son suyos y caen con él, así que matar al nigromante limpia el tablero.
- Los alzados ya no dan almas al Carcelero (no se pueden cultivar).

**Sin cambios:**
- las divisiones de los enemigos normales (`split`);
- las bombas;
- las invocaciones de los héroes.

## 4. Clases (G3.3)

| Clase | Cambio | Por qué |
|---|---|---|
| Arquero | **Distancia letal** (pasiva nueva): +1 de daño por casilla más allá de 3, hasta +3. No la tiene el Arquero óseo enemigo | Le da una mecánica propia: colocarse lejos es una decisión cada turno y encaja con Ojo de halcón y Disparo letal |
| Arquitecto | Lanza de energía: como mucho **2 veces por turno** (antes ilimitada) | Ya no basta con repetir la Lanza: el tercer gasto pasa a glifos o escudos, que son su identidad |
| Bárbaro | Sed de batalla cura **2 + 20 por cada 100 de Furia** (antes 2 + 12) | Gastar toda la Furia ahora compensa: es la decisión central de la clase (pegar más o sobrevivir) |
| Hechicera Zorro, Tejedora, Acechador, Carcelero, Pistolero | Sin cambios en el kit inicial | Ya tenían recurso propio con presencia real (esencia, esferas, Sombra, almas, cargador) y ninguna habilidad dominante. Sus mejoras están en G3.4 |

## 5. Habilidades desbloqueadas por jefes (G3.4)

Cambian 16 de las 56:

| Clase | Habilidad | PA | Enfriamiento | Cambio de diseño |
|---|---|---|---|---|
| Zorro | Espejismo ilusorio | 2 | 3 → **2** | Da 1 carga de esencia: el engaño alimenta su recurso |
| Tejedora | Singularidad | 4 | 3 → **2** | Crea 2 esferas: con espera 2 se enlaza con Descarga desatada |
| Acechador | Marca de la muerte | 4 → **3** | 3 → **2** | Era una preparación demasiado cara para un solo objetivo |
| Acechador | Velo de penumbra | 2 | 3 → **2** | Defensa más Sombra: refuerza el intercambio |
| Carcelero | Sacrificio del guardián | 2 | 3 → **1** | Es apoyo, así que debe usarse a menudo; da valor real en cooperativo |
| Bárbaro | Frenesí imparable | 3 → **2** | 4 → **2** | **Ahora cuesta 30 de Furia**: compite con Golpe colosal y Sed por el recurso, en lugar de esperar 4 turnos |
| Bárbaro | Mirada del verdugo | 2 | 3 → **2** | Marca de presa que genera Furia: debe estar más presente |
| Arquitecto | Campo de inercia | 3 | 3 → **2** | Control de zona útil contra jefes que se desplazan |
| Arquitecto | Matriz de distorsión | 4 → **3** | 3 | Dura 3 turnos: mantiene espera 3 para no tener dos a la vez |
| Arquitecto | Ciudadela de cristal | 5 → **4** | 4 → **3** | Sigue siendo la decisiva (25 de escudo, inmunidad, glifos), pero cabe en un turno con otra acción |
| Pistolero | Tiro certero a la cabeza | 4 | 2 | **+6 contra Marcados**: combo con Bala trazadora |
| Pistolero | Balas de plata imbuidas | 3 | 3 → **2** | Dura 2 turnos: la ventana de perforar se alterna con la recarga |
| Arquero | Disparo letal | 5 → **4** | 3 | Con 4 PA cabe con otra acción; encaja con Distancia letal |
| Arquero | Halcón | 3 | 4 → **2** | Solo uno a la vez: la espera solo importa si muere, y 4 era castigo |
| Arquero | Disparo conmocionante | 3 | 3 → **2** | Los jefes ya resisten la pérdida de PA; con espera 3 no compensaba |
| Arquero | Flecha ígnea | 3 | 1 | **+6 si el objetivo ya arde**: dos flechas seguidas avivan el fuego |

Nuevo campo de hechizo `bonusVs` (daño extra contra un estado). Es un dato del hechizo, no del guardado.

Ninguna habilidad de jefe de las 8 clases tiene ya enfriamiento mayor que 3. Las de espera 3 que quedan son decisivas a propósito:
- Ciudadela de cristal;
- Matriz de distorsión;
- Disparo letal.

**Conservadas tal cual** (las otras 40). Su espera ya es de 0 a 2, o pagan con recurso:
- **Zorro:** Fuego zorruno, Vórtice, Seducción, Estallido, Vínculo.
- **Tejedora:** Fuerza de voluntad, Gravedad, Órbita, Resonancia, Transfusión.
- **Arquitecto:** Glifo de gravedad, Baluarte, Pulsar, Cercado, Disparo arquitectónico, Sello, Sobrecarga.
- **Pistolero:** Abanico, Trazadora, Rodilla, Danza de balas, Mina, Humo, Gancho, Tambor.
- **Carcelero:** La caja, Explosión de almas, Cadenas vinculantes, Atracción, Siega.
- **Acechador:** Danza de cuchillas, Paso sombrío, Convergencia, Cosecha oscura.
- **Bárbaro:** Grito, Golpe colosal, Pacto, Cuchillada.
- **Arquero:** Abanico, Campo de cepos.

No cambia cómo se desbloquean, guardan o eligen: `buildBossOffer`, `h.boons` y `newSpellPool` siguen igual.

## 6. Archivos modificados

- **Nuevos:**
  - `src/core/combat/bosskits.ts`
  - `tests/g3_combate.test.ts` (22 tests)
  - este documento
- `src/core/combat/ai.ts`:
  - `bossTurn` por kit;
  - ataques anunciados (`omenCells`, `omenDamage`, colocación y estallido);
  - invocación por papel;
  - tope de alzados.
- `src/core/combat/engine.ts`:
  - estado «Desvaneciéndose»;
  - pilar derribado expone al jefe;
  - recompensas al matar invocaciones;
  - `bonusVs` y Distancia letal;
  - Sed de batalla;
  - esencia de Espejismo;
  - `strike` y `applyStatus` para la IA.
- `src/core/classes/spells.ts`: costes, enfriamientos y textos; campo `bonusVs`; Lanza 2 por turno.
- `src/core/classes/classes.ts`: pasiva del Arquero.
- `src/core/state.ts`: estado `fading` (solo amplía la lista de estados posibles, sin campos nuevos).
- `src/render/board.ts`: casillas rojas del ataque anunciado; nombre y color de «Desvaneciéndose».
- `src/ui/combat.ts`: aviso «⚠ Ataque anunciado».
- `tests/v9.test.ts`: valor esperado de Sed de batalla.

**No se toca:**
- `RunState` ni su versión;
- Supabase, RLS, RPC ni autenticación;
- economía, tienda, contratos, logros ni recompensas.

Los combates guardados antes de esta versión siguen cargando: un jefe sin fase marcada se inicializa en su primer turno, y las marcas y estados nuevos son opcionales.

## 7. Validación automática

- `npx vitest run`: **360 pasan, 1 omitido** (antes 338). Ningún test falla.
- **Nuevos tests:**
  - kits distintos;
  - ataque anunciado (marca, coste, a quién daña y a quién no);
  - sin anuncios seguidos;
  - Expuesta tras el vertido y suelo en llamas;
  - raíces, escudo devorado, PA del gemido;
  - pilar que expone;
  - líneas cortadas por obstáculos;
  - topes de invocación de los 8 jefes con 1 a 4 jugadores en 30 rondas;
  - vida por papel;
  - manifestaciones que se desvanecen;
  - recompensas por matar espectros y ecos;
  - curación del Eco por ecos vivos;
  - Prior sobre cadáveres;
  - tope de alzados y que caigan con el acólito;
  - Distancia letal;
  - Lanza 2 por turno;
  - tabla de PA y enfriamientos;
  - ciclo de enfriamiento 2;
  - Frenesí con Furia;
  - esencia de Espejismo;
  - bonus contra estados;
  - los 8 jefes jugados enteros por la IA en solitario y con 4, con resultado determinista.
- `npm run build`: correcto.
- **Prueba orientativa, no de equilibrio:** combates de jefe con bots sin equipo, antes y después.
  - Los 8 terminan siempre.
  - La Plañidera cae antes y con menos invocaciones.
  - El resto, parecido.
  - Los bots no esquivan los anuncios y van sin objetos, así que esto **no** mide la dificultad real.

## 8. Riesgos y pendientes

- **Daño de los anuncios:** los multiplicadores (0,9-1,5) son una primera estimación. Si alguno mata sin margen a una clase frágil, se baja ese `mul` en `bosskits.ts`.
- **Héroes de la IA:** los campeones del Salón y los aliados no esquivan los anuncios.
- **Gemido de la Plañidera en fase 2:** se suma a su Lamento, que ya quita PA. Hay que vigilar que no deje a los cuerpo a cuerpo sin turno.
- **Expuesta −4 de la Fundidora:** con clases de muchos golpes (Pistolero, Tejedora) puede derretirla rápido. Es intencionado, pero hay que verlo.
- **Distancia letal:** con Ojo de halcón y Disparo letal puede subir mucho el daño del Arquero a 6+ casillas.

## 9. Qué probar jugando antes de dar esto por bueno

1. Ascensión 0 en solitario y con 2-4 jugadores, al menos un jefe de cada zona. ¿Se entienden las casillas rojas sin explicación? ¿Da tiempo a salir?
2. Plañidera y Eco: ¿matar espectros y ecos se nota como ventaja? ¿Desaparecen sin confundir?
3. Prior, Madre, Rey y Devorador en fase 2: ¿derribar pilares para exponer al jefe es una decisión real?
4. Fundidora: ¿la ventana tras el vertido se aprovecha o es demasiado castigo para los cuerpo a cuerpo?
5. Cooperativo en línea: que los avisos, las casillas rojas y las manifestaciones se vean igual en el anfitrión y en el invitado, y tras reconectar.
6. Arquero (Distancia letal), Arquitecto (Lanza 2 por turno), Bárbaro (Sed y Frenesí con Furia): ¿se siguen jugando bien?
7. Ascensiones altas (A6, A9, A10 con pilares dobles): que los jefes con pilares no se vuelvan imposibles.

## Actualización posterior: habilidades de jefe sin enfriamiento

A petición del diseño, las **56 habilidades de jefe de las 8 clases jugables ya no tienen enfriamiento**. Mantienen su coste de PA y sus límites por turno (`perTurn`), y se pueden repetir mientras queden PA. Si alguna resulta excesiva, se le volverá a poner enfriamiento.

Los kits iniciales no cambian.

**Campo de inercia:** ahora se lanza a una casilla a 2-5 casillas, con línea de visión, y el campo de 3×3 se centra en ella. Antes era alrededor del Arquitecto.
