import { eq } from "drizzle-orm";
import type { DatabaseClient } from "../client";
import {
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  runEvents,
  runSteps
} from "../schema";

type RunRow = typeof outcomeRuns.$inferSelect;
type RunStepRow = typeof runSteps.$inferSelect;

export type StoredRun = {
  id: string;
  outcomeId: string;
  planId: string;
  status: RunRow["status"];
  createdAt: string;
  updatedAt: string;
};

export type StoredRunStep = {
  id: string;
  runId: string;
  planNodeId: string;
  title: string;
  kind: string;
  capability: string;
  status: RunStepRow["status"];
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateRunFromPlanInput = {
  id: string;
  outcomeId: string;
  planId: string;
  createdAt: string;
  updatedAt: string;
};

export type AppendRunEventInput = {
  id: string;
  runId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type UpdateStepStatusInput = {
  stepId: string;
  status: RunStepRow["status"];
  updatedAt: string;
};

function mapRunRow(row: RunRow): StoredRun {
  return {
    id: row.id,
    outcomeId: row.outcomeId,
    planId: row.planId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapRunStepRow(row: RunStepRow): StoredRunStep {
  return {
    id: row.id,
    runId: row.runId,
    planNodeId: row.planNodeId,
    title: row.title,
    kind: row.kind,
    capability: row.capability,
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function compareRunRows(left: RunRow, right: RunRow) {
  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  const updatedDelta = left.updatedAt.getTime() - right.updatedAt.getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

export class RunRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createFromPlan(input: CreateRunFromPlanInput): Promise<StoredRun> {
    return this.db.transaction(async (transaction) => {
      const plans = await transaction.select().from(outcomePlans);
      const plan = plans.find((row) => row.id === input.planId);

      if (!plan) {
        throw new Error(`Plan ${input.planId} does not exist.`);
      }

      if (plan.outcomeId !== input.outcomeId) {
        throw new Error(
          `Plan ${input.planId} belongs to ${plan.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const [created] = await transaction
        .insert(outcomeRuns)
        .values({
          id: input.id,
          outcomeId: plan.outcomeId,
          planId: input.planId,
          status: "queued",
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt)
        })
        .returning();

      const [nodeRows, edgeRows] = await Promise.all([
        transaction.select().from(planNodes),
        transaction.select().from(planEdges)
      ]);

      const nodes = nodeRows
        .filter((row) => row.planId === input.planId)
        .sort((left, right) => left.position - right.position);
      const targetNodeIds = new Set(
        edgeRows.filter((row) => row.planId === input.planId).map((row) => row.to)
      );

      if (nodes.length > 0) {
        const stepValues: Array<typeof runSteps.$inferInsert> = nodes.map((node) => ({
          id: `step_${input.id}_${node.id}`,
          runId: input.id,
          planNodeId: node.id,
          title: node.title,
          kind: node.kind,
          capability: node.capability,
          status: targetNodeIds.has(node.id) ? "pending" : "ready",
          position: node.position,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt)
        }));

        await transaction.insert(runSteps).values(
          stepValues.map((step) => ({
            ...step,
            status: step.status
          }))
        );
      }

      return mapRunRow(created);
    });
  }

  async getById(id: string): Promise<StoredRun | null> {
    const rows = await this.db.select().from(outcomeRuns);
    const found = rows.find((row) => row.id === id);
    return found ? mapRunRow(found) : null;
  }

  async getLatestByOutcome(outcomeId: string): Promise<StoredRun | null> {
    const rows = await this.db.select().from(outcomeRuns);
    const found = rows
      .filter((row) => row.outcomeId === outcomeId)
      .sort(compareRunRows)
      .at(-1);

    return found ? mapRunRow(found) : null;
  }

  async listSteps(runId: string): Promise<StoredRunStep[]> {
    const rows = await this.db.select().from(runSteps);
    return rows
      .filter((row) => row.runId === runId)
      .sort((left, right) => left.position - right.position)
      .map(mapRunStepRow);
  }

  async appendEvent(input: AppendRunEventInput): Promise<void> {
    await this.db.insert(runEvents).values({
      id: input.id,
      runId: input.runId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: new Date(input.createdAt)
    });
  }

  async updateStepStatus(
    input: UpdateStepStatusInput
  ): Promise<StoredRunStep | null> {
    const [updated] = await this.db
      .update(runSteps)
      .set({
        status: input.status,
        updatedAt: new Date(input.updatedAt)
      })
      .where(eq(runSteps.id, input.stepId))
      .returning();

    return updated ? mapRunStepRow(updated) : null;
  }
}
