import { z } from "zod";
import { OutcomeSchema } from "./outcome";

export const EventTypeSchema = z.enum([
  "outcome.updated",
  "plan_node.updated",
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

export const OutcomeStreamEventSchema = z.discriminatedUnion("type", [
  OutcomeUpdatedEventSchema,
  MessageCreatedEventSchema
]);

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type MessageCreatedData = z.infer<typeof MessageCreatedDataSchema>;
export type OutcomeUpdatedEvent = z.infer<typeof OutcomeUpdatedEventSchema>;
export type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;
export type OutcomeStreamEvent = z.infer<typeof OutcomeStreamEventSchema>;
