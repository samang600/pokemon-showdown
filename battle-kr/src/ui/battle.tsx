/** 배틀 화면 */
import { h, Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Session } from '../engine';
import { KoreanText, parseLine, effectInfo, type ParsedLine } from '../text';
import { moveData, moveKo, speciesData, speciesKo, toID, abilityKo, itemKo, natureKo, STAT_SHORT, STAT_KO, typeKo, abilityDesc,
	itemDesc, type Gen } from '../data';
import { toSimTeam, type PSet } from '../sets';
import { loadSettings, updateRecords } from '../store';
import { Sprite, HPBar, StatusBadge, TypeBadge, TYPE_COLOR, Modal, toast, confirmBox } from './core';
import { MonSheet, type LiveInfo } from './screens';
import { estimateDamage } from '../ai';
import * as FX from '../fx';
import { sfx, moveSound, playMusic, stopMusic, cry, preloadCries, pickBattleMusic } from '../sound';
import { SPRITE_URL } from '../trainer-lines';
import { loadAnim, preloadAnim, playAnim, animIdFor } from '../anim-player';

export interface BattleSetup {
	gen: Gen;
	doubles: boolean;
	p1: { name: string; team: PSet[]; sprite?: string };
	p2: { name: string; title?: string; team: PSet[]; line?: string; sprite?: string; lines?: { intro?: string; ace?: string; lose?: string; win?: string } };
	aiSkill: number;
	label?: string; // 예: '배틀타워 12번째'
	bg?: 'tower' | 'factory' | 'pwt' | 'field' | 'champion';
}
export interface BattleResult { win: boolean; forfeit: boolean; turns: number; p1Left: number; p2Left: number }

interface Mon {
	ident: string; nick: string; species: string; level: number; gender: string; shiny: boolean;
	hp: number; maxhp: number; status: string; fainted: boolean; boosts: { [k: string]: number };
	vol: Set<string>; anim: string; ability?: string; item?: string; transformed?: string; hidden?: boolean; tera?: string; seen: string[];
}
interface SideScene { id: string; name: string; active: (Mon | null)[]; team: Mon[]; cond: { [id: string]: number }; teamSize: number }
interface Scene { p1: SideScene; p2: SideScene; weather: string; pseudo: Set<string>; turn: number }

const VOLATILE_KO: { [id: string]: string } = {
	substitute: '대타', confusion: '혼란', leechseed: '씨뿌리기', taunt: '도발', encore: '앵콜', torment: '트집',
	attract: '헤롱헤롱', yawn: '하품', perish3: '멸망 3', perish2: '멸망 2', perish1: '멸망 1', perish0: '멸망',
	curse: '저주', nightmare: '악몽', ingrain: '뿌리박기', aquaring: '아쿠아링', magnetrise: '전자부유', embargo: '금제',
	healblock: '회복봉인', focusenergy: '기충전', disable: '사슬묶기', flashfire: '타오르는불꽃', slowstart: '슬로스타트',
	charge: '충전', stockpile1: '비축 1', stockpile2: '비축 2', stockpile3: '비축 3', typechange: '타입 변화', smackdown: '떨어뜨리기',
	telekinesis: '텔레키네시스', dynamax: '다이맥스', autotomize: '바디퍼지', imprison: '봉인', uproar: '소란', partiallytrapped: '조이기',
	trapped: '도망 불가', foresight: '꿰뚫어보기', miracleeye: '미라클아이', powertrick: '파워트릭', destinybond: '길동무',
};
const SIDE_KO: { [id: string]: string } = {
	stealthrock: '스텔스록', spikes: '압정뿌리기', toxicspikes: '독압정', reflect: '리플렉터', lightscreen: '빛의장막',
	tailwind: '순풍', safeguard: '신비의부적', mist: '흰안개', luckychant: '주술', wideguard: '와이드가드', quickguard: '퍼스트가드',
};
const WEATHER_KO: { [id: string]: string } = { raindance: '비', sunnyday: '쾌청', sandstorm: '모래바람', hail: '싸라기눈' };
const PSEUDO_KO: { [id: string]: string } = { trickroom: '트릭룸', gravity: '중력', wonderroom: '원더룸', magicroom: '매직룸', mudsport: '흙놀이', watersport: '물놀이' };

function parseDetails(details: string) {
	const parts = details.split(', ');
	let level = 100, gender = '', shiny = false;
	for (const p of parts.slice(1)) {
		if (p.startsWith('L')) level = parseInt(p.slice(1), 10);
		else if (p === 'M' || p === 'F') gender = p;
		else if (p === 'shiny') shiny = true;
	}
	return { species: parts[0], level, gender, shiny };
}
function parseHP(cond: string) {
	const [hpPart, status] = (cond || '').split(' ');
	if (hpPart === '0' || status === 'fnt') return { hp: 0, maxhp: 0, status: 'fnt' };
	const [hp, maxhp] = hpPart.split('/').map(n => parseInt(n, 10));
	return { hp: hp || 0, maxhp: maxhp || 0, status: status || '' };
}
function slotOf(ident: string) {
	const c = ident.charAt(2);
	return c >= 'a' && c <= 'c' ? c.charCodeAt(0) - 97 : -1;
}

const SPEED_MS = { 1: 1350, 2: 850, 3: 420 };

export function BattleView({ setup, onEnd }: { setup: BattleSetup; onEnd: (r: BattleResult) => void }) {
	const settings = useRef(loadSettings()).current;
	const sessionRef = useRef<Session | null>(null);
	const textRef = useRef<KoreanText | null>(null);
	const sceneRef = useRef<Scene>({
		p1: { id: 'p1', name: setup.p1.name, active: [], team: [], cond: {}, teamSize: setup.p1.team.length },
		p2: { id: 'p2', name: setup.p2.name, active: [], team: [], cond: {}, teamSize: setup.p2.team.length },
		weather: '', pseudo: new Set(), turn: 0,
	});
	const [, setTick] = useState(0);
	const rerender = () => setTick(t => t + 1);
	const [message, setMessage] = useState('');
	const [log, setLog] = useState<string[]>([]);
	const [phase, setPhase] = useState<'playing' | 'input' | 'ended'>('playing');
	const [showLog, setShowLog] = useState(false);
	const [detail, setDetail] = useState<{ mon: Mon; own: boolean } | null>(null);
	const skipRef = useRef<(() => void) | null>(null);
	const fastRef = useRef(false);
	const logRef = useRef<string[]>([]);
	const [fast, setFast] = useState(false);

	// 입력 상태
	const [slotIdx, setSlotIdx] = useState(0);
	const [parts, setParts] = useState<string[]>([]);
	const [menu, setMenu] = useState<'main' | 'moves' | 'switch' | 'target'>('main');
	const [pendingMove, setPendingMove] = useState<{ num: number; target: string; gm?: string } | null>(null);
	const [focus, setFocus] = useState(0);
	const [sheet, setSheet] = useState<{ idx: number; canSwitch: boolean } | null>(null);
	const fxRef = useRef<HTMLDivElement | null>(null);
	const [trainerVis, setTrainerVis] = useState<{ own: boolean; foe: boolean }>({ own: false, foe: false });
	const aceShownRef = useRef(false);
	const [gimmick, setGimmick] = useState('');
	const arenaRef = useRef<HTMLDivElement | null>(null);
	const [scale, setScale] = useState(1.5);
	useEffect(() => {
		const el = arenaRef.current;
		if (!el) return;
		const update = () => setScale(el.clientWidth / 256);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const gen = setup.gen;

	const wait = (ms: number) => new Promise<void>(resolve => {
		const t = setTimeout(() => { skipRef.current = null; resolve(); }, fastRef.current ? Math.min(ms, 120) : ms);
		skipRef.current = () => { clearTimeout(t); skipRef.current = null; resolve(); };
	});

	function findMon(ident: string, details?: string): Mon {
		const scene = sceneRef.current;
		const side = scene[ident.slice(0, 2) as 'p1' | 'p2'];
		const nick = ident.slice(ident.indexOf(': ') + 2);
		let mon = side.team.find(m => m.nick === nick && (!details || toID(parseDetails(details).species).startsWith(toID(m.species).slice(0, 4)) || true));
		if (!mon) {
			const d = details ? parseDetails(details) : { species: nick, level: 50, gender: '', shiny: false };
			mon = {
				ident: ident.slice(0, 2) + ': ' + nick, nick, species: d.species, level: d.level, gender: d.gender, shiny: d.shiny,
				hp: 100, maxhp: 100, status: '', fainted: false, boosts: {}, vol: new Set(), anim: '', seen: [],
			};
			side.team.push(mon);
		}
		return mon;
	}
	function activeMon(ident: string): Mon | null {
		const scene = sceneRef.current;
		const side = scene[ident.slice(0, 2) as 'p1' | 'p2'];
		const slot = slotOf(ident);
		if (slot >= 0 && side.active[slot]) return side.active[slot];
		const nick = ident.slice(ident.indexOf(': ') + 2);
		return side.team.find(m => m.nick === nick) || null;
	}
	function animate(mon: Mon | null, anim: string, ms = 500) {
		if (!mon) return;
		mon.anim = anim;
		setTimeout(() => { if (mon.anim === anim) { mon.anim = ''; rerender(); } }, ms);
	}

	/** 슬롯 위 포켓몬 몸통 중심 좌표 (arena 기준 px) */
	function slotPoint(ident: string): FX.Pt | null {
		const arena = arenaRef.current;
		if (!arena || !ident || !/^p\d[a-c]/.test(ident)) return null;
		const own = ident.startsWith('p1');
		const el = arena.querySelector(`.slot.${own ? 'own' : 'foe'}.s${slotOf(ident)}`) as HTMLElement | null;
		if (!el) return null;
		const a = arena.getBoundingClientRect(), r = el.getBoundingClientRect();
		return { x: r.left - a.left, y: r.top - a.top - (own ? 34 : 26) * scale * (setup.doubles ? 0.8 : 1) };
	}
	const pendingHitRef = useRef<{ at: number; sound: string } | null>(null);
	const frontRef = useRef<HTMLCanvasElement | null>(null);
	const backRef = useRef<HTMLCanvasElement | null>(null);
	const animBgRef = useRef<HTMLDivElement | null>(null);
	const animUsedRef = useRef<ParsedLine | null>(null);
	const [fieldOpen, setFieldOpen] = useState(false);
	useEffect(() => {
		const el = arenaRef.current; if (!el) return;
		const fit = () => {
			const dpr = window.devicePixelRatio || 1;
			for (const c of [frontRef.current, backRef.current]) {
				if (!c) continue;
				c.width = el.clientWidth * dpr; c.height = el.clientHeight * dpr;
				c.style.width = el.clientWidth + 'px'; c.style.height = el.clientHeight + 'px';
				c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
			}
		};
		fit();
		const ro = new ResizeObserver(fit); ro.observe(el);
		return () => ro.disconnect();
	}, []);
	function slotEl(ident: string): HTMLElement | null {
		const arena = arenaRef.current;
		if (!arena || !/^p\d[a-c]/.test(ident)) return null;
		return arena.querySelector(`.slot.${ident.startsWith('p1') ? 'own' : 'foe'}.s${slotOf(ident)}`) as HTMLElement | null;
	}
	/** PokéRogue(Pokémon Reborn) 애니메이션 재생. 없으면 false */
	async function tryRebornAnim(p: ParsedLine): Promise<boolean> {
		if (settings.effects === false || p.kw.still || p.kw.notarget) return false;
		const [, user, moveName, target] = p.args;
		const id = animIdFor(toID(moveName));
		const anim = await preloadAnim(id);
		if (!anim || !frontRef.current || !backRef.current || !animBgRef.current) return false;
		const userPt = slotPoint(user); if (!userPt) return false;
		let tgt = target && /^p\d[a-c]/.test(target) ? target : '';
		if (!tgt || tgt.slice(0, 3) === user.slice(0, 3)) {
			// 자신 대상/대상 없음: 반대편 첫 포켓몬을 가상 대상으로
			const foe = user.startsWith('p1') ? 'p2' : 'p1';
			const idx = sceneRef.current[foe].active.findIndex(m => m && !m.fainted);
			tgt = `${foe}${'ab'[Math.max(0, idx)]}: x`;
		}
		const targetPt = slotPoint(tgt) || userPt;
		animUsedRef.current = p;
		await playAnim(anim, {
			front: frontRef.current, back: backRef.current, bgLayer: animBgRef.current,
			userPt, targetPt, userEl: slotEl(user), targetEl: slotEl(tgt), k: scale * 0.85, userIsFoe: user.startsWith('p2'),
			sfxVolume: settings.sound === false ? 0 : 0.8,
		});
		return true;
	}
	function moveFx(p: ParsedLine): number {
		const layer = fxRef.current, arena = arenaRef.current;
		const [, user, moveName, target] = p.args;
		const mid = toID(moveName);
		const simMove = sessionRef.current?.battle.dex.moves.get(mid);
		const md = moveData(mid, gen);
		const type = simMove?.type || md?.type || 'Normal', cat = simMove?.category || md?.category || 'Physical';
		moveSound(type, cat);
		if (!layer || !arena || p.kw.still || settings.effects === false) return 0;
		const from = slotPoint(user);
		if (!from) return 0;
		if (p.kw.miss || p.kw.notarget) return 0;
		const tt = simMove?.target || md?.target || 'normal';
		let hits: FX.Pt[] = [];
		const foeSide = user.startsWith('p1') ? 'p2' : 'p1';
		if (['allAdjacentFoes', 'allAdjacent', 'all', 'foeSide'].includes(tt)) {
			sceneRef.current[foeSide].active.forEach((m, i) => { if (m && !m.fainted) { const pt = slotPoint(`${foeSide}${'ab'[i]}: x`); if (pt) hits.push(pt); } });
		}
		const to = slotPoint(target || '') || hits[0] || from;
		if (!hits.length) hits = [to];
		const impact = FX.playMove(layer, arena, { id: mid, type, category: cat, flags: simMove?.flags || {}, target: tt, basePower: simMove?.basePower }, from, to, scale, hits);
		const hitSound = RXp(/explosion|selfdestruct|boomburst|eruption|mindblown/, mid) ? 'hitExplode' : RXp(/punch|fist|kick|slam|smash|hammer|tackle|headbutt|rush|charge|press|chop/, mid) ? 'hitPunch' : RXp(/slash|cut|claw|blade|sword|edge|scissor|wing|razor|fang|bite|crunch/, mid) ? 'hitSlash' : 'hit';
		pendingHitRef.current = { at: impact, sound: hitSound };
		return impact;
	}

	/** 줄 하나를 화면 상태에 반영. 연출 대기시간(ms) 반환 */
	function apply(p: ParsedLine): number {
		const scene = sceneRef.current;
		const { cmd, args, kw } = p;
		switch (cmd) {
		case 'switch': case 'drag': case 'replace': {
			const ident = args[1];
			const side = scene[ident.slice(0, 2) as 'p1' | 'p2'];
			const slot = slotOf(ident);
			const prev = side.active[slot];
			if (prev) { prev.boosts = {}; prev.vol = new Set(); prev.transformed = undefined; }
			const mon = findMon(ident, args[2]);
			const d = parseDetails(args[2]);
			mon.species = d.species; mon.level = d.level; mon.gender = d.gender; mon.shiny = d.shiny;
			const hp = parseHP(args[3]);
			mon.hp = hp.hp; mon.maxhp = hp.maxhp || mon.maxhp; mon.status = hp.status === 'fnt' ? '' : hp.status;
			mon.fainted = false; mon.boosts = {}; mon.vol = new Set();
			side.active[slot] = mon;
			const own = ident.startsWith('p1');
			const layer = fxRef.current;
			const to = slotPoint(ident);
			if (layer && to && cmd !== 'replace') {
				const from = { x: own ? -10 : layer.clientWidth + 10, y: to.y - 30 * scale };
				mon.hidden = true;
				sfx('ballThrow');
				const t = FX.ballOut(layer, from, to, scale);
				setTimeout(() => { mon.hidden = false; mon.anim = 'enter'; rerender(); sfx('ballOpen'); cry(toID(mon.species)); setTimeout(() => { if (mon.anim === 'enter') { mon.anim = ''; rerender(); } }, 500); }, t);
				return t + 450;
			}
			animate(mon, 'enter', 600);
			cry(toID(mon.species));
			return 350;
		}
		case 'faint': {
			const mon = activeMon(args[1]);
			if (mon) { mon.fainted = true; mon.hp = 0; animate(mon, 'faint', 900); cry(toID(mon.species), { faint: true }); }
			sfx('faint');
			return 700;
		}
		case 'move': {
			const mon = activeMon(args[1]);
			if (mon && !mon.seen.includes(args[2])) mon.seen.push(args[2]);
			animate(mon, args[1].startsWith('p1') ? 'attack-own' : 'attack-foe', 450);
			if (animUsedRef.current === p) { animUsedRef.current = null; pendingHitRef.current = { at: 0, sound: '' }; return 150; }
			const impact = settings.effects === false ? (moveSound(moveData(toID(args[2]), gen)?.type || 'Normal', moveData(toID(args[2]), gen)?.category || 'Physical'), 0) : moveFx(p);
			return Math.max(500, impact + 300);
		}
		case '-damage': case '-heal': case '-sethp': {
			const mon = activeMon(args[1]);
			if (!mon) return 0;
			const hp = parseHP(args[2]);
			const before = mon.hp;
			mon.hp = hp.hp;
			if (hp.maxhp) mon.maxhp = hp.maxhp;
			if (hp.status === 'fnt') { mon.hp = 0; }
			else mon.status = hp.status;
			if (cmd === '-damage' && !kw.from) { animate(mon, 'hit', 450); if (pendingHitRef.current?.sound !== '') sfx(pendingHitRef.current?.sound || 'hit'); }
			if (cmd === '-heal' && !kw.silent && fxRef.current) { const pt = slotPoint(args[1]); if (pt) FX.sparkle(fxRef.current, pt, 'Grass', scale); sfx('heal'); }
			return before !== mon.hp ? 550 : 0;
		}
		case '-status': { const m = activeMon(args[1]); if (m) m.status = args[2]; sfx('status'); return 0; }
		case '-supereffective': { sfx('hitSuper'); if (arenaRef.current) FX.shake(arenaRef.current, true); return 0; }
		case '-crit': { sfx('crit'); if (fxRef.current) FX.flash(fxRef.current); return 0; }
		case '-miss': { sfx('miss'); return 0; }
		case '-zpower': { sfx('zmove'); const pt = slotPoint(args[1]); if (pt && fxRef.current) FX.pillar(fxRef.current, pt, '#ffe040', scale); return 700; }
		case '-curestatus': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			const nick = args[1].slice(args[1].indexOf(': ') + 2);
			const m = side.team.find(x => x.nick === nick);
			if (m) m.status = '';
			return 0;
		}
		case '-cureteam': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			for (const m of side.team) m.status = '';
			return 0;
		}
		case '-boost': case '-unboost': {
			const m = activeMon(args[1]);
			if (m) {
				const n = parseInt(args[3], 10) * (cmd === '-boost' ? 1 : -1);
				m.boosts[args[2]] = Math.max(-6, Math.min(6, (m.boosts[args[2]] || 0) + n));
				animate(m, n > 0 ? 'boost' : 'unboost', 500);
				sfx(n > 0 ? 'statUp' : 'statDown');
			}
			return 0;
		}
		case '-setboost': { const m = activeMon(args[1]); if (m) m.boosts[args[2]] = parseInt(args[3], 10); return 0; }
		case '-clearboost': { const m = activeMon(args[1]); if (m) m.boosts = {}; return 0; }
		case '-clearnegativeboost': {
			const m = activeMon(args[1]);
			if (m) for (const k in m.boosts) if (m.boosts[k] < 0) m.boosts[k] = 0;
			return 0;
		}
		case '-clearallboost':
			for (const s of [scene.p1, scene.p2]) for (const m of s.active) if (m) m.boosts = {};
			return 0;
		case '-invertboost': { const m = activeMon(args[1]); if (m) for (const k in m.boosts) m.boosts[k] = -m.boosts[k]; return 0; }
		case '-copyboost': {
			const m = activeMon(args[1]); const t = activeMon(args[2]);
			if (m && t) m.boosts = { ...t.boosts };
			return 0;
		}
		case '-swapboost': {
			const m = activeMon(args[1]); const t = activeMon(args[2]);
			if (m && t) {
				const stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
				for (const s of stats) { const tmp = m.boosts[s] || 0; m.boosts[s] = t.boosts[s] || 0; t.boosts[s] = tmp; }
			}
			return 0;
		}
		case '-weather':
			if (!kw.upkeep && args[1] !== 'none') sfx('weather');
			if (!kw.upkeep) scene.weather = args[1] === 'none' ? '' : toID(args[1]);
			return 0;
		case '-fieldstart': scene.pseudo.add(effectInfo(args[1]).id); return 0;
		case '-fieldend': scene.pseudo.delete(effectInfo(args[1]).id); return 0;
		case '-sidestart': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			const id = effectInfo(args[2]).id;
			side.cond[id] = (side.cond[id] || 0) + 1;
			return 0;
		}
		case '-sideend': {
			const side = scene[args[1].slice(0, 2) as 'p1' | 'p2'];
			delete side.cond[effectInfo(args[2]).id];
			return 0;
		}
		case '-start': {
			const m = activeMon(args[1]);
			if (!m) return 0;
			const id = effectInfo(args[2]).id;
			if (id.startsWith('perish')) { for (const k of [...m.vol]) if (k.startsWith('perish')) m.vol.delete(k); }
			if (id.startsWith('stockpile')) { for (const k of [...m.vol]) if (k.startsWith('stockpile')) m.vol.delete(k); }
			m.vol.add(id);
			if (id === 'substitute') animate(m, 'enter', 400);
			if (id === 'dynamax') { sfx('dynamax'); if (fxRef.current) FX.flash(fxRef.current, '#ff2040', 500); return 700; }
			return 0;
		}
		case '-end': {
			const m = activeMon(args[1]);
			if (!m) return 0;
			const id = effectInfo(args[2]).id;
			m.vol.delete(id);
			if (id === 'stockpile') for (const k of [...m.vol]) if (k.startsWith('stockpile')) m.vol.delete(k);
			return 0;
		}
		case '-transform': {
			const m = activeMon(args[1]); const t = activeMon(args[2]);
			if (m && t) { m.transformed = t.species; m.boosts = { ...t.boosts }; }
			return 300;
		}
		case 'detailschange': case '-formechange': {
			const m = activeMon(args[1]);
			if (m) { const d = parseDetails(args[2]); if (cmd === 'detailschange') m.species = d.species; else m.transformed = d.species; }
			return 300;
		}
		case '-terastallize': {
			const m = activeMon(args[1]);
			if (m) { m.tera = args[2]; animate(m, 'enter', 600); }
			sfx('tera'); const pt = slotPoint(args[1]); if (pt && fxRef.current) FX.pillar(fxRef.current, pt, TYPE_COLOR[args[2]] || '#fff', scale);
			return 800;
		}
		case '-mega': case '-primal': case '-burst': {
			const m = activeMon(args[1]); animate(m, 'enter', 600);
			sfx('mega'); const pt = slotPoint(args[1]); if (pt && fxRef.current) FX.pillar(fxRef.current, pt, '#ff80ff', scale);
			if (m) cry(toID(m.species), { delay: 600 });
			return 900;
		}
		case '-item': { const m = activeMon(args[1]); if (m) m.item = args[2]; return 0; }
		case '-enditem': { const m = activeMon(args[1]); if (m) m.item = ''; return 0; }
		case '-ability': { const m = activeMon(args[1]); if (m) m.ability = args[2]; return 0; }
		case 'turn': scene.turn = parseInt(args[1], 10); return 0;
		case 'teamsize': {
			const side = scene[args[1] as 'p1' | 'p2'];
			if (side) side.teamSize = parseInt(args[2], 10);
			return 0;
		}
		}
		return 0;
	}

	async function play(lines: string[]) {
		setPhase('playing');
		const kt = textRef.current!;
		for (const line of lines) {
			const p = parseLine(line);
			if (!p) continue;
			let prev: { ident: string; fainted: boolean } | null = null;
			if (p.cmd === 'switch' || p.cmd === 'drag') {
				const side = sceneRef.current[p.args[1].slice(0, 2) as 'p1' | 'p2'];
				const cur = side.active[slotOf(p.args[1])];
				if (cur) prev = { ident: cur.ident, fainted: cur.fainted };
			}
			let text = '';
			try { text = kt.render(p, prev); } catch (e) { console.error(e, line); }
			const msgs = text ? text.split('\n').filter(Boolean) : [];
			// 상대 마지막 포켓몬: 트레이너 등장 + 대사
			if ((p.cmd === 'switch' || p.cmd === 'drag') && p.args[1].startsWith('p2') && !aceShownRef.current && setup.p2.lines?.ace) {
				const sc = sceneRef.current.p2;
				const fainted = sc.team.filter(m => m.fainted).length;
				const alive = sc.teamSize - fainted;
				const isNew = !sc.team.some(m => m.nick === p.args[1].slice(p.args[1].indexOf(': ') + 2));
				if (alive === 1 && (isNew || sc.teamSize === sc.team.length) && sc.teamSize > 1) {
					aceShownRef.current = true;
					setTrainerVis({ own: false, foe: true });
					showMsg(`${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}: “${setup.p2.lines.ace}”`);
					await wait(SPEED_MS[settings.speed] * 1.5);
					setTrainerVis({ own: false, foe: false });
					await wait(300);
				}
			}
			// 교체 메시지는 들어가기 전에
			if (msgs.length && (p.cmd === 'switch' || p.cmd === 'drag') && prev && !prev.fainted && msgs.length > 1) {
				showMsg(msgs.shift()!);
				const side = sceneRef.current[p.args[1].slice(0, 2) as 'p1' | 'p2'];
				const cur = side.active[slotOf(p.args[1])];
				if (cur) { animate(cur, 'leave', 500); const pt = slotPoint(p.args[1]); if (pt && fxRef.current) FX.ballIn(fxRef.current, pt, scale); }
				rerender();
				await wait(SPEED_MS[settings.speed] * 0.7);
			}
			if (p.cmd === 'move' && msgs.length) {
				// 기술 이름 메시지를 먼저 보여주고 애니메이션
				showMsg(msgs.shift()!);
				const mon = activeMon(p.args[1]);
				if (mon && !mon.seen.includes(p.args[2])) mon.seen.push(p.args[2]);
				rerender();
				const used = await tryRebornAnim(p);
				if (!used) {
					const d = apply(p); rerender();
					await wait(Math.max(d, SPEED_MS[settings.speed] * 0.6));
				} else { pendingHitRef.current = { at: 0, sound: '' }; await wait(120); }
				for (const m of msgs) { showMsg(m); await wait(SPEED_MS[settings.speed]); }
				continue;
			}
			const delay = apply(p);
			rerender();
			if (p.cmd === 'turn') { pushLog(text); continue; }
			for (const m of msgs) {
				showMsg(m);
				await wait(SPEED_MS[settings.speed] + (m.length > 30 ? 200 : 0));
			}
			if (!msgs.length && delay) await wait(Math.min(delay, SPEED_MS[settings.speed]));
		}
		const s = sessionRef.current!;
		if (s.ended) {
			setPhase('ended');
			const win = s.winner === setup.p1.name;
			updateRecords(r => { r.battles++; if (win) r.wins++; });
			if (win) playMusic('victory'); else stopMusic();
			showMsg(win ? `${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}에게 이겼다!` : '눈앞이 깜깜해졌다…');
			const endLine = win ? setup.p2.lines?.lose : setup.p2.lines?.win;
			if (endLine) {
				await wait(SPEED_MS[settings.speed] * 1.2);
				setTrainerVis({ own: false, foe: true });
				showMsg(`${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}: “${endLine}”`);
			}
		} else {
			beginInput();
		}
	}

	function showMsg(m: string) {
		setMessage(m);
		pushLog(m);
	}
	function pushLog(m: string) {
		logRef.current = [...logRef.current, m];
		setLog(logRef.current);
	}

	function beginInput() {
		setParts([]);
		setGimmick('');
		setPendingMove(null);
		const req = sessionRef.current!.p1Request;
		if (!req || req.wait) { setPhase('playing'); return; }
		const first = firstSlot(req, 0);
		setSlotIdx(first);
		setMenu(req.forceSwitch ? 'switch' : 'main');
		setPhase('input');
		const scene = sceneRef.current;
		const mon = scene.p1.active[first];
		if (req.forceSwitch) setMessage('다음 포켓몬을 골라 주세요.');
		else if (mon) setMessage(`${mon.nick}${josaTopic(mon.nick)} 무엇을 할까?`);
	}

	/** 이번에 선택해야 하는 슬롯 */
	function firstSlot(req: any, from: number): number {
		const n = req.forceSwitch ? req.forceSwitch.length : req.active?.length || 1;
		for (let i = from; i < n; i++) {
			if (req.forceSwitch) { if (req.forceSwitch[i]) return i; continue; }
			const mon = req.side.pokemon[i];
			if (mon && !mon.condition.endsWith(' fnt') && mon.condition !== '0 fnt' && !req.active[i]?.commanding) return i;
		}
		return -1;
	}

	function pushChoice(choice: string) {
		const req = sessionRef.current!.p1Request;
		const next = [...parts, choice];
		const nextSlot = firstSlot(req, slotIdx + 1);
		if (nextSlot < 0) {
			submit(next);
		} else {
			setParts(next);
			setSlotIdx(nextSlot);
			setMenu(req.forceSwitch ? 'switch' : 'main');
			const mon = sceneRef.current.p1.active[nextSlot];
			if (!req.forceSwitch && mon) setMessage(`${mon.nick}${josaTopic(mon.nick)} 무엇을 할까?`);
		}
	}

	function submit(choiceParts: string[]) {
		const s = sessionRef.current!;
		const lines = s.choose(choiceParts.join(', '));
		if (!lines) {
			toast('선택할 수 없습니다: ' + (s.lastError.replace(/^\[.*?\]\s*/, '') || '다시 골라 주세요'));
			beginInput();
			return;
		}
		play(lines);
	}

	function cancelChoice() {
		if (!parts.length) { setMenu(sessionRef.current!.p1Request.forceSwitch ? 'switch' : 'main'); return; }
		const req = sessionRef.current!.p1Request;
		setParts([]);
		const first = firstSlot(req, 0);
		setSlotIdx(first);
		setMenu(req.forceSwitch ? 'switch' : 'main');
	}

	async function forfeit() {
		if (!(await confirmBox('기권', '정말 기권할까요? 이 승부는 패배로 기록됩니다.', '기권', '취소'))) return;
		const lines = sessionRef.current!.forfeit();
		await play(lines);
	}

	useEffect(() => {
		const s = new Session({
			gen: setup.gen, doubles: setup.doubles, aiSkill: setup.aiSkill,
			p1: { name: setup.p1.name, team: toSimTeam(setup.p1.team) as any },
			p2: { name: setup.p2.name, team: toSimTeam(setup.p2.team) as any },
		});
		sessionRef.current = s;
		textRef.current = new KoreanText({
			gen: setup.gen, ownSide: 'p1', doubles: setup.doubles,
			trainerName: side => side === 'p1' ? setup.p1.name : (setup.p2.title ? `${setup.p2.title} ${setup.p2.name}` : setup.p2.name),
		});
		// 내 팀은 미리 등록 (교체 화면용)
		const lines = s.start();
		playMusic(pickBattleMusic(setup.bg === 'champion' ? 'boss' : setup.bg === 'tower' || setup.bg === 'factory' ? 'tower' : setup.bg === 'pwt' ? 'pwt' : 'battle'));
		preloadCries([...setup.p1.team, ...setup.p2.team].map(x => toID(x.species)));
		if (settings.effects !== false) for (const set of [...setup.p1.team, ...setup.p2.team]) for (const m of set.moves) preloadAnim(animIdFor(toID(m)));
		(async () => {
			// 트레이너 등장 (양쪽 트레이너가 발판에 나타난 뒤 포켓몬을 내보냄)
			setTrainerVis({ own: true, foe: true });
			const who = `${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}`;
			setMessage(`${who}${josaSubject(setup.p2.name)} 승부를 걸어왔다!`);
			pushLog(`${who}${josaSubject(setup.p2.name)} 승부를 걸어왔다!`);
			await wait(SPEED_MS[settings.speed] * 1.3);
			const intro = setup.p2.lines?.intro || setup.p2.line;
			if (intro) {
				showMsg(`${who}: “${intro}”`);
				await wait(SPEED_MS[settings.speed] * 1.6);
			}
			setTrainerVis({ own: false, foe: false });
			await wait(350);
			await play(lines);
		})();
		return () => { skipRef.current?.(); stopMusic(); };
	}, []);

	const scene = sceneRef.current;
	const req = sessionRef.current?.p1Request;

	function finish() {
		const s = sessionRef.current!;
		stopMusic();
		const win = s.winner === setup.p1.name;
		const alive = (side: 'p1' | 'p2') => s.battle[side].pokemon.filter((p: any) => !p.fainted).length;
		onEnd({ win, forfeit: !win && s.battle.turn > 0 && alive('p1') > 0, turns: s.battle.turn, p1Left: alive('p1'), p2Left: alive('p2') });
	}

	// ── 렌더링 ──
	const reqMon = req?.side?.pokemon;
	const activeReq = req?.active?.[slotIdx];
	const curMon = scene.p1.active[slotIdx];

	/** 예상 데미지 비율 문자열 (설정 켜짐 때) */
	const dmgPreview = (m: any, targetSide: 'p1' | 'p2' = 'p2', slot?: number): string => {
		if (!settings.damagePreview) return '';
		const b = sessionRef.current?.battle; if (!b) return '';
		const user = b.p1.active[slotIdx]; if (!user) return '';
		const targets = slot !== undefined ? [b[targetSide].active[slot]] : b.p2.active.filter((x: any) => x && !x.fainted);
		const mv = b.dex.moves.get(m.id);
		if (!mv || mv.category === 'Status' || !targets.length || !targets[0]) return '';
		try {
			const d = estimateDamage(b, user, targets[0], mv);
			if (d <= 0) return '';
			const pct = Math.round(d * targets[0].hp / targets[0].maxhp * 100);
			return pct >= 100 ? 'KO 가능' : `약 ${Math.max(1, pct)}%`;
		} catch { return ''; }
	};

	const moveInfo = (m: any, i = -1) => {
		const md = moveData(m.id, gen);
		let type = md?.type || 'Normal';
		let name = moveKo(m.move);
		if (i >= 0 && gimmick === 'zmove') {
			const z = activeReq?.canZMove?.[i];
			if (z) name = moveKo(z.move);
		}
		const dmaxed = activeReq?.maxMoves && !activeReq?.canDynamax;
		if (i >= 0 && (gimmick === 'dynamax' || dmaxed) && activeReq?.maxMoves?.maxMoves?.[i]) {
			name = moveKo(activeReq.maxMoves.maxMoves[i].move);
		}
		if (m.id === 'hiddenpower') {
			const t = /Hidden Power (\w+)/.exec(m.move)?.[1];
			if (t) { type = t; name = `잠재파워(${typeKo(t)})`; }
		}
		let eff = '';
		if (md && md.category !== 'Status' && !setup.doubles) {
			const s = sessionRef.current!.battle;
			const target = s.p2.active.find((p: any) => p && !p.fainted);
			if (target) {
				const imm = !s.dex.getImmunity(type, target);
				const e = imm ? 0 : Math.pow(2, s.dex.getEffectiveness(type, target));
				eff = e === 0 ? '효과 없음' : e >= 4 ? '효과 매우 굉장' : e >= 2 ? '효과 굉장' : e <= 0.25 ? '매우 별로' : e < 1 ? '효과 별로' : '보통';
			}
		}
		return { md, type, name, eff };
	};

	const renderMoves = () => {
		if (!activeReq) return null;
		const focusM = activeReq.moves[focus] || activeReq.moves[0];
		const fi = focusM ? moveInfo(focusM) : null;
		return <div class="move-panel">
			<div class="move-grid win-dark">
				{activeReq.moves.map((m: any, i: number) => {
					const { type, name, eff } = moveInfo(m, i);
					const disabled = m.disabled || (m.pp === 0 && m.id !== 'struggle') || (gimmick === 'zmove' && !activeReq.canZMove?.[i]);
					return <button key={i} class={'move-btn' + (focus === i ? ' focus' : '')} disabled={disabled}
						style={{ '--tc': TYPE_COLOR[type] } as any}
						onPointerDown={() => setFocus(i)} onClick={() => onMove(i + 1, m)}>
						<span class={'mv-name' + (name.length >= 9 ? ' xl' : name.length >= 7 ? ' l' : '')}>{name}</span>
						<span class="mv-sub"><TypeBadge type={type} small /><span class="mv-pp">{m.maxpp ? `${m.pp}/${m.maxpp}` : ''}</span></span>
						{eff && eff !== '보통' && <span class={'mv-eff ' + (eff.includes('굉장') ? 'good' : 'bad')}>{eff}</span>}
						{settings.damagePreview && !setup.doubles && dmgPreview(m) && <span class="mv-dmg">{dmgPreview(m)}</span>}
					</button>;
				})}
			</div>
			{fi && <div class="move-info win-dark">
				<div class="mi-row"><span>타입</span><TypeBadge type={fi.type} small /></div>
				<div class="mi-row"><span>분류</span><b>{fi.md ? (fi.md.category === 'Physical' ? '물리' : fi.md.category === 'Special' ? '특수' : '변화') : '-'}</b></div>
				<div class="mi-row"><span>위력</span><b>{fi.md?.basePower || '—'}</b></div>
				<div class="mi-row"><span>명중</span><b>{fi.md?.accuracy || '—'}</b></div>
				<div class="mi-row"><span>PP</span><b>{focusM.maxpp ? `${focusM.pp}/${focusM.maxpp}` : '-'}</b></div>
			</div>}
			{fi?.md?.desc && <div class="move-desc">{fi.md.desc}</div>}
		</div>;
	};

	function onMove(num: number, m: any) {
		const locked = m.pp === undefined && m.maxpp === undefined;
		const dmaxed = activeReq?.maxMoves && !activeReq?.canDynamax;
		let target = locked ? 'self' : m.target || moveData(m.id, gen)?.target || 'normal';
		if (dmaxed || gimmick === 'dynamax') target = activeReq.maxMoves?.maxMoves?.[num - 1]?.target || 'adjacentFoe';
		if (gimmick === 'zmove') target = activeReq.canZMove?.[num - 1]?.target || target;
		const gm = gimmick ? ' ' + gimmick : '';
		setGimmick('');
		if (setup.doubles && ['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(target)) {
			setPendingMove({ num, target, gm });
			setMenu('target');
			return;
		}
		pushChoice(`move ${num}${gm}`);
	}

	const renderTargets = () => {
		if (!pendingMove) return null;
		const t = pendingMove.target;
		const btns: h.JSX.Element[] = [];
		if (t !== 'adjacentAlly' && t !== 'adjacentAllyOrSelf') {
			scene.p2.active.forEach((m, i) => {
				if (!m || m.fainted) return;
				const mv = activeReq?.moves[pendingMove.num - 1];
				let eff = '';
				const b = sessionRef.current?.battle;
				const tg = b?.p2.active[i];
				const md = mv ? b?.dex.moves.get(mv.id) : null;
				if (md && tg && md.category !== 'Status') {
					const e = !b.dex.getImmunity(md.type, tg) ? 0 : Math.pow(2, b.dex.getEffectiveness(md.type, tg));
					eff = e === 0 ? '효과 없음' : e >= 2 ? '효과 굉장' : e < 1 ? '효과 별로' : '';
				}
				const dp = mv ? dmgPreview(mv, 'p2', i) : '';
				btns.push(<button class="btn target foe" onClick={() => pushChoice(`move ${pendingMove.num} ${i + 1}${pendingMove.gm || ''}`)}>상대 {m.nick}{eff && <small class="block">{eff}</small>}{dp && <small class="block">{dp}</small>}</button>);
			});
		}
		scene.p1.active.forEach((m, i) => {
			if (!m || m.fainted) return;
			const self = i === slotIdx;
			if (self && t !== 'adjacentAllyOrSelf') return;
			if (!self && t === 'adjacentFoe') return;
			btns.push(<button class="btn target ally" onClick={() => pushChoice(`move ${pendingMove.num} -${i + 1}${pendingMove.gm || ''}`)}>{self ? '자신' : '같은 편'} {m.nick}</button>);
		});
		return <div class="target-grid">{btns}</div>;
	};

	const renderSwitch = () => {
		if (!reqMon) return null;
		const trapped = activeReq?.trapped && !req.forceSwitch;
		const chosen = new Set(parts.filter(p => p.startsWith('switch')).map(p => parseInt(p.slice(7), 10)));
		return <div class="switch-list">
			{trapped && <div class="hint">도망칠 수 없어서 교체할 수 없다!</div>}
			{reqMon.map((p: any, i: number) => {
				const hp = parseHP(p.condition);
				const nick = p.ident.slice(4);
				const species = p.details.split(',')[0];
				const isActive = p.active;
				const fainted = hp.status === 'fnt';
				const disabled = isActive || fainted || trapped || chosen.has(i + 1);
				return <button key={i} class={'switch-btn' + (isActive ? ' active' : '') + (disabled ? ' off' : '')}
					onClick={() => setSheet({ idx: i, canSwitch: !disabled })}>
					<span class="sw-sprite"><Sprite species={species} gen={gen} size={40} anim={false} /></span>
					<span class="sw-info">
						<b>{nick}</b>
						<HPBar hp={hp.hp} maxhp={hp.maxhp || 1} />
						<small>{fainted ? '기절' : `${hp.hp}/${hp.maxhp}`} {hp.status && hp.status !== 'fnt' && <StatusBadge status={hp.status} />}{isActive && ' · 배틀 중'}</small>
					</span>
				</button>;
			})}
		</div>;
	};

	const controls = () => {
		if (phase === 'ended') {
			return <div class="controls end">
				<button class="btn primary big" onClick={finish}>계속</button>
				<button class="btn ghost" onClick={() => setShowLog(true)}>배틀 기록</button>
			</div>;
		}
		if (phase !== 'input' || !req) {
			return <div class="controls waiting">
				<button class={'btn small' + (fast ? ' on' : '')} onClick={() => { fastRef.current = !fastRef.current; setFast(fastRef.current); skipRef.current?.(); }}>
					{fast ? '▶▶ 빨리감기 켜짐' : '▶▶ 빨리감기'}</button>
			</div>;
		}
		const back = (parts.length || menu !== 'main') && !(req.forceSwitch && !parts.length) ?
			<button class="btn small" onClick={() => {
				if (menu === 'target') setMenu('moves');
				else if (menu !== 'main' && !req.forceSwitch) setMenu('main');
				else cancelChoice();
			}}>◀ 뒤로</button> : null;
		const usedG = parts.join(' ');
		const g: [string, string][] = [];
		if (activeReq && menu === 'moves') {
			if (!/ mega| ultra/.test(usedG)) {
				if (activeReq.canMegaEvo) g.push(['mega', '메가진화']);
				if (activeReq.canMegaEvoX) g.push(['megax', '메가 X']);
				if (activeReq.canMegaEvoY) g.push(['megay', '메가 Y']);
				if (activeReq.canUltraBurst) g.push(['ultra', '울트라버스트']);
			}
			if (activeReq.canZMove && !/ zmove/.test(usedG)) g.push(['zmove', 'Z파워']);
			if (activeReq.canDynamax && !/ dynamax/.test(usedG)) g.push(['dynamax', '다이맥스']);
			if (activeReq.canTerastallize && !/ terastallize/.test(usedG)) g.push(['terastallize', `테라스탈 ${typeKo(activeReq.canTerastallize)}`]);
		}
		return <div class="controls">
			<div class="ctl-head">
				<span class="ctl-title">{req.forceSwitch ? '교체할 포켓몬' : curMon ? `${curMon.nick}` : ''}{setup.doubles && !req.forceSwitch ? ` (${slotIdx + 1})` : ''}</span>
				{g.map(([k, label]) => <button class={'gm gm-' + k + (gimmick === k ? ' on' : '')} onClick={() => setGimmick(gimmick === k ? '' : k)}>{gimmick === k ? '✔' : ''}{label}</button>)}
				{back}
			</div>
			{menu === 'main' && <div class="cmd-grid win-dark">
				<button class="cmd" onClick={() => { setFocus(0); setMenu('moves'); }}>싸운다</button>
				<button class="cmd" onClick={() => setMenu('switch')}>포켓몬</button>
				<button class="cmd" onClick={() => setFieldOpen(true)}>필드</button>
				<button class="cmd" onClick={() => setShowLog(true)}>기록</button>
				<button class="cmd" onClick={forfeit}>기권</button>
			</div>}
			{menu === 'moves' && renderMoves()}
			{menu === 'target' && renderTargets()}
			{menu === 'switch' && renderSwitch()}
		</div>;
	};

	const infoBox = (mon: Mon | null, own: boolean, i: number) => {
		if (!mon || (mon.fainted && !mon.anim)) return <div class="info empty" key={i} />;
		const boosts = Object.entries(mon.boosts).filter(([, v]) => v);
		const vols = [...mon.vol].filter(v => VOLATILE_KO[v]);
		return <div class={'info ' + (own ? 'own' : 'foe') + ' i' + i} key={i} onClick={() => setDetail({ mon, own })}>
			<div class="info-top">
				<b class="info-name">{mon.nick}</b>
				{mon.gender && <span class={'gender ' + mon.gender}>{mon.gender === 'M' ? '♂' : '♀'}</span>}
				<span class="lv">Lv{mon.level}</span>
			</div>
			<HPBar hp={mon.hp} maxhp={mon.maxhp} />
			<div class="info-bottom">
				<StatusBadge status={mon.status} />
				{own ? <span class="hp-num">{mon.hp}/{mon.maxhp}</span> : <span class="hp-num">{mon.maxhp ? Math.ceil(mon.hp / mon.maxhp * 100) : 0}%</span>}
			</div>
			{(boosts.length > 0 || vols.length > 0) && <div class="chips">
				{boosts.map(([k, v]) => <span class={'chip ' + (v > 0 ? 'up' : 'down')}>{STAT_SHORT[k] || STAT_KO[k]}{v > 0 ? '+' : ''}{v}</span>)}
				{vols.map(v => <span class="chip vol">{VOLATILE_KO[v]}</span>)}
			</div>}
			{mon.tera && <span class="tera-badge" style={{ background: TYPE_COLOR[mon.tera] }}>테라 {typeKo(mon.tera)}</span>}
		</div>;
	};

	const spriteSlot = (mon: Mon | null, own: boolean, i: number) => {
		const pos = (own ? 'own' : 'foe') + ' s' + i;
		if (!mon || (mon.fainted && !mon.anim) || mon.hidden) return <div class={'slot ' + pos} key={i} />;
		return <div class={'slot ' + pos + ' ' + (mon.anim || '') + (mon.vol.has('dynamax') ? ' dmax' : '') + (mon.tera ? ' tera' : '')} key={i}
			style={mon.tera ? { '--tera': TYPE_COLOR[mon.tera] } as any : undefined} onClick={() => setDetail({ mon, own })}>
			{mon.vol.has('substitute') ? <Sprite species="substitute" back={own} gen={gen} size={400} cls={own ? 'back' : 'front'} /> :
				<Sprite species={mon.transformed || mon.species} back={own} shiny={mon.shiny} gen={gen} size={400} cls={own ? 'back' : 'front'} />}
		</div>;
	};

	const sideChips = (side: SideScene) => Object.entries(side.cond).map(([id, n]) =>
		<span class="chip side">{SIDE_KO[id] || id}{n > 1 ? `×${n}` : ''}</span>);
	const teamDots = (side: SideScene, own: boolean) => {
		const total = side.teamSize;
		const dots = [];
		for (let i = 0; i < total; i++) {
			const m = own ? side.team[i] : side.team[i];
			const cls = !m ? 'unk' : m.fainted ? 'fnt' : m.status ? 'sts' : 'ok';
			dots.push(<span class={'ball ' + cls} />);
		}
		return <div class={'balls ' + (own ? 'own' : 'foe')}>{dots}</div>;
	};

	/** 시뮬레이터의 내 포켓몬 → 상세 시트용 데이터 */
	function liveOf(idx: number): { set: PSet; live: LiveInfo } | null {
		const sm = sessionRef.current?.battle.p1.pokemon[idx];
		if (!sm) return null;
		const pp: LiveInfo['pp'] = {};
		const moves = sm.baseMoveSlots.map((m: any) => {
			const id = m.id === 'hiddenpower' && sm.hpType ? 'hiddenpower' + sm.hpType.toLowerCase() : m.id;
			pp[toID(id)] = [m.pp, m.maxpp];
			return id;
		});
		return {
			set: { name: sm.name, species: sm.species.name, item: sm.item, ability: sm.ability, moves, nature: sm.set.nature || 'serious',
				evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sm.set.evs }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...sm.set.ivs },
				level: sm.level, shiny: sm.set.shiny, teraType: sm.terastallized || sm.teraType },
			live: { hp: sm.hp, maxhp: sm.maxhp, status: sm.status, pp, stats: { hp: sm.maxhp, ...sm.storedStats }, boosts: sm.isActive ? sm.boosts : undefined },
		};
	}

	// 내 팀 순서대로 미리 채우기
	if (reqMon && scene.p1.team.length < reqMon.length) {
		for (const p of reqMon) {
			const nick = p.ident.slice(4);
			if (!scene.p1.team.find(m => m.nick === nick)) {
				const d = parseDetails(p.details);
				const hp = parseHP(p.condition);
				scene.p1.team.push({ ident: 'p1: ' + nick, nick, species: d.species, level: d.level, gender: d.gender, shiny: d.shiny,
					hp: hp.hp, maxhp: hp.maxhp, status: hp.status === 'fnt' ? '' : hp.status, fainted: hp.status === 'fnt', boosts: {}, vol: new Set(), anim: '', seen: [] });
			}
		}
	}

	const slots = setup.doubles ? [0, 1] : [0];
	return <div class={'battle bg-' + (setup.bg || 'field') + (setup.doubles ? ' doubles' : ' singles')}>
		<div class={'arena' + (trainerVis.foe ? ' t-foe' : '')} ref={arenaRef} style={{ '--s': scale } as any} onClick={() => skipRef.current?.()}>
			<div class="arena-bg" />
			<div class={'weather-ov ' + (scene.weather || '') + ' ' + [...scene.pseudo].join(' ')} />
			<div class="anim-bg-layer" ref={animBgRef} />
			<canvas class="anim-canvas back" ref={backRef} />
			{setup.p2.sprite && <img class={'trainer-spr foe' + (trainerVis.foe ? ' in' : '')} src={SPRITE_URL(setup.p2.sprite)} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />}
			{setup.p1.sprite && <img class={'trainer-spr own' + (trainerVis.own ? ' in' : '')} src={SPRITE_URL(setup.p1.sprite)} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />}
			{slots.map(i => spriteSlot(scene.p2.active[i] || null, false, i))}
			{slots.map(i => spriteSlot(scene.p1.active[i] || null, true, i))}
			<canvas class="anim-canvas front" ref={frontRef} />
			<div class="fx-layer" ref={fxRef} />
			<div class="hud-top">
				<span class="badge">{setup.label || ''}</span>
				<span class="badge">{scene.turn ? `${scene.turn}턴` : ''}</span>
				<button class="badge field-btn" onClick={e => { e.stopPropagation(); setFieldOpen(true); }}>필드 ▸</button>
			</div>
			<div class="hud-cond">
				{scene.weather && WEATHER_KO[scene.weather] && <span class="chip weather">{WEATHER_KO[scene.weather]}</span>}
				{[...scene.pseudo].map(id => <span class="chip field">{PSEUDO_KO[id] || id}</span>)}
			</div>
			<div class="panels foe">
				<div class="side-row">{teamDots(scene.p2, false)}{sideChips(scene.p2)}</div>
				{slots.map(i => infoBox(scene.p2.active[i] || null, false, i))}
			</div>
			<div class="panels own">
				{slots.map(i => infoBox(scene.p1.active[i] || null, true, i))}
				<div class="side-row">{sideChips(scene.p1)}{teamDots(scene.p1, true)}</div>
			</div>
		</div>
		<div class="bottom">
			<div class="msgbox win-dark" onClick={() => skipRef.current?.()}>
				<p>{message}</p>
				{phase === 'playing' && <span class="msg-arrow">▼</span>}
			</div>
			{controls()}
		</div>
		{fieldOpen && <FieldModal session={sessionRef.current!} onClose={() => setFieldOpen(false)} />}
		{showLog && <Modal title="배틀 기록" onClose={() => setShowLog(false)}>
			<div class="log">{log.map((l, i) => <div key={i} class={l.startsWith('──') ? 'log-turn' : ''}>{l}</div>)}</div>
		</Modal>}
		{sheet && (() => {
			const d = liveOf(sheet.idx);
			if (!d) return null;
			const reason = !sheet.canSwitch ? (d.live.hp <= 0 ? '쓰러져서 낼 수 없다.' : reqMon?.[sheet.idx]?.active ? '지금 배틀에 나와 있다.' : activeReq?.trapped ? '도망칠 수 없어서 교체할 수 없다!' : '') : '';
			return <MonSheet set={d.set} gen={gen} live={d.live} note={reason} onClose={() => setSheet(null)} actions={phase === 'input' && menu === 'switch' ? [
				{ label: req?.forceSwitch ? '내보낸다' : '교체한다', disabled: !sheet.canSwitch, onClick: () => { const i = sheet.idx; setSheet(null); pushChoice(`switch ${i + 1}`); } },
				{ label: '닫기', kind: 'ghost', onClick: () => setSheet(null) },
			] : [{ label: '닫기', kind: 'ghost', onClick: () => setSheet(null) }]} />;
		})()}
		{detail && (detail.own ? (() => {
			const idx = sessionRef.current!.battle.p1.pokemon.findIndex((p: any) => p.name === detail.mon.nick);
			const d = idx >= 0 ? liveOf(idx) : null;
			return d ? <MonSheet set={d.set} gen={gen} live={d.live} onClose={() => setDetail(null)} actions={[{ label: '닫기', kind: 'ghost', onClick: () => setDetail(null) }]} /> : null;
		})() : <MonDetail mon={detail.mon} own={detail.own} gen={gen} session={sessionRef.current!} onClose={() => setDetail(null)} />)}
	</div>;
}

const RXp = (re: RegExp, id: string) => re.test(id);

const TERRAIN_KO: { [id: string]: string } = { electricterrain: '일렉트릭필드', grassyterrain: '그래스필드', mistyterrain: '미스트필드', psychicterrain: '사이코필드' };
const SIDE_COND_KO: { [id: string]: string } = { ...SIDE_KO, auroraveil: '오로라베일', craftyshield: '트릭가드', matblock: '마룻바닥세워막기', luckychant: '행운의주술', stickyweb: '끈적끈적네트' };
/** 필드 상황: 날씨·필드·방·양쪽 설치기와 남은 턴 */
function FieldModal({ session, onClose }: { session: Session; onClose: () => void }) {
	const b = session.battle;
	const turns = (st: any) => st?.duration ? `${st.duration}턴 남음` : st?.id ? '지속' : '';
	const w = b.field.weatherState, t = b.field.terrainState;
	const pw = Object.entries(b.field.pseudoWeather || {}) as [string, any][];
	const sideInfo = (side: any, label: string) => {
		const conds = Object.entries(side.sideConditions || {}) as [string, any][];
		return <div class="field-side">
			<b>{label}</b>
			{!conds.length && <span class="muted"> 없음</span>}
			{conds.map(([id, st]) => <div class="field-row"><span>{SIDE_COND_KO[id] || id}{st.layers > 1 ? ` ×${st.layers}` : ''}</span><span class="muted">{turns(st)}</span></div>)}
			{side.active.filter((p: any) => p && !p.fainted).map((p: any) => {
				const vols = Object.entries(p.volatiles || {}).filter(([id]) => VOLATILE_KO[id] || /^perish|^stockpile/.test(id)).map(([id, st]: any) => `${VOLATILE_KO[id] || id}${st?.duration ? `(${st.duration}턴)` : ''}`);
				const st = p.status ? `${STATUS_LABEL_KO[p.status] || p.status}${p.status === 'slp' && p.statusState?.time ? `(최대 ${p.statusState.time}턴)` : ''}` : '';
				return (vols.length || st) ? <div class="field-row"><span>{p.name}</span><span class="muted">{[st, ...vols].filter(Boolean).join(' · ')}</span></div> : null;
			})}
		</div>;
	};
	return <Modal title={`필드 상황 · ${b.turn}턴`} onClose={onClose}>
		<div class="field-info">
			<div class="field-row"><span>날씨</span><b>{w?.id ? `${WEATHER_KO[w.id] || w.id} · ${turns(w)}` : '없음'}</b></div>
			<div class="field-row"><span>필드</span><b>{t?.id ? `${TERRAIN_KO[t.id] || t.id} · ${turns(t)}` : '없음'}</b></div>
			{pw.map(([id, st]) => <div class="field-row"><span>{PSEUDO_KO[id] || id}</span><b>{turns(st)}</b></div>)}
			{sideInfo(b.p1, '우리 편')}
			{sideInfo(b.p2, '상대 편')}
		</div>
	</Modal>;
}
const STATUS_LABEL_KO: { [s: string]: string } = { brn: '화상', par: '마비', slp: '잠듦', frz: '얼음', psn: '독', tox: '맹독' };

function josaSubject(word: string) {
	const ch = word.charCodeAt(word.length - 1);
	if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 ? '이' : '가';
	return '가';
}

function josaTopic(word: string) {
	const ch = word.charCodeAt(word.length - 1);
	if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 ? '은' : '는';
	return '는';
}

function MonDetail({ mon, own, gen, session, onClose }: { mon: Mon; own: boolean; gen: Gen; session: Session; onClose: () => void }) {
	const sd = speciesData(toID(mon.transformed || mon.species), gen);
	const simMon = session.battle[own ? 'p1' : 'p2'].pokemon.find((p: any) => p.name === mon.nick);
	const boosts = Object.entries(mon.boosts).filter(([, v]) => v);
	return <Modal title={`${mon.nick} Lv${mon.level}`} onClose={onClose}>
		<div class="detail">
			<div class="detail-head">
				<Sprite species={mon.transformed || mon.species} gen={gen} size={96} shiny={mon.shiny} />
				<div>
					<div class="types">{sd?.t.map(t => <TypeBadge type={t} />)}</div>
					<div>{speciesKo(mon.species)} {mon.gender === 'M' ? '♂' : mon.gender === 'F' ? '♀' : ''}</div>
					<div>HP {own ? `${mon.hp}/${mon.maxhp}` : `${mon.maxhp ? Math.ceil(mon.hp / mon.maxhp * 100) : 0}%`} <StatusBadge status={mon.status} /></div>
				</div>
			</div>
			{boosts.length > 0 && <p>능력 변화: {boosts.map(([k, v]) => `${STAT_KO[k]} ${v > 0 ? '+' : ''}${v}`).join(', ')}</p>}
			{own && simMon ? <>
				<p><b>특성</b> {abilityKo(simMon.baseAbility)} <small class="muted">{abilityDesc(simMon.baseAbility)}</small></p>
				<p><b>도구</b> {simMon.item ? itemKo(simMon.item) : '없음'} <small class="muted">{simMon.item ? itemDesc(simMon.item) : ''}</small></p>
				<p><b>성격</b> {natureKo(simMon.set.nature || 'serious')}</p>
				<table class="stat-table"><tbody>
					{(['atk', 'def', 'spa', 'spd', 'spe'] as const).map(k => <tr><th>{STAT_KO[k]}</th><td>{simMon.storedStats[k]}</td></tr>)}
				</tbody></table>
				<ul class="move-list">{simMon.moveSlots.map((m: any) => <li>{moveKo(m.id === 'hiddenpower' ? 'hiddenpower' + (simMon.hpType || '').toLowerCase() : m.id)} <small>{m.pp}/{m.maxpp}</small></li>)}</ul>
			</> : <>
				{sd && <p class="muted">종족값 {sd.bs.join(' / ')}</p>}
				{sd && (() => {
					const b = session.battle;
					const types = mon.tera ? [mon.tera] : sd.t;
					const eff = (t: string) => { const fake = { getTypes: () => types, hasType: (x: string) => types.includes(x), types } as any; try { return !b.dex.getImmunity(t, types) ? 0 : Math.pow(2, b.dex.getEffectiveness(t, types)); } catch { void fake; return 1; } };
					const all = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
					const weak = all.filter(t => eff(t) >= 2), resist = all.filter(t => eff(t) < 1);
					return <>
						<p><b>약점</b> {weak.length ? weak.map(t => <TypeBadge type={t} small />) : '없음'}</p>
						<p><b>반감·무효</b> {resist.length ? resist.map(t => <TypeBadge type={t} small />) : '없음'}</p>
					</>;
				})()}
				{mon.seen.length > 0 && <p><b>사용한 기술</b> {mon.seen.map(m => moveKo(m)).join(', ')}</p>}
				{mon.ability && <p><b>특성</b> {abilityKo(mon.ability)}</p>}
				{mon.item !== undefined && <p><b>도구</b> {mon.item ? itemKo(mon.item) : '없음'}</p>}
				{sd && <p class="muted">가능한 특성: {sd.ab.map(a => abilityKo(a)).join(', ')}</p>}
			</>}
		</div>
	</Modal>;
}
void Fragment;
