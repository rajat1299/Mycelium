# Milestone 3 Execution Substrate Design

## Purpose

Milestone 3 exists to prove that Mycelium's orchestration kernel can execute real work, not just persist plans and runs.

The thing we need to prove is:

- the foreman produces an executable dependency graph
- the scheduler releases work when dependencies clear
- independent steps run in parallel without stepping on each other
- outputs are persisted as artifacts
- synthesis can consume prior step outputs and complete the outcome

The execution substrate only needs to be good enough to prove that loop with realistic isolation.

## Approved direction

Approved on `2026-03-12`:

- use a `local Docker sandbox provider` for M3
- keep the provider interface compatible with future remote sandboxes
- do not build daemon protocols, remote control planes, or hosted infra in this milestone

This keeps M3 focused on orchestration proof instead of infra sprawl.

## Options considered

### Option 1: In-process local executor

Pros:

- fastest implementation path
- easiest unit tests
- minimal Docker coupling

Cons:

- weak isolation
- parallel runs can share accidental process state
- does not exercise the abstraction we eventually need

Rejected because it proves too little.

### Option 2: Local Docker sandbox provider

Pros:

- real process isolation
- realistic mounted workspaces and artifact directories
- container lifecycle maps cleanly to future remote sandboxes
- good enough to test parallel execution honestly

Cons:

- more setup than in-process execution
- requires Docker availability for smoke validation

Approved because it is the best balance between realism and speed.

### Option 3: Remote sandbox and worker daemon now

Pros:

- closest to the long-term architecture
- avoids redesigning the worker protocol later

Cons:

- too much infrastructure for the next proof point
- slows feedback loops
- entangles M3 with M7 concerns

Rejected as premature.

## M3 scope

### In scope

- executable plan-node metadata
- deterministic fork/join planner output
- dependency-aware run scheduler
- local Docker sandbox provider
- workspace lease management
- filesystem-backed artifact store
- durable run updates, step updates, run logs, and artifacts
- control-plane execution service that drives queued runs to completion
- operator-console surfaces for run progress and artifacts

### Out of scope

- remote sandbox daemon protocol
- BYO-key model routing
- provider/model selection
- approval queue expansion
- schedules
- messaging adapters
- local companion execution

## Orchestration proof shape

M3 should move from the current linear three-node demo to a deterministic fork/join plan:

1. `Analyze outcome`
2. `Draft brief`
3. `Draft operator summary`
4. `Synthesize result`

Dependencies:

- `Analyze outcome -> Draft brief`
- `Analyze outcome -> Draft operator summary`
- `Draft brief -> Synthesize result`
- `Draft operator summary -> Synthesize result`

That gives us:

- one upstream planning node
- two independent worker nodes that can run in parallel
- one synthesis node that proves join behavior

The planner can remain deterministic in M3. The milestone is about execution semantics, not fancy decomposition quality.

## Execution model

### Plan nodes become executable

Plan nodes need more than titles and capabilities. Each node should carry enough information for the control plane to hand it to a worker without inventing behavior at runtime.

For M3, keep this intentionally narrow:

- `instruction`
- `template`
- `expectedArtifactPath`
- `expectedArtifactKind`

Use template-driven work, not open-ended provider routing. The local Docker provider will know how to execute a small set of internal templates.

Suggested templates:

- `analyze_outcome`
- `draft_brief`
- `draft_operator_summary`
- `synthesize_result`

## Sandbox model

### One container per step

Each runnable step gets one ephemeral container.

The container receives:

- a mounted workspace directory
- a mounted artifacts directory
- structured environment variables describing the outcome, run, and step

The container writes outputs to known paths. The control plane persists metadata for those outputs after the container exits.

### No daemon in M3

Do not add a long-lived worker daemon yet.

Reasons:

- one-container-per-step is enough to prove scheduling semantics
- logs can be streamed from the Docker process directly
- failure handling is simpler
- the provider boundary still stays compatible with a future remote daemon

## Workspace and lease model

Each run gets an isolated local workspace root.

Inside that root:

- `input/`
- `artifacts/`
- `logs/`
- optional `repo/` later

The control plane should acquire one workspace lease per run before execution starts and release it when the run reaches a terminal state.

M3 only needs local filesystem leases plus deterministic path allocation. We do not need full git worktree automation yet.

## Artifact model

M3 should introduce the first real artifact path:

- artifact bytes live in a local filesystem store
- artifact metadata lives in Postgres
- artifacts can be scoped to `outcome`, `run`, and `step`

At minimum, persist:

- artifact id
- outcome id
- run id
- step id
- kind
- relative path
- size or metadata blob

The control plane should emit `artifact.created` SSE events when metadata is persisted.

## Control-plane execution service

The control plane remains authoritative.

It should own:

- run status transitions
- ready-step discovery
- step claiming
- sandbox dispatch
- log fanout
- artifact persistence
- dependency release after completion
- synthesis completion
- outcome status updates

This should live as an internal service object, not inside route handlers.

Route handlers should only:

- create runs
- kick execution
- read state

## Event model additions

M3 should add these event paths to the working stream:

- `run.updated`
- `run.log`
- `artifact.created`

Existing events remain:

- `outcome.updated`
- `run.created`
- `run.step.updated`

This gives the operator console enough information to show a live execution picture without inventing client-side state.

## Test strategy

### Unit level

- scheduler releases only dependency-free steps
- completing one branch does not unlock the synthesis node too early
- completing both parallel branches unlocks synthesis
- local workspace lease allocation is deterministic and isolated
- artifact store prevents path traversal

### Control-plane integration

- creating a run triggers execution service kickoff
- two sibling steps execute in parallel through a fake sandbox provider
- run logs and artifact events are persisted and streamed
- outcome status advances to `queued`, `running`, then `completed`

### Manual smoke

With Docker running locally:

- create outcome
- generate plan
- start run
- watch two parallel steps complete
- confirm synthesis artifact exists
- confirm UI shows completed run and artifacts

## Reference extraction priorities

### `Terragon`

Use for:

- provider abstraction shape
- sandbox lifecycle boundaries
- daemon separation instincts
- artifact and run lifecycle thinking

Read:

- `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/provider.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/sandbox.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/sandbox/src/daemon.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/types/src/sandbox.ts`

### `OpenClaw`

Use for:

- sandbox image and environment setup instincts
- workspace bootstrap pragmatism

Read:

- `/Users/rajattiwari/swarm/openclaw/Dockerfile.sandbox`
- `/Users/rajattiwari/swarm/openclaw/Dockerfile.sandbox-common`
- `/Users/rajattiwari/swarm/openclaw/scripts/sandbox-setup.sh`
- `/Users/rajattiwari/swarm/openclaw/scripts/sandbox-common-setup.sh`

### `Middleman`

Use for:

- foreman orchestration mindset
- manager-owned synthesis
- worker isolation expectations

Read:

- `/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md`
- `/Users/rajattiwari/swarm/middleman/docs/manager-isolation.md`
- `/Users/rajattiwari/swarm/middleman/docs/plans/per-manager-integrations.md`

### `Deer Flow`

Use for:

- task streaming UX
- local sandbox structure
- artifact surfacing

Read:

- `/Users/rajattiwari/swarm/deer-flow/backend/src/tools/builtins/task_tool.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/subagents/executor.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/sandbox/local/local_sandbox_provider.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/gateway/routers/artifacts.py`

## Exit condition

M3 is done when a run created from the deterministic fork/join plan executes end-to-end in local Docker sandboxes, produces artifacts, streams progress to the UI, and completes the outcome without any manual state patching.
