import { describe, expect, it } from 'vitest';
import { createSkillResourceTool } from '../src/agent.ts';
import type { SessionEnv, SkillDefinition } from '../src/types.ts';

const localSkill: SkillDefinition = {
	name: 'review',
	description: 'Review work.',
	body: 'Review.',
	resources: {
		kind: 'lazy-local',
		entries: [{ path: 'references/checklist.md' }],
		contents: { 'references/checklist.md': 'Check everything.' },
	},
	source: { kind: 'local', path: '/skills/review/SKILL.md' },
};

function createEnv(files: Record<string, string> = {}): SessionEnv {
	return {
		cwd: '/repo',
		resolvePath: (path) => path,
		exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
		readFile: async (path) => files[path] ?? '',
		readFileBuffer: async (path) => new TextEncoder().encode(files[path] ?? ''),
		writeFile: async () => {},
		stat: async () => ({ isFile: true, isDirectory: false, isSymbolicLink: false, size: 0, mtime: new Date(0) }),
		readdir: async () => [],
		exists: async (path) => path in files,
		mkdir: async () => {},
		rm: async () => {},
	};
}

describe('createSkillResourceTool', () => {
	it('reads bundled lazy-local resources', async () => {
		const tool = createSkillResourceTool(createEnv(), { review: localSkill });
		const result = await tool.execute('tool', { skill: 'review', path: 'references/checklist.md' });
		expect(result.content[0]).toMatchObject({ text: 'Check everything.' });
	});

	it('reads lazy sandbox resources through the environment', async () => {
		const sandboxSkill: SkillDefinition = {
			...localSkill,
			resources: { kind: 'lazy-sandbox', cwd: '/repo', root: '/repo/.agents/skills/review', entries: [] },
			source: { kind: 'sandbox', cwd: '/repo', relativePath: '.agents/skills/review' },
		};
		const file = '/repo/.agents/skills/review/references/checklist.md';
		const tool = createSkillResourceTool(createEnv({ [file]: 'Sandbox checklist.' }), { review: sandboxSkill });
		const result = await tool.execute('tool', { skill: 'review', path: 'references/checklist.md' });
		expect(result.content[0]).toMatchObject({ text: 'Sandbox checklist.' });
	});

	it('returns sandbox assets as base64 text', async () => {
		const sandboxSkill: SkillDefinition = {
			...localSkill,
			resources: { kind: 'lazy-sandbox', cwd: '/repo', root: '/repo/.agents/skills/review', entries: [] },
			source: { kind: 'sandbox', cwd: '/repo', relativePath: '.agents/skills/review' },
		};
		const file = '/repo/.agents/skills/review/assets/logo.txt';
		const tool = createSkillResourceTool(createEnv({ [file]: 'asset' }), { review: sandboxSkill });
		const result = await tool.execute('tool', { skill: 'review', path: 'assets/logo.txt' });
		expect(result.content[0]).toMatchObject({ text: 'YXNzZXQ=' });
	});

	it('rejects paths outside skill resource directories', async () => {
		const tool = createSkillResourceTool(createEnv(), { review: localSkill });
		await expect(tool.execute('tool', { skill: 'review', path: '../secret.md' })).rejects.toThrow(
			'must stay under',
		);
	});

	it('rejects invalid pagination bounds', async () => {
		const tool = createSkillResourceTool(createEnv(), { review: localSkill });
		await expect(
			tool.execute('tool', { skill: 'review', path: 'references/checklist.md', limit: 0 }),
		).rejects.toThrow('positive integer');
	});
});
