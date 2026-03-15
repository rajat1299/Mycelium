import type { FastifyInstance } from "fastify";
import {
  ArtifactLineageListResponseSchema,
  ArtifactListResponseSchema
} from "@computer-oss/protocol";
import type { Repositories } from "../lib/repositories";

type ArtifactRouteOptions = {
  repositories: Repositories;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

export function registerArtifactRoutes(
  app: FastifyInstance,
  options: ArtifactRouteOptions
): void {
  app.get("/api/runs/:runId/artifacts", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    const artifacts = await options.repositories.artifacts.listByRun(params.runId);

    return reply.code(200).send(
      ArtifactListResponseSchema.parse({
        artifacts
      })
    );
  });

  app.get("/api/runs/:runId/artifact-lineage", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    const edges = await options.repositories.artifactLineage.listByRun(params.runId);

    return reply.code(200).send(
      ArtifactLineageListResponseSchema.parse({
        edges
      })
    );
  });
}
