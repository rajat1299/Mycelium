import { eq } from "drizzle-orm";
import type {
  RemoteWorker,
  RemoteWorkerHealthStatus
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import { remoteWorkers, runSteps, workspaceLeases } from "../schema";

type RemoteWorkerRow = typeof remoteWorkers.$inferSelect;

export type StoredRemoteWorker = RemoteWorker;

export type UpsertRemoteWorkerInput = StoredRemoteWorker;

export type RecordRemoteWorkerHeartbeatInput = {
  workerId: string;
  workerSessionId: string;
  sentAt: string;
  healthStatus: RemoteWorkerHealthStatus;
};

export type CleanupStaleRemoteWorkersInput = {
  staleBefore: string;
  disconnectedAt: string;
};

function mapRemoteWorkerRow(row: RemoteWorkerRow): StoredRemoteWorker {
  return {
    id: row.id,
    sessionId: row.sessionId,
    workspaceId: row.workspaceId,
    label: row.label,
    daemonVersion: row.daemonVersion,
    availability: row.availability,
    capabilities: {
      capabilityFamilies: row.capabilityFamilies as StoredRemoteWorker["capabilities"]["capabilityFamilies"],
      supportsArtifacts: row.supportsArtifacts,
      supportsCheckpoints: row.supportsCheckpoints,
      supportsLogs: row.supportsLogs
    },
    health: {
      status: row.healthStatus,
      lastHeartbeatAt: row.lastHeartbeatAt.toISOString()
    },
    connectedAt: row.connectedAt.toISOString(),
    disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString()
  };
}

function compareWorkers(left: StoredRemoteWorker, right: StoredRemoteWorker) {
  const updatedDelta =
    new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

function foreignKeyDeleteError(
  table: string,
  constraint: string,
  referencingTable: string
) {
  return new Error(
    `update or delete on table "${table}" violates foreign key constraint "${constraint}" on table "${referencingTable}"`
  );
}

export class RemoteWorkerRepository {
  constructor(private readonly db: DatabaseClient) {}

  async upsert(input: UpsertRemoteWorkerInput): Promise<StoredRemoteWorker> {
    return this.db.transaction(async (transaction) => {
      const rows = await transaction.select().from(remoteWorkers);
      const existing = rows.find((row) => row.id === input.id);
      const conflictingSession = rows.find(
        (row) => row.sessionId === input.sessionId && row.id !== input.id
      );

      if (conflictingSession) {
        throw new Error(
          `duplicate key value violates unique constraint "remote_workers_session_id_key"`
        );
      }

      if (!existing) {
        const [created] = await transaction
          .insert(remoteWorkers)
          .values({
            id: input.id,
            sessionId: input.sessionId,
            workspaceId: input.workspaceId,
            label: input.label,
            daemonVersion: input.daemonVersion,
            availability: input.availability,
            capabilityFamilies: input.capabilities.capabilityFamilies,
            supportsArtifacts: input.capabilities.supportsArtifacts,
            supportsCheckpoints: input.capabilities.supportsCheckpoints,
            supportsLogs: input.capabilities.supportsLogs,
            healthStatus: input.health.status,
            connectedAt: new Date(input.connectedAt),
            lastHeartbeatAt: new Date(input.health.lastHeartbeatAt),
            disconnectedAt: input.disconnectedAt
              ? new Date(input.disconnectedAt)
              : null,
            updatedAt: new Date(input.updatedAt)
          })
          .returning();

        return mapRemoteWorkerRow(created);
      }

      const [updated] = await transaction
        .update(remoteWorkers)
        .set({
          sessionId: input.sessionId,
          workspaceId: input.workspaceId,
          label: input.label,
          daemonVersion: input.daemonVersion,
          availability: input.availability,
          capabilityFamilies: input.capabilities.capabilityFamilies,
          supportsArtifacts: input.capabilities.supportsArtifacts,
          supportsCheckpoints: input.capabilities.supportsCheckpoints,
          supportsLogs: input.capabilities.supportsLogs,
          healthStatus: input.health.status,
          connectedAt: new Date(input.connectedAt),
          lastHeartbeatAt: new Date(input.health.lastHeartbeatAt),
          disconnectedAt: input.disconnectedAt
            ? new Date(input.disconnectedAt)
            : null,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(remoteWorkers.id, input.id))
        .returning();

      return mapRemoteWorkerRow(updated);
    });
  }

  async getById(id: string): Promise<StoredRemoteWorker | null> {
    const rows = await this.db.select().from(remoteWorkers);
    const found = rows.find((row) => row.id === id);
    return found ? mapRemoteWorkerRow(found) : null;
  }

  async getBySession(sessionId: string): Promise<StoredRemoteWorker | null> {
    const rows = await this.db.select().from(remoteWorkers);
    const found = rows.find((row) => row.sessionId === sessionId);
    return found ? mapRemoteWorkerRow(found) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<StoredRemoteWorker[]> {
    const rows = await this.db.select().from(remoteWorkers);
    return rows
      .filter((row) => row.workspaceId === workspaceId)
      .map(mapRemoteWorkerRow)
      .sort(compareWorkers);
  }

  async recordHeartbeat(
    input: RecordRemoteWorkerHeartbeatInput
  ): Promise<StoredRemoteWorker | null> {
    const rows = await this.db.select().from(remoteWorkers);
    const existing = rows.find((row) => row.id === input.workerId);

    if (!existing || existing.sessionId !== input.workerSessionId) {
      return null;
    }

    const [updated] = await this.db
      .update(remoteWorkers)
      .set({
        healthStatus: input.healthStatus,
        lastHeartbeatAt: new Date(input.sentAt),
        updatedAt: new Date(input.sentAt)
      })
      .where(eq(remoteWorkers.id, input.workerId))
      .returning();

    return updated ? mapRemoteWorkerRow(updated) : null;
  }

  async cleanupStaleSessions(
    input: CleanupStaleRemoteWorkersInput
  ): Promise<StoredRemoteWorker[]> {
    const rows = await this.db.select().from(remoteWorkers);
    const staleRows = rows.filter(
      (row) =>
        row.availability !== "offline" &&
        row.lastHeartbeatAt.getTime() < new Date(input.staleBefore).getTime()
    );

    const updatedWorkers: StoredRemoteWorker[] = [];

    for (const worker of staleRows) {
      const [updated] = await this.db
        .update(remoteWorkers)
        .set({
          availability: "offline",
          healthStatus: "offline",
          disconnectedAt: new Date(input.disconnectedAt),
          updatedAt: new Date(input.disconnectedAt)
        })
        .where(eq(remoteWorkers.id, worker.id))
        .returning();

      if (updated) {
        updatedWorkers.push(mapRemoteWorkerRow(updated));
      }
    }

    return updatedWorkers.sort(compareWorkers);
  }

  async delete(id: string): Promise<boolean> {
    const [stepRows, leaseRows] = await Promise.all([
      this.db.select().from(runSteps),
      this.db.select().from(workspaceLeases)
    ]);

    if (stepRows.some((row) => row.remoteWorkerId === id)) {
      throw foreignKeyDeleteError(
        "remote_workers",
        "run_steps_remote_worker_id_fkey",
        "run_steps"
      );
    }

    if (leaseRows.some((row) => row.remoteWorkerId === id)) {
      throw foreignKeyDeleteError(
        "remote_workers",
        "workspace_leases_remote_worker_id_fkey",
        "workspace_leases"
      );
    }

    const deleted = await this.db
      .delete(remoteWorkers)
      .where(eq(remoteWorkers.id, id))
      .returning();

    return deleted.length > 0;
  }
}
