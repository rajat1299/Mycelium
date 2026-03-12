import { describe, expect, it } from "vitest";
import {
  RunDetailSchema,
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
        status: "ready"
      }),
      expect.objectContaining({
        title: "Execute outcome",
        status: "pending"
      }),
      expect.objectContaining({
        title: "Synthesize result",
        status: "pending"
      })
    ]);

    const readRun = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}`
    });

    expect(readRun.statusCode).toBe(200);
    expect(RunDetailSchema.parse(readRun.json())).toEqual(run);
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

    expect(events).toEqual(
      expect.arrayContaining([
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
