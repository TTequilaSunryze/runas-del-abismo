"""
Monta hojas de animación (una dirección, mirando a la derecha) a partir de una lámina dibujada con IA.

  python3 hoja_ia.py LAMINA.png SALIDA_PREFIJO RECUADROS.json [escala] [celda] [ancla]

RECUADROS.json: {"idle": [[y0, x0, y1, x1], ...], "walk": [...], "attack": [...], "hurt": [...], "death": [...]}
(los recuadros se sacan con las manchas de la capa alfa; las etiquetas quedan fuera).
Cada fotograma: quita manchas sueltas (< 60 px), recorta, reduce con LANCZOS a la escala, alfa duro y se coloca en
una celda cuadrada con los pies en (celda/2, celda-4). El ancla horizontal es el centro de las filas de abajo
(los pies o la sombra) o, con ancla «left», el lado izquierdo de esas filas (útil si el ataque se estira hacia delante).
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage


def build(src, out, boxes, k=1 / 3, cell=96, anchor='center', anchor_rows=12):
    im = Image.open(src).convert('RGBA')
    for name, bs in boxes.items():
        sheet = Image.new('RGBA', (cell * len(bs), cell))
        for i, (y0, x0, y1, x1) in enumerate(bs):
            a = np.array(im.crop((x0, y0, x1, y1)))
            m = a[..., 3] > 40
            lab, n = ndimage.label(m)
            sizes = ndimage.sum(m, lab, range(1, n + 1))
            a[..., 3] = np.where(np.isin(lab, [j + 1 for j, s in enumerate(sizes) if s >= 60]), a[..., 3], 0)
            f = Image.fromarray(a); f = f.crop(f.getbbox())
            mm = np.array(f)[..., 3] > 0
            rows = np.nonzero(mm.any(1))[0]
            xs = np.nonzero(mm[max(0, rows[-1] - anchor_rows):rows[-1] + 1].any(0))[0]
            ax = xs.min() if anchor == 'left' else (xs.min() + xs.max()) / 2
            g = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            ga = np.array(g); ga[..., 3] = np.where(ga[..., 3] > 120, 255, 0); g = Image.fromarray(ga)
            x = round(cell / 2 - ax * k) - (round(cell * 0.12) if anchor == 'left' else 0)
            c = Image.new('RGBA', (cell, cell)); c.alpha_composite(g, (max(0, x), max(0, cell - 4 - g.height)))
            sheet.alpha_composite(c, (i * cell, 0))
        sheet.save(f'{out}_{name}.png')
        print(name, len(bs))


if __name__ == '__main__':
    a = sys.argv
    build(a[1], a[2], json.load(open(a[3])), float(a[4]) if len(a) > 4 else 1 / 3, int(a[5]) if len(a) > 5 else 96, a[6] if len(a) > 6 else 'center')
