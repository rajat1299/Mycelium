# Agent Runbook

Use this file as the first stop for any Codex agent working on Mycelium.

## What this repository is

Mycelium is an open-source control plane for outcome-driven AI work. The current integrated slice is `Milestone 7: Remote Workers and Daemon`, running on top of the verified `Milestone 6: Checkpoints, Replay, and Audit`, `Milestone 5: Review Queue and Artifact Lineage`, `Milestone 4: Routing and BYO Keys`, and `Milestone 3: Execution Substrate V1` local execution path:

- `apps/control-plane`: Fastify API and SSE runtime
- `apps/web`: Next.js operator console
- `packages/protocol`: shared contracts
- `packages/checkpoints`: backend-agnostic checkpoint store interface plus the shipped local filesystem backend
- `packages/db`: Drizzle schema and repositories
- `packages/orchestrator`: plan graph, planner, scheduler, and run-state primitives
- `packages/sandbox`: local Docker fallback, remote worker provider, and workspace management
- `packages/artifacts`: local artifact store and safe path resolution

Read these next:

1. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
2. [Local development](/Users/rajattiwari/swarm/computer-oss/docs/setup-local-dev.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md)
6. [Milestone 3 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-design.md)
7. [Milestone 3 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-implementation.md)
8. [Milestone 4 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md)
9. [Milestone 4 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-implementation.md)
10. [Milestone 5 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-design.md)
11. [Milestone 5 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-implementation.md)
12. [Milestone 6 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-design.md)
13. [Milestone 6 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-implementation.md)
14. [Milestone 7 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-design.md)
15. [Milestone 7 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-implementation.md)
16. [Milestone 8 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-design.md)
17. [Milestone 8 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-implementation.md)

The M4, M5, M6, and M7 docs now include milestone-closure verification notes. M7 is integrated on `main` and remains the currently shipped runtime in this repo. M8 is the next execution-ready milestone in the roadmap, locked to schedules plus Slack and Telegram runtime delivery with local companion groundwork only.

## Local setup

Run from the repo root:

```bash
pnpm install
cp .env.example .env
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
```

Then replace `REPLACE_WITH_LOCAL_DB_PASSWORD` in:

- `.env`
- `apps/control-plane/.env.local`

Start the local database and sync the schema:

```bash
pnpm db:up
set -a; source .env; set +a; pnpm db:push
```

`pnpm db:push` from the repo root currently requires the root `.env` file to be exported first. Keep the command above verbatim until the script is changed.

The default local sandbox image is `node:22-bookworm-slim`. If a machine needs a different image, set `SANDBOX_IMAGE` in `apps/control-plane/.env.local`.
`CHECKPOINT_ROOT` is optional. If it is unset, the shipped M6 local checkpoint backend writes versioned JSON manifests under `apps/control-plane/.mycelium/checkpoints`.
`MYCELIUM_DAEMON_TOKEN` is optional. If it is unset, local daemon requests use `local-daemon-token`.

Set `MYCELIUM_ENCRYPTION_KEY` in `apps/control-plane/.env.local` before testing credential writes. Generate one local key with:

```bash
openssl rand -base64 32
```

Start the application stack:

```bash
pnpm dev
```

Local endpoints:

- web: `http://127.0.0.1:3000`
- control plane: `http://127.0.0.1:4000/health`
- postgres: `127.0.0.1:54321`

## Verification

Run these before handing work back for review:

```bash
pnpm test
pnpm typecheck
pnpm build
```

If the task touches the running stack, also verify:

```bash
curl http://127.0.0.1:4000/health
```

If the task touches the execution path, also verify one real run in the UI or over the API:

- generate the draft plan
- start the run
- confirm `Draft brief` and `Draft operator summary` complete before `Synthesize result`
- confirm the run reaches `completed`
- confirm the selected run shows persisted artifacts and persisted logs

If the task touches the M4 routing surface, also verify:

- the settings page loads provider catalog, workspace credentials, auth profiles, and router policy
- creating a credential requires `MYCELIUM_ENCRYPTION_KEY`
- a route preview resolves or returns explicit unresolved diagnostics
- repeated route previews keep the same provider/model/auth-profile selection for a fixed policy version, even though `resolvedAt` changes per preview
- if you want every node in the default draft plan to resolve, the policy includes `document` as well as `reasoning`
- run steps show route metadata or unresolved state without breaking the M3 local execution path

If the task touches the M5 approval or lineage surface, also verify:

- the selected run blocks on the review-required `Synthesize result` step
- `/review` shows a pending `Review final result` approval for the blocked run
- the review detail points at the expected artifact under review
- approving the blocked work completes the run, and rejecting it fails the run
- the outcome detail page shows the blocked-review card and the artifact-lineage panel for the selected run

If the task touches the M6 checkpoint, replay, or audit surface, also verify:

- the selected run persists resumable checkpoints at safe boundaries under `CHECKPOINT_ROOT`
- interrupting the control plane leaves an in-flight run `interrupted` and `resumable` after restart instead of silently stuck
- `POST /api/runs/:runId/resume` resumes from the latest durable checkpoint
- steps already checkpointed as completed do not rerun during resume
- the outcome detail page renders `Replay anchors` and `Operator trail` for the selected run
- replay explains the selected checkpoint payload, audit explains durable lifecycle history, and persisted logs remain separate step-level debug detail

If the task touches the M7 remote-worker surface, also verify:

- a worker daemon connects to the control plane and shows up as available
- two worker sessions are connected if you want the full shipped fork/join draft plan to stay remote on both middle branches
- a real run executes on the remote worker instead of silently falling back to the local Docker path
- step logs, artifacts, and checkpoint creation still persist through the control plane
- approval-gated work still blocks and resolves normally after remote execution reaches review
- a worker disconnect or control-plane restart leaves the run recoverable through the M6 resume path

The repo does not yet ship a packaged daemon executable. For local verification, use a thin harness that exercises the daemon HTTP contract directly:

- `POST /api/worker-daemon/register`
- `POST /api/worker-daemon/commands/claim`
- `POST /api/worker-daemon/events`
- `POST /api/worker-daemon/disconnect`

## Stop commands

Stop the local app processes started by `pnpm dev` with `Ctrl+C`.

Stop the project database:

```bash
pnpm db:down
```

If you need to clear local state:

```bash
docker compose down -v
```

## Working agreement for agents

- Default to working directly on local `main` in this repo unless the human explicitly asks for isolated `codex/*` worktrees.
- Keep GitHub remote branches limited to `main` unless the human explicitly asks for another flow.
- Do not commit secrets or local passwords. Use placeholders in tracked files and real values only in ignored env files.
- Prefer additive docs updates when the setup, architecture, or workflow changes.
- If you change the local startup flow, update both [setup-local-dev.md](/Users/rajattiwari/swarm/computer-oss/docs/setup-local-dev.md) and this runbook.
- Append cross-milestone status updates to [project-log.md](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md).
- Update the active milestone plan only in its progress, deviation, and verification sections.

## Current review workflow

The human is using a separate review/planning window for architecture, code review, and task breakdown. Implementation agents should keep changes scoped, verified, and easy to review in chunks.
