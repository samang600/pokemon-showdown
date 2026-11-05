/** 시뮬레이터(Battle) 를 감싸 플레이어(p1) ↔ AI(p2) 대전을 진행 */
import { Battle } from '../../sim/battle';
import type { PokemonSet } from '../../sim/teams';
import { chooseAI } from './ai';
import { loadSettings } from './store';
import { ruleById, megaStoneAllowed, type BattleRule, type GimmickKind } from './rules';

export interface SideConfig { name: string; team: PokemonSet[] }
export interface SessionConfig {
	gen: 4 | 5;
	doubles: boolean;
	p1: SideConfig;
	p2: SideConfig;
	aiSkill: number; // 0~1
	seed?: [number, number, number, number];
	/** 배틀 규칙 id (없으면 설정값) */
	ruleId?: string;
}

export class Session {
	battle: Battle;
	private pending: string[] = [];
	p1Request: any = null;
	p2Request: any = null;
	private p2Answered: any = null;
	/** 각 진영이 이번 배틀에 쓴 기믹 종류 */
	gimmickUsed: { p1: Set<GimmickKind>; p2: Set<GimmickKind> } = { p1: new Set(), p2: new Set() };
	/** 규칙상 추가로 허용한 다이맥스 (시뮬레이터 요청에 넣어 줄 것) */
	private extraDmax: { [side: string]: { [i: number]: any } } = {};
	ended = false;
	winner = '';
	lastError = '';

	rule: BattleRule;

	constructor(public cfg: SessionConfig) {
		this.rule = ruleById(cfg.ruleId || loadSettings().battleRule);
		const formatid = `gen${cfg.gen}kr${cfg.doubles ? 'doubles' : 'singles'}`;
		this.battle = new Battle({
			formatid: formatid as any,
			...(cfg.seed ? { seed: 'gen5,' + cfg.seed.map(n => n.toString(16).padStart(4, '0')).join('') } : {}),
			send: (type: string, data: any) => this.receive(type, data),
		} as any);
	}

	private receive(type: string, data: any) {
		if (type === 'update') {
			const lines: string[] = Array.isArray(data) ? data : String(data).split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.startsWith('|split|')) {
					// 다음 줄(비공개 = 정확한 HP)만 쓰고, 그다음 줄(공개)은 건너뜀
					this.pending.push(lines[i + 1]);
					i += 2;
					continue;
				}
				this.pending.push(line);
				const gm = gimmickOfLine(line);
				if (gm) this.gimmickUsed[gm[0]].add(gm[1]);
				if (line.startsWith('|win|')) { this.ended = true; this.winner = line.slice(5); }
				if (line === '|tie') { this.ended = true; this.winner = ''; }
			}
		} else if (type === 'sideupdate') {
			const str = String(data);
			const nl = str.indexOf('\n');
			const side = str.slice(0, nl);
			const rest = str.slice(nl + 1);
			if (rest.startsWith('|request|')) {
				const req = JSON.parse(rest.slice(9));
				this.applyGimmickRule(req, side as 'p1' | 'p2');
				if (side === 'p1') this.p1Request = req;
				else if (side === 'p2') this.p2Request = req;
			} else if (rest.startsWith('|error|')) {
				if (side === 'p1') this.lastError = rest.slice(7);
			}
		} else if (type === 'end') {
			this.ended = true;
		}
	}

	/** 기믹 규칙 적용 (설정의 '기믹 규칙')
	 *  one: 한 배틀에 한 종류(처음 쓴 종류만, 1회) / free: 종류마다 1회 / mega·zmove·dynamax·tera: 그 기믹만 / none: 사용 불가 */
	private applyGimmickRule(req: any, side: 'p1' | 'p2') {
		this.extraDmax[side] = filterGimmicks(req, this.rule, this.gimmickUsed[side], this.battle[side]);
	}
	/** 규칙으로 추가 허용한 다이맥스를 시뮬레이터 쪽 요청에도 넣는다 (선택 직전) */
	private syncSimRequest(side: 'p1' | 'p2') {
		const extra = this.extraDmax[side];
		const ar = this.battle[side].activeRequest as any;
		if (!extra || !ar?.active) return;
		for (const i in extra) if (ar.active[i]) { ar.active[i].canDynamax = true; ar.active[i].maxMoves = extra[i]; }
	}

	private flush() {
		const out = this.pending;
		this.pending = [];
		return out;
	}

	private runAI() {
		for (let guard = 0; guard < 8 && !this.ended; guard++) {
			const req = this.p2Request;
			if (!req || req.wait || req === this.p2Answered) return;
			this.p2Answered = req;
			let choice = 'default';
			try {
				choice = chooseAI(this.battle, req, 'p2', this.cfg.aiSkill);
			} catch (e) {
				console.error('AI 오류', e);
			}
			this.syncSimRequest('p2');
			if (!this.battle.choose('p2', choice)) this.battle.choose('p2', 'default');
			this.battle.sendUpdates();
		}
	}

	start(): string[] {
		this.battle.setPlayer('p1', { name: this.cfg.p1.name, team: this.cfg.p1.team } as any);
		this.battle.setPlayer('p2', { name: this.cfg.p2.name, team: this.cfg.p2.team } as any);
		this.battle.sendUpdates();
		this.runAI();
		return this.flush();
	}

	/** 플레이어 선택. 잘못된 선택이면 null */
	choose(choice: string): string[] | null {
		this.lastError = '';
		const prevReq = this.p1Request;
		this.syncSimRequest('p1');
		const ok = this.battle.choose('p1', choice);
		if (!ok) {
			this.p1Request = prevReq;
			return null;
		}
		this.battle.sendUpdates();
		this.runAI();
		return this.flush();
	}

	forfeit(): string[] {
		this.battle.forceWin('p2');
		this.battle.sendUpdates();
		return this.flush();
	}
}

/** 요청(request)을 배틀 규칙에 맞춘다. 규칙상 안 되는 기믹은 지우고, 쇼다운이 막아 둔 것(메가스톤 소지 포켓몬의 테라스탈·다이맥스 등)은 열어 준다.
 *  반환: 추가로 허용한 다이맥스 {슬롯: maxMoves} (시뮬레이터 요청에 넣어 줄 것) */
export function filterGimmicks(req: any, rule: BattleRule, used: Set<GimmickKind>, simSide: any): { [i: number]: any } {
	const extra: { [i: number]: any } = {};
	if (!req?.active) return extra;
	const allow = (k: GimmickKind) => rule.kinds.includes(k) && !used.has(k) && !(rule.oneKind && used.size > 0);
	const dmaxNow = simSide?.active?.some((p: any) => p?.volatiles['dynamax']);
	req.active.forEach((a: any, i: number) => {
		if (!a) return;
		const p = simSide?.active?.[i];
		// 메가진화: 규칙·허용 메가 목록
		const stoneOk = p ? megaStoneAllowed(rule, p.item) : allow('mega');
		if (!allow('mega') || !stoneOk) { delete a.canMegaEvo; delete a.canMegaEvoX; delete a.canMegaEvoY; }
		if (!allow('mega')) delete a.canUltraBurst;
		if (!allow('zmove')) delete a.canZMove;
		// 테라스탈: 쇼다운은 메가스톤 소지 포켓몬의 테라스탈을 막아 두므로 규칙상 되면 열어 준다
		if (!allow('tera')) delete a.canTerastallize;
		else if (p && !a.canTerastallize && !p.terastallized && p.canTerastallize === null && !['Ogerpon', 'Terapagos'].includes(p.species.baseSpecies)) {
			p.canTerastallize = p.teraType; a.canTerastallize = p.teraType;
		}
		// 다이맥스
		if (!allow('dynamax')) { delete a.canDynamax; if (!dmaxNow) delete a.maxMoves; }
		else if (p && !a.canDynamax && !p.volatiles['dynamax'] && simSide.canDynamaxNow?.() && !p.species.isMega && !p.species.isPrimal &&
			p.species.forme !== 'Ultra' && !p.species.cannotDynamax && !p.getItem().zMove) {
			const mm = p.getDynamaxRequest(true);
			if (mm) { a.canDynamax = true; a.maxMoves = mm; extra[i] = mm; }
		}
	});
	return extra;
}
/** 로그 한 줄이 기믹 사용이면 [진영, 종류] */
export function gimmickOfLine(line: string): ['p1' | 'p2', GimmickKind] | null {
	const gm = /^\|(-mega|-primal|-burst|-zpower|-terastallize)\|(p[12])/.exec(line) || /^\|-start\|(p[12])[a-c]: [^|]*\|Dynamax/.exec(line);
	if (!gm) return null;
	if (line.startsWith('|-primal')) return null; // 원시회귀는 자동
	const side = (gm[2] || gm[1]) as 'p1' | 'p2';
	return [side, line.includes('-zpower') ? 'zmove' : line.includes('-terastallize') ? 'tera' : line.includes('Dynamax') ? 'dynamax' : 'mega'];
}
