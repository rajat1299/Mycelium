import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MessagingConnectionSchema } from "@computer-oss/protocol";
import type { TelegramService } from "../lib/telegram-service";

const UpsertTelegramConnectionRequestSchema = z.object({
  enabled: z.boolean(),
  accountLabel: z.string().min(1),
  externalWorkspaceId: z.string().min(1),
  externalWorkspaceLabel: z.string().min(1).nullable().optional()
});

const TelegramInboundRequestSchema = z.object({
  workspaceId: z.string().min(1),
  botId: z.string().min(1),
  botUsername: z.string().min(1).nullable().optional(),
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  replyToMessageId: z.string().min(1).nullable(),
  userId: z.string().min(1),
  userDisplayName: z.string().min(1).nullable().optional(),
  text: z.string().min(1)
});

type TelegramRouteOptions = {
  telegramService: TelegramService;
};

function badRequest(message: string) {
  return { error: message };
}

export function registerTelegramRoutes(
  app: FastifyInstance,
  options: TelegramRouteOptions
) {
  app.get("/api/workspaces/:workspaceId/telegram/connection", async (request, reply) => {
    const params = request.params as { workspaceId?: string };

    if (!params.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const connection = await options.telegramService.getConnection(params.workspaceId);

    return reply.code(200).send({ connection });
  });

  app.put("/api/workspaces/:workspaceId/telegram/connection", async (request, reply) => {
    const params = request.params as { workspaceId?: string };
    const parsed = UpsertTelegramConnectionRequestSchema.safeParse(request.body);

    if (!params.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid Telegram connection payload."));
    }

    const connection = await options.telegramService.upsertConnection({
      workspaceId: params.workspaceId,
      ...parsed.data
    });

    return reply.code(200).send(MessagingConnectionSchema.parse(connection));
  });

  app.post("/api/telegram/updates", async (request, reply) => {
    const parsed = TelegramInboundRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid Telegram inbound payload."));
    }

    try {
      const handled = await options.telegramService.handlePollingUpdate(parsed.data);
      return reply.code(202).send(handled);
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(404).send(badRequest(error.message));
      }

      throw error;
    }
  });
}
