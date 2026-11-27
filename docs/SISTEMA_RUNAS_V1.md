# Sistema de Runas Universal

Las runas son el corazón de la construcción de personajes de Ruinas del Abismo. No pertenecen a ninguna clase: las ocho clases (Hechicera Zorro, Tejedora de Esferas, Acechador de Sombras, Carcelero de Almas, Bárbaro Desatado, Arquitecto Rúnico, Pistolero Arcano y Arquero) pueden equipar cualquier runa de cualquier familia, y cada runa modifica todas las habilidades compatibles del héroe.

Las cuatro familias (Vida, Muerte, Tiempo y Materia) **no son elementos**. El elemento del daño (fuego, hielo, veneno, sombra y luz, con las resistencias de cada enemigo) es un sistema aparte que algunas runas pueden cambiar.

## Arquitectura

| Archivo | Qué contiene |
|---|---|
| `src/core/runeCatalog.ts` | Solo datos: runas, sinergias, familias, rarezas, equivalencias de reliquias. |
| `src/core/runes.ts` | Aplicación pura de runas y sinergias a una habilidad (`runeResult`, `applyRunes`), espacios y validaciones. |
| `src/core/statuses.ts` | Catálogo único de estados alterados: acumulación, topes, reglas de élites y jefes, textos. |
| `src/core/combat/runefx.ts` | Efectos de combate de las runas (rebotes, ecos, ejecución, detonación…). |
| `src/core/combat/engine.ts` | Integra estados y efectos en el lanzamiento y en el inicio de turno. |
| `src/game/runeLoot.ts` | Ofertas, tablas de rareza, garantías, gestión de espacios y migración de partidas. |
| `src/ui/runes.ts` | Piedras rúnicas, ofertas, pestaña de runas y Grimorio rúnico. |

Reglas técnicas:
- `runeResult` clona la definición (`structuredClone`) y nunca muta `SPELLS`: consultar una habilidad no aplica nada dos veces.
- Las operaciones son declarativas (`RuneOp`). Cada una decide si encaja con la habilidad por lo que hace (daña, cura, escuda, área…), nunca por la clase. Lo que no encaja se ignora y la interfaz lo explica («no afecta a esta habilidad»).
- Orden fijo: mutaciones → números → estados → duración de estados → efectos de combate.
- El mismo efecto de varias fuentes no se duplica: se queda el más fuerte.
- Los golpes secundarios (esquirlas, rebotes, perforación, ecos, estallidos) solo hacen daño y no vuelven a disparar runas: no hay bucles.
- Aceleración nunca deja una habilidad a 0 PA.
- Nuevas runas: basta con añadir una entrada a `RUNE_LIST` con operaciones existentes. Nuevos efectos: un `RuneTrigger` en `runefx.ts`.

## Espacios

- 4 espacios por personaje + 3 de reserva (para cambiar de configuración sin perder runas).
- Al empezar la expedición se elige la runa inicial entre 3 comunes de familias distintas (no dependen de la clase). Los otros 3 espacios empiezan vacíos.
- No se puede equipar dos veces una runa salvo las marcadas como acumulables.
- Las runas se gestionan fuera del combate (pestaña ✧ Runas): equipar, quitar a la reserva, intercambiar espacios, sustituir (con comparación de sinergias ganadas y perdidas) y soltar.

## Obtención

| Fuente | Cómo |
|---|---|
| Inicio | Oferta obligatoria de 3 comunes. |
| Combate normal | Probabilidad baja (8% + 3% por zona, máx. 20%) de una oferta de 2. |
| Élite y emboscada | **Garantizada**: 3 opciones de infrecuente a épica. |
| Jefe de zona | **Garantizada**: 3 opciones rara o mejor, con su runa exclusiva entre ellas si la tiene. |
| Jefe final | **Excepcional**: Juicio del Segador y legendarias. |
| Cofre | 40% + 15% por zona, oferta de 2. |
| Santuario | La mitad de los santuarios añaden una oferta de calidad alta. |
| Tienda | 2 runas por visita, con oro. |
| Eventos | Los que daban reliquias dan ahora runas; «La Forja de Runas Rotas» (reforjar, fundir, esquirlas) y «El Altar de las Cuatro Familias» (sangre por runas raras, trueque). |

Las garantías están en `finishFight` → `guaranteedOffer`: si el catálogo se agotara, la oferta baja de rareza o da una acumulable, pero nunca queda vacía. Las runas usan un azar propio (`run.runeRng`): añadirlas no cambia mapas, botín ni combates.

## Persistencia

- **Expedición**: `HeroSave.runes`, `runeBag` y `runeOffers`. Se pierden al acabar la expedición: cada una empieza con una runa nueva.
- **Grimorio rúnico (permanente)**: `Meta.archive.runes` (descubierta / utilizada en combate) y `Meta.archive.synergies` (activada). Se fusionan entre dispositivos como el resto del Archivo.
- **Partidas antiguas**: al cargar, sin campo de runas reciben Fractura (como en el núcleo V1). Las reliquias con runa equivalente pasan a runas (equipadas o a la reserva); el resto se devuelve a 25 de oro cada una. La migración es idempotente.

## Reliquias (retiradas)

Ya no se generan ni se venden. Equivalencias: Corazón de piedra, Caparazón, Pluma, Reloj (→ Reloj de arena), Trébol (→ Filo negro), Cristal (→ Dilatación), Ascua (→ Ignición), Víbora (→ Espora), Hacha (→ Filo del verdugo), Cáliz (→ Brote), Erizo, Raíz viva, Muralla y Máscara de furia. Sin equivalente (se reembolsan): Colmillo, Medalla de fe, Sangre de dragón, Ojo del tuerto, Botas de viento, Bolsa sin fondo, Lupa y Dado. Los registros del Archivo de reliquias se conservan; el hito de colección, el desafío `col_relics` y los contratos de «reliquia» cuentan ahora runas. Las reliquias de grupo tras los jefes (eventos `reliquia_N`) siguen siendo eventos de votación.

## Élites y jefes ante los estados

Nunca son inmunes a todo: el Aturdimiento les quita 2 PA, la Congelación 1 PA y 2 PM y la Inmovilización de jefe 2 PM. Los daños progresivos, la Condena y la Resonancia les afectan entero. La Ejecución no remata jefes: les hace daño fijo.

## CATÁLOGO DE RUNAS

### Vida

| Runa (id) | Rareza | Tipo | Efecto |
|---|---|---|---|
| Brote (`brote`) | Común | Estadística · acumulable | Curaciones y escudos +30%. |
| Corazón de piedra (`corazon_piedra`) | Común | Estadística · acumulable | +20 de vida máxima. |
| Espora (`espora`) | Común | Estados | Tus golpes aplican Veneno (2 cargas, 3 turnos). |
| Savia (`savia`) | Común | Estadística · acumulable | Tus habilidades de daño roban el 12% del daño. |
| Retoño (`retono`) | Infrecuente | Estados | Tus curas y escudos dan Regeneración (2 cargas, 3 turnos). |
| Contagio (`contagio`) | Infrecuente | Estados | Al rematar, los estados negativos del objetivo saltan a los enemigos pegados. |
| Purga (`purga`) | Infrecuente | Estados | Curas y escudos eliminan 1 estado negativo y dan Barrera rúnica (1 carga). |
| Sangre verde (`sangre_verde`) | Infrecuente | Elemental | Tu daño pasa a ser de veneno y hace +5 contra envenenados. |
| Floración (`floracion`) | Rara | Comportamiento | Tus curaciones dañan a los enemigos pegados al aliado curado (100% de lo curado). |
| Simbionte (`simbionte`) | Rara | Sinergia | Golpear a un objetivo con daño progresivo te cura el 35% del daño. Tus golpes aplican Corrupción (1 carga, 3 turnos). |
| Raíz viva (`raiz_viva`) | Rara | Estadística | Recuperas el 8% de tu vida al empezar cada turno. |
| Mutágeno (`mutageno`) | Épica | Mutación | MUTACIÓN: tus golpes a un solo objetivo se convierten en área cuadrada (radio 1) con Veneno (3 cargas). +1 PA. |
| Transfusión negra (`transfusion`) | Épica | Mutación | MUTACIÓN: tus habilidades de daño roban el 50% del daño y pasan a ser de veneno. La curación sobrante se vuelve escudo. |
| Corazón de la Madre Raíz (`corazon_raiz`) · jefe: madre | Legendaria | Sinergia | Toda curación sobrante se vuelve escudo; curas y escudos dan Regeneración (3 cargas, 4 turnos) y +60% de potencia; tus golpes dan Regeneración a ti (1 carga). |

### Muerte

| Runa (id) | Rareza | Tipo | Efecto |
|---|---|---|---|
| Hemorragia (`hemorragia`) | Común | Estados | Tus golpes aplican Sangrado (2 cargas, 3 turnos). El Sangrado se acumula hasta 10. |
| Filo negro (`filo_negro`) | Común | Estadística · acumulable | +12% de crítico en tus habilidades de daño. |
| Cosecha (`cosecha`) | Común | Estadística | Roba el 20% del daño y +4 de daño contra objetivos que sangran. |
| Condena (`condena`) | Infrecuente | Estados | Tus golpes aplican Condena (2 turnos): guarda el 50% de todo el daño que recibe y lo recibe de golpe al acabarse. |
| Sacrificio (`sacrificio`) | Infrecuente | Estadística | Tus habilidades de daño cuestan el 6% de tu vida actual y hacen +45% de daño. |
| Sombra hueca (`sombra_hueca`) | Infrecuente | Elemental | Tu daño pasa a ser de sombra e ignora 3 de armadura. |
| Máscara de furia (`mascara_furia`) | Infrecuente | Estadística | +4 de daño mientras estés por debajo de la mitad de vida. |
| Ejecución (`ejecucion`) | Rara | Comportamiento | Si tu golpe deja a un objetivo con un estado negativo por debajo del 20% de su vida (élites 12%), muere. Los jefes reciben +20 de daño en su lugar. |
| Filo del verdugo (`filo_verdugo`) | Rara | Estadística | Tus críticos hacen el doble de daño extra. +8% de crítico. |
| Detonación (`detonacion`) | Épica | Comportamiento | Tus golpes consumen el Sangrado, el Veneno y la Quemadura del objetivo y los infligen de golpe ×2. |
| Lamento de la Plañidera (`lamento`) · jefe: planidera | Épica | Estados | Tus golpes aplican Debilitado (2 turnos) y Condena (2 turnos), y hacen +6 contra debilitados. |
| Corona del Osario (`corona_osario`) · jefe: prior | Legendaria | Comportamiento | Al rematar, el cadáver estalla (35% de su vida máxima a los enemigos a 2 casillas) y contagia sus estados negativos. |
| Juicio del Segador (`segador`) · jefe final | Legendaria | Mutación | Tus golpes aplican Condena y Corrupción; rematar reinicia la habilidad (vuelve a estar disponible y gratis); la ejecución alcanza al 30%. |

### Tiempo

| Runa (id) | Rareza | Tipo | Efecto |
|---|---|---|---|
| Aceleración (`aceleracion`) | Común | Estadística | Tus habilidades de daño cuestan 1 PA menos (mínimo 1). |
| Dilatación (`dilatacion`) | Común | Estados · acumulable | Los estados que aplican tus habilidades duran 1 turno más. |
| Pluma del reloj (`pluma`) | Común | Estadística | +1 PM y +6 de iniciativa. |
| Presteza (`presteza`) | Común | Comportamiento · acumulable | Tus habilidades a distancia ganan +1 de alcance máximo. |
| Repetición (`repeticion`) | Infrecuente | Comportamiento | Las habilidades limitadas por turno ganan 1 uso más; las que tienen enfriamiento, −1 turno. |
| Escarcha (`escarcha`) | Infrecuente | Estados | Tus golpes aplican Escarcha (1 carga, 3 turnos). Con 3 cargas, el objetivo queda Congelado. |
| Impulso temporal (`impulso`) | Infrecuente | Comportamiento | Al rematar con una habilidad, ganas +1 PA (una vez por turno). |
| Anticipación (`anticipacion`) | Infrecuente | Estados | Tus golpes aplican Debilitado (2 turnos): hace un 25% menos de daño. |
| Eco diferido (`eco_diferido`) | Rara | Comportamiento | Al empezar tu siguiente turno, la habilidad vuelve a golpear la misma casilla y su área al 50%. |
| Reloj de arena (`reloj_arena`) | Rara | Estadística | +1 PA. |
| Bucle (`bucle`) | Épica | Mutación | MUTACIÓN: tus habilidades de daño no tienen enfriamiento y ganan un uso más por turno, al 80% del daño. |
| Tiempo roto (`tiempo_roto`) · jefe: rey | Legendaria | Comportamiento | Cada habilidad de daño se repite entera al empezar tu siguiente turno (100%) y los estados que aplicas duran 2 turnos más. |
| Coro de los Caídos (`coro_caidos`) · jefe: eco | Legendaria | Sinergia | Tus habilidades de daño se repiten al 60% al empezar tu siguiente turno y aplican 2 cargas de Resonancia rúnica. |

### Materia

| Runa (id) | Rareza | Tipo | Efecto |
|---|---|---|---|
| Fractura (`fractura`) | Común | Estados | Ignora 2 de armadura y aplica Expuesto (1 carga, 2 turnos). |
| Caparazón (`caparazon`) | Común | Estadística | +2 de armadura. |
| Bastión (`bastion`) | Común | Estadística | Escudos +50%. Tus habilidades sin daño te dan 4 de escudo. |
| Fragmentación (`fragmentacion`) | Común | Comportamiento | Tus golpes a un objetivo salpican a 1 enemigo a 2 casillas al 40% del daño. |
| Perforación (`perforacion`) | Infrecuente | Comportamiento | Ignora 4 de armadura y el golpe atraviesa al enemigo de detrás (70%). |
| Ignición (`ignicion`) | Infrecuente | Elemental | Tu daño pasa a ser de fuego y aplica Quemadura (1 carga, 2 turnos). La Quemadura crece al acumularse. |
| Espejo de obsidiana (`espejo`) | Infrecuente | Comportamiento | Tus escudos también dan Baluarte prismático (2 turnos): devuelve el 15% del daño recibido. |
| Piel de erizo (`erizo`) | Infrecuente | Estadística | Devuelves el 30% del daño cuerpo a cuerpo. +1 de armadura. |
| Metralla (`metralla`) | Rara | Comportamiento | Tus golpes a un objetivo rebotan a 2 enemigos más (a 3 casillas) al 60%. |
| Piedra de muralla (`muralla`) | Rara | Estadística | Empiezas cada turno con un escudo del 15% de tu vida. |
| Suelo de brasas (`brasas`) | Rara | Comportamiento | Tus habilidades de daño dejan llamas en el suelo (2 rondas) en el objetivo y su área: quien las pisa se quema. |
| Supernova (`supernova`) | Épica | Mutación | MUTACIÓN: tus golpes a un solo objetivo se convierten en área cuadrada (radio 1) a daño completo. +1 PA. |
| Lanza del Titán (`lanza_titan`) | Épica | Mutación | MUTACIÓN: tus golpes cuerpo a cuerpo se convierten en lanzas en línea recta (2-5 casillas) que atraviesan a todos. Tus habilidades de daño te dan escudo (30% del daño máximo). |
| Cepo del Cazador (`cepo_cazador`) · jefe: cazador | Épica | Comportamiento | Tus golpes inmovilizan (1 turno), atraviesan al enemigo de detrás (70%) y hacen +8 contra inmovilizados. |
| Crisol de la Fundidora (`crisol`) · jefe: fundidora | Épica | Elemental | Tu daño pasa a ser de fuego, aplica Quemadura (2 cargas), deja llamas en el suelo (2 rondas) y hace +6 contra quemados. |
| Cataclismo (`cataclismo`) · jefe: devorarunas | Legendaria | Mutación | MUTACIÓN: tus habilidades de área ganan +2 de radio y todo el área recibe el daño completo (+2 PA). Tus golpes aplican Resonancia rúnica. |

## SINERGIAS

| Familias | Nombre | Efecto |
|---|---|---|
| Vida + Muerte | Ciclo de la carne | Golpear a un objetivo con daño progresivo te cura el 25% del daño, y rematar contagia sus estados a los vecinos. |
| Vida + Tiempo | Savia eterna | Curas y escudos dan Regeneración (1 carga, 3 turnos); los estados que aplicas duran 1 turno más. |
| Vida + Materia | Raíces de hueso | Tus golpes inmovilizan (1 turno) y cada enemigo alcanzado te da 3 de escudo. |
| Muerte + Tiempo | Sentencia diferida | Tus golpes aplican Condena (2 turnos) y +20% de daño. |
| Muerte + Materia | Metralla de huesos | Al rematar, el objetivo estalla: 20% de su vida máxima a los enemigos pegados. |
| Materia + Tiempo | Proyectil fractal | Tus golpes a un objetivo rebotan 1 vez (50%) y se repiten al 30% al empezar tu siguiente turno. |
| Vida + Muerte + Tiempo | Rueda de la reencarnación | Rematar reinicia la habilidad (vuelve a estar disponible y gratis este turno). |
| Vida + Muerte + Materia | Colmena | Tus golpes aplican Resonancia rúnica (1 carga) y Veneno (1 carga). |
| Vida + Tiempo + Materia | Jardín del reloj | Curas y escudos eliminan 1 estado negativo; tus escudos devuelven daño (2 turnos). |
| Muerte + Tiempo + Materia | Fin de las eras | Tus golpes aplican 2 cargas de Resonancia rúnica y +15% de daño. |
| Vida + Muerte + Tiempo + Materia | Abismo primordial | Las cuatro familias a la vez: +30% de daño, curas y escudos, y tus golpes aplican Resonancia rúnica. |

## ESTADOS

| Estado (id) | Tipo | Acumulación | Regla | Élites y jefes |
|---|---|---|---|---|
| 🔥 Quemadura (`burn`) | dot | suma (máx. 5) | 3 de daño de fuego al empezar el turno, +2 por carga extra (máx. 5). Quemar a un objetivo con Escarcha o Congelado provoca Choque térmico. | Igual |
| ☠️ Veneno (`poison`) | dot | suma (máx. 10) | 2 de daño de veneno por carga al empezar el turno (máx. 10). Con Corrupción, un 50% más. | Igual |
| 🩸 Sangrado (`bleed`) | dot | suma (máx. 10) | 3 de daño por carga al empezar el turno, ignora la armadura (máx. 10). | Igual |
| 💫 Aturdido (`stun`) | control | no crece | Pierde su turno. | Élites y jefes no pierden el turno: pierden 2 PA en el siguiente. |
| 🐌 Ralentizado (`slow`) | control | no crece | Pierde 1 PM por carga. | Igual |
| 🌿 Inmovilizado (`rooted`) | control | no crece | No puede moverse en su turno. | Jefes: pierden 2 PM en vez de quedarse quietos. |
| ❄️ Escarcha (`chill`) | control | suma (máx. 3) | Se acumula; con 3 cargas, el objetivo queda Congelado. | Igual |
| 🧊 Congelado (`frozen`) | control | no crece | Pierde su turno. El fuego lo descongela con Choque térmico. | Élites y jefes no pierden el turno: pierden 1 PA y 2 PM. |
| 💗 Encantado (`charm`) | control | no crece | Recibe más daño de quien lo encantó. | Igual |
| ⛓️ Atrapado (`hobble`) | control | no crece | Huye peor del placaje. | Igual |
| 🔗 Encadenado (`chained`) | manip | no crece | Vínculo: comparte la mitad del daño con el otro encadenado. | Igual |
| ⚓ Sello de anclaje (`anchor`) | control | no crece | Sellado por un glifo: no puede huir del sello. | Igual |
| 🛡️ Expuesto (`exposed`) | debuff | no crece | Fractura de armadura: −1 de armadura por carga. | Igual |
| 🎯 Vulnerable (`vuln`) | debuff | no crece | Recibe más daño. | Igual |
| ✖️ Marcado (`mark`) | debuff | no crece | Recibe daño extra de cada golpe. | Igual |
| 🥀 Debilitado (`weak`) | debuff | no crece | Hace un 25% menos de daño. | Igual |
| 🕳️ Corrupción (`corrupt`) | debuff | suma (máx. 5) | Recibe un 50% menos de curación y su Veneno hace un 50% más. Al morir, contagia Corrupción y Veneno a sus vecinos. | Igual |
| 💀 Marca de la muerte (`deathmark`) | mark | no crece | Guarda parte del daño del Acechador y estalla al final de su turno. | Igual |
| ⌛ Condena (`doom`) | mark | no crece | Guarda el 50% de todo el daño que recibe; cuando se acaba, lo recibe de golpe. | Igual |
| 🔆 Resonancia rúnica (`resonance`) | mark | suma (máx. 5) | Con 5 cargas estalla: 4 de daño por carga a él y la mitad a sus vecinos. | Igual |
| 🎯 Presa (`verdugo`) | mark | no crece | El Bárbaro va a por ella. | Igual |
| 💪 Potenciado (`empower`) | buff | no crece | Hace más daño. | Igual |
| 🏹 Alcance+ (`reach`) | buff | no crece | Más alcance. | Igual |
| 👻 Invisible (`invis`) | buff | no crece | No se le puede apuntar. | Igual |
| 🛡️ Protegido (`guarded`) | buff | no crece | Otro recibe parte de su daño. | Igual |
| 😡 Frenesí (`frenzy`) | buff | no crece | Inmune a aturdir. | Igual |
| 🌀 Órbita (`orbita`) | buff | no crece | El primer golpe cuerpo a cuerpo sale despedido. | Igual |
| 🔘 Balas de plata (`silver`) | buff | no crece | Sus disparos ignoran la armadura. | Igual |
| 🌫️ En el humo (`smoke`) | buff | no crece | Esquiva los ataques a distancia. | Igual |
| ✨ Inmune (`immune`) | buff | no crece | No recibe estados negativos. | Igual |
| 🧲 Barrera cinética (`kinetic`) | buff | no crece | Repele al primer agresor cuerpo a cuerpo. | Igual |
| 💠 Baluarte prismático (`prism`) | buff | no crece | Devuelve el 15% del daño recibido. | Igual |
| 🌱 Regeneración (`regen`) | buff | suma (máx. 5) | Recupera 3 de vida por carga al empezar el turno (máx. 5). | Igual |
| ⚡ Acelerado (`haste`) | buff | no crece | Empieza su turno con +1 PA y +1 PM por carga. | Igual |
| 🔰 Barrera rúnica (`ward`) | buff | suma (máx. 3) | Cada carga bloquea el siguiente estado negativo que le llegue. | Igual |
| ⏳ Desvaneciéndose (`fading`) | mark | no crece | Desaparece al acabarse. | Igual |

## TABLAS DE RAREZA

| Fuente | Común | Infrecuente | Rara | Épica | Legendaria | Opciones |
|---|---|---|---|---|---|---|
| start | 100% | 0% | 0% | 0% | 0% | 3 |
| combat | 70% | 28% | 2% | 0% | 0% | 2 |
| chest | 45% | 40% | 13% | 2% | 0% | 2 |
| event | 30% | 42% | 22% | 6% | 0% | 3 |
| shop | 40% | 38% | 18% | 4% | 0% | 1 |
| shrine | 10% | 45% | 35% | 10% | 0% | 3 |
| elite | 0% | 58% | 34% | 8% | 0% | 3 |
| boss | 0% | 0% | 55% | 40% | 5% | 3 |
| final | 0% | 0% | 0% | 0% | 100% | 3 |

Precio en tienda (oro): Común 60 · Infrecuente 95 · Rara 150 · Épica 230 · Legendaria 400.
