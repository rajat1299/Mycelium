import { describe, expect, it } from "vitest";
import { ArtifactRepository } from "./artifacts";
import { createRepositoryTestDatabase } from "./test-database";

describe("ArtifactRepository", () => {
  it("stores artifacts scoped to outcome, run, and step and lists them by run", async () => {
    const { db, state } = createRepositoryTestDatabase();
    state.outcomeRuns.push({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "running",
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:05:00.000Z")
    });
    state.runSteps.push({
      id: "step_123",
      runId: "run_123",
      planNodeId: "plan_outcome_123:draft-brief",
      title: "Draft brief",
      kind: "task",
      capability: "coding",
      status: "completed",
      position: 1,
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:07:00.000Z")
    });

    const repository = new ArtifactRepository(db as never);

    const artifact = await repository.create({
      id: "artifact_123",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      kind: "brief",
      relativePath: "artifacts/brief.md",
      size: 128,
      metadata: {
        contentType: "text/markdown"
      },
      createdAt: "2026-03-12T00:07:05.000Z"
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        id: "artifact_123",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_123",
        relativePath: "artifacts/brief.md",
        size: 128
      })
    );

    await expect(repository.listByRun("run_123")).resolves.toEqual([
      expect.objectContaining({
        id: "artifact_123",
        relativePath: "artifacts/brief.md"
      })
    ]);

    await expect(repository.listByOutcome("outcome_123")).resolves.toEqual([
      expect.objectContaining({
        id: "artifact_123",
        stepId: "step_123"
      })
    ]);
  });

  it("rejects artifacts whose run and step scopes do not match the outcome", async () => {
    const { db, state } = createRepositoryTestDatabase();
    state.outcomeRuns.push({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "running",
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:05:00.000Z")
    });
    state.outcomeRuns.push({
      id: "run_999",
      outcomeId: "outcome_999",
      planId: "plan_outcome_999",
      status: "running",
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:05:00.000Z")
    });
    state.runSteps.push({
      id: "step_999",
      runId: "run_999",
      planNodeId: "plan_outcome_999:draft-brief",
      title: "Draft brief",
      kind: "task",
      capability: "coding",
      status: "completed",
      position: 1,
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:07:00.000Z")
    });

    const repository = new ArtifactRepository(db as never);

    await expect(
      repository.create({
        id: "artifact_bad_outcome",
        outcomeId: "outcome_other",
        runId: "run_123",
        kind: "brief",
        relativePath: "artifacts/brief.md",
        size: 128,
        metadata: {},
        createdAt: "2026-03-12T00:07:05.000Z"
      })
    ).rejects.toThrow("Run run_123 belongs to outcome_123, not outcome_other.");

    await expect(
      repository.create({
        id: "artifact_bad_step",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_999",
        kind: "brief",
        relativePath: "artifacts/brief.md",
        size: 128,
        metadata: {},
        createdAt: "2026-03-12T00:07:05.000Z"
      })
    ).rejects.toThrow("Step step_999 belongs to run_999, not run_123.");
  });
});
