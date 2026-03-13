import type {
  AuthProfile,
  CapabilityFamily,
  ProviderCatalog,
  RouterPolicy,
  StepRoute
} from "@computer-oss/protocol";
import { getModelDefinition, modelSupportsCapability } from "./catalog";
import { listOrderedCandidates } from "./policy";

function isProfileEligible(profile: AuthProfile, resolvedAt: string): boolean {
  if (profile.status !== "active") {
    return false;
  }

  if (!profile.cooldownUntil) {
    return true;
  }

  return Date.parse(profile.cooldownUntil) <= Date.parse(resolvedAt);
}

function selectProfile(input: {
  workspaceId: string;
  providerId: string;
  authProfileId: string | null;
  authProfiles: AuthProfile[];
  resolvedAt: string;
}): AuthProfile | null | "provider_mismatch" {
  const profiles = input.authProfiles.filter(
    (profile) => profile.workspaceId === input.workspaceId
  );

  if (input.authProfileId) {
    const profile = profiles.find((item) => item.id === input.authProfileId);

    if (!profile) {
      return null;
    }

    if (profile.providerId !== input.providerId) {
      return "provider_mismatch";
    }

    return isProfileEligible(profile, input.resolvedAt) ? profile : null;
  }

  return (
    profiles
      .filter(
        (profile) =>
          profile.providerId === input.providerId &&
          isProfileEligible(profile, input.resolvedAt)
      )
      .sort((left, right) => left.priority - right.priority)[0] ?? null
  );
}

export function resolveRoute(input: {
  workspaceId: string;
  capability: CapabilityFamily;
  policy: RouterPolicy;
  catalog: ProviderCatalog;
  authProfiles: AuthProfile[];
  resolvedAt: string;
}): StepRoute {
  const candidates = [
    ...listOrderedCandidates(input.policy, input.capability),
    ...listOrderedCandidates(input.policy, "fallback")
  ];

  if (candidates.length === 0) {
    return {
      capability: input.capability,
      providerId: null,
      modelId: null,
      authProfileId: null,
      policyVersion: input.policy.version,
      status: "unresolved",
      reason: "no_policy_candidates",
      resolvedAt: input.resolvedAt
    };
  }

  let firstFailure: StepRoute | null = null;

  for (const candidate of candidates) {
    const model = getModelDefinition(
      input.catalog,
      candidate.providerId,
      candidate.modelId
    );

    if (!model) {
      firstFailure ??= {
        capability: input.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId,
        policyVersion: input.policy.version,
        status: "invalid_policy",
        reason: "model_not_found",
        resolvedAt: input.resolvedAt
      };
      continue;
    }

    if (!modelSupportsCapability(model, input.capability)) {
      firstFailure ??= {
        capability: input.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId,
        policyVersion: input.policy.version,
        status: "invalid_policy",
        reason: "capability_unsupported",
        resolvedAt: input.resolvedAt
      };
      continue;
    }

    const profile = selectProfile({
      workspaceId: input.workspaceId,
      providerId: candidate.providerId,
      authProfileId: candidate.authProfileId,
      authProfiles: input.authProfiles,
      resolvedAt: input.resolvedAt
    });

    if (profile === "provider_mismatch") {
      firstFailure ??= {
        capability: input.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId,
        policyVersion: input.policy.version,
        status: "invalid_policy",
        reason: "auth_profile_provider_mismatch",
        resolvedAt: input.resolvedAt
      };
      continue;
    }

    if (!profile) {
      firstFailure ??= {
        capability: input.capability,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        authProfileId: candidate.authProfileId,
        policyVersion: input.policy.version,
        status: "missing_auth",
        reason: "no_active_auth_profile",
        resolvedAt: input.resolvedAt
      };
      continue;
    }

    return {
      capability: input.capability,
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      authProfileId: profile.id,
      policyVersion: input.policy.version,
      status: "resolved",
      reason: null,
      resolvedAt: input.resolvedAt
    };
  }

  return (
    firstFailure ?? {
      capability: input.capability,
      providerId: null,
      modelId: null,
      authProfileId: null,
      policyVersion: input.policy.version,
      status: "unresolved",
      reason: "no_policy_candidates",
      resolvedAt: input.resolvedAt
    }
  );
}
