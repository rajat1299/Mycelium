import { describe, expect, it } from "vitest";
import { PlanRepository } from "./plans";
import { RemoteWorkerRepository } from "./remote-workers";
import { RunRepository } from "./runs";
import { createRepositoryTestDatabase } from "./test-database";
import { WorkspaceLeaseRepository } from "./workspace-leases";

function buildExecutablePlanInput() {
  return {
    id: "plan_outcome_123",
    outcomeId: "outcome_123",
    status: "draft" as const,
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
    nodes: [
      {
        id: "plan_outcome_123:analyze-outcome",
        kind: "root" as const,
        title: "Analyze outcome",
        capability: "reasoning" as const,
        position: 0
      }
    ],
    edges: []
  };
}

describe("RemoteWorkerRepository", () => {
  it("upserts worker registration, refreshes heartbeat, and marks stale sessions offline", async () => {
    const { db } = createRepositoryTestDatabase();
    const repository = new RemoteWorkerRepository(db as never);

    const registered = await repository.upsert({
      id: "worker_1",
      sessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      availability: "available",
      capabilities: {
        capabilityFamilies: ["coding", "terminal", "document"],
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

    expect(registered).toEqual(
      expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_1",
        availability: "available",
        health: expect.objectContaining({
          status: "healthy",
          lastHeartbeatAt: "2026-03-16T10:00:00.000Z"
        })
      })
    );

    const heartbeated = await repository.recordHeartbeat({
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      sentAt: "2026-03-16T10:05:00.000Z",
      healthStatus: "degraded"
    });

    expect(heartbeated).toEqual(
      expect.objectContaining({
        id: "worker_1",
        health: expect.objectContaining({
          status: "degraded",
          lastHeartbeatAt: "2026-03-16T10:05:00.000Z"
        }),
        updatedAt: "2026-03-16T10:05:00.000Z"
      })
    );

    await expect(
      repository.cleanupStaleSessions({
        staleBefore: "2026-03-16T10:10:00.000Z",
        disconnectedAt: "2026-03-16T10:15:00.000Z"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "worker_1",
        availability: "offline",
        disconnectedAt: "2026-03-16T10:15:00.000Z",
        health: expect.objectContaining({
          status: "offline"
        })
      })
    ]);
  });

  it("persists step assignment and worker-owned workspace leases, and rejects conflicting assignment", async () => {
    const { db } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);
    const remoteWorkers = new RemoteWorkerRepository(db as never);
    const workspaceLeases = new WorkspaceLeaseRepository(db as never);

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-16T10:00:00.000Z",
      updatedAt: "2026-03-16T10:00:00.000Z"
    });

    await remoteWorkers.upsert({
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
    await remoteWorkers.upsert({
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

    const step = (await runs.listSteps("run_123"))[0]!;
    const assigned = await runs.assignStepToWorker({
      stepId: step.id,
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      attemptId: "attempt_1",
      assignedAt: "2026-03-16T10:02:00.000Z",
      updatedAt: "2026-03-16T10:02:00.000Z"
    });

    expect(assigned).toEqual(
      expect.objectContaining({
        id: step.id,
        executionTarget: "remote_worker",
        remoteWorkerId: "worker_1",
        remoteWorkerSessionId: "worker_session_1",
        remoteExecutionAttemptId: "attempt_1",
        remoteAssignedAt: "2026-03-16T10:02:00.000Z"
      })
    );

    await expect(
      workspaceLeases.acquire({
        runId: "run_123",
        rootPath: "/tmp/mycelium/run_123",
        inputPath: "/tmp/mycelium/run_123/input",
        artifactsPath: "/tmp/mycelium/run_123/artifacts",
        logsPath: "/tmp/mycelium/run_123/logs",
        remoteWorkerId: "worker_1",
        remoteWorkerSessionId: "worker_session_1",
        acquiredAt: "2026-03-16T10:03:00.000Z"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        runId: "run_123",
        remoteWorkerId: "worker_1",
        remoteWorkerSessionId: "worker_session_1"
      })
    );

    await expect(
      runs.assignStepToWorker({
        stepId: step.id,
        workerId: "worker_2",
        workerSessionId: "worker_session_2",
        attemptId: "attempt_2",
        assignedAt: "2026-03-16T10:04:00.000Z",
        updatedAt: "2026-03-16T10:04:00.000Z"
      })
    ).rejects.toThrow(
      `Step ${step.id} is already assigned to worker worker_1.`
    );
  });
});
