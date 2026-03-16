# Milestone 7 Remote Workers and Daemon Design

## Purpose

Milestone 7 exists to prove that Mycelium's orchestration layer works on real remote workers without changing the control-plane durability model that Milestones 3 through 6 already verified.

Status: `Execution-ready planning complete on 2026-03-16.`

Milestones 1 through 6 proved:

- durable outcomes, plans, runs, steps, approvals, artifact lineage, checkpoints, and audit history
- dependency-aware fork/join scheduling on the local Docker substrate
- deterministic routing and persisted route decisions
- review-aware blocking and resume
- interruption recovery and replay on the control-plane-hosted checkpoint model

What the product still does not prove is remote execution:

- a worker daemon can connect in from a remote host and be treated as a first-class execution target
- the control plane can assign work to that worker and keep authoritative run state
- logs, artifacts, and checkpoint payloads can flow back from the remote worker into the existing durability surfaces
- worker disconnects and control-plane restarts can recover without inventing a second durability model in the same milestone

M7 is the milestone that turns "Mycelium works on the local stack" into "Mycelium can execute the same run model on a real remote daemon-backed worker."

## Approved direction

Approved on `2026-03-16`:

- ship `remote execution only` in M7
- keep the control plane authoritative for run state, approvals, artifacts, audit history, and checkpoint durability
- keep `CheckpointStore` backend-compatible, but continue shipping only the local filesystem backend in M7
- add a remote worker daemon protocol and remote sandbox provider behind the existing orchestration boundary
- have worker daemons push logs, artifacts, and checkpoint payloads back to the control plane instead of introducing a remote checkpoint backend in the same milestone
- defer remote durability backends for checkpoints and artifacts to the next milestone

This follows the same pattern already used in Mycelium:

- `packages/sandbox`: local Docker provider first, remote provider later
- artifact storage: local filesystem first, remote blob store later
- `CheckpointStore`: local filesystem backend first, remote backend later

M7 should extend the runtime model, not replace it.

## Options considered

### Option 1: Remote execution only, with control-plane-hosted durability

Pros:

- isolates the hard new problem to daemon-backed remote execution
- keeps artifact and checkpoint durability on already-proven control-plane surfaces
- makes M7 debugging narrower and easier
- matches the delivery pattern that has worked across M3 through M6

Cons:

- remote workers still depend on the control plane as the durability authority
- remote checkpoint/blob backends remain future work

Approved because it proves the core product risk without coupling it to a second storage migration.

### Option 2: Remote execution plus remote durability in the same milestone

Pros:

- closer to the long-term end state
- avoids one later backend addition

Cons:

- mixes protocol, worker lifecycle, and storage-backend risk in one milestone
- makes resume and replay failures harder to localize
- slows the proof that daemon-backed remote execution works at all

Rejected because it is too much scope for one milestone.

### Option 3: Stay local-only longer and defer remote workers entirely

Pros:

- smallest incremental engineering step
- no new daemon or connection model

Cons:

- delays proving the most novel infrastructure step after M6
- leaves Mycelium looking like a local-only orchestration demo

Rejected because M7 should be the milestone that proves real remote execution.

## M7 scope

### In scope

- remote worker and daemon protocol contracts
- worker registration, heartbeat, and authenticated connection handling
- remote sandbox provider support behind the existing execution boundary
- run-to-worker assignment and lease tracking
- remote step execution with logs, artifacts, and checkpoint payloads uploaded back to the control plane
- remote-worker-aware interruption and reconnect handling
- operator-visible worker assignment and remote execution state
- local-stack plus remote-worker smoke verification

### Out of scope

- remote checkpoint storage backends
- remote artifact blob backends
- arbitrary multi-cluster scheduling policy
- messaging, cron, or local companion work
- provider-backed model execution changes beyond the worker substrate
- browser/ffmpeg-equipped worker specialization

## Design principles

1. The control plane remains the source of truth for durable state in M7.
2. Worker daemons connect outbound to the control plane; the control plane does not open inbound sockets into workers.
3. Remote execution must sit behind the same orchestration and sandbox abstractions that local execution already uses.
4. A step is not durably complete until its logs, artifacts, and checkpoint effects are committed through the control plane.
5. Worker disconnect and resume semantics must reuse the M6 checkpoint model instead of inventing a second replay path.

## Primary product proof for M7

By the end of M7, an operator should be able to:

1. start the control plane locally
2. start a remote worker daemon on another reachable host or sandbox
3. see that worker register as available
4. start a real run that executes on the remote worker instead of the local Docker provider
5. observe step logs, artifact creation, checkpoint creation, and final review behavior through the existing control-plane surfaces
6. interrupt either the worker connection or the control plane and recover via the already-shipped checkpoint model without losing durable history

If that works, Mycelium has its first real remote execution substrate.

## Remote execution model

M7 keeps the existing control-plane ownership model:

- the planner, scheduler, review queue, checkpoint indexes, audit history, and artifact metadata stay in the control plane
- the worker daemon owns only ephemeral execution and workspace-local process management
- the daemon reports step logs, produced artifacts, and checkpoint payload manifests back to the control plane
- the control plane writes those artifacts and checkpoints through the existing persistence layers and only then advances durable run state

This means remote workers are replaceable execution hosts, not alternate sources of truth.

## Connection model

M7 uses `daemon connects to gateway`:

- the worker daemon opens an outbound authenticated connection to the control plane
- the control plane keeps a worker registry and dispatches work over that live session
- the daemon reconnects if the connection drops
- local development can use a tunnel when the control plane is not directly reachable from the worker host

This is the right shape for:

- NAT/firewall-friendly remote hosts
- a future serverless or edge-exposed control plane
- keeping worker machines off the public internet

## Worker lifecycle summary

M7 introduces four runtime layers:

1. `Worker registry`
   - tracks connected worker daemons, health, capabilities, and lease availability

2. `Remote provider`
   - makes a connected worker look like a normal sandbox execution target to the control plane

3. `Run assignment`
   - binds a run or step attempt to a worker session explicitly and durably

4. `Upload-back durability`
   - logs, artifacts, and checkpoint payloads are shipped back to the control plane before durable transitions are committed

The remote worker does not become the durability owner in M7.

## Ship gate for M7

Before calling M7 complete:

- a real run executes end to end on a remote daemon-backed worker
- the run still uses the M4 routing layer, M5 approval loop, and M6 checkpoint or audit surfaces
- step logs, artifacts, and checkpoint payloads are durably visible from the control plane
- a worker disconnect or control-plane restart does not erase durable run history
- already checkpointed completed work does not rerun after resume

## Reference extraction map for M7

Use only the verified current files below. Do not replace them with guessed filenames.

### Terragon

Read:

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

Extract:

- outbound daemon-to-gateway connection shape
- daemon install, restart, ping, and update lifecycle
- gateway-side event ingestion and normalization
- worker-bound sandbox provider boundaries

Do not inherit:

- hosted platform assumptions
- Terragon-specific thread or chat product framing

### OpenClaw

Read:

- `/Users/rajattiwari/swarm/openclaw/src/acp/runtime/registry.ts`
- `/Users/rajattiwari/swarm/openclaw/src/acp/control-plane/manager.core.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-runtime-state.ts`
- `/Users/rajattiwari/swarm/openclaw/src/commands/daemon-runtime.ts`
- `/Users/rajattiwari/swarm/openclaw/src/commands/node-daemon-runtime.ts`
- `/Users/rajattiwari/swarm/openclaw/src/commands/agent/session-store.ts`
- `/Users/rajattiwari/swarm/openclaw/src/commands/sessions-cleanup.ts`
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)

Extract:

- runtime backend registry shape
- long-lived session manager discipline
- session store and cleanup rigor
- explicit runtime-state ownership in the gateway

Do not inherit:

- chat-assistant-first product framing
- OpenClaw-specific plugin and channel assumptions

### Middleman

Read:

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-factory.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/agent-runtime.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
- `/Users/rajattiwari/swarm/middleman/packages/protocol/src/server-events.ts`
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

Extract:

- runtime construction boundaries
- manager-owned session lifecycle
- typed streaming event discipline
- explicit status and pending-work tracking

Do not inherit:

- manager/worker prompt semantics as the orchestration core
- file-backed state as the durability source of truth

### Deer Flow

Read:

- `/Users/rajattiwari/swarm/deer-flow/backend/src/subagents/executor.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/tools/builtins/task_tool.py`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/threads/hooks.ts`

Extract:

- long-running background execution and status transitions
- streamed task-progress updates for delegated work
- reconnect and resume instincts in the operator-facing stream layer

Do not inherit:

- LangGraph-centric execution ownership
- thread-centric UX assumptions

## Architecture summary

M7 should leave Mycelium with one clear shape:

- orchestration stays in the control plane
- remote workers are execution hosts connected through an authenticated daemon session
- `packages/sandbox` remains the execution boundary
- checkpoints and artifacts stay durably anchored to current control-plane stores
- a future milestone can add remote durability backends without rewriting orchestration, replay, or audit
