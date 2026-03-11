import { z } from "zod";

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

export const EventEnvelopeSchema = z.object({
  type: EventTypeSchema,
  data: z.unknown()
});

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
