---
title: React overview
description: Install @flue/react and provide an SDK client to React hooks.
---

`@flue/react` connects React interfaces to persistent agents and workflow runs. It uses `@flue/sdk` for transport and keeps live state synchronized from Flue event streams.

## Install

```sh
pnpm add @flue/react @flue/sdk react
```

React 18 or later is required.

## Provide a client

Create one SDK client and pass it to `FlueProvider`:

```tsx
import { FlueProvider } from '@flue/react';
import { createFlueClient } from '@flue/sdk';

const client = createFlueClient({ baseUrl: '/api' });

export function Root() {
  return (
    <FlueProvider client={client}>
      <App />
    </FlueProvider>
  );
}
```

`useFlueClient()` returns the provided client. `useFlueAgent()` and `useFlueWorkflow()` also accept a `client` option for providerless use. All three fail immediately when no client is available, even while a hook is dormant.

Relative `baseUrl` values resolve against the browser's origin. Use an absolute URL outside the browser.

## Browser routing, CORS, and authentication

For same-origin applications, mount `flue()` below the path used by `baseUrl`, such as `/api`. The React example follows this layout.

Flue's runtime does not add `Access-Control-Allow-*` headers. If the UI and Flue API use different origins, add CORS middleware to the **outer Hono application**, before mounting the Flue sub-app:

```ts
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/api/*', cors({ origin: 'https://app.example.com' }));
app.route('/api', flue());
```

Authentication is application-owned. Protect the public Flue routes with middleware on the outer Hono app, and configure browser credentials through the SDK client's `token` or `headers`. A header function runs for every request and stream reconnection, which supports rotating credentials.

```ts
const client = createFlueClient({
  baseUrl: '/api',
  headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
});
```

Do not put server secrets in browser code. Route middleware must authenticate and authorize the current user, including access to the requested agent instance or workflow run.

## Rendering messages

`useFlueAgent()` returns parts-based `UIMessage[]` data compatible with AI SDK v5's `UIMessage` shape. `@flue/react` defines this shape locally and has no runtime dependency on `ai`; compatibility covers the data shape, not AI SDK's wire protocol or `useChat` transport.

Messages may contain `text`, `reasoning`, `dynamic-tool`, and `file` parts. Flue rebuilds them from complete message snapshots; delta events are not the rendering authority. Tool input arrives complete, so tool parts use `input-available`, `output-available`, and `output-error`, but not `input-streaming`.

Image bytes are redacted from durable history. A replayed image therefore has a placeholder URL. An image sent from the current UI is rendered from its local data URL, and reconciliation preserves that local URL when its redacted stream echo arrives.

## Server rendering

Hooks use an empty dormant server snapshot. SSR produces no connection, messages, or run events; the browser connects after hydration when an `id` or `runId` is present.

See [`useFlueAgent`](/docs/sdk/react/use-flue-agent/) for conversations and [`useFlueWorkflow`](/docs/sdk/react/use-flue-workflow/) for run observation.
