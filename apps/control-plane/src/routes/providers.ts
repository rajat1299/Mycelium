import type { FastifyInstance } from "fastify";
import { ProviderCatalogSchema } from "@computer-oss/protocol";
import { getProviderCatalog } from "@computer-oss/router";

export function registerProviderRoutes(app: FastifyInstance): void {
  app.get("/api/providers/models", async (_request, reply) => {
    return reply.code(200).send(ProviderCatalogSchema.parse(getProviderCatalog()));
  });
}
