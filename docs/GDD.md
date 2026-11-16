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

## Pendiente / ideas
Sincronizar ecos en la nube con cuenta, más zonas y clases, sprites animados, balance con datos de partidas reales.
