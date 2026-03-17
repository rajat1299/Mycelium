import { z } from "zod";
import { CheckpointDetailPayloadSchema, CheckpointKindSchema } from "./checkpoint";
import { RunStepSchema } from "./plan";
import {
  RemoteStepAssignmentSchema,
  RemoteStepLifecycleStatusSchema
} from "./remote-worker";

const DaemonEventBaseSchema = z.object({
  workerId: z.string().min(1),
  workerSessionId: z.string().min(1),
  runId: z.string().min(1),
  stepId: z.string().min(1),
  attemptId: z.string().min(1)
});

export const DaemonDispatchContextSchema = z.object({
  workspaceId: z.string().min(1),
  outcomeId: z.string().min(1),
  outcomePrompt: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  environment: z.record(z.string(), z.string()).optional()
});

export const DaemonDispatchStepCommandSchema = z.object({
  type: z.literal("dispatch_step"),
  commandId: z.string().min(1),
  issuedAt: z.string().datetime(),
  assignment: RemoteStepAssignmentSchema,
  context: DaemonDispatchContextSchema,
  step: RunStepSchema
});

export const DaemonCommandSchema = z.discriminatedUnion("type", [
  DaemonDispatchStepCommandSchema
]);

export const DaemonLogEventSchema = DaemonEventBaseSchema.extend({
  type: z.literal("log"),
  level: z.enum(["info", "error"]),
  message: z.string().min(1),
  createdAt: z.string().datetime()
});

export const DaemonArtifactUploadSchema = z.object({
  kind: z.string().min(1),
  relativePath: z.string().min(1),
  size: z.number().int().nonnegative(),
  contentBase64: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime()
});

export const DaemonArtifactEventSchema = DaemonEventBaseSchema.extend({
  type: z.literal("artifact"),
  artifact: DaemonArtifactUploadSchema
});

export const DaemonCheckpointUploadSchema = z.object({
  kind: CheckpointKindSchema,
  resumable: z.boolean(),
  createdAt: z.string().datetime(),
  payload: CheckpointDetailPayloadSchema
});

export const DaemonCheckpointEventSchema = DaemonEventBaseSchema.extend({
  type: z.literal("checkpoint"),
  checkpoint: DaemonCheckpointUploadSchema
});

export const DaemonStatusEventSchema = DaemonEventBaseSchema.extend({
  type: z.literal("status"),
  status: RemoteStepLifecycleStatusSchema,
  message: z.string().min(1).optional(),
  createdAt: z.string().datetime()
});

export const DaemonTerminalStatusSchema = z.enum([
  "completed",
  "failed",
  "cancelled",
  "interrupted"
]);

export const DaemonTerminalEventSchema = DaemonEventBaseSchema.extend({
  type: z.literal("terminal"),
  status: DaemonTerminalStatusSchema,
  exitCode: z.number().int(),
  stdoutSummary: z.string(),
  stderrSummary: z.string(),
  expectedArtifactCount: z.number().int().nonnegative(),
  finishedAt: z.string().datetime()
});

export const DaemonEventSchema = z.discriminatedUnion("type", [
  DaemonLogEventSchema,
  DaemonArtifactEventSchema,
  DaemonCheckpointEventSchema,
  DaemonStatusEventSchema,
  DaemonTerminalEventSchema
]);

export type DaemonDispatchContext = z.infer<typeof DaemonDispatchContextSchema>;
export type DaemonDispatchStepCommand = z.infer<
  typeof DaemonDispatchStepCommandSchema
>;
export type DaemonCommand = z.infer<typeof DaemonCommandSchema>;
export type DaemonLogEvent = z.infer<typeof DaemonLogEventSchema>;
export type DaemonArtifactUpload = z.infer<typeof DaemonArtifactUploadSchema>;
export type DaemonArtifactEvent = z.infer<typeof DaemonArtifactEventSchema>;
export type DaemonCheckpointUpload = z.infer<
  typeof DaemonCheckpointUploadSchema
>;
export type DaemonCheckpointEvent = z.infer<typeof DaemonCheckpointEventSchema>;
export type DaemonStatusEvent = z.infer<typeof DaemonStatusEventSchema>;
export type DaemonTerminalStatus = z.infer<typeof DaemonTerminalStatusSchema>;
export type DaemonTerminalEvent = z.infer<typeof DaemonTerminalEventSchema>;
export type DaemonEvent = z.infer<typeof DaemonEventSchema>;
