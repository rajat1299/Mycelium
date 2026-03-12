import { describe, expect, it } from "vitest";
import { validatePlanGraph } from "./plan-graph";
import { createDeterministicDraftPlan } from "./planner";

describe("deterministic draft planner", () => {
  it("turns an outcome into a stable three-node draft plan", () => {
    const plan = createDeterministicDraftPlan({
      outcomeId: "outcome_123",
      prompt: "Draft launch notes and prepare the operator summary.",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z"
    });

    expect(plan.id).toBe("plan_outcome_123");
    expect(plan.status).toBe("draft");
    expect(plan.nodes).toEqual([
      {
        id: "plan_outcome_123:analyze-outcome",
        kind: "root",
        title: "Analyze outcome",
        capability: "reasoning"
      },
      {
        id: "plan_outcome_123:execute-outcome",
        kind: "task",
        title: "Execute outcome",
        capability: "coding"
      },
      {
        id: "plan_outcome_123:synthesize-result",
        kind: "synthesis",
        title: "Synthesize result",
        capability: "document"
      }
    ]);
    expect(plan.edges).toEqual([
      {
        id: "plan_outcome_123:edge-analyze-execute",
        from: "plan_outcome_123:analyze-outcome",
        to: "plan_outcome_123:execute-outcome"
      },
      {
        id: "plan_outcome_123:edge-execute-synthesize",
        from: "plan_outcome_123:execute-outcome",
        to: "plan_outcome_123:synthesize-result"
      }
    ]);
    expect(validatePlanGraph(plan)).toEqual({ ok: true });
  });

  it("namespaces node and edge ids so different outcomes do not collide", () => {
    const firstPlan = createDeterministicDraftPlan({
      outcomeId: "outcome_123",
      prompt: "First outcome",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z"
    });
    const secondPlan = createDeterministicDraftPlan({
      outcomeId: "outcome_456",
      prompt: "Second outcome",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z"
    });

    expect(new Set(firstPlan.nodes.map((node) => node.id))).not.toEqual(
      new Set(secondPlan.nodes.map((node) => node.id))
    );
    expect(new Set(firstPlan.edges.map((edge) => edge.id))).not.toEqual(
      new Set(secondPlan.edges.map((edge) => edge.id))
    );
  });
});
