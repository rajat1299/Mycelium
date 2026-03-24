import { afterEach, describe, expect, it } from "vitest";
import {
  createInMemoryServiceContainer,
  type ServiceContainer
} from "../src/lib/service-container";
import { buildApp } from "../src/app";
import { createPlanForOutcomeTurn } from "./turn-test-helpers";

const appsToClose = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    Array.from(appsToClose).map(async (app) => {
      appsToClose.delete(app);
      await app.close();
    })
  );
});

function daemonHeaders(token: string) {
  return {
    "content-type": "application/json",
    "x-mycelium-daemon-token": token
  };
}

async function claimCommandsEventually(
  app: ReturnType<typeof buildApp>,
  services: ServiceContainer
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const claimed = await app.inject({
      method: "POST",
      url: "/api/worker-daemon/commands/claim",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1"
      }
    });

    if (
      claimed.statusCode === 200 &&
      Array.isArray(claimed.json().commands) &&
      claimed.json().commands.length > 0
    ) {
      return claimed;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("Timed out waiting for a remote dispatch command.");
}

async function seedOutcomePlanAndWorker(services: ServiceContainer) {
  const connectedAt = new Date().toISOString();
  const outcome = await services.repositories.outcomes.create({
    id: "outcome_123",
    workspaceId: "ws_123",
    userId: "user_123",
    prompt: "Ship the launch brief.",
    source: "web"
  });

  await createPlanForOutcomeTurn(services.repositories, {
    id: "plan_outcome_123",
    outcomeId: outcome.id,
    status: "draft",
    createdAt: "2026-03-17T10:00:00.000Z",
    updatedAt: "2026-03-17T10:00:00.000Z",
    nodes: [
      {
        id: "plan_outcome_123:draft-brief",
        kind: "root",
        title: "Draft brief",
        capability: "coding",
        instruction: "Write the launch brief.",
        template: "draft_brief",
        expectedArtifactPath: "artifacts/brief.md",
        expectedArtifactKind: "brief"
      }
    ],
    edges: []
  });

  await services.workerRegistry.registerWorker({
    workerId: "worker_1",
    workerSessionId: "worker_session_1",
    workspaceId: "ws_123",
    label: "Primary remote worker",
    daemonVersion: "1.0.0",
    connectedAt,
    capabilities: {
      capabilityFamilies: ["coding", "terminal"],
      supportsArtifacts: true,
      supportsCheckpoints: true,
      supportsLogs: true
    }
  });

  return outcome;
}

describe("remote execution", () => {
  it("dispatches remote work, persists upload-back logs and artifacts, and durably records uploaded checkpoints before step completion", async () => {
    const services = createInMemoryServiceContainer({
      workerStaleTimeoutMs: 24 * 60 * 60 * 1000
    });
    const app = buildApp({ services });
    appsToClose.add(app);
    const outcome = await seedOutcomePlanAndWorker(services);

    const created = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: "plan_outcome_123"
      }
    });

    expect(created.statusCode).toBe(201);
    const run = created.json();

    const claimedCommands = await claimCommandsEventually(app, services);

    expect(claimedCommands.statusCode).toBe(200);
    expect(claimedCommands.json()).toEqual({
      commands: [
        expect.objectContaining({
          type: "dispatch_step",
          assignment: expect.objectContaining({
            workerId: "worker_1",
            workerSessionId: "worker_session_1"
          }),
          step: expect.objectContaining({
            runId: run.id,
            planNodeId: "plan_outcome_123:draft-brief"
          })
        })
      ]
    });

    const [step] = await services.repositories.runs.listSteps(run.id);
    expect(step?.executionTarget).toBe("remote_worker");

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "log",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        level: "info",
        message: "remote execution started",
        createdAt: "2026-03-17T10:02:00.000Z"
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "artifact",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        artifact: {
          kind: "brief",
          relativePath: "artifacts/brief.md",
          size: 14,
          contentBase64: Buffer.from("# Launch brief\n").toString("base64"),
          createdAt: "2026-03-17T10:03:00.000Z"
        }
      }
    });

    const [artifact] = await services.repositories.artifacts.listByRun(run.id);

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "checkpoint",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        checkpoint: {
          kind: "step_completed",
          resumable: true,
          createdAt: "2026-03-17T10:04:00.000Z",
          payload: {
            version: 1,
            run: {
              id: run.id,
              outcomeId: outcome.id,
              workspaceId: outcome.workspaceId,
              status: "running"
            },
            steps: [
              {
                stepId: step!.id,
                title: step!.title,
                status: "completed"
              }
            ],
            readyStepIds: [],
            blockedStepIds: [],
            workspacePaths: {
              inputDir: `/tmp/input/${run.id}`,
              logsDir: `/tmp/logs/${run.id}`,
              artifactsDir: `/tmp/artifacts/${run.id}`
            },
            artifactIds: artifact ? [artifact.id] : [],
            latestAuditSequence: 0
          }
        }
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "terminal",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        status: "completed",
        exitCode: 0,
        stdoutSummary: "remote execution complete",
        stderrSummary: "",
        expectedArtifactCount: 1,
        finishedAt: "2026-03-17T10:05:00.000Z"
      }
    });

    await services.executionService.waitForRun(run.id);

    const persistedRun = await services.repositories.runs.getById(run.id);
    expect(persistedRun).toEqual(
      expect.objectContaining({
        status: "completed",
        latestCheckpointId: expect.any(String)
      })
    );

    const uploadedCheckpoint = (
      await services.repositories.checkpoints.listByRun(run.id)
    ).find((candidate) => candidate.kind === "step_completed");
    const checkpoint = uploadedCheckpoint
      ? await services.checkpointService.readCheckpoint(uploadedCheckpoint.id)
      : null;
    expect(checkpoint).toEqual(
      expect.objectContaining({
        kind: "step_completed",
        stepId: step!.id,
        payload: expect.objectContaining({
          artifactIds: artifact ? [artifact.id] : []
        })
      })
    );

    const logs = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/logs`
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json()).toEqual({
      logs: expect.arrayContaining([
        expect.objectContaining({
          level: "info",
          message: "remote execution started"
        })
      ])
    });

    const artifacts = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/artifacts`
    });
    expect(artifacts.statusCode).toBe(200);
    expect(artifacts.json()).toEqual({
      artifacts: [
        expect.objectContaining({
          runId: run.id,
          stepId: step!.id,
          relativePath: "artifacts/brief.md"
        })
      ]
    });
  });

  it("marks a remote run interrupted and resumable when the worker disconnects mid-step", async () => {
    const services = createInMemoryServiceContainer({
      workerStaleTimeoutMs: 24 * 60 * 60 * 1000
    });
    const app = buildApp({ services });
    appsToClose.add(app);
    const outcome = await seedOutcomePlanAndWorker(services);

    const created = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: "plan_outcome_123"
      }
    });

    expect(created.statusCode).toBe(201);
    const run = created.json();
    const [step] = await services.repositories.runs.listSteps(run.id);

    await claimCommandsEventually(app, services);

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/disconnect",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        disconnectedAt: "2026-03-17T10:06:00.000Z"
      }
    });

    await services.executionService.waitForRun(run.id);

    const interruptedRun = await services.repositories.runs.getById(run.id);
    expect(interruptedRun).toEqual(
      expect.objectContaining({
        status: "interrupted",
        latestCheckpointId: expect.any(String),
        resumable: true
      })
    );

    const interruptedStep = (
      await services.repositories.runs.listSteps(run.id)
    ).find((candidate) => candidate.id === step!.id);
    expect(interruptedStep).toEqual(
      expect.objectContaining({
        executionTarget: "remote_worker",
        remoteWorkerId: "worker_1"
      })
    );
  });

  it("reassigns onto the reconnected worker session if the busy claim loses after assignment", async () => {
    const services = createInMemoryServiceContainer({
      workerStaleTimeoutMs: 24 * 60 * 60 * 1000
    });
    const app = buildApp({ services });
    appsToClose.add(app);
    const outcome = await seedOutcomePlanAndWorker(services);
    const originalUpdateSessionState =
      services.repositories.remoteWorkers.updateSessionState.bind(
        services.repositories.remoteWorkers
      );
    const originalUpsert = services.repositories.remoteWorkers.upsert.bind(
        services.repositories.remoteWorkers
      );
    let simulatedReconnect = false;

    services.repositories.remoteWorkers.updateSessionState = (async (input) => {
      if (
        !simulatedReconnect &&
        input.workerId === "worker_1" &&
        input.workerSessionId === "worker_session_1" &&
        input.availability === "busy"
      ) {
        simulatedReconnect = true;
        await originalUpsert({
          id: "worker_1",
          sessionId: "worker_session_2",
          workspaceId: "ws_123",
          label: "Primary remote worker",
          daemonVersion: "1.0.1",
          availability: "available",
          capabilities: {
            capabilityFamilies: ["coding", "terminal"],
            supportsArtifacts: true,
            supportsCheckpoints: true,
            supportsLogs: true
          },
          health: {
            status: "healthy",
            lastHeartbeatAt: "2026-03-17T10:01:30.000Z"
          },
          connectedAt: "2026-03-17T10:01:30.000Z",
          disconnectedAt: null,
          updatedAt: "2026-03-17T10:01:30.000Z"
        });

        return null;
      }

      return originalUpdateSessionState(input);
    }) as typeof services.repositories.remoteWorkers.updateSessionState;

    const created = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: "plan_outcome_123"
      }
    });

    expect(created.statusCode).toBe(201);
    const run = created.json();

    const claimedCommands = await (async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const claimed = await app.inject({
          method: "POST",
          url: "/api/worker-daemon/commands/claim",
          headers: daemonHeaders(services.daemonAuthToken),
          payload: {
            workerId: "worker_1",
            workerSessionId: "worker_session_2"
          }
        });

        if (
          claimed.statusCode === 200 &&
          Array.isArray(claimed.json().commands) &&
          claimed.json().commands.length > 0
        ) {
          return claimed;
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      throw new Error("Timed out waiting for a reassigned remote dispatch command.");
    })();

    expect(claimedCommands.json()).toEqual({
      commands: [
        expect.objectContaining({
          assignment: expect.objectContaining({
            workerId: "worker_1",
            workerSessionId: "worker_session_2"
          })
        })
      ]
    });

    const [step] = await services.repositories.runs.listSteps(run.id);
    expect(step).toEqual(
      expect.objectContaining({
        remoteWorkerId: "worker_1",
        remoteWorkerSessionId: "worker_session_2",
        executionTarget: "remote_worker",
        status: "claimed"
      })
    );
  });

  it("interrupts a remote run when the worker expires without sending disconnect", async () => {
    let currentTime = new Date("2026-03-17T10:00:00.000Z");
    const services = createInMemoryServiceContainer({
      now: () => currentTime,
      workerStaleTimeoutMs: 60_000,
      workerSweepIntervalMs: 5
    });
    const app = buildApp({ services });
    appsToClose.add(app);
    const outcome = await services.repositories.outcomes.create({
      id: "outcome_124",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Ship the launch brief.",
      source: "web"
    });

    await createPlanForOutcomeTurn(services.repositories, {
      id: "plan_outcome_124",
      outcomeId: outcome.id,
      status: "draft",
      createdAt: currentTime.toISOString(),
      updatedAt: currentTime.toISOString(),
      nodes: [
        {
          id: "plan_outcome_124:draft-brief",
          kind: "root",
          title: "Draft brief",
          capability: "coding",
          instruction: "Write the launch brief.",
          template: "draft_brief",
          expectedArtifactPath: "artifacts/brief.md",
          expectedArtifactKind: "brief"
        }
      ],
      edges: []
    });

    await services.workerRegistry.registerWorker({
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      workspaceId: "ws_123",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      connectedAt: currentTime.toISOString(),
      capabilities: {
        capabilityFamilies: ["coding", "terminal"],
        supportsArtifacts: true,
        supportsCheckpoints: true,
        supportsLogs: true
      }
    });

    const created = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: "plan_outcome_124"
      }
    });

    expect(created.statusCode).toBe(201);
    const run = created.json();

    await claimCommandsEventually(app, services);

    currentTime = new Date("2026-03-17T10:02:00.000Z");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await services.executionService.waitForRun(run.id);

    await expect(services.repositories.runs.getById(run.id)).resolves.toEqual(
      expect.objectContaining({
        status: "interrupted",
        resumable: true,
        latestCheckpointId: expect.any(String)
      })
    );
  });

  it("does not complete a remote step until the declared artifact uploads have persisted", async () => {
    const services = createInMemoryServiceContainer({
      workerStaleTimeoutMs: 24 * 60 * 60 * 1000
    });
    const app = buildApp({ services });
    appsToClose.add(app);
    const outcome = await seedOutcomePlanAndWorker(services);

    const created = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: "plan_outcome_123"
      }
    });

    expect(created.statusCode).toBe(201);
    const run = created.json();
    const claimedCommands = await claimCommandsEventually(app, services);
    const [step] = await services.repositories.runs.listSteps(run.id);

    expect(claimedCommands.statusCode).toBe(200);
    expect(step?.remoteExecutionAttemptId).toBeTruthy();

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "checkpoint",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        checkpoint: {
          kind: "step_completed",
          resumable: true,
          createdAt: "2026-03-17T10:04:00.000Z",
          payload: {
            version: 1,
            run: {
              id: run.id,
              outcomeId: outcome.id,
              workspaceId: outcome.workspaceId,
              status: "running"
            },
            steps: [
              {
                stepId: step!.id,
                title: step!.title,
                status: "completed"
              }
            ],
            readyStepIds: [],
            blockedStepIds: [],
            workspacePaths: {
              inputDir: `/tmp/input/${run.id}`,
              logsDir: `/tmp/logs/${run.id}`,
              artifactsDir: `/tmp/artifacts/${run.id}`
            },
            artifactIds: [],
            latestAuditSequence: 0
          }
        }
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "terminal",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        status: "completed",
        exitCode: 0,
        stdoutSummary: "remote execution complete",
        stderrSummary: "",
        expectedArtifactCount: 1,
        finishedAt: "2026-03-17T10:05:00.000Z"
      }
    });

    await expect(services.repositories.runs.getById(run.id)).resolves.toEqual(
      expect.objectContaining({
        status: "running"
      })
    );

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/events",
      headers: daemonHeaders(services.daemonAuthToken),
      payload: {
        type: "artifact",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        runId: run.id,
        stepId: step!.id,
        attemptId: step!.remoteExecutionAttemptId,
        artifact: {
          kind: "brief",
          relativePath: "artifacts/brief.md",
          size: 14,
          contentBase64: Buffer.from("# Launch brief\n").toString("base64"),
          createdAt: "2026-03-17T10:06:00.000Z"
        }
      }
    });

    await services.executionService.waitForRun(run.id);
    await expect(services.repositories.runs.getById(run.id)).resolves.toEqual(
      expect.objectContaining({
        status: "completed"
      })
    );
    await expect(services.repositories.artifacts.listByRun(run.id)).resolves.toEqual([
      expect.objectContaining({
        stepId: step!.id,
        relativePath: "artifacts/brief.md"
      })
    ]);
  });
});
