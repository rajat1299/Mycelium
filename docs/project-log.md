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

- Date: `2026-03-12`
- Default branch: `main`
- Current integrated runtime baseline: `660ae61`
- Completed milestone: `M2 Orchestration Kernel`
- Next planned milestone: `M3 Execution Substrate V1`
- Current mode:
  - this chat window is review/planning/management space
  - implementation happens in separate Codex windows on `codex/*` branches

## Milestone ledger

| Milestone | Status | Summary | Primary docs |
| --- | --- | --- | --- |
| M1 Foundation | Complete | Monorepo bootstrap, typed protocol, DB package, control-plane API, SSE, Next.js command center, local dev workflow | [Milestone 1 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-1-foundation-implementation.md) |
| M2 Orchestration Kernel | Complete | Durable plan graph, run state machine, orchestration package, control-plane planning/run APIs, plan/run UI, and review-driven hardening of run recovery and selection behavior | [Milestone 2 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-2-orchestration-kernel-implementation.md) |
| M3 Execution Substrate V1 | Planned | Local Docker sandbox provider, dependency-aware execution service, artifact persistence, run logs, and the first end-to-end execution proof | [Milestone 3 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-implementation.md) |
| Execution Roadmap | Active | Multi-milestone delivery order for future Codex agents | [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md) |

## Decision log

- `2026-03-11`: Use a separate project log plus milestone-local updates. Do not rely on inline edits to milestone plans as the only tracking mechanism.
- `2026-03-11`: Keep this chat window as review/planning/management space. Implementation agents should work in separate windows and hand off via docs plus commits.
- `2026-03-11`: Use placeholder env values in tracked files and keep real local secrets only in ignored env files.
- `2026-03-11`: Keep GitHub remote branches limited to `main`. Use local `codex/*` worktree branches for execution chunks, merge only verified work, and delete any temporary remote feature branches immediately after integration.
- `2026-03-12`: Lock Milestone 3 to a local Docker sandbox provider. M3 is for proving orchestration semantics with real isolation, not for building remote daemons or provider routing.

## Activity log

- `2026-03-11` | `Codex` | `main@85a56b2` | Completed Milestone 1 foundation, merged to `main`, added local-dev workflow, fixed smoke-path issues, and pushed origin/main. | Verified with `pnpm test`, `pnpm typecheck`, `pnpm build`, and the end-to-end smoke path before merge.
- `2026-03-11` | `Codex` | `main@85a56b2` | Removed committed DB password literals, added agent runbook, and pushed origin/main. | Verified with `pnpm test`, `pnpm typecheck`, `pnpm build`, `docker compose config`, and no active listeners on `3000`, `4000`, `54321`.
- `2026-03-11` | `Codex` | `main` | Added the project log, execution roadmap, and Milestone 2 implementation plan so future Codex agents can execute work from a shared manager-authored spec. | Review-only/planning update. No runtime behavior changed.
- `2026-03-11` | `Codex` | `codex/m2-orchestration-kernel` | Started Milestone 2 execution in an isolated global worktree and began the first implementation batch for orchestration contracts, plan/run persistence, and deterministic draft planning. | Baseline verified in the worktree with `pnpm install` and `pnpm test` before code changes.
- `2026-03-11` | `Codex` | `codex/m2-orchestration-kernel` | Completed the first Milestone 2 implementation batch: added `packages/orchestrator`, added durable plan/run tables and repositories, and implemented deterministic draft-plan generation. | Verified with package-level TDD checks plus workspace `pnpm test`, `pnpm typecheck`, `pnpm build`, and a lockfile refresh via `pnpm install`.
- `2026-03-11` | `Codex` | `codex/m2-orchestration-kernel` | Applied review-driven fixes to Milestone 2 batch 1: namespaced planner node/edge ids, added graph cycle rejection, wrapped plan/run creation in transactions, and enforced one-plan-per-outcome explicitly. | Re-verified with targeted TDD checks plus workspace `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- `2026-03-11` | `Codex` | `codex/m2-task4-api-ui` | Completed Milestone 2 Task 4 on a fresh local worktree branch: added typed plan/run protocol contracts, added control-plane plan/run routes, and expanded the outcome event stream with `plan.created`, `run.created`, and `run.step.updated`. | Verified with protocol and control-plane package tests, typechecks, builds, and a full workspace `pnpm test`, `pnpm typecheck`, `pnpm build`.
- `2026-03-11` | `Codex` | `codex/m2-task4-api-ui` | Completed Milestone 2 Task 5: added operator-console plan actions, draft-plan graph rendering, run timeline rendering, SSE-driven UI updates, and local Spell-inspired badge/button/spinner primitives for the orchestration panels. | Verified with new web component tests plus a full workspace `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- `2026-03-11` | `Codex` | `codex/m2-task4-api-ui` | Updated the README, local-dev guide, milestone notes, and project log for the plan/run workflow. | Final workspace verification passed. Docker smoke execution was not run here because the Docker daemon was unavailable in the execution environment.
- `2026-03-12` | `Codex` | `main@660ae61` | Completed Milestone 2 and closed the review cycle by fixing run recovery, pinned run selection, outcome status sync, and advisory `runId` handling in the outcome detail page. | Verified on merged `main` with `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- `2026-03-12` | `Codex` | `main@660ae61` | Authored the Milestone 3 execution substrate design and manager-level implementation plan, and updated roadmap and status docs to make M3 the next execution target. | Review/planning update only. No runtime behavior changed.
- `2026-03-12` | `Codex` | `codex/m3-task1-executable-plans` | Started Milestone 3 execution in an isolated global worktree, completed the required reading for M3, reviewed Task 1 against the current M2 code, and prepared to begin the executable plan and scheduler batch with TDD. | Baseline verified in the worktree with `pnpm install` and `pnpm test` before code changes.
- `2026-03-12` | `Codex` | `codex/m3-task1-executable-plans` | Completed Milestone 3 Task 1: added executable plan-node metadata, replaced the linear draft planner with a deterministic fork/join graph, and added pure scheduler helpers for ready-step discovery, dependency release, and terminal-run detection. | Verified with `pnpm --filter @computer-oss/protocol test`, `pnpm --filter @computer-oss/orchestrator test`, and `pnpm --filter @computer-oss/orchestrator typecheck`.
