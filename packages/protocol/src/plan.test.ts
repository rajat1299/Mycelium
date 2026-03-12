import { describe, expect, it } from "vitest";
import {
  EventTypeSchema,
  OutcomeStreamEventSchema,
  PlanSchema,
  RunDetailSchema
} from "./index";

describe("plan and run protocols", () => {
  it("accepts a valid draft plan payload", () => {
    const parsed = PlanSchema.safeParse({
      id: "plan_outcome_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "plan_outcome_123:analyze-outcome",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning",
          position: 0
        },
        {
          id: "plan_outcome_123:execute-outcome",
          kind: "task",
          title: "Execute outcome",
          capability: "coding",
          position: 1
        }
      ],
      edges: [
        {
          id: "plan_outcome_123:edge-analyze-execute",
          from: "plan_outcome_123:analyze-outcome",
          to: "plan_outcome_123:execute-outcome"
        }
      ]
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts run detail and expanded outcome stream events", () => {
    const run = RunDetailSchema.parse({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "queued",
      createdAt: "2026-03-11T00:05:00.000Z",
      updatedAt: "2026-03-11T00:05:00.000Z",
      steps: [
        {
          id: "step_run_123_plan_outcome_123:analyze-outcome",
          runId: "run_123",
          planNodeId: "plan_outcome_123:analyze-outcome",
          title: "Analyze outcome",
          kind: "root",
          capability: "reasoning",
          status: "ready",
          position: 0,
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z"
        }
      ]
    });

    expect(run.steps).toHaveLength(1);
    expect(EventTypeSchema.parse("plan.created")).toBe("plan.created");
    expect(EventTypeSchema.parse("run.created")).toBe("run.created");
    expect(EventTypeSchema.parse("run.step.updated")).toBe("run.step.updated");

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "plan.created",
        data: {
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-11T00:00:00.000Z",
          updatedAt: "2026-03-11T00:00:00.000Z",
          nodes: [],
          edges: []
        }
      })
    ).toEqual(
      expect.objectContaining({
        type: "plan.created"
      })
    );

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "run.created",
        data: {
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z"
        }
      })
    ).toEqual(
      expect.objectContaining({
        type: "run.created"
      })
    );

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "run.step.updated",
        data: run.steps[0]
      })
    ).toEqual(
      expect.objectContaining({
        type: "run.step.updated"
      })
    );
  });
});
