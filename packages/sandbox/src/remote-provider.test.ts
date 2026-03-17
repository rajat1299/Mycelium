import { describe, expect, it, vi } from "vitest";
import type { SandboxExecutionRequest, SandboxExecutionResult } from "./provider";
import {
  RemoteExecutionInterruptedError,
  RemoteProvider
} from "./remote-provider";

function createRemoteRequest(): SandboxExecutionRequest {
  return {
    runId: "run_123",
    context: {
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      outcomePrompt: "Draft the operator brief."
    },
    workspace: {
      rootPath: "/tmp/mycelium/run_123",
      inputPath: "/tmp/mycelium/run_123/input",
      artifactsPath: "/tmp/mycelium/run_123/artifacts",
      logsPath: "/tmp/mycelium/run_123/logs"
    },
    step: {
      id: "step_123",
      runId: "run_123",
      planNodeId: "plan_outcome_123:draft-brief",
      title: "Draft brief",
      kind: "task",
      capability: "coding",
      instruction: "Write the brief artifact.",
      template: "draft_brief",
      expectedArtifactPath: "artifacts/brief.md",
      expectedArtifactKind: "brief",
      executionTarget: "remote_worker",
      remoteWorkerId: "worker_1",
      remoteWorkerSessionId: "worker_session_1",
      remoteExecutionAttemptId: "attempt_1",
      remoteAssignedAt: "2026-03-17T10:00:00.000Z",
      status: "claimed",
      position: 0,
      createdAt: "2026-03-17T10:00:00.000Z",
      updatedAt: "2026-03-17T10:00:00.000Z"
    }
  };
}

function createLocalResult(): SandboxExecutionResult {
  return {
    containerName: "local-step-123",
    exitCode: 0,
    stdout: "local execution complete",
    stderr: "",
    startedAt: "2026-03-17T10:00:00.000Z",
    finishedAt: "2026-03-17T10:00:01.000Z",
    durationMs: 1000,
    producedArtifactPaths: ["artifacts/local-brief.md"]
  };
}

describe("RemoteProvider", () => {
  it("dispatches a remote step command and waits for checkpoint upload before completing", async () => {
    const provider = new RemoteProvider();
    const executePromise = provider.execute(createRemoteRequest());

    const firstClaim = provider.claimCommands({
      workerId: "worker_1",
      workerSessionId: "worker_session_1"
    });

    expect(firstClaim).toEqual([
      expect.objectContaining({
        type: "dispatch_step",
        assignment: expect.objectContaining({
          workerId: "worker_1",
          workerSessionId: "worker_session_1",
          attemptId: "attempt_1"
        }),
        step: expect.objectContaining({
          id: "step_123",
          executionTarget: "remote_worker"
        }),
        context: expect.objectContaining({
          workspaceId: "ws_123",
          outcomeId: "outcome_123",
          outcomePrompt: "Draft the operator brief."
        })
      })
    ]);
    expect(
      provider.claimCommands({
        workerId: "worker_1",
        workerSessionId: "worker_session_1"
      })
    ).toEqual([]);

    provider.recordArtifactUpload({
      type: "artifact",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      artifact: {
        kind: "brief",
        relativePath: "artifacts/brief.md",
        size: 20,
        contentBase64: Buffer.from("# Draft brief\n").toString("base64"),
        createdAt: "2026-03-17T10:00:02.000Z"
      }
    });

    provider.completeAttempt({
      type: "terminal",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      status: "completed",
      exitCode: 0,
      stdoutSummary: "remote execution complete",
      stderrSummary: "",
      expectedArtifactCount: 1,
      finishedAt: "2026-03-17T10:00:05.000Z"
    });

    let resolved = false;
    void executePromise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    provider.recordCheckpointUpload({
      type: "checkpoint",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      checkpoint: {
        kind: "step_completed",
        resumable: true,
        createdAt: "2026-03-17T10:00:04.000Z",
        payload: {
          version: 1,
          run: {
            id: "run_123",
            outcomeId: "outcome_123",
            workspaceId: "ws_123",
            status: "running"
          },
          steps: [
            {
              stepId: "step_123",
              title: "Draft brief",
              status: "completed"
            }
          ],
          readyStepIds: [],
          blockedStepIds: [],
          workspacePaths: {
            inputDir: "/tmp/mycelium/run_123/input",
            logsDir: "/tmp/mycelium/run_123/logs",
            artifactsDir: "/tmp/mycelium/run_123/artifacts"
          },
          artifactIds: ["artifact_123"],
          latestAuditSequence: 0
        }
      }
    });

    await expect(executePromise).resolves.toEqual(
      expect.objectContaining({
        containerName: "remote-worker:worker_1",
        exitCode: 0,
        stdout: "remote execution complete",
        producedArtifactPaths: ["artifacts/brief.md"]
      })
    );
  });

  it("delegates local execution to the fallback provider and interrupts pending remote attempts", async () => {
    const localResult = createLocalResult();
    const fallbackProvider = {
      execute: vi.fn(async () => localResult)
    };
    const provider = new RemoteProvider({ fallbackProvider });

    await expect(
      provider.execute({
        ...createRemoteRequest(),
        step: {
          ...createRemoteRequest().step,
          executionTarget: "local_docker",
          remoteWorkerId: null,
          remoteWorkerSessionId: null,
          remoteExecutionAttemptId: null,
          remoteAssignedAt: null,
          status: "running"
        }
      })
    ).resolves.toEqual(localResult);
    expect(fallbackProvider.execute).toHaveBeenCalledTimes(1);

    const pendingRemote = provider.execute(createRemoteRequest());
    provider.interruptWorkerSession({
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      message: "Remote worker disconnected."
    });

    await expect(pendingRemote).rejects.toBeInstanceOf(
      RemoteExecutionInterruptedError
    );
  });

  it("waits for the declared remote artifact uploads even when terminal and checkpoint arrive first", async () => {
    const provider = new RemoteProvider();
    const executePromise = provider.execute(createRemoteRequest());

    provider.claimCommands({
      workerId: "worker_1",
      workerSessionId: "worker_session_1"
    });

    provider.recordCheckpointUpload({
      type: "checkpoint",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      checkpoint: {
        kind: "step_completed",
        resumable: true,
        createdAt: "2026-03-17T10:00:04.000Z",
        payload: {
          version: 1,
          run: {
            id: "run_123",
            outcomeId: "outcome_123",
            workspaceId: "ws_123",
            status: "running"
          },
          steps: [
            {
              stepId: "step_123",
              title: "Draft brief",
              status: "completed"
            }
          ],
          readyStepIds: [],
          blockedStepIds: [],
          workspacePaths: {
            inputDir: "/tmp/mycelium/run_123/input",
            logsDir: "/tmp/mycelium/run_123/logs",
            artifactsDir: "/tmp/mycelium/run_123/artifacts"
          },
          artifactIds: [],
          latestAuditSequence: 0
        }
      }
    });

    provider.completeAttempt({
      type: "terminal",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      status: "completed",
      exitCode: 0,
      stdoutSummary: "remote execution complete",
      stderrSummary: "",
      expectedArtifactCount: 1,
      finishedAt: "2026-03-17T10:00:05.000Z"
    });

    let resolved = false;
    void executePromise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    provider.recordArtifactUpload({
      type: "artifact",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      artifact: {
        kind: "brief",
        relativePath: "artifacts/brief.md",
        size: 20,
        contentBase64: Buffer.from("# Draft brief\n").toString("base64"),
        createdAt: "2026-03-17T10:00:06.000Z"
      }
    });

    await expect(executePromise).resolves.toEqual(
      expect.objectContaining({
        producedArtifactPaths: ["artifacts/brief.md"]
      })
    );
  });

  it("does not let duplicate artifact uploads satisfy the remote completion barrier early", async () => {
    const provider = new RemoteProvider();
    const executePromise = provider.execute(createRemoteRequest());

    provider.claimCommands({
      workerId: "worker_1",
      workerSessionId: "worker_session_1"
    });

    provider.recordCheckpointUpload({
      type: "checkpoint",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      checkpoint: {
        kind: "step_completed",
        resumable: true,
        createdAt: "2026-03-17T10:00:04.000Z",
        payload: {
          version: 1,
          run: {
            id: "run_123",
            outcomeId: "outcome_123",
            workspaceId: "ws_123",
            status: "running"
          },
          steps: [
            {
              stepId: "step_123",
              title: "Draft brief",
              status: "completed"
            }
          ],
          readyStepIds: [],
          blockedStepIds: [],
          workspacePaths: {
            inputDir: "/tmp/mycelium/run_123/input",
            logsDir: "/tmp/mycelium/run_123/logs",
            artifactsDir: "/tmp/mycelium/run_123/artifacts"
          },
          artifactIds: [],
          latestAuditSequence: 0
        }
      }
    });

    provider.completeAttempt({
      type: "terminal",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      status: "completed",
      exitCode: 0,
      stdoutSummary: "remote execution complete",
      stderrSummary: "",
      expectedArtifactCount: 2,
      finishedAt: "2026-03-17T10:00:05.000Z"
    });

    provider.recordArtifactUpload({
      type: "artifact",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      artifact: {
        kind: "brief",
        relativePath: "artifacts/a.md",
        size: 8,
        contentBase64: Buffer.from("# A\n").toString("base64"),
        createdAt: "2026-03-17T10:00:06.000Z"
      }
    });

    provider.recordArtifactUpload({
      type: "artifact",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      artifact: {
        kind: "brief",
        relativePath: "artifacts/a.md",
        size: 8,
        contentBase64: Buffer.from("# A\n").toString("base64"),
        createdAt: "2026-03-17T10:00:07.000Z"
      }
    });

    let resolved = false;
    void executePromise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    provider.recordArtifactUpload({
      type: "artifact",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_123",
      attemptId: "attempt_1",
      artifact: {
        kind: "brief",
        relativePath: "artifacts/b.md",
        size: 8,
        contentBase64: Buffer.from("# B\n").toString("base64"),
        createdAt: "2026-03-17T10:00:08.000Z"
      }
    });

    await expect(executePromise).resolves.toEqual(
      expect.objectContaining({
        producedArtifactPaths: ["artifacts/a.md", "artifacts/b.md"]
      })
    );
  });
});
