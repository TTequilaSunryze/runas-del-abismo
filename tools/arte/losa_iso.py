import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); A = np.array(im); a = A[:, :, 3] > 128
ys, xs = np.nonzero(a)
H, W = a.shape
# esquina izquierda: columna más a la izquierda (con margen) -> punto más alto de esa columna
def col_top(x0, side):
    cols = range(x0, x0 + 6) if side == 'l' else range(x0 - 5, x0 + 1)
    pts = [(x, np.nonzero(a[:, x])[0].min()) for x in cols if a[:, x].any()]
    x, y = min(pts, key=lambda p: p[1]); return x, y
def col_bot(x0, side):
    cols = range(x0, x0 + 6) if side == 'l' else range(x0 - 5, x0 + 1)
    return max(np.nonzero(a[:, x])[0].max() for x in cols if a[:, x].any())
L = col_top(xs.min(), 'l'); R = col_top(xs.max(), 'r')
thick = ((col_bot(xs.min(), 'l') - L[1]) + (col_bot(xs.max(), 'r') - R[1])) / 2
T = (xs[ys.argmin()], ys.min())
# esquina de abajo de la cara superior: el punto más bajo menos el grosor
bx = xs[ys.argmax()]; B = (bx, ys.max() - thick)
print('L', L, 'T', T, 'R', R, 'B', B, 'grosor', round(thick))
# transformación de perspectiva: rombo 256x128 <- cuadrilátero de la cara superior
dstp = [(0, 64), (128, 0), (256, 64), (128, 128)]; srcp = [L, T, R, B]
M = []; v = []
for (x, y), (u, w) in zip(dstp, srcp):
    M.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); v.append(u)
    M.append([0, 0, 0, x, y, 1, -w * x, -w * y]); v.append(w)
coef = np.linalg.solve(np.array(M, float), np.array(v, float))
S = 4  # se trabaja al cuádruple y luego se reduce, para que quede nítido
big = im.transform((256 * S, 128 * S), Image.PERSPECTIVE, list(np.linalg.solve(np.array(M, float), np.array(v, float)) * 1), Image.BICUBIC) if False else None
# recalcular con escala S
M = []; v = []
for (x, y), (u, w) in zip([(px * S, py * S) for px, py in dstp], srcp):
    M.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); v.append(u)
    M.append([0, 0, 0, x, y, 1, -w * x, -w * y]); v.append(w)
coef = np.linalg.solve(np.array(M, float), np.array(v, float))
big = im.transform((256 * S, 128 * S), Image.PERSPECTIVE, list(coef), Image.BICUBIC)
out = big.resize((256, 128), Image.LANCZOS)
# luz uniforme: se quita el degradado de cada canal (desenfoque con máscara, sin el negro de fuera) y se lleva a un gris piedra común
yy, xx = np.mgrid[0:128, 0:256]
mk = ((np.abs(xx - 127.5) / 128 + np.abs(yy - 63.5) / 64) <= 1.0).astype(float)
rgb = np.array(out.convert('RGB'), float) * mk[..., None]
def box(arr, r, axis):
    c = np.cumsum(np.pad(arr, [(r + 1, r) if k == axis else (0, 0) for k in range(2)], mode='edge'), axis=axis)
    return (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
def blur(arr):
    for _ in range(3): arr = box(box(arr, 18, 0), 18, 1)
    return arr
m = blur(mk) + 1e-3
low = np.dstack([blur(rgb[..., k]) / m for k in range(3)]) + 1
flat = rgb / low
target = np.array([84, 80, 90], float)  # piedra oscura con un toque violeta, como el suelo actual
res = np.clip(flat * target, 0, 255).astype(np.uint8)
# máscara del rombo exacto
yy, xx = np.mgrid[0:128, 0:256]
mask = (np.abs(xx - 127.5) / 128 + np.abs(yy - 63.5) / 64) <= 1.0
alpha = (mask * 255).astype(np.uint8)
Image.fromarray(np.dstack([res, alpha])).save(dst)
print(dst)
