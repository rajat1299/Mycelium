# 🍄 Mycelium

**Your keys. Your models. Your data.**

Mycelium is an open-source orchestration platform for long-running AI work. Describe an outcome — research, code, documents, data analysis, scheduled workflows — and Mycelium decomposes it into a dependency-aware task graph, routes subtasks across the best available models and runtimes, executes them in parallel sandboxed environments, gates review-required or side-effecting work on human approval, and delivers artifacts. Interactive, background, or recurring. Minutes or months.

You run it. You own it.

---

## What it does

You describe an outcome. Mycelium handles the rest.

**Research and synthesis**

> "Research the top 5 competitors in the AI dev tools space, compare their pricing and features, and put it in a report."

The foreman decomposes this into a plan graph — 5 independent research nodes running in parallel, one synthesis node that depends on all 5. Each research node spins up in its own sandbox, routes to your configured research model, and delivers structured results. The synthesis node compiles everything into a formatted report. You come back in 10 minutes and it's done.

**Code across a codebase**

> "Refactor the authentication module to use OAuth2, write tests, and update the API docs."

The foreman analyzes dependencies — the refactor runs first, tests and docs run in parallel after. Each worker gets its own isolated sandbox with full terminal, filesystem, and browser access. Side effects like pushing branches or opening PRs pause for your approval.

**Scheduled workflows**

> "Every Monday at 9am, pull our analytics data, generate a weekly summary, and post it to #team-updates in Slack."

Mycelium schedules it using the exact same execution pipeline as interactive runs. The Slack post pauses for approval the first time. Once you mark that action as pre-approved, it runs autonomously every week.

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│  You                                                      │
│  Web command center / Slack / Telegram / REST API          │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│  Control Plane                                             │
│  Orchestration · Persistence · Realtime events             │
│  Approvals · Schedules · Worker coordination               │
└────────┬─────────────┬─────────────────┬──────────────────┘
         │             │                 │
   ┌─────▼──────┐ ┌────▼──────┐  ┌──────▼───────┐
   │  Router     │ │ Foreman   │  │  Approval    │
   │  Policy →   │ │ Plan graph│  │  Service     │
   │  provider/  │ │ dispatch  │  │  Side-effect │
   │  model/     │ │ synthesis │  │  gates       │
   │  runtime    │ │ retries   │  │              │
   └─────────────┘ └─────┬─────┘  └──────────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
      ┌─────▼──┐  ┌──────▼──┐  ┌─────▼──────────┐
      │Worker 1│  │Worker 2 │  │Local Companion  │
      │Remote  │  │Remote   │  │Edge agent on    │
      │Sandbox │  │Sandbox  │  │your machine for │
      └────────┘  └─────────┘  │local files,     │
                               │browser sessions,│
                               │authenticated    │
                               │contexts         │
                               └─────────────────┘
```

### Outcomes, not chats

The dominant workflow object is an **Outcome** — not a thread, session, or chat. Chat is one surface into the outcome. Plan graphs, runs, artifacts, approvals, and schedules all hang off the outcome. Start a task in the web console, continue it in Slack, review the artifacts back in the console. The outcome is the anchor.

### Foreman

A persistent orchestrator with compacting memory. When you describe an outcome, the foreman builds a dependency-aware plan graph — nodes for each subtask, edges for dependencies. Independent nodes execute in parallel. Dependent nodes wait. The foreman handles retries, escalation, and synthesis of worker outputs into coherent final artifacts.

The foreman remembers your preferences, conventions, and project context across sessions. It gets better the longer you use it.

### Router

A policy-driven engine that maps capabilities to providers, models, and runtimes. You define the policy explicitly:

```yaml
reasoning:
  - provider: anthropic
    model: claude-opus-4.6
coding:
  - provider: openai
    model: GPT-5.4
research:
  - provider: google
    model: gemini-2.5-pro
fast_tasks:
  - provider: xai
    model: grok-4-1-fast-non-reasoning
fallback:
  - provider: anthropic
    model: claude-sonnet-4.6
```

The foreman tags each subtask with a capability (`reasoning`, `research`, `coding`, `browser`, `terminal`, `api`, `document`, `fast_tasks`). The router resolves each capability to a provider and model based on your policy. Fallback chains are deterministic — if a provider is down or a key is missing, the router moves to the next candidate. No hidden routing. No opaque costs.

### Workers

Each worker runs in an isolated Docker sandbox with Python, Node.js, a browser, ffmpeg, and standard Unix tools. Workers can browse the web, execute code, generate files, call APIs, and automate browsers. They stream logs, progress, and artifacts back to the control plane in real time.

Workers are independent. If one fails, the others keep running. The foreman retries or reassigns.

### Local companion

An optional edge agent that runs on your machine for tasks that need local context — your browser sessions, local files, authenticated accounts, or device-specific access that can't exist in a remote sandbox. The local companion only accepts signed, scoped tasks from the control plane and rejects anything outside its approved boundaries.

### Approvals

Review-required work is gated by default. The shipped M5 slice pauses the final synthesis output for approval in the web console, and the same control loop is the substrate for future external writes. Read-only work still runs autonomously for browsing, search, summarization, drafting, sandboxed file generation, and dry-run planning.

You review and approve in the web console or directly in Slack/Telegram.

---

## Why Mycelium exists

Products like Perplexity Computer, Manus, and Devin proved that AI workflow orchestration works. But they're closed, expensive, and opaque. You can't see what models are running, you can't control costs, and your data flows through someone else's infrastructure.

The open-source agent ecosystem went the other direction — frameworks like LangGraph and CrewAI give you primitives, but you're assembling the product yourself. Config files, custom chains, glue code. You wanted an AI employee, you got a box of IKEA parts.

Mycelium is the assembled thing. Not a framework. A product you run with one command.

**What's different:**

- **BYO keys.** Plug in your own API keys from any supported provider. You pay providers directly. No markup.
- **Visible routing.** You see and control exactly which model handles which capability. Policy-driven, not magic.
- **Approval-gated execution.** Read-only work runs autonomously. Review-required outputs and side effects pause for your sign-off.
- **Self-hosted.** Your data, artifacts, logs, and memory stay on your infrastructure.
- **Multi-surface.** Web command center for the full experience. Slack and Telegram for messaging your agent like a coworker. REST + WebSocket API for programmatic access. An outcome started on one surface continues seamlessly on another.
- **Persistent memory.** The foreman learns your codebase, preferences, and workflow across sessions.
- **Parallel by default.** The foreman identifies independent subtasks and runs them concurrently. You describe the outcome, not the sequence.
- **Same pipeline everywhere.** Interactive, background, and scheduled runs use the exact same execution path.

---

## Quick start

### Prerequisites

- Node.js `22.x`
- `pnpm` `10.17.0` or newer
- Docker Desktop or a local Docker engine
- enough local Docker disk space to pull `node:22-bookworm-slim`
- at least one provider API key you can enter through the settings page after the stack is running

### Run it

```bash
git clone https://github.com/rajat1299/Mycelium.git
cd mycelium
cp .env.example .env
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
```

Open `.env` and replace `REPLACE_WITH_LOCAL_DB_PASSWORD` with a local password. Then open `apps/control-plane/.env.local`, replace the same DB password there, and add a local encryption key:

```bash
openssl rand -base64 32
```

```env
MYCELIUM_ENCRYPTION_KEY=<paste-generated-key>
```

The root `.env` file is only for the local Postgres bootstrap. Provider secrets are stored through the settings page and encrypted before they are written to Postgres.

```bash
pnpm install
pnpm db:up
set -a; source .env; set +a; pnpm db:push
pnpm dev
```

`pnpm db:push` currently needs `DATABASE_URL` exported from the root `.env` file. The command above works from the repo root in a normal POSIX shell.

The local sandbox uses `node:22-bookworm-slim` by default. If you need to pin a different local image, set `SANDBOX_IMAGE` in `apps/control-plane/.env.local` before starting the stack.
`CHECKPOINT_ROOT` is optional. If you leave it unset, the shipped M6 checkpoint backend writes versioned JSON manifests under `apps/control-plane/.mycelium/checkpoints`.

Open `http://127.0.0.1:3000`. The current integrated slice is Milestone 6 checkpoints, replay, and audit on top of the Milestone 5 review queue, Milestone 4 routing, and Milestone 3 local execution path: you can save encrypted provider credentials, create auth profiles, define router policy, preview route resolution, run the local Docker execution flow, review blocked work in `/review`, inspect persisted lineage, interrupt the control plane, recover stranded runs as resumable, and resume from durable checkpoints in the outcome detail console.

### Manual smoke checklist

1. Open `/settings` and confirm the provider catalog, workspace credentials, auth profiles, and routing policy surfaces load.
2. Create one workspace credential. Credential writes require `MYCELIUM_ENCRYPTION_KEY` in `apps/control-plane/.env.local`.
3. Create one auth profile for that credential.
4. Save router policy entries for `reasoning`, `coding`, and `document`, then preview `reasoning` and `document` and confirm repeated previews keep the same provider, model, and auth profile. `resolvedAt` changes per preview because it is a fresh resolution timestamp.
5. Create an outcome from the web UI.
6. Generate the draft plan and confirm the four-node fork/join graph renders:
   `Analyze outcome` -> `Draft brief` + `Draft operator summary` -> `Synthesize result`.
7. Start the run and confirm the two middle steps complete before synthesis starts.
8. Confirm the run blocks on `Synthesize result` and the selected run shows the `Blocked on review` card instead of completing immediately.
9. Open `/review` and confirm a pending `Review final result` approval appears for the blocked run.
10. Confirm the blocked approval points at the final artifact under review, and the outcome detail page renders the `Artifact lineage` panel for the selected run.
11. Approve the blocked work and confirm the run reaches `completed`.
12. Repeat with a second outcome and reject the blocked work. Confirm the second run reaches `failed`.
13. Confirm the artifact panel still shows exactly four persisted artifacts for the approved run:
   `artifacts/analyze-outcome.md`, `artifacts/brief.md`, `artifacts/operator-summary.md`, and `artifacts/final-result.md`.
14. Confirm the lineage panel shows the deterministic `derived_from` relationships for the run, including the final result deriving from both branch artifacts.
15. Confirm the log panel shows persisted step logs after a page refresh, not just live SSE updates.
16. Start a new outcome and run for the interruption smoke path, then wait until the selected run shows at least one `step_completed` checkpoint while the run is still active.
17. Stop only the control plane process before the run reaches a terminal state.
18. Restart the control plane and confirm the selected run becomes `interrupted`, `resumable`, and still points at the latest resumable checkpoint instead of silently continuing in the background.
19. Resume the run from the outcome detail checkpoint panel or `POST /api/runs/<RUN_ID>/resume`.
20. Confirm the already checkpointed completed step does not rerun, then approve the resumed final review step and confirm the run reaches `completed`.
21. Confirm the outcome detail page renders `Replay anchors` and `Operator trail`, and that the audit trail includes interruption and resume entries in stable sequence order.
22. Confirm replay, audit, and live logs each answer a different question:
    replay shows the selected durable checkpoint payload, audit shows the durable lifecycle ledger, and logs show step stdout or stderr detail.

### Messaging (optional)

Mycelium supports Slack and Telegram out of the box. See the [messaging setup guide](docs/messaging.md) for configuration.

### API

The currently shipped local API surface for the Milestone 6 slice is:

```bash
# Read the static provider/model catalog
curl http://127.0.0.1:4000/api/providers/models

# Create a workspace credential
curl -X POST http://127.0.0.1:3000/api/workspace-credentials \
  -H "content-type: application/json" \
  -d '{"workspaceId":"ws_default","providerId":"anthropic","label":"Primary Anthropic key","secret":"sk-ant-..."}'

# Create an auth profile
curl -X POST http://127.0.0.1:3000/api/auth-profiles \
  -H "content-type: application/json" \
  -d '{"workspaceId":"ws_default","providerId":"anthropic","label":"Anthropic primary","credentialId":"<CREDENTIAL_ID>","priority":0,"status":"active"}'

# Save router policy
curl -X PUT http://127.0.0.1:3000/api/router/policy \
  -H "content-type: application/json" \
  -d '{"workspaceId":"ws_default","version":1,"updatedAt":"<ISO_TIMESTAMP>","candidates":[{"capability":"reasoning","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true},{"capability":"coding","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true},{"capability":"document","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true}]}'

# Preview a route
curl -X POST http://127.0.0.1:3000/api/router/resolve-preview \
  -H "content-type: application/json" \
  -d '{"workspaceId":"ws_default","capability":"reasoning","policyVersion":1}'

# Create an outcome
curl -X POST http://127.0.0.1:4000/api/outcomes \
  -H "content-type: application/json" \
  -d '{"workspaceId":"ws_default","userId":"user_default","prompt":"Research the top 5 AI dev tool competitors and write a launch brief","source":"web"}'

# Generate the persisted draft plan
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan

# Read the plan graph
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan

# Start a run from that plan
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs \
  -H "content-type: application/json" \
  -d '{"planId":"plan_<OUTCOME_ID>"}'

# Read the latest persisted run for an outcome
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs/latest

# Read a run and its steps
curl http://127.0.0.1:4000/api/runs/<RUN_ID>

# Read persisted run logs
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/logs

# Read persisted run artifacts
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifacts

# Read persisted artifact-lineage edges for a run
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifact-lineage

# Read checkpoint summaries, a selected checkpoint payload, and the durable audit ledger
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/checkpoints
curl http://127.0.0.1:4000/api/checkpoints/<CHECKPOINT_ID>
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/audit

# Resume an interrupted run from the latest durable checkpoint
curl -X POST http://127.0.0.1:4000/api/runs/<RUN_ID>/resume \
  -H "content-type: application/json" \
  -d '{}'

# List pending approvals for a workspace
curl "http://127.0.0.1:4000/api/approvals?workspaceId=ws_default"

# Approve or reject blocked work
curl -X POST http://127.0.0.1:4000/api/approvals/<APPROVAL_ID>/approve \
  -H "content-type: application/json" \
  -d '{"resolutionNote":"Looks good."}'
curl -X POST http://127.0.0.1:4000/api/approvals/<APPROVAL_ID>/reject \
  -H "content-type: application/json" \
  -d '{"resolutionNote":"Needs revision."}'

# Stream live plan/run events over SSE
curl -N http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/events
```

The operator console consumes the same control-plane endpoints and the same outcome-scoped SSE stream for timeline, activity, logs, artifacts, approvals, checkpoints, and audit history. Runtime execution remains on the M3 local Docker path in this milestone; M4 made routing decisions durable and visible, M5 added the workspace review desk plus run-scoped artifact-lineage inspection, and M6 adds local interruption recovery plus checkpoint-backed resume before provider-backed worker execution lands in a later milestone.

---

## Architecture

Mycelium is a TypeScript monorepo.

```
mycelium/
├── apps/
│   ├── web/                # Next.js command center
│   ├── control-plane/      # Node.js orchestration service
│   └── local-companion/    # Optional edge agent
├── packages/
│   ├── protocol/           # Typed API and realtime event contracts
│   ├── orchestrator/       # Foreman logic, plan graph, synthesis, retries
│   ├── router/             # Capability → provider/model policy engine
│   ├── checkpoints/        # Backend-agnostic checkpoint store interface plus local filesystem backend
│   ├── sandbox/            # Remote sandbox lifecycle management
│   ├── worker-daemon/      # Runtime process inside sandboxes
│   ├── messaging/          # Slack and Telegram adapters
│   ├── artifacts/          # Artifact store, previews, safe path resolution
│   └── db/                 # Schema, migrations, queries, state machines
├── docker-compose.yml
├── Dockerfile.sandbox
└── .env.example
```

### Stack

- **Control plane:** TypeScript/Node.js, HTTP + SSE
- **Database:** PostgreSQL for all control-plane state
- **Blob store:** Local filesystem by default, behind an object-store abstraction for later hosted deployments
- **Sandboxes:** Docker containers per worker, fully isolated
- **Web:** Next.js command center with live streaming
- **Messaging:** Slack and Telegram via gateway adapters


## Roadmap

### v1 — Foundation (current)

- [ ] Foreman with persistent compacting memory
- [ ] Dependency-aware plan graph execution
- [ ] Independent sandboxed worker runtimes
- [ ] Policy-driven multi-model routing with deterministic fallback
- [ ] Approval system for side effects
- [ ] Web command center with live run monitoring
- [ ] REST + SSE API
- [ ] Slack and Telegram adapters
- [ ] Scheduled and recurring runs
- [ ] Artifact store with previews and downloads
- [ ] Local companion for edge tasks
- [ ] Checkpoint and resume for interrupted runs

### v2 — Multi-user and ecosystem

- [ ] Multi-user workspace support with RBAC
- [ ] Per-user API key management
- [ ] Skill marketplace (community-contributed capabilities)
- [ ] Agent execution replay and audit trail
- [ ] Budget controls and cost tracking per outcome
- [ ] Branch and worktree lease management

### v3 — Hosted option

- [ ] Managed cloud deployment
- [ ] Object store integration (S3/R2) for artifacts
- [ ] Team workspaces
- [ ] OAuth connector library
- [ ] Usage analytics dashboard

---


## Contributing

Mycelium is early and moving fast.

```bash
git clone https://github.com/rajat1299/Mycelium.git
cd mycelium
pnpm i
pnpm dev
# Control plane: http://localhost:4400
# Web console:   http://localhost:4401
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT

---

<p align="center">
  <i>In nature, mycelium is the underground network that connects entire forests — transferring nutrients, coordinating responses, and enabling organisms to work together without central control. This project works the same way.</i>
</p>
