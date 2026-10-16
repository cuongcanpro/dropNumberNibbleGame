/** The Nibi Site that hosts the contributor sandbox: games deployed there show under Contributors. */
export const SANDBOX_SITE = 'https://nibi.zingplay.dev';

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * The sandbox only accepts `zps.<username>.<game>` from contributors, so two people building the
 * same game never collide. The team assigns the portal's `dev.nibi.<id>` when the game is ported.
 */
export function sandboxPackageId(username: string, id: string): string {
	if (!USERNAME_RE.test(username)) throw new Error(`"${username}" is not a Nibi Site username`);
	if (!ID_RE.test(id)) throw new Error(`game id "${id}" must be kebab-case`);
	return `zps.${username}.${id}`;
}

/** `nibi whoami` prints `[nibi whoami] <username>@<site> (<role>)`. */
export function usernameFromWhoami(output: string): string {
	const username = /\[nibi whoami\] ([^@\s]+)@/.exec(output)?.[1];
	if (!username) throw new Error(`could not read the username from: ${output.trim()}`);
	return username;
}

/** Replaces the `packageId:` line of a `nibi.yml`, keeping everything else byte for byte. */
export function withPackageId(nibiYml: string, packageId: string): string {
	const pattern = /^packageId:\s*"?[^"\n]*"?\s*$/m;
	if (!pattern.test(nibiYml)) throw new Error('nibi.yml has no packageId line');
	return nibiYml.replace(pattern, `packageId: "${packageId}"`);
}

/** Reads the current `packageId` of a `nibi.yml`. */
export function packageIdOf(nibiYml: string): string | undefined {
	return /^packageId:\s*"?([^"\n]*?)"?\s*$/m.exec(nibiYml)?.[1];
}
