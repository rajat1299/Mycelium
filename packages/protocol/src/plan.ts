import { z } from "zod";

export const PlanStatusSchema = z.enum(["draft"]);

export const PlanNodeKindSchema = z.enum(["root", "task", "synthesis"]);

export const PlanNodeCapabilitySchema = z.enum([
  "reasoning",
  "research",
  "coding",
  "browser",
  "terminal",
  "api",
  "document",
  "fast_tasks",
  "fallback"
]);

export const PlanNodeSchema = z.object({
  id: z.string(),
  kind: PlanNodeKindSchema,
  title: z.string().min(1),
  capability: PlanNodeCapabilitySchema,
  position: z.number().int().nonnegative()
});

export const PlanEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string()
});

export const PlanSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  status: PlanStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  nodes: z.array(PlanNodeSchema),
  edges: z.array(PlanEdgeSchema)
});

export const CreateRunRequestSchema = z.object({
  planId: z.string().min(1)
});

export const RunStatusSchema = z.enum([
  "draft",
  "queued",
  "planning",
  "waiting_for_worker",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
]);

export const StepStatusSchema = z.enum([
  "pending",
  "ready",
  "claimed",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
]);

export const RunSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  planId: z.string(),
  status: RunStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RunStepSchema = z.object({
  id: z.string(),
  runId: z.string(),
  planNodeId: z.string(),
  title: z.string().min(1),
  kind: PlanNodeKindSchema,
  capability: PlanNodeCapabilitySchema,
  status: StepStatusSchema,
  position: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RunDetailSchema = RunSchema.extend({
  steps: z.array(RunStepSchema)
});

export type PlanStatus = z.infer<typeof PlanStatusSchema>;
export type PlanNodeKind = z.infer<typeof PlanNodeKindSchema>;
export type PlanNodeCapability = z.infer<typeof PlanNodeCapabilitySchema>;
export type PlanNode = z.infer<typeof PlanNodeSchema>;
export type PlanEdge = z.infer<typeof PlanEdgeSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
export type RunStep = z.infer<typeof RunStepSchema>;
export type RunDetail = z.infer<typeof RunDetailSchema>;
