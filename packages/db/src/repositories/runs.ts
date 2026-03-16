import { and, eq, isNull, sql } from "drizzle-orm";
import {
  CheckpointDetailPayloadSchema,
  type ApprovalRequirement,
  type RemoteExecutionTarget,
  StepRouteSchema,
  type StepRoute
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import {
  outcomes,
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  remoteWorkers,
  runCheckpoints,
  runEvents,
  runSteps
} from "../schema";
import type { StoredOutcome } from "./outcomes";

type RunRow = typeof outcomeRuns.$inferSelect;
type RunStepRow = typeof runSteps.$inferSelect;
type OutcomeRow = typeof outcomes.$inferSelect;
type RunEventRow = typeof runEvents.$inferSelect;

function mapApprovalRequirement(
  row: Pick<
    RunStepRow,
    "approvalKind" | "approvalTitle" | "approvalSummary" | "approvalInstruction"
  >
): ApprovalRequirement | undefined {
  if (!row.approvalKind || !row.approvalTitle) {
    return undefined;
  }

  return {
    kind: row.approvalKind as ApprovalRequirement["kind"],
    title: row.approvalTitle,
    summary: row.approvalSummary ?? null,
    instruction: row.approvalInstruction ?? null
  };
}

export type StoredRun = {
  id: string;
  outcomeId: string;
  planId: string;
  status: RunRow["status"];
  latestCheckpointId?: string | null;
  resumable?: boolean;
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
  approvalRequirement?: ApprovalRequirement;
  expectedArtifactPath?: string;
  expectedArtifactKind?: string;
  routeProviderId?: string | null;
  routeModelId?: string | null;
  routeAuthProfileId?: string | null;
  routePolicyVersion?: number;
  routeStatus?: StepRoute["status"];
  routeReason?: StepRoute["reason"];
  routeResolvedAt?: string;
  executionTarget?: RemoteExecutionTarget | null;
  remoteWorkerId?: string | null;
  remoteWorkerSessionId?: string | null;
  remoteExecutionAttemptId?: string | null;
  remoteAssignedAt?: string | null;
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

export type AssignStepToWorkerInput = {
  stepId: string;
  workerId: string;
  workerSessionId: string;
  attemptId: string;
  assignedAt: string;
  updatedAt: string;
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

export type UpdateApprovalResolutionLifecycleInput = {
  runId: string;
  outcomeId: string;
  stepId: string;
  stepStatus: RunStepRow["status"];
  runStatus: RunRow["status"];
  outcomeStatus: OutcomeRow["status"];
  updatedAt: string;
};

export type ReleaseReadyDependentsInput = {
  runId: string;
  completedStepId: string;
  updatedAt: string;
};

export type RestoreFromCheckpointInput = {
  runId: string;
  checkpointId: string;
  payload: unknown;
  updatedAt: string;
};

function mapRunRow(row: RunRow): StoredRun {
  return {
    id: row.id,
    outcomeId: row.outcomeId,
    planId: row.planId,
    status: row.status,
    latestCheckpointId: row.latestCheckpointId,
    resumable: row.resumable,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapRunStepRow(row: RunStepRow): StoredRunStep {
  const approvalRequirement = mapApprovalRequirement(row);

  return {
    id: row.id,
    runId: row.runId,
    planNodeId: row.planNodeId,
    title: row.title,
    kind: row.kind,
    capability: row.capability,
    ...(row.instruction ? { instruction: row.instruction } : {}),
    ...(row.template ? { template: row.template } : {}),
    ...(approvalRequirement ? { approvalRequirement } : {}),
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
    ...(row.executionTarget
      ? {
          executionTarget: row.executionTarget,
          remoteWorkerId: row.remoteWorkerId,
          remoteWorkerSessionId: row.remoteWorkerSessionId,
          remoteExecutionAttemptId: row.remoteExecutionAttemptId,
          remoteAssignedAt: row.remoteAssignedAt?.toISOString() ?? null
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
          latestCheckpointId: null,
          resumable: false,
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
          ...(node.approvalKind && node.approvalTitle
            ? {
                approvalKind: node.approvalKind,
                approvalTitle: node.approvalTitle,
                approvalSummary: node.approvalSummary,
                approvalInstruction: node.approvalInstruction
              }
            : {}),
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

  async listByStatuses(statuses: StoredRun["status"][]): Promise<StoredRun[]> {
    const allowed = new Set(statuses);
    const rows = await this.db.select().from(outcomeRuns);

    return rows
      .filter((row) => allowed.has(row.status))
      .sort(compareRunRows)
      .map(mapRunRow);
  }

  async listByOutcome(outcomeId: string): Promise<StoredRun[]> {
    const rows = await this.db.select().from(outcomeRuns);

    return rows
      .filter((row) => row.outcomeId === outcomeId)
      .sort(compareRunRows)
      .map(mapRunRow);
  }

  async getStepById(stepId: string): Promise<StoredRunStep | null> {
    const rows = await this.db.select().from(runSteps);
    const found = rows.find((row) => row.id === stepId);

    return found ? mapRunStepRow(found) : null;
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

  async assignStepToWorker(
    input: AssignStepToWorkerInput
  ): Promise<StoredRunStep | null> {
    return this.db.transaction(async (transaction) => {
      const [stepRows, workerRows] = await Promise.all([
        transaction.select().from(runSteps),
        transaction.select().from(remoteWorkers)
      ]);
      const existing = stepRows.find((row) => row.id === input.stepId);

      if (!existing) {
        return null;
      }

      const worker = workerRows.find((row) => row.id === input.workerId);

      if (!worker) {
        throw new Error(`Remote worker ${input.workerId} does not exist.`);
      }

      if (worker.sessionId !== input.workerSessionId) {
        throw new Error(
          `Remote worker ${input.workerId} session ${input.workerSessionId} does not match active session ${worker.sessionId}.`
        );
      }

      if (
        (existing.remoteWorkerId && existing.remoteWorkerId !== input.workerId) ||
        (existing.remoteWorkerSessionId &&
          existing.remoteWorkerSessionId !== input.workerSessionId)
      ) {
        throw new Error(
          `Step ${input.stepId} is already assigned to worker ${existing.remoteWorkerId}.`
        );
      }

      const [updated] = await transaction
        .update(runSteps)
        .set({
          executionTarget: "remote_worker",
          remoteWorkerId: input.workerId,
          remoteWorkerSessionId: input.workerSessionId,
          remoteExecutionAttemptId: input.attemptId,
          remoteAssignedAt: new Date(input.assignedAt),
          updatedAt: new Date(input.updatedAt)
        })
        .where(
          and(
            eq(runSteps.id, input.stepId),
            and(
              isNull(runSteps.remoteWorkerId),
              and(
                isNull(runSteps.remoteWorkerSessionId),
                sql`exists (select 1 from ${remoteWorkers} where ${remoteWorkers.id} = ${input.workerId} and ${remoteWorkers.sessionId} = ${input.workerSessionId})`
              )
            )
          )
        )
        .returning();

      if (updated) {
        return mapRunStepRow(updated);
      }

      const [refreshedRows, refreshedWorkers] = await Promise.all([
        transaction.select().from(runSteps),
        transaction.select().from(remoteWorkers)
      ]);
      const current = refreshedRows.find((row) => row.id === input.stepId);

      if (!current) {
        return null;
      }

      if (
        (current.remoteWorkerId && current.remoteWorkerId !== input.workerId) ||
        (current.remoteWorkerSessionId &&
          current.remoteWorkerSessionId !== input.workerSessionId)
      ) {
        throw new Error(
          `Step ${input.stepId} is already assigned to worker ${current.remoteWorkerId}.`
        );
      }

      const currentWorker = refreshedWorkers.find(
        (row) => row.id === input.workerId
      );

      if (!currentWorker) {
        throw new Error(`Remote worker ${input.workerId} does not exist.`);
      }

      if (currentWorker.sessionId !== input.workerSessionId) {
        throw new Error(
          `Remote worker ${input.workerId} session ${input.workerSessionId} does not match active session ${currentWorker.sessionId}.`
        );
      }

      return mapRunStepRow(current);
    });
  }

  async updateApprovalResolutionLifecycle(
    input: UpdateApprovalResolutionLifecycleInput
  ): Promise<
    { step: StoredRunStep; run: StoredRun; outcome: StoredOutcome } | null
  > {
    return this.db.transaction(async (transaction) => {
      const [runRows, stepRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(runSteps)
      ]);
      const existingRun = runRows.find((row) => row.id === input.runId);

      if (!existingRun) {
        return null;
      }

      if (existingRun.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${existingRun.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const existingStep = stepRows.find((row) => row.id === input.stepId);

      if (!existingStep) {
        throw new Error(`Step ${input.stepId} does not exist.`);
      }

      if (existingStep.runId !== input.runId) {
        throw new Error(
          `Step ${input.stepId} belongs to ${existingStep.runId}, not ${input.runId}.`
        );
      }

      const [updatedStep] = await transaction
        .update(runSteps)
        .set({
          status: input.stepStatus,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(runSteps.id, input.stepId))
        .returning();

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
        step: mapRunStepRow(updatedStep),
        run: mapRunRow(updatedRun),
        outcome: mapOutcomeRow(updatedOutcome)
      };
    });
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

  async restoreFromCheckpoint(
    input: RestoreFromCheckpointInput
  ): Promise<{ run: StoredRun; steps: StoredRunStep[] } | null> {
    const payload = CheckpointDetailPayloadSchema.parse(input.payload);

    return this.db.transaction(async (transaction) => {
      const [runRows, outcomeRows, stepRows, checkpointRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(outcomes),
        transaction.select().from(runSteps),
        transaction.select().from(runCheckpoints)
      ]);

      const run = runRows.find((row) => row.id === input.runId);

      if (!run) {
        return null;
      }

      const checkpoint = checkpointRows.find((row) => row.id === input.checkpointId);

      if (!checkpoint) {
        throw new Error(`Checkpoint ${input.checkpointId} does not exist.`);
      }

      if (checkpoint.runId !== input.runId) {
        throw new Error(
          `Checkpoint ${input.checkpointId} belongs to ${checkpoint.runId}, not ${input.runId}.`
        );
      }

      const outcome = outcomeRows.find((row) => row.id === run.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${run.outcomeId} does not exist.`);
      }

      if (payload.run.id !== input.runId) {
        throw new Error(
          `Checkpoint payload belongs to ${payload.run.id}, not ${input.runId}.`
        );
      }

      if (payload.run.outcomeId !== run.outcomeId) {
        throw new Error(
          `Checkpoint payload outcome ${payload.run.outcomeId} does not match ${run.outcomeId}.`
        );
      }

      if (payload.run.workspaceId !== outcome.workspaceId) {
        throw new Error(
          `Checkpoint payload workspace ${payload.run.workspaceId} does not match ${outcome.workspaceId}.`
        );
      }

      const runScopedSteps = stepRows.filter((row) => row.runId === input.runId);
      const payloadStepIds = new Set(payload.steps.map((step) => step.stepId));

      if (runScopedSteps.some((step) => !payloadStepIds.has(step.id))) {
        throw new Error(
          `Checkpoint payload for run ${input.runId} does not cover every persisted step.`
        );
      }

      for (const payloadStep of payload.steps) {
        const existingStep = runScopedSteps.find((row) => row.id === payloadStep.stepId);

        if (!existingStep) {
          throw new Error(
            `Checkpoint payload step ${payloadStep.stepId} does not belong to run ${input.runId}.`
          );
        }

        await transaction
          .update(runSteps)
          .set({
            status: payloadStep.status,
            updatedAt: new Date(input.updatedAt)
          })
          .where(eq(runSteps.id, payloadStep.stepId))
          .returning();
      }

      const [updatedRun] = await transaction
        .update(outcomeRuns)
        .set({
          latestCheckpointId: input.checkpointId,
          resumable: checkpoint.resumable,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(outcomeRuns.id, input.runId))
        .returning();

      const restoredSteps = await transaction.select().from(runSteps);

      return {
        run: mapRunRow(updatedRun),
        steps: restoredSteps
          .filter((row) => row.runId === input.runId)
          .sort((left, right) => left.position - right.position)
          .map(mapRunStepRow)
      };
    });
  }
}
