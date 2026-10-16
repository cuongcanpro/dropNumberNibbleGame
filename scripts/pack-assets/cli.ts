// pnpm pack-assets [--check] [target...]
// Target = tên thư mục có pack.config.ts (packages/<x> hoặc games/<x>). Không truyền ⇒ tất cả.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildGroup } from './build-group.ts';
import { diffOutput } from './check-outputs.ts';
import type { PackConfig } from './types.ts';

const ROOT = resolve(import.meta.dirname, '../..');

function findTargets(): Map<string, string> {
	const found = new Map<string, string>();
	for (const parent of ['packages', 'games']) {
		const dir = join(ROOT, parent);
		if (!existsSync(dir)) continue;
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const cfg = join(dir, e.name, 'pack.config.ts');
			if (e.isDirectory() && existsSync(cfg)) found.set(e.name, cfg);
		}
	}
	return found;
}

async function main(): Promise<number> {
	const args = process.argv.slice(2);
	const check = args.includes('--check');
	const names = args.filter((a) => !a.startsWith('--'));
	const targets = findTargets();
	for (const n of names) {
		if (!targets.has(n)) {
			console.error(`Không có pack.config.ts cho "${n}". Có: ${[...targets.keys()].join(', ')}`);
			return 2;
		}
	}
	let stale = 0;
	for (const [name, cfgPath] of targets) {
		if (names.length > 0 && !names.includes(name)) continue;
		const config = (await import(pathToFileURL(cfgPath).href)).default as PackConfig;
		for (const group of config.groups) {
			for (const file of buildGroup(dirname(cfgPath), group)) {
				const rel = relative(ROOT, file.path);
				if (check) {
					const why = diffOutput(file);
					if (why) {
						stale++;
						console.error(`STALE ${rel}: ${why}`);
					}
				} else {
					mkdirSync(dirname(file.path), { recursive: true });
					writeFileSync(file.path, file.contents);
					console.log(`wrote ${rel}`);
				}
			}
		}
	}
	if (stale > 0) {
		console.error(`${stale} file atlas không khớp nguồn. Chạy: pnpm pack-assets rồi commit.`);
		return 1;
	}
	if (check) console.log('atlas khớp nguồn');
	return 0;
}

process.exit(await main());
