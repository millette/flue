export interface VirtualSandboxOptions {
	prefix?: string;
}

const CLOUDFLARE_SHELL_MIGRATION_DOC = 'docs/cloudflare-shell.md';

export function getVirtualSandbox(): never;
export function getVirtualSandbox(bucket: unknown, options?: VirtualSandboxOptions): never;
export function getVirtualSandbox(bucket?: unknown, _options?: VirtualSandboxOptions): never {
	if (bucket === undefined) {
		throw new Error(
			'[flue] getVirtualSandbox() has been removed. Flue\'s default in-memory sandbox is already ' +
				'what you wanted — omit the `sandbox` option from init() (or pass `false`) and you get it. ' +
				`See ${CLOUDFLARE_SHELL_MIGRATION_DOC} for the full migration story.`,
		);
	}
	throw new Error(
		'[flue] getVirtualSandbox(bucket) has been removed. Its "mount the R2 bucket as the agent ' +
			'filesystem" framing was never accurate. Install the Cloudflare Shell connector with ' +
			'`flue add cloudflare-shell`, then use its `hydrateFromBucket()` helper before `init()`. ' +
			`See ${CLOUDFLARE_SHELL_MIGRATION_DOC}.`,
	);
}

export function hydrateFromBucket(..._args: unknown[]): never {
	throw new Error(
		'[flue] hydrateFromBucket() has moved into the Cloudflare Shell connector. ' +
			'Install it with `flue add cloudflare-shell`, then import `hydrateFromBucket` from your project-local connector file.',
	);
}

export { cfSandboxToSessionEnv } from './cf-sandbox.ts';

export { runWithCloudflareContext, getCloudflareContext } from './context.ts';
export type { CloudflareContext } from './context.ts';

export { getCloudflareAIBindingApiProvider } from './workers-ai-provider.ts';

export type { CloudflareGatewayOptions } from './gateway.ts';

export { FlueRegistry } from './registry-do.ts';
export { createCloudflareRunRegistry } from './run-registry.ts';
