import { eq } from "drizzle-orm";
import {
  CheckpointSummarySchema,
  type CheckpointSummary
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import { outcomes, outcomeRuns, runCheckpoints, runSteps } from "../schema";

type RunCheckpointRow = typeof runCheckpoints.$inferSelect;
type RunRow = typeof outcomeRuns.$inferSelect;
type OutcomeRow = typeof outcomes.$inferSelect;
type StepRow = typeof runSteps.$inferSelect;

export type StoredCheckpoint = CheckpointSummary;
export type CreateCheckpointInput = CheckpointSummary;

function mapCheckpointRow(row: RunCheckpointRow): StoredCheckpoint {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    outcomeId: row.outcomeId,
    runId: row.runId,
    stepId: row.stepId,
    sequence: row.sequence,
    kind: row.kind,
    resumable: row.resumable,
    storeKey: row.storeKey,
    checksum: row.checksum,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString()
  };
}

function compareCheckpointsNewestFirst(
  left: RunCheckpointRow,
  right: RunCheckpointRow
) {
  const sequenceDelta = right.sequence - left.sequence;

  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }

  const createdDelta = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return right.id.localeCompare(left.id);
}

export class CheckpointRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateCheckpointInput): Promise<StoredCheckpoint> {
    const checkpoint = CheckpointSummarySchema.parse(input);

    return this.db.transaction(async (transaction) => {
      const [runRows, outcomeRows, stepRows, checkpointRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(outcomes),
        transaction.select().from(runSteps),
        transaction.select().from(runCheckpoints)
      ]);

      const run = runRows.find((row) => row.id === checkpoint.runId);

      if (!run) {
        throw new Error(`Run ${checkpoint.runId} does not exist.`);
      }

      if (run.outcomeId !== checkpoint.outcomeId) {
        throw new Error(
          `Run ${checkpoint.runId} belongs to ${run.outcomeId}, not ${checkpoint.outcomeId}.`
        );
      }

      const outcome = outcomeRows.find((row) => row.id === checkpoint.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${checkpoint.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== checkpoint.workspaceId) {
        throw new Error(
          `Outcome ${checkpoint.outcomeId} belongs to ${outcome.workspaceId}, not ${checkpoint.workspaceId}.`
        );
      }

      if (checkpoint.stepId) {
        const step = stepRows.find((row) => row.id === checkpoint.stepId);

        if (!step) {
          throw new Error(`Step ${checkpoint.stepId} does not exist.`);
        }

        if (step.runId !== checkpoint.runId) {
          throw new Error(
            `Step ${checkpoint.stepId} belongs to ${step.runId}, not ${checkpoint.runId}.`
          );
        }
      }

      const latestRecordedCheckpoint = checkpointRows
        .filter((row) => row.runId === checkpoint.runId)
        .sort(compareCheckpointsNewestFirst)
        .at(0);

      const shouldAdvanceLatestPointer =
        !latestRecordedCheckpoint ||
        checkpoint.sequence > latestRecordedCheckpoint.sequence;

      const [created] = await transaction
        .insert(runCheckpoints)
        .values({
          id: checkpoint.id,
          workspaceId: checkpoint.workspaceId,
          outcomeId: checkpoint.outcomeId,
          runId: checkpoint.runId,
          stepId: checkpoint.stepId,
          sequence: checkpoint.sequence,
          kind: checkpoint.kind,
          resumable: checkpoint.resumable,
          storeKey: checkpoint.storeKey,
          checksum: checkpoint.checksum,
          byteSize: checkpoint.byteSize,
          createdAt: new Date(checkpoint.createdAt)
        })
        .returning();

      if (shouldAdvanceLatestPointer) {
        await transaction
          .update(outcomeRuns)
          .set({
            latestCheckpointId: checkpoint.id,
            resumable: checkpoint.resumable,
            updatedAt: new Date(checkpoint.createdAt)
          })
          .where(eq(outcomeRuns.id, checkpoint.runId))
          .returning();
      }

      return mapCheckpointRow(created);
    });
  }

  async getById(id: string): Promise<StoredCheckpoint | null> {
    const rows = await this.db.select().from(runCheckpoints);
    const found = rows.find((row) => row.id === id);
    return found ? mapCheckpointRow(found) : null;
  }

  async getByRunSequence(input: {
    runId: string;
    sequence: number;
  }): Promise<StoredCheckpoint | null> {
    const rows = await this.db.select().from(runCheckpoints);
    const found = rows.find(
      (row) => row.runId === input.runId && row.sequence === input.sequence
    );

    return found ? mapCheckpointRow(found) : null;
  }

  async listByRun(runId: string): Promise<StoredCheckpoint[]> {
    const rows = await this.db.select().from(runCheckpoints);

    return rows
      .filter((row) => row.runId === runId)
      .sort(compareCheckpointsNewestFirst)
      .map(mapCheckpointRow);
  }

  async getLatestResumableByRun(runId: string): Promise<StoredCheckpoint | null> {
    const rows = await this.db.select().from(runCheckpoints);
    const found = rows
      .filter((row) => row.runId === runId && row.resumable)
      .sort(compareCheckpointsNewestFirst)
      .at(0);

    return found ? mapCheckpointRow(found) : null;
  }
}
