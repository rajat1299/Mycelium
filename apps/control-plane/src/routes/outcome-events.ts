import type { FastifyInstance } from "fastify";
import { formatSseEvent, type EventBus } from "../lib/event-bus";
import type { Repositories } from "../lib/repositories";

type OutcomeEventRouteOptions = {
  repositories: Repositories;
  eventBus: EventBus;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

export function registerOutcomeEventRoutes(
  app: FastifyInstance,
  options: OutcomeEventRouteOptions
): void {
  app.get("/api/outcomes/:id/events", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    reply.hijack();
    reply.raw.setHeader("content-type", "text/event-stream; charset=utf-8");
    reply.raw.setHeader("cache-control", "no-cache, no-transform");
    reply.raw.setHeader("connection", "keep-alive");
    reply.raw.flushHeaders?.();
    reply.raw.write(": connected\n\n");

    const unsubscribe = options.eventBus.subscribe(params.id, (event) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(formatSseEvent(event));
      }
    });

    const cleanup = () => {
      unsubscribe();

      if (!reply.raw.writableEnded && !reply.raw.destroyed) {
        reply.raw.end();
      }

      request.raw.off("close", cleanup);
      request.raw.off("end", cleanup);
    };

    request.raw.on("close", cleanup);
    request.raw.on("end", cleanup);
  });
}
