import { describe, expect, it } from "vitest";
import {
  CheckpointDetailPayloadSchema,
  CheckpointDetailSchema,
  CheckpointListResponseSchema,
  CheckpointSummarySchema,
  OutcomeStreamEventSchema,
  ResumeRunRequestSchema,
  ResumeRunResponseSchema,
  RunSchema
} from "./index";

describe("checkpoint protocol contracts", () => {
  it("accepts checkpoint summaries, detail payloads, and resume contracts", () => {
    const payload = CheckpointDetailPayloadSchema.parse({
      version: 1,
      run: {
        id: "run_123",
        outcomeId: "outcome_123",
        workspaceId: "ws_default",
        status: "running"
      },
      steps: [
        {
          stepId: "step_analyze",
          title: "Analyze outcome",
          status: "completed"
        },
        {
          stepId: "step_synthesize",
          title: "Synthesize result",
          status: "ready"
        }
      ],
      readyStepIds: ["step_synthesize"],
      blockedStepIds: [],
      workspacePaths: {
        inputDir: "input",
        logsDir: "logs",
        artifactsDir: "artifacts"
      },
      artifactIds: ["artifact_1", "artifact_2"],
      latestAuditSequence: 4
    });

    const checkpoint = CheckpointDetailSchema.parse({
      id: "checkpoint_123",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      runId: "run_123",
      sequence: 3,
      kind: "step_completed",
      resumable: true,
      storeKey: "run_123/000003-checkpoint_123.json",
      checksum: "a".repeat(64),
      byteSize: 512,
      stepId: "step_analyze",
      createdAt: "2026-03-16T00:00:00.000Z",
      payload
    });
    const summary = CheckpointSummarySchema.parse({
      id: checkpoint.id,
      workspaceId: checkpoint.workspaceId,
      outcomeId: checkpoint.outcomeId,
      runId: checkpoint.runId,
      sequence: checkpoint.sequence,
      kind: checkpoint.kind,
      resumable: checkpoint.resumable,
      storeKey: checkpoint.storeKey,
      checksum: checkpoint.checksum,
      byteSize: checkpoint.byteSize,
      stepId: checkpoint.stepId,
      createdAt: checkpoint.createdAt
    });

    expect(
      CheckpointListResponseSchema.parse({
        checkpoints: [summary]
      })
    ).toEqual({
      checkpoints: [summary]
    });

    expect(
      ResumeRunRequestSchema.parse({
        checkpointId: checkpoint.id
      })
    ).toEqual({
      checkpointId: checkpoint.id
    });

    expect(
      ResumeRunResponseSchema.parse({
        run: {
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_123",
          triggerMessageId: "msg_123",
          status: "running",
          latestCheckpointId: checkpoint.id,
          resumable: false,
          createdAt: "2026-03-16T00:00:00.000Z",
          updatedAt: "2026-03-16T00:05:00.000Z"
        },
        resumedFromCheckpointId: checkpoint.id
      })
    ).toEqual({
      run: expect.objectContaining({
        id: "run_123",
        latestCheckpointId: checkpoint.id
      }),
      resumedFromCheckpointId: checkpoint.id
    });
  });

  it("rejects invalid resumable and terminal checkpoint invariants", () => {
    expect(() =>
      CheckpointDetailSchema.parse({
        id: "checkpoint_terminal",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        sequence: 6,
        kind: "run_completed",
        resumable: true,
        storeKey: "run_123/000006-checkpoint_terminal.json",
        checksum: "b".repeat(64),
        byteSize: 256,
        stepId: null,
        createdAt: "2026-03-16T00:00:00.000Z",
        payload: {
          version: 1,
          run: {
            id: "run_123",
            outcomeId: "outcome_123",
            workspaceId: "ws_default",
            triggerMessageId: "msg_123",
            status: "completed"
          },
          steps: [],
          readyStepIds: [],
          blockedStepIds: [],
          workspacePaths: {
            inputDir: "input",
            logsDir: "logs",
            artifactsDir: "artifacts"
          },
          artifactIds: [],
          latestAuditSequence: 10
        }
      })
    ).toThrow(/terminal checkpoints cannot be resumable/i);

    expect(() =>
      CheckpointDetailSchema.parse({
        id: "checkpoint_blocked",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        sequence: 4,
        kind: "step_blocked_on_approval",
        resumable: true,
        storeKey: "run_123/000004-checkpoint_blocked.json",
        checksum: "c".repeat(64),
        byteSize: 256,
        stepId: "step_synthesize",
        createdAt: "2026-03-16T00:00:00.000Z",
        payload: {
          version: 1,
          run: {
            id: "run_123",
            outcomeId: "outcome_123",
            workspaceId: "ws_default",
            triggerMessageId: "msg_123",
            status: "blocked"
          },
          steps: [],
          readyStepIds: [],
          blockedStepIds: ["step_synthesize"],
          workspacePaths: {
            inputDir: "input",
            logsDir: "logs",
            artifactsDir: "artifacts"
          },
          artifactIds: [],
          latestAuditSequence: 8
        }
      })
    ).toThrow(/approval-blocked checkpoints are not resumable/i);

    expect(
      RunSchema.safeParse({
        id: "run_123",
        outcomeId: "outcome_123",
        planId: "plan_123",
        triggerMessageId: "msg_123",
        status: "interrupted",
        resumable: false,
        latestCheckpointId: null,
        createdAt: "2026-03-16T00:00:00.000Z",
        updatedAt: "2026-03-16T00:00:00.000Z"
      }).success
    ).toBe(false);
  });

  it("accepts checkpoint and resume events", () => {
    const checkpointCreated = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "checkpoint.created",
      data: {
        id: "checkpoint_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        sequence: 3,
        kind: "step_completed",
        resumable: true,
        storeKey: "run_123/000003-checkpoint_123.json",
        checksum: "d".repeat(64),
        byteSize: 512,
        stepId: "step_analyze",
        createdAt: "2026-03-16T00:00:00.000Z"
      }
    });

    const resumed = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "run.resumed",
      data: {
        run: {
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_123",
          triggerMessageId: "msg_123",
          status: "running",
          latestCheckpointId: "checkpoint_123",
          resumable: false,
          createdAt: "2026-03-16T00:00:00.000Z",
          updatedAt: "2026-03-16T00:05:00.000Z"
        },
        resumedFromCheckpointId: "checkpoint_123"
      }
    });

    expect(checkpointCreated.type).toBe("checkpoint.created");
    expect(resumed.type).toBe("run.resumed");
  });
});
