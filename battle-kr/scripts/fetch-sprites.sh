#!/usr/bin/env bash
# 오프라인용 그림을 public/sprites 에 받는다 (Pokémon Showdown 스프라이트 서버).
#  - 포켓몬: gen5 정지 그림 (앞/뒤 × 일반/색이 다른) — 오프라인일 때·정지 그림 설정일 때 사용
#  - 트레이너 그림, 도구 아이콘 시트
# 이미 받은 파일은 건너뛴다. 사용법: bash battle-kr/scripts/fetch-sprites.sh
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/public/sprites"
HOST="https://play.pokemonshowdown.com/sprites"
mkdir -p "$OUT"/{gen5,gen5-back,gen5-shiny,gen5-back-shiny,trainers,substitutes/gen5,substitutes/gen5-back}

LIST="$(mktemp)"
npx --yes esbuild "$HERE/scripts/list-sprites.ts" --bundle --platform=node --log-level=error \
	--outfile="$LIST.cjs" && node "$LIST.cjs" "$HERE/src" > "$LIST"
rm -f "$LIST.cjs"

jobs_file="$(mktemp)"
while read -r kind id; do
	if [ "$kind" = poke ]; then
		for d in gen5 gen5-back gen5-shiny gen5-back-shiny; do echo "$d/$id.png"; done
	else
		echo "trainers/$id.png"
	fi
done < "$LIST" > "$jobs_file"
printf "itemicons-sheet.png\nsubstitutes/gen5/substitute.png\nsubstitutes/gen5-back/substitute.png\n" >> "$jobs_file"

fetch_one() {
	local rel="$1"
	[ -s "$OUT/$rel" ] && return 0
	local code
	code=$(curl -s -o "$OUT/$rel.part" -w '%{http_code}' "$HOST/$rel")
	if [ "$code" = 200 ]; then mv "$OUT/$rel.part" "$OUT/$rel"; else rm -f "$OUT/$rel.part"; echo "없음: $rel"; fi
}
export -f fetch_one
export OUT HOST
xargs -P 24 -I{} bash -c 'fetch_one "$@"' _ {} < "$jobs_file"
rm -f "$LIST" "$jobs_file"
echo "완료: $(find "$OUT" -name '*.png' | wc -l)개, $(du -sh "$OUT" | cut -f1)"
