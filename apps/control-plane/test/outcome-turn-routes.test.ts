import { describe, expect, it } from "vitest";
import { OutcomeTurnResponseSchema } from "@computer-oss/protocol";
import { createExecutionHarness } from "./execution-test-helpers";

describe("outcome turn routes", () => {
  it("starts and continues turns through the shared outcome turn service", async () => {
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
          prompt: "Draft the kickoff brief.",
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

      expect(started.triggerMessage.content).toBe("Draft the kickoff brief.");
      expect(started.run?.triggerMessageId).toBe(started.triggerMessage.id);

      const cont = await app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout milestones."
        }
      });

      expect(cont.statusCode).toBe(201);
      const continued = OutcomeTurnResponseSchema.parse(cont.json());

      expect(continued.outcome.id).toBe(started.outcome.id);
      expect(continued.triggerMessage.content).toBe(
        "Add the rollout milestones."
      );
      expect(continued.triggerMessage.id).not.toBe(started.triggerMessage.id);
      expect(continued.plan?.id).not.toBe(started.plan?.id);
      expect(continued.run?.id).not.toBe(started.run?.id);
      expect(continued.run?.triggerMessageId).toBe(continued.triggerMessage.id);
    } finally {
      await harness.cleanup();
    }
  });

  it("returns 409 when continuing while the latest run is still active", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true
    });

    try {
      const start = await harness.app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft the kickoff brief.",
          source: "web"
        }
      });

      const started = OutcomeTurnResponseSchema.parse(start.json());

      const cont = await harness.app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout milestones."
        }
      });

      expect(cont.statusCode).toBe(409);
      expect(cont.json()).toEqual({
        error: expect.stringContaining("active run")
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("returns 404 when continuing a missing outcome", async () => {
    const app = createExecutionHarness({ simulationMode: true });
    const harness = await app;

    try {
      const response = await harness.app.inject({
        method: "POST",
        url: "/api/outcomes/outcome_missing/continue",
        payload: {
          content: "Try again"
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Outcome outcome_missing not found."
      });
    } finally {
      await harness.cleanup();
    }
  });
});
