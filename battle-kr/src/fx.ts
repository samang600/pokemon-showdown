/**
 * 배틀 이펙트 — 타입·분류·기술 이름에 따라 다른 도트 연출 (이 앱용으로 직접 만든 연출, 외부 그래픽 없음)
 *
 * 연출 원형(primitive): beam · bolt · projectile · stream · slash · punch · quake · wave · rain · vortex · ring ·
 *   powder · notes · shield · drain · bite · crescent · throw · sparkle
 * pickAnim() 이 기술 id·타입·분류·플래그를 보고 원형을 조합한다.
 */
import { TYPE_COLOR } from './ui/core';

export interface Pt { x: number; y: number }
export interface MoveFxInfo { id: string; type: string; category: string; flags: { [k: string]: any }; target?: string; basePower?: number }

const LIGHT: { [t: string]: string } = {
	Fire: '#ffd040', Water: '#b0e0ff', Electric: '#fff8a0', Grass: '#b0f080', Ice: '#e8ffff', Psychic: '#ffc0e0',
	Ghost: '#c8a0ff', Dark: '#a08080', Dragon: '#b0b8ff', Fairy: '#ffe0ff', Poison: '#e0a0ff', Steel: '#f0f0ff',
	Fighting: '#ffc080', Ground: '#e8c890', Rock: '#e0d8b0', Bug: '#e0f080', Flying: '#e0f0ff', Normal: '#ffffff', Stellar: '#ffffff',
};
const DARK: { [t: string]: string } = {
	Fire: '#a02010', Water: '#1040a0', Electric: '#a07000', Grass: '#206020', Ice: '#2080a0', Psychic: '#a02060',
	Ghost: '#402060', Dark: '#301818', Dragon: '#203090', Fairy: '#a040a0', Poison: '#501870', Steel: '#405060',
	Fighting: '#a04000', Ground: '#603010', Rock: '#605030', Bug: '#506010', Flying: '#4070a0', Normal: '#808080', Stellar: '#404060',
};
const col = (t: string) => ({ c: TYPE_COLOR[t] || '#fff', l: LIGHT[t] || '#fff', d: DARK[t] || '#444' });

function px(layer: HTMLElement, x: number, y: number, w: number, h: number, color: string, extra = '') {
	const el = document.createElement('div');
	el.className = 'fxp';
	el.style.cssText = `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;background:${color};${extra}`;
	layer.appendChild(el);
	return el;
}
function anim(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions) {
	const a = el.animate(frames, { easing: 'steps(6)', fill: 'forwards', ...opts });
	a.onfinish = () => el.remove();
	return a;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ───────── 원형 ─────────
export function burst(layer: HTMLElement, at: Pt, type: string, s: number, strong = false) {
	const { c, l } = col(type);
	const n = strong ? 18 : 10;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + rnd(0, 0.4);
		const dist = rnd(18, 40) * s * (strong ? 1.4 : 1);
		const size = Math.round(rnd(3, 6) * s);
		const el = px(layer, at.x, at.y, size, size, i % 2 ? c : l, ['Water', 'Poison', 'Fairy'].includes(type) ? 'border-radius:50%' : '');
		anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px)`, opacity: 0 }], { duration: rnd(360, 520) });
	}
	const ring = px(layer, at.x, at.y, 10 * s, 10 * s, 'transparent', `border:${Math.max(2, Math.round(s * 1.5))}px solid ${l};border-radius:50%`);
	anim(ring, [{ transform: 'scale(.4)', opacity: 1 }, { transform: `scale(${strong ? 5 : 3.4})`, opacity: 0 }], { duration: 360, easing: 'steps(5)' });
}

export function slash(layer: HTMLElement, at: Pt, type: string, s: number, count = 3, angle = -35) {
	const { l } = col(type);
	for (let i = 0; i < count; i++) {
		const w = 48 * s, h = Math.max(2, Math.round(2.5 * s));
		const el = px(layer, at.x, at.y + (i - (count - 1) / 2) * 10 * s, w, h, l, `transform:rotate(${angle}deg) scaleX(0)`);
		anim(el, [{ transform: `rotate(${angle}deg) scaleX(0)`, opacity: 1 }, { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 1, offset: 0.5 }, { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0 }],
			{ duration: 260, delay: i * 60, easing: 'steps(4)' });
	}
}

export function punch(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	// 충격 별
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		const el = px(layer, at.x, at.y, 14 * s, 3 * s, i % 2 ? c : l, `transform:rotate(${a}rad) translateX(0)`);
		anim(el, [{ transform: `rotate(${a}rad) translateX(0) scaleX(.2)`, opacity: 1 }, { transform: `rotate(${a}rad) translateX(${22 * s}px) scaleX(1)`, opacity: 0 }], { duration: 300, easing: 'steps(4)' });
	}
	const core = px(layer, at.x, at.y, 12 * s, 12 * s, '#fff', 'border-radius:50%');
	anim(core, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 220, easing: 'steps(3)' });
}

export function beam(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, dur = 650) {
	const { c, l } = col(type);
	const dx = to.x - from.x, dy = to.y - from.y;
	const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
	const mk = (h: number, color: string, delay: number) => {
		const el = px(layer, from.x, from.y, len, h, color, `transform-origin:0 50%;transform:rotate(${ang}rad) scaleX(0);left:${from.x}px;top:${from.y - h / 2}px`);
		anim(el, [{ transform: `rotate(${ang}rad) scaleX(0)`, opacity: 1 }, { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.25 },
			{ transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.8 }, { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 0 }], { duration: dur, delay, easing: 'steps(8)' });
	};
	mk(14 * s, c, 0); mk(7 * s, l, 40); mk(3 * s, '#fff', 80);
	setTimeout(() => burst(layer, to, type, s, true), dur * 0.3);
	return dur;
}

export function bolt(layer: HTMLElement, to: Pt, type: string, s: number, count = 2) {
	const { c, l } = col(type);
	for (let k = 0; k < count; k++) {
		const segs = 7;
		let x = to.x + rnd(-30, 30) * s, y = -10;
		for (let i = 0; i < segs; i++) {
			const nx = i === segs - 1 ? to.x : x + rnd(-18, 18) * s;
			const ny = i === segs - 1 ? to.y : y + (to.y + 10) / segs;
			const len = Math.hypot(nx - x, ny - y), ang = Math.atan2(ny - y, nx - x);
			const el = px(layer, x, y, len, 3 * s, i % 2 ? l : c, `transform-origin:0 50%;left:${x}px;top:${y}px;transform:rotate(${ang}rad)`);
			anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 260, delay: k * 130 + i * 12, easing: 'steps(3)' });
			x = nx; y = ny;
		}
		setTimeout(() => { flash(layer, l, 90); burst(layer, to, type, s); }, k * 130 + 90);
	}
}

export function projectile(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, big = false): number {
	const { c, l } = col(type);
	const count = big ? 1 : 7;
	const dur = 380;
	for (let i = 0; i < count; i++) {
		const size = Math.round((big ? 22 : 6) * s);
		const el = px(layer, from.x, from.y, size, size, big ? c : (i % 2 ? c : l), 'border-radius:50%' + (big ? `;box-shadow:0 0 0 ${3 * s}px ${l}` : ''));
		const j = () => rnd(-6, 6) * s;
		anim(el, [{ transform: 'translate(0,0)', opacity: 0.9 }, { transform: `translate(${(to.x - from.x) * 0.5 + j()}px,${(to.y - from.y) * 0.5 - 20 * s}px)`, opacity: 1 },
			{ transform: `translate(${to.x - from.x}px,${to.y - from.y}px)`, opacity: 0.8 }], { duration: dur, delay: i * 35, easing: 'steps(8)' });
	}
	setTimeout(() => burst(layer, to, type, s, big), dur + count * 35 - 60);
	return dur + count * 35;
}

/** 입에서 뿜는 줄기 (화염방사·하이드로펌프·냉동빔 등) */
export function stream(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, dur = 700) {
	const { c, l } = col(type);
	const n = 26;
	for (let i = 0; i < n; i++) {
		const size = Math.round(rnd(4, 9) * s);
		const el = px(layer, from.x, from.y, size, size, i % 3 === 0 ? '#fff' : i % 2 ? c : l, type === 'Water' || type === 'Poison' ? 'border-radius:50%' : '');
		const sp = rnd(-14, 14) * s;
		anim(el, [{ transform: 'translate(0,0) scale(.5)', opacity: 1 }, { transform: `translate(${to.x - from.x + sp}px,${to.y - from.y + sp}px) scale(1.4)`, opacity: 0.2 }],
			{ duration: 320, delay: i * (dur / n), easing: 'steps(6)' });
	}
	setTimeout(() => burst(layer, to, type, s, true), dur * 0.45);
	return dur;
}

export function quake(layer: HTMLElement, arena: HTMLElement, type: string, s: number) {
	const { d, l } = col(type);
	const h = layer.clientHeight, w = layer.clientWidth;
	for (let i = 0; i < 12; i++) {
		const x = rnd(0, w), y = rnd(h * 0.55, h);
		const el = px(layer, x, y, rnd(10, 30) * s, 3 * s, i % 2 ? d : l);
		anim(el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-rnd(10, 30) * s}px)`, opacity: 0 }], { duration: 500, delay: i * 40 });
	}
	shake(arena, true, 700);
}

/** 가로로 휩쓰는 파도 (파도타기·열풍·눈보라) */
export function wave(layer: HTMLElement, to: Pt, type: string, s: number, fromLeft: boolean) {
	const { c, l } = col(type);
	const w = layer.clientWidth;
	for (let i = 0; i < 14; i++) {
		const el = px(layer, fromLeft ? -20 : w + 20, to.y + rnd(-30, 20) * s, rnd(16, 40) * s, rnd(5, 9) * s, i % 2 ? c : l, type === 'Water' ? 'border-radius:50%' : '');
		anim(el, [{ transform: 'translateX(0)', opacity: 0.9 }, { transform: `translateX(${(fromLeft ? 1 : -1) * (w + 60)}px)`, opacity: 0.6 }], { duration: 700, delay: i * 30, easing: 'steps(10)' });
	}
	setTimeout(() => burst(layer, to, type, s, true), 350);
}

/** 하늘에서 떨어짐 (운석·낙석·유성) */
export function rain(layer: HTMLElement, to: Pt, type: string, s: number, count = 8, size = 8) {
	const { c, d } = col(type);
	for (let i = 0; i < count; i++) {
		const sz = Math.round(rnd(size * 0.6, size * 1.3) * s);
		const tx = to.x + rnd(-40, 40) * s;
		const el = px(layer, tx + 60 * s, -20, sz, sz, i % 2 ? c : d, type === 'Rock' || type === 'Ground' ? '' : 'border-radius:50%');
		anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${-60 * s}px,${to.y + 20 + rnd(-10, 10) * s}px)`, opacity: 1 }], { duration: 300, delay: i * 70, easing: 'steps(5)' });
		setTimeout(() => burst(layer, { x: tx, y: to.y }, type, s), i * 70 + 280);
	}
}

export function vortex(layer: HTMLElement, at: Pt, type: string, s: number, dur = 800) {
	const { c, l } = col(type);
	for (let i = 0; i < 16; i++) {
		const el = px(layer, at.x, at.y, 6 * s, 6 * s, i % 2 ? c : l, 'border-radius:50%');
		const r = (12 + i * 3) * s;
		const a0 = i * 0.8;
		const frames: Keyframe[] = [];
		for (let k = 0; k <= 8; k++) {
			const a = a0 + k * 0.9;
			frames.push({ transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r * 0.5 - k * 4 * s}px)`, opacity: k < 7 ? 1 : 0 });
		}
		anim(el, frames, { duration: dur, delay: i * 25, easing: 'steps(16)' });
	}
}

export function ring(layer: HTMLElement, at: Pt, type: string, s: number, big = true) {
	const { c, l } = col(type);
	for (let i = 0; i < 3; i++) {
		const el = px(layer, at.x, at.y, 20 * s, 20 * s, 'transparent', `border:${4 * s}px solid ${i % 2 ? c : l};border-radius:50%`);
		anim(el, [{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${big ? 7 : 4})`, opacity: 0 }], { duration: 500, delay: i * 110, easing: 'steps(6)' });
	}
	if (big) flash(layer, l, 250);
}

export function powder(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	for (let i = 0; i < 18; i++) {
		const el = px(layer, at.x + rnd(-30, 30) * s, at.y - 50 * s, 3 * s, 3 * s, i % 2 ? c : l, 'border-radius:50%');
		anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(${60 * s}px) translateX(${rnd(-10, 10) * s}px)`, opacity: 0 }], { duration: 900, delay: i * 40, easing: 'steps(10)' });
	}
}

export function notes(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	for (let i = 0; i < 6; i++) {
		const el = document.createElement('div');
		el.className = 'fxp fx-note';
		el.textContent = i % 2 ? '♪' : '♫';
		el.style.cssText = `left:${at.x + rnd(-24, 24) * s}px;top:${at.y - 10 * s}px;color:${i % 2 ? c : l};font-size:${14 * s}px;`;
		layer.appendChild(el);
		anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(${-50 * s}px)`, opacity: 0 }], { duration: 900, delay: i * 110 });
	}
}

export function shield(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	const el = px(layer, at.x, at.y - 10 * s, 60 * s, 60 * s, 'transparent', `border:${3 * s}px solid ${l};box-shadow:inset 0 0 0 ${3 * s}px ${c};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)`);
	anim(el, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.7 }, { transform: 'scale(1.1)', opacity: 0 }], { duration: 800 });
}

export function drain(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number) {
	const { c, l } = col(type);
	burst(layer, to, type, s);
	for (let i = 0; i < 10; i++) {
		const el = px(layer, to.x + rnd(-10, 10) * s, to.y, 5 * s, 5 * s, i % 2 ? c : l, 'border-radius:50%');
		anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${from.x - to.x}px,${from.y - to.y}px)`, opacity: 0.4 }], { duration: 600, delay: 200 + i * 50, easing: 'steps(8)' });
	}
}

export function bite(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { l } = col(type);
	for (const dir of [-1, 1]) {
		for (let i = 0; i < 4; i++) {
			const el = px(layer, at.x + (i - 1.5) * 10 * s, at.y + dir * 26 * s, 6 * s, 10 * s, l, `clip-path:polygon(50% ${dir > 0 ? 0 : 100}%,100% ${dir > 0 ? 100 : 0}%,0 ${dir > 0 ? 100 : 0}%)`);
			anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { transform: `translateY(${-dir * 18 * s}px)`, opacity: 1, offset: 0.5 }, { transform: `translateY(${-dir * 18 * s}px)`, opacity: 0 }], { duration: 400, easing: 'steps(4)' });
		}
	}
	setTimeout(() => burst(layer, at, type, s), 180);
}

export function crescent(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, count = 2) {
	const { l, c } = col(type);
	for (let i = 0; i < count; i++) {
		const el = px(layer, from.x, from.y, 30 * s, 30 * s, 'transparent', `border:${4 * s}px solid ${i % 2 ? l : c};border-color:${l} transparent transparent transparent;border-radius:50%`);
		anim(el, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px) rotate(540deg)`, opacity: 0.9 }], { duration: 380, delay: i * 120, easing: 'steps(8)' });
		setTimeout(() => slash(layer, to, type, s, 2, 20 + i * 40), i * 120 + 340);
	}
}

export function throwRocks(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, count = 5, round = false) {
	const { c, d } = col(type);
	for (let i = 0; i < count; i++) {
		const sz = rnd(6, 11) * s;
		const el = px(layer, from.x, from.y - 20 * s, sz, sz, i % 2 ? c : d, round ? 'border-radius:50%' : `clip-path:polygon(50% 0,100% 40%,80% 100%,20% 100%,0 40%)`);
		anim(el, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${(to.x - from.x) / 2}px,${(to.y - from.y) / 2 - 40 * s}px) rotate(180deg)`, opacity: 1 },
			{ transform: `translate(${to.x - from.x + rnd(-10, 10) * s}px,${to.y - from.y}px) rotate(360deg)`, opacity: 1 }], { duration: 420, delay: i * 90, easing: 'steps(8)' });
		setTimeout(() => burst(layer, to, type, s), i * 90 + 400);
	}
}

export function sparkle(layer: HTMLElement, at: Pt, type: string, s: number, down = false) {
	const c = LIGHT[type] || '#fff';
	for (let i = 0; i < 9; i++) {
		const el = px(layer, at.x + rnd(-25, 25) * s, at.y + rnd(-6, 24) * s, 3 * s, 3 * s, i % 3 ? c : '#ffffff');
		anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translateY(${(down ? 1 : -1) * 34 * s}px)`, opacity: 0 }], { duration: 600, delay: i * 40 });
	}
}

export function shake(el: HTMLElement, strong = false, dur = 0) {
	const d = strong ? 6 : 3;
	el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${d}px,${-d}px)` }, { transform: `translate(${-d}px,${d}px)` }, { transform: `translate(${d}px,0)` }, { transform: 'translate(0,0)' }],
		{ duration: dur || (strong ? 320 : 220), easing: 'steps(4)', iterations: dur ? 2 : 1 });
}
export function flash(layer: HTMLElement, color = '#fff', dur = 180) {
	const el = document.createElement('div');
	el.className = 'fx-flash';
	el.style.background = color;
	layer.appendChild(el);
	anim(el, [{ opacity: 0.85 }, { opacity: 0 }], { duration: dur, easing: 'steps(3)' });
}
export function pillar(layer: HTMLElement, at: Pt, color: string, s: number) {
	const el = document.createElement('div');
	el.className = 'fxp';
	const w = 40 * s;
	el.style.cssText = `left:${at.x - w / 2}px;top:0;width:${w}px;height:${at.y + 20 * s}px;background:linear-gradient(180deg, transparent, ${color});`;
	layer.appendChild(el);
	anim(el, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 0.9, transform: 'scaleX(1)', offset: 0.3 }, { opacity: 0, transform: 'scaleX(1.6)' }], { duration: 800, easing: 'steps(8)' });
	sparkle(layer, at, 'Normal', s);
}

/** 몬스터볼에서 나오기: 볼이 날아가 열리고 빛이 퍼짐 */
export function ballOut(layer: HTMLElement, from: Pt, to: Pt, s: number): number {
	const size = 10 * s;
	const ball = px(layer, from.x, from.y, size, size, 'linear-gradient(180deg,#e83030 0 45%,#111 45% 55%,#f8f8f8 55%)', 'border-radius:50%;box-shadow:0 0 0 1px #000');
	const dur = 420;
	anim(ball, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${(to.x - from.x) / 2}px,${(to.y - from.y) / 2 - 50 * s}px) rotate(360deg)` },
		{ transform: `translate(${to.x - from.x}px,${to.y - from.y}px) rotate(720deg)` }], { duration: dur, easing: 'steps(10)' });
	setTimeout(() => {
		flash(layer, '#fff', 140);
		const glow = px(layer, to.x, to.y, 8 * s, 8 * s, '#fff', 'border-radius:50%;box-shadow:0 0 12px 6px #fff');
		anim(glow, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(6)', opacity: 0 }], { duration: 380, easing: 'steps(6)' });
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * Math.PI * 2;
			const el = px(layer, to.x, to.y, 4 * s, 4 * s, i % 2 ? '#fff' : '#ffe080');
			anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * 40 * s}px,${Math.sin(a) * 40 * s * 0.6 - 10 * s}px)`, opacity: 0 }], { duration: 420, delay: 40, easing: 'steps(6)' });
		}
	}, dur - 20);
	return dur;
}

/** 돌아가기: 빛이 모여 볼로 */
export function ballIn(layer: HTMLElement, at: Pt, s: number) {
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		const el = px(layer, at.x + Math.cos(a) * 30 * s, at.y + Math.sin(a) * 20 * s, 4 * s, 4 * s, '#f8c0c0');
		anim(el, [{ opacity: 1 }, { transform: `translate(${-Math.cos(a) * 30 * s}px,${-Math.sin(a) * 20 * s}px)`, opacity: 0 }], { duration: 300, easing: 'steps(5)' });
	}
}

// ───────── 기술 → 연출 선택 ─────────
const RX = (re: RegExp, id: string) => re.test(id);

/**
 * 기술 하나의 연출을 재생. 돌아오는 값은 타격이 들어가는 시점(ms) — 그때 피격 소리를 낸다.
 */
export function playMove(layer: HTMLElement, arena: HTMLElement, m: MoveFxInfo, from: Pt, to: Pt, s: number, hits: Pt[] = [to]): number {
	const { id, type, category } = m;
	const own = from.x < layer.clientWidth / 2;
	const t = type;
	const each = (fn: (p: Pt) => void) => hits.forEach(fn);

	if (category === 'Status') {
		if (RX(/powder|spore|poisongas|stunspore|toxic$|willowisp|yawn|hypnosis|lovelykiss|darkvoid/, id)) { each(p => powder(layer, p, t, s)); return 500; }
		if (RX(/sing|song|roar$|chatter|round|perishsong|screech|supersonic|metalsound|growl|howl|noble/, id)) { notes(layer, from, t, s); return 500; }
		if (RX(/protect|detect|kingsshield|spikyshield|banefulbunker|obstruct|silktrap|burningbulwark|wideguard|quickguard|matblock|endure|reflect|lightscreen|auroraveil|safeguard|substitute|barrier|irondefense|acidarmor|withdraw|harden|defensecurl|cosmicpower|stockpile|amnesia|cottonguard|bulkup|coil|shelter/, id)) { shield(layer, from, t, s); return 500; }
		if (RX(/recover|roost|softboiled|milkdrink|slackoff|synthesis|moonlight|morningsun|rest|wish|healorder|shoreup|lifedew|junglehealing|healbell|aromatherapy|refresh|purify|floralhealing|healpulse/, id)) { sparkle(layer, hits[0] === to && m.target !== 'self' ? to : from, 'Grass', s); return 500; }
		if (RX(/dance|nastyplot|calmmind|agility|rockpolish|shiftgear|autotomize|workup|growth|honeclaws|tailglow|geomancy|clangoroussoul|noretreat|bellydrum|curse|meditate|sharpen|focusenergy|charge|victorydance|tidyup|quiverdance|dragondance|swordsdance|shellsmash/, id)) {
			sparkle(layer, from, t, s); ring(layer, from, t, s, false); return 500;
		}
		if (RX(/stealthrock|spikes|toxicspikes|stickyweb|stoneaxe|ceaselessedge/, id)) { throwRocks(layer, from, { x: to.x, y: to.y + 20 * s }, t === 'Normal' ? 'Rock' : t, s, 4); return 500; }
		if (RX(/thunderwave|glare|leer|taunt|torment|encore|disable|spite|meanlook|block|confuseray|swagger|flatter|attract|sweetkiss|teeterdance|trick|switcheroo|knockoff|embargo|healblock|imprison|psychup|haze|clearsmog|whirlwind|roar|dragontail|circlethrow|lockon|mindreader|foresight|odorsleuth|miracleeye|memento|partingshot|defog|rapidspin|mortalspin|toxicthread|strengthsap|leechseed|poisonpowder/, id)) {
			each(p => sparkle(layer, p, t, s, true)); if (RX(/leechseed|strengthsap/, id)) drain(layer, from, to, 'Grass', s); return 450;
		}
		if (RX(/raindance|sunnyday|sandstorm|hail|snowscape|chillyreception|trickroom|gravity|magicroom|wonderroom|electricterrain|grassyterrain|mistyterrain|psychicterrain|tailwind|mudsport|watersport/, id)) { flash(layer, LIGHT[t] || '#fff', 400); powder(layer, { x: layer.clientWidth / 2, y: layer.clientHeight / 2 }, t, s); return 500; }
		sparkle(layer, m.target === 'self' || m.target === 'allySide' ? from : to, t, s);
		return 450;
	}

	// ── 공격 기술 ──
	const strong = (m.basePower || 0) >= 100;
	if (RX(/explosion|selfdestruct|mistyexplosion|boomburst|hyperbeam|gigaimpact|bloomdoom|infernooverdrive|supernova|eruption|waterspout|mindblown|steelbeam|chloroblast|finalgambit|lastresort/, id)) {
		if (RX(/hyperbeam|gigaimpact|steelbeam|chloroblast/, id)) { return beam(layer, from, to, t, s, 800) * 0.35; }
		ring(layer, RX(/explosion|selfdestruct|mindblown|mistyexplosion/, id) ? from : to, t, s, true); shake(arena, true); return 300;
	}
	if (RX(/beam|solar|flashcannon|technoblast|prismaticlaser|lightthatburnsthesky|dynamaxcannon|eternabeam|psystrike|aurasphere|moonblast|dracometeor$|hydrocannon|frenzyplant|blastburn|mistball|lusterpurge|freezedry|triattack|signalbeam|chargebeam|bubblebeam|psybeam|icebeam|hyperbeam|powergem|judgment|fleurcannon|photongeyser/, id)) {
		const d = beam(layer, from, to, t, s, strong ? 750 : 600); return d * 0.3;
	}
	if (RX(/thunder|bolt|volt|zap|discharge|electro|shock|spark|wildcharge|plasma|risingvoltage|boltbeak|fusionbolt|thunderous|thunderbolt|thunderclap|supercellslam/, id) && t === 'Electric') {
		if (RX(/wildcharge|volttackle|boltbeak|spark|thunderpunch|thunderfang|supercellslam|zingzap|plasmafists|thunderouskick/, id)) { punch(layer, to, t, s); setTimeout(() => bolt(layer, to, t, s, 1), 60); return 120; }
		each(p => bolt(layer, p, t, s, strong ? 3 : 2)); return 110;
	}
	if (RX(/flamethrower|fireblast|heatwave|overheat|flamecharge|inferno|lavaplume|fierydance|magmastorm|burnup|searingshot|ember|blazekick|incinerate|mysticalfire|scald|steameruption|hydropump|surf|muddywater|waterpulse|watergun|bubble|sludge|acid|gunkshot|venoshock|dragonbreath|dragonpulse|icywind|blizzard|frostbreath|powdersnow|glaciate|dragonenergy|breakingswipe|snarl|darkpulse|hex|shadowball|nightshade|psyshock|psychic$|extrasensory|futuresight|storedpower|expandingforce|energyball|gigadrain|leafstorm|petalblizzard|bugbuzz|airslash|hurricane|gust|aircutter|razorwind|ominouswind|silverwind|fairywind|dazzlinggleam|drainingkiss|sparklingaria|oceanicoperetta|hyperspacefury|spacialrend|roaroftime|originpulse|precipiceblades|clangingscales|coreenforcer|overdrive|torchsong|bittermalice|infernalparade|makeitrain|ragingbull|armorcannon|bleakwindstorm|wildboltstorm|sandsearstorm|springtidestorm|psyblade|lumina|ivycudgel|electroshot|matchagotcha|syrupbomb|tachyoncutter/, id) && category === 'Special' || (category === 'Special' && RX(/flame|fire|heat|burn|water|hydro|aqua|ice|frost|freeze|snow|sludge|acid|poison|dragon|psy|shadow|dark|leaf|energy|air|wind|storm|fairy|gleam/, id))) {
		if (RX(/surf|muddywater|heatwave|blizzard|icywind|hurricane|petalblizzard|glaciate|bleakwindstorm|wildboltstorm|sandsearstorm|springtidestorm|wave$/, id)) { wave(layer, to, t, s, own); shake(arena); return 350; }
		if (RX(/pulse|ball$|shadowball|energyball|sludgebomb|moonblast|mistball|psyshock|hex|nightshade|storedpower|expandingforce|focusblast|aurasphere|seedbomb|eggbomb|weatherball|electroball|gyroball|iceball|octazooka|syrupbomb|acidspray|mudbomb|mudshot/, id)) { return projectile(layer, from, to, t, s, strong || RX(/ball|bomb|blast/, id)) - 60; }
		if (RX(/twister|whirlpool|firespin|sandtomb|magmastorm|infestation|snaptrap|thunderstorm|hurricane|vortex|razorwind|ominouswind|silverwind|fairywind|gust|aircutter|tailwind|fierydance/, id)) { each(p => vortex(layer, p, t, s)); return 300; }
		if (RX(/psychic$|extrasensory|futuresight|confusion|zenheadbutt|psystrike|psyblade|lumina|dreameater|mysticalfire|bittermalice|infernalparade|hyperspace|spacialrend|roaroftime/, id)) { each(p => { ring(layer, p, t, s, false); vortex(layer, p, t, s, 600); }); flash(layer, LIGHT[t], 200); return 300; }
		return stream(layer, from, to, t, s, strong ? 800 : 650) * 0.45;
	}
	if (category === 'Special') {
		if (RX(/storm|meteor|dracometeor|rockslide|meteorbeam|cometpunch|ancientpower|powergem|stoneedge|rockblast|diamondstorm|seedflare|magnitude|earthpower|scorchingsands|makeitrain|malignantchain/, id)) { rain(layer, to, t, s, strong ? 10 : 6); shake(arena); return 420; }
		return projectile(layer, from, to, t, s, strong) - 60;
	}

	// 물리
	if (RX(/earthquake|bulldoze|magnitude|stomp|stompingtantrum|highhorsepower|headlongrush|precipiceblades|fissure|earthpower|thousandwaves|thousandarrows|landswrath|stampede|tremor/, id)) { quake(layer, arena, t, s); each(p => burst(layer, p, t, s, true)); return 250; }
	if (RX(/rockslide|stoneedge|rockblast|rocktomb|rockthrow|ancientpower|rockwrecker|headsmash|accelerock|smackdown|meteormash|cometpunch|diamondstorm|stoneaxe|mightycleave|rockclimb/, id)) {
		if (RX(/rockslide|rocktomb|ancientpower|diamondstorm|stoneedge/, id)) { rain(layer, to, t, s, 8, 10); shake(arena); return 420; }
		throwRocks(layer, from, to, t, s, 5); return 420;
	}
	if (RX(/punch|fist|chop|hammer|smash|slam|bodypress|clap|tackle|bodyslam|doubleedge|takedown|gigaimpact|headbutt|skullbash|ironhead|zenheadbutt|headsmash|headcharge|rush|charge|ram|collision|knock|bash|pound|facade|return|frustration|retaliate|revenge|payback|suckerpunch|quickattack|extremespeed|fakeout|feint|machpunch|bulletpunch|shadowsneak|aquajet|iceshard|accelerock|jetpunch|grassyglide|flipturn|uturn|voltswitch|crushgrip|hardpress|thrash|outrage|strength|superpower|closecombat|highjumpkick|jumpkick|kick|lowsweep|lowkick|drainpunch|crosschop|skyuppercut|meteormash|darkestlariat|throatchop|dualchop|armthrust|tripleaxel|triplekick|axekick|tripledive|bounce|fly$|dive|dig|phantomforce|shadowforce|geargrind|heavyslam|heatcrash|flare|blitz|volttackle|woodhammer|bravebird|wildcharge|zingzap|plasmafists|bodypress|dragonrush|dragonhammer|bolt/, id)) {
		punch(layer, to, t, s); if (strong) { burst(layer, to, t, s, true); shake(arena, strong); } if (RX(/drainpunch|hornleech|leechlife|absorb|gigadrain|megadrain|drainingkiss|dreameater|oblivionwing|paraboliccharge|bitterblade|matchagotcha/, id)) drain(layer, from, to, t, s); return 160;
	}
	if (RX(/bite|crunch|fang|jaw|chomp|munch|hyperfang|superfang|psychicfangs|fishiousrend|jawlock|snaptrap/, id)) { bite(layer, to, t, s); return 180; }
	if (RX(/slash|cut|claw|scratch|razor|blade|sword|edge|cleave|fury|crosspoison|nightslash|psychocut|sacredsword|leafblade|solarblade|secretsword|xscissor|airslash|aerialace|wing|steelwing|drillpeck|peck|hornattack|horndrill|megahorn|smartstrike|drillrun|poisonjab|needlearm|lunge|firstimpression|uturn|slicing|kowtowcleave|populationbomb|ceaselessedge|bitterblade|aquacutter|ivycudgel|tachyoncutter|psyblade|stoneaxe|mightycleave|shadowclaw|dragonclaw|metalclaw|crushclaw|hone|cross/, id)) {
		if (RX(/wing|aerialace|airslash|aircutter|acrobatics|drillpeck|peck|bravebird|fly$|skyattack|dualwingbeat|beakblast|flyingpress|oblivionwing/, id)) { crescent(layer, from, to, t, s, 2); return 450; }
		slash(layer, to, t, s, RX(/fury|cross|xscissor|dualchop|populationbomb|multi/, id) ? 4 : 3); return 120;
	}
	if (RX(/seed|leaf|razorleaf|magicalleaf|petal|bulletseed|pinmissile|spikecannon|iciclespear|icicle|rockblast|bonerush|bonemerang|boneclub|poisonsting|twineedle|needle|missile|shuriken|waterShuriken|sting|barrage|eggbomb|fling|present|boomerang|beatup|scaleshot|tripledive|spreadsplatter|iciclecrash|iceball|snowball/, id)) { throwRocks(layer, from, to, t, s, 6, RX(/seed|ball|egg|snow|present|barrage/, id)); return 450; }
	if (RX(/dragon|outrage|flare|fire|burn|blaze|heat|ice|frost|aqua|water|liquid|wave|surf|crabhammer|razorshell|waterfall|leafstorm|wood|grass|bug|poison|sludge|shadow|phantom|night|dark|spirit|hex|psych|zen|steel|iron|metal|anchor|gyro|heavy|gear|rock|stone|ground|mud|sand|fairy|play|spark|volt|thunder|electro|bolt/, id)) {
		punch(layer, to, t, s); burst(layer, to, t, s, strong); return 160;
	}
	// 기본: 돌진 + 타격
	burst(layer, to, t, s, strong);
	return 180;
}
