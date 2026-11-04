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

export interface BattleSetup {
	gen: Gen;
	doubles: boolean;
	p1: { name: string; team: PSet[] };
	p2: { name: string; title?: string; team: PSet[]; line?: string };
	aiSkill: number;
	label?: string; // 예: '배틀타워 12번째'
	bg?: 'tower' | 'factory' | 'pwt' | 'field' | 'champion';
}
export interface BattleResult { win: boolean; forfeit: boolean; turns: number; p1Left: number; p2Left: number }

interface Mon {
	ident: string; nick: string; species: string; level: number; gender: string; shiny: boolean;
	hp: number; maxhp: number; status: string; fainted: boolean; boosts: { [k: string]: number };
	vol: Set<string>; anim: string; ability?: string; item?: string; transformed?: string; hidden?: boolean; tera?: string;
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
				hp: 100, maxhp: 100, status: '', fainted: false, boosts: {}, vol: new Set(), anim: '',
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
			animate(mon, 'enter', 600);
			return 350;
		}
		case 'faint': {
			const mon = activeMon(args[1]);
			if (mon) { mon.fainted = true; mon.hp = 0; animate(mon, 'faint', 900); }
			return 500;
		}
		case 'move': {
			const mon = activeMon(args[1]);
			animate(mon, args[1].startsWith('p1') ? 'attack-own' : 'attack-foe', 450);
			return 250;
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
			if (cmd === '-damage' && !kw.from) animate(mon, 'hit', 450);
			return before !== mon.hp ? 550 : 0;
		}
		case '-status': { const m = activeMon(args[1]); if (m) m.status = args[2]; return 0; }
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
		case '-terastallize': { const m = activeMon(args[1]); if (m) { m.tera = args[2]; animate(m, 'enter', 600); } return 500; }
		case '-mega': case '-primal': case '-burst': { const m = activeMon(args[1]); animate(m, 'enter', 600); return 400; }
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
			// 교체 메시지는 들어가기 전에
			if (msgs.length && (p.cmd === 'switch' || p.cmd === 'drag') && prev && !prev.fainted && msgs.length > 1) {
				showMsg(msgs.shift()!);
				const side = sceneRef.current[p.args[1].slice(0, 2) as 'p1' | 'p2'];
				const cur = side.active[slotOf(p.args[1])];
				if (cur) animate(cur, 'leave', 500);
				rerender();
				await wait(SPEED_MS[settings.speed] * 0.7);
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
			showMsg(win ? `${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}에게 이겼다!` : '눈앞이 깜깜해졌다…');
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
		(async () => {
			if (setup.p2.line) {
				setMessage(`${setup.p2.title ? setup.p2.title + ' ' : ''}${setup.p2.name}: “${setup.p2.line}”`);
				pushLog(`${setup.p2.name}: “${setup.p2.line}”`);
				await wait(SPEED_MS[settings.speed] * 1.6);
			}
			await play(lines);
		})();
		return () => { skipRef.current?.(); };
	}, []);

	const scene = sceneRef.current;
	const req = sessionRef.current?.p1Request;

	function finish() {
		const s = sessionRef.current!;
		const win = s.winner === setup.p1.name;
		const alive = (side: 'p1' | 'p2') => s.battle[side].pokemon.filter((p: any) => !p.fainted).length;
		onEnd({ win, forfeit: !win && s.battle.turn > 0 && alive('p1') > 0, turns: s.battle.turn, p1Left: alive('p1'), p2Left: alive('p2') });
	}

	// ── 렌더링 ──
	const reqMon = req?.side?.pokemon;
	const activeReq = req?.active?.[slotIdx];
	const curMon = scene.p1.active[slotIdx];

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
		const usedG = parts.join(' ');
		const g: [string, string][] = [];
		if (!/ mega| ultra/.test(usedG)) {
			if (activeReq.canMegaEvo) g.push(['mega', '메가진화']);
			if (activeReq.canMegaEvoX) g.push(['megax', '메가진화 X']);
			if (activeReq.canMegaEvoY) g.push(['megay', '메가진화 Y']);
			if (activeReq.canUltraBurst) g.push(['ultra', '울트라버스트']);
		}
		if (activeReq.canZMove && !/ zmove/.test(usedG)) g.push(['zmove', 'Z파워']);
		if (activeReq.canDynamax && !/ dynamax/.test(usedG)) g.push(['dynamax', '다이맥스']);
		if (activeReq.canTerastallize && !/ terastallize/.test(usedG)) g.push(['terastallize', `테라스탈(${typeKo(activeReq.canTerastallize)})`]);
		return <div class="move-panel">
			{g.length > 0 && <div class="gimmicks">{g.map(([k, label]) =>
				<button class={'btn small gm gm-' + k + (gimmick === k ? ' on' : '')} onClick={() => setGimmick(gimmick === k ? '' : k)}>{gimmick === k ? '✔ ' : ''}{label}</button>)}</div>}
			<div class="move-grid win-dark">
				{activeReq.moves.map((m: any, i: number) => {
					const { type, name, eff } = moveInfo(m, i);
					const disabled = m.disabled || (m.pp === 0 && m.id !== 'struggle') || (gimmick === 'zmove' && !activeReq.canZMove?.[i]);
					return <button key={i} class={'move-btn' + (focus === i ? ' focus' : '')} disabled={disabled}
						style={{ '--tc': TYPE_COLOR[type] } as any}
						onPointerDown={() => setFocus(i)} onClick={() => onMove(i + 1, m)}>
						<span class="mv-name">{name}</span>
						<span class="mv-sub"><TypeBadge type={type} small /><span class="mv-pp">{m.maxpp ? `${m.pp}/${m.maxpp}` : ''}</span></span>
						{eff && eff !== '보통' && <span class={'mv-eff ' + (eff.includes('굉장') ? 'good' : 'bad')}>{eff}</span>}
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
				btns.push(<button class="btn target foe" onClick={() => pushChoice(`move ${pendingMove.num} ${i + 1}${pendingMove.gm || ''}`)}>상대 {m.nick}</button>);
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
				return <button key={i} class={'switch-btn' + (isActive ? ' active' : '')} disabled={disabled}
					onClick={() => pushChoice(`switch ${i + 1}`)}>
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
		return <div class="controls">
			<div class="ctl-head">
				<span>{req.forceSwitch ? '교체할 포켓몬을 고르세요' : curMon ? `${curMon.nick}의 행동` : ''}{setup.doubles && !req.forceSwitch ? ` · ${slotIdx + 1}번째` : ''}</span>
				{back}
			</div>
			{menu === 'main' && <div class="cmd-grid win-dark">
				<button class="cmd" onClick={() => { setFocus(0); setMenu('moves'); }}>싸운다</button>
				<button class="cmd" onClick={() => setMenu('switch')}>포켓몬</button>
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
		if (!mon || (mon.fainted && !mon.anim)) return <div class={'slot ' + pos} key={i} />;
		return <div class={'slot ' + pos + ' ' + (mon.anim || '') + (mon.vol.has('dynamax') ? ' dmax' : '') + (mon.tera ? ' tera' : '')} key={i}
			style={mon.tera ? { '--tera': TYPE_COLOR[mon.tera] } as any : undefined} onClick={() => setDetail({ mon, own })}>
			{mon.vol.has('substitute') ? <div class="sub-doll">대타</div> :
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

	// 내 팀 순서대로 미리 채우기
	if (reqMon && scene.p1.team.length < reqMon.length) {
		for (const p of reqMon) {
			const nick = p.ident.slice(4);
			if (!scene.p1.team.find(m => m.nick === nick)) {
				const d = parseDetails(p.details);
				const hp = parseHP(p.condition);
				scene.p1.team.push({ ident: 'p1: ' + nick, nick, species: d.species, level: d.level, gender: d.gender, shiny: d.shiny,
					hp: hp.hp, maxhp: hp.maxhp, status: hp.status === 'fnt' ? '' : hp.status, fainted: hp.status === 'fnt', boosts: {}, vol: new Set(), anim: '' });
			}
		}
	}

	const slots = setup.doubles ? [0, 1] : [0];
	return <div class={'battle bg-' + (setup.bg || 'field') + (setup.doubles ? ' doubles' : ' singles')}>
		<div class="arena" ref={arenaRef} style={{ '--s': scale } as any} onClick={() => skipRef.current?.()}>
			<div class="arena-bg" />
			{slots.map(i => spriteSlot(scene.p2.active[i] || null, false, i))}
			{slots.map(i => spriteSlot(scene.p1.active[i] || null, true, i))}
			<div class="hud-top">
				<span class="badge">{setup.label || ''}</span>
				<span class="badge">{scene.turn ? `${scene.turn}턴` : ''}</span>
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
		{showLog && <Modal title="배틀 기록" onClose={() => setShowLog(false)}>
			<div class="log">{log.map((l, i) => <div key={i} class={l.startsWith('──') ? 'log-turn' : ''}>{l}</div>)}</div>
		</Modal>}
		{detail && <MonDetail mon={detail.mon} own={detail.own} gen={gen} session={sessionRef.current!} onClose={() => setDetail(null)} />}
	</div>;
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
				{mon.ability && <p><b>특성</b> {abilityKo(mon.ability)}</p>}
				{mon.item !== undefined && <p><b>도구</b> {mon.item ? itemKo(mon.item) : '없음'}</p>}
				{sd && <p class="muted">가능한 특성: {sd.ab.map(a => abilityKo(a)).join(', ')}</p>}
			</>}
		</div>
	</Modal>;
}
void Fragment;
