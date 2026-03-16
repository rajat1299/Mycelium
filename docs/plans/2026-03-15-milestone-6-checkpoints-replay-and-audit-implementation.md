# Milestone 6 Checkpoints, Replay, and Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md), and [Milestone 6 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-design.md) before touching code.

**Goal:** Add a remote-compatible checkpoint and audit layer so Mycelium can resume interrupted local runs from durable boundaries, replay checkpoint history, and show an operator-facing audit trail.

**Architecture:** Keep the control plane authoritative. M6 adds checkpoint storage, audit persistence, replay APIs, and resume behavior, but it does not add remote workers or a remote checkpoint backend. The `CheckpointStore` abstraction must remain stable so M7 can add a remote backend without changing orchestration, replay, or audit contracts.

**Tech stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`

**Status:** `Execution-ready planning complete on 2026-03-15`

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

Then read milestone-specific references:

- `Deer Flow`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/provider.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/async_provider.py`
  - `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`
- `Terragon`
  - `/Users/rajattiwari/swarm/terragon-oss/apps/broadcast/src/sandbox.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/apps/cli/src/commands/pull.tsx`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
  - [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
- `OpenClaw`
  - `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store-maintenance.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/cron/session-reaper.ts`
  - [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
- `Middleman`
  - `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/escalations/escalation-storage.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/memory-paths.ts`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

## Non-negotiable invariants for M6

Lock these before touching code:

- the `CheckpointStore` interface must not expose local-filesystem-only assumptions
- only safe durable boundaries may become resumable checkpoints
- resume must restore step state from the checkpoint snapshot, not from best-effort guesses
- replay and audit must not depend on transient SSE payload ordering
- completed steps already covered by a checkpoint must not rerun during resume
- blocked-on-approval state must remain distinct from interrupted or resumable state
- M5 approval and lineage behavior must remain intact

## Reference extraction checklist by task

### Task 1

- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/provider.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/async_provider.py`
- `/Users/rajattiwari/swarm/terragon-oss/apps/broadcast/src/sandbox.ts`

### Task 2

- `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store.ts`
- `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store-maintenance.ts`
- `/Users/rajattiwari/swarm/openclaw/src/cron/session-reaper.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/memory-paths.ts`

### Task 3

- `/Users/rajattiwari/swarm/terragon-oss/apps/broadcast/src/sandbox.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/cli/src/commands/pull.tsx`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/async_provider.py`
- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)

### Task 4

- `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/escalations/escalation-storage.ts`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`

### Task 5

- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`
- `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store.ts`

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
- update local-dev and runbook docs if the runtime root, checkpoint root, or operator flow changed

---

## Scope for this milestone

In scope:

- checkpoint and audit protocol contracts
- `packages/checkpoints` with a remote-compatible store interface
- local filesystem checkpoint backend
- checkpoint metadata and audit persistence
- execution capture at safe boundaries
- interrupted-run recovery and resume
- checkpoint, replay, and audit APIs
- outcome-detail checkpoint and audit UI

Out of scope:

- remote checkpoint storage
- remote workers and daemon protocol changes
- container snapshots
- artifact diffing or review comments
- messaging delivery or schedules
- provider-backed runtime execution

## Milestone acceptance criteria

Before calling M6 complete:

- a run persists resumable checkpoints at safe boundaries on the local stack
- interrupting the control plane leaves the run resumable instead of silently stuck
- `POST /api/runs/:runId/resume` restores the run from the latest durable checkpoint
- the outcome detail UI shows checkpoint history and audit history for the selected run
- replay explains what the selected checkpoint contained and what happened after it
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

---

## Task 1: Add checkpoint and audit contracts plus the store abstraction

**Reference priority:**

- primary: `Deer Flow`
- secondary: `Terragon`

**Files:**

- Create: `packages/protocol/src/checkpoint.ts`
- Create: `packages/protocol/src/audit.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/plan.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/checkpoint.test.ts`
- Create: `packages/protocol/src/audit.test.ts`
- Create: `packages/checkpoints/package.json`
- Create: `packages/checkpoints/tsconfig.json`
- Create: `packages/checkpoints/src/index.ts`
- Create: `packages/checkpoints/src/types.ts`
- Create: `packages/checkpoints/src/local-filesystem-store.ts`
- Create: `packages/checkpoints/src/local-filesystem-store.test.ts`

**Step 1: Write the failing tests**

Cover:

- checkpoint schema shape
- resumable versus terminal checkpoint invariants
- audit-event schema shape
- checkpoint-created and run-resume event payloads
- `CheckpointStore` write and read contract
- local backend path normalization and checksum reporting

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test -- src/checkpoint.test.ts src/audit.test.ts
pnpm --filter @computer-oss/checkpoints test -- src/local-filesystem-store.test.ts
```

Expected:

- FAIL because the checkpoint contracts and package do not exist yet

**Step 3: Implement the contracts and package**

Add shared schemas for:

- checkpoint summary
- checkpoint detail payload
- checkpoint list response
- audit event
- audit list response
- resume request and response
- SSE payloads for checkpoint creation and run interruption or resume

Add `packages/checkpoints` with:

- a backend-agnostic `CheckpointStore` interface
- a local filesystem implementation
- versioned JSON manifest read and write helpers

Do not leak local-only assumptions such as absolute filesystem paths into the protocol contracts.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/protocol typecheck
pnpm --filter @computer-oss/checkpoints test
pnpm --filter @computer-oss/checkpoints typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol packages/checkpoints
git commit -m "feat: add checkpoint and audit contracts"
```

---

## Task 2: Extend persistence for checkpoints and audit history

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Terragon` and existing `packages/db` patterns

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/repositories/checkpoints.ts`
- Create: `packages/db/src/repositories/checkpoints.test.ts`
- Create: `packages/db/src/repositories/audit-events.ts`
- Create: `packages/db/src/repositories/audit-events.test.ts`
- Modify: `packages/db/src/repositories/runs.ts`
- Modify: `packages/db/src/repositories/test-database.ts`

**Step 1: Write the failing tests**

Cover:

- creating checkpoint metadata rows with sequence ordering
- listing checkpoints newest-first and by sequence
- storing audit events with stable ordering
- linking audit events to checkpoints
- rejecting cross-run checkpoint or audit writes
- restoring step state from a checkpoint snapshot

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/checkpoints.test.ts src/repositories/audit-events.test.ts
```

Expected:

- FAIL because the repositories and schema do not exist yet

**Step 3: Implement persistence**

Add or expand tables for:

- `run_checkpoints`
- `run_audit_events`

Persist:

- checkpoint metadata in Postgres
- store location, checksum, size, sequence, kind, and resumable flag
- audit category, event type, summary, payload, and optional checkpoint linkage

Keep the checkpoint payload itself in the `CheckpointStore`, not inline in the DB row.

Add repository methods for:

- create checkpoint metadata
- get checkpoint by id
- list checkpoints by run
- append audit event
- list audit events by run
- restore run-step state from a checkpoint snapshot

Mirror the new FK and ordering behavior in the fake test DB.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/db test
pnpm --filter @computer-oss/db typecheck
pnpm --filter @computer-oss/db build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: persist checkpoints and audit history"
```

---

## Task 3: Integrate checkpoint capture and resume into the control plane

**Reference priority:**

- primary: `Terragon`
- secondary: `Deer Flow`

**Files:**

- Modify: `apps/control-plane/src/lib/env.ts`
- Modify: `apps/control-plane/src/lib/service-container.ts`
- Create: `apps/control-plane/src/lib/checkpoint-service.ts`
- Create: `apps/control-plane/src/lib/checkpoint-service.test.ts`
- Modify: `apps/control-plane/src/lib/execution-service.ts`
- Modify: `apps/control-plane/src/lib/approval-service.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`

**Step 1: Write the failing tests**

Cover:

- checkpoint creation after safe boundaries only
- interruption marking a run resumable
- restoring step state from the latest checkpoint
- resume starting only unfinished work
- approval-blocked runs staying blocked rather than turning interrupted
- startup recovery scan marking stranded active runs correctly

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts test/checkpoint-service.test.ts
```

Expected:

- FAIL because checkpoint capture and resume do not exist yet

**Step 3: Implement control-plane integration**

Add a checkpoint service that:

- builds semantic checkpoint payloads from durable run state
- writes them to the `CheckpointStore`
- persists checkpoint metadata
- appends matching audit events

Update execution and approval flow so they:

- checkpoint after run start
- checkpoint after step completion
- checkpoint after approval block
- checkpoint after approval resolution
- checkpoint at terminal states

Add recovery behavior for interrupted runs:

- detect resumable runs on startup
- expose manual resume through a service call
- restore step states from the checkpoint payload before restarting the scheduler

Do not attempt process-level resume. M6 resumes from semantic durable boundaries only.

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
git commit -m "feat: add checkpoint capture and resume"
```

---

## Task 4: Add replay, audit, and resume APIs plus SSE events

**Reference priority:**

- primary: `Middleman`
- secondary: `Deer Flow`

**Files:**

- Create: `apps/control-plane/src/routes/checkpoints.ts`
- Modify: `apps/control-plane/src/routes/runs.ts`
- Modify: `apps/control-plane/src/app.ts`
- Modify: `apps/control-plane/test/runs.test.ts`
- Create: `apps/control-plane/test/checkpoints.test.ts`

**Step 1: Write the failing tests**

Cover:

- listing checkpoints for a run
- reading checkpoint detail
- listing audit events for a run
- resuming a resumable run
- rejecting resume for terminal or non-resumable runs
- streaming checkpoint-created and run-resumed events over the outcome SSE stream

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/checkpoints.test.ts test/runs.test.ts
```

Expected:

- FAIL because the endpoints and SSE wiring do not exist yet

**Step 3: Implement the routes and event wiring**

Add:

- `GET /api/runs/:runId/checkpoints`
- `GET /api/checkpoints/:checkpointId`
- `GET /api/runs/:runId/audit`
- `POST /api/runs/:runId/resume`

Also emit outcome-stream events for:

- `checkpoint.created`
- `run.interrupted`
- `run.resumed`

Keep the live SSE union compatible with existing M3 to M5 UI behavior.

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
git commit -m "feat: add checkpoint and audit api"
```

---

## Task 5: Add checkpoint timeline, replay detail, audit trail, and resume UI

**Reference priority:**

- primary: `Deer Flow`
- secondary: existing Mycelium outcome-console patterns

**Files:**

- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/events.ts`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/execution-console.tsx`
- Create: `apps/web/components/outcomes/checkpoint-timeline.tsx`
- Create: `apps/web/components/outcomes/checkpoint-timeline.test.tsx`
- Create: `apps/web/components/outcomes/checkpoint-detail-card.tsx`
- Create: `apps/web/components/outcomes/checkpoint-detail-card.test.tsx`
- Create: `apps/web/components/outcomes/audit-trail.tsx`
- Create: `apps/web/components/outcomes/audit-trail.test.tsx`

**Step 1: Write the failing tests**

Cover:

- rendering checkpoint list and selection
- rendering checkpoint detail for the selected checkpoint
- rendering audit events in stable order
- showing resume action only for resumable runs
- live updates when checkpoint-created or run-resumed SSE events arrive

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/web test -- checkpoint-timeline checkpoint-detail-card audit-trail
```

Expected:

- FAIL because the UI does not exist yet

**Step 3: Implement the operator-console surfaces**

Extend the outcome detail console with:

- checkpoint timeline
- selected checkpoint detail
- audit trail
- resume action for interrupted resumable runs

Keep the M3 timeline, M4 route metadata, and M5 lineage/review surfaces intact. M6 should layer into the existing console instead of replacing it.

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
git add apps/web
git commit -m "feat: add checkpoint and audit console"
```

---

## Task 6: Update docs and run the interruption-and-resume smoke path

**Reference priority:**

- primary: the shipped Mycelium M6 surface
- secondary: local setup and runbook patterns already in the repo

**Files:**

- Modify: `README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/agent-runbook.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-execution-roadmap.md`
- Modify: `docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-design.md`
- Modify: `docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-implementation.md`

**Step 1: Update docs**

Document:

- the shipped M6 flow
- the local checkpoint root and any env required for it
- the difference between replay, audit, and live logs
- the fact that only the local filesystem checkpoint backend ships in M6

**Step 2: Run the live smoke path**

Verify on the local stack:

- create an outcome, plan, and run
- let the run create at least one checkpoint
- interrupt the control plane
- restart the control plane
- confirm the run becomes resumable
- resume the run
- confirm already checkpointed completed steps do not rerun
- confirm the run reaches its correct terminal state
- confirm the checkpoint timeline and audit trail render in the UI

**Step 3: Run final verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: close milestone 6 checkpoint workflow"
```

---

## Implementation notes

- `2026-03-15`: M6 is locked to a remote-compatible `CheckpointStore` interface with only a local filesystem backend in this milestone. Do not widen scope into remote workers or daemon protocol changes.
- `2026-03-16`: Task 1 completed on `codex/m6-task1-checkpoint-contracts`: added checkpoint and audit protocol contracts, added additive interrupted/resumable run metadata and new checkpoint or resume SSE event variants, and introduced `packages/checkpoints` with a backend-agnostic `CheckpointStore` interface plus the first `LocalFilesystemCheckpointStore` implementation using versioned JSON manifests, relative store keys, and checksum reporting.
