/** 포켓몬 세트(기술·도구·노력치) 만들기 */
import { Teams } from '../../sim/teams';
import { RAW, speciesData, learnset, moveData, toID, bst, speciesKo, nickKo, megaStonesFor, zCrystalForType, type Gen, type StatID } from './data';
import FACTORY_SETS from '../../data/random-battles/gen9/factory-sets.json';

export interface PSet {
	name: string; species: string; item: string; ability: string; moves: string[]; nature: string;
	evs: { [k in StatID]: number }; ivs: { [k in StatID]: number }; level: number; gender?: string; shiny?: boolean; teraType?: string;
}

const generators: { [gen: number]: any } = {};
function generator(gen: Gen) {
	return generators[gen] ||= Teams.getGenerator(`gen${gen}randombattle`);
}

export const rng = {
	int(n: number) { return Math.floor(Math.random() * n); },
	pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; },
	shuffle<T>(arr: T[]): T[] {
		const a = arr.slice();
		for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
		return a;
	},
};

const BAN_MOVES = new Set(['explosion', 'selfdestruct', 'focuspunch', 'dreameater', 'lastresort', 'synchronoise', 'snore',
	'belch', 'futuresight', 'doomdesire', 'fling', 'naturalgift', 'struggle', 'counter', 'mirrorcoat', 'metalburst', 'bide',
	'feint', 'skyattack', 'razorwind', 'skullbash', 'solarbeam', 'hyperbeam', 'gigaimpact', 'blastburn', 'hydrocannon',
	'frenzyplant', 'rockwrecker', 'roaroftime', 'dig', 'fly', 'bounce', 'dive', 'shadowforce', 'skydrop', 'freezeshock',
	'iceburn', 'chatter', 'thrash', 'petaldance', 'rollout', 'iceball', 'uproar', 'present', 'magnitude', 'beatup', 'spitup',
	'trumpcard', 'punishment', 'payday', 'fakeout', 'selfdestruct', 'memento', 'healingwish', 'lunardance', 'finalgambit',
	'echoedvoice', 'round', 'fusionflare', 'fusionbolt', 'covet', 'thief', 'pursuit', 'smellingsalts', 'wakeupslap',
	'shockwave', 'magicalleaf', 'aerialace', 'swift', 'feintattack', 'shadowpunch', 'vitalthrow', 'magnetbomb', 'hiddenpower']);
const GOOD_STATUS_OFF = ['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'bulkup', 'shellsmash', 'rockpolish', 'agility', 'coil', 'shiftgear'];
const GOOD_STATUS_DEF = ['spore', 'stealthrock', 'toxic', 'willowisp', 'thunderwave', 'recover', 'roost', 'slackoff', 'softboiled',
	'synthesis', 'moonlight', 'morningsun', 'milkdrink', 'wish', 'leechseed', 'sleeppowder', 'spikes', 'healbell', 'aromatherapy',
	'reflect', 'lightscreen', 'protect', 'substitute', 'trickroom', 'tailwind', 'yawn', 'hypnosis', 'taunt', 'encore', 'painsplit', 'rest'];
const ABILITY_PREF = ['hugepower', 'purepower', 'speedboost', 'adaptability', 'levitate', 'intimidate', 'technician', 'drought',
	'drizzle', 'sandstream', 'snowwarning', 'magicguard', 'naturalcure', 'regenerator', 'thickfat', 'swiftswim', 'chlorophyll',
	'moxie', 'sheerforce', 'guts', 'multiscale', 'sturdy', 'flashfire', 'voltabsorb', 'waterabsorb', 'poisonheal', 'skilllink',
	'serenegrace', 'download', 'trace', 'simple', 'wonderguard', 'shadowtag', 'arenatrap', 'magnetpull', 'unaware', 'marvelscale',
	'roughskin', 'ironfist', 'reckless', 'toughclaws', 'analytic', 'sniper', 'hustle', 'noguard', 'tintedlens', 'solarpower',
	'clearbody', 'insomnia', 'synchronize', 'pressure', 'innerfocus', 'justified', 'sapsipper', 'motordrive', 'lightningrod',
	'stormdrain', 'filter', 'solidrock', 'prankster'];

function effectivePower(id: string, gen: Gen) {
	const m = moveData(id, gen)!;
	let bp = m.basePower;
	if (['lowkick', 'grassknot'].includes(id)) bp = 70;
	if (id === 'return' || id === 'frustration') bp = 102;
	if (id === 'gyroball' || id === 'heavyslam') bp = 70;
	if (id === 'seismictoss' || id === 'nightshade') bp = 80;
	const multi: { [id: string]: number } = {
		bulletseed: 3, iciclespear: 3, rockblast: 3, pinmissile: 3, tailslap: 3, doublehit: 2, dualchop: 2, bonemerang: 2,
		doublekick: 2, geargrind: 2, triplekick: 3, armthrust: 3, furyattack: 3, furyswipes: 3, cometpunch: 3, doubleslap: 3,
		spikecannon: 3, barrage: 3, bonerush: 3, twineedle: 2,
	};
	if (multi[id]) bp *= multi[id];
	const acc = m.accuracy === 0 ? 100 : m.accuracy;
	let v = bp * acc / 100;
	if (['closecombat', 'overheat', 'dracometeor', 'leafstorm', 'superpower', 'psychoboost', 'vcreate'].includes(id)) v *= 0.9;
	if (['doubleedge', 'bravebird', 'flareblitz', 'woodhammer', 'headsmash', 'volttackle', 'wildcharge', 'takedown', 'submission'].includes(id)) v *= 0.9;
	if (['jumpkick', 'highjumpkick'].includes(id)) v *= 0.85;
	if (m.priority > 0) v *= 1.1;
	return v;
}

/** 랜덤배틀 세트 데이터가 없는 포켓몬용 자동 세트 */
export function buildSet(speciesId: string, gen: Gen): PSet {
	const s = speciesData(speciesId, gen)!;
	const moves = learnset(speciesId, gen).filter(id => moveData(id, gen));
	const [hp, atk, , spa, , spe] = s.bs;
	void hp;
	const physical = atk >= spa;
	const scored = moves.map(id => {
		const m = moveData(id, gen)!;
		if (m.category === 'Status' || !m.basePower && !['seismictoss', 'nightshade', 'lowkick', 'grassknot', 'gyroball', 'heavyslam', 'return'].includes(id)) return null;
		if (BAN_MOVES.has(id) || id.startsWith('hiddenpower')) return null;
		let v = effectivePower(id, gen);
		if (s.t.includes(m.type)) v *= 1.5;
		const catOk = (m.category === 'Physical') === physical;
		if (!catOk) v *= Math.min(atk, spa) / Math.max(atk, spa) * 0.9;
		return { id, type: m.type, v };
	}).filter(Boolean) as { id: string; type: string; v: number }[];
	scored.sort((a, b) => b.v - a.v);

	const chosen: string[] = [];
	const types = new Set<string>();
	for (const t of s.t) {
		const best = scored.find(x => x.type === t && !chosen.includes(x.id));
		if (best && best.v > 40) { chosen.push(best.id); types.add(t); }
	}
	for (const x of scored) {
		if (chosen.length >= 3) break;
		if (types.has(x.type)) continue;
		chosen.push(x.id); types.add(x.type);
	}
	const status = moves.filter(id => (physical || spe >= 90 ? GOOD_STATUS_OFF : []).includes(id));
	const status2 = moves.filter(id => GOOD_STATUS_DEF.includes(id));
	const util = status.length ? rng.pick(status) : status2.length ? rng.pick(status2) : null;
	if (util && chosen.length >= 3) chosen.splice(3, 0, util);
	for (const x of scored) {
		if (chosen.length >= 4) break;
		if (!chosen.includes(x.id)) chosen.push(x.id);
	}
	for (const id of status2) {
		if (chosen.length >= 4) break;
		if (!chosen.includes(id)) chosen.push(id);
	}
	let ability = s.ab[0];
	for (const pref of ABILITY_PREF) if (s.ab.includes(pref)) { ability = pref; break; }
	let item = 'leftovers';
	if (!s.fe && gen >= 5) item = 'eviolite';
	else if (chosen.some(id => GOOD_STATUS_OFF.includes(id))) item = rng.pick(['lifeorb', 'leftovers', 'lumberry']);
	else if (spe >= 90 && chosen.every(id => moveData(id, gen)!.category !== 'Status')) item = rng.pick(['choicescarf', 'lifeorb', 'expertbelt']);
	else if (spe < 70 && chosen.every(id => moveData(id, gen)!.category !== 'Status')) item = physical ? 'choiceband' : 'choicespecs';
	if (s.req) item = s.req;
	const set: PSet = {
		name: nickKo(speciesId), species: s.en, item, ability, moves: chosen.slice(0, 4), nature: 'serious',
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
	};
	applySpread(set, gen);
	return set;
}

/** 기술 구성에 맞춰 노력치·성격 정하기 */
export function applySpread(set: PSet, gen: Gen, role = '') {
	const s = speciesData(set.species, gen)!;
	const [, atk, def, spa, sdef, spe] = s.bs;
	let phys = 0, spec = 0, stat = 0;
	for (const id of set.moves) {
		const m = moveData(id, gen);
		if (!m) continue;
		if (m.category === 'Physical') phys++;
		else if (m.category === 'Special') spec++;
		else stat++;
	}
	const usesPhys = phys > 0 && (phys >= spec || atk > spa + 20);
	const usesSpec = spec > 0 && (spec > phys || spa > atk + 20);
	const mixed = phys > 0 && spec > 0 && Math.abs(atk - spa) < 25;
	const bulky = stat >= 2 || /Staller|Bulky Support|Support/.test(role) || (spe < 60 && def + sdef > 200);
	const fast = spe >= 75 || /Fast|Sweeper|Setup/.test(role);
	const ev = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
	let nature = 'serious';
	const trickRoom = set.moves.includes('trickroom');
	if (bulky && !fast) {
		ev.hp = 252;
		if (usesPhys) { ev.atk = 252; ev.def = 4; nature = trickRoom ? 'brave' : 'adamant'; }
		else if (usesSpec) { ev.spa = 252; ev.spd = 4; nature = trickRoom ? 'quiet' : 'modest'; }
		else if (def <= sdef) { ev.def = 252; ev.spd = 4; nature = atk > spa ? 'impish' : 'bold'; }
		else { ev.spd = 252; ev.def = 4; nature = atk > spa ? 'careful' : 'calm'; }
	} else if (mixed) {
		ev.atk = 128; ev.spa = 128; ev.spe = 252;
		nature = def < sdef ? 'naive' : 'hasty';
		if (spe < 60) { ev.spe = 0; ev.hp = 252; nature = 'serious'; }
	} else if (usesSpec) {
		ev.spa = 252; ev.spe = 252; ev.hp = 4;
		nature = spe >= 95 ? 'timid' : 'modest';
		if (spe < 55) { ev.spe = 0; ev.hp = 252; ev.spd = 4; nature = trickRoom ? 'quiet' : 'modest'; }
	} else {
		ev.atk = 252; ev.spe = 252; ev.hp = 4;
		nature = spe >= 95 ? 'jolly' : 'adamant';
		if (spe < 55) { ev.spe = 0; ev.hp = 252; ev.def = 4; nature = trickRoom ? 'brave' : 'adamant'; }
	}
	if (bulky && fast && !usesPhys && !usesSpec) {
		for (const k in ev) (ev as any)[k] = 0;
		ev.hp = 252; ev.spe = 252; ev.spd = 4;
		nature = 'timid';
	}
	set.evs = ev;
	set.nature = nature;
	if (set.moves.includes('gyroball') || trickRoom) { set.ivs.spe = 0; }
	return set;
}

function sanitizeMoves(moves: string[], gen: Gen) {
	const out: string[] = [];
	for (let m of moves) {
		m = toID(m);
		if (/^return\d+$/.test(m)) m = 'return';
		if (/^frustration\d+$/.test(m)) m = 'frustration';
		if (!out.includes(m) && moveData(m, gen)) out.push(m);
		if (out.length >= 4) break;
	}
	return out;
}

/** 랜덤배틀 세트(있으면) 또는 자동 세트 */
export function randomSetFor(speciesId: string, gen: Gen, level = 50, doubles = false): PSet {
	const id = toID(speciesId);
	const g = generator(gen);
	let set: PSet;
	const table = doubles ? g.randomDoublesSets : g.randomSets;
	if (table?.[id]) {
		try {
			const r = g.randomSet(id, {}, false, doubles);
			set = {
				name: nickKo(id), species: speciesData(id, gen)?.en || r.species, item: toID(r.item), ability: toID(r.ability),
				moves: sanitizeMoves(r.moves, gen), nature: 'serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
				ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level, teraType: r.teraType,
			};
			if (set.moves.length < 1) throw new Error('no moves');
			// 랜덤배틀 세트의 잠재파워 타입 유지
			const hp = r.moves.find((m: string) => toID(m).startsWith('hiddenpower'));
			if (hp && toID(hp) !== 'hiddenpower') {
				const idx = set.moves.findIndex(m => m.startsWith('hiddenpower'));
				if (idx < 0 && set.moves.length < 4) set.moves.push(toID(hp));
			}
			applySpread(set, gen, r.role || '');
		} catch {
			set = buildSet(id, gen);
		}
	} else {
		set = buildSet(id, gen);
	}
	set.level = level;
	return set;
}

export interface PoolOptions {
	gen: Gen; minBst?: number; maxBst?: number; allowSubLegend?: boolean; types?: string[]; exclude?: Set<string>;
}

const BANNED_POOL = new Set(['unown', 'ditto', 'smeargle', 'wobbuffet', 'wynaut', 'shedinja', 'pichuspikyeared', 'castform',
	'cherrim', 'kecleon', 'luvdisc', 'delibird', 'spinda', 'farfetchd', 'plusle', 'minun', 'pachirisu', 'chatot', 'beautifly',
	'dustox', 'kricketune', 'wormadam', 'wormadamsandy', 'wormadamtrash', 'mothim', 'combee', 'burmy', 'phione', 'caterpie',
	'arceus', 'giratinaorigin', 'shayminsky', 'deoxys', 'deoxysattack', 'deoxysdefense', 'deoxysspeed', 'basculinbluestriped',
	'genesectdouse', 'genesectshock', 'genesectburn', 'genesectchill', 'keldeoresolute', 'meloettapirouette',
]);

/** 조건에 맞는 최종진화(일반) 포켓몬 목록 */
export function speciesPool(o: PoolOptions): string[] {
	const out: string[] = [];
	for (const id in RAW.species) {
		const s = speciesData(id, o.gen);
		if (!s || !RAW.species[id].g[o.gen]) continue;
		if (!s.fe || s.bo || BANNED_POOL.has(id) || o.exclude?.has(id)) continue;
		if (s.tags?.some(t => t === 'Restricted Legendary' || t === 'Mythical')) continue;
		if (!o.allowSubLegend && s.tags?.includes('Sub-Legendary')) continue;
		if (s.base && s.req && !/^(rotom|ogerpon)/.test(id)) continue; // 아르세우스·실버디 타입폼 등은 제외
		const b = bst(id, o.gen);
		if (o.minBst && b < o.minBst) continue;
		if (o.maxBst && b > o.maxBst) continue;
		if (o.types && !s.t.some(t => o.types!.includes(t))) continue;
		out.push(id);
	}
	return out;
}

const ITEM_ALTS = ['leftovers', 'sitrusberry', 'lumberry', 'lifeorb', 'expertbelt', 'focussash', 'choicescarf', 'choiceband',
	'choicespecs', 'shellbell', 'quickclaw', 'brightpowder', 'scopelens', 'whiteherb', 'chestoberry', 'salacberry', 'liechiberry',
	'petayaberry', 'kingsrock', 'widelens', 'muscleband', 'wiseglasses', 'blacksludge', 'lightclay', 'mentalherb'];
/** 도구 중복 금지(배틀타워 규칙) */
export function dedupeItems(team: PSet[]) {
	const used = new Set<string>();
	for (const set of team) {
		if (used.has(set.item)) {
			const alt = ITEM_ALTS.find(i => !used.has(i) && RAW.items[i]);
			set.item = alt || '';
		}
		if (set.item) used.add(set.item);
	}
	return team;
}

export function randomTeam(o: PoolOptions & { size: number; level?: number; ivs?: number; itemClause?: boolean; must?: string[]; doubles?: boolean; gimmicks?: boolean }): PSet[] {
	const pool = rng.shuffle(speciesPool(o));
	const picked: string[] = [...(o.must || [])];
	const usedBase = new Set(picked.map(id => speciesData(id, o.gen)?.num));
	for (const id of pool) {
		if (picked.length >= o.size) break;
		const num = speciesData(id, o.gen)!.num;
		if (usedBase.has(num)) continue;
		usedBase.add(num);
		picked.push(id);
	}
	const team = picked.map(id => {
		const set = randomSetFor(id, o.gen, o.level ?? 50, !!o.doubles);
		if (o.ivs !== undefined) for (const k in set.ivs) (set.ivs as any)[k] = Math.min((set.ivs as any)[k] === 0 ? 0 : 31, o.ivs);
		return set;
	});
	if (o.gimmicks !== false) assignGimmicks(team);
	return o.itemClause === false ? team : dedupeItems(team);
}

/** 팀에 메가스톤·Z크리스탈을 하나씩 (가능하면) 나눠 주고 테라스탈 타입을 정함 */
export function assignGimmicks(team: PSet[], opts: { mega?: number; z?: number } = {}) {
	const megaProb = opts.mega ?? 0.6, zProb = opts.z ?? 0.4;
	const hasMega = team.some(s => RAW.items[s.item]?.mega);
	const hasZ = team.some(s => RAW.items[s.item]?.zt);
	if (!hasMega && Math.random() < megaProb) {
		const cands = team.filter(s => megaStonesFor(s.species).length && !speciesData(s.species, 9)?.req);
		if (cands.length) {
			const set = rng.pick(cands);
			set.item = rng.pick(megaStonesFor(set.species));
		}
	}
	if (!hasZ && Math.random() < zProb) {
		const cands = team.filter(s => !RAW.items[s.item]?.mega && !speciesData(s.species, 9)?.req && !/^choice/.test(s.item));
		if (cands.length) {
			const set = rng.pick(cands);
			const types = speciesData(set.species, 9)!.t;
			const stab = set.moves.map(m => moveData(m, 9)).filter(m => m && m.category !== 'Status' && types.includes(m.type))
				.sort((a, b) => b!.basePower - a!.basePower)[0];
			const z = stab ? zCrystalForType(stab.type) : null;
			if (z) set.item = z;
		}
	}
	for (const s of team) if (!s.teraType) s.teraType = speciesData(s.species, 9)?.t[0];
	return team;
}

/** 9세대 배틀팩토리 세트 (티어: PU → NU → RU → UU → OU → Uber) */
export const FACTORY_TIERS = ['PU', 'NU', 'RU', 'UU', 'OU', 'Uber'] as const;
export function factoryTeam(tier: string, size: number, level: number, exclude = new Set<string>()): PSet[] {
	const table = (FACTORY_SETS as any)[tier] || (FACTORY_SETS as any).OU;
	const ids = rng.shuffle(Object.keys(table).filter(id => !exclude.has(id) && speciesData(id, 9)));
	const out: PSet[] = [];
	const nums = new Set<number>();
	for (const id of ids) {
		if (out.length >= size) break;
		const num = speciesData(id, 9)!.num;
		if (nums.has(num)) continue;
		const entry = table[id];
		const total = entry.sets.reduce((a: number, x: any) => a + (x.weight || 1), 0);
		let r = Math.random() * total;
		let fs = entry.sets[0];
		for (const x of entry.sets) { r -= x.weight || 1; if (r <= 0) { fs = x; break; } }
		const pick = (v: any) => Array.isArray(v) ? rng.pick(v) : v;
		const moves = fs.moves.map((slot: any) => toID(pick(slot))).filter((m: string) => moveData(m, 9));
		const sid = toID(fs.species);
		const sd = speciesData(sid, 9);
		if (!sd || moves.length < 2) continue;
		nums.add(num);
		const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(fs.evs || {}) };
		const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...(fs.ivs || {}) };
		out.push({
			name: nickKo(sid), species: sd.en, item: toID(pick(fs.item) || ''), ability: toID(pick(fs.ability) || sd.ab[0]),
			moves: [...new Set(moves)] as string[], nature: toID(pick(fs.nature) || 'serious'), evs, ivs, level, teraType: pick(fs.teraType) || sd.t[0],
		});
	}
	return out;
}

/** 시뮬레이터에 넘길 형태로 */
export function toSimTeam(team: PSet[]) {
	return team.map(s => ({
		name: s.name || speciesKo(s.species), species: s.species, item: s.item, ability: s.ability, moves: s.moves.slice(),
		nature: s.nature, evs: { ...s.evs }, ivs: { ...s.ivs }, level: s.level, gender: s.gender || '', shiny: !!s.shiny,
		teraType: s.teraType || speciesData(s.species, 9)?.t[0],
	}));
}

export function cloneSet(s: PSet): PSet {
	return JSON.parse(JSON.stringify(s));
}
