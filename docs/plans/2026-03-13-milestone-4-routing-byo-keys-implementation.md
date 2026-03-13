# Milestone 4 Routing and BYO Keys Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md), and [Milestone 4 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md) before touching code.

**Goal:** Introduce Mycelium's explicit routing and BYO-key control plane by adding a static provider/model registry, encrypted credential storage, auth profiles, router policy CRUD, deterministic route resolution, and operator-console settings and route visibility.

**Architecture:** Keep the control plane authoritative. M4 adds a routing domain and encrypted credential model, but it does **not** switch worker execution to real external providers yet. Route decisions become durable control-plane state and are displayed in the product while the M3 local sandbox execution path remains intact.

**Tech Stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`, Node `crypto`

---

## Required reading for this milestone

Read these first:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Technical Spec](/Users/rajattiwari/swarm/computer-oss/docs/04-technical-spec.md)
6. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
7. [Milestone 4 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md)

Then read milestone-specific references:

- `OpenClaw`
  - [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
  - [openclaw-reduction-map.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-reduction-map.md)
  - focus on model catalog, model selection, auth profiles, and model overrides
- `Terragon`
  - [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
  - focus on shared schema, environments, and provider abstraction boundaries
- `Middleman`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
  - focus on runtime-factory and explicit manager-owned policy decisions
- `Deer Flow`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/config/model_config.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/thread_state.py`
  - `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`
  - use only as a secondary reference for compact model metadata and inspectable UI state

## Non-negotiable invariants for M4

Before touching code, lock these in:

- plaintext provider secrets must never be stored, logged, or returned after submission
- all credential, auth-profile, policy, and step-route ownership is workspace-scoped
- provider, model, and auth profile must stay provider-consistent
- route resolution must be deterministic and produce explicit unresolved diagnostics
- M3 local execution must remain functional even when route resolution is unresolved

## Reference extraction checklist by task

Use these source files directly instead of rereading whole repos.

### Task 1

- `/Users/rajattiwari/swarm/openclaw/src/agents/models-config.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/models-config.providers.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/provider-capabilities.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-factory.ts`

### Task 2

- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/model/agent-provider-credentials.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/auth-profiles.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/pi-auth-credentials.ts`

### Task 3

- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/credentials.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-actions/credentials.ts`
- `/Users/rajattiwari/swarm/openclaw/src/channels/model-overrides.ts`

### Task 4

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-types.ts`

### Task 5

- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/thread_state.py`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`

## Progress update protocol

Before starting:

- create a fresh `codex/*` branch from `main`
- append a short entry to [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md) that M4 implementation has started

During implementation:

- add milestone-local notes under `Implementation Notes` at the bottom of this file
- keep only milestone-local deviations here

After each finished task:

- run the task-level verification commands
- request review in the execution window before moving to the next task

After milestone completion:

- append verification evidence here
- update [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
- update setup docs if env/config requirements changed

---

## Scope for this milestone

In scope:

- `packages/router`
- shared protocol schemas for providers, auth profiles, router policy, route preview, and persisted step routes
- encrypted workspace credential storage
- named auth profiles
- router policy persistence and validation
- deterministic route resolution
- persisted route decisions on run steps
- control-plane APIs for catalog, auth profiles, router policy, and route preview
- operator-console settings surface for keys and routing
- run timeline display of resolved route metadata

Out of scope:

- live provider-backed worker execution
- live provider API key verification
- dynamic vendor model sync
- spend metering and budget enforcement
- approvals, schedules, messaging, or local companion work

## Milestone acceptance criteria

Before calling M4 complete:

- encrypted provider credentials can be stored per workspace
- workspace credentials can be listed and managed without exposing plaintext
- auth profiles can be created, updated, listed, and deleted
- router policy can be read and updated through one API path and one web surface
- route preview returns deterministic resolved or unresolved diagnostics
- run steps persist route metadata or unresolved diagnostics durably
- the run timeline shows route badges or unresolved state
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

---

## Task 1: Add shared routing contracts and the router package

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Middleman`

**Files:**

- Create: `packages/router/package.json`
- Create: `packages/router/tsconfig.json`
- Create: `packages/router/src/index.ts`
- Create: `packages/router/src/catalog.ts`
- Create: `packages/router/src/policy.ts`
- Create: `packages/router/src/resolve.ts`
- Create: `packages/router/src/catalog.test.ts`
- Create: `packages/router/src/policy.test.ts`
- Create: `packages/router/src/resolve.test.ts`
- Create: `packages/protocol/src/router.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/plan.ts`
- Create: `packages/protocol/src/router.test.ts`

**Step 1: Write the failing tests**

Cover:

- provider/model catalog shape
- capability-family compatibility checks
- ordered policy candidates
- deterministic fallback resolution
- unresolved diagnostics for missing auth or invalid policy references
- persisted route fields on run steps

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test -- src/router.test.ts
pnpm --filter @computer-oss/router test
```

Expected:

- FAIL because `packages/router` and the shared router schemas do not exist yet

**Step 3: Implement the contracts**

Add shared schemas for:

- provider definition
- model definition
- workspace credential metadata
- auth profile
- router policy
- route candidate
- route preview request/response
- persisted step route metadata

Implement `packages/router` with:

- a static provider/model catalog
- policy validation helpers
- deterministic route resolution
- unresolved diagnostic reasons

Keep exact pricing out of scope. Use coarse metadata like `costClass` and `latencyClass`.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/router test
pnpm --filter @computer-oss/router typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol packages/router
git commit -m "feat: add routing contracts and router package"
```

---

## Task 2: Extend persistence for encrypted credentials, auth profiles, policy, and step routes

**Reference priority:**

- primary: `Terragon`
- secondary: `OpenClaw`

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/repositories/workspace-credentials.ts`
- Create: `packages/db/src/repositories/router-policy.ts`
- Create: `packages/db/src/repositories/auth-profiles.ts`
- Create: `packages/db/src/repositories/workspace-credentials.test.ts`
- Create: `packages/db/src/repositories/router-policy.test.ts`
- Modify: `packages/db/src/repositories/runs.ts`
- Create: `packages/db/src/repositories/auth-profiles.test.ts`
- Modify: `packages/db/src/repositories/runs.test.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`
- Create: `apps/control-plane/test/repositories-workspace-credentials.test.ts`
- Create: `apps/control-plane/test/repositories-auth-profiles.test.ts`

**Step 1: Write the failing repository tests**

Cover:

- creating and listing encrypted-credential metadata and auth profiles
- persisting router policy candidates in priority order
- rejecting cross-workspace or cross-provider references
- persisting route decisions on run steps
- preserving unresolved route diagnostics when no auth profile exists

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/workspace-credentials.test.ts
pnpm --filter @computer-oss/db test -- src/repositories/router-policy.test.ts
pnpm --filter @computer-oss/db test -- src/repositories/auth-profiles.test.ts
pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts
pnpm --filter @computer-oss/control-plane test -- test/repositories-workspace-credentials.test.ts
pnpm --filter @computer-oss/control-plane test -- test/repositories-auth-profiles.test.ts
```

Expected: FAIL because the schema and repositories do not exist yet.

**Step 3: Implement the schema and repositories**

Add tables for:

- `workspace_credentials`
- `auth_profiles`
- `router_policies`
- `router_policy_candidates`

Extend `run_steps` with:

- `routeProviderId`
- `routeModelId`
- `routeAuthProfileId`
- `routePolicyVersion`
- `routeStatus`
- `routeReason`
- `routeResolvedAt`

Implement repository support for:

- workspace-credential CRUD with metadata-only reads
- auth-profile CRUD
- policy read/write
- route metadata updates on steps
- in-memory repository parity with the DB behavior

Do not store plaintext secrets in the DB repository surface.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/db test
pnpm --filter @computer-oss/db typecheck
pnpm --filter @computer-oss/control-plane test -- test/repositories-workspace-credentials.test.ts
pnpm --filter @computer-oss/control-plane test -- test/repositories-auth-profiles.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db apps/control-plane/src/lib/repositories.ts apps/control-plane/test/repositories-auth-profiles.test.ts
git commit -m "feat: persist auth profiles and step route state"
```

---

## Task 3: Add encryption and control-plane routing services

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Terragon`

**Files:**

- Modify: `apps/control-plane/src/lib/env.ts`
- Create: `apps/control-plane/src/lib/encryption.ts`
- Create: `apps/control-plane/src/lib/router-service.ts`
- Modify: `apps/control-plane/src/lib/service-container.ts`
- Create: `apps/control-plane/src/routes/workspace-credentials.ts`
- Create: `apps/control-plane/src/routes/providers.ts`
- Create: `apps/control-plane/src/routes/auth-profiles.ts`
- Create: `apps/control-plane/src/routes/router.ts`
- Modify: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/test/workspace-credentials.test.ts`
- Create: `apps/control-plane/test/auth-profiles.test.ts`
- Create: `apps/control-plane/test/router.test.ts`

**Step 1: Write the failing control-plane tests**

Cover:

- reading the provider/model catalog
- creating and listing workspace credentials without returning plaintext
- creating and listing auth profiles
- rejecting credential writes when `MYCELIUM_ENCRYPTION_KEY` is missing
- reading and writing router policy
- previewing a resolved route
- previewing an unresolved route with useful diagnostics

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/workspace-credentials.test.ts
pnpm --filter @computer-oss/control-plane test -- test/auth-profiles.test.ts
pnpm --filter @computer-oss/control-plane test -- test/router.test.ts
```

Expected: FAIL because the services and routes do not exist yet.

**Step 3: Implement the services and routes**

`encryption.ts` should:

- encrypt secrets with AES-256-GCM
- decrypt secrets only on the server
- surface a clear error when the env key is missing or invalid

`router-service.ts` should:

- load catalog, policy, and auth profiles
- resolve route previews
- return structured unresolved reasons

Routes should expose:

- `GET /api/workspace-credentials`
- `POST /api/workspace-credentials`
- `PATCH /api/workspace-credentials/:id`
- `DELETE /api/workspace-credentials/:id`
- `GET /api/providers/models`
- `GET /api/auth-profiles`
- `POST /api/auth-profiles`
- `PATCH /api/auth-profiles/:id`
- `DELETE /api/auth-profiles/:id`
- `POST /api/auth-profiles/:id/validate`
- `GET /api/router/policy`
- `PUT /api/router/policy`
- `POST /api/router/resolve-preview`

For `validate`, do configuration validation only. Do not add live vendor calls.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/control-plane
git commit -m "feat: add routing and auth profile control-plane apis"
```

---

## Task 4: Resolve and persist step routes during run creation

**Reference priority:**

- primary: `Middleman`
- secondary: `OpenClaw`

**Files:**

- Modify: `apps/control-plane/src/routes/runs.ts`
- Modify: `apps/control-plane/src/lib/execution-service.ts`
- Modify: `packages/db/src/repositories/runs.ts`
- Modify: `packages/protocol/src/plan.ts`
- Modify: `apps/control-plane/test/runs.test.ts`
- Modify: `apps/control-plane/test/execution-service.test.ts`

**Step 1: Write the failing tests**

Cover:

- run creation persists step route metadata when policy resolves successfully
- run creation persists unresolved diagnostics when auth is missing
- M3 local execution path still completes when route metadata is unresolved
- run-detail responses include step route fields

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/runs.test.ts
pnpm --filter @computer-oss/control-plane test -- test/execution-service.test.ts
```

Expected: FAIL because runs do not persist route metadata yet.

**Step 3: Implement route persistence**

During run creation:

- inspect each step capability
- resolve the step route through `router-service`
- persist the route metadata on the step

Important:

- unresolved route state must be durable and explicit
- unresolved route state must not break the current local sandbox demo
- execution service should treat route metadata as informative in M4, not yet authoritative for runtime provider dispatch

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
pnpm --filter @computer-oss/db test -- src/repositories/runs.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/control-plane packages/db packages/protocol
git commit -m "feat: persist route decisions on run steps"
```

---

## Task 5: Add the operator settings surface and route visibility

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Vercel React best practices`

**Files:**

- Create: `apps/web/app/settings/page.tsx`
- Create: `apps/web/components/settings/provider-catalog.tsx`
- Create: `apps/web/components/settings/workspace-credentials-panel.tsx`
- Create: `apps/web/components/settings/auth-profiles-panel.tsx`
- Create: `apps/web/components/settings/router-policy-editor.tsx`
- Create: `apps/web/components/settings/route-preview-panel.tsx`
- Create: `apps/web/components/settings/*.test.tsx`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/outcomes/run-timeline.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.test.tsx`

**Step 1: Write the failing web tests**

Cover:

- settings page loads catalog, profiles, and policy
- route preview renders resolved and unresolved states
- policy editor submits updates
- run timeline renders provider/model/profile badges when step route data exists
- unresolved route status renders a warning state

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/web test -- app/settings/page.test.tsx
pnpm --filter @computer-oss/web test -- components/outcomes/run-timeline.test.tsx
```

Expected: FAIL because the settings route and route UI do not exist yet.

**Step 3: Implement the web surface**

Add a `Settings` route that includes:

- provider/model catalog panel
- workspace-credentials CRUD panel
- auth profile CRUD panel
- policy editor
- route preview diagnostics

Update the run timeline so each step shows:

- provider badge
- model badge
- auth profile label or unresolved warning

Do not over-design this. The milestone goal is operational control, not marketing polish.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/web test
pnpm --filter @computer-oss/web typecheck
pnpm --filter @computer-oss/web build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add routing settings and step route ui"
```

---

## Task 6: Docs, setup, and milestone verification

**Reference priority:**

- primary: current repo docs only

**Files:**

- Modify: `README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/agent-runbook.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-execution-roadmap.md`
- Modify: `docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md`
- Modify: `docs/plans/2026-03-13-milestone-4-routing-byo-keys-implementation.md`

**Step 1: Update docs for M4 setup**

Document:

- `MYCELIUM_ENCRYPTION_KEY`
- generating a local encryption key with `openssl rand -base64 32`
- settings workflow for auth profiles and router policy
- settings workflow for workspace credentials
- acceptance checklist for route preview and step route visibility

**Step 2: Run the merged verification set**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 3: Run the M4 manual smoke path**

From the local stack:

1. open the settings page
2. add one provider credential and one auth profile
3. set a routing policy for `reasoning` and `coding`
4. preview both routes and confirm they resolve deterministically
5. create an outcome and run
6. confirm the timeline shows route metadata on steps
7. confirm the run still completes on the M3 local execution path

**Step 4: Update milestone notes and project log**

Record:

- verification evidence
- any deviations
- the merged milestone summary

**Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: record m4 routing workflow and verification"
```

---

## M4 execution order

Recommended order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6

Do not start Task 5 before Task 3 is stable. The UI should not guess at contracts that the API has not finalized.

## Review checkpoints

Request review after:

- Task 1
- Task 2
- Task 3
- Task 4
- Task 5
- milestone completion

## Implementation notes

- `2026-03-13`: Plan authored after M3 closure. The milestone is intentionally scoped to control-plane routing and BYO-key management only. Real provider-backed worker execution remains out of scope for M4.
- `2026-03-13`: Codex began Task 1 on `codex/m4-task1-routing-contracts` after reloading the M4 design/plan, runbook, roadmap, and project-log context, then verifying a clean isolated baseline with `pnpm install` and `pnpm test`.
- `2026-03-13`: Task 1 keeps route metadata additive on `RunStepSchema` so the shared contracts can expose persisted route state immediately without forcing Task 2 persistence and Task 4 run-step writes to land in the same batch.
- `2026-03-13`: Task 1 required one small workspace bootstrapping deviation from the plan: after adding the new `packages/router` workspace package, the worktree needed one extra `pnpm install` so `@computer-oss/router` could resolve its local `@computer-oss/protocol` workspace dependency during tests and typecheck.

## Verification log

- `2026-03-13` Task 1:
  - `pnpm install`
  - `pnpm test`
  - `pnpm --filter @computer-oss/protocol test -- src/router.test.ts`
  - `pnpm --filter @computer-oss/router test`
  - `pnpm install`
  - `pnpm --filter @computer-oss/protocol test`
  - `pnpm --filter @computer-oss/router test`
  - `pnpm --filter @computer-oss/router typecheck`
