# Runas del Abismo: imágenes para la vista isométrica

Esta es la lista de lo que hay que generar con la herramienta de IA para que las salas se vean como la captura de referencia: mazmorra de piedra en vista isométrica, antorchas cálidas y personajes de pixel art detallado.

El tablero isométrico ya está hecho y funciona en el juego (botón 🔷 o tecla I). Ahora mismo usa las losas y el pilar que ya existían, deformados al rombo. Cada lote de imágenes de esta lista sustituye una parte.

---

## 1. Reglas comunes (para todas las imágenes)

Estas reglas son lo más importante. Si una imagen no las cumple, no encaja en el tablero aunque se vea bonita.

| Regla | Valor |
|---|---|
| Formato | PNG con **fondo transparente**. Nada de fondo negro, ni blanco, ni suelo dibujado alrededor. |
| Perspectiva | **Isométrica 2:1**: el rombo de una casilla mide el doble de ancho que de alto. Cámara fija, mirando desde abajo a la derecha hacia arriba a la izquierda (como en la captura). |
| Luz | Luz **cálida de antorcha desde arriba a la izquierda**; sombras frías, azuladas o violetas. Igual en todas las imágenes. |
| Sombra en el suelo | **No dibujarla.** El juego pone la sombra bajo los pies y bajo los objetos. |
| Texto | Ninguno: ni letras, ni números, ni firmas, ni marcas de agua. |
| Estilo | Pixel art detallado "HD": píxeles visibles, contorno oscuro, 3–4 tonos por color, paleta apagada (piedra gris verdosa, musgo, óxido) con acentos de color vivos (fuego naranja, magia azul o violeta). |
| Tamaño | Genera **grande** (el tamaño de cada tabla, o el doble). Yo lo reduzco al tamaño del juego. Nunca más pequeño. |

**Frase de estilo para pegar al principio de todas las peticiones.** Las herramientas de IA suelen entender mejor el inglés:

> `isometric 2:1 pixel art, dark fantasy dungeon, detailed HD pixel art, dark outlines, muted stone palette with warm torchlight from the upper left, cool purple shadows, transparent background, no text, game asset, consistent style`

**Consejo de coherencia:** genera primero **una losa y un pilar**, y si te gustan, úsalos como imagen de referencia de estilo para todo lo demás. Si la herramienta permite fijar la semilla (seed), usa siempre la misma.

---

## 2. Medidas y punto de apoyo

El juego coloca cada imagen apoyándola en el centro del rombo de su casilla. Por eso importa dónde está "el suelo" dentro de la imagen.

| Tipo | Lienzo | Dónde va el suelo |
|---|---|---|
| Losa de suelo | **256 × 128** | El rombo ocupa el lienzo entero: sus puntas tocan el centro de cada borde. Fuera del rombo, transparente. |
| Obstáculo (pilar, escombros, estatua…) | **256 × 512** (ancho fijo, alto hasta 512) | La base del objeto es un rombo de 256 × 128 pegado al **borde inferior** del lienzo. |
| Tramo de muro del fondo | **128 × 384** | El pie del muro toca el borde inferior. Ver el apartado 4. |
| Personaje o enemigo (cada fotograma) | **256 × 256** | **Los pies, centrados en horizontal, a 32 px del borde inferior** (en el punto 128, 224). La cabeza no debe pasar del borde de arriba. |
| Jefe (cada fotograma) | **384 × 384** | Los pies en (192, 352). |
| Efecto animado (llama, chispas) | **64 × 128** por fotograma | La base de la llama abajo y centrada. |

**Hojas de animación:** los fotogramas de una misma animación van **en una fila, de izquierda a derecha**, sin huecos entre ellos. Por ejemplo, un ataque de 4 fotogramas de 256 × 256 es una imagen de **1024 × 256**.

**Dirección de los personajes:** todos miran **hacia abajo a la derecha** (hacia la cámara, de tres cuartos). Para mirar a la izquierda los voltea el juego, así que no hace falta generar esa versión.

---

## 3. Nombres de archivo

Usa estos nombres exactos, así los cargo sin tener que renombrar nada:

```
iso/z1/floor_01.png … floor_08.png
iso/z1/pillar_01.png …
iso/heroes/pistolero_idle.png, pistolero_walk.png, pistolero_attack.png …
iso/enemies/esqueleto_guardian_idle.png …
```

(`z1` = zona 1, `z2` = zona 2, etc.)

---

## 4. LOTE 1: escenario de la zona 1, Las Catacumbas Olvidadas (el de la captura)

Es lo primero, porque es lo que más cambia el aspecto. Son unas **30 imágenes**.

### 4.1 Losas del suelo: `floor_01` … `floor_08` (256 × 128)
Ocho variantes de la misma losa de piedra, para que el suelo no se vea repetido. El juego las reparte al azar.

| Archivo | Descripción |
|---|---|
| floor_01 | Losa de piedra gris limpia, con bisel suave en los bordes |
| floor_02 | Igual, con una grieta diagonal |
| floor_03 | Con musgo verde en una esquina |
| floor_04 | Desgastada, con el centro hundido |
| floor_05 | Con piedrecitas sueltas encima |
| floor_06 | Con una runa grabada muy tenue |
| floor_07 | Con huesos pequeños o restos encima |
| floor_08 | Partida en dos piezas |

> Petición de ejemplo: `[frase de estilo] single isometric floor tile, worn grey stone slab with a diagonal crack, beveled edges, diamond shape filling a 256x128 canvas, transparent outside the diamond`

**Importante:** el brillo medio tiene que ser parecido en las 8 losas. Si una es mucho más clara, se notará como un parche.

### 4.2 Borde del tablero: `edge_left.png` y `edge_right.png` (128 × 160)
El canto de piedra que se ve en el borde delantero del suelo, para que no parezca una lámina flotando. Son las caras laterales de una losa, de unos 32 px de grosor visible, con roca oscura debajo. `edge_left` es la cara inclinada hacia la izquierda y `edge_right` la inclinada hacia la derecha.

### 4.3 Abismo: `pit.png` (256 × 128)
Un hueco en el suelo: negro profundo con el borde de piedra roto y algún destello violeta en el fondo.

### 4.4 Obstáculos de una casilla (256 × hasta 512)
| Archivo | Descripción |
|---|---|
| pillar_01 | Pilar de piedra cuadrado con capitel tallado (como los de la captura) |
| pillar_02 | Pilar con runas grabadas que brillan azul tenue |
| pillar_03 | Pilar roto, solo la mitad inferior, con cascotes |
| rubble_01 | Montón de escombros bajo (que no tape a quien está detrás) |
| rubble_02 | Bloques caídos con musgo |
| tomb | Sarcófago de piedra cerrado, orientado en diagonal |
| statue | Estatua sin rostro, encapuchada, sobre un pedestal |

### 4.5 Brasero (interactivo: se rompe y deja fuego)
| Archivo | Lienzo | Descripción |
|---|---|---|
| brazier.png | 256 × 384 | Cuenco de hierro sobre trípode, **sin llama** (la llama va aparte) |
| brazier_broken.png | 256 × 256 | El mismo, volcado y roto |
| flame.png | 6 fotogramas de 64 × 128 → **384 × 128** | Llama naranja y amarilla en bucle |

### 4.6 Muros del fondo (lo que rodea la sala en la captura)
Van por los **dos bordes de atrás** del tablero: el de arriba a la izquierda y el de arriba a la derecha. Cada tramo cubre el lado de una casilla.

| Archivo | Lienzo | Descripción |
|---|---|---|
| wall_l_01, wall_l_02, wall_l_03 | 128 × 384 | Tramo de muro de sillares para el borde **izquierdo** (la cara mira hacia abajo a la derecha). Tres variantes: limpio, agrietado y con raíces. |
| wall_r_01, wall_r_02, wall_r_03 | 128 × 384 | Lo mismo para el borde **derecho** (la cara mira hacia abajo a la izquierda) |
| wall_l_torch, wall_r_torch | 128 × 384 | Tramo con un soporte de antorcha de hierro, **sin la llama** (se reutiliza `flame.png`) |
| wall_l_arch, wall_r_arch | 128 × 384 | Tramo con un arco o puerta oscura |
| wall_corner | 128 × 448 | La esquina de arriba, donde se unen los dos muros |

### 4.7 Suelo especial (opcional en este lote)
- `puddle.png` (256 × 128): charco de agua oscura con reflejos (la sala "inundada").
- `spikes_off.png` y `spikes_on.png` (256 × 128): placa de púas hundida y la misma con las púas fuera.

---

## 5. LOTE 2: personajes jugables

Recomiendo empezar por **una sola clase** (la que más juegues: en tu captura sale el Pistolero) para validar el tamaño y el estilo antes de hacer las 8.

### Animaciones por clase
| Animación | Fotogramas | Hoja | Qué debe verse |
|---|---|---|---|
| `idle` | 4 | 1024 × 256 | Respirando, de pie, en bucle |
| `walk` | 6 | 1536 × 256 | Andando sin desplazarse (el juego lo mueve) |
| `attack` | 4 | 1024 × 256 | Ataque con su arma: preparación, golpe, impacto, vuelta |
| `cast` | 4 | 1024 × 256 | Lanzar un hechizo: brazos arriba, brillo en las manos |
| `special` | 4 | 1024 × 256 | Gesto de su habilidad principal (más espectacular) |
| `hurt` | 2 | 512 × 256 | Retroceso al recibir un golpe |
| `death` | 5 | 1280 × 256 | Cae al suelo. El último fotograma, tumbado. |

Además, por clase: **`portrait.png` de 256 × 256**. Es el retrato de busto que aparece abajo a la izquierda y en el orden de turnos: mirando de frente, con fondo transparente.

**Para que todos los fotogramas sean el mismo personaje:** genera primero el `idle` y úsalo como referencia para el resto. Mantén la ropa, los colores y las proporciones idénticos. En la cabecera de cada petición describe siempre el personaje con las mismas palabras.

### Las 8 clases (descripción para la petición)
| Archivo | Clase | Idea visual |
|---|---|---|
| pistolero_* | Pistolero Arcano | Sombrero de ala ancha, abrigo largo oscuro, dos pistolas con runas azules |
| carcelero_* | Carcelero de Almas | Armadura oscura pesada, cadenas, linterna verde de almas, guadaña |
| zorro_* | Hechicera Zorro | Kitsune con colas, kimono rojo y blanco, fuego azul en las manos |
| esferas_* | Tejedora de Esferas | Túnica violeta, esferas oscuras flotando a su alrededor |
| acechador_* | Acechador de Sombras | Asesino encapuchado, dagas, bufanda que se deshace en humo |
| barbaro_* | Bárbaro Desatado | Musculoso, pieles, hacha a dos manos, pintura de guerra roja |
| arquitecto_* | Arquitecto Rúnico | Mago constructor, túnica con placas de piedra, glifos cian |
| arquero_* | Arquero | Capucha verde, arco largo, carcaj, capa de cazador |

Total: 8 clases × (7 hojas + 1 retrato) = **64 imágenes**.

---

## 6. LOTE 3: enemigos de la zona 1

Cada enemigo necesita como mínimo **`idle` (4), `attack` (4) y `death` (5)**. El golpe recibido lo hace el juego con un destello. Los jefes, además, **`cast` (4)** y miden **384 × 384**.

| Archivo | Enemigo | Tipo |
|---|---|---|
| limo_osario | Limo de osario | normal |
| murcielago_cripta | Murciélago de cripta | normal (vuela: los pies son la sombra) |
| esqueleto_guardian | Esqueleto guardián | normal (el de la captura) |
| acolito_hereje | Acólito hereje | normal |
| arquero_oseo | Arquero óseo | normal |
| necrofago | Necrófago | normal |
| espectro | Espectro | normal, semitransparente |
| momia_osario | Momia del osario | normal |
| calavera_ignea | Calavera ígnea | normal, flota en llamas |
| sepulturero | Sepulturero | normal |
| gargola | Gárgola | normal |
| caballero_sepulcral | Caballero sepulcral | élite |
| abominacion_huesos | Abominación de huesos | élite, grande |
| pilar_huesos | Pilar de huesos | invocación fija (solo `idle` y `death`) |
| prior_hueco | El Prior Hueco | **jefe** |
| planidera | La Plañidera | **jefe** |

Unas **50 imágenes**.

---

## 7. LOTE 4: zonas 2, 3 y 4

Lo mismo que los lotes 1 y 3, cambiando el tema:

| Zona | Suelo y muros | Obstáculos | Enemigos |
|---|---|---|---|
| **2. El Bosque Corrompido** | Tierra húmeda, raíces, losas de un templo antiguo comido por el bosque; "muros" de troncos y zarzas | Tocones, árboles muertos, setas gigantes, rocas con musgo | Lobo corrupto, Araña de zarza, Tejedora, Chamán de esporas, Ent podrido, Lobo alfa, Hongo hinchado, Pantera sombría, Zarzal andante, Druida corrupto, Raíz sanadora · **jefes:** La Madre Raíz, Reina de la zarza, El Cazador Silvano |
| **3. Las Ruinas de Ceniza** | Piedra quemada con grietas de lava, ceniza; muros de un palacio calcinado | Columnas derrumbadas, yunques, estatuas fundidas, braseros eternos | Sabueso de ceniza, Ceniciento, Piromante, Gólem de escoria, Verdugo de ceniza, Salamandra, Forjador caído, Tirador de ceniza, Ascua viva, Inquisidor de ceniza · **jefes:** El Rey Calcinado, La Fundidora |
| **4. El Abismo** | Roca negra flotando sobre el vacío, runas violetas que brillan; sin muros (bordes al vacío) | Obeliscos rúnicos, cristales, fragmentos flotantes | Errante del vacío, Ojo del abismo, Devorador, Heraldo del vacío, Larva abisal, Guardián rúnico, Centinela del Vacío, Mímico de runas, Obelisco hambriento · **jefes:** El Devorador de Runas, El Eco de los Caídos |

---

## 8. LOTE 5: interfaz (los marcos de la captura)

Esto se puede hacer en paralelo, porque no depende del tablero.

| Archivo | Lienzo | Descripción |
|---|---|---|
| ui_frame.png | 192 × 192 | Marco de madera oscura con remaches y esquinas de bronce. **Las esquinas deben ocupar exactamente 48 px** (lo estiro por los lados). |
| ui_parchment.png | 512 × 512 | Pergamino viejo, que se pueda repetir sin costuras (para el registro de combate) |
| ui_button.png | 384 × 128 | Botón dorado y naranja grande, como «¡Listo!» |
| ui_button_dark.png | 384 × 128 | El mismo, en piedra oscura (botones secundarios) |
| ui_slot.png | 128 × 128 | Hueco de habilidad: marco de piedra con borde dorado |
| ui_heart.png | 192 × 192 | Corazón rojo brillante (la vida, abajo a la izquierda) |
| ui_ap.png, ui_mp.png | 96 × 96 | Estrella azul (PA) y rombo verde (PM) |

---

## 9. Cómo entregarlas

1. Súbelas a este chat (puedes mandar varias a la vez) o a la carpeta del proyecto con los nombres de arriba.
2. Yo compruebo el tamaño y el punto de apoyo, las recorto y reduzco si hace falta, y las integro.
3. Te publico una versión para que la veas en el juego antes de pasar al siguiente lote.

**Orden recomendado:** Lote 1 (zona 1) → Lote 2 (solo el Pistolero) → Lote 3 (enemigos de la zona 1) → resto de clases → Lote 5 (interfaz) → Lote 4 (otras zonas).

### Cuántas son en total
| Lote | Imágenes aproximadas |
|---|---|
| 1. Escenario de la zona 1 | 30 |
| 2. Personajes (8 clases) | 64 |
| 3. Enemigos de la zona 1 | 50 |
| 4. Zonas 2–4 (escenario y enemigos) | 230 |
| 5. Interfaz | 8 |
| **Total** | **≈ 380** |

Con solo el lote 1 y el Pistolero (unas 38 imágenes), la sala de la zona 1 ya se parecerá mucho a la captura.

---

## 10. Qué hago yo en cada paso

| Paso | Estado | Qué cambia |
|---|---|---|
| 1. Tablero isométrico | ✅ Hecho | Proyección en rombos, clic y casillas resaltadas correctos, pilares translúcidos si tapan a alguien, grosor del borde, botón 🔷 / tecla I para comparar con la vista plana |
| 2. Cargador de escenario | Al llegar el lote 1 | Losas reales, muros del fondo con antorchas animadas, abismo, braseros |
| 3. Luz | Con el lote 1 | Halo de cada antorcha y brasero sobre el suelo, oscuridad en los rincones |
| 4. Personajes y enemigos | Al llegar los lotes 2 y 3 | Hojas de animación de 256 px, retratos |
| 5. Interfaz | Al llegar el lote 5 | Marcos, botones y pergamino como en la captura |
| 6. Efectos | Después | Proyectiles y áreas de hechizo con perspectiva |
