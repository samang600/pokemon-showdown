/** 게임 모드 진행 (배틀타워 · 배틀팩토리 · PWT · 네임드 트레이너 · 프리 배틀) */
import { h } from 'preact';
import { ask } from './ui/core';
import { BattleView, type BattleSetup, type BattleResult } from './ui/battle';
import { PickScreen, InfoScreen, SwapScreen, ChoiceScreen, BracketView } from './ui/screens';
import { randomTeam, randomSetFor, cloneSet, dedupeItems, rng, factoryTeam, assignGimmicks, FACTORY_TIERS, type PSet } from './sets';
import { NAMED, CUPS, REGIONS, ROLE_KO, randomTrainer, namedById, type NamedTrainer } from './trainers';
import { loadTeams, loadSettings, load, save, remove, updateRecords, loadRecords, type SavedTeam } from './store';
import { speciesKo, spriteId, megaStonesFor, type Gen } from './data';

type Fmt = 'singles' | 'doubles';
const BACK = Symbol('back');

function battle(setup: BattleSetup): Promise<BattleResult> {
	return ask<BattleResult>(resolve => <BattleView key={Math.random()} setup={setup} onEnd={resolve} />);
}
function playerName() { return loadSettings().playerName || '플레이어'; }
function withLevel(team: PSet[], level: number) { return team.map(s => ({ ...cloneSet(s), level })); }

async function chooseFormat(title: string, desc?: string): Promise<Fmt | typeof BACK> {
	return ask<Fmt | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)}
		intro={desc ? <p class="hint">{desc}</p> : undefined}
		options={[
			{ value: 'singles' as Fmt, label: '싱글배틀', desc: '1대1로 싸웁니다', icon: '①' },
			{ value: 'doubles' as Fmt, label: '더블배틀', desc: '2마리씩 동시에 싸웁니다', icon: '②' },
		]} onPick={r} />);
}

/** 내 팀 고르기: 저장된 팀 또는 렌탈 */
async function chooseTeam(gen: Gen, title: string, allowRental = true): Promise<PSet[] | typeof BACK> {
	const teams = loadTeams().filter(t => t.sets.length >= 3);
	const opts: { value: SavedTeam | 'rental'; label: string; desc?: string; icon?: any }[] = teams.map(t => ({
		value: t, label: t.name, desc: t.sets.map(s => speciesKo(s.species)).join(' · '), icon: <span class="mini"><img class="sprite" src={`https://play.pokemonshowdown.com/sprites/gen5/${spriteId(t.sets[0].species)}.png`} /></span>,
	}));
	if (allowRental) opts.push({ value: 'rental', label: '추천 렌탈 팀', desc: '무작위로 6마리를 빌립니다', icon: '🎲' });
	const v = await ask<SavedTeam | 'rental' | typeof BACK>(r => <ChoiceScreen title={title} onBack={() => r(BACK)}
		intro={!teams.length ? <p class="hint">저장된 팀(3마리 이상)이 없습니다. 메인 메뉴 → 팀 편집에서 만들 수 있어요.</p> : undefined}
		options={opts} onPick={r} />);
	if (v === BACK) return BACK;
	if (v === 'rental') return randomTeam({ gen, size: 6, minBst: 480 });
	return v.sets.map(cloneSet);
}

// ───────────── 배틀타워 ─────────────
const TOWER_KEY = (fmt: Fmt) => `tower-${fmt}`;
interface TowerState { fmt: Fmt; team: PSet[]; streak: number }

function towerOpponent(streak: number, fmt: Fmt) {
	const tier = Math.floor(streak / 7);
	const n = fmt === 'doubles' ? 4 : 3;
	const battleNo = streak + 1;
	// 타이쿤: 21번째, 49번째
	if (battleNo === 21 || battleNo === 49) {
		const gold = battleNo === 49;
		const species = gold ? ['heatran', 'cresselia', 'regigigas', 'metagross'] : ['rhyperior', 'milotic', 'dragonite', 'togekiss'];
		const team = species.slice(0, n).map(id => randomSetFor(id, 9, 50, fmt === 'doubles'));
		return { name: '타워 타이쿤', title: '', team: dedupeItems(assignGimmicks(team, { mega: 1, z: 1 })), skill: 0.97, boss: gold ? '금' : '은',
			line: gold ? '여기까지 온 너에게 전력으로 답하겠다!' : '배틀타워의 정점, 타워 타이쿤이다. 승부다!' };
	}
	const ranges = [[380, 490], [430, 520], [460, 545], [480, 600], [490, 680]];
	const [minBst, maxBst] = ranges[Math.min(tier, ranges.length - 1)];
	const tr = randomTrainer();
	const ivs = Math.min(31, 10 + tier * 5);
	let team = randomTeam({ gen: 9, size: n, minBst, maxBst, allowSubLegend: tier >= 3, ivs, doubles: fmt === 'doubles', types: Math.random() < 0.6 ? tr.types : undefined });
	if (team.length < n) team = randomTeam({ gen: 9, size: n, minBst, maxBst, ivs, doubles: fmt === 'doubles' });
	return { name: tr.name, title: tr.className, team, skill: Math.min(0.95, 0.5 + tier * 0.1), boss: '', line: '' };
}

export async function runTower() {
	const fmt = await chooseFormat('배틀타워', '레벨 50 · 싱글 3마리 / 더블 4마리 · 7연승마다 1세트 · 메가진화·Z기술·다이맥스·테라스탈 사용 가능');
	if (fmt === BACK) return;
	let state = load<TowerState | null>(TOWER_KEY(fmt), null);
	if (state) {
		const resume = await ask<'resume' | 'new' | typeof BACK>(r => <InfoScreen title="배틀타워" heading={`${state!.streak}연승 중인 도전이 있습니다`}
			sprites={state!.team.map(s => s.species)} gen={9}
			lines={['이어서 도전할까요? 새로 시작하면 지금 연승 기록은 사라집니다.']}
			actions={[{ label: '이어서 도전', onClick: () => r('resume') }, { label: '새로 시작', kind: 'ghost', onClick: () => r('new') },
				{ label: '돌아가기', kind: 'ghost', onClick: () => r(BACK) }]} />);
		if (resume === BACK) return;
		if (resume === 'new') state = null;
	}
	if (!state) {
		const team = await chooseTeam(9, '배틀타워 · 팀 선택');
		if (team === BACK) return;
		const n = fmt === 'doubles' ? 4 : 3;
		const picked = team.length > n ? await ask<PSet[] | typeof BACK>(r => <PickScreen title="참가 포켓몬" team={team} gen={9} count={n}
			onBack={() => r(BACK)} onDone={r} />) : team;
		if (picked === BACK) return;
		state = { fmt, team: withLevel(dedupeItems(picked.map(cloneSet)), 50), streak: 0 };
		save(TOWER_KEY(fmt), state);
	}
	const key = `tower-${fmt}`;
	while (true) {
		const opp = towerOpponent(state.streak, fmt);
		const go = await ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title={`배틀타워 · ${fmt === 'doubles' ? '더블' : '싱글'}`}
			banner={`${state!.streak + 1}번째 승부`}
			heading={opp.boss ? `⚠ 타워 타이쿤 등장! (${opp.boss}의 심볼)` : `${opp.title} ${opp.name}${josa(opp.name)} 승부를 걸어왔다!`}
			lines={[`현재 ${state!.streak}연승 · 세트 ${Math.floor(state!.streak / 7) + 1} - ${state!.streak % 7 + 1}번째`]}
			sprites={state!.team.map(s => s.species)} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') },
				{ label: '도전 그만두기', kind: 'danger', onClick: () => r('quit') }]} />);
		if (go === 'rest') { save(TOWER_KEY(fmt), state); return; }
		if (go === 'quit') { remove(TOWER_KEY(fmt)); return; }
		const res = await battle({
			gen: 9, doubles: fmt === 'doubles', aiSkill: opp.skill, bg: opp.boss ? 'champion' : 'tower',
			label: `배틀타워 ${state.streak + 1}번째`,
			p1: { name: playerName(), team: state.team }, p2: { name: opp.name, title: opp.title, team: opp.team, line: opp.line },
		});
		if (res.win) {
			state.streak++;
			const s = state.streak;
			const bp = s % 7 === 0 ? 3 + Math.floor(s / 7) : 0;
			updateRecords(r => { r.current[key] = s; r.best[key] = Math.max(r.best[key] || 0, s); r.bp += bp; });
			save(TOWER_KEY(fmt), state);
			if (s % 7 === 0) {
				await ask<void>(r => <InfoScreen title="배틀타워" banner="🏆 세트 클리어!" heading={`${s}연승 달성!`}
					lines={[`BP ${bp}를 받았다!`, '포켓몬들의 체력이 회복되었다.']} actions={[{ label: '계속', onClick: () => r() }]} />);
			}
		} else {
			const s = state.streak;
			remove(TOWER_KEY(fmt));
			updateRecords(r => { r.current[key] = 0; });
			await ask<void>(r => <InfoScreen title="배틀타워" heading="도전 종료" banner={`${s}연승`}
				lines={[`최고 기록: ${loadRecords().best[key] || 0}연승`, '다음에는 더 멀리 가 보자!']}
				actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
	}
}

// ───────────── 배틀팩토리 ─────────────
interface FactoryState { fmt: Fmt; level: 50 | 100; team: PSet[]; streak: number }
const FACTORY_KEY = (fmt: Fmt, lv: number) => `factory-${fmt}-${lv}`;

function factoryPool(streak: number, level: number, size: number, exclude?: Set<string>) {
	// 세트가 오를수록 높은 티어의 렌탈: PU → NU → RU → UU → OU
	const tier = FACTORY_TIERS[Math.min(Math.floor(streak / 7), 4)];
	const team = factoryTeam(tier, size, level, exclude);
	return team.length >= size ? team : [...team, ...randomTeam({ gen: 9, size: size - team.length, minBst: 450, level })];
}

export async function runFactory() {
	const fmt = await chooseFormat('배틀팩토리', '빌린 포켓몬으로 싸우는 시설 · 이길 때마다 상대 포켓몬과 교환 가능 · 세트가 오를수록 강한 렌탈');
	if (fmt === BACK) return;
	const level = await ask<50 | 100 | typeof BACK>(r => <ChoiceScreen title="배틀팩토리 · 레벨" onBack={() => r(BACK)} options={[
		{ value: 50 as const, label: '레벨 50', desc: '모든 포켓몬 레벨 50', icon: '50' },
		{ value: 100 as const, label: '오픈 레벨', desc: '모든 포켓몬 레벨 100', icon: '100' },
	]} onPick={r} />);
	if (level === BACK) return;
	const n = fmt === 'doubles' ? 4 : 3;
	const key = `factory-${fmt}-${level}`;
	let state = load<FactoryState | null>(FACTORY_KEY(fmt, level), null);
	if (state) {
		const v = await ask<'resume' | 'new'>(r => <InfoScreen title="배틀팩토리" heading={`${state!.streak}연승 중인 도전이 있습니다`}
			sprites={state!.team.map(s => s.species)} gen={9}
			actions={[{ label: '이어서 도전', onClick: () => r('resume') }, { label: '새로 시작', kind: 'ghost', onClick: () => r('new') }]} />);
		if (v === 'new') state = null;
	}
	const rentalRound = async (streak: number) => {
		const rentals = factoryPool(streak, level, 6);
		return ask<PSet[]>(r => <PickScreen title="렌탈 포켓몬 선택" team={rentals} gen={9} count={n}
			hint={`빌릴 포켓몬 ${n}마리를 고르세요. 처음 고른 포켓몬이 선봉입니다.`} onDone={r} />);
	};
	if (!state) {
		state = { fmt, level, team: await rentalRound(0), streak: 0 };
		save(FACTORY_KEY(fmt, level), state);
	}
	const head = (no: number) => no === 21 || no === 49;
	while (true) {
		const no = state.streak + 1;
		const isHead = head(no);
		const tr = randomTrainer();
		const oppTeam = isHead ? factoryTeam(no === 49 ? 'Uber' : 'OU', n, level) : factoryPool(state.streak, level, n);
		const opp = isHead ? { name: '팩토리 헤드', title: '', skill: 0.97, line: '지식과 운, 둘 다 시험해 보자고!' } :
			{ name: tr.name, title: tr.className, skill: Math.min(0.92, 0.5 + Math.floor(state.streak / 7) * 0.1), line: '' };
		const go = await ask<'go' | 'rest' | 'quit'>(r => <InfoScreen title="배틀팩토리" banner={`${no}번째 승부`}
			heading={isHead ? '⚠ 팩토리 헤드 등장!' : `${opp.title} ${opp.name}${josa(opp.name)} 승부를 걸어왔다!`}
			lines={[`현재 ${state!.streak}연승 · 레벨 ${level === 50 ? '50' : '오픈'}`, `상대 선봉: ${speciesKo(oppTeam[0].species)} (정보 공개)`]}
			sprites={state!.team.map(s => s.species)} gen={9}
			actions={[{ label: '승부한다', onClick: () => r('go') }, { label: '쉬기 (저장 후 나가기)', kind: 'ghost', onClick: () => r('rest') },
				{ label: '도전 그만두기', kind: 'danger', onClick: () => r('quit') }]} />);
		if (go === 'rest') { save(FACTORY_KEY(fmt, level), state); return; }
		if (go === 'quit') { remove(FACTORY_KEY(fmt, level)); return; }
		const res = await battle({
			gen: 9, doubles: fmt === 'doubles', aiSkill: opp.skill, bg: isHead ? 'champion' : 'factory', label: `배틀팩토리 ${no}번째`,
			p1: { name: playerName(), team: state.team }, p2: { name: opp.name, title: opp.title, team: oppTeam, line: opp.line },
		});
		if (!res.win) {
			const s = state.streak;
			remove(FACTORY_KEY(fmt, level));
			updateRecords(r => { r.current[key] = 0; });
			await ask<void>(r => <InfoScreen title="배틀팩토리" heading="도전 종료" banner={`${s}연승`}
				lines={[`최고 기록: ${loadRecords().best[key] || 0}연승`]} actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
		state.streak++;
		const s = state.streak;
		updateRecords(r => { r.current[key] = s; r.best[key] = Math.max(r.best[key] || 0, s); if (s % 7 === 0) r.bp += 3 + Math.floor(s / 7); });
		if (s % 7 === 0) {
			await ask<void>(r => <InfoScreen title="배틀팩토리" banner="🏆 세트 클리어!" heading={`${s}연승 달성!`}
				lines={['새로운 렌탈 포켓몬을 고릅니다.']} actions={[{ label: '계속', onClick: () => r() }]} />);
			state.team = await rentalRound(s);
		} else {
			const swap = await ask<{ give: number; take: number } | null>(r => <SwapScreen mine={state!.team} theirs={oppTeam} gen={9} onDone={r} />);
			if (swap) {
				const got = cloneSet(oppTeam[swap.take]);
				got.level = level;
				state.team[swap.give] = got;
			}
		}
		save(FACTORY_KEY(fmt, level), state);
	}
}

// ───────────── PWT ─────────────
function namedTeam(t: NamedTrainer, size: number, gen: Gen = 9): PSet[] {
	// 에이스는 항상 포함, 나머지 무작위
	const others = rng.shuffle(t.team.filter(s => s !== t.ace)).slice(0, size - 1);
	const species = [...others, t.ace];
	const team = species.map(id => {
		const set = randomSetFor(id, gen, 50);
		if (id === 'pikachu') set.item = 'lightball';
		return set;
	});
	// 에이스에게 메가스톤이 있으면 우선 메가진화 담당
	const ace = team[team.length - 1];
	const stones = megaStonesFor(ace.species);
	if (stones.length) ace.item = rng.pick(stones);
	return dedupeItems(assignGimmicks(team, { mega: t.role === 'leader' ? 0.5 : 0.9, z: 0.6 }));
}

export async function runPWT() {
	const cup = await ask<typeof CUPS[number] | typeof BACK>(r => <ChoiceScreen title="PWT 월드 토너먼트" onBack={() => r(BACK)}
		intro={<p class="hint">레벨 50 · 8명 토너먼트 3연승으로 우승!</p>}
		options={CUPS.map(c => ({ value: c, label: c.name, desc: c.desc, badge: loadRecords().cups[c.id] ? `🏆×${loadRecords().cups[c.id]}` : undefined, icon: '🏟' }))}
		onPick={r} />);
	if (cup === BACK) return;
	const fmt = await chooseFormat(cup.name);
	if (fmt === BACK) return;
	const n = fmt === 'doubles' ? 4 : 3;
	let myTeam: PSet[];
	if (cup.rental) {
		myTeam = randomTeam({ gen: 9, size: 6, minBst: 470, maxBst: 600, doubles: fmt === 'doubles' });
	} else {
		const t = await chooseTeam(9, `${cup.name} · 팀 선택`);
		if (t === BACK) return;
		myTeam = withLevel(t, 50);
	}
	// 참가자 구성
	const me = playerName();
	let entrants: { name: string; title: string; team: () => PSet[]; skill: number; line?: string; named?: NamedTrainer }[];
	const named = cup.trainers().slice(0, 7).map(id => namedById(id));
	if (named.length) {
		entrants = named.map(t => ({ name: t.name, title: ROLE_KO[t.role] === '챔피언' ? '챔피언' : t.role === 'elite' ? '사천왕' : '관장', team: () => namedTeam(t, 6), skill: t.role === 'champion' ? 0.95 : t.role === 'elite' ? 0.88 : 0.8, line: t.line, named: t }));
	} else {
		entrants = Array.from({ length: 7 }, () => {
			const tr = randomTrainer();
			return { name: tr.name, title: tr.className, team: () => randomTeam({ gen: 9, size: 6, minBst: cup.rental ? 460 : 490, maxBst: cup.rental ? 600 : 680, allowSubLegend: !cup.rental }), skill: cup.rental ? 0.7 : 0.85 };
		});
	}
	while (entrants.length < 7) entrants.push(entrants[entrants.length % Math.max(1, named.length)]);
	const order = rng.shuffle([...entrants.keys()]);
	const slots = [me, ...order.map(i => entrants[i].name)];
	const rounds: string[][] = [slots, ['', '', '', ''], ['', ''], ['']];
	let pool = order.map(i => entrants[i]);
	if (cup.rental) {
		await ask<void>(r => <InfoScreen title={cup.name} heading="렌탈 포켓몬을 받았다!" sprites={myTeam.map(s => s.species)} gen={9}
			actions={[{ label: '확인', onClick: () => r() }]} />);
	}
	// 1회전 상대 = slots[1], 다른 경기는 무작위 진행
	let oppIdx = 0;
	for (let round = 0; round < 3; round++) {
		const opp = pool[oppIdx];
		await ask<void>(r => <InfoScreen title={cup.name} banner={['1회전', '준결승', '결승'][round]}
			heading={`VS ${opp.title} ${opp.name}`}
			actions={[{ label: '승부한다', onClick: () => r() }]}>
			<BracketView rounds={rounds} highlight={me} />
		</InfoScreen>);
		const oppTeam = opp.team();
		const picked = await ask<PSet[]>(r => <PickScreen title="참가 포켓몬 선택" team={myTeam} gen={9} count={n}
			opponent={{ name: `${opp.title} ${opp.name}`, team: oppTeam }} onDone={r} />);
		// 상대도 n마리 선택 (에이스 포함)
		const oppPick = [...rng.shuffle(oppTeam.slice(0, -1)).slice(0, n - 1), oppTeam[oppTeam.length - 1]];
		const res = await battle({
			gen: 9, doubles: fmt === 'doubles', aiSkill: Math.min(0.97, opp.skill + round * 0.04), bg: round === 2 ? 'champion' : 'pwt',
			label: `${cup.name} ${['1회전', '준결승', '결승'][round]}`,
			p1: { name: me, team: picked }, p2: { name: opp.name, title: opp.title, team: oppPick, line: opp.line },
		});
		// 대진표 갱신 (다른 경기는 무작위)
		const winners: string[] = [];
		const cur = rounds[round];
		for (let i = 0; i < cur.length; i += 2) {
			if (i === 0) winners.push(res.win ? me : opp.name);
			else winners.push(rng.pick([cur[i], cur[i + 1]]));
		}
		rounds[round + 1] = winners;
		if (!res.win) {
			await ask<void>(r => <InfoScreen title={cup.name} heading="아쉽게 탈락!" lines={[`${['1회전', '준결승', '결승'][round]}에서 ${opp.name}에게 졌다.`]}
				actions={[{ label: '메뉴로', onClick: () => r() }]} />);
			return;
		}
		if (round < 2) {
			// 다음 상대: 옆 경기 승자
			const nextName = winners[1];
			oppIdx = pool.findIndex(e => e.name === nextName);
			if (oppIdx < 0) oppIdx = 0;
			await ask<void>(r => <InfoScreen title={cup.name} banner="승리!" heading="대진표" actions={[{ label: '다음 경기로', onClick: () => r() }]}>
				<BracketView rounds={rounds} highlight={me} />
			</InfoScreen>);
		}
	}
	updateRecords(r => { r.cups[cup.id] = (r.cups[cup.id] || 0) + 1; r.bp += 5; });
	await ask<void>(r => <InfoScreen title={cup.name} banner="🏆 우승!" heading={`${cup.name} 우승을 축하합니다!`}
		sprites={myTeam.map(s => s.species)} gen={9} lines={['BP 5를 받았다!']} actions={[{ label: '메뉴로', onClick: () => r() }]} />);
	void pool; pool = [];
}

// ───────────── 네임드 트레이너 ─────────────
export async function runNamed() {
	while (true) {
		const region = await ask<NamedTrainer['region'] | typeof BACK>(r => <ChoiceScreen title="네임드 트레이너" onBack={() => r(BACK)}
			intro={<p class="hint">역대 체육관 관장·사천왕·챔피언과 대전합니다. (레벨 50)</p>}
			options={REGIONS.map(reg => ({ value: reg, label: `${reg} 지방`, desc: NAMED.filter(t => t.region === reg).map(t => t.name).join(' · '), icon: '🗺' }))}
			onPick={r} />);
		if (region === BACK) return;
		while (true) {
			const t = await ask<NamedTrainer | typeof BACK>(r => <ChoiceScreen title={`${region} 지방`} onBack={() => r(BACK)}
				options={NAMED.filter(x => x.region === region).map(x => ({
					value: x, label: x.name, desc: x.title, badge: loadRecords().named[x.id] ? `✓${loadRecords().named[x.id]}` : undefined,
					icon: <span class="mini"><img class="sprite" src={`https://play.pokemonshowdown.com/sprites/gen5/${x.ace}.png`} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} /></span>,
				}))} onPick={r} />);
			if (t === BACK) break;
			const mode = await ask<'s3' | 's6' | 'd4' | 'd6' | typeof BACK>(r => <ChoiceScreen title={`${t.name} · 규칙`} onBack={() => r(BACK)}
				intro={<p class="hint">“{t.line}”</p>}
				options={[
					{ value: 's3' as const, label: '싱글 3vs3', desc: '6마리 중 3마리 선택', icon: '①' },
					{ value: 's6' as const, label: '싱글 6vs6 (풀배틀)', desc: '전원 참가', icon: '⑥' },
					{ value: 'd4' as const, label: '더블 4vs4', desc: '6마리 중 4마리 선택', icon: '②' },
					{ value: 'd6' as const, label: '더블 6vs6', desc: '전원 참가', icon: '⑥' },
				]} onPick={r} />);
			if (mode === BACK) continue;
			const team = await chooseTeam(9, `${t.name} 전 · 팀 선택`);
			if (team === BACK) continue;
			const doubles = mode.startsWith('d');
			const size = mode === 's3' ? 3 : mode === 'd4' ? 4 : 6;
			const oppTeam = namedTeam(t, 6);
			const myTeam = withLevel(team, 50);
			const picked = size < 6 && myTeam.length > size ? await ask<PSet[]>(r => <PickScreen title="참가 포켓몬" team={myTeam} gen={9} count={size}
				opponent={{ name: t.name, team: oppTeam }} onDone={r} />) : myTeam;
			const oppPick = size < 6 ? [...rng.shuffle(oppTeam.slice(0, -1)).slice(0, size - 1), oppTeam[oppTeam.length - 1]] : oppTeam;
			const res = await battle({
				gen: 9, doubles, aiSkill: t.role === 'champion' ? 0.95 : 0.85, bg: t.role === 'champion' ? 'champion' : 'pwt',
				label: `${t.title}`, p1: { name: playerName(), team: picked }, p2: { name: t.name, title: ROLE_KO[t.role], team: oppPick, line: t.line },
			});
			if (res.win) updateRecords(r => { r.named[t.id] = (r.named[t.id] || 0) + 1; });
			await ask<void>(r => <InfoScreen title={t.name} heading={res.win ? `${t.name}에게 승리했다!` : `${t.name}에게 졌다…`}
				lines={[res.win ? '훌륭한 승부였다!' : '다시 도전해 보자!']} actions={[{ label: '확인', onClick: () => r() }]} />);
		}
	}
}

// ───────────── 프리 배틀 ─────────────
export async function runFree() {
	const opt = await ask<{ gen: Gen; fmt: Fmt } | typeof BACK>(r => <ChoiceScreen title="프리 배틀" onBack={() => r(BACK)}
		intro={<p class="hint">무작위 팀끼리 6vs6으로 바로 싸웁니다. 기록에는 남지 않아요.</p>}
		options={[
			{ value: { gen: 9 as Gen, fmt: 'singles' as Fmt }, label: '싱글배틀', icon: '①' },
			{ value: { gen: 9 as Gen, fmt: 'doubles' as Fmt }, label: '더블배틀', icon: '②' },
		]} onPick={r} />);
	if (opt === BACK) return;
	const src = await chooseTeam(opt.gen, '내 팀');
	if (src === BACK) return;
	while (true) {
		const tr = randomTrainer();
		const opp = randomTeam({ gen: opt.gen, size: 6, minBst: 470, maxBst: 600 });
		const res = await battle({
			gen: opt.gen, doubles: opt.fmt === 'doubles', aiSkill: 0.8, bg: 'field', label: '프리 배틀',
			p1: { name: playerName(), team: withLevel(src, 50) }, p2: { name: tr.name, title: tr.className, team: opp },
		});
		const again = await ask<boolean>(r => <InfoScreen title="프리 배틀" heading={res.win ? '승리!' : '패배…'}
			actions={[{ label: '한 번 더', onClick: () => r(true) }, { label: '메뉴로', kind: 'ghost', onClick: () => r(false) }]} />);
		if (!again) return;
	}
}

function josa(name: string) {
	const ch = name.charCodeAt(name.length - 1);
	return ch >= 0xAC00 && ch <= 0xD7A3 && (ch - 0xAC00) % 28 ? '이' : '가';
}
