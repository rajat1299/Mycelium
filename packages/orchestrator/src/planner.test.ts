import { describe, expect, it } from "vitest";
import { validatePlanGraph } from "./plan-graph";
import { createDeterministicDraftPlan } from "./planner";

describe("deterministic draft planner", () => {
  it("turns an outcome into a stable executable fork-join draft plan", () => {
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
        capability: "reasoning",
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      },
      {
        id: "plan_outcome_123:draft-brief",
        kind: "task",
        title: "Draft brief",
        capability: "document",
        instruction: "Write a concise execution brief using the analysis artifact.",
        template: "draft_brief",
        expectedArtifactPath: "artifacts/brief.md",
        expectedArtifactKind: "brief"
      },
      {
        id: "plan_outcome_123:draft-operator-summary",
        kind: "task",
        title: "Draft operator summary",
        capability: "document",
        instruction: "Write the operator-facing summary from the analysis artifact.",
        template: "draft_operator_summary",
        expectedArtifactPath: "artifacts/operator-summary.md",
        expectedArtifactKind: "operator_summary"
      },
      {
        id: "plan_outcome_123:synthesize-result",
        kind: "synthesis",
        title: "Synthesize result",
        capability: "document",
        instruction: "Combine the brief and operator summary into the final result.",
        template: "synthesize_result",
        expectedArtifactPath: "artifacts/final-result.md",
        expectedArtifactKind: "result"
      }
    ]);
    expect(plan.edges).toEqual([
      {
        id: "plan_outcome_123:edge-analyze-brief",
        from: "plan_outcome_123:analyze-outcome",
        to: "plan_outcome_123:draft-brief"
      },
      {
        id: "plan_outcome_123:edge-analyze-operator-summary",
        from: "plan_outcome_123:analyze-outcome",
        to: "plan_outcome_123:draft-operator-summary"
      },
      {
        id: "plan_outcome_123:edge-brief-synthesize",
        from: "plan_outcome_123:draft-brief",
        to: "plan_outcome_123:synthesize-result"
      },
      {
        id: "plan_outcome_123:edge-operator-summary-synthesize",
        from: "plan_outcome_123:draft-operator-summary",
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
