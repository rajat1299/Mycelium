# Milestone 5 Review Queue and Artifact Lineage Design

## Purpose

Milestone 5 exists to make Mycelium reviewable and interruptible in a way that the current M4 stack is not.

Milestones 1 through 4 proved:

- outcomes, plans, runs, and steps are durable
- dependency scheduling and fork/join execution work
- local Docker execution can produce persisted logs and artifacts
- routing is explicit, workspace-scoped, and visible on steps

What the product still does **not** prove is the trust loop:

- when work should stop for a human
- what exactly the human is being asked to review
- how approval resolution changes run state durably
- how final artifacts relate to intermediate artifacts

M5 is the milestone that turns "the run produced files" into "the operator can inspect, approve, reject, and understand the lineage of those files."

## Approved direction

Approved on `2026-03-14`:

- build a `DB-backed review queue and approval control loop`
- expand approvals from a placeholder table into a first-class runtime object
- add explicit artifact-lineage records instead of relying only on loose artifact metadata
- let execution pause on approval-required steps and resume after resolution
- expose pending approvals and lineage in the operator console
- keep the M3 local Docker execution path and the M4 routing layer intact underneath

We are **not** using M5 to add schedules, messaging adapters, comment threads, or checkpoint replay.

## Options considered

### Option 1: Add a passive inbox view without blocking execution

Pros:

- smaller UI-first milestone
- easy to ship quickly
- minimal execution-service changes

Cons:

- does not prove human-in-the-loop orchestration
- no real pause/resume semantics
- side-effect control remains aspirational
- artifact review is observational only

Rejected because it would produce a queue-looking UI without the product kernel behind it.

### Option 2: Add a durable approval queue tied directly to run and step lifecycle

Pros:

- proves pause/resume behavior end to end
- gives the UI a real product primitive
- creates the right substrate for later messaging or schedule-driven approvals
- makes artifact lineage actually useful because approvals can point at concrete outputs

Cons:

- requires transactional lifecycle updates
- adds new blocking states and resume paths
- forces us to define approval semantics clearly now

Approved because it is the smallest milestone that proves reviewable execution instead of just describing it.

### Option 3: Build the full collaborative review product now

This would include:

- threaded comments
- operator edits to artifacts
- diff views
- review assignment
- multi-stage approval policies
- retry-from-review workflows

Rejected because it is too wide for the next milestone. M5 should establish the durable queue and state machine first.

## M5 scope

### In scope

- approval and review protocol contracts
- plan-node or run-step approval requirements
- durable approval records linked to outcome, run, step, and artifact context
- artifact-lineage records between produced artifacts
- execution-service pause on approval-required work
- approval resolution and run resume/release behavior
- control-plane approval APIs and SSE events
- operator review queue UI
- artifact-lineage UI on the outcome detail surface

### Out of scope

- comment threads and collaborative review editing
- messaging delivery of approvals
- scheduled approvals
- auto-approval policies
- checkpoint replay and historical event inspection beyond what M5 needs
- remote workers or provider-backed execution
- changing the M4 routing contract

## Design principles

1. Approval must be a durable domain object, not just a UI badge.
2. Run, step, outcome, and approval transitions must move together transactionally.
3. Artifact lineage must be append-only and derived from actual execution edges.
4. Human review must pause execution cleanly without corrupting readiness or release logic.
5. The UI should expose only the minimum state required to take action confidently.

## Primary product proof for M5

By the end of M5, an operator should be able to:

1. start a run that includes at least one approval-required step
2. see the run pause with a concrete pending approval
3. inspect the produced artifacts and how they were derived
4. approve or reject the blocked work
5. watch execution resume or terminate deterministically

If that works reliably, we have the first real human-in-the-loop orchestration loop.

## Reference extraction map for M5

M5 should extract ideas selectively from the reference repos. Do not import whole subsystems.

### OpenClaw

Read:

- `/Users/rajattiwari/swarm/openclaw/src/tools/exec-approval.ts`
- `/Users/rajattiwari/swarm/openclaw/src/core/agent-state.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/router.ts`
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)

Extract:

- approvals as explicit control-plane objects
- operator action patterns for approve or reject
- how approval-required work is surfaced rather than hidden

Do not inherit:

- broad channel or assistant framing
- message-first approval routing

### Terragon

Read:

- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/r2-file-upload.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/r2/r2.ts`
- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)

Extract:

- durable post-run object modeling
- artifact persistence instincts
- lifecycle rigor around stateful execution objects

Do not inherit:

- hosted product complexity
- billing, user-management, or enterprise abstractions

### Deer Flow

Read:

- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/thread_state.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/gateway/routers/artifacts.py`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`

Extract:

- inspectable artifact UX
- lightweight artifact state and loading patterns
- how to keep output inspection simple and durable

Do not inherit:

- thread-centric execution ownership
- LangGraph-specific control flow

### Middleman

Read:

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-types.ts`
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

Extract:

- manager-owned pause and escalation instincts
- synthesis boundaries and explicit human involvement points

Do not inherit:

- file-backed persistence
- local-only runtime assumptions

## Product shape for M5

M5 should add two operator-facing surfaces:

1. `Review queue`
   - list pending approvals across the current workspace
   - show what outcome, run, and step is blocked
   - show the artifacts or outputs under review
   - let the operator approve or reject

2. `Artifact lineage`
   - show where a selected artifact came from
   - show which parent artifacts fed into it
   - show which step produced it
   - keep lineage readable without requiring a graph database or complex visualization

The outcome detail page remains the main execution page. The review queue is a workspace-level entry point into blocked work.

## Architecture summary

M5 adds four new domain areas:

1. `Approval requirement metadata`
2. `Approval queue records`
3. `Artifact-lineage edges`
4. `Execution pause and resume behavior`

## Approval model

### Approval requirement

An approval requirement answers:

- does this step need a human gate?
- when does the gate happen?
- what should the operator review?

M5 should support one concrete mode first:

- `output_review_required`

That means:

- the step runs and produces artifacts
- execution pauses before the step is treated as released or terminal
- a review object is created over the step outputs
- approve marks the step complete and releases dependents
- reject marks the step rejected and terminates the run clearly

This is enough to prove the queue and the lineage loop without pretending we already have external side-effect adapters.

### Approval record

The durable approval object should include:

- `id`
- `workspaceId`
- `outcomeId`
- `runId`
- `stepId`
- `status`
- `kind`
- `title`
- `summary`
- `instruction`
- `requestedAt`
- `resolvedAt`
- `resolution`
- `resolutionNote`
- `artifactIds[]` or equivalent attached artifact context

M5 should keep resolution simple:

- `approved`
- `rejected`
- `cancelled`

### Approval resolution semantics

Approve:

- mark approval approved
- transition the blocked step to completed
- release dependents if any now become ready
- continue the run

Reject:

- mark approval rejected
- move the blocked step to failed or cancelled
- mark the run terminal
- mark the outcome terminal or blocked according to the chosen invariant

Approved M5 invariant:

- rejecting a blocking approval fails the run
- the outcome moves to `failed`

That is intentionally strict and easy to reason about.

## Artifact-lineage model

Artifact lineage should be a first-class edge table, not just JSON metadata.

Each lineage edge should connect:

- `parentArtifactId`
- `childArtifactId`
- `runId`
- `parentStepId`
- `childStepId`
- `relation`

M5 only needs one relation kind:

- `derived_from`

Lineage creation rule:

- when a step completes and produces one or more artifacts, create lineage edges from every completed parent-step artifact to every produced child artifact

For the current fork/join draft plan that means:

- `brief.md` derives from `analyze-outcome.md`
- `operator-summary.md` derives from `analyze-outcome.md`
- `final-result.md` derives from both `brief.md` and `operator-summary.md`

This is simple, deterministic, and directly tied to the plan graph.

## Runtime state changes

Current M4 runtime:

- ready steps execute
- completed steps release dependents
- terminal runs complete automatically

M5 runtime:

- ready steps execute
- if a step is approval-free, completion works as it does now
- if a step requires review, the run does **not** release dependents yet
- instead it creates a pending approval, blocks the step, and blocks the run/outcome
- approval resolution re-enters the scheduler and continues execution

This means approval resolution becomes part of the execution control plane, not a side table.

## State-machine implications

### Outcome

Use existing outcome statuses where possible:

- `running`
- `blocked_on_approval`
- `completed`
- `failed`

### Run

Keep the existing run states and use:

- `running`
- `blocked`
- `completed`
- `failed`

### Step

Use:

- `running`
- `blocked`
- `completed`
- `failed`

M5 should avoid inventing new statuses unless current statuses prove insufficient.

## API surface for M5

Add:

- `GET /api/approvals?workspaceId=<id>&status=pending`
- `GET /api/approvals/:id`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `GET /api/runs/:runId/artifact-lineage`

Realtime events:

- `approval.requested`
- `approval.resolved`
- `artifact.lineage.created` or a batched lineage refresh event

If lineage does not need its own event, reuse approval and artifact updates and fetch lineage on demand from the UI.

## UI shape for M5

### Review queue page

Create a dedicated `/review` page that shows:

- pending approvals
- linked outcome prompt
- blocked step title
- route metadata if available
- artifact summary
- approve/reject action buttons

### Outcome detail integration

Add:

- a blocked-on-review card when the selected run has a pending approval
- artifact lineage section tied to the selected run or selected artifact

Keep the UI simple and audit-friendly:

- list and relationships first
- avoid a complex node graph unless needed later

## Non-negotiable invariants for M5

- approval resolution must be idempotent
- an approval can only resolve once
- approval ownership must stay workspace and outcome consistent
- artifact lineage edges must stay within one run
- blocking approval updates must be transactional with run/step/outcome state changes
- M3/M4 execution paths without review-required steps must keep working unchanged

## What M5 unlocks

If M5 lands cleanly, the next milestones become much easier:

- M6 can build replay and audit on top of real approval and lineage objects
- M7 can send remote workers through the same approval gate
- messaging or schedules can eventually become another surface for the same review queue instead of inventing their own flow

That is why M5 should happen before checkpoints or remote sandboxes.
