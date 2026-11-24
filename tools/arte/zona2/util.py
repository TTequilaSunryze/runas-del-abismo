import sys, json
sys.path.insert(0, '/home/claude/runas-del-abismo/tools/arte')
import numpy as np
from PIL import Image
from scipy import ndimage
def load(n): return np.array(Image.open(f'/tmp/n7/{n}.png'))
def save(n, a): Image.fromarray(a).save(f'/tmp/n7/{n}.png')
def kill_lines(a, run=120):
    """Quita líneas rectas grises (marcos y rejillas): tramos largos de píxeles poco saturados."""
    rgb = a[..., :3].astype(int); sat = rgb.max(2) - rgb.min(2)
    gray = (a[..., 3] > 0) & (sat < 26)
    kill = np.zeros_like(gray)
    for axis in (0, 1):
        g = gray if axis == 1 else gray.T
        k = np.zeros_like(g)
        for i in range(g.shape[0]):
            row = g[i]; d = np.diff(np.concatenate([[0], row.astype(int), [0]]))
            st, en = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
            for s, e in zip(st, en):
                if e - s >= run: k[i, s:e] = True
        kill |= (k if axis == 1 else k.T)
    kill = ndimage.binary_dilation(kill, iterations=1) & gray
    a = a.copy(); a[..., 3][kill] = 0
    return a
def comps(a, y0, y1, x0=0, x1=None, min_area=1500, dil=5):
    m = a[y0:y1, x0:x1, 3] > 0
    lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= 50])
    cols = ndimage.binary_dilation(m.any(0), iterations=dil)
    cl, k = ndimage.label(cols); out = []
    for sl in ndimage.find_objects(cl):
        xa, xb = sl[0].start, sl[0].stop
        sub = m[:, xa:xb]
        if sub.sum() < min_area: continue
        rows = np.nonzero(sub.any(1))[0]
        out.append([y0 + int(rows[0]), x0 + xa, y0 + int(rows[-1]) + 1, x0 + xb])
    return out
def rows_profile(a, x0=0):
    m = a[:, x0:, 3] > 0
    on = m.sum(1) > 3
    segs = []; y = 0
    while y < len(on):
        if on[y]:
            s = y
            while y < len(on) and on[y]: y += 1
            segs.append((s, y))
        y += 1
    return [(s, e) for s, e in segs if e - s > 6]
def split(a, b, n):
    y0, x0, y1, x1 = b; col = (a[y0:y1, x0:x1, 3] > 0).sum(0); w = (x1 - x0) / n; cuts = [0]
    for i in range(1, n):
        c = int(i * w); lo, hi = max(1, c - int(w * 0.3)), min(len(col) - 1, c + int(w * 0.3)); cuts.append(lo + int(np.argmin(col[lo:hi])))
    cuts.append(x1 - x0); return [[y0, x0 + cuts[i], y1, x0 + cuts[i + 1]] for i in range(n)]
def inside_panels(src, a, inset=3):
    """Deja solo lo que está dentro de los recuadros pintados (quita los bordes de los paneles y las rejillas)."""
    rgb = np.array(Image.open(src).convert('RGB')).astype(int)
    q = (rgb // 6).reshape(-1, 3); vals, cnt = np.unique(q, axis=0, return_counts=True)
    keep = np.zeros(rgb.shape[:2], bool)
    H, W = keep.shape
    for i in np.argsort(-cnt)[:3]:
        r = vals[i] * 6 + 3
        cand = np.abs(rgb - r).max(2) <= 12
        lab, n = ndimage.label(cand)
        for j, sl in enumerate(ndimage.find_objects(lab)):
            h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            if h * w > 0.4 * H * W or h < 60 or w < 60: continue
            if (lab[sl] == j + 1).sum() < 2000: continue
            keep[sl[0].start + inset:sl[0].stop - inset, sl[1].start + inset:sl[1].stop - inset] = True
    a = a.copy(); a[..., 3][~keep] = 0
    return a
