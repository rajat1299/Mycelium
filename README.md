# 🍄 Mycelium

**Your own AI computer. Your keys. Your models. Your data.**

Mycelium is an open-source AI workflow engine that breaks complex tasks into subtasks, dispatches them to parallel agents running in isolated cloud sandboxes, and delivers finished work — research, code, documents, analysis — while you do something else.

Think of it as an open-source alternative to Perplexity Computer. Except you own every piece of it.

```
git clone https://github.com/mycelium-ai/mycelium.git
cd mycelium
cp .env.example .env       # paste your API key
docker compose up
```

Open `http://localhost:4400`. Start talking.

---

## Why Mycelium

AI models are extraordinary. The bottleneck isn't intelligence — it's orchestration.

You can already ask an LLM to write code, do research, draft documents, analyze data. But the moment you need a workflow — "research ten competitors, summarize findings, draft a report, email it to my team" — you're back to babysitting. Copy-pasting between tools. Sequencing tasks manually. Watching spinners.

Perplexity Computer solved this with a $200/month cloud product. Mycelium solves it with software you run yourself.

**One manager agent** receives your request and decomposes it into subtasks.  
**Worker agents** execute each subtask in parallel, inside isolated Docker sandboxes.  
**You review the output** when it's ready. Or don't — let it roll.

No vendor lock-in. No $200/month. No data leaving your infrastructure unless you want it to.

---

## How it works

```
You: "Research the top 5 competitors in the AI billing space,
      compare their pricing models, and draft a memo for the team."

Mycelium:
  ├─ Spawns 5 research workers (parallel)
  │   ├─ Worker 1: researches Competitor A → writes findings to workspace
  │   ├─ Worker 2: researches Competitor B → writes findings to workspace
  │   ├─ Worker 3: researches Competitor C → writes findings to workspace
  │   ├─ Worker 4: researches Competitor D → writes findings to workspace
  │   └─ Worker 5: researches Competitor E → writes findings to workspace
  ├─ Spawns comparison worker (waits for research)
  │   └─ Reads all findings → produces pricing comparison table
  └─ Spawns memo writer (waits for comparison)
      └─ Drafts team memo with executive summary + detailed comparison

Result: a polished memo in your workspace, 3 minutes later.
```

The manager handles task decomposition, dependency ordering, worker lifecycle, error recovery, and context synthesis. You describe outcomes. It figures out the rest.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Web UI (Vite + TanStack)                            │
│  Chat · Task graph · Live agent streams · Settings   │
└──────────────────┬───────────────────────────────────┘
                   │ HTTP + WebSocket
┌──────────────────▼───────────────────────────────────┐
│  Orchestrator Daemon (Node.js)                       │
│  Foreman · Task scheduler · Persistence · API        │
└──────────────────┬───────────────────────────────────┘
                   │ spawns containers
┌──────────────────▼───────────────────────────────────┐
│  Sandboxed Workers (Docker)                          │
│  Each worker: isolated filesystem, network,          │
│  pre-installed tools (Python, Node, ffmpeg, browser) │
└──────────────────────────────────────────────────────┘

Data: Postgres (task state, memory, config) + local volume (artifacts)
```

**Foreman** — a persistent manager agent with compacting memory. It decomposes your request into a task graph, identifies what can run in parallel vs. what's sequential, dispatches workers, monitors progress, and synthesizes results. It remembers your preferences and project context across sessions.

**Workers** — each runs in an isolated Docker container with a clean Linux environment. Workers can execute code, browse the web, generate files, call APIs, and run for minutes or hours. If a worker fails, the foreman retries or reassigns.

**API** — everything the UI can do, the API can do. Trigger workflows from scripts, CI pipelines, Slack bots, or anything that speaks HTTP.

---

## Features

**Parallel execution** — describe a batch of work and the foreman automatically parallelizes independent subtasks across sandboxed workers. No manual sequencing.

**Persistent memory** — the foreman maintains compacting memory across sessions. It learns your preferences, your project context, your workflow patterns. Day one it's helpful. Day thirty it's indispensable.

**Isolated sandboxes** — every worker runs in its own Docker container. Pre-installed with Python, Node.js, ffmpeg, common Unix tools, and a headless browser. No "works on my machine" problems.

**BYO keys** — bring your own API keys from any supported provider. You control cost, you control which models to use, you control your data.

**Web UI + API** — a real-time dashboard for watching agents work, chatting with your foreman, and reviewing artifacts. Plus a full REST + WebSocket API for programmatic access.

**Messaging channels** — talk to Mycelium from Slack, Discord, Telegram, or the web UI. Built on battle-tested integrations.

**Skills system** — built-in skills for web search, code execution, document generation, browser automation, and scheduled tasks. Extensible — add your own.

---

## What you can do with it

Mycelium isn't locked to one task type. The foreman handles anything that can be decomposed into steps.

**Research** — "Deep dive into the regulatory landscape for AI in healthcare across the US, EU, and UK. Produce a comparison table and a 2-page brief."

**Code** — "Refactor our auth module to use JWT, update all tests, and make sure CI passes."

**Content** — "Write a blog post about our new feature launch. Include competitor positioning. Adapt it into a Twitter thread and a LinkedIn post."

**Analysis** — "Pull our last 6 months of support tickets, categorize them by theme, identify the top 3 pain points, and draft recommendations."

**Ops** — "Every Monday at 9am, check our uptime dashboard, summarize any incidents from last week, and post a summary to #engineering in Slack."

---

## Configuration

### Minimal setup (one API key)

```env
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

That's it. Mycelium uses your single key for the foreman and all workers.

### Multi-provider setup

```env
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
```

### Model routing (optional)

```yaml
# config/router.yaml — defaults shown, customize as needed
default: claude-sonnet-4
foreman: claude-opus-4

# v2: per-task-type routing (coming soon)
# routing:
#   research: gemini-2.5-pro
#   coding: claude-opus-4
#   fast_tasks: gpt-4o-mini
#   summarization: claude-sonnet-4
```

In v1, the foreman and all workers use the `default` model (or `foreman` for the manager). Multi-model routing per task type is on the roadmap.

---

## Roadmap

**v0 — Foundation** *(current)*
- [x] Foreman agent with task decomposition
- [x] Sandboxed worker execution (Docker)
- [x] Persistent memory with compaction
- [x] Web UI with real-time streaming
- [x] REST + WebSocket API
- [x] BYO API keys (single provider)
- [x] Messaging channels (Slack, Discord, Telegram)
- [x] Built-in skills (search, browser, code, files)

**v1 — Multi-model & Polish**
- [ ] Policy-driven model routing (`router.yaml`)
- [ ] Per-task-type model assignment
- [ ] Skill marketplace (community-contributed workflows)
- [ ] Task templates (reusable workflow definitions)
- [ ] Improved error recovery and retry strategies

**v2 — Teams & Hosted**
- [ ] Multi-user workspace support
- [ ] Role-based access control
- [ ] Hosted cloud option (BYO keys, managed infrastructure)
- [ ] Object store integration (S3/R2) for artifacts
- [ ] OAuth connector library for third-party services

---

## Built on giants

Mycelium wouldn't exist without the open-source projects it builds on:

- **[OpenClaw](https://github.com/openclaw/openclaw)** — personal AI assistant framework, messaging integrations, sandbox architecture (MIT)
- **[Terragon](https://github.com/terragon-labs/terragon-oss)** — cloud agent orchestration, multi-provider routing, git workflow automation (Apache-2.0)
- **[Middleman](https://github.com/SawyerHood/middleman)** — manager-worker agent hierarchy, persistent compacting memory, parallel dispatch (MIT)

---

## Contributing

Mycelium is early and moving fast. If you're interested in AI agent orchestration, we'd love your help.

```
pnpm dev              # start the dev environment
pnpm test             # run tests
pnpm test:e2e         # run end-to-end tests
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## FAQ

**How is this different from LangGraph / CrewAI / AutoGen?**  
Those are frameworks — libraries you build on top of. Mycelium is the assembled product. You don't write agent code. You describe what you want and the foreman handles it.

**How is this different from OpenClaw?**  
OpenClaw is a personal assistant — great at conversations, reminders, and single tasks. Mycelium is a workflow engine — it decomposes complex multi-step work into parallel subtasks and executes them in isolated sandboxes.

**How is this different from Perplexity Computer?**  
Same concept, different model. Perplexity Computer is a managed service at $200/month with opaque model routing. Mycelium is open-source, self-hosted, BYO keys, and you control everything.

**Do I need multiple API keys?**  
No. One key from any supported provider is enough. Multi-provider routing is optional and coming in v1.

**Can I run this without Docker?**  
Not recommended. Sandboxed execution is core to how Mycelium works — it ensures consistency and isolation. Docker Compose handles everything.

**Where does my data go?**  
Nowhere you don't control. Postgres runs locally in Docker. Artifacts are stored on your local filesystem. API calls go directly from your machine to your chosen provider. Mycelium has no telemetry, no phone-home, no cloud dependency.

---

## License

MIT — do whatever you want with it.
