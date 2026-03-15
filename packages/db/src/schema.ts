import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";

export const outcomeStatusValues = [
  "draft",
  "planning",
  "queued",
  "running",
  "blocked_on_approval",
  "scheduled",
  "completed",
  "failed",
  "cancelled"
] as const;

export const approvalStatusValues = [
  "pending",
  "resolved",
  "cancelled"
] as const;

export const approvalResolutionValues = [
  "approved",
  "rejected",
  "cancelled"
] as const;

export const planStatusValues = ["draft"] as const;

export const runStatusValues = [
  "draft",
  "queued",
  "planning",
  "waiting_for_worker",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
] as const;

export const stepStatusValues = [
  "pending",
  "ready",
  "claimed",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
] as const;

export const workspaceCredentialStatusValues = [
  "active",
  "disabled",
  "error"
] as const;

export const authProfileStatusValues = [
  "active",
  "disabled",
  "cooling_down"
] as const;

export const routeStatusValues = [
  "resolved",
  "unresolved",
  "invalid_policy",
  "missing_auth"
] as const;

export const routeReasonValues = [
  "no_policy_candidates",
  "policy_workspace_mismatch",
  "provider_not_found",
  "model_not_found",
  "capability_unsupported",
  "auth_profile_not_found",
  "auth_profile_provider_mismatch",
  "no_active_auth_profile"
] as const;

export const artifactLineageRelationValues = ["derived_from"] as const;

export const outcomeStatusEnum = pgEnum("outcome_status", outcomeStatusValues);
export const approvalStatusEnum = pgEnum("approval_status", approvalStatusValues);
export const approvalResolutionEnum = pgEnum(
  "approval_resolution",
  approvalResolutionValues
);
export const planStatusEnum = pgEnum("plan_status", planStatusValues);
export const runStatusEnum = pgEnum("run_status", runStatusValues);
export const stepStatusEnum = pgEnum("step_status", stepStatusValues);
export const workspaceCredentialStatusEnum = pgEnum(
  "workspace_credential_status",
  workspaceCredentialStatusValues
);
export const authProfileStatusEnum = pgEnum(
  "auth_profile_status",
  authProfileStatusValues
);
export const routeStatusEnum = pgEnum("route_status", routeStatusValues);
export const routeReasonEnum = pgEnum("route_reason", routeReasonValues);
export const artifactLineageRelationEnum = pgEnum(
  "artifact_lineage_relation",
  artifactLineageRelationValues
);

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const outcomes = pgTable("outcomes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  prompt: text("prompt").notNull(),
  source: text("source").notNull(),
  status: outcomeStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const outcomeMessages = pgTable("outcome_messages", {
  id: text("id").primaryKey(),
  outcomeId: text("outcome_id")
    .notNull()
    .references(() => outcomes.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(),
  outcomeId: text("outcome_id")
    .notNull()
    .references(() => outcomes.id),
  runId: text("run_id").references(() => outcomeRuns.id),
  stepId: text("step_id").references(() => runSteps.id),
  kind: text("kind").notNull(),
  relativePath: text("relative_path").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  outcomeId: text("outcome_id")
    .notNull()
    .references(() => outcomes.id),
  runId: text("run_id")
    .notNull()
    .references(() => outcomeRuns.id),
  stepId: text("step_id")
    .notNull()
    .references(() => runSteps.id),
  status: approvalStatusEnum("status").notNull().default("pending"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  instruction: text("instruction"),
  artifactIds: jsonb("artifact_ids").notNull().default([]),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: approvalResolutionEnum("resolution"),
  resolutionNote: text("resolution_note")
});

export const artifactLineageEdges = pgTable("artifact_lineage_edges", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => outcomeRuns.id),
  parentArtifactId: text("parent_artifact_id")
    .notNull()
    .references(() => artifacts.id),
  childArtifactId: text("child_artifact_id")
    .notNull()
    .references(() => artifacts.id),
  parentStepId: text("parent_step_id")
    .notNull()
    .references(() => runSteps.id),
  childStepId: text("child_step_id")
    .notNull()
    .references(() => runSteps.id),
  relation: artifactLineageRelationEnum("relation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaceCredentials = pgTable("workspace_credentials", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  providerId: text("provider_id").notNull(),
  label: text("label").notNull(),
  secretCiphertext: text("secret_ciphertext").notNull(),
  secretNonce: text("secret_nonce").notNull(),
  secretVersion: integer("secret_version").notNull(),
  status: workspaceCredentialStatusEnum("status").notNull().default("active"),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const authProfiles = pgTable("auth_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  providerId: text("provider_id").notNull(),
  label: text("label").notNull(),
  credentialId: text("credential_id")
    .notNull()
    .references(() => workspaceCredentials.id),
  status: authProfileStatusEnum("status").notNull().default("active"),
  priority: integer("priority").notNull(),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const routerPolicies = pgTable("router_policies", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .notNull()
    .references(() => workspaces.id),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const routerPolicyCandidates = pgTable("router_policy_candidates", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => routerPolicies.workspaceId),
  capability: text("capability").notNull(),
  priority: integer("priority").notNull(),
  providerId: text("provider_id").notNull(),
  modelId: text("model_id").notNull(),
  authProfileId: text("auth_profile_id").references(() => authProfiles.id),
  enabled: boolean("enabled").notNull().default(true)
});

export const outcomePlans = pgTable("outcome_plans", {
  id: text("id").primaryKey(),
  outcomeId: text("outcome_id")
    .notNull()
    .references(() => outcomes.id)
    .unique(),
  status: planStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const planNodes = pgTable("plan_nodes", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => outcomePlans.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  capability: text("capability").notNull(),
  instruction: text("instruction"),
  template: text("template"),
  expectedArtifactPath: text("expected_artifact_path"),
  expectedArtifactKind: text("expected_artifact_kind"),
  position: integer("position").notNull()
});

export const planEdges = pgTable("plan_edges", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => outcomePlans.id),
  from: text("from_node_id")
    .notNull()
    .references(() => planNodes.id),
  to: text("to_node_id")
    .notNull()
    .references(() => planNodes.id)
});

export const outcomeRuns = pgTable("outcome_runs", {
  id: text("id").primaryKey(),
  outcomeId: text("outcome_id")
    .notNull()
    .references(() => outcomes.id),
  planId: text("plan_id")
    .notNull()
    .references(() => outcomePlans.id),
  status: runStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const runSteps = pgTable("run_steps", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => outcomeRuns.id),
  planNodeId: text("plan_node_id")
    .notNull()
    .references(() => planNodes.id),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  capability: text("capability").notNull(),
  instruction: text("instruction"),
  template: text("template"),
  expectedArtifactPath: text("expected_artifact_path"),
  expectedArtifactKind: text("expected_artifact_kind"),
  routeProviderId: text("route_provider_id"),
  routeModelId: text("route_model_id"),
  routeAuthProfileId: text("route_auth_profile_id"),
  routePolicyVersion: integer("route_policy_version"),
  routeStatus: routeStatusEnum("route_status"),
  routeReason: routeReasonEnum("route_reason"),
  routeResolvedAt: timestamp("route_resolved_at", { withTimezone: true }),
  status: stepStatusEnum("status").notNull().default("pending"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const runEvents = pgTable("run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => outcomeRuns.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaceLeases = pgTable("workspace_leases", {
  runId: text("run_id")
    .primaryKey()
    .references(() => outcomeRuns.id),
  rootPath: text("root_path").notNull(),
  inputPath: text("input_path").notNull(),
  artifactsPath: text("artifacts_path").notNull(),
  logsPath: text("logs_path").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp("released_at", { withTimezone: true })
});
