# Agent Runbook

Use this file as the first stop for any Codex agent working on Mycelium.

## What this repository is

Mycelium is an open-source control plane for outcome-driven AI work. The currently implemented slice is `Milestone 1: Foundation`:

- `apps/control-plane`: Fastify API and SSE runtime
- `apps/web`: Next.js operator console
- `packages/protocol`: shared contracts
- `packages/db`: Drizzle schema and repositories

Read these next:

1. [Local development](/Users/rajattiwari/swarm/computer-oss/docs/setup-local-dev.md)
2. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
3. [System design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
4. [Milestone 1 implementation plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-1-foundation-implementation.md)

## Local setup

Run from the repo root:

```bash
pnpm install
cp .env.example .env
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
```

Then replace `REPLACE_WITH_LOCAL_DB_PASSWORD` in:

- `.env`
- `apps/control-plane/.env.local`

Start the local database and sync the schema:

```bash
pnpm db:up
pnpm db:push
```

Start the application stack:

```bash
pnpm dev
```

Local endpoints:

- web: `http://127.0.0.1:3000`
- control plane: `http://127.0.0.1:4000/health`
- postgres: `127.0.0.1:54321`

## Verification

Run these before handing work back for review:

```bash
pnpm test
pnpm typecheck
pnpm build
```

If the task touches the running stack, also verify:

```bash
curl http://127.0.0.1:4000/health
```

## Stop commands

Stop the local app processes started by `pnpm dev` with `Ctrl+C`.

Stop the project database:

```bash
pnpm db:down
```

If you need to clear local state:

```bash
docker compose down -v
```

## Working agreement for agents

- Do implementation work on a `codex/*` branch, not directly on `main`.
- Keep `main` as the integration branch that gets reviewed and merged after verification.
- Do not commit secrets or local passwords. Use placeholders in tracked files and real values only in ignored env files.
- Prefer additive docs updates when the setup, architecture, or workflow changes.
- If you change the local startup flow, update both [setup-local-dev.md](/Users/rajattiwari/swarm/computer-oss/docs/setup-local-dev.md) and this runbook.

## Current review workflow

The human is using a separate review/planning window for architecture, code review, and task breakdown. Implementation agents should keep changes scoped, verified, and easy to review in chunks.
