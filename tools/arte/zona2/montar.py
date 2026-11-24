import sys, json
sys.path.insert(0, '/tmp/n7'); sys.path.insert(0, '/home/claude/runas-del-abismo/tools/arte')
from util import *
from regions import R
from hoja_ia import build
OUT = '/home/claude/runas-del-abismo/public/iso/units/'
REC = '/home/claude/runas-del-abismo/tools/arte/recuadros/'

def boxes(n):
    a = load(n); res = {}
    for k, (y0, y1, x0, x1, want) in R[n].items():
        b = comps(a, y0, y1, x0, x1)
        if len(b) != want:
            ys = min(q[0] for q in b); ye = max(q[2] for q in b); xs = min(q[1] for q in b); xe = max(q[3] for q in b)
            b = split(a, [ys, xs, ye, xe], want)
        res[k] = b
    return res

B = {n: boxes(n) for n in R}
# arreglos a mano
z = B['zorro']
z['orb'] = z['orb'][:3]
z['dash'] = [z['dash'][0], z['dash'][2]]
z['charm'] = [[393, 550, 517, 712], [393, 805, 517, 975]]
# la escena del hongo: las dos últimas manchas son el mismo fotograma (dos hongos pequeños)
hd = comps(load('hongo'), 1138, 1425, 80, 2576)
B['hongo']['death'] = hd[:7] + [[min(hd[7][0], hd[8][0]), hd[7][1], max(hd[7][2], hd[8][2]), hd[8][3]]]
B['madre']['attack'] = [[85, 1730, 302, 1928], [85, 1930, 302, 2132], [85, 2134, 302, 2336], [85, 2338, 302, 2545]]
B['cazador2']['cast'] = [[818, 40, 1104, 372], [818, 372, 1104, 662], [818, 662, 1104, 952], [818, 952, 1104, 1455]]
json.dump(B, open('/tmp/n7/boxes.json', 'w'))

def h_of(n, k):
    a = load(n); return np.median([b[2] - b[0] for b in B[n][k]])

# cada personaje: hoja, animaciones (nombre en el juego ← región), alto deseado en la celda, celda
PLAN = {
 'pilar': ('pilar', {'idle': ['all']}, 100, 128),
 'zorro': ('zorro', {'idle': 'idle', 'walk': 'walk', 'attack': 'orb', 'charm': 'charm', 'dash': 'dash', 'foxfire': 'foxfire', 'illusion': 'illusion', 'vortex': 'vortex', 'tail': 'tail', 'essence': 'essence', 'hurt': 'hurt', 'death': 'death'}, 54, 128),
 'arana': ('arana', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'hurt': 'hurt', 'death': 'death'}, 44, 128),
 'chaman': ('chaman', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'cast': 'cast', 'hurt': 'hurt', 'death': 'death'}, 62, 128),
 'hongo': ('hongo', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'hurt': 'hurt', 'death': 'death'}, 54, 128),
 'pantera': ('pantera', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'cast': 'cast', 'hurt': 'hurt', 'death': 'death'}, 46, 128),
 'alfa': ('alfa', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'cast': 'cast', 'shield': 'shield', 'hurt': 'hurt', 'death': 'death'}, 72, 160),
 'reina': ('reina', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'cast': 'cast', 'poison': 'poison', 'death': 'death'}, 84, 160),
 'madre': ('madre', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'cast': 'cast', 'hurt': 'hurt', 'death': 'transform'}, 92, 192),
 'madre2': ('madre', {'idle': 'idle2', 'walk': 'walk2', 'attack': 'attack2', 'cast': 'cast2', 'hurt': 'hurt2', 'transform': 'transform', 'death': 'death2'}, 80, 192),
 'brote': ('madre', {'idle': 'b_idle', 'hurt': 'b_hurt', 'death': 'b_death'}, 64, 128),
 'cazador': ('cazador', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'bite': 'bite', 'cast': 'cast', 'hurt': 'hurt', 'death': 'death'}, 80, 160),
 'cazador2': ('cazador2', {'idle': 'idle', 'walk': 'walk', 'attack': 'attack', 'bite': 'bite', 'cast': 'cast', 'hurt': 'hurt', 'transform': None, 'death': 'death'}, 86, 192),
}
if __name__ == '__main__':
    only = sys.argv[1:]
    for name, (src, anims, target, cell) in PLAN.items():
        if only and name not in only: continue
        ref = anims['idle'] if isinstance(anims['idle'], str) else anims['idle'][0]
        k = target / h_of(src, ref)
        bx = {}
        for an, reg in anims.items():
            if reg is None: continue
            if isinstance(reg, list): bx[an] = [b for r in reg for b in B[src][r]]
            else: bx[an] = B[src][reg]
        # el pilar: un fotograma por estado (sano, dañado, muy dañado, destruido)
        if name == 'pilar':
            p = B['pilar']['all']; bx = {'idle': p[:3], 'hurt': p[1:3], 'death': p[2:4]}
        # Cazador fase 2: la transformación es la última fila de la fase 1
        json.dump(bx, open(REC + name + '.json', 'w'))
        build(f'/tmp/n7/{src}.png', OUT + name, bx, k, cell)
        print(name, 'escala %.3f' % k)
        if name == 'cazador2':
            build('/tmp/n7/cazador.png', OUT + 'cazador2', {'transform': B['cazador']['transform']}, 80 / h_of('cazador', 'idle'), 192)
            bx['transform'] = B['cazador']['transform']; json.dump(bx, open(REC + name + '.json', 'w'))
