/** 공용 UI 조각과 화면 전환 도우미 */
import { h, render, type ComponentChildren, type VNode } from 'preact';
import { useState } from 'preact/hooks';
import { spriteId, typeKo, speciesData, toID, type Gen } from '../data';
import { loadSettings } from '../store';

// ── 화면 전환: 모드 진행 코드를 async 함수로 쓰기 위한 도우미 ──
let setViewFn: ((v: VNode | null) => void) | null = null;
export function bindView(fn: (v: VNode | null) => void) { setViewFn = fn; }
export function show(node: VNode | null) { setViewFn?.(node); }
/** render(resolve) 가 그린 화면에서 resolve 가 불릴 때까지 기다림 */
export function ask<T>(render: (resolve: (v: T) => void) => VNode): Promise<T> {
	return new Promise<T>(resolve => {
		let done = false;
		const once = (v: T) => { if (!done) { done = true; resolve(v); } };
		show(render(once));
	});
}

// ── 타입 색 ──
export const TYPE_COLOR: { [t: string]: string } = {
	Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#d9b400', Grass: '#3fa129', Ice: '#3dcef3',
	Fighting: '#ff8000', Poison: '#9141cb', Ground: '#915121', Flying: '#81b9ef', Psychic: '#ef4179', Bug: '#91a119',
	Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1', Dark: '#624d4e', Steel: '#60a1b8', Fairy: '#ef70ef', '???': '#68a090',
};

export function TypeBadge({ type, small }: { type: string; small?: boolean }) {
	return <span class={'type' + (small ? ' small' : '')} style={{ background: TYPE_COLOR[type] || '#888' }}>{typeKo(type)}</span>;
}

const SPRITE_HOST = 'https://play.pokemonshowdown.com/sprites';

/** 포켓몬 그림 (인터넷 연결 시 쇼다운 스프라이트, 실패하면 이름 카드) */
export function Sprite({ species, back, shiny, gen = 5, size = 96, anim, cls }: {
	species: string; back?: boolean; shiny?: boolean; gen?: Gen; size?: number; anim?: boolean; cls?: string;
}) {
	const settings = loadSettings();
	const id = species === 'substitute' ? 'substitute' : spriteId(species);
	const useAnim = (anim ?? settings.animatedSprites);
	const candidates: string[] = [];
	const sh = shiny ? '-shiny' : '';
	if (useAnim) candidates.push(`${SPRITE_HOST}/gen5ani${back ? '-back' : ''}${sh}/${id}.gif`);
	if (gen === 4) candidates.push(`${SPRITE_HOST}/gen4${back ? '-back' : ''}${sh}/${id}.png`);
	candidates.push(`${SPRITE_HOST}/gen5${back ? '-back' : ''}${sh}/${id}.png`);
	const [idx, setIdx] = useState(0);
	const [key, setKey] = useState(id + back + shiny + gen + useAnim);
	const curKey = id + back + shiny + gen + useAnim;
	if (key !== curKey) { setKey(curKey); setIdx(0); }
	if (idx >= candidates.length && id === 'substitute') {
		return <div class={'sub-doll ' + (cls || '')}>대타</div>;
	}
	if (idx >= candidates.length) {
		const s = speciesData(toID(species), gen);
		const color = TYPE_COLOR[s?.t[0] || 'Normal'];
		return <div class={'sprite-fallback ' + (cls || '')} style={{ width: size, height: size, borderColor: color }}>
			<span style={{ color }}>{(s?.n || species).slice(0, 4)}</span>
		</div>;
	}
	return <img class={'sprite ' + (cls || '')} src={candidates[idx]} alt={species} loading="lazy"
		style={{ maxWidth: size, maxHeight: size, objectFit: 'contain' }}
		onError={() => setIdx(idx + 1)} draggable={false} />;
}

/** 목록용 작은 아이콘 */
export function MiniSprite({ species, gen = 5, size = 40 }: { species: string; gen?: Gen; size?: number }) {
	return <span class="mini" style={{ width: size, height: size }}>
		<Sprite species={species} gen={gen} size={size} anim={false} />
	</span>;
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ComponentChildren }) {
	return <header class="bar">
		{onBack ? <button class="icon-btn" onClick={onBack} aria-label="뒤로">‹</button> : <span class="icon-gap" />}
		<h1>{title}</h1>
		<div class="bar-right">{right}</div>
	</header>;
}

export function Screen({ title, onBack, right, children, cls }: {
	title: string; onBack?: () => void; right?: ComponentChildren; children: ComponentChildren; cls?: string;
}) {
	return <div class={'screen ' + (cls || '')}>
		<Header title={title} onBack={onBack} right={right} />
		<main class="content">{children}</main>
	</div>;
}

export function HPBar({ hp, maxhp, showText }: { hp: number; maxhp: number; showText?: boolean }) {
	const pct = maxhp ? Math.max(0, Math.min(100, hp / maxhp * 100)) : 0;
	const color = pct > 50 ? 'var(--hp-good)' : pct > 20 ? 'var(--hp-mid)' : 'var(--hp-low)';
	return <div class="hpbar">
		<div class="hpbar-fill" style={{ width: pct + '%', background: color }} />
		{showText && <span class="hpbar-text">{hp}/{maxhp}</span>}
	</div>;
}

export const STATUS_LABEL: { [s: string]: [string, string] } = {
	brn: ['화상', '#e0632e'], par: ['마비', '#c9a800'], slp: ['잠듦', '#8a8a9a'], frz: ['얼음', '#3cb8d8'],
	psn: ['독', '#9a4ac0'], tox: ['맹독', '#7a2aa0'], fnt: ['기절', '#555'],
};
export function StatusBadge({ status }: { status?: string }) {
	if (!status || !STATUS_LABEL[status]) return null;
	const [label, color] = STATUS_LABEL[status];
	return <span class="status" style={{ background: color }}>{label}</span>;
}

export function Modal({ onClose, children, title }: { onClose: () => void; children: ComponentChildren; title?: string }) {
	return <div class="modal-bg" onClick={onClose}>
		<div class="modal" onClick={e => e.stopPropagation()}>
			{title && <div class="modal-title"><b>{title}</b><button class="icon-btn" onClick={onClose} aria-label="닫기">×</button></div>}
			<div class="modal-body">{children}</div>
		</div>
	</div>;
}

let toastTimer: any;
export function toast(msg: string) {
	let el = document.getElementById('toast');
	if (!el) {
		el = document.createElement('div');
		el.id = 'toast';
		document.body.appendChild(el);
	}
	el.textContent = msg;
	el.className = 'show';
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => { el!.className = ''; }, 2200);
}

/** 확인 대화상자 */
export function confirmBox(title: string, body: string, ok = '확인', cancel = '취소'): Promise<boolean> {
	return new Promise(resolve => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const close = (v: boolean) => { render(null, host); host.remove(); resolve(v); };
		render(
			<Modal onClose={() => close(false)} title={title}>
				<p class="pre">{body}</p>
				<div class="row end">
					{cancel && <button class="btn ghost" onClick={() => close(false)}>{cancel}</button>}
					<button class="btn primary" onClick={() => close(true)}>{ok}</button>
				</div>
			</Modal>, host);
	});
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
void h;
