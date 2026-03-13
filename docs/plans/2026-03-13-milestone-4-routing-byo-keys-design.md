# Milestone 4 Routing and BYO Keys Design

## Purpose

Milestone 4 exists to make Mycelium's provider and model selection explicit, durable, and user-controlled.

Milestone 3 proved that the orchestration kernel can:

- produce an executable dependency graph
- schedule dependencies correctly
- execute fork/join work in real local sandboxes
- persist logs and artifacts

What it does **not** prove yet is the core product claim behind "Your keys. Your models. Your data."

The thing we need to prove in M4 is:

- a workspace can declare which providers and models it wants to use
- a workspace can store BYO credentials safely
- the control plane can resolve a plan step to a concrete provider/model/auth profile deterministically
- those routing decisions are persisted and inspectable
- operators can change policy without editing code or env files

M4 is the control-plane milestone for routing. It is not the milestone for real provider-backed worker execution.

## Approved direction

Approved on `2026-03-13`:

- build a `DB-backed routing and BYO-key control plane`
- add a static provider/model capability registry
- add encrypted workspace-scoped credential storage
- add named auth profiles separate from raw secret storage
- add workspace router policy CRUD and route-preview APIs
- persist routing decisions on run steps
- expose routing configuration and routing decisions in the web operator console

We are **not** using M4 to add live provider worker adapters yet.

## Options considered

### Option 1: Env-only keys plus hardcoded YAML policy

Pros:

- fastest implementation
- minimal schema work
- easy for local development

Cons:

- not multi-workspace
- not inspectable in the product
- no auth profile abstraction
- no durable operator-controlled policy changes
- does not match the product claim

Rejected because it is a developer convenience layer, not a product control plane.

### Option 2: DB-backed encrypted credentials plus static catalog and deterministic resolver

Pros:

- explicit operator experience
- durable workspace-scoped policy
- strong fit for self-hosted BYO-key positioning
- clear path to future provider-backed execution
- keeps the unstable vendor surface behind one routing boundary

Cons:

- more schema and API work
- requires an encryption key in local env
- introduces settings UI before broader product surfaces exist

Approved because it gives us the right product kernel without dragging in provider execution too early.

### Option 3: Dynamic provider probing with auto-discovered models and live key verification

Pros:

- more automated user experience
- fresher model availability
- can validate real provider connectivity

Cons:

- high vendor-specific complexity
- unstable behavior across providers
- requires external API contracts before we need them
- would slow the milestone and widen the failure surface

Rejected as premature. M4 should establish the routing contract first. Dynamic probing can land later.

## M4 scope

### In scope

- `packages/router`
- shared routing/auth protocol contracts
- static provider/model capability registry
- encrypted workspace-scoped credential storage
- named auth profiles
- workspace router policy CRUD
- deterministic route resolution and route preview
- persisted run-step routing metadata
- operator-console settings surface for keys and routing
- operator-console display of resolved step routes
- budget/cost metadata groundwork

### Out of scope

- real Anthropic/OpenAI/Gemini worker adapters
- live provider inference inside sandbox execution
- live network key validation against provider APIs
- automatic model catalog sync from vendors
- spend metering and billing
- review queue expansion
- schedules and messaging

## Design principles

1. Keep model identity, credential identity, and execution runtime identity separate.
2. Make routing explicit and inspectable at both policy time and run time.
3. Keep provider-specific complexity behind a stable resolver boundary.
4. Do not break the M3 local execution path while M4 lands.
5. Prefer static catalogs and deterministic resolution over vendor-driven magic.

## Reference extraction map for M4

M4 should extract ideas selectively from the four reference repos. Do not lift whole subsystems unchanged.

### OpenClaw

Read:

- `/Users/rajattiwari/swarm/openclaw/src/agents/models-config.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/models-config.providers.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/provider-capabilities.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/auth-profiles.ts`
- `/Users/rajattiwari/swarm/openclaw/src/agents/pi-auth-credentials.ts`
- `/Users/rajattiwari/swarm/openclaw/src/channels/model-overrides.ts`
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)
- [openclaw-reduction-map.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-reduction-map.md)

Extract:

- separation between model identity and credential identity
- provider capability metadata and model-catalog normalization
- named auth-profile indirection over raw credentials
- state-reset discipline when provider, model, or profile changes

Do not inherit:

- channel-centric session state
- provider-specific sprawl
- the existing assistant-first UI shell

### Terragon

Read:

- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/db/schema.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/model/agent-provider-credentials.ts`
- `/Users/rajattiwari/swarm/terragon-oss/packages/env/src/common.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/credentials.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-actions/credentials.ts`
- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)

Extract:

- schema discipline for provider-linked credentials
- env and secret-handling hygiene
- repository and server-action boundaries around credential mutations

Do not inherit:

- hosted SaaS assumptions
- user/account/billing surface area we do not need for M4

### Middleman

Read:

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-factory.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/runtime-types.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/swarm/swarm-manager.ts`
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

Extract:

- explicit runtime and capability selection boundaries
- manager-owned policy decisions that stay deterministic and inspectable

Do not inherit:

- file-backed runtime persistence
- local-only execution assumptions

### Deer Flow

Read:

- `/Users/rajattiwari/swarm/deer-flow/backend/src/config/model_config.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/agents/thread_state.py`
- `/Users/rajattiwari/swarm/deer-flow/frontend/src/core/artifacts/loader.ts`

Extract:

- compact model-metadata ideas
- inspectable thread or run state presentation
- UI instincts for route or artifact metadata surfacing

Do not inherit:

- LangGraph-specific execution assumptions
- thread-centric runtime ownership

## Product shape for M4

M4 should give the operator a new settings flow:

- view the supported provider/model catalog
- add workspace credentials
- create named auth profiles
- define routing policy per capability family
- preview how a capability would resolve before starting a run
- inspect the resolved route on each persisted run step

The outcome and execution flow remain the same as M3. The new layer is control and observability around provider/model selection.

## Architecture summary

M4 adds four new domain areas:

1. `Provider and model registry`
2. `Encrypted credentials and auth profiles`
3. `Workspace router policy`
4. `Step route resolution`

These sit between the orchestration package and the execution service.

The control plane remains authoritative:

- the router resolves decisions
- the DB persists decisions
- the web app reads and edits policy
- the execution service consumes persisted route decisions later

The M3 local sandbox path continues to run regardless of whether a step has a configured external route. In M4, routing is authoritative for control-plane state, but not yet for runtime execution.

## Non-negotiable invariants

Agents implementing M4 must preserve these invariants:

1. Plaintext secrets only exist at the control-plane write boundary. They must never be persisted, logged, streamed, or returned to the web app after submission.
2. Credential ownership is workspace-scoped. Cross-workspace references between credentials, auth profiles, policy candidates, and runs are invalid.
3. Provider, model, and auth profile must stay internally consistent. A route cannot point to an auth profile for one provider and a model for another.
4. Route resolution must be deterministic. The same catalog, policy, and profile set must always resolve the same result.
5. Unresolved routing is explicit state, not a silent fallback. If routing fails, the step stores unresolved diagnostics.
6. M4 must not break M3 execution. The local sandbox path remains the runtime until a later milestone replaces it.

## Domain model

### Provider definition

Static, code-defined metadata describing a supported provider.

Minimum fields:

- `id`
- `label`
- `authType`
- `supportsCapabilities`
- `supportsStreaming`
- `supportsReasoning`
- `supportsVision`
- `docsUrl`

Examples:

- `anthropic`
- `openai`
- `google`
- `xai`
- `openrouter`

### Model definition

Static, code-defined metadata for one model under one provider.

Minimum fields:

- `providerId`
- `modelId`
- `label`
- `capabilityFamilies`
- `contextWindow`
- `costClass`
- `latencyClass`
- `status`

`costClass` and `latencyClass` are groundwork metadata for later budget-aware routing. M4 does not need exact vendor billing math.

### Workspace credential

Represents one encrypted secret blob owned by one workspace.

Minimum fields:

- `id`
- `workspaceId`
- `providerId`
- `label`
- `secretCiphertext`
- `secretNonce`
- `secretVersion`
- `status`
- `createdAt`
- `updatedAt`

This stores the raw API key material only in encrypted form.

### Auth profile

Represents a named credential-routing identity separate from the raw secret.

Minimum fields:

- `id`
- `workspaceId`
- `providerId`
- `label`
- `credentialId`
- `status`
- `priority`
- `cooldownUntil`
- `lastValidatedAt`

This separation is important. OpenClaw gets this right: credentials rotate and cool down independently from the symbolic profile the session or route wants to use.

### Credential metadata read model

The UI and API need a metadata-only view distinct from the encrypted secret.

Minimum fields:

- `id`
- `workspaceId`
- `providerId`
- `label`
- `status`
- `createdAt`
- `updatedAt`
- `lastValidatedAt`

This is the object the web app should list. Secret ciphertext stays server-only.

### Router policy

Represents the workspace's explicit routing preferences.

Minimum fields:

- `workspaceId`
- `version`
- `updatedAt`
- ordered candidates per capability family

Each candidate should include:

- `capability`
- `priority`
- `providerId`
- `modelId`
- `authProfileId` or `null` for "auto profile"
- `enabled`

Capability families remain the same as the current technical spec:

- `reasoning`
- `research`
- `coding`
- `browser`
- `terminal`
- `api`
- `document`
- `fast_tasks`
- `fallback`

### Route resolution

Represents the chosen provider/model/profile for a concrete step.

Minimum fields:

- `runId`
- `stepId`
- `capability`
- `providerId`
- `modelId`
- `authProfileId`
- `policyVersion`
- `status`
- `reason`
- `resolvedAt`

`status` should be one of:

- `resolved`
- `unresolved`
- `invalid_policy`
- `missing_auth`

This gives us an inspectable state even before external providers actually execute work.

## Ownership boundaries

### `packages/router`

Owns:

- static provider and model catalog
- capability-family compatibility rules
- policy validation
- deterministic resolution and unresolved diagnostics

Must not own:

- encryption
- database writes
- Fastify request handling

### `packages/db`

Owns:

- durable credential metadata and encrypted secret storage
- auth-profile persistence
- router policy persistence
- persisted step route state

Must not own:

- plaintext secret lifecycle after initial write
- provider/model business logic beyond referential integrity

### `apps/control-plane`

Owns:

- encryption and decryption boundary
- credential write APIs
- route preview APIs
- run-step route persistence at run creation time

Must not own:

- hardcoded vendor routing heuristics
- silent fallback behavior

### `apps/web`

Owns:

- settings UI
- route preview presentation
- step-route visibility in the operator console

Must not own:

- plaintext secrets after form submission
- routing decisions independently of the control plane

## Persistence design

### New tables

M4 should add:

- `workspace_credentials`
- `auth_profiles`
- `router_policies`
- `router_policy_candidates`

M4 should also extend `run_steps` with durable route-decision fields:

- `route_provider_id`
- `route_model_id`
- `route_auth_profile_id`
- `route_policy_version`
- `route_status`
- `route_reason`
- `route_resolved_at`

This is preferable to a separate route table in M4 because:

- each step has at most one active resolved route in the current design
- the route needs to be visible in the main run detail response
- the UI should not need another join just to show the selected provider/model

If we later add retries with alternative route attempts, M6 or M7 can add step-route history.

## Encryption model

Workspace credentials must not be stored as plaintext in Postgres.

M4 should use:

- a symmetric application key from env
- AES-256-GCM via Node `crypto`
- versioned envelope metadata so the format can change later

Suggested env var:

- `MYCELIUM_ENCRYPTION_KEY`

Behavior:

- required for write operations on credentials
- read operations can still show metadata without decrypting the secret
- missing key should fail fast and clearly on credential create/update

The client never receives plaintext secrets after submission.

## Resolver behavior

### Resolution inputs

The resolver should take:

- workspace id
- capability family
- optional plan-node metadata
- workspace policy
- provider/model catalog
- available auth profiles

### Resolution algorithm

For a given capability:

1. load the workspace policy candidates for that capability
2. if none exist, load `fallback`
3. filter candidates that are disabled
4. verify provider and model exist in the static catalog
5. verify the model supports the requested capability
6. resolve the requested auth profile, or select the highest-priority active profile for that provider
7. if auth is missing, mark unresolved and continue to the next candidate
8. pick the first eligible candidate
9. return a durable route decision

This is deterministic and operator-readable.

### Non-goal for M4

The resolver should **not**:

- infer routes by hidden heuristics
- ping vendor APIs
- rewrite policy automatically
- silently switch providers without recording why

## Execution compatibility with M3

M4 must not break the M3 local execution demo.

That means:

- route resolution can fail without blocking the current local template execution path
- current run creation remains valid even with no provider credentials configured
- UI should show unresolved route state explicitly instead of pretending a route exists

This is deliberate. M4 proves the control-plane routing layer before we make runtime execution depend on it.

## API surface for M4

### Catalog

- `GET /api/providers/models`

Returns the static provider/model registry plus capability metadata.

### Auth profiles and credentials

- `GET /api/workspace-credentials`
- `POST /api/workspace-credentials`
- `PATCH /api/workspace-credentials/:id`
- `DELETE /api/workspace-credentials/:id`
- `GET /api/auth-profiles`
- `POST /api/auth-profiles`
- `PATCH /api/auth-profiles/:id`
- `DELETE /api/auth-profiles/:id`
- `POST /api/auth-profiles/:id/validate`

`validate` in M4 means configuration validation:

- provider exists
- secret decrypts
- provider/profile linkage is correct

It does **not** mean live provider API verification yet.

### Router policy

- `GET /api/router/policy`
- `PUT /api/router/policy`
- `POST /api/router/resolve-preview`

The preview route should accept:

- workspace id
- capability
- optional explicit policy version

and return:

- resolved route or unresolved diagnostic

## Web UX for M4

### Settings page

Add a new settings route with three sections:

1. `Provider catalog`
2. `Workspace credentials`
3. `Auth profiles`
4. `Routing policy`

This should stay functional, not ornamental.

### Policy editor

Each capability family should render as an ordered list of route candidates.

Operators should be able to:

- add a candidate
- reorder candidates
- disable a candidate
- select provider/model/profile

### Route preview

Add a small diagnostics panel that lets the operator preview:

- what `reasoning` resolves to
- what `coding` resolves to
- why something is unresolved if it fails

### Execution surfaces

Run timeline items should display resolved route metadata when available:

- provider badge
- model badge
- auth profile label or unresolved warning

This keeps routing decisions visible where they matter.

## Testing strategy

### Unit

- catalog lookup and provider/model normalization
- policy validation
- deterministic fallback ordering
- auth profile selection
- encryption roundtrip

### Repository

- encrypted credential persistence
- policy candidate ordering
- route-decision persistence on run steps
- invalid ownership and invalid references rejected

### Control-plane integration

- auth profile CRUD
- policy CRUD
- resolve-preview API
- run creation persists route decisions on steps

### Web

- settings page reads catalog and policy
- policy editor submits valid updates
- run timeline shows resolved route metadata
- unresolved routes render explicit diagnostics

## Milestone acceptance criteria

Before calling M4 complete:

- a workspace can store encrypted provider credentials
- a workspace can create named auth profiles
- a workspace can read and update router policy through the API and web UI
- a route preview can deterministically resolve a capability to provider/model/profile
- run steps persist resolved route metadata or unresolved diagnostics
- the operator console shows routing decisions for persisted steps
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass at the workspace root

## Risks and mitigations

### Risk: encryption adds setup friction

Mitigation:

- keep one clear env var
- fail fast on missing key only for write paths
- document setup explicitly

### Risk: static catalogs go stale

Mitigation:

- treat the catalog as a versioned code-owned artifact in M4
- add model metadata in a narrow, reviewable file
- defer dynamic sync until after the contract proves out

### Risk: M4 overreaches into provider execution

Mitigation:

- explicitly keep runtime execution on the M3 local path
- persist route decisions now
- wire provider-backed execution later

## Bottom line

M4 should make the product claim real at the control-plane level:

- your providers
- your models
- your credentials
- your policy

without yet forcing the runtime to execute through vendor adapters.
