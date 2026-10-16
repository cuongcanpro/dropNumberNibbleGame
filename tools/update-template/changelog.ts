export interface ChangelogEntry {
	readonly version: string;
	readonly date: string;
	readonly summary: string;
	readonly text: string;
}

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const HEADING_RE = /^## (\S+) - (\d{4}-\d{2}-\d{2})$/;
const SUMMARY_RE = /^Tóm tắt: (.+)$/m;

function parts(version: string): number[] {
	const match = VERSION_RE.exec(version);
	if (!match) throw new Error(`"${version}" is not a version like 1.2.3`);
	return match.slice(1).map(Number);
}

/** 1 when `a` is newer than `b`, -1 when older, 0 when equal. */
export function compareVersions(a: string, b: string): number {
	const [pa, pb] = [parts(a), parts(b)];
	for (let i = 0; i < pa.length; i++) {
		if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
	}
	return 0;
}

/** Entries in file order, which is newest first; each `text` runs from its `## <version> - <date>` heading to the next. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
	const lines = markdown.split('\n');
	const starts = lines.flatMap((line, i) => (HEADING_RE.test(line) ? [i] : []));
	return starts.map((start, n) => {
		const [, version, date] = HEADING_RE.exec(lines[start]) ?? [];
		const text = lines
			.slice(start, starts[n + 1] ?? lines.length)
			.join('\n')
			.trimEnd();
		return { version, date, summary: SUMMARY_RE.exec(text)?.[1] ?? '', text };
	});
}

export function entriesSince(markdown: string, version: string): ChangelogEntry[] {
	return parseChangelog(markdown).filter((entry) => compareVersions(entry.version, version) > 0);
}
