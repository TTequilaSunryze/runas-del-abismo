"""
Pasa a pixel art un personaje renderizado en 3D (hojas por dirección, p. ej. «Idle_Body_180.png»)
y lo convierte en hojas de 8 direcciones para el juego (filas S, SE, E, NE, N, NW, W, SW).

  python3 pixelar_hoja.py CARPETA_x320p SALIDA_PREFIJO [escala] [idle=Idle,walk=Walk,attack=Attack,hurt=Hit,death=Death] [paso]

Pasos por fotograma: quita la sombra pintada (gris poco saturado y semitransparente), sube contraste y color,
reduce con LANCZOS a la escala, alfa duro, paleta común de 22 colores sin tramado y contorno oscuro de 1 píxel.
El juego lo dibuja a 2× sin suavizado. Ángulos del modelo: 180 = de frente (S), 0 = de espaldas (N), 90 = derecha (E).
"""
import sys
from PIL import Image, ImageEnhance
import numpy as np

S = 320
DIRS = ['180', '135', '090', '045', '000', '315', '270', '225']
ANIMS = {'idle': ('Idle', 2), 'walk': ('Walk', 2), 'attack': ('Attack_Swipe', 2), 'hurt': ('Hit', 2), 'death': ('Death', 2)}


def clean(f):
    a = np.array(f).astype(int)
    sat = a[..., :3].max(2) - a[..., :3].min(2)
    a[..., 3] = np.where((sat < 28) & (a[..., 3] < 250), 0, a[..., 3])
    return Image.fromarray(a.astype(np.uint8))


def pixelize(f, scale, colors=22, pal=None):
    f = ImageEnhance.Color(ImageEnhance.Contrast(clean(f)).enhance(1.25)).enhance(1.1)
    small = f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS)
    a = np.array(small)
    a[..., 3] = np.where(a[..., 3] > 140, 255, 0)
    if pal is None:
        pal = Image.fromarray(a[..., :3]).quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    a[..., :3] = np.array(Image.fromarray(a[..., :3]).quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
    m = a[..., 3] > 0
    pad, o = np.pad(m, 1), np.zeros_like(m)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o |= pad[1 + dy:1 + dy + m.shape[0], 1 + dx:1 + dx + m.shape[1]]
    a[o & ~m] = [22, 8, 10, 255]
    return Image.fromarray(a), pal


def foot_of(f):
    """Punto de apoyo: centro de la sombra pintada (lo que clean() quita); si no hay, el pie del cuerpo."""
    a = np.array(f).astype(int)
    sat = a[..., :3].max(2) - a[..., :3].min(2)
    ys, xs = np.nonzero((sat < 28) & (a[..., 3] < 250) & (a[..., 3] > 20))
    if len(ys) > 200:
        return float(xs.mean()), float(ys.mean())
    bb = clean(f).getbbox()
    return (bb[0] + bb[2]) / 2, bb[3] - 4


def frames(src, folder, ang):
    sh = Image.open(f'{src}/{folder}/{folder}_Body_{ang}.png')
    return [f for r in range(sh.height // S) for c in range(sh.width // S) for f in [sh.crop((c * S, r * S, (c + 1) * S, (r + 1) * S))] if f.getbbox()]


def main(src, out, k=0.5, anims=None, step=2):
    anims = {n: (fo, step) for n, fo in anims.items()} if anims else ANIMS
    c = round(S * k)
    mont = Image.new('RGBA', (S * 4, S))
    for i, (name, ang) in enumerate([('idle', '180'), ('walk', '090'), ('attack', '180'), ('death', '225')]):
        fr = frames(src, anims[name][0], ang)
        mont.alpha_composite(fr[min(3, len(fr) - 1)], (i * S, 0))
    _, pal = pixelize(mont, k)
    fx, fy = foot_of(frames(src, anims['idle'][0], '180')[0])
    counts = {}
    for name, (fo, step) in anims.items():
        rows = [frames(src, fo, ang)[::step] for ang in DIRS]
        n = counts[name] = min(len(r) for r in rows)
        sheet = Image.new('RGBA', (c * n, c * 8))
        for d, fr in enumerate(rows):
            for i, f in enumerate(fr[:n]):
                sheet.alpha_composite(pixelize(f, k, pal=pal)[0], (i * c, d * c))
        sheet.save(f'{out}_{name}.png', optimize=True)
    print('celda', c, 'pie', (round(fx * k), round(fy * k)), 'fotogramas', counts)


if __name__ == '__main__':
    a = sys.argv
    anims = dict(kv.split('=') for kv in a[4].split(',')) if len(a) > 4 else None
    main(a[1], a[2], float(a[3]) if len(a) > 3 else 0.5, anims, int(a[5]) if len(a) > 5 else 2)
