import { z } from "zod";

export const CapabilityFamilySchema = z.enum([
  "reasoning",
  "research",
  "coding",
  "browser",
  "terminal",
  "api",
  "document",
  "fast_tasks",
  "fallback"
]);

export const ProviderAuthTypeSchema = z.enum(["api_key", "oauth"]);

export const WorkspaceCredentialStatusSchema = z.enum([
  "active",
  "disabled",
  "error"
]);

export const AuthProfileStatusSchema = z.enum([
  "active",
  "disabled",
  "cooling_down"
]);

export const ModelCostClassSchema = z.enum(["low", "medium", "high"]);

export const ModelLatencyClassSchema = z.enum(["low", "medium", "high"]);

export const ModelStatusSchema = z.enum(["active", "preview", "deprecated"]);

export const RouteStatusSchema = z.enum([
  "resolved",
  "unresolved",
  "invalid_policy",
  "missing_auth"
]);

export const RouteReasonSchema = z.enum([
  "no_policy_candidates",
  "provider_not_found",
  "model_not_found",
  "capability_unsupported",
  "auth_profile_not_found",
  "auth_profile_provider_mismatch",
  "no_active_auth_profile"
]);

export const ProviderDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  authType: ProviderAuthTypeSchema,
  supportsCapabilities: z.array(CapabilityFamilySchema),
  supportsStreaming: z.boolean(),
  supportsReasoning: z.boolean(),
  supportsVision: z.boolean(),
  docsUrl: z.string().url()
});

export const ModelDefinitionSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  label: z.string().min(1),
  capabilityFamilies: z.array(CapabilityFamilySchema),
  contextWindow: z.number().int().positive(),
  costClass: ModelCostClassSchema,
  latencyClass: ModelLatencyClassSchema,
  status: ModelStatusSchema
});

export const ProviderCatalogSchema = z.object({
  providers: z.array(ProviderDefinitionSchema),
  models: z.array(ModelDefinitionSchema)
});

export const WorkspaceCredentialMetadataSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  status: WorkspaceCredentialStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastValidatedAt: z.string().datetime().nullable()
});

export const AuthProfileSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  credentialId: z.string().min(1),
  status: AuthProfileStatusSchema,
  priority: z.number().int().nonnegative(),
  cooldownUntil: z.string().datetime().nullable(),
  lastValidatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RouterPolicyCandidateSchema = z.object({
  capability: CapabilityFamilySchema,
  priority: z.number().int().nonnegative(),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  authProfileId: z.string().min(1).nullable(),
  enabled: z.boolean()
});

export const RouterPolicySchema = z.object({
  workspaceId: z.string().min(1),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  candidates: z.array(RouterPolicyCandidateSchema)
});

export const StepRouteSchema = z.object({
  capability: CapabilityFamilySchema,
  providerId: z.string().min(1).nullable(),
  modelId: z.string().min(1).nullable(),
  authProfileId: z.string().min(1).nullable(),
  policyVersion: z.number().int().nonnegative(),
  status: RouteStatusSchema,
  reason: RouteReasonSchema.nullable(),
  resolvedAt: z.string().datetime()
});

export const RoutePreviewRequestSchema = z.object({
  workspaceId: z.string().min(1),
  capability: CapabilityFamilySchema,
  policyVersion: z.number().int().nonnegative().optional()
});

export const RoutePreviewResponseSchema = z.object({
  workspaceId: z.string().min(1),
  capability: CapabilityFamilySchema,
  route: StepRouteSchema
});

export type CapabilityFamily = z.infer<typeof CapabilityFamilySchema>;
export type ProviderAuthType = z.infer<typeof ProviderAuthTypeSchema>;
export type WorkspaceCredentialStatus = z.infer<
  typeof WorkspaceCredentialStatusSchema
>;
export type AuthProfileStatus = z.infer<typeof AuthProfileStatusSchema>;
export type ModelCostClass = z.infer<typeof ModelCostClassSchema>;
export type ModelLatencyClass = z.infer<typeof ModelLatencyClassSchema>;
export type ModelStatus = z.infer<typeof ModelStatusSchema>;
export type RouteStatus = z.infer<typeof RouteStatusSchema>;
export type RouteReason = z.infer<typeof RouteReasonSchema>;
export type ProviderDefinition = z.infer<typeof ProviderDefinitionSchema>;
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;
export type ProviderCatalog = z.infer<typeof ProviderCatalogSchema>;
export type WorkspaceCredentialMetadata = z.infer<
  typeof WorkspaceCredentialMetadataSchema
>;
export type AuthProfile = z.infer<typeof AuthProfileSchema>;
export type RouterPolicyCandidate = z.infer<typeof RouterPolicyCandidateSchema>;
export type RouterPolicy = z.infer<typeof RouterPolicySchema>;
export type StepRoute = z.infer<typeof StepRouteSchema>;
export type RoutePreviewRequest = z.infer<typeof RoutePreviewRequestSchema>;
export type RoutePreviewResponse = z.infer<typeof RoutePreviewResponseSchema>;
