import { randomUUID } from "node:crypto";
import { LocalArtifactStore } from "@computer-oss/artifacts";
import { isRunTerminal } from "@computer-oss/orchestrator";
import {
  ApprovalSchema,
  ArtifactSchema,
  OutcomeSchema,
  RunLogDataSchema,
  ResumeRunResponseSchema,
  RunSchema,
  RunStepSchema
} from "@computer-oss/protocol";
import type {
  SandboxProvider,
  WorkspaceLease as RuntimeWorkspaceLease,
  WorkspaceManager
} from "@computer-oss/sandbox";
import type { CheckpointService } from "./checkpoint-service";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

type ExecutionServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  checkpointService: CheckpointService;
  sandboxProvider: SandboxProvider;
  workspaceManager: WorkspaceManager;
  now?: () => Date;
};

export type ExecutionService = {
  startRun(runId: string): void;
  resumeRun(input: {
    runId: string;
    checkpointId?: string;
  }): Promise<
    | {
        run: Awaited<ReturnType<Repositories["runs"]["getById"]>> & {};
        resumedFromCheckpointId: string;
      }
    | null
  >;
  recoverInterruptedRuns(): Promise<void>;
  waitForRun(runId: string): Promise<void>;
};

export function createExecutionService(
  options: ExecutionServiceOptions
): ExecutionService {
  const inFlightRuns = new Map<string, Promise<void>>();
  const settledRuns = new Map<string, Promise<void>>();
  const now = options.now ?? (() => new Date());
  const startRun = (runId: string) => {
      if (inFlightRuns.has(runId)) {
        return;
      }

      settledRuns.delete(runId);

      const execution = executeRun({
        runId,
        repositories: options.repositories,
        eventBus: options.eventBus,
        checkpointService: options.checkpointService,
        sandboxProvider: options.sandboxProvider,
        workspaceManager: options.workspaceManager,
        now
      });

      inFlightRuns.set(runId, execution);
      void execution.then(
        () => {
          inFlightRuns.delete(runId);
          rememberSettledRun(settledRuns, runId, execution);
        },
        (error) => {
          inFlightRuns.delete(runId);
          rememberSettledRun(settledRuns, runId, execution);
          reportUnhandledExecutionError(runId, error);
        }
      );
    };

  return {
    startRun,
    async resumeRun(input) {
      const run = await options.repositories.runs.getById(input.runId);

      if (!run) {
        return null;
      }

      if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
        throw new Error(`Run ${run.id} is terminal and cannot be resumed.`);
      }

      if (run.status === "blocked") {
        throw new Error(`Run ${run.id} is blocked on approval and cannot be resumed.`);
      }

      if (run.status !== "interrupted") {
        throw new Error(`Run ${run.id} is not interrupted and cannot be resumed.`);
      }

      const checkpoint =
        (input.checkpointId
          ? await options.repositories.checkpoints.getById(input.checkpointId)
          : null) ?? (await options.repositories.checkpoints.getLatestResumableByRun(run.id));

      if (!checkpoint) {
        throw new Error(`Run ${run.id} does not have a resumable checkpoint.`);
      }

      if (!checkpoint.resumable) {
        throw new Error(`Checkpoint ${checkpoint.id} is not resumable.`);
      }

      const detail = await options.checkpointService.readCheckpoint(checkpoint.id);

      if (!detail) {
        throw new Error(`Checkpoint ${checkpoint.id} could not be loaded.`);
      }

      const restored = await options.repositories.runs.restoreFromCheckpoint({
        runId: run.id,
        checkpointId: checkpoint.id,
        payload: detail.payload,
        updatedAt: now().toISOString()
      });

      if (!restored) {
        return null;
      }

      const outcome = await options.repositories.outcomes.getById(run.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${run.outcomeId} does not exist.`);
      }

      const eventPublisher = {
        repositories: options.repositories,
        eventBus: options.eventBus
      };

      for (const step of restored.steps) {
        await emitRunStepUpdated(eventPublisher, outcome.id, step);
      }

      const resumedLifecycle = await options.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: now().toISOString()
      });

      if (!resumedLifecycle) {
        throw new Error("Failed to resume run or outcome lifecycle state.");
      }

      await appendSystemAuditEvent(options, {
        workspaceId: outcome.workspaceId,
        outcomeId: outcome.id,
        runId: run.id,
        stepId: checkpoint.stepId,
        checkpointId: checkpoint.id,
        category: "resume",
        eventType: "run.resumed",
        summary: "Resumed run from a durable checkpoint.",
        payload: {
          resumedFromCheckpointId: checkpoint.id
        },
        createdAt: resumedLifecycle.run.updatedAt
      });

      await emitRunUpdated(eventPublisher, outcome.id, resumedLifecycle.run);
      await emitOutcomeUpdated(eventPublisher, resumedLifecycle.outcome);
      await emitRunResumed(eventPublisher, {
        outcomeId: outcome.id,
        run: resumedLifecycle.run,
        resumedFromCheckpointId: checkpoint.id
      });

      startRun(run.id);

      return {
        run: resumedLifecycle.run,
        resumedFromCheckpointId: checkpoint.id
      };
    },
    async recoverInterruptedRuns() {
      await options.checkpointService.recoverInterruptedRuns();
    },
    async waitForRun(runId) {
      await (inFlightRuns.get(runId) ?? settledRuns.get(runId) ?? Promise.resolve());
    }
  };
}

type ExecuteRunOptions = {
  runId: string;
  repositories: Repositories;
  eventBus: EventBus;
  checkpointService: CheckpointService;
  sandboxProvider: SandboxProvider;
  workspaceManager: WorkspaceManager;
  now: () => Date;
};

type EventPublisherOptions = Pick<ExecuteRunOptions, "repositories" | "eventBus">;

async function executeRun(options: ExecuteRunOptions): Promise<void> {
  const run = await options.repositories.runs.getById(options.runId);

  if (!run) {
    return;
  }

  const outcome = await options.repositories.outcomes.getById(run.outcomeId);

  if (!outcome) {
    return;
  }

  let lease: RuntimeWorkspaceLease | null = null;

  try {
    lease = await acquireWorkspaceLease(options, run.id);
    await updateLifecycleStatus(options, {
      runId: run.id,
      outcomeId: outcome.id,
      runStatus: "running",
      outcomeStatus: "running"
    });
    await options.checkpointService.createCheckpoint({
      runId: run.id,
      kind: "run_started",
      stepId: null
    });

    while (true) {
      const readySteps = await options.repositories.runs.listReadySteps(run.id);

      if (readySteps.length === 0) {
        const steps = await options.repositories.runs.listSteps(run.id);

        if (
          steps.some(
            (step) => step.status === "failed" || step.status === "cancelled"
          )
        ) {
          await updateLifecycleStatus(options, {
            runId: run.id,
            outcomeId: outcome.id,
            runStatus: "failed",
            outcomeStatus: "failed"
          });
          return;
        }

        if (
          isRunTerminal(
            steps.map((step) => ({
              id: step.id,
              planNodeId: step.planNodeId,
              status: step.status
            }))
          )
        ) {
          await updateLifecycleStatus(options, {
            runId: run.id,
            outcomeId: outcome.id,
            runStatus: "completed",
            outcomeStatus: "completed"
          });
          await options.checkpointService.createCheckpoint({
            runId: run.id,
            kind: "run_completed",
            stepId: null
          });
          return;
        }

        if (steps.some((step) => step.status === "blocked")) {
          return;
        }

        await updateLifecycleStatus(options, {
          runId: run.id,
          outcomeId: outcome.id,
          runStatus: "failed",
          outcomeStatus: "failed"
        });
        await emitRunLog(options, {
          outcomeId: outcome.id,
          runId: run.id,
          level: "error",
          message: "Execution stalled without ready or terminal steps."
        });
        return;
      }

      const results = await Promise.all(
        readySteps.map((step) =>
          executeReadyStep(options, {
            runId: run.id,
            outcomeId: outcome.id,
            workspaceId: outcome.workspaceId,
            planId: run.planId,
            outcomePrompt: outcome.prompt,
            lease: lease!,
            step
          })
        )
      );

      if (results.some((result) => result.status === "failed")) {
        await updateLifecycleStatus(options, {
          runId: run.id,
          outcomeId: outcome.id,
          runStatus: "failed",
          outcomeStatus: "failed"
        });
        await options.checkpointService.createCheckpoint({
          runId: run.id,
          kind: "run_failed",
          stepId: null
        });
        return;
      }

      if (results.some((result) => result.status === "blocked")) {
        return;
      }
    }
  } catch (error) {
    await emitBestEffortRunLog(options, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "error",
      message: toErrorMessage(error)
    });
    await updateLifecycleStatus(options, {
      runId: run.id,
      outcomeId: outcome.id,
      runStatus: "failed",
      outcomeStatus: "failed"
    });
  } finally {
    await releaseWorkspaceLease(options, {
      outcomeId: outcome.id,
      runId: run.id
    });
  }
}

async function executeReadyStep(
  options: ExecuteRunOptions,
  input: {
    runId: string;
    outcomeId: string;
    workspaceId: string;
    planId: string;
    outcomePrompt: string;
    lease: RuntimeWorkspaceLease;
    step: Awaited<ReturnType<Repositories["runs"]["listReadySteps"]>>[number];
  }
): Promise<{ status: "completed" | "failed" | "blocked" }> {
  const runningAt = options.now().toISOString();
  const runningStep = await options.repositories.runs.updateStepStatus({
    stepId: input.step.id,
    status: "running",
    updatedAt: runningAt
  });

  if (!runningStep) {
    throw new Error(`Step ${input.step.id} no longer exists.`);
  }

  await emitRunStepUpdated(options, input.outcomeId, runningStep);
  await emitRunLog(options, {
    outcomeId: input.outcomeId,
    runId: input.runId,
    stepId: runningStep.id,
    stepTitle: runningStep.title,
    level: "info",
    message: `Starting ${runningStep.title}`
  });

  try {
    const result = await options.sandboxProvider.execute({
      runId: input.runId,
      step: runningStep,
      context: {
        outcomeId: input.outcomeId,
        outcomePrompt: input.outcomePrompt
      },
      workspace: input.lease.paths
    });

    await emitSandboxLogs(options, {
      outcomeId: input.outcomeId,
      runId: input.runId,
      step: runningStep,
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (result.exitCode !== 0) {
      const failedStep = await options.repositories.runs.updateStepStatus({
        stepId: runningStep.id,
        status: "failed",
        updatedAt: options.now().toISOString()
      });

      if (!failedStep) {
        throw new Error(`Failed step ${runningStep.id} disappeared during update.`);
      }

      await emitRunStepUpdated(options, input.outcomeId, failedStep);
      return { status: "failed" };
    }

    const artifactStore = new LocalArtifactStore({
      rootPath: input.lease.paths.rootPath
    });
    const createdArtifacts: Array<
      Awaited<ReturnType<Repositories["artifacts"]["create"]>>
    > = [];

    for (const relativePath of result.producedArtifactPaths) {
      const body = await artifactStore.read(relativePath);
      const artifact = await options.repositories.artifacts.create({
        id: `artifact_${randomUUID()}`,
        outcomeId: input.outcomeId,
        runId: input.runId,
        stepId: runningStep.id,
        kind: runningStep.expectedArtifactKind ?? "artifact",
        relativePath,
        size: body.byteLength,
        metadata: {
          containerName: result.containerName,
          stepTitle: runningStep.title
        },
        createdAt: options.now().toISOString()
      });

      await emitArtifactCreated(options, input.outcomeId, artifact);
      createdArtifacts.push(artifact);
    }

    await createArtifactLineage(options, {
      runId: input.runId,
      planId: input.planId,
      stepId: runningStep.id,
      planNodeId: runningStep.planNodeId,
      childArtifacts: createdArtifacts
    });

    if (runningStep.approvalRequirement) {
      const blockedAt = options.now().toISOString();
      let blockedStep: Awaited<
        ReturnType<Repositories["runs"]["updateStepStatus"]>
      > | null = null;
      let approval: Awaited<
        ReturnType<Repositories["approvals"]["createPending"]>
      > | null = null;

      try {
        blockedStep = await options.repositories.runs.updateStepStatus({
          stepId: runningStep.id,
          status: "blocked",
          updatedAt: blockedAt
        });

        if (!blockedStep) {
          throw new Error(`Blocked step ${runningStep.id} disappeared during update.`);
        }

        approval = await options.repositories.approvals.createPending({
          id: `approval_${randomUUID()}`,
          workspaceId: input.workspaceId,
          outcomeId: input.outcomeId,
          runId: input.runId,
          stepId: runningStep.id,
          kind: runningStep.approvalRequirement.kind,
          title: runningStep.approvalRequirement.title,
          summary: runningStep.approvalRequirement.summary,
          instruction: runningStep.approvalRequirement.instruction,
          artifactIds: createdArtifacts.map((artifact) => artifact.id),
          requestedAt: blockedAt
        });

        const updatedLifecycle = await options.repositories.runs.updateLifecycleStatus({
          runId: input.runId,
          outcomeId: input.outcomeId,
          runStatus: "blocked",
          outcomeStatus: "blocked_on_approval",
          updatedAt: blockedAt
        });

        if (!updatedLifecycle) {
          throw new Error("Failed to update run or outcome lifecycle state.");
        }

        await emitRunStepUpdated(options, input.outcomeId, blockedStep);
        await emitRunUpdated(options, input.outcomeId, updatedLifecycle.run);
        await emitOutcomeUpdated(options, updatedLifecycle.outcome);
        await emitApprovalRequested(options, input.outcomeId, approval);
        await options.checkpointService.createCheckpoint({
          runId: input.runId,
          kind: "step_blocked_on_approval",
          stepId: blockedStep.id
        });
        await emitRunLog(options, {
          outcomeId: input.outcomeId,
          runId: input.runId,
          stepId: blockedStep.id,
          stepTitle: blockedStep.title,
          level: "info",
          message: `Blocked ${blockedStep.title} awaiting approval`
        });

        return { status: "blocked" };
      } catch (error) {
        if (approval) {
          const cancelledApproval = await options.repositories.approvals.cancel({
            approvalId: approval.id,
            resolvedAt: options.now().toISOString(),
            resolutionNote: `Block transition failed: ${toErrorMessage(error)}`
          });

          if (cancelledApproval) {
            await emitApprovalResolved(options, input.outcomeId, cancelledApproval);
          }
        }

        throw error;
      }
    }

    const completedAt = options.now().toISOString();
    const completedStep = await options.repositories.runs.updateStepStatus({
      stepId: runningStep.id,
      status: "completed",
      updatedAt: completedAt
    });

    if (!completedStep) {
      throw new Error(`Completed step ${runningStep.id} disappeared during update.`);
    }

    await emitRunStepUpdated(options, input.outcomeId, completedStep);
    await emitRunLog(options, {
      outcomeId: input.outcomeId,
      runId: input.runId,
      stepId: completedStep.id,
      stepTitle: completedStep.title,
      level: "info",
      message: `Completed ${completedStep.title}`
    });

    const newlyReadySteps = await options.repositories.runs.releaseReadyDependents({
      runId: input.runId,
      completedStepId: completedStep.id,
      updatedAt: completedAt
    });

    for (const readyStep of newlyReadySteps) {
      await emitRunStepUpdated(options, input.outcomeId, readyStep);
    }

    await options.checkpointService.createCheckpoint({
      runId: input.runId,
      kind: "step_completed",
      stepId: completedStep.id
    });

    return { status: "completed" };
  } catch (error) {
    const failedStep = await options.repositories.runs.updateStepStatus({
      stepId: runningStep.id,
      status: "failed",
      updatedAt: options.now().toISOString()
    });

    if (failedStep) {
      await emitRunStepUpdated(options, input.outcomeId, failedStep);
    }

    await emitRunLog(options, {
      outcomeId: input.outcomeId,
      runId: input.runId,
      stepId: runningStep.id,
      stepTitle: runningStep.title,
      level: "error",
      message: toErrorMessage(error)
    });

    return { status: "failed" };
  }
}

async function acquireWorkspaceLease(
  options: ExecuteRunOptions,
  runId: string
): Promise<RuntimeWorkspaceLease> {
  const existingLease = await options.repositories.workspaceLeases.getActiveByRun(runId);

  if (existingLease) {
    return {
      runId,
      acquiredAt: existingLease.acquiredAt,
      paths: {
        rootPath: existingLease.rootPath,
        inputPath: existingLease.inputPath,
        artifactsPath: existingLease.artifactsPath,
        logsPath: existingLease.logsPath
      }
    };
  }

  const runtimeLease = await options.workspaceManager.acquire(runId);

  try {
    await options.repositories.workspaceLeases.acquire({
      runId,
      rootPath: runtimeLease.paths.rootPath,
      inputPath: runtimeLease.paths.inputPath,
      artifactsPath: runtimeLease.paths.artifactsPath,
      logsPath: runtimeLease.paths.logsPath,
      acquiredAt: runtimeLease.acquiredAt
    });
  } catch (error) {
    try {
      options.workspaceManager.release(runId);
    } catch (releaseError) {
      throw new Error(
        `${toErrorMessage(error)}; local workspace cleanup failed: ${toErrorMessage(
          releaseError
        )}`
      );
    }

    throw error;
  }

  return runtimeLease;
}

async function releaseWorkspaceLease(
  options: ExecuteRunOptions,
  input: {
    outcomeId: string;
    runId: string;
  }
) {
  const cleanupErrors: string[] = [];

  try {
    await options.repositories.workspaceLeases.release({
      runId: input.runId,
      releasedAt: options.now().toISOString()
    });
  } catch (error) {
    cleanupErrors.push(`Durable workspace lease release failed: ${toErrorMessage(error)}`);
  }

  try {
    options.workspaceManager.release(input.runId);
  } catch (error) {
    cleanupErrors.push(`Local workspace cleanup failed: ${toErrorMessage(error)}`);
  }

  for (const message of cleanupErrors) {
    await emitBestEffortRunLog(options, {
      outcomeId: input.outcomeId,
      runId: input.runId,
      level: "error",
      message
    });
  }
}

async function updateLifecycleStatus(
  options: ExecuteRunOptions,
  input: {
    runId: string;
    outcomeId: string;
    runStatus: "running" | "blocked" | "completed" | "failed";
    outcomeStatus: "running" | "blocked_on_approval" | "completed" | "failed";
  }
) {
  const updatedLifecycle = await options.repositories.runs.updateLifecycleStatus({
    runId: input.runId,
    outcomeId: input.outcomeId,
    runStatus: input.runStatus,
    outcomeStatus: input.outcomeStatus,
    updatedAt: options.now().toISOString()
  });

  if (!updatedLifecycle) {
    throw new Error("Failed to update run or outcome lifecycle state.");
  }

  await emitRunUpdated(options, input.outcomeId, updatedLifecycle.run);
  await emitOutcomeUpdated(options, updatedLifecycle.outcome);
}

async function emitOutcomeUpdated(
  options: EventPublisherOptions,
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
  options: EventPublisherOptions,
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
  options: EventPublisherOptions,
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

async function emitRunLog(
  options: EventPublisherOptions & Pick<ExecuteRunOptions, "now">,
  input: {
    outcomeId: string;
    runId: string;
    stepId?: string;
    stepTitle?: string;
    level: "info" | "error";
    message: string;
  }
) {
  const createdAt = options.now().toISOString();
  const data = RunLogDataSchema.parse({
    runId: input.runId,
    ...(input.stepId ? { stepId: input.stepId } : {}),
    ...(input.stepTitle ? { stepTitle: input.stepTitle } : {}),
    level: input.level,
    message: input.message,
    createdAt
  });

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "run.log",
    payload: data,
    createdAt
  });

  options.eventBus.publish({
    outcomeId: input.outcomeId,
    type: "run.log",
    data
  });
}

async function emitBestEffortRunLog(
  options: EventPublisherOptions & Pick<ExecuteRunOptions, "now">,
  input: {
    outcomeId: string;
    runId: string;
    stepId?: string;
    stepTitle?: string;
    level: "info" | "error";
    message: string;
  }
) {
  try {
    await emitRunLog(options, input);
  } catch (error) {
    reportUnhandledExecutionError(input.runId, error);
  }
}

async function emitArtifactCreated(
  options: EventPublisherOptions,
  outcomeId: string,
  artifact: Awaited<ReturnType<Repositories["artifacts"]["create"]>>
) {
  const data = ArtifactSchema.parse(artifact);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId ?? "run_unknown",
    eventType: "artifact.created",
    payload: data,
    createdAt: data.createdAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "artifact.created",
    data
  });
}

async function emitApprovalRequested(
  options: EventPublisherOptions,
  outcomeId: string,
  approval: Awaited<ReturnType<Repositories["approvals"]["createPending"]>>
) {
  const data = ApprovalSchema.parse(approval);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "approval.requested",
    payload: data,
    createdAt: data.requestedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "approval.requested",
    data
  });
}

async function emitApprovalResolved(
  options: EventPublisherOptions,
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

async function emitRunResumed(
  options: EventPublisherOptions,
  input: {
    outcomeId: string;
    run: Awaited<ReturnType<Repositories["runs"]["getById"]>> & {};
    resumedFromCheckpointId: string;
  }
) {
  const data = ResumeRunResponseSchema.parse({
    run: input.run,
    resumedFromCheckpointId: input.resumedFromCheckpointId
  });

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.run.id,
    eventType: "run.resumed",
    payload: data,
    createdAt: data.run.updatedAt
  });

  options.eventBus.publish({
    outcomeId: input.outcomeId,
    type: "run.resumed",
    data
  });
}

async function appendSystemAuditEvent(
  options: ExecutionServiceOptions,
  input: {
    workspaceId: string;
    outcomeId: string;
    runId: string;
    stepId: string | null;
    checkpointId: string | null;
    category: "resume";
    eventType: string;
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }
) {
  const existing = await options.repositories.auditEvents.listByRun(input.runId);
  const sequence =
    existing.reduce((max, event) => Math.max(max, event.sequence), 0) + 1;

  await options.repositories.auditEvents.append({
    id: `audit_${randomUUID()}`,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    runId: input.runId,
    stepId: input.stepId,
    checkpointId: input.checkpointId,
    sequence,
    category: input.category,
    eventType: input.eventType,
    actorType: "system",
    summary: input.summary,
    payload: input.payload,
    createdAt: input.createdAt
  });
}

async function createArtifactLineage(
  options: ExecuteRunOptions,
  input: {
    runId: string;
    planId: string;
    stepId: string;
    planNodeId: string;
    childArtifacts: Array<
      Awaited<ReturnType<Repositories["artifacts"]["create"]>>
    >;
  }
) {
  if (input.childArtifacts.length === 0) {
    return;
  }

  const [steps, edges, artifacts] = await Promise.all([
    options.repositories.runs.listSteps(input.runId),
    options.repositories.plans.listEdges(input.planId),
    options.repositories.artifacts.listByRun(input.runId)
  ]);
  const parentNodeIds = edges
    .filter((edge) => edge.to === input.planNodeId)
    .map((edge) => edge.from);

  if (parentNodeIds.length === 0) {
    return;
  }

  const parentStepIds = steps
    .filter((step) => parentNodeIds.includes(step.planNodeId))
    .map((step) => step.id);
  const parentArtifacts = artifacts.filter(
    (artifact) => artifact.stepId && parentStepIds.includes(artifact.stepId)
  );

  if (parentArtifacts.length === 0) {
    return;
  }

  await options.repositories.artifactLineage.createMany(
    parentArtifacts.flatMap((parentArtifact) =>
      input.childArtifacts.map((childArtifact) => ({
        id: `lineage_${randomUUID()}`,
        runId: input.runId,
        parentArtifactId: parentArtifact.id,
        childArtifactId: childArtifact.id,
        parentStepId: parentArtifact.stepId!,
        childStepId: input.stepId,
        relation: "derived_from",
        createdAt: options.now().toISOString()
      }))
    )
  );
}

async function emitSandboxLogs(
  options: ExecuteRunOptions,
  input: {
    outcomeId: string;
    runId: string;
    step: Awaited<ReturnType<Repositories["runs"]["listReadySteps"]>>[number];
    stdout: string;
    stderr: string;
  }
) {
  for (const message of splitLogLines(input.stdout)) {
    await emitRunLog(options, {
      outcomeId: input.outcomeId,
      runId: input.runId,
      stepId: input.step.id,
      stepTitle: input.step.title,
      level: "info",
      message
    });
  }

  for (const message of splitLogLines(input.stderr)) {
    await emitRunLog(options, {
      outcomeId: input.outcomeId,
      runId: input.runId,
      stepId: input.step.id,
      stepTitle: input.step.title,
      level: "error",
      message
    });
  }
}

function splitLogLines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function reportUnhandledExecutionError(runId: string, error: unknown) {
  console.error(`[execution-service] run ${runId} crashed`, error);
}

function rememberSettledRun(
  settledRuns: Map<string, Promise<void>>,
  runId: string,
  execution: Promise<void>
) {
  settledRuns.set(runId, execution);

  while (settledRuns.size > 100) {
    const oldestRunId = settledRuns.keys().next().value;

    if (typeof oldestRunId !== "string") {
      return;
    }

    settledRuns.delete(oldestRunId);
  }
}
