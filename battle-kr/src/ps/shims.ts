/** 브라우저용 `fs` / `path` 대체 모듈 (esbuild 플러그인이 연결) */
const MODS = ['gen4', 'gen5', 'gen6', 'gen7', 'gen8'];

export function readdirSync(dir: string) {
	if (dir.replace(/\/$/, '').endsWith('/data/mods')) return MODS.slice();
	return [];
}
export function existsSync() { return false; }
export function readFileSync(): never { throw Object.assign(new Error('fs unavailable'), { code: 'ENOENT' }); }
export function statSync(): never { throw Object.assign(new Error('fs unavailable'), { code: 'ENOENT' }); }
export function writeFileSync() {}
export function mkdirSync() {}
export default { readdirSync, existsSync, readFileSync, statSync, writeFileSync, mkdirSync };
