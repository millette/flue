import { describe, expect, it } from 'vitest';
import { Harness } from '../src/harness.ts';
import { InMemorySessionStore } from '../src/session.ts';
import { defineAgent } from '../src/definition.ts';
import type { AgentConfig, SessionEnv, SkillDefinition } from '../src/types.ts';

const sandboxSkill: SkillDefinition = {
	name: 'sandbox-review',
	description: 'Review sandbox files.',
	body: 'Review files.',
	source: { kind: 'sandbox', cwd: '/repo', relativePath: '.agents/skills/sandbox-review' },
};

const env: SessionEnv = {
	cwd: '/repo',
	resolvePath: (path) => (path.startsWith('/') ? path : `/repo/${path}`),
	exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
	readFile: async () => '',
	readFileBuffer: async () => new Uint8Array(),
	writeFile: async () => {},
	stat: async () => ({ isFile: false, isDirectory: false, isSymbolicLink: false, size: 0, mtime: new Date(0) }),
	readdir: async () => [],
	exists: async () => false,
	mkdir: async () => {},
	rm: async () => {},
};

describe('task session sandbox context', () => {
	it('inherits workspace context and sandbox skills for task agents', async () => {
		const config: AgentConfig = {
			systemPrompt: '',
			workspaceContext: 'Repository context.',
			skills: { 'sandbox-review': sandboxSkill },
			sandboxSkills: { 'sandbox-review': sandboxSkill },
			sandboxSkillDiscoveryHint: false,
			subagents: {},
			model: undefined,
			resolveModel: () => undefined,
		};
		const harness = new Harness('agent', 'default', config, env, new InMemorySessionStore());
		const taskSession = await (harness as unknown as {
			createTaskSession(options: {
				parentSession: string;
				taskId: string;
				parentEnv: SessionEnv;
				agent: ReturnType<typeof defineAgent>;
				depth: number;
			}): Promise<{ config: AgentConfig }>;
		}).createTaskSession({
			parentSession: 'default',
			taskId: 'task',
			parentEnv: env,
			agent: defineAgent({ name: 'child', instructions: 'Child instructions.' }),
			depth: 1,
		});
		const taskConfig = taskSession.config;
		expect(taskConfig.systemPrompt).toContain('Child instructions.');
		expect(taskConfig.systemPrompt).toContain('Repository context.');
		expect(taskConfig.skills['sandbox-review']).toBe(sandboxSkill);
	});
});
