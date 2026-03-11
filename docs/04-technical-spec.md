# Technical Spec

## Backend stack

- `TypeScript`
- `Node.js`
- `Postgres`
- local filesystem blob store by default
- WebSocket or SSE event stream for live updates

## Public HTTP surface

- `POST /api/outcomes`
- `GET /api/outcomes/:id`
- `POST /api/outcomes/:id/messages`
- `POST /api/outcomes/:id/abort`
- `GET /api/outcomes/:id/graph`
- `GET /api/artifacts/:id`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `GET /api/providers/models`
- `GET /api/router/policy`
- `PUT /api/router/policy`
- `POST /api/schedules`
- `GET /api/schedules`

Messaging ingress endpoints will exist for Slack and Telegram.

## Realtime event contracts

- `outcome.updated`
- `plan_node.updated`
- `run.updated`
- `run.log`
- `artifact.created`
- `approval.requested`
- `approval.resolved`
- `schedule.fired`
- `message.created`

## Internal adapter contracts

- `PolicyRouter.resolve(task, workspacePolicy) -> executionPlan`
- `WorkerAdapter.start(runSpec) -> workerSession`
- `WorkerAdapter.resume(sessionId)`
- `WorkerAdapter.abort(sessionId)`
- `WorkerAdapter.stream(sessionId) -> events`
- `MessagingAdapter.ingest(message) -> outcomeCommand`
- `MessagingAdapter.deliver(updateOrApproval)`
- `ArtifactStore.put/get/list`
- `CheckpointStore.save/load`

## Default capability families

- `reasoning`
- `research`
- `coding`
- `browser`
- `terminal`
- `api`
- `document`
- `fast_tasks`
- `fallback`

## Router policy shape

Default policy should be explicit and user-editable. Example:

```yaml
reasoning:
  - provider: anthropic
    model: claude-opus-4
coding:
  - provider: anthropic
    model: claude-code
research:
  - provider: google
    model: gemini-2.5-pro
fast_tasks:
  - provider: openai
    model: gpt-4o-mini
fallback:
  - provider: anthropic
    model: claude-sonnet-4
```

## Storage defaults

### Postgres

Use Postgres for:

- workspaces
- users
- outcomes
- messages
- plan graph metadata
- runs
- approvals
- schedules
- memory records
- router policy

### Blob store abstraction

Use a local filesystem-backed blob store by default for:

- artifacts
- uploads
- logs
- previews
- checkpoints

Keep the interface object-store compatible for later hosted deployments.

## Security model

- provider keys stored per workspace
- local companion accepts only signed tasks scoped to the workspace
- artifact path resolution must prevent traversal and cross-outcome leakage
- approval system is authoritative for side effects
- runtime environments are isolated per run or session class

## Test requirements

### Orchestration

- outcome becomes a plan graph with dependencies
- independent nodes run in parallel
- retries and fallback are deterministic

### Safety

- side effects block on approval
- read-only tasks do not
- local companion rejects out-of-scope actions

### Recovery

- restart preserves outcomes, runs, approvals, schedules, and artifacts
- worker reconnect resumes the same run
- scheduled runs use the same execution pipeline as interactive runs

### Surface consistency

- an outcome started on web can continue on Slack or Telegram
- artifact previews remain visible across surfaces

## Open technical decisions

- exact queueing mechanism for run dispatch
- whether branch/worktree leasing is part of v1 or v1.1
- whether budget controls land in v1 or begin as observability only
