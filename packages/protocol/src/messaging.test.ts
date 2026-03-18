import { describe, expect, it } from "vitest";
import {
  EventTypeSchema,
  ExternalConversationBindingSchema,
  MessagingConnectionSchema,
  MessagingDeliverySchema,
  MessagingInboundMessageSchema,
  OutcomeStreamEventSchema
} from "./index";

describe("messaging protocol contracts", () => {
  it("accepts Slack and Telegram connection state plus durable conversation identity", () => {
    const slackConnection = MessagingConnectionSchema.parse({
      id: "connection_slack_1",
      workspaceId: "ws_default",
      channel: "slack",
      transport: "socket_mode",
      status: "connected",
      enabled: true,
      accountLabel: "Ops workspace",
      externalWorkspaceId: "T123456",
      externalWorkspaceLabel: "Mycelium Ops",
      connectedAt: "2026-03-17T12:00:00.000Z",
      lastInboundAt: "2026-03-17T12:10:00.000Z",
      lastOutboundAt: "2026-03-17T12:11:00.000Z",
      lastError: null,
      updatedAt: "2026-03-17T12:11:00.000Z"
    });

    const telegramConnection = MessagingConnectionSchema.parse({
      id: "connection_telegram_1",
      workspaceId: "ws_default",
      channel: "telegram",
      transport: "long_polling",
      status: "degraded",
      enabled: true,
      accountLabel: "Mycelium Bot",
      externalWorkspaceId: "bot:telegram",
      externalWorkspaceLabel: "Mycelium updates",
      connectedAt: "2026-03-17T12:00:00.000Z",
      lastInboundAt: "2026-03-17T12:10:00.000Z",
      lastOutboundAt: null,
      lastError: "Telegram long poll timed out; reconnecting.",
      updatedAt: "2026-03-17T12:11:00.000Z"
    });

    const binding = ExternalConversationBindingSchema.parse({
      id: "binding_1",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      channel: "slack",
      connectionId: slackConnection.id,
      externalWorkspaceId: "T123456",
      conversationId: "C123456",
      threadId: "1710763200.000100",
      lastInboundMessageId: "1710763200.000100",
      lastOutboundDeliveryId: "delivery_1",
      createdAt: "2026-03-17T12:10:00.000Z",
      updatedAt: "2026-03-17T12:11:00.000Z"
    });

    expect(slackConnection.transport).toBe("socket_mode");
    expect(telegramConnection.transport).toBe("long_polling");
    expect(binding.channel).toBe("slack");
  });

  it("accepts inbound message payloads, outbound deliveries, and messaging SSE events", () => {
    const inboundMessage = MessagingInboundMessageSchema.parse({
      id: "message_1",
      workspaceId: "ws_default",
      connectionId: "connection_slack_1",
      channel: "slack",
      externalWorkspaceId: "T123456",
      conversationId: "C123456",
      threadId: "1710763200.000100",
      externalMessageId: "1710763200.000100",
      senderId: "U123456",
      senderDisplayName: "Raj",
      text: "Status update for the daily brief",
      receivedAt: "2026-03-17T12:10:00.000Z",
      dedupeKey: "slack:T123456:C123456:1710763200.000100"
    });

    const delivery = MessagingDeliverySchema.parse({
      id: "delivery_1",
      workspaceId: "ws_default",
      connectionId: "connection_slack_1",
      channel: "slack",
      externalWorkspaceId: "T123456",
      conversationId: "C123456",
      threadId: "1710763200.000100",
      kind: "result_summary",
      status: "sent",
      body: "Daily brief finished. Review is available in the web desk.",
      outcomeId: "outcome_123",
      runId: "run_123",
      sentAt: "2026-03-17T12:11:00.000Z",
      lastAttemptAt: "2026-03-17T12:11:00.000Z",
      errorMessage: null
    });

    expect(EventTypeSchema.parse("messaging.connection.updated")).toBe(
      "messaging.connection.updated"
    );
    expect(EventTypeSchema.parse("messaging.delivery.updated")).toBe(
      "messaging.delivery.updated"
    );

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "messaging.connection.updated",
        data: {
          id: "connection_slack_1",
          workspaceId: "ws_default",
          channel: "slack",
          transport: "socket_mode",
          status: "connected",
          enabled: true,
          accountLabel: "Ops workspace",
          externalWorkspaceId: "T123456",
          externalWorkspaceLabel: "Mycelium Ops",
          connectedAt: "2026-03-17T12:00:00.000Z",
          lastInboundAt: "2026-03-17T12:10:00.000Z",
          lastOutboundAt: "2026-03-17T12:11:00.000Z",
          lastError: null,
          updatedAt: "2026-03-17T12:11:00.000Z"
        }
      })
    ).toEqual(expect.objectContaining({ type: "messaging.connection.updated" }));

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "messaging.delivery.updated",
        data: delivery
      })
    ).toEqual(expect.objectContaining({ type: "messaging.delivery.updated" }));

    expect(inboundMessage.channel).toBe("slack");
  });
});
