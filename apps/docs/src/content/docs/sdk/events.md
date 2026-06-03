---
title: Events and records
description: SDK event, workflow-run record, and normalized model-turn types.
lastReviewedAt: 2026-06-02
---

## `FlueEvent`

`FlueEvent` is the observable runtime-event union. It includes run lifecycle, agent lifecycle, model turn, message, tool, task, compaction, operation, log, and idle events. Persisted workflow-run events always carry `runId` and `eventIndex`; together they identify one stored event and provide its ordering and resume cursor. Direct-agent stream indexes provide live per-context ordering only. Dispatched activity uses `dispatchId` as its delivery identity rather than becoming a workflow run.

## `AttachedAgentEvent`

`AttachedAgentEvent` is emitted by direct interactions with persistent agent instances. It excludes workflow-run lifecycle events, requires `instanceId`, and does not include `runId`.

## Run and discovery types

| Type                 | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `RunOwner`           | Workflow identity recorded for a run.                                                           |
| `RunRecord`          | Persisted workflow-run record, including status, timestamps, payload, result, and error fields. |
| `RunPointer`         | Workflow-run summary returned by admin listing routes.                                          |
| `RunStatus`          | Workflow-run status: `'active'`, `'completed'`, or `'errored'`.                                 |
| `AgentManifestEntry` | Agent discovery metadata returned by the read-only admin route.                                 |
| `ListResponse<T>`    | Cursor-paginated response with `items` and optional `nextCursor`.                               |

## Normalized model-turn types

`turn_request` and `turn` events expose normalized model data through these exported types:

| Type                   | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `LlmMessage`           | Union of normalized user, assistant, and tool-result messages.           |
| `LlmUserMessage`       | Normalized user message.                                                 |
| `LlmAssistantMessage`  | Normalized assistant message.                                            |
| `LlmToolResultMessage` | Normalized tool-result message.                                          |
| `LlmTextContent`       | Text content.                                                            |
| `LlmThinkingContent`   | Reasoning content.                                                       |
| `LlmImageContent`      | Image content.                                                           |
| `LlmToolCall`          | Tool call content.                                                       |
| `LlmTool`              | Tool definition.                                                         |
| `LlmTurnPurpose`       | Model-turn purpose: `'agent'`, `'compaction'`, or `'compaction_prefix'`. |
