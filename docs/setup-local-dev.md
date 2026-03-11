# Local Development

This repository is currently shipping the Milestone 1 foundation slice:

- Postgres-backed outcome storage
- Fastify control plane with outcome CRUD and SSE
- Next.js command center for create, list, and detail views

## Prerequisites

- Node.js `22.x`
- `pnpm` `10.17.0` or newer
- Docker Desktop or a local Docker engine

## Developer smoke checklist

1. Start Postgres with Docker Compose.
2. Push the Drizzle schema to the local database.
3. Start the control plane.
4. Start the web app.
5. Create an outcome from the web UI.
6. Confirm it appears in the list and that the detail view receives an SSE update.

## First-time setup

```bash
pnpm install
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
pnpm db:up
pnpm db:push
```

`pnpm db:push` is the current schema bootstrap step for Milestone 1. We are using `drizzle-kit push` locally before committed SQL migrations land in a later milestone.
`pnpm db:push` waits for the local Postgres port to accept connections before it runs the schema sync.

## Start the stack

```bash
pnpm dev
```

Expected local services:

- web: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- control plane: [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)
- postgres: `127.0.0.1:54321`

## Manual smoke path

1. Open the web app at [http://127.0.0.1:3000](http://127.0.0.1:3000).
2. Submit a new outcome from the home page.
3. Confirm the new outcome appears in the list.
4. Open the outcome detail page.
5. In a second terminal, append a message through the control plane:

```bash
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/messages \
  -H 'content-type: application/json' \
  -d '{"role":"assistant","content":"Smoke path event from the control plane."}'
```

6. Confirm the detail page adds a new activity entry without a refresh.

## Verification commands

```bash
pnpm test
pnpm typecheck
curl http://127.0.0.1:4000/health
```

## Useful commands

```bash
pnpm db:up
pnpm db:push
pnpm dev
pnpm dev:control-plane
pnpm dev:web
pnpm db:down
```

## Troubleshooting

If the control plane exits with a `DATABASE_URL` validation error, the app-local env file is missing. Copy `apps/control-plane/.env.example` to `apps/control-plane/.env.local`.

If outcome creation fails with database relation errors, rerun `pnpm db:push`.

If the web UI loads but shows no outcomes, verify `CONTROL_PLANE_URL` in `apps/web/.env.local` and check [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health).

If you already run Postgres locally on `5432`, that is expected. Mycelium uses `54321` locally to avoid connecting to the wrong database.
