import { defineAgent, type FlueContext } from '@flue/runtime';
import * as v from 'valibot';

const greeter = defineAgent({
	model: 'anthropic/claude-sonnet-4-6',
	instructions: 'Greet users warmly and concisely.',
});

export const triggers = { webhook: true };

export default async function ({ init, payload }: FlueContext) {
	const agent = await init({ inherit: greeter });
	const harness = agent.harness();
	const session = await harness.session();

	const { data } = await session.prompt(`Greet the user named "${payload.name ?? 'Developer'}".`, {
		result: v.object({ greeting: v.string() }),
	});

	console.log('[with-inherit] greeting:', data.greeting);
	return data;
}
