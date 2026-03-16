# Milestone 6 Checkpoints, Replay, and Audit Design

## Purpose

Milestone 6 exists to make the shipped M5 local stack resumable, inspectable, and explainable.

Status: `Completed on 2026-03-16 and integrated on main.`

Milestones 1 through 5 proved:

- outcomes, plans, runs, steps, approvals, and artifact lineage are durable
- dependency-aware fork/join execution works on the local Docker substrate
- routing is explicit and visible on steps
- blocked work can pause for review and resume after approval

What the product still does not prove is continuity after interruption:

- where a long-running run can safely resume
- what exact state was durable at that boundary
- how an operator inspects the before and after of a resumed run
- how to explain what happened without reading raw run logs

M6 is the milestone that turns "the run was executing" into "the run can resume from a safe checkpoint, replay its durable history, and show a trustworthy audit trail."

## Approved direction

Approved on `2026-03-15`:

- introduce a first-class `CheckpointStore` interface now
- implement only a `LocalFilesystemCheckpointStore` in M6
- keep checkpoint metadata and audit indexes in the DB, with checkpoint payloads stored behind the `CheckpointStore`
- build replay and audit on top of stable checkpoint and audit contracts, not directly on transient SSE payloads
- keep the M3 local Docker execution path, the M4 routing layer, and the M5 approval loop intact underneath
- defer remote checkpoint storage and daemon-backed checkpoint recovery to M7

This matches the pattern already used in Mycelium:

- `packages/sandbox`: local Docker provider now, remote provider later
- artifact storage: local filesystem now, remote blob backend later

M6 should do the same thing for checkpoints.

## Options considered

### Option 1: Embed local checkpoint files directly in the execution service

Pros:

- fastest possible path to a working local resume prototype
- smallest initial code surface
- no new package boundary

Cons:

- hard-bakes filesystem assumptions into orchestration code
- makes M7 remote workers a rewrite instead of a backend swap
- couples replay and audit to local implementation details

Rejected because it would solve the local demo and make the next architecture step harder.

### Option 2: Introduce a remote-compatible `CheckpointStore` and ship only the local filesystem backend in M6

Pros:

- keeps orchestration, replay, and audit backend-agnostic
- aligns with the existing `packages/sandbox` design pattern
- keeps M7 to "add another backend" instead of "replace the model"
- still keeps M6 constrained to the current local stack

Cons:

- adds one extra abstraction layer now
- requires us to define checkpoint payload shape carefully

Approved because it is the smallest durable shape that supports both M6 local resume and M7 remote workers.

### Option 3: Jump straight to remote checkpoints and daemon-backed worker resume

Pros:

- closest to the long-term product
- avoids a second implementation step later

Cons:

- drags M7 complexity into M6
- adds protocol, remote process, and infra work before replay and audit are proven
- slows down the actual product proof for resumability

Rejected because M6 should prove the continuity model first, not remote infrastructure.

## M6 scope

### In scope

- checkpoint protocol contracts
- a `CheckpointStore` interface with a local filesystem backend
- durable checkpoint metadata and durable audit-event persistence
- checkpoint capture at safe execution boundaries
- interrupted-run recovery and resume from the latest durable checkpoint
- replay and audit APIs
- operator-console checkpoint timeline and audit trail
- local-stack smoke verification for interruption and resume

### Out of scope

- remote checkpoint backends
- remote workers or daemon protocol changes
- container-level snapshots or process hibernation
- artifact diff views or review comments
- schedules, messaging, or recurring replay jobs
- provider-backed execution adapters

## Design principles

1. Checkpoints must be semantic, not process-level. We checkpoint durable execution boundaries, not raw container memory.
2. The `CheckpointStore` interface must be stable across local and remote backends.
3. Audit history must be append-only and more stable than live SSE transport events.
4. Resume must never rerun work that is already safely checkpointed as completed.
5. Replay should explain the run, not behave like a debugger.

## Primary product proof for M6

By the end of M6, an operator should be able to:

1. start a run on the current local Docker stack
2. let the run reach at least one durable checkpoint boundary
3. interrupt the control plane before the run finishes
4. restart the stack and see the run marked resumable
5. resume from the latest durable checkpoint without redoing already checkpointed steps
6. inspect a checkpoint timeline and an audit trail that explains what happened

If that works reliably, Mycelium has its first real continuity layer.

## Closure note

M6 shipped on `2026-03-16` with the design intact:

- `CheckpointStore` is a first-class interface, but only `LocalFilesystemCheckpointStore` ships in M6
- Postgres stores checkpoint metadata, audit indexes, and the latest resumable checkpoint pointer
- checkpoint payload manifests stay behind the store boundary and default locally to `apps/control-plane/.mycelium/checkpoints` when `CHECKPOINT_ROOT` is unset
- replay, audit, and live logs are now separate operator surfaces:
  - replay shows the selected durable checkpoint payload and step frontier
  - audit shows the append-only lifecycle ledger in stable sequence order
  - logs show persisted step stdout or stderr detail
- the live local-stack smoke path verified interruption and recovery end to end:
  - a run reached `step_completed`
  - the control plane was stopped before terminal state
  - restart marked the run `interrupted` and `resumable`
  - `POST /api/runs/:runId/resume` resumed from the preserved checkpoint id
  - the already completed `Analyze outcome` step did not rerun
  - the run returned to the M5 review gate and reached `completed` after approval

## Reference extraction map for M6

Use only the verified current files below. Do not replace them with guessed filenames.

### Deer Flow

Read:

- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/provider.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/checkpointer/async_provider.py`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`

Extract:

- checkpointer abstraction shape
- sync and async lifetime management
- reconnect and history-loading instincts for replay surfaces

Do not inherit:

- LangGraph-specific runtime ownership
- thread-centric execution semantics

### Terragon

Read:

- `/Users/rajattiwari/swarm/terragon-oss/apps/broadcast/src/sandbox.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/cli/src/commands/pull.tsx`
- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)

Extract:

- resume semantics around long-lived sandbox sessions
- operator-facing "pull or resume existing work" instincts
- durable event and usage ledger thinking

Do not inherit:

- hosted platform assumptions
- provider-specific resume logic in the Mycelium core

### OpenClaw

Read:

- `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store.ts`
- `/Users/rajattiwari/swarm/openclaw/src/config/sessions/store-maintenance.ts`
- `/Users/rajattiwari/swarm/openclaw/src/cron/session-reaper.ts`
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)

Extract:

- session continuity storage discipline
- maintenance and pruning policy
- cleanup and reaper rigor for local runtime state

Do not inherit:

- assistant-first session product framing
- messaging-channel assumptions

### Middleman

Read:

- `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/escalations/escalation-storage.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/memory-paths.ts`
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

Extract:

- typed event contracts for operator-facing history
- manager-owned lifecycle responsibility
- simple, durable local persistence for operator-visible state

Do not inherit:

- file-backed persistence as the system of record
- local-only backend assumptions in the orchestration core

## Product shape for M6

M6 adds three operator-facing capabilities:

1. `Checkpoint timeline`
   - shows durable boundaries for a selected run
   - shows whether each checkpoint is resumable or terminal
   - lets the operator inspect the selected checkpoint snapshot

2. `Audit trail`
   - shows stable, human-readable execution history
   - includes lifecycle, checkpoint, approval, resume, and terminal events
   - is queryable and replay-friendly, not just live logs

3. `Resume action`
   - appears when a run is interrupted but resumable
   - restarts execution from the latest safe checkpoint
   - leaves already checkpointed completed work untouched

Replay in M6 means reconstructing and inspecting durable history from checkpoints plus audit events. It does not mean full time-travel debugging or arbitrary state rewinds.

## Architecture summary

M6 adds four domain areas:

1. `Checkpoint contracts and store abstraction`
2. `Checkpoint and audit persistence`
3. `Execution capture and resume logic`
4. `Replay and audit APIs plus UI`

## Checkpoint model

### Checkpoint record

A checkpoint should have:

- immutable id
- run, outcome, and workspace identity
- monotonically increasing sequence
- checkpoint kind
- resumable flag
- store location
- checksum and payload size
- optional step context
- created-at timestamp

Recommended checkpoint kinds:

- `run_started`
- `step_completed`
- `step_blocked_on_approval`
- `approval_resolved`
- `run_completed`
- `run_failed`

Only safe boundaries become checkpoints. If a process dies in the middle of a step, the run resumes from the previous safe checkpoint and the interrupted in-flight step is requeued from that durable state.

### Checkpoint payload

The stored payload should be a versioned manifest, not an opaque blob. It should include:

- run summary
- step summaries and statuses
- ready-step ids
- blocked-step ids
- workspace paths
- artifact ids known at the checkpoint
- latest audit sequence covered by the checkpoint

The payload is intentionally semantic. It is not a raw container snapshot.

### `CheckpointStore`

M6 should add a package-level abstraction such as:

- `writeCheckpoint(...)`
- `readCheckpoint(...)`
- `deleteCheckpoint(...)` if needed for cleanup

The store returns durable metadata such as:

- store key or location
- checksum
- byte size

Only the local filesystem backend is implemented in M6. M7 adds a remote backend behind the same interface.

### Local backend

The M6 local backend should write versioned JSON checkpoint manifests under a generated local runtime directory, for example:

- `apps/control-plane/.mycelium/checkpoints/<runId>/<sequence>-<checkpointId>.json`

The exact root should be env-configurable so local development and future hosted environments can choose different roots.

## Audit model

M6 should introduce a first-class audit ledger instead of treating the current `run_events` transport history as the source of truth.

### Why not reuse `run_events` directly

`run_events` is currently optimized for:

- SSE fan-out
- UI hydration
- transport payloads

It is not yet a stable replay model.

M6 should keep `run_events` as the live transport/event stream and add a dedicated audit ledger for:

- stable event categories
- operator-facing summaries
- deterministic replay ordering
- checkpoint linkage

### Audit event shape

Each audit event should include:

- run id
- outcome id
- optional step id
- optional checkpoint id
- category
- event type
- actor type such as `system` or `operator`
- short summary
- structured payload
- created-at timestamp

Useful categories:

- `lifecycle`
- `checkpoint`
- `approval`
- `resume`
- `artifact`

## Resume model

### Interrupted runs

M6 should introduce an explicit interrupted or resumable state instead of pretending a crashed run is still healthy.

On startup or recovery scan:

- find non-terminal runs with no in-flight worker and a latest resumable checkpoint
- mark them as interrupted or resumable
- append an audit event explaining the interruption

### Resume algorithm

Resume should:

1. load the latest resumable checkpoint payload
2. restore step statuses from that checkpoint snapshot
3. requeue any ready work from the checkpoint snapshot
4. restart execution through the normal scheduler path

Completed steps from the checkpoint must remain completed. Only unfinished work should move forward.

### Approval interaction

Blocked-on-approval runs do not become interrupted just because they are waiting for humans. Approval remains the control path for that state. Checkpoints should still capture the blocked boundary so replay can explain why the run paused.

## Replay model

Replay in M6 is an inspection surface built from:

- checkpoint list
- selected checkpoint detail
- audit trail before and after the selected checkpoint

The operator should be able to answer:

- what had already happened at this checkpoint
- what was ready next
- whether the run later resumed, failed, or completed

That is enough for M6. It proves continuity and explanation without building debugger-grade tooling.

## API shape

M6 should add:

- `GET /api/runs/:runId/checkpoints`
- `GET /api/checkpoints/:checkpointId`
- `GET /api/runs/:runId/audit`
- `POST /api/runs/:runId/resume`

Checkpoint creation and interruption or resume events should also flow through the outcome SSE stream so the operator console updates live.

## UI shape

The outcome detail page remains the execution home.

Add:

- a checkpoint timeline panel
- an audit trail panel
- checkpoint detail view for the selected checkpoint
- a resume action when the selected run is resumable

Do not create a separate replay product area yet. Keep M6 scoped to the existing operator console.

## Ship gate for M6

Before calling M6 complete:

- interrupted runs can resume from a durable checkpoint on the current local stack
- replay surfaces can load checkpoint metadata and a selected checkpoint payload
- audit history explains checkpoint creation, interruption, approval boundaries, resume, and terminal outcome
- resume does not rerun steps already checkpointed as completed
- the local filesystem checkpoint backend stays behind a package interface that can accept a remote backend later
