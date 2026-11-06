#!/usr/bin/env python3
"""도트 계단식 둥근 테두리: 9분할 테두리 그림(SVG)과 같은 모양의 clip-path 를 만들어 CSS 로 출력.
테두리 = 진한 외곽선 1픽셀 + 안쪽 테두리 1픽셀, 모서리는 픽셀 계단(반지름 r)."""
import sys, urllib.parse

def profile(r):
    # 위에서부터 줄마다 왼쪽에서 비우는 픽셀 수 (원에 가까운 계단)
    return {6: [6, 4, 3, 2, 1, 1], 4: [4, 2, 1, 1], 3: [3, 1, 1], 2: [2, 1]}[r]

def ring_svg(r, outer, inner, K):
    n = 2 * K + 1
    prof = profile(r)
    def inside(x, y):
        if not (0 <= x < n and 0 <= y < n): return False
        dx = min(x, n - 1 - x); dy = min(y, n - 1 - y)
        return not (dy < len(prof) and dx < prof[dy])
    cells = [(x, y) for y in range(n) for x in range(n) if inside(x, y)]
    # 외곽선: 바깥과 맞닿은 칸 (상하좌우) / 안쪽 테두리: 외곽선과 맞닿은 칸 (대각선 포함)
    outl = {(x, y) for x, y in cells if any(not inside(a, b) for a, b in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])}
    inn = {(x, y) for x, y in cells if (x, y) not in outl and any((a, b) in outl for a, b in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])}
    rects = [f'<rect x="{x}" y="{y}" width="1" height="1" fill="{outer}"/>' for x, y in sorted(outl)]
    rects += [f'<rect x="{x}" y="{y}" width="1" height="1" fill="{inner}"/>' for x, y in sorted(inn)]
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {n} {n}' width='{n}' height='{n}' shape-rendering='crispEdges'>{''.join(rects)}</svg>".replace('"', "'")
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe=":/=' ,<>-.") + '")'

def clip(r, P):
    """바깥 모양(외곽선의 바깥 가장자리)을 따라가는 다각형"""
    prof = profile(r); L = len(prof)
    # 왼쪽 위 모서리 점들 (왼쪽 변에서 시작해 위 변까지, 시계 방향)
    tl = [(0, L)]
    for k in reversed(range(L)):
        tl += [(prof[k], k + 1), (prof[k], k)]
    def pt(dx, dy, right, bottom):
        X = f'calc(100% - {dx * P}px)' if right else f'{dx * P}px'
        Y = f'calc(100% - {dy * P}px)' if bottom else f'{dy * P}px'
        return f'{X} {Y}'
    out = [pt(dx, dy, False, False) for dx, dy in tl]                    # 왼쪽 위
    out += [pt(dx, dy, True, False) for dx, dy in reversed(tl)]           # 오른쪽 위
    out += [pt(dx, dy, True, True) for dx, dy in tl]                      # 오른쪽 아래
    out += [pt(dx, dy, False, True) for dx, dy in reversed(tl)]           # 왼쪽 아래
    return 'polygon(' + ', '.join(out) + ')'

P = 2  # 도트 한 칸 = 2px
css = []
css.append('/* ═════ 도트 계단식 둥근 테두리 (scripts/pixring.py 로 생성): 진한 외곽선 1칸 + 흰 테두리 1칸, 모서리는 픽셀 계단 ═════ */')
rings = {
    'w': ('#0a0f18', '#ffffff'), 'f': ('#3a0804', '#ffffff'), 'sw': ('#0a0f18', '#d8ecdc'), 'sb': ('#0a0f18', '#d8e8fc'),
    't': ('#0a0f18', '#e8e8f0'), 'ty': ('#3a4a08', '#f8ff70'), 'tb': ('#08203a', '#f8ff70'), 'i': ('#0a0d12', '#f4f6fa'),
}
K4, K2 = 7, 3
css.append(':root {')
for k, (o, i) in rings.items():
    css.append(f'\t--ring-{k}: {ring_svg(6, o, i, K4)};')
css.append(f'\t--ring-s: {ring_svg(2, "#000000", "#9aa6bc", K2)};')
css.append(f'\t--ring-i2: {ring_svg(2, "#0a0d12", "#f4f6fa", K2)};')
css.append(f'\t--clip4: {clip(6, P)};')
css.append(f'\t--clip2: {clip(2, P)};')
css.append('}')
print('\n'.join(css))
