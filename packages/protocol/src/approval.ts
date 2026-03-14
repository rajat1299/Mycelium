import { z } from "zod";

export const ApprovalRequirementKindSchema = z.enum(["output_review_required"]);

export const ApprovalRequirementSchema = z.object({
  kind: ApprovalRequirementKindSchema,
  title: z.string().min(1),
  summary: z.string().min(1).nullable().default(null),
  instruction: z.string().min(1).nullable().default(null)
});

export const ApprovalStatusSchema = z.enum([
  "pending",
  "resolved",
  "cancelled"
]);

export const ApprovalResolutionSchema = z.enum([
  "approved",
  "rejected",
  "cancelled"
]);

export const ApprovalSchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    outcomeId: z.string().min(1),
    runId: z.string().min(1),
    stepId: z.string().min(1),
    status: ApprovalStatusSchema,
    kind: ApprovalRequirementKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1).nullable(),
    instruction: z.string().min(1).nullable(),
    artifactIds: z.array(z.string().min(1)),
    requestedAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    resolution: ApprovalResolutionSchema.nullable(),
    resolutionNote: z.string().min(1).nullable()
  })
  .superRefine((approval, ctx) => {
    if (approval.status === "pending") {
      if (
        approval.resolvedAt !== null ||
        approval.resolution !== null ||
        approval.resolutionNote !== null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pending approvals cannot be resolved."
        });
      }

      return;
    }

    if (approval.resolvedAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${approval.status} approvals require resolvedAt.`
      });
    }

    if (approval.resolution === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${approval.status} approvals require resolution.`
      });
      return;
    }

    if (
      approval.status === "resolved" &&
      approval.resolution === "cancelled"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Resolved approvals must use approved or rejected resolution."
      });
    }

    if (
      approval.status === "cancelled" &&
      approval.resolution !== "cancelled"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cancelled approvals must use cancelled resolution."
      });
    }
  });

export const ApprovalResolutionRequestSchema = z.object({
  resolution: ApprovalResolutionSchema,
  resolutionNote: z.string().min(1).nullable().default(null)
});

export const ApprovalListResponseSchema = z.object({
  approvals: z.array(ApprovalSchema)
});

export type ApprovalRequirementKind = z.infer<
  typeof ApprovalRequirementKindSchema
>;
export type ApprovalRequirement = z.infer<typeof ApprovalRequirementSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type ApprovalResolution = z.infer<typeof ApprovalResolutionSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type ApprovalResolutionRequest = z.infer<
  typeof ApprovalResolutionRequestSchema
>;
export type ApprovalListResponse = z.infer<typeof ApprovalListResponseSchema>;
