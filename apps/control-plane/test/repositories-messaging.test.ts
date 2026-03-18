import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

describe("in-memory messaging repositories", () => {
  it("stores one live connection per workspace/channel and rejects conversation rebinding across outcomes", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.outcomes.create({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Draft a launch brief",
      source: "slack"
    });
    await repositories.outcomes.create({
      id: "outcome_456",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Continue the launch brief",
      source: "slack"
    });

    await repositories.messaging.upsertConnection({
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
    const connection = await repositories.messaging.upsertConnection({
      id: "connection_slack_2",
      workspaceId: "ws_default",
      channel: "slack",
      transport: "socket_mode",
      status: "connected",
      enabled: true,
      accountLabel: "Ops workspace",
      externalWorkspaceId: "T123456",
      externalWorkspaceLabel: "Mycelium Ops",
      connectedAt: "2026-03-17T12:10:00.000Z",
      lastInboundAt: "2026-03-17T12:11:00.000Z",
      lastOutboundAt: "2026-03-17T12:12:00.000Z",
      lastError: null,
      updatedAt: "2026-03-17T12:12:00.000Z"
    });

    await expect(
      repositories.messaging.listConnectionsByWorkspace("ws_default")
    ).resolves.toEqual([
      expect.objectContaining({
        id: "connection_slack_1",
        channel: "slack"
      })
    ]);

    await repositories.messaging.bindConversation({
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

    await expect(
      repositories.messaging.bindConversation({
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
  });

  it("rejects bindings whose external workspace does not match the connection session", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.outcomes.create({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Draft a launch brief",
      source: "slack"
    });

    const connection = await repositories.messaging.upsertConnection({
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
      repositories.messaging.bindConversation({
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
