import { describe, expect, it } from "vitest";
import {
  OutcomeSchema,
  RunDetailSchema
} from "@computer-oss/protocol";
import {
  createExecutionHarness,
  createOutcomeAndPlan
} from "./execution-test-helpers";

describe("run routes", () => {
  it("creates a run, returns the queued snapshot, and execution completes in the background", async () => {
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

      expect(createRun.statusCode).toBe(201);
      const run = RunDetailSchema.parse(createRun.json());

      expect(run.planId).toBe(plan.id);
      expect(run.status).toBe("queued");
      expect(run.steps).toEqual([
        expect.objectContaining({
          title: "Analyze outcome",
          status: "ready",
          instruction: "Inspect the outcome prompt and capture execution notes.",
          template: "analyze_outcome",
          expectedArtifactPath: "artifacts/analyze-outcome.md",
          expectedArtifactKind: "analysis"
        }),
        expect.objectContaining({
          title: "Draft brief",
          status: "pending",
          expectedArtifactPath: "artifacts/brief.md",
          expectedArtifactKind: "brief"
        }),
        expect.objectContaining({
          title: "Draft operator summary",
          status: "pending",
          expectedArtifactPath: "artifacts/operator-summary.md",
          expectedArtifactKind: "operator_summary"
        }),
        expect.objectContaining({
          title: "Synthesize result",
          status: "pending",
          expectedArtifactPath: "artifacts/final-result.md",
          expectedArtifactKind: "result"
        })
      ]);

      await services.executionService.waitForRun(run.id);

      const readRun = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}`
      });

      expect(readRun.statusCode).toBe(200);
      expect(RunDetailSchema.parse(readRun.json())).toEqual(
        expect.objectContaining({
          id: run.id,
          status: "completed",
          steps: [
            expect.objectContaining({
              title: "Analyze outcome",
              status: "completed"
            }),
            expect.objectContaining({
              title: "Draft brief",
              status: "completed"
            }),
            expect.objectContaining({
              title: "Draft operator summary",
              status: "completed"
            }),
            expect.objectContaining({
              title: "Synthesize result",
              status: "completed"
            })
          ]
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("returns the latest persisted run for an outcome", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Re-open the queued execution timeline."
      );

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      const createdRun = RunDetailSchema.parse(createRun.json());
      await services.executionService.waitForRun(createdRun.id);

      const latestRun = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}/runs/latest`
      });

      expect(latestRun.statusCode).toBe(200);
      expect(RunDetailSchema.parse(latestRun.json())).toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "completed"
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("publishes queued, running, and completed lifecycle events when a run is created", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, events } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Prepare the launch follow-up tasks."
      );

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      const createdRun = RunDetailSchema.parse(createRun.json());
      await services.executionService.waitForRun(createdRun.id);

      const readOutcome = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}`
      });

      expect(readOutcome.statusCode).toBe(200);
      expect(OutcomeSchema.parse(readOutcome.json()).status).toBe("completed");

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: expect.objectContaining({
              id: outcome.id,
              status: "queued"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: expect.objectContaining({
              id: outcome.id,
              status: "running"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: expect.objectContaining({
              id: outcome.id,
              status: "completed"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.created",
            data: expect.objectContaining({
              id: createdRun.id,
              outcomeId: outcome.id,
              planId: plan.id
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.updated",
            data: expect.objectContaining({
              id: createdRun.id,
              status: "running"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.updated",
            data: expect.objectContaining({
              id: createdRun.id,
              status: "completed"
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });
});
