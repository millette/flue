import { describe, expect, it } from 'vitest';
import { composeAgentSystemPrompt, discoverSandboxSkills, readAgentsMd } from '../src/context.ts';
import { defineAgent } from '../src/definition.ts';
import type { FileStat, SessionEnv } from '../src/types.ts';

function createEnv(options: { files?: Record<string, string>; dirs?: Record<string, string[]> }): SessionEnv {
	const files = new Map(Object.entries(options.files ?? {}));
	const dirs = new Map(Object.entries(options.dirs ?? {}));
	const stat = async (path: string): Promise<FileStat> => ({
		isFile: files.has(path),
		isDirectory: dirs.has(path),
		isSymbolicLink: false,
		size: files.get(path)?.length ?? 0,
		mtime: new Date(0),
	});
	return {
		cwd: '/repo',
		resolvePath: (path) => (path.startsWith('/') ? path : `/repo/${path}`),
		exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
		readFile: async (path) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`missing ${path}`);
			return content;
		},
		readFileBuffer: async (path) => new TextEncoder().encode(files.get(path) ?? ''),
		writeFile: async () => {},
		stat,
		readdir: async (path) => dirs.get(path) ?? [],
		exists: async (path) => files.has(path) || dirs.has(path),
		mkdir: async () => {},
		rm: async () => {},
	};
}

describe('sandbox context', () => {
	it('prefers AGENTS.md over CLAUDE.md', async () => {
		const env = createEnv({ files: { '/repo/AGENTS.md': 'agents', '/repo/CLAUDE.md': 'claude' } });
		await expect(readAgentsMd(env, '/repo')).resolves.toBe('agents');
	});

	it('discovers sandbox skills without reading resource trees', async () => {
		const env = createEnv({
			files: {
				'/repo/.agents/skills/review/SKILL.md': '---\nname: review\ndescription: Review work.\n---\nDo reviews.',
				'/repo/.agents/skills/review/references/LARGE.md': 'lazy',
			},
			dirs: {
				'/repo/.agents/skills': ['review'],
				'/repo/.agents/skills/review': ['SKILL.md', 'references'],
				'/repo/.agents/skills/review/references': ['LARGE.md'],
			},
		});
		const [skill] = await discoverSandboxSkills(env, '/repo/.agents/skills');
		expect(skill).toMatchObject({
			name: 'review',
			resources: {
				kind: 'lazy-sandbox',
				root: '/repo/.agents/skills/review',
				entries: [{ path: 'references/LARGE.md' }],
			},
			source: { kind: 'sandbox', cwd: '/repo', relativePath: '.agents/skills/review' },
		});
	});

	it('places workspace context after instructions and before skills', () => {
		const prompt = composeAgentSystemPrompt(
			defineAgent({
				name: 'reviewer',
				instructions: 'Agent instructions.',
				skills: [
					{
						name: 'review',
						description: 'Review work.',
						body: 'Do reviews.',
						source: { kind: 'local', path: '/skills/review/SKILL.md' },
					},
				],
			}),
			{ context: 'Workspace context.' },
		);
		expect(prompt.indexOf('Agent instructions.')).toBeLessThan(prompt.indexOf('Workspace context.'));
		expect(prompt.indexOf('Workspace context.')).toBeLessThan(prompt.indexOf('<skills>'));
	});
});
