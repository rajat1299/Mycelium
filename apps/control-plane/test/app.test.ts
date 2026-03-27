import { describe, expect, it } from "vitest";
import {
  OutcomeThreadSnapshotSchema,
  OutcomeTurnResponseSchema
} from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createExecutionHarness } from "./execution-test-helpers";

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

  it("starts and continues an outcome turn", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true
    });

    try {
      const { app } = harness;

      const start = await app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft a project kickoff brief",
          source: "web"
        }
      });

      expect(start.statusCode).toBe(201);
      const started = OutcomeTurnResponseSchema.parse(start.json());

      await harness.services.repositories.runs.updateStatus({
        runId: started.run?.id ?? "",
        status: "completed",
        updatedAt: "2026-03-24T12:15:00.000Z"
      });

      const cont = await app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout notes.",
          submissionId: "submit_123"
        }
      });

      expect(cont.statusCode).toBe(201);
      expect(OutcomeTurnResponseSchema.parse(cont.json())).toEqual(
        expect.objectContaining({
          outcome: expect.objectContaining({
            id: started.outcome.id
          })
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("returns 404 for a missing outcome thread snapshot", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/outcomes/outcome_missing/thread"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Outcome not found."
    });
  });

  it("returns a schema-valid outcome thread snapshot", async () => {
    const harness = await createExecutionHarness({
      simulationMode: false
    });

    harness.services.executionService.startRun = async () => undefined;

    try {
      const start = await harness.app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft a project kickoff brief",
          source: "web"
        }
      });

      const started = OutcomeTurnResponseSchema.parse(start.json());

      const thread = await harness.app.inject({
        method: "GET",
        url: `/api/outcomes/${started.outcome.id}/thread`
      });

      expect(thread.statusCode).toBe(200);
      const rawThread = thread.json();

      expect(rawThread).toHaveProperty("presentationHints");
      expect(rawThread.presentationHints).toEqual([]);

      expect(OutcomeThreadSnapshotSchema.parse(rawThread)).toEqual(
        expect.objectContaining({
          outcome: expect.objectContaining({
            id: started.outcome.id
          }),
          messages: [
            expect.objectContaining({
              id: started.triggerMessage.id
            })
          ],
          presentationHints: []
        })
      );
    } finally {
      await harness.cleanup();
    }
  });
});
