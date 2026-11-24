# Herramientas para preparar el arte isométrico

No forman parte del juego ni de la compilación (Python 3 con Pillow y numpy).

- `recortar_fondo.py ENTRADA SALIDA TOLERANCIA`: quita el fondo (color plano, oscuro o cuadriculado gris pintado) rellenando desde los bordes y recorta la imagen al contenido. Tolerancia habitual: 40.
- `losa_iso.py ENTRADA SALIDA [--color] [--pts Lx,Ly,Tx,Ty,Rx,Ry]`: de una losa con grosor (ya sin fondo) saca solo la cara de arriba, la ajusta al rombo de 256×128, quita el degradado de luz y la lleva al gris piedra del suelo.

Ejemplo:
```
python3 recortar_fondo.py losa.webp losa_sin_fondo.png 40
python3 losa_iso.py losa_sin_fondo.png ../../public/iso/z1/floor_04.png
```

- `--color`: para losas que ya vienen con luz pareja y tienen color propio (musgo, runas): solo suaviza el brillo.
- `--pts`: esquinas izquierda, superior y derecha de la cara de arriba, marcadas a mano sobre la imagen de entrada, para cuando la base sobresale y la detección automática falla.
- Todas las losas se llevan al mismo tono medio para que no se vean parches.

## Escenario (public/iso/crypt)

"Stone Crypt FREE" de dotplays (crédito agradecido, no obligatorio; no se pueden redistribuir las piezas sueltas).
Se usan los PNG de `sprites/@128` (rombo 128×64, el del tablero), oscurecidos: suelos ×(0.66, 0.66, 0.70), muros ×(0.62, 0.62, 0.66), objetos ×(0.72, 0.70, 0.68), marcas ×0.8. La llama es `fx/@128/fx_flame.png` (8 fotogramas).
Cada sala se genera con una semilla (partida, zona, sala y tamaño): manchas de musgo o piedra rota con autotile por esquinas, marcas en el suelo, de 0 a 2 arcos con puerta cerrada, abierta o sin puerta, y antorchas cada 2 a 4 tramos (`buildRoom` en src/render/board.ts).
Tono por zona (multiplicar) en `ZONE_TINT`.

## Objetos (public/iso/props)

"Pixel Worlds - 202 Dungeon, Castle & Mine Props (Free)" de SdavGha: sin atribución obligatoria; no se pueden redistribuir sueltos ni usar para entrenar IA.
Se usan los PNG `_2x` (rombo 128×64, igual que el tablero), oscurecidos ×(0.70, 0.67, 0.63). Punto de apoyo: centro de abajo de la imagen sobre el vértice de abajo de la casilla.
Obstáculos por zona en `ZONE_PROPS` (src/render/board.ts); la trampa de púas es la del Stone Crypt (`spike_trap_up`).

## Personajes con hoja de 8 direcciones (public/iso/units)

Guerrero esqueleto: "Skeleton Series" de MEKAI GAMES (crédito agradecido; no redistribuir ni usar para entrenar IA).
Hojas `sheets/classic/skeleton_classic_<anim>.png` tal cual: fotogramas de 96 px, pies en (48, 80), filas S, SE, E, NE, N, NW, W, SW. Se dibujan a 2×.
Para añadir otro: copiar sus hojas como `<nombre>_<idle|walk|attack|hurt|death>.png` y registrarlo en `SHEETS` (src/render/board.ts) con la clase del enemigo.

Devorador (zona 4): modelo 3D de demonio en 16 direcciones ("Assembled_Shadow_Optimized_Spritesheets", sin licencia en el ZIP: pendiente de confirmar su origen), pasado a pixel art con `pixelar_hoja.py` a escala 0.5 (celdas de 160 px, pie en (80, 104)).
Larva abisal (zona 4): ciempiés gigante 3D, `pixelar_hoja.py ... centipede 0.5 "idle=Idle,walk=Walk,attack=Attack,hurt=Hit,death=Death" 2` (celdas de 160, pie (80, 80)).
Ent podrido (zona 2): árbol maldito 3D, `pixelar_hoja.py ... tree 0.55 "idle=Idle,walk=Walk (Loop),attack=Attack_01,hurt=Hit,death=Death" 1` (celdas de 176, pie (86, 95)).
Los tres modelos 3D venían sin licencia en el ZIP: pendiente de confirmar su origen.

Tiny Enemies Vol. 1 (Vryell): hojas de 16 px en 4 direcciones (filas S, E, N, W; cabecera de 16 px; 4 filas por color). Se reparten en las 8 filas del juego (S, SE←E, E, NE←N, N, NW←N, W, SW←W) como `tiny_<enemigo>_<anim>.png` y se dibujan a 5×.
Enemigos: espectro, gárgola, necrófago, acólito, araña, hongo, chamán, druida, pantera, piromante, ascua, salamandra, ceniciento, ojo, errante del vacío y heraldo.

Arquero (héroe): "Arcane archer" (autor y licencia por confirmar), de perfil y mirando a la derecha; filas del original: 0 correr, 1 muerte, 3 disparo, 5 quieto, 6 habilidad, 7 herido. Celdas de 64 px, pies en (32, 48), a 3× (unos 96 px); se voltea para mirar a la izquierda. El .aseprite del pack es la misma hoja en un solo fotograma, sin etiquetas. Disparo: 800 ms, suelta la flecha en el 7.º fotograma (`release`), con `projectile.png` como flecha; el efecto de impacto y los números de daño esperan a que llegue.
Tejedora (zona 2): araña gigante 3D (celdas de 256: el conversor lo detecta por la carpeta `x256…`), `pixelar_hoja.py x256_Spritesheets weaver 0.62 "idle=Idle_Nervous,walk=Walk,attack=Attack1,hurt=Hit,death=Die1" 2`. Licencia por confirmar.
`head` en cada hoja = alto real del dibujo sobre los pies, para colocar la barra de vida.

Limo de osario: hoja dibujada con IA (una dirección, mira a la derecha), fondo ya transparente. Fotogramas recortados por zonas, reducidos a 1/3, alfa duro, alineados por la base (el ataque, por el lado izquierdo del cuerpo) en celdas de 96×96 con los pies en (48, 92); a 2×. Herido: 3 primeros fotogramas (el 4.º, el estallido, no se usa).
Murciélago de cripta: hoja dibujada con IA sin transparencia real (cuadriculado gris pintado): se quita el gris poco saturado y claro, se tapan las etiquetas de las filas, se cortan los fotogramas por los huecos de cada fila, se descartan manchas sueltas (<60 px) y se alinean por la sombra. Celdas de 72 px, sombra en (36, 69), a 2×, una dirección (mira a la derecha).
Arquero óseo: lámina con transparencia, montada con `hoja_ia.py lamina.png public/iso/units/boneArcher recuadros.json 0.4 96` (recuadros guardados en tools/arte/recuadros/arquero_oseo.json). Suelta la flecha en el 5.º fotograma de 8 (`release`).
Caballero sepulcral: lámina JPG con fondo gris liso (31, 32, 34): se quita rellenando desde los bordes (tolerancia 12) más los huecos interiores grandes (> 350 px). Recuadros en tools/arte/recuadros/caballero_sepulcral.json; `hoja_ia.py … knight … 0.5 160`; aclarado (gamma 0.72 ×1.08) porque se confundía con el suelo.
`hoja_ia.py` ya no desplaza el fotograma si algo se sale de la celda (lo recorta y avisa) y quita los trozos del fotograma vecino pegados al borde del recuadro.
Momia del osario: lámina JPG con fondo gris oscuro (29, 29, 29), quitado igual que el del caballero; ataque recortado por manchas (fotogramas desiguales). `hoja_ia.py … mummy … 0.24 160`.

`detectar.py LAMINA LIMPIA.png MODO [x_min]` quita el fondo (borde / oscuro / cuadros) y detecta los fotogramas por filas; los recuadros de cada criatura están en tools/arte/recuadros/. Calavera ígnea, Sepulturero (su colocar trampa = «cast»), Abominación de huesos (reposo solo con los dibujos que llevan guadaña), Lobo corrupto (aullido = «cast») y El Prior Hueco (fase 1 «prior», fase 2 «prior2», cuyo «cast» es la transformación y se ve al cambiar de fase). Sepulturero y Prior aclarados (gamma 0.75 ×1.08).
Reposo: ida y vuelta (0 1 2 3 2 1…), unos 1,2 s por vuelta; andar: unos 0,8 s por vuelta. El reposo del caballero va sin el dibujo que no tenía espada.
La Plañidera: lámina de dos fases (izquierda pálida = «planidera», derecha oscura = «planidera2»; la última fila izquierda es la transformación). Fase 2: reposo = fila de flotar (la primera fila parpadeaba). Escala 0.72, celdas de 224. Las hojas con fase 2 tienen la animación «transform», que se ve al cambiar de fase.

**Quitados (23-11):** «Skeleton Series» (MEKAI GAMES) y «Tiny Enemies» (Vryell). Esos enemigos vuelven al dibujo antiguo hasta tener su lámina propia.

## Zona 1 (hojas IA del usuario)
esqueleto, acolito, necrofago, espectro, gargola: recuadros en `recuadros/<nombre>.json`.
Fotogramas pegados separados por mínimos de columna (bolas de fuego del acólito, estela del espectro,
última muerte del esqueleto); en la gárgola la fila de lanzar y la de herido se separan por el mínimo de filas.
El acólito traía títulos de texto: se borran las manchas claras dentro de la franja de cada título.

## Zona 2 + Hechicera Zorro (hojas IA del usuario)
`zona2/`: `regiones.py` (zona de cada animación en cada lámina y nº de fotogramas), `util.py` (quitar rejillas,
quedarse con el interior de los paneles, separar fotogramas) y `montar.py` (monta todas las hojas).
Láminas con paneles: se limpia con «paneles» y se deja solo el interior de los recuadros (`inside_panels`);
el chamán (tabla) con tolerancia mayor y quitando las líneas que cruzan toda la tabla.
Pilar de huesos: un dibujo por estado de vida (`hpFrames`). Zorro: una animación por familia de hechizos (`spellAnim`).
Cazador Silvano: la transformación es la última fila de la fase 1. Madre Raíz: la fila «death/transform» es su transformación.
