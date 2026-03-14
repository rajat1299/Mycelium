import {
  authProfiles,
  artifacts,
  outcomes,
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  runEvents,
  runSteps,
  routerPolicies,
  routerPolicyCandidates,
  workspaceCredentials,
  workspaceLeases
} from "../schema";

export type TableRecord = Record<string, unknown>;

type SupportedTable =
  | typeof outcomes
  | typeof outcomePlans
  | typeof planNodes
  | typeof planEdges
  | typeof outcomeRuns
  | typeof runSteps
  | typeof runEvents
  | typeof artifacts
  | typeof workspaceCredentials
  | typeof authProfiles
  | typeof routerPolicies
  | typeof routerPolicyCandidates
  | typeof workspaceLeases;

export type RepositoryTestState = {
  outcomes: TableRecord[];
  outcomePlans: TableRecord[];
  planNodes: TableRecord[];
  planEdges: TableRecord[];
  outcomeRuns: TableRecord[];
  runSteps: TableRecord[];
  runEvents: TableRecord[];
  artifacts: TableRecord[];
  workspaceCredentials: TableRecord[];
  authProfiles: TableRecord[];
  routerPolicies: TableRecord[];
  routerPolicyCandidates: TableRecord[];
  workspaceLeases: TableRecord[];
};

export type RepositoryTestDb = {
  insert: (table: SupportedTable) => {
    values: (values: TableRecord | TableRecord[]) => {
      returning: () => Promise<TableRecord[]>;
      onConflictDoNothing: () => Promise<void>;
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
  delete: (table: SupportedTable) => {
    where: (expression: { queryChunks?: Array<{ name?: string; value?: unknown }> }) => {
      returning: () => Promise<TableRecord[]>;
    };
  };
  transaction: <T>(callback: (transaction: RepositoryTestDb) => Promise<T>) => Promise<T>;
};

export type TestDatabaseOptions = {
  failOnInsertTables?: string[];
  failOnUpdateTables?: string[];
};

type QueryChunk = {
  name?: string;
  value?: unknown;
  queryChunks?: QueryChunk[];
};

type ParsedPredicate =
  | { type: "eq"; column: string; value: unknown }
  | { type: "isNull"; column: string };

export function createRepositoryTestDatabase(options: TestDatabaseOptions = {}) {
  const inserted: Array<{ table: string; values: TableRecord | TableRecord[] }> = [];
  const failOnInsertTables = new Set(options.failOnInsertTables ?? []);
  const failOnUpdateTables = new Set(options.failOnUpdateTables ?? []);

  const state: RepositoryTestState = {
    outcomes: [],
    outcomePlans: [],
    planNodes: [],
    planEdges: [],
    outcomeRuns: [],
    runSteps: [],
    runEvents: [],
    artifacts: [],
    workspaceCredentials: [],
    authProfiles: [],
    routerPolicies: [],
    routerPolicyCandidates: [],
    workspaceLeases: []
  };

  function getTableName(table: SupportedTable) {
    if (table === outcomes) {
      return "outcomes";
    }

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

    if (table === workspaceCredentials) {
      return "workspace_credentials";
    }

    if (table === authProfiles) {
      return "auth_profiles";
    }

    if (table === routerPolicies) {
      return "router_policies";
    }

    if (table === routerPolicyCandidates) {
      return "router_policy_candidates";
    }

    return "workspace_leases";
  }

  function getRowsForTable(name: string): TableRecord[] {
    switch (name) {
      case "outcomes":
        return state.outcomes;
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
      case "workspace_credentials":
        return state.workspaceCredentials;
      case "auth_profiles":
        return state.authProfiles;
      case "router_policies":
        return state.routerPolicies;
      case "router_policy_candidates":
        return state.routerPolicyCandidates;
      case "workspace_leases":
        return state.workspaceLeases;
      default:
        return [];
    }
  }

  function isStringChunkValue(
    value: unknown,
    expected: string
  ): value is string[] {
    return Array.isArray(value) && value.includes(expected);
  }

  function parsePredicates(expression: { queryChunks?: QueryChunk[] }): ParsedPredicate[] {
    const chunks = expression.queryChunks ?? [];

    if (
      chunks.length === 3 &&
      chunks[1]?.queryChunks &&
      isStringChunkValue(chunks[0]?.value, "(") &&
      isStringChunkValue(chunks[2]?.value, ")")
    ) {
      return parsePredicates(chunks[1]);
    }

    if (
      chunks.length === 3 &&
      chunks[0]?.queryChunks &&
      chunks[2]?.queryChunks &&
      isStringChunkValue(chunks[1]?.value, " and ")
    ) {
      return [...parsePredicates(chunks[0]), ...parsePredicates(chunks[2])];
    }

    const column = chunks[1]?.name;

    if (typeof column !== "string") {
      throw new Error("Expected a supported predicate with a column name.");
    }

    if (chunks.length >= 4 && "value" in (chunks[3] ?? {})) {
      return [
        {
          type: "eq",
          column,
          value: chunks[3]?.value
        }
      ];
    }

    if (chunks.length >= 3 && isStringChunkValue(chunks[2]?.value, " is null")) {
      return [{ type: "isNull", column }];
    }

    throw new Error("Expected an eq(), isNull(), or and() predicate.");
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

  function rowMatchesPredicate(row: TableRecord, predicate: ParsedPredicate) {
    const value = readColumnValue(row, predicate.column);

    if (predicate.type === "eq") {
      return value === predicate.value;
    }

    return value === null || value === undefined;
  }

  function primaryKeyFor(tableName: string, row: TableRecord) {
    if (tableName === "workspace_leases") {
      return row.runId;
    }

    if (tableName === "router_policies") {
      return row.workspaceId;
    }

    return row.id;
  }

  function insertOrUpdateForeignKeyError(tableName: string, constraint: string) {
    return new Error(
      `insert or update on table "${tableName}" violates foreign key constraint "${constraint}"`
    );
  }

  function deleteForeignKeyError(
    tableName: string,
    constraint: string,
    referencingTable: string
  ) {
    return new Error(
      `update or delete on table "${tableName}" violates foreign key constraint "${constraint}" on table "${referencingTable}"`
    );
  }

  function hasWorkspaceCredential(
    credentialId: unknown,
    pendingRows: TableRecord[] = []
  ) {
    if (typeof credentialId !== "string" || credentialId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === credentialId) ||
      state.workspaceCredentials.some((row) => row.id === credentialId)
    );
  }

  function hasAuthProfile(authProfileId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof authProfileId !== "string" || authProfileId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === authProfileId) ||
      state.authProfiles.some((row) => row.id === authProfileId)
    );
  }

  function assertRoutingForeignKeysForRow(
    tableName: string,
    row: TableRecord,
    pendingRows: TableRecord[] = []
  ) {
    if (
      tableName === "auth_profiles" &&
      !hasWorkspaceCredential(row.credentialId, pendingRows)
    ) {
      throw insertOrUpdateForeignKeyError(
        "auth_profiles",
        "auth_profiles_credential_id_fkey"
      );
    }

    if (
      tableName === "router_policy_candidates" &&
      row.authProfileId !== null &&
      row.authProfileId !== undefined &&
      !hasAuthProfile(row.authProfileId, pendingRows)
    ) {
      throw insertOrUpdateForeignKeyError(
        "router_policy_candidates",
        "router_policy_candidates_auth_profile_id_fkey"
      );
    }
  }

  function assertDeleteAllowed(tableName: string, rows: TableRecord[]) {
    if (tableName === "workspace_credentials") {
      for (const row of rows) {
        if (
          state.authProfiles.some((profile) => profile.credentialId === row.id)
        ) {
          throw deleteForeignKeyError(
            "workspace_credentials",
            "auth_profiles_credential_id_fkey",
            "auth_profiles"
          );
        }
      }
    }

    if (tableName === "auth_profiles") {
      for (const row of rows) {
        if (
          state.routerPolicyCandidates.some(
            (candidate) => candidate.authProfileId === row.id
          )
        ) {
          throw deleteForeignKeyError(
            "auth_profiles",
            "router_policy_candidates_auth_profile_id_fkey",
            "router_policy_candidates"
          );
        }
      }
    }
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

          for (const row of rows) {
            assertRoutingForeignKeysForRow(tableName, row, rows);
          }

          tableRows.push(...rows);

          return {
            async onConflictDoNothing() {
              return;
            },
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
              const predicates = parsePredicates(expression);
              const rows = getRowsForTable(tableName);
              const row = rows.find((entry) =>
                predicates.every((predicate) => rowMatchesPredicate(entry, predicate))
              );

              if (!row) {
                return {
                  async returning() {
                    return [];
                  }
                };
              }

              if (failOnUpdateTables.has(tableName)) {
                throw new Error(`Simulated ${tableName} update failure.`);
              }

              const nextRow = {
                ...row,
                ...values
              };

              assertRoutingForeignKeysForRow(tableName, nextRow);
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
    delete(table: SupportedTable) {
      const tableName = getTableName(table);

      return {
        where(expression: { queryChunks?: Array<{ name?: string; value?: unknown }> }) {
          const predicates = parsePredicates(expression);
          const rows = getRowsForTable(tableName);
          const removed = rows.filter((entry) =>
            predicates.every((predicate) => rowMatchesPredicate(entry, predicate))
          );
          const remaining = rows.filter(
            (entry) =>
              !predicates.every((predicate) => rowMatchesPredicate(entry, predicate))
          );

          assertDeleteAllowed(tableName, removed);
          rows.length = 0;
          rows.push(...remaining);

          return {
            async returning() {
              return removed;
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
        state.outcomes = snapshot.state.outcomes;
        state.planNodes = snapshot.state.planNodes;
        state.planEdges = snapshot.state.planEdges;
        state.outcomeRuns = snapshot.state.outcomeRuns;
        state.runSteps = snapshot.state.runSteps;
        state.runEvents = snapshot.state.runEvents;
        state.artifacts = snapshot.state.artifacts;
        state.workspaceCredentials = snapshot.state.workspaceCredentials;
        state.authProfiles = snapshot.state.authProfiles;
        state.routerPolicies = snapshot.state.routerPolicies;
        state.routerPolicyCandidates = snapshot.state.routerPolicyCandidates;
        state.workspaceLeases = snapshot.state.workspaceLeases;
        throw error;
      }
    }
  });

  return { db, inserted, state };
}
