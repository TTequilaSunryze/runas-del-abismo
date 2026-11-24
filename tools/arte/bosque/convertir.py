# Convierte el pack «Forest» de Rafael Sewa (paleta Vanilla) al estilo del juego: pixelado, oscuro y a 2:1.
import glob, os, json
import numpy as np
from PIL import Image
V = '/tmp/forest/x/AssetPack01_Forest_Sample/02_Vanilla/'
OUT = '/home/claude/runas-del-abismo/public/iso/forest/'
def src(name):
    f = [p for p in glob.glob(V + '*') if os.path.basename(p).split('_', 1)[1].rsplit('.', 1)[0].lower() == name.lower()]
    return Image.open(f[0]).convert('RGBA')
def darken(im, mul=(0.52, 0.62, 0.58), gamma=1.25, sat=0.8):
    a = np.array(im).astype(float)
    rgb = a[..., :3] / 255
    g = rgb.mean(2, keepdims=True); rgb = g + (rgb - g) * sat
    rgb = np.clip(rgb, 0, 1) ** gamma * np.array(mul)
    a[..., :3] = np.clip(rgb * 255, 0, 255)
    return Image.fromarray(a.astype(np.uint8))
def pixel(im, w, colors=40, squash=1.0):
    """Reduce al ancho w (y aplasta la altura para pasar de isométrico verdadero a 2:1), alfa duro y pocos colores."""
    h = max(1, round(im.height * w / im.width * squash))
    s = im.resize((w, h), Image.LANCZOS)
    a = np.array(s); alpha = a[..., 3] > 110
    rgb = Image.fromarray(a[..., :3]).quantize(colors, method=Image.MEDIANCUT).convert('RGB')
    out = np.dstack([np.array(rgb), np.where(alpha, 255, 0).astype(np.uint8)])
    return Image.fromarray(out)
SQ = (64 / 128) / (156 / 270)  # de rombo 270×156 a 128×64
made = {}
def save(key, im):
    im.save(OUT + key + '.png'); made[key] = im.size

# suelo: textura cuadrada sin costuras (espejada), pixelada; se pinta en perspectiva con la transformación del suelo
g = src('ForestGround').convert('RGB').crop((600, 400, 1624, 1424)).resize((256, 256), Image.LANCZOS)
g = Image.fromarray(np.array(g)); m = Image.new('RGB', (512, 512))
m.paste(g, (0, 0)); m.paste(g.transpose(Image.FLIP_LEFT_RIGHT), (256, 0)); m.paste(g.transpose(Image.FLIP_TOP_BOTTOM), (0, 256)); m.paste(g.transpose(Image.ROTATE_180), (256, 256))
m = m.resize((256, 256), Image.LANCZOS).quantize(24).convert('RGBA')
save('ground', darken(m, (0.42, 0.44, 0.36), 1.35, 0.7))
# manchas de hierba, musgo y hojas (sobre el suelo, aplastadas a 2:1)
for name, w in [('DarkGrass2', 120), ('DarkGrass3', 110), ('DarkGrass4', 120), ('DarkGrass6', 190), ('DarkGrass7', 190), ('DarkGrass8', 220), ('DarkGrass12', 300),
                ('Moss2', 150), ('Moss3', 210), ('Moss4', 260), ('GroundLeaves2', 110), ('GroundLeaves4', 170), ('Mushroom4', 90), ('Mushroom3', 70), ('FlowerGround3', 70), ('DenseGrass2', 120)]:
    save('g_' + name.lower(), darken(pixel(src(name), w, 32, SQ), (0.3, 0.4, 0.3), 1.5, 0.6))
# obstáculos: árboles con hojas, árboles secos, tocones, rocas, troncos y helechos (de pie: sin aplastar)
OB = [('Tree33', 96), ('Tree35', 98), ('Tree37', 96), ('Tree51', 84),
      ('Tree10', 90), ('Tree13', 100), ('Stump4', 92), ('Stump4', 92), ('Stump5', 104), ('Stump6', 120), ('Rock3', 92), ('Rock5', 100), ('Rock6', 124), ('Log1', 150), ('Fern3', 96), ('TallGrass4', 124), ('Mushroom6', 64)]
for name, w in OB:
    save('o_' + name.lower(), darken(pixel(src(name), w, 40), (0.5, 0.6, 0.55), 1.3, 0.75))
# borde del bosque: árboles grandes y oscuros detrás de la sala
for name, w in [('Tree44', 230), ('Tree45', 210), ('Tree47', 220), ('Tree48', 210), ('Tree49', 220), ('Tree50', 260), ('Tree43', 220), ('Tree52', 140), ('Tree22', 170), ('Tree21', 170)]:
    save('b_' + name.lower(), darken(pixel(src(name), w, 40), (0.33, 0.42, 0.4), 1.4, 0.65))
json.dump(made, open(OUT + 'index.json', 'w'), indent=0)
print(len(made))
