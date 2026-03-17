import type {
  RemoteWorker,
  RemoteWorkerAvailability,
  RemoteWorkerHeartbeat,
  RemoteWorkerRegistration
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

const DEFAULT_WORKER_STALE_TIMEOUT_MS = 60_000;

type DisconnectWorkerInput = {
  workerId: string;
  workerSessionId: string;
  disconnectedAt: string;
};

type UpdateWorkerAvailabilityInput = {
  workerId: string;
  workerSessionId: string;
  availability: RemoteWorkerAvailability;
  updatedAt: string;
};

type WorkerRegistryOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  now?: () => Date;
  staleAfterMs?: number;
};

export type WorkerRegistry = ReturnType<typeof createWorkerRegistry>;

export function createWorkerRegistry(options: WorkerRegistryOptions) {
  const now = options.now ?? (() => new Date());
  const staleAfterMs =
    options.staleAfterMs ?? DEFAULT_WORKER_STALE_TIMEOUT_MS;

  async function mergeWorker(
    workerId: string,
    workerSessionId: string,
    mutate: (worker: RemoteWorker) => RemoteWorker
  ): Promise<RemoteWorker | null> {
    const current = await options.repositories.remoteWorkers.getById(workerId);

    if (!current || current.sessionId !== workerSessionId) {
      return null;
    }

    return options.repositories.remoteWorkers.upsert(mutate(current));
  }

  async function cleanupStaleWorkers(): Promise<RemoteWorker[]> {
    const currentTime = now();
    const staleBefore = new Date(currentTime.getTime() - staleAfterMs).toISOString();

    return options.repositories.remoteWorkers.cleanupStaleSessions({
      staleBefore,
      disconnectedAt: currentTime.toISOString()
    });
  }

  return {
    async registerWorker(input: RemoteWorkerRegistration): Promise<RemoteWorker> {
      const existing = await options.repositories.remoteWorkers.getById(
        input.workerId
      );

      return options.repositories.remoteWorkers.upsert({
        id: input.workerId,
        sessionId: input.workerSessionId,
        workspaceId: input.workspaceId,
        label: input.label,
        daemonVersion: input.daemonVersion,
        availability: "available",
        capabilities: input.capabilities,
        health: {
          status: "healthy",
          lastHeartbeatAt: input.connectedAt
        },
        connectedAt: input.connectedAt,
        disconnectedAt: null,
        updatedAt:
          existing?.sessionId === input.workerSessionId
            ? existing.updatedAt
            : input.connectedAt
      });
    },

    async recordHeartbeat(input: RemoteWorkerHeartbeat): Promise<RemoteWorker | null> {
      return mergeWorker(
        input.workerId,
        input.workerSessionId,
        (current) => ({
          ...current,
          availability: current.availability === "busy" ? "busy" : "available",
          health: input.health,
          disconnectedAt: null,
          updatedAt: input.sentAt
        })
      );
    },

    async disconnectWorker(input: DisconnectWorkerInput): Promise<RemoteWorker | null> {
      return mergeWorker(
        input.workerId,
        input.workerSessionId,
        (current) => ({
          ...current,
          availability: "offline",
          health: {
            ...current.health,
            status: "offline",
            lastHeartbeatAt: input.disconnectedAt
          },
          disconnectedAt: input.disconnectedAt,
          updatedAt: input.disconnectedAt
        })
      );
    },

    async setWorkerAvailability(
      input: UpdateWorkerAvailabilityInput
    ): Promise<RemoteWorker | null> {
      return mergeWorker(
        input.workerId,
        input.workerSessionId,
        (current) => ({
          ...current,
          availability: input.availability,
          disconnectedAt:
            input.availability === "offline"
              ? input.updatedAt
              : null,
          updatedAt: input.updatedAt
        })
      );
    },

    async listWorkers(workspaceId: string): Promise<RemoteWorker[]> {
      await cleanupStaleWorkers();
      return options.repositories.remoteWorkers.listByWorkspace(workspaceId);
    },

    async getWorker(workerId: string): Promise<RemoteWorker | null> {
      await cleanupStaleWorkers();
      return options.repositories.remoteWorkers.getById(workerId);
    },

    async cleanupStaleWorkers(): Promise<RemoteWorker[]> {
      return cleanupStaleWorkers();
    }
  };
}
