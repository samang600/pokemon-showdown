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

import * as g8_abilities from '../../../data/mods/gen8/abilities';
import * as g8_formatsdata from '../../../data/mods/gen8/formats-data';
import * as g8_items from '../../../data/mods/gen8/items';
import * as g8_moves from '../../../data/mods/gen8/moves';
import * as g8_pokedex from '../../../data/mods/gen8/pokedex';
import * as g8_rulesets from '../../../data/mods/gen8/rulesets';
import * as g8_scripts from '../../../data/mods/gen8/scripts';
import * as g8_typechart from '../../../data/mods/gen8/typechart';

import * as g7_abilities from '../../../data/mods/gen7/abilities';
import * as g7_formatsdata from '../../../data/mods/gen7/formats-data';
import * as g7_items from '../../../data/mods/gen7/items';
import * as g7_moves from '../../../data/mods/gen7/moves';
import * as g7_pokedex from '../../../data/mods/gen7/pokedex';
import * as g7_rulesets from '../../../data/mods/gen7/rulesets';
import * as g7_scripts from '../../../data/mods/gen7/scripts';

import * as g6_abilities from '../../../data/mods/gen6/abilities';
import * as g6_conditions from '../../../data/mods/gen6/conditions';
import * as g6_formatsdata from '../../../data/mods/gen6/formats-data';
import * as g6_items from '../../../data/mods/gen6/items';
import * as g6_moves from '../../../data/mods/gen6/moves';
import * as g6_pokedex from '../../../data/mods/gen6/pokedex';
import * as g6_scripts from '../../../data/mods/gen6/scripts';
import * as g6_typechart from '../../../data/mods/gen6/typechart';

import * as g5_abilities from '../../../data/mods/gen5/abilities';
import * as g5_conditions from '../../../data/mods/gen5/conditions';
import * as g5_formatsdata from '../../../data/mods/gen5/formats-data';
import * as g5_items from '../../../data/mods/gen5/items';
import * as g5_moves from '../../../data/mods/gen5/moves';
import * as g5_pokedex from '../../../data/mods/gen5/pokedex';
import * as g5_rulesets from '../../../data/mods/gen5/rulesets';
import * as g5_scripts from '../../../data/mods/gen5/scripts';
import * as g5_typechart from '../../../data/mods/gen5/typechart';

import * as g4_abilities from '../../../data/mods/gen4/abilities';
import * as g4_conditions from '../../../data/mods/gen4/conditions';
import * as g4_formatsdata from '../../../data/mods/gen4/formats-data';
import * as g4_items from '../../../data/mods/gen4/items';
import * as g4_moves from '../../../data/mods/gen4/moves';
import * as g4_pokedex from '../../../data/mods/gen4/pokedex';
import * as g4_rulesets from '../../../data/mods/gen4/rulesets';
import * as g4_scripts from '../../../data/mods/gen4/scripts';

import * as rb_gen4 from '../../../data/random-battles/gen4/teams';
import * as rb_gen5 from '../../../data/random-battles/gen5/teams';

import * as formats from './formats';

export const MODS = ['gen4', 'gen5', 'gen6', 'gen7', 'gen8'];

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

	'/ps/data/mods/gen8/abilities': g8_abilities,
	'/ps/data/mods/gen8/formats-data': g8_formatsdata,
	'/ps/data/mods/gen8/items': g8_items,
	'/ps/data/mods/gen8/moves': g8_moves,
	'/ps/data/mods/gen8/pokedex': g8_pokedex,
	'/ps/data/mods/gen8/rulesets': g8_rulesets,
	'/ps/data/mods/gen8/scripts': g8_scripts,
	'/ps/data/mods/gen8/typechart': g8_typechart,

	'/ps/data/mods/gen7/abilities': g7_abilities,
	'/ps/data/mods/gen7/formats-data': g7_formatsdata,
	'/ps/data/mods/gen7/items': g7_items,
	'/ps/data/mods/gen7/moves': g7_moves,
	'/ps/data/mods/gen7/pokedex': g7_pokedex,
	'/ps/data/mods/gen7/rulesets': g7_rulesets,
	'/ps/data/mods/gen7/scripts': g7_scripts,

	'/ps/data/mods/gen6/abilities': g6_abilities,
	'/ps/data/mods/gen6/conditions': g6_conditions,
	'/ps/data/mods/gen6/formats-data': g6_formatsdata,
	'/ps/data/mods/gen6/items': g6_items,
	'/ps/data/mods/gen6/moves': g6_moves,
	'/ps/data/mods/gen6/pokedex': g6_pokedex,
	'/ps/data/mods/gen6/scripts': g6_scripts,
	'/ps/data/mods/gen6/typechart': g6_typechart,

	'/ps/data/mods/gen5/abilities': g5_abilities,
	'/ps/data/mods/gen5/conditions': g5_conditions,
	'/ps/data/mods/gen5/formats-data': g5_formatsdata,
	'/ps/data/mods/gen5/items': g5_items,
	'/ps/data/mods/gen5/moves': g5_moves,
	'/ps/data/mods/gen5/pokedex': g5_pokedex,
	'/ps/data/mods/gen5/rulesets': g5_rulesets,
	'/ps/data/mods/gen5/scripts': g5_scripts,
	'/ps/data/mods/gen5/typechart': g5_typechart,

	'/ps/data/mods/gen4/abilities': g4_abilities,
	'/ps/data/mods/gen4/conditions': g4_conditions,
	'/ps/data/mods/gen4/formats-data': g4_formatsdata,
	'/ps/data/mods/gen4/items': g4_items,
	'/ps/data/mods/gen4/moves': g4_moves,
	'/ps/data/mods/gen4/pokedex': g4_pokedex,
	'/ps/data/mods/gen4/rulesets': g4_rulesets,
	'/ps/data/mods/gen4/scripts': g4_scripts,

	'/ps/data/random-battles/gen4/teams': rb_gen4,
	'/ps/data/random-battles/gen5/teams': rb_gen5,

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
