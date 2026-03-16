import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

describe("in-memory remote worker repositories", () => {
  it("stores worker state, refreshes heartbeats, and cleans up stale sessions", async () => {
    const repositories = createInMemoryRepositories();

    const created = await repositories.remoteWorkers.upsert({
      id: "worker_1",
      sessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      availability: "available",
      capabilities: {
        capabilityFamilies: ["coding", "terminal"],
        supportsArtifacts: true,
        supportsCheckpoints: true,
        supportsLogs: true
      },
      health: {
        status: "healthy",
        lastHeartbeatAt: "2026-03-16T10:00:00.000Z"
      },
      connectedAt: "2026-03-16T09:59:00.000Z",
      disconnectedAt: null,
      updatedAt: "2026-03-16T10:00:00.000Z"
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: "worker_1",
        availability: "available"
      })
    );

    await expect(
      repositories.remoteWorkers.recordHeartbeat({
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        sentAt: "2026-03-16T10:05:00.000Z",
        healthStatus: "healthy"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        health: expect.objectContaining({
          lastHeartbeatAt: "2026-03-16T10:05:00.000Z"
        })
      })
    );

    await expect(
      repositories.remoteWorkers.cleanupStaleSessions({
        staleBefore: "2026-03-16T10:06:00.000Z",
        disconnectedAt: "2026-03-16T10:10:00.000Z"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "worker_1",
        availability: "offline",
        disconnectedAt: "2026-03-16T10:10:00.000Z"
      })
    ]);
  });

  it("enforces assignment conflicts and delete parity for assigned workers", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.plans.create({
      id: "plan_outcome_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-16T00:00:00.000Z",
      updatedAt: "2026-03-16T00:00:00.000Z",
      nodes: [
        {
          id: "plan_outcome_123:analyze-outcome",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning"
        }
      ],
      edges: []
    });
    await repositories.runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-16T10:00:00.000Z",
      updatedAt: "2026-03-16T10:00:00.000Z"
    });

    await repositories.remoteWorkers.upsert({
      id: "worker_1",
      sessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      availability: "available",
      capabilities: {
        capabilityFamilies: ["coding", "terminal"],
        supportsArtifacts: true,
        supportsCheckpoints: true,
        supportsLogs: true
      },
      health: {
        status: "healthy",
        lastHeartbeatAt: "2026-03-16T10:00:00.000Z"
      },
      connectedAt: "2026-03-16T09:59:00.000Z",
      disconnectedAt: null,
      updatedAt: "2026-03-16T10:00:00.000Z"
    });
    await repositories.remoteWorkers.upsert({
      id: "worker_2",
      sessionId: "worker_session_2",
      workspaceId: "ws_default",
      label: "Backup remote worker",
      daemonVersion: "1.0.0",
      availability: "available",
      capabilities: {
        capabilityFamilies: ["coding", "terminal"],
        supportsArtifacts: true,
        supportsCheckpoints: true,
        supportsLogs: true
      },
      health: {
        status: "healthy",
        lastHeartbeatAt: "2026-03-16T10:00:00.000Z"
      },
      connectedAt: "2026-03-16T09:59:00.000Z",
      disconnectedAt: null,
      updatedAt: "2026-03-16T10:00:00.000Z"
    });

    const [step] = await repositories.runs.listSteps("run_123");
    await repositories.runs.assignStepToWorker({
      stepId: step.id,
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      attemptId: "attempt_1",
      assignedAt: "2026-03-16T10:02:00.000Z",
      updatedAt: "2026-03-16T10:02:00.000Z"
    });

    await expect(
      repositories.runs.assignStepToWorker({
        stepId: step.id,
        workerId: "worker_2",
        workerSessionId: "worker_session_2",
        attemptId: "attempt_2",
        assignedAt: "2026-03-16T10:03:00.000Z",
        updatedAt: "2026-03-16T10:03:00.000Z"
      })
    ).rejects.toThrow(`Step ${step.id} is already assigned to worker worker_1.`);

    await expect(repositories.remoteWorkers.delete("worker_1")).rejects.toThrow(
      'update or delete on table "remote_workers" violates foreign key constraint "run_steps_remote_worker_id_fkey" on table "run_steps"'
    );
  });
});
