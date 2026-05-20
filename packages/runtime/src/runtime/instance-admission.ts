export interface InstanceRunLease {
	release(): Promise<void>;
}

export interface AcquireInstanceRunInput {
	agentName: string;
	instanceId: string;
	runId: string;
}

export interface InstanceRunAdmission {
	acquire(input: AcquireInstanceRunInput): Promise<InstanceRunLease | null>;
}
