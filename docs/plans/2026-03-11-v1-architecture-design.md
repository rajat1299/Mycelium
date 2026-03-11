# V1 Architecture Design

Date: `2026-03-11`

## Decision

Build a new TypeScript monorepo control plane and extract proven engineering patterns from the four reference projects instead of forking any single one.

## Locked v1 shape

- self-hosted single workspace
- hybrid edge plus cloud
- web command center plus Slack and Telegram adapters
- browser, files, terminal, APIs, and document generation
- interactive, background, and scheduled runs
- policy-driven BYO-key router
- approval-gated side effects
- independent worker runtimes as the core execution model

## Product kernel

- `apps/web`
- `apps/control-plane`
- `apps/local-companion`
- `packages/protocol`
- `packages/orchestrator`
- `packages/router`
- `packages/sandbox`
- `packages/worker-daemon`
- `packages/messaging`
- `packages/artifacts`
- `packages/db`

## Runtime model

First-class entities:

- `Workspace`
- `User`
- `Outcome`
- `OutcomeMessage`
- `PlanNode`
- `PlanEdge`
- `Run`
- `WorkerSession`
- `Artifact`
- `Approval`
- `Schedule`
- `RouterPolicy`
- `MemoryRecord`

## Reference mapping

- `OpenClaw` for control-plane surfaces, sessions, skills, memory, approvals, messaging patterns
- `Middleman` for foreman-worker decomposition, escalation, and synthesis
- `Terragon` for sandbox lifecycle, daemon model, state machines, checkpoints
- `Deer Flow` for artifact UX, checkpointers, subtask streaming, clarification interrupts

## Gaps we will build ourselves

- dependency-aware plan graph execution
- provider routing policy engine
- BYO-key budget ledger
- artifact lineage graph
- workspace and branch lease management
- replay and audit model
- first-class human review queue

## Frontend decision

Use `Next.js + React + TypeScript` for the operator console.

Why:

- React matches existing team familiarity
- Next.js gives a stronger app shell for an operations product
- TypeScript is necessary for typed contracts across UI, API, and runtime state

Constraint:

The orchestration runtime stays in `apps/control-plane`, not inside Next.js.

## Immediate next step

Turn this design baseline into an implementation plan package-by-package, then start with the control plane skeleton, protocol contracts, and core outcome graph model.
