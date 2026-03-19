# Milestone 8 Schedules, Messaging, and Local Companion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **For Codex agents:** Read [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md), [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md), [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md), and [Milestone 8 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-design.md) before touching code.

**Goal:** Ship schedules plus Slack and Telegram as real ingress runtimes on top of the existing Mycelium execution kernel, while limiting the local companion to reviewed protocol, security, and bootstrap groundwork only.

**Architecture:** M8 adds durable schedule objects, schedule execution, Slack and Telegram connection or conversation normalization, and outbound delivery over the same control-plane execution pipeline. It does not ship a packaged local companion runtime. The companion work in this milestone is protocol and bootstrap groundwork only.

**Tech stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`, `Docker`

**Status:** `Implemented and verified on 2026-03-18`

---

## Required reading for this milestone

Read these first:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
4. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
5. [Technical Spec](/Users/rajattiwari/swarm/computer-oss/docs/04-technical-spec.md)
6. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
7. [Milestone 7 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-design.md)
8. [Milestone 8 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-design.md)

Then read milestone-specific references:

- `Middleman`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/cron-scheduler-service.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/schedule-storage.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/slack/slack-integration.ts`
  - `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/telegram/telegram-integration.ts`
  - [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
- `OpenClaw`
  - `/Users/rajattiwari/swarm/openclaw/src/cron/schedule.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/gateway/server-cron.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/gateway/server-methods/cron.ts`
  - `/Users/rajattiwari/swarm/openclaw/extensions/slack/src/channel.ts`
  - `/Users/rajattiwari/swarm/openclaw/extensions/telegram/src/channel.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/daemon/service.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/daemon/runtime-paths.ts`
  - `/Users/rajattiwari/swarm/openclaw/src/daemon/systemd.ts`
  - [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
- `Terragon`
  - `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/automations/cron.ts`
  - `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/scheduled-thread.ts`
  - [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)
- `Deer Flow`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/channels/slack.py`
  - `/Users/rajattiwari/swarm/deer-flow/backend/src/channels/telegram.py`

## Non-negotiable invariants for M8

Lock these before touching code:

- scheduled work and messaging work must normalize into the same durable outcome, plan, run, approval, checkpoint, and audit path as web-triggered work
- the control plane remains authoritative for durable state; schedules and channel adapters are ingress surfaces only
- Slack should use Socket Mode and Telegram should use long polling in M8 unless the human explicitly approves a different connection model
- approval resolution remains web-first in M8; Slack and Telegram may notify, but they are not the approval authority
- the local companion in M8 is design, protocol, and bootstrap groundwork only
- do not ship a packaged local companion binary, local-machine step execution, or privileged host actions in M8
- the shipped M7 remote-worker path and the M3 local Docker fallback path must continue to work

## Reference extraction checklist by task

### Task 1

- `/Users/rajattiwari/swarm/openclaw/src/cron/schedule.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/cron-scheduler-service.ts`
- `/Users/rajattiwari/swarm/openclaw/extensions/slack/src/channel.ts`
- `/Users/rajattiwari/swarm/openclaw/extensions/telegram/src/channel.ts`
- `/Users/rajattiwari/swarm/openclaw/src/daemon/service.ts`

### Task 2

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/schedule-storage.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/automations/cron.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-methods/cron.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/slack/slack-integration.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/telegram/telegram-integration.ts`

### Task 3

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/cron-scheduler-service.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-cron.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-methods/cron.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/scheduled-thread.ts`

### Task 4

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/slack/slack-integration.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/telegram/telegram-integration.ts`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/channels/slack.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/channels/telegram.py`
- `/Users/rajattiwari/swarm/openclaw/extensions/slack/src/channel.ts`
- `/Users/rajattiwari/swarm/openclaw/extensions/telegram/src/channel.ts`

### Task 5

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/slack/slack-integration.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/telegram/telegram-integration.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-methods/cron.ts`

### Task 6

- `/Users/rajattiwari/swarm/openclaw/src/daemon/service.ts`
- `/Users/rajattiwari/swarm/openclaw/src/daemon/runtime-paths.ts`
- `/Users/rajattiwari/swarm/openclaw/src/daemon/systemd.ts`
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)

If one of the reference files moves, do not guess a replacement path. Verify the replacement in the cloned repo first, then update this plan.

## Progress update protocol

Before starting:

- default to local `main`
- use an isolated local `codex/*` worktree only if the human explicitly asks for that workflow
- append a short start entry to [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)

During implementation:

- keep milestone-local deviations and verification notes in `Implementation Notes` at the bottom of this file
- do not rewrite earlier tasks; append review-driven changes only

After each finished task:

- run the task-level verification commands
- stop at the task boundary and request review before moving on

After milestone completion:

- append milestone verification evidence here
- update [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
- update the runbook and local-dev docs if the setup, smoke path, or verification flow changed

---

## Scope for this milestone

In scope:

- schedule contracts, persistence, runtime, and APIs
- Slack and Telegram connection state, ingress normalization, outbound delivery, and APIs
- web operator surfaces for schedules and channel status
- durable binding from external conversations to outcomes
- local companion protocol, scope model, and bootstrap groundwork

Out of scope:

- packaged companion binaries
- companion-managed local execution
- Slack or Telegram approval resolution
- public-webhook-only channel operation
- remote checkpoint or artifact durability backends
- browser or ffmpeg local companion features

## Milestone acceptance criteria

Before calling M8 complete:

- a durable schedule can create or continue work through the existing outcome, plan, and run path
- Slack and Telegram can both create or continue work for a workspace without bypassing the control plane
- outbound status or result delivery reaches the originating Slack thread or Telegram chat
- review-required runs triggered by schedule or channel ingress still block in the existing web review flow
- checkpoint, audit, artifact, and remote-worker behavior remain intact for scheduled and messaging-triggered runs
- companion protocol and bootstrap groundwork are present and reviewed, but no runnable packaged companion is required
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

---

## Task 1: Add schedules, messaging, and companion-groundwork contracts

**Reference priority:**

- primary: `OpenClaw`
- secondary: `Middleman`

**Files:**

- Create: `packages/protocol/src/schedule.ts`
- Create: `packages/protocol/src/messaging.ts`
- Create: `packages/protocol/src/local-companion.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/schedule.test.ts`
- Create: `packages/protocol/src/messaging.test.ts`
- Create: `packages/protocol/src/local-companion.test.ts`

**Step 1: Write the failing tests**

Cover:

- schedule definitions, trigger modes, timezone or next-fire metadata, and validation diagnostics
- Slack and Telegram connection summaries, inbound message payloads, outbound delivery payloads, and durable conversation identity
- local companion bootstrap, capability, scope, and trust-establishment contracts
- SSE payloads for schedule state and messaging connection or delivery state

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test -- src/schedule.test.ts src/messaging.test.ts src/local-companion.test.ts
```

Expected:

- FAIL because the new contracts do not exist yet

**Step 3: Implement the contracts**

Add shared schemas for:

- durable schedules and schedule fire history summaries
- Slack and Telegram inbound or outbound payloads and connection summaries
- external conversation binding identity
- local companion bootstrap, scope, and capability contracts

Keep the companion contracts transport-agnostic enough that a later milestone can ship the real companion runtime without rewriting them.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/protocol typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol
git commit -m "feat: add schedule and messaging protocol contracts"
```

---

## Task 2: Extend persistence for schedules and messaging bindings

**Reference priority:**

- primary: `Middleman`
- secondary: `Terragon`

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/repositories/schedules.ts`
- Create: `packages/db/src/repositories/schedules.test.ts`
- Create: `packages/db/src/repositories/messaging.ts`
- Create: `packages/db/src/repositories/messaging.test.ts`
- Modify: `packages/db/src/repositories/test-database.ts`
- Modify: `apps/control-plane/src/lib/repositories.ts`
- Create: `apps/control-plane/test/repositories-schedules.test.ts`
- Create: `apps/control-plane/test/repositories-messaging.test.ts`

**Step 1: Write the failing tests**

Cover:

- durable schedule create, update, disable, and next-fire bookkeeping
- per-occurrence dedupe for schedule firing
- Slack and Telegram connection persistence and status transitions
- durable binding from external conversation identity to outcome identity
- in-memory parity for schedule uniqueness, stale connection cleanup, and conversation rebinding rules

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/db test -- src/repositories/schedules.test.ts src/repositories/messaging.test.ts
pnpm --filter @computer-oss/control-plane test -- test/repositories-schedules.test.ts test/repositories-messaging.test.ts
```

Expected:

- FAIL because the persistence surfaces do not exist yet

**Step 3: Implement persistence**

Add durable tables or expansions for:

- schedules and per-run trigger metadata
- Slack and Telegram workspace connections
- external conversation bindings to outcomes

Persist enough data to answer:

- when this schedule fires next
- whether this due occurrence already produced work
- which outcome a Slack thread or Telegram chat belongs to
- whether a connection is healthy and enabled

Mirror the relevant FK and uniqueness behavior in the fake DB and in-memory repository layer.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/db test
pnpm --filter @computer-oss/db typecheck
pnpm --filter @computer-oss/control-plane test -- test/repositories-schedules.test.ts test/repositories-messaging.test.ts
pnpm --filter @computer-oss/control-plane typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db apps/control-plane
git commit -m "feat: persist schedules and messaging bindings"
```

---

## Task 3: Add schedule runtime and schedule APIs

**Reference priority:**

- primary: `Middleman`
- secondary: `OpenClaw`

**Files:**

- Create: `apps/control-plane/src/lib/schedule-service.ts`
- Create: `apps/control-plane/src/routes/schedules.ts`
- Modify: `apps/control-plane/src/lib/service-container.ts`
- Modify: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/test/schedules.test.ts`

**Step 1: Write the failing tests**

Cover:

- schedule CRUD
- due-schedule polling and per-occurrence dedupe
- schedule-triggered create-outcome or continue-outcome behavior
- optional continuation into plan or run creation through the normal control-plane path
- SSE visibility for schedule state changes

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/schedules.test.ts
```

Expected:

- FAIL because the schedule runtime and routes do not exist yet

**Step 3: Implement the runtime**

Add:

- a durable schedule service
- schedule routes
- service-container wiring
- polling or due-processing that stays idempotent across restart or race windows

The schedule runtime should call the same outcome or run services that the web surface already uses. Do not invent a schedule-only execution path.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
pnpm --filter @computer-oss/control-plane build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/control-plane
git commit -m "feat: add schedule runtime and api"
```

---

## Task 4: Add Slack and Telegram runtime plus control-plane APIs

**Reference priority:**

- primary: `Middleman`
- secondary: `Deer Flow` and `OpenClaw`

**Files:**

- Create: `apps/control-plane/src/lib/messaging-service.ts`
- Create: `apps/control-plane/src/lib/slack-service.ts`
- Create: `apps/control-plane/src/lib/telegram-service.ts`
- Create: `apps/control-plane/src/routes/slack.ts`
- Create: `apps/control-plane/src/routes/telegram.ts`
- Create: `apps/control-plane/src/routes/messages.ts`
- Modify: `apps/control-plane/src/lib/service-container.ts`
- Modify: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/test/slack.test.ts`
- Create: `apps/control-plane/test/telegram.test.ts`
- Create: `apps/control-plane/test/messages.test.ts`

**Step 1: Write the failing tests**

Cover:

- workspace connection or config routes
- Slack inbound message handling through Socket Mode normalization
- Telegram inbound message handling through long polling normalization
- outbound status or result delivery
- durable conversation binding to outcomes
- protection against duplicate inbound delivery

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- test/slack.test.ts test/telegram.test.ts test/messages.test.ts
```

Expected:

- FAIL because the messaging services and routes do not exist yet

**Step 3: Implement messaging runtime**

Add:

- workspace-scoped Slack and Telegram services
- inbound normalization into the existing outcome path
- outbound delivery back to the source conversation
- control-plane APIs for connection state and message-linked history

Keep approval resolution in the web review surface for M8. Messaging may notify, but it should not become the review authority.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
pnpm --filter @computer-oss/control-plane build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/control-plane
git commit -m "feat: add slack and telegram runtime"
```

---

## Task 5: Add operator UI for schedules and messaging state

**Reference priority:**

- primary: `Middleman`
- secondary: `OpenClaw`

**Files:**

- Modify: `apps/web/app/settings/page.tsx`
- Create: `apps/web/components/settings/schedules-panel.tsx`
- Create: `apps/web/components/settings/messaging-panel.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/execution-console.tsx`
- Modify: `apps/web/lib/api.ts`
- Create: `apps/web/app/api/schedules/route.ts`
- Create: `apps/web/app/api/slack/route.ts`
- Create: `apps/web/app/api/telegram/route.ts`
- Create: `apps/web/components/settings/schedules-panel.test.tsx`
- Create: `apps/web/components/settings/messaging-panel.test.tsx`

**Step 1: Write the failing tests**

Cover:

- schedule list and create or update interactions
- Slack and Telegram connection status rendering
- outcome surfaces showing schedule or message origin metadata where relevant
- no regression to the existing run, review, checkpoint, and worker panels

**Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @computer-oss/web test -- components/settings/schedules-panel.test.tsx components/settings/messaging-panel.test.tsx
```

Expected:

- FAIL because the new settings and outcome surfaces do not exist yet

**Step 3: Implement the UI**

Add:

- a schedules settings panel
- Slack and Telegram connection or status surfaces
- same-origin web proxies for the new control-plane APIs
- any minimal outcome metadata needed to help operators trace ingress source

Keep the UI aligned with the existing settings and outcome console language instead of inventing a separate messaging product shell.

**Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @computer-oss/web test
pnpm --filter @computer-oss/web build
pnpm --filter @computer-oss/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add schedules and messaging ui"
```

---

## Task 6: Close M8 docs, smoke verification, and companion groundwork

**Reference priority:**

- primary: `OpenClaw`
- secondary: local milestone docs and verified repo notes

**Files:**

- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/setup-local-dev.md`
- Modify: `docs/agent-runbook.md`
- Modify: `docs/project-log.md`
- Modify: `docs/plans/2026-03-11-execution-roadmap.md`
- Modify: `docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-design.md`
- Modify: `docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-implementation.md`

**Step 1: Run the live smoke path**

Verify at least:

- a durable schedule creates or continues work through the normal execution path
- Slack inbound creates or continues work and outbound delivery responds in the source thread
- Telegram inbound creates or continues work and outbound delivery responds in the source chat
- review-required work triggered from schedule or messaging still blocks in the web review desk
- a remote-worker-backed run still works when triggered from one of the new ingress surfaces
- companion groundwork docs explain protocol, bootstrap, and trust boundaries without claiming a shipped binary

**Step 2: Update docs**

Document:

- the shipped M8 behavior
- local setup for schedule and messaging verification
- the verified smoke evidence
- the explicit limitation that the local companion is groundwork only in M8

**Step 3: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: PASS.

**Step 4: Commit**

```bash
git add .
git commit -m "docs: close milestone 8 schedules and messaging"
```

---

## Implementation notes

- `2026-03-17`: M8 is locked to schedules plus Slack and Telegram as runtime deliverables, with the local companion limited to design, protocol, and bootstrap groundwork only.
- `2026-03-18`: Live M8 smoke passed on `ws_default`. Slack created/continued `outcome_e2ea0d3fdb46db49` with `2` deliveries and `1` binding; Telegram created/continued `outcome_9a190c39fd4caa73` with `2` deliveries and `1` binding; schedule fire `schedule_fire_e0da3fc439b0611a` drove `run_e0da3fc439b0611a`, blocked on approval `approval_92557c23-1041-4fb0-8d77-c79efd61130c`, then completed with `4` artifacts, `7` checkpoints, `12` logs, and `7` audit entries while `workerA` and `workerB` processed `2` steps each.
- `2026-03-18`: The live smoke exposed one DB-backed messaging retry bug: duplicate outcome/message recovery relied on matching `"duplicate"` in the thrown error text, which was not stable across Drizzle/Postgres failure shapes. The shipped fix now checks durable outcome and message existence directly so Slack/Telegram continuation and retry repair work on the real DB path.
