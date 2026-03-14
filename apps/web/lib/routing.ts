import type {
  AuthProfile,
  CapabilityFamily,
  RouteReason,
  RouteStatus
} from "@computer-oss/protocol";

export const CAPABILITY_OPTIONS: CapabilityFamily[] = [
  "reasoning",
  "research",
  "coding",
  "browser",
  "terminal",
  "api",
  "document",
  "fast_tasks",
  "fallback"
];

export const ROUTE_PREVIEW_CAPABILITIES: CapabilityFamily[] = [
  "reasoning",
  "coding"
];

function titleCaseWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatCapabilityLabel(capability: CapabilityFamily) {
  return capability
    .split("_")
    .map(titleCaseWord)
    .join(" ");
}

export function formatRouteStatus(status: RouteStatus) {
  switch (status) {
    case "resolved":
      return "Resolved";
    case "missing_auth":
      return "Missing auth";
    case "invalid_policy":
      return "Invalid policy";
    default:
      return "Unresolved";
  }
}

export function formatRouteReason(reason: RouteReason) {
  switch (reason) {
    case "no_policy_candidates":
      return "No policy candidates";
    case "policy_workspace_mismatch":
      return "Policy workspace mismatch";
    case "provider_not_found":
      return "Provider not found";
    case "model_not_found":
      return "Model not found";
    case "capability_unsupported":
      return "Capability unsupported";
    case "auth_profile_not_found":
      return "Auth profile not found";
    case "auth_profile_provider_mismatch":
      return "Auth profile provider mismatch";
    default:
      return "No active auth profile";
  }
}

export function routeStatusVariant(status: RouteStatus): "sky" | "amber" {
  return status === "resolved" ? "sky" : "amber";
}

export function resolveAuthProfileLabel(
  authProfiles: AuthProfile[],
  authProfileId: string | null | undefined
) {
  if (!authProfileId) {
    return null;
  }

  return authProfiles.find((profile) => profile.id === authProfileId)?.label ?? authProfileId;
}
