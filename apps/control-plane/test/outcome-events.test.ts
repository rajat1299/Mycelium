import { afterEach, describe, expect, it } from "vitest";
import type { OutcomeStreamEvent } from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createEventBus, formatSseEvent } from "../src/lib/event-bus";

const appsToClose = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    Array.from(appsToClose).map(async (app) => {
      appsToClose.delete(app);
      await app.close();
    })
  );
});

describe("formatSseEvent", () => {
  it("serializes a protocol event into SSE format", () => {
    const body = formatSseEvent({
      type: "outcome.updated",
      data: { id: "outcome_123", status: "running" }
    });

    expect(body).toContain("event: outcome.updated");
    expect(body).toContain('"status":"running"');
  });
});

describe("outcome events", () => {
  it("publishes create and message events", async () => {
    const eventBus = createEventBus();
    const events: OutcomeStreamEvent[] = [];
    const unsubscribe = eventBus.subscribeAll((event) => {
      events.push(event);
    });

    const app = buildApp({ eventBus });
    appsToClose.add(app);

    const create = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Prepare status update",
        source: "web"
      }
    });

    const outcome = create.json();

    await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/messages`,
      payload: {
        role: "user",
        content: "Lead with the most urgent blocker."
      }
    });

    unsubscribe();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcomeId: outcome.id,
          type: "outcome.updated"
        }),
        expect.objectContaining({
          outcomeId: outcome.id,
          type: "message.created"
        })
      ])
    );
  });

  it("streams message events over SSE", async () => {
    const eventBus = createEventBus();
    const app = buildApp({ eventBus });
    appsToClose.add(app);

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected an address object from Fastify.");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const create = await fetch(`${baseUrl}/api/outcomes`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Prepare status update",
        source: "web"
      })
    });

    const outcome = await create.json();

    const streamResponse = await fetch(`${baseUrl}/api/outcomes/${outcome.id}/events`);

    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");

    const reader = streamResponse.body?.getReader();

    if (!reader) {
      throw new Error("Expected a response body for SSE route.");
    }

    const initialChunk = await reader.read();

    expect(new TextDecoder().decode(initialChunk.value)).toContain(": connected");

    await fetch(`${baseUrl}/api/outcomes/${outcome.id}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: "user",
        content: "Lead with the most urgent blocker."
      })
    });

    const eventChunk = await reader.read();
    const chunkText = new TextDecoder().decode(eventChunk.value);

    expect(chunkText).toContain("event: message.created");
    expect(chunkText).toContain("Lead with the most urgent blocker.");

    await reader.cancel();
  });
});
