/** 공용 UI 조각과 화면 전환 도우미 */
import { h, render, type ComponentChildren, type VNode } from 'preact';
import { useState } from 'preact/hooks';
import { spriteId, typeKo, speciesData, toID, RAW, type Gen } from '../data';
import { loadSettings } from '../store';

// ── 화면 전환: 모드 진행 코드를 async 함수로 쓰기 위한 도우미 ──
let setViewFn: ((v: VNode | null) => void) | null = null;
export function bindView(fn: (v: VNode | null) => void) { setViewFn = fn; }
export function show(node: VNode | null) { setViewFn?.(node); }
/** render(resolve) 가 그린 화면에서 resolve 가 불릴 때까지 기다림 */
/** 배틀 중 '메인 메뉴로' — 진행 중인 모드를 끝낸다 */
export class QuitToMenu extends Error { constructor() { super('quit'); } }
let aborting = false;
export function abortMode() { aborting = true; }
export function resetAbort() { aborting = false; }
export function ask<T>(render: (resolve: (v: T) => void) => VNode): Promise<T> {
	if (aborting) return Promise.reject(new QuitToMenu());
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
/** 앱 안에 들어 있는 그림 (scripts/fetch-sprites.sh 로 받음) — 오프라인에서도 표시 */
export const LOCAL_SPRITES = 'sprites';
declare const __LITE__: boolean;
/** 저용량판: 앱 안에 그림이 없어 전부 인터넷에서 */
export const LITE = typeof __LITE__ === 'boolean' ? __LITE__ : false;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** 도구 아이콘 (쇼다운 아이템 아이콘 시트, 24×24) */
export function ItemIcon({ item, size = 24 }: { item: string; size?: number }) {
	const n = RAW.items[toID(item)]?.sp;
	if (!item || n === undefined) return <span class="item-icon none" style={{ width: size, height: size }} />;
	const k = size / 24;
	return <span class="item-icon" style={{ width: size, height: size, backgroundImage: LITE ? `url(${SPRITE_HOST}/itemicons-sheet.png)` : `url(${LOCAL_SPRITES}/itemicons-sheet.png), url(${SPRITE_HOST}/itemicons-sheet.png)`,
		backgroundPosition: `${-(n % 16) * 24 * k}px ${-Math.floor(n / 16) * 24 * k}px`, backgroundSize: `${384 * k}px ${1152 * k}px` }} />;
}

/** 물리/특수/변화 아이콘 */
export function CatIcon({ cat }: { cat: string }) {
	const label = cat === 'Physical' ? '물리' : cat === 'Special' ? '특수' : '변화';
	return <span class={'cat-icon ' + cat.toLowerCase()} title={label}>{label}</span>;
}

const preloaded: { [url: string]: HTMLImageElement } = {};
/** 배틀 시작 전에 그림을 미리 받아 둔다 (교체 때 그림이 늦게 뜨는 것 방지) */
export function preloadSprite(species: string, back: boolean, shiny?: boolean) {
	const settings = loadSettings();
	const id = spriteId(species);
	const sh = shiny ? '-shiny' : '';
	if (!settings.animatedSprites || !online()) return; // 앱 안의 그림은 받을 필요 없음
	const url = `${SPRITE_HOST}/ani${back ? '-back' : ''}${sh}/${id}.gif`;
	if (preloaded[url]) return;
	const im = new Image(); im.decoding = 'async'; im.src = url; preloaded[url] = im;
}

/** 포켓몬 그림 (인터넷 연결 시 쇼다운 스프라이트, 실패하면 이름 카드) */
export function Sprite({ species, back, shiny, gen = 5, size = 96, anim, cls }: {
	species: string; back?: boolean; shiny?: boolean; gen?: Gen; size?: number; anim?: boolean; cls?: string;
}) {
	const settings = loadSettings();
	const id = species === 'substitute' ? 'substitute' : spriteId(species);
	const useAnim = (anim ?? settings.animatedSprites);
	const candidates = spriteCandidates(species, id, !!back, !!shiny, useAnim, gen);
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

/** 그림 후보 순서: 온라인이면 움직이는 그림 → 앱 안의 정지 그림 → 서버 정지 그림, 오프라인이면 앱 안의 그림부터 */
function spriteCandidates(species: string, id: string, back: boolean, shiny: boolean, useAnim: boolean, gen: Gen): string[] {
	const b = back ? '-back' : '', sh = shiny ? '-shiny' : '';
	if (id === 'substitute') return LITE ? [`${SPRITE_HOST}/substitutes/gen5${b}/substitute.png`] : [`${LOCAL_SPRITES}/substitutes/gen5${b}/substitute.png`, `${SPRITE_HOST}/substitutes/gen5${b}/substitute.png`];
	const local = [`${LOCAL_SPRITES}/gen5${b}${sh}/${id}.png`];
	// 앱에 없는 모습(일부 Z-A 메가 등)은 기본 모습으로
	const base = speciesData(toID(species), 9 as Gen)?.base;
	if (base) local.push(`${LOCAL_SPRITES}/gen5${b}${sh}/${spriteId(base)}.png`);
	const remote: string[] = [];
	if (useAnim) remote.push(`${SPRITE_HOST}/ani${b}${sh}/${id}.gif`, `${SPRITE_HOST}/gen5ani${b}${sh}/${id}.gif`);
	if (gen === 4) remote.push(`${SPRITE_HOST}/gen4${b}${sh}/${id}.png`);
	const remoteStatic = `${SPRITE_HOST}/gen5${b}${sh}/${id}.png`;
	if (LITE) { const rb = base ? [`${SPRITE_HOST}/gen5${b}${sh}/${spriteId(base)}.png`] : []; return useAnim ? [...remote, remoteStatic, ...rb] : [remoteStatic, ...rb]; }
	if (!online()) return [...local, remoteStatic];
	return useAnim ? [...remote, local[0], remoteStatic, ...local.slice(1)] : [local[0], remoteStatic, ...local.slice(1)];
}

/** 목록용 작은 아이콘 */
export function MiniSprite({ species, gen = 5, size = 40, shiny }: { species: string; gen?: Gen; size?: number; shiny?: boolean }) {
	return <span class="mini" style={{ width: size, height: size }}>
		<Sprite species={species} gen={gen} size={size} anim={false} shiny={shiny} />
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
