# Mycelium

**Your own AI computer. Your keys. Your models. Your data.**

Mycelium is an open-source control plane for outcome-driven AI work. The long-term product is an open-source Perplexity Computer: give it an outcome, let it decompose and coordinate the work, keep execution under your control, and bring your own model keys.

The repository is currently in `Milestone 1: Foundation`. This slice is intentionally narrow and production-shaped:

- shared protocol schemas for outcomes and realtime events
- a Postgres-backed Fastify control plane with outcome CRUD
- SSE streaming for outcome activity
- a Next.js command center that can create outcomes, list them, and watch live activity

What is **not** built yet:

- task graph execution
- provider routing and BYO key policy
- worker daemons and sandboxes
- long-running orchestration memory
- browser or cross-app computer use

## Quickstart

```bash
git clone https://github.com/rajat1299/Mycelium.git
cd Mycelium
pnpm install
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
pnpm db:up
pnpm db:push
pnpm dev
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000).

For the full local smoke path, see [docs/setup-local-dev.md](./docs/setup-local-dev.md).
The local Postgres container binds to `127.0.0.1:54321` to avoid colliding with a host Postgres on `5432`.

## Current architecture slice

```text
apps/web            Next.js operator console
apps/control-plane  Fastify API + SSE
packages/protocol   Shared Zod contracts
packages/db         Drizzle schema + repositories
```

The current flow is:

1. the web app creates an outcome through the control plane
2. the control plane persists it in Postgres
3. the outcome list renders current state
4. the outcome detail page subscribes to SSE events for live updates

## Documentation

- [Local development](./docs/setup-local-dev.md)
- [Product vision](./docs/01-product-vision.md)
- [Architecture](./docs/02-architecture.md)
- [System design](./docs/03-system-design.md)
- [Technical spec](./docs/04-technical-spec.md)
- [Reference extraction map](./docs/05-reference-extraction-map.md)
- [Frontend and UX](./docs/06-frontend-and-ux.md)
- [Milestone 1 implementation plan](./docs/plans/2026-03-11-milestone-1-foundation-implementation.md)

## Commands

```bash
pnpm test
pnpm typecheck
pnpm db:up
pnpm db:push
pnpm dev
pnpm db:down
```

## Reference projects

Mycelium is being designed by extracting the best engineering patterns from:

- [OpenClaw](https://github.com/openclaw/openclaw)
- [Terragon OSS](https://github.com/terragon-labs/terragon-oss)
- [Middleman](https://github.com/SawyerHood/middleman)
- [Deer Flow](https://github.com/bytedance/deer-flow)

The extraction notes and product design docs are committed in this repository so new engineers and agent sessions can start from shared context.

## License

MIT
