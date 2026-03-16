import { z } from "zod";

export const AuditCategorySchema = z.enum([
  "lifecycle",
  "checkpoint",
  "approval",
  "resume",
  "artifact"
]);

export const AuditActorTypeSchema = z.enum(["system", "operator"]);

export const AuditPayloadSchema = z.record(z.string(), z.unknown());

export const AuditEventSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  outcomeId: z.string(),
  runId: z.string(),
  stepId: z.string().nullable(),
  checkpointId: z.string().nullable(),
  sequence: z.number().int().nonnegative(),
  category: AuditCategorySchema,
  eventType: z.string().min(1),
  actorType: AuditActorTypeSchema,
  summary: z.string().min(1),
  payload: AuditPayloadSchema,
  createdAt: z.string().datetime()
});

export const AuditListResponseSchema = z.object({
  events: z.array(AuditEventSchema)
});

export type AuditCategory = z.infer<typeof AuditCategorySchema>;
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;
export type AuditPayload = z.infer<typeof AuditPayloadSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;
