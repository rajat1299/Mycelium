import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RemoteWorkerSchema } from "@computer-oss/protocol";
import type { WorkerRegistry } from "../lib/worker-registry";

const WorkerListResponseSchema = z.object({
  workers: z.array(RemoteWorkerSchema)
});

type WorkerRouteOptions = {
  workerRegistry: WorkerRegistry;
};

function errorResponse(message: string) {
  return {
    error: message
  };
}

export function registerWorkerRoutes(
  app: FastifyInstance,
  options: WorkerRouteOptions
): void {
  app.get("/api/workers", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(errorResponse("workspaceId is required."));
    }

    const workers = await options.workerRegistry.listWorkers(query.workspaceId);

    return reply.code(200).send(
      WorkerListResponseSchema.parse({
        workers
      })
    );
  });
}
