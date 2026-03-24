import { describe, expect, it } from "vitest";
import { PlanRepository } from "./plans";
import { RemoteWorkerRepository } from "./remote-workers";
import { RunRepository } from "./runs";
import { createRepositoryTestDatabase, type TableRecord } from "./test-database";
import { WorkspaceLeaseRepository } from "./workspace-leases";

function buildExecutablePlanInput() {
  return {
    id: "plan_outcome_123",
    outcomeId: "outcome_123",
    triggerMessageId: "msg_plan_outcome_123",
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

function seedTriggerMessage(
  state: { [key: string]: unknown },
  id: string,
  outcomeId = "outcome_123"
) {
  const messages = ((state as { outcomeMessages?: TableRecord[] }).outcomeMessages ??=
    []);

  messages.push({
    id,
    outcomeId,
    role: "user",
    content: `${id} content`,
    createdAt: new Date("2026-03-16T00:00:00.000Z")
  });
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

  it("does not apply a stale heartbeat after the worker session changes", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new RemoteWorkerRepository(db as never);

    await repository.upsert({
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

    const originalUpdate = (db as { update: typeof db.update }).update.bind(db);
    let simulatedReconnect = false;

    (db as { update: typeof db.update }).update = ((table) => {
      const updateBuilder = originalUpdate(table);

      return {
        set(values) {
          const setBuilder = updateBuilder.set(values);

          return {
            where(expression) {
              if (!simulatedReconnect) {
                simulatedReconnect = true;
                const worker = state.remoteWorkers.find(
                  (row) => row.id === "worker_1"
                );

                if (worker) {
                  Object.assign(worker, {
                    sessionId: "worker_session_2",
                    connectedAt: new Date("2026-03-16T10:06:00.000Z"),
                    lastHeartbeatAt: new Date("2026-03-16T10:06:00.000Z"),
                    updatedAt: new Date("2026-03-16T10:06:00.000Z")
                  });
                }
              }

              return setBuilder.where(expression);
            }
          };
        }
      };
    }) as typeof db.update;

    await expect(
      repository.recordHeartbeat({
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        sentAt: "2026-03-16T10:05:00.000Z",
        healthStatus: "degraded"
      })
    ).resolves.toBeNull();

    await expect(repository.getById("worker_1")).resolves.toEqual(
      expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_2",
        health: expect.objectContaining({
          status: "healthy",
          lastHeartbeatAt: "2026-03-16T10:06:00.000Z"
        }),
        updatedAt: "2026-03-16T10:06:00.000Z"
      })
    );
  });

  it("does not mark a reconnected worker offline during stale-session cleanup", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new RemoteWorkerRepository(db as never);

    await repository.upsert({
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

    const originalUpdate = (db as { update: typeof db.update }).update.bind(db);
    let simulatedReconnect = false;

    (db as { update: typeof db.update }).update = ((table) => {
      const updateBuilder = originalUpdate(table);

      return {
        set(values) {
          const setBuilder = updateBuilder.set(values);

          return {
            where(expression) {
              if (!simulatedReconnect) {
                simulatedReconnect = true;
                const worker = state.remoteWorkers.find(
                  (row) => row.id === "worker_1"
                );

                if (worker) {
                  Object.assign(worker, {
                    sessionId: "worker_session_2",
                    connectedAt: new Date("2026-03-16T10:12:00.000Z"),
                    lastHeartbeatAt: new Date("2026-03-16T10:12:00.000Z"),
                    updatedAt: new Date("2026-03-16T10:12:00.000Z")
                  });
                }
              }

              return setBuilder.where(expression);
            }
          };
        }
      };
    }) as typeof db.update;

    await expect(
      repository.cleanupStaleSessions({
        staleBefore: "2026-03-16T10:10:00.000Z",
        disconnectedAt: "2026-03-16T10:15:00.000Z"
      })
    ).resolves.toEqual([]);

    await expect(repository.getById("worker_1")).resolves.toEqual(
      expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_2",
        availability: "available",
        disconnectedAt: null,
        health: expect.objectContaining({
          status: "healthy",
          lastHeartbeatAt: "2026-03-16T10:12:00.000Z"
        }),
        updatedAt: "2026-03-16T10:12:00.000Z"
      })
    );
  });

  it("persists step assignment and worker-owned workspace leases, and rejects conflicting assignment", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);
    const remoteWorkers = new RemoteWorkerRepository(db as never);
    const workspaceLeases = new WorkspaceLeaseRepository(db as never);

    seedTriggerMessage(state, "msg_plan_outcome_123");
    seedTriggerMessage(state, "msg_run_123");
    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      triggerMessageId: "msg_plan_outcome_123",
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

  it("rejects stale step assignment when another worker claims the step first", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);
    const remoteWorkers = new RemoteWorkerRepository(db as never);

    seedTriggerMessage(state, "msg_plan_outcome_123");
    seedTriggerMessage(state, "msg_run_123");
    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      triggerMessageId: "msg_plan_outcome_123",
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

    const [step] = await runs.listSteps("run_123");
    const originalUpdate = (db as { update: typeof db.update }).update.bind(db);
    let simulatedConcurrentClaim = false;

    (db as { update: typeof db.update }).update = ((table) => {
      const updateBuilder = originalUpdate(table);

      return {
        set(values) {
          const setBuilder = updateBuilder.set(values);

          return {
            where(expression) {
              if (!simulatedConcurrentClaim) {
                simulatedConcurrentClaim = true;
                const persistedStep = state.runSteps.find(
                  (row) => row.id === step?.id
                );

                if (persistedStep) {
                  Object.assign(persistedStep, {
                    executionTarget: "remote_worker",
                    remoteWorkerId: "worker_2",
                    remoteWorkerSessionId: "worker_session_2",
                    remoteExecutionAttemptId: "attempt_2",
                    remoteAssignedAt: new Date("2026-03-16T10:01:00.000Z"),
                    updatedAt: new Date("2026-03-16T10:01:00.000Z")
                  });
                }
              }

              return setBuilder.where(expression);
            }
          };
        }
      };
    }) as typeof db.update;

    await expect(
      runs.assignStepToWorker({
        stepId: step!.id,
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        attemptId: "attempt_1",
        assignedAt: "2026-03-16T10:02:00.000Z",
        updatedAt: "2026-03-16T10:02:00.000Z"
      })
    ).rejects.toThrow(
      `Step ${step!.id} is already assigned to worker worker_2.`
    );
  });

  it("rejects stale step assignment when the worker reconnects before the assignment write", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);
    const remoteWorkers = new RemoteWorkerRepository(db as never);

    seedTriggerMessage(state, "msg_plan_outcome_123");
    seedTriggerMessage(state, "msg_run_123");
    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      triggerMessageId: "msg_plan_outcome_123",
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

    const [step] = await runs.listSteps("run_123");
    const originalUpdate = (db as { update: typeof db.update }).update.bind(db);
    let simulatedReconnect = false;

    (db as { update: typeof db.update }).update = ((table) => {
      const updateBuilder = originalUpdate(table);

      return {
        set(values) {
          const setBuilder = updateBuilder.set(values);

          return {
            where(expression) {
              if (!simulatedReconnect) {
                simulatedReconnect = true;
                const worker = state.remoteWorkers.find(
                  (row) => row.id === "worker_1"
                );

                if (worker) {
                  Object.assign(worker, {
                    sessionId: "worker_session_2",
                    connectedAt: new Date("2026-03-16T10:01:00.000Z"),
                    lastHeartbeatAt: new Date("2026-03-16T10:01:00.000Z"),
                    updatedAt: new Date("2026-03-16T10:01:00.000Z")
                  });
                }
              }

              return setBuilder.where(expression);
            }
          };
        }
      };
    }) as typeof db.update;

    await expect(
      runs.assignStepToWorker({
        stepId: step!.id,
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        attemptId: "attempt_1",
        assignedAt: "2026-03-16T10:02:00.000Z",
        updatedAt: "2026-03-16T10:02:00.000Z"
      })
    ).rejects.toThrow(
      "Remote worker worker_1 session worker_session_1 does not match active session worker_session_2."
    );
  });
});
