# Project Log

Use this as the canonical cross-milestone execution log.

## Why this file exists

Milestone plan docs should remain stable execution specs. They are not enough by themselves for cross-agent coordination because they do not provide:

- a project-wide status snapshot
- a chronological activity log
- a durable place for deviations and decisions that span milestones
- a single handoff surface for review-only sessions

## Tracking policy

Recommendation: use **both** a separate project log and milestone-local progress updates.

Use this file for:

- merged work summaries
- current project status
- architectural decisions
- blockers and risk changes
- branch or commit references
- handoff notes between agent sessions

Use the active milestone plan doc for:

- milestone-scoped progress notes
- task-level completion markers
- deviations from the original milestone spec
- verification notes for that milestone only

Rule of thumb:

- if the update matters across milestones, append it here
- if the update only matters to one milestone, keep it in that milestone doc

## How agents must update this file

Before handing work back for review, append:

1. one entry to the `Activity Log`
2. any new architecture or process change to the `Decision Log`
3. the milestone status in the `Milestone Ledger` if it changed

Do not rewrite older entries except to correct factual mistakes.

## Current snapshot

- Date: `2026-03-11`
- Default branch: `main`
- Current integrated runtime baseline: `85a56b2`
- Completed milestone: `M1 Foundation`
- Next planned milestone: `M2 Orchestration Kernel`
- Current mode:
  - this chat window is review/planning/management space
  - implementation happens in separate Codex windows on `codex/*` branches

## Milestone ledger

| Milestone | Status | Summary | Primary docs |
| --- | --- | --- | --- |
| M1 Foundation | Complete | Monorepo bootstrap, typed protocol, DB package, control-plane API, SSE, Next.js command center, local dev workflow | [Milestone 1 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-1-foundation-implementation.md) |
| M2 Orchestration Kernel | Planned | Durable plan graph, run state machine, orchestration package, control-plane planning/run APIs, plan/run UI | [Milestone 2 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-2-orchestration-kernel-implementation.md) |
| Execution Roadmap | Active | Multi-milestone delivery order for future Codex agents | [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md) |

## Decision log

- `2026-03-11`: Use a separate project log plus milestone-local updates. Do not rely on inline edits to milestone plans as the only tracking mechanism.
- `2026-03-11`: Keep this chat window as review/planning/management space. Implementation agents should work in separate windows and hand off via docs plus commits.
- `2026-03-11`: Use placeholder env values in tracked files and keep real local secrets only in ignored env files.

## Activity log

- `2026-03-11` | `Codex` | `main@85a56b2` | Completed Milestone 1 foundation, merged to `main`, added local-dev workflow, fixed smoke-path issues, and pushed origin/main. | Verified with `pnpm test`, `pnpm typecheck`, `pnpm build`, and the end-to-end smoke path before merge.
- `2026-03-11` | `Codex` | `main@85a56b2` | Removed committed DB password literals, added agent runbook, and pushed origin/main. | Verified with `pnpm test`, `pnpm typecheck`, `pnpm build`, `docker compose config`, and no active listeners on `3000`, `4000`, `54321`.
- `2026-03-11` | `Codex` | `main` | Added the project log, execution roadmap, and Milestone 2 implementation plan so future Codex agents can execute work from a shared manager-authored spec. | Review-only/planning update. No runtime behavior changed.
