# Local Development

This repository is currently shipping the Milestone 5 review-queue-and-artifact-lineage slice on top of the Milestone 4 routing layer and the Milestone 3 execution substrate:

- Postgres-backed outcome storage
- Fastify control plane with outcome, draft-plan, run, log, and artifact APIs
- Outcome-scoped SSE for outcome, plan, run, step, log, and artifact lifecycle updates
- Local Docker sandbox execution with deterministic fork/join scheduling
- Encrypted workspace credentials plus auth profiles
- Router policy CRUD and deterministic route preview
- Approval-aware execution blocking and resume
- Review queue APIs and workspace review desk
- Durable artifact-lineage edges plus outcome-detail lineage inspection
- Next.js operator console for create, list, detail, settings, draft-plan, run timeline, review queue, persisted logs, and run artifact views

## Prerequisites

- Node.js `22.x`
- `pnpm` `10.17.0` or newer
- Docker Desktop or a local Docker engine

## Developer smoke checklist

1. Start Postgres with Docker Compose.
2. Push the Drizzle schema to the local database.
3. Start the control plane.
4. Start the web app.
5. Open the settings page and confirm provider catalog, credentials, auth profiles, and router policy load.
6. Create one workspace credential and one auth profile.
7. Save router policy for `reasoning`, `coding`, and `document`.
8. Preview `reasoning` and `document` and confirm provider/model/auth-profile selection stays stable across repeated previews.
9. Create an outcome from the web UI.
10. Generate a draft plan from the outcome detail page.
11. Start a run from the persisted plan.
12. Confirm the two middle draft steps finish before synthesis starts.
13. Confirm the selected run blocks on `Synthesize result` and the outcome detail page shows `Blocked on review`.
14. Confirm `/review` shows a pending `Review final result` approval for that run.
15. Approve the blocked work and confirm the run reaches `completed`.
16. Repeat with a second run and reject the blocked work, then confirm the run reaches `failed`.
17. Confirm the run timeline shows persisted route metadata on steps without breaking local Docker execution.
18. Confirm the artifact panel, lineage panel, log panel, and live activity panel update without a manual refresh.
19. Refresh the page and confirm persisted logs, artifacts, route badges, and lineage are still visible for the selected run.

## First-time setup

```bash
pnpm install
cp .env.example .env
cp apps/control-plane/.env.example apps/control-plane/.env.local
cp apps/web/.env.example apps/web/.env.local
# replace REPLACE_WITH_LOCAL_DB_PASSWORD in .env and apps/control-plane/.env.local
openssl rand -base64 32
# add the generated value as MYCELIUM_ENCRYPTION_KEY in apps/control-plane/.env.local
pnpm db:up
set -a; source .env; set +a; pnpm db:push
```

`pnpm db:push` is still the current schema bootstrap step for local development. The root command does not auto-load `.env`, so export the root env file first as shown above.
`pnpm db:push` waits for the local Postgres port to accept connections before it runs the schema sync.
The repository does not commit a database password. You must set your own local password in `.env` and `apps/control-plane/.env.local`.
`MYCELIUM_ENCRYPTION_KEY` is required for workspace-credential create and update operations. A local generated key is enough for development.
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
2. Open the settings page.
3. Create one workspace credential.
4. Create one auth profile for that credential.
5. Save router policy entries for `reasoning`, `coding`, and `document`.
6. Preview `reasoning` and `document` and confirm the selected provider, model, and auth profile stay the same on repeated previews. The preview timestamp changes because each preview is a fresh resolution.
7. The shipped plan uses `reasoning` once and `document` for the other three nodes, so keep `document` configured for the full M5 smoke path.
8. Submit a new outcome from the home page.
9. Confirm the new outcome appears in the list.
10. Open the outcome detail page.
11. Click `Generate draft plan` and confirm the four-node fork/join graph renders:
   `Analyze outcome`, `Draft brief`, `Draft operator summary`, and `Synthesize result`.
12. Click `Start run` and confirm the run timeline shows `Analyze outcome` finishing first, `Draft brief` and `Draft operator summary` finishing before `Synthesize result`, then blocking on review instead of auto-completing.
13. Confirm the selected run shows provider, model, auth profile, and route status badges plus the `Blocked on review` card.
14. Open [http://127.0.0.1:3000/review](http://127.0.0.1:3000/review) and confirm the pending `Review final result` approval is auto-selected.
15. Confirm the review detail shows the final artifact under review and that the outcome detail page renders an `Artifact lineage` panel for the selected run.
16. Approve the blocked work and confirm the run reaches `completed`.
17. Repeat with a second outcome and reject the blocked work. Confirm that run reaches `failed`.
18. Confirm the artifact panel shows exactly four persisted artifacts for the approved run:
   `artifacts/analyze-outcome.md`, `artifacts/brief.md`, `artifacts/operator-summary.md`, and `artifacts/final-result.md`.
19. Confirm the lineage panel shows deterministic `derived_from` edges for the selected run.
20. Confirm the log panel shows persisted step logs and still shows them after a page refresh.
21. In a second terminal, append a message through the control plane:

```bash
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/messages \
  -H 'content-type: application/json' \
  -d '{"role":"assistant","content":"Smoke path event from the control plane."}'
```

22. Confirm the detail page adds a new activity entry without a refresh.
23. Optional API verification for the same workspace and outcome:

```bash
curl http://127.0.0.1:4000/api/providers/models
curl -X POST http://127.0.0.1:3000/api/workspace-credentials \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","providerId":"anthropic","label":"Primary Anthropic key","secret":"sk-ant-..."}'
curl -X POST http://127.0.0.1:3000/api/auth-profiles \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","providerId":"anthropic","label":"Anthropic primary","credentialId":"<CREDENTIAL_ID>","priority":0,"status":"active"}'
curl -X PUT http://127.0.0.1:3000/api/router/policy \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","version":1,"updatedAt":"<ISO_TIMESTAMP>","candidates":[{"capability":"reasoning","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true},{"capability":"coding","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true},{"capability":"document","priority":0,"providerId":"anthropic","modelId":"claude-opus-4.6","authProfileId":"<PROFILE_ID>","enabled":true}]}'
curl -X POST http://127.0.0.1:3000/api/router/resolve-preview \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"ws_default","capability":"reasoning","policyVersion":1}'
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/plan
curl -X POST http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs \
  -H 'content-type: application/json' \
  -d '{"planId":"plan_<OUTCOME_ID>"}'
curl http://127.0.0.1:4000/api/outcomes/<OUTCOME_ID>/runs/latest
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/logs
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifacts
curl http://127.0.0.1:4000/api/runs/<RUN_ID>/artifact-lineage
curl "http://127.0.0.1:4000/api/approvals?workspaceId=ws_default"
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

If credential creation fails with `MYCELIUM_ENCRYPTION_KEY is required for credential writes.`, add `MYCELIUM_ENCRYPTION_KEY` to `apps/control-plane/.env.local`, restart the control plane, and retry.

If the web UI loads but shows no outcomes, verify `CONTROL_PLANE_URL` in `apps/web/.env.local` and check [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health).

If you already run Postgres locally on `5432`, that is expected. Mycelium uses `54321` locally to avoid connecting to the wrong database.

If runs stay queued or step execution fails immediately, verify Docker Desktop is running, confirm the host has enough free space to pull and start `node:22-bookworm-slim`, and check whether `SANDBOX_IMAGE` points at a valid local image.

If a run shows unresolved route badges on `Draft brief`, `Draft operator summary`, or `Synthesize result`, verify the router policy includes a `document` candidate. The default M3 draft plan uses `document` for those three nodes.

If a run completes immediately instead of blocking for review, verify the selected run is using the current default draft plan. M5 only pauses on the review-required `Synthesize result` step in that shipped four-node plan.
