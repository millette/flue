---
title: useFlueWorkflow
description: Observe a workflow run from React.
---

`useFlueWorkflow()` replays and follows one workflow run. Trigger workflows with the SDK client, then pass the returned `runId` to the hook.

```tsx
import { useFlueClient, useFlueWorkflow } from '@flue/react';
import { useState } from 'react';

function WorkflowPanel() {
  const flue = useFlueClient();
  const [runId, setRunId] = useState<string>();
  const run = useFlueWorkflow({ runId });

  async function trigger() {
    const invocation = await flue.workflows.invoke('report', {
      payload: { period: 'weekly' },
    });
    setRunId(invocation.runId);
  }

  return (
    <section>
      <button onClick={trigger}>Run report</button>
      <p>{run.status}</p>
      {run.logs.map((event) => (
        <pre key={`${event.timestamp}:${event.eventIndex}`}>{event.message}</pre>
      ))}
    </section>
  );
}
```

The hook observes only. It does not trigger workflows; use `useFlueClient()` as shown above.

## Options

```ts
interface UseFlueWorkflowOptions {
  runId?: string;
  client?: FlueClient;
}
```

Without a `runId`, the hook is dormant with `status: 'idle'` and makes no connection. `client` overrides the client from `FlueProvider`.

## Result

```ts
interface UseFlueWorkflowResult {
  events: FlueEvent[];
  logs: Extract<FlueEvent, { type: 'log' }>[];
  status:
    | 'idle'
    | 'connecting'
    | 'running'
    | 'completed'
    | 'errored'
    | 'disconnected';
  result: unknown;
  error: unknown;
}
```

The hook replays the complete bounded run stream, then follows it live. `events` is uncapped in v1, and `logs` is the subset whose type is `log`. `result` comes from `run_end`; an absent result is normalized to `null`.

- `connecting`: initial connection or transient reconnection. During a retry, `error` contains the latest transport failure.
- `running`: a `run_start` or `run_resume` event was observed.
- `completed`: `run_end` reported success.
- `errored`: `run_end` reported a workflow failure; `error` contains that failure.
- `disconnected`: observation ended without a terminal run event and no further reconnect will be attempted, such as after a fatal `401`, `403`, or `404`, or a server-closed stream.

Transport loss never becomes `errored`. Transient failures remain `connecting` and retry indefinitely from the durable checkpoint, replaying missed events when connectivity returns. Completed and errored runs are terminal and do not reconnect.

There is no workflow stop or cancellation method in `@flue/react`.
