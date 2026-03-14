import { and, eq } from "drizzle-orm";
import { StepRouteSchema, type StepRoute } from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import {
  outcomes,
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  runEvents,
  runSteps
} from "../schema";
import type { StoredOutcome } from "./outcomes";

type RunRow = typeof outcomeRuns.$inferSelect;
type RunStepRow = typeof runSteps.$inferSelect;
type OutcomeRow = typeof outcomes.$inferSelect;
type RunEventRow = typeof runEvents.$inferSelect;

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
  instruction?: string;
  template?: string;
  expectedArtifactPath?: string;
  expectedArtifactKind?: string;
  routeProviderId?: string | null;
  routeModelId?: string | null;
  routeAuthProfileId?: string | null;
  routePolicyVersion?: number;
  routeStatus?: StepRoute["status"];
  routeReason?: StepRoute["reason"];
  routeResolvedAt?: string;
  status: RunStepRow["status"];
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredRunEvent = {
  id: string;
  runId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
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

export type UpdateStepRouteInput = {
  stepId: string;
  route: StepRoute;
};

export type UpdateRunStatusInput = {
  runId: string;
  status: RunRow["status"];
  updatedAt: string;
};

export type UpdateRunLifecycleStatusInput = {
  runId: string;
  outcomeId: string;
  runStatus: RunRow["status"];
  outcomeStatus: OutcomeRow["status"];
  updatedAt: string;
};

export type ReleaseReadyDependentsInput = {
  runId: string;
  completedStepId: string;
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
    ...(row.instruction ? { instruction: row.instruction } : {}),
    ...(row.template ? { template: row.template } : {}),
    ...(row.expectedArtifactPath
      ? { expectedArtifactPath: row.expectedArtifactPath }
      : {}),
    ...(row.expectedArtifactKind
      ? { expectedArtifactKind: row.expectedArtifactKind }
      : {}),
    ...(row.routeStatus
      ? {
          routeProviderId: row.routeProviderId,
          routeModelId: row.routeModelId,
          routeAuthProfileId: row.routeAuthProfileId,
          routePolicyVersion: row.routePolicyVersion ?? undefined,
          routeStatus: row.routeStatus,
          routeReason: row.routeReason,
          routeResolvedAt: row.routeResolvedAt?.toISOString()
        }
      : {}),
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapRunEventRow(row: RunEventRow): StoredRunEvent {
  return {
    id: row.id,
    runId: row.runId,
    eventType: row.eventType,
    payload: row.payload as Record<string, unknown>,
    createdAt: row.createdAt.toISOString()
  };
}

function compareRunEvents(left: RunEventRow, right: RunEventRow) {
  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function mapOutcomeRow(row: OutcomeRow): StoredOutcome {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    prompt: row.prompt,
    source: row.source as StoredOutcome["source"],
    status: row.status,
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
          ...(node.instruction ? { instruction: node.instruction } : {}),
          ...(node.template ? { template: node.template } : {}),
          ...(node.expectedArtifactPath
            ? { expectedArtifactPath: node.expectedArtifactPath }
            : {}),
          ...(node.expectedArtifactKind
            ? { expectedArtifactKind: node.expectedArtifactKind }
            : {}),
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

  async listByOutcome(outcomeId: string): Promise<StoredRun[]> {
    const rows = await this.db.select().from(outcomeRuns);

    return rows
      .filter((row) => row.outcomeId === outcomeId)
      .sort(compareRunRows)
      .map(mapRunRow);
  }

  async listSteps(runId: string): Promise<StoredRunStep[]> {
    const rows = await this.db.select().from(runSteps);
    return rows
      .filter((row) => row.runId === runId)
      .sort((left, right) => left.position - right.position)
      .map(mapRunStepRow);
  }

  async listReadySteps(runId: string): Promise<StoredRunStep[]> {
    const rows = await this.db.select().from(runSteps);

    return rows
      .filter((row) => row.runId === runId && row.status === "ready")
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

  async listEvents(
    runId: string,
    eventType?: string
  ): Promise<StoredRunEvent[]> {
    const rows = await this.db.select().from(runEvents);

    return rows
      .filter(
        (row) =>
          row.runId === runId &&
          (eventType ? row.eventType === eventType : true)
      )
      .sort(compareRunEvents)
      .map(mapRunEventRow);
  }

  async updateLifecycleStatus(
    input: UpdateRunLifecycleStatusInput
  ): Promise<{ run: StoredRun; outcome: StoredOutcome } | null> {
    return this.db.transaction(async (transaction) => {
      const runRows = await transaction.select().from(outcomeRuns);
      const existingRun = runRows.find((row) => row.id === input.runId);

      if (!existingRun) {
        return null;
      }

      if (existingRun.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${existingRun.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const [updatedRun] = await transaction
        .update(outcomeRuns)
        .set({
          status: input.runStatus,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(outcomeRuns.id, input.runId))
        .returning();

      const [updatedOutcome] = await transaction
        .update(outcomes)
        .set({
          status: input.outcomeStatus,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(outcomes.id, input.outcomeId))
        .returning();

      if (!updatedOutcome) {
        throw new Error(
          `Outcome ${input.outcomeId} disappeared during lifecycle update.`
        );
      }

      return {
        run: mapRunRow(updatedRun),
        outcome: mapOutcomeRow(updatedOutcome)
      };
    });
  }

  async updateStatus(input: UpdateRunStatusInput): Promise<StoredRun | null> {
    const [updated] = await this.db
      .update(outcomeRuns)
      .set({
        status: input.status,
        updatedAt: new Date(input.updatedAt)
      })
      .where(eq(outcomeRuns.id, input.runId))
      .returning();

    return updated ? mapRunRow(updated) : null;
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

  async updateStepRoute(
    input: UpdateStepRouteInput
  ): Promise<StoredRunStep | null> {
    const route = StepRouteSchema.parse(input.route);
    const rows = await this.db.select().from(runSteps);
    const existing = rows.find((row) => row.id === input.stepId);

    if (!existing) {
      return null;
    }

    if (existing.capability !== route.capability) {
      throw new Error(
        `Route capability ${route.capability} does not match step capability ${existing.capability}.`
      );
    }

    const [updated] = await this.db
      .update(runSteps)
      .set({
        routeProviderId: route.providerId,
        routeModelId: route.modelId,
        routeAuthProfileId: route.authProfileId,
        routePolicyVersion: route.policyVersion,
        routeStatus: route.status,
        routeReason: route.reason,
        routeResolvedAt: new Date(route.resolvedAt)
      })
      .where(eq(runSteps.id, input.stepId))
      .returning();

    return updated ? mapRunStepRow(updated) : null;
  }

  async releaseReadyDependents(
    input: ReleaseReadyDependentsInput
  ): Promise<StoredRunStep[]> {
    return this.db.transaction(async (transaction) => {
      const [runRows, stepRows, edgeRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(runSteps),
        transaction.select().from(planEdges)
      ]);

      const run = runRows.find((row) => row.id === input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      const runScopedSteps = stepRows.filter((row) => row.runId === input.runId);
      const completedStep = runScopedSteps.find((row) => row.id === input.completedStepId);

      if (!completedStep) {
        throw new Error(
          `Step ${input.completedStepId} does not belong to run ${input.runId}.`
        );
      }

      const planScopedEdges = edgeRows.filter((row) => row.planId === run.planId);
      const dependentNodeIds = planScopedEdges
        .filter((edge) => edge.from === completedStep.planNodeId)
        .map((edge) => edge.to);
      const released: RunStepRow[] = [];

      for (const dependentNodeId of dependentNodeIds) {
        const dependentStep = runScopedSteps.find(
          (step) => step.planNodeId === dependentNodeId
        );

        if (!dependentStep || dependentStep.status !== "pending") {
          continue;
        }

        const parentNodeIds = planScopedEdges
          .filter((edge) => edge.to === dependentNodeId)
          .map((edge) => edge.from);

        const allParentsCompleted = parentNodeIds.every((parentNodeId) =>
          runScopedSteps.some(
            (step) =>
              step.planNodeId === parentNodeId && step.status === "completed"
          )
        );

        if (!allParentsCompleted) {
          continue;
        }

        const [updated] = await transaction
          .update(runSteps)
          .set({
            status: "ready",
            updatedAt: new Date(input.updatedAt)
          })
          .where(and(eq(runSteps.id, dependentStep.id), eq(runSteps.status, "pending")))
          .returning();

        if (updated) {
          released.push(updated);
          const stepIndex = runScopedSteps.findIndex((step) => step.id === updated.id);
          if (stepIndex >= 0) {
            runScopedSteps[stepIndex] = updated;
          }
        }
      }

      return released
        .sort((left, right) => left.position - right.position)
        .map(mapRunStepRow);
    });
  }
}
