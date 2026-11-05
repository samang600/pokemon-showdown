/** 앱에 넣을 그림 목록 출력 (scripts/fetch-sprites.sh 가 사용)
 *  출력 형식: 한 줄에 하나씩 `종류 id` (poke = 포켓몬, trainer = 트레이너) */
import * as fs from 'fs';
import * as path from 'path';
import { RAW, spriteId } from '../src/data';
import { CLASS_SPRITES, PLAYER_SPRITES, NAMED_SPRITE } from '../src/trainer-lines';
import { EXTRA_NAMED } from '../src/trainer-lore';

const out = new Set<string>();
for (const id in RAW.species) {
	out.add('poke ' + spriteId(id));
	if (RAW.species[id].gx) out.add('poke ' + spriteId(id) + '-gmax');
	out.add('cry ' + id);
	const base = RAW.species[id].base;
	if (base) out.add('cry ' + base);
}
// 네임드 트레이너 id (trainers.ts 는 시뮬레이터를 불러오므로 글자로 읽음)
const src = fs.readFileSync(path.join(process.argv[2], 'trainers.ts'), 'utf8');
const named = src.slice(src.indexOf('export const NAMED'), src.indexOf('export const REGIONS'));
for (const m of named.matchAll(/\bT\('([a-z0-9-]+)'/g)) out.add('trainer ' + (NAMED_SPRITE[m[1]] || m[1]));
for (const e of EXTRA_NAMED) out.add('trainer ' + e.sprite);
for (const list of Object.values(CLASS_SPRITES)) for (const s of list) out.add('trainer ' + s);
for (const p of PLAYER_SPRITES) out.add('trainer ' + p.id);
for (const s of ['palmer', 'thorton']) out.add('trainer ' + s);
console.log([...out].join('\n'));
