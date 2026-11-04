/**
 * 배틀 이펙트 — 타입·분류별 도트 파티클 (이 앱용으로 직접 만든 연출, 외부 그래픽 없음)
 */
import { TYPE_COLOR } from './ui/core';

export interface Pt { x: number; y: number }

const LIGHT: { [t: string]: string } = {
	Fire: '#ffd040', Water: '#b0e0ff', Electric: '#fff8a0', Grass: '#b0f080', Ice: '#e8ffff', Psychic: '#ffc0e0',
	Ghost: '#c8a0ff', Dark: '#a08080', Dragon: '#b0b8ff', Fairy: '#ffe0ff', Poison: '#e0a0ff', Steel: '#f0f0ff',
	Fighting: '#ffc080', Ground: '#e8c890', Rock: '#e0d8b0', Bug: '#e0f080', Flying: '#e0f0ff', Normal: '#ffffff',
};

function px(layer: HTMLElement, x: number, y: number, size: number, color: string, round = false) {
	const el = document.createElement('div');
	el.className = 'fxp';
	el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;background:${color};${round ? 'border-radius:50%;' : ''}`;
	layer.appendChild(el);
	return el;
}
function done(el: HTMLElement, anim: Animation) { anim.onfinish = () => el.remove(); }

/** 대상 위치에 터지는 효과 */
export function burst(layer: HTMLElement, at: Pt, type: string, scale: number, strong = false) {
	const c = TYPE_COLOR[type] || '#fff';
	const l = LIGHT[type] || '#fff';
	const n = strong ? 16 : 10;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
		const dist = (18 + Math.random() * 22) * scale * (strong ? 1.4 : 1);
		const size = Math.round((3 + Math.random() * 3) * scale);
		const el = px(layer, at.x, at.y, size, i % 2 ? c : l, type === 'Water' || type === 'Poison');
		done(el, el.animate([
			{ transform: 'translate(0,0)', opacity: 1 },
			{ transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px)`, opacity: 0 },
		], { duration: 380 + Math.random() * 160, easing: 'steps(6)' }));
	}
	const ring = px(layer, at.x, at.y, 10 * scale, 'transparent', true);
	ring.style.border = `${Math.max(2, Math.round(scale * 1.5))}px solid ${l}`;
	done(ring, ring.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: `scale(${strong ? 5 : 3.4})`, opacity: 0 }], { duration: 360, easing: 'steps(5)' }));
	if (['Fighting', 'Normal', 'Dark', 'Steel', 'Bug', 'Dragon'].includes(type)) slash(layer, at, l, scale);
}

function slash(layer: HTMLElement, at: Pt, color: string, scale: number) {
	for (let i = 0; i < 3; i++) {
		const el = document.createElement('div');
		el.className = 'fxp';
		const w = 46 * scale, h = Math.max(2, Math.round(2 * scale));
		el.style.cssText = `left:${at.x - w / 2}px;top:${at.y - h / 2 + (i - 1) * 9 * scale}px;width:${w}px;height:${h}px;background:${color};transform:rotate(-35deg) scaleX(0)`;
		layer.appendChild(el);
		done(el, el.animate([
			{ transform: 'rotate(-35deg) scaleX(0)', opacity: 1 },
			{ transform: 'rotate(-35deg) scaleX(1)', opacity: 1, offset: 0.5 },
			{ transform: 'rotate(-35deg) scaleX(1)', opacity: 0 },
		], { duration: 280, delay: i * 50, easing: 'steps(4)' }));
	}
}

/** 날아가는 탄 (특수기) */
export function projectile(layer: HTMLElement, from: Pt, to: Pt, type: string, scale: number): number {
	const c = TYPE_COLOR[type] || '#fff';
	const l = LIGHT[type] || '#fff';
	const count = type === 'Electric' ? 10 : 7;
	const dur = 380;
	for (let i = 0; i < count; i++) {
		const size = Math.round((type === 'Psychic' || type === 'Ghost' ? 7 : 5) * scale);
		const el = px(layer, from.x, from.y, size, i % 2 ? c : l, ['Water', 'Psychic', 'Ghost', 'Poison', 'Fairy'].includes(type));
		const jitter = () => (type === 'Electric' ? (Math.random() - 0.5) * 24 * scale : (Math.random() - 0.5) * 6 * scale);
		done(el, el.animate([
			{ transform: 'translate(0,0)', opacity: 0.9 },
			{ transform: `translate(${(to.x - from.x) * 0.5 + jitter()}px,${(to.y - from.y) * 0.5 + jitter()}px)`, opacity: 1 },
			{ transform: `translate(${to.x - from.x}px,${to.y - from.y}px)`, opacity: 0.8 },
		], { duration: dur, delay: i * 35, easing: 'steps(8)' }));
	}
	return dur + count * 35;
}

/** 변화기: 반짝이 상승 */
export function sparkle(layer: HTMLElement, at: Pt, type: string, scale: number, down = false) {
	const c = LIGHT[type] || '#fff';
	for (let i = 0; i < 9; i++) {
		const x = at.x + (Math.random() - 0.5) * 50 * scale;
		const y = at.y + (Math.random() - 0.2) * 30 * scale;
		const el = px(layer, x, y, Math.round(3 * scale), i % 3 ? c : '#ffffff');
		done(el, el.animate([
			{ transform: 'translateY(0)', opacity: 0 },
			{ opacity: 1, offset: 0.3 },
			{ transform: `translateY(${(down ? 1 : -1) * 34 * scale}px)`, opacity: 0 },
		], { duration: 600, delay: i * 40, easing: 'steps(6)' }));
	}
}

/** 화면 흔들기·번쩍임 */
export function shake(el: HTMLElement, strong = false) {
	const d = strong ? 6 : 3;
	el.animate([
		{ transform: 'translate(0,0)' }, { transform: `translate(${d}px,${-d}px)` }, { transform: `translate(${-d}px,${d}px)` },
		{ transform: `translate(${d}px,0)` }, { transform: 'translate(0,0)' },
	], { duration: strong ? 320 : 220, easing: 'steps(4)' });
}
export function flash(layer: HTMLElement, color = '#fff', dur = 180) {
	const el = document.createElement('div');
	el.className = 'fx-flash';
	el.style.background = color;
	layer.appendChild(el);
	done(el, el.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: dur, easing: 'steps(3)' }));
}
/** 기믹 연출: 빛 기둥 */
export function pillar(layer: HTMLElement, at: Pt, color: string, scale: number) {
	const el = document.createElement('div');
	el.className = 'fxp';
	const w = 40 * scale;
	el.style.cssText = `left:${at.x - w / 2}px;top:0;width:${w}px;height:${at.y + 20 * scale}px;background:linear-gradient(180deg, transparent, ${color});`;
	layer.appendChild(el);
	done(el, el.animate([{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 0.9, transform: 'scaleX(1)', offset: 0.3 }, { opacity: 0, transform: 'scaleX(1.6)' }],
		{ duration: 800, easing: 'steps(8)' }));
	sparkle(layer, at, 'Normal', scale);
}
