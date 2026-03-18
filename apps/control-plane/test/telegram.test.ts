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

describe("telegram routes and runtime", () => {
  it("upserts workspace Telegram connections and continues bound chats through long-polling updates", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:05:00.000Z"),
      telegramTransport: {
        async deliver(delivery) {
          sentDeliveries.push({
            body: delivery.body,
            conversationId: delivery.conversationId,
            threadId: delivery.threadId
          });

          return {
            externalDeliveryId: `telegram_delivery_${sentDeliveries.length}`
          };
        }
      }
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    const configure = await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_456/telegram/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops bot",
        externalWorkspaceId: "bot:telegram_ops",
        externalWorkspaceLabel: "Mycelium Telegram Bot"
      }
    });

    expect(configure.statusCode).toBe(200);
    expect(MessagingConnectionSchema.parse(configure.json())).toEqual(
      expect.objectContaining({
        workspaceId: "ws_456",
        channel: "telegram",
        transport: "long_polling",
        status: "connected",
        externalWorkspaceId: "bot:telegram_ops"
      })
    );

    const first = await app.inject({
      method: "POST",
      url: "/api/telegram/updates",
      payload: {
        workspaceId: "ws_456",
        botId: "bot:telegram_ops",
        botUsername: "mycelium_ops_bot",
        chatId: "99887766",
        messageId: "111",
        replyToMessageId: null,
        userId: "tg_user_123",
        userDisplayName: "Rajat",
        text: "Summarize the release train"
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
      url: "/api/telegram/updates",
      payload: {
        workspaceId: "ws_456",
        botId: "bot:telegram_ops",
        botUsername: "mycelium_ops_bot",
        chatId: "99887766",
        messageId: "112",
        replyToMessageId: null,
        userId: "tg_user_123",
        userDisplayName: "Rajat",
        text: "Also include risks"
      }
    });

    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: false,
        duplicate: false,
        outcomeId: first.json().outcomeId
      })
    );

    const outcomes = await services.repositories.outcomes.listByWorkspace("ws_456");
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        id: first.json().outcomeId,
        source: "telegram"
      })
    );

    const binding = ExternalConversationBindingSchema.parse(
      await services.repositories.messaging.getBindingByExternalConversation({
        workspaceId: "ws_456",
        channel: "telegram",
        externalWorkspaceId: "bot:telegram_ops",
        conversationId: "99887766",
        threadId: null
      })
    );

    expect(binding).toEqual(
      expect.objectContaining({
        outcomeId: first.json().outcomeId,
        lastInboundMessageId: "112"
      })
    );

    expect(sentDeliveries).toHaveLength(2);
    expect(sentDeliveries[0]?.conversationId).toBe("99887766");
    expect(sentDeliveries[1]?.body).toEqual(expect.stringContaining("Outcome"));
  });

  it("rejects wrong-bot Telegram updates before creating outcome state", async () => {
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:06:00.000Z")
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_456/telegram/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops bot",
        externalWorkspaceId: "bot:telegram_ops",
        externalWorkspaceLabel: "Mycelium Telegram Bot"
      }
    });

    const inbound = await app.inject({
      method: "POST",
      url: "/api/telegram/updates",
      payload: {
        workspaceId: "ws_456",
        botId: "bot:telegram_other",
        botUsername: "other_bot",
        chatId: "99887766",
        messageId: "111",
        replyToMessageId: null,
        userId: "tg_user_123",
        userDisplayName: "Rajat",
        text: "Summarize the release train"
      }
    });

    expect(inbound.statusCode).toBe(404);
    expect(inbound.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(
          "is authenticated to external workspace bot:telegram_ops, not bot:telegram_other."
        )
      })
    );
    await expect(
      services.repositories.outcomes.listByWorkspace("ws_456")
    ).resolves.toEqual([]);
  });

  it("treats retries of older Telegram messages as duplicates after newer messages arrive", async () => {
    const sentDeliveries: Array<{ body: string; conversationId: string; threadId: string | null }> = [];
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T15:07:00.000Z"),
      telegramTransport: {
        async deliver(delivery) {
          sentDeliveries.push({
            body: delivery.body,
            conversationId: delivery.conversationId,
            threadId: delivery.threadId
          });

          return {
            externalDeliveryId: `telegram_delivery_${sentDeliveries.length}`
          };
        }
      }
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "PUT",
      url: "/api/workspaces/ws_456/telegram/connection",
      payload: {
        enabled: true,
        accountLabel: "Ops bot",
        externalWorkspaceId: "bot:telegram_ops",
        externalWorkspaceLabel: "Mycelium Telegram Bot"
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/telegram/updates",
      payload: {
        workspaceId: "ws_456",
        botId: "bot:telegram_ops",
        botUsername: "mycelium_ops_bot",
        chatId: "99887766",
        messageId: "111",
        replyToMessageId: null,
        userId: "tg_user_123",
        userDisplayName: "Rajat",
        text: "Summarize the release train"
      }
    });

    const newer = await app.inject({
      method: "POST",
      url: "/api/telegram/updates",
      payload: {
        workspaceId: "ws_456",
        botId: "bot:telegram_ops",
        botUsername: "mycelium_ops_bot",
        chatId: "99887766",
        messageId: "112",
        replyToMessageId: null,
        userId: "tg_user_123",
        userDisplayName: "Rajat",
        text: "Also include risks"
      }
    });

    const retriedOld = await app.inject({
      method: "POST",
      url: "/api/telegram/updates",
      payload: {
        workspaceId: "ws_456",
        botId: "bot:telegram_ops",
        botUsername: "mycelium_ops_bot",
        chatId: "99887766",
        messageId: "111",
        replyToMessageId: null,
        userId: "tg_user_123",
        userDisplayName: "Rajat",
        text: "Summarize the release train"
      }
    });

    expect(newer.statusCode).toBe(202);
    expect(retriedOld.statusCode).toBe(202);
    expect(retriedOld.json()).toEqual(
      expect.objectContaining({
        accepted: true,
        created: false,
        duplicate: true,
        outcomeId: newer.json().outcomeId
      })
    );

    const binding = ExternalConversationBindingSchema.parse(
      await services.repositories.messaging.getBindingByExternalConversation({
        workspaceId: "ws_456",
        channel: "telegram",
        externalWorkspaceId: "bot:telegram_ops",
        conversationId: "99887766",
        threadId: null
      })
    );

    expect(binding.lastInboundMessageId).toBe("112");
    expect(sentDeliveries).toHaveLength(2);
  });
});
