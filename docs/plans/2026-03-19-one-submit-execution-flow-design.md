# One-Submit Execution Flow Design

## Purpose

This design replaces the current operator-first entry flow with a task-first execution flow while keeping the existing Mycelium control-plane model intact.

Status: `Approved on 2026-03-19 for implementation.`

The current shipped flow is:

1. submit prompt on home
2. create an outcome
3. navigate to the outcome detail page
4. manually generate a draft plan
5. manually start a run
6. optionally switch to `/review` to resolve approvals

That flow was the correct M2 orchestration shape because it made durable outcomes, plans, runs, and SSE state visible and testable. It is not the target product experience.

The target UX is a single-submit task experience:

1. the user types once on home
2. Mycelium creates the outcome, draft plan, and run automatically
3. the user lands on the outcome page while execution is already in motion
4. the user sees progress, subtasks, approvals, and artifacts inline on that page

## Approved direction

Approved on `2026-03-19`:

- home submit should auto-start by default
- no home-page toggle for `draft only` or `plan only` in the first pass
- keep the internal `outcome -> plan -> run` model unchanged
- treat this as a frontend-flow rewrite, not a control-plane architecture rewrite
- keep the current visual language introduced in the recent UI redesign
- move the current operator panels into a secondary drawer or power-user surface
- make inline approval on the outcome page the primary approval path
- keep `/review` as the secondary workspace-wide queue

## Why this approach

The existing durable model is still the right backend model:

- `Outcome` remains the dominant workflow object
- `Plan` remains the persisted orchestration graph
- `Run` remains the execution attempt

Those boundaries are now implementation details, not the primary user interaction model.

This design keeps the durable system intact while changing the operator experience to match the product promise of "describe work and watch it happen."

## Options considered

### Option A: UX-layer rewrite on top of the current backend

Pros:

- preserves the proven M2-M8 control-plane contracts
- avoids reopening checkpoints, approvals, routing, remote workers, and messaging logic
- lets the team ship incrementally with safe commits
- gives the user the target one-submit flow quickly

Cons:

- requires a meaningful frontend rewrite on the outcome page
- some internal concepts remain visible in code even if hidden from the user

Approved because it gives the right UX without destabilizing the system.

### Option B: Auto-start now, conversation UI later

Pros:

- lowest immediate risk
- small first patch

Cons:

- preserves the operator-console layout
- leaves the strongest UX mismatch in place for longer

Rejected as the final direction, but used as the first implementation chunk.

### Option C: New task/session-first frontend model plus new API view models

Pros:

- cleanest long-term frontend abstraction

Cons:

- turns a UX rewrite into a product-model rewrite
- too much risk for the first pass

Rejected for this effort.

## Non-negotiable invariants

Lock these during implementation:

- home submit creates an outcome, then attempts draft-plan creation, then attempts run creation
- the control plane remains authoritative for plans, runs, steps, approvals, checkpoints, audit, artifacts, and routing
- `/settings` remains unchanged in this rewrite
- `/review` remains available as the workspace-wide approval desk
- current SSE events remain the source of truth for live execution state
- current test coverage for control-plane behavior must remain valid
- the recent design language stays intact; do not regress to generic admin UI

## UX goals

By the end of this rewrite, the user should be able to:

1. type a prompt on home and submit once
2. land on the outcome page and immediately see execution in progress
3. understand the subtask breakdown without learning internal plan or run objects
4. approve or reject blocked work inline on the outcome page
5. receive artifacts inline in the same execution stream
6. open a secondary drawer when they need checkpoints, audit, logs, lineage, or remote-worker detail

## What changes

### Home page

Keep:

- headline
- prompt input
- suggestion chips
- overall visual direction

Change:

- submit should chain `createOutcome -> createPlan -> createRun`
- redirect to `/outcomes/:id?runId=:runId` on success
- if plan creation fails, still redirect to the outcome page with an inline bootstrap error
- if run creation fails, still redirect to the outcome page with the draft plan visible and an inline bootstrap error

### Outcome detail page

The outcome page becomes the primary task view.

Primary surface:

- prompt header
- conversation-style execution stream
- follow-up input

Secondary surface:

- operator drawer with current power-user panels

This keeps the durable backend state intact while making the reading experience task-first.

### Review flow

Inline approval becomes primary for the current outcome.

`/review` stays as the workspace queue for:

- operators managing multiple outcomes
- catching approvals not currently open on an outcome page

## Outcome page structure

### Prompt header

The prompt header should show:

- prompt preview
- source
- status
- timestamp
- expand or collapse affordance for long prompts

### Conversation stream

The stream is an ordered list of execution entries rendered top to bottom.

Entry families:

- system messages
- plan checklist
- step execution cards
- approval cards
- artifact delivery cards
- checkpoint markers
- interruption or resume cards
- worker status markers

### Follow-up input

The follow-up input appears at the bottom of the outcome page.

Initial behavior:

- append a message to the outcome conversation only
- do not trigger re-planning or a new run yet

### Operator drawer

Move these existing surfaces into the drawer:

- plan graph
- run timeline
- checkpoint timeline
- checkpoint detail
- audit trail
- artifact list
- artifact lineage
- remote worker panel
- raw log panel if still needed during transition

## Event-to-card mapping

The current SSE stream remains the source of truth.

- `plan.created` -> plan checklist card
- `run.created` -> system status card
- `run.updated` -> high-level status card updates
- `run.step.updated` -> step cards appear and update in place
- `run.log` -> step card detail output
- `artifact.created` -> inline artifact badge or delivery card
- `approval.requested` -> approval card
- `approval.resolved` -> approval card resolution state
- `checkpoint.created` -> subdued checkpoint marker
- `run.interrupted` -> interruption card
- `run.resumed` -> resume confirmation card
- `worker.connected` / `worker.disconnected` -> subdued worker status cards
- `remote.step.updated` -> remote status details inside the matching step card

## Conversation-entry model

The frontend should maintain a derived conversation list keyed by stable ids.

Important rule:

- step entries update in place as logs, artifacts, and status changes arrive
- approval entries update in place as the approval is resolved
- the final artifact card should not duplicate the same artifact repeatedly across refreshes

## Migration strategy

Implement in small working chunks:

1. docs plus home auto-start behavior
2. outcome conversation scaffolding
3. inline approval
4. artifact delivery and operator drawer
5. follow-up input and tasks-list polish
6. responsive and visual polish pass

Each chunk must leave the app working, verified, and committable.

## Risks

### Risk: partial bootstrap failure

If outcome creation succeeds but plan or run bootstrap fails, the user can land on an empty-looking page.

Mitigation:

- carry bootstrap status into the redirect
- render an inline bootstrap error state on the outcome page

### Risk: event ordering makes the conversation stream noisy

The existing SSE stream is event-oriented, not presentation-oriented.

Mitigation:

- derive stable card identities in the web layer
- update entries in place instead of appending everything as a new row

### Risk: power-user observability regresses

The current operator console exposes low-level state directly.

Mitigation:

- move existing panels into a drawer instead of removing them

## Acceptance criteria

Before calling this rewrite complete:

- home submit creates outcome, plan, and run automatically
- the user no longer needs to click `Generate draft plan` or `Start run`
- the outcome page shows execution progress in a conversation-style view
- the current outcome can be approved inline without navigating away
- artifacts are delivered inline in the execution stream
- current operator surfaces remain reachable through a secondary drawer
- `pnpm --filter @computer-oss/web test`, `pnpm --filter @computer-oss/web typecheck`, and `pnpm --filter @computer-oss/web build` pass
