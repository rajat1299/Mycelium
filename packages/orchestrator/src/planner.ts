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
  const executeNodeId = `${planId}:execute-outcome`;
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
        capability: "reasoning"
      },
      {
        id: executeNodeId,
        kind: "task",
        title: "Execute outcome",
        capability: "coding"
      },
      {
        id: synthesizeNodeId,
        kind: "synthesis",
        title: "Synthesize result",
        capability: "document"
      }
    ],
    edges: [
      {
        id: `${planId}:edge-analyze-execute`,
        from: analyzeNodeId,
        to: executeNodeId
      },
      {
        id: `${planId}:edge-execute-synthesize`,
        from: executeNodeId,
        to: synthesizeNodeId
      }
    ]
  };
}
