import type { FastifyInstance } from "fastify";
import {
  AuditListResponseSchema,
  CheckpointDetailSchema,
  CheckpointListResponseSchema
} from "@computer-oss/protocol";
import type { CheckpointService } from "../lib/checkpoint-service";
import type { Repositories } from "../lib/repositories";

type CheckpointRouteOptions = {
  repositories: Repositories;
  checkpointService: CheckpointService;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

export function registerCheckpointRoutes(
  app: FastifyInstance,
  options: CheckpointRouteOptions
): void {
  app.get("/api/runs/:runId/checkpoints", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    const checkpoints = await options.repositories.checkpoints.listByRun(params.runId);

    return reply.code(200).send(
      CheckpointListResponseSchema.parse({
        checkpoints
      })
    );
  });

  app.get("/api/checkpoints/:checkpointId", async (request, reply) => {
    const params = request.params as { checkpointId?: string };

    if (!params.checkpointId) {
      return reply.code(400).send(badRequest("Checkpoint id is required."));
    }

    const checkpoint = await options.checkpointService.readCheckpoint(params.checkpointId);

    if (!checkpoint) {
      return reply.code(404).send(badRequest("Checkpoint not found."));
    }

    return reply.code(200).send(CheckpointDetailSchema.parse(checkpoint));
  });

  app.get("/api/runs/:runId/audit", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    const events = await options.repositories.auditEvents.listByRun(params.runId);

    return reply.code(200).send(
      AuditListResponseSchema.parse({
        events
      })
    );
  });
}
