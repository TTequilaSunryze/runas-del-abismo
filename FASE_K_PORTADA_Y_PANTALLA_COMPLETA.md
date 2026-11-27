# Fase K · Portada, selección de héroe, Asentamiento y pantalla completa

## Propósito
Reordenar la entrada al juego al estilo de Slay the Spire II y hacer que todo el juego quepa en el monitor.

## Flujo nuevo
1. **Menú principal** sobre la cueva rúnica animada (`bg/inicio.jpg`): Continuar (solo si hay partida), Jugar, Abandonar partida (solo si hay partida; pide dos clics), Multijugador, Ajustes y Salir o cambiar cuenta. Perfil arriba a la izquierda.
2. **Jugar**: el mismo fondo, desenfocado y oscurecido, con dos cartas: *Adentrarse en el Abismo* y *Reto del día*.
3. **Selección de héroe**: retratos pequeños abajo; el elegido ocupa el fondo, con ficha (nombre, vida, historia, pasiva, habilidades) a la izquierda, dificultad encima de los retratos, ↩ a la izquierda y ✔ a la derecha. *Cambiar habilidades* abre las 4 ranuras en tarjetas sobre el fondo desenfocado. En multijugador, los jugadores de la sala aparecen arriba a la izquierda.
4. **El Asentamiento** (tras ✔): paso previo a la expedición. La Puerta del Abismo empieza la partida; el resto de lugares abren lo que antes eran pestañas del inicio (Archivo, Tienda, Salón de héroes, Maestría, Logros, Reto diario, Amigos). Forja y Santuario, bloqueados. Al terminar una expedición se vuelve aquí.

## Pantalla completa
- La aplicación ocupa exactamente el viewport; nada desplaza el documento.
- En combate, el tablero llena todo el hueco entre la barra superior y la inferior (se miden en cada redibujado y al cambiar el tamaño de la ventana). El orden de turnos es una tira compacta arriba a la izquierda; el registro es un icono 📜 que abre un panel.
- En mapa, salas, tienda y eventos, el contenido usa todo el ancho; equipo, hechizos y grupo son iconos a la derecha (con ayuda al pasar el ratón) que abren un panel por encima, siempre dentro de la pantalla.
- Barra superior con iconos (mapa, ficha, sonido, 🚪 abandonar); en pantallas estrechas se ocultan los deslizadores y las barras pasan a dos líneas.

## Pendiente de arte (no se ha inventado ninguna imagen)
- Ilustración a pantalla completa de cada héroe: `public/heroes/<clase>.png`, y añadirla en `HERO_ART` (`src/ui/screens.ts`). Mientras tanto se usa el sprite del juego sobre un tinte de color.
- Imagen del Asentamiento con sus edificios, y arte de cada edificio con sus NPC y diálogos. Hasta entonces se reutiliza la escena del Refugio existente.

## Integración técnica
- `homeScreen()` (portada) y `lobbyScreen()` (selección de héroe / Asentamiento) en `src/ui/screens.ts`.
- Estado nuevo en `ui`: `front`, `abandonArmed`, `lobbyStage`, `overlay`, `bldgOpen`, `refreshLobby`.
- Acciones nuevas en `src/ui/app.ts`: `front`, `abandon`, `abyssgo`, `dailygo`, `herook`, `herochange`, `overlay`, `bldgclose`, `sidetab`.
- No se modifica `core`, `RunState`, Supabase, el combate ni la economía.

## Validación
- `npm test` (480 pasan) y `npm run build` correctos.
- Revisado en 1920×1080, 1440×900, 1280×720, 1024×600 y 390×844 sin elementos fuera de la pantalla.
