import { randomUUID } from "node:crypto";
import { LocalArtifactStore } from "@computer-oss/artifacts";
import { isRunTerminal } from "@computer-oss/orchestrator";
import {
  ArtifactSchema,
  OutcomeSchema,
  RunLogDataSchema,
  RunSchema,
  RunStepSchema
} from "@computer-oss/protocol";
import type {
  SandboxProvider,
  WorkspaceLease as RuntimeWorkspaceLease,
  WorkspaceManager
} from "@computer-oss/sandbox";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

type ExecutionServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  sandboxProvider: SandboxProvider;
  workspaceManager: WorkspaceManager;
  now?: () => Date;
};

export type ExecutionService = {
  startRun(runId: string): void;
  waitForRun(runId: string): Promise<void>;
};

export function createExecutionService(
  options: ExecutionServiceOptions
): ExecutionService {
  const inFlightRuns = new Map<string, Promise<void>>();
  const now = options.now ?? (() => new Date());

  return {
    startRun(runId) {
      if (inFlightRuns.has(runId)) {
        return;
      }

      const execution = executeRun({
        runId,
        repositories: options.repositories,
        eventBus: options.eventBus,
        sandboxProvider: options.sandboxProvider,
        workspaceManager: options.workspaceManager,
        now
      }).finally(() => {
        inFlightRuns.delete(runId);
      });

      inFlightRuns.set(runId, execution);
    },
    async waitForRun(runId) {
      await (inFlightRuns.get(runId) ?? Promise.resolve());
    }
  };
}

type ExecuteRunOptions = {
  runId: string;
  repositories: Repositories;
  eventBus: EventBus;
  sandboxProvider: SandboxProvider;
  workspaceManager: WorkspaceManager;
  now: () => Date;
};

async function executeRun(options: ExecuteRunOptions): Promise<void> {
  const run = await options.repositories.runs.getById(options.runId);

  if (!run) {
    return;
  }

  const outcome = await options.repositories.outcomes.getById(run.outcomeId);

  if (!outcome) {
    return;
  }

  const lease = await acquireWorkspaceLease(options, run.id);

  try {
    await updateLifecycleStatus(options, {
      runId: run.id,
      outcomeId: outcome.id,
      runStatus: "running",
      outcomeStatus: "running"
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
            outcomePrompt: outcome.prompt,
            lease,
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
        return;
      }
    }
  } catch (error) {
    await emitRunLog(options, {
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
    await options.repositories.workspaceLeases.release({
      runId: run.id,
      releasedAt: options.now().toISOString()
    });
    options.workspaceManager.release(run.id);
  }
}

async function executeReadyStep(
  options: ExecuteRunOptions,
  input: {
    runId: string;
    outcomeId: string;
    outcomePrompt: string;
    lease: RuntimeWorkspaceLease;
    step: Awaited<ReturnType<Repositories["runs"]["listReadySteps"]>>[number];
  }
): Promise<{ status: "completed" | "failed" }> {
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

  await options.repositories.workspaceLeases.acquire({
    runId,
    rootPath: runtimeLease.paths.rootPath,
    inputPath: runtimeLease.paths.inputPath,
    artifactsPath: runtimeLease.paths.artifactsPath,
    logsPath: runtimeLease.paths.logsPath,
    acquiredAt: runtimeLease.acquiredAt
  });

  return runtimeLease;
}

async function updateLifecycleStatus(
  options: ExecuteRunOptions,
  input: {
    runId: string;
    outcomeId: string;
    runStatus: "running" | "completed" | "failed";
    outcomeStatus: "running" | "completed" | "failed";
  }
) {
  const timestamp = options.now().toISOString();
  const [updatedRun, updatedOutcome] = await Promise.all([
    options.repositories.runs.updateStatus({
      runId: input.runId,
      status: input.runStatus,
      updatedAt: timestamp
    }),
    options.repositories.outcomes.updateStatus({
      id: input.outcomeId,
      status: input.outcomeStatus,
      updatedAt: timestamp
    })
  ]);

  if (!updatedRun || !updatedOutcome) {
    throw new Error("Failed to update run or outcome lifecycle state.");
  }

  await emitRunUpdated(options, input.outcomeId, updatedRun);
  await emitOutcomeUpdated(options, updatedOutcome);
}

async function emitOutcomeUpdated(
  options: ExecuteRunOptions,
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
  options: ExecuteRunOptions,
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
  options: ExecuteRunOptions,
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
  options: ExecuteRunOptions,
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

async function emitArtifactCreated(
  options: ExecuteRunOptions,
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
