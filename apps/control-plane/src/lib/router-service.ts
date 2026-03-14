import type {
  CapabilityFamily,
  RoutePreviewRequest,
  RoutePreviewResponse,
  RouterPolicy,
  StepRoute
} from "@computer-oss/protocol";
import { getProviderCatalog, resolveRoute, validateRouterPolicy } from "@computer-oss/router";
import type { Repositories } from "./repositories";

export class RouterPolicyValidationError extends Error {
  constructor(
    readonly issues: ReturnType<typeof validateRouterPolicy>["issues"]
  ) {
    super("Invalid router policy.");
    this.name = "RouterPolicyValidationError";
  }
}

export class RouterPolicyVersionMismatchError extends Error {
  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Requested policy version ${expectedVersion} does not match stored version ${actualVersion}.`
    );
    this.name = "RouterPolicyVersionMismatchError";
  }
}

export type RouterService = ReturnType<typeof createRouterService>;

type RouterServiceOptions = {
  repositories: Repositories;
  now?: () => Date;
};

function buildEmptyPolicy(workspaceId: string, resolvedAt: string): RouterPolicy {
  return {
    workspaceId,
    version: 0,
    updatedAt: resolvedAt,
    candidates: []
  };
}

export function createRouterService(options: RouterServiceOptions) {
  const now = options.now ?? (() => new Date());

  async function resolvePersistedRoute(input: {
    workspaceId: string;
    capability: CapabilityFamily;
    policyVersion?: number;
    resolvedAt?: string;
  }): Promise<StepRoute> {
    const resolvedAt = input.resolvedAt ?? now().toISOString();
    const policy =
      (await options.repositories.routerPolicy.getByWorkspace(input.workspaceId)) ??
      buildEmptyPolicy(input.workspaceId, resolvedAt);

    if (
      input.policyVersion !== undefined &&
      input.policyVersion !== policy.version
    ) {
      throw new RouterPolicyVersionMismatchError(
        input.policyVersion,
        policy.version
      );
    }

    const authProfiles = await options.repositories.authProfiles.listByWorkspace(
      input.workspaceId
    );

    return resolveRoute({
      workspaceId: input.workspaceId,
      capability: input.capability,
      policy,
      catalog: getProviderCatalog(),
      authProfiles,
      resolvedAt
    });
  }

  return {
    getCatalog() {
      return getProviderCatalog();
    },
    async getPolicy(workspaceId: string) {
      return options.repositories.routerPolicy.getByWorkspace(workspaceId);
    },
    async upsertPolicy(policy: RouterPolicy) {
      const authProfiles = await options.repositories.authProfiles.listByWorkspace(
        policy.workspaceId
      );
      const validation = validateRouterPolicy({
        catalog: getProviderCatalog(),
        policy,
        authProfiles
      });

      if (!validation.ok) {
        throw new RouterPolicyValidationError(validation.issues);
      }

      return options.repositories.routerPolicy.upsert(policy);
    },
    async previewRoute(request: RoutePreviewRequest): Promise<RoutePreviewResponse> {
      const route = await resolvePersistedRoute({
        workspaceId: request.workspaceId,
        capability: request.capability,
        policyVersion: request.policyVersion
      });

      return {
        workspaceId: request.workspaceId,
        capability: request.capability,
        route
      };
    },
    resolveRoute: resolvePersistedRoute
  };
}
