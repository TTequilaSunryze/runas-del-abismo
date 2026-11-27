# Fase O · El Salón de los Héroes y el Custodio (y arreglos)

## Arquitectura reutilizada
- **Lugares** (`src/ui/settlement.ts`, `PLACES`): mismo patrón que Taberna, Archivo y Puerta (fondo animado en `menubg`, zonas que se aclaran, carteles, fundido, habitante con tiras de fotogramas, diálogo con retrato).
- **Duelos y héroes guardados**: el panel existente del Salón (`metaPanel('salon')`: `meta.hall`, `meta.team`, duelos 3c3), sin cambios. Se abre desde el **armero**.
- **Objetos recuperados**: la ficha de investigación del Archivo (`dossier objetos`).
- **Memoria del habitante**: `meta.npcSeen` (la misma de Darel) para reaccionar a lo ocurrido desde la última visita.
- **Ventanas de inspección**: el mismo formato que la Puerta (`.dossier.inspect`).
- **No hay base de datos nueva.** El Muro se calcula en cada apertura desde `meta.stats`, Atlas, Crónicas, logros, `meta.hall`, `meta.research` y los rumores de Irena.

## El Salón
- En el panorama, el Salón es la cueva de las velas (antes «El Santuario», bloqueado). El cementerio de espadas pasa a «Campo de las espadas» (bloqueado): el Salón no es un cementerio.
- Objetos: **Muro de los Recuerdos**, **Libro de regresos** (altar), **Armero de los héroes** (duelos), **Estantes de objetos** (reliquias) y **Placas de los ausentes**.
- **Muro de los Recuerdos** (con filtros):
  - Hecho confirmado: guardianes caídos por región (Atlas), expediciones que llegaron al final, logros.
  - Testimonio: regresos tras caer, cada héroe guardado (si cayó: «cayó y regresó; recuerda la entrada, no la caída»), historias de zona de las Crónicas.
  - Teoría: hallazgos investigados con Romi.
  - Rumor: rumores de Irena ya desbloqueados.
  - Contradicción: salidas «sin regreso» según Darel aunque los héroes sigan en el Asentamiento; la expedición perdida.
- **Placas de los ausentes**: la Némesis («visto ahí abajo»), lo que hay más allá de las regiones conocidas, secretos sin explicar, los que bajaron antes. Nadie se marca como muerto.
- **El Custodio**: ciclo de quieto, trabajando (grabando una placa) y observando; se ilumina al pasar el ratón, saluda al seleccionarlo y abre el diálogo. Reconoce al héroe que vuelve tras caer, recuerda cosas que el héroe olvidó, no explica el Retorno. Música: lista «La torre / Final del camino / Descanso».

## Arreglos
- Sin botón «Descender al Abismo» en el panorama: solo se baja desde la Puerta.
- Fundido a negro al descender (para todos los jugadores). Vídeo de entrada opcional: si existe `public/video/intro_abismo.mp4`, se reproduce y se puede saltar (botón, clic, Esc, Espacio o Intro).
- Música: listas por situación, en orden aleatorio y sin bucles (`POOLS` en `src/audio/sfx.ts`); el menú usa 7 de las 11 pistas.
- Romi: fotogramas alineados por los pies (antes la figura se desplazaba hasta 22 px entre fotogramas). Igual con el Custodio.

## Recursos
`public/bg/salon.jpg`, `public/npc/custodio*.png|jpg` (`custodio_loop` = 24 fotogramas).

## Vídeo de entrada al Abismo
- `public/video/intro_abismo.mp4` (7,9 s, 1280×720, con sonido; recomprimido de 5,8 MB a 2,8 MB).
- Suena cada vez que se desciende, con sonido; la música se silencia mientras dura y vuelve después.
- Se salta con un clic, el botón «Saltar», Esc, Espacio o Intro.
- Se descarga al entrar en la Puerta, para que empiece al instante.
- Si el navegador no deja reproducir con sonido (sin ninguna interacción previa), se reproduce en silencio.
