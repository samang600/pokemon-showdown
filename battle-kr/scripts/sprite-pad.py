#!/usr/bin/env python3
"""public/sprites/gen5*/ 정지 그림의 아래 투명 여백을 재서 src/gen/sprite-pad.json 에 저장 ([앞, 뒤] px). fetch-sprites.sh 가 호출."""
import os, json, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
base = os.path.join(here, '../public/sprites')
out = {}
def pad(path):
    im = Image.open(path).convert('RGBA'); w, h = im.size; px = im.load()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            if px[x, y][3] > 20: return h - 1 - y
    return 0
for d, idx in (('gen5', 0), ('gen5-back', 1)):
    p = os.path.join(base, d)
    if not os.path.isdir(p): continue
    for f in os.listdir(p):
        if f.endswith('.png'):
            out.setdefault(f[:-4], [0, 0])[idx] = pad(os.path.join(p, f))
json.dump(out, open(os.path.join(here, '../src/gen/sprite-pad.json'), 'w'), separators=(',', ':'))
print('sprite-pad.json:', len(out))
