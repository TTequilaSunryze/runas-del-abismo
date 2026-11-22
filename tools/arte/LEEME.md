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
