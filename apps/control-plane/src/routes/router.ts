import type { FastifyInstance } from "fastify";
import {
  RoutePreviewRequestSchema,
  RoutePreviewResponseSchema,
  RouterPolicySchema
} from "@computer-oss/protocol";
import {
  RouterPolicyValidationError,
  RouterPolicyVersionMismatchError,
  type RouterService
} from "../lib/router-service";

type RouterRouteOptions = {
  routerService: RouterService;
};

function badRequest(message: string, issues?: unknown) {
  return {
    error: message,
    ...(issues !== undefined ? { issues } : {})
  };
}

export function registerRouterRoutes(
  app: FastifyInstance,
  options: RouterRouteOptions
): void {
  app.get("/api/router/policy", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const policy = await options.routerService.getPolicy(query.workspaceId);

    return reply.code(200).send({
      policy: policy ? RouterPolicySchema.parse(policy) : null
    });
  });

  app.put("/api/router/policy", async (request, reply) => {
    const parsed = RouterPolicySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid router policy payload."));
    }

    try {
      const stored = await options.routerService.upsertPolicy(parsed.data);

      return reply.code(200).send(RouterPolicySchema.parse(stored));
    } catch (error) {
      if (error instanceof RouterPolicyValidationError) {
        return reply
          .code(400)
          .send(badRequest(error.message, error.issues));
      }

      if (error instanceof Error && error.message.includes("belongs to")) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }
  });

  app.post("/api/router/resolve-preview", async (request, reply) => {
    const parsed = RoutePreviewRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid route preview payload."));
    }

    try {
      const preview = await options.routerService.previewRoute(parsed.data);

      return reply.code(200).send(RoutePreviewResponseSchema.parse(preview));
    } catch (error) {
      if (error instanceof RouterPolicyVersionMismatchError) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }
  });
}
