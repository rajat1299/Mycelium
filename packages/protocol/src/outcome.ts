import { z } from "zod";
import { MessageCreatedDataSchema } from "./outcome-message";
import { PlanSchema, RunDetailSchema } from "./plan";

export const OutcomeStatusSchema = z.enum([
  "draft",
  "planning",
  "queued",
  "running",
  "blocked_on_approval",
  "scheduled",
  "completed",
  "failed",
  "cancelled"
]);

export const OutcomeSourceSchema = z.enum([
  "web",
  "schedule",
  "slack",
  "telegram"
]);

export const OutcomeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  prompt: z.string().min(1),
  source: OutcomeSourceSchema,
  status: OutcomeStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const CreateOutcomeRequestSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  prompt: z.string().min(1),
  source: OutcomeSourceSchema
});

export const StartOutcomeRequestSchema = CreateOutcomeRequestSchema;

export const ContinueOutcomeRequestSchema = z.object({
  content: z.string().min(1)
});

export const OutcomeListResponseSchema = z.object({
  outcomes: z.array(OutcomeSchema)
});

export const CreateOutcomeMessageRequestSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1)
});

export const OutcomeTurnResponseSchema = z.object({
  outcome: OutcomeSchema,
  triggerMessage: MessageCreatedDataSchema,
  plan: PlanSchema.nullable().optional(),
  run: RunDetailSchema.nullable().optional()
});

export type OutcomeStatus = z.infer<typeof OutcomeStatusSchema>;
export type OutcomeSource = z.infer<typeof OutcomeSourceSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type CreateOutcomeRequest = z.infer<typeof CreateOutcomeRequestSchema>;
export type StartOutcomeRequest = z.infer<typeof StartOutcomeRequestSchema>;
export type ContinueOutcomeRequest = z.infer<
  typeof ContinueOutcomeRequestSchema
>;
export type OutcomeListResponse = z.infer<typeof OutcomeListResponseSchema>;
export type CreateOutcomeMessageRequest = z.infer<
  typeof CreateOutcomeMessageRequestSchema
>;
export type OutcomeTurnResponse = z.infer<typeof OutcomeTurnResponseSchema>;
