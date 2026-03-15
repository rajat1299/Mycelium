import { describe, expect, it } from "vitest";
import { ApprovalRepository } from "./approvals";
import { createRepositoryTestDatabase } from "./test-database";
import { approvals } from "../schema";

function seedApprovalContext(
  state: ReturnType<typeof createRepositoryTestDatabase>["state"]
) {
  state.outcomes.push({
    id: "outcome_123",
    workspaceId: "ws_123",
    userId: "user_123",
    prompt: "Ship the launch brief and summary.",
    source: "web",
    status: "blocked_on_approval",
    createdAt: new Date("2026-03-14T00:00:00.000Z"),
    updatedAt: new Date("2026-03-14T00:10:00.000Z")
  });
  state.outcomes.push({
    id: "outcome_999",
    workspaceId: "ws_999",
    userId: "user_999",
    prompt: "Other workspace outcome.",
    source: "web",
    status: "running",
    createdAt: new Date("2026-03-14T00:00:00.000Z"),
    updatedAt: new Date("2026-03-14T00:10:00.000Z")
  });

  state.outcomeRuns.push({
    id: "run_123",
    outcomeId: "outcome_123",
    planId: "plan_outcome_123",
    status: "blocked",
    createdAt: new Date("2026-03-14T00:05:00.000Z"),
    updatedAt: new Date("2026-03-14T00:10:00.000Z")
  });
  state.outcomeRuns.push({
    id: "run_999",
    outcomeId: "outcome_999",
    planId: "plan_outcome_999",
    status: "running",
    createdAt: new Date("2026-03-14T00:05:00.000Z"),
    updatedAt: new Date("2026-03-14T00:10:00.000Z")
  });

  state.runSteps.push({
    id: "step_123",
    runId: "run_123",
    planNodeId: "node_review",
    title: "Review final result",
    kind: "synthesis",
    capability: "reasoning",
    status: "blocked",
    position: 3,
    createdAt: new Date("2026-03-14T00:05:00.000Z"),
    updatedAt: new Date("2026-03-14T00:10:00.000Z")
  });
  state.runSteps.push({
    id: "step_999",
    runId: "run_999",
    planNodeId: "node_other",
    title: "Other step",
    kind: "task",
    capability: "coding",
    status: "running",
    position: 1,
    createdAt: new Date("2026-03-14T00:05:00.000Z"),
    updatedAt: new Date("2026-03-14T00:10:00.000Z")
  });

  state.artifacts.push({
    id: "artifact_result",
    outcomeId: "outcome_123",
    runId: "run_123",
    stepId: "step_123",
    kind: "result",
    relativePath: "artifacts/final-result.md",
    size: 512,
    metadata: {},
    createdAt: new Date("2026-03-14T00:09:00.000Z")
  });
  state.artifacts.push({
    id: "artifact_other",
    outcomeId: "outcome_999",
    runId: "run_999",
    stepId: "step_999",
    kind: "result",
    relativePath: "artifacts/other.md",
    size: 128,
    metadata: {},
    createdAt: new Date("2026-03-14T00:09:00.000Z")
  });
}

describe("ApprovalRepository", () => {
  it("does not invent a foreign key for jsonb artifact ids in the fake db", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedApprovalContext(state);

    await expect(
      db
        .insert(approvals)
        .values({
          id: "approval_json_only",
          workspaceId: "ws_123",
          outcomeId: "outcome_123",
          runId: "run_123",
          stepId: "step_123",
          status: "pending",
          kind: "output_review_required",
          title: "Review final result",
          summary: null,
          instruction: null,
          artifactIds: ["artifact_missing"],
          requestedAt: new Date("2026-03-14T00:10:00.000Z"),
          resolvedAt: null,
          resolution: null,
          resolutionNote: null
        })
        .returning()
    ).resolves.toEqual([
      expect.objectContaining({
        id: "approval_json_only",
        artifactIds: ["artifact_missing"]
      })
    ]);
  });

  it("creates pending approvals and lists them by workspace and status", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedApprovalContext(state);
    const repository = new ApprovalRepository(db as never);

    const created = await repository.createPending({
      id: "approval_123",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      kind: "output_review_required",
      title: "Review final result",
      summary: "Check the final result before release.",
      instruction: "Verify the claims and format.",
      artifactIds: ["artifact_result"],
      requestedAt: "2026-03-14T00:10:00.000Z"
    });

    await repository.createPending({
      id: "approval_999",
      workspaceId: "ws_999",
      outcomeId: "outcome_999",
      runId: "run_999",
      stepId: "step_999",
      kind: "output_review_required",
      title: "Other review",
      summary: null,
      instruction: null,
      artifactIds: ["artifact_other"],
      requestedAt: "2026-03-14T00:11:00.000Z"
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: "approval_123",
        workspaceId: "ws_123",
        status: "pending",
        artifactIds: ["artifact_result"],
        resolution: null
      })
    );

    await expect(repository.getById("approval_123")).resolves.toEqual(
      expect.objectContaining({
        id: "approval_123",
        stepId: "step_123",
        title: "Review final result"
      })
    );

    await expect(
      repository.listByWorkspace({
        workspaceId: "ws_123",
        status: "pending"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "approval_123",
        status: "pending"
      })
    ]);
  });

  it("resolves an approval once and rejects repeated resolution", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedApprovalContext(state);
    const repository = new ApprovalRepository(db as never);

    await repository.createPending({
      id: "approval_123",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      kind: "output_review_required",
      title: "Review final result",
      summary: null,
      instruction: "Verify the claims and format.",
      artifactIds: ["artifact_result"],
      requestedAt: "2026-03-14T00:10:00.000Z"
    });

    await expect(
      repository.resolve({
        approvalId: "approval_123",
        resolution: "approved",
        resolutionNote: "Looks good.",
        resolvedAt: "2026-03-14T00:12:00.000Z",
        stepStatus: "completed",
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-14T00:12:00.000Z"
      })
    ).resolves.toEqual({
      approval: expect.objectContaining({
        id: "approval_123",
        status: "resolved",
        resolution: "approved",
        resolutionNote: "Looks good."
      }),
      step: expect.objectContaining({
        id: "step_123",
        status: "completed"
      }),
      run: expect.objectContaining({
        id: "run_123",
        status: "running"
      }),
      outcome: expect.objectContaining({
        id: "outcome_123",
        status: "running"
      })
    });

    await expect(
      repository.resolve({
        approvalId: "approval_123",
        resolution: "rejected",
        resolutionNote: "Too late.",
        resolvedAt: "2026-03-14T00:13:00.000Z",
        stepStatus: "failed",
        runStatus: "failed",
        outcomeStatus: "failed",
        updatedAt: "2026-03-14T00:13:00.000Z"
      })
    ).rejects.toThrow("Approval approval_123 is already resolved.");
  });

  it("rolls back approval resolution when a paired lifecycle update fails", async () => {
    const { db, state } = createRepositoryTestDatabase({
      failOnUpdateTables: ["outcomes"]
    });
    seedApprovalContext(state);
    const repository = new ApprovalRepository(db as never);

    await repository.createPending({
      id: "approval_123",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      kind: "output_review_required",
      title: "Review final result",
      summary: null,
      instruction: null,
      artifactIds: ["artifact_result"],
      requestedAt: "2026-03-14T00:10:00.000Z"
    });

    await expect(
      repository.resolve({
        approvalId: "approval_123",
        resolution: "rejected",
        resolutionNote: "Needs edits.",
        resolvedAt: "2026-03-14T00:12:00.000Z",
        stepStatus: "failed",
        runStatus: "failed",
        outcomeStatus: "failed",
        updatedAt: "2026-03-14T00:12:00.000Z"
      })
    ).rejects.toThrow("Simulated outcomes update failure.");

    expect(state.approvals).toEqual([
      expect.objectContaining({
        id: "approval_123",
        status: "pending",
        resolution: null
      })
    ]);
    expect(state.runSteps).toEqual([
      expect.objectContaining({
        id: "step_123",
        status: "blocked"
      }),
      expect.objectContaining({
        id: "step_999",
        status: "running"
      })
    ]);
    expect(state.outcomeRuns).toEqual([
      expect.objectContaining({
        id: "run_123",
        status: "blocked"
      }),
      expect.objectContaining({
        id: "run_999",
        status: "running"
      })
    ]);
    expect(state.outcomes).toEqual([
      expect.objectContaining({
        id: "outcome_123",
        status: "blocked_on_approval"
      }),
      expect.objectContaining({
        id: "outcome_999",
        status: "running"
      })
    ]);
  });
});
