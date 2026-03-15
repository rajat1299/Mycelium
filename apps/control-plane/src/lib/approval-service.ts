import { randomUUID } from "node:crypto";
import { isRunTerminal } from "@computer-oss/orchestrator";
import {
  type StepStatus,
  ApprovalSchema,
  OutcomeSchema,
  RunSchema,
  RunStepSchema
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { ExecutionService } from "./execution-service";
import type { Repositories } from "./repositories";

type ApprovalServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: ExecutionService;
  now?: () => Date;
};

export type ApprovalService = {
  resolveApproval(input: {
    approvalId: string;
    resolution: "approved" | "rejected";
    resolutionNote: string | null;
  }): Promise<
    | {
        approval: Awaited<ReturnType<Repositories["approvals"]["getById"]>> & {};
      }
    | null
  >;
};

export function createApprovalService(
  options: ApprovalServiceOptions
): ApprovalService {
  const now = options.now ?? (() => new Date());

  return {
    async resolveApproval(input) {
      const approval = await options.repositories.approvals.getById(input.approvalId);

      if (!approval) {
        return null;
      }

      const run = await options.repositories.runs.getById(approval.runId);

      if (!run) {
        throw new Error(`Run ${approval.runId} does not exist.`);
      }

      const steps = await options.repositories.runs.listSteps(approval.runId);
      const updatedAt = now().toISOString();
      const targetStepStatus: StepStatus =
        input.resolution === "approved" ? "completed" : "failed";
      const nextSteps = steps.map((step) =>
        step.id === approval.stepId ? { ...step, status: targetStepStatus } : step
      );
      const runIsTerminal = isRunTerminal(
        nextSteps.map((step) => ({
          id: step.id,
          planNodeId: step.planNodeId,
          status: step.status
        }))
      );
      const targetRunStatus =
        input.resolution === "approved"
          ? runIsTerminal
            ? "completed"
            : "blocked"
          : "failed";
      const targetOutcomeStatus =
        input.resolution === "approved"
          ? runIsTerminal
            ? "completed"
            : "blocked_on_approval"
          : "failed";
      const resolved = await options.repositories.approvals.resolve({
        approvalId: input.approvalId,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote,
        resolvedAt: updatedAt,
        stepStatus: targetStepStatus,
        runStatus: targetRunStatus,
        outcomeStatus: targetOutcomeStatus,
        updatedAt
      });

      if (!resolved) {
        return null;
      }

      await emitRunStepUpdated(options, approval.outcomeId, resolved.step);

      if (input.resolution === "approved" && !runIsTerminal) {
        const newlyReady = await options.repositories.runs.releaseReadyDependents({
          runId: resolved.run.id,
          completedStepId: resolved.step.id,
          updatedAt
        });

        for (const step of newlyReady) {
          await emitRunStepUpdated(options, approval.outcomeId, step);
        }

        const resumedLifecycle = await options.repositories.runs.updateLifecycleStatus({
          runId: resolved.run.id,
          outcomeId: approval.outcomeId,
          runStatus: "running",
          outcomeStatus: "running",
          updatedAt
        });

        if (!resumedLifecycle) {
          throw new Error("Failed to resume run or outcome lifecycle state.");
        }

        await emitRunUpdated(options, approval.outcomeId, resumedLifecycle.run);
        await emitOutcomeUpdated(options, resumedLifecycle.outcome);
        await emitApprovalResolved(options, approval.outcomeId, resolved.approval);

        if (newlyReady.length > 0) {
          options.executionService.startRun(resolved.run.id);
        }
      } else {
        await emitRunUpdated(options, approval.outcomeId, resolved.run);
        await emitOutcomeUpdated(options, resolved.outcome);
        await emitApprovalResolved(options, approval.outcomeId, resolved.approval);
      }

      return {
        approval: resolved.approval
      };
    }
  };
}

async function emitOutcomeUpdated(
  options: ApprovalServiceOptions,
  outcome: Awaited<ReturnType<Repositories["outcomes"]["getById"]>> & {}
) {
  const data = OutcomeSchema.parse(outcome);

  options.eventBus.publish({
    outcomeId: data.id,
    type: "outcome.updated",
    data
  });
}

async function emitRunUpdated(
  options: ApprovalServiceOptions,
  outcomeId: string,
  run: Awaited<ReturnType<Repositories["runs"]["getById"]>> & {}
) {
  const data = RunSchema.parse(run);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.id,
    eventType: "run.updated",
    payload: data,
    createdAt: data.updatedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "run.updated",
    data
  });
}

async function emitRunStepUpdated(
  options: ApprovalServiceOptions,
  outcomeId: string,
  step: Awaited<ReturnType<Repositories["runs"]["updateStepStatus"]>> & {}
) {
  const data = RunStepSchema.parse(step);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "run.step.updated",
    payload: data,
    createdAt: data.updatedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "run.step.updated",
    data
  });
}

async function emitApprovalResolved(
  options: ApprovalServiceOptions,
  outcomeId: string,
  approval: Awaited<ReturnType<Repositories["approvals"]["getById"]>> & {}
) {
  const data = ApprovalSchema.parse(approval);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "approval.resolved",
    payload: data,
    createdAt: data.resolvedAt ?? data.requestedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "approval.resolved",
    data
  });
}
