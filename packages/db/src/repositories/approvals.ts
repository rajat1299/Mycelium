import { and, eq } from "drizzle-orm";
import type { DatabaseClient } from "../client";
import { approvals, artifacts, outcomes, outcomeRuns, runSteps } from "../schema";

type ApprovalRow = typeof approvals.$inferSelect;
type OutcomeRow = typeof outcomes.$inferSelect;
type RunRow = typeof outcomeRuns.$inferSelect;
type StepRow = typeof runSteps.$inferSelect;

export type StoredApproval = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  runId: string;
  stepId: string;
  status: ApprovalRow["status"];
  kind: string;
  title: string;
  summary: string | null;
  instruction: string | null;
  artifactIds: string[];
  requestedAt: string;
  resolvedAt: string | null;
  resolution: ApprovalRow["resolution"];
  resolutionNote: string | null;
};

export type CreatePendingApprovalInput = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  runId: string;
  stepId: string;
  kind: string;
  title: string;
  summary: string | null;
  instruction: string | null;
  artifactIds: string[];
  requestedAt: string;
};

export type ListApprovalsInput = {
  workspaceId: string;
  status?: ApprovalRow["status"];
};

export type ResolveApprovalInput = {
  approvalId: string;
  resolution: NonNullable<ApprovalRow["resolution"]>;
  resolutionNote: string | null;
  resolvedAt: string;
  stepStatus: StepRow["status"];
  runStatus: RunRow["status"];
  outcomeStatus: OutcomeRow["status"];
  updatedAt: string;
};

export type CancelApprovalInput = {
  approvalId: string;
  resolvedAt: string;
  resolutionNote: string | null;
};

function mapApprovalRow(row: ApprovalRow): StoredApproval {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    outcomeId: row.outcomeId,
    runId: row.runId,
    stepId: row.stepId,
    status: row.status,
    kind: row.kind,
    title: row.title,
    summary: row.summary ?? null,
    instruction: row.instruction ?? null,
    artifactIds: row.artifactIds as string[],
    requestedAt: row.requestedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolution: row.resolution ?? null,
    resolutionNote: row.resolutionNote ?? null
  };
}

function compareApprovalRows(left: ApprovalRow, right: ApprovalRow) {
  const requestedDelta = left.requestedAt.getTime() - right.requestedAt.getTime();

  if (requestedDelta !== 0) {
    return requestedDelta;
  }

  return left.id.localeCompare(right.id);
}

export class ApprovalRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createPending(input: CreatePendingApprovalInput): Promise<StoredApproval> {
    return this.db.transaction(async (transaction) => {
      const [outcomeRows, runRows, stepRows, artifactRows] = await Promise.all([
        transaction.select().from(outcomes),
        transaction.select().from(outcomeRuns),
        transaction.select().from(runSteps),
        transaction.select().from(artifacts)
      ]);

      const outcome = outcomeRows.find((row) => row.id === input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== input.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${input.workspaceId}.`
        );
      }

      const run = runRows.find((row) => row.id === input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const step = stepRows.find((row) => row.id === input.stepId);

      if (!step) {
        throw new Error(`Step ${input.stepId} does not exist.`);
      }

      if (step.runId !== input.runId) {
        throw new Error(
          `Step ${input.stepId} belongs to ${step.runId}, not ${input.runId}.`
        );
      }

      for (const artifactId of input.artifactIds) {
        const artifact = artifactRows.find((row) => row.id === artifactId);

        if (!artifact) {
          throw new Error(`Artifact ${artifactId} does not exist.`);
        }

        if (
          artifact.outcomeId !== input.outcomeId ||
          artifact.runId !== input.runId ||
          artifact.stepId !== input.stepId
        ) {
          throw new Error(
            `Artifact ${artifactId} does not belong to approval step ${input.stepId} in run ${input.runId}.`
          );
        }
      }

      const [created] = await transaction
        .insert(approvals)
        .values({
          id: input.id,
          workspaceId: input.workspaceId,
          outcomeId: input.outcomeId,
          runId: input.runId,
          stepId: input.stepId,
          status: "pending",
          kind: input.kind,
          title: input.title,
          summary: input.summary,
          instruction: input.instruction,
          artifactIds: input.artifactIds,
          requestedAt: new Date(input.requestedAt),
          resolvedAt: null,
          resolution: null,
          resolutionNote: null
        })
        .returning();

      return mapApprovalRow(created);
    });
  }

  async getById(id: string): Promise<StoredApproval | null> {
    const rows = await this.db.select().from(approvals);
    const found = rows.find((row) => row.id === id);

    return found ? mapApprovalRow(found) : null;
  }

  async listByWorkspace(input: ListApprovalsInput): Promise<StoredApproval[]> {
    const rows = await this.db.select().from(approvals);

    return rows
      .filter(
        (row) =>
          row.workspaceId === input.workspaceId &&
          (input.status ? row.status === input.status : true)
      )
      .sort(compareApprovalRows)
      .map(mapApprovalRow);
  }

  async resolve(input: ResolveApprovalInput) {
    return this.db.transaction(async (transaction) => {
      const [approvalRows, runRows, stepRows, outcomeRows] = await Promise.all([
        transaction.select().from(approvals),
        transaction.select().from(outcomeRuns),
        transaction.select().from(runSteps),
        transaction.select().from(outcomes)
      ]);

      const existing = approvalRows.find((row) => row.id === input.approvalId);

      if (!existing) {
        return null;
      }

      if (existing.status !== "pending") {
        throw new Error(`Approval ${input.approvalId} is already resolved.`);
      }

      const run = runRows.find((row) => row.id === existing.runId);

      if (!run) {
        throw new Error(`Run ${existing.runId} does not exist.`);
      }

      if (run.outcomeId !== existing.outcomeId) {
        throw new Error(
          `Run ${existing.runId} belongs to ${run.outcomeId}, not ${existing.outcomeId}.`
        );
      }

      const step = stepRows.find((row) => row.id === existing.stepId);

      if (!step) {
        throw new Error(`Step ${existing.stepId} does not exist.`);
      }

      if (step.runId !== existing.runId) {
        throw new Error(
          `Step ${existing.stepId} belongs to ${step.runId}, not ${existing.runId}.`
        );
      }

      const outcome = outcomeRows.find((row) => row.id === existing.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${existing.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== existing.workspaceId) {
        throw new Error(
          `Outcome ${existing.outcomeId} belongs to ${outcome.workspaceId}, not ${existing.workspaceId}.`
        );
      }

      const [updatedApproval] = await transaction
        .update(approvals)
        .set({
          status: input.resolution === "cancelled" ? "cancelled" : "resolved",
          resolution: input.resolution,
          resolutionNote: input.resolutionNote,
          resolvedAt: new Date(input.resolvedAt)
        })
        .where(and(eq(approvals.id, input.approvalId), eq(approvals.status, "pending")))
        .returning();

      if (!updatedApproval) {
        throw new Error(`Approval ${input.approvalId} is already resolved.`);
      }

      const [updatedStep] = await transaction
        .update(runSteps)
        .set({
          status: input.stepStatus,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(runSteps.id, existing.stepId))
        .returning();

      const [updatedRun] = await transaction
        .update(outcomeRuns)
        .set({
          status: input.runStatus,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(outcomeRuns.id, existing.runId))
        .returning();

      const [updatedOutcome] = await transaction
        .update(outcomes)
        .set({
          status: input.outcomeStatus,
          updatedAt: new Date(input.updatedAt)
        })
        .where(eq(outcomes.id, existing.outcomeId))
        .returning();

      if (!updatedOutcome) {
        throw new Error(
          `Outcome ${existing.outcomeId} disappeared during lifecycle update.`
        );
      }

      return {
        approval: mapApprovalRow(updatedApproval),
        step: {
          id: updatedStep.id,
          runId: updatedStep.runId,
          planNodeId: updatedStep.planNodeId,
          title: updatedStep.title,
          kind: updatedStep.kind,
          capability: updatedStep.capability,
          status: updatedStep.status,
          position: updatedStep.position,
          createdAt: updatedStep.createdAt.toISOString(),
          updatedAt: updatedStep.updatedAt.toISOString(),
          ...(updatedStep.instruction ? { instruction: updatedStep.instruction } : {}),
          ...(updatedStep.template ? { template: updatedStep.template } : {}),
          ...(updatedStep.expectedArtifactPath
            ? { expectedArtifactPath: updatedStep.expectedArtifactPath }
            : {}),
          ...(updatedStep.expectedArtifactKind
            ? { expectedArtifactKind: updatedStep.expectedArtifactKind }
            : {})
        },
        run: {
          id: updatedRun.id,
          outcomeId: updatedRun.outcomeId,
          planId: updatedRun.planId,
          triggerMessageId: updatedRun.triggerMessageId,
          status: updatedRun.status,
          createdAt: updatedRun.createdAt.toISOString(),
          updatedAt: updatedRun.updatedAt.toISOString()
        },
        outcome: {
          id: updatedOutcome.id,
          workspaceId: updatedOutcome.workspaceId,
          userId: updatedOutcome.userId,
          prompt: updatedOutcome.prompt,
          source: updatedOutcome.source as "web",
          status: updatedOutcome.status,
          createdAt: updatedOutcome.createdAt.toISOString(),
          updatedAt: updatedOutcome.updatedAt.toISOString()
        }
      };
    });
  }

  async cancel(input: CancelApprovalInput): Promise<StoredApproval | null> {
    const [updated] = await this.db
      .update(approvals)
      .set({
        status: "cancelled",
        resolution: "cancelled",
        resolutionNote: input.resolutionNote,
        resolvedAt: new Date(input.resolvedAt)
      })
      .where(and(eq(approvals.id, input.approvalId), eq(approvals.status, "pending")))
      .returning();

    return updated ? mapApprovalRow(updated) : null;
  }
}
