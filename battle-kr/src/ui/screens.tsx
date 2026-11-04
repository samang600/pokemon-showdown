/** 메뉴·선택 화면들 */
import { h, Fragment, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { speciesData, toID, moveKo, itemKo, abilityKo, natureKo, typeKo, STAT_SHORT, type Gen } from '../data';
import type { PSet } from '../sets';
import { Screen, Sprite, MiniSprite, TypeBadge, Modal } from './core';

/** 세트 요약 카드 */
export function SetCard({ set, gen, selected, order, onClick, compact, children }: {
	set: PSet; gen: Gen; selected?: boolean; order?: number; onClick?: () => void; compact?: boolean; children?: ComponentChildren;
}) {
	const sd = speciesData(toID(set.species), gen);
	return <div class={'set-card' + (selected ? ' selected' : '') + (onClick ? ' clickable' : '')} onClick={onClick}>
		{order !== undefined && <span class="order">{order}</span>}
		<div class="set-sprite"><Sprite species={set.species} gen={gen} size={64} anim={false} shiny={set.shiny} /></div>
		<div class="set-body">
			<div class="set-title"><b>{set.name || sd?.n}</b>{sd?.t.map(t => <TypeBadge type={t} small />)}</div>
			<div class="set-meta">{abilityKo(set.ability)} · {set.item ? itemKo(set.item) : '도구 없음'}{!compact && ` · ${natureKo(set.nature)}`}</div>
			<div class="set-moves">{set.moves.map(m => <span>{moveKo(m)}</span>)}</div>
		</div>
		{children}
	</div>;
}

/** N마리 고르기 (순서 = 선택 순서, 첫 번째가 선봉) */
export function PickScreen({ title, team, gen, count, opponent, hint, onDone, onBack }: {
	title: string; team: PSet[]; gen: Gen; count: number; opponent?: { name: string; team: PSet[] };
	hint?: string; onDone: (picked: PSet[]) => void; onBack?: () => void;
}) {
	const [picked, setPicked] = useState<number[]>([]);
	const toggle = (i: number) => {
		if (picked.includes(i)) setPicked(picked.filter(x => x !== i));
		else if (picked.length < count) setPicked([...picked, i]);
	};
	return <Screen title={title} onBack={onBack}>
		{opponent && <div class="preview">
			<div class="preview-title">상대: {opponent.name}</div>
			<div class="preview-row">{opponent.team.map(s => <MiniSprite species={s.species} gen={gen} size={44} />)}</div>
		</div>}
		<p class="hint">{hint || `${count}마리를 순서대로 고르세요. 처음 고른 포켓몬이 먼저 나갑니다.`}</p>
		<div class="card-list">
			{team.map((s, i) => <SetCard set={s} gen={gen} selected={picked.includes(i)}
				order={picked.includes(i) ? picked.indexOf(i) + 1 : undefined} onClick={() => toggle(i)} />)}
		</div>
		<div class="sticky-bottom">
			<button class="btn primary big" disabled={picked.length !== Math.min(count, team.length)}
				onClick={() => onDone(picked.map(i => team[i]))}>결정 ({picked.length}/{Math.min(count, team.length)})</button>
		</div>
	</Screen>;
}

/** 트레이너 등장 / 결과 같은 안내 화면 */
export function InfoScreen({ title, heading, lines, sprites, gen, actions, banner, children }: {
	title: string; heading?: string; lines?: string[]; sprites?: string[]; gen?: Gen; banner?: string; children?: ComponentChildren;
	actions: { label: string; kind?: 'primary' | 'ghost' | 'danger'; onClick: () => void }[];
}) {
	return <Screen title={title}>
		<div class="info-screen">
			{banner && <div class="banner">{banner}</div>}
			{heading && <h2>{heading}</h2>}
			{sprites && <div class="preview-row big">{sprites.map(s => <Sprite species={s} gen={gen || 5} size={64} anim />)}</div>}
			{lines?.map(l => <p class="pre">{l}</p>)}
			{children}
		</div>
		<div class="sticky-bottom col">
			{actions.map(a => <button class={'btn big ' + (a.kind || 'primary')} onClick={a.onClick}>{a.label}</button>)}
		</div>
	</Screen>;
}

/** 팩토리 교환 */
export function SwapScreen({ mine, theirs, gen, onDone }: {
	mine: PSet[]; theirs: PSet[]; gen: Gen; onDone: (r: { give: number; take: number } | null) => void;
}) {
	const [give, setGive] = useState(-1);
	const [take, setTake] = useState(-1);
	return <Screen title="포켓몬 교환">
		<p class="hint">방금 이긴 상대의 포켓몬과 1마리를 교환할 수 있습니다.</p>
		<h3 class="sec">내보낼 포켓몬</h3>
		<div class="card-list">{mine.map((s, i) => <SetCard set={s} gen={gen} compact selected={give === i} onClick={() => setGive(i)} />)}</div>
		<h3 class="sec">받을 포켓몬</h3>
		<div class="card-list">{theirs.map((s, i) => <SetCard set={s} gen={gen} compact selected={take === i} onClick={() => setTake(i)} />)}</div>
		<div class="sticky-bottom row">
			<button class="btn ghost big" onClick={() => onDone(null)}>교환 안 함</button>
			<button class="btn primary big" disabled={give < 0 || take < 0} onClick={() => onDone({ give, take })}>교환</button>
		</div>
	</Screen>;
}

/** 선택지 목록 */
export function ChoiceScreen<T>({ title, intro, options, onPick, onBack }: {
	title: string; intro?: ComponentChildren; onBack?: () => void;
	options: { value: T; label: string; desc?: string; badge?: string; disabled?: boolean; icon?: ComponentChildren }[];
	onPick: (v: T) => void;
}) {
	return <Screen title={title} onBack={onBack}>
		{intro}
		<div class="option-list">
			{options.map(o => <button class="option" disabled={o.disabled} onClick={() => onPick(o.value)}>
				{o.icon && <span class="opt-icon">{o.icon}</span>}
				<span class="opt-body"><b>{o.label}</b>{o.desc && <small>{o.desc}</small>}</span>
				{o.badge && <span class="opt-badge">{o.badge}</span>}
			</button>)}
		</div>
	</Screen>;
}

/** 대진표 */
export function BracketView({ rounds, highlight }: { rounds: string[][]; highlight: string }) {
	const names = ['1회전', '준결승', '결승', '우승'];
	return <div class="bracket">
		{rounds.map((r, ri) => <div class="b-round">
			<div class="b-title">{names[ri]}</div>
			{r.map(n => <div class={'b-entry' + (n === highlight ? ' me' : '') + (!n ? ' tbd' : '')}>{n || '?'}</div>)}
		</div>)}
	</div>;
}

export function SetDetailModal({ set, gen, onClose }: { set: PSet; gen: Gen; onClose: () => void }) {
	const sd = speciesData(toID(set.species), gen);
	return <Modal title={set.name} onClose={onClose}>
		<div class="detail">
			<div class="detail-head"><Sprite species={set.species} gen={gen} size={96} />
				<div>{sd?.t.map(t => <TypeBadge type={t} />)}<p class="muted">종족값 {sd?.bs.join('/')}</p></div></div>
			<p>{abilityKo(set.ability)} · {itemKo(set.item)} · {natureKo(set.nature)}</p>
			<p class="muted">노력치 {Object.entries(set.evs).filter(([, v]) => v).map(([k, v]) => `${STAT_SHORT[k]} ${v}`).join(' / ')}</p>
			<ul class="move-list">{set.moves.map(m => <li>{moveKo(m)}</li>)}</ul>
		</div>
	</Modal>;
}
void Fragment; void typeKo;
