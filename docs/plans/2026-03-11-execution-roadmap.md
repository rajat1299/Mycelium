# Execution Roadmap

> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), and the referenced learning notes before starting any milestone.

## Purpose

This file is the manager-level roadmap for taking Mycelium from the current Milestone 1 foundation slice into a usable open-source Perplexity Computer control plane.

It is not a replacement for milestone implementation plans.

Use it to answer:

- what should be built next
- why the order matters
- which reference repo to read for each subsystem
- what each milestone must deliver before the next one starts

## Required reading for all implementation agents

Read these before starting any milestone:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
6. [Cross-Project Learnings](/Users/rajattiwari/swarm/_codex_notes/cross-project-learnings.md)

Then read the repo-specific notes based on the milestone:

- `OpenClaw`: [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md), [openclaw-reduction-map.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-reduction-map.md)
- `Middleman`: [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
- `Terragon`: [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
- `Deer Flow`: use [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md) plus direct repo reading in `/Users/rajattiwari/swarm/deer-flow`

## Coordination model

- Milestone plans are execution specs.
- [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md) is the cross-milestone source of truth for what has been done.
- Agents should work on `codex/*` branches.
- `main` remains the reviewed integration branch.
- Each milestone should end with:
  - fresh verification
  - a project-log entry
  - updates to the active milestone plan’s progress/deviation section

## Roadmap principles

1. Build the product kernel before broad integrations.
2. Prefer durable domain objects over UI-first scaffolding.
3. Extract ideas from reference repos, not wholesale architecture.
4. Keep the control plane authoritative and the UI thin.
5. Make manual, scheduled, and triggered work converge on one execution pipeline.

## Milestone sequence

### M1 Foundation

Status: `Complete`

Delivered:

- monorepo baseline
- shared protocol package
- core DB schema
- control-plane CRUD plus SSE
- web command center shell
- local dev workflow

Primary references:

- `Middleman`: protocol boundary and focused product shape
- `OpenClaw`: control-plane instincts
- `Terragon`: DB shape and execution lifecycle thinking

### M2 Orchestration Kernel

Status: `Complete`

Goal:

Build the durable execution domain:

- plan graph
- run state machine
- run-step persistence
- orchestrator package
- plan/run APIs
- plan/run UI surfaces

Primary references:

- `Middleman`: foreman decomposition, synthesis, manager-owned memory
- `Terragon`: thread/run lifecycle state machine and durable workflow object
- `OpenClaw`: authoritative control-plane request surface
- `Deer Flow`: event streaming and artifact/thread UX

Blocking dependencies:

- M1 complete

Ship gate:

- outcomes can generate a draft plan
- outcomes can create durable runs
- run and step states are persisted and streamed to the UI
- plan/run views exist in the operator console

### M3 Execution Substrate V1

Status: `Complete`

Goal:

Introduce the first real execution substrate so Mycelium can prove dependency-aware scheduling, parallel worker execution, and synthesis with a local Docker sandbox provider.

Primary references:

- `Terragon`: sandbox provider abstraction and daemon boundary
- `OpenClaw`: CLI runner, per-run workspace/bootstrap model
- `Middleman`: worker lifecycle and manager-worker coordination

Deliverables:

- `packages/sandbox` with a local Docker provider
- `packages/artifacts` with a local filesystem-backed artifact store
- workspace lease management
- scheduler-driven step claim/start/finish path
- realtime run logs and artifact events
- first end-to-end fork/join execution path

Ship gate:

- a queued run can execute a fork/join plan end-to-end
- independent ready steps run in parallel in isolated local containers
- step lifecycle transitions are durable
- artifacts can be attached to a run/step and shown in the UI

Completion notes:

- the local Docker provider, artifact store, and workspace lease model are integrated
- `POST /api/outcomes/:id/runs` now kicks off execution automatically
- the outcome detail page now shows timeline, persisted logs, and persisted artifacts for the selected run
- the end-to-end smoke path has been verified against the real local stack with Docker

### M4 Routing and BYO Keys

Status: `Complete`

Goal:

Make model/provider selection explicit, user-controlled, and durable.

Primary references:

- `OpenClaw`: model catalog, auth profiles, session model overrides
- `Terragon`: provider abstraction and environment handling
- `Middleman`: runtime-factory pattern

Deliverables:

- `packages/router`
- provider/model capability registry
- BYO key storage and validation model
- router policy CRUD
- persisted step route decisions
- operator settings surface for keys and routing
- cost/budget-aware routing groundwork

Ship gate:

- users can configure routing policy
- a workspace can store encrypted provider credentials and auth profiles
- a run/step can resolve to a provider/model selection through one path
- route decisions are visible in the operator console

Primary docs:

- [Milestone 4 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md)
- [Milestone 4 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-implementation.md)

Execution note:

- the M4 docs are finalized enough to start implementation windows from Task 1 without additional architecture work in advance

Completion notes:

- `packages/router`, routing contracts, and persisted step-route fields are integrated
- workspaces can store encrypted provider credentials, create auth profiles, save router policy, and preview route resolution from the settings surface
- run creation persists route metadata on steps while execution remains on the M3 local Docker path
- the local smoke path is verified against the running stack, including settings load, credential/profile creation, route preview, route badges on run steps, and completed execution on the existing draft-plan runtime

### M5 Review Queue and Artifact Lineage

Status: `Planned`

Goal:

Make human review, approvals, and artifacts first-class product objects.

Primary references:

- `OpenClaw`: exec approvals and operator-console patterns
- `Terragon`: post-run lifecycle and artifact persistence instincts
- `Deer Flow`: artifact handling and streamed task visibility

Deliverables:

- review queue object model
- approval request and resolution flow
- artifact lineage metadata
- operator console review surface

Ship gate:

- side-effecting steps can block on approval
- the UI exposes what needs human action

### M6 Checkpoints, Replay, and Audit

Status: `Planned`

Goal:

Make long-running work resumable, replayable, and explainable.

Primary references:

- `Terragon`: checkpoint thread and durable post-run pipeline
- `Deer Flow`: checkpointer abstraction and resumability
- `OpenClaw`: session continuity and cleanup rigor

Deliverables:

- checkpoint persistence
- run replay surface
- audit log/event history model
- resumable execution boundaries

Ship gate:

- interrupted work can resume from a durable checkpoint
- operators can inspect a run history after the fact

### M7 Remote Sandbox and Worker Daemon

Status: `Planned`

Goal:

Move from local execution substrate to real remote, isolated worker environments.

Primary references:

- `Terragon`: daemon-in-sandbox model and sandbox lifecycle
- `OpenClaw`: runtime registry and long-lived session coherence

Deliverables:

- remote sandbox provider abstraction
- worker daemon protocol
- remote artifact sync
- sandbox lifecycle management

Ship gate:

- a run can execute on a remote isolated worker with durable coordination

### M8 Schedules, Messaging, and Local Companion

Status: `Planned`

Goal:

Add additional ingress and deferred execution once the kernel is stable.

Primary references:

- `Middleman`: cron reusing the main execution path
- `OpenClaw`: cron and isolated-agent runs, messaging adapter patterns
- `Terragon`: automation trigger validation

Deliverables:

- scheduled runs enter the normal execution pipeline
- messaging ingress can create or continue work
- local companion design can begin without owning the core

Ship gate:

- scheduled and external-triggered work does not fork the core execution model

## Extraction matrix by subsystem

| Subsystem | Primary reference | Secondary reference | Notes |
| --- | --- | --- | --- |
| Control-plane API | OpenClaw | Middleman | Keep one authoritative request surface |
| Foreman decomposition | Middleman | Deer Flow | Use manager semantics, not LangGraph as core |
| Run lifecycle state | Terragon | Deer Flow | Prefer explicit state transitions |
| Session continuity | OpenClaw | Terragon | Preserve identity, overrides, and cleanup rigor |
| Sandbox abstraction | Terragon | OpenClaw | Keep execution behind one provider boundary |
| Skills/workspace context | OpenClaw | Middleman | Runtime context should be durable and explicit |
| Realtime fanout | Deer Flow | OpenClaw | Stream execution state, not just messages |
| Scheduling | Middleman | OpenClaw | Scheduled work must enter the same core path |

## What not to do

- do not fork one reference repo and mutate it into Mycelium
- do not add messaging/channel breadth before the kernel is stable
- do not hide lifecycle in prompts instead of state
- do not let the web app become the orchestration core
- do not commit real secrets in tracked files
