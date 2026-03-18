import { afterEach, describe, expect, it } from "vitest";
import {
  ExternalConversationBindingSchema,
  MessagingConnectionSchema
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

describe("slack routes and runtime", () => {
  it("upserts workspace Slack connections and normalizes Socket Mode messages idempotently", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:00:00.000Z"),
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

    const configure = await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_123/slack/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops workspace",
        externalWorkspaceId: "T123456",
        externalWorkspaceLabel: "Mycelium Ops"
      }
    });

    expect(configure.statusCode).toBe(200);
    const connection = MessagingConnectionSchema.parse(configure.json());
    expect(connection).toEqual(
      expect.objectContaining({
        workspaceId: "ws_123",
        channel: "slack",
        transport: "socket_mode",
        status: "connected",
        externalWorkspaceId: "T123456"
      })
    );

    const first = await app.inject({
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

    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: true,
        duplicate: false
      })
    );

    const second = await app.inject({
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

    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: false,
        duplicate: true,
        outcomeId: first.json().outcomeId
      })
    );

    const outcomes = await services.repositories.outcomes.listByWorkspace("ws_123");
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        id: first.json().outcomeId,
        source: "slack",
        prompt: "Draft the launch brief"
      })
    );

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
        outcomeId: first.json().outcomeId,
        lastInboundMessageId: "1710763200.000100"
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

  it("rejects wrong-team Socket Mode messages before creating outcome state", async () => {
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:01:00.000Z")
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
        teamId: "T999999",
        teamName: "Wrong Team",
        channelId: "C123456",
        threadTs: "1710763200.000100",
        eventTs: "1710763200.000100",
        userId: "U123456",
        userDisplayName: "Rajat",
        text: "Draft the launch brief"
      }
    });

    expect(inbound.statusCode).toBe(404);
    expect(inbound.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(
          "is authenticated to external workspace T123456, not T999999."
        )
      })
    );
    await expect(
      services.repositories.outcomes.listByWorkspace("ws_123")
    ).resolves.toEqual([]);
  });
});
