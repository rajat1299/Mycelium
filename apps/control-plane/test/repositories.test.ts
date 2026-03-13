import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

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
    await repositories.plans.create(buildPlanInput());
    await repositories.runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
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
});
