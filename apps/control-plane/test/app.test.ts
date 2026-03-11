import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("control plane", () => {
  it("returns a health response", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("creates and fetches an outcome", async () => {
    const app = buildApp();

    const create = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft a project kickoff brief",
        source: "web"
      }
    });

    expect(create.statusCode).toBe(201);
    const created = create.json();

    const read = await app.inject({
      method: "GET",
      url: `/api/outcomes/${created.id}`
    });

    expect(read.statusCode).toBe(200);
    expect(read.json().prompt).toBe("Draft a project kickoff brief");
  });

  it("lists outcomes for a workspace", async () => {
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "First outcome",
        source: "web"
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_456",
        userId: "user_123",
        prompt: "Second outcome",
        source: "web"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/outcomes?workspaceId=ws_123"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcomes: [
        expect.objectContaining({
          prompt: "First outcome",
          workspaceId: "ws_123"
        })
      ]
    });
  });

  it("appends a message to an outcome", async () => {
    const app = buildApp();

    const create = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Review the launch checklist",
        source: "web"
      }
    });

    const outcome = create.json();

    const response = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/messages`,
      payload: {
        role: "user",
        content: "Please prioritize blocker items first."
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true });
  });
});
