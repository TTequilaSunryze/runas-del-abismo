# Runas del Abismo — Documento de diseño (v2)

RPG táctico por turnos, roguelike y cooperativo online (1–4 jugadores), pixel art 2D. Jugable en navegador (GitHub Pages) con Supabase para guardado, sala en tiempo real y ranking.

## Bucle de juego
3 zonas × 7 salas ramificadas (combate, élite, evento de grupo, descanso, tienda, tesoro, jefe). Al final de cada zona, un jefe. Nivel máximo 12. Si todos caen, la partida termina y se cobra progresión permanente.

## Combate
Turnos por iniciativa, PA/PM, línea de visión, estados (quemadura, veneno, ralentización, aturdimiento, marca), trampas, charcos pegajosos, resistencias elementales. Anfitrión autoritativo: ejecuta el motor y reparte el estado.

## Enemigos
- Rasgos: manada (más daño con compañeros), guardia (escudo cada turno), devorador (se cura con cadáveres), nigromante (alza muertos), espectro (atraviesa obstáculos), cazador (persigue al frágil), charco (inmoviliza al morir), apoyo (cura/escuda aliados).
- Élites con modificadores: Ardiente, Vampírico, Blindado, Veloz, Enorme, Venenoso.
- Jefes con pilares (huesos, raíces, braseros) que lo curan 5 %/turno y segunda fase.
- Escalado por número de jugadores y profundidad.

## Clases y build
Guerrero, Mago, Clérigo, Pícaro. 4 rutas por clase (3 hechizos cada una); se eligen hasta 2 y cada ruta bloquea a su opuesta. 8 ranuras de equipo, 4 rarezas, mochila de 8. 12 runas base + 4 desbloqueables que modifican hechizos.

## Progresión entre partidas (rejugabilidad)
- **Ecos**: se ganan por salas, jefes y victoria (+20 % por nivel de ascensión, +30 % en el reto diario).
- **Mejoras permanentes** (6): vida, oro inicial, runas iniciales, opciones de botín, re-tiradas, curación.
- **Logros** (17): dan ecos y desbloquean runas (Bendición, Aturdidora, Sangrienta, Silencio) y maestrías por clase.
- **Ascensión 0–10**: se desbloquea al ganar; cada nivel añade dificultad (más vida/daño, élites con 2 afijos, tienda cara, más enemigos, jefes con más pilares…).
- **Reto diario**: misma semilla y 2 modificadores para todos, ascensión 3, ranking en Supabase.
- Datos permanentes en el navegador de cada jugador (localStorage `rda_meta`).

## Presentación
Tutorial de 5 pasos la primera vez, textos de zona y clase, pantalla final con resumen y recompensas, "Jugar otra partida" para toda la sala, música distinta por zona y jefe, diseño adaptado a móvil.

## v3: cuenta, maestría, sets, arquero, Salón y duelos
- **Cuenta opcional** (email y contraseña, Supabase Auth). El progreso se guarda en la tabla `profiles` (solo cada uno ve su fila). Al entrar la primera vez en un navegador se une con el progreso local.
- **Maestría por clase (0–5)**: experiencia por salas, jefes, victoria y ascensión. Empiezas con 2 rutas no opuestas (1.ª y 3.ª); maestría 1 abre la 2.ª, maestría 2 la 4.ª; 3 da una mejora de hechizo inicial, 4 da 4 opciones al elegir mejoras, 5 da dos mejoras iniciales. Quien ya había jugado recibe maestría inicial.
- **Mejoras de hechizo**: a nivel 4, 6, 8, 10 y 12 eliges 1 de 3 (Potenciado, Eficiente, Presto, Lejano, Amplio, Persistente, Certero).
- **Sets de 3 piezas** (6): Víbora (veneno), Pira (fuego), Bastión (escudo cada turno), Verdugo (críticos x2), Peregrino (PA/PM), Santuario (curas +30%). Bonus a 2 y a 3 piezas. Tesoros y tiendas garantizan una pieza; el botín favorece el set empezado.
- **Arquero**: Francotirador / Ráfaga, Trampero / Señor de bestias (cepos ocultos al rival, flecha perforante en línea, salto atrás, lobo invocado). No dispara a enemigos adyacentes.
- **Reliquias de grupo**: tras cada jefe el grupo vota 1 de 3 pasivas.
- **Salón de héroes** (12): guarda un héroe al acabar. Tu mejor héroe puede aparecer como **Némesis** (élite) en las partidas de tus amigos desde la zona 2.
- **Duelos 3 contra 3**: contra el equipo de un amigo llevado por la IA (por nombre de cuenta), entrenamiento contra tu reflejo, o en vivo en una sala. Nivel igualado a 12, vida x1,6, terreno en espejo.

## v4: legibilidad y contenido
- **Iconos de hechizo en pixel art**: uno por hechizo (52 dibujos, paleta por elemento), borde del color de su tipo (daño, curación, escudo, control, apoyo, invocación) y coste en PA. Ayuda flotante con un resumen generado desde los datos. Daño estimado al apuntar a un enemigo (y aviso si lo mata).
- **Enemigos**: de 25 a 56 (incluye aliados). Rasgos nuevos: explota al morir, se divide, se regenera, espinas, furia, pone cepos, salto sombrío. 13 afijos de élite.
- **Jefes y élites alternativos**: 2 jefes y 2 élites por zona; cada partida usa uno.
- **Zona 4 – El Abismo**: se desbloquea al ganar una vez; el anfitrión la incluye. Enemigos, 2 jefes, objetos, 6 eventos y música propios. Reliquia de grupo al entrar.
- **Salas nuevas**: Forja (mejora una pieza), Altar (sangre u oro por runa rara, mejora de hechizo o vida), Apostador (oro por reliquias), Jaula (un aliado lucha con vosotros hasta el final de la zona). El mapa varía mucho más entre partidas.
- **Reliquias personales** (22): estadísticas o rasgos (quemar, veneno extra, críticos x2, regenerar, espinas…). Salen de jefes, élites, tesoros, tienda y apuestas.
- **Presagios** (8): reglas especiales en algunos combates (Luna de sangre, Ciénaga, Eclipse, Botín maldito…).
- **Eventos**: de 13 a 27, con consecuencias a largo plazo (préstamo que cobra en la zona siguiente, promesa que premia un jefe sin bajas, espíritu que ayuda en el jefe, cofre maldito que endurece el próximo élite, aliados).
- **Modificadores elegibles**: hasta 3 de 11, +15% de ecos cada uno.
- **Curva de dificultad**: los enemigos suben un 15% de vida y daño por zona (y un 30% más en el Abismo).

## v5: combate táctico, progresión dentro de la partida y cooperación
- **Élites y jefes**: inmunes a aturdir. Cada PM/PA que se les intenta quitar (y cada casilla de empuje) se tira dos veces (70% cada una) y solo entra si salen las dos (~49%).
- **Placaje y huida**: al salir de una casilla pegada a enemigos se conserva solo una parte de los PM: (huida + 2) / (2 × (placaje total + 2)). Clases: guerrero placa mucho, pícaro y arquero huyen bien. Espectros e invisibles lo ignoran. Objetos con Placaje/Huida.
- **Kit inicial**: 3 habilidades desde el nivel 1 (2 de daño + 1 de potenciación): Guerrero *Sed de sangre* (15% de vida → +35% daño), Mago *Escudo arcano*, Clérigo *Fervor*, Arquero *Ojo de halcón* (+2 alcance) y *Tiro rasante* (sí alcanza a pegados), Pícaro *Desvanecerse* (invisible).
- **Bendiciones de clase (estilo Hades)**: cada clase tiene 4 estilos (p. ej. Guerrero: Acero, Sangre, Muralla, Caudillo) con 3 opciones cada uno: mejoras de sus hechizos de clase (Chispa voraz, Tajo vampírico, Flecha de acero…) o hechizos nuevos de la clase (Meteoro, Carga, Degollar, Halcón…). El Santuario y los élites ofrecen 3 de un estilo, a menudo el que ya llevas; 2 y 3 del mismo estilo dan bonus. Hasta 6 bendiciones.
- **Consumibles**: poción de curación, poción de resurrección, bomba de fuego, bomba de humo (máx. 3 de cada). Salen tras los combates (siempre tras élite y jefe) y en la tienda.
- **Botín por profundidad**: más probabilidad de raro, épico y legendario cuanto más avanzada la partida (con techo).
- **Vida al equipar**: la vida máxima que da un objeto se suma también a la actual.
- **Jaula**: ahora es un combate; al ganarlo, el prisionero se une al grupo.
- **Forja**: cuesta oro, mejora equipo o mochila (+20% por nivel, hasta +5) con vista previa en verde.
- **Listo**: el anfitrión no puede cambiar de sala hasta que todos los conectados hayan elegido botín, mejoras y bendiciones y pulsado «Listo».
- **Ficha del personaje** (botón 📊 o tecla S): estadísticas base + equipo, sets, reliquias, bendiciones y eventos.
- **Estadísticas en vivo de los enemigos**: −PM en azul y −PA en amarillo al aplicarse; la ayuda muestra PA/PM de su próximo turno, armadura, placaje y huida.
- **Online**: la presencia en Supabase se publica como mucho cada 4 s y solo con datos mínimos (antes se superaba el límite y el servidor desconectaba al jugador); aviso en pantalla y reconexión si el canal se cae.
- **Amigos e invitaciones** (con cuenta): lista de amigos por nombre de cuenta, ver quién está en línea y en qué sala, invitar desde la sala con un clic.
- **Música**: 11 pistas propias (menú, sala, mapa de cada zona, combate, jefe, descanso, elecciones, final) con fundido.

## Pendiente / ideas
Sincronizar ecos en la nube con cuenta, más zonas y clases, sprites animados, balance con datos de partidas reales.

## v6: kits iniciales y recompensas por sala
- **Sin rutas ni niveles**: cada clase empieza con un kit de 3 habilidades. El Clásico siempre; con maestría 1-4 se desbloquean 4 kits más (los antiguos estilos: p. ej. Guerrero Baluarte, Berserker, Caudillo, Duelista). Maestría 5: empiezas con una bendición.
- **Recompensa por sala (estilo Hades)**: tras cada combate normal, alternando, una bendición de clase o una mejora de hechizo; tras un élite, una bendición; tras un jefe, una mejora de hechizo. Los hechizos nuevos solo llegan si se eligen.
- **Curva**: los enemigos empiezan un 35% más débiles en la zona 1 y suben un 55% por zona (+40% más en el Abismo).
- **Volumen de la música** con barra (arriba a la derecha) y arreglado silenciar/activar.
- **Ojo de halcón**: el alcance extra se ve y se puede usar en el mismo turno.
- **Listo**: el anfitrión ve a quién espera y por qué, y puede seguir sin esperar si a nadie le queda nada por elegir.

## v7 · Clases nuevas

Tres clases con mecánica propia (nombres y diseños originales). Cada una tiene un kit inicial de 3 habilidades y 2 estilos de bendición.

- **Hechicera Zorro** (44 PV, 7 PA, 5 PM, huida 11). Orbe del engaño (en línea, golpea al ir y al volver), Encanto (el enemigo no ataca y se acerca en línea recta gastando sus PM) e Impulso espiritual (salto de 3 en línea recta que ignora el placaje y dispara al enemigo más cercano). *Robo de esencia*: cada habilidad que acierta da 1 carga; con 3, la siguiente de daño cura el 15%.
- **Tejedora de Esferas** (id interno `esferas`, porque `tejedora` ya era un enemigo; 40 PV, 8 PA, 4 PM). Pulso oscuro (daña y deja una esfera, máx. 3), Dispersión (cono de 3: las esferas salen disparadas, atraviesan a los enemigos dañándolos y aturdiéndolos, y luego la onda los empuja 3) y Descarga desatada (+5 de daño por esfera consumida).
- **Carcelero de Almas** (68 PV, 2 armadura, placaje 12). Sentencia de muerte (gancho al primer enemigo de la línea: −2 PA y lo arrastra 2; ese turno, Recorrer la cadena por 1 PA), Linterna espectral (escudo a los aliados pegados; un aliado junto a ella puede Tomar la linterna por 1 PA y aparecer al lado del Carcelero ignorando el placaje) y Despellejar (3×3: daño, −2 PM y empuje 1). *Cosecha de almas*: cada enemigo que muere con él vivo da +1 de armadura fija ese combate (tope +6); las almas se acumulan durante la partida y cada 3 dan una mejora de hechizo.

**Marcadores en el suelo** (`src/core/combat/marks.ts`): objetos vinculados a una unidad que no bloquean ni tienen turno (esferas, linterna). Caducan al empezar los turnos de su dueño (o por rondas si no tienen dueño) y desaparecen si el dueño muere.

**Equilibrio**: `SIMN=60 npx vitest run tests/sim.test.ts` juega partidas completas de 3 y 4 jugadores con la IA de campeón y compara clases. Sirve para comparar, no para medir la dificultad para personas.

- **Acechador de Sombras** (60 PV, 7 PA, 5 PM, crítico 12). Shuriken sombrío (línea recta, primer enemigo), Tajo de sombra (a los pegados a ti y a tu Sombra, −1 PM una sola vez) y Sombra viviente (2 PA: la Sombra dura 2 turnos; mientras exista, Intercambiar por 1 PA te cambia de sitio con ella ignorando el placaje). *La Sombra* es un marcador fantasma: sin vida, sin turno y sin bloquear; los enemigos no pueden atacarla. Replica cada hechizo de daño al **50%** (también contra el mismo enemigo) y no repite los efectos de control. Bendiciones *Filos* (shuriken, tajo de 2 PM, Marca mortal) y *Umbra* (Sombra de 3 turnos, réplica al 75%, Ocaso).

**Modelos animados** (`src/render/models.ts`): las cuatro clases nuevas tienen modelos de 32×32 pintados por código con contorno automático, con animaciones de reposo, andar, ataque, lanzamiento, especial (encanto, dispersión, sombra) y muerte. Llevan sus colores propios; el color del jugador va en el anillo de debajo. Las clases antiguas siguen con sus sprites de 16×16.

## v8 · Equilibrio, ritmo de mejoras y clases jugables

- **Clases jugables**: Hechicera Zorro, Tejedora de Esferas, Acechador de Sombras, Carcelero de Almas y Arquero. Guerrero, Mago, Pícaro y Clérigo quedan ocultos (`hidden` en `classes.ts`); sus hechizos y bendiciones se conservan.
- **Estadísticas iguales**: todas empiezan con 60 PV, 6 PA y 3 PM, sin bonus de daño.
- **Usos por turno** (`perTurn`): Orbe, Pulso, Shuriken y Tajo de sombra, 2; Impulso, Descarga y Sentencia, 1. *Impulso espiritual* se puede repetir gratis (0 PA) si su proyectil remata.
- **Zorro**: el orbe hace daño a la ida y a la vuelta, pero sus efectos se aplican una vez. Encanto (alcance 1-7) atrae 2 casillas.
- **Tejedora**: esferas de 2 turnos, Pulso 1-5; Dispersión 3 PA, cono de 2, recarga 1; Descarga 5 PA, 1-5, sin recarga y a un solo objetivo.
- **Acechador**: Shuriken 3 PA, 1-5 en línea; Tajo sin recarga, −1 PM. Animación de giro del personaje y de su Sombra.
- **Carcelero**: Sentencia 3 PA, 1-5, sin recarga; Linterna recarga 2; Despellejar 3 PA. *Almas*: cuentan en toda la partida (indicador en el HUD y en Grupo); cada 5, +1 de armadura permanente. Cosecha: 2 de escudo por alma (máx. 20).
- **Una recompensa por sala**: combate normal, un objeto y una mejora de hechizo alternos; élite, una bendición; jefe, un objeto, una runa rara y una reliquia. El tesoro ya no da runa.
- **Tope de mejoras**: un hechizo se mejora como mucho 2 veces por partida (bendiciones incluidas) y solo con una mejora elemental. Nunca se ofrece mejorar un hechizo que no tienes: se ofrece antes el hechizo.
- **Mejoras elementales**: Ígneo (fuego + quemadura), Gélido (hielo + −1 PM), Tóxico (veneno x2) y Umbrío (sombra + 20% de robo de vida). Potenciado baja a +20%.
- **6 hechizos nuevos por clase** en 3 estilos por clase; los rasgos de 3 piezas ya no se repiten entre estilos.
- **Dificultad**: `DIFF` en `run.ts` (zona 1 −50%, +45% por zona; grupos de 1-2 jugadores, un poco más fácil). Simulación con la IA de campeón (30 partidas): tríos 40-60%, 4 jugadores ~63%, dúos 17-37%.
- **El Abismo (zona 4)** ya no es opcional: no se muestra hasta ganar por primera vez y desde entonces se juega siempre.
- **Interfaz**: ficha de hechizo en lista (coste, daño, alcance, zona, usos, recarga y efectos); retrato del personaje en la selección; barra de maestría con lo que falta para el siguiente nivel.

## v9 · Hechizos únicos, bendiciones de clase y el Bárbaro Desatado

- **Pool por clase** (`PATRONS` con `noSet`): 6 hechizos únicos y 3 bendiciones pasivas por clase (`BLESSINGS` en `core/boonmods.ts`). Las ofertas son al azar y solo de la clase del jugador. Ya no salen hechizos genéricos.
- **3 ofertas de hechizo antes de la sala 3**: una al empezar, otra tras la sala 1 y otra en la sala 2 (santuario, combate o jaula: esa fila ya no tiene evento). Las 3 primeras ofertas son solo hechizos. Maestría 5: 4 opciones por oferta.
- **Zorro**: Fuego zorruno (3 llamas que vuelan al acabar el turno: al más cercano a 3; si empatan, el de menos vida y luego menos resistencias), Espejismo ilusorio (señuelo que atrae a los enemigos), Vórtice espiritual, Seducción arcana, Estallido de colas, Vínculo etéreo. Bendiciones: Esencia desbordante, Danza de las nueve colas, Mirada hipnótica. **Aura rosa** cuando la siguiente habilidad va a curar.
- **Tejedora**: Descarga cuesta 4 PA y suma +8 por esfera; las esferas que chocan hacen 9-11. Fuerza de voluntad, Gravedad inversa, Órbita defensiva, Resonancia oscura, Singularidad, Transfusión de vacío. Bendiciones: Poder ilimitado, Onda expansiva, Eco oscuro.
- **Carcelero**: cada muerte deja un alma en el suelo y una que se puede gastar. La caja, Explosión de almas, Cadenas vinculantes, Atracción del abismo, Tormento espectral, Sacrificio del guardián. Bendiciones: Condenación eterna, Faro de las sombras, Guadaña segadora.
- **Acechador**: Marca de la muerte (guarda el 35% del daño y estalla), Danza de cuchillas (sangrado), Paso sombrío, Velo de penumbra, Convergencia letal, Cosecha oscura. Bendiciones: Maestro de las sombras (2 Sombras), Desprecio por los débiles, Sombra persistente.
- **Bárbaro Desatado** (60/6/3, armadura 1, placaje 8): Furia de 0 a 100 (+20 al golpear, +10 al recibir daño, −20 por turno sin pelear; cada 20, +5% de daño y +6% de crítico). Kit: Sed de batalla, Tajo despiadado, Embiste giratorio. 6 hechizos: Grito desmoralizador, Golpe colosal, Pacto de sangre, Cuchillada giratoria, Mirada del verdugo, Frenesí imparable. Bendiciones: Furia inagotable, Negarse a morir, Torbellino sangriento. Modelo animado de 32×32 (reposo, andar, ataque, furia y muerte).
- **Interfaz**: Esencia, Esferas, Almas, Furia y Marcas de la muerte en la barra del héroe y sobre el tablero; llamas, muros de La caja y almas dibujados en el suelo; iconos nuevos.
- **Simulación** (bots, 30 partidas): tríos con Carcelero y Arquero entre 37% (Zorro) y 60% (Bárbaro); 4 jugadores con clases nuevas, 63%.

## Fase Q · Encuentros de jefe
- **Nunca solos**: todo jefe lucha con al menos 3 enemigos de papeles distintos (4 con 4 jugadores). Su vida se ajusta al tamaño del grupo.
- **Desgaste por oleadas** (Plañidera, Rey Calcinado, Eco de los Caídos): 4 enemigos al empezar; 4 más en la ronda 3; en la 5 llega el jefe con un subordinado especial y 2 acompañantes. Cada oleada se anuncia una ronda antes, con las casillas de llegada marcadas.
- **Objetivos estructurales**: sellos (Prior), raíces (Madre) y almas (Eco) protegen al jefe (−15 % / −10 % de daño cada uno, hasta un 60 %, nunca inmunidad). Puestos de caza, braseros, válvulas, fragmentos rúnicos y ecos del lamento son opcionales: si se ignoran, la presión crece.
- **Ataques anunciados más peligrosos**: en un encuentro, una parte del daño depende de la vida del héroe, con tope (55 %, o 75 % si se ignoraron mecánicas). En la fase 2 se anuncian más a menudo.
- Detalle completo en `FASE_Q_JEFES_DESGASTE.md`.
