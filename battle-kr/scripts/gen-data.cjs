#!/usr/bin/env node
/**
 * 배틀 시뮬레이터용 데이터 추출 (빌드 시 1회 실행)
 *
 * `node build` 로 만든 dist/ 를 읽어 4·5세대에서 쓰는 포켓몬·기술·특성·도구의
 * 한글 이름, 설명, 배울 수 있는 기술 목록, 배틀 메시지(한글)를 작은 JSON으로 만든다.
 *
 * 사용법: node battle-kr/scripts/gen-data.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(__dirname, '../src/gen/dex.json');
const PKHEX_SPECIES = path.resolve(__dirname, 'species_ko.txt');

if (!fs.existsSync(path.join(DIST, 'sim'))) {
	console.error('dist/ 가 없습니다. 먼저 저장소 루트에서 `node build` 를 실행하세요.');
	process.exit(1);
}

const { Dex } = require(path.join(DIST, 'sim'));
const T = name => require(path.join(DIST, 'data/text', name));
const ko = {
	pokedex: T('ko/pokedex').PokedexText,
	moves: T('ko/moves').MovesText,
	abilities: T('ko/abilities').AbilitiesText,
	items: T('ko/items').ItemsText,
	default: T('ko/default').DefaultText,
	names: T('ko/names'),
};
const en = {
	moves: T('moves').MovesText,
	abilities: T('abilities').AbilitiesText,
	items: T('items').ItemsText,
	default: T('default').DefaultText,
};

/** 원본 TS 의 `// Official flavor text: "..."` 주석에서 한글 공식 설명을 뽑는다 */
function flavorTexts(file) {
	const src = fs.readFileSync(path.join(ROOT, 'data/text/ko', file), 'utf8');
	const out = {};
	let cur = null;
	for (const line of src.split('\n')) {
		const m = /^\t"?([a-z0-9]+)"?: \{/.exec(line);
		if (m) cur = m[1];
		const f = /\/\/ Official flavor text: "(.*)"\s*$/.exec(line);
		if (f && cur && !out[cur]) out[cur] = f[1].replace(/\\"/g, '"');
	}
	return out;
}
const flavor = {
	moves: flavorTexts('moves.ts'),
	abilities: flavorTexts('abilities.ts'),
	items: flavorTexts('items.ts'),
};

// PKHeX 의 한글 종족 이름(번호순) — ko 텍스트에 이름이 없을 때 사용
const pkhexSpecies = fs.existsSync(PKHEX_SPECIES) ?
	fs.readFileSync(PKHEX_SPECIES, 'utf8').split(/\r?\n/) : [];

const FORME_KO = {
	'Blue-Striped': '푸른줄무늬', 'Sunny': '태양의 모습', 'Rainy': '빗방울의 모습', 'Snowy': '설운의 모습',
	'Sandy': '모래땅도롱', 'Trash': '슈레도롱', 'Plant': '초목도롱', 'East': '동쪽바다', 'West': '서쪽바다',
	'Zen': '달마모드', 'Spring': '봄', 'Summer': '여름', 'Autumn': '가을', 'Winter': '겨울',
	'Origin': '오리진폼', 'Altered': '어나더폼', 'Attack': '어택폼', 'Defense': '디펜스폼', 'Speed': '스피드폼',
	'Sunshine': '포지폼', 'Sky': '스카이폼', 'Land': '랜드폼', 'Therian': '영물폼', 'Incarnate': '화신폼',
	'Resolute': '각오의 모습', 'Pirouette': '스텝폼', 'Aria': '보이스폼',
	'Douse': '아쿠아카세트', 'Shock': '번개카세트', 'Burn': '블레이즈카세트', 'Chill': '프리즈카세트',
	'Heat': '히트', 'Wash': '워시', 'Frost': '프로스트', 'Fan': '스핀', 'Mow': '커트',
	'Black': '블랙', 'White': '화이트', 'Red-Striped': '붉은줄무늬',
};

const TYPE_KO = ko.names.TypeNames;

function speciesName(s, dex) {
	const k = ko.pokedex[s.id]?.name;
	if (k) return k;
	const base = dex.species.get(s.baseSpecies);
	const baseKo = ko.pokedex[base.id]?.name || pkhexSpecies[s.num] || s.baseSpecies;
	if (!s.forme) return baseKo;
	let forme = FORME_KO[s.forme];
	if (!forme && s.baseSpecies === 'Arceus') forme = TYPE_KO[s.forme] || s.forme;
	return `${baseKo}(${forme || s.forme})`;
}

/** genN 하위 객체까지 포함해 한글 메시지를 합친다. 한글이 없으면 영어 원문을 `en:` 접두로 표시 */
const SKIP_FIELDS = new Set(['name', 'desc', 'shortDesc']);
function mergeMessages(enEntry, koEntry) {
	const out = {};
	if (!enEntry) return out;
	for (const f in enEntry) {
		const v = enEntry[f];
		if (SKIP_FIELDS.has(f)) continue;
		if (typeof v === 'string') {
			const kv = koEntry?.[f];
			out[f] = kv != null ? kv : null;
		} else if (v && typeof v === 'object' && /^gen\d$/.test(f)) {
			const sub = mergeMessages(v, koEntry?.[f]);
			if (Object.keys(sub).length) out[f] = sub;
		}
	}
	return out;
}

const result = {
	species: {}, moves: {}, abilities: {}, items: {}, natures: {}, types: {}, stats: ko.names.StatNames,
	text: {}, defaultText: {},
};

// ── 기술 ──
const moveIds = [];
const moveIndex = {};
const d9 = Dex.forGen(9);
for (const gen of [4, 5]) {
	const dex = Dex.forGen(gen);
	for (const m of dex.moves.all()) {
		if (m.isNonstandard || m.isZ || m.isMax || m.num <= 0) continue;
		if (!(m.id in moveIndex)) {
			moveIndex[m.id] = moveIds.length;
			moveIds.push(m.id);
			result.moves[m.id] = {
				n: ko.moves[m.id]?.name || m.name,
				d: flavor.moves[m.id] || '',
				g: {},
			};
		}
		result.moves[m.id].g[gen] = [m.type, m.category, m.basePower, m.accuracy === true ? 0 : m.accuracy,
			m.pp, m.priority, m.target, m.flags.contact ? 1 : 0];
	}
}
void d9;

// ── 특성 ──
for (const a of Dex.forGen(5).abilities.all()) {
	if (a.isNonstandard || a.num <= 0) continue;
	result.abilities[a.id] = { n: ko.abilities[a.id]?.name || a.name, d: flavor.abilities[a.id] || '', gen: a.gen };
}

// ── 도구 ──
for (const gen of [4, 5]) {
	for (const it of Dex.forGen(gen).items.all()) {
		if (it.isNonstandard || it.num <= 0 || it.isPokeball) continue;
		if (it.zMove || it.megaStone) continue;
		const e = result.items[it.id] ||= { n: ko.items[it.id]?.name || it.name, d: flavor.items[it.id] || '', gens: [] };
		e.gens.push(gen);
	}
}

// ── 포켓몬 ──
function learnable(dex, species, gen) {
	const out = new Set();
	let s = species;
	const seen = new Set();
	while (s && s.exists && !seen.has(s.id)) {
		seen.add(s.id);
		let ls = dex.species.getLearnsetData(s.id).learnset;
		if (!ls && s.changesFrom) ls = dex.species.getLearnsetData(dex.species.get(s.changesFrom).id).learnset;
		if (!ls && s.baseSpecies !== s.name) ls = dex.species.getLearnsetData(dex.species.get(s.baseSpecies).id).learnset;
		if (ls) {
			for (const moveid in ls) {
				if (ls[moveid].some(src => { const g = +src.charAt(0); return g >= 3 && g <= gen; })) out.add(moveid);
			}
		}
		s = s.prevo ? dex.species.get(s.prevo) : null;
	}
	if (species.id.startsWith('rotom') && species.forme) {
		const extra = { rotomheat: 'overheat', rotomwash: 'hydropump', rotomfrost: 'blizzard', rotomfan: 'airslash', rotommow: 'leafstorm' }[species.id];
		if (extra) out.add(extra);
	}
	if (out.has('hiddenpower')) {
		for (const t of Object.keys(TYPE_KO)) {
			const id = 'hiddenpower' + t.toLowerCase();
			if (moveIndex[id] !== undefined) out.add(id);
		}
	}
	return [...out].filter(id => moveIndex[id] !== undefined && !dex.moves.get(id).isNonstandard)
		.map(id => moveIndex[id]).sort((a, b) => a - b);
}

const BATTLE_ONLY = new Set(['Castform', 'Cherrim', 'Darmanitan', 'Meloetta']);
for (const gen of [4, 5]) {
	const dex = Dex.forGen(gen);
	for (const s of dex.species.all()) {
		if (s.isNonstandard || s.num <= 0) continue;
		const isBattleOnly = s.battleOnly || (s.forme && BATTLE_ONLY.has(s.baseSpecies));
		const e = result.species[s.id] ||= {
			n: speciesName(s, dex), en: s.name, num: s.num, base: s.baseSpecies !== s.name ? Dex.species.get(s.baseSpecies).id : undefined,
			tags: s.tags.length ? s.tags : undefined, g: {},
		};
		e.g[gen] = {
			t: s.types, bs: [s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe],
			ab: Object.values(s.abilities).map(a => dex.abilities.get(a).id),
			fe: s.nfe ? 0 : 1,
			bo: isBattleOnly ? 1 : undefined,
			gr: s.gender || undefined,
			req: s.requiredItem ? dex.items.get(s.requiredItem).id : undefined,
			wt: s.weightkg,
			ls: isBattleOnly ? undefined : learnable(dex, s, gen),
		};
	}
}

// ── 성격·타입 ──
for (const n of Dex.natures.all()) {
	result.natures[n.id] = { n: ko.names.NatureNames[n.name] || n.name, en: n.name, p: n.plus || '', m: n.minus || '' };
}
for (const t of Dex.forGen(5).types.all()) {
	result.types[t.name] = TYPE_KO[t.name] || t.name;
}

// ── 배틀 메시지 ──
for (const [kind, enTable, koTable] of [
	['moves', en.moves, ko.moves], ['abilities', en.abilities, ko.abilities], ['items', en.items, ko.items],
]) {
	for (const id in enTable) {
		const m = mergeMessages(enTable[id], koTable[id]);
		if (Object.keys(m).length) result.text[id] = m;
	}
	void kind;
}
for (const id in en.default) {
	if (id === 'ui') continue;
	const m = mergeMessages(en.default[id], ko.default[id]);
	// default 테이블 항목은 이름(weatherName 등)도 필요
	if (ko.default[id]?.weatherName) m.weatherName = ko.default[id].weatherName;
	if (id === 'default') result.defaultText = m;
	else result.text[id] = Object.assign(result.text[id] || {}, m);
}

result.moveIds = moveIds;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`dex.json: 포켓몬 ${Object.keys(result.species).length}, 기술 ${moveIds.length}, 특성 ${Object.keys(result.abilities).length}, ` +
	`도구 ${Object.keys(result.items).length}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
