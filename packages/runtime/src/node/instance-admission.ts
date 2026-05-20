import type {
	AcquireInstanceRunInput,
	InstanceRunAdmission,
	InstanceRunLease,
} from '../runtime/instance-admission.ts';

export class InMemoryInstanceRunAdmission implements InstanceRunAdmission {
	private active = new Set<string>();

	async acquire(input: AcquireInstanceRunInput): Promise<InstanceRunLease | null> {
		const key = createInstanceKey(input.agentName, input.instanceId);
		if (this.active.has(key)) return null;
		this.active.add(key);
		return {
			release: async () => {
				this.active.delete(key);
			},
		};
	}
}

function createInstanceKey(agentName: string, instanceId: string): string {
	return JSON.stringify([agentName, instanceId]);
}
