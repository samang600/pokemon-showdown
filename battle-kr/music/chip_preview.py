#!/usr/bin/env python3
"""chip-tracks.json 을 앱의 startSynth 와 같은 방식(파형·음량·엔벨로프·드럼)으로 렌더해 미리듣기 mp3 를 만든다.
사용: python3 chip_preview.py chip-tracks.json 출력폴더 [곡 ...]"""
import sys, os, json, subprocess, numpy as np

SR = 44100
rng = np.random.default_rng(1)

def osc(kind, f, n):
    ph = (np.arange(n) * f / SR) % 1.0
    if kind == 'square': return np.where(ph < 0.5, 1.0, -1.0)
    if kind == 'triangle': return 4 * np.abs(ph - 0.5) - 1
    if kind == 'sawtooth': return 2 * ph - 1
    return np.sin(2 * np.pi * ph)

def env(n, v):
    t = np.arange(n) / SR; dur = n / SR
    a = np.minimum(t / 0.008, 1.0)
    up = 0.0001 * (v / 0.0001) ** a
    k = np.clip((t - 0.008) / max(1e-4, dur - 0.008), 0, 1)
    down = v * (0.0001 / v) ** k
    return np.where(t < 0.008, up, down)

def add(buf, at, sig):
    i = int(at * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i]

def tone(buf, at, f, dur, kind, vol, slide=None):
    n = int(dur * SR)
    if slide:
        fr = f * (slide / f) ** (np.arange(n) / n); ph = np.cumsum(fr / SR) % 1.0
        sig = np.sin(2 * np.pi * ph)
    else: sig = osc(kind, f, n)
    add(buf, at, sig * env(n, vol))

def noise(buf, at, dur, cutoff, vol):
    n = int(dur * SR); x = rng.uniform(-1, 1, n)
    a = np.exp(-2 * np.pi * cutoff / SR)   # 1차 고역 통과
    y = np.empty(n); prev_x = prev_y = 0.0
    for i in range(n):
        prev_y = a * (prev_y + x[i] - prev_x); prev_x = x[i]; y[i] = prev_y
    t = np.arange(n) / n
    add(buf, at, y * vol * (0.0001 / vol) ** t)

N = lambda m: 440 * 2 ** ((m - 69) / 12)
dec = lambda s: [None if c == ' ' else -1 if c == '!' else ord(c) - 14 for c in s]

def render(tr):
    sd = 60 / tr['bpm'] / 4
    ch = {k: dec(tr[k]) for k in ('lead', 'harm', 'bass', 'arp')}
    L = len(ch['lead']); buf = np.zeros(int((L * sd + 1) * SR))
    def ln(a, i):
        n = 1
        while i + n < len(a) and a[i + n] == -1 and n < 16: n += 1
        return n
    for i in range(L):
        at = i * sd
        x = ch['lead'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * ln(ch['lead'], i) * 0.9, tr['leadType'], 0.13)
        x = ch['harm'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * ln(ch['harm'], i) * 0.95, 'triangle', 0.08)
        x = ch['bass'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * 0.9, 'triangle', 0.3)
        x = ch['arp'][i]
        if x not in (None, -1): tone(buf, at, N(x), sd * 0.5, 'square', 0.045)
        d = tr['drums'][i]
        if d == 'k': tone(buf, at, 150, 0.1, 'sine', 0.5, slide=40)
        elif d == 's': noise(buf, at, 0.09, 1500, 0.22)
        elif d == 'h': noise(buf, at, 0.03, 7000, 0.1)
    return buf * 0.22 * 2.2   # 앱 음악 버스(보통) 0.22, 미리듣기용으로 키움

if __name__ == '__main__':
    tracks = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    for name in sys.argv[3:] or tracks:
        y = render(tracks[name]); pk = np.abs(y).max(); y = y * min(1.0, 0.89 / pk)
        raw = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
        mp3 = os.path.join(out, f'chip-{name}.mp3')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '44100', '-b:a', '96k', mp3], input=raw, check=True)
        print(name, f'{len(y) / SR:.1f}s peak {pk:.2f}', mp3, flush=True)
