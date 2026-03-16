import { z } from "zod";
import { CapabilityFamilySchema } from "./router";

export const RemoteExecutionTargetSchema = z.enum([
  "local_docker",
  "remote_worker"
]);

export const RemoteWorkerAvailabilitySchema = z.enum([
  "available",
  "busy",
  "draining",
  "offline"
]);

export const RemoteWorkerHealthStatusSchema = z.enum([
  "healthy",
  "degraded",
  "offline"
]);

export const RemoteWorkerCapabilitySummarySchema = z.object({
  capabilityFamilies: z.array(CapabilityFamilySchema).nonempty(),
  supportsArtifacts: z.boolean(),
  supportsCheckpoints: z.boolean(),
  supportsLogs: z.boolean()
});

export const RemoteWorkerHealthSchema = z.object({
  status: RemoteWorkerHealthStatusSchema,
  lastHeartbeatAt: z.string().datetime()
});

export const RemoteWorkerRegistrationSchema = z.object({
  workerId: z.string().min(1),
  workerSessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().min(1),
  daemonVersion: z.string().min(1),
  connectedAt: z.string().datetime(),
  capabilities: RemoteWorkerCapabilitySummarySchema
});

export const RemoteWorkerHeartbeatSchema = z.object({
  workerId: z.string().min(1),
  workerSessionId: z.string().min(1),
  sentAt: z.string().datetime(),
  health: RemoteWorkerHealthSchema
});

export const RemoteWorkerSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().min(1),
  daemonVersion: z.string().min(1),
  availability: RemoteWorkerAvailabilitySchema,
  capabilities: RemoteWorkerCapabilitySummarySchema,
  health: RemoteWorkerHealthSchema,
  connectedAt: z.string().datetime(),
  disconnectedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime()
});

export const RemoteStepAssignmentSchema = z.object({
  executionTarget: z.literal("remote_worker"),
  workerId: z.string().min(1),
  workerSessionId: z.string().min(1),
  attemptId: z.string().min(1),
  assignedAt: z.string().datetime()
});

export const RemoteStepLifecycleStatusSchema = z.enum([
  "assigned",
  "accepted",
  "running",
  "uploading_artifacts",
  "uploading_checkpoint",
  "completed",
  "failed",
  "cancelled",
  "interrupted"
]);

export const RemoteStepLifecycleEventDataSchema = z.object({
  runId: z.string().min(1),
  stepId: z.string().min(1),
  status: RemoteStepLifecycleStatusSchema,
  assignment: RemoteStepAssignmentSchema,
  message: z.string().min(1).nullable().optional(),
  occurredAt: z.string().datetime()
});

export type RemoteExecutionTarget = z.infer<typeof RemoteExecutionTargetSchema>;
export type RemoteWorkerAvailability = z.infer<
  typeof RemoteWorkerAvailabilitySchema
>;
export type RemoteWorkerHealthStatus = z.infer<
  typeof RemoteWorkerHealthStatusSchema
>;
export type RemoteWorkerCapabilitySummary = z.infer<
  typeof RemoteWorkerCapabilitySummarySchema
>;
export type RemoteWorkerHealth = z.infer<typeof RemoteWorkerHealthSchema>;
export type RemoteWorkerRegistration = z.infer<
  typeof RemoteWorkerRegistrationSchema
>;
export type RemoteWorkerHeartbeat = z.infer<typeof RemoteWorkerHeartbeatSchema>;
export type RemoteWorker = z.infer<typeof RemoteWorkerSchema>;
export type RemoteStepAssignment = z.infer<typeof RemoteStepAssignmentSchema>;
export type RemoteStepLifecycleStatus = z.infer<
  typeof RemoteStepLifecycleStatusSchema
>;
export type RemoteStepLifecycleEventData = z.infer<
  typeof RemoteStepLifecycleEventDataSchema
>;
