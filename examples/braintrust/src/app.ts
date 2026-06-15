import { type FlueEvent, observe } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { braintrustFlueObserver, initLogger } from 'braintrust';
import { Hono } from 'hono';

const apiKey = process.env.BRAINTRUST_API_KEY;
const observedRuns = new Set<string>();

if (apiKey) {
	initLogger({
		projectName: process.env.BRAINTRUST_PROJECT_NAME ?? 'Flue',
		apiKey,
	});

	observe((event, ctx) => braintrustFlueObserver(compatibleEvent(event), ctx), {
		types: [
			'run_start',
			'run_resume',
			'run_end',
			'operation_start',
			'operation',
			'turn_request',
			'turn',
			'tool_start',
			'tool',
			'task_start',
			'task',
			'compaction_start',
			'compaction',
		],
	});
}

function compatibleEvent(event: FlueEvent): unknown {
	if (event.type === 'run_start') observedRuns.add(event.runId);
	if (event.type === 'run_end') observedRuns.delete(event.runId);
	if (event.type === 'tool') return { ...event, type: 'tool_call' };
	if (event.type === 'run_resume') {
		if (observedRuns.has(event.runId)) return event;
		observedRuns.add(event.runId);
		return { ...event, type: 'run_start', payload: undefined };
	}
	return event;
}

const app = new Hono();
app.route('/', flue());

export default app;
