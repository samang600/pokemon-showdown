/**
 * 효과음·배경음악 — WebAudio 로 직접 합성하는 칩튠 (외부 음원 파일 없음, 모두 이 앱용으로 새로 만든 소리)
 */
import { loadSettings } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ac(): AudioContext | null {
	if (ctx) return ctx;
	const C = (window as any).AudioContext || (window as any).webkitAudioContext;
	if (!C) return null;
	ctx = new C();
	master = ctx!.createGain(); master.gain.value = 0.6; master.connect(ctx!.destination);
	sfxBus = ctx!.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
	musicBus = ctx!.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
	noiseBuf = ctx!.createBuffer(1, ctx!.sampleRate, ctx!.sampleRate);
	const d = noiseBuf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	return ctx;
}

/** 첫 터치 때 호출 (브라우저 자동재생 제한) */
export function unlockAudio() {
	const c = ac();
	if (c && c.state === 'suspended') c.resume();
}

const sfxOn = () => loadSettings().sound !== false;
const musicOn = () => loadSettings().music !== false;

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; at?: number; bus?: GainNode | null; vib?: number } = {}) {
	const c = ac(); if (!c) return;
	const t = c.currentTime + (opts.at || 0);
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = opts.type || 'square';
	o.frequency.setValueAtTime(freq, t);
	if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
	if (opts.vib) {
		const lfo = c.createOscillator(); const lg = c.createGain();
		lfo.frequency.value = opts.vib; lg.gain.value = freq * 0.05;
		lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur);
	}
	const v = opts.vol ?? 0.3;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(v, t + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g); g.connect(opts.bus === undefined ? sfxBus! : opts.bus!);
	o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { freq?: number; q?: number; vol?: number; at?: number; type?: BiquadFilterType; sweep?: number; bus?: GainNode | null } = {}) {
	const c = ac(); if (!c || !noiseBuf) return;
	const t = c.currentTime + (opts.at || 0);
	const src = c.createBufferSource(); src.buffer = noiseBuf;
	const f = c.createBiquadFilter(); f.type = opts.type || 'lowpass';
	f.frequency.setValueAtTime(opts.freq || 2000, t);
	if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
	f.Q.value = opts.q || 1;
	const g = c.createGain();
	const v = opts.vol ?? 0.3;
	g.gain.setValueAtTime(v, t);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(f); f.connect(g); g.connect(opts.bus === undefined ? sfxBus! : opts.bus!);
	src.start(t); src.stop(t + dur + 0.02);
}

const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

/** 효과음 */
export function sfx(name: string, type = 'Normal') {
	if (!sfxOn() || !ac()) return;
	switch (name) {
	case 'select': tone(N(84), 0.05, { vol: 0.15 }); tone(N(91), 0.06, { vol: 0.15, at: 0.045 }); break;
	case 'back': tone(N(79), 0.06, { vol: 0.15 }); tone(N(72), 0.07, { vol: 0.13, at: 0.05 }); break;
	case 'ball': tone(300, 0.18, { type: 'square', slide: 1400, vol: 0.12 }); noise(0.12, { freq: 4000, vol: 0.18, at: 0.17 }); tone(N(88), 0.08, { at: 0.2, vol: 0.12 }); break;
	case 'hit': noise(0.14, { freq: 1600, sweep: 300, vol: 0.45 }); tone(160, 0.12, { slide: 60, vol: 0.25 }); break;
	case 'hitSuper': noise(0.22, { freq: 3000, sweep: 200, vol: 0.55 }); tone(220, 0.2, { slide: 50, vol: 0.32 }); noise(0.1, { freq: 5000, vol: 0.25, at: 0.08 }); break;
	case 'hitWeak': noise(0.09, { freq: 700, sweep: 200, vol: 0.3 }); break;
	case 'crit': tone(N(96), 0.06, { vol: 0.18 }); tone(N(100), 0.08, { vol: 0.16, at: 0.05 }); break;
	case 'miss': noise(0.25, { type: 'bandpass', freq: 600, sweep: 3000, q: 4, vol: 0.25 }); break;
	case 'faint': tone(700, 0.7, { type: 'square', slide: 60, vol: 0.18 }); noise(0.5, { freq: 800, sweep: 100, vol: 0.12, at: 0.2 }); break;
	case 'statUp': [0, 4, 7, 12, 16].forEach((d, i) => tone(N(72 + d), 0.09, { type: 'triangle', vol: 0.22, at: i * 0.055 })); break;
	case 'statDown': [16, 12, 7, 4, 0].forEach((d, i) => tone(N(64 + d), 0.09, { type: 'triangle', vol: 0.22, at: i * 0.055 })); break;
	case 'heal': [0, 7, 12, 19, 24].forEach((d, i) => tone(N(76 + d), 0.14, { type: 'sine', vol: 0.18, at: i * 0.06 })); break;
	case 'status': tone(N(60), 0.35, { type: 'square', vol: 0.14, vib: 18 }); tone(N(55), 0.35, { type: 'square', vol: 0.1, vib: 12, at: 0.05 }); break;
	case 'mega': tone(200, 0.9, { type: 'sawtooth', slide: 1600, vol: 0.12 }); [0, 4, 7, 12].forEach((d, i) => tone(N(72 + d), 0.4, { type: 'triangle', vol: 0.15, at: 0.8 + i * 0.03 })); break;
	case 'tera': [0, 7, 12, 16, 19, 24].forEach((d, i) => tone(N(84 + d), 0.25, { type: 'sine', vol: 0.14, at: i * 0.05 })); noise(0.4, { type: 'highpass', freq: 6000, vol: 0.12 }); break;
	case 'zmove': tone(80, 1, { type: 'sawtooth', slide: 900, vol: 0.14 }); noise(0.9, { freq: 400, sweep: 5000, vol: 0.18 }); break;
	case 'dynamax': tone(60, 1.1, { type: 'square', slide: 30, vol: 0.2 }); tone(90, 1.1, { type: 'sawtooth', slide: 45, vol: 0.12 }); noise(1, { freq: 300, vol: 0.2 }); break;
	case 'weather': noise(0.8, { type: 'bandpass', freq: 1200, q: 0.7, vol: 0.15 }); break;
	case 'move': moveSound(type, 'Physical'); break;
	}
}

/** 기술 사용음 (분류·타입별) */
export function moveSound(type: string, category: string) {
	if (!sfxOn() || !ac()) return;
	if (category === 'Status') {
		[0, 5, 9].forEach((d, i) => tone(N(81 + d), 0.1, { type: 'triangle', vol: 0.14, at: i * 0.06 }));
		return;
	}
	switch (type) {
	case 'Fire': noise(0.45, { freq: 900, sweep: 300, vol: 0.35 }); tone(120, 0.4, { type: 'sawtooth', slide: 70, vol: 0.08 }); break;
	case 'Water': for (let i = 0; i < 5; i++) tone(N(70 + i * 3), 0.07, { type: 'sine', vol: 0.18, at: i * 0.05, slide: N(77 + i * 3) }); break;
	case 'Electric': for (let i = 0; i < 8; i++) tone(N(88 + (i % 3) * 5), 0.03, { vol: 0.12, at: i * 0.035 }); noise(0.3, { type: 'highpass', freq: 3000, vol: 0.12 }); break;
	case 'Grass': noise(0.35, { type: 'bandpass', freq: 2500, q: 3, vol: 0.2 }); break;
	case 'Ice': [24, 19, 28, 24].forEach((d, i) => tone(N(72 + d), 0.08, { type: 'sine', vol: 0.14, at: i * 0.05 })); break;
	case 'Psychic': tone(N(72), 0.5, { type: 'sine', vol: 0.15, vib: 9 }); tone(N(79), 0.5, { type: 'sine', vol: 0.1, vib: 7 }); break;
	case 'Ghost': case 'Dark': tone(N(48), 0.5, { type: 'triangle', vol: 0.2, vib: 5, slide: N(40) }); break;
	case 'Dragon': tone(90, 0.5, { type: 'sawtooth', slide: 300, vol: 0.12 }); noise(0.4, { freq: 600, vol: 0.2 }); break;
	case 'Rock': case 'Ground': noise(0.4, { freq: 300, vol: 0.45 }); tone(70, 0.35, { vol: 0.2, slide: 40 }); break;
	case 'Flying': noise(0.4, { type: 'bandpass', freq: 800, sweep: 2500, q: 2, vol: 0.25 }); break;
	case 'Poison': for (let i = 0; i < 4; i++) tone(N(55 + i * 2), 0.09, { type: 'sine', vol: 0.15, at: i * 0.07, slide: N(50) }); break;
	case 'Steel': tone(N(86), 0.25, { type: 'square', vol: 0.1 }); tone(N(93), 0.2, { type: 'triangle', vol: 0.1, at: 0.02 }); break;
	case 'Fairy': [0, 4, 7, 11, 14].forEach((d, i) => tone(N(86 + d), 0.08, { type: 'sine', vol: 0.12, at: i * 0.04 })); break;
	case 'Fighting': case 'Bug': case 'Normal': default:
		noise(0.1, { type: 'bandpass', freq: 1200, q: 1, vol: 0.25 }); break;
	}
}

// ── 배경음악: 간단한 시퀀서 (이 앱용으로 새로 작곡한 짧은 루프) ──
interface Track { bpm: number; lead: (number | null)[]; bass: (number | null)[]; drums: string; loop: boolean; leadType?: OscillatorType }
const R = null;
const TRACKS: { [k: string]: Track } = {
	// 가단조 i-VI-III-VII 진행, 16분음표 단위
	battle: {
		bpm: 148, loop: true,
		lead: [69, R, 72, R, 76, R, 74, 72, 74, R, 71, R, 67, R, 69, 71, 72, R, 69, R, 77, R, 76, 74, 72, R, 74, R, 76, R, R, R,
			81, R, 79, R, 77, R, 76, R, 74, R, 76, 77, 79, R, R, R, 77, R, 76, R, 74, R, 72, R, 71, R, 72, 74, 76, R, R, R],
		bass: [45, 57, 45, 57, 45, 57, 45, 57, 41, 53, 41, 53, 41, 53, 41, 53, 48, 60, 48, 60, 48, 60, 48, 60, 43, 55, 43, 55, 43, 55, 43, 55,
			45, 57, 45, 57, 45, 57, 45, 57, 41, 53, 41, 53, 41, 53, 41, 53, 48, 60, 48, 60, 43, 55, 43, 55, 40, 52, 40, 52, 40, 52, 44, 56],
		drums: 'k.h.s.h.k.hks.h.k.h.s.h.k.hks.hhk.h.s.h.k.hks.h.k.h.s.h.k.ksssss',
	},
	boss: {
		bpm: 168, loop: true, leadType: 'sawtooth',
		lead: [62, R, 65, 62, 69, R, 68, R, 65, R, 62, R, 61, R, 62, 64, 65, R, 64, 62, 70, R, 69, R, 67, R, 65, R, 64, R, 61, R,
			74, R, 73, R, 74, R, 77, R, 76, R, 74, R, 73, R, 70, R, 69, R, 70, R, 69, R, 67, R, 65, R, 64, 65, 67, 69, R, R],
		bass: [38, 38, 50, 38, 38, 50, 38, 50, 34, 34, 46, 34, 34, 46, 34, 46, 36, 36, 48, 36, 36, 48, 36, 48, 33, 33, 45, 33, 37, 37, 49, 37,
			38, 38, 50, 38, 38, 50, 38, 50, 34, 34, 46, 34, 34, 46, 34, 46, 31, 31, 43, 31, 33, 33, 45, 33, 37, 37, 49, 37, 37, 49, 37, 49],
		drums: 'k.hsk.hsk.hsk.hskkhsk.hsk.hsk.hsk.hsk.hsk.hskkhsk.hsk.hsksssss',
	},
	title: {
		bpm: 112, loop: true, leadType: 'triangle',
		lead: [72, R, R, 76, 79, R, 77, R, 76, R, 74, R, 72, R, R, R, 74, R, R, 77, 81, R, 79, R, 77, R, 76, R, 74, R, R, R,
			76, R, R, 79, 84, R, 83, R, 81, R, 79, R, 77, R, 76, R, 74, R, 76, R, 77, R, 74, R, 72, R, R, R, R, R, R, R],
		bass: [48, R, 55, R, 52, R, 55, R, 53, R, 57, R, 53, R, 57, R, 50, R, 57, R, 53, R, 57, R, 55, R, 59, R, 55, R, 59, R,
			52, R, 55, R, 59, R, 55, R, 45, R, 52, R, 57, R, 52, R, 50, R, 53, R, 57, R, 55, R, 59, R, 48, R, 52, R, 55, R],
		drums: 'k.......h.......k.......h.......k.......h.......k.......h.h.h.h.',
	},
	victory: {
		bpm: 160, loop: false, leadType: 'square',
		lead: [72, R, 72, R, 72, R, 72, R, 68, R, R, R, 70, R, R, R, 72, R, R, 70, 72, R, R, R, R, R, R, R, R, R, R, R],
		bass: [48, R, 48, R, 48, R, 48, R, 44, R, R, R, 46, R, R, R, 48, R, R, R, 48, R, R, R, R, R, R, R, R, R, R, R],
		drums: 'k.k.k.k.s...s...k..sk...........',
	},
};

let timer: any = null;
let current = '';
let step = 0;
let nextTime = 0;

export function playMusic(name: string) {
	if (current === name) return;
	stopMusic();
	if (!musicOn()) return;
	const c = ac(); if (!c) return;
	const tr = TRACKS[name]; if (!tr) return;
	current = name; step = 0; nextTime = c.currentTime + 0.05;
	const stepDur = 60 / tr.bpm / 4;
	timer = setInterval(() => {
		while (nextTime < c.currentTime + 0.25) {
			const len = tr.lead.length;
			if (!tr.loop && step >= len) { stopMusic(); return; }
			const i = step % len;
			const at = nextTime - c.currentTime;
			const l = tr.lead[i]; const b = tr.bass[i % tr.bass.length]; const d = tr.drums[i % tr.drums.length];
			if (l !== null && l !== undefined) tone(N(l), stepDur * 1.8, { type: tr.leadType || 'square', vol: 0.16, at, bus: musicBus });
			if (b !== null && b !== undefined) tone(N(b), stepDur * 0.9, { type: 'triangle', vol: 0.32, at, bus: musicBus });
			if (d === 'k') tone(150, 0.1, { type: 'sine', slide: 40, vol: 0.5, at, bus: musicBus });
			if (d === 's') noise(0.09, { type: 'highpass', freq: 1500, vol: 0.22, at, bus: musicBus });
			if (d === 'h') noise(0.03, { type: 'highpass', freq: 7000, vol: 0.12, at, bus: musicBus });
			nextTime += stepDur; step++;
		}
	}, 60);
}
export function stopMusic() {
	if (timer) clearInterval(timer);
	timer = null; current = '';
}
