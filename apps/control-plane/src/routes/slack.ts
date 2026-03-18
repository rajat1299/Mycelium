import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MessagingConnectionSchema } from "@computer-oss/protocol";
import type { SlackService } from "../lib/slack-service";

const UpsertSlackConnectionRequestSchema = z.object({
  enabled: z.boolean(),
  accountLabel: z.string().min(1),
  externalWorkspaceId: z.string().min(1),
  externalWorkspaceLabel: z.string().min(1).nullable().optional()
});

const SlackInboundRequestSchema = z.object({
  workspaceId: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().min(1).nullable().optional(),
  channelId: z.string().min(1),
  threadTs: z.string().min(1).nullable(),
  eventTs: z.string().min(1),
  userId: z.string().min(1),
  userDisplayName: z.string().min(1).nullable().optional(),
  text: z.string().min(1)
});

type SlackRouteOptions = {
  slackService: SlackService;
};

function badRequest(message: string) {
  return { error: message };
}

export function registerSlackRoutes(
  app: FastifyInstance,
  options: SlackRouteOptions
) {
  app.get("/api/workspaces/:workspaceId/slack/connection", async (request, reply) => {
    const params = request.params as { workspaceId?: string };

    if (!params.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const connection = await options.slackService.getConnection(params.workspaceId);

    return reply.code(200).send({ connection });
  });

  app.put("/api/workspaces/:workspaceId/slack/connection", async (request, reply) => {
    const params = request.params as { workspaceId?: string };
    const parsed = UpsertSlackConnectionRequestSchema.safeParse(request.body);

    if (!params.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid Slack connection payload."));
    }

    const connection = await options.slackService.upsertConnection({
      workspaceId: params.workspaceId,
      ...parsed.data
    });

    return reply.code(200).send(MessagingConnectionSchema.parse(connection));
  });

  app.post("/api/slack/socket-mode/messages", async (request, reply) => {
    const parsed = SlackInboundRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid Slack inbound payload."));
    }

    try {
      const handled = await options.slackService.handleSocketModeMessage(parsed.data);
      return reply.code(202).send(handled);
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(404).send(badRequest(error.message));
      }

      throw error;
    }
  });
}
