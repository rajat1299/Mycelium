import { describe, expect, it } from "vitest";
import {
  RunDetailSchema,
  OutcomeSchema,
  type OutcomeStreamEvent
} from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createEventBus } from "../src/lib/event-bus";

describe("run routes", () => {
  it("creates a run from a persisted plan and fetches it with steps", async () => {
    const app = buildApp();

    const createOutcome = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Ship the launch brief and summary.",
        source: "web"
      }
    });

    const outcome = createOutcome.json();

    const createPlan = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    const plan = createPlan.json();

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
        instruction: "Write a concise execution brief using the analysis artifact.",
        template: "draft_brief",
        expectedArtifactPath: "artifacts/brief.md",
        expectedArtifactKind: "brief"
      }),
      expect.objectContaining({
        title: "Draft operator summary",
        status: "pending",
        instruction: "Write the operator-facing summary from the analysis artifact.",
        template: "draft_operator_summary",
        expectedArtifactPath: "artifacts/operator-summary.md",
        expectedArtifactKind: "operator_summary"
      }),
      expect.objectContaining({
        title: "Synthesize result",
        status: "pending",
        instruction: "Combine the brief and operator summary into the final result.",
        template: "synthesize_result",
        expectedArtifactPath: "artifacts/final-result.md",
        expectedArtifactKind: "result"
      })
    ]);

    const readRun = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}`
    });

    expect(readRun.statusCode).toBe(200);
    expect(RunDetailSchema.parse(readRun.json())).toEqual(run);
  });

  it("returns the latest persisted run for an outcome", async () => {
    const app = buildApp();

    const createOutcome = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Re-open the queued execution timeline.",
        source: "web"
      }
    });

    const outcome = createOutcome.json();

    const createPlan = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    const plan = createPlan.json();

    const createRun = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: plan.id
      }
    });

    const createdRun = RunDetailSchema.parse(createRun.json());

    const latestRun = await app.inject({
      method: "GET",
      url: `/api/outcomes/${outcome.id}/runs/latest`
    });

    expect(latestRun.statusCode).toBe(200);
    expect(RunDetailSchema.parse(latestRun.json())).toEqual(createdRun);
  });

  it("publishes run lifecycle events when a run is created", async () => {
    const eventBus = createEventBus();
    const events: OutcomeStreamEvent[] = [];
    const unsubscribe = eventBus.subscribeAll((event) => {
      events.push(event);
    });
    const app = buildApp({ eventBus });

    const createOutcome = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Prepare the launch follow-up tasks.",
        source: "web"
      }
    });

    const outcome = createOutcome.json();

    const createPlan = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    const plan = createPlan.json();

    await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/runs`,
      payload: {
        planId: plan.id
      }
    });

    unsubscribe();

    const readOutcome = await app.inject({
      method: "GET",
      url: `/api/outcomes/${outcome.id}`
    });

    expect(readOutcome.statusCode).toBe(200);
    expect(OutcomeSchema.parse(readOutcome.json()).status).toBe("queued");

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
          type: "run.created",
          data: expect.objectContaining({
            outcomeId: outcome.id,
            planId: plan.id
          })
        }),
        expect.objectContaining({
          outcomeId: outcome.id,
          type: "run.step.updated",
          data: expect.objectContaining({
            runId: expect.any(String),
            title: "Analyze outcome"
          })
        }),
        expect.objectContaining({
          outcomeId: outcome.id,
          type: "run.step.updated",
          data: expect.objectContaining({
            runId: expect.any(String),
            title: "Synthesize result"
          })
        })
      ])
    );
  });
});
