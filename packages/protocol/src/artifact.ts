import { z } from "zod";

export const ArtifactSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  runId: z.string().nullable(),
  stepId: z.string().nullable(),
  kind: z.string().min(1),
  relativePath: z.string().min(1),
  size: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime()
});

export const ArtifactListResponseSchema = z.object({
  artifacts: z.array(ArtifactSchema)
});

export type Artifact = z.infer<typeof ArtifactSchema>;
export type ArtifactListResponse = z.infer<typeof ArtifactListResponseSchema>;
