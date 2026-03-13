import { describe, expect, it } from "vitest";
import { PlanRepository } from "./plans";
import { RunRepository } from "./runs";
import { createRepositoryTestDatabase } from "./test-database";

function buildExecutablePlanInput() {
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
        capability: "reasoning" as const,
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      },
      {
        id: "plan_outcome_123:draft-brief",
        kind: "task" as const,
        title: "Draft brief",
        capability: "coding" as const,
        instruction: "Write a concise execution brief using the analysis artifact.",
        template: "draft_brief",
        expectedArtifactPath: "artifacts/brief.md",
        expectedArtifactKind: "brief"
      },
      {
        id: "plan_outcome_123:draft-operator-summary",
        kind: "task" as const,
        title: "Draft operator summary",
        capability: "document" as const,
        instruction: "Write the operator-facing summary from the analysis artifact.",
        template: "draft_operator_summary",
        expectedArtifactPath: "artifacts/operator-summary.md",
        expectedArtifactKind: "operator_summary"
      },
      {
        id: "plan_outcome_123:synthesize-result",
        kind: "synthesis" as const,
        title: "Synthesize result",
        capability: "reasoning" as const,
        instruction: "Combine the brief and operator summary into the final result.",
        template: "synthesize_result",
        expectedArtifactPath: "artifacts/final-result.md",
        expectedArtifactKind: "result"
      }
    ],
    edges: [
      {
        id: "plan_outcome_123:edge-analyze-brief",
        from: "plan_outcome_123:analyze-outcome",
        to: "plan_outcome_123:draft-brief"
      },
      {
        id: "plan_outcome_123:edge-analyze-summary",
        from: "plan_outcome_123:analyze-outcome",
        to: "plan_outcome_123:draft-operator-summary"
      },
      {
        id: "plan_outcome_123:edge-brief-synthesize",
        from: "plan_outcome_123:draft-brief",
        to: "plan_outcome_123:synthesize-result"
      },
      {
        id: "plan_outcome_123:edge-summary-synthesize",
        from: "plan_outcome_123:draft-operator-summary",
        to: "plan_outcome_123:synthesize-result"
      }
    ]
  };
}

describe("RunRepository", () => {
  it("persists executable step metadata and lists only dependency-ready steps", async () => {
    const { db } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    await expect(runs.listReadySteps("run_123")).resolves.toEqual([
      expect.objectContaining({
        planNodeId: "plan_outcome_123:analyze-outcome",
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis",
        status: "ready"
      })
    ]);
  });

  it("updates run status and lists outcome runs in chronological order", async () => {
    const { db } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    await plans.create(buildExecutablePlanInput());

    await runs.createFromPlan({
      id: "run_001",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });
    await runs.createFromPlan({
      id: "run_002",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:10:00.000Z",
      updatedAt: "2026-03-12T00:10:00.000Z"
    });

    const updated = await runs.updateStatus({
      runId: "run_002",
      status: "running",
      updatedAt: "2026-03-12T00:12:00.000Z"
    });

    expect(updated).toEqual(
      expect.objectContaining({
        id: "run_002",
        status: "running",
        updatedAt: "2026-03-12T00:12:00.000Z"
      })
    );

    await expect(runs.listByOutcome("outcome_123")).resolves.toEqual([
      expect.objectContaining({ id: "run_001", status: "queued" }),
      expect.objectContaining({ id: "run_002", status: "running" })
    ]);
  });

  it("updates run and outcome lifecycle state atomically", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    state.outcomes.push({
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Ship the launch brief and summary.",
      source: "web",
      status: "queued",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z")
    });

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    await expect(
      runs.updateLifecycleStatus({
        runId: "run_123",
        outcomeId: "outcome_123",
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-12T00:06:00.000Z"
      })
    ).resolves.toEqual({
      run: expect.objectContaining({
        id: "run_123",
        status: "running",
        updatedAt: "2026-03-12T00:06:00.000Z"
      }),
      outcome: expect.objectContaining({
        id: "outcome_123",
        status: "running",
        updatedAt: "2026-03-12T00:06:00.000Z"
      })
    });
  });

  it("rolls back run lifecycle updates when the paired outcome update fails", async () => {
    const { db, state } = createRepositoryTestDatabase({
      failOnUpdateTables: ["outcomes"]
    });
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    state.outcomes.push({
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Ship the launch brief and summary.",
      source: "web",
      status: "queued",
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z")
    });

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    await expect(
      runs.updateLifecycleStatus({
        runId: "run_123",
        outcomeId: "outcome_123",
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-12T00:06:00.000Z"
      })
    ).rejects.toThrow("Simulated outcomes update failure.");

    expect(state.outcomeRuns).toEqual([
      expect.objectContaining({
        id: "run_123",
        status: "queued"
      })
    ]);
    expect(state.outcomes).toEqual([
      expect.objectContaining({
        id: "outcome_123",
        status: "queued"
      })
    ]);
  });

  it("rejects lifecycle updates when the run belongs to a different outcome", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    state.outcomes.push(
      {
        id: "outcome_123",
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Ship the launch brief and summary.",
        source: "web",
        status: "queued",
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
        updatedAt: new Date("2026-03-12T00:00:00.000Z")
      },
      {
        id: "outcome_456",
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft the operator escalation note.",
        source: "web",
        status: "queued",
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
        updatedAt: new Date("2026-03-12T00:00:00.000Z")
      }
    );

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    await expect(
      runs.updateLifecycleStatus({
        runId: "run_123",
        outcomeId: "outcome_456",
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-12T00:06:00.000Z"
      })
    ).rejects.toThrow("Run run_123 belongs to outcome_123, not outcome_456.");

    expect(state.outcomeRuns).toEqual([
      expect.objectContaining({
        id: "run_123",
        outcomeId: "outcome_123",
        status: "queued"
      })
    ]);
    expect(state.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "outcome_123",
          status: "queued"
        }),
        expect.objectContaining({
          id: "outcome_456",
          status: "queued"
        })
      ])
    );
  });

  it("marks a step completed and makes newly unblocked dependents ready", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    const steps = await runs.listSteps("run_123");
    const analyze = steps.find((step) => step.planNodeId.endsWith("analyze-outcome"));
    const brief = steps.find((step) => step.planNodeId.endsWith("draft-brief"));
    const summary = steps.find((step) => step.planNodeId.endsWith("draft-operator-summary"));

    if (!analyze || !brief || !summary) {
      throw new Error("Expected seeded fork/join steps.");
    }

    await runs.updateStepStatus({
      stepId: analyze.id,
      status: "completed",
      updatedAt: "2026-03-12T00:06:00.000Z"
    });

    const firstRelease = await runs.releaseReadyDependents({
      runId: "run_123",
      completedStepId: analyze.id,
      updatedAt: "2026-03-12T00:06:00.000Z"
    });

    expect(firstRelease.map((step) => step.planNodeId)).toEqual([
      "plan_outcome_123:draft-brief",
      "plan_outcome_123:draft-operator-summary"
    ]);

    await runs.updateStepStatus({
      stepId: brief.id,
      status: "completed",
      updatedAt: "2026-03-12T00:07:00.000Z"
    });

    await expect(
      runs.releaseReadyDependents({
        runId: "run_123",
        completedStepId: brief.id,
        updatedAt: "2026-03-12T00:07:00.000Z"
      })
    ).resolves.toEqual([]);

    await runs.updateStepStatus({
      stepId: summary.id,
      status: "completed",
      updatedAt: "2026-03-12T00:08:00.000Z"
    });

    await expect(
      runs.releaseReadyDependents({
        runId: "run_123",
        completedStepId: summary.id,
        updatedAt: "2026-03-12T00:08:00.000Z"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        planNodeId: "plan_outcome_123:synthesize-result",
        status: "ready"
      })
    ]);

    await runs.appendEvent({
      id: "event_log_123",
      runId: "run_123",
      eventType: "run.log",
      payload: {
        level: "info",
        message: "parallel workers complete"
      },
      createdAt: "2026-03-12T00:08:30.000Z"
    });

    expect(state.runEvents).toEqual([
      expect.objectContaining({
        id: "event_log_123",
        eventType: "run.log"
      })
    ]);
  });

  it("does not re-release a join step that another sibling already released", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const plans = new PlanRepository(db as never);
    const runs = new RunRepository(db as never);

    await plans.create(buildExecutablePlanInput());
    await runs.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      createdAt: "2026-03-12T00:05:00.000Z",
      updatedAt: "2026-03-12T00:05:00.000Z"
    });

    const steps = await runs.listSteps("run_123");
    const analyze = steps.find((step) => step.planNodeId.endsWith("analyze-outcome"));
    const brief = steps.find((step) => step.planNodeId.endsWith("draft-brief"));
    const summary = steps.find((step) =>
      step.planNodeId.endsWith("draft-operator-summary")
    );

    if (!analyze || !brief || !summary) {
      throw new Error("Expected seeded fork/join steps.");
    }

    await runs.updateStepStatus({
      stepId: analyze.id,
      status: "completed",
      updatedAt: "2026-03-12T00:06:00.000Z"
    });
    await runs.releaseReadyDependents({
      runId: "run_123",
      completedStepId: analyze.id,
      updatedAt: "2026-03-12T00:06:00.000Z"
    });

    await runs.updateStepStatus({
      stepId: brief.id,
      status: "completed",
      updatedAt: "2026-03-12T00:07:00.000Z"
    });
    await runs.updateStepStatus({
      stepId: summary.id,
      status: "completed",
      updatedAt: "2026-03-12T00:08:00.000Z"
    });

    const originalUpdate = (db as { update: typeof db.update }).update.bind(db);
    let simulatedConcurrentRelease = false;

    (db as { update: typeof db.update }).update = ((table) => {
      const updateBuilder = originalUpdate(table);

      return {
        set(values) {
          const setBuilder = updateBuilder.set(values);

          return {
            where(expression) {
              if (!simulatedConcurrentRelease) {
                simulatedConcurrentRelease = true;
                const synthesisRow = state.runSteps.find(
                  (row) =>
                    row.planNodeId === "plan_outcome_123:synthesize-result"
                );

                if (synthesisRow) {
                  synthesisRow.status = "ready";
                  synthesisRow.updatedAt = new Date("2026-03-12T00:07:59.000Z");
                }
              }

              return setBuilder.where(expression);
            }
          };
        }
      };
    }) as typeof db.update;

    await expect(
      runs.releaseReadyDependents({
        runId: "run_123",
        completedStepId: summary.id,
        updatedAt: "2026-03-12T00:08:00.000Z"
      })
    ).resolves.toEqual([]);

    await expect(runs.listSteps("run_123")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planNodeId: "plan_outcome_123:synthesize-result",
          status: "ready",
          updatedAt: "2026-03-12T00:07:59.000Z"
        })
      ])
    );
  });
});
