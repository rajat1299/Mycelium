import { z } from "zod";
import {
  CapabilityFamilySchema,
  RouteReasonSchema,
  RouteStatusSchema
} from "./router";

export const PlanStatusSchema = z.enum(["draft"]);

export const PlanNodeKindSchema = z.enum(["root", "task", "synthesis"]);

export const PlanNodeCapabilitySchema = CapabilityFamilySchema;

export const PlanNodeTemplateSchema = z.enum([
  "analyze_outcome",
  "draft_brief",
  "draft_operator_summary",
  "synthesize_result"
]);

export const ArtifactKindSchema = z.enum([
  "analysis",
  "brief",
  "operator_summary",
  "result"
]);

export const PlanNodeSchema = z.object({
  id: z.string(),
  kind: PlanNodeKindSchema,
  title: z.string().min(1),
  capability: PlanNodeCapabilitySchema,
  instruction: z.string().min(1).optional(),
  template: PlanNodeTemplateSchema.optional(),
  expectedArtifactPath: z.string().min(1).optional(),
  expectedArtifactKind: ArtifactKindSchema.optional(),
  position: z.number().int().nonnegative()
});

export const PlanEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string()
});

export const PlanSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  status: PlanStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  nodes: z.array(PlanNodeSchema),
  edges: z.array(PlanEdgeSchema)
});

export const CreateRunRequestSchema = z.object({
  planId: z.string().min(1)
});

export const RunStatusSchema = z.enum([
  "draft",
  "queued",
  "planning",
  "waiting_for_worker",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
]);

export const StepStatusSchema = z.enum([
  "pending",
  "ready",
  "claimed",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
]);

export const RunSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  planId: z.string(),
  status: RunStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RunStepSchema = z
  .object({
    id: z.string(),
    runId: z.string(),
    planNodeId: z.string(),
    title: z.string().min(1),
    kind: PlanNodeKindSchema,
    capability: PlanNodeCapabilitySchema,
    instruction: z.string().min(1).optional(),
    template: PlanNodeTemplateSchema.optional(),
    expectedArtifactPath: z.string().min(1).optional(),
    expectedArtifactKind: ArtifactKindSchema.optional(),
    routeProviderId: z.string().min(1).nullable().optional(),
    routeModelId: z.string().min(1).nullable().optional(),
    routeAuthProfileId: z.string().min(1).nullable().optional(),
    routePolicyVersion: z.number().int().nonnegative().optional(),
    routeStatus: RouteStatusSchema.optional(),
    routeReason: RouteReasonSchema.nullable().optional(),
    routeResolvedAt: z.string().datetime().optional(),
    status: StepStatusSchema,
    position: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine((step, ctx) => {
    const hasRouteMetadata =
      step.routeProviderId !== undefined ||
      step.routeModelId !== undefined ||
      step.routeAuthProfileId !== undefined ||
      step.routePolicyVersion !== undefined ||
      step.routeStatus !== undefined ||
      step.routeReason !== undefined ||
      step.routeResolvedAt !== undefined;

    if (!hasRouteMetadata) {
      return;
    }

    if (step.routeStatus === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["routeStatus"],
        message: "routeStatus is required when route metadata is present."
      });
    }

    if (step.routePolicyVersion === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["routePolicyVersion"],
        message: "routePolicyVersion is required when route metadata is present."
      });
    }

    if (step.routeResolvedAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["routeResolvedAt"],
        message: "routeResolvedAt is required when route metadata is present."
      });
    }

    if (step.routeStatus === "resolved") {
      if (!step.routeProviderId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routeProviderId"],
          message: "Resolved route metadata requires routeProviderId."
        });
      }

      if (!step.routeModelId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routeModelId"],
          message: "Resolved route metadata requires routeModelId."
        });
      }

      if (!step.routeAuthProfileId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routeAuthProfileId"],
          message: "Resolved route metadata requires routeAuthProfileId."
        });
      }

      if (step.routeReason !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routeReason"],
          message: "Resolved route metadata must set routeReason to null."
        });
      }

      return;
    }

    if (step.routeStatus !== undefined && step.routeReason == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["routeReason"],
        message: "Unresolved route metadata requires a non-null routeReason."
      });
    }
  });

export const RunDetailSchema = RunSchema.extend({
  steps: z.array(RunStepSchema)
});

export type PlanStatus = z.infer<typeof PlanStatusSchema>;
export type PlanNodeKind = z.infer<typeof PlanNodeKindSchema>;
export type PlanNodeCapability = z.infer<typeof PlanNodeCapabilitySchema>;
export type PlanNodeTemplate = z.infer<typeof PlanNodeTemplateSchema>;
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
export type PlanNode = z.infer<typeof PlanNodeSchema>;
export type PlanEdge = z.infer<typeof PlanEdgeSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
export type RunStep = z.infer<typeof RunStepSchema>;
export type RunDetail = z.infer<typeof RunDetailSchema>;
