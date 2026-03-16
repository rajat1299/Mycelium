import { randomUUID } from "node:crypto";
import {
  CheckpointDetailSchema,
  CheckpointSummarySchema,
  type CheckpointDetail,
  type CheckpointKind,
  type CheckpointSummary
} from "@computer-oss/protocol";
import type { CheckpointStore } from "@computer-oss/checkpoints";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

type CheckpointServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  checkpointStore: CheckpointStore;
  now?: () => Date;
};

export type CheckpointService = {
  createCheckpoint(input: {
    runId: string;
    kind: CheckpointKind;
    stepId: string | null;
  }): Promise<CheckpointSummary>;
  readCheckpoint(checkpointId: string): Promise<CheckpointDetail | null>;
  recoverInterruptedRuns(): Promise<
    Array<{ run: Awaited<ReturnType<Repositories["runs"]["getById"]>> & {}; interruptedFromCheckpointId: string }>
  >;
};

export function createCheckpointService(
  options: CheckpointServiceOptions
): CheckpointService {
  const now = options.now ?? (() => new Date());
  const inFlightCheckpointWrites = new Map<string, Promise<CheckpointSummary>>();

  return {
    async createCheckpoint(input) {
      const writeCheckpoint = async () => {
        const run = await options.repositories.runs.getById(input.runId);

        if (!run) {
          throw new Error(`Run ${input.runId} does not exist.`);
        }

        const outcome = await options.repositories.outcomes.getById(run.outcomeId);

        if (!outcome) {
          throw new Error(`Outcome ${run.outcomeId} does not exist.`);
        }

        const [steps, artifacts, auditEvents, workspacePaths, existingCheckpoints] =
          await Promise.all([
            options.repositories.runs.listSteps(run.id),
            options.repositories.artifacts.listByRun(run.id),
            options.repositories.auditEvents.listByRun(run.id),
            resolveWorkspacePaths(options.repositories, options.checkpointStore, run.id),
            options.repositories.checkpoints.listByRun(run.id)
          ]);
        const createdAt = now().toISOString();
        const checkpointId = `checkpoint_${randomUUID()}`;
        const sequence =
          existingCheckpoints.reduce(
            (max, checkpoint) => Math.max(max, checkpoint.sequence),
            0
          ) + 1;
        const latestAuditSequence =
          auditEvents.reduce((max, event) => Math.max(max, event.sequence), 0);
        const payload = {
          version: 1 as const,
          run: {
            id: run.id,
            outcomeId: outcome.id,
            workspaceId: outcome.workspaceId,
            status: run.status
          },
          steps: steps.map((step) => ({
            stepId: step.id,
            title: step.title,
            status: step.status
          })),
          readyStepIds: steps
            .filter((step) => step.status === "ready")
            .map((step) => step.id),
          blockedStepIds: steps
            .filter((step) => step.status === "blocked")
            .map((step) => step.id),
          workspacePaths,
          artifactIds: artifacts.map((artifact) => artifact.id),
          latestAuditSequence
        };
        const persisted = await options.checkpointStore.writeCheckpoint({
          runId: run.id,
          checkpointId,
          sequence,
          manifest: payload
        });
        const checkpoint = CheckpointSummarySchema.parse({
          id: checkpointId,
          workspaceId: outcome.workspaceId,
          outcomeId: outcome.id,
          runId: run.id,
          stepId: input.stepId,
          sequence,
          kind: input.kind,
          resumable: isCheckpointResumable(input.kind),
          storeKey: persisted.storeKey,
          checksum: persisted.checksum,
          byteSize: persisted.byteSize,
          createdAt
        });
        const stored = await options.repositories.checkpoints.create(checkpoint);

        await appendAuditEvent(options, {
          runId: run.id,
          outcomeId: outcome.id,
          workspaceId: outcome.workspaceId,
          stepId: input.stepId,
          checkpointId: stored.id,
          category: "checkpoint",
          eventType: "checkpoint.created",
          summary: `Recorded ${stored.kind} checkpoint.`,
          payload: {
            checkpointId: stored.id,
            kind: stored.kind,
            sequence: stored.sequence,
            resumable: stored.resumable
          },
          createdAt
        });

        await options.repositories.runs.appendEvent({
          id: `event_${randomUUID()}`,
          runId: stored.runId,
          eventType: "checkpoint.created",
          payload: stored,
          createdAt: stored.createdAt
        });

        options.eventBus.publish({
          outcomeId: stored.outcomeId,
          type: "checkpoint.created",
          data: stored
        });

        return stored;
      };

      return serializeCheckpointWrite(inFlightCheckpointWrites, input.runId, writeCheckpoint);
    },

    async readCheckpoint(checkpointId) {
      const checkpoint = await options.repositories.checkpoints.getById(checkpointId);

      if (!checkpoint) {
        return null;
      }

      const persisted = await options.checkpointStore.readCheckpoint(checkpoint.storeKey);

      return CheckpointDetailSchema.parse({
        ...checkpoint,
        payload: persisted.manifest
      });
    },

    async recoverInterruptedRuns() {
      const activeRuns = await options.repositories.runs.listByStatuses(["running"]);
      const recovered: Array<{
        run: Awaited<ReturnType<Repositories["runs"]["getById"]>> & {};
        interruptedFromCheckpointId: string;
      }> = [];

      for (const run of activeRuns) {
        const checkpoint =
          (run.latestCheckpointId
            ? await options.repositories.checkpoints.getById(run.latestCheckpointId)
            : null) ?? (await options.repositories.checkpoints.getLatestResumableByRun(run.id));

        if (!checkpoint || !checkpoint.resumable) {
          continue;
        }

        const outcome = await options.repositories.outcomes.getById(run.outcomeId);

        if (!outcome) {
          throw new Error(`Outcome ${run.outcomeId} does not exist.`);
        }

        const interruptedRun = await options.repositories.runs.updateStatus({
          runId: run.id,
          status: "interrupted",
          updatedAt: now().toISOString()
        });

        if (!interruptedRun) {
          continue;
        }

        await appendAuditEvent(options, {
          runId: interruptedRun.id,
          outcomeId: outcome.id,
          workspaceId: outcome.workspaceId,
          stepId: checkpoint.stepId,
          checkpointId: checkpoint.id,
          category: "resume",
          eventType: "run.interrupted",
          summary: "Marked stranded run as interrupted from a resumable checkpoint.",
          payload: {
            interruptedFromCheckpointId: checkpoint.id
          },
          createdAt: interruptedRun.updatedAt
        });

        await options.repositories.runs.appendEvent({
          id: `event_${randomUUID()}`,
          runId: interruptedRun.id,
          eventType: "run.updated",
          payload: interruptedRun,
          createdAt: interruptedRun.updatedAt
        });
        await options.repositories.runs.appendEvent({
          id: `event_${randomUUID()}`,
          runId: interruptedRun.id,
          eventType: "run.interrupted",
          payload: {
            run: interruptedRun,
            interruptedFromCheckpointId: checkpoint.id
          },
          createdAt: interruptedRun.updatedAt
        });

        options.eventBus.publish({
          outcomeId: outcome.id,
          type: "run.updated",
          data: interruptedRun
        });
        options.eventBus.publish({
          outcomeId: outcome.id,
          type: "run.interrupted",
          data: {
            run: interruptedRun,
            interruptedFromCheckpointId: checkpoint.id
          }
        });

        recovered.push({
          run: interruptedRun,
          interruptedFromCheckpointId: checkpoint.id
        });
      }

      return recovered;
    }
  };
}

function isCheckpointResumable(kind: CheckpointKind) {
  return kind !== "step_blocked_on_approval" && kind !== "run_completed" && kind !== "run_failed";
}

async function serializeCheckpointWrite<T>(
  inFlightCheckpointWrites: Map<string, Promise<T>>,
  runId: string,
  work: () => Promise<T>
) {
  const previous = inFlightCheckpointWrites.get(runId);
  const current = (async () => {
    await previous;
    return work();
  })();

  inFlightCheckpointWrites.set(runId, current);

  try {
    return await current;
  } finally {
    if (inFlightCheckpointWrites.get(runId) === current) {
      inFlightCheckpointWrites.delete(runId);
    }
  }
}

async function resolveWorkspacePaths(
  repositories: Repositories,
  checkpointStore: CheckpointStore,
  runId: string
) {
  const activeLease = await repositories.workspaceLeases.getActiveByRun(runId);

  if (activeLease) {
    return {
      inputDir: activeLease.inputPath,
      logsDir: activeLease.logsPath,
      artifactsDir: activeLease.artifactsPath
    };
  }

  const latestCheckpoint = await repositories.checkpoints.getLatestResumableByRun(runId);
  const fallbackLatestCheckpoint =
    latestCheckpoint ?? (await repositories.checkpoints.listByRun(runId)).at(0);

  if (!fallbackLatestCheckpoint) {
    throw new Error(
      `Run ${runId} has no active workspace lease or stored checkpoint workspace paths.`
    );
  }

  const persisted = await checkpointStore.readCheckpoint(fallbackLatestCheckpoint.storeKey);
  return persisted.manifest.workspacePaths;
}

async function appendAuditEvent(
  options: CheckpointServiceOptions,
  input: {
    workspaceId: string;
    outcomeId: string;
    runId: string;
    stepId: string | null;
    checkpointId: string | null;
    category: "checkpoint" | "resume";
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
