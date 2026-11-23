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
    elif mode == 'paneles':
        # fondo con recuadros de otro tono: los dos colores más comunes son fondo; relleno desde los bordes
        q = (a // 6).reshape(-1, 3); vals, cnt = np.unique(q, axis=0, return_counts=True)
        refs = [vals[i] * 6 + 3 for i in np.argsort(-cnt)[:2]]
        cand = np.zeros(a.shape[:2], bool)
        for r in refs: cand |= np.abs(a - r).max(2) <= 12
        lab, _ = ndimage.label(cand)
        sizes = ndimage.sum(cand, lab, range(1, lab.max() + 1))
        bg = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2000])
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


def bands(rgba, x_min=0, min_gap=3, min_h=40, min_area=1200):
    """Filas por franjas vacías; dentro de cada fila, fotogramas por manchas (unidas solo en horizontal)."""
    m = rgba[..., 3] > 0
    m[:, :x_min] = False
    lab, n = ndimage.label(m)
    sz = ndimage.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= 40])
    rows_on = m.sum(1) > 2
    out, y = [], 0
    H = m.shape[0]
    while y < H:
        if not rows_on[y]: y += 1; continue
        y0 = y; gap = 0
        while y < H and gap < min_gap:
            gap = 0 if rows_on[y] else gap + 1; y += 1
        y1 = y - gap
        if y1 - y0 < min_h: continue
        sub = m[y0:y1]
        cols = ndimage.binary_dilation(sub.any(0), iterations=6)
        cl, k = ndimage.label(cols)
        fr = []
        for sl in ndimage.find_objects(cl):
            x0, x1 = sl[0].start, sl[0].stop
            if sub[:, x0:x1].sum() >= min_area: fr.append([y0, x0, y1, x1])
        if fr: out.append(fr)
    return out


if __name__ == '__main__':
    a = sys.argv
    rgba = clean(a[1], a[3])
    Image.fromarray(rgba).save(a[2])
    rows = bands(rgba, int(a[4]) if len(a) > 4 else 0)
    for i, r in enumerate(rows): print(i, len(r), json.dumps(r))
