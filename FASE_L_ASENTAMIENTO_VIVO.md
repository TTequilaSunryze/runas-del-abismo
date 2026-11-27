# Fase L · El Asentamiento vivo y la Taberna

## Propósito
Tras elegir héroe, el jugador llega a un panorama del Asentamiento en el que puede entrar en los lugares y hablar con sus habitantes. Primer lugar completo: la Taberna con Irena.

## Funcionamiento
1. **Panorama** (`bg/asentamiento.jpg`), animado: antorchas, faroles y velas que parpadean, ascuas, humo de la forja y la hoguera, luz del Abismo que late y chispas frías que suben por la grieta.
2. Al pasar el ratón por un edificio, se aclara sutilmente y aparece su nombre y para qué sirve. Los bloqueados se ven en gris con 🔒 «Próximamente».
3. **Lugares**: Taberna (interior propio), Archivo, Mercader de ecos (Tienda), Memorial de los héroes (Salón), Barracones (Maestría), Atalaya (Logros), Palomar (Amigos), Tablón del reto (Reto del día) y la Puerta del Abismo (empieza la expedición). Bloqueados: Forja, Santuario y Puesto de guardia.
4. **Entrar en la Taberna**: fundido a negro, interior (`bg/taberna.jpg`) con fuego y faroles animados y cambio de música (pista «Descanso»).
5. **Irena** trabaja detrás de la barra (sprites limpiando un vaso); al pasar el ratón saluda, se ilumina y aparece su nombre. Al hacer clic empieza la conversación.
6. **Diálogo**: el fondo se oscurece, Irena aparece de cuerpo entero y abajo el cuadro de texto con su retrato. El texto se escribe letra a letra; clic, Espacio o Intro lo completan o avanzan; Esc cierra.
7. **Opciones**: qué es el Refugio, noticias de tus expediciones (según tus partidas, victorias, jefes y bajas), sobre ella, rumores que se desbloquean con tu progreso (partidas, jefes, Archivo, victorias) y despedirse. El saludo reacciona al héroe elegido.

## Recursos
- `public/bg/asentamiento.jpg`, `public/bg/taberna.jpg`
- `public/npc/irena.png` (cuerpo entero, fondo quitado), `irena_retrato.jpg`, tiras de 4 fotogramas `irena_wipe.png`, `irena_wave.png`, `irena_talk.png` (esta última aún sin uso)

## Integración técnica
- `src/ui/settlement.ts`: panorama, Taberna, diálogo, fundido y máquina de escribir.
- `src/content/dialogues.ts`: habitantes y árbol de conversación (`NPCS`). Añadir un habitante = un objeto más.
- `src/render/menubg.ts`: escenas `settle` y `tavern`, humo y ascuas solo desde fuegos.
- Las coordenadas de edificios y personajes están en píxeles de la imagen original, así que coinciden con el fondo en cualquier tamaño de pantalla.
- Solo ambientación: no se modifica `Meta`, `RunState`, Supabase, el combate ni la economía.

## Pendiente
- Interiores, habitantes y diálogos del resto de edificios.
- Pista de música propia para la Taberna, si la hay.
