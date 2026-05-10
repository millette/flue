---
{
  "category": "sandbox",
  "website": "https://github.com/justbuildai/just-bash",
  "aliases": ["just-bash", "justbash"]
}
---

# Add a Flue Connector: just-bash

You are an AI coding agent installing the just-bash sandbox connector for a
Flue project. Follow these instructions exactly. Confirm with the user only
when something is genuinely ambiguous (e.g. an unusual project layout).

## What this connector does

Wraps [`just-bash`](https://github.com/justbuildai/just-bash) — an
in-process, virtual bash + filesystem written in pure TypeScript — into
Flue's `BashFactory` interface. Nothing is spawned, nothing is networked
against by default: shell commands are interpreted in-memory and the
filesystem lives in-process. This makes it the cheapest, fastest sandbox
for Flue agents, and the only one that requires no external service or
container runtime.

Things to know before installing:

- just-bash runs on both `--target node` and `--target cloudflare`. The
  same package works for either target.
- The default filesystem is `InMemoryFs` (lost on restart). just-bash
  also ships `ReadWriteFs` (host filesystem passthrough — Node only),
  `MountableFs` (compose multiple filesystems under different paths),
  and a few others. Pick the one that matches the agent's needs.
- Each call to the factory returns a *fresh* `Bash` instance. Share the
  `fs` object across calls inside the factory closure if you want files
  to persist across sessions; create a new `fs` per call if you want
  per-session isolation.
- just-bash includes an opt-in network layer
  (`network: { dangerouslyAllowFullInternetAccess: true }`) which lets
  in-sandbox commands like `curl` reach the real internet via the host's
  network stack. Enable only if the agent actually needs it — leaving
  it off is the safer default.

## Where to write the file

Pick the location based on the user's project layout:

- **`.flue/` layout** (project has files at the root and uses `.flue/agents/`
  etc.): write to `./.flue/connectors/just-bash.ts`.
- **Root layout** (the project root itself contains `agents/` and friends):
  write to `./connectors/just-bash.ts`.

If neither feels right (uncommon layout, multiple workspaces, etc.), ask the
user before writing.

Create any missing parent directories.

## File contents

Write this file verbatim. Do not "improve" it — it conforms to the published
`BashFactory` contract and is intentionally thin.

```ts
/**
 * just-bash connector for Flue.
 *
 * Wraps `just-bash` — an in-process virtual bash + filesystem — into
 * Flue's BashFactory interface. just-bash is the cheapest, fastest
 * sandbox available to Flue: no external service, no container, no
 * network calls (unless explicitly enabled). Filesystem and shell run
 * entirely in-process.
 *
 * @example In-memory filesystem (default; lost on restart)
 * ```typescript
 * import { justBash } from '../connectors/just-bash';
 *
 * const agent = await init({
 *   sandbox: justBash(),
 *   model: 'anthropic/claude-sonnet-4-6',
 * });
 * ```
 *
 * @example Persistent in-memory filesystem (shared across sessions)
 * ```typescript
 * import { InMemoryFs } from 'just-bash';
 * import { justBash } from '../connectors/just-bash';
 *
 * const fs = new InMemoryFs();
 * const agent = await init({
 *   sandbox: justBash({ fs }),
 *   model: 'anthropic/claude-sonnet-4-6',
 * });
 * ```
 *
 * @example Host filesystem passthrough (Node only)
 * ```typescript
 * import { ReadWriteFs } from 'just-bash';
 * import { justBash } from '../connectors/just-bash';
 *
 * const agent = await init({
 *   sandbox: justBash({ fs: new ReadWriteFs('/some/host/dir') }),
 *   model: 'anthropic/claude-sonnet-4-6',
 * });
 * ```
 *
 * @example Allow real network access from inside the sandbox
 * ```typescript
 * const agent = await init({
 *   sandbox: justBash({
 *     network: { dangerouslyAllowFullInternetAccess: true },
 *   }),
 *   model: 'anthropic/claude-sonnet-4-6',
 * });
 * ```
 */
import { Bash, InMemoryFs, type Filesystem } from 'just-bash';
import type { BashFactory } from '@flue/sdk/client';

export interface JustBashOptions {
	/**
	 * Filesystem implementation just-bash should use. Defaults to a fresh
	 * `InMemoryFs` per factory call (per-session isolation). Pass a shared
	 * `InMemoryFs` (or any other just-bash `Filesystem`) if you want files
	 * to persist across sessions backed by the same Workspace.
	 */
	fs?: Filesystem;

	/**
	 * Default working directory for shell commands. just-bash defaults to
	 * `/` if omitted.
	 */
	cwd?: string;

	/**
	 * Network configuration. just-bash blocks network access by default.
	 * Set `{ dangerouslyAllowFullInternetAccess: true }` to let
	 * in-sandbox commands (e.g. `curl`) reach the real internet via the
	 * host's network stack.
	 */
	network?: { dangerouslyAllowFullInternetAccess?: boolean };
}

/**
 * Create a Flue `BashFactory` backed by just-bash.
 *
 * Each call to the returned factory constructs a new `Bash` instance.
 * The `fs` and `network` options (if provided) are captured in the
 * closure so they're shared across sessions; pass a fresh `fs` per
 * factory call if you want per-session isolation instead.
 */
export function justBash(options: JustBashOptions = {}): BashFactory {
	return () =>
		new Bash({
			fs: options.fs ?? new InMemoryFs(),
			cwd: options.cwd,
			network: options.network,
		});
}
```

## Required dependencies

just-bash is a single package that works on both Flue build targets:

```bash
npm install just-bash
```

(Use the user's package manager — `pnpm add`, `yarn add`, etc. if their
lockfile indicates a different one.)

## Authentication

**just-bash has no API key.** It runs entirely in-process — there's no
remote service to authenticate against.

If `network.dangerouslyAllowFullInternetAccess` is enabled, in-sandbox
commands use the host's network stack directly, so any credentials those
commands need (e.g. `GITHUB_TOKEN` for `gh`, `OPENAI_API_KEY` for `curl`
calls) come from the agent's process environment. Use the project's
existing conventions (`AGENTS.md`, `.env`, `.dev.vars`, a secret manager,
CI vars) for storing those.

For reference: `flue dev --env <file>` and `flue run --env <file>` load
any `.env`-format file the user points them at.

## Wiring it into an agent

Here's what using this connector looks like inside a Flue agent. If the
user is already working on an agent that this connector is meant to plug
into, you can finish that work by wiring the connector into it. Otherwise,
share this snippet so they can wire it up themselves.

```ts
import type { FlueContext } from '@flue/sdk/client';
import { justBash } from '../connectors/just-bash'; // adjust path to match the user's layout

export const triggers = { webhook: true };

export default async function ({ init }: FlueContext) {
  const agent = await init({
    sandbox: justBash(),
    model: 'anthropic/claude-sonnet-4-6',
  });
  const session = await agent.session();

  return await session.shell('echo "hello just-bash" > /tmp/hello.txt && cat /tmp/hello.txt');
}
```

## Verify

1. Run the user's typechecker (`npx tsc --noEmit` is a safe default) and
   confirm the new file has no errors.
2. Confirm the import path you used for the connector matches where you
   actually wrote the file.
3. Tell the user the next steps: install `just-bash`, decide whether they
   need a persistent or per-session filesystem (and which `Filesystem`
   implementation), decide whether to enable
   `dangerouslyAllowFullInternetAccess`, and run `flue dev` (or
   `flue run <agent>`) to try it.
