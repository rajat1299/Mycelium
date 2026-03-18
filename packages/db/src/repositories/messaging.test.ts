import { describe, expect, it } from "vitest";
import { MessagingRepository } from "./messaging";
import { createRepositoryTestDatabase } from "./test-database";

describe("MessagingRepository", () => {
  it("persists Slack and Telegram connection state transitions and keeps one live connection per workspace/channel", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new MessagingRepository(db as never);

    const slack = await repository.upsertConnection({
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
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    const telegram = await repository.upsertConnection({
      id: "connection_telegram_1",
      workspaceId: "ws_default",
      channel: "telegram",
      transport: "long_polling",
      status: "degraded",
      enabled: true,
      accountLabel: "Mycelium Bot",
      externalWorkspaceId: "bot:telegram",
      externalWorkspaceLabel: "Mycelium updates",
      connectedAt: "2026-03-17T12:01:00.000Z",
      lastInboundAt: "2026-03-17T12:10:00.000Z",
      lastOutboundAt: null,
      lastError: "Telegram long poll timed out; reconnecting.",
      updatedAt: "2026-03-17T12:10:00.000Z"
    });

    expect(slack.channel).toBe("slack");
    expect(telegram.transport).toBe("long_polling");

    const replacedSlack = await repository.upsertConnection({
      id: "connection_slack_2",
      workspaceId: "ws_default",
      channel: "slack",
      transport: "socket_mode",
      status: "connected",
      enabled: true,
      accountLabel: "Ops workspace",
      externalWorkspaceId: "T123456",
      externalWorkspaceLabel: "Mycelium Ops",
      connectedAt: "2026-03-17T12:11:00.000Z",
      lastInboundAt: "2026-03-17T12:12:00.000Z",
      lastOutboundAt: "2026-03-17T12:13:00.000Z",
      lastError: null,
      updatedAt: "2026-03-17T12:13:00.000Z"
    });

    expect(replacedSlack).toEqual(
      expect.objectContaining({
        id: "connection_slack_1",
        lastOutboundAt: "2026-03-17T12:13:00.000Z"
      })
    );
    expect(state.messagingConnections).toHaveLength(2);

    await expect(repository.listConnectionsByWorkspace("ws_default")).resolves.toEqual([
      expect.objectContaining({
        id: "connection_slack_1",
        channel: "slack"
      }),
      expect.objectContaining({
        id: "connection_telegram_1",
        channel: "telegram"
      })
    ]);
  });

  it("binds external conversations to outcomes and rejects rebinding the same conversation to a different outcome", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new MessagingRepository(db as never);

    state.outcomes.push({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Draft a launch brief",
      source: "slack",
      status: "draft",
      createdAt: new Date("2026-03-17T12:00:00.000Z"),
      updatedAt: new Date("2026-03-17T12:00:00.000Z")
    });
    state.outcomes.push({
      id: "outcome_456",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Continue the launch brief",
      source: "slack",
      status: "draft",
      createdAt: new Date("2026-03-17T12:01:00.000Z"),
      updatedAt: new Date("2026-03-17T12:01:00.000Z")
    });

    const connection = await repository.upsertConnection({
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
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    const binding = await repository.bindConversation({
      id: "binding_1",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      channel: "slack",
      connectionId: connection.id,
      externalWorkspaceId: "T123456",
      conversationId: "C123456",
      threadId: "1710763200.000100",
      lastInboundMessageId: "1710763200.000100",
      lastOutboundDeliveryId: null,
      createdAt: "2026-03-17T12:10:00.000Z",
      updatedAt: "2026-03-17T12:10:00.000Z"
    });

    expect(binding).toEqual(
      expect.objectContaining({
        outcomeId: "outcome_123",
        conversationId: "C123456"
      })
    );

    await expect(
      repository.getBindingByExternalConversation({
        workspaceId: "ws_default",
        channel: "slack",
        externalWorkspaceId: "T123456",
        conversationId: "C123456",
        threadId: "1710763200.000100"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "binding_1",
        outcomeId: "outcome_123"
      })
    );

    await expect(
      repository.bindConversation({
        id: "binding_2",
        workspaceId: "ws_default",
        outcomeId: "outcome_456",
        channel: "slack",
        connectionId: connection.id,
        externalWorkspaceId: "T123456",
        conversationId: "C123456",
        threadId: "1710763200.000100",
        lastInboundMessageId: "1710763300.000200",
        lastOutboundDeliveryId: null,
        createdAt: "2026-03-17T12:11:00.000Z",
        updatedAt: "2026-03-17T12:11:00.000Z"
      })
    ).rejects.toThrow(
      "Conversation slack:T123456:C123456:1710763200.000100 is already bound to outcome outcome_123."
    );

    expect(state.messagingConversationBindings).toHaveLength(1);
  });

  it("rejects bindings whose external workspace does not match the live connection", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new MessagingRepository(db as never);

    state.outcomes.push({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Draft a launch brief",
      source: "slack",
      status: "draft",
      createdAt: new Date("2026-03-17T12:00:00.000Z"),
      updatedAt: new Date("2026-03-17T12:00:00.000Z")
    });

    const connection = await repository.upsertConnection({
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
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    await expect(
      repository.bindConversation({
        id: "binding_1",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        channel: "slack",
        connectionId: connection.id,
        externalWorkspaceId: "T999999",
        conversationId: "C123456",
        threadId: "1710763200.000100",
        lastInboundMessageId: "1710763200.000100",
        lastOutboundDeliveryId: null,
        createdAt: "2026-03-17T12:10:00.000Z",
        updatedAt: "2026-03-17T12:10:00.000Z"
      })
    ).rejects.toThrow(
      "Messaging connection connection_slack_1 is authenticated to external workspace T123456, not T999999."
    );
  });
});
