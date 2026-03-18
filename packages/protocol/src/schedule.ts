import { z } from "zod";

export const ScheduleStatusSchema = z.enum([
  "active",
  "paused",
  "disabled",
  "error"
]);

export const ScheduleOutcomeModeSchema = z.enum([
  "create_outcome",
  "continue_outcome"
]);

export const ScheduleDispatchModeSchema = z.enum([
  "outcome_only",
  "draft_plan",
  "create_run"
]);

export const ScheduleValidationSeveritySchema = z.enum(["warning", "error"]);

export const ScheduleValidationDiagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: ScheduleValidationSeveritySchema,
  field: z.string().min(1).nullable().optional()
});

export const ScheduleCronTriggerSchema = z.object({
  kind: z.literal("cron"),
  expression: z.string().min(1),
  timezone: z.string().min(1)
});

export const ScheduleEveryTriggerSchema = z.object({
  kind: z.literal("every"),
  everyMs: z.number().int().positive(),
  anchorAt: z.string().datetime().optional(),
  timezone: z.string().min(1).optional()
});

export const ScheduleAtTriggerSchema = z.object({
  kind: z.literal("at"),
  at: z.string().datetime(),
  timezone: z.string().min(1).optional()
});

export const ScheduleTriggerSchema = z.discriminatedUnion("kind", [
  ScheduleCronTriggerSchema,
  ScheduleEveryTriggerSchema,
  ScheduleAtTriggerSchema
]);

export const ScheduleSchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    title: z.string().min(1),
    prompt: z.string().min(1),
    status: ScheduleStatusSchema,
    trigger: ScheduleTriggerSchema,
    outcomeMode: ScheduleOutcomeModeSchema,
    dispatchMode: ScheduleDispatchModeSchema,
    nextFireAt: z.string().datetime().nullable(),
    lastFiredAt: z.string().datetime().nullable(),
    validationDiagnostics: z.array(ScheduleValidationDiagnosticSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine((schedule, ctx) => {
    if (schedule.status === "error" && schedule.validationDiagnostics.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validationDiagnostics"],
        message: "Error schedules require validation diagnostics."
      });
    }
  });

export const ScheduleFireStatusSchema = z.enum([
  "triggered",
  "deduped",
  "failed"
]);

export const ScheduleFireSummarySchema = z
  .object({
    id: z.string().min(1),
    scheduleId: z.string().min(1),
    occurrenceKey: z.string().min(1),
    scheduledFor: z.string().datetime(),
    firedAt: z.string().datetime().nullable(),
    status: ScheduleFireStatusSchema,
    outcomeId: z.string().min(1).nullable(),
    runId: z.string().min(1).nullable(),
    errorMessage: z.string().min(1).nullable()
  })
  .superRefine((fire, ctx) => {
    if (fire.status === "triggered" && fire.firedAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firedAt"],
        message: "Triggered schedule fires require firedAt."
      });
    }

    if (fire.status === "failed" && fire.errorMessage === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["errorMessage"],
        message: "Failed schedule fires require errorMessage."
      });
    }
  });

export const ScheduleListResponseSchema = z.object({
  schedules: z.array(ScheduleSchema)
});

export const ScheduleFireListResponseSchema = z.object({
  fires: z.array(ScheduleFireSummarySchema)
});

export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;
export type ScheduleOutcomeMode = z.infer<typeof ScheduleOutcomeModeSchema>;
export type ScheduleDispatchMode = z.infer<typeof ScheduleDispatchModeSchema>;
export type ScheduleValidationSeverity = z.infer<
  typeof ScheduleValidationSeveritySchema
>;
export type ScheduleValidationDiagnostic = z.infer<
  typeof ScheduleValidationDiagnosticSchema
>;
export type ScheduleCronTrigger = z.infer<typeof ScheduleCronTriggerSchema>;
export type ScheduleEveryTrigger = z.infer<typeof ScheduleEveryTriggerSchema>;
export type ScheduleAtTrigger = z.infer<typeof ScheduleAtTriggerSchema>;
export type ScheduleTrigger = z.infer<typeof ScheduleTriggerSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type ScheduleFireStatus = z.infer<typeof ScheduleFireStatusSchema>;
export type ScheduleFireSummary = z.infer<typeof ScheduleFireSummarySchema>;
export type ScheduleListResponse = z.infer<typeof ScheduleListResponseSchema>;
export type ScheduleFireListResponse = z.infer<
  typeof ScheduleFireListResponseSchema
>;
