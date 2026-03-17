import { describe, expect, it } from "vitest";
import {
  CheckpointDetailPayloadSchema,
  DaemonArtifactEventSchema,
  DaemonCheckpointEventSchema,
  DaemonCommandSchema,
  DaemonEventSchema,
  DaemonLogEventSchema,
  DaemonStatusEventSchema,
  DaemonTerminalEventSchema
} from "./index";

describe("daemon protocol contracts", () => {
  it("accepts a daemon dispatch command for a remote step", () => {
    const command = DaemonCommandSchema.parse({
      type: "dispatch_step",
      commandId: "command_1",
      issuedAt: "2026-03-16T12:00:10.000Z",
      assignment: {
        executionTarget: "remote_worker",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        attemptId: "attempt_1",
        assignedAt: "2026-03-16T12:00:10.000Z"
      },
      context: {
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        outcomePrompt: "Analyze the outcome and draft a brief.",
        timeoutMs: 300000,
        environment: {
          MYCELIUM_RUN_ID: "run_123"
        }
      },
      step: {
        id: "step_1",
        runId: "run_123",
        planNodeId: "plan_123:analyze-outcome",
        title: "Analyze outcome",
        kind: "root",
        capability: "reasoning",
        status: "claimed",
        position: 0,
        executionTarget: "remote_worker",
        remoteWorkerId: "worker_1",
        remoteWorkerSessionId: "worker_session_1",
        remoteExecutionAttemptId: "attempt_1",
        remoteAssignedAt: "2026-03-16T12:00:10.000Z",
        createdAt: "2026-03-16T12:00:00.000Z",
        updatedAt: "2026-03-16T12:00:10.000Z"
      }
    });

    expect(command.type).toBe("dispatch_step");
  });

  it("accepts daemon log, artifact, checkpoint, status, and terminal events", () => {
    const checkpointPayload = CheckpointDetailPayloadSchema.parse({
      version: 1,
      run: {
        id: "run_123",
        outcomeId: "outcome_123",
        workspaceId: "ws_default",
        status: "running"
      },
      steps: [
        {
          stepId: "step_1",
          title: "Analyze outcome",
          status: "completed"
        }
      ],
      readyStepIds: [],
      blockedStepIds: [],
      workspacePaths: {
        inputDir: "input",
        logsDir: "logs",
        artifactsDir: "artifacts"
      },
      artifactIds: ["artifact_1"],
      latestAuditSequence: 2
    });

    const logEvent = DaemonLogEventSchema.parse({
      type: "log",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_1",
      attemptId: "attempt_1",
      level: "info",
      message: "Started step execution.",
      createdAt: "2026-03-16T12:00:11.000Z"
    });

    const artifactEvent = DaemonArtifactEventSchema.parse({
      type: "artifact",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_1",
      attemptId: "attempt_1",
      artifact: {
        kind: "analysis",
        relativePath: "artifacts/analyze-outcome.md",
        size: 128,
        contentBase64: "IyBBbmFseXNpcyBub3Rlcwo=",
        metadata: {
          contentType: "text/markdown"
        },
        createdAt: "2026-03-16T12:00:12.000Z"
      }
    });

    const checkpointEvent = DaemonCheckpointEventSchema.parse({
      type: "checkpoint",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_1",
      attemptId: "attempt_1",
      checkpoint: {
        kind: "step_completed",
        resumable: true,
        createdAt: "2026-03-16T12:00:13.000Z",
        payload: checkpointPayload
      }
    });

    const statusEvent = DaemonStatusEventSchema.parse({
      type: "status",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_1",
      attemptId: "attempt_1",
      status: "running",
      message: "Worker is executing the assigned step.",
      createdAt: "2026-03-16T12:00:11.500Z"
    });

    const terminalEvent = DaemonTerminalEventSchema.parse({
      type: "terminal",
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      runId: "run_123",
      stepId: "step_1",
      attemptId: "attempt_1",
      status: "completed",
      exitCode: 0,
      stdoutSummary: "Step completed successfully.",
      stderrSummary: "",
      expectedArtifactCount: 1,
      finishedAt: "2026-03-16T12:00:14.000Z"
    });

    expect(DaemonEventSchema.parse(logEvent)).toEqual(logEvent);
    expect(DaemonEventSchema.parse(artifactEvent)).toEqual(artifactEvent);
    expect(DaemonEventSchema.parse(checkpointEvent)).toEqual(checkpointEvent);
    expect(DaemonEventSchema.parse(statusEvent)).toEqual(statusEvent);
    expect(DaemonEventSchema.parse(terminalEvent)).toEqual(terminalEvent);
  });
});
