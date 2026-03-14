# 🍄 Mycelium

**Your keys. Your models. Your data.**

Mycelium is an open-source orchestration platform for long-running AI work. Describe an outcome — research, code, documents, data analysis, scheduled workflows — and Mycelium decomposes it into a dependency-aware task graph, routes subtasks across the best available models and runtimes, executes them in parallel sandboxed environments, gates side effects on human approval, and delivers artifacts. Interactive, background, or recurring. Minutes or months.

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

Side effects are gated by default. Mycelium runs autonomously for read-only work — browsing, search, summarization, drafting, sandboxed file generation, dry-run planning. But any external write (posting messages, sending emails, mutating third-party services, privileged terminal commands, creating persistent schedules) pauses for your explicit approval before executing.

You review and approve in the web console or directly in Slack/Telegram.

---

## Why Mycelium exists

Products like Perplexity Computer, Manus, and Devin proved that AI workflow orchestration works. But they're closed, expensive, and opaque. You can't see what models are running, you can't control costs, and your data flows through someone else's infrastructure.

The open-source agent ecosystem went the other direction — frameworks like LangGraph and CrewAI give you primitives, but you're assembling the product yourself. Config files, custom chains, glue code. You wanted an AI employee, you got a box of IKEA parts.

Mycelium is the assembled thing. Not a framework. A product you run with one command.

**What's different:**

- **BYO keys.** Plug in your own API keys from any supported provider. You pay providers directly. No markup.
- **Visible routing.** You see and control exactly which model handles which capability. Policy-driven, not magic.
- **Approval-gated execution.** Read-only work runs autonomously. Side effects always pause for your sign-off.
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

Open `http://127.0.0.1:3000`. The current integrated slice is Milestone 4 routing and BYO keys on top of the Milestone 3 local execution path: you can save encrypted provider credentials, create auth profiles, define router policy, preview route resolution, and then run the same local Docker execution flow with persisted route metadata on each step.

### Manual smoke checklist

1. Open `/settings` and confirm the provider catalog, workspace credentials, auth profiles, and routing policy surfaces load.
2. Create one workspace credential. Credential writes require `MYCELIUM_ENCRYPTION_KEY` in `apps/control-plane/.env.local`.
3. Create one auth profile for that credential.
4. Save router policy entries for `reasoning` and `coding`, then preview both routes and confirm they resolve to the same provider, model, and auth profile on repeated previews. `resolvedAt` changes per preview because it is a fresh resolution timestamp.
5. If you want every node in the default M3 draft plan to resolve, also add a `document` policy entry. The shipped four-node draft plan uses `reasoning` for `Analyze outcome` and `document` for the other three nodes.
6. Create an outcome from the web UI.
7. Generate the draft plan and confirm the four-node fork/join graph renders:
   `Analyze outcome` -> `Draft brief` + `Draft operator summary` -> `Synthesize result`.
8. Start the run and confirm the two middle steps complete before synthesis starts.
9. Confirm the run reaches `completed` and the outcome header also reaches `completed`.
10. Confirm the timeline shows route badges on each step and that unresolved routes, if any, are rendered explicitly instead of blocking local execution.
11. Confirm the artifact panel shows exactly four artifacts:
   `artifacts/analyze-outcome.md`, `artifacts/brief.md`, `artifacts/operator-summary.md`, and `artifacts/final-result.md`.
12. Confirm the log panel shows persisted step logs after a page refresh, not just live SSE updates.

### Messaging (optional)

Mycelium supports Slack and Telegram out of the box. See the [messaging setup guide](docs/messaging.md) for configuration.

### API

The currently shipped local API surface for the Milestone 4 slice is:

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

# Stream live plan/run events over SSE
curl -N http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/events
```

The operator console consumes the same control-plane endpoints and the same outcome-scoped SSE stream for timeline, activity, logs, artifacts, and persisted step-route metadata. Runtime execution remains on the M3 local Docker path in this milestone; M4 makes the routing decisions durable and visible before provider-backed worker execution lands in a later milestone.

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
