import {
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

export const outcomeStatusEnum = pgEnum("outcome_status", outcomeStatusValues);
export const approvalStatusEnum = pgEnum("approval_status", approvalStatusValues);

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
  kind: text("kind").notNull(),
  path: text("path"),
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
