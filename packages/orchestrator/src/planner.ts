import type { PlanGraph } from "./plan-graph";

export type CreateDeterministicDraftPlanInput = {
  outcomeId: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export function createDeterministicDraftPlan(
  input: CreateDeterministicDraftPlanInput
): PlanGraph {
  void input.prompt;
  const planId = `plan_${input.outcomeId}`;
  const analyzeNodeId = `${planId}:analyze-outcome`;
  const draftBriefNodeId = `${planId}:draft-brief`;
  const draftOperatorSummaryNodeId = `${planId}:draft-operator-summary`;
  const synthesizeNodeId = `${planId}:synthesize-result`;

  return {
    id: planId,
    outcomeId: input.outcomeId,
    status: "draft",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    nodes: [
      {
        id: analyzeNodeId,
        kind: "root",
        title: "Analyze outcome",
        capability: "reasoning",
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      },
      {
        id: draftBriefNodeId,
        kind: "task",
        title: "Draft brief",
        capability: "document",
        instruction: "Write a concise execution brief using the analysis artifact.",
        template: "draft_brief",
        expectedArtifactPath: "artifacts/brief.md",
        expectedArtifactKind: "brief"
      },
      {
        id: draftOperatorSummaryNodeId,
        kind: "task",
        title: "Draft operator summary",
        capability: "document",
        instruction: "Write the operator-facing summary from the analysis artifact.",
        template: "draft_operator_summary",
        expectedArtifactPath: "artifacts/operator-summary.md",
        expectedArtifactKind: "operator_summary"
      },
      {
        id: synthesizeNodeId,
        kind: "synthesis",
        title: "Synthesize result",
        capability: "document",
        instruction: "Combine the brief and operator summary into the final result.",
        template: "synthesize_result",
        approvalRequirement: {
          kind: "output_review_required",
          title: "Review final result",
          summary: "Inspect the final artifact before marking the run complete.",
          instruction: "Approve to complete the run or reject to fail it."
        },
        expectedArtifactPath: "artifacts/final-result.md",
        expectedArtifactKind: "result"
      }
    ],
    edges: [
      {
        id: `${planId}:edge-analyze-brief`,
        from: analyzeNodeId,
        to: draftBriefNodeId
      },
      {
        id: `${planId}:edge-analyze-operator-summary`,
        from: analyzeNodeId,
        to: draftOperatorSummaryNodeId
      },
      {
        id: `${planId}:edge-brief-synthesize`,
        from: draftBriefNodeId,
        to: synthesizeNodeId
      },
      {
        id: `${planId}:edge-operator-summary-synthesize`,
        from: draftOperatorSummaryNodeId,
        to: synthesizeNodeId
      }
    ]
  };
}
