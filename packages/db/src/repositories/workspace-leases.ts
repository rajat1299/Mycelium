import { eq } from "drizzle-orm";
import type { DatabaseClient } from "../client";
import { outcomeRuns, workspaceLeases } from "../schema";

type WorkspaceLeaseRow = typeof workspaceLeases.$inferSelect;

export type StoredWorkspaceLease = {
  runId: string;
  rootPath: string;
  inputPath: string;
  artifactsPath: string;
  logsPath: string;
  acquiredAt: string;
  releasedAt: string | null;
};

export type AcquireWorkspaceLeaseInput = {
  runId: string;
  rootPath: string;
  inputPath: string;
  artifactsPath: string;
  logsPath: string;
  acquiredAt: string;
};

export type ReleaseWorkspaceLeaseInput = {
  runId: string;
  releasedAt: string;
};

function mapWorkspaceLeaseRow(row: WorkspaceLeaseRow): StoredWorkspaceLease {
  return {
    runId: row.runId,
    rootPath: row.rootPath,
    inputPath: row.inputPath,
    artifactsPath: row.artifactsPath,
    logsPath: row.logsPath,
    acquiredAt: row.acquiredAt.toISOString(),
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null
  };
}

export class WorkspaceLeaseRepository {
  constructor(private readonly db: DatabaseClient) {}

  async acquire(input: AcquireWorkspaceLeaseInput): Promise<StoredWorkspaceLease> {
    return this.db.transaction(async (transaction) => {
      const [runRows, leaseRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(workspaceLeases)
      ]);

      const run = runRows.find((row) => row.id === input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      const activeLease = leaseRows.find(
        (row) => row.runId === input.runId && row.releasedAt === null
      );

      if (activeLease) {
        throw new Error(`Active workspace lease already exists for run ${input.runId}.`);
      }

      const [created] = await transaction
        .insert(workspaceLeases)
        .values({
          runId: input.runId,
          rootPath: input.rootPath,
          inputPath: input.inputPath,
          artifactsPath: input.artifactsPath,
          logsPath: input.logsPath,
          acquiredAt: new Date(input.acquiredAt),
          releasedAt: null
        })
        .returning();

      return mapWorkspaceLeaseRow(created);
    });
  }

  async getActiveByRun(runId: string): Promise<StoredWorkspaceLease | null> {
    const rows = await this.db.select().from(workspaceLeases);
    const found = rows.find((row) => row.runId === runId && row.releasedAt === null);

    return found ? mapWorkspaceLeaseRow(found) : null;
  }

  async release(
    input: ReleaseWorkspaceLeaseInput
  ): Promise<StoredWorkspaceLease | null> {
    const [updated] = await this.db
      .update(workspaceLeases)
      .set({
        releasedAt: new Date(input.releasedAt)
      })
      .where(eq(workspaceLeases.runId, input.runId))
      .returning();

    return updated ? mapWorkspaceLeaseRow(updated) : null;
  }
}
