# Fase Q · Rediseño de los encuentros de jefe

Se trabaja sobre `main` (e4e1412). No se quita nada de G3.1–G3.4: los ataques anunciados, las ventanas de vulnerabilidad,
las invocaciones por papeles, los pilares de la fase 2 y las dos fases de cada jefe siguen igual. Esta fase añade
encima objetivos, presión, oleadas y más amenaza. El catálogo de runas, las clases, el equipo, las reliquias, la
metaprogresión y Supabase no se tocan.

## 1. Diagnóstico (código actual)

- **Kits** (`core/combat/bosskits.ts`): solo datos. Cada jefe tiene un ataque anunciado (y a veces uno de fase 2), una
  invocación con papel, sus pilares de fase 2 y rasgos. La IA (`ai.ts → bossTurn`) los interpreta.
- **Composición** (`game/run.ts → enemyList`): jefe + `bossEscorts(n) = max(1, n − 1)` escoltas sacadas al azar de
  `guard`. En solitario y con 2 jugadores, el jefe iba con **un solo** enemigo.
- **Escalado**: el jefe y los élites escalan su vida por jugadores (`scales`, +35 % por jugador). Encima van
  `zoneBoost` (zona, ascensiones 1 y 9, grupos pequeños) y los extras de `enemyOpts` (ascensión 6, retos, pactos,
  ramas). Las escoltas son comunes y no escalaban por jugadores.
- **Pilares**: unidades `ai: 'pillar'`. Tienen vida, se pueden golpear, no cuentan para ganar y su muerte deja al jefe
  Expuesto. **Esto ya era un sistema de objetivos destructibles**: se reutiliza para todos los objetivos nuevos.
- **Oleadas**: las salas creadas ya tenían `waves` (refuerzos por ronda) y `goal` (sobrevivir / objetivos marcados).
  Faltaban el aviso previo, las casillas de llegada válidas en el momento y el orden por iniciativa (las unidades
  nuevas jugaban al final de la ronda).
- **Runas**: Ejecución ya no mata jefes (+20 de daño en su lugar). Metralla rebota a cualquier enemigo vivo. Las
  invocaciones y los pilares no dejan cadáver aprovechable. *Cronostasis* y *Metamorfosis*, que citan las
  instrucciones, **no existen** en el catálogo actual (el documento de referencia está desactualizado).

## 2. Regla universal: mínimo 4 hostiles

- `bossEscorts(n) = max(3, n)`: 3, 3, 3 y 4 escoltas. Con el jefe, 4 o 5 hostiles. Los objetivos estructurales no
  cuentan como hostiles.
- La escolta ya no sale al azar: cada kit define `encounter.escorts` por papeles (protección, daño a distancia,
  apoyo, control o persecución) y un `extra` para 4 jugadores.
- `ESCORT_HP = [0.6, 0.75, 0.9, 1]`: la vida de la escolta y de las oleadas se ajusta por jugadores. El jefe sigue
  con su escalado de siempre.
- Las salas de jefe creadas a mano se completan con la escolta hasta llegar a 4 hostiles (`customFight`).
- Todas las casillas de aparición están libres y se puede llegar a ellas (lo comprueba `buildFight` y lo prueba
  `q_jefes.test.ts`).

| Jefe | Formato | Escolta (1-3 j.) | Extra (4 j.) |
|---|---|---|---|
| Prior Hueco | clásico | esqueleto (protege), arquero óseo (distancia), acólito (alza muertos) | necrófago |
| Plañidera | desgaste | ver oleadas | — |
| Madre Raíz | clásico | araña (persigue), chamán (escudos), ent (control) | tejedora |
| Cazador Silvano | clásico | lobo (manada), pantera (salto), tejedora (red) | lobo |
| Rey Calcinado | desgaste | ver oleadas | — |
| Fundidora | clásico | forjador (protege), tirador (cepos), piromante (apoyo) | gólem de escoria |
| Devorador de Runas | clásico | guardián rúnico (protege), heraldo (apoyo), ojo (distancia) | devorador |
| Eco de los Caídos | desgaste | ver oleadas | — |

## 3. Encuentro de desgaste (Plañidera, Rey, Eco)

Las oleadas van por **ronda** (estado del encuentro), no por bajas.

| Ronda | Qué pasa |
|---|---|
| 1 | Primera oleada: 4 enemigos de la zona. El jefe no está. |
| 2 | Aviso: «llegan 4 refuerzos la próxima ronda» y casillas de llegada marcadas (portal rojo). |
| 3 | Segunda oleada: 4 enemigos más. Los supervivientes siguen en el tablero. |
| 4 | Aviso: «¡{jefe} irrumpirá la próxima ronda con N acompañantes!». |
| 5 | El jefe + un subordinado especial (élite con nombre propio) + 2 enemigos. Evento `bossEnter`: texto propio, sonido y aviso en el tablero. |

Reglas (`engine.ts → spawnWave / announceWave / hastenWave / arrivalCells`):
- Las casillas se reservan al anunciar. Si alguien las ocupa, se buscan otras válidas: libres, accesibles, a 3 o más
  casillas de los héroes (si no, 2 y luego 1), mejor en la mitad enemiga y sin trampas ni fuego.
- Si no cabe alguien, espera en la entrada y llega en la ronda siguiente. No se pierde ninguna unidad.
- Si el grupo despeja la sala, la siguiente oleada se adelanta a la ronda siguiente (con aviso). No se puede impedir
  que llegue el jefe, y el combate no se gana mientras queden oleadas.
- Las oleadas entran al empezar la ronda y el orden de esa ronda se rehace por iniciativa (`interleave`). Nadie juega
  dos veces y el jefe juega en su sitio.
- `ATTRITION_UNIT = { hp: 0.7, power: 0.5 }`: los comunes de las oleadas tienen menos vida y daño que en un combate
  normal, porque son muchos. El jefe y el subordinado no llevan este ajuste.

| Jefe | 1.ª oleada | 2.ª oleada | Con el jefe | Subordinado |
|---|---|---|---|---|
| Plañidera | espectro ×2, esqueleto, murciélago | limo (charcos), sepulturero (cepos), calavera ×2 (explotan: castigan al grupo junto) | acólito, momia | Caballero del Lamento |
| Rey Calcinado | sabueso ×2, ceniciento, salamandra | piromante (área), tirador (cepos), gólem de escoria (charcos), salamandra | piromante, forjador | Verdugo de la Pira |
| Eco de los Caídos | errante ×2, larva, ojo | errante ×2 (cazan al frágil), ojo, heraldo | heraldo, devorador + almas caídas | Centinela del Coro |

## 4. Objetivos estructurales

Son unidades `ai: 'pillar'` con `Unit.objective = { mech, role, ward? }`. Se ven en el tablero (sprite propio), tienen
vida (escala +35 % por jugador y +25 % por zona) y reciben daño de todo, también de áreas y rebotes. La ficha explica
qué hacen. No cuentan para ganar.

- **Obligatorios** (`ward`): cada uno en pie quita al jefe un % del daño que recibe, con un tope de `WARD_CAP = 60 %`.
  Nunca es inmunidad. La ficha del jefe muestra «Protegido: −X %».
- **Opcionales**: no hace falta romperlos, pero hacerlo da ventaja: cortar un ataque, bajar la presión, quitarle
  escondites o recuperar energía.
- Al caer, dejan al jefe Expuesto (como los pilares de siempre; salvo los ecos y los fragmentos, que dan otras
  ventajas) y aplican su efecto (`encounter.ts → onObjectiveDown`).
- Los castigos de sus propias mecánicas no se reducen por la protección: escaldadura de válvula, desgarro de alma y
  retroceso de eco.

## 5. Mecánica final de cada jefe

**Prior Hueco / Coloso del Osario** (clásico)
- 3/3/4/4 **sellos funerarios** (obligatorios, −15 % cada uno). Romper uno: Expuesto y −2 de daño plano.
- Fase 2 (además de sus pilares de siempre): *Campana del Coloso* cada 2 rondas. Cada 2 rondas, *Derrumbe*: rompe los
  muros a 2 casillas o menos de él y agrieta 3 casillas junto al héroe más cercano (púas).

**La Plañidera / Desatada** (desgaste)
- Cada turno deja 1 **eco del lamento** (2 en la fase 2) a 2 casillas de un héroe. Tope: 4 ecos (6 en la fase 2).
  Duran 4 rondas.
- Cada eco vivo cuando estalla su lamento lo hace un **+25 %** más fuerte. El aviso dice cuánto. Al estallar, se traga
  los ecos.
- Fase 2: los ecos persiguen al héroe más cercano y gimen (daño) si lo alcanzan. Se mantienen el espectro que le
  quita PA y el *Gemido*.

**La Madre Raíz / Raíz Desatada** (clásico)
- 4 **raíces principales** (obligatorias, −15 % cada una). Cada una la cura un 2 % por turno. Romper una: Expuesta y
  −2 de daño.
- Fase 2: brotan 2 casillas de raíz venenosa junto a los héroes cada turno (tope 14). *Estrangulamiento* cada 2 rondas.

**El Cazador Silvano / Sin Rostro** (clásico)
- 2/2/3/3 **puestos de caza** (opcionales).
- Con 2 o más héroes, marca a quien se separa (sin aliados a 2 casillas): queda Marcado y su *Tiro cargado* lo busca.
- Cada 3 rondas, al acabar su turno, desaparece (invisible) y reaparece junto al puesto más alejado del grupo. Sin
  puestos, no puede esconderse.
- Fase 2: las casillas alrededor de los puestos son **territorio de caza**. Empezar el turno ahí deja Marcado y
  Ralentizado. *Tiro de gracia* cada 2 rondas.

**El Rey Calcinado / Avatar de la Pira** (desgaste)
- 2/2/3/3 **braseros de la Pira** (opcionales). Están desde la ronda 1, así que la presión crece antes de que llegue.
- Mientras quede alguno, la pira se aviva +1 por ronda (tope 8). Cada brasero prende el suelo junto a un héroe.
- El Rey gana daño plano igual a ¾ del avivado, y su lluvia de pira, +5 % por punto.
- Apagar un brasero: −2 de avivado, apaga el fuego de alrededor, Expuesto y −2 de daño.
- Fase 2: la arena arde cada vez más (2 casillas más cada ronda, con tope del 25 % del tablero). En los encuentros,
  empezar el turno en el fuego también quema.

**La Fundidora / al Rojo** (clásico)
- 2/2/3/3 **válvulas** (opcionales). La presión del crisol sube +1 por turno. Al llegar a 5 (4 en la fase 2) anuncia la
  **Colada masiva**: anillo de radio 3, ×1.4 y deja fuego.
- Abrir (romper) una válvula tiene dos usos:
  - defensivo: −3 de presión y corta la colada anunciada;
  - ofensivo: si ella está a 3 casillas o menos, el vapor le quita un 8 % de su vida y la deja Expuesta.
- Fase 2: la fundición se extiende (fuego de 3 rondas junto a ella y junto a un héroe).

**El Devorador de Runas / Hambre Sin Fondo** (clásico)
- 2/2/2/3 **fragmentos rúnicos** (opcionales). Cada 3 rondas emerge uno más (tope 3, o 4 con 4 jugadores).
- Cada turno se come el fragmento más cercano (a 6 casillas o menos): +1 de energía y se cura un 4 %. Con 3 queda
  **saciado**: +3 de daño y sus fauces pegan ×1.4.
- Romper un fragmento antes da al héroe que lo rompe (o al más cercano) **+25 % de daño durante 2 turnos**.
- Fase 2: cada fragmento que se come le da +2 PA. Cada 2 rondas reescribe el campo con grietas del vacío: quien
  empiece su turno en una (de cualquier bando) pierde 1 PA. Las runas de los héroes no se tocan.

**El Eco de los Caídos / Coro** (desgaste)
- 2/2/3/3 **almas caídas** (obligatorias, −10 % cada una) que llegan con él. Cada una lo cura un 3 % por turno y su
  coro pega +15 % por alma.
- Liberar un alma lo desgarra (4 % de su vida, sin reducción) y lo deja Expuesto.
- Fase 2: cada alma repite contra un héroe el último golpe que dio (35 %, con tope del 15 % de su vida).
- Se mantienen los ecos que lo curan y lo hieren al morir.

## 6. Daño y estadísticas

- **Ataques anunciados en un encuentro** (`omenHit`): base × potencia de las mecánicas ignoradas + 10 % de la vida
  máxima de quien se queda dentro. Topes:
  - 55 % de su vida máxima;
  - 75 % si se han ignorado mecánicas.

  Siempre se anuncian un turno antes y se pueden esquivar o cortar. Fuera de un encuentro (laboratorio de unidades,
  pruebas) el daño no cambia.
- **Multiplicadores de los anuncios**:

  | Anuncio | Antes | Ahora |
  |---|---|---|
  | Campana fúnebre | 1.2 | 1.35 |
  | Llanto desgarrador | 1.2 | 1.3 |
  | Gemido | 1.0 | 1.15 |
  | Raíces del subsuelo | 0.9 | 1.1 |
  | Tiro cargado | 1.5 | 1.6 |
  | Lluvia de pira | 0.9 | 1.05 |
  | Vertido del crisol | 1.2 | 1.3 |
  | Fauces del vacío | 1.0 | 1.15 |
  | Coro de los caídos | 1.0 | 1.1 |

- **Fase 2 más frecuente**: anuncios nuevos cada 2 rondas para el Prior, la Madre, el Cazador, el Rey, el Devorador y
  el Eco. La Plañidera ya lo tenía. La Fundidora lo consigue con la colada.
- **Hechizos exclusivos de jefe**: +1 a +3 de daño (por ejemplo, Maldición 6-8 → 7-10, Cataclismo 15-18 → 17-21,
  Devorar runas 17-21 → 19-24). Los hechizos que comparten con enemigos comunes no cambian.
- **No se duplica nada**: las ascensiones (vida del jefe en la 6, refuerzo en la 1 y la 9, pilares ×2 en la 10) y los
  retos pasan por el mismo `enemyOpts`. Los ajustes nuevos (`ESCORT_HP`, `ATTRITION_UNIT`, vida de los objetivos)
  multiplican aparte y solo en la sala de jefe.

## 7. Runas

- Ninguna familia queda anulada. No hay inmunidades nuevas.
- Metralla, fragmentación y perforación rebotan también en los objetivos (son enemigos válidos).
- Ejecución no mata al jefe (+20 de daño, como antes), pero sí remata objetivos estructurales bajos.
- Corona del Osario y los estallidos afectan a los objetivos cercanos. Los objetivos no dejan cadáver que alzar ni
  devorar.
- Cataclismo y las áreas sirven para romper varios objetivos a la vez.
- Los ecos rúnicos (Eco diferido, Tiempo roto, Coro de los Caídos) cuentan para la protección como cualquier golpe.
  Las almas del Coro repiten el último golpe directo, no los ecos.

## 8. Archivos

- `src/core/state.ts`: `Unit.objective`, `ObjectiveMech`, `EncounterState`, `EncounterWave`, evento `bossEnter`.
- `src/core/combat/encounter.ts` (nuevo): protección, objetivos, presión y mecánicas por jefe.
- `src/core/combat/bosskits.ts`: `encounter` de cada jefe, anuncios de fase 2, multiplicadores, `WARD_CAP`,
  `MIN_HOSTILES`.
- `src/core/combat/engine.ts`: protección en `hurt`, muerte de objetivos y oleadas con aviso, casillas e iniciativa.
- `src/core/combat/ai.ts`: turnos de objetivo, ganchos del jefe, colada, potencia de anuncios.
- `src/game/run.ts`: composición, objetivos, oleadas, `ESCORT_HP`, `ATTRITION_UNIT`, salas creadas.
- `src/content/zona1-4/enemies.ts`: 8 objetivos nuevos.
- `src/core/classes/spells.ts`: hechizos de jefe.
- `src/render/board.ts`, `src/render/sprites.ts`, `src/ui/combat.ts`, `src/audio/sfx.ts`: marcas de llegada,
  territorio de caza, grietas, ficha de protección y objetivos, entrada del jefe.
- `tests/q_jefes.test.ts` (nuevo). Ajustados: `tests/rebalance.test.ts` (la regla de escoltas cambia a propósito),
  `tests/g3_combate.test.ts` y `tests/helpers.ts` (`bringBoss` para el desgaste).

## 9. Pendiente

- **Equilibrio con jugadores reales.** El bot de pruebas no usa runas ni equipo real, y ataca primero a los pilares.
  Con él, los encuentros nuevos son mucho más duros, sobre todo en solitario y en las zonas 3 y 4. Hay que probarlos
  en partida. Los mandos están centralizados: `ESCORT_HP`, `ATTRITION_UNIT`, `OMEN_HP_PCT`, `OMEN_CAP`, `WARD_CAP`,
  `count` de cada objetivo y la presión de `encounter.ts`.
- **Raíces de la Madre**: se rompen golpeándolas. No hay una acción aparte de «cortar la conexión», ni se dibujan las
  líneas que las unen al jefe.
- **Arte**: los objetivos usan los sprites procedurales (pilar o fantasma, recoloreados). Faltan modelos propios para
  la vista isométrica.
- **Cronostasis y Metamorfosis** no existen en el catálogo actual: no se han podido revisar.
