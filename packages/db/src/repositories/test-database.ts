import {
  messagingConnections,
  messagingConversationBindings,
  approvals,
  artifactLineageEdges,
  authProfiles,
  artifacts,
  outcomeMessages,
  outcomes,
  outcomePlans,
  outcomeRuns,
  planEdges,
  planNodes,
  remoteWorkers,
  scheduleFires,
  schedules,
  runAuditEvents,
  runCheckpoints,
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
  | typeof outcomeMessages
  | typeof outcomePlans
  | typeof planNodes
  | typeof planEdges
  | typeof remoteWorkers
  | typeof schedules
  | typeof scheduleFires
  | typeof messagingConnections
  | typeof messagingConversationBindings
  | typeof outcomeRuns
  | typeof runSteps
  | typeof runEvents
  | typeof runCheckpoints
  | typeof runAuditEvents
  | typeof artifacts
  | typeof approvals
  | typeof artifactLineageEdges
  | typeof workspaceCredentials
  | typeof authProfiles
  | typeof routerPolicies
  | typeof routerPolicyCandidates
  | typeof workspaceLeases;

export type RepositoryTestState = {
  outcomes: TableRecord[];
  outcomeMessages: TableRecord[];
  outcomePlans: TableRecord[];
  planNodes: TableRecord[];
  planEdges: TableRecord[];
  remoteWorkers: TableRecord[];
  schedules: TableRecord[];
  scheduleFires: TableRecord[];
  messagingConnections: TableRecord[];
  messagingConversationBindings: TableRecord[];
  outcomeRuns: TableRecord[];
  runSteps: TableRecord[];
  runEvents: TableRecord[];
  runCheckpoints: TableRecord[];
  runAuditEvents: TableRecord[];
  artifacts: TableRecord[];
  approvals: TableRecord[];
  artifactLineageEdges: TableRecord[];
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
  | { type: "isNull"; column: string }
  | {
      type: "existsRemoteWorkerSession";
      workerId: unknown;
      workerSessionId: unknown;
    }
  | {
      type: "notExistsMessagingBindingForConnection";
      connectionId: unknown;
    };

export function createRepositoryTestDatabase(options: TestDatabaseOptions = {}) {
  const inserted: Array<{ table: string; values: TableRecord | TableRecord[] }> = [];
  const failOnInsertTables = new Set(options.failOnInsertTables ?? []);
  const failOnUpdateTables = new Set(options.failOnUpdateTables ?? []);

  const state: RepositoryTestState = {
    outcomes: [],
    outcomeMessages: [],
    outcomePlans: [],
    planNodes: [],
    planEdges: [],
    remoteWorkers: [],
    schedules: [],
    scheduleFires: [],
    messagingConnections: [],
    messagingConversationBindings: [],
    outcomeRuns: [],
    runSteps: [],
    runEvents: [],
    runCheckpoints: [],
    runAuditEvents: [],
    artifacts: [],
    approvals: [],
    artifactLineageEdges: [],
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

    if (table === outcomeMessages) {
      return "outcome_messages";
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

    if (table === remoteWorkers) {
      return "remote_workers";
    }

    if (table === schedules) {
      return "schedules";
    }

    if (table === scheduleFires) {
      return "schedule_fires";
    }

    if (table === messagingConnections) {
      return "messaging_connections";
    }

    if (table === messagingConversationBindings) {
      return "messaging_conversation_bindings";
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

    if (table === runCheckpoints) {
      return "run_checkpoints";
    }

    if (table === runAuditEvents) {
      return "run_audit_events";
    }

    if (table === artifacts) {
      return "artifacts";
    }

    if (table === approvals) {
      return "approvals";
    }

    if (table === artifactLineageEdges) {
      return "artifact_lineage_edges";
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
      case "outcome_messages":
        return state.outcomeMessages;
      case "outcome_plans":
        return state.outcomePlans;
      case "plan_nodes":
        return state.planNodes;
      case "plan_edges":
        return state.planEdges;
      case "remote_workers":
        return state.remoteWorkers;
      case "schedules":
        return state.schedules;
      case "schedule_fires":
        return state.scheduleFires;
      case "messaging_connections":
        return state.messagingConnections;
      case "messaging_conversation_bindings":
        return state.messagingConversationBindings;
      case "outcome_runs":
        return state.outcomeRuns;
      case "run_steps":
        return state.runSteps;
      case "run_events":
        return state.runEvents;
      case "run_checkpoints":
        return state.runCheckpoints;
      case "run_audit_events":
        return state.runAuditEvents;
      case "artifacts":
        return state.artifacts;
      case "approvals":
        return state.approvals;
      case "artifact_lineage_edges":
        return state.artifactLineageEdges;
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

    if (
      chunks.length === 11 &&
      isStringChunkValue(chunks[0]?.value, "exists (select 1 from ") &&
      chunks[1] === remoteWorkers &&
      isStringChunkValue(chunks[2]?.value, " where ") &&
      chunks[3]?.name === "id" &&
      isStringChunkValue(chunks[4]?.value, " = ") &&
      isStringChunkValue(chunks[6]?.value, " and ") &&
      chunks[7]?.name === "session_id" &&
      isStringChunkValue(chunks[8]?.value, " = ") &&
      isStringChunkValue(chunks[10]?.value, ")")
    ) {
      return [
        {
          type: "existsRemoteWorkerSession",
          workerId: chunks[5],
          workerSessionId: chunks[9]
        }
      ];
    }

    if (
      chunks.length === 7 &&
      isStringChunkValue(chunks[0]?.value, "not exists (select 1 from ") &&
      chunks[1] === messagingConversationBindings &&
      isStringChunkValue(chunks[2]?.value, " where ") &&
      chunks[3]?.name === "connection_id" &&
      isStringChunkValue(chunks[4]?.value, " = ") &&
      isStringChunkValue(chunks[6]?.value, ")")
    ) {
      return [
        {
          type: "notExistsMessagingBindingForConnection",
          connectionId: chunks[5]
        }
      ];
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
    if (predicate.type === "existsRemoteWorkerSession") {
      return state.remoteWorkers.some(
        (worker) =>
          readColumnValue(worker, "id") === predicate.workerId &&
          readColumnValue(worker, "session_id") === predicate.workerSessionId
      );
    }

    if (predicate.type === "notExistsMessagingBindingForConnection") {
      return !state.messagingConversationBindings.some(
        (binding) =>
          readColumnValue(binding, "connection_id") === predicate.connectionId
      );
    }

    const value = readColumnValue(row, predicate.column);

    if (predicate.type === "eq") {
      if (value instanceof Date && predicate.value instanceof Date) {
        return value.getTime() === predicate.value.getTime();
      }

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

    if (tableName === "schedule_fires") {
      return row.id;
    }

    if (tableName === "messaging_connections") {
      return row.id;
    }

    if (tableName === "messaging_conversation_bindings") {
      return row.id;
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

  function hasOutcome(outcomeId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof outcomeId !== "string" || outcomeId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === outcomeId) ||
      state.outcomes.some((row) => row.id === outcomeId)
    );
  }

  function hasRun(runId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof runId !== "string" || runId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === runId) ||
      state.outcomeRuns.some((row) => row.id === runId)
    );
  }

  function hasStep(stepId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof stepId !== "string" || stepId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === stepId) ||
      state.runSteps.some((row) => row.id === stepId)
    );
  }

  function hasArtifact(artifactId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof artifactId !== "string" || artifactId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === artifactId) ||
      state.artifacts.some((row) => row.id === artifactId)
    );
  }

  function hasCheckpoint(checkpointId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof checkpointId !== "string" || checkpointId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === checkpointId) ||
      state.runCheckpoints.some((row) => row.id === checkpointId)
    );
  }

  function hasSchedule(scheduleId: unknown, pendingRows: TableRecord[] = []) {
    if (typeof scheduleId !== "string" || scheduleId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === scheduleId) ||
      state.schedules.some((row) => row.id === scheduleId)
    );
  }

  function hasMessagingConnection(
    connectionId: unknown,
    pendingRows: TableRecord[] = []
  ) {
    if (typeof connectionId !== "string" || connectionId.length === 0) {
      return false;
    }

    return (
      pendingRows.some((row) => row.id === connectionId) ||
      state.messagingConnections.some((row) => row.id === connectionId)
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

    if (tableName === "approvals") {
      if (!hasOutcome(row.outcomeId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "approvals",
          "approvals_outcome_id_fkey"
        );
      }

      if (!hasRun(row.runId, pendingRows)) {
        throw insertOrUpdateForeignKeyError("approvals", "approvals_run_id_fkey");
      }

      if (!hasStep(row.stepId, pendingRows)) {
        throw insertOrUpdateForeignKeyError("approvals", "approvals_step_id_fkey");
      }
    }

    if (tableName === "run_checkpoints") {
      if (!hasOutcome(row.outcomeId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "run_checkpoints",
          "run_checkpoints_outcome_id_fkey"
        );
      }

      if (!hasRun(row.runId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "run_checkpoints",
          "run_checkpoints_run_id_fkey"
        );
      }

      if (
        row.stepId !== null &&
        row.stepId !== undefined &&
        !hasStep(row.stepId, pendingRows)
      ) {
        throw insertOrUpdateForeignKeyError(
          "run_checkpoints",
          "run_checkpoints_step_id_fkey"
        );
      }
    }

    if (tableName === "run_audit_events") {
      if (!hasOutcome(row.outcomeId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "run_audit_events",
          "run_audit_events_outcome_id_fkey"
        );
      }

      if (!hasRun(row.runId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "run_audit_events",
          "run_audit_events_run_id_fkey"
        );
      }

      if (
        row.stepId !== null &&
        row.stepId !== undefined &&
        !hasStep(row.stepId, pendingRows)
      ) {
        throw insertOrUpdateForeignKeyError(
          "run_audit_events",
          "run_audit_events_step_id_fkey"
        );
      }

      if (
        row.checkpointId !== null &&
        row.checkpointId !== undefined &&
        !hasCheckpoint(row.checkpointId, pendingRows)
      ) {
        throw insertOrUpdateForeignKeyError(
          "run_audit_events",
          "run_audit_events_checkpoint_id_fkey"
        );
      }
    }

    if (tableName === "artifact_lineage_edges") {
      if (!hasRun(row.runId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "artifact_lineage_edges",
          "artifact_lineage_edges_run_id_fkey"
        );
      }

      if (!hasArtifact(row.parentArtifactId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "artifact_lineage_edges",
          "artifact_lineage_edges_parent_artifact_id_fkey"
        );
      }

      if (!hasArtifact(row.childArtifactId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "artifact_lineage_edges",
          "artifact_lineage_edges_child_artifact_id_fkey"
        );
      }

      if (!hasStep(row.parentStepId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "artifact_lineage_edges",
          "artifact_lineage_edges_parent_step_id_fkey"
        );
      }

      if (!hasStep(row.childStepId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "artifact_lineage_edges",
          "artifact_lineage_edges_child_step_id_fkey"
        );
      }
    }

    if (tableName === "schedule_fires") {
      if (!hasSchedule(row.scheduleId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "schedule_fires",
          "schedule_fires_schedule_id_fkey"
        );
      }

      if (
        row.outcomeId !== null &&
        row.outcomeId !== undefined &&
        !hasOutcome(row.outcomeId, pendingRows)
      ) {
        throw insertOrUpdateForeignKeyError(
          "schedule_fires",
          "schedule_fires_outcome_id_fkey"
        );
      }

      if (
        row.runId !== null &&
        row.runId !== undefined &&
        !hasRun(row.runId, pendingRows)
      ) {
        throw insertOrUpdateForeignKeyError(
          "schedule_fires",
          "schedule_fires_run_id_fkey"
        );
      }
    }

    if (tableName === "messaging_conversation_bindings") {
      if (!hasOutcome(row.outcomeId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "messaging_conversation_bindings",
          "messaging_conversation_bindings_outcome_id_fkey"
        );
      }

      if (!hasMessagingConnection(row.connectionId, pendingRows)) {
        throw insertOrUpdateForeignKeyError(
          "messaging_conversation_bindings",
          "messaging_conversation_bindings_connection_id_fkey"
        );
      }
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

    if (tableName === "artifacts") {
      for (const row of rows) {
        if (
          state.artifactLineageEdges.some(
            (edge) =>
              edge.parentArtifactId === row.id || edge.childArtifactId === row.id
          )
        ) {
          throw deleteForeignKeyError(
            "artifacts",
            "artifact_lineage_edges_parent_artifact_id_fkey",
            "artifact_lineage_edges"
          );
        }
      }
    }

    if (tableName === "run_steps") {
      for (const row of rows) {
        if (state.runCheckpoints.some((checkpoint) => checkpoint.stepId === row.id)) {
          throw deleteForeignKeyError(
            "run_steps",
            "run_checkpoints_step_id_fkey",
            "run_checkpoints"
          );
        }

        if (state.runAuditEvents.some((event) => event.stepId === row.id)) {
          throw deleteForeignKeyError(
            "run_steps",
            "run_audit_events_step_id_fkey",
            "run_audit_events"
          );
        }

        if (state.approvals.some((approval) => approval.stepId === row.id)) {
          throw deleteForeignKeyError(
            "run_steps",
            "approvals_step_id_fkey",
            "approvals"
          );
        }

        if (
          state.artifactLineageEdges.some(
            (edge) => edge.parentStepId === row.id || edge.childStepId === row.id
          )
        ) {
          throw deleteForeignKeyError(
            "run_steps",
            "artifact_lineage_edges_parent_step_id_fkey",
            "artifact_lineage_edges"
          );
        }
      }
    }

    if (tableName === "outcome_runs") {
      for (const row of rows) {
        if (state.runCheckpoints.some((checkpoint) => checkpoint.runId === row.id)) {
          throw deleteForeignKeyError(
            "outcome_runs",
            "run_checkpoints_run_id_fkey",
            "run_checkpoints"
          );
        }

        if (state.runAuditEvents.some((event) => event.runId === row.id)) {
          throw deleteForeignKeyError(
            "outcome_runs",
            "run_audit_events_run_id_fkey",
            "run_audit_events"
          );
        }

        if (state.approvals.some((approval) => approval.runId === row.id)) {
          throw deleteForeignKeyError(
            "outcome_runs",
            "approvals_run_id_fkey",
            "approvals"
          );
        }

        if (
          state.artifactLineageEdges.some((edge) => edge.runId === row.id)
        ) {
          throw deleteForeignKeyError(
            "outcome_runs",
            "artifact_lineage_edges_run_id_fkey",
            "artifact_lineage_edges"
          );
        }
      }
    }

    if (tableName === "outcomes") {
      for (const row of rows) {
        if (state.runCheckpoints.some((checkpoint) => checkpoint.outcomeId === row.id)) {
          throw deleteForeignKeyError(
            "outcomes",
            "run_checkpoints_outcome_id_fkey",
            "run_checkpoints"
          );
        }

        if (state.runAuditEvents.some((event) => event.outcomeId === row.id)) {
          throw deleteForeignKeyError(
            "outcomes",
            "run_audit_events_outcome_id_fkey",
            "run_audit_events"
          );
        }

        if (state.approvals.some((approval) => approval.outcomeId === row.id)) {
          throw deleteForeignKeyError(
            "outcomes",
            "approvals_outcome_id_fkey",
            "approvals"
          );
        }

        if (
          state.scheduleFires.some((scheduleFire) => scheduleFire.outcomeId === row.id)
        ) {
          throw deleteForeignKeyError(
            "outcomes",
            "schedule_fires_outcome_id_fkey",
            "schedule_fires"
          );
        }

        if (
          state.messagingConversationBindings.some(
            (binding) => binding.outcomeId === row.id
          )
        ) {
          throw deleteForeignKeyError(
            "outcomes",
            "messaging_conversation_bindings_outcome_id_fkey",
            "messaging_conversation_bindings"
          );
        }
      }
    }

    if (tableName === "run_checkpoints") {
      for (const row of rows) {
        if (state.runAuditEvents.some((event) => event.checkpointId === row.id)) {
          throw deleteForeignKeyError(
            "run_checkpoints",
            "run_audit_events_checkpoint_id_fkey",
            "run_audit_events"
          );
        }
      }
    }

    if (tableName === "schedules") {
      for (const row of rows) {
        if (state.scheduleFires.some((scheduleFire) => scheduleFire.scheduleId === row.id)) {
          throw deleteForeignKeyError(
            "schedules",
            "schedule_fires_schedule_id_fkey",
            "schedule_fires"
          );
        }
      }
    }

    if (tableName === "messaging_connections") {
      for (const row of rows) {
        if (
          state.messagingConversationBindings.some(
            (binding) => binding.connectionId === row.id
          )
        ) {
          throw deleteForeignKeyError(
            "messaging_connections",
            "messaging_conversation_bindings_connection_id_fkey",
            "messaging_conversation_bindings"
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
              tableName === "run_checkpoints" &&
              tableRows.some(
                (existing) =>
                  existing.runId === row.runId && existing.sequence === row.sequence
              )
            ) {
              throw new Error(
                'duplicate key value violates unique constraint "run_checkpoints_run_id_sequence_key"'
              );
            }

            if (
              tableName === "run_audit_events" &&
              tableRows.some(
                (existing) =>
                  existing.runId === row.runId && existing.sequence === row.sequence
              )
            ) {
              throw new Error(
                'duplicate key value violates unique constraint "run_audit_events_run_id_sequence_key"'
              );
            }

            if (
              tableName === "schedule_fires" &&
              tableRows.some(
                (existing) =>
                  existing.scheduleId === row.scheduleId &&
                  existing.occurrenceKey === row.occurrenceKey
              )
            ) {
              throw new Error(
                'duplicate key value violates unique constraint "schedule_fires_schedule_id_occurrence_key_key"'
              );
            }

            if (
              tableName === "messaging_connections" &&
              tableRows.some(
                (existing) =>
                  existing.workspaceId === row.workspaceId &&
                  existing.channel === row.channel
              )
            ) {
              throw new Error(
                'duplicate key value violates unique constraint "messaging_connections_workspace_id_channel_key"'
              );
            }

            if (
              tableName === "messaging_conversation_bindings" &&
              tableRows.some(
                (existing) =>
                  existing.workspaceId === row.workspaceId &&
                  existing.channel === row.channel &&
                  existing.externalWorkspaceId === row.externalWorkspaceId &&
                  existing.conversationId === row.conversationId &&
                  existing.threadKey === row.threadKey
              )
            ) {
              throw new Error(
                'duplicate key value violates unique constraint "messaging_conversation_bindings_workspace_id_channel_external_key"'
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
        state.outcomeMessages = snapshot.state.outcomeMessages;
        state.planNodes = snapshot.state.planNodes;
        state.planEdges = snapshot.state.planEdges;
        state.outcomeRuns = snapshot.state.outcomeRuns;
        state.runSteps = snapshot.state.runSteps;
        state.runEvents = snapshot.state.runEvents;
        state.runCheckpoints = snapshot.state.runCheckpoints;
        state.runAuditEvents = snapshot.state.runAuditEvents;
        state.artifacts = snapshot.state.artifacts;
        state.approvals = snapshot.state.approvals;
        state.artifactLineageEdges = snapshot.state.artifactLineageEdges;
        state.schedules = snapshot.state.schedules;
        state.scheduleFires = snapshot.state.scheduleFires;
        state.messagingConnections = snapshot.state.messagingConnections;
        state.messagingConversationBindings = snapshot.state.messagingConversationBindings;
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
