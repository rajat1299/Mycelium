# Milestone 2 Orchestration Kernel Implementation Plan

> **For Codex agents:** Use the normal planning/execution workflow. Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), and [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md) before touching code.

**Goal:** Introduce the first durable orchestration kernel for Mycelium by adding the plan graph domain, run and step lifecycle state, orchestration package boundaries, plan/run control-plane APIs, and operator-console plan/run views.

**Architecture:** Keep the control plane authoritative. Milestone 2 does **not** build real remote worker execution yet. It builds the domain model that later worker providers will execute against.

**Tech Stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`

---

## Required reading for this milestone

Read these first:

1. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
2. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
3. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
4. [Cross-Project Learnings](/Users/rajattiwari/swarm/_codex_notes/cross-project-learnings.md)

Then read milestone-specific references:

- `Middleman`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
  - focus on sections `3`, `4`, `11`
- `Terragon`
  - [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
  - focus on sections `3`, `5`, `6`, `8`
- `OpenClaw`
  - [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
  - [openclaw-reduction-map.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-reduction-map.md)
  - focus on sections `3`, `4`, `6`
- `Deer Flow`
  - read the relevant code in `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer`
  - read `/Users/rajattiwari/swarm/deer-flow/backend/src/tools/builtins/task_tool.py`
  - read `/Users/rajattiwari/swarm/deer-flow/backend/src/subagents/executor.py`
  - use Deer Flow for eventing and task-thread UX ideas, not as the architectural base

## Progress update protocol

Before starting:

- add a short entry to [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md) that the milestone has started

During implementation:

- add milestone-local notes under `Implementation Notes` at the bottom of this file
- only record deviations here if they are local to M2

After completion:

- append verification evidence here
- update [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)

---

## Scope for this milestone

In scope:

- new `packages/orchestrator`
- plan graph domain types and validation
- run and step lifecycle state model
- DB tables and repositories for plans, nodes, edges, runs, steps, and run events
- deterministic draft-plan generation for an outcome
- control-plane APIs for plan and run management
- SSE event expansion for run and step lifecycle updates
- operator-console views for plan graph and run timeline

Out of scope:

- real step execution against providers
- remote sandboxes or worker daemon
- BYO key storage and router policy behavior
- approvals beyond existing placeholders
- messaging adapters
- schedules
- local companion

## Milestone acceptance criteria

Before calling M2 complete:

- an outcome can generate and persist a draft plan
- a run can be created from a plan and persisted durably
- run and step lifecycle updates are emitted over SSE
- the outcome detail page shows the draft plan and the run timeline
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

---

## Task 1: Add the orchestration package with state and graph contracts

**Reference priority:**

- primary: `Middleman`
- secondary: `Terragon`

**Files:**

- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`
- Create: `packages/orchestrator/src/index.ts`
- Create: `packages/orchestrator/src/run-state.ts`
- Create: `packages/orchestrator/src/plan-graph.ts`
- Create: `packages/orchestrator/src/planner.ts`
- Create: `packages/orchestrator/src/run-state.test.ts`
- Create: `packages/orchestrator/src/plan-graph.test.ts`

**Step 1: Write the failing tests**

Add a failing state test for valid transitions and a failing graph test for plan validation.

At minimum, cover:

- run status enum
- step status enum
- valid and invalid transitions
- graph with one root node and explicit edge validation

**Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @computer-oss/orchestrator test
```

Expected: FAIL because the package does not exist yet.

**Step 3: Implement the orchestration contracts**

Define:

- run states like `draft | queued | planning | waiting_for_worker | running | blocked | completed | failed | cancelled`
- step states like `pending | ready | claimed | running | blocked | completed | failed | cancelled`
- transition helpers
- plan graph schemas with:
  - plan
  - plan node
  - plan edge
  - root node constraints

Do not add provider-specific behavior yet.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/orchestrator test
pnpm --filter @computer-oss/orchestrator typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/orchestrator
git commit -m "feat: add orchestration state and graph contracts"
```

---

## Task 2: Extend the database layer for plans and runs

**Reference priority:**

- primary: `Terragon`
- secondary: `Deer Flow`

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/repositories/plans.ts`
- Create: `packages/db/src/repositories/runs.ts`
- Create: `packages/db/src/repositories/plans.test.ts`

**Step 1: Write the failing repository test**

Cover:

- creating a plan for an outcome
- inserting plan nodes and edges
- creating a run from a plan
- listing run steps for a run

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/plans.test.ts
```

Expected: FAIL because the schema and repositories do not exist yet.

**Step 3: Implement the schema and repositories**

Add DB tables for:

- `outcome_plans`
- `plan_nodes`
- `plan_edges`
- `outcome_runs`
- `run_steps`
- `run_events`

Repository responsibilities:

- `PlanRepository`
  - create plan
  - get plan by outcome
  - list nodes and edges
- `RunRepository`
  - create run from plan
  - get run by id
  - list run steps
  - append run event
  - update step status

Keep IDs as strings for now.

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
git commit -m "feat: add plan and run persistence"
```

---

## Task 3: Add draft-plan generation in the orchestrator package

**Reference priority:**

- primary: `Middleman`
- secondary: `OpenClaw`

**Files:**

- Modify: `packages/orchestrator/src/planner.ts`
- Create: `packages/orchestrator/src/planner.test.ts`

**Step 1: Write the failing planner test**

Create a failing test that proves:

- an outcome prompt can become a draft plan
- the generated plan includes:
  - a root analysis node
  - an execution node
  - a review/synthesis node
- edges are valid and acyclic

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/orchestrator test -- src/planner.test.ts
```

Expected: FAIL because the planner has not been implemented.

**Step 3: Implement a deterministic draft planner**

For M2, do **not** pretend to have real LLM decomposition yet.

Implement a deterministic planner that creates a stable 3-node graph:

- `analyze-outcome`
- `execute-outcome`
- `synthesize-result`

Use this milestone to establish:

- planner interface
- plan persistence path
- UI shape for plan visualization

LLM-based decomposition belongs in a later milestone.

**Step 4: Run tests**

Run:

```bash
pnpm --filter @computer-oss/orchestrator test
pnpm --filter @computer-oss/orchestrator typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/orchestrator
git commit -m "feat: add deterministic draft planner"
```

---

## Task 4: Add control-plane APIs and events for plans and runs

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Terragon`

**Files:**

- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/plan.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`
- Create: `apps/control-plane/src/routes/plans.ts`
- Create: `apps/control-plane/src/routes/runs.ts`
- Modify: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/test/plans.test.ts`
- Create: `apps/control-plane/test/runs.test.ts`

**Step 1: Write the failing API tests**

Cover:

- generating a draft plan for an outcome
- reading the persisted plan
- creating a run from a plan
- reading a run and its steps
- emitting events for:
  - `plan.created`
  - `run.created`
  - `run.step.updated`

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- plans
pnpm --filter @computer-oss/control-plane test -- runs
```

Expected: FAIL because routes and protocol contracts do not exist yet.

**Step 3: Implement the API slice**

Add routes:

- `POST /api/outcomes/:id/plan`
- `GET /api/outcomes/:id/plan`
- `POST /api/outcomes/:id/runs`
- `GET /api/runs/:runId`

Extend SSE outcome events to include:

- plan creation
- run creation
- step status changes

Keep the eventing on the existing outcome stream for now. Do not add a second realtime channel yet.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol apps/control-plane
git commit -m "feat: add plan and run control-plane apis"
```

---

## Task 5: Add operator-console plan and run views

**Reference priority:**

- primary: `Deer Flow`
- secondary: `Terragon`

**Files:**

- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/events.ts`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Create: `apps/web/components/outcomes/plan-graph.tsx`
- Create: `apps/web/components/outcomes/run-timeline.tsx`
- Create: `apps/web/components/outcomes/plan-actions.tsx`
- Create: `apps/web/components/outcomes/plan-graph.test.tsx`

**Step 1: Write the failing UI test**

Cover:

- rendering draft plan nodes
- rendering a run timeline with steps
- showing empty states when no plan or run exists yet

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/web test -- plan-graph
```

Expected: FAIL because the components and types do not exist yet.

**Step 3: Implement the operator-console slice**

Add:

- a `Generate draft plan` action
- a `Start run` action once a plan exists
- plan graph display
- run timeline display
- SSE-driven updates for run and step state

Do not add graph editing yet. This milestone is for visibility and orchestration state, not full authoring.

**Step 4: Run tests, typecheck, and build**

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
git commit -m "feat: add plan and run views to the operator console"
```

---

## Task 6: Wire docs, verification, and milestone handoff

**Files:**

- Modify: `README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-milestone-2-orchestration-kernel-implementation.md`

**Step 1: Update docs**

Ensure docs reflect:

- how to generate a plan
- how to create a run
- how to observe run updates

**Step 2: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

If Docker is available, also run the local stack and verify:

1. create an outcome
2. generate a draft plan
3. start a run
4. observe run and step updates in the UI

**Step 3: Update logs**

Append:

- one milestone completion note in [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
- `Implementation Notes` and `Verification Notes` at the bottom of this file

**Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: update milestone 2 handoff and verification notes"
```

---

## Final verification checklist

Before calling the milestone complete:

- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm build` passes
- `POST /api/outcomes/:id/plan` works
- `POST /api/outcomes/:id/runs` works
- the outcome detail page shows the persisted draft plan
- the outcome detail page shows the run timeline
- run and step lifecycle changes appear on the outcome SSE stream

## Implementation notes

Append milestone-local notes here as work progresses.
