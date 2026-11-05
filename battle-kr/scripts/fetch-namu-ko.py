#!/usr/bin/env python3
"""나무위키 미러(namu.moe)에서 쇼다운·PokeAPI 에 한국어가 없는 기술·도구·특성의 공식 한국어 이름과 게임 속 설명을 모은다.
  기술: 개별 문서의 [include(틀:포켓몬 기술, 한칭=…, 효과=…)]
  특성: '포켓몬스터/특성/ㄱ'… 초성별 목록 (이름 | (일본어 / 영어) | 설명 | 첫 등장)
  도구: 개별 문서 정보 상자의 '설명'
  문서가 없는 메가스톤·Z크리스탈: 공식 문구 형식을 따라 만듦 (표시: gen)
출력: src/ps/ko-text-namu.json. 요청 사이 1초 대기. 사용: python3 scripts/fetch-namu-ko.py"""
import html, json, os, re, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEX = os.path.join(HERE, '../src/gen/dex.json')
FB = os.path.join(HERE, '../src/ps/ko-text-fallback.json')
OUT = os.path.join(HERE, '../src/ps/ko-text-namu.json')
HANG = re.compile('[가-힣]')
UA = {'User-Agent': 'battle-kr build script (Korean names/descriptions, 1 req/s)'}

def to_id(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

def page(title, raw=False):
    u = 'https://namu.moe/w/' + urllib.parse.quote(title)
    time.sleep(1.0)
    try:
        t = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read().decode('utf-8')
    except urllib.error.HTTPError:
        return None
    if raw: return t
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' | ', t)))

def clean(s):
    s = re.sub(r'\s*\|\s*', ' ', s); s = re.sub(r'\[\d+\]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def usable(d):
    return bool(d) and bool(HANG.search(d)) and '사용할 수 없' not in d

dex = json.load(open(DEX)); fb = json.load(open(FB))
need = {}
for cat in ('moves', 'items', 'abilities'):
    need[cat] = []
    for k, v in dex[cat].items():
        if cat == 'moves' and (v.get('z') or v.get('x')): continue
        has_d = usable(v.get('d', '')) or usable(fb[cat].get(k, {}).get('d', ''))
        has_n = bool(HANG.search(v.get('n', ''))) or bool(HANG.search(fb[cat].get(k, {}).get('n', '')))
        if not has_d or not has_n: need[cat].append(k)
    print(cat, '찾을 항목', len(need[cat]))

out = {'moves': {}, 'items': {}, 'abilities': {}}
# 한국어 이름이 아직 없는 것: 문서 제목을 알려 줌
TITLE = {'nihillight': '니힐레이저'}

# ── 기술 ──
for k in need['moves']:
    v = dex['moves'][k]
    title = TITLE.get(k) or v['n']
    t = None
    for suf in ('', '(기술)', '(포켓몬스터)'):
        t = page(title + suf)
        if t and '틀:포켓몬 기술' in t: break
    if not t: print('  기술 문서 없음', k, title); continue
    m = re.search(r'\[include\(틀:포켓몬 기술,(.*?)\)\]', t)
    if not m: print('  틀 없음', k, title); continue
    body = m.group(1)
    f = dict((a.strip(), b.strip()) for a, b in re.findall(r'([가-힣A-Za-z0-9]+)=([^=]*?)(?=,\s*[가-힣A-Za-z0-9]+=|$)', body))
    e = {}
    if f.get('한칭'): e['n'] = clean(f['한칭'])
    if usable(f.get('효과', '')): e['d'] = clean(f['효과'])
    if e: out['moves'][k] = e
    print('  기술', k, e)

# ── 특성: 초성별 목록 ──
ab = {}
for c in 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ':
    t = page('포켓몬스터/특성/' + c)
    if not t: continue
    for m in re.finditer(r'\| ([가-힣A-Za-z0-9·]+) \| \(([^/|]+) / ([^)|]+)\) [|\s]+(.+?) [|\s]+첫 등장', t):
        ko, en, desc = m.group(1), m.group(3), clean(m.group(4))
        if len(desc) < 300: ab[to_id(en)] = (ko, desc)
print('특성 목록에서', len(ab), '개')
for k in need['abilities']:
    if k in ab:
        ko, desc = ab[k]; e = {'n': ko}
        if usable(desc): e['d'] = desc
        out['abilities'][k] = e
    else: print('  특성 없음', k, dex['abilities'][k]['n'])

# ── 도구 ──
species_ko = {k: v['n'] for k, v in dex['species'].items()}
TYPE_KO = dex.get('types', {})
for k in need['items']:
    v = dex['items'][k]; name = v['n']
    t = page(name)
    m = re.search(r'\| 설명 [|\s]+(.+?) [|\s]+(?:가격|도입|입수|분류)', t) if t else None
    if m and usable(clean(m.group(1))):
        out['items'][k] = {'d': clean(m.group(1))}; print('  도구', k, out['items'][k]); continue
    # 문서가 없으면 공식 문구 형식으로
    if v.get('mega') and v.get('megaFrom'):
        base = to_id(v['megaFrom'][0]) if isinstance(v['megaFrom'], list) else to_id(v['megaFrom'])
        pk = species_ko.get(base, '').split('(')[0].strip() or name.replace('나이트', '')
        out['items'][k] = {'d': f'{pk}에게 지니게 하면 배틀할 때 메가진화할 수 있는 신비한 메가스톤의 일종.', 'gen': 1}
    elif v.get('zt'):
        tko = TYPE_KO.get(v['zt'], v['zt'])
        if v.get('zu'):
            out['items'][k] = {'d': f'특정 포켓몬의 전용 기술을 Z기술로 업그레이드하는 Z크리스탈. 지니게 하면 그 포켓몬이 Z기술을 쓸 수 있다.', 'gen': 1}
        else:
            out['items'][k] = {'d': f'{tko}타입 기술을 Z기술로 업그레이드하는 Z크리스탈. 지니게 하면 Z기술을 쓸 수 있다.', 'gen': 1}
    else:
        print('  도구 없음', k, name); continue
    print('  도구(형식)', k, out['items'][k])

json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('저장', OUT, {c: len(v) for c, v in out.items()})
