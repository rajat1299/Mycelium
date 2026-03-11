# Contributing to Mycelium

Mycelium is early-stage and moving fast. We welcome contributions.

This document covers how to get set up, how we work, and what to expect when you open a PR.

---

## Getting started

### Prerequisites

- Node.js v20+
- pnpm v9+
- Docker and Docker Compose
- An API key from at least one supported provider (Anthropic, OpenAI, Google)

### Local development

```bash
git clone https://github.com/rajat1299/Mycelium.git
cd mycelium
pnpm i
cp .env.example .env    # add your API keys
pnpm dev
```

This starts:

- Control plane at `http://localhost:4400`
- Web console at `http://localhost:4401`
- Postgres and sandbox infrastructure via Docker

### Running tests

```bash
pnpm test              # unit tests
pnpm test:e2e          # end-to-end tests (requires Docker)
```

### Project structure

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
```

If you're unsure where something lives, check the package READMEs or ask in a discussion.

---

## How to contribute

### Reporting bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Docker version, Node version, which providers you're using)
- Relevant logs (redact API keys)

### Suggesting features

Open a discussion or issue. Describe the problem you're trying to solve, not just the solution you have in mind. Context helps us evaluate whether it fits v1 scope or belongs on the roadmap.

### Picking up work

Good starting points:

- Issues labeled `good-first-issue` — scoped tasks suitable for new contributors
- Issues labeled `help-wanted` — larger pieces where we'd appreciate community help
- Issues labeled `docs` — documentation improvements, guides, examples

If you want to work on something, comment on the issue first so we can confirm scope and avoid duplicate effort.

### Opening a pull request

1. Fork the repo and create a branch from `main`. Name it something descriptive: `fix/approval-timeout`, `feat/telegram-adapter`, `docs/router-policy-guide`.

2. Keep PRs focused. One concern per PR. A PR that fixes a bug and also refactors an unrelated module is two PRs.

3. Include tests for new behavior. If you're touching the orchestrator, router, or approval system, tests aren't optional.

4. Update docs if your change affects user-facing behavior — README, API docs, or inline comments.

5. Write a clear PR description:
   - What does this change?
   - Why?
   - How can reviewers test it?
   - Any open questions or tradeoffs?

6. Make sure CI passes before requesting review.

---

## Code conventions

### TypeScript

- Strict mode enabled. No `any` unless absolutely unavoidable and commented.
- Prefer explicit types over inference for function signatures and public APIs.
- Use `packages/protocol` types for anything that crosses package boundaries.

### Naming

- Files: `kebab-case.ts`
- Types and interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Database columns: `snake_case`
- Environment variables: `SCREAMING_SNAKE_CASE`

### Commits

Write clear commit messages. We don't enforce conventional commits, but prefer this shape:

```
fix: approval timeout not resetting after rejection

The approval service was holding the previous timeout reference
after a rejection, causing the next approval request to inherit
a stale deadline. Reset the timer on both approve and reject paths.
```

The first line should be a concise summary. If more context is needed, add a blank line and a body.

### Formatting and linting

```bash
pnpm lint              # check
pnpm lint:fix          # auto-fix
pnpm format            # prettier
```

Run these before pushing. CI will catch it anyway, but it saves a round trip.

---

## Architecture guidelines

These apply to any contribution that touches core systems.

### Outcome is the anchor

Everything in Mycelium hangs off the Outcome. If you're adding a feature, ask: "Where does this attach to the outcome?" If the answer is "it doesn't," reconsider whether it belongs in core.

### Packages own their boundaries

Packages communicate through typed contracts in `packages/protocol`. Don't import directly across package boundaries. If `packages/orchestrator` needs something from `packages/router`, it should go through a defined interface, not a direct file import.

### State belongs in Postgres

Don't introduce new persistence mechanisms. In-memory state is acceptable for ephemeral runtime data (active WebSocket connections, streaming buffers). Anything that should survive a restart goes in Postgres through `packages/db`.

### Blobs go through the artifact store

Don't write files directly to the filesystem from application code. Use `packages/artifacts` so the storage backend remains swappable.

### Side effects require approval

If you're adding a new worker capability that mutates external state (sends messages, writes to APIs, modifies files outside the sandbox), it must go through the approval system. Read-only capabilities can run autonomously.

### Tests cover the contract, not the implementation

Test what a package promises (its interface), not how it does it internally. This keeps tests stable across refactors.

---

## Areas where we especially need help

- **Skills and capabilities** — new worker skills (web scraping, data processing, image generation, etc.)
- **Provider adapters** — support for additional model providers beyond Anthropic, OpenAI, and Google
- **Messaging adapters** — Discord, Microsoft Teams, and other channels
- **Documentation** — guides, tutorials, examples, and better inline docs
- **Testing** — expanding coverage, especially for orchestration edge cases and approval flows
- **Security review** — sandbox isolation, artifact path traversal prevention, local companion scoping

---

## Code of conduct

Be respectful. Give constructive feedback. Assume good intent. We're building something in the open and that only works if people feel welcome contributing.

---

## Questions?

Open a discussion on GitHub. For quick questions, check existing issues and discussions first — someone may have already asked.

---

## License

By contributing to **Mycelium**, you agree that your contributions will be licensed under the MIT License.
