# Local Development

This repository is currently shipping the Milestone 3 execution-substrate slice:

- Postgres-backed outcome storage
- Fastify control plane with outcome, draft-plan, run, log, and artifact APIs
- Outcome-scoped SSE for outcome, plan, run, step, log, and artifact lifecycle updates
- Local Docker sandbox execution with deterministic fork/join scheduling
- Next.js operator console for create, list, detail, draft-plan, run timeline, persisted logs, and run artifact views

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
6. Generate a draft plan from the outcome detail page.
7. Start a run from the persisted plan.
8. Confirm the two middle draft steps finish before synthesis starts.
9. Confirm the run timeline, artifact panel, log panel, and live activity panel update without a manual refresh.
10. Refresh the page and confirm persisted logs and artifacts are still visible for the selected run.

## First-time setup

```bash
pnpm install
cp .env.example .env
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
# replace REPLACE_WITH_LOCAL_DB_PASSWORD in .env and apps/control-plane/.env.local
pnpm db:up
set -a; source .env; set +a; pnpm db:push
```

`pnpm db:push` is still the current schema bootstrap step for local development. The root command does not auto-load `.env`, so export the root env file first as shown above.
`pnpm db:push` waits for the local Postgres port to accept connections before it runs the schema sync.
The repository does not commit a database password. You must set your own local password in `.env` and `apps/control-plane/.env.local`.
The local Docker sandbox defaults to `node:22-bookworm-slim`. If you need a different local image, set `SANDBOX_IMAGE` in `apps/control-plane/.env.local`.

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
5. Click `Generate draft plan` and confirm the four-node fork/join graph renders:
   `Analyze outcome`, `Draft brief`, `Draft operator summary`, and `Synthesize result`.
6. Click `Start run` and confirm the run timeline shows `Analyze outcome` finishing first, `Draft brief` and `Draft operator summary` finishing before `Synthesize result`, and the run reaching `completed`.
7. Confirm the artifact panel shows exactly four persisted artifacts for the run:
   `artifacts/analyze-outcome.md`, `artifacts/brief.md`, `artifacts/operator-summary.md`, and `artifacts/final-result.md`.
8. Confirm the log panel shows persisted step logs and still shows them after a page refresh.
9. In a second terminal, append a message through the control plane:

```bash
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/messages \
  -H 'content-type: application/json' \
  -d '{"role":"assistant","content":"Smoke path event from the control plane."}'
```

10. Confirm the detail page adds a new activity entry without a refresh.
11. Optional API verification for the same outcome:

```bash
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs \
  -H 'content-type: application/json' \
  -d '{"planId":"plan_<OUTCOME_ID>"}'
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs/latest
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/logs
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifacts
curl -N http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/events
```

## Verification commands

```bash
pnpm test
pnpm typecheck
pnpm build
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

If `pnpm db:push` fails with a `DATABASE_URL` validation error from the repo root, rerun it with `set -a; source .env; set +a; pnpm db:push` so the root shell exports the database URL first.

If outcome creation fails with authentication or relation errors, verify the password in `.env` matches `apps/control-plane/.env.local`, then rerun `set -a; source .env; set +a; pnpm db:push`.

If the web UI loads but shows no outcomes, verify `CONTROL_PLANE_URL` in `apps/web/.env.local` and check [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health).

If you already run Postgres locally on `5432`, that is expected. Mycelium uses `54321` locally to avoid connecting to the wrong database.

If runs stay queued or step execution fails immediately, verify Docker Desktop is running, confirm the host has enough free space to pull and start `node:22-bookworm-slim`, and check whether `SANDBOX_IMAGE` points at a valid local image.
