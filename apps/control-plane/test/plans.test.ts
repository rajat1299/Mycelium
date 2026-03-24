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
    expect(createdPlan.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Analyze outcome",
          instruction: "Inspect the outcome prompt and capture execution notes.",
          template: "analyze_outcome",
          expectedArtifactPath: "artifacts/analyze-outcome.md",
          expectedArtifactKind: "analysis"
        }),
        expect.objectContaining({
          title: "Synthesize result",
          instruction: "Combine the brief and operator summary into the final result.",
          template: "synthesize_result",
          expectedArtifactPath: "artifacts/final-result.md",
          expectedArtifactKind: "result"
        })
      ])
    );

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

  it("returns the latest persisted plan snapshot for an outcome", async () => {
    const app = buildApp();

    const createOutcome = await app.inject({
      method: "POST",
      url: "/api/outcomes",
      payload: {
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft the first plan.",
        source: "web"
      }
    });
    const outcome = createOutcome.json();

    await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/messages`,
      payload: {
        role: "user",
        content: "First turn"
      }
    });
    const firstPlanResponse = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });
    const firstPlan = PlanSchema.parse(firstPlanResponse.json());

    await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/messages`,
      payload: {
        role: "user",
        content: "Second turn"
      }
    });
    const secondPlanResponse = await app.inject({
      method: "POST",
      url: `/api/outcomes/${outcome.id}/plan`
    });
    const secondPlan = PlanSchema.parse(secondPlanResponse.json());

    expect(secondPlan.id).not.toBe(firstPlan.id);
    expect(secondPlan.triggerMessageId).not.toBe(firstPlan.triggerMessageId);

    const latestPlan = await app.inject({
      method: "GET",
      url: `/api/outcomes/${outcome.id}/plan`
    });

    expect(latestPlan.statusCode).toBe(200);
    expect(PlanSchema.parse(latestPlan.json())).toEqual(secondPlan);
  });
});
