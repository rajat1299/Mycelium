import { describe, expect, it } from "vitest";
import { AuditEventRepository } from "./audit-events";
import { createRepositoryTestDatabase } from "./test-database";

function seedAuditContext(
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
      status: "running",
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
      id: "step_123",
      runId: "run_123",
      planNodeId: "node_123",
      title: "Analyze outcome",
      kind: "root",
      capability: "reasoning",
      status: "completed",
      position: 0,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    },
    {
      id: "step_999",
      runId: "run_999",
      planNodeId: "node_999",
      title: "Other step",
      kind: "task",
      capability: "coding",
      status: "running",
      position: 0,
      createdAt: new Date("2026-03-16T00:01:00.000Z"),
      updatedAt: new Date("2026-03-16T00:05:00.000Z")
    }
  );

  state.runCheckpoints = [
    {
      id: "checkpoint_123",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      sequence: 1,
      kind: "step_completed",
      resumable: true,
      storeKey: "run_123/000001-checkpoint_123.json",
      checksum: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      byteSize: 512,
      createdAt: new Date("2026-03-16T00:02:00.000Z")
    },
    {
      id: "checkpoint_999",
      workspaceId: "ws_999",
      outcomeId: "outcome_999",
      runId: "run_999",
      stepId: "step_999",
      sequence: 1,
      kind: "run_started",
      resumable: true,
      storeKey: "run_999/000001-checkpoint_999.json",
      checksum: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      byteSize: 512,
      createdAt: new Date("2026-03-16T00:02:00.000Z")
    }
  ];
}

describe("AuditEventRepository", () => {
  it("stores audit events with stable ordering and checkpoint linkage", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedAuditContext(state);
    const repository = new AuditEventRepository(db as never);

    await repository.append({
      id: "audit_001",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: null,
      checkpointId: null,
      sequence: 1,
      category: "lifecycle",
      eventType: "run.started",
      actorType: "system",
      summary: "Run started.",
      payload: { status: "running" },
      createdAt: "2026-03-16T00:02:00.000Z"
    });
    await repository.append({
      id: "audit_002",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      checkpointId: "checkpoint_123",
      sequence: 2,
      category: "checkpoint",
      eventType: "checkpoint.created",
      actorType: "system",
      summary: "Checkpoint recorded after step completion.",
      payload: { checkpointId: "checkpoint_123" },
      createdAt: "2026-03-16T00:03:00.000Z"
    });

    await expect(repository.listByRun("run_123")).resolves.toEqual([
      expect.objectContaining({
        id: "audit_001",
        sequence: 1,
        checkpointId: null
      }),
      expect.objectContaining({
        id: "audit_002",
        sequence: 2,
        checkpointId: "checkpoint_123"
      })
    ]);
  });

  it("rejects audit writes that cross run, outcome, step, or checkpoint ownership", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedAuditContext(state);
    const repository = new AuditEventRepository(db as never);

    await expect(
      repository.append({
        id: "audit_bad_outcome",
        workspaceId: "ws_123",
        outcomeId: "outcome_999",
        runId: "run_123",
        stepId: null,
        checkpointId: null,
        sequence: 1,
        category: "lifecycle",
        eventType: "run.started",
        actorType: "system",
        summary: "Bad outcome linkage.",
        payload: {},
        createdAt: "2026-03-16T00:02:00.000Z"
      })
    ).rejects.toThrow("Run run_123 belongs to outcome_123, not outcome_999.");

    await expect(
      repository.append({
        id: "audit_bad_checkpoint",
        workspaceId: "ws_123",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_123",
        checkpointId: "checkpoint_999",
        sequence: 2,
        category: "checkpoint",
        eventType: "checkpoint.created",
        actorType: "system",
        summary: "Bad checkpoint linkage.",
        payload: {},
        createdAt: "2026-03-16T00:03:00.000Z"
      })
    ).rejects.toThrow("Checkpoint checkpoint_999 belongs to run_999, not run_123.");
  });
});
