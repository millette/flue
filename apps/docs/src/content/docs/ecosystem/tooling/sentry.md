---
title: Sentry
description: Report Flue workflow failures and explicit error logs to Sentry on Node.js and Cloudflare.
subtitle: Capture actionable failures with Flue correlation tags while keeping model content out of telemetry by default.
---

## Add Sentry

Add target-aware Sentry error reporting to an existing Flue project with:

```sh
flue add tooling sentry
```

The blueprint installs `@sentry/node` or `@sentry/cloudflare`, initializes the SDK at the appropriate runtime boundary, and adds an `observe(...)` bridge for workflow failures and explicit `ctx.log.error(...)` calls. It does not enable traces, AI metrics, or model-content export by default.

See [Observability](/docs/guide/observability/#choose-an-observability-provider) to compare Sentry with OpenTelemetry and Braintrust.

## Configure the project

Configure the Sentry project DSN through your deployment environment:

```sh
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=<commit-sha>
```

Only `SENTRY_DSN` is needed to deliver events. A Sentry DSN permits event submission but does not grant read access to project data. Keeping it in deployment configuration rather than application source makes rotation and abuse mitigation easier; use a secret or environment binding according to your project's policy.

The integration uses different SDKs by target:

| Target | Package | Initialization |
| --- | --- | --- |
| Node.js | `@sentry/node` | Module-scoped `Sentry.init(...)` in application source |
| Cloudflare | `@sentry/cloudflare` | `instrumentDurableObjectWithSentry(...)` around each generated agent and workflow Durable Object |

Do not use `@sentry/node` on Cloudflare through `nodejs_compat`.

## Choose what to report

The generated bridge reports:

- workflow `run_end` events with `isError: true`;
- `ctx.log.error(...)` as an exception when the log has an `error` attribute;
- other error logs as error-level Sentry messages.

Captures include relevant `flue.*` correlation tags. Workflow failures include `flue.run.id`, which can be inspected with `flue logs <runId>`. Persistent-agent captures use instance, session, operation, submission, and optional dispatch correlation instead. See [Observability](/docs/guide/observability/) for Flue's identity and observer model.

The bridge intentionally skips failed operations and tools because those failures may be recovered and later duplicated by a fatal workflow report. It also avoids arbitrary log attributes, prompts, responses, tool arguments, and complete event payloads. Make an explicit data-handling decision before expanding that policy.

## Target behavior

On Node.js, module-scoped initialization is sufficient for the bridge's explicit captures. Complete Sentry HTTP, database, or tracing auto-instrumentation requires Sentry's preload setup before application imports and should be verified against the built Flue server.

On Cloudflare, Flue applies a module-local `wrap` extension to the final generated Durable Object class for every instrumented agent and workflow. This preserves Flue's routing and durability behavior while allowing Sentry to initialize from the current binding environment. The wrapper does not cover the outer Worker or an authored Hono application; add HTTP middleware separately when request instrumentation is required.

## Verify

Trigger one failed workflow and one explicit error log against a non-production Sentry project. Confirm the expected `flue.*` correlation fields. On Cloudflare, exercise a wrapped agent or workflow under workerd, and verify that the application still starts without a configured DSN.
