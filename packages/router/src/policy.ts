import type {
  AuthProfile,
  CapabilityFamily,
  ProviderCatalog,
  RouterPolicy,
  RouterPolicyCandidate
} from "@computer-oss/protocol";
import { getModelDefinition, getProviderDefinition, modelSupportsCapability } from "./catalog";

export type RouterPolicyValidationIssue = {
  code:
    | "provider_not_found"
    | "model_not_found"
    | "capability_unsupported"
    | "auth_profile_not_found"
    | "auth_profile_provider_mismatch";
  capability: CapabilityFamily;
  providerId: string;
  modelId: string;
  authProfileId?: string | null;
};

export function listOrderedCandidates(
  policy: RouterPolicy,
  capability: CapabilityFamily
): RouterPolicyCandidate[] {
  return policy.candidates
    .filter(
      (candidate) => candidate.enabled && candidate.capability === capability
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return `${left.providerId}:${left.modelId}`.localeCompare(
        `${right.providerId}:${right.modelId}`
      );
    });
}

export function validateRouterPolicy(input: {
  catalog: ProviderCatalog;
  policy: RouterPolicy;
  authProfiles: AuthProfile[];
}): { ok: boolean; issues: RouterPolicyValidationIssue[] } {
  const issues: RouterPolicyValidationIssue[] = [];

  for (const candidate of input.policy.candidates.filter((item) => item.enabled)) {
    const provider = getProviderDefinition(input.catalog, candidate.providerId);

    if (!provider) {
      issues.push({
        code: "provider_not_found",
        capability: candidate.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId
      });
      continue;
    }

    const model = getModelDefinition(
      input.catalog,
      candidate.providerId,
      candidate.modelId
    );

    if (!model) {
      issues.push({
        code: "model_not_found",
        capability: candidate.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId
      });
      continue;
    }

    if (!modelSupportsCapability(model, candidate.capability)) {
      issues.push({
        code: "capability_unsupported",
        capability: candidate.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId
      });
    }

    if (!candidate.authProfileId) {
      continue;
    }

    const authProfile = input.authProfiles.find(
      (profile) => profile.id === candidate.authProfileId
    );

    if (!authProfile) {
      issues.push({
        code: "auth_profile_not_found",
        capability: candidate.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId
      });
      continue;
    }

    if (authProfile.providerId !== candidate.providerId) {
      issues.push({
        code: "auth_profile_provider_mismatch",
        capability: candidate.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}
