# Milestone 1 Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bootstrap the Computer OSS monorepo and ship a working first slice with typed contracts, a Postgres-backed control-plane skeleton, and a minimal web command center for creating and viewing outcomes.

**Architecture:** Start with the smallest production-shaped slice of the architecture rather than scaffolding every package up front. This milestone creates the monorepo root, `packages/protocol`, `packages/db`, `apps/control-plane`, and `apps/web`, with the control plane owning HTTP plus SSE and the web app consuming typed contracts from shared packages.

**Tech Stack:** `pnpm`, `turbo`, `TypeScript`, `Vitest`, `Zod`, `Fastify`, `Drizzle ORM`, `Postgres`, `Next.js`, `React`, `Tailwind CSS`

---

## Scope for this milestone

In scope:

- monorepo bootstrap
- shared protocol schemas and event types
- core database schema for workspace, outcome, outcome_message, artifact, approval, and router_policy
- control-plane HTTP API for health and outcome CRUD
- SSE event stream for outcome updates
- web command center with outcome list, create form, and outcome detail view
- local dev Postgres via Docker Compose

Out of scope:

- task graph execution
- provider routing engine behavior
- worker daemons and remote sandboxes
- messaging adapters
- schedules
- local companion

### Task 1: Bootstrap the monorepo root and shared protocol package

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/outcome.ts`
- Create: `packages/protocol/src/events.ts`
- Create: `packages/protocol/src/outcome.test.ts`
- Modify: `.gitignore`

**Step 1: Create the workspace root and the failing protocol test**

Add a failing schema test first:

```ts
import { describe, expect, it } from "vitest";
import { OutcomeSchema, OutcomeStatusSchema } from "./index";

describe("OutcomeSchema", () => {
  it("accepts a valid outcome payload", () => {
    const parsed = OutcomeSchema.safeParse({
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Summarize the latest incident report",
      source: "web",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    expect(OutcomeStatusSchema.parse("draft")).toBe("draft");
  });
});
```

Root scripts should expose:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  }
}
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm install
pnpm --filter @computer-oss/protocol test
```

Expected: FAIL because `OutcomeSchema` and `OutcomeStatusSchema` do not exist yet.

**Step 3: Implement the minimal shared protocol package**

Use `zod` schemas for:

- outcome status enum
- source enum for `web | slack | telegram`
- outcome shape
- outcome create request
- outcome list response
- server-sent event envelope

Export everything from `packages/protocol/src/index.ts`.

**Step 4: Run the test and typecheck**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/protocol typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add .gitignore package.json pnpm-workspace.yaml turbo.json tsconfig.base.json packages/protocol
git commit -m "feat: bootstrap monorepo and protocol package"
```

### Task 2: Add the database package and core schema

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/repositories/outcomes.ts`
- Create: `packages/db/src/schema.test.ts`

**Step 1: Write the failing schema test**

Create a test that proves the status enum and outcome table are exported:

```ts
import { describe, expect, it } from "vitest";
import { outcomeStatusEnum, outcomes } from "./index";

describe("db schema", () => {
  it("exports the outcome table and status enum", () => {
    expect(outcomes[Symbol.for("drizzle:Name")]).toBe("outcomes");
    expect(outcomeStatusEnum.enumValues).toContain("draft");
    expect(outcomeStatusEnum.enumValues).toContain("running");
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/db test
```

Expected: FAIL because the package and exports do not exist yet.

**Step 3: Implement the minimal DB package**

Create:

- Postgres client factory using environment variables
- Drizzle schema for:
  - `workspaces`
  - `users`
  - `outcomes`
  - `outcome_messages`
  - `artifacts`
  - `approvals`
  - `router_policies`
- a small `OutcomeRepository` with:
  - `create`
  - `getById`
  - `listByWorkspace`
  - `appendMessage`

Use string IDs for now. Do not add plan graph tables in this milestone.

**Step 4: Run the test and typecheck**

Run:

```bash
pnpm --filter @computer-oss/db test
pnpm --filter @computer-oss/db typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example packages/db
git commit -m "feat: add core database package and schema"
```

### Task 3: Build the control-plane app with health and outcome CRUD

**Files:**
- Create: `apps/control-plane/package.json`
- Create: `apps/control-plane/tsconfig.json`
- Create: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/src/server.ts`
- Create: `apps/control-plane/src/lib/env.ts`
- Create: `apps/control-plane/src/lib/repositories.ts`
- Create: `apps/control-plane/src/routes/health.ts`
- Create: `apps/control-plane/src/routes/outcomes.ts`
- Create: `apps/control-plane/test/app.test.ts`

**Step 1: Write the failing API test**

Use Fastify `inject` and a fake repository:

```ts
import { buildApp } from "../src/app";
import { describe, expect, it } from "vitest";

describe("control plane", () => {
  it("creates and fetches an outcome", async () => {
    const app = buildApp();

    const create = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft a project kickoff brief",
        source: "web",
      },
    });

    expect(create.statusCode).toBe(201);
    const created = create.json();

    const read = await app.inject({
      method: "GET",
      url: `/api/outcomes/${created.id}`,
    });

    expect(read.statusCode).toBe(200);
    expect(read.json().prompt).toBe("Draft a project kickoff brief");
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
```

Expected: FAIL because the app and routes do not exist yet.

**Step 3: Implement the control-plane skeleton**

Use:

- `Fastify` for HTTP
- `@computer-oss/protocol` for request and response validation
- a repository interface in `src/lib/repositories.ts`
- an in-memory repository only inside tests
- the real DB-backed repository wiring in runtime code

Routes to implement now:

- `GET /health`
- `POST /api/outcomes`
- `GET /api/outcomes/:id`
- `GET /api/outcomes`
- `POST /api/outcomes/:id/messages`

**Step 4: Run tests, then start the server locally**

Run:

```bash
pnpm --filter @computer-oss/control-plane test
pnpm --filter @computer-oss/control-plane typecheck
pnpm --filter @computer-oss/control-plane dev
```

Expected: tests PASS and the server exposes `GET /health`.

**Step 5: Commit**

```bash
git add apps/control-plane
git commit -m "feat: add control-plane outcome api skeleton"
```

### Task 4: Add the outcome SSE stream and protocol-aligned event publishing

**Files:**
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `apps/control-plane/src/lib/event-bus.ts`
- Create: `apps/control-plane/src/routes/outcome-events.ts`
- Modify: `apps/control-plane/src/app.ts`
- Create: `apps/control-plane/test/outcome-events.test.ts`

**Step 1: Write the failing SSE test**

Create a test around the event formatter and route registration:

```ts
import { describe, expect, it } from "vitest";
import { formatSseEvent } from "../src/lib/event-bus";

describe("formatSseEvent", () => {
  it("serializes a protocol event into SSE format", () => {
    const body = formatSseEvent({
      type: "outcome.updated",
      data: { id: "outcome_123", status: "running" },
    });

    expect(body).toContain("event: outcome.updated");
    expect(body).toContain('"status":"running"');
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/control-plane test -- outcome-events
```

Expected: FAIL because the event bus and SSE route do not exist.

**Step 3: Implement minimal realtime plumbing**

Add:

- protocol event envelope types in `packages/protocol`
- a small in-process event bus
- `GET /api/outcomes/:id/events`
- event publication on outcome create and message append

Use SSE first. Do not add WebSockets in this milestone.

**Step 4: Run tests**

Run:

```bash
pnpm --filter @computer-oss/protocol test
pnpm --filter @computer-oss/control-plane test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/protocol apps/control-plane
git commit -m "feat: add outcome event stream"
```

### Task 5: Create the Next.js operator console shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/outcomes/[id]/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/components/outcomes/new-outcome-form.tsx`
- Create: `apps/web/components/outcomes/outcome-list.tsx`
- Create: `apps/web/components/outcomes/outcome-activity.tsx`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/events.ts`
- Create: `apps/web/lib/types.ts`
- Create: `apps/web/components/outcomes/outcome-list.test.tsx`

**Step 1: Write the failing UI test**

Create a small component test:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutcomeList } from "./outcome-list";

describe("OutcomeList", () => {
  it("renders outcome prompts and statuses", () => {
    render(
      <OutcomeList
        outcomes={[
          { id: "outcome_1", prompt: "Prepare release notes", status: "running" },
        ]}
      />,
    );

    expect(screen.getByText("Prepare release notes")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @computer-oss/web test
```

Expected: FAIL because the web app and component do not exist yet.

**Step 3: Implement the minimal web shell**

Build:

- home page listing outcomes
- create-outcome form posting to the control plane
- outcome detail page
- activity panel consuming the SSE stream

Use shared protocol types instead of duplicating request or response shapes.

**Step 4: Run tests and boot the app**

Run:

```bash
pnpm --filter @computer-oss/web test
pnpm --filter @computer-oss/web typecheck
pnpm --filter @computer-oss/web dev
```

Expected: tests PASS and the home page loads.

**Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add web command center shell"
```

### Task 6: Wire local development and baseline verification

**Files:**
- Modify: `README.md`
- Create: `apps/control-plane/.env.example`
- Create: `apps/web/.env.example`
- Create: `docs/setup-local-dev.md`

**Step 1: Write the failing developer smoke checklist**

Document the smoke path before wiring the scripts:

```md
1. Start Postgres with Docker Compose
2. Run database migrations
3. Start control plane
4. Start web app
5. Create an outcome from the web UI
6. Confirm it appears in the list and streams an update event
```

**Step 2: Run the current setup to verify the gaps**

Run:

```bash
docker compose up -d
pnpm dev
```

Expected: one or more missing setup steps or environment variables. Capture them and fix them in docs and scripts.

**Step 3: Add the missing developer wiring**

Ensure:

- env files are documented
- database startup is explicit
- root README links to local setup
- root scripts are enough to boot the core services

**Step 4: Run the full smoke flow**

Run:

```bash
docker compose up -d
pnpm install
pnpm test
pnpm typecheck
pnpm dev
```

Expected:

- tests PASS
- typecheck PASS
- web and control-plane apps boot locally

**Step 5: Commit**

```bash
git add README.md apps/control-plane/.env.example apps/web/.env.example docs/setup-local-dev.md
git commit -m "docs: add local development workflow"
```

## Final verification checklist

Before calling the milestone complete:

- `pnpm test` passes at the workspace root
- `pnpm typecheck` passes at the workspace root
- `docker compose up -d` starts Postgres successfully
- `POST /api/outcomes` works end-to-end
- the web UI can create and display outcomes
- the outcome detail page receives SSE updates

## Recommended execution order

Implement Tasks `1 -> 6` in order. Do not parallelize them until the monorepo root exists and shared contracts are stable.
