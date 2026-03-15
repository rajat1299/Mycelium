# Milestone 5 Review Queue and Artifact Lineage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md), and [Milestone 5 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-design.md) before touching code.

**Goal:** Add a first-class review queue and artifact-lineage model so Mycelium can pause blocked work for human review, show what is being approved, and resume or fail execution deterministically after operator action.

**Architecture:** Keep the control plane authoritative. M5 expands the runtime around approvals and lineage, but it does **not** add schedules, messaging adapters, checkpoint replay, or remote workers. The M3 local Docker execution path and M4 routing path stay intact.

**Tech stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`

---

## Required reading for this milestone

Read these first:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Technical Spec](/Users/rajattiwari/swarm/computer-oss/docs/04-technical-spec.md)
6. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
7. [Milestone 5 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-design.md)

Then read milestone-specific references:

- `OpenClaw`
  - [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
  - focus on exec-approval and operator-facing action patterns
- `Terragon`
  - [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
  - focus on durable run/artifact state and post-run lifecycle instincts
- `Middleman`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
  - focus on escalation boundaries and manager-owned pause points
- `Deer Flow`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/thread_state.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/gateway/routers/artifacts.py`
  - `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`
  - use only as a secondary reference for artifact UX and inspectable state

## Non-negotiable invariants for M5

Lock these before touching code:

- approval-required work must not silently continue without an approval record
- approval resolution must be idempotent and single-shot
- approval, run, step, and outcome updates must be transactional
- artifact-lineage edges must never connect artifacts across runs
- rejecting an approval must leave a clear terminal state
- non-review runs must keep behaving exactly as they did in M4

## Reference extraction checklist by task

### Task 1

- `/Users/rajattiwari/swarm/openclaw/src/tools/exec-approval.ts`
- `/Users/rajattiwari/swarm/openclaw/src/core/agent-state.ts`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`

### Task 2

- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/r2-file-upload.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/r2/r2.ts`
- `/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md`

### Task 3

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
- `/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md`

### Task 4

- `/Users/rajattiwari/swarm/openclaw/src/gateway/router.ts`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/gateway/routers/artifacts.py`

### Task 5

- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`
- `/Users/rajattiwari/swarm/openclaw/src/tools/exec-approval.ts`

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
- update local-dev and runbook docs if the operator flow changed

---

## Scope for this milestone

In scope:

- approval and lineage protocol contracts
- approval requirement fields on executable plan nodes or run steps
- approval persistence and artifact-lineage persistence
- execution blocking and resume paths
- approval APIs and SSE events
- workspace review queue UI
- artifact-lineage UI on the outcome detail surface

Out of scope:

- comment threads and collaborative review
- schedules, messaging, or external delivery integrations
- checkpoint replay or audit-history expansion
- provider execution adapters or remote workers
- budget controls

## Milestone acceptance criteria

Before calling M5 complete:

- a run can create a pending approval and pause deterministically
- approval resolution updates approval, step, run, and outcome state together
- approving resumes execution or completes the blocked run correctly
- rejecting fails the blocked run clearly
- artifact-lineage edges are persisted for derived outputs
- operators can inspect pending approvals in the web console
- operators can inspect artifact lineage on the outcome detail surface
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

---

## Task 1: Add approval and lineage contracts

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Deer Flow`

**Files:**

- Create: `packages/protocol/src/approval.ts`
- Create: `packages/protocol/src/artifact-lineage.ts`
- Modify: `packages/protocol/src/plan.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/approval.test.ts`
- Create: `packages/protocol/src/artifact-lineage.test.ts`
- Modify: `packages/protocol/src/plan.test.ts`

**Step 1: Write the failing tests**

Cover:

- approval schema shape
- approval status and resolution invariants
- approval-linked run or step context
- artifact-lineage edge shape
- additive review-required metadata on plan nodes or run steps
- SSE event payloads for approval request and resolution

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test -- src/approval.test.ts src/artifact-lineage.test.ts
```

Expected:

- FAIL because the approval and lineage contracts do not exist yet

**Step 3: Implement the contracts**

Add shared schemas for:

- approval record
- approval request detail
- approval resolution request
- approval list response
- artifact-lineage edge
- artifact-lineage list response
- approval-related event payloads
- review requirement metadata on executable nodes or steps

Keep the first milestone mode narrow:

- one requirement kind: `output_review_required`

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
git commit -m "feat: add approval and artifact lineage contracts"
```

---

## Task 2: Extend persistence for approvals and artifact lineage

**Reference priority:**

- primary: `Terragon`
- secondary: existing `packages/db` patterns

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/repositories/approvals.ts`
- Create: `packages/db/src/repositories/approvals.test.ts`
- Create: `packages/db/src/repositories/artifact-lineage.ts`
- Create: `packages/db/src/repositories/artifact-lineage.test.ts`
- Modify: `packages/db/src/repositories/artifacts.ts`
- Modify: `packages/db/src/repositories/runs.ts`
- Modify: `packages/db/src/repositories/test-database.ts`

**Step 1: Write the failing tests**

Cover:

- creating pending approvals
- listing pending approvals by workspace
- resolving an approval once and rejecting repeated resolution
- lineage edges staying within one run
- lineage reads for a run and for an artifact
- transactional state changes around approval resolution

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/approvals.test.ts src/repositories/artifact-lineage.test.ts
```

Expected:

- FAIL because the approval repository and lineage repository do not exist yet

**Step 3: Implement persistence**

Add or expand tables for:

- approvals with linked workspace, outcome, run, and step context
- artifact-lineage edges

Prefer explicit columns over opaque JSON for the core relationships.

Add repository methods for:

- create pending approval
- get approval by id
- list approvals by workspace and status
- resolve approval
- add lineage edges
- list lineage for a run
- list lineage for an artifact

Mirror the new FK behavior in the fake test DB.

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
git commit -m "feat: persist approvals and artifact lineage"
```

---

## Task 3: Integrate approvals and lineage into execution

**Reference priority:**

- primary: `Middleman`
- secondary: `Terragon`

**Files:**

- Modify: `packages/orchestrator/src/planner.ts`
- Modify: `packages/orchestrator/src/scheduler.ts`
- Modify: `packages/orchestrator/src/*.test.ts`
- Modify: `apps/control-plane/src/lib/execution-service.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`
- Create: `apps/control-plane/src/lib/approval-service.ts`
- Modify: `apps/control-plane/test/execution-service.test.ts`
- Modify: `apps/control-plane/test/repositories.test.ts`

**Step 1: Write the failing tests**

Cover:

- a review-required step blocks the run after producing artifacts
- pending approval creation includes the correct run and step context
- approval creates lineage edges from parent-step artifacts to child-step artifacts
- approving a blocked step resumes or finalizes the run correctly
- rejecting a blocked step fails the run and outcome
- non-review-required runs stay unchanged

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts
```

Expected:

- FAIL because approval-aware execution is not implemented yet

**Step 3: Implement runtime behavior**

Integrate approval awareness into execution by:

- tagging at least one deterministic planner node as `output_review_required`
- pausing completion for that step after artifacts are persisted
- creating a pending approval before dependents are released
- transitioning outcome to `blocked_on_approval` and run to `blocked`
- on approval, completing the step and releasing dependents
- on rejection, terminating the run clearly

The simplest first proof is to make the final synthesis output review-required.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts
pnpm --filter @computer-oss/control-plane typecheck
pnpm test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/orchestrator apps/control-plane
git commit -m "feat: add approval-aware execution flow"
```

Status:

- Completed on `2026-03-15`.
- Final synthesis is now tagged `output_review_required`.
- Execution persists artifact-lineage edges, creates pending approvals, pauses runs in `blocked` / `blocked_on_approval`, and resumes or fails deterministically through the new approval service.
- Verified with `pnpm --filter @computer-oss/control-plane test`, `pnpm --filter @computer-oss/control-plane typecheck`, `pnpm --filter @computer-oss/orchestrator test`, `pnpm --filter @computer-oss/orchestrator typecheck`, `pnpm --filter @computer-oss/orchestrator build`, `pnpm --filter @computer-oss/db test`, `pnpm --filter @computer-oss/db typecheck`, `pnpm --filter @computer-oss/db build`, and workspace `pnpm test`, `pnpm typecheck`, `pnpm build`.

---

## Task 4: Add approval and lineage APIs plus event streaming

**Reference priority:**

- primary: `OpenClaw`
- secondary: existing control-plane route patterns

**Files:**

- Create: `apps/control-plane/src/routes/approvals.ts`
- Modify: `apps/control-plane/src/routes/outcome-events.ts`
- Modify: `apps/control-plane/src/routes/artifacts.ts`
- Modify: `apps/control-plane/src/app.ts`
- Modify: `apps/control-plane/test/app.test.ts`
- Create: `apps/control-plane/test/approvals.test.ts`

**Step 1: Write the failing tests**

Cover:

- listing pending approvals by workspace
- fetching approval detail
- approving and rejecting an approval
- approval events appearing on the outcome stream
- lineage reads for a run

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/approvals.test.ts
```

Expected:

- FAIL because the routes and event wiring do not exist yet

**Step 3: Implement routes**

Add:

- `GET /api/approvals`
- `GET /api/approvals/:id`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `GET /api/runs/:runId/artifact-lineage`

Publish:

- `approval.requested`
- `approval.resolved`

Prefer reusing the current SSE transport instead of adding WebSockets.

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
git commit -m "feat: add approval and lineage api surfaces"
```

---

## Task 5: Add the operator review queue and artifact-lineage surfaces

**Reference priority:**

- primary: `Deer Flow`
- secondary: existing `apps/web` execution-console patterns

**Files:**

- Create: `apps/web/app/review/page.tsx`
- Create: `apps/web/components/review/review-queue.tsx`
- Create: `apps/web/components/review/review-detail-card.tsx`
- Create: `apps/web/components/outcomes/artifact-lineage-panel.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/execution-console.tsx`
- Modify: `apps/web/lib/api.ts`
- Create: `apps/web/app/review/page.test.tsx`
- Create: `apps/web/components/review/*.test.tsx`
- Create: `apps/web/components/outcomes/artifact-lineage-panel.test.tsx`

**Step 1: Write the failing tests**

Cover:

- review queue page loads pending approvals
- approve and reject actions hit the right API surface
- blocked approval state appears on the outcome detail view
- artifact-lineage panel renders derived-from relationships for the selected run
- approval SSE events update the local UI

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/web test -- app/review/page.test.tsx
```

Expected:

- FAIL because the review route and lineage UI do not exist yet

**Step 3: Implement the web surfaces**

Add:

- a workspace review queue page
- approve/reject actions through Next API or server actions
- a blocked-on-review card on the outcome detail page
- an artifact-lineage panel for the selected run

Keep the UI intentionally simple:

- queue list
- review detail
- lineage list or chain view

Do not build a comment system or a heavy graph explorer in M5.

**Step 4: Run tests and typecheck**

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
git commit -m "feat: add review queue and artifact lineage ui"
```

---

## Task 6: Docs, smoke path, and milestone closure

**Reference priority:**

- primary: shipped repo behavior
- secondary: earlier milestone closure docs

**Files:**

- Modify: `README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/agent-runbook.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-execution-roadmap.md`
- Modify: `docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-design.md`
- Modify: `docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-implementation.md`

**Step 1: Update docs**

Document:

- how approval-required runs behave
- where the review queue lives
- how artifact-lineage inspection works
- any new env or smoke requirements

**Step 2: Run the live smoke path**

At minimum verify:

1. start the local stack
2. create credential, auth profile, and router policy
3. create an outcome and generate the default plan
4. start a run
5. confirm the run blocks on the review-required step
6. confirm a pending approval appears in `/review`
7. confirm the approval links to the expected artifacts
8. approve the blocked work
9. confirm the run reaches `completed`
10. repeat with rejection and confirm the run reaches `failed`
11. confirm artifact-lineage relationships render for the selected run

**Step 3: Run workspace verification**

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
git commit -m "docs: record m5 review queue workflow"
```

---

## Known risks to watch during M5

- deadlocking the scheduler by blocking a step without a clean resume path
- non-transactional approval resolution creating split-brain run/outcome state
- lineage edges being written across the wrong run or step
- UI state splitting between the review queue and outcome detail page
- over-scoping into comments, edits, or collaborative review behavior

## Implementation Notes

- `2026-03-14`: Plan authored. No implementation notes yet.
- `2026-03-14`: Task 1 completed on `codex/m5-task1-approval-lineage-contracts`: added first-class approval and artifact-lineage protocol contracts, wired approval events into the shared SSE union, and added additive approval-requirement metadata on plan nodes and run steps.
- `2026-03-14`: Task 2 completed on `codex/m5-task2-approvals-lineage-persistence`: expanded the DB schema for first-class approvals plus `artifact_lineage_edges`, added approval and lineage repositories with run-scoped validation, added artifact lookup helpers and approval-lifecycle repository support, and extended the fake repository DB with approval/lineage tables, FK checks, and rollback coverage.
- `2026-03-15`: Task 4 completed on `codex/m5-task4-approval-api-streaming`: added control-plane approval routes for pending-list/detail/approve/reject, added run-scoped artifact-lineage reads, and verified that `approval.requested` and `approval.resolved` events stream over the existing outcome SSE surface without adding a second transport.
