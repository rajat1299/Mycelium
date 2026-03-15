import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApprovalListResponseSchema,
  ApprovalSchema
} from "@computer-oss/protocol";
import type { ApprovalService } from "../lib/approval-service";
import type { Repositories } from "../lib/repositories";

const ApprovalResolutionBodySchema = z.object({
  resolutionNote: z.string().min(1).nullable().optional()
});

type ApprovalRouteOptions = {
  repositories: Repositories;
  approvalService: ApprovalService;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

export function registerApprovalRoutes(
  app: FastifyInstance,
  options: ApprovalRouteOptions
): void {
  app.get("/api/approvals", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const approvals = await options.repositories.approvals.listByWorkspace({
      workspaceId: query.workspaceId,
      status: "pending"
    });

    return reply.code(200).send(
      ApprovalListResponseSchema.parse({
        approvals
      })
    );
  });

  app.get("/api/approvals/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Approval id is required."));
    }

    const approval = await options.repositories.approvals.getById(params.id);

    if (!approval) {
      return reply.code(404).send(badRequest("Approval not found."));
    }

    return reply.code(200).send(ApprovalSchema.parse(approval));
  });

  app.post("/api/approvals/:id/approve", async (request, reply) => {
    return resolveApprovalRequest(app, options, request, reply, "approved");
  });

  app.post("/api/approvals/:id/reject", async (request, reply) => {
    return resolveApprovalRequest(app, options, request, reply, "rejected");
  });
}

async function resolveApprovalRequest(
  _app: FastifyInstance,
  options: ApprovalRouteOptions,
  request: {
    params: unknown;
    body: unknown;
  },
  reply: {
    code(statusCode: number): { send(payload?: unknown): unknown };
  },
  resolution: "approved" | "rejected"
) {
  const params = request.params as { id?: string };

  if (!params.id) {
    return reply.code(400).send(badRequest("Approval id is required."));
  }

  const parsed = ApprovalResolutionBodySchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    return reply.code(400).send(badRequest("Invalid approval resolution payload."));
  }

  try {
    const resolved = await options.approvalService.resolveApproval({
      approvalId: params.id,
      resolution,
      resolutionNote: parsed.data.resolutionNote ?? null
    });

    if (!resolved) {
      return reply.code(404).send(badRequest("Approval not found."));
    }

    return reply.code(200).send(ApprovalSchema.parse(resolved.approval));
  } catch (error) {
    if (error instanceof Error && error.message.includes("already resolved")) {
      return reply.code(409).send(badRequest(error.message));
    }

    throw error;
  }
}
