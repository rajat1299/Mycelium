import { z } from "zod";
import { RunSchema, RunStatusSchema, StepStatusSchema } from "./plan";

export const CheckpointKindSchema = z.enum([
  "run_started",
  "step_completed",
  "step_blocked_on_approval",
  "approval_resolved",
  "run_completed",
  "run_failed"
]);

export const CheckpointPayloadRunSummarySchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  workspaceId: z.string(),
  status: RunStatusSchema
});

export const CheckpointPayloadStepSummarySchema = z.object({
  stepId: z.string(),
  title: z.string().min(1),
  status: StepStatusSchema
});

export const CheckpointWorkspacePathsSchema = z.object({
  inputDir: z.string().min(1),
  logsDir: z.string().min(1),
  artifactsDir: z.string().min(1)
});

export const CheckpointDetailPayloadSchema = z.object({
  version: z.literal(1),
  run: CheckpointPayloadRunSummarySchema,
  steps: z.array(CheckpointPayloadStepSummarySchema),
  readyStepIds: z.array(z.string()),
  blockedStepIds: z.array(z.string()),
  workspacePaths: CheckpointWorkspacePathsSchema,
  artifactIds: z.array(z.string()),
  latestAuditSequence: z.number().int().nonnegative()
});

export const CheckpointSummarySchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    outcomeId: z.string(),
    runId: z.string(),
    sequence: z.number().int().nonnegative(),
    kind: CheckpointKindSchema,
    resumable: z.boolean(),
    storeKey: z.string().min(1),
    checksum: z.string().regex(/^[a-f0-9]{64}$/i),
    byteSize: z.number().int().positive(),
    stepId: z.string().nullable(),
    createdAt: z.string().datetime()
  })
  .superRefine((checkpoint, ctx) => {
    if (
      (checkpoint.kind === "run_completed" || checkpoint.kind === "run_failed") &&
      checkpoint.resumable
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resumable"],
        message: "Terminal checkpoints cannot be resumable."
      });
    }

    if (checkpoint.kind === "step_blocked_on_approval" && checkpoint.resumable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resumable"],
        message: "Approval-blocked checkpoints are not resumable."
      });
    }
  });

export const CheckpointDetailSchema = CheckpointSummarySchema.extend({
  payload: CheckpointDetailPayloadSchema
});

export const CheckpointListResponseSchema = z.object({
  checkpoints: z.array(CheckpointSummarySchema)
});

export const ResumeRunRequestSchema = z.object({
  checkpointId: z.string().min(1).optional()
});

export const ResumeRunResponseSchema = z.object({
  run: RunSchema,
  resumedFromCheckpointId: z.string().min(1)
});

export const RunInterruptedDataSchema = z.object({
  run: RunSchema,
  interruptedFromCheckpointId: z.string().min(1)
});

export type CheckpointKind = z.infer<typeof CheckpointKindSchema>;
export type CheckpointPayloadRunSummary = z.infer<
  typeof CheckpointPayloadRunSummarySchema
>;
export type CheckpointPayloadStepSummary = z.infer<
  typeof CheckpointPayloadStepSummarySchema
>;
export type CheckpointWorkspacePaths = z.infer<
  typeof CheckpointWorkspacePathsSchema
>;
export type CheckpointDetailPayload = z.infer<
  typeof CheckpointDetailPayloadSchema
>;
export type CheckpointSummary = z.infer<typeof CheckpointSummarySchema>;
export type CheckpointDetail = z.infer<typeof CheckpointDetailSchema>;
export type CheckpointListResponse = z.infer<typeof CheckpointListResponseSchema>;
export type ResumeRunRequest = z.infer<typeof ResumeRunRequestSchema>;
export type ResumeRunResponse = z.infer<typeof ResumeRunResponseSchema>;
export type RunInterruptedData = z.infer<typeof RunInterruptedDataSchema>;
