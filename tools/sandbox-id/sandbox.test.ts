import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packageIdOf, sandboxPackageId, usernameFromWhoami, withPackageId } from './sandbox.ts';

const nibiYml =
	'# nibi.project.v1\npackageId: "dev.nibi.pop-bubbles"\nassets:\n  root: res\ncatalog:\n  displayName: "Pop"\n';

test('sandboxPackageId puts the game in the username namespace', () => {
	assert.equal(sandboxPackageId('vulq2', 'pop-bubbles'), 'zps.vulq2.pop-bubbles');
	assert.equal(sandboxPackageId('nguyen.van-a', 'pop'), 'zps.nguyen.van-a.pop');
});

test('sandboxPackageId rejects ids the Site would refuse', () => {
	assert.throws(() => sandboxPackageId('vulq2', 'Pop_Bubbles'), /kebab-case/);
	assert.throws(() => sandboxPackageId('vulq2', 'pop.bubbles'), /kebab-case/);
	assert.throws(() => sandboxPackageId('', 'pop'), /username/);
	assert.throws(() => sandboxPackageId('Vu Le', 'pop'), /username/);
});

test('usernameFromWhoami reads the signed-in account', () => {
	assert.equal(
		usernameFromWhoami('[nibi whoami] vulq2@https://nibi.zingplay.dev (operator)\n'),
		'vulq2',
	);
	assert.throws(() => usernameFromWhoami('not logged in to https://nibi.zingplay.dev'), /username/);
});

test('withPackageId rewrites only the packageId line', () => {
	const next = withPackageId(nibiYml, 'zps.vulq2.pop-bubbles');
	assert.equal(next, nibiYml.replace('dev.nibi.pop-bubbles', 'zps.vulq2.pop-bubbles'));
	assert.equal(packageIdOf(next), 'zps.vulq2.pop-bubbles');
	assert.equal(withPackageId(next, 'zps.vulq2.pop-bubbles'), next);
	assert.equal(packageIdOf('packageId: dev.nibi.bare\n'), 'dev.nibi.bare');
	assert.throws(() => withPackageId('assets:\n  root: res\n', 'zps.a.b'), /no packageId/);
});
