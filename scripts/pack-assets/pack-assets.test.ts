import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAtlasJson } from './atlas-json.ts';
import { diffOutput } from './check-outputs.ts';
import { EXTRUDE, PADDING, packSprites } from './pack-group.ts';
import { encodePng } from './png-io.ts';
import type { PackedPage, Sprite } from './types.ts';

function solid(key: string, width: number, height: number, rgba: [number, number, number, number]) {
	const data = Buffer.alloc(width * height * 4);
	for (let i = 0; i < width * height; i++) Buffer.from(rgba).copy(data, i * 4);
	return { key, width, height, data } satisfies Sprite;
}

const sprites = [
	solid('b/wide', 120, 40, [255, 0, 0, 255]),
	solid('a/tall', 30, 90, [0, 255, 0, 255]),
	solid('c/small', 16, 16, [0, 0, 255, 128]),
	solid('a/same1', 50, 50, [9, 9, 9, 255]),
	solid('a/same2', 50, 50, [8, 8, 8, 255]),
];

const bytes = (pages: PackedPage[]) =>
	pages.map((p) => encodePng(p.width, p.height, p.pixels).toString('base64'));

test('tất định: thứ tự nhập khác nhau vẫn ra đúng cùng bố cục + byte PNG', () => {
	const a = packSprites(sprites);
	const b = packSprites([...sprites].reverse());
	assert.deepEqual(
		a.map((p) => p.frames),
		b.map((p) => p.frames),
	);
	assert.deepEqual(bytes(a), bytes(b));
	assert.deepEqual(bytes(a), bytes(packSprites(sprites)));
});

test('frame không chồng nhau, cách ≥ padding, nằm trong trang, không xoay/trim', () => {
	const [page] = packSprites(sprites);
	assert.ok(page);
	assert.equal(page.frames.length, sprites.length);
	for (const f of page.frames) {
		assert.ok(f.x >= 1 && f.y >= 1 && f.x + f.w + 1 <= page.width && f.y + f.h + 1 <= page.height);
	}
	for (const f of page.frames) {
		for (const g of page.frames) {
			if (f === g) continue;
			const gapX = Math.max(g.x - (f.x + f.w), f.x - (g.x + g.w));
			const gapY = Math.max(g.y - (f.y + f.h), f.y - (g.y + g.h));
			// Giữa hai sprite: extrude 1 mỗi bên + padding 2.
			assert.ok(Math.max(gapX, gapY) >= 2 * EXTRUDE + PADDING, `${f.key} vs ${g.key}`);
		}
	}
});

test('extrude 1px: viền ngoài frame lặp điểm ảnh biên', () => {
	const [page] = packSprites([solid('x', 10, 10, [200, 100, 50, 255])]);
	assert.ok(page);
	const f = page.frames[0];
	assert.ok(f);
	const at = (x: number, y: number) => [
		...page.pixels.subarray((y * page.width + x) * 4, (y * page.width + x) * 4 + 4),
	];
	assert.deepEqual(at(f.x - 1, f.y - 1), [200, 100, 50, 255]);
	assert.deepEqual(at(f.x + f.w, f.y + f.h), [200, 100, 50, 255]);
});

test('JSON một trang: Phaser JSON Hash, key = tên frame', () => {
	const pages = packSprites(sprites);
	const json = JSON.parse(buildAtlasJson(pages, ['gk.png']));
	assert.deepEqual(Object.keys(json.frames).sort(), sprites.map((s) => s.key).sort());
	const f = json.frames['b/wide'];
	assert.equal(f.rotated, false);
	assert.equal(f.trimmed, false);
	assert.deepEqual(f.sourceSize, { w: 120, h: 40 });
	assert.deepEqual(f.spriteSourceSize, { x: 0, y: 0, w: 120, h: 40 });
	assert.equal(json.meta.image, 'gk.png');
	assert.deepEqual(json.meta.size, { w: pages[0]?.width, h: pages[0]?.height });
});

test('tràn trang ⇒ multiatlas, mỗi trang ≤ maxSize', () => {
	const many = Array.from({ length: 6 }, (_, i) => solid(`s${i}`, 60, 60, [i, i, i, 255]));
	const pages = packSprites(many, 128);
	assert.ok(pages.length > 1);
	for (const p of pages) assert.ok(p.width <= 128 && p.height <= 128);
	const json = JSON.parse(
		buildAtlasJson(
			pages,
			pages.map((_, i) => `m-${i}.png`),
		),
	);
	assert.equal(json.textures.length, pages.length);
	assert.equal(json.textures.flatMap((t: { frames: unknown[] }) => t.frames).length, many.length);
});

test('sprite quá lớn so với trang ⇒ ném lỗi', () => {
	assert.throws(() => packSprites([solid('big', 200, 10, [0, 0, 0, 255])], 128), /lớn hơn trang/);
});

test('diffOutput: PNG so điểm ảnh, JSON so chuỗi', async () => {
	const { mkdtempSync, writeFileSync } = await import('node:fs');
	const { join } = await import('node:path');
	const { tmpdir } = await import('node:os');
	const dir = mkdtempSync(join(tmpdir(), 'pack-'));
	const [page] = packSprites(sprites);
	assert.ok(page);
	const png = encodePng(page.width, page.height, page.pixels);
	const path = join(dir, 'a.png');
	assert.equal(diffOutput({ path, contents: png, png: true }), 'thiếu file');
	writeFileSync(path, png);
	assert.equal(diffOutput({ path, contents: png, png: true }), null);
	const changed = Buffer.from(page.pixels);
	changed[0] = (changed[0] ?? 0) ^ 0xff;
	assert.equal(
		diffOutput({ path, contents: encodePng(page.width, page.height, changed), png: true }),
		'điểm ảnh khác',
	);
	const jp = join(dir, 'a.json');
	writeFileSync(jp, '{}\n');
	assert.equal(diffOutput({ path: jp, contents: '{}\n' }), null);
	assert.equal(diffOutput({ path: jp, contents: '{"a":1}\n' }), 'nội dung khác');
});
