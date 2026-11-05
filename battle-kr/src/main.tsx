import './ps/registry';
import { h, render, type VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { bindView, Screen, Sprite, toast, QuitToMenu, resetAbort } from './ui/core';
import { TeamList, TeamEditor } from './ui/teambuilder';
import { CalcScreen } from './ui/calc';
import { runTower, runFactory, runPWT, runNamed, runFree, runCheat } from './modes';
import { loadRecords, loadSettings, saveSettings, load, type Settings } from './store';
import { RULES, ruleById } from './rules';
import { CUPS, NAMED } from './trainers';
import { unlockAudio, playMusic, stopMusic, sfx, setMusicVolume, setSfxVolume, setMoveSfxVolume, BGM_CHOICES } from './sound';
import { PLAYER_SPRITES, SPRITE_URL } from './trainer-lines';

const MODES = [
	{ id: 'tower', name: '배틀타워', sub: '연승 도전', run: runTower, color: '#3a6df0', icon: '🗼', mon: 'garchomp' },
	{ id: 'factory', name: '배틀팩토리', sub: '렌탈 배틀', run: runFactory, color: '#e0812b', icon: '🏭', mon: 'metagross' },
	{ id: 'pwt', name: 'PWT', sub: '월드 토너먼트', run: runPWT, color: '#d23a6a', icon: '🏆', mon: 'hydreigon' },
	{ id: 'named', name: '네임드 트레이너', sub: '관장 · 챔피언 · 라이벌 · 악당', run: runNamed, color: '#7a4ad8', icon: '⭐', mon: 'dragonite' },
	{ id: 'free', name: '프리 배틀', sub: '싱글 · 더블 바로 대전', run: () => runFree(), color: '#2a9d6a', icon: '⚔', mon: 'lucario' },
	{ id: 'cheat', name: '치트 배틀', sub: '마음대로 · 전적 없음', run: runCheat, color: '#b0308a', icon: '🃏', mon: 'mew' },
];

function TitleScreen({ onStart }: { onStart: () => void }) {
	return <div class="title-screen" onClick={onStart}>
		<div class="title-glow" />
		<div class="title-mons">
			<Sprite species="garchomp" gen={9} size={110} />
			<Sprite species="lucario" gen={9} size={90} />
		</div>
		<div class="title-logo">
			<span class="logo-small">BATTLE SIMULATOR</span>
			<span class="logo-main">배틀 시뮬레이터</span>
			<span class="logo-sub">타워 · 팩토리 · 토너먼트 · 더블배틀</span>
		</div>
		<div class="title-tap">화면을 터치하세요</div>
		<div class="title-foot">Pokémon Showdown 엔진 기반 · 팬 메이드</div>
	</div>;
}

function Home({ go }: { go: (v: string) => void }) {
	const rec = loadRecords();
	const settings = loadSettings();
	const towerBest = Math.max(rec.best['tower-singles'] || 0, rec.best['tower-doubles'] || 0);
	const factoryBest = Math.max(...['singles', 'doubles'].flatMap(f => [50, 100].map(l => rec.best[`factory-${f}-${l}`] || 0)), 0);
	const cupWins = Object.values(rec.cups).reduce((a, b) => a + b, 0);
	const namedWins = Object.keys(rec.named).length;
	const suspended = ['tower-singles', 'tower-doubles'].some(k => load(k, null)) || ['singles', 'doubles'].some(f => [50, 100].some(l => load(`factory-${f}-${l}`, null)));
	const badge: { [id: string]: string } = {
		tower: towerBest ? `최고 ${towerBest}연승` : '', factory: factoryBest ? `최고 ${factoryBest}연승` : '',
		pwt: cupWins ? `우승 ${cupWins}회` : `${CUPS.length}개 대회`, named: `${namedWins}/${NAMED.length} 격파`, free: '',
	};
	return <div class="home">
		<div class="home-head">
			<div>
				<div class="hello">{settings.playerName}, 어서 와!</div>
				<div class="stats-line">전적 {rec.wins}승 {rec.battles - rec.wins}패{rec.battles ? ` · 승률 ${Math.round(rec.wins / rec.battles * 100)}%` : ''}</div>
			</div>
			<button class="icon-btn" onClick={() => go('settings')} aria-label="설정">⚙</button>
		</div>
		{suspended && <div class="notice">쉬는 중인 도전이 있어요. 해당 시설에 들어가면 이어서 할 수 있습니다.</div>}
		<div class="mode-grid">
			{MODES.map((m, i) => <button class={'mode-tile' + (i < 2 ? ' wide' : '')} style={{ '--mc': m.color } as any} onClick={() => go('mode:' + m.id)}>
				<span class="mode-icon">{m.icon}</span>
				<span class="mode-text"><b>{m.name}</b><small>{m.sub}</small>{badge[m.id] && <em>{badge[m.id]}</em>}</span>
				<span class="mode-mon"><Sprite species={m.mon} gen={9} size={64} anim={false} /></span>
			</button>)}
		</div>
		<div class="home-bottom three">
			<button class="btn big menu" onClick={() => go('teams')}>📋 팀 편집</button>
			<button class="btn big menu" onClick={() => go('calc')}>🧮 배틀 계산기</button>
			<button class="btn big menu" onClick={() => go('records')}>📊 기록</button>
		</div>
	</div>;
}

function Records({ onBack }: { onBack: () => void }) {
	const r = loadRecords();
	const rows: [string, string][] = [
		['배틀타워 싱글', `${r.best['tower-singles'] || 0}연승`], ['배틀타워 더블', `${r.best['tower-doubles'] || 0}연승`],
		['팩토리 싱글 Lv50', `${r.best['factory-singles-50'] || 0}연승`], ['팩토리 싱글 오픈', `${r.best['factory-singles-100'] || 0}연승`],
		['팩토리 더블 Lv50', `${r.best['factory-doubles-50'] || 0}연승`], ['팩토리 더블 오픈', `${r.best['factory-doubles-100'] || 0}연승`],
	];
	return <Screen title="기록" onBack={onBack}>
		<div class="record-card"><b>총 전적</b><span>{r.wins}승 {r.battles - r.wins}패{r.battles ? ` · 승률 ${Math.round(r.wins / r.battles * 100)}%` : ''}</span></div>
		<h3 class="sec">최고 연승</h3>
		{rows.map(([k, v]) => <div class="record-row"><span>{k}</span><b>{v}</b></div>)}
		<h3 class="sec">PWT 우승</h3>
		{CUPS.map(c => <div class="record-row"><span>{c.name}</span><b>{r.cups[c.id] ? `🏆 ${r.cups[c.id]}회` : '—'}</b></div>)}
		<h3 class="sec">네임드 트레이너 격파</h3>
		<div class="named-grid">{NAMED.map(t => <span class={'named-chip' + (r.named[t.id] ? ' done' : '')}>{t.name}</span>)}</div>
	</Screen>;
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
	const [s, setS] = useState<Settings>(loadSettings());
	const up = (p: Partial<Settings>) => { const n = { ...s, ...p }; setS(n); saveSettings(n); };
	return <Screen title="설정" onBack={onBack}>
		<label class="field-label">트레이너 이름
			<input value={s.playerName} maxLength={10} onInput={e => up({ playerName: (e.target as HTMLInputElement).value || '플레이어' })} />
		</label>
		<h3 class="sec">메시지 속도</h3>
		<div class="seg">{([1, 2, 3, 4] as const).map(v => <button class={s.speed === v ? 'on' : ''} onClick={() => up({ speed: v })}>{['느림', '보통', '빠름', '매우 빠름'][v - 1]}</button>)}</div>
		<h3 class="sec">주인공 모습</h3>
		<div class="avatar-pick">{PLAYER_SPRITES.map(p => <button class={s.playerSprite === p.id ? 'on' : ''} onClick={() => up({ playerSprite: p.id })}>
			<img src={SPRITE_URL(p.id)} alt="" />{p.name}</button>)}</div>
		<h3 class="sec">소리</h3>
		<div class="seg">
			<button class={s.sound ? 'on' : ''} onClick={() => { up({ sound: !s.sound }); }}>효과음 {s.sound ? '켜짐' : '꺼짐'}</button>
			<button class={s.music ? 'on' : ''} onClick={() => { const m = !s.music; up({ music: m }); if (m) setTimeout(() => playMusic('title'), 0); else stopMusic(); }}>배경음악 {s.music ? '켜짐' : '꺼짐'}</button>
		</div>
		<div class="set-row"><span>배경음악</span><div class="seg">{([1, 2, 3] as const).map(v => <button class={s.musicVolume === v ? 'on' : ''} onClick={() => { up({ musicVolume: v }); setMusicVolume(v); }}>{['작게', '보통', '크게'][v - 1]}</button>)}</div></div>
		<div class="set-row"><span>울음·효과음</span><div class="seg">{([1, 2, 3] as const).map(v => <button class={s.sfxVolume === v ? 'on' : ''} onClick={() => { up({ sfxVolume: v }); setSfxVolume(v); }}>{['작게', '보통', '크게'][v - 1]}</button>)}</div></div>
		<div class="set-row"><span>기술 효과음</span><div class="seg">{([0, 1, 2, 3] as const).map(v => <button class={s.moveSfx === v ? 'on' : ''} onClick={() => { up({ moveSfx: v }); setMoveSfxVolume(v); }}>{['끔', '작게', '보통', '크게'][v]}</button>)}</div></div>
		<h3 class="sec">배틀 음악</h3>
		<div class="seg wrap">{BGM_CHOICES.map(([k, l]) => <button class={s.battleBgm === k ? 'on' : ''} onClick={() => { up({ battleBgm: k }); if (k !== 'random') { stopMusic(); setTimeout(() => playMusic(k), 0); } }}>{l}</button>)}</div>
		<p class="muted small">무작위면 배틀마다 상황에 맞는 곡 중 하나가 흐릅니다. 고르면 미리 들을 수 있어요.</p>
		<h3 class="sec">창틀 디자인</h3>
		<div class="seg">{([['stone', '블루'], ['silver', '레드'], ['dark', '블랙']] as const).map(([k, l]) => <button class={s.frame === k ? 'on' : ''} onClick={() => { up({ frame: k }); applyTheme({ ...s, frame: k }); }}>{l}</button>)}</div>
		<h3 class="sec">메뉴 배경</h3>
		<div class="seg wrap">{([['title', '밤하늘'], ['field', '초원'], ['tower', '타워'], ['factory', '팩토리'], ['pwt', '경기장'], ['champion', '챔피언']] as const).map(([k, l]) => <button class={s.homeBg === k ? 'on' : ''} onClick={() => { up({ homeBg: k }); applyTheme({ ...s, homeBg: k }); }}>{l}</button>)}</div>
		<p class="muted small">효과음·배경음악은 이 앱에서 합성한 칩튠, 기술 효과음은 Pokémon Reborn 제작. 울음소리는 인터넷에서 받아 옵니다.</p>
		<h3 class="sec">배틀 규칙</h3>
		{[...new Set(RULES.map(r => r.group))].map(g => <div class="set-row rule-row"><span>{g}</span><div class="seg wrap">
			{RULES.filter(r => r.group === g).map(r => <button class={s.battleRule === r.id ? 'on' : ''} onClick={() => up({ battleRule: r.id })}>{r.name.replace(/^(전국도감|챔피언스 레귤레이션) · ?/, '')}</button>)}</div></div>)}
		<p class="muted small"><b>{ruleById(s.battleRule).name}</b>: {ruleById(s.battleRule).desc} 모든 모드의 나와 상대에게 적용되고, 무작위·렌탈 팀과 상대 팀도 이 규칙에 맞게 만들어집니다.</p>
		<h3 class="sec">배틀 화면</h3>
		<div class="seg">
			<button class={s.effects ? 'on' : ''} onClick={() => up({ effects: !s.effects })}>기술 이펙트 {s.effects ? '켜짐' : '꺼짐'}</button>
			<button class={s.damagePreview ? 'on' : ''} onClick={() => up({ damagePreview: !s.damagePreview })}>데미지 예상 {s.damagePreview ? '켜짐' : '꺼짐'}</button>
		</div>
		<div class="seg">
			<button class={s.vibrate ? 'on' : ''} onClick={() => up({ vibrate: !s.vibrate })}>진동 {s.vibrate ? '켜짐' : '꺼짐'}</button>
			<button class={s.fastForward ? 'on' : ''} onClick={() => up({ fastForward: !s.fastForward })}>항상 빨리감기 {s.fastForward ? '켜짐' : '꺼짐'}</button>
		</div>
		<p class="muted small">데미지 예상: 기술 버튼에 상대에게 줄 데미지의 대략적인 비율을 표시합니다 (연습용).</p>
		<h3 class="sec">포켓몬 그림</h3>
		<div class="seg">
			<button class={s.animatedSprites ? 'on' : ''} onClick={() => up({ animatedSprites: true })}>움직이는 그림</button>
			<button class={!s.animatedSprites ? 'on' : ''} onClick={() => up({ animatedSprites: false })}>정지 도트 그림 (기본)</button>
		</div>
		<p class="muted small">포켓몬 그림은 인터넷에 연결되어 있을 때 표시됩니다. (오프라인이면 이름 카드로 표시)</p>
		<h3 class="sec">정보</h3>
		<p class="muted small">배틀 계산은 Pokémon Showdown 시뮬레이터(MIT)를 그대로 사용합니다. 비공식 팬 메이드 앱이며, 포켓몬 관련 명칭의 권리는 Nintendo·Creatures·GAME FREAK·The Pokémon Company에 있습니다.</p>
		<button class="btn danger" onClick={() => { if (confirm('모든 기록과 팀을 지울까요?')) { try { Object.keys(localStorage).filter(k => k.startsWith('pkbkr:')).forEach(k => localStorage.removeItem(k)); } catch {} toast('초기화했습니다'); } }}>데이터 초기화</button>
	</Screen>;
}

function App() {
	const [modeView, setModeView] = useState<VNode | null>(null);
	const [route, setRoute] = useState<string>('title');
	const [editTeam, setEditTeam] = useState<any>(null);
	useEffect(() => { bindView(setModeView); applyTheme(loadSettings()); }, []);

	const go = async (r: string) => {
		if (r.startsWith('mode:')) {
			const m = MODES.find(x => x.id === r.slice(5))!;
			setRoute('mode');
			resetAbort();
			try { await m.run(); } catch (e: any) { if (!(e instanceof QuitToMenu)) { console.error(e); toast('오류: ' + (e?.message || e)); } }
			resetAbort();
			setModeView(null);
			setRoute('home');
			playMusic('title');
			return;
		}
		setRoute(r);
	};

	// 안드로이드 뒤로가기
	useEffect(() => {
		(window as any).onAndroidBack = () => {
			const backBtn = document.querySelector('.bar .icon-btn[aria-label="뒤로"]') as HTMLButtonElement | null;
			if (document.querySelector('.modal-bg')) { (document.querySelector('.modal-bg') as HTMLElement).click(); return true; }
			if (backBtn) { backBtn.click(); return true; }
			const ctlBack = document.querySelector('.ctl-head .ctl-back') as HTMLButtonElement | null; // 배틀 명령창의 ◀ 뒤로
			if (ctlBack) { ctlBack.click(); return true; }
			const menu = document.querySelector('.hud-top .menu-btn') as HTMLButtonElement | null;
			if (menu) { menu.click(); return true; } // 배틀 메뉴 (메인 메뉴로·기권)
			if (document.querySelector('.battle')) return true; // 연출 중엔 무시
			if (route !== 'home' && route !== 'title') { setRoute('home'); return true; }
			if (route === 'home') { setRoute('title'); return true; }
			return false;
		};
	});

	if (route === 'title') return <TitleScreen onStart={() => { unlockAudio(); playMusic('title'); sfx('select'); setRoute('home'); }} />;
	if (route === 'mode') return modeView || <div class="loading">불러오는 중…</div>;
	if (route === 'teams') {
		if (editTeam) return <TeamEditor team={editTeam} onBack={() => setEditTeam(null)} />;
		return <TeamList onBack={() => setRoute('home')} onEdit={t => setEditTeam(t)} />;
	}
	if (route === 'records') return <Records onBack={() => setRoute('home')} />;
	if (route === 'calc') return <CalcScreen onBack={() => setRoute('home')} />;
	if (route === 'settings') return <SettingsScreen onBack={() => setRoute('home')} />;
	return <Home go={go} />;
}

/** 창틀·배경 설정 적용 (CSS 변수) */
export function applyTheme(s: Settings) {
	const root = document.documentElement;
	root.setAttribute('data-frame', s.frame || 'stone');
	root.setAttribute('data-bg', s.homeBg || 'title');
}

// 버튼 누를 때 효과음
document.addEventListener('pointerdown', e => {
	const b = (e.target as HTMLElement).closest('button');
	if (!b || (b as HTMLButtonElement).disabled) return;
	unlockAudio();
	sfx(b.getAttribute('aria-label') === '뒤로' || b.textContent?.includes('뒤로') ? 'back' : 'select');
}, true);

render(<App />, document.getElementById('app')!);
