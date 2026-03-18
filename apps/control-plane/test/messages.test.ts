import { afterEach, describe, expect, it } from "vitest";
import {
  ExternalConversationBindingSchema,
  MessagingConnectionSchema,
  MessagingDeliverySchema
} from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createInMemoryServiceContainer } from "../src/lib/service-container";

const appsToClose = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    Array.from(appsToClose).map(async (app) => {
      appsToClose.delete(app);
      await app.close();
    })
  );
});

describe("message history and outbound delivery routes", () => {
  it("returns message-linked history for an outcome and delivers result updates back to the bound conversation", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:10:00.000Z"),
      slackTransport: {
        async deliver(delivery) {
          sentDeliveries.push({
            body: delivery.body,
            conversationId: delivery.conversationId,
            threadId: delivery.threadId
          });

          return {
            externalDeliveryId: `slack_delivery_${sentDeliveries.length}`
          };
        }
      }
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_123/slack/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      }
    });

    const inbound = await app.inject({
      method: "POST",
      url: "/api/slack/socket-mode/messages",
      payload: {
        workspaceId: "ws_123",
        teamId: "T123456",
        teamName: "Mycelium Ops",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });

    const outcomeId = inbound.json().outcomeId;

    const deliver = await app.inject({
      method: "POST",
      url: "/api/messages/deliveries",
      payload: {
        outcomeId,
        kind: "result_summary",
        body: "The launch brief is ready.",
        runId: null
      }
    });

    expect(deliver.statusCode).toBe(202);
    expect(MessagingDeliverySchema.parse(deliver.json())).toEqual(
      expect.objectContaining({
        outcomeId,
        channel: "slack",
        kind: "result_summary",
        status: "sent",
        conversationId: "C123456"
      })
    );

    const history = await app.inject({
      method: "GET",
      url: `/api/outcomes/${outcomeId}/messages/history`
    });

    expect(history.statusCode).toBe(200);
    const historyBody = history.json();
    const connection = MessagingConnectionSchema.parse(historyBody.connection);
    const bindings = historyBody.bindings.map((binding: unknown) =>
      ExternalConversationBindingSchema.parse(binding)
    );
    const deliveries = historyBody.deliveries.map((delivery: unknown) =>
      MessagingDeliverySchema.parse(delivery)
    );

    expect(connection).toEqual(
      expect.objectContaining({
        workspaceId: "ws_123",
        channel: "slack",
        transport: "socket_mode",
        status: "connected",
        enabled: true,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      })
    );
    expect(bindings).toEqual([
      expect.objectContaining({
        outcomeId,
        channel: "slack",
        externalWorkspaceId: "T123456",
        conversationId: "C123456",
        threadId: "1710763200.000100",
        lastInboundMessageId: "1710763200.000100",
        lastOutboundDeliveryId: expect.any(String)
      })
    ]);
    expect(deliveries).toEqual([
      expect.objectContaining({ kind: "status_update", outcomeId }),
      expect.objectContaining({ kind: "result_summary", outcomeId })
    ]);

    expect(sentDeliveries).toEqual([
      {
        body: expect.stringContaining("Outcome"),
        conversationId: "C123456",
        threadId: "1710763200.000100"
      },
      {
        body: "The launch brief is ready.",
        conversationId: "C123456",
        threadId: "1710763200.000100"
      }
    ]);
  });

  it("rejects outbound delivery when the bound connection has been disabled", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:11:00.000Z"),
      slackTransport: {
        async deliver(delivery) {
          sentDeliveries.push({
            body: delivery.body,
            conversationId: delivery.conversationId,
            threadId: delivery.threadId
          });

          return {
            externalDeliveryId: `slack_delivery_${sentDeliveries.length}`
          };
        }
      }
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_123/slack/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      }
    });

    const inbound = await app.inject({
      method: "POST",
      url: "/api/slack/socket-mode/messages",
      payload: {
        workspaceId: "ws_123",
        teamId: "T123456",
        teamName: "Mycelium Ops",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });
    const outcomeId = inbound.json().outcomeId;

    const disabled = await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_123/slack/connection",
      payload: {
        enabled: false,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      }
    });

    expect(disabled.statusCode).toBe(200);

    const deliver = await app.inject({
      method: "POST",
      url: "/api/messages/deliveries",
      payload: {
        outcomeId,
        kind: "result_summary",
        body: "The launch brief is ready.",
        runId: null
      }
    });

    expect(deliver.statusCode).toBe(404);
    expect(deliver.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("is disabled.")
      })
    );
    expect(sentDeliveries).toEqual([
      {
        body: expect.stringContaining("Outcome"),
        conversationId: "C123456",
        threadId: "1710763200.000100"
      }
    ]);
  });

  it("repairs missing conversation binding on retry after the first inbound fails post-append", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:12:00.000Z"),
      slackTransport: {
        async deliver(delivery) {
          sentDeliveries.push({
            body: delivery.body,
            conversationId: delivery.conversationId,
            threadId: delivery.threadId
          });

          return {
            externalDeliveryId: `slack_delivery_${sentDeliveries.length}`
          };
        }
      }
    });
    const originalBindConversation = services.repositories.messaging.bindConversation;
    let failBindOnce = true;
    services.repositories.messaging.bindConversation = async (input) => {
      if (failBindOnce) {
        failBindOnce = false;
        throw new Error("transient bind failure");
      }

      return originalBindConversation(input);
    };

    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_123/slack/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      }
    });

    const firstAttempt = await app.inject({
      method: "POST",
      url: "/api/slack/socket-mode/messages",
      payload: {
        workspaceId: "ws_123",
        teamId: "T123456",
        teamName: "Mycelium Ops",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });

    expect(firstAttempt.statusCode).toBe(404);
    expect(firstAttempt.json()).toEqual(
      expect.objectContaining({
        error: "transient bind failure"
      })
    );

    const retry = await app.inject({
      method: "POST",
      url: "/api/slack/socket-mode/messages",
      payload: {
        workspaceId: "ws_123",
        teamId: "T123456",
        teamName: "Mycelium Ops",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });

    expect(retry.statusCode).toBe(202);
    expect(retry.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: false,
        duplicate: false
      })
    );

    const outcomes = await services.repositories.outcomes.listByWorkspace("ws_123");
    expect(outcomes).toHaveLength(1);

    const binding = ExternalConversationBindingSchema.parse(
      await services.repositories.messaging.getBindingByExternalConversation({
        workspaceId: "ws_123",
        channel: "slack",
        externalWorkspaceId: "T123456",
        conversationId: "C123456",
        threadId: "1710763200.000100"
      })
    );

    expect(binding).toEqual(
      expect.objectContaining({
        outcomeId: outcomes[0]?.id,
        lastInboundMessageId: "1710763200.000100",
        lastOutboundDeliveryId: expect.any(String)
      })
    );
    expect(sentDeliveries).toHaveLength(1);
  });

  it("repairs missing status delivery on retry after the first inbound fails post-bind", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    let failDeliveryOnce = true;
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:13:00.000Z"),
      slackTransport: {
        async deliver(delivery) {
          if (failDeliveryOnce) {
            failDeliveryOnce = false;
            throw new Error("transient delivery failure");
          }

          sentDeliveries.push({
            body: delivery.body,
            conversationId: delivery.conversationId,
            threadId: delivery.threadId
          });

          return {
            externalDeliveryId: `slack_delivery_${sentDeliveries.length}`
          };
        }
      }
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_123/slack/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      }
    });

    const firstAttempt = await app.inject({
      method: "POST",
      url: "/api/slack/socket-mode/messages",
      payload: {
        workspaceId: "ws_123",
        teamId: "T123456",
        teamName: "Mycelium Ops",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });

    expect(firstAttempt.statusCode).toBe(202);
    expect(firstAttempt.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: true,
        duplicate: false
      })
    );

    const beforeRetry = ExternalConversationBindingSchema.parse(
      await services.repositories.messaging.getBindingByExternalConversation({
        workspaceId: "ws_123",
        channel: "slack",
        externalWorkspaceId: "T123456",
        conversationId: "C123456",
        threadId: "1710763200.000100"
      })
    );
    expect(beforeRetry.lastInboundMessageId).toBe("1710763200.000100");
    expect(beforeRetry.lastOutboundDeliveryId).toBeNull();

    const retry = await app.inject({
      method: "POST",
      url: "/api/slack/socket-mode/messages",
      payload: {
        workspaceId: "ws_123",
        teamId: "T123456",
        teamName: "Mycelium Ops",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });

    expect(retry.statusCode).toBe(202);
    expect(retry.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: false,
        duplicate: false
      })
    );

    const afterRetry = ExternalConversationBindingSchema.parse(
      await services.repositories.messaging.getBindingByExternalConversation({
        workspaceId: "ws_123",
        channel: "slack",
        externalWorkspaceId: "T123456",
        conversationId: "C123456",
        threadId: "1710763200.000100"
      })
    );
    expect(afterRetry.lastOutboundDeliveryId).toEqual(expect.any(String));
    expect(sentDeliveries).toEqual([
      {
        body: expect.stringContaining("Outcome"),
        conversationId: "C123456",
        threadId: "1710763200.000100"
      }
    ]);
  });
});
