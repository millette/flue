import { parseSkillMarkdown } from './skill-frontmatter.ts';
import type { AgentDefinition, SessionEnv, SkillDefinition } from './types.ts';

const RESOURCE_DIRS = ['scripts', 'references', 'assets'] as const;

export const HEADLESS_PREAMBLE =
	'You are running in headless mode with no human operator. Work autonomously — never ask questions, never wait for user input. Make your best judgment and proceed independently.';

export async function readAgentsMd(env: SessionEnv, basePath: string): Promise<string> {
	const agentsPath = joinPath(basePath, 'AGENTS.md');
	if (await env.exists(agentsPath)) return (await env.readFile(agentsPath)).trim();
	const claudePath = joinPath(basePath, 'CLAUDE.md');
	if (await env.exists(claudePath)) return (await env.readFile(claudePath)).trim();
	return '';
}

export async function readSandboxContextFile(env: SessionEnv, path: string): Promise<string> {
	return (await env.exists(path)) ? (await env.readFile(path)).trim() : '';
}

export function skillsDirIn(basePath: string): string {
	return joinPath(basePath, '.agents/skills');
}

export async function discoverSandboxSkills(env: SessionEnv, skillsPath: string): Promise<SkillDefinition[]> {
	if (!(await env.exists(skillsPath))) return [];
	const skills: SkillDefinition[] = [];
	for (const entry of await env.readdir(skillsPath)) {
		const skillDir = joinPath(skillsPath, entry);
		try {
			if (!(await env.stat(skillDir)).isDirectory) continue;
		} catch {
			continue;
		}
		const skillMdPath = joinPath(skillDir, 'SKILL.md');
		if (!(await env.exists(skillMdPath))) continue;
		const parsed = parseSkillMarkdown(await env.readFile(skillMdPath), {
			directoryName: entry,
			path: skillMdPath,
		});
		const resourceEntries = await discoverSandboxResourceEntries(env, skillDir);
		const resources = resourceEntries.length > 0
			? { kind: 'lazy-sandbox' as const, cwd: env.cwd, root: skillDir, entries: resourceEntries }
			: undefined;
		skills.push({
			...parsed,
			resources,
			source: { kind: 'sandbox', cwd: env.cwd, relativePath: relativePath(env.cwd, skillDir) },
		});
	}
	return skills;
}

export function composeAgentSystemPrompt(
	agent: AgentDefinition,
	options?: { context?: string; skills?: readonly SkillDefinition[] },
): string {
	const parts: string[] = [HEADLESS_PREAMBLE];
	if (agent.instructions) parts.push('', agent.instructions);
	if (options?.context) parts.push('', options.context);
	appendSkillPrompt(parts, options?.skills ?? agent.skills ?? []);
	const subagents = agent.subagents ?? [];
	if (subagents.length > 0) {
		parts.push('', '<task_agents>');
		for (const subagent of subagents) {
			const description = subagent.description ? ` description=${JSON.stringify(subagent.description)}` : '';
			parts.push(`<agent name=${JSON.stringify(subagent.name)}${description} />`);
		}
		parts.push('</task_agents>');
	}
	return parts.join('\n');
}

export function joinWorkspaceContext(discovered: string, inline: string | undefined): string | undefined {
	const parts = [discovered.trim(), inline?.trim() ?? ''].filter(Boolean);
	return parts.length > 0 ? parts.join('\n\n') : undefined;
}

async function discoverSandboxResourceEntries(
	env: SessionEnv,
	skillDir: string,
): Promise<{ path: string }[]> {
	const entries: { path: string }[] = [];
	for (const directory of RESOURCE_DIRS) {
		const resourceDir = joinPath(skillDir, directory);
		if (!(await env.exists(resourceDir))) continue;
		await collectSandboxResourceEntries(env, skillDir, resourceDir, entries);
	}
	return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function collectSandboxResourceEntries(
	env: SessionEnv,
	skillDir: string,
	directory: string,
	entries: { path: string }[],
): Promise<void> {
	for (const name of await env.readdir(directory)) {
		const path = joinPath(directory, name);
		let stat;
		try {
			stat = await env.stat(path);
		} catch {
			continue;
		}
		if (stat.isDirectory) {
			await collectSandboxResourceEntries(env, skillDir, path, entries);
			continue;
		}
		if (stat.isFile) entries.push({ path: relativePath(skillDir, path) });
	}
}

function appendSkillPrompt(parts: string[], skills: readonly SkillDefinition[]): void {
	if (skills.length === 0) return;
	parts.push('', '<skills>', 'Load a skill only when its metadata matches the current task.');
	for (const skill of skills) {
		parts.push(`<skill name=${JSON.stringify(skill.name)} description=${JSON.stringify(skill.description)} />`);
	}
	parts.push('</skills>');
}

function relativePath(cwd: string, target: string): string {
	const normalizedCwd = cwd.endsWith('/') ? cwd.slice(0, -1) : cwd;
	if (target === normalizedCwd) return '.';
	if (target.startsWith(`${normalizedCwd}/`)) return target.slice(normalizedCwd.length + 1);
	return target;
}

function joinPath(base: string, leaf: string): string {
	if (leaf.startsWith('/')) return leaf;
	if (base.endsWith('/')) return base + leaf;
	return `${base}/${leaf}`;
}
