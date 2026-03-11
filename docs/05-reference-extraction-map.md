# Reference Extraction Map

## Extraction strategy

We are not merging four codebases. We are extracting the highest-leverage engineering patterns from each one and rebuilding the product core around our own domain model.

## OpenClaw

Best for:

- control-plane API and gateway instincts
- session and workspace management
- plugin and skills substrate
- approval surfaces
- messaging adapter patterns
- memory and operator-console ideas

Use selectively:

- ACP session management concepts
- model/auth profile ideas
- exec approvals
- workspace handling

Ignore for v1:

- the large messaging-channel surface area
- canvas-heavy UX
- mobile and voice shells
- assistant-shell product framing

## Middleman

Best for:

- manager-worker decomposition
- delegation from vague outcomes
- escalation and review loop
- synthesis of worker outputs
- typed runtime/protocol mindset

Use selectively:

- foreman logic
- manager-owned memory summaries
- worker result synthesis

Ignore for v1:

- file-backed persistence as the product core
- existing UI shell
- local-first assumptions where they fight the control plane

## Terragon

Best for:

- remote sandbox lifecycle
- daemon-in-sandbox execution
- explicit run and thread lifecycle state
- checkpoint/resume instincts
- git-native execution patterns

Use selectively:

- worker daemon model
- run lifecycle state transitions
- artifact and checkpoint persistence shape

Ignore for v1:

- billing/admin/SaaS surface
- app architecture as the control-plane blueprint

## Deer Flow

Best for:

- resumable checkpointer abstraction
- thread-scoped sandbox and artifact handling
- subtask event streaming UX
- clarification interrupts

Use selectively:

- checkpoint provider ideas
- artifact serving patterns
- live task streaming patterns

Ignore for v1:

- LangGraph as the core orchestration model
- conversational memory as a substitute for execution memory

## What none of them solve cleanly enough

- task graph and dependency scheduler
- policy-driven multi-provider routing
- BYO-key budget ledger
- artifact lineage graph
- branch and workspace lease management
- review queue as a core product object
- durable replay and audit model
