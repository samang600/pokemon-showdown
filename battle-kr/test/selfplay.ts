import '../src/ps/registry';
import { Battle } from '../../sim/battle';
import { chooseAI } from '../src/ai';
import { randomTeam, toSimTeam } from '../src/sets';
import { KoreanText, parseLine } from '../src/text';
(window as any).selfplay = (n: number, gen: 4 | 5, doubles: boolean, skillA: number, skillB: number) => {
	const res = { aWins: 0, bWins: 0, ties: 0, errors: [] as string[], turns: 0, emptyText: {} as any, sample: [] as string[] };
	for (let k = 0; k < n; k++) {
		const reqs: any = {};
		const lines: string[] = [];
		const b = new Battle({ formatid: `gen${gen}kr${doubles ? 'doubles' : 'singles'}` as any, send: (t: string, d: any) => {
			if (t === 'sideupdate') { const s = String(d); const side = s.slice(0, 2); const r = s.slice(3); if (r.startsWith('|request|')) reqs[side] = JSON.parse(r.slice(9)); }
			if (t === 'update') lines.push(...(Array.isArray(d) ? d : String(d).split('\n')));
		} } as any);
		b.setPlayer('p1', { name: 'A', team: toSimTeam(randomTeam({ gen, size: doubles ? 4 : 3, minBst: 450 })) } as any);
		b.setPlayer('p2', { name: 'B', team: toSimTeam(randomTeam({ gen, size: doubles ? 4 : 3, minBst: 450 })) } as any);
		b.sendUpdates();
		let guard = 0;
		const done: any = {};
		while (!b.ended && guard++ < 600) {
			let acted = false;
			for (const side of ['p1', 'p2'] as const) {
				const r = reqs[side];
				if (!r || r.wait || done[side] === r) continue;
				done[side] = r;
				let c = 'default';
				try { c = chooseAI(b, r, side, side === 'p1' ? skillA : skillB); } catch (e: any) { res.errors.push('AI ' + e.message + e.stack.slice(0, 300)); }
				try {
					if (!b.choose(side, c)) { res.errors.push(`bad choice ${side}: ${c}`); b.choose(side, 'default'); }
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
