# Milestone 3 Execution Substrate V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md), and [Milestone 3 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-design.md) before touching code.

**Goal:** Prove that Mycelium's orchestration layer can execute a real dependency graph end-to-end by adding a local Docker sandbox provider, dependency-aware scheduling, artifact persistence, and a live operator-console execution view.

**Architecture:** Keep the control plane authoritative. M3 adds a local Docker execution substrate and a deterministic fork/join planner, but it does not add remote daemons, provider routing, or BYO-key integrations yet. The milestone should prove scheduling, parallelism, and synthesis with real isolation and durable artifacts.

**Tech Stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`, local `Docker`

---

## Required reading for this milestone

Read these first:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Technical Spec](/Users/rajattiwari/swarm/computer-oss/docs/04-technical-spec.md)
6. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
7. [Milestone 3 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-design.md)

Then read milestone-specific references:

- `Terragon`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/provider.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/sandbox.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/daemon.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/types/src/sandbox.ts`
- `OpenClaw`
  - `/Users/rajattiwari/swarm/openclaw/Dockerfile.sandbox`
  - `/Users/rajattiwari/swarm/openclaw/Dockerfile.sandbox-common`
  - `/Users/rajattiwari/swarm/openclaw/scripts/sandbox-setup.sh`
  - `/Users/rajattiwari/swarm/openclaw/scripts/sandbox-common-setup.sh`
- `Middleman`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
  - `/Users/rajattiwari/swarm/middleman/docs/manager-isolation.md`
  - `/Users/rajattiwari/swarm/middleman/docs/plans/per-manager-integrations.md`
- `Deer Flow`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/tools/builtins/task_tool.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/subagents/executor.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/sandbox/local/local_sandbox_provider.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/gateway/routers/artifacts.py`

## Progress update protocol

Before starting:

- create a fresh `codex/*` branch from `main`
- append a short entry to [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md) that M3 implementation has started

During implementation:

- add milestone-local notes under `Implementation Notes` at the bottom of this file
- record only milestone-local deviations here

After each finished task:

- run the task-level verification commands
- request review in the execution window before moving to the next task

After milestone completion:

- append verification evidence here
- update [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
- update any setup docs that changed

---

## Scope for this milestone

In scope:

- executable plan-node metadata
- deterministic fork/join planner output
- scheduler logic that unlocks dependency-ready steps
- `packages/sandbox` with a local Docker provider
- `packages/artifacts` with a filesystem-backed artifact store
- workspace lease management
- DB support for artifacts and workspace leases
- control-plane execution service that drives runs to completion
- realtime `run.updated`, `run.log`, and `artifact.created` events
- operator-console artifact and execution panels

Out of scope:

- remote sandbox daemon protocol
- provider/model routing
- BYO keys and router policy CRUD
- approval-first side effects beyond current placeholders
- messaging adapters
- schedules
- local companion

## Milestone acceptance criteria

Before calling M3 complete:

- the deterministic planner emits a fork/join graph with two independent worker steps
- starting a run kicks off execution automatically
- ready sibling steps execute in parallel in local Docker containers
- step, run, and outcome statuses advance durably
- artifacts are written to local storage and persisted in Postgres metadata
- `run.updated`, `run.log`, and `artifact.created` reach the outcome SSE stream
- the outcome detail page shows run progress and artifacts
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root
- a manual smoke path with Docker proves end-to-end execution

---

## Task 1: Make plans executable and schedulable

**Reference priority:**

- primary: `Middleman`
- secondary: `Terragon`

**Files:**

- Modify: `packages/protocol/src/plan.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/plan.test.ts`
- Modify: `packages/orchestrator/src/plan-graph.ts`
- Modify: `packages/orchestrator/src/planner.ts`
- Modify: `packages/orchestrator/src/planner.test.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Create: `packages/orchestrator/src/scheduler.ts`
- Create: `packages/orchestrator/src/scheduler.test.ts`

**Step 1: Write the failing protocol and orchestrator tests**

Cover:

- executable plan-node fields
- fork/join draft-plan output
- ready-step selection from a dependency graph
- synthesis remaining blocked until both worker branches complete

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test -- src/plan.test.ts
pnpm --filter @computer-oss/orchestrator test -- src/planner.test.ts
pnpm --filter @computer-oss/orchestrator test -- src/scheduler.test.ts
```

Expected:

- `scheduler.test.ts` fails because the file does not exist
- protocol and planner tests fail because executable fields and fork/join output do not exist yet

**Step 3: Extend the contracts**

Add enough metadata for workers to execute a node deterministically.

Minimum node additions:

- `instruction`
- `template`
- `expectedArtifactPath`
- `expectedArtifactKind`

Update the deterministic planner to emit:

- `Analyze outcome`
- `Draft brief`
- `Draft operator summary`
- `Synthesize result`

with two parallel middle nodes and a join at synthesis.

Add pure scheduler helpers for:

- listing ready nodes from current step states
- detecting terminal run completion
- computing which dependents become ready after a step completes

Do not add provider routing logic here.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/orchestrator test
pnpm --filter @computer-oss/orchestrator typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol packages/orchestrator
git commit -m "feat: add executable fork-join planning contracts"
```

---

## Task 2: Add local sandbox and artifact packages

**Reference priority:**

- primary: `Terragon`
- secondary: `OpenClaw`

**Files:**

- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`
- Create: `packages/sandbox/src/index.ts`
- Create: `packages/sandbox/src/provider.ts`
- Create: `packages/sandbox/src/local-docker-provider.ts`
- Create: `packages/sandbox/src/workspace-manager.ts`
- Create: `packages/sandbox/src/provider.test.ts`
- Create: `packages/sandbox/src/workspace-manager.test.ts`
- Create: `packages/artifacts/package.json`
- Create: `packages/artifacts/tsconfig.json`
- Create: `packages/artifacts/src/index.ts`
- Create: `packages/artifacts/src/store.ts`
- Create: `packages/artifacts/src/store.test.ts`

**Step 1: Write the failing tests**

Cover:

- deterministic workspace paths per run
- lease acquisition preventing double-use of the same workspace
- local artifact store writing only under its configured root
- local Docker provider translating a step spec into an isolated container run request

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @computer-oss/sandbox test
pnpm --filter @computer-oss/artifacts test
```

Expected: FAIL because the packages do not exist yet.

**Step 3: Implement the packages**

`packages/sandbox` should define:

- `SandboxProvider`
- `SandboxExecutionRequest`
- `SandboxExecutionResult`
- `WorkspaceLease`
- `WorkspaceManager`
- `LocalDockerProvider`

`LocalDockerProvider` should:

- use one ephemeral Docker container per step
- mount workspace and artifact directories
- run a minimal command inside `node:22-bookworm-slim` or equivalent
- capture stdout and stderr for log fanout
- return exit code, timing, and produced paths

`packages/artifacts` should define:

- local root path configuration
- safe relative-path resolution
- `put`, `read`, and `list` primitives

Do not add remote provider behavior yet.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/sandbox test
pnpm --filter @computer-oss/sandbox typecheck
pnpm --filter @computer-oss/artifacts test
pnpm --filter @computer-oss/artifacts typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sandbox packages/artifacts
git commit -m "feat: add local sandbox and artifact packages"
```

---

## Task 3: Extend persistence for execution, artifacts, and leases

**Reference priority:**

- primary: `Terragon`
- secondary: `Deer Flow`

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/repositories/runs.ts`
- Create: `packages/db/src/repositories/runs.test.ts`
- Create: `packages/db/src/repositories/artifacts.ts`
- Create: `packages/db/src/repositories/artifacts.test.ts`
- Create: `packages/db/src/repositories/workspace-leases.ts`
- Create: `packages/db/src/repositories/workspace-leases.test.ts`

**Step 1: Write the failing repository tests**

Cover:

- run status updates
- listing ready steps
- marking a step completed and making dependents ready
- storing artifacts scoped to outcome, run, and step
- acquiring and releasing workspace leases

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts
pnpm --filter @computer-oss/db test -- src/repositories/artifacts.test.ts
pnpm --filter @computer-oss/db test -- src/repositories/workspace-leases.test.ts
```

Expected: FAIL because the schema and repositories do not support these flows yet.

**Step 3: Extend the schema and repositories**

Add or extend support for:

- richer `artifacts` rows with `runId`, `stepId`, and safer metadata
- `workspace_leases`
- `RunRepository.updateStatus`
- `RunRepository.listByOutcome`
- `RunRepository.listReadySteps`
- `RunRepository.appendLogEvent` or equivalent `runEvents` helper

Keep dependency-release calculations outside the repository when possible.

The repository should expose durable primitives, not embed the whole scheduler.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/db test
pnpm --filter @computer-oss/db typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: persist execution artifacts and workspace leases"
```

---

## Task 4: Add the control-plane execution service

**Reference priority:**

- primary: `Terragon`
- secondary: `Middleman`

**Files:**

- Modify: `apps/control-plane/src/app.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`
- Modify: `apps/control-plane/src/lib/env.ts`
- Create: `apps/control-plane/src/lib/execution-service.ts`
- Create: `apps/control-plane/src/lib/service-container.ts`
- Modify: `apps/control-plane/src/routes/runs.ts`
- Create: `apps/control-plane/src/routes/artifacts.ts`
- Modify: `apps/control-plane/test/runs.test.ts`
- Create: `apps/control-plane/test/execution-service.test.ts`
- Create: `apps/control-plane/test/artifacts.test.ts`

**Step 1: Write the failing execution tests**

Use a fake sandbox provider first.

Cover:

- creating a run triggers execution kickoff
- the run moves `queued -> running -> completed`
- two ready sibling steps start before synthesis starts
- logs and artifacts are emitted
- outcome status moves `queued -> running -> completed`

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts
pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts
pnpm --filter @computer-oss/control-plane test -- test/artifacts.test.ts
```

Expected: FAIL because there is no execution service, artifact route, or status-driving path yet.

**Step 3: Implement the service**

Create an execution service that:

- acquires a workspace lease for the run
- emits `outcome.updated` when work starts
- finds ready steps
- claims and runs ready siblings in parallel with `Promise.all`
- streams `run.log` and `run.updated`
- persists artifacts on successful step completion
- unlocks downstream steps after dependency completion
- marks the run and outcome terminal when synthesis completes or a step fails

Route behavior:

- `POST /api/outcomes/:id/runs` should still create the run, but now also trigger execution
- `GET /api/outcomes/:id/runs/latest` remains the outcome-scoped recovery path
- add artifact reads needed by the web UI

Keep the execution service separate from Fastify route code.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/control-plane
git commit -m "feat: add control-plane execution service"
```

---

## Task 5: Expose run progress and artifacts in the operator console

**Reference priority:**

- primary: `Deer Flow`
- secondary: `OpenClaw`

**Files:**

- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/events.ts`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/run-timeline.tsx`
- Modify: `apps/web/components/outcomes/outcome-activity.tsx`
- Create: `apps/web/components/outcomes/artifact-list.tsx`
- Create: `apps/web/components/outcomes/run-log-panel.tsx`
- Modify: `apps/web/components/outcomes/plan-graph.test.tsx`
- Create: `apps/web/components/outcomes/artifact-list.test.tsx`
- Create: `apps/web/components/outcomes/run-log-panel.test.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.test.tsx`

**Step 1: Write the failing UI tests**

Cover:

- artifact list rendering
- live run log rendering from SSE events
- run timeline status updates from `run.updated`
- outcome detail page showing latest artifacts for the selected run

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/web test -- app/outcomes/[id]/page.test.tsx
pnpm --filter @computer-oss/web test -- components/outcomes/artifact-list.test.tsx
pnpm --filter @computer-oss/web test -- components/outcomes/run-log-panel.test.tsx
```

Expected: FAIL because these surfaces do not exist yet.

**Step 3: Implement the UI**

Add:

- artifact fetch helpers
- `artifact.created`, `run.updated`, and `run.log` event handling
- artifact list panel
- run log panel
- richer run status rendering

Keep the page server-first. Do not move orchestration logic into the client.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/web test
pnpm --filter @computer-oss/web typecheck
pnpm --filter @computer-oss/web build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add execution artifacts and logs to the operator console"
```

---

## Task 6: Run the local Docker smoke path and update docs

**Reference priority:**

- primary: internal docs
- secondary: `OpenClaw`

**Files:**

- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/agent-runbook.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-execution-roadmap.md`
- Modify: `docs/plans/2026-03-12-milestone-3-execution-substrate-implementation.md`

**Step 1: Add a manual smoke checklist**

Document:

- how to ensure Docker is running
- how to start the stack
- how to create an outcome and run it
- what files, statuses, and UI signals prove success

**Step 2: Run the real smoke path**

Run:

```bash
pnpm db:up
pnpm db:push
pnpm dev
```

Then verify:

1. create an outcome from the web UI
2. generate the draft plan
3. start the run
4. observe two middle steps finish before synthesis
5. confirm artifacts exist and are visible in the UI
6. confirm the outcome reaches `completed`

**Step 3: Run final verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 4: Update docs and logs**

Update:

- setup instructions
- any Docker assumptions
- milestone notes
- project log

**Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: record m3 execution workflow and verification"
```

---

## Final completion checklist

Do not hand the milestone back for merge until all of these are true:

- task-level commits exist and are reviewable
- the execution service uses the sandbox abstraction, not ad hoc route logic
- the UI reads durable state and SSE events without inventing client-only orchestration
- the Docker smoke path has been run on the actual merged milestone branch
- [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md) has been updated
- this document's `Implementation Notes` and `Verification Log` are filled in

## Implementation Notes

- `2026-03-12`: Initial manager-authored plan created. M3 is explicitly locked to a local Docker sandbox provider. Do not widen scope into remote daemons, provider routing, or BYO-key work in this milestone.
- `2026-03-12`: Codex began Task 1 on `codex/m3-task1-executable-plans` after loading the required reading, reviewing the Task 1 reference notes, and verifying a clean worktree baseline with `pnpm install` and `pnpm test`. No blocker was found in the plan; the first batch remains limited to executable plan contracts, fork/join deterministic planning, and pure scheduler helpers.
- `2026-03-12`: Task 1 keeps the new executable node fields additive in the shared schemas for now. The deterministic planner emits `instruction`, `template`, `expectedArtifactPath`, and `expectedArtifactKind` immediately, but the protocol and plan-graph schemas still accept older persisted nodes until later M3 tasks extend durable storage.
- `2026-03-12`: Review hardening for Task 1 added two invariants that the initial batch missed: plan graphs now reject duplicate node IDs, and scheduler helpers ignore step rows whose `planNodeId` is not owned by the current plan. The control-plane route tests were also updated so the branch stays integration-safe with the new fork/join planner shape.
- `2026-03-12`: Codex began Task 2 on `codex/m3-task2-sandbox-artifacts` after reloading the M3 implementation plan and the Terragon/OpenClaw sandbox references. This batch stays limited to `packages/sandbox` and `packages/artifacts`, with TDD coverage first for deterministic workspace allocation, lease exclusivity, safe artifact root resolution, and Docker execution request translation.
- `2026-03-12`: Task 2 keeps the sandbox boundary package-local instead of importing `RunStep` directly from `@computer-oss/protocol`. The provider now accepts a narrow execution-step contract so the package stays standalone and future control-plane code can map durable run-step rows into it explicitly.
- `2026-03-12`: Task 2 added an injectable Docker runner to `LocalDockerProvider` so unit tests can verify container request translation without requiring a live Docker daemon. The provider also normalizes expected artifact paths before composing `/workspace/...` targets to prevent container-side path escape.
- `2026-03-12`: Task 2 hardening enforces that a sandbox request's `step.runId` must match the parent `runId`, and timeout cleanup now force-removes the named Docker container instead of assuming `docker run --rm` is sufficient after the client process is killed.
- `2026-03-12`: Review hardening for Task 2 added three more invariants that the initial batch missed: workspace leases now reserve their run before any async directory creation to prevent concurrent double-acquire, artifact paths are canonicalized before returning or persisting metadata so aliases collapse to one identity, and `expectedArtifactPath` must resolve under `artifacts/` because produced-artifact discovery is intentionally scoped to that mounted subtree in M3.
- `2026-03-12`: Final Task 2 hardening filters caller-supplied `MYCELIUM_*` variables out of `request.environment` before composing the container environment. The sandbox provider is now authoritative for run, step, and artifact context instead of trusting external overrides.
- `2026-03-12`: Codex began Task 3 on `codex/m3-task3-execution-persistence` after merging Task 2 to `main`. This batch is limited to `packages/db` durability work, and it also carries the executable plan-node metadata into persisted plan/run rows so Task 4 does not have to build an execution service on top of lossy step records.
- `2026-03-12`: Task 3 required one small implementation-scope deviation from the file list in the plan: `apps/control-plane/src/routes/plans.ts`, `apps/control-plane/src/lib/repositories.ts`, and the matching control-plane tests were updated so the live plan creation path actually passes executable node metadata into the newly expanded DB persistence layer. Without that, Task 3 would have shipped durable columns that the app never wrote.
- `2026-03-12`: Review hardening for Task 3 tightened the remaining state-transition invariants in the persistence layer. `releaseReadyDependents()` now only flips a step to `ready` if the row is still `pending` at update time, which prevents duplicate join-step releases when sibling completions race. Workspace lease release is also idempotent now: the repository updates only active leases and preserves the first recorded `releasedAt` timestamp if cleanup runs twice.
- `2026-03-12`: Codex began Task 4 on `codex/m3-task4-execution-service` after merging Task 3 to `main`. The batch stays centered on the control plane: background execution, artifact read APIs, and the SSE lifecycle that Task 5 will project into the operator console.
- `2026-03-12`: Task 4 required a few small implementation-scope deviations from the listed file set. Shared protocol contracts were expanded with artifact and new event schemas, `tsconfig.base.json` gained resolver entries for the newer workspace packages, `apps/control-plane/src/server.ts` was updated so the real server composes the execution service instead of only DB repositories, and the existing web SSE parser/activity feed received a minimal compatibility patch so the widened event union does not break unrelated workspace typechecks before Task 5 lands.

## Verification Log

- `2026-03-12` Task 1:
  - `pnpm --filter @computer-oss/protocol test`
  - `pnpm --filter @computer-oss/orchestrator test`
  - `pnpm --filter @computer-oss/orchestrator typecheck`
- `2026-03-12` Task 1 review hardening:
  - `pnpm --filter @computer-oss/control-plane test -- test/plans.test.ts`
  - `pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
- `2026-03-12` Task 2:
  - `pnpm install`
  - `pnpm --filter @computer-oss/sandbox test`
  - `pnpm --filter @computer-oss/sandbox typecheck`
  - `pnpm --filter @computer-oss/artifacts test`
  - `pnpm --filter @computer-oss/artifacts typecheck`
- `2026-03-12` Task 2 review hardening:
  - `pnpm --filter @computer-oss/sandbox test -- src/workspace-manager.test.ts src/provider.test.ts`
  - `pnpm --filter @computer-oss/artifacts test -- src/store.test.ts`
  - `pnpm --filter @computer-oss/sandbox test`
  - `pnpm --filter @computer-oss/sandbox typecheck`
  - `pnpm --filter @computer-oss/artifacts test`
  - `pnpm --filter @computer-oss/artifacts typecheck`
- `2026-03-12` Task 2 final env hardening:
  - `pnpm --filter @computer-oss/sandbox test -- src/provider.test.ts`
  - `pnpm --filter @computer-oss/sandbox test`
  - `pnpm --filter @computer-oss/sandbox typecheck`
- `2026-03-12` Task 3:
  - `pnpm install`
  - `pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts`
  - `pnpm --filter @computer-oss/db test -- src/repositories/artifacts.test.ts`
  - `pnpm --filter @computer-oss/db test -- src/repositories/workspace-leases.test.ts`
  - `pnpm --filter @computer-oss/db test`
  - `pnpm --filter @computer-oss/db typecheck`
  - `pnpm --filter @computer-oss/control-plane test -- test/plans.test.ts`
  - `pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts`
  - `pnpm --filter @computer-oss/control-plane typecheck`
- `2026-03-12` Task 3 review hardening:
  - `pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts`
  - `pnpm --filter @computer-oss/db test -- src/repositories/workspace-leases.test.ts`
  - `pnpm --filter @computer-oss/db typecheck`
  - `pnpm --filter @computer-oss/control-plane test -- test/plans.test.ts`
  - `pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts`
  - `pnpm --filter @computer-oss/control-plane typecheck`
- `2026-03-12` Task 4:
  - `pnpm install`
  - `pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts`
  - `pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts`
  - `pnpm --filter @computer-oss/control-plane test -- test/artifacts.test.ts`
  - `pnpm --filter @computer-oss/control-plane test`
  - `pnpm --filter @computer-oss/control-plane typecheck`
  - `pnpm --filter @computer-oss/protocol test`
  - `pnpm --filter @computer-oss/protocol typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm typecheck`
