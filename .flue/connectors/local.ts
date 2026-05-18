import { exec as execCb } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { FileStat, SandboxFactory, SessionEnv, ShellResult } from '@flue/runtime';

const execAsync = promisify(execCb);

const DEFAULT_LOCAL_ENV_ALLOWLIST = [
	'PATH',
	'HOME',
	'USER',
	'LOGNAME',
	'HOSTNAME',
	'SHELL',
	'LANG',
	'LC_ALL',
	'LC_CTYPE',
	'TZ',
	'TERM',
	'TMPDIR',
	'TMP',
	'TEMP',
] as const;

export interface LocalSandboxOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
}

function abortErrorFor(signal: AbortSignal): Error {
	const reason = signal.reason;
	const message =
		reason instanceof Error && reason.message
			? reason.message
			: typeof reason === 'string' && reason
				? reason
				: 'The operation was aborted.';
	const error = new DOMException(message, 'AbortError');
	try {
		Object.defineProperty(error, 'cause', { value: reason, configurable: true });
	} catch {
		return error;
	}
	return error;
}

function resolveBaseEnv(userEnv: LocalSandboxOptions['env']): NodeJS.ProcessEnv {
	if (userEnv !== undefined && (typeof userEnv !== 'object' || Array.isArray(userEnv))) {
		throw new TypeError(
			'[flue] local() `env` must be a Record<string, string | undefined>. ' +
				'To inherit the full host env, pass `env: { ...process.env }`.',
		);
	}

	const base: NodeJS.ProcessEnv = {};
	for (const key of DEFAULT_LOCAL_ENV_ALLOWLIST) {
		const value = process.env[key];
		if (value !== undefined) base[key] = value;
	}
	if (!userEnv) return base;
	for (const [key, value] of Object.entries(userEnv)) {
		if (value === undefined) delete base[key];
		else base[key] = value;
	}
	return base;
}

function createLocalSessionEnv(options: LocalSandboxOptions = {}): SessionEnv {
	const cwd = path.resolve(options.cwd ?? process.cwd());
	const baseEnv = resolveBaseEnv(options.env);
	const resolvePath = (p: string): string => (path.isAbsolute(p) ? p : path.resolve(cwd, p));

	return {
		async exec(command, opts): Promise<ShellResult> {
			const signal = opts?.signal;
			if (signal?.aborted) throw abortErrorFor(signal);
			const timeoutSignal =
				typeof opts?.timeout === 'number'
					? AbortSignal.timeout(opts.timeout * 1000)
					: undefined;
			const mergedSignal =
				signal && timeoutSignal
					? AbortSignal.any([signal, timeoutSignal])
					: (signal ?? timeoutSignal);

			try {
				const { stdout, stderr } = await execAsync(command, {
					cwd: opts?.cwd ? resolvePath(opts.cwd) : cwd,
					env: opts?.env ? { ...baseEnv, ...opts.env } : baseEnv,
					signal: mergedSignal,
					encoding: 'utf8',
					maxBuffer: 64 * 1024 * 1024,
				});
				if (signal?.aborted) throw abortErrorFor(signal);
				return { stdout, stderr, exitCode: 0 };
			} catch (err: any) {
				if (signal?.aborted) throw abortErrorFor(signal);
				if (err && typeof err === 'object' && 'code' in err) {
					return {
						stdout: typeof err.stdout === 'string' ? err.stdout : '',
						stderr: typeof err.stderr === 'string' ? err.stderr : String(err.message ?? ''),
						exitCode: typeof err.code === 'number' ? err.code : 1,
					};
				}
				throw err;
			}
		},
		async readFile(p) {
			return fs.readFile(resolvePath(p), 'utf8');
		},
		async readFileBuffer(p) {
			const buf = await fs.readFile(resolvePath(p));
			return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
		},
		async writeFile(p, content) {
			const resolved = resolvePath(p);
			const dir = path.dirname(resolved);
			if (dir && dir !== resolved) await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(resolved, content);
		},
		async stat(p): Promise<FileStat> {
			const s = await fs.stat(resolvePath(p));
			return {
				isFile: s.isFile(),
				isDirectory: s.isDirectory(),
				isSymbolicLink: s.isSymbolicLink(),
				size: s.size,
				mtime: s.mtime,
			};
		},
		async readdir(p) {
			return fs.readdir(resolvePath(p));
		},
		async exists(p) {
			try {
				await fs.access(resolvePath(p));
				return true;
			} catch {
				return false;
			}
		},
		async mkdir(p, opts) {
			await fs.mkdir(resolvePath(p), { recursive: opts?.recursive ?? false });
		},
		async rm(p, opts) {
			await fs.rm(resolvePath(p), {
				recursive: opts?.recursive ?? false,
				force: opts?.force ?? false,
			});
		},
		cwd,
		resolvePath,
	};
}

export function local(options: LocalSandboxOptions = {}): SandboxFactory {
	return {
		createSessionEnv: async ({ cwd }) =>
			createLocalSessionEnv({
				cwd: options.cwd ?? cwd,
				env: options.env,
			}),
	};
}
