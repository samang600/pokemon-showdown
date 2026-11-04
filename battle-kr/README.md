# 배틀 시뮬레이터 KR (한국어 포켓몬 배틀 시뮬레이터)

스마트폰에서 바로 하는 한국어 포켓몬 배틀 앱. 배틀 계산은 이 저장소의 **Pokémon Showdown 시뮬레이터(`sim/`)를 그대로** 브라우저에서 돌립니다.

## 받기
- **안드로이드**: [`release/BattleSimKR-v1.0.0.apk`](release/BattleSimKR-v1.0.0.apk) 를 받아 설치 (출처를 알 수 없는 앱 허용 필요, 안드로이드 7.0 이상)
- **아이폰·PC**: `dist/index.html` 한 파일을 브라우저로 열거나 웹에 올리면 됩니다 (홈 화면에 추가 → 앱처럼 실행)
- 포켓몬 그림은 인터넷 연결 시 Showdown 스프라이트 서버에서 받아 표시합니다 (오프라인이면 이름 카드)

## 모드
| 모드 | 규칙 | 내용 |
|---|---|---|
| 배틀타워 | 4세대 · Lv50 · 싱글 3마리 / 더블 4마리 | 7연승마다 세트 클리어·BP, 연승할수록 상대가 강해짐, 21·49번째에 타워 타이쿤. 쉬기(저장) 가능 |
| 배틀팩토리 | 4세대 · Lv50 / 오픈(Lv100) · 싱글 / 더블 | 렌탈 6마리 중 선택, 승리 후 상대 포켓몬과 교환, 21·49번째에 팩토리 헤드 |
| PWT | 5세대 · Lv50 · 싱글 / 더블 | 렌탈·오픈·관동/성도/호연/신오/하나 리더스·월드 리더스·사천왕·챔피언스 등 10개 대회, 8명 토너먼트(상대 팀 미리보기 후 선택) |
| 네임드 트레이너 | 5세대 · Lv50 | 관장·사천왕·챔피언 61명과 싱글 3vs3 / 6vs6, 더블 4vs4 / 6vs6 |
| 프리 배틀 | 4·5세대 싱글/더블 | 무작위 상대와 바로 대전 |

팀 편집: 종족(초성 검색 가능)·특성·도구·기술(배울 수 있는 기술만)·성격·노력치, 추천 세트, 쇼다운 형식 텍스트 가져오기(영어·한글 이름)/내보내기.

## 상대 AI (`src/ai.ts`)
- [Complete-Fire-Red-Upgrade](https://github.com/Skeli789/Complete-Fire-Red-Upgrade) (Skeli789) Battle AI 구조를 옮김:
  모든 기술 viability 100에서 시작 → 실패·무의미한 기술 감점(ai_negatives) → 쓰러뜨릴 수 있는 기술·가장 강한 기술 가점(TryToFaint)
  → 상황별 변화 기술 가점(ai_positives) → 더블 점수표(두 마리 공격·KO 수·같은 편 피해) → 교체 판단(ai_switching: 멸망의노래,
  원더가드, 쓸 기술 없음, 흡수 특성 동료, 자연회복+잠듦, 하품, 지속 피해, 죽음 회피, 공격 능력 크게 하락)과 가장 적합한 교체 대상 선택.
  CFRU 는 비영리 사용 조건이므로 이 앱도 **비영리**로만 배포합니다.
- [FredodaFred/pokemon-battle-ai](https://github.com/FredodaFred/pokemon-battle-ai) 의 규칙 기반 점수(추가효과·자해 고려) 아이디어 반영.
- [atw1020/Pokemon_Battle_AI](https://github.com/atw1020/Pokemon_Battle_AI) 는 학습된 모델이 필요한 TensorFlow 신경망이고, 저자 README에 따르면 정확도가 50% 수준이라 사용하지 않았습니다.
- 데미지는 실제 능력치(노력치·성격·랭크)로 계산하고, 난이도(skill)가 낮을수록 실수가 잦아집니다.

## 그래픽
- 창틀·버튼: [Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon) 의 `chrome.png` 9-slice (GPL-3.0, `src/ui-assets/LICENSE-SPD-GPL3.txt`)
- 글꼴: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL 1.1, `src/fonts/OFL-Galmuri.md`)
- 배틀 화면 배치는 PokeRogue 스타일을 참고했고, 배경은 `scripts/gen-arenas.py` 로 직접 그린 도트 그림입니다.
- 한글 이름·배틀 메시지: 저장소의 `data/text/ko`, 부족한 종족명은 PKHeX 한글 데이터(`scripts/species_ko.txt`)

GPL-3.0 그래픽이 포함되므로 이 앱 묶음(`battle-kr`)은 GPL-3.0 조건으로 배포합니다.

## 빌드
```
npm ci --omit=optional          # 저장소 루트
node build                      # dist/ (시뮬레이터 컴파일)
node battle-kr/scripts/gen-data.cjs   # 한글 데이터 → src/gen/dex.json
node battle-kr/build.mjs        # → battle-kr/dist/index.html (한 파일, 약 6MB)
node battle-kr/build.mjs --android && cd battle-kr/android && ./gradlew assembleRelease
```
- 안드로이드 SDK 경로는 `android/local.properties` 의 `sdk.dir`.
- 서명: 환경변수 `BATTLESIM_KEYSTORE`(키스토어 경로, 별칭 `battlesim`)·`BATTLESIM_KEY_PASSWORD` 를 주면 그 키로, 없으면 디버그 키로 서명합니다. 키는 저장소에 넣지 마세요 (같은 키로 서명해야 업데이트 설치 가능).
- GitHub Actions `배틀 시뮬레이터 APK` 워크플로가 APK·웹 파일을 아티팩트로 만듭니다.
- AI 자체 대전 테스트: `node battle-kr/build.mjs --test` → `test/selfplay.html` 을 열고 `selfplay(25, 4, false, 0.95, 0.3)`.

## 구조
- `src/ps/` 시뮬레이터를 브라우저에서 돌리기 위한 대체 모듈(fs·path·동적 require 레지스트리, 포맷 목록)
- `src/engine.ts` 플레이어 ↔ AI 대전 진행, `src/text.ts` 프로토콜 → 한국어 메시지(조사 처리 `src/josa.ts`)
- `src/sets.ts` 세트 생성(랜덤배틀 세트 + 자동 세트, 노력치·성격), `src/trainers.ts` 트레이너·대회
- `src/modes.tsx` 모드 진행, `src/ui/` 화면
