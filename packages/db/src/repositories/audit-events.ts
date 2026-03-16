import { AuditEventSchema, type AuditEvent } from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import {
  outcomes,
  outcomeRuns,
  runAuditEvents,
  runCheckpoints,
  runSteps
} from "../schema";

type RunAuditEventRow = typeof runAuditEvents.$inferSelect;

export type StoredAuditEvent = AuditEvent;
export type AppendAuditEventInput = AuditEvent;

function mapAuditEventRow(row: RunAuditEventRow): StoredAuditEvent {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    outcomeId: row.outcomeId,
    runId: row.runId,
    stepId: row.stepId,
    checkpointId: row.checkpointId,
    sequence: row.sequence,
    category: row.category,
    eventType: row.eventType,
    actorType: row.actorType,
    summary: row.summary,
    payload: row.payload as Record<string, unknown>,
    createdAt: row.createdAt.toISOString()
  };
}

function compareAuditEvents(left: RunAuditEventRow, right: RunAuditEventRow) {
  const sequenceDelta = left.sequence - right.sequence;

  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }

  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

export class AuditEventRepository {
  constructor(private readonly db: DatabaseClient) {}

  async append(input: AppendAuditEventInput): Promise<StoredAuditEvent> {
    const event = AuditEventSchema.parse(input);

    return this.db.transaction(async (transaction) => {
      const [runRows, outcomeRows, stepRows, checkpointRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(outcomes),
        transaction.select().from(runSteps),
        transaction.select().from(runCheckpoints)
      ]);

      const run = runRows.find((row) => row.id === event.runId);

      if (!run) {
        throw new Error(`Run ${event.runId} does not exist.`);
      }

      if (run.outcomeId !== event.outcomeId) {
        throw new Error(
          `Run ${event.runId} belongs to ${run.outcomeId}, not ${event.outcomeId}.`
        );
      }

      const outcome = outcomeRows.find((row) => row.id === event.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${event.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== event.workspaceId) {
        throw new Error(
          `Outcome ${event.outcomeId} belongs to ${outcome.workspaceId}, not ${event.workspaceId}.`
        );
      }

      if (event.stepId) {
        const step = stepRows.find((row) => row.id === event.stepId);

        if (!step) {
          throw new Error(`Step ${event.stepId} does not exist.`);
        }

        if (step.runId !== event.runId) {
          throw new Error(
            `Step ${event.stepId} belongs to ${step.runId}, not ${event.runId}.`
          );
        }
      }

      if (event.checkpointId) {
        const checkpoint = checkpointRows.find((row) => row.id === event.checkpointId);

        if (!checkpoint) {
          throw new Error(`Checkpoint ${event.checkpointId} does not exist.`);
        }

        if (checkpoint.runId !== event.runId) {
          throw new Error(
            `Checkpoint ${event.checkpointId} belongs to ${checkpoint.runId}, not ${event.runId}.`
          );
        }
      }

      const [created] = await transaction
        .insert(runAuditEvents)
        .values({
          id: event.id,
          workspaceId: event.workspaceId,
          outcomeId: event.outcomeId,
          runId: event.runId,
          stepId: event.stepId,
          checkpointId: event.checkpointId,
          sequence: event.sequence,
          category: event.category,
          eventType: event.eventType,
          actorType: event.actorType,
          summary: event.summary,
          payload: event.payload,
          createdAt: new Date(event.createdAt)
        })
        .returning();

      return mapAuditEventRow(created);
    });
  }

  async listByRun(runId: string): Promise<StoredAuditEvent[]> {
    const rows = await this.db.select().from(runAuditEvents);

    return rows
      .filter((row) => row.runId === runId)
      .sort(compareAuditEvents)
      .map(mapAuditEventRow);
  }
}
