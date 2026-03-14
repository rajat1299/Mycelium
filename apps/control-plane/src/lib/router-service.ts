import type {
  RoutePreviewRequest,
  RoutePreviewResponse,
  RouterPolicy
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
      const resolvedAt = now().toISOString();
      const policy =
        (await options.repositories.routerPolicy.getByWorkspace(request.workspaceId)) ??
        buildEmptyPolicy(request.workspaceId, resolvedAt);

      if (
        request.policyVersion !== undefined &&
        request.policyVersion !== policy.version
      ) {
        throw new RouterPolicyVersionMismatchError(
          request.policyVersion,
          policy.version
        );
      }

      const authProfiles = await options.repositories.authProfiles.listByWorkspace(
        request.workspaceId
      );

      return {
        workspaceId: request.workspaceId,
        capability: request.capability,
        route: resolveRoute({
          workspaceId: request.workspaceId,
          capability: request.capability,
          policy,
          catalog: getProviderCatalog(),
          authProfiles,
          resolvedAt
        })
      };
    }
  };
}
