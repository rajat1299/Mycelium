import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/lib/event-bus";
import { createInMemoryRepositories } from "../src/lib/repositories";
import { createWorkerRegistry } from "../src/lib/worker-registry";

afterEach(() => {
  vi.useRealTimers();
});

describe("worker registry", () => {
  it("actively sweeps stale workers and reports expired sessions without a read trigger", async () => {
    vi.useFakeTimers();
    const repositories = createInMemoryRepositories();
    const expiredSessions: Array<{ workerId: string; workerSessionId: string }> = [];
    let currentTime = new Date("2026-03-17T10:00:00.000Z");
    const registry = createWorkerRegistry({
      repositories,
      eventBus: createEventBus(),
      now: () => currentTime,
      staleAfterMs: 60_000,
      sweepIntervalMs: 5_000,
      onWorkersExpired(workers) {
        expiredSessions.push(
          ...workers.map((worker) => ({
            workerId: worker.id,
            workerSessionId: worker.sessionId
          }))
        );
      }
    });

    await repositories.remoteWorkers.upsert({
      id: "worker_1",
      sessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      availability: "busy",
      capabilities: {
        capabilityFamilies: ["coding", "terminal"],
        supportsArtifacts: true,
        supportsCheckpoints: true,
        supportsLogs: true
      },
      health: {
        status: "healthy",
        lastHeartbeatAt: currentTime.toISOString()
      },
      connectedAt: currentTime.toISOString(),
      disconnectedAt: null,
      updatedAt: currentTime.toISOString()
    });

    currentTime = new Date("2026-03-17T10:02:00.000Z");
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(repositories.remoteWorkers.getById("worker_1")).resolves.toEqual(
      expect.objectContaining({
        id: "worker_1",
        availability: "offline",
        disconnectedAt: "2026-03-17T10:02:00.000Z"
      })
    );
    expect(expiredSessions).toEqual([
      {
        workerId: "worker_1",
        workerSessionId: "worker_session_1"
      }
    ]);

    registry.close();
  });

  it("does not let a stale heartbeat overwrite a reconnected session", async () => {
    const repositories = createInMemoryRepositories();
    const registry = createWorkerRegistry({
      repositories,
      eventBus: createEventBus()
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
    const capabilities = {
      capabilityFamilies: ["coding", "terminal"] as const,
      supportsArtifacts: true,
      supportsCheckpoints: true,
      supportsLogs: true
    };

    const originalUpsert = repositories.remoteWorkers.upsert.bind(
      repositories.remoteWorkers
    );
    const originalUpdateSessionState =
      repositories.remoteWorkers.updateSessionState.bind(
        repositories.remoteWorkers
      );
    let simulatedReconnect = false;

    repositories.remoteWorkers.updateSessionState = (async (input) => {
      if (!simulatedReconnect && input.workerId === "worker_1") {
        simulatedReconnect = true;
        await originalUpsert({
          id: "worker_1",
          sessionId: "worker_session_2",
          workspaceId: "ws_default",
          label: "Primary remote worker",
          daemonVersion: "1.0.0",
          availability: "available",
          capabilities: {
            capabilityFamilies: [...capabilities.capabilityFamilies],
            supportsArtifacts: capabilities.supportsArtifacts,
            supportsCheckpoints: capabilities.supportsCheckpoints,
            supportsLogs: capabilities.supportsLogs
          },
          health: {
            status: "healthy",
            lastHeartbeatAt: "2026-03-16T10:06:00.000Z"
          },
          connectedAt: "2026-03-16T10:06:00.000Z",
          disconnectedAt: null,
          updatedAt: "2026-03-16T10:06:00.000Z"
        });
      }

      return originalUpdateSessionState(input);
    }) as typeof repositories.remoteWorkers.updateSessionState;

    await expect(
      registry.recordHeartbeat({
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        sentAt: "2026-03-16T10:05:00.000Z",
        health: {
          status: "degraded",
          lastHeartbeatAt: "2026-03-16T10:05:00.000Z"
        }
      })
    ).resolves.toBeNull();

    await expect(repositories.remoteWorkers.getById("worker_1")).resolves.toEqual(
      expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_2",
        availability: "available",
        health: expect.objectContaining({
          status: "healthy",
          lastHeartbeatAt: "2026-03-16T10:06:00.000Z"
        }),
        disconnectedAt: null,
        updatedAt: "2026-03-16T10:06:00.000Z"
      })
    );
  });

  it("does not let a stale disconnect overwrite a reconnected session", async () => {
    const repositories = createInMemoryRepositories();
    const registry = createWorkerRegistry({
      repositories,
      eventBus: createEventBus()
    });

    await repositories.remoteWorkers.upsert({
      id: "worker_1",
      sessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      availability: "busy",
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
    const capabilities = {
      capabilityFamilies: ["coding", "terminal"] as const,
      supportsArtifacts: true,
      supportsCheckpoints: true,
      supportsLogs: true
    };

    const originalUpsert = repositories.remoteWorkers.upsert.bind(
      repositories.remoteWorkers
    );
    const originalUpdateSessionState =
      repositories.remoteWorkers.updateSessionState.bind(
        repositories.remoteWorkers
      );
    let simulatedReconnect = false;

    repositories.remoteWorkers.updateSessionState = (async (input) => {
      if (!simulatedReconnect && input.workerId === "worker_1") {
        simulatedReconnect = true;
        await originalUpsert({
          id: "worker_1",
          sessionId: "worker_session_2",
          workspaceId: "ws_default",
          label: "Primary remote worker",
          daemonVersion: "1.0.0",
          availability: "available",
          capabilities: {
            capabilityFamilies: [...capabilities.capabilityFamilies],
            supportsArtifacts: capabilities.supportsArtifacts,
            supportsCheckpoints: capabilities.supportsCheckpoints,
            supportsLogs: capabilities.supportsLogs
          },
          health: {
            status: "healthy",
            lastHeartbeatAt: "2026-03-16T10:06:00.000Z"
          },
          connectedAt: "2026-03-16T10:06:00.000Z",
          disconnectedAt: null,
          updatedAt: "2026-03-16T10:06:00.000Z"
        });
      }

      return originalUpdateSessionState(input);
    }) as typeof repositories.remoteWorkers.updateSessionState;

    await expect(
      registry.disconnectWorker({
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        disconnectedAt: "2026-03-16T10:07:00.000Z"
      })
    ).resolves.toBeNull();

    await expect(repositories.remoteWorkers.getById("worker_1")).resolves.toEqual(
      expect.objectContaining({
        id: "worker_1",
        sessionId: "worker_session_2",
        availability: "available",
        health: expect.objectContaining({
          status: "healthy",
          lastHeartbeatAt: "2026-03-16T10:06:00.000Z"
        }),
        disconnectedAt: null,
        updatedAt: "2026-03-16T10:06:00.000Z"
      })
    );
  });
});
