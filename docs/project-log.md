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

- Date: `2026-03-14`
- Default branch: `main`
- Current integrated runtime baseline: `Milestone 4 routing and BYO keys integrated on main`
- Completed milestone: `M4 Routing and BYO Keys`
- Active execution-ready milestone: `M5 Review Queue and Artifact Lineage`
- Current mode:
  - this chat window is review/planning/management space
  - implementation happens in separate Codex windows on `codex/*` branches

## Milestone ledger

| Milestone | Status | Summary | Primary docs |
| --- | --- | --- | --- |
| M1 Foundation | Complete | Monorepo bootstrap, typed protocol, DB package, control-plane API, SSE, Next.js command center, local dev workflow | [Milestone 1 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-1-foundation-implementation.md) |
| M2 Orchestration Kernel | Complete | Durable plan graph, run state machine, orchestration package, control-plane planning/run APIs, plan/run UI, and review-driven hardening of run recovery and selection behavior | [Milestone 2 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-2-orchestration-kernel-implementation.md) |
| M3 Execution Substrate V1 | Complete | Local Docker sandbox provider, dependency-aware execution service, artifact persistence, run logs, operator-console artifact/log surfaces, and a verified end-to-end fork/join execution path | [Milestone 3 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-implementation.md) |
| M4 Routing and BYO Keys | Complete | Static provider/model registry, encrypted credentials, auth profiles, router policy CRUD, deterministic route resolution, route preview, persisted step-route metadata, and operator settings surfaces verified against the local M3 execution path | [Milestone 4 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md), [Milestone 4 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-implementation.md) |
| M5 Review Queue and Artifact Lineage | Planned | First-class approvals, review queue, approval-aware execution blocking and resume, and durable artifact-lineage inspection | [Milestone 5 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-design.md), [Milestone 5 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-implementation.md) |
| Execution Roadmap | Active | Multi-milestone delivery order for future Codex agents | [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md) |

## Decision log

- `2026-03-11`: Use a separate project log plus milestone-local updates. Do not rely on inline edits to milestone plans as the only tracking mechanism.
- `2026-03-11`: Keep this chat window as review/planning/management space. Implementation agents should work in separate windows and hand off via docs plus commits.
- `2026-03-11`: Use placeholder env values in tracked files and keep real local secrets only in ignored env files.
- `2026-03-11`: Keep GitHub remote branches limited to `main`. Use local `codex/*` worktree branches for execution chunks, merge only verified work, and delete any temporary remote feature branches immediately after integration.
- `2026-03-12`: Lock Milestone 3 to a local Docker sandbox provider. M3 is for proving orchestration semantics with real isolation, not for building remote daemons or provider routing.
- `2026-03-13`: Keep local setup docs explicit that root-level `pnpm db:push` requires the root `.env` file to be exported first. Do not document bare `pnpm db:push` as a fresh-shell command until the script behavior changes.
- `2026-03-13`: Scope Milestone 4 to the routing and BYO-key control plane only. Persist deterministic provider/model/auth-profile decisions on steps, but keep the M3 local execution path as the runtime until a later milestone adds real provider-backed worker execution.
- `2026-03-13`: Treat workspace credentials as a first-class M4 object, separate from auth profiles. Credentials own encrypted secret material; auth profiles are the durable routing identity that policy and run steps point at.
- `2026-03-14`: Treat repeated route previews as deterministic when provider, model, auth profile, and status remain stable for a fixed policy version. `resolvedAt` is expected to change on each preview because it records a fresh resolution time.
- `2026-03-14`: Keep the local smoke docs explicit that the default M3 draft plan uses `reasoning` plus `document`. A fully resolved M4 run needs a `document` route candidate in addition to any `reasoning` and `coding` preview checks.
- `2026-03-14`: Lock Milestone 5 to the review queue and artifact-lineage slice. M5 should add approval-aware blocking and resume before checkpoints, schedules, messaging, or remote worker work.
- `2026-03-14`: Approval resolution must be transactional with run, step, and outcome updates, and artifact lineage should be persisted as first-class edge records rather than only loose artifact metadata.

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
- `2026-03-12` | `Codex` | `codex/m3-task1-executable-plans` | Applied review-driven hardening to Milestone 3 Task 1: aligned downstream control-plane expectations with the live fork/join planner, rejected duplicate plan-node IDs in graph validation, and made the scheduler ignore steps whose `planNodeId` is not present in the plan. | Re-verified with `pnpm test`, `pnpm typecheck`, and `pnpm build` in the worktree.
- `2026-03-12` | `Codex` | `codex/m3-task2-sandbox-artifacts` | Started Milestone 3 Task 2 in a fresh isolated worktree, reloaded the M3 implementation plan and sandbox/artifact references, and scoped the batch to local Docker sandbox and filesystem artifact primitives. | Baseline repo state was clean on `main` before the worktree was created; Task 2 begins with TDD for workspace leasing, artifact path safety, and Docker request translation.
- `2026-03-12` | `Codex` | `codex/m3-task2-sandbox-artifacts` | Completed Milestone 3 Task 2: added `packages/sandbox` with deterministic local workspace leasing plus an injectable local Docker provider, and added `packages/artifacts` with a filesystem-backed artifact store that rejects path traversal. | Verified with `pnpm --filter @computer-oss/sandbox test`, `pnpm --filter @computer-oss/sandbox typecheck`, `pnpm --filter @computer-oss/artifacts test`, and `pnpm --filter @computer-oss/artifacts typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task2-sandbox-artifacts` | Applied review-driven hardening to Milestone 3 Task 2: fixed the concurrent lease race, canonicalized artifact paths to a single identity, and constrained expected artifact outputs to the mounted `artifacts/` subtree. | Re-verified with targeted regression tests plus `pnpm --filter @computer-oss/sandbox test`, `pnpm --filter @computer-oss/sandbox typecheck`, `pnpm --filter @computer-oss/artifacts test`, and `pnpm --filter @computer-oss/artifacts typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task2-sandbox-artifacts` | Applied final Task 2 review hardening for environment safety: caller-supplied `MYCELIUM_*` variables are now filtered out so the provider’s reserved execution context cannot be overridden. | Re-verified with `pnpm --filter @computer-oss/sandbox test -- src/provider.test.ts`, `pnpm --filter @computer-oss/sandbox test`, and `pnpm --filter @computer-oss/sandbox typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task3-execution-persistence` | Started Milestone 3 Task 3 in a fresh isolated worktree from merged `main`, reloaded the persistence section of the M3 plan, and scoped the batch to DB schema plus repository primitives for execution, artifacts, and workspace leases. | Task 3 begins with repository-level TDD for durable run transitions, ready-step reads, artifact metadata storage, and workspace lease acquisition/release semantics.
- `2026-03-12` | `Codex` | `codex/m3-task3-execution-persistence` | Completed Milestone 3 Task 3: extended DB persistence for executable plan/run metadata, run status and dependency release, artifact metadata, and workspace leases, then wired the control-plane plan writer path to preserve executable node fields end-to-end. | Verified with `pnpm --filter @computer-oss/db test`, `pnpm --filter @computer-oss/db typecheck`, `pnpm --filter @computer-oss/control-plane test -- test/plans.test.ts`, `pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts`, and `pnpm --filter @computer-oss/control-plane typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task3-execution-persistence` | Applied review-driven hardening to Milestone 3 Task 3: guarded dependent-step release so concurrent sibling completions cannot re-release the same join step, and made workspace lease release idempotent so repeated cleanup preserves the original terminal timestamp. | Re-verified with targeted regression tests plus `pnpm --filter @computer-oss/db typecheck`, `pnpm --filter @computer-oss/control-plane test -- test/plans.test.ts`, `pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts`, and `pnpm --filter @computer-oss/control-plane typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task4-execution-service` | Started Milestone 3 Task 4 in a fresh isolated worktree from merged `main`, reloaded the execution-service section of the M3 plan and design, and scoped the batch to background run execution, artifact reads, and the expanded SSE lifecycle. | Task 4 begins with red control-plane tests for queued-to-completed execution, sibling parallelism, log/artifact fanout, and outcome status progression through a fake sandbox provider.
- `2026-03-12` | `Codex` | `codex/m3-task4-execution-service` | Completed Milestone 3 Task 4: added a control-plane execution service plus service container, run-scoped artifact reads, durable `run.updated` / `run.log` / `artifact.created` streaming, and the real server composition path for local Docker-backed execution. | Verified with targeted control-plane checks plus workspace `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- `2026-03-12` | `Codex` | `codex/m3-task4-execution-service` | Applied review hardening to Milestone 3 Task 4: durable workspace-lease acquire/release failures no longer leak the local runtime workspace or escape the background runner, and execution-service coverage now locks that behavior in. | Re-verified with `pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts`, `pnpm --filter @computer-oss/control-plane test`, `pnpm --filter @computer-oss/control-plane typecheck`, and sequential workspace `pnpm test`, `pnpm build`, `pnpm typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task4-execution-service` | Applied final Task 4 hardening for failure-path correctness: `waitForRun()` now preserves raw execution failures for callers, and run/outcome lifecycle transitions now flow through a single atomic repository path instead of split updates in the execution service. | Re-verified with `pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts`, `pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts`, and sequential workspace `pnpm test`, `pnpm build`, `pnpm typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task4-execution-service` | Applied final repository-integrity hardening for Task 4: atomic lifecycle updates now also verify that the target run belongs to the supplied outcome before any mutation, and the in-memory repository mirrors the same invariant for tests and future callers. | Re-verified with `pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts`, `pnpm --filter @computer-oss/control-plane test -- test/repositories.test.ts`, and sequential workspace `pnpm test`, `pnpm build`, `pnpm typecheck`.
- `2026-03-12` | `Codex` | `codex/m3-task5-operator-console` | Started Milestone 3 Task 5 in a fresh isolated worktree from merged `main`, reloaded the operator-console section of the M3 plan, and drove the UI slice with red tests for artifact loading, log streaming, and pinned run updates. | Baseline verified in the worktree with `pnpm install` and `pnpm test` before code changes.
- `2026-03-12` | `Codex` | `codex/m3-task5-operator-console` | Completed Milestone 3 Task 5: added run-scoped artifact and log panels, server-side artifact loading for the selected run, and live `run.updated` handling so the operator console stays aligned with persisted execution state. | Verified with `pnpm --filter @computer-oss/web test`, `pnpm --filter @computer-oss/web typecheck`, and `pnpm --filter @computer-oss/web build`.
- `2026-03-13` | `Codex` | `codex/m3-task5-operator-console` | Applied review-driven hardening to Task 5: the control plane now exposes persisted run logs, the outcome page bootstraps those logs server-side, and a shared execution-console client wrapper keeps run selection synchronized across timeline, artifact, and log panels. | Re-verified with targeted control-plane/web checks plus sequential workspace `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- `2026-03-13` | `Codex` | `codex/m3-task5-operator-console` | Applied final Task 5 efficiency hardening: outcome-panel subscribers now share a single `EventSource` connection per outcome through the web event transport layer instead of opening duplicate SSE sockets per panel. | Re-verified with new `events.ts` regression coverage plus fresh sequential workspace `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- `2026-03-13` | `Codex` | `codex/m3-task6-smoke-docs` | Completed Milestone 3 Task 6: ran the real local Docker smoke path, verified fork/join execution plus persisted logs and artifacts, fixed sandbox artifact discovery so each step only reports its own expected or newly created outputs, and updated the setup/runbook docs for the exported-env database bootstrap flow. | Verified with `pnpm --filter @computer-oss/sandbox test -- src/provider.test.ts`, `pnpm db:up`, `set -a; source .env; set +a; pnpm db:push`, `pnpm dev`, live health and UI/API smoke checks, and fresh sequential workspace `pnpm test`, `pnpm typecheck`, `pnpm build`.
- `2026-03-13` | `Codex` | `main` | Authored the Milestone 4 design and implementation plan for routing and BYO-key control-plane work, and updated the roadmap/runbook surfaces so future agents can start M4 from a single reviewed spec. | Planning update only. No runtime behavior changed.
- `2026-03-13` | `Codex` | `main` | Hardened the M4 execution spec: added exact reference-file mappings across OpenClaw, Terragon, Middleman, and Deer Flow; promoted workspace credentials to a first-class API and repository surface; and marked M4 as execution-ready in the shared docs. | Planning update only. No runtime behavior changed.
- `2026-03-13` | `Codex` | `codex/m4-task1-routing-contracts` | Started Milestone 4 Task 1 in a fresh global worktree, reloaded the M4 design/plan plus the updated runbook/project-log context, and scoped the first implementation batch to shared routing contracts and the standalone router package. | Baseline verified in the worktree with `pnpm install` and `pnpm test` before code changes.
- `2026-03-13` | `Codex` | `codex/m4-task1-routing-contracts` | Completed Milestone 4 Task 1: added shared routing/auth protocol contracts, additive persisted route fields on run steps, and a standalone `packages/router` with a static provider/model catalog, policy validation helpers, and deterministic route resolution with explicit unresolved diagnostics. | Verified with `pnpm --filter @computer-oss/protocol test`, `pnpm --filter @computer-oss/router test`, and `pnpm --filter @computer-oss/router typecheck`.
- `2026-03-13` | `Codex` | `codex/m4-task2-routing-persistence` | Completed Milestone 4 Task 2: added encrypted workspace-credential persistence, auth-profile persistence, router-policy repositories, durable step-route writes, and matching in-memory/FK parity coverage for the DB and control-plane test harnesses. | Verified with `pnpm --filter @computer-oss/db test`, `pnpm --filter @computer-oss/db typecheck`, `pnpm --filter @computer-oss/db build`, `pnpm --filter @computer-oss/control-plane test -- test/repositories-workspace-credentials.test.ts`, `pnpm --filter @computer-oss/control-plane test -- test/repositories-auth-profiles.test.ts`, `pnpm --filter @computer-oss/control-plane typecheck`, and `pnpm --filter @computer-oss/control-plane build`.
- `2026-03-14` | `Codex` | `main@16664db` | Completed Milestone 4 Tasks 3-5: added control-plane routing services and APIs, route preview workflows, settings surfaces for provider credentials and auth profiles, router-policy editing, and run-timeline route badges, then merged the reviewed batch to `main`. | Verified with targeted control-plane and web checks plus workspace `pnpm test`, `pnpm typecheck`, and `pnpm build` before merge.
- `2026-03-14` | `Codex` | `codex/m4-task6-docs-verification` | Completed Milestone 4 Task 6: updated the README, runbook, local-dev guide, roadmap, and milestone notes for the settings workflow and encryption setup, then ran the real local-stack smoke path through the shipped HTTP surface to verify route preview, persisted step routes, and M3-compatible run completion. | Verified with `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm db:up`, `set -a; source .env; set +a; pnpm db:push`, live `pnpm dev:control-plane` and `pnpm dev:web`, and HTTP smoke checks covering settings load, credential/profile create, router policy save, repeated preview resolution, outcome/run creation, run completion, and rendered route metadata.
- `2026-03-14` | `Codex` | `main` | Authored the Milestone 5 design and implementation plan for review queue and artifact lineage, and updated the roadmap, runbook, docs index, and project status so new implementation windows can start M5 directly from reviewed docs. | Planning update only. No runtime behavior changed.
- `2026-03-14` | `Codex` | `codex/m5-task1-approval-lineage-contracts` | Started Milestone 5 Task 1 in a fresh global worktree from `main`, reloaded the M5 design/plan plus the updated runbook/project-log context, noted the non-blocking docs-index path mismatch in the planning handoff, and scoped the batch to approval and artifact-lineage protocol contracts. | Baseline verified in the worktree with `pnpm install` and `pnpm test` before code changes.
