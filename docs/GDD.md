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
