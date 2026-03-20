# One-Submit Execution Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current multi-click operator entry flow with a one-submit user flow while preserving the existing backend `outcome -> plan -> run` model and current control-plane behavior.

**Architecture:** The rewrite is staged. First, home submit auto-starts outcome bootstrap. Then the outcome page is re-rendered as a conversation-style execution surface built from the existing data-loading path and SSE stream. Existing operator panels move into a secondary drawer instead of being removed.

**Tech stack:** `pnpm`, `TypeScript`, `Vitest`, `Next.js`, `React`, `Tailwind CSS`

---

## Required reading

Read these before implementation:

1. [Product Vision](/Users/rajattiwari/swarm/computer-oss/docs/01-product-vision.md)
2. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
3. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
4. [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md)
5. [One-Submit Execution Flow Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-19-one-submit-execution-flow-design.md)
6. [spell-ui.md](/Users/rajattiwari/swarm/spell-ui.md)

## Non-negotiable rules for implementation

- preserve the current backend model and APIs
- keep the current design language and recently introduced shell primitives
- use TDD for each behavior change
- after every meaningful chunk:
  - self-review the diff
  - rerun focused verification
  - commit before starting the next chunk
- do not remove `/review`; inline approval is additive
- do not rewrite `/settings` in this effort

## Chunk sequence

### Chunk 1: Home submit auto-start

**Goal:** Make home submit create outcome, draft plan, and run automatically.

**Files:**
- Create: `apps/web/lib/home-submit.ts`
- Create: `apps/web/lib/home-submit.test.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.test.tsx`

**Steps:**

1. Write failing tests for:
   - successful chained bootstrap
   - plan bootstrap failure redirect state
   - run bootstrap failure redirect state
2. Extract the home bootstrap behavior into `apps/web/lib/home-submit.ts`
3. Update `app/page.tsx` to use the helper and redirect with bootstrap state
4. Add a minimal inline bootstrap error surface on the outcome page
5. Run focused tests, typecheck, and build
6. Self-review the diff twice
7. Commit

### Chunk 2: Conversation scaffolding on the outcome page

**Goal:** Replace the primary operator-console layout with a conversation-first task view while keeping existing data loading.

**Files:**
- Create: `apps/web/components/outcomes/outcome-conversation.tsx`
- Create: `apps/web/components/outcomes/system-message-card.tsx`
- Create: `apps/web/components/outcomes/subtask-plan-card.tsx`
- Create: `apps/web/components/outcomes/subtask-execution-card.tsx`
- Create: `apps/web/components/outcomes/outcome-conversation.test.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/execution-console.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.test.tsx`

**Steps:**

1. Write failing tests for:
   - plan checklist rendering
   - step execution cards appearing from run state
   - current prompt header rendering
2. Build a derived conversation-entry mapper from currently loaded run, step, log, and artifact state
3. Render the conversation stream in the main column
4. Keep existing operator components reachable during the transition
5. Run focused web tests
6. Self-review the diff twice
7. Commit

### Chunk 3: Inline approval gate

**Goal:** Make the current outcome page the primary place to resolve approvals.

**Files:**
- Create: `apps/web/components/outcomes/approval-gate-card.tsx`
- Modify: `apps/web/components/outcomes/outcome-conversation.tsx`
- Modify: `apps/web/components/outcomes/execution-console.tsx`
- Modify: `apps/web/lib/api.ts`
- Create or modify tests under:
  - `apps/web/components/outcomes/outcome-conversation.test.tsx`
  - `apps/web/components/outcomes/execution-console.test.tsx`

**Steps:**

1. Write failing tests for inline approve and reject behavior
2. Render approval cards in the conversation stream
3. Wire approve and reject actions to existing web proxies
4. Keep `/review` unchanged
5. Run focused web tests
6. Self-review the diff twice
7. Commit

### Chunk 4: Artifact delivery and operator drawer

**Goal:** Deliver artifacts inline and move advanced panels behind a drawer.

**Files:**
- Create: `apps/web/components/outcomes/artifact-delivery-card.tsx`
- Create: `apps/web/components/outcomes/operator-drawer.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify: `apps/web/components/outcomes/outcome-conversation.tsx`
- Modify related tests

**Steps:**

1. Write failing tests for:
   - final artifact delivery card
   - operator drawer toggle and contents
2. Move current advanced panels into the drawer
3. Keep artifact delivery visible inline in the main stream
4. Run focused web tests
5. Self-review the diff twice
6. Commit

### Chunk 5: Follow-up input and tasks navigation polish

**Goal:** Add follow-up input and make task navigation feel consistent with the new flow.

**Files:**
- Create: `apps/web/components/outcomes/follow-up-input.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/outcomes/[id]/page.tsx`
- Modify related tests

**Steps:**

1. Write failing tests for follow-up input submission and tasks navigation rendering
2. Add follow-up input to the outcome page
3. Add or refine tasks navigation in the shell
4. Remove obsolete primary affordances from the main outcome surface
5. Run focused web tests
6. Self-review the diff twice
7. Commit

### Chunk 6: Final polish and regression pass

**Goal:** Finish the rewrite and ensure it is coherent across desktop and mobile.

**Files:**
- Modify any touched web UI files
- Update page tests and component tests as needed

**Steps:**

1. Run full web verification
2. Fix responsive and visual regressions
3. Remove any dead code left from the old primary flow
4. Self-review the full diff multiple times
5. Commit the final chunk

## Verification commands

After each chunk:

```bash
pnpm --filter @computer-oss/web test
pnpm --filter @computer-oss/web typecheck
pnpm --filter @computer-oss/web build
git diff --check
```

At the end of the rewrite:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Implementation notes

- chunk 1 should preserve the current operator-console layout so the app stays usable immediately after auto-start lands
- do not hide low-level operator visibility until the drawer replacement exists
- if any chunk leaves a temporary mismatch between visuals and behavior, keep the behavior correct and finish the matching UI in the next chunk immediately
