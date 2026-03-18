import { z } from "zod";

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

export const OutcomeListResponseSchema = z.object({
  outcomes: z.array(OutcomeSchema)
});

export const CreateOutcomeMessageRequestSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1)
});

export type OutcomeStatus = z.infer<typeof OutcomeStatusSchema>;
export type OutcomeSource = z.infer<typeof OutcomeSourceSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type CreateOutcomeRequest = z.infer<typeof CreateOutcomeRequestSchema>;
export type OutcomeListResponse = z.infer<typeof OutcomeListResponseSchema>;
export type CreateOutcomeMessageRequest = z.infer<
  typeof CreateOutcomeMessageRequestSchema
>;
