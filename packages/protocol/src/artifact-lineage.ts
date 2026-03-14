import { z } from "zod";

export const ArtifactLineageRelationSchema = z.enum(["derived_from"]);

export const ArtifactLineageEdgeSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    parentArtifactId: z.string().min(1),
    childArtifactId: z.string().min(1),
    parentStepId: z.string().min(1),
    childStepId: z.string().min(1),
    relation: ArtifactLineageRelationSchema,
    createdAt: z.string().datetime()
  })
  .superRefine((edge, ctx) => {
    if (edge.parentArtifactId === edge.childArtifactId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Artifact-lineage edges must connect two distinct artifacts."
      });
    }
  });

export const ArtifactLineageListResponseSchema = z.object({
  edges: z.array(ArtifactLineageEdgeSchema)
});

export type ArtifactLineageRelation = z.infer<
  typeof ArtifactLineageRelationSchema
>;
export type ArtifactLineageEdge = z.infer<typeof ArtifactLineageEdgeSchema>;
export type ArtifactLineageListResponse = z.infer<
  typeof ArtifactLineageListResponseSchema
>;
