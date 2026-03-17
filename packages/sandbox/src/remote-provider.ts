import type {
  DaemonArtifactEvent,
  DaemonCheckpointEvent,
  DaemonCommand,
  DaemonDispatchStepCommand,
  DaemonTerminalEvent
} from "@computer-oss/protocol";
import type {
  SandboxExecutionRequest,
  SandboxExecutionResult,
  SandboxProvider
} from "./provider";

type ClaimCommandsInput = {
  workerId: string;
  workerSessionId: string;
};

type InterruptWorkerSessionInput = ClaimCommandsInput & {
  message?: string;
};

type PendingAttempt = {
  request: SandboxExecutionRequest;
  resolve: (result: SandboxExecutionResult) => void;
  reject: (error: Error) => void;
  artifactPaths: Set<string>;
  uploadedArtifactCount: number;
  checkpointUploaded: boolean;
  terminalEvent: DaemonTerminalEvent | null;
};

export class RemoteExecutionInterruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteExecutionInterruptedError";
  }
}

export type RemoteProviderOptions = {
  fallbackProvider?: SandboxProvider;
};

export class RemoteProvider implements SandboxProvider {
  private readonly fallbackProvider?: SandboxProvider;
  private readonly commandsBySession = new Map<string, DaemonCommand[]>();
  private readonly pendingAttempts = new Map<string, PendingAttempt>();

  constructor(options: RemoteProviderOptions = {}) {
    this.fallbackProvider = options.fallbackProvider;
  }

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
    if (request.step.executionTarget !== "remote_worker") {
      if (!this.fallbackProvider) {
        throw new Error("RemoteProvider requires a remote worker execution target.");
      }

      return this.fallbackProvider.execute(request);
    }

    const assignment = {
      executionTarget: "remote_worker" as const,
      workerId: requireValue(request.step.remoteWorkerId, "remoteWorkerId"),
      workerSessionId: requireValue(
        request.step.remoteWorkerSessionId,
        "remoteWorkerSessionId"
      ),
      attemptId: requireValue(
        request.step.remoteExecutionAttemptId,
        "remoteExecutionAttemptId"
      ),
      assignedAt: requireValue(request.step.remoteAssignedAt, "remoteAssignedAt")
    };

    if (this.pendingAttempts.has(assignment.attemptId)) {
      throw new Error(`Remote attempt ${assignment.attemptId} is already in flight.`);
    }

    const command = {
      type: "dispatch_step",
      commandId: `command_${assignment.attemptId}`,
      issuedAt: assignment.assignedAt,
      assignment,
      context: {
        workspaceId: request.context.workspaceId,
        outcomeId: request.context.outcomeId,
        outcomePrompt: request.context.outcomePrompt,
        ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {}),
        ...(request.environment ? { environment: request.environment } : {})
      },
      step: request.step as DaemonDispatchStepCommand["step"]
    } satisfies DaemonDispatchStepCommand;

    const sessionKey = getWorkerSessionKey(
      assignment.workerId,
      assignment.workerSessionId
    );
    const queue = this.commandsBySession.get(sessionKey) ?? [];
    queue.push(command);
    this.commandsBySession.set(sessionKey, queue);

    return await new Promise<SandboxExecutionResult>((resolve, reject) => {
      this.pendingAttempts.set(assignment.attemptId, {
        request,
        resolve,
        reject,
        artifactPaths: new Set<string>(),
        uploadedArtifactCount: 0,
        checkpointUploaded: false,
        terminalEvent: null
      });
    });
  }

  claimCommands(input: ClaimCommandsInput): DaemonCommand[] {
    const sessionKey = getWorkerSessionKey(input.workerId, input.workerSessionId);
    const commands = this.commandsBySession.get(sessionKey) ?? [];
    this.commandsBySession.delete(sessionKey);
    return [...commands];
  }

  recordArtifactUpload(event: DaemonArtifactEvent): void {
    const pending = this.pendingAttempts.get(event.attemptId);

    if (!pending) {
      return;
    }

    pending.artifactPaths.add(event.artifact.relativePath);
    pending.uploadedArtifactCount += 1;
    this.maybeResolveAttempt(event.attemptId);
  }

  recordCheckpointUpload(event: DaemonCheckpointEvent): void {
    const pending = this.pendingAttempts.get(event.attemptId);

    if (!pending) {
      return;
    }

    pending.checkpointUploaded = true;
    this.maybeResolveAttempt(event.attemptId);
  }

  completeAttempt(event: DaemonTerminalEvent): void {
    const pending = this.pendingAttempts.get(event.attemptId);

    if (!pending) {
      return;
    }

    pending.terminalEvent = event;
    this.maybeResolveAttempt(event.attemptId);
  }

  interruptWorkerSession(input: InterruptWorkerSessionInput): number {
    const sessionKey = getWorkerSessionKey(input.workerId, input.workerSessionId);
    this.commandsBySession.delete(sessionKey);

    let interrupted = 0;

    for (const [attemptId, pending] of this.pendingAttempts.entries()) {
      const step = pending.request.step;
      if (
        step.remoteWorkerId !== input.workerId ||
        step.remoteWorkerSessionId !== input.workerSessionId
      ) {
        continue;
      }

      interrupted += 1;
      this.pendingAttempts.delete(attemptId);
      pending.reject(
        new RemoteExecutionInterruptedError(
          input.message ?? `Remote worker ${input.workerId} disconnected.`
        )
      );
    }

    return interrupted;
  }

  private maybeResolveAttempt(attemptId: string) {
    const pending = this.pendingAttempts.get(attemptId);

    if (!pending || !pending.terminalEvent) {
      return;
    }

    const terminal = pending.terminalEvent;
    if (terminal.status === "interrupted") {
      this.pendingAttempts.delete(attemptId);
      pending.reject(
        new RemoteExecutionInterruptedError(
          `Remote execution attempt ${attemptId} was interrupted.`
        )
      );
      return;
    }

    if (terminal.status === "completed" && !pending.checkpointUploaded) {
      return;
    }

    if (
      terminal.status === "completed" &&
      pending.uploadedArtifactCount < terminal.expectedArtifactCount
    ) {
      return;
    }

    this.pendingAttempts.delete(attemptId);
    pending.resolve({
      containerName: `remote-worker:${terminal.workerId}`,
      exitCode: terminal.exitCode,
      stdout: terminal.stdoutSummary,
      stderr: terminal.stderrSummary,
      startedAt: pending.request.step.remoteAssignedAt ?? terminal.finishedAt,
      finishedAt: terminal.finishedAt,
      durationMs:
        Math.max(
          0,
          new Date(terminal.finishedAt).getTime() -
            new Date(pending.request.step.remoteAssignedAt ?? terminal.finishedAt).getTime()
        ),
      producedArtifactPaths: Array.from(pending.artifactPaths).sort((left, right) =>
        left.localeCompare(right)
      )
    });
  }
}

function getWorkerSessionKey(workerId: string, workerSessionId: string) {
  return `${workerId}:${workerSessionId}`;
}

function requireValue(value: string | null | undefined, fieldName: string): string {
  if (!value) {
    throw new Error(`Remote execution requires ${fieldName}.`);
  }

  return value;
}
