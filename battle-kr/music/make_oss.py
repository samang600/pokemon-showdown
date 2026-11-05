#!/usr/bin/env python3
"""공개 음원(CC0·CC BY) 8곡을 앱용으로 변환: -16 LUFS 로 맞추고 96kbps mp3, 루프 지점 loops.json.
사용: python3 -I make_oss.py <받은 파일 폴더> <출력 폴더>"""
import json, os, re, subprocess, sys

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
Z1 = 'z1/JRPGCollection_midi_ogg_patches/ogg/'
Z2 = 'z2/JRPGCollection2_midi_ogg_patches/ogg/'
SONGS = {
    'title': [Z1 + 'JRPG_town_loop.ogg'],
    'battle': [Z1 + 'JRPG_battle_loop.ogg'],
    'tower': ['Red Doors 2.0 (GameClosure Edition)_0.mp3'],
    'boss': ['CleytonRX - Battle RPG Theme_1.mp3'],
    'champion': ['determined_pursuit_loop.wav'],
    'pwt': ['jrpg_battle_intro.mp3', 'jrpg_battle_loop.mp3'],   # 인트로 + 반복 구간
    'evil': [Z2 + 'JRPG_battleBoss_loop.ogg'],
    'victory': [Z1 + 'JRPG_winBattle.ogg'],                         # 짧은 팡파르 (반복 안 함)
}

def dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

def lufs(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])

loops = {}
for name, parts in SONGS.items():
    files = [os.path.join(SRC, p) for p in parts]
    tmp = os.path.join(OUT, f'_{name}.wav')
    if len(files) == 1:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', files[0], '-ar', '44100', '-ac', '2', tmp], check=True)
        start = 0.0
    else:
        start = dur(files[0])
        inputs = sum((['-i', f] for f in files), [])
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *inputs, '-filter_complex',
                        ''.join(f'[{i}:a]aresample=44100,aformat=channel_layouts=stereo[a{i}];' for i in range(len(files))) +
                        ''.join(f'[a{i}]' for i in range(len(files))) + f'concat=n={len(files)}:v=0:a=1[o]', '-map', '[o]', tmp], check=True)
    gain = -16.0 - lufs(tmp)
    mp3 = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:level=false',
                    '-c:a', 'libmp3lame', '-b:a', '96k', mp3], check=True)
    os.remove(tmp)
    end = dur(mp3)
    loops[name] = {'start': round(start, 4), 'end': round(end, 4)} if name != 'victory' else {'start': round(end, 4), 'end': round(end, 4)}
    print(name, f'{end:.1f}s gain {gain:+.1f}dB', loops[name], os.path.getsize(mp3) // 1024, 'KB', flush=True)
json.dump(loops, open(os.path.join(OUT, 'loops.json'), 'w'), indent=1)
