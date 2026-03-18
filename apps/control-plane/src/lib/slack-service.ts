import {
  type MessagingConnection,
  type MessagingInboundMessage
} from "@computer-oss/protocol";
import type { MessagingService } from "./messaging-service";

type SlackServiceOptions = {
  messagingService: MessagingService;
  now?: () => Date;
};

type SlackConnectionRequest = {
  workspaceId: string;
  enabled: boolean;
  accountLabel: string;
  externalWorkspaceId: string;
  externalWorkspaceLabel?: string | null;
};

type SlackInboundRequest = {
  workspaceId: string;
  teamId: string;
  teamName?: string | null;
  channelId: string;
  threadTs: string | null;
  eventTs: string;
  userId: string;
  userDisplayName?: string | null;
  text: string;
};

export type SlackService = {
  getConnection(workspaceId: string): Promise<MessagingConnection | null>;
  upsertConnection(input: SlackConnectionRequest): Promise<MessagingConnection>;
  handleSocketModeMessage(
    input: SlackInboundRequest
  ): Promise<{ accepted: true; outcomeId: string; created: boolean; duplicate: boolean }>;
  close(): void;
};

export function createSlackService(options: SlackServiceOptions): SlackService {
  const now = options.now ?? (() => new Date());

  return {
    async getConnection(workspaceId) {
      return options.messagingService.getConnection(workspaceId, "slack");
    },
    async upsertConnection(input) {
      return options.messagingService.upsertConnection({
        workspaceId: input.workspaceId,
        channel: "slack",
        enabled: input.enabled,
        accountLabel: input.accountLabel,
        externalWorkspaceId: input.externalWorkspaceId,
        externalWorkspaceLabel: input.externalWorkspaceLabel ?? null
      });
    },
    async handleSocketModeMessage(input) {
      const connection = await options.messagingService.getConnection(
        input.workspaceId,
        "slack"
      );

      if (!connection) {
        throw new Error(`Slack is not configured for workspace ${input.workspaceId}.`);
      }

      const threadId = input.threadTs ?? input.eventTs;
      const normalized: MessagingInboundMessage = {
        id: `inbound_slack_${input.eventTs}`,
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        channel: "slack",
        externalWorkspaceId: input.teamId,
        conversationId: input.channelId,
        threadId,
        externalMessageId: input.eventTs,
        senderId: input.userId,
        senderDisplayName: input.userDisplayName ?? null,
        text: input.text,
        receivedAt: now().toISOString(),
        dedupeKey: `slack:${input.workspaceId}:${input.teamId}:${input.channelId}:${threadId}:${input.eventTs}`
      };

      return options.messagingService.handleInboundMessage(normalized);
    },
    close() {}
  };
}
