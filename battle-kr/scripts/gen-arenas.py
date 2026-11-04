#!/usr/bin/env python3
"""배틀 배경(도트) 생성기 — 직접 그린 원본 픽셀 아트. 256x144, 앱에서 정수배로 확대해 사용.
사용법: python3 battle-kr/scripts/gen-arenas.py
"""
import math
import os
import random
from PIL import Image, ImageDraw

W, H = 256, 144
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'ui-assets')


def bands(d, y0, y1, colors):
    n = len(colors)
    for i, c in enumerate(colors):
        a = y0 + (y1 - y0) * i // n
        b = y0 + (y1 - y0) * (i + 1) // n
        d.rectangle([0, a, W, b], fill=c)


def dither_line(d, y, c1, c2):
    for x in range(0, W, 2):
        d.point((x + (y % 2), y), fill=c2)


def ellipse_platform(d, cx, cy, rx, ry, top, rim, shade):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry + 3], fill=shade)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rim)
    d.ellipse([cx - rx + 3, cy - ry + 2, cx + rx - 3, cy + ry - 2], fill=top)


def field():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 60, ['#5aa8e8', '#68b4ee', '#78c0f2', '#8ccaf4', '#a0d6f6', '#b8e2f8'])
    rnd = random.Random(3)
    for _ in range(5):  # 구름
        cx, cy = rnd.randint(0, W), rnd.randint(6, 40)
        for k in range(4):
            d.ellipse([cx + k * 9 - 12, cy - 5 + (k % 2) * 3, cx + k * 9 + 6, cy + 6], fill='#f4fbff')
        d.rectangle([cx - 12, cy + 3, cx + 36, cy + 6], fill='#dcefff')
    # 먼 산
    for i, (col, base, amp) in enumerate([('#7ab0c8', 62, 14), ('#5e9a8a', 66, 10)]):
        pts = [(0, H)]
        for x in range(0, W + 8, 8):
            pts.append((x, base - amp * abs(math.sin(x / (37 + i * 11))) - (x % 16 == 0) * 2))
        pts.append((W, H))
        d.polygon(pts, fill=col)
    # 숲 줄
    for x in range(-4, W, 7):
        h = 6 + (x * 7) % 5
        d.polygon([(x, 74), (x + 4, 74 - h), (x + 8, 74)], fill='#3f7a46')
    bands(d, 74, H, ['#79c25a', '#71ba52', '#69b24c', '#62aa46', '#5aa240', '#539a3a'])
    for y in range(74, H, 3):
        for x in range((y * 5) % 9, W, 9):
            d.point((x, y), fill='#8fd06a')
    ellipse_platform(d, 196, 82, 46, 9, '#a8d878', '#78b050', '#4f8a36')
    ellipse_platform(d, 62, 132, 62, 11, '#a8d878', '#78b050', '#4f8a36')
    return im


def tower():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#141838', '#181e44', '#1c2450', '#222a5c', '#283268', '#2e3a76'])
    # 창문 + 별
    rnd = random.Random(7)
    for wx in range(14, W, 58):
        d.rectangle([wx, 10, wx + 30, 58], fill='#0a0e26')
        d.rectangle([wx + 2, 12, wx + 28, 56], fill='#1a2a6a')
        for _ in range(8):
            d.point((wx + rnd.randint(3, 27), rnd.randint(13, 55)), fill='#e8f0ff')
        d.rectangle([wx + 14, 12, wx + 15, 56], fill='#0a0e26')
        d.rectangle([wx + 2, 33, wx + 28, 34], fill='#0a0e26')
    # 기둥
    for px in range(0, W, 58):
        d.rectangle([px - 6, 0, px + 4, 78], fill='#3a4688')
        d.rectangle([px - 6, 0, px - 4, 78], fill='#5462a8')
        d.rectangle([px + 2, 0, px + 4, 78], fill='#262e60')
    # 바닥 타일
    bands(d, 76, H, ['#4a5aa8', '#4454a0', '#3e4e98', '#384890', '#334288', '#2e3c80'])
    for y in range(78, H, 8):
        d.line([(0, y), (W, y)], fill='#56669e')
    for i in range(-12, 14):
        x0 = W // 2 + i * 22
        d.line([(W // 2 + i * 6, 76), (x0, H)], fill='#56669e')
    ellipse_platform(d, 196, 82, 46, 9, '#9aa8e8', '#6a78c0', '#3c4888')
    ellipse_platform(d, 62, 132, 62, 11, '#9aa8e8', '#6a78c0', '#3c4888')
    return im


def factory():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#25282f', '#2b2f37', '#31353e', '#383c46', '#3e434e', '#454a56'])
    # 파이프
    for y, c in [(14, '#7a6a52'), (30, '#5b6b7a')]:
        d.rectangle([0, y, W, y + 6], fill=c)
        d.rectangle([0, y, W, y + 1], fill='#b0a080' if c == '#7a6a52' else '#8aa0b4')
        for x in range(10, W, 40):
            d.rectangle([x, y - 1, x + 4, y + 7], fill='#2a2a2a')
    # 컨베이어 + 경고 줄무늬
    d.rectangle([0, 58, W, 72], fill='#2a2d33')
    for x in range(-14, W, 14):
        d.polygon([(x, 72), (x + 7, 72), (x + 14, 66), (x + 7, 66)], fill='#e0b030')
    d.rectangle([0, 64, W, 66], fill='#1c1e22')
    for x in range(20, W, 64):  # 상자
        d.rectangle([x, 44, x + 18, 58], fill='#8a6a3a')
        d.rectangle([x, 44, x + 18, 45], fill='#b08a50')
        d.line([(x, 44), (x + 18, 58)], fill='#6a4e28')
    bands(d, 76, H, ['#6c7280', '#666c79', '#606672', '#5a606b', '#545a64', '#4e535d'])
    for y in range(76, H, 10):
        for x in range((y // 10 % 2) * 10, W, 20):
            d.rectangle([x, y, x + 9, y + 9], outline='#777d8a')
    ellipse_platform(d, 196, 82, 46, 9, '#b8bcc6', '#8a8f9a', '#4e535d')
    ellipse_platform(d, 62, 132, 62, 11, '#b8bcc6', '#8a8f9a', '#4e535d')
    return im


def stadium():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 30, ['#1a0c2c', '#24103a', '#2e1448'])
    # 관중석
    rnd = random.Random(11)
    for row in range(6):
        y = 30 + row * 6
        d.rectangle([0, y, W, y + 5], fill=['#4a1e5a', '#55246a', '#4a1e5a', '#55246a', '#4a1e5a', '#55246a'][row])
        for x in range((row % 2) * 2, W, 4):
            d.rectangle([x, y + 1, x + 1, y + 3], fill=rnd.choice(['#e86a8a', '#f2c25a', '#7ac0f0', '#c8a0f0', '#f0f0f0', '#5a2a6a']))
    # 조명
    for lx in [30, 128, 226]:
        d.polygon([(lx - 4, 0), (lx + 4, 0), (lx + 26, 66), (lx - 26, 66)], fill=None)
        d.rectangle([lx - 6, 2, lx + 6, 7], fill='#fff4c0')
    d.rectangle([0, 66, W, 76], fill='#2a0c34')
    for x in range(0, W, 32):
        d.rectangle([x + 4, 68, x + 26, 73], fill='#e86a8a' if (x // 32) % 2 else '#f2c25a')
    bands(d, 76, H, ['#b04a7a', '#a84474', '#a03e6e', '#983868', '#903262', '#882c5c'])
    d.ellipse([60, 88, 196, 140], outline='#e8a0c0')
    d.line([(0, 110), (W, 110)], fill='#c86a98')
    ellipse_platform(d, 196, 82, 46, 9, '#f0b8d4', '#d080a8', '#80305a')
    ellipse_platform(d, 62, 132, 62, 11, '#f0b8d4', '#d080a8', '#80305a')
    return im


def champion():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    bands(d, 0, 76, ['#2a0606', '#360a0a', '#420e0e', '#501414', '#5e1a1a', '#6c2020'])
    # 휘장과 금 장식
    for x in range(0, W, 32):
        d.polygon([(x, 0), (x + 32, 0), (x + 26, 50), (x + 16, 56), (x + 6, 50)], fill='#8a1c1c')
        d.line([(x + 16, 0), (x + 16, 54)], fill='#6a1010')
        d.rectangle([x + 13, 44, x + 19, 50], fill='#f0c040')
    d.rectangle([0, 0, W, 4], fill='#f0c040')
    d.rectangle([0, 4, W, 5], fill='#a07018')
    bands(d, 76, H, ['#c8902e', '#c08828', '#b88022', '#ae781e', '#a4701a', '#9a6816'])
    for y in range(78, H, 6):
        dither_line(d, y, None, '#d8a840')
    d.rectangle([W // 2 - 40, 76, W // 2 + 40, H], fill='#8a1c1c')
    d.rectangle([W // 2 - 40, 76, W // 2 - 38, H], fill='#f0c040')
    d.rectangle([W // 2 + 38, 76, W // 2 + 40, H], fill='#f0c040')
    ellipse_platform(d, 196, 82, 46, 9, '#f8dc90', '#d8a848', '#7a4e10')
    ellipse_platform(d, 62, 132, 62, 11, '#f8dc90', '#d8a848', '#7a4e10')
    return im


def title():
    im = Image.new('RGB', (W, H * 2))
    d = ImageDraw.Draw(im)
    bands(d, 0, H * 2, ['#0c0a1e', '#120f2a', '#181436', '#1e1a42', '#26204e', '#2e265a', '#3a2c62', '#4a3268'])
    rnd = random.Random(5)
    for _ in range(90):
        x, y = rnd.randint(0, W), rnd.randint(0, H)
        d.point((x, y), fill=rnd.choice(['#ffffff', '#c8d0ff', '#ffe8a0']))
    pts = [(0, H * 2)]
    for x in range(0, W + 6, 6):
        pts.append((x, int(H * 1.45 - 26 * abs(math.sin(x / 41)) - 10 * abs(math.sin(x / 13)))))
    pts.append((W, H * 2))
    d.polygon(pts, fill='#1a1430')
    # 탑 실루엣
    d.rectangle([W // 2 - 14, 70, W // 2 + 14, H * 2], fill='#100c22')
    d.polygon([(W // 2 - 18, 70), (W // 2, 44), (W // 2 + 18, 70)], fill='#100c22')
    for y in range(80, H * 2, 12):
        d.rectangle([W // 2 - 3, y, W // 2 + 2, y + 4], fill='#f0c050')
    return im


def extend_top(im, extra):
    w, h = im.size
    out = Image.new('RGB', (w, h + extra))
    out.paste(im, (0, extra))
    d = ImageDraw.Draw(out)
    top = im.getpixel((w // 2, 0))
    for y in range(extra):
        k = 0.55 + 0.45 * (y // 6 * 6) / extra  # 6px 단위 계단식 그라데이션
        d.line([(0, y), (w, y)], fill=tuple(int(c * k) for c in top))
    rnd = random.Random(1)
    if sum(top) < 200:  # 어두운 배경엔 별
        for _ in range(25):
            d.point((rnd.randint(0, w - 1), rnd.randint(0, extra - 1)), fill='#c8d0ff')
    return out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('field', field), ('tower', tower), ('factory', factory), ('pwt', stadium), ('champion', champion), ('title', title)]:
        im = fn()
        if name != 'title':
            im = extend_top(im, 48)  # 4:3 (256x192) — 세로 화면용으로 위쪽 하늘/벽을 늘림
        im.save(os.path.join(OUT, f'arena_{name}.png'), optimize=True)
        print('arena_' + name)
