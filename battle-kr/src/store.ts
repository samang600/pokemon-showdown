/** 저장 (localStorage, 실패하면 메모리에만) */
import type { PSet } from './sets';

const mem: { [k: string]: string } = {};
const PREFIX = 'pkbkr:';

function get(key: string): string | null {
	try {
		const v = localStorage.getItem(PREFIX + key);
		if (v !== null) return v;
	} catch {}
	return mem[key] ?? null;
}
function set(key: string, value: string) {
	mem[key] = value;
	try { localStorage.setItem(PREFIX + key, value); } catch {}
}
function del(key: string) {
	delete mem[key];
	try { localStorage.removeItem(PREFIX + key); } catch {}
}

export function load<T>(key: string, fallback: T): T {
	const raw = get(key);
	if (!raw) return fallback;
	try { return JSON.parse(raw) as T; } catch { return fallback; }
}
export function save(key: string, value: any) { set(key, JSON.stringify(value)); }
export function remove(key: string) { del(key); }

// ── 팀 ──
export interface SavedTeam { id: string; name: string; gen: 4 | 5; sets: PSet[]; updated: number; /** 치트 팀: 치트 배틀에서만 사용 */ cheat?: boolean }
export function loadTeams(): SavedTeam[] { return load<SavedTeam[]>('teams', []); }
export function saveTeams(teams: SavedTeam[]) { save('teams', teams); }
export function upsertTeam(team: SavedTeam) {
	const teams = loadTeams();
	const i = teams.findIndex(t => t.id === team.id);
	team.updated = Date.now();
	if (i >= 0) teams[i] = team; else teams.unshift(team);
	saveTeams(teams);
}
export function deleteTeam(id: string) { saveTeams(loadTeams().filter(t => t.id !== id)); }
export function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── 설정 ──
export interface Settings { speed: 1 | 2 | 3 | 4; animatedSprites: boolean; playerName: string; showLog: boolean; sound: boolean; music: boolean; playerSprite: string; effects: boolean; damagePreview: boolean; musicVolume: 1 | 2 | 3; sfxVolume: 1 | 2 | 3; frame: 'stone' | 'silver' | 'dark'; homeBg: string; battleBgm: string; fastForward: boolean; vibrate: boolean; ver: number; moveSfx: 0 | 1 | 2 | 3; /** 배틀 규칙 id (rules.ts) */ battleRule: string }
export function loadSettings(): Settings {
	const saved = load<Partial<Settings>>('settings', {});
	// 설정 v2: 효과음·울음소리 기본값을 '작게'로 (이전 버전에서 저장된 값도 한 번 낮춤)
	if ((saved.ver || 0) < 2) { saved.sfxVolume = 1; saved.ver = 2; save('settings', saved); }
	if ((saved.ver || 0) < 3) { saved.moveSfx = 1; saved.ver = 3; save('settings', saved); }
	if ((saved.ver || 0) < 4) {
		// 설정 v4: 기믹 규칙 → 배틀 규칙
		const old = (saved as any).gimmickRule as string | undefined;
		saved.battleRule = { one: 'natdex', free: 'natdexfree', mega: 'gen6', zmove: 'gen7', dynamax: 'gen8', tera: 'gen9', none: 'none' }[old || 'one'] || 'natdex';
		delete (saved as any).gimmickRule; saved.ver = 4; save('settings', saved);
	}
	return { speed: 2, animatedSprites: true, playerName: '플레이어', showLog: false, sound: true, music: true, playerSprite: 'lucas', effects: true,
		damagePreview: false, musicVolume: 2, sfxVolume: 1, frame: 'stone', homeBg: 'title', battleBgm: 'random', fastForward: false, vibrate: true, ver: 4, moveSfx: 1, battleRule: 'natdex', ...saved };
}
export function saveSettings(s: Settings) { save('settings', s); }

// ── 기록 ──
export interface Records {
	best: { [mode: string]: number }; // 최고 연승
	current: { [mode: string]: number };
	cups: { [cup: string]: number }; // 우승 횟수
	named: { [id: string]: number }; // 승리 횟수
	bp: number;
	battles: number;
	wins: number;
}
export function loadRecords(): Records {
	return { best: {}, current: {}, cups: {}, named: {}, bp: 0, battles: 0, wins: 0, ...load<Partial<Records>>('records', {}) };
}
export function saveRecords(r: Records) { save('records', r); }
export function updateRecords(fn: (r: Records) => void) {
	const r = loadRecords();
	fn(r);
	saveRecords(r);
	return r;
}
