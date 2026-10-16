// node <new template>/tools/update-template/cli.ts [--into <game folder>] [--dry-run]
// Run from the newly unzipped template: it updates the folder you are building your game in
// (default: the current directory) to this copy's template, leaving games/<id>/ alone.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { updateTemplate } from './update.ts';

const SOURCE = resolve(import.meta.dirname, '../..');

try {
	const { values } = parseArgs({
		options: {
			into: { type: 'string', default: '.' },
			'dry-run': { type: 'boolean', default: false },
		},
	});
	const target = resolve(values.into);
	const dryRun = values['dry-run'];
	if (target === SOURCE) {
		throw new Error(
			'run it from the new template copy, inside the folder to update: node <new copy>/tools/update-template/cli.ts --into .',
		);
	}

	const result = updateTemplate(SOURCE, target, { dryRun });
	if (result.from === result.to) {
		console.log(`Already on template ${result.to}.`);
	} else {
		console.log(`${dryRun ? 'Would update' : 'Updated'} template ${result.from} -> ${result.to}:`);
		for (const action of result.actions) console.log(`  ${action}`);
		for (const warning of result.warnings) console.log(`warning: ${warning}`);
		if (result.backup) console.log(`Old files copied to ${result.backup}/`);
		if (!dryRun) {
			console.log(
				'\nNext: pnpm i, pnpm check, then apply "Apply to your game" below to games/<id>/.',
			);
		}
		for (const entry of result.entries) console.log(`\n${entry.text}`);
	}
} catch (error) {
	console.error(`update-template: ${(error as Error).message}`);
	process.exit(1);
}
