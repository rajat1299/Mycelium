import type {
  DaemonArtifactEvent,
  DaemonCheckpointEvent,
  DaemonEvent,
  DaemonLogEvent,
  DaemonStatusEvent,
  DaemonTerminalEvent,
  RemoteStepLifecycleStatus,
  RemoteWorkerHeartbeat,
  RemoteWorkerRegistration
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";
import type { WorkerRegistry } from "./worker-registry";

type DaemonEventContext = {
  outcomeId: string;
  runId: string;
  step: Awaited<
    ReturnType<Repositories["runs"]["listSteps"]>
  >[number];
  assignment: {
    executionTarget: "remote_worker";
    workerId: string;
    workerSessionId: string;
    attemptId: string;
    assignedAt: string;
  };
};

type DaemonGatewayOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  workerRegistry: WorkerRegistry;
  onLogEvent?: (
    event: DaemonLogEvent,
    context: DaemonEventContext
  ) => Promise<void> | void;
  onArtifactEvent?: (
    event: DaemonArtifactEvent,
    context: DaemonEventContext
  ) => Promise<void> | void;
  onCheckpointEvent?: (
    event: DaemonCheckpointEvent,
    context: DaemonEventContext
  ) => Promise<void> | void;
  onTerminalEvent?: (
    event: DaemonTerminalEvent,
    context: DaemonEventContext
  ) => Promise<void> | void;
};

function availabilityForRemoteStatus(status: RemoteStepLifecycleStatus) {
  if (
    status === "assigned" ||
    status === "accepted" ||
    status === "running" ||
    status === "uploading_artifacts" ||
    status === "uploading_checkpoint"
  ) {
    return "busy" as const;
  }

  return "available" as const;
}

export type DaemonGateway = ReturnType<typeof createDaemonGateway>;

export function createDaemonGateway(options: DaemonGatewayOptions) {
  async function resolveContext(event: DaemonEvent): Promise<DaemonEventContext> {
    const run = await options.repositories.runs.getById(event.runId);

    if (!run) {
      throw new Error(`Run ${event.runId} does not exist.`);
    }

    const worker = await options.workerRegistry.getWorker(event.workerId);

    if (!worker) {
      throw new Error(`Remote worker ${event.workerId} does not exist.`);
    }

    if (worker.sessionId !== event.workerSessionId) {
      throw new Error(
        `Remote worker ${event.workerId} session ${event.workerSessionId} does not match active session ${worker.sessionId}.`
      );
    }

    const step = (await options.repositories.runs.listSteps(event.runId)).find(
      (candidate) => candidate.id === event.stepId
    );

    if (!step) {
      throw new Error(
        `Step ${event.stepId} does not belong to run ${event.runId}.`
      );
    }

    if (step.remoteWorkerId !== event.workerId) {
      throw new Error(
        `Step ${event.stepId} is assigned to worker ${step.remoteWorkerId}, not ${event.workerId}.`
      );
    }

    if (step.remoteWorkerSessionId !== event.workerSessionId) {
      throw new Error(
        `Step ${event.stepId} is assigned to worker session ${step.remoteWorkerSessionId}, not ${event.workerSessionId}.`
      );
    }

    if (step.remoteExecutionAttemptId !== event.attemptId) {
      throw new Error(
        `Step ${event.stepId} attempt ${event.attemptId} does not match active attempt ${step.remoteExecutionAttemptId}.`
      );
    }

    if (!step.remoteAssignedAt) {
      throw new Error(`Step ${event.stepId} is missing remote assignment metadata.`);
    }

    return {
      outcomeId: run.outcomeId,
      runId: run.id,
      step,
      assignment: {
        executionTarget: "remote_worker",
        workerId: event.workerId,
        workerSessionId: event.workerSessionId,
        attemptId: event.attemptId,
        assignedAt: step.remoteAssignedAt
      }
    };
  }

  return {
    async registerWorker(input: RemoteWorkerRegistration) {
      return options.workerRegistry.registerWorker(input);
    },

    async recordHeartbeat(input: RemoteWorkerHeartbeat) {
      return options.workerRegistry.recordHeartbeat(input);
    },

    async disconnectWorker(input: {
      workerId: string;
      workerSessionId: string;
      disconnectedAt: string;
    }) {
      return options.workerRegistry.disconnectWorker(input);
    },

    async ingestEvent(event: DaemonEvent) {
      const context = await resolveContext(event);

      if (event.type === "log") {
        options.eventBus.publish({
          outcomeId: context.outcomeId,
          type: "run.log",
          data: {
            runId: context.runId,
            stepId: context.step.id,
            stepTitle: context.step.title,
            level: event.level,
            message: event.message,
            createdAt: event.createdAt
          }
        });
        await options.onLogEvent?.(event, context);
        return;
      }

      if (event.type === "artifact") {
        await options.onArtifactEvent?.(event, context);
        return;
      }

      if (event.type === "checkpoint") {
        await options.onCheckpointEvent?.(event, context);
        return;
      }

      if (event.type === "status") {
        await options.workerRegistry.setWorkerAvailability({
          workerId: event.workerId,
          workerSessionId: event.workerSessionId,
          availability: availabilityForRemoteStatus(event.status),
          updatedAt: event.createdAt
        });

        options.eventBus.publish({
          outcomeId: context.outcomeId,
          type: "remote.step.updated",
          data: {
            runId: context.runId,
            stepId: context.step.id,
            status: event.status,
            assignment: context.assignment,
            message: event.message ?? null,
            occurredAt: event.createdAt
          }
        });
        return;
      }

      await options.workerRegistry.setWorkerAvailability({
        workerId: event.workerId,
        workerSessionId: event.workerSessionId,
        availability: "available",
        updatedAt: event.finishedAt
      });

      options.eventBus.publish({
        outcomeId: context.outcomeId,
        type: "remote.step.updated",
        data: {
          runId: context.runId,
          stepId: context.step.id,
          status: event.status,
          assignment: context.assignment,
          message: null,
          occurredAt: event.finishedAt
        }
      });

      await options.onTerminalEvent?.(event, context);
    }
  };
}
