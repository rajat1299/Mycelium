# Milestone 7 Remote Workers and Daemon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md), and [Milestone 7 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-design.md) before touching code.

**Goal:** Prove that Mycelium can execute real runs on remote daemon-backed workers while keeping checkpoints, artifacts, approvals, audit history, and durable run state authoritative in the control plane.

**Architecture:** M7 adds a remote worker daemon protocol, worker registry, remote sandbox provider, and remote run assignment path. It does not add a remote checkpoint backend or remote artifact blob store. Worker daemons execute step work and upload logs, artifacts, and checkpoint payloads back to the existing control-plane persistence surfaces.

**Tech stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `ws`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`, `Docker`

**Status:** `Execution-ready planning complete on 2026-03-16`

---

## Required reading for this milestone

Read these first:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Technical Spec](/Users/rajattiwari/swarm/computer-oss/docs/04-technical-spec.md)
6. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
7. [Milestone 6 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-design.md)
8. [Milestone 7 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-design.md)

Then read milestone-specific references:

- `Terragon`
  - `/Users/rajattiwari/swarm/terragon-oss/docs/ideas/new-agent-service.md`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/provider.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/daemon.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/daemon/src/daemon.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/daemon/src/runtime.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/daemon/src/shared.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/app/api/daemon-event/route.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/handle-daemon-event.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/agent/sandbox.ts`
  - [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
- `OpenClaw`
  - `/Users/rajattiwari/swarm/openclaw/src/acp/runtime/registry.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/acp/control-plane/manager.core.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/gateway/server-runtime-state.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/commands/daemon-runtime.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/commands/node-daemon-runtime.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/commands/agent/session-store.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/commands/sessions-cleanup.ts`
  - [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
- `Middleman`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-factory.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/agent-runtime.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
  - `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
- `Deer Flow`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/subagents/executor.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/tools/builtins/task_tool.py`
  - `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`

## Non-negotiable invariants for M7

Lock these before touching code:

- the control plane remains authoritative for run, outcome, approval, artifact, checkpoint, and audit durability
- worker daemons connect outbound to the control plane; do not design inbound control-plane-to-worker sockets
- remote execution must remain behind the sandbox abstraction instead of bypassing it
- step completion must not be committed until required logs, artifacts, and checkpoint effects are durably recorded through the control plane
- worker assignment and worker lease ownership must be explicit and queryable
- M3 local Docker execution must keep working alongside the new remote provider
- M5 approval semantics and M6 resume semantics must remain intact
- remote checkpoint or blob storage backends are out of scope for this milestone

## Reference extraction checklist by task

### Task 1

- `/Users/rajattiwari/swarm/terragon-oss/packages/daemon/src/shared.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/daemon/src/runtime.ts`
- `/Users/rajattiwari/swarm/openclaw/src/acp/runtime/registry.ts`
- `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`

### Task 2

- `/Users/rajattiwari/swarm/openclaw/src/commands/agent/session-store.ts`
- `/Users/rajattiwari/swarm/openclaw/src/commands/sessions-cleanup.ts`
- `/Users/rajattiwari/swarm/openclaw/src/acp/control-plane/manager.core.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/agent/sandbox.ts`

### Task 3

- `/Users/rajattiwari/swarm/terragon-oss/docs/ideas/new-agent-service.md`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/app/api/daemon-event/route.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/handle-daemon-event.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-runtime-state.ts`

### Task 4

- `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/provider.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/daemon.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-factory.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/agent-runtime.ts`

### Task 5

- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`
- `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`
- `/Users/rajattiwari/swarm/openclaw/src/acp/control-plane/manager.core.ts`

### Task 6

- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

If one of the reference files moves, do not guess a replacement path. Verify the replacement in the cloned repo first, then update this plan.

## Progress update protocol

Before starting:

- create a fresh `codex/*` branch from `main`
- append a short start entry to [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)

During implementation:

- keep milestone-local deviations and verification notes in `Implementation Notes` at the bottom of this file
- do not rewrite earlier tasks; append review-driven changes only

After each finished task:

- run the task-level verification commands
- stop at the task boundary and request review before moving on

After milestone completion:

- append milestone verification evidence here
- update [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
- update the runbook and local-dev docs if the remote worker bootstrap or verification flow changed

---

## Scope for this milestone

In scope:

- worker daemon and remote-worker protocol contracts
- worker registry and authenticated worker sessions
- remote run or step assignment plus lease tracking
- remote provider support in `packages/sandbox`
- daemon-backed remote step execution
- upload-back artifact and checkpoint durability through the control plane
- remote-worker-aware APIs, SSE, and operator visibility

Out of scope:

- remote checkpoint storage
- remote artifact blob storage
- arbitrary multi-region scheduling
- messaging, schedules, or local companion work
- browser/ffmpeg remote specialization
- provider-backed model execution changes outside the worker substrate

## Milestone acceptance criteria

Before calling M7 complete:

- a remote worker daemon connects to the control plane and appears available
- `POST /api/outcomes/:id/runs` can execute the shipped default run on a remote worker
- step logs, artifacts, checkpoint creation, and audit history are durably visible from the control plane
- approval-gated runs still block and resume correctly after remote execution reaches the review step
- a worker disconnect or control-plane restart leaves the run recoverable through the existing M6 checkpoint model
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

---

## Task 1: Add remote worker and daemon protocol contracts

**Reference priority:**

- primary: `Terragon`
- secondary: `OpenClaw` and `Middleman`

**Files:**

- Create: `packages/protocol/src/remote-worker.ts`
- Create: `packages/protocol/src/daemon.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/plan.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/remote-worker.test.ts`
- Create: `packages/protocol/src/daemon.test.ts`

**Step 1: Write the failing tests**

Cover:

- worker registration payloads
- worker capability and health schema
- daemon command and daemon event payloads
- remote step assignment metadata
- worker-connected, worker-disconnected, and remote-step lifecycle SSE payloads
- run-step persisted metadata for remote worker assignment and attempt identity

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test -- src/remote-worker.test.ts src/daemon.test.ts
```

Expected:

- FAIL because the remote-worker and daemon contracts do not exist yet

**Step 3: Implement the contracts**

Add shared schemas for:

- worker registration and heartbeat
- worker capability summary
- daemon dispatch command
- daemon log, artifact, checkpoint, status, and terminal event payloads
- remote run-step assignment summary
- SSE payloads for worker availability and remote execution state

Keep contracts transport-agnostic enough that M8 can add remote durability without changing the event model.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/protocol typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol
git commit -m "feat: add remote worker protocol contracts"
```

---

## Task 2: Extend persistence for worker inventory and run assignment

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Terragon`

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/repositories/remote-workers.ts`
- Create: `packages/db/src/repositories/remote-workers.test.ts`
- Modify: `packages/db/src/repositories/runs.ts`
- Modify: `packages/db/src/repositories/workspace-leases.ts`
- Modify: `packages/db/src/repositories/test-database.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`
- Create: `apps/control-plane/test/repositories-remote-workers.test.ts`

**Step 1: Write the failing tests**

Cover:

- worker registration upsert and heartbeat refresh
- worker health transitions
- exclusive run or lease assignment to one worker at a time
- cleanup of stale worker sessions
- durable linkage from run or step attempt to worker identity
- in-memory parity for worker deletion, stale-session cleanup, and assignment conflicts

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/remote-workers.test.ts
pnpm --filter @computer-oss/control-plane test -- test/repositories-remote-workers.test.ts
```

Expected:

- FAIL because the worker persistence surface does not exist yet

**Step 3: Implement persistence**

Add durable tables or expansions for:

- connected remote workers
- worker sessions or heartbeat metadata
- run or step assignment to a worker

Persist enough data to answer:

- which worker is executing this run or step
- whether the worker session is healthy
- whether the run is still leased to that worker

Mirror the relevant FK and uniqueness behavior in the fake DB and in-memory repository layer.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/db test
pnpm --filter @computer-oss/db typecheck
pnpm --filter @computer-oss/control-plane test -- test/repositories-remote-workers.test.ts
pnpm --filter @computer-oss/control-plane typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db apps/control-plane/src/lib/repositories.ts apps/control-plane/test/repositories-remote-workers.test.ts
git commit -m "feat: persist remote worker assignments"
```

---

## Task 3: Add the control-plane daemon gateway and worker registry

**Reference priority:**

- primary: `Terragon`
- secondary: `OpenClaw`

**Files:**

- Create: `apps/control-plane/src/lib/worker-registry.ts`
- Create: `apps/control-plane/src/lib/daemon-gateway.ts`
- Modify: `apps/control-plane/src/lib/service-container.ts`
- Modify: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/src/routes/worker-daemon.ts`
- Create: `apps/control-plane/src/routes/workers.ts`
- Create: `apps/control-plane/test/worker-daemon.test.ts`
- Create: `apps/control-plane/test/workers.test.ts`

**Step 1: Write the failing tests**

Cover:

- authenticated worker registration
- heartbeat and reconnect
- control-plane-side worker availability transitions
- daemon event ingestion
- stale worker timeout or disconnect handling
- listing worker status over the API

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/worker-daemon.test.ts test/workers.test.ts
```

Expected:

- FAIL because the gateway and registry do not exist yet

**Step 3: Implement the gateway**

Add:

- a worker registry owned by the control plane
- an authenticated daemon connection route
- event handlers for log, artifact, checkpoint, and terminal status uploads
- worker status read APIs for the operator surface

The daemon should connect outbound to the control plane. Do not invert the connection model.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
pnpm --filter @computer-oss/control-plane build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/control-plane
git commit -m "feat: add remote worker daemon gateway"
```

---

## Task 4: Add the remote sandbox provider and integrate remote execution

**Reference priority:**

- primary: `Terragon`
- secondary: `Middleman`

**Files:**

- Create: `packages/sandbox/src/remote-provider.ts`
- Create: `packages/sandbox/src/remote-provider.test.ts`
- Modify: `packages/sandbox/src/index.ts`
- Modify: `packages/sandbox/src/types.ts`
- Modify: `apps/control-plane/src/lib/execution-service.ts`
- Modify: `apps/control-plane/src/lib/checkpoint-service.ts`
- Modify: `apps/control-plane/src/routes/runs.ts`
- Create: `apps/control-plane/test/remote-execution.test.ts`

**Step 1: Write the failing tests**

Cover:

- remote provider dispatch
- streamed log delivery from daemon to control plane
- artifact upload and persistence from the remote worker
- checkpoint upload and durable commit before step completion
- local Docker provider still working when the remote provider is disabled
- worker disconnect leaving the run interrupted and resumable instead of silently stuck

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/sandbox test -- src/remote-provider.test.ts
pnpm --filter @computer-oss/control-plane test -- test/remote-execution.test.ts
```

Expected:

- FAIL because the remote provider and execution wiring do not exist yet

**Step 3: Implement remote execution**

Add:

- a remote provider in `packages/sandbox`
- execution-service support for dispatching a step to a connected worker
- upload-back handling for remote logs, artifacts, and checkpoint payloads
- interruption behavior that preserves the M6 resume path when the worker disappears mid-run

Do not let a remote worker become the durability authority.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/sandbox test
pnpm --filter @computer-oss/sandbox typecheck
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
pnpm --filter @computer-oss/control-plane build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sandbox apps/control-plane
git commit -m "feat: add remote worker execution path"
```

---

## Task 5: Add worker visibility, remote status, and operator recovery surfaces

**Reference priority:**

- primary: `Deer Flow`
- secondary: `Middleman` and `OpenClaw`

**Files:**

- Modify: `apps/control-plane/src/routes/runs.ts`
- Modify: `apps/control-plane/src/routes/workers.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/events.ts`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/execution-console.tsx`
- Modify: `apps/web/components/outcomes/run-timeline.tsx`
- Create: `apps/web/components/outcomes/remote-worker-panel.tsx`
- Create: `apps/web/components/outcomes/remote-worker-panel.test.tsx`
- Create: `apps/web/app/review/page.test.tsx`

**Step 1: Write the failing tests**

Cover:

- showing the selected worker on a run
- live worker-connected or disconnected updates in the outcome surface
- remote interruption and resume state visibility
- review flow still working after remote execution reaches the approval gate
- stale worker state not overwriting newer status updates

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/web test -- components/outcomes/remote-worker-panel.test.tsx app/review/page.test.tsx
```

Expected:

- FAIL because the worker visibility surface does not exist yet

**Step 3: Implement operator visibility**

Expose:

- worker assignment and health on the selected run
- remote interruption or resume status in the outcome console
- live worker status updates through the existing outcome event transport

Keep the UI additive. Do not rewrite the M5 review desk or the M6 checkpoint surfaces.

**Step 4: Run tests, build, and typecheck**

Run:

```bash
pnpm --filter @computer-oss/web test
pnpm --filter @computer-oss/web build
pnpm --filter @computer-oss/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web apps/control-plane/src/routes
git commit -m "feat: show remote worker execution state"
```

---

## Task 6: Docs, local and remote smoke verification, and milestone closure

**Reference priority:**

- primary: local `_codex_notes`
- secondary: the verified repo files above

**Files:**

- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/agent-runbook.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-execution-roadmap.md`
- Modify: `docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-design.md`
- Modify: `docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-implementation.md`

**Step 1: Update docs**

Document:

- how to boot a local control plane with a remote worker daemon
- the fact that checkpoint and artifact durability still lives in the control plane in M7
- how to verify worker registration, remote execution, disconnect recovery, and resume

**Step 2: Run the live smoke path**

Verify:

- a remote worker daemon connects
- a draft plan runs on the remote worker
- artifacts, checkpoints, and logs appear in the current operator surfaces
- approval-gated review still works
- a worker disconnect or control-plane restart preserves resumable recovery

**Step 3: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 4: Cleanup and closure**

- stop local app processes
- stop local database if it was started for the smoke
- remove generated runtime state
- update the project log and milestone notes with exact smoke evidence

**Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: close milestone 7 remote worker execution"
```

---

## Milestone verification evidence

- `2026-03-17`: Verified remote completion on workspace `ws_smoke_full_1773769480092` by registering two worker sessions through `/api/worker-daemon/register`, running `run_d509a7d8-c5b9-4951-b28d-dfab48958d30`, uploading daemon `status`, `log`, `artifact`, `checkpoint`, and `terminal` events through `/api/worker-daemon/events`, and approving `approval_bdbaf465-a4e5-4389-aebd-f37f06b4a1df`. The completed run produced four artifacts, seven checkpoints, twelve persisted logs, and seven audit entries.
- `2026-03-17`: Verified restart and resume on workspace `ws_smoke_resume_1773769802713` by interrupting `run_685d59d0-a7ca-4ba4-b463-efb16e30d0ce` after the first remote `step_completed` upload, restarting the control plane, confirming `interrupted` plus `resumable`, resuming from `checkpoint_a522da4b-9cad-44d2-a9a2-79214852894f`, and completing after only `Draft brief`, `Draft operator summary`, and `Synthesize result` were dispatched post-resume.
- `2026-03-17`: Full workspace verification passed with `pnpm test`, `pnpm typecheck`, and `pnpm build`.

## Implementation Notes

- `2026-03-16`: M7 scope is locked to remote execution only. The control plane remains authoritative for checkpoints, artifacts, and audit durability. Remote checkpoint or artifact backends are explicitly deferred to the next milestone.
- `2026-03-17`: The repo-level M7 smoke uses the daemon HTTP contract directly because the repo does not yet ship a packaged daemon executable. Local docs should describe the worker bootstrap as `register -> claim -> events -> disconnect`, not as a nonexistent CLI daemon command.
- `2026-03-17`: The shipped four-node draft plan needs two connected worker sessions to stay fully remote on both middle branch steps. With only one worker, the remaining branch can legitimately fall back to the local Docker provider.
