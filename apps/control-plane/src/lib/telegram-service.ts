import {
  type MessagingConnection,
  type MessagingInboundMessage
} from "@computer-oss/protocol";
import type { MessagingService } from "./messaging-service";

type TelegramServiceOptions = {
  messagingService: MessagingService;
  now?: () => Date;
};

type TelegramConnectionRequest = {
  workspaceId: string;
  enabled: boolean;
  accountLabel: string;
  externalWorkspaceId: string;
  externalWorkspaceLabel?: string | null;
};

type TelegramInboundRequest = {
  workspaceId: string;
  botId: string;
  botUsername?: string | null;
  chatId: string;
  messageId: string;
  replyToMessageId: string | null;
  userId: string;
  userDisplayName?: string | null;
  text: string;
};

export type TelegramService = {
  getConnection(workspaceId: string): Promise<MessagingConnection | null>;
  upsertConnection(input: TelegramConnectionRequest): Promise<MessagingConnection>;
  handlePollingUpdate(
    input: TelegramInboundRequest
  ): Promise<{ accepted: true; outcomeId: string; created: boolean; duplicate: boolean }>;
  close(): void;
};

export function createTelegramService(
  options: TelegramServiceOptions
): TelegramService {
  const now = options.now ?? (() => new Date());

  return {
    async getConnection(workspaceId) {
      return options.messagingService.getConnection(workspaceId, "telegram");
    },
    async upsertConnection(input) {
      return options.messagingService.upsertConnection({
        workspaceId: input.workspaceId,
        channel: "telegram",
        enabled: input.enabled,
        accountLabel: input.accountLabel,
        externalWorkspaceId: input.externalWorkspaceId,
        externalWorkspaceLabel: input.externalWorkspaceLabel ?? null
      });
    },
    async handlePollingUpdate(input) {
      const connection = await options.messagingService.getConnection(
        input.workspaceId,
        "telegram"
      );

      if (!connection) {
        throw new Error(`Telegram is not configured for workspace ${input.workspaceId}.`);
      }

      const normalized: MessagingInboundMessage = {
        id: `inbound_telegram_${input.messageId}`,
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        channel: "telegram",
        externalWorkspaceId: input.botId,
        conversationId: input.chatId,
        threadId: null,
        externalMessageId: input.messageId,
        senderId: input.userId,
        senderDisplayName: input.userDisplayName ?? null,
        text: input.text,
        receivedAt: now().toISOString(),
        dedupeKey: `telegram:${input.botId}:${input.chatId}:${input.messageId}`
      };

      return options.messagingService.handleInboundMessage(normalized);
    },
    close() {}
  };
}
