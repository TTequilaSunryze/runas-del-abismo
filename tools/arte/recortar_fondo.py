import sys
from PIL import Image
from collections import deque
src, dst, tol = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB'); W, H = im.size; px = im.load()
out = Image.new('RGBA', (W, H)); op = out.load()
bgs = [px[0,0], px[W-1,0], px[0,H-1], px[W-1,H-1], px[W//2,2]]
def isbg(c): return (max(c)-min(c) < 8 and min(c) > 55) or any(sum(abs(a-b) for a,b in zip(c,g)) < tol for g in bgs)
seen = bytearray(W*H); q = deque()
for x in range(W): q.append((x,0)); q.append((x,H-1))
for y in range(H): q.append((0,y)); q.append((W-1,y))
while q:
    x,y = q.popleft(); i=y*W+x
    if seen[i]: continue
    if not isbg(px[x,y]): continue
    seen[i]=1
    for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
        if 0<=nx<W and 0<=ny<H and not seen[ny*W+nx]: q.append((nx,ny))
for y in range(H):
    for x in range(W):
        r,g,b = px[x,y]; op[x,y] = (r,g,b,0 if seen[y*W+x] else 255)
bb = out.getbbox(); out = out.crop(bb); out.save(dst); print(dst, out.size)
