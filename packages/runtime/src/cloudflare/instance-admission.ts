import type {
	AcquireInstanceRunInput,
	InstanceRunAdmission,
	InstanceRunLease,
} from '../runtime/instance-admission.ts';

interface SqlResult {
	toArray(): SqlRow[];
}

type SqlRow = Record<string, unknown>;

interface SqlStorage {
	exec(query: string, ...bindings: unknown[]): SqlResult;
}

export function createDurableInstanceRunAdmission(sql: SqlStorage): InstanceRunAdmission {
	ensureInstanceRunAdmissionTable(sql);
	return new DurableInstanceRunAdmission(sql);
}

export function releaseDurableInstanceRunAdmission(
	sql: SqlStorage,
	input: { agentName: string; instanceId: string; runId: string },
): void {
	ensureInstanceRunAdmissionTable(sql);
	sql.exec(
		'DELETE FROM flue_active_instance_runs WHERE agent_name = ? AND instance_id = ? AND run_id = ?',
		input.agentName,
		input.instanceId,
		input.runId,
	);
}

class DurableInstanceRunAdmission implements InstanceRunAdmission {
	constructor(private sql: SqlStorage) {}

	async acquire(input: AcquireInstanceRunInput): Promise<InstanceRunLease | null> {
		const inserted = this.sql
			.exec(
				`INSERT OR IGNORE INTO flue_active_instance_runs
				 (agent_name, instance_id, run_id, started_at)
				 VALUES (?, ?, ?, ?) RETURNING run_id`,
				input.agentName,
				input.instanceId,
				input.runId,
				Date.now(),
			)
			.toArray();
		if (inserted.length === 0) return null;
		return {
			release: async () => {
				this.sql.exec(
					'DELETE FROM flue_active_instance_runs WHERE agent_name = ? AND instance_id = ? AND run_id = ?',
					input.agentName,
					input.instanceId,
					input.runId,
				);
			},
		};
	}
}

function ensureInstanceRunAdmissionTable(sql: SqlStorage): void {
	sql.exec(
		`CREATE TABLE IF NOT EXISTS flue_active_instance_runs (
		 agent_name TEXT NOT NULL,
		 instance_id TEXT NOT NULL,
		 run_id TEXT NOT NULL,
		 started_at INTEGER NOT NULL,
		 PRIMARY KEY (agent_name, instance_id)
		)`,
	);
}
