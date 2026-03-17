import { afterEach, describe, expect, it } from "vitest";
import type { OutcomeStreamEvent } from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createEventBus } from "../src/lib/event-bus";
import {
  createInMemoryRepositories,
  type Repositories
} from "../src/lib/repositories";

const appsToClose = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    Array.from(appsToClose).map(async (app) => {
      appsToClose.delete(app);
      await app.close();
    })
  );
});

function daemonHeaders(token = "test-daemon-token") {
  return {
    "content-type": "application/json",
    "x-mycelium-daemon-token": token
  };
}

async function seedAssignedRun(repositories: Repositories) {
  const outcome = await repositories.outcomes.create({
    id: "outcome_123",
    workspaceId: "ws_default",
    userId: "user_default",
    prompt: "Run on a remote worker",
    source: "web"
  });

  await repositories.plans.create({
    id: "plan_outcome_123",
    outcomeId: outcome.id,
    status: "draft",
    createdAt: "2026-03-16T10:00:00.000Z",
    updatedAt: "2026-03-16T10:00:00.000Z",
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
    outcomeId: outcome.id,
    planId: "plan_outcome_123",
    createdAt: "2026-03-16T10:00:00.000Z",
    updatedAt: "2026-03-16T10:00:00.000Z"
  });

  const [step] = await repositories.runs.listSteps("run_123");

  if (!step) {
    throw new Error("Expected a seeded run step.");
  }

  return {
    outcome,
    step
  };
}

describe("worker daemon routes", () => {
  it("requires daemon auth and supports worker registration, heartbeat, and reconnect", async () => {
    const app = buildApp();
    appsToClose.add(app);

    const registration = {
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      connectedAt: "2026-03-16T10:00:00.000Z",
      capabilities: {
        capabilityFamilies: ["coding", "terminal"],
        supportsArtifacts: true,
        supportsCheckpoints: true,
        supportsLogs: true
      }
    };

    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/register",
      payload: registration
    });

    expect(unauthorized.statusCode).toBe(401);

    const registered = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/register",
      headers: daemonHeaders(),
      payload: registration
    });

    expect(registered.statusCode).toBe(200);
    expect(registered.json()).toEqual({
      worker: expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_1",
        workspaceId: "ws_default",
        availability: "available"
      })
    });

    const heartbeated = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/heartbeat",
      headers: daemonHeaders(),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        sentAt: "2026-03-16T10:05:00.000Z",
        health: {
          status: "healthy",
          lastHeartbeatAt: "2026-03-16T10:05:00.000Z"
        }
      }
    });

    expect(heartbeated.statusCode).toBe(200);
    expect(heartbeated.json()).toEqual({
      worker: expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_1",
        health: expect.objectContaining({
          lastHeartbeatAt: "2026-03-16T10:05:00.000Z"
        })
      })
    });

    const reconnected = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/register",
      headers: daemonHeaders(),
      payload: {
        ...registration,
        workerSessionId: "worker_session_2",
        connectedAt: "2026-03-16T10:06:00.000Z"
      }
    });

    expect(reconnected.statusCode).toBe(200);
    expect(reconnected.json()).toEqual({
      worker: expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_2",
        disconnectedAt: null
      })
    });

    const staleHeartbeat = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/heartbeat",
      headers: daemonHeaders(),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        sentAt: "2026-03-16T10:07:00.000Z",
        health: {
          status: "degraded",
          lastHeartbeatAt: "2026-03-16T10:07:00.000Z"
        }
      }
    });

    expect(staleHeartbeat.statusCode).toBe(409);
  });

  it("ingests daemon events, updates worker availability, and disconnects worker sessions", async () => {
    const repositories = createInMemoryRepositories();
    const eventBus = createEventBus();
    const events: OutcomeStreamEvent[] = [];
    const unsubscribe = eventBus.subscribeAll((event) => {
      events.push(event);
    });
    const seeded = await seedAssignedRun(repositories);
    const app = buildApp({ repositories, eventBus });
    appsToClose.add(app);

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/register",
      headers: daemonHeaders(),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        workspaceId: "ws_default",
        label: "Primary remote worker",
        daemonVersion: "1.0.0",
        connectedAt: "2026-03-16T10:00:00.000Z",
        capabilities: {
          capabilityFamilies: ["coding", "terminal"],
          supportsArtifacts: true,
          supportsCheckpoints: true,
          supportsLogs: true
        }
      }
    });

    await repositories.runs.assignStepToWorker({
      stepId: seeded.step.id,
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      attemptId: "attempt_1",
      assignedAt: "2026-03-16T10:01:00.000Z",
      updatedAt: "2026-03-16T10:01:00.000Z"
    });

    const statusEvent = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(),
      payload: {
        type: "status",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: "run_123",
        stepId: seeded.step.id,
        attemptId: "attempt_1",
        status: "running",
        createdAt: "2026-03-16T10:02:00.000Z",
        message: "Remote execution started"
      }
    });

    expect(statusEvent.statusCode).toBe(202);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcomeId: seeded.outcome.id,
          type: "remote.step.updated",
          data: expect.objectContaining({
            runId: "run_123",
            stepId: seeded.step.id,
            status: "running",
            assignment: expect.objectContaining({
              workerId: "worker_1",
              workerSessionId: "worker_session_1",
              attemptId: "attempt_1"
            })
          })
        })
      ])
    );

    const terminalEvent = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(),
      payload: {
        type: "terminal",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: "run_123",
        stepId: seeded.step.id,
        attemptId: "attempt_1",
        status: "completed",
        exitCode: 0,
        stdoutSummary: "completed successfully",
        stderrSummary: "",
        finishedAt: "2026-03-16T10:05:00.000Z"
      }
    });

    expect(terminalEvent.statusCode).toBe(202);

    const artifactEvent = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(),
      payload: {
        type: "artifact",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: "run_123",
        stepId: seeded.step.id,
        attemptId: "attempt_1",
        artifact: {
          kind: "document",
          relativePath: "artifacts/brief.md",
          size: 24,
          contentBase64: "IyBCcmllZgo=",
          createdAt: "2026-03-16T10:04:00.000Z"
        }
      }
    });

    expect(artifactEvent.statusCode).toBe(202);

    const checkpointEvent = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(),
      payload: {
        type: "checkpoint",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: "run_123",
        stepId: seeded.step.id,
        attemptId: "attempt_1",
        checkpoint: {
          kind: "step_completed",
          resumable: true,
          createdAt: "2026-03-16T10:04:30.000Z",
          payload: {
            version: 1,
            run: {
              id: "run_123",
              outcomeId: seeded.outcome.id,
              workspaceId: seeded.outcome.workspaceId,
              status: "running"
            },
            steps: [
              {
                stepId: seeded.step.id,
                title: seeded.step.title,
                status: "running"
              }
            ],
            readyStepIds: [seeded.step.id],
            blockedStepIds: [],
            workspacePaths: {
              inputDir: "/tmp/mycelium/run_123/input",
              logsDir: "/tmp/mycelium/run_123/logs",
              artifactsDir: "/tmp/mycelium/run_123/artifacts"
            },
            artifactIds: [],
            latestAuditSequence: 0
          }
        }
      }
    });

    expect(checkpointEvent.statusCode).toBe(202);

    const disconnected = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/disconnect",
      headers: daemonHeaders(),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        disconnectedAt: "2026-03-16T10:06:00.000Z"
      }
    });

    expect(disconnected.statusCode).toBe(200);
    expect(disconnected.json()).toEqual({
      worker: expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_1",
        availability: "offline",
        disconnectedAt: "2026-03-16T10:06:00.000Z"
      })
    });

    unsubscribe();
  });
});
