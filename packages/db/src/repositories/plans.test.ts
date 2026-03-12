import { describe, expect, it } from "vitest";
import { PlanRepository } from "./plans";
import { RunRepository } from "./runs";
import {
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  runEvents,
  runSteps
} from "../schema";

type TableRecord = Record<string, unknown>;

type TestDb = {
  insert: (
    table:
      | typeof outcomePlans
      | typeof planNodes
      | typeof planEdges
      | typeof outcomeRuns
      | typeof runSteps
      | typeof runEvents
  ) => {
    values: (values: TableRecord | TableRecord[]) => {
      returning: () => Promise<TableRecord[]>;
    };
  };
  select: () => {
    from: (
      table:
        | typeof outcomePlans
        | typeof planNodes
        | typeof planEdges
        | typeof outcomeRuns
        | typeof runSteps
        | typeof runEvents
    ) => Promise<TableRecord[]>;
  };
  update: (table: typeof runSteps) => {
    set: (values: TableRecord) => {
      where: (expression: { queryChunks?: Array<{ name?: string; value?: unknown }> }) => {
        returning: () => Promise<TableRecord[]>;
      };
    };
  };
  transaction: <T>(callback: (transaction: TestDb) => Promise<T>) => Promise<T>;
};

type TestDatabaseOptions = {
  failOnInsertTables?: string[];
};

function buildPlanInput(overrides: Partial<Record<string, unknown>> = {}) {
  const outcomeId = String(overrides.outcomeId ?? "outcome_123");
  const planId = String(overrides.id ?? `plan_${outcomeId}`);

  return {
    id: planId,
    outcomeId,
    status: "draft" as const,
    createdAt: "2026-03-11T00:00:00.000Z",
    updatedAt: "2026-03-11T00:00:00.000Z",
    nodes: [
      {
        id: `${planId}:analyze-outcome`,
        kind: "root" as const,
        title: "Analyze outcome",
        capability: "reasoning" as const
      },
      {
        id: `${planId}:execute-outcome`,
        kind: "task" as const,
        title: "Execute outcome",
        capability: "coding" as const
      }
    ],
    edges: [
      {
        id: `${planId}:edge-analyze-execute`,
        from: `${planId}:analyze-outcome`,
        to: `${planId}:execute-outcome`
      }
    ]
  };
}

function createRepositoryTestDatabase(options: TestDatabaseOptions = {}) {
  const inserted: Array<{ table: string; values: TableRecord | TableRecord[] }> = [];
  const failOnInsertTables = new Set(options.failOnInsertTables ?? []);

  const state = {
    outcomePlans: [] as TableRecord[],
    planNodes: [] as TableRecord[],
    planEdges: [] as TableRecord[],
    outcomeRuns: [] as TableRecord[],
    runSteps: [] as TableRecord[],
    runEvents: [] as TableRecord[]
  };

  function getTableName(
    table:
      | typeof outcomePlans
      | typeof planNodes
      | typeof planEdges
      | typeof outcomeRuns
      | typeof runSteps
      | typeof runEvents
  ) {
    if (table === outcomePlans) {
      return "outcome_plans";
    }

    if (table === planNodes) {
      return "plan_nodes";
    }

    if (table === planEdges) {
      return "plan_edges";
    }

    if (table === outcomeRuns) {
      return "outcome_runs";
    }

    if (table === runSteps) {
      return "run_steps";
    }

    return "run_events";
  }

  function getRowsForTable(name: string) {
    switch (name) {
      case "outcome_plans":
        return state.outcomePlans;
      case "plan_nodes":
        return state.planNodes;
      case "plan_edges":
        return state.planEdges;
      case "outcome_runs":
        return state.outcomeRuns;
      case "run_steps":
        return state.runSteps;
      case "run_events":
        return state.runEvents;
      default:
        return [];
    }
  }

  function parseEqExpression(expression: {
    queryChunks?: Array<{ name?: string; value?: unknown }>;
  }) {
    const column = expression.queryChunks?.[1]?.name;
    const value = expression.queryChunks?.[3]?.value;

    if (typeof column !== "string") {
      throw new Error("Expected an eq() expression with a column name.");
    }

    return { column, value };
  }

  const db = {} as TestDb;

  Object.assign(db, {
    insert(
      table:
        | typeof outcomePlans
        | typeof planNodes
        | typeof planEdges
        | typeof outcomeRuns
        | typeof runSteps
        | typeof runEvents
    ) {
      const tableName = getTableName(table);

      return {
        values(values: TableRecord | TableRecord[]) {
          if (failOnInsertTables.has(tableName)) {
            throw new Error(`Simulated ${tableName} insert failure.`);
          }

          inserted.push({ table: tableName, values });

          const rows = Array.isArray(values) ? values : [values];
          const tableRows = getRowsForTable(tableName);

          for (const row of rows) {
            if (tableRows.some((existing) => existing.id === row.id)) {
              throw new Error(`duplicate key value violates unique constraint "${tableName}_pkey"`);
            }

            if (
              tableName === "outcome_plans" &&
              tableRows.some((existing) => existing.outcomeId === row.outcomeId)
            ) {
              throw new Error(
                'duplicate key value violates unique constraint "outcome_plans_outcome_id_key"'
              );
            }
          }

          tableRows.push(...rows);

          return {
            async returning() {
              return rows;
            }
          };
        }
      };
    },
    select() {
      return {
        from(
          table:
            | typeof outcomePlans
            | typeof planNodes
            | typeof planEdges
            | typeof outcomeRuns
            | typeof runSteps
            | typeof runEvents
        ) {
          return Promise.resolve(getRowsForTable(getTableName(table)));
        }
      };
    },
    update(table: typeof runSteps) {
      const tableName = getTableName(table);

      return {
        set(values: TableRecord) {
          return {
            where(expression: { queryChunks?: Array<{ name?: string; value?: unknown }> }) {
              const { column, value } = parseEqExpression(expression);
              const rows = getRowsForTable(tableName);
              const row = rows.find((entry) => entry[column] === value);

              if (!row) {
                return {
                  async returning() {
                    return [];
                  }
                };
              }

              Object.assign(row, values);

              return {
                async returning() {
                  return [row];
                }
              };
            }
          };
        }
      };
    },
    async transaction<T>(callback: (transaction: typeof db) => Promise<T>) {
      const snapshot = structuredClone({
        inserted,
        state
      });

      try {
        return await callback(db);
      } catch (error) {
        inserted.length = 0;
        inserted.push(...snapshot.inserted);

        state.outcomePlans = snapshot.state.outcomePlans;
        state.planNodes = snapshot.state.planNodes;
        state.planEdges = snapshot.state.planEdges;
        state.outcomeRuns = snapshot.state.outcomeRuns;
        state.runSteps = snapshot.state.runSteps;
        state.runEvents = snapshot.state.runEvents;
        throw error;
      }
    }
  });

  return { db, inserted, state };
}

describe("plan and run repositories", () => {
  it("creates a plan with nodes and edges for an outcome", async () => {
    const { db, inserted } = createRepositoryTestDatabase();
    const repository = new PlanRepository(db as never);

    await repository.create(buildPlanInput({ id: "plan_123", outcomeId: "outcome_123" }));

    expect(inserted).toEqual([
      {
        table: "outcome_plans",
        values: {
          id: "plan_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: new Date("2026-03-11T00:00:00.000Z"),
          updatedAt: new Date("2026-03-11T00:00:00.000Z")
        }
      },
      {
        table: "plan_nodes",
        values: [
          {
            id: "plan_123:analyze-outcome",
            planId: "plan_123",
            kind: "root",
            title: "Analyze outcome",
            capability: "reasoning",
            position: 0
          },
          {
            id: "plan_123:execute-outcome",
            planId: "plan_123",
            kind: "task",
            title: "Execute outcome",
            capability: "coding",
            position: 1
          }
        ]
      },
      {
        table: "plan_edges",
        values: [
          {
            id: "plan_123:edge-analyze-execute",
            planId: "plan_123",
            from: "plan_123:analyze-outcome",
            to: "plan_123:execute-outcome"
          }
        ]
      }
    ]);
  });

  it("enforces one active plan per outcome", async () => {
    const { db } = createRepositoryTestDatabase();
    const repository = new PlanRepository(db as never);

    await repository.create(buildPlanInput({ id: "plan_123", outcomeId: "outcome_123" }));

    await expect(
      repository.create(buildPlanInput({ id: "plan_456", outcomeId: "outcome_123" }))
    ).rejects.toThrow("Plan already exists for outcome outcome_123.");
  });

  it("rolls back the parent plan when node insertion fails", async () => {
    const { db, state } = createRepositoryTestDatabase({
      failOnInsertTables: ["plan_nodes"]
    });
    const repository = new PlanRepository(db as never);

    await expect(
      repository.create(buildPlanInput({ id: "plan_rollback", outcomeId: "outcome_rollback" }))
    ).rejects.toThrow("Simulated plan_nodes insert failure.");

    expect(state.outcomePlans).toEqual([]);
    expect(state.planNodes).toEqual([]);
    expect(state.planEdges).toEqual([]);
  });

  it("rejects edges whose endpoints are not part of the same plan input", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new PlanRepository(db as never);
    const malformedPlan = buildPlanInput({
      id: "plan_invalid",
      outcomeId: "outcome_invalid"
    });

    malformedPlan.edges = [
      {
        id: "plan_invalid:edge-cross-plan",
        from: "plan_other:analyze-outcome",
        to: "plan_invalid:execute-outcome"
      }
    ];

    await expect(repository.create(malformedPlan)).rejects.toThrow(
      "Plan edges must reference nodes from the same plan input."
    );

    expect(state.outcomePlans).toEqual([]);
    expect(state.planNodes).toEqual([]);
    expect(state.planEdges).toEqual([]);
  });

  it("creates a run from a persisted plan, lists steps, updates step status, and records events", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const planRepository = new PlanRepository(db as never);
    const runRepository = new RunRepository(db as never);

    await planRepository.create(buildPlanInput({ id: "plan_123", outcomeId: "outcome_123" }));

    const run = await runRepository.createFromPlan({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_123",
      createdAt: "2026-03-11T00:05:00.000Z",
      updatedAt: "2026-03-11T00:05:00.000Z"
    });

    expect(run.status).toBe("queued");

    const steps = await runRepository.listSteps("run_123");

    expect(steps).toEqual([
      expect.objectContaining({
        runId: "run_123",
        planNodeId: "plan_123:analyze-outcome",
        title: "Analyze outcome",
        status: "ready"
      }),
      expect.objectContaining({
        runId: "run_123",
        planNodeId: "plan_123:execute-outcome",
        title: "Execute outcome",
        status: "pending"
      })
    ]);

    const updatedStep = await runRepository.updateStepStatus({
      stepId: String(steps[0].id),
      status: "running",
      updatedAt: "2026-03-11T00:06:00.000Z"
    });

    expect(updatedStep).toEqual(
      expect.objectContaining({
        id: steps[0].id,
        status: "running",
        updatedAt: "2026-03-11T00:06:00.000Z"
      })
    );

    await runRepository.appendEvent({
      id: "event_123",
      runId: "run_123",
      eventType: "run.step.updated",
      payload: {
        stepId: steps[0].id,
        status: "running"
      },
      createdAt: "2026-03-11T00:06:00.000Z"
    });

    expect(state.outcomeRuns).toHaveLength(1);
    expect(state.runSteps).toHaveLength(2);
    expect(state.runEvents).toEqual([
      {
        id: "event_123",
        runId: "run_123",
        eventType: "run.step.updated",
        payload: {
          stepId: steps[0].id,
          status: "running"
        },
        createdAt: new Date("2026-03-11T00:06:00.000Z")
      }
    ]);
  });

  it("returns the latest run for an outcome", async () => {
    const { db } = createRepositoryTestDatabase();
    const planRepository = new PlanRepository(db as never);
    const runRepository = new RunRepository(db as never);

    await planRepository.create(buildPlanInput({ id: "plan_123", outcomeId: "outcome_123" }));

    await runRepository.createFromPlan({
      id: "run_older",
      outcomeId: "outcome_123",
      planId: "plan_123",
      createdAt: "2026-03-11T00:05:00.000Z",
      updatedAt: "2026-03-11T00:05:00.000Z"
    });

    await runRepository.createFromPlan({
      id: "run_newer",
      outcomeId: "outcome_123",
      planId: "plan_123",
      createdAt: "2026-03-11T00:06:00.000Z",
      updatedAt: "2026-03-11T00:06:00.000Z"
    });

    await expect(runRepository.getLatestByOutcome("outcome_123")).resolves.toEqual(
      expect.objectContaining({
        id: "run_newer",
        outcomeId: "outcome_123"
      })
    );
  });

  it("rolls back the parent run when step insertion fails", async () => {
    const { db, state } = createRepositoryTestDatabase({
      failOnInsertTables: ["run_steps"]
    });
    const planRepository = new PlanRepository(db as never);
    const runRepository = new RunRepository(db as never);

    await planRepository.create(buildPlanInput({ id: "plan_123", outcomeId: "outcome_123" }));

    await expect(
      runRepository.createFromPlan({
        id: "run_rollback",
        outcomeId: "outcome_123",
        planId: "plan_123",
        createdAt: "2026-03-11T00:05:00.000Z",
        updatedAt: "2026-03-11T00:05:00.000Z"
      })
    ).rejects.toThrow("Simulated run_steps insert failure.");

    expect(state.outcomeRuns).toEqual([]);
    expect(state.runSteps).toEqual([]);
  });

  it("rejects a run when the plan belongs to a different outcome", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const planRepository = new PlanRepository(db as never);
    const runRepository = new RunRepository(db as never);

    await planRepository.create(buildPlanInput({ id: "plan_B", outcomeId: "outcome_B" }));

    await expect(
      runRepository.createFromPlan({
        id: "run_mismatch",
        outcomeId: "outcome_A",
        planId: "plan_B",
        createdAt: "2026-03-11T00:05:00.000Z",
        updatedAt: "2026-03-11T00:05:00.000Z"
      })
    ).rejects.toThrow("Plan plan_B belongs to outcome_B, not outcome_A.");

    expect(state.outcomeRuns).toEqual([]);
    expect(state.runSteps).toEqual([]);
  });
});
