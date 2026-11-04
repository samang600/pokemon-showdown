/** 시뮬레이터(Battle) 를 감싸 플레이어(p1) ↔ AI(p2) 대전을 진행 */
import { Battle } from '../../sim/battle';
import type { PokemonSet } from '../../sim/teams';
import { chooseAI } from './ai';

export interface SideConfig { name: string; team: PokemonSet[] }
export interface SessionConfig {
	gen: 4 | 5;
	doubles: boolean;
	p1: SideConfig;
	p2: SideConfig;
	aiSkill: number; // 0~1
	seed?: [number, number, number, number];
}

export class Session {
	battle: Battle;
	private pending: string[] = [];
	p1Request: any = null;
	p2Request: any = null;
	private p2Answered: any = null;
	/** 각 진영이 이번 배틀에 쓴 기믹 (mega/zmove/dynamax/tera) — 한 종류만 허용 */
	gimmickUsed: { p1: string; p2: string } = { p1: '', p2: '' };
	ended = false;
	winner = '';
	lastError = '';

	constructor(public cfg: SessionConfig) {
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
				const gm = /^\|(-mega|-primal|-burst|-zpower|-terastallize)\|(p[12])/.exec(line) || /^\|-start\|(p[12])[a-c]: [^|]*\|Dynamax/.exec(line);
				if (gm) {
					const side = (gm[2] || gm[1]) as 'p1' | 'p2';
					const kind = line.includes('-zpower') ? 'zmove' : line.includes('-terastallize') ? 'tera' : line.includes('Dynamax') ? 'dynamax' : 'mega';
					if (!this.gimmickUsed[side]) this.gimmickUsed[side] = kind;
				}
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

	/** 이미 한 종류의 기믹을 썼으면 다른 기믹 선택지를 없앤다 (다이맥스 중엔 다이맥스 기술은 유지) */
	private applyGimmickRule(req: any, side: 'p1' | 'p2') {
		const used = this.gimmickUsed[side];
		if (!used || !req.active) return;
		for (const a of req.active) {
			if (!a) continue;
			if (used !== 'mega') { delete a.canMegaEvo; delete a.canMegaEvoX; delete a.canMegaEvoY; delete a.canUltraBurst; }
			if (used !== 'zmove') delete a.canZMove;
			if (used !== 'dynamax') { delete a.canDynamax; if (!this.battle[side].active.some((p: any) => p?.volatiles['dynamax'])) delete a.maxMoves; }
			if (used !== 'tera') delete a.canTerastallize;
			// 같은 종류라도 1회뿐 (메가·Z·테라는 시뮬레이터가 스스로 막고, 다이맥스도 1회)
			if (used === 'mega') { delete a.canMegaEvo; delete a.canMegaEvoX; delete a.canMegaEvoY; delete a.canUltraBurst; }
			if (used === 'zmove') delete a.canZMove;
			if (used === 'tera') delete a.canTerastallize;
			if (used === 'dynamax') delete a.canDynamax;
		}
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
