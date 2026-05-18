import { defineAgent, type ActionContext } from '@flue/runtime';
import { Bash, InMemoryFs } from 'just-bash';
import * as v from 'valibot';

export const triggers = { webhook: true };

const sandboxSkillAgent = defineAgent({
	name: 'sandbox-skill',
	model: 'anthropic/claude-sonnet-4-6',
});

export default async function ({ init, payload }: ActionContext) {
	const fs = new InMemoryFs();
	await fs.mkdir('/home/user/.agents/skills/sandbox-greet', { recursive: true });
	await fs.writeFile(
		'/home/user/.agents/skills/sandbox-greet/SKILL.md',
		[
			'---',
			'name: sandbox-greet',
			'description: Generate a concise greeting for a supplied name.',
			'---',
			'',
			'Return a friendly greeting for the name in the arguments.',
		].join('\n'),
	);
	const harness = await init({
		agent: sandboxSkillAgent,
		sandbox: () => new Bash({ fs }),
		loadFromSandbox: true,
	});
	const session = await harness.session();
	const result = await session.skill('sandbox-greet', {
		args: { name: payload.name ?? 'World' },
		result: v.object({ greeting: v.string() }),
	});
	return result.data;
}
