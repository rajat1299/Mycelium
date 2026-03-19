# Milestone 8 Schedules, Messaging, and Local Companion Design

## Purpose

Milestone 8 exists to add the first non-web ingress surfaces to Mycelium without forking the execution model that Milestones 1 through 7 already proved.

Status: `Integrated and verified on 2026-03-18.`

Milestones 1 through 7 proved:

- durable outcomes, plans, runs, steps, approvals, artifact lineage, checkpoints, audit history, and remote-worker execution
- one authoritative control plane with local Docker fallback and remote daemon-backed workers
- deterministic routing, review-aware blocking, interruption recovery, and resume
- operator visibility for runs, approvals, checkpoints, audit, artifacts, and remote workers

What the product still does not prove is external ingress and deferred execution:

- a durable schedule can enter the exact same outcome, plan, run, approval, checkpoint, and audit path as manual work
- Slack and Telegram can create or continue work without inventing a second orchestration model
- the local companion can be designed and security-reviewed before a packaged binary exists

M8 is the milestone that turns Mycelium from a web-and-daemon operated control plane into a system that can be triggered on time and from real chat surfaces, while keeping the companion itself at the protocol and bootstrap stage only.

## Approved direction

Approved on `2026-03-17`:

- ship schedules as a real runtime deliverable in M8
- ship both Slack and Telegram as real runtime deliverables in M8
- keep the current control-plane execution model authoritative; scheduled and messaging work must flow into the same durable outcome, plan, run, approval, checkpoint, and audit surfaces
- keep the web review desk authoritative for approvals in M8
- design the local companion in M8, including protocol, security model, and install or bootstrap groundwork
- do not ship a packaged local companion binary or user-machine execution path in M8
- prefer self-host-friendly channel connection models:
  - Slack via Socket Mode
  - Telegram via long polling

This keeps M8 focused on user-facing value while preventing the local companion from turning the milestone into a second infrastructure program.

## Options considered

### Option A: Schedules plus Slack and Telegram runtime, companion groundwork only

Pros:

- ships the user-facing value first
- exercises the same execution kernel from more than one ingress surface
- keeps the hardest new local-machine trust problem out of the runtime critical path
- matches the delivery pattern already used for sandbox, artifacts, checkpoints, and remote workers

Cons:

- the local companion is still not a shipped runtime by the end of M8
- local-machine execution remains follow-on work

Approved because it maximizes product feedback while containing risk.

### Option B: Ship schedules, messaging, and a real local companion runtime in the same milestone

Pros:

- more complete platform story in one step
- companion install and runtime issues are discovered earlier

Cons:

- mixes schedules, messaging, install, signing, scoping, crash recovery, and local-machine trust into one milestone
- makes failures harder to localize
- likely turns one milestone into two

Rejected because it is too much scope for one delivery window.

### Option C: Ship schedules only and defer messaging

Pros:

- smaller runtime surface
- simpler control-plane work

Cons:

- delays one of the clearest product-facing ingress surfaces
- misses the chance to validate threaded human workflows through Slack and Telegram

Rejected because M8 should prove both deferred execution and conversational ingress.

## M8 scope

### In scope

- durable schedule object model and trigger validation
- schedule execution that enters the normal outcome, plan, and run pipeline
- Slack and Telegram connection, ingress normalization, and outbound status or result delivery
- durable conversation binding from Slack or Telegram threads/chats to outcomes
- operator-visible schedule state and messaging connection state
- local companion protocol, security model, and install or bootstrap groundwork
- live smoke verification for schedules and both messaging channels

### Out of scope

- packaged local companion binaries
- user-machine execution through the companion
- approval resolution directly from Slack or Telegram
- browser or ffmpeg local companion capabilities
- public-webhook-first channel designs that require exposed inbound infrastructure
- remote checkpoint or artifact durability backends

## Design principles

1. Scheduled work, Slack messages, Telegram messages, and web actions must normalize into one execution pipeline.
2. The control plane remains authoritative for durable state; channels and schedules are ingress surfaces, not alternate sources of truth.
3. Slack and Telegram should favor self-host-friendly connection models that do not require public ingress.
4. Review, approval, checkpoint, and audit semantics must remain identical no matter how work entered the system.
5. The local companion must ship only as reviewed groundwork in M8: protocol, trust boundaries, scopes, and bootstrap model, not a runnable end-user binary.

## Primary product proof for M8

By the end of M8, an operator should be able to:

1. create a durable schedule for a workspace
2. let that schedule fire and create or continue work through the same outcome and run pipeline
3. connect Slack and Telegram to a workspace without exposing public webhooks
4. send a message from Slack or Telegram and see it create or continue a durable Mycelium outcome
5. observe normal planning, run execution, review blocking, checkpointing, and audit behavior on that work
6. receive status or result delivery back into the originating Slack thread or Telegram chat
7. inspect reviewed local companion protocol and bootstrap docs in the repo, with companion runtime delivery explicitly deferred

If that works, Mycelium has its first real deferred and conversational ingress slice.

## Closure note

Verified on `2026-03-18` against the live local stack:

- Slack Socket Mode-style inbound created and continued durable outcome `outcome_e2ea0d3fdb46db49`, produced `2` outbound deliveries, and stayed bound to one conversation
- Telegram long-polling-style inbound created and continued durable outcome `outcome_9a190c39fd4caa73`, produced `2` outbound deliveries, and stayed bound to one conversation
- schedule fire `schedule_fire_e0da3fc439b0611a` created run `run_e0da3fc439b0611a`, blocked on web approval `approval_92557c23-1041-4fb0-8d77-c79efd61130c`, then completed with `4` artifacts, `7` checkpoints, `12` persisted logs, and `7` audit entries
- the continue-outcome schedule path stayed on one durable outcome with `2` recorded fires
- the local companion remained exactly where this design intended: protocol, scope, trust-boundary, and bootstrap groundwork only, with no packaged binary or user-machine execution shipped in M8

## Unified ingress model

M8 should not create separate schedulers, bots, or channel-specific execution paths.

All ingress sources should normalize into the same control-plane boundary:

- `web`
- `schedule`
- `slack`
- `telegram`

Each ingress event should answer the same questions:

- which workspace owns this work
- whether it creates a new outcome or continues an existing one
- what message or trigger payload was received
- whether the trigger should stop at an outcome update or continue into draft-plan or run creation
- what durable external identity should be stored for traceability

That means the schedule runner and channel adapters are thin normalization layers over the existing outcome, planner, run, approval, checkpoint, and audit services.

## Schedule model

M8 schedules should be first-class durable control-plane objects, not ad hoc timers in memory.

Each schedule should persist:

- workspace ownership
- trigger definition
- timezone and validation metadata
- whether the schedule creates new work or continues existing work
- last-fired and next-fire metadata
- durable failure state or validation diagnostics

Schedule execution should be idempotent per due occurrence. If a poller or process restart races, only one durable trigger record should win for that occurrence.

Schedule firing should reuse existing primitives:

- create or continue an outcome
- append a normalized trigger message
- optionally continue into plan or run creation through the current control-plane surfaces

## Messaging model

Slack and Telegram should be treated as workspace-scoped channel connections with durable conversation binding.

M8 should persist:

- per-workspace Slack and Telegram connection state
- authentication or token status metadata
- inbound conversation identity
- mapping from external conversation to Mycelium outcome
- last-seen inbound or outbound marker needed for dedupe and continuity

Messaging behavior in M8 should be:

- inbound messages create or continue a durable outcome
- outbound delivery sends status, result, or summary updates back to the source thread or chat
- review-required work still resolves in the web review desk, not directly in Slack or Telegram

For self-hosting, the connection model should stay simple:

- Slack uses Socket Mode instead of public webhook ingress
- Telegram uses long polling instead of public webhook ingress

## Local companion groundwork model

The local companion enters M8 only as a reviewed foundation layer.

M8 should define:

- companion identity and registration contracts
- bootstrap token or trust-establishment shape
- capability and scope advertisement model
- install or bootstrap assumptions for macOS, Linux, and Windows
- local-path and local-tool trust boundaries
- explicit statement that user-machine execution is not yet shipped

M8 should not ship:

- a packaged binary
- service install commands exposed to end users
- local-machine execution of steps
- automatic privilege escalation or ambient host access

The point of this work is to make M9 implementation narrower and safer, not to half-ship a companion in M8.

## Security and approval boundaries

Schedules and channels widen ingress, so M8 must stay clear about authority:

- workspace ownership checks remain mandatory at every ingress boundary
- channel allowlists and identity normalization must exist before inbound execution is accepted
- schedule and message-triggered work must still hit the existing review queue for review-required steps
- Slack or Telegram should be able to notify about approvals, but final approval authority stays in the web review flow in M8
- companion groundwork must model explicit scopes instead of ambient machine access

## Ship gate for M8

Before calling M8 complete:

- a durable schedule can create or continue work and drive it through the existing execution path
- Slack and Telegram can both create or continue work through the control plane
- outbound delivery returns status or result messages to Slack and Telegram without bypassing the control plane
- scheduled and channel-triggered runs still use routing, approvals, checkpoints, audit history, and remote-worker execution the same way as web-triggered runs
- local companion protocol and bootstrap docs are present and reviewed, but no packaged companion runtime is required

## Reference extraction map for M8

Use only the verified current files below. Do not replace them with guessed filenames.

### Middleman

Read:

- `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/cron-scheduler-service.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/scheduler/schedule-storage.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/slack/slack-integration.ts`
- `/Users/rajattiwari/swarm/middleman/apps/backend/src/integrations/telegram/telegram-integration.ts`
- [middleman-engineering.md](/Users/rajattiwari/swarm/_codex_notes/middleman-engineering.md)

Extract:

- schedule firing that reuses the main execution path
- durable schedule storage instincts
- separation between integration config, inbound routing, delivery, and connection status

Do not inherit:

- Middleman-specific swarm or manager framing
- file-backed persistence as the long-term Mycelium schedule store

### OpenClaw

Read:

- `/Users/rajattiwari/swarm/openclaw/src/cron/schedule.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-cron.ts`
- `/Users/rajattiwari/swarm/openclaw/src/gateway/server-methods/cron.ts`
- `/Users/rajattiwari/swarm/openclaw/extensions/slack/src/channel.ts`
- `/Users/rajattiwari/swarm/openclaw/extensions/telegram/src/channel.ts`
- `/Users/rajattiwari/swarm/openclaw/src/daemon/service.ts`
- `/Users/rajattiwari/swarm/openclaw/src/daemon/runtime-paths.ts`
- `/Users/rajattiwari/swarm/openclaw/src/daemon/systemd.ts`
- [openclaw-engineering.md](/Users/rajattiwari/swarm/_codex_notes/openclaw-engineering.md)

Extract:

- cron normalization and due-run control
- channel-plugin boundaries for Slack and Telegram
- install or bootstrap discipline for a later local companion
- explicit platform service assumptions without shipping them in M8

Do not inherit:

- OpenClaw plugin breadth
- chat-first product framing that collapses all work into one channel abstraction

### Terragon

Read:

- `/Users/rajattiwari/swarm/terragon-oss/packages/shared/src/automations/cron.ts`
- `/Users/rajattiwari/swarm/terragon-oss/apps/www/src/server-lib/scheduled-thread.ts`
- [terragon-oss-engineering.md](/Users/rajattiwari/swarm/_codex_notes/terragon-oss-engineering.md)

Extract:

- cron-pattern validation boundaries
- durable scheduled resume or continue behavior
- trigger validation that is explicit rather than prompt-defined

Do not inherit:

- Vercel-specific product or hosting assumptions
- Terragon thread or chat model wholesale

### Deer Flow

Read:

- `/Users/rajattiwari/swarm/deer-flow/backend/src/channels/slack.py`
- `/Users/rajattiwari/swarm/deer-flow/backend/src/channels/telegram.py`

Extract:

- self-host-friendly Slack Socket Mode behavior
- Telegram long-polling behavior
- lightweight inbound-message and outbound-status loops

Do not inherit:

- Python channel implementation details that do not fit the Mycelium control plane
- Deer Flow-specific bus or thread abstractions as-is
