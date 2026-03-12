import { describe, expect, it } from "vitest";
import { RunDetailSchema } from "@computer-oss/protocol";
import {
  createExecutionHarness,
  createOutcomeAndPlan
} from "./execution-test-helpers";

describe("artifact routes", () => {
  it("lists persisted artifacts for a completed run", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      const response = await app.inject({
        method: "GET",
        url: `/api/runs/${createdRun.id}/artifacts`
      });
      const payload = response.json();

      expect(response.statusCode).toBe(200);
      expect(payload.artifacts).toHaveLength(4);
      expect(payload).toEqual({
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            runId: createdRun.id,
            kind: "analysis",
            relativePath: "artifacts/analyze-outcome.md"
          }),
          expect.objectContaining({
            runId: createdRun.id,
            kind: "brief",
            relativePath: "artifacts/brief.md"
          }),
          expect.objectContaining({
            runId: createdRun.id,
            kind: "operator_summary",
            relativePath: "artifacts/operator-summary.md"
          }),
          expect.objectContaining({
            runId: createdRun.id,
            kind: "result",
            relativePath: "artifacts/final-result.md"
          })
        ])
      });
    } finally {
      await harness.cleanup();
    }
  });
});
