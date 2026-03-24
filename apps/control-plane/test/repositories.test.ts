import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";
import {
  createPlanForOutcomeTurn,
  createRunForExistingPlan
} from "./turn-test-helpers";

function buildPlanInput() {
  return {
    id: "plan_outcome_123",
    outcomeId: "outcome_123",
    status: "draft" as const,
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z",
    nodes: [
      {
        id: "plan_outcome_123:analyze-outcome",
        kind: "root" as const,
        title: "Analyze outcome",
        capability: "reasoning" as const
      }
    ],
    edges: []
  };
}

describe("in-memory repositories", () => {
  it("rejects mismatched run/outcome lifecycle updates", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.outcomes.create({
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Ship the launch brief and summary.",
      source: "web"
    });
    await repositories.outcomes.create({
      id: "outcome_456",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Draft the operator escalation note.",
      source: "web"
    });
    const plan = await createPlanForOutcomeTurn(repositories, buildPlanInput());
    await createRunForExistingPlan(repositories, {
      id: "run_123",
      outcomeId: "outcome_123",
      planId: plan.id,
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    await expect(
      repositories.runs.updateLifecycleStatus({
        runId: "run_123",
        outcomeId: "outcome_456",
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-12T00:06:00.000Z"
      })
    ).rejects.toThrow("Run run_123 belongs to outcome_123, not outcome_456.");

    await expect(repositories.runs.getById("run_123")).resolves.toEqual(
      expect.objectContaining({
        id: "run_123",
        outcomeId: "outcome_123",
        status: "queued"
      })
    );
    await expect(repositories.outcomes.getById("outcome_123")).resolves.toEqual(
      expect.objectContaining({
        id: "outcome_123",
        status: "draft"
      })
    );
    await expect(repositories.outcomes.getById("outcome_456")).resolves.toEqual(
      expect.objectContaining({
        id: "outcome_456",
        status: "draft"
      })
    );
  });

  it("threads approval requirements into run steps and stores approvals plus lineage edges", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.outcomes.create({
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Ship the launch brief and summary.",
      source: "web"
    });
    const plan = await createPlanForOutcomeTurn(repositories, {
      ...buildPlanInput(),
      nodes: [
        {
          id: "plan_outcome_123:review",
          kind: "task",
          title: "Review result",
          capability: "document",
          approvalRequirement: {
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before release.",
            instruction: "Approve to complete the run or reject to fail it."
          },
          expectedArtifactPath: "artifacts/final-result.md",
          expectedArtifactKind: "result"
        }
      ]
    });
    await createRunForExistingPlan(repositories, {
      id: "run_123",
      outcomeId: "outcome_123",
      planId: plan.id,
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    await expect(repositories.runs.listSteps("run_123")).resolves.toEqual([
      expect.objectContaining({
        planNodeId: "plan_outcome_123:review",
        approvalRequirement: {
          kind: "output_review_required",
          title: "Review final result",
          summary: "Inspect the final artifact before release.",
          instruction: "Approve to complete the run or reject to fail it."
        }
      })
    ]);

    await repositories.artifacts.create({
      id: "artifact_parent",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_run_123_plan_outcome_123:review",
      kind: "result",
      relativePath: "artifacts/final-result.md",
      size: 128,
      metadata: {},
      createdAt: "2026-03-12T00:06:00.000Z"
    });
    await repositories.artifacts.create({
      id: "artifact_child",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_run_123_plan_outcome_123:review",
      kind: "result",
      relativePath: "artifacts/final-result-v2.md",
      size: 256,
      metadata: {},
      createdAt: "2026-03-12T00:06:15.000Z"
    });

    await repositories.approvals.createPending({
      id: "approval_123",
      workspaceId: "ws_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_run_123_plan_outcome_123:review",
      kind: "output_review_required",
      title: "Review final result",
      summary: "Inspect the final artifact before release.",
      instruction: "Approve to complete the run or reject to fail it.",
      artifactIds: ["artifact_child"],
      requestedAt: "2026-03-12T00:06:30.000Z"
    });
    await repositories.artifactLineage.createMany([
      {
        id: "lineage_123",
        runId: "run_123",
        parentArtifactId: "artifact_parent",
        childArtifactId: "artifact_child",
        parentStepId: "step_run_123_plan_outcome_123:review",
        childStepId: "step_run_123_plan_outcome_123:review",
        relation: "derived_from",
        createdAt: "2026-03-12T00:06:45.000Z"
      }
    ]);

    await expect(
      repositories.approvals.listByWorkspace({
        workspaceId: "ws_123",
        status: "pending"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "approval_123",
        artifactIds: ["artifact_child"]
      })
    ]);
    await expect(repositories.artifactLineage.listByRun("run_123")).resolves.toEqual([
      expect.objectContaining({
        id: "lineage_123",
        runId: "run_123"
      })
    ]);
  });
});
