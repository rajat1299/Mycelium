import { describe, expect, it } from "vitest";
import {
  PlanSchema,
  type OutcomeStreamEvent
} from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createEventBus } from "../src/lib/event-bus";

describe("plan routes", () => {
  it("generates a draft plan for an outcome and reads it back", async () => {
    const app = buildApp();

    const createOutcome = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft the customer launch summary and supporting notes.",
        source: "web"
      }
    });

    const outcome = createOutcome.json();

    const generatePlan = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    expect(generatePlan.statusCode).toBe(201);
    const createdPlan = PlanSchema.parse(generatePlan.json());

    expect(createdPlan.outcomeId).toBe(outcome.id);
    expect(createdPlan.nodes.map((node) => node.title)).toEqual([
      "Analyze outcome",
      "Draft brief",
      "Draft operator summary",
      "Synthesize result"
    ]);

    const readPlan = await app.inject({
      method: "GET",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    expect(readPlan.statusCode).toBe(200);
    expect(PlanSchema.parse(readPlan.json())).toEqual(createdPlan);
  });

  it("publishes a plan.created event when a draft plan is generated", async () => {
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
        prompt: "Plan the internal launch checklist.",
        source: "web"
      }
    });

    const outcome = createOutcome.json();

    await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    unsubscribe();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcomeId: outcome.id,
          type: "plan.created",
          data: expect.objectContaining({
            outcomeId: outcome.id
          })
        })
      ])
    );
  });
});
