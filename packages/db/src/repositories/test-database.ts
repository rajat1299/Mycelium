import {
  artifacts,
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  runEvents,
  runSteps,
  workspaceLeases
} from "../schema";

export type TableRecord = Record<string, unknown>;

type SupportedTable =
  | typeof outcomePlans
  | typeof planNodes
  | typeof planEdges
  | typeof outcomeRuns
  | typeof runSteps
  | typeof runEvents
  | typeof artifacts
  | typeof workspaceLeases;

export type RepositoryTestState = {
  outcomePlans: TableRecord[];
  planNodes: TableRecord[];
  planEdges: TableRecord[];
  outcomeRuns: TableRecord[];
  runSteps: TableRecord[];
  runEvents: TableRecord[];
  artifacts: TableRecord[];
  workspaceLeases: TableRecord[];
};

export type RepositoryTestDb = {
  insert: (table: SupportedTable) => {
    values: (values: TableRecord | TableRecord[]) => {
      returning: () => Promise<TableRecord[]>;
    };
  };
  select: () => {
    from: (table: SupportedTable) => Promise<TableRecord[]>;
  };
  update: (table: SupportedTable) => {
    set: (values: TableRecord) => {
      where: (expression: { queryChunks?: Array<{ name?: string; value?: unknown }> }) => {
        returning: () => Promise<TableRecord[]>;
      };
    };
  };
  transaction: <T>(callback: (transaction: RepositoryTestDb) => Promise<T>) => Promise<T>;
};

export type TestDatabaseOptions = {
  failOnInsertTables?: string[];
};

export function createRepositoryTestDatabase(options: TestDatabaseOptions = {}) {
  const inserted: Array<{ table: string; values: TableRecord | TableRecord[] }> = [];
  const failOnInsertTables = new Set(options.failOnInsertTables ?? []);

  const state: RepositoryTestState = {
    outcomePlans: [],
    planNodes: [],
    planEdges: [],
    outcomeRuns: [],
    runSteps: [],
    runEvents: [],
    artifacts: [],
    workspaceLeases: []
  };

  function getTableName(table: SupportedTable) {
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

    if (table === runEvents) {
      return "run_events";
    }

    if (table === artifacts) {
      return "artifacts";
    }

    return "workspace_leases";
  }

  function getRowsForTable(name: string): TableRecord[] {
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
      case "artifacts":
        return state.artifacts;
      case "workspace_leases":
        return state.workspaceLeases;
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

  function readColumnValue(row: TableRecord, column: string) {
    if (column in row) {
      return row[column];
    }

    const camelColumn = column.replace(/_([a-z])/g, (_match, letter: string) =>
      letter.toUpperCase()
    );

    return row[camelColumn];
  }

  function primaryKeyFor(tableName: string, row: TableRecord) {
    if (tableName === "workspace_leases") {
      return row.runId;
    }

    return row.id;
  }

  const db = {} as RepositoryTestDb;

  Object.assign(db, {
    insert(table: SupportedTable) {
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
            const primaryKey = primaryKeyFor(tableName, row);

            if (
              primaryKey !== undefined &&
              tableRows.some((existing) => primaryKeyFor(tableName, existing) === primaryKey)
            ) {
              throw new Error(
                `duplicate key value violates unique constraint "${tableName}_pkey"`
              );
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
        from(table: SupportedTable) {
          return Promise.resolve(getRowsForTable(getTableName(table)));
        }
      };
    },
    update(table: SupportedTable) {
      const tableName = getTableName(table);

      return {
        set(values: TableRecord) {
          return {
            where(expression: { queryChunks?: Array<{ name?: string; value?: unknown }> }) {
              const { column, value } = parseEqExpression(expression);
              const rows = getRowsForTable(tableName);
              const row = rows.find((entry) => readColumnValue(entry, column) === value);

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
    async transaction<T>(callback: (transaction: RepositoryTestDb) => Promise<T>) {
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
        state.artifacts = snapshot.state.artifacts;
        state.workspaceLeases = snapshot.state.workspaceLeases;
        throw error;
      }
    }
  });

  return { db, inserted, state };
}
