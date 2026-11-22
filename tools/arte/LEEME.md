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
