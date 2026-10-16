// pnpm qr-page <Launcher URL>: `nibi dev` draws its QR only in an interactive terminal, so from an
// agent's shell it prints the `Launcher URL:` line instead. This opens that URL as a QR in the browser.
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isLauncherUrl, qrPage } from './page.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const url = process.argv[2] ?? '';
if (!isLauncherUrl(url)) {
	console.error(
		'Usage: pnpm qr-page <Launcher URL>   the https://…/dev/<user>/<session>/ line pnpm dev:qr prints',
	);
	process.exit(1);
}

// `uqr` is the QR encoder the nibi CLI itself uses, so it resolves from the nibi package.
const nibi = createRequire(join(ROOT, 'package.json')).resolve('nibi/package.json');
const { renderSVG } = createRequire(nibi)('uqr') as { renderSVG: (text: string) => string };

const file = join(tmpdir(), 'nibi-launcher-qr.html');
writeFileSync(file, qrPage(url, renderSVG(url)));
const [command, args] =
	process.platform === 'darwin'
		? ['open', [file]]
		: process.platform === 'win32'
			? ['cmd', ['/c', 'start', '', file]]
			: ['xdg-open', [file]];
execFile(command, args, (error) => {
	if (error) console.log(`Open this file in a browser: ${file}`);
});
console.log(`QR page: ${file}`);
