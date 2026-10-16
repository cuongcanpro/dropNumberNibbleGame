// Root files the template owns but the user may also edit, merged three ways against `base`, the
// template the folder last got. Without a base (a first update) the template wins on every
// difference and each one is reported, since a hand edit can't be told from an older template.

export interface Merged {
	readonly text: string;
	readonly warnings: string[];
}

/** `compare` decides sameness; `children`, when both sides have them, merge one level down. */
interface Node<T> {
	readonly key: string;
	readonly compare: string;
	readonly data: T;
	readonly children?: readonly Node<T>[];
}

type Rebuild<T> = (template: Node<T>, children: readonly Node<T>[]) => Node<T>;

const pathOf = (where: string, key: string): string =>
	where.includes(' ') ? `${where}.${key}` : `${where} ${key}`;

function mergeNodes<T>(
	where: string,
	base: readonly Node<T>[] | undefined,
	user: readonly Node<T>[],
	template: readonly Node<T>[],
	rebuild: Rebuild<T>,
	warnings: string[],
): Node<T>[] {
	const find = (nodes: readonly Node<T>[] | undefined, key: string): Node<T> | undefined =>
		nodes?.find((n) => n.key === key);
	const merged: Node<T>[] = [];
	for (const theirs of template) {
		const at = pathOf(where, theirs.key);
		const mine = find(user, theirs.key);
		const before = find(base, theirs.key);
		if (!mine) {
			if (before?.compare === theirs.compare) continue;
			if (before)
				warnings.push(`${at}: you had removed it; the template changed it, so it is back`);
			merged.push(theirs);
		} else if (theirs.children && mine.children) {
			const children = mergeNodes(
				at,
				before?.children,
				mine.children,
				theirs.children,
				rebuild,
				warnings,
			);
			merged.push(rebuild(theirs, children));
		} else if (mine.compare === theirs.compare || before?.compare === mine.compare) {
			merged.push(theirs);
		} else if (before?.compare === theirs.compare) {
			merged.push(mine);
		} else {
			warnings.push(`${at}: took the template's ${theirs.compare} over yours ${mine.compare}`);
			merged.push(theirs);
		}
	}
	for (const mine of user) {
		if (find(template, mine.key)) continue;
		const before = find(base, mine.key);
		if (before?.compare === mine.compare) continue;
		if (before)
			warnings.push(`${pathOf(where, mine.key)}: the template dropped it; kept your edited copy`);
		merged.push(mine);
	}
	return merged;
}

// package.json

type Json = Record<string, unknown>;

const isMap = (value: unknown): value is Json =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function parseJson(text: string): Json {
	let value: unknown;
	try {
		value = JSON.parse(text.replace(/^﻿/, ''));
	} catch (error) {
		throw new Error(`package.json is not valid JSON: ${(error as Error).message}`, {
			cause: error,
		});
	}
	if (!isMap(value)) throw new Error('package.json must hold a JSON object');
	return value;
}

/** Always the template's, so it stays out of the merge. */
const VERSION_KEY = 'templateVersion';

function jsonNodes(json: Json, nested: boolean): Node<unknown>[] {
	return Object.keys(json)
		.filter((key) => key !== VERSION_KEY)
		.map((key) => {
			const data = json[key];
			return {
				key,
				compare: JSON.stringify(data),
				data,
				...(nested && isMap(data) ? { children: jsonNodes(data, false) } : {}),
			};
		});
}

const rebuildJson: Rebuild<unknown> = (template, children) => {
	const data = Object.fromEntries(children.map((c) => [c.key, c.data]));
	return { ...template, data, compare: JSON.stringify(data), children };
};

/** Merges the root `package.json` one level deep (`scripts`, `devDependencies`, …). */
export function mergePackageJson(
	userText: string,
	templateText: string,
	baseText?: string,
): Merged {
	const template = parseJson(templateText);
	const warnings: string[] = [];
	const nodes = mergeNodes(
		'package.json',
		baseText === undefined ? undefined : jsonNodes(parseJson(baseText), true),
		jsonNodes(parseJson(userText), true),
		jsonNodes(template, true),
		rebuildJson,
		warnings,
	);
	const merged: Json = {};
	for (const key of Object.keys(template)) {
		if (key === VERSION_KEY) merged[key] = template[key];
		const node = nodes.find((n) => n.key === key);
		if (node) merged[key] = node.data;
	}
	for (const node of nodes) if (!Object.hasOwn(merged, node.key)) merged[node.key] = node.data;
	return { text: `${JSON.stringify(merged, null, '\t')}\n`, warnings };
}

// pnpm-workspace.yaml

interface Lines {
	readonly lines: readonly string[];
	/** Indent of a section's entries, or of the entry itself. */
	readonly indent: number;
}

const isComment = (line: string): boolean => line.trim().startsWith('#');
const depthOf = (line: string): number => line.length - line.trimStart().length;
const unquote = (text: string): string => text.trim().replace(/^(['"])(.*)\1$/, '$2');
const contentOf = (lines: readonly string[]): string[] =>
	lines.filter((l) => !isComment(l)).map((l) => l.trim());

function entryNode(lines: readonly string[], indent: number): Node<Lines> {
	const [item = '', ...rest] = contentOf(lines);
	const isListItem = item.startsWith('- ');
	const colon = item.indexOf(':');
	const value = isListItem ? item : item.slice(colon + 1).trim();
	return {
		key: isListItem ? item : unquote(item.slice(0, colon)),
		compare: `"${[value, ...rest].join(' ')}"`,
		data: { lines, indent },
	};
}

function groupEntries(children: readonly string[], indent: number): string[][] {
	const groups: string[][] = [];
	let comments: string[] = [];
	for (const line of children) {
		if (isComment(line)) {
			comments.push(line);
		} else if (depthOf(line) === indent || groups.length === 0) {
			groups.push([...comments, line]);
			comments = [];
		} else {
			groups.at(-1)?.push(...comments, line);
			comments = [];
		}
	}
	if (comments.length) groups.at(-1)?.push(...comments);
	return groups;
}

/**
 * Splits `pnpm-workspace.yaml` into top-level sections and their direct entries. Enough for its
 * flat lists and maps; a deeper value stays inside its entry's lines.
 */
function yamlNodes(text: string): { nodes: Node<Lines>[]; trailer: string[] } {
	const sections: { head: string[]; children: string[] }[] = [];
	let pending: string[] = [];
	for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
		if (line.trim() === '') continue;
		if (isComment(line) && depthOf(line) === 0) {
			pending.push(line);
		} else if (depthOf(line) === 0) {
			sections.push({ head: [...pending, line], children: [] });
			pending = [];
		} else {
			sections.at(-1)?.children.push(line);
		}
	}
	const nodes = sections.map(({ head, children }): Node<Lines> => {
		const line = head.at(-1) ?? '';
		const indent = depthOf(children.find((l) => !isComment(l)) ?? '');
		const groups = groupEntries(children, indent);
		return {
			key: unquote(line.slice(0, line.indexOf(':'))),
			compare: `"${[...contentOf(head), ...contentOf(children)].join(' ')}"`,
			data: { lines: head, indent },
			...(groups.length ? { children: groups.map((g) => entryNode(g, indent)) } : {}),
		};
	});
	return { nodes, trailer: pending };
}

const reindent = (entry: Node<Lines>, indent: number): Node<Lines> => {
	const shift = indent - entry.data.indent;
	if (shift === 0) return entry;
	const lines = entry.data.lines.map((l) =>
		shift > 0 ? ' '.repeat(shift) + l : l.slice(Math.min(-shift, depthOf(l))),
	);
	return { ...entry, data: { lines, indent } };
};

const rebuildYaml: Rebuild<Lines> = (template, children) => ({
	...template,
	children: children.map((c) => reindent(c, template.data.indent)),
});

const yamlText = (node: Node<Lines>): string =>
	[...node.data.lines, ...(node.children ?? []).flatMap((c) => c.data.lines)].join('\n');

/** Merges `pnpm-workspace.yaml` section by section, entry by entry. */
export function mergeWorkspaceYaml(
	userText: string,
	templateText: string,
	baseText?: string,
): Merged {
	const user = yamlNodes(userText);
	const warnings: string[] = [];
	const nodes = mergeNodes(
		'pnpm-workspace.yaml',
		baseText === undefined ? undefined : yamlNodes(baseText).nodes,
		user.nodes,
		yamlNodes(templateText).nodes,
		rebuildYaml,
		warnings,
	);
	const blocks = [
		...nodes.map(yamlText),
		...(user.trailer.length ? [user.trailer.join('\n')] : []),
	];
	return { text: `${blocks.join('\n\n')}\n`, warnings };
}
