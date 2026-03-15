import { describe, expect, it } from "vitest";
import { ArtifactLineageRepository } from "./artifact-lineage";
import { createRepositoryTestDatabase } from "./test-database";

function seedLineageContext(
  state: ReturnType<typeof createRepositoryTestDatabase>["state"]
) {
  state.outcomeRuns.push(
    {
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "running",
      createdAt: new Date("2026-03-14T00:05:00.000Z"),
      updatedAt: new Date("2026-03-14T00:10:00.000Z")
    },
    {
      id: "run_999",
      outcomeId: "outcome_999",
      planId: "plan_outcome_999",
      status: "running",
      createdAt: new Date("2026-03-14T00:05:00.000Z"),
      updatedAt: new Date("2026-03-14T00:10:00.000Z")
    }
  );

  state.runSteps.push(
    {
      id: "step_parent",
      runId: "run_123",
      planNodeId: "node_parent",
      title: "Parent step",
      kind: "task",
      capability: "reasoning",
      status: "completed",
      position: 1,
      createdAt: new Date("2026-03-14T00:05:00.000Z"),
      updatedAt: new Date("2026-03-14T00:07:00.000Z")
    },
    {
      id: "step_child",
      runId: "run_123",
      planNodeId: "node_child",
      title: "Child step",
      kind: "synthesis",
      capability: "reasoning",
      status: "completed",
      position: 2,
      createdAt: new Date("2026-03-14T00:07:00.000Z"),
      updatedAt: new Date("2026-03-14T00:09:00.000Z")
    },
    {
      id: "step_other",
      runId: "run_999",
      planNodeId: "node_other",
      title: "Other step",
      kind: "task",
      capability: "coding",
      status: "completed",
      position: 1,
      createdAt: new Date("2026-03-14T00:05:00.000Z"),
      updatedAt: new Date("2026-03-14T00:09:00.000Z")
    }
  );

  state.artifacts.push(
    {
      id: "artifact_parent",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_parent",
      kind: "analysis",
      relativePath: "artifacts/analysis.md",
      size: 120,
      metadata: {},
      createdAt: new Date("2026-03-14T00:07:00.000Z")
    },
    {
      id: "artifact_child",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_child",
      kind: "result",
      relativePath: "artifacts/result.md",
      size: 200,
      metadata: {},
      createdAt: new Date("2026-03-14T00:09:00.000Z")
    },
    {
      id: "artifact_other",
      outcomeId: "outcome_999",
      runId: "run_999",
      stepId: "step_other",
      kind: "result",
      relativePath: "artifacts/other.md",
      size: 90,
      metadata: {},
      createdAt: new Date("2026-03-14T00:09:00.000Z")
    }
  );
}

describe("ArtifactLineageRepository", () => {
  it("stores lineage edges within a run and lists them by run and artifact", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedLineageContext(state);
    const repository = new ArtifactLineageRepository(db as never);

    await expect(
      repository.createMany([
        {
          id: "lineage_123",
          runId: "run_123",
          parentArtifactId: "artifact_parent",
          childArtifactId: "artifact_child",
          parentStepId: "step_parent",
          childStepId: "step_child",
          relation: "derived_from",
          createdAt: "2026-03-14T00:09:00.000Z"
        }
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        id: "lineage_123",
        runId: "run_123",
        relation: "derived_from"
      })
    ]);

    await expect(repository.listByRun("run_123")).resolves.toEqual([
      expect.objectContaining({
        id: "lineage_123",
        childArtifactId: "artifact_child"
      })
    ]);

    await expect(repository.listByArtifact("artifact_child")).resolves.toEqual([
      expect.objectContaining({
        id: "lineage_123",
        parentArtifactId: "artifact_parent"
      })
    ]);
  });

  it("rejects lineage edges that connect artifacts across different runs", async () => {
    const { db, state } = createRepositoryTestDatabase();
    seedLineageContext(state);
    const repository = new ArtifactLineageRepository(db as never);

    await expect(
      repository.createMany([
        {
          id: "lineage_bad",
          runId: "run_123",
          parentArtifactId: "artifact_parent",
          childArtifactId: "artifact_other",
          parentStepId: "step_parent",
          childStepId: "step_other",
          relation: "derived_from",
          createdAt: "2026-03-14T00:09:00.000Z"
        }
      ])
    ).rejects.toThrow(
      "Artifact-lineage edges must stay within run run_123."
    );
  });
});
