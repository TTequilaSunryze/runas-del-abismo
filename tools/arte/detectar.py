"""
Quita el fondo de una lámina y detecta los fotogramas por filas.

  python3 detectar.py LAMINA SALIDA_LIMPIA.png MODO [x_min] [dilatar]

MODO: «borde» (fondo liso: relleno desde los bordes), «oscuro» (quita todo lo casi negro y poco saturado),
«cuadros» (cuadriculado gris pintado: quita lo gris poco saturado y claro).
Imprime las filas (de arriba abajo) con sus recuadros [y0, x0, y1, x1] de izquierda a derecha, en JSON.
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage


def clean(src, mode):
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    sat = a.max(2) - a.min(2); lum = a.mean(2)
    if mode == 'oscuro':
        bg = (lum < 42) & (sat < 22)
    elif mode == 'cuadros':
        bg = (sat < 16) & (lum > 95) & (lum < 215)
    else:
        ref = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3)]), axis=0)
        cand = np.abs(a - ref).max(2) <= 14
        lab, _ = ndimage.label(cand)
        edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); edge.discard(0)
        bg = np.isin(lab, list(edge))
        isl = cand & ~bg; il, k = ndimage.label(isl); sz = ndimage.sum(isl, il, range(1, k + 1))
        bg |= np.isin(il, [i + 1 for i, s in enumerate(sz) if s > 300])
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    return np.dstack([a.astype(np.uint8), alpha])


def frames(rgba, x_min=0, dil=6, min_area=2500):
    m = rgba[..., 3] > 0
    m[:, :x_min] = False
    lab, _ = ndimage.label(ndimage.binary_dilation(m, iterations=dil))
    bs = []
    for sl in ndimage.find_objects(lab):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h * w >= min_area and h > 30: bs.append([sl[0].start, sl[1].start, sl[0].stop, sl[1].stop])
    rows = []
    for b in sorted(bs, key=lambda b: (b[0] + b[2]) / 2):
        cy = (b[0] + b[2]) / 2
        for r in rows:
            if abs(r['cy'] - cy) < (b[2] - b[0]) * 0.45: r['b'].append(b); break
        else: rows.append({'cy': cy, 'b': [b]})
    out = []
    for r in rows:
        bb = sorted(r['b'], key=lambda b: b[1])
        y0 = min(b[0] for b in bb); y1 = max(b[2] for b in bb)
        out.append([[y0, b[1], y1, b[3]] for b in bb])
    return out


if __name__ == '__main__':
    a = sys.argv
    rgba = clean(a[1], a[3])
    Image.fromarray(rgba).save(a[2])
    rows = frames(rgba, int(a[4]) if len(a) > 4 else 0, int(a[5]) if len(a) > 5 else 6)
    for i, r in enumerate(rows): print(i, len(r), json.dumps(r))
