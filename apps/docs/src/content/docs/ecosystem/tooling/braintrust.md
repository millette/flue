---
title: Braintrust
description: Trace Flue workflows, model turns, tools, tasks, and compactions in Braintrust.
subtitle: Debug agent behavior with structured traces, token usage, costs, and Flue correlation across Node.js and Cloudflare.
package:
  name: braintrust
  href: https://www.npmjs.com/package/braintrust
---

## Add Braintrust

Add Braintrust tracing to an existing Flue project with:

```sh
flue add tooling braintrust
```

The blueprint installs Braintrust 3.17 and registers its public Flue observer through `observe(...)`. The same source builds on Node.js and Cloudflare through Braintrust's `workerd` export; no separate Cloudflare package or Durable Object wrapper is needed.

Braintrust also provides a Node import hook for Node-only auto-instrumentation. The generated manual observer is the portable path for projects that may target either runtime.

See [Observability](/docs/guide/observability/#choose-an-observability-provider) to compare Braintrust with OpenTelemetry and Sentry.

## Configure the project

Provide the API key through your deployment platform's secret store and choose the Braintrust project that receives traces:

```sh
BRAINTRUST_API_KEY=<braintrust-api-key>
BRAINTRUST_PROJECT_NAME=Flue
```

The project name defaults to `Flue`. Never commit the API key; on Cloudflare, store it as a Worker secret rather than a Wrangler `vars` value. When the key is absent, the integration does not initialize or subscribe and the application continues without trace export.

## What Braintrust traces

| Flue activity | Braintrust trace |
| --- | --- |
| Workflow invocation | Root `workflow:<name>` task span |
| Prompt, skill, or compaction operation | Nested `flue.<kind>` task span |
| Model turn | `llm:<model>` span with input, output, errors, and usage metrics |
| Tool call | Nested `tool:<name>` span |
| Delegated task | Nested task span |
| Context compaction | Nested compaction span |

Model spans include token usage and estimated cost where available. Workflow traces carry `runId`; persistent-agent traces retain agent instance, session, operation, and optional `dispatchId` correlation. See [Observability](/docs/guide/observability/) for Flue's identity and observer model.

Braintrust 3.17 expects the previous `tool_call` name for terminal tool events and does not consume `run_resume`. The generated bridge translates tool events and creates a recovery root only when the current isolate did not observe the original workflow start; otherwise the existing workflow span remains open for `run_end`. This fallback does not preserve Flue's distinct recovery semantics or durably continue a trace across isolates. Re-check these translations before upgrading Braintrust.

## Protect sensitive content

Braintrust tracing is content-bearing. Its observer can export workflow payloads and results, model messages and output, reasoning, system prompts, tool definitions and values, task prompts and results, errors, and correlation metadata.

Review retention, access, privacy, and compliance requirements before enabling it in production. Use Braintrust's `setMaskingFunction(...)` before initialization when content requires redaction, and test the application-specific masker against representative prompts, reasoning, tool data, errors, secrets, and personal information.

## Cloudflare delivery

On Cloudflare, each generated agent and workflow Durable Object exports its own activity. Braintrust flushes asynchronously, but Flue observers cannot attach that final upload to the Durable Object execution lifetime. Delivery is therefore best-effort and may lose final spans when an isolate becomes idle immediately after work completes.

Confirm that tradeoff before enabling Cloudflare export and verify delivery in a deployed Worker. Node uses Braintrust's process-exit flush fallback.

## Verify

Run a workflow with a model turn and tool call against a non-production Braintrust project. Confirm the trace hierarchy, closed tool spans, usage data, and Flue correlation. On Cloudflare, separately verify final-span delivery under the deployed isolate lifecycle.
