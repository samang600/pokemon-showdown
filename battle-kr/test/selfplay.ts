import '../src/ps/registry';
import { Battle } from '../../sim/battle';
import { chooseAI } from '../src/ai';
import { filterGimmicks, gimmickOfLine } from '../src/engine';
import { loadSettings } from '../src/store';
import { ruleById } from '../src/rules';
import { randomTeam, toSimTeam } from '../src/sets';
import { setSmogon, aiPickEntry } from '../src/smogon';
import { KoreanText, parseLine } from '../src/text';
/** o.aSmogon/bSmogon: 각 팀을 Smogon 통계로 만들지 / o.quality: 통계 세트의 쏠림 / o.pick: 6마리 중 n마리 (A 는 aiPickEntry, B 는 무작위) */
(window as any).selfplay = (n: number, gen: 9, doubles: boolean, skillA: number, skillB: number, _unused = false, size = 0,
	o: { aSmogon?: boolean; bSmogon?: boolean; quality?: number; pick?: number } = {}) => {
	const res = { switches: 0, faints: 0, gm: {} as any, aWins: 0, bWins: 0, ties: 0, errors: [] as string[], turns: 0, emptyText: {} as any, sample: [] as string[] };
	for (let k = 0; k < n; k++) {
		const reqs: any = {};
		const used: any = { p1: new Set(), p2: new Set() };
		const rule = ruleById(loadSettings().battleRule);
		const lines: string[] = [];
		const b = new Battle({ formatid: `gen${gen}kr${doubles ? 'doubles' : 'singles'}` as any, send: (t: string, d: any) => {
			if (t === 'sideupdate') { const s = String(d); const side = s.slice(0, 2); const r = s.slice(3); if (r.startsWith('|request|')) reqs[side] = JSON.parse(r.slice(9)); }
			if (t === 'update') { const ls = Array.isArray(d) ? d : String(d).split('\n'); lines.push(...ls); for (const l of ls) { const g = gimmickOfLine(l); if (g) used[g[0]].add(g[1]); } }
		} } as any);
		const sz = o.pick ? 6 : size || (doubles ? 4 : 3);
		setSmogon(o.aSmogon ?? true); let ta = randomTeam({ gen, size: sz, minBst: 450, doubles, quality: o.quality });
		setSmogon(o.bSmogon ?? true); let tb = randomTeam({ gen, size: sz, minBst: 450, doubles, quality: o.quality });
		if (o.pick) {
			setSmogon(true); const pa = aiPickEntry(ta, tb, o.pick, doubles, 1);
			setSmogon(false); const pb = aiPickEntry(tb, ta, o.pick, doubles, 1);
			ta = pa; tb = pb;
		}
		setSmogon(true);
		b.setPlayer('p1', { name: 'A', team: toSimTeam(ta) } as any);
		b.setPlayer('p2', { name: 'B', team: toSimTeam(tb) } as any);
		b.sendUpdates();
		let guard = 0;
		const done: any = {};
		while (!b.ended && guard++ < 600) {
			let acted = false;
			for (const side of ['p1', 'p2'] as const) {
				const r = reqs[side];
				if (!r || r.wait || done[side] === r) continue;
				done[side] = r;
				const extra = filterGimmicks(r, rule, used[side], (b as any)[side]);
				const ar = (b as any)[side].activeRequest; if (ar?.active) for (const i in extra) if (ar.active[i]) { ar.active[i].canDynamax = true; ar.active[i].maxMoves = extra[i]; }
				let c = 'default';
				try { c = chooseAI(b, r, side, side === 'p1' ? skillA : skillB); } catch (e: any) { res.errors.push('AI ' + e.message + e.stack.slice(0, 300)); }
				try {
					if (!b.choose(side, c)) { res.errors.push(`bad choice ${side}: ${c} :: ${(b as any)[side].choice.error}`); b.choose(side, 'default'); }
				} catch (e: any) { res.errors.push('SIM ' + e.message + '\n' + b.log.slice(-25).join('\n')); guard = 9999; break; }
				b.sendUpdates();
				acted = true;
			}
			if (!acted) { res.errors.push('stall'); break; }
		}
		res.turns += b.turn;
		if (b.winner === 'A') res.aWins++; else if (b.winner === 'B') res.bWins++; else res.ties++;
		const kt = new KoreanText({ gen, ownSide: 'p1', doubles, trainerName: s => s });
		for (let i = 0; i < lines.length; i++) {
			const l = lines[i];
			if (l.startsWith('|split|')) { i++; continue; }
			const p = parseLine(l);
			if (!p) continue;
			if (p.cmd === 'switch') res.switches++;
			if (p.cmd === 'faint') res.faints++;
			for (const k of ['-mega', '-zpower', '-terastallize']) if (p.cmd === k) res.gm[k] = (res.gm[k] || 0) + 1;
			if (p.cmd === '-start' && p.args[2] === 'Dynamax') res.gm.dynamax = (res.gm.dynamax || 0) + 1;
			if (p.cmd === 'bigerror' || p.cmd === 'error') res.errors.push(l);
			try {
				const t = kt.render(p, null);
				if (!t && !['', 't:', 'gametype', 'player', 'gen', 'tier', 'teamsize', 'upkeep', 'switch', 'request', '-damage', 'split', 'turn', 'move'].includes(p.cmd)) res.emptyText[p.cmd + ' ' + (p.args[2] || '') + ' ' + JSON.stringify(p.kw)] = 1;
				if (t && /[A-Za-z]{4,}/.test(t.replace(/Lv\d+/, ''))) res.sample.push(t + '  ⟸ ' + l);
				if (t && t.includes('{')) res.sample.push('BRACE ' + t);
			} catch (e: any) { res.errors.push('TEXT ' + e.message + ' ' + l); }
		}
	}
	res.emptyText = Object.keys(res.emptyText).slice(0, 60);
	res.sample = res.sample.slice(0, 40);
	return res;
};
