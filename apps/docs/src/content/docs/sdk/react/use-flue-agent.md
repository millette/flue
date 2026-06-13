---
title: useFlueAgent
description: Render and send messages for a persistent agent instance.
---

`useFlueAgent()` connects to one persistent agent instance and folds its durable events into renderable messages.

```tsx
import { useFlueAgent } from '@flue/react';

function Chat({ instanceId }: { instanceId?: string }) {
  const agent = useFlueAgent({
    name: 'support',
    id: instanceId,
  });

  return (
    <form action={async (data) => agent.sendMessage(String(data.get('message')))}>
      {agent.messages.map((message) => (
        <article key={message.id}>{message.parts.length} parts</article>
      ))}
      <input name="message" />
      <button type="submit">Send</button>
    </form>
  );
}
```

## Options

```ts
interface UseFlueAgentOptions {
  name: string;
  id?: string;
  history?: number | 'all';
  client?: FlueClient;
}
```

| Option | Description |
| --- | --- |
| `name` | Agent module name. |
| `id` | Persistent instance id. Without it, the hook is dormant. |
| `history` | Initial history. Defaults to the latest 100 events; use `'all'` for full history. |
| `client` | SDK client override. Otherwise the hook uses `FlueProvider`. |

A dormant hook has `status: 'idle'` and no messages or network connection. Calling `sendMessage()` without an `id` rejects.

## Result

```ts
interface UseFlueAgentResult {
  messages: UIMessage[];
  status: 'idle' | 'connecting' | 'submitted' | 'streaming' | 'error';
  error?: Error;
  sendMessage(message: string, options?: { images?: AgentPromptImage[] }): Promise<void>;
}
```

`sendMessage()` renders an optimistic user message and resolves when the server admits the prompt, not when generation finishes. If admission fails, the optimistic message is removed, `error` is set, and the promise rejects.

Statuses have distinct UI meanings:

- `idle`: no prompt is active, or a new instance has no stream yet.
- `connecting`: the initial connection or a reconnect is in progress. During reconnects, `error` contains the latest transport failure.
- `submitted`: a prompt is in flight or admitted, before attributable assistant activity. This is the pre-first-token state.
- `streaming`: assistant activity for this client's submission is arriving.
- `error`: sending or the stream failed terminally.

Transient stream failures retry indefinitely from the durable checkpoint with capped exponential backoff. Missed events replay after reconnection. A new send wakes a pending reconnect immediately.

## Fresh instances

Agent streams are created by the first admitted prompt. For a fresh `id`, the initial stream request returns `404`; the hook treats this as an expected empty `idle` state and attaches from the admission offset after its first successful `sendMessage()`.

If another client creates that instance after this hook received the `404`, this hook does not discover it until remount or until it sends its own first message.

## Message parts and tools

Render `message.parts` by `type`. Message snapshots establish the authoritative text, reasoning, image, and tool-call state, which keeps replay idempotent and allows a limited history window to begin partway through a message. Tool-result messages are not rendered separately; `dynamic-tool` parts receive results from tool events.

Image history contains redacted placeholder URLs. Locally submitted images retain their data URLs during stream reconciliation. See the [React overview](/docs/sdk/react/overview/#rendering-messages) for compatibility details.

There is no `stop()` or cancellation method. Aborting only the browser connection would not stop server work, so v1 exposes neither behavior.
