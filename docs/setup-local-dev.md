# Local Development

This repository is currently shipping the Milestone 8 schedules-and-messaging slice on top of the Milestone 7 remote-worker runtime, the Milestone 6 checkpoints-replay-and-audit layer, the Milestone 5 review queue, the Milestone 4 routing layer, and the Milestone 3 execution substrate:

- Postgres-backed outcome storage
- Fastify control plane with outcome, draft-plan, run, log, and artifact APIs
- Outcome-scoped SSE for outcome, plan, run, step, log, and artifact lifecycle updates
- Local Docker sandbox execution with deterministic fork/join scheduling
- Encrypted workspace credentials plus auth profiles
- Router policy CRUD and deterministic route preview
- Approval-aware execution blocking and resume
- Review queue APIs and workspace review desk
- Durable artifact-lineage edges plus outcome-detail lineage inspection
- Local filesystem checkpoint capture, replay anchors, interruption recovery, and audit history
- Authenticated remote worker registration, heartbeat, claim, event-ingest, and disconnect routes
- Remote step execution with upload-back logs, artifacts, and checkpoint payloads
- Durable schedules plus schedule-fire history and outcome-scoped schedule SSE
- Workspace-scoped Slack and Telegram connections, inbound normalization, outbound delivery, and message history
- Next.js operator console for create, list, detail, settings, draft-plan, run timeline, review queue, persisted logs, and run artifact views
- Remote worker visibility in the outcome console, live worker lifecycle SSE events, and operator settings panels for schedules and messaging
- Local companion protocol, scope, and bootstrap groundwork docs without a packaged companion runtime

## Prerequisites

- Node.js `22.x`
- `pnpm` `10.17.0` or newer
- Docker Desktop or a local Docker engine

## Developer smoke checklist

1. Start Postgres with Docker Compose.
2. Push the Drizzle schema to the local database.
3. Start the control plane.
4. Start the web app.
5. Open the settings page and confirm provider catalog, credentials, auth profiles, and router policy load.
6. Create one workspace credential and one auth profile.
7. Save router policy for `reasoning`, `coding`, and `document`.
8. Preview `reasoning` and `document` and confirm provider/model/auth-profile selection stays stable across repeated previews.
9. Create an outcome from the web UI.
10. Generate a draft plan from the outcome detail page.
11. Start a run from the persisted plan.
12. Confirm the two middle draft steps finish before synthesis starts.
13. Confirm the selected run blocks on `Synthesize result` and the outcome detail page shows `Blocked on review`.
14. Confirm `/review` shows a pending `Review final result` approval for that run.
15. Approve the blocked work and confirm the run reaches `completed`.
16. Repeat with a second run, let it create at least one `step_completed` checkpoint while still active, stop the control plane, restart it, and confirm the run becomes `interrupted` plus `resumable`.
17. Resume that interrupted run and confirm the already checkpointed completed step does not rerun.
18. Approve the resumed final review step and confirm the run reaches `completed`.
19. Confirm the checkpoint panel shows `Replay anchors` and the audit panel shows `Operator trail` with interruption and resume entries.
20. Repeat with a third run and reject the blocked work, then confirm the run reaches `failed`.
21. Confirm the run timeline shows persisted route metadata on steps without breaking local Docker execution.
22. Confirm the artifact panel, lineage panel, checkpoint panel, audit panel, log panel, and live activity panel update without a manual refresh.
23. Refresh the page and confirm persisted logs, artifacts, route badges, checkpoint history, and audit history are still visible for the selected run.
24. Configure Slack and Telegram for the same workspace and confirm inbound messages create or continue durable outcomes.
25. Confirm outbound status delivery posts back into the originating Slack thread and Telegram chat.
26. Create a durable schedule, let it fire into a run, and confirm the run still blocks for approval in `/review`.
27. Confirm the schedule-triggered run executes through the same remote-worker, checkpoint, artifact, and audit path as web-triggered work.

## First-time setup

```bash
pnpm install
cp .env.example .env
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
# replace REPLACE_WITH_LOCAL_DB_PASSWORD in .env and apps/control-plane/.env.local
openssl rand -base64 32
# add the generated value as MYCELIUM_ENCRYPTION_KEY in apps/control-plane/.env.local
pnpm db:up
set -a; source .env; set +a; pnpm db:push
```

`pnpm db:push` is still the current schema bootstrap step for local development. The root command does not auto-load `.env`, so export the root env file first as shown above.
`pnpm db:push` waits for the local Postgres port to accept connections before it runs the schema sync.
The repository does not commit a database password. You must set your own local password in `.env` and `apps/control-plane/.env.local`.
`MYCELIUM_ENCRYPTION_KEY` is required for workspace-credential create and update operations. A local generated key is enough for development.
The local Docker sandbox defaults to `node:22-bookworm-slim`. If you need a different local image, set `SANDBOX_IMAGE` in `apps/control-plane/.env.local`.
`CHECKPOINT_ROOT` is optional. If you leave it unset, the local M6 checkpoint backend writes versioned JSON manifests under `apps/control-plane/.mycelium/checkpoints`.
`MYCELIUM_DAEMON_TOKEN` is optional. If unset, local daemon requests use `local-daemon-token`.

The repo does not yet ship a packaged daemon executable or packaged companion binary. The verified local smoke uses a thin local harness that calls the daemon HTTP contract directly:

- `POST /api/worker-daemon/register`
- `POST /api/worker-daemon/commands/claim`
- `POST /api/worker-daemon/events`
- `POST /api/worker-daemon/disconnect`

## Start the stack

```bash
pnpm dev
```

Expected local services:

- web: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- control plane: [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)
- postgres: `127.0.0.1:54321`

## Manual smoke path

1. Open the web app at [http://127.0.0.1:3000](http://127.0.0.1:3000).
2. Confirm `/settings` still loads provider catalog, credentials, auth profiles, router policy, schedules, Slack, and Telegram.
3. Create a fresh workspace id for the smoke, or reuse `ws_default` if the local DB is clean.
4. Register two worker sessions in that workspace through `POST /api/worker-daemon/register`.
5. Confirm `GET /api/workers?workspaceId=<WORKSPACE_ID>` returns both workers as `available`.
6. Submit a new outcome from the home page.
7. Confirm the new outcome appears in the list.
8. Open the outcome detail page.
9. Click `Generate draft plan` and confirm the four-node fork/join graph renders:
   `Analyze outcome`, `Draft brief`, `Draft operator summary`, and `Synthesize result`.
10. Click `Start run`.
11. From the worker harness, poll `POST /api/worker-daemon/commands/claim` for both worker sessions and mirror each `dispatch_step` command back through `POST /api/worker-daemon/events` with `status`, `log`, `artifact`, `checkpoint`, and `terminal` events.
12. Confirm the selected run shows remote worker assignment and the remote worker panel updates as the daemon events arrive.
13. Confirm the two middle draft steps stay on remote workers. The default fork/join plan needs two connected worker sessions to avoid falling back to the local Docker provider on one branch.
14. Confirm persisted logs, four artifacts, artifact-lineage edges, checkpoint summaries, replay anchors, and audit history appear for the selected run.
15. Open [http://127.0.0.1:3000/review](http://127.0.0.1:3000/review) and confirm the pending `Review final result` approval is auto-selected.
16. Approve the blocked work and confirm the run reaches `completed`.
17. Start a second outcome and run for the restart or resume smoke.
18. Let the first remote step upload a resumable `step_completed` checkpoint, then stop only the control plane before that worker sends its terminal event.
19. Restart the control plane and confirm the second run becomes `interrupted`, `resumable`, and still points at the uploaded checkpoint.
20. Resume from the checkpoint panel or `POST /api/runs/<RUN_ID>/resume`.
21. Re-register worker sessions in the same workspace and continue polling `commands/claim`.
22. Confirm `Analyze outcome` does not rerun after resume, the remaining three steps execute remotely, and the resumed run blocks on final review before approval.
23. Approve the resumed final review step and confirm the run reaches `completed`.
24. Confirm the audit trail includes interruption and resume entries in stable sequence order, and confirm replay, audit, and persisted logs still answer different questions.
25. Configure Slack for the same workspace:

```bash
curl -X PUT http://127.0.0.1:4000/api/workspaces/<WORKSPACE_ID>/slack/connection \
  -H 'content-type: application/json' \
  -d '{"enabled":true,"accountLabel":"Ops Slack","externalWorkspaceId":"T123456","externalWorkspaceLabel":"Ops"}'
```

26. Configure Telegram for the same workspace:

```bash
curl -X PUT http://127.0.0.1:4000/api/workspaces/<WORKSPACE_ID>/telegram/connection \
  -H 'content-type: application/json' \
  -d '{"enabled":true,"accountLabel":"Ops Telegram","externalWorkspaceId":"bot:telegram_ops","externalWorkspaceLabel":"telegram_ops"}'
```

27. Post a Slack Socket Mode-style inbound message:

```bash
curl -X POST http://127.0.0.1:4000/api/slack/socket-mode/messages \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"<WORKSPACE_ID>","teamId":"T123456","teamName":"Ops","channelId":"C123456","threadTs":"1710784800.000100","eventTs":"1710784800.000100","userId":"U123456","userDisplayName":"Operator","text":"Draft today'\''s status."}'
```

28. Post a second Slack message in the same thread and confirm it continues the same outcome instead of creating a new one.
29. Post a Telegram long-polling-style update:

```bash
curl -X POST http://127.0.0.1:4000/api/telegram/updates \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"<WORKSPACE_ID>","botId":"bot:telegram_ops","botUsername":"telegram_ops","chatId":"1001","messageId":"2001","replyToMessageId":null,"userId":"42","userDisplayName":"Operator","text":"Continue the launch brief."}'
```

30. Post a second Telegram message that replies in the same chat and confirm it continues the same outcome.
31. Create a durable schedule in the same workspace:

```bash
curl -X POST http://127.0.0.1:4000/api/workspaces/<WORKSPACE_ID>/schedules \
  -H 'content-type: application/json' \
  -d '{"title":"Weekly summary smoke","prompt":"Summarize the latest updates and produce the normal result artifacts.","status":"active","trigger":{"kind":"cron","expression":"* * * * *","timezone":"America/Chicago"},"outcomeMode":"create_outcome","dispatchMode":"create_run"}'
```

32. Wait for the schedule to fire, then confirm the resulting run executes through the same remote-worker path and reaches `blocked` on the final review step.
33. Approve the pending work in `/review` and confirm the run reaches `completed`.
34. Confirm the message-history API and outbound-delivery API both work for the messaging-triggered outcomes:

```bash
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/messages/history
curl -X POST http://127.0.0.1:4000/api/messages/deliveries \
  -H 'content-type: application/json' \
  -d '{"outcomeId":"<OUTCOME_ID>","kind":"status_update","body":"Smoke path completed.","runId":"<RUN_ID>"}'
```

35. Optional: call `POST /api/worker-daemon/disconnect` for one worker session and confirm the worker list or outcome activity feed reflects the disconnect.
36. Optional: append a message through the control plane:

```bash
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/messages \
  -H 'content-type: application/json' \
  -d '{"role":"assistant","content":"Smoke path event from the control plane."}'
```

37. Confirm the detail page adds a new activity entry without a refresh.
38. Optional API verification for the same workspace and outcome:

```bash
curl http://127.0.0.1:4000/api/providers/models
curl -X POST http://127.0.0.1:3000/api/workspace-credentials \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","providerId":"anthropic","label":"Primary Anthropic key","secret":"sk-ant-..."}'
curl -X POST http://127.0.0.1:3000/api/auth-profiles \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","providerId":"anthropic","label":"Anthropic primary","credentialId":"<CREDENTIAL_ID>","priority":0,"status":"active"}'
curl -X PUT http://127.0.0.1:3000/api/router/policy \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","version":1,"updatedAt":"<ISO_TIMESTAMP>","candidates":[{"capability":"reasoning","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true},{"capability":"coding","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true},{"capability":"document","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true}]}'
curl -X POST http://127.0.0.1:3000/api/router/resolve-preview \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","capability":"reasoning","policyVersion":1}'
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs \
  -H 'content-type: application/json' \
  -d '{"planId":"plan_<OUTCOME_ID>"}'
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs/latest
curl "http://127.0.0.1:4000/api/workers?workspaceId=<WORKSPACE_ID>"
curl -X POST http://127.0.0.1:4000/api/worker-daemon/register \
  -H 'content-type: application/json' \
  -H "x-mycelium-daemon-token: ${MYCELIUM_DAEMON_TOKEN:-local-daemon-token}" \
  -d '{"workerId":"worker_smoke_a","workerSessionId":"session_smoke_a","workspaceId":"<WORKSPACE_ID>","label":"Smoke worker A","daemonVersion":"smoke-1.0.0","connectedAt":"<ISO_TIMESTAMP>","capabilities":{"capabilityFamilies":["reasoning","coding","document","terminal"],"supportsArtifacts":true,"supportsCheckpoints":true,"supportsLogs":true}}'
curl -X POST http://127.0.0.1:4000/api/worker-daemon/commands/claim \
  -H 'content-type: application/json' \
  -H "x-mycelium-daemon-token: ${MYCELIUM_DAEMON_TOKEN:-local-daemon-token}" \
  -d '{"workerId":"worker_smoke_a","workerSessionId":"session_smoke_a"}'
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/logs
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifacts
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifact-lineage
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/checkpoints
curl http://127.0.0.1:4000/api/checkpoints/<CHECKPOINT_ID>
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/audit
curl -X POST http://127.0.0.1:4000/api/runs/<RUN_ID>/resume \
  -H 'content-type: application/json' \
  -d '{}'
curl "http://127.0.0.1:4000/api/approvals?workspaceId=ws_default"
curl http://127.0.0.1:4000/api/workspaces/ws_default/schedules
curl http://127.0.0.1:4000/api/schedules/<SCHEDULE_ID>/fires
curl http://127.0.0.1:4000/api/workspaces/ws_default/slack/connection
curl http://127.0.0.1:4000/api/workspaces/ws_default/telegram/connection
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/messages/history
curl -N http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/events
```

Replay, audit, and live logs are intentionally different surfaces:

- replay is the selected durable checkpoint payload and step frontier
- audit is the append-only lifecycle ledger keyed by stable sequence numbers
- live logs are step stdout and stderr detail, useful for debugging but not the source of truth for resume

## Verification commands

```bash
pnpm test
pnpm typecheck
pnpm build
curl http://127.0.0.1:4000/health
```

## Useful commands

```bash
pnpm db:up
pnpm db:push
pnpm dev
pnpm dev:control-plane
pnpm dev:web
pnpm db:down
```

## Troubleshooting

If the control plane exits with a `DATABASE_URL` validation error, the app-local env file is missing. Copy `apps/control-plane/.env.example` to `apps/control-plane/.env.local`.

If `pnpm db:push` fails with a `DATABASE_URL` validation error from the repo root, rerun it with `set -a; source .env; set +a; pnpm db:push` so the root shell exports the database URL first.

If outcome creation fails with authentication or relation errors, verify the password in `.env` matches `apps/control-plane/.env.local`, then rerun `set -a; source .env; set +a; pnpm db:push`.

If credential creation fails with `MYCELIUM_ENCRYPTION_KEY is required for credential writes.`, add `MYCELIUM_ENCRYPTION_KEY` to `apps/control-plane/.env.local`, restart the control plane, and retry.

If the web UI loads but shows no outcomes, verify `CONTROL_PLANE_URL` in `apps/web/.env.local` and check [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health).

If you already run Postgres locally on `5432`, that is expected. Mycelium uses `54321` locally to avoid connecting to the wrong database.

If runs stay queued or step execution fails immediately, verify Docker Desktop is running, confirm the host has enough free space to pull and start `node:22-bookworm-slim`, and check whether `SANDBOX_IMAGE` points at a valid local image.

If one of the two middle fork or join draft steps runs locally instead of on a remote worker, only one worker session is currently available. Connect two workers in the same workspace before starting the run if you want the entire shipped draft plan to stay remote.

If a run shows unresolved route badges on `Draft brief`, `Draft operator summary`, or `Synthesize result`, verify the router policy includes a `document` candidate. The default M3 draft plan uses `document` for those three nodes.

If a run completes immediately instead of blocking for review, verify the selected run is using the current default draft plan. M5 only pauses on the review-required `Synthesize result` step in that shipped four-node plan.

If a resumed run never shows a resume control, verify the run is actually `interrupted`, the latest selected checkpoint is marked `resumable`, and the control plane restarted after the interruption instead of the run quietly reaching a later state before shutdown.

If Slack or Telegram inbound posts return `404` for a missing connection, create or re-enable the workspace connection first through `/settings` or the connection APIs.

If a retried Slack or Telegram event fails with a duplicate-key-looking write error, rerun `pnpm db:push` to ensure the local schema matches the current repo and retry against a clean workspace. The shipped M8 runtime now repairs duplicate DB-backed inbound retries by checking durable outcome and message existence instead of matching database error strings.

If a schedule row exists but never fires locally, confirm the trigger is active, the control plane process stayed up long enough to poll due work, and the workspace still has at least one valid route candidate for the resulting plan or run path.
