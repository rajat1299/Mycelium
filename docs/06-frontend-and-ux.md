# Frontend and UX

## Framework decision

Use `Next.js + React + TypeScript` for `apps/web`.

That means:

- `React` is the UI programming model you already know
- `Next.js` is the app shell, routing layer, and deployment-friendly web framework
- `TypeScript` is non-negotiable because the product depends on typed contracts across APIs, events, and orchestration state

## Why not plain React only

A plain React SPA would work, but it gives up useful structure too early:

- weaker conventions around routing and layout
- more hand-rolled app shell decisions
- less ergonomic server-side surfaces when we need them
- more glue for auth, settings pages, and artifact downloads

If this were a lightweight chat UI, Vite + React would be fine. This is an operator console for a long-running control plane, so the app framework helps.

## Why not put the backend inside Next.js

Do not turn Next.js route handlers into the orchestration backend.

Keep:

- `apps/web` as the operator console
- `apps/control-plane` as the actual product runtime

That separation matters because the control plane owns:

- scheduling
- approvals
- run coordination
- worker streaming
- provider routing
- durable state transitions

Those concerns should not be trapped inside a UI server.

## Recommended frontend stack

- `Next.js`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `Radix UI` or another headless primitive layer
- `TanStack Query` for server state
- lightweight local UI state store only where needed

## UI information architecture

The primary navigation should be:

- `Outcomes`
- `Runs`
- `Approvals`
- `Artifacts`
- `Schedules`
- `Router`
- `Settings`

The product should not feel like a chat app with extra tabs. It should feel like a command center for ongoing work.

## Design direction

The UI should optimize for:

- live visibility into running work
- quick approval and intervention
- inspectable artifacts and logs
- explicit routing and cost visibility
- low-friction recovery from failure

The UI should avoid:

- anthropomorphic assistant aesthetics
- chat-first layouts as the only main surface
- hidden state changes
- decorative dashboards that do not help operators act

## Key screens for v1

- outcome list and filters
- outcome detail with graph, activity, chat, and artifacts
- run detail with logs and checkpoint state
- approval queue
- router policy editor
- schedule list and editor
- workspace/provider settings

## Frontend implementation rules

- consume typed contracts from `packages/protocol`
- treat WebSocket or SSE events as the source of truth for live updates
- keep optimistic UI narrow and auditable
- never bury approval-required state changes behind silent auto-refresh

## Recommendation summary

The correct answer is not `React or Next.js`.

The correct answer is:

`Next.js for the web application, React for the component model, TypeScript for the entire product surface.`
