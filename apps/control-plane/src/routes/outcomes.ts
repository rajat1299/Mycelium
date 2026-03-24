import type { FastifyInstance } from "fastify";
import {
  ContinueOutcomeRequestSchema,
  CreateOutcomeMessageRequestSchema,
  CreateOutcomeRequestSchema,
  MessageCreatedDataSchema,
  OutcomeMessageListResponseSchema,
  OutcomeListResponseSchema,
  OutcomeSchema,
  OutcomeTurnResponseSchema,
  StartOutcomeRequestSchema
} from "@computer-oss/protocol";
import type { EventBus } from "../lib/event-bus";
import {
  OutcomeTurnConflictError,
  type OutcomeTurnService
} from "../lib/outcome-turn-service";
import type { Repositories } from "../lib/repositories";

type OutcomeRouteOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  outcomeTurnService: OutcomeTurnService;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

export function registerOutcomeRoutes(
  app: FastifyInstance,
  options: OutcomeRouteOptions
): void {
  app.post("/api/outcomes/start", async (request, reply) => {
    const parsed = StartOutcomeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome turn payload."));
    }

    try {
      const response = await options.outcomeTurnService.startThread(parsed.data);

      return reply.code(201).send(OutcomeTurnResponseSchema.parse(response));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("does not exist")) {
          return reply.code(404).send(badRequest(error.message));
        }
      }

      throw error;
    }
  });

  app.post("/api/outcomes", async (request, reply) => {
    const parsed = CreateOutcomeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome payload."));
    }

    const created = await options.repositories.outcomes.create({
      ...parsed.data,
      id: `outcome_${crypto.randomUUID()}`
    });

    options.eventBus.publish({
      outcomeId: created.id,
      type: "outcome.updated",
      data: created
    });

    return reply.code(201).send(OutcomeSchema.parse(created));
  });

  app.post("/api/outcomes/:id/continue", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = ContinueOutcomeRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome turn payload."));
    }

    try {
      const response = await options.outcomeTurnService.continueThread({
        outcomeId: params.id,
        ...parsed.data
      });

      return reply.code(201).send(OutcomeTurnResponseSchema.parse(response));
    } catch (error) {
      if (error instanceof Error) {
        if (error instanceof OutcomeTurnConflictError) {
          return reply.code(409).send(badRequest(error.message));
        }

        if (error.message.includes("not found")) {
          return reply.code(404).send(badRequest(error.message));
        }
      }

      throw error;
    }
  });

  app.get("/api/outcomes/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    return reply.code(200).send(OutcomeSchema.parse(outcome));
  });

  app.get("/api/outcomes/:id/messages", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const messages = await options.repositories.outcomes.listMessages(params.id);

    return reply.code(200).send(
      OutcomeMessageListResponseSchema.parse({
        messages: messages.map((message) => MessageCreatedDataSchema.parse(message))
      })
    );
  });

  app.get("/api/outcomes", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const outcomes = await options.repositories.outcomes.listByWorkspace(
      query.workspaceId
    );

    return reply.code(200).send(
      OutcomeListResponseSchema.parse({
        outcomes: outcomes.map((outcome) => OutcomeSchema.parse(outcome))
      })
    );
  });

  app.post("/api/outcomes/:id/messages", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = CreateOutcomeMessageRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome message payload."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const message = {
      ...parsed.data,
      id: `msg_${crypto.randomUUID()}`,
      outcomeId: params.id,
      createdAt: new Date().toISOString()
    };

    await options.repositories.outcomes.appendMessage(message);

    options.eventBus.publish({
      outcomeId: params.id,
      type: "message.created",
      data: message
    });

    return reply.code(202).send({ accepted: true });
  });
}
