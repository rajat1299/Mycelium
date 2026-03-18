import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MessagingDeliverySchema } from "@computer-oss/protocol";
import type { MessagingService } from "../lib/messaging-service";

const CreateDeliveryRequestSchema = z.object({
  outcomeId: z.string().min(1),
  kind: z.enum(["status_update", "result_summary", "approval_notification"]),
  body: z.string().min(1),
  runId: z.string().min(1).nullable()
});

type MessageRouteOptions = {
  messagingService: MessagingService;
};

function badRequest(message: string) {
  return { error: message };
}

export function registerMessageRoutes(
  app: FastifyInstance,
  options: MessageRouteOptions
) {
  app.get("/api/outcomes/:id/messages/history", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const history = await options.messagingService.getOutcomeHistory(params.id);

    return reply.code(200).send(history);
  });

  app.post("/api/messages/deliveries", async (request, reply) => {
    const parsed = CreateDeliveryRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid messaging delivery payload."));
    }

    try {
      const delivery = await options.messagingService.deliverToOutcome(parsed.data);
      return reply.code(202).send(MessagingDeliverySchema.parse(delivery));
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(404).send(badRequest(error.message));
      }

      throw error;
    }
  });
}
