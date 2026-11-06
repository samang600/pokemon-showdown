#!/usr/bin/env python3
"""3세대(GBA) 분위기의 새 배틀 곡 3곡 — 이 앱용으로 새로 쓴 선율·코드 진행. 칩튠 시퀀서 형식으로 바로 출력.
  g3battle   트레이너 배틀 (D단조 156): i-VI-VII-V 진행, 옥타브 8분 베이스, 반음계 상승 인트로
  g3gym      관장전 (C단조 168): 영웅적인 단조, B 구간 끝에 나폴리 화음(Db)
  g3frontier 배틀 프런티어풍 (F장조 160): 금관 팡파르 느낌의 장조, 믹솔리디안 Bb·C7
형식: 인트로 → A(8마디) → B(8마디) → A 로 반복 (intro 칸부터)
출력: <앱>/src/gen/chip-gen3.json (chip-tracks.json 과 같은 형식: 16분음표 한 칸에 한 글자, ' ' 쉼, '!' 지속, 그 밖 chr(MIDI+14))
사용: python3 gen3.py [출력 경로]"""
import os, sys, json

PC = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}

def midi(tok):
    """'c#5' / 'bb4' / 'e6' → MIDI"""
    n = PC[tok[0]]; i = 1
    while i < len(tok) and tok[i] in '#b' and not tok[i:].isdigit():
        n += 1 if tok[i] == '#' else -1; i += 1
    return n + 12 * (int(tok[i:]) + 1)

def melody(text):
    """'d5.2 f5.2 r.4' → 칸 배열 (음, -1 지속, None 쉼)"""
    out = []
    for t in text.split():
        p, ln = t.split('.'); ln = int(ln)
        if p == 'r': out += [None] * ln
        else: out += [midi(p)] + [-1] * (ln - 1)
    return out

def chord(name):
    """'Dm' 'Bb' 'A7' 'Gm7' 'C7' → (근음 음이름 번호, 구성음 반음 간격들)"""
    root = PC[name[0].lower()]; i = 1
    if i < len(name) and name[i] in '#b': root += 1 if name[i] == '#' else -1; i += 1
    q = name[i:]
    if q == 'm': iv = [0, 3, 7]
    elif q == 'm7': iv = [0, 3, 7, 10]
    elif q == '7': iv = [0, 4, 7, 10]
    else: iv = [0, 4, 7]
    return root % 12, iv

def bass_bar(name, style):
    r, iv = chord(name); lo = 33 + (r - 9) % 12   # A1(33) ~ G#2(44)
    if style == 'oct8':      # 8분 옥타브 왕복 (3세대 배틀 베이스)
        seq = [lo, -1, lo + 12, -1] * 4
    elif style == 'drive':   # 16분 근음 연타 + 박마다 5도
        seq = []
        for b in range(4): seq += [lo, lo, lo + 12 if b % 2 else lo + iv[2], lo]
    else:                    # 'walk': 근음·5도·옥타브·5도
        seq = [lo, -1, lo + iv[2], -1, lo + 12, -1, lo + iv[2], -1] * 2
    return seq

def harm_bar(name):
    """화음 채널: 반 마디씩 3음 → 5음 (4옥타브)"""
    r, iv = chord(name); base = 60 + (r - 0) % 12
    if base > 66: base -= 12
    return [base + iv[1]] + [-1] * 7 + [base + iv[2]] + [-1] * 7

def arp_bar(name, on=True):
    if not on: return [None] * 16
    r, iv = chord(name); base = 72 + r % 12
    if base > 78: base -= 12
    pat = [base + iv[0], base + iv[1], base + iv[2], base + 12]
    return [pat[i % 4] for i in range(16)]

def song(bpm, lead_type, sections, bass_style, drums_main, drums_b, drums_intro):
    lead, harm, bass, arp, drums = [], [], [], [], ''
    intro_len = 0
    for kind, chords, mel in sections:
        m = melody(mel)
        assert len(m) == 16 * len(chords), (kind, len(m), len(chords))
        lead += m
        for ch in chords:
            harm += harm_bar(ch)
            bass += bass_bar(ch, 'drive' if kind == 'intro' else bass_style)
            arp += arp_bar(ch, kind == 'B')
            drums += drums_intro if kind == 'intro' else drums_b if kind == 'B' else drums_main
        if kind == 'intro': intro_len = len(lead)
    enc = lambda a: ''.join(' ' if x is None else '!' if x == -1 else chr(x + 14) for x in a)
    return {'bpm': bpm, 'intro': intro_len, 'leadType': lead_type, 'lead': enc(lead), 'harm': enc(harm), 'bass': enc(bass), 'arp': enc(arp), 'drums': drums}

SONGS = {
    'g3battle': song(156, 'pulse25', [
        ('intro', ['A', 'A'],
         'a4.1 bb4.1 b4.1 c5.1 c#5.1 d5.1 d#5.1 e5.1 f5.1 f#5.1 g5.1 g#5.1 a5.4  a5.2 r.2 a5.2 r.2 a5.2 r.2 a5.4'),
        ('A', ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'],
         'd5.2 f5.2 a5.4 g5.2 f5.2 e5.2 f5.2  d5.4 bb4.2 c5.2 d5.6 f5.2  e5.2 g5.2 c6.4 bb5.2 a5.2 g5.2 e5.2  a5.8 c#5.4 e5.4 '
         'f5.2 a5.2 d6.4 c6.2 a5.2 f5.2 a5.2  bb5.4 a5.2 g5.2 f5.4 d5.4  g5.2 e5.2 c5.2 e5.2 g5.4 bb5.4  a5.12 r.4'),
        ('B', ['Gm', 'Dm', 'Bb', 'C', 'Gm', 'A', 'Dm', 'A7'],
         'g5.6 a5.2 bb5.4 a5.4  f5.6 e5.2 d5.8  d5.2 f5.2 bb5.6 a5.2 g5.4  e5.2 g5.2 c6.6 bb5.2 a5.2 g5.2 '
         'bb5.4 a5.4 g5.4 f5.4  e5.4 c#5.4 e5.4 a5.4  d6.6 c6.2 a5.4 f5.4  e5.2 g5.2 a5.2 c#6.2 e6.8'),
    ], 'oct8', 'k.h.s.h.k.hks.h.', 'k.hhs.hhk.hhs.hs', 's...s...s...s.ss'),
    'g3gym': song(168, 'pulse25', [
        ('intro', ['Cm', 'Cm', 'Ab', 'G'],
         'c5.2 r.2 c5.2 r.2 c5.2 r.2 eb5.2 r.2  c5.2 r.2 c5.2 r.2 c5.2 r.2 g5.2 r.2  ab4.4 bb4.4 c5.4 d5.4  g5.16'),
        ('A', ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'F', 'G'],
         'c5.4 eb5.2 g5.2 c6.4 bb5.2 g5.2  ab5.6 g5.2 f5.4 eb5.4  d5.2 f5.2 bb5.4 ab5.2 g5.2 f5.2 d5.2  g5.8 b4.4 d5.4 '
         'eb5.2 g5.2 c6.4 d6.2 eb6.2 d6.2 c6.2  c6.4 ab5.4 eb5.4 c5.4  f5.2 ab5.2 c6.6 bb5.2 ab5.4  g5.12 r.4'),
        ('B', ['Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Bb', 'Db', 'G'],
         'eb6.6 c6.2 ab5.8  d6.6 bb5.2 f5.8  g5.4 bb5.4 d6.4 bb5.4  c6.8 g5.8 '
         'ab5.2 c6.2 eb6.4 db6.2 c6.2 bb5.4  bb5.2 d6.2 f6.4 eb6.2 d6.2 c6.4  db6.4 ab5.4 f5.4 db5.4  d5.2 g5.2 b5.2 d6.2 g6.8'),
    ], 'drive', 'k.hks.hkk.hks.hs', 'k.hhs.hkk.hhs.ss', 's.s.s.s.s.s.ssss'),
    'g3frontier': song(160, 'pulse25', [
        ('intro', ['C', 'C'],
         'c5.2 c5.2 c5.2 g5.4 e5.2 g5.4  c6.12 r.4'),
        ('A', ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
         'a5.4 c6.4 f5.4 a5.4  g5.6 e5.2 c5.8  d5.2 f5.2 a5.4 g5.2 f5.2 e5.4  f5.8 d5.4 bb4.4 '
         'c6.4 a5.2 c6.2 f6.4 e6.4  d6.2 c6.2 bb5.4 g5.4 e5.4  f5.2 g5.2 a5.2 bb5.2 d6.8  c6.12 r.4'),
        ('B', ['Gm', 'C', 'Am', 'Dm', 'Bb', 'C', 'Gm7', 'C7'],
         'bb5.6 a5.2 g5.8  e5.4 g5.4 c6.8  c6.6 b5.2 a5.8  f5.4 a5.4 d6.8 '
         'd6.2 c6.2 bb5.4 a5.2 g5.2 f5.4  e5.2 f5.2 g5.4 a5.2 bb5.2 c6.4  d6.4 bb5.4 g5.4 bb5.4  c6.4 e6.4 g6.8'),
    ], 'walk', 'k.h.s.h.k.h.s.hs', 'k.h.s.hkk.h.s.ss', 'k...k...k...s.ss'),
}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../src/gen/chip-gen3.json')
    for k, v in SONGS.items():
        n = len(v['lead']); assert all(len(v[c]) == n for c in ('harm', 'bass', 'arp', 'drums')), k
        print(k, f"{v['bpm']}bpm", f"{n // 16}마디", f"{n * 60 / v['bpm'] / 4:.0f}초", 'intro', v['intro'])
    json.dump(SONGS, open(out, 'w'), ensure_ascii=False)
    print('→', out)
