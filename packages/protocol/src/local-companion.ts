import { z } from "zod";

export const LocalCompanionPlatformSchema = z.enum([
  "macos",
  "linux",
  "windows"
]);

export const LocalCompanionTransportSchema = z.enum([
  "local_socket",
  "named_pipe",
  "loopback_https"
]);

export const LocalCompanionTrustModeSchema = z.enum(["bootstrap_token"]);

export const LocalCompanionCapabilitySchema = z.enum([
  "filesystem",
  "terminal",
  "application_launch",
  "browser",
  "media"
]);

export const LocalCompanionCapabilitySummarySchema = z.object({
  capabilities: z.array(LocalCompanionCapabilitySchema).nonempty(),
  supportsInteractiveTerminal: z.boolean(),
  supportsPrivilegedEscalation: z.boolean()
});

export const LocalCompanionPathAccessSchema = z.enum([
  "read_only",
  "read_write"
]);

export const LocalCompanionPathScopeSchema = z.object({
  rootPath: z.string().min(1),
  access: LocalCompanionPathAccessSchema
});

export const LocalCompanionScopeSchema = z.object({
  pathScopes: z.array(LocalCompanionPathScopeSchema),
  allowedCommands: z.array(z.string().min(1)),
  allowedHosts: z.array(z.string().min(1))
});

export const LocalCompanionTrustSchema = z.object({
  mode: LocalCompanionTrustModeSchema,
  bootstrapToken: z.string().min(1),
  tokenExpiresAt: z.string().datetime(),
  requestedAt: z.string().datetime(),
  expectedControlPlaneFingerprint: z.string().min(1).nullable()
});

export const LocalCompanionBootstrapSchema = z.object({
  companionId: z.string().min(1),
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1),
  platform: LocalCompanionPlatformSchema,
  controlPlaneUrl: z.string().url(),
  transport: LocalCompanionTransportSchema,
  trust: LocalCompanionTrustSchema,
  capabilities: LocalCompanionCapabilitySummarySchema,
  scope: LocalCompanionScopeSchema
});

export const LocalCompanionRegistrationSchema = z.object({
  companionId: z.string().min(1),
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  platform: LocalCompanionPlatformSchema,
  version: z.string().min(1),
  transport: LocalCompanionTransportSchema,
  trust: LocalCompanionTrustSchema,
  capabilities: LocalCompanionCapabilitySummarySchema,
  scope: LocalCompanionScopeSchema,
  connectedAt: z.string().datetime()
});

export type LocalCompanionPlatform = z.infer<typeof LocalCompanionPlatformSchema>;
export type LocalCompanionTransport = z.infer<typeof LocalCompanionTransportSchema>;
export type LocalCompanionTrustMode = z.infer<typeof LocalCompanionTrustModeSchema>;
export type LocalCompanionCapability = z.infer<typeof LocalCompanionCapabilitySchema>;
export type LocalCompanionCapabilitySummary = z.infer<
  typeof LocalCompanionCapabilitySummarySchema
>;
export type LocalCompanionPathAccess = z.infer<
  typeof LocalCompanionPathAccessSchema
>;
export type LocalCompanionPathScope = z.infer<
  typeof LocalCompanionPathScopeSchema
>;
export type LocalCompanionScope = z.infer<typeof LocalCompanionScopeSchema>;
export type LocalCompanionTrust = z.infer<typeof LocalCompanionTrustSchema>;
export type LocalCompanionBootstrap = z.infer<
  typeof LocalCompanionBootstrapSchema
>;
export type LocalCompanionRegistration = z.infer<
  typeof LocalCompanionRegistrationSchema
>;
