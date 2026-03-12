import {
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

export const outcomeStatusEnum = pgEnum("outcome_status", outcomeStatusValues);
export const approvalStatusEnum = pgEnum("approval_status", approvalStatusValues);
export const planStatusEnum = pgEnum("plan_status", planStatusValues);
export const runStatusEnum = pgEnum("run_status", runStatusValues);
export const stepStatusEnum = pgEnum("step_status", stepStatusValues);

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
  outcomeId: text("outcome_id")
    .notNull()
    .references(() => outcomes.id),
  kind: text("kind").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
});

export const routerPolicies = pgTable("router_policies", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  policy: jsonb("policy").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
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
