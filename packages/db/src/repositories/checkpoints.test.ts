import { describe, expect, it } from "vitest";
import type { CheckpointDetailPayload } from "@computer-oss/protocol";
import { CheckpointRepository } from "./checkpoints";
import { RunRepository } from "./runs";
import { createRepositoryTestDatabase } from "./test-database";

function seedCheckpointContext(
  state: ReturnType<typeof createRepositoryTestDatabase>["state"]
) {
  state.outcomes.push(
    {
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Ship the launch brief and summary.",
      source: "web",
      status: "running",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    },
    {
      id: "outcome_999",
      workspaceId: "ws_999",
      userId: "user_999",
      prompt: "Other workspace outcome.",
      source: "web",
      status: "running",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    }
  );

  state.outcomeRuns.push(
    {
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "interrupted",
      latestCheckpointId: null,
      resumable: false,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    },
    {
      id: "run_999",
      outcomeId: "outcome_999",
      planId: "plan_outcome_999",
      status: "running",
      latestCheckpointId: null,
      resumable: false,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    }
  );

  state.runSteps.push(
    {
      id: "step_root",
      runId: "run_123",
      planNodeId: "node_root",
      title: "Analyze outcome",
      kind: "root",
      capability: "reasoning",
      status: "running",
      position: 0,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    },
    {
      id: "step_child",
      runId: "run_123",
      planNodeId: "node_child",
      title: "Draft brief",
      kind: "task",
      capability: "coding",
      status: "running",
      position: 1,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    },
    {
      id: "step_other",
      runId: "run_999",
      planNodeId: "node_other",
      title: "Other step",
      kind: "task",
      capability: "coding",
      status: "running",
      position: 0,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    }
  );
}

function buildCheckpointPayload(
  overrides: Partial<CheckpointDetailPayload> = {}
): CheckpointDetailPayload {
  return {
    version: 1,
    run: {
      id: "run_123",
      outcomeId: "outcome_123",
      workspaceId: "ws_123",
      status: "running"
    },
    steps: [
      {
        stepId: "step_root",
        title: "Analyze outcome",
        status: "completed"
      },
      {
        stepId: "step_child",
        title: "Draft brief",
        status: "ready"
      }
    ],
    readyStepIds: ["step_child"],
    blockedStepIds: [],
    workspacePaths: {
      inputDir: "input",
      logsDir: "logs",
      artifactsDir: "artifacts"
    },
    artifactIds: ["artifact_1"],
    latestAuditSequence: 2,
    ...overrides
  };
}

describe("CheckpointRepository", () => {
  it("creates checkpoint metadata, lists newest-first, and loads checkpoints by run sequence", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedCheckpointContext(state);
    const repository = new CheckpointRepository(db as never);

    await repository.create({
      id: "checkpoint_001",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: null,
      sequence: 1,
      kind: "run_started",
      resumable: true,
      storeKey: "run_123/000001-checkpoint_001.json",
      checksum: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      byteSize: 512,
      createdAt: "2026-03-16T00:02:00.000Z"
    });
    await repository.create({
      id: "checkpoint_002",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_root",
      sequence: 2,
      kind: "step_completed",
      resumable: true,
      storeKey: "run_123/000002-checkpoint_002.json",
      checksum: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      byteSize: 768,
      createdAt: "2026-03-16T00:03:00.000Z"
    });

    await expect(repository.listByRun("run_123")).resolves.toEqual([
      expect.objectContaining({ id: "checkpoint_002", sequence: 2 }),
      expect.objectContaining({ id: "checkpoint_001", sequence: 1 })
    ]);

    await expect(
      repository.getByRunSequence({
        runId: "run_123",
        sequence: 1
      })
    ).resolves.toEqual(expect.objectContaining({ id: "checkpoint_001" }));
  });

  it("rejects checkpoint writes that cross run, outcome, workspace, or step ownership", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedCheckpointContext(state);
    const repository = new CheckpointRepository(db as never);

    await expect(
      repository.create({
        id: "checkpoint_bad_outcome",
        workspaceId: "ws_123",
        outcomeId: "outcome_999",
        runId: "run_123",
        stepId: null,
        sequence: 1,
        kind: "run_started",
        resumable: true,
        storeKey: "run_123/000001-checkpoint_bad_outcome.json",
        checksum: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        byteSize: 512,
        createdAt: "2026-03-16T00:02:00.000Z"
      })
    ).rejects.toThrow("Run run_123 belongs to outcome_123, not outcome_999.");

    await expect(
      repository.create({
        id: "checkpoint_bad_step",
        workspaceId: "ws_123",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_other",
        sequence: 1,
        kind: "step_completed",
        resumable: true,
        storeKey: "run_123/000001-checkpoint_bad_step.json",
        checksum: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        byteSize: 512,
        createdAt: "2026-03-16T00:02:00.000Z"
      })
    ).rejects.toThrow("Step step_other belongs to run_999, not run_123.");
  });

  it("restores run step state from a checkpoint snapshot", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedCheckpointContext(state);
    const checkpoints = new CheckpointRepository(db as never);
    const runs = new RunRepository(db as never);

    await checkpoints.create({
      id: "checkpoint_restore",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_root",
      sequence: 3,
      kind: "step_completed",
      resumable: true,
      storeKey: "run_123/000003-checkpoint_restore.json",
      checksum: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      byteSize: 1024,
      createdAt: "2026-03-16T00:04:00.000Z"
    });

    const restored = await runs.restoreFromCheckpoint({
      runId: "run_123",
      checkpointId: "checkpoint_restore",
      payload: buildCheckpointPayload(),
      updatedAt: "2026-03-16T00:06:00.000Z"
    });

    expect(restored).toEqual({
      run: expect.objectContaining({
        id: "run_123",
        latestCheckpointId: "checkpoint_restore",
        resumable: true
      }),
      steps: [
        expect.objectContaining({ id: "step_root", status: "completed" }),
        expect.objectContaining({ id: "step_child", status: "ready" })
      ]
    });
  });

  it("keeps the run latest checkpoint pointer monotonic when older checkpoints arrive late", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedCheckpointContext(state);
    const repository = new CheckpointRepository(db as never);

    await repository.create({
      id: "checkpoint_002",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_root",
      sequence: 2,
      kind: "step_completed",
      resumable: false,
      storeKey: "run_123/000002-checkpoint_002.json",
      checksum: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      byteSize: 768,
      createdAt: "2026-03-16T00:03:00.000Z"
    });

    await repository.create({
      id: "checkpoint_001",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: null,
      sequence: 1,
      kind: "run_started",
      resumable: true,
      storeKey: "run_123/000001-checkpoint_001.json",
      checksum: "9999999999999999999999999999999999999999999999999999999999999999",
      byteSize: 512,
      createdAt: "2026-03-16T00:02:00.000Z"
    });

    expect(state.outcomeRuns).toEqual([
      expect.objectContaining({
        id: "run_123",
        latestCheckpointId: "checkpoint_002",
        resumable: false
      }),
      expect.objectContaining({
        id: "run_999",
        latestCheckpointId: null,
        resumable: false
      })
    ]);
  });
});
