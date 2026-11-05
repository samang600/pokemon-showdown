/**
 * Pokémon Showdown 시뮬레이터는 Node 에서 `require(동적경로)` 로 데이터를 읽는다.
 * 브라우저에서는 그럴 수 없으므로, 필요한 데이터 모듈을 정적으로 묶어 두고
 * 전역 `require` 를 흉내 내 경로 → 모듈을 돌려준다.
 */
import * as base_abilities from '../../../data/abilities';
import * as base_aliases from '../../../data/aliases';
import * as base_conditions from '../../../data/conditions';
import * as base_formatsdata from '../../../data/formats-data';
import * as base_items from '../../../data/items';
import * as base_moves from '../../../data/moves';
import * as base_natures from '../../../data/natures';
import * as base_pokedex from '../../../data/pokedex';
import * as base_rulesets from '../../../data/rulesets';
import * as base_scripts from '../../../data/scripts';
import * as base_typechart from '../../../data/typechart';

import * as rb_gen9 from '../../../data/random-battles/gen9/teams';

import * as formats from './formats';
import CHAMP from './champions-moves.json';

/** 포켓몬 챔피언스 PP: 5→8, 10→12, 15→16, 20 이상→20 (1 같은 특수값은 그대로) */
export function championsPP(pp: number) { return pp >= 20 ? 20 : pp >= 15 ? 16 : pp >= 10 ? 12 : pp >= 5 ? 8 : pp; }

/** 포켓몬 챔피언스 기술 사양 적용 (basePower·accuracy·type·secondary·self·boosts·flags·target·critRatio·ignoreAbility) */
export function applyChampionsMoves(Moves: { [id: string]: any }) {
	for (const [id, patch] of Object.entries(CHAMP as { [id: string]: any })) {
		if (id.startsWith('_')) continue;
		const m = Moves[id];
		if (!m) continue;
		for (const [k, v] of Object.entries(patch)) {
			if (k === 'secondary') { const sec = { ...(m.secondary || {}) }; for (const [sk, sv] of Object.entries(v as any)) if (sv !== '__keep__') sec[sk] = sv; m.secondary = sec; }
			else if (k === 'flags') m.flags = { ...(m.flags || {}), ...(v as any) };
			else if (k === 'self') m.self = { ...(m.self || {}), ...(v as any) };
			else m[k] = v;
		}
	}
	// PP: 챔피언스는 PP업 없이 5→8, 10→12, 15→16, 20 이상→20 (Pokébase 자료)
	for (const m of Object.values(Moves)) {
		if (!m || typeof m.pp !== 'number') continue;
		m.pp = championsPP(m.pp);
		m.noPPBoosts = true;
	}
	// 은혜갚기·화풀이: 친밀도와 관계없이 항상 102 (시뮬레이터가 요청 문자열에 콜백 값을 붙이므로 콜백은 남겨 둠)
	for (const id of ['return', 'frustration']) if (Moves[id]) { Moves[id].basePower = 102; Moves[id].basePowerCallback = () => 102; }
	// 소금절이: 매 턴 1/16 (물·강철 타입은 1/8) — 본가는 1/8·1/4
	if (Moves.saltcure?.condition) {
		Moves.saltcure.condition.onResidual = function (this: any, pokemon: any) {
			this.damage(pokemon.baseMaxhp / (pokemon.hasType(['Water', 'Steel']) ? 8 : 16));
		};
	}
}
applyChampionsMoves((base_moves as any).Moves);

export const MODS: string[] = [];

const REGISTRY: { [path: string]: any } = {
	'/ps/data/abilities': base_abilities,
	'/ps/data/aliases': base_aliases,
	'/ps/data/conditions': base_conditions,
	'/ps/data/formats-data': base_formatsdata,
	'/ps/data/items': base_items,
	'/ps/data/moves': base_moves,
	'/ps/data/natures': base_natures,
	'/ps/data/pokedex': base_pokedex,
	'/ps/data/rulesets': base_rulesets,
	'/ps/data/scripts': base_scripts,
	'/ps/data/typechart': base_typechart,

	'/ps/data/random-battles/gen9/teams': rb_gen9,

	'/ps/config/formats': formats,
};

function normalize(p: string, from = '/ps/sim') {
	const parts = (p.startsWith('/') ? p : from + '/' + p).split('/');
	const out: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return '/' + out.join('/').replace(/\.(ts|js)$/, '');
}

function notFound(p: string) {
	const e: any = new Error(`Cannot find module '${p}'`);
	e.code = 'MODULE_NOT_FOUND';
	return e;
}

const fakeRequire: any = (p: string) => {
	if (p === 'node:crypto' || p === 'crypto') return globalThis.crypto;
	const key = normalize(p);
	const mod = REGISTRY[key];
	if (!mod) throw notFound(p);
	return mod;
};
fakeRequire.resolve = (p: string) => {
	const key = normalize(p);
	if (!REGISTRY[key]) throw notFound(p);
	return key;
};

(globalThis as any).__psRequire = fakeRequire;
