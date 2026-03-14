import type {
  Artifact,
  AuthProfile,
  Outcome,
  Plan,
  ProviderCatalog,
  RouterPolicy,
  RunDetail,
  RunLogData,
  WorkspaceCredentialMetadata
} from "@computer-oss/protocol";

export type OutcomeListItem = Pick<
  Outcome,
  "id" | "prompt" | "status" | "updatedAt"
>;

export type ActivityEntry = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  tone?: "default" | "accent" | "success" | "warning";
};

export type OutcomeOrchestrationSnapshot = {
  plan: Plan | null;
  run: RunDetail | null;
};

export type RunArtifact = Artifact;
export type RunLogEntry = RunLogData;
export type ProviderCatalogData = ProviderCatalog;
export type WorkspaceCredentialSummary = WorkspaceCredentialMetadata;
export type AuthProfileSummary = AuthProfile;
export type WorkspaceRouterPolicy = RouterPolicy;
