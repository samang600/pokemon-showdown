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
