import { createAgent, http, type FlueContext } from '@flue/runtime';
import reviewer from '../agents/reviewer.ts';

export const channels = [http()];

const orchestrator = createAgent(() => ({ model: false }));

export async function run({ init }: FlueContext) {
	const harness = await init(orchestrator);
	const session = await harness.session();
	const result = await session.delegate('Review a proposal to add a user-visible audit log.', {
		agent: reviewer,
		id: 'reviewer-demo',
	});

	return { review: result.text, model: result.model.id };
}
