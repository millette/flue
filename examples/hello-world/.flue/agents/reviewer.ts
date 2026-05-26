import { createAgent } from '@flue/runtime';

export default createAgent(() => ({
	model: 'anthropic/claude-haiku-4-5',
	instructions: 'Review the requested change and give one concise recommendation.',
}));
