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
export interface SavedTeam { id: string; name: string; gen: 4 | 5; sets: PSet[]; updated: number }
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
export interface Settings { speed: 1 | 2 | 3; animatedSprites: boolean; playerName: string; showLog: boolean }
export function loadSettings(): Settings {
	return { speed: 2, animatedSprites: true, playerName: '플레이어', showLog: false, ...load<Partial<Settings>>('settings', {}) };
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
