import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { buildAtlasJson } from './atlas-json.ts';
import { DEFAULT_MAX_SIZE, packSprites } from './pack-group.ts';
import { decodePng, encodePng } from './png-io.ts';
import type { OutputFile, PackGroup, PackSource, Sprite } from './types.ts';

function listPngs(dir: string): string[] {
	const out: string[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, e.name);
		if (e.isDirectory()) out.push(...listPngs(full));
		else if (e.name.toLowerCase().endsWith('.png')) out.push(full);
	}
	return out.sort();
}

export function readSource(configDir: string, src: PackSource): Sprite[] {
	const root = resolve(configDir, src.dir);
	return listPngs(root).map((file) => {
		const rel = relative(root, file)
			.split('\\')
			.join('/')
			.replace(/\.png$/i, '');
		const key = `${src.prefix ?? ''}${src.rename?.[rel] ?? rel}`;
		return decodePng(readFileSync(file), key);
	});
}

/** Đọc nguồn → xếp → mã hoá. Không ghi đĩa: `--check` và ghi dùng chung đường này. */
export function buildGroup(configDir: string, group: PackGroup): OutputFile[] {
	const sprites = group.sources.flatMap((s) => readSource(configDir, s));
	const seen = new Set<string>();
	for (const s of sprites) {
		if (seen.has(s.key)) throw new Error(`${group.out}: trùng key "${s.key}"`);
		seen.add(s.key);
	}
	if (sprites.length === 0) throw new Error(`${group.out}: không có PNG nào`);
	const pages = packSprites(sprites, group.maxSize ?? DEFAULT_MAX_SIZE);
	const base = resolve(configDir, group.out);
	const name = basename(base);
	const pngNames = pages.map((_, i) => (pages.length === 1 ? `${name}.png` : `${name}-${i}.png`));
	const files: OutputFile[] = pages.map((p, i) => ({
		path: join(base, '..', pngNames[i] ?? ''),
		contents: encodePng(p.width, p.height, p.pixels),
		png: true,
	}));
	files.push({ path: `${base}.json`, contents: buildAtlasJson(pages, pngNames) });
	return files;
}
