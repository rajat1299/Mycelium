# Docs Index

Read these in order if you are new to the project:

1. [Agent Runbook](/Users/rajattiwari/swarm/computer-oss/docs/agent-runbook.md)
2. [Project Log](/Users/rajattiwari/swarm/computer-oss/docs/project-log.md)
3. [Product Vision](/Users/rajattiwari/swarm/computer-oss/docs/01-product-vision.md)
4. [Architecture](/Users/rajattiwari/swarm/computer-oss/docs/02-architecture.md)
5. [System Design](/Users/rajattiwari/swarm/computer-oss/docs/03-system-design.md)
6. [Technical Spec](/Users/rajattiwari/swarm/computer-oss/docs/04-technical-spec.md)
7. [Reference Extraction Map](/Users/rajattiwari/swarm/computer-oss/docs/05-reference-extraction-map.md)
8. [Frontend and UX](/Users/rajattiwari/swarm/computer-oss/docs/06-frontend-and-ux.md)
9. [Execution Roadmap](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-execution-roadmap.md)
10. [Milestone 2 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-milestone-2-orchestration-kernel-implementation.md)
11. [Milestone 3 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-design.md)
12. [Milestone 3 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-12-milestone-3-execution-substrate-implementation.md)
13. [Milestone 4 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-design.md)
14. [Milestone 4 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-13-milestone-4-routing-byo-keys-implementation.md)
15. [Milestone 5 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-design.md)
16. [Milestone 5 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-14-milestone-5-review-queue-and-artifact-lineage-implementation.md)
17. [Milestone 6 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-design.md)
18. [Milestone 6 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-15-milestone-6-checkpoints-replay-and-audit-implementation.md)
19. [Milestone 7 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-design.md)
20. [Milestone 7 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-16-milestone-7-remote-workers-and-daemon-implementation.md)
21. [Milestone 8 Design](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-design.md)
22. [Milestone 8 Plan](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-17-milestone-8-schedules-messaging-and-local-companion-implementation.md)
23. [Architecture Design Record](/Users/rajattiwari/swarm/computer-oss/docs/plans/2026-03-11-v1-architecture-design.md)

## How to use this docs set

- Start with `01` if you need product context.
- Start with `02` and `03` if you are implementing backend/runtime work.
- Start with `06` if you are working on the operator console.
- Use `05` when deciding whether to extract from a reference repo or build something new.
- Use the design record in `plans/` when you need the reasoning behind the current architecture.

## Current status

Milestone 7 is integrated on `main`. The shipped stack now includes authenticated remote worker sessions, remote step execution through the daemon HTTP contract, upload-back logs or artifacts or checkpoints, worker visibility in the operator console, and the existing M6 interruption or resume model on top of the Milestone 5 review queue, Milestone 4 routing, and the Milestone 3 local Docker fallback path. Milestone 8 is the next execution-ready milestone and is locked to schedules plus Slack and Telegram runtime delivery, with the local companion limited to design or protocol or bootstrap groundwork only. Start with the runbook, then the local setup guide, then the M8 design and implementation docs.
