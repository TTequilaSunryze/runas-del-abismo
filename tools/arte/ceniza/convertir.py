# Zona 3 (ceniza): suelo repetible, grietas de lava y ciudadelas en ruinas del borde, a partir de las imágenes IA del creador.
import numpy as np
from PIL import Image
from scipy import ndimage
U = '/mnt/user-data/uploads/'
OUT = '/home/claude/runas-del-abismo/public/iso/ash/'
def unmagenta(path):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # fondo magenta y lo que se tiñó de él (humo violeta, bordes)
    bg = ((r - g) > 70) & ((b - g) > 70)
    lab, n = ndimage.label(~bg); sz = ndimage.sum(~bg, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 400])
    alpha = np.where(keep, 255, 0).astype(np.uint8)
    im = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]))
    return im.crop(im.getbbox())
def pixel(im, w, colors=48):
    h = round(im.height * w / im.width)
    s = im.resize((w, h), Image.LANCZOS); a = np.array(s)
    rgb = Image.fromarray(a[..., :3]).quantize(colors, method=Image.MEDIANCUT).convert('RGB')
    return Image.fromarray(np.dstack([np.array(rgb), np.where(a[..., 3] > 120, 255, 0).astype(np.uint8)]))
def dim(im, k=0.85):
    a = np.array(im).astype(float); a[..., :3] *= k; return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
# suelo: la textura ya repite; se reduce a 256 (cubre 4×4 casillas) y se oscurece un poco
g = Image.open(U + '8af39003-image.png').convert('RGB').resize((256, 256), Image.LANCZOS).quantize(40).convert('RGBA')
dim(g, 0.8).save(OUT + 'ground.png')
# grieta de lava en tres tamaños (y volteada al dibujarla)
crack = unmagenta(U + '7f8825e6-image.jpg')
for i, w in enumerate([210, 160, 120]): pixel(crack, w).save(OUT + f'crack{i}.png')
# ciudadelas del borde
for i, f in enumerate(['858cee24', 'b164ee64']):
    c = unmagenta(U + f + '-image.jpg')
    for j, w in enumerate([300, 240]): dim(pixel(c, w), 0.72).save(OUT + f'wall{i}{j}.png')
print('ok')
# obstáculos propios (el resto salen de «Pixel Worlds»)
anvil = unmagenta(U + 'b213b309-image.jpg')
dim(pixel(anvil, 92), 0.85).save(OUT + 'prop_anvil.png')
