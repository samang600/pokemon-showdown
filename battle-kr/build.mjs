#!/usr/bin/env node
/**
 * 포켓몬 배틀 시뮬레이터(한글) 빌드
 *
 *   node battle-kr/build.mjs          → battle-kr/dist/ (index.html 한 파일에 모두 포함)
 *   node battle-kr/build.mjs --android → 안드로이드 assets 에도 복사
 *
 * 먼저 저장소 루트에서 `npm install` · `node build` · `node battle-kr/scripts/gen-data.cjs` 필요.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'dist');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');

const shimPlugin = {
	name: 'ps-browser-shims',
	setup(build) {
		build.onResolve({ filter: /^(fs|node:fs)$/ }, () => ({ path: path.join(HERE, 'src/ps/shims.ts') }));
		build.onResolve({ filter: /^(path|node:path)$/ }, () => ({ path: path.join(HERE, 'src/ps/path.ts') }));
		build.onResolve({ filter: /^(util|node:util)$/ }, () => ({ path: path.join(HERE, 'src/ps/util.ts') }));
		build.onResolve({ filter: /^(node:crypto|crypto)$/ }, () => ({ path: 'crypto', namespace: 'empty' }));
		build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'module.exports = globalThis.crypto;', loader: 'js' }));
		// lib/index 는 서버용 모듈(fs·sql 등)까지 끌어오므로 utils 만 쓰도록
		build.onResolve({ filter: /^(\.\.\/)+lib$/ }, () => ({ path: path.join(HERE, 'src/ps/lib-slim.ts') }));
		// 시뮬레이터의 동적 require 는 런타임 레지스트리(__psRequire)로 돌린다
		build.onLoad({ filter: /[\\/]sim[\\/](dex|dex-formats|dex-text|teams|prng)\.ts$/ }, async args => {
			const src = await fs.promises.readFile(args.path, 'utf8');
			return { contents: src.replace(/\brequire(\.resolve)?\(/g, (m, r) => `__psRequire${r || ''}(`), loader: 'ts' };
		});
	},
};

if (!args.has('--test')) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const result = await esbuild.build({
	entryPoints: [path.join(HERE, args.has('--test') ? 'test/selfplay.ts' : 'src/main.tsx')],
	bundle: true,
	write: false,
	format: 'iife',
	platform: 'browser',
	target: ['es2020', 'chrome80', 'safari14'],
	minify: !dev,
	sourcemap: false,
	define: { '__dirname': '"/ps/sim"', 'process.env.NODE_ENV': '"production"' },
	jsx: 'automatic',
	jsxImportSource: 'preact',
	loader: { '.json': 'json' },
	plugins: [shimPlugin],
	logLevel: 'warning',
	legalComments: 'none',
	charset: 'utf8',
});

const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(HERE, 'src/style.css'), 'utf8')
	.replace(/__IMG_(\w+)__/g, (_m, name) => 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'src/ui-assets', name + '.png')).toString('base64'))
	.replace(/__FONT_(\w+)__/g, (_m, name) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(HERE, 'src/fonts', name + '.woff2')).toString('base64'));
const template = fs.readFileSync(path.join(HERE, 'src/index.html'), 'utf8');
const html = template
	.replace('/*__CSS__*/', () => css)
	.replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
if (args.has('--test')) { fs.writeFileSync(path.join(HERE, 'test/selfplay.html'), html); console.log('test/selfplay.html'); process.exit(0); }
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.cpSync(path.join(HERE, 'public'), OUT, { recursive: true });
console.log(`battle-kr/dist/index.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);

if (args.has('--android')) {
	const assets = path.join(HERE, 'android/app/src/main/assets/www');
	fs.rmSync(assets, { recursive: true, force: true });
	fs.mkdirSync(assets, { recursive: true });
	fs.cpSync(OUT, assets, { recursive: true });
	console.log('→ android/app/src/main/assets/www 에 복사');
}
