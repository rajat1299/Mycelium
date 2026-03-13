import { z } from "zod";
import { ArtifactSchema } from "./artifact";
import { OutcomeSchema } from "./outcome";
import { PlanSchema, RunSchema, RunStepSchema } from "./plan";

export const EventTypeSchema = z.enum([
  "outcome.updated",
  "plan.created",
  "plan_node.updated",
  "run.created",
  "run.step.updated",
  "run.updated",
  "run.log",
  "artifact.created",
  "approval.requested",
  "approval.resolved",
  "schedule.fired",
  "message.created"
]);

export const MessageCreatedDataSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string().datetime()
});

export const EventEnvelopeSchema = z.object({
  type: EventTypeSchema,
  data: z.unknown()
});

export const OutcomeUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("outcome.updated"),
  data: OutcomeSchema
});

export const MessageCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("message.created"),
  data: MessageCreatedDataSchema
});

export const PlanCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("plan.created"),
  data: PlanSchema
});

export const RunCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.created"),
  data: RunSchema
});

export const RunStepUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.step.updated"),
  data: RunStepSchema
});

export const RunUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.updated"),
  data: RunSchema
});

export const RunLogDataSchema = z.object({
  runId: z.string(),
  stepId: z.string().optional(),
  stepTitle: z.string().optional(),
  level: z.enum(["info", "error"]),
  message: z.string().min(1),
  createdAt: z.string().datetime()
});

export const RunLogEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.log"),
  data: RunLogDataSchema
});

export const RunLogListResponseSchema = z.object({
  logs: z.array(RunLogDataSchema)
});

export const ArtifactCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("artifact.created"),
  data: ArtifactSchema
});

export const OutcomeStreamEventSchema = z.discriminatedUnion("type", [
  OutcomeUpdatedEventSchema,
  MessageCreatedEventSchema,
  PlanCreatedEventSchema,
  RunCreatedEventSchema,
  RunStepUpdatedEventSchema,
  RunUpdatedEventSchema,
  RunLogEventSchema,
  ArtifactCreatedEventSchema
]);

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type MessageCreatedData = z.infer<typeof MessageCreatedDataSchema>;
export type OutcomeUpdatedEvent = z.infer<typeof OutcomeUpdatedEventSchema>;
export type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;
export type PlanCreatedEvent = z.infer<typeof PlanCreatedEventSchema>;
export type RunCreatedEvent = z.infer<typeof RunCreatedEventSchema>;
export type RunStepUpdatedEvent = z.infer<typeof RunStepUpdatedEventSchema>;
export type RunUpdatedEvent = z.infer<typeof RunUpdatedEventSchema>;
export type RunLogData = z.infer<typeof RunLogDataSchema>;
export type RunLogEvent = z.infer<typeof RunLogEventSchema>;
export type RunLogListResponse = z.infer<typeof RunLogListResponseSchema>;
export type ArtifactCreatedEvent = z.infer<typeof ArtifactCreatedEventSchema>;
export type OutcomeStreamEvent = z.infer<typeof OutcomeStreamEventSchema>;
