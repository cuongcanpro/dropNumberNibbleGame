import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLauncherUrl, qrPage } from './page.ts';

test('isLauncherUrl accepts only the URL nibi dev prints', () => {
	assert.equal(isLauncherUrl('https://tunnel.zingplay.dev/dev/vulq2/AZm3_x-9/'), true);
	for (const bad of [
		'http://tunnel.zingplay.dev/dev/vulq2/AZm3/',
		'https://tunnel.zingplay.dev/dev/vulq2/AZm3',
		'https://tunnel.zingplay.dev/play/vulq2/AZm3/',
		'Launcher URL: https://tunnel.zingplay.dev/dev/vulq2/AZm3/',
		'',
	]) {
		assert.equal(isLauncherUrl(bad), false, bad);
	}
});

test('qrPage embeds the QR and an escaped copy of the URL', () => {
	const page = qrPage('https://t.example/dev/a/<b>/', '<svg id="qr"></svg>');
	assert.match(page, /<svg id="qr"><\/svg>/);
	assert.match(page, /<code>https:\/\/t\.example\/dev\/a\/&lt;b&gt;\/<\/code>/);
});
