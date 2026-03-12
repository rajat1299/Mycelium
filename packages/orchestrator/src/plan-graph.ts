import { z } from "zod";

export const PlanStatusSchema = z.enum(["draft"]);

export const PlanNodeKindSchema = z.enum(["root", "task", "synthesis"]);

export const PlanNodeCapabilitySchema = z.enum([
  "reasoning",
  "research",
  "coding",
  "browser",
  "terminal",
  "api",
  "document",
  "fast_tasks",
  "fallback"
]);

export const PlanNodeTemplateSchema = z.enum([
  "analyze_outcome",
  "draft_brief",
  "draft_operator_summary",
  "synthesize_result"
]);

export const ArtifactKindSchema = z.enum([
  "analysis",
  "brief",
  "operator_summary",
  "result"
]);

export const PlanNodeSchema = z.object({
  id: z.string(),
  kind: PlanNodeKindSchema,
  title: z.string().min(1),
  capability: PlanNodeCapabilitySchema,
  instruction: z.string().min(1).optional(),
  template: PlanNodeTemplateSchema.optional(),
  expectedArtifactPath: z.string().min(1).optional(),
  expectedArtifactKind: ArtifactKindSchema.optional()
});

export const PlanEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string()
});

export const PlanGraphSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  status: PlanStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  nodes: z.array(PlanNodeSchema),
  edges: z.array(PlanEdgeSchema)
});

export type PlanStatus = z.infer<typeof PlanStatusSchema>;
export type PlanNode = z.infer<typeof PlanNodeSchema>;
export type PlanEdge = z.infer<typeof PlanEdgeSchema>;
export type PlanGraph = z.infer<typeof PlanGraphSchema>;
export type PlanNodeTemplate = z.infer<typeof PlanNodeTemplateSchema>;
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export type PlanGraphValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validatePlanGraph(input: unknown): PlanGraphValidationResult {
  const parsed = PlanGraphSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.message)
    };
  }

  const plan = parsed.data;
  const errors: string[] = [];
  const nodesById = new Map(plan.nodes.map((node) => [node.id, node]));
  const rootNodes = plan.nodes.filter((node) => node.kind === "root");

  if (rootNodes.length !== 1) {
    errors.push("Plan graph must contain exactly one root node.");
  }

  for (const edge of plan.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      errors.push(`Plan edge ${edge.id} references a node that does not exist.`);
    }

    if (edge.from === edge.to) {
      errors.push(`Plan edge ${edge.id} cannot reference the same node twice.`);
    }
  }

  if (rootNodes.length === 1) {
    const rootId = rootNodes[0].id;
    const hasIncomingEdge = plan.edges.some((edge) => edge.to === rootId);

    if (hasIncomingEdge) {
      errors.push("Root node cannot have incoming edges.");
    }
  }

  if (errors.length === 0) {
    const incomingCounts = new Map(plan.nodes.map((node) => [node.id, 0]));
    const adjacency = new Map(plan.nodes.map((node) => [node.id, [] as string[]]));

    for (const edge of plan.edges) {
      incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
      adjacency.get(edge.from)?.push(edge.to);
    }

    const queue = Array.from(incomingCounts.entries())
      .filter(([, count]) => count === 0)
      .map(([nodeId]) => nodeId);
    let visitedCount = 0;

    while (queue.length > 0) {
      const nodeId = queue.shift();

      if (!nodeId) {
        continue;
      }

      visitedCount += 1;

      for (const nextNodeId of adjacency.get(nodeId) ?? []) {
        const nextIncomingCount = (incomingCounts.get(nextNodeId) ?? 0) - 1;
        incomingCounts.set(nextNodeId, nextIncomingCount);

        if (nextIncomingCount === 0) {
          queue.push(nextNodeId);
        }
      }
    }

    if (visitedCount !== plan.nodes.length) {
      errors.push("Plan graph must be acyclic.");
    } else if (rootNodes.length === 1) {
      const reachableNodes = new Set<string>();
      const queue = [rootNodes[0].id];

      while (queue.length > 0) {
        const nodeId = queue.shift();

        if (!nodeId || reachableNodes.has(nodeId)) {
          continue;
        }

        reachableNodes.add(nodeId);

        for (const nextNodeId of adjacency.get(nodeId) ?? []) {
          queue.push(nextNodeId);
        }
      }

      if (reachableNodes.size !== plan.nodes.length) {
        errors.push("All plan nodes must be reachable from the root node.");
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return { ok: true };
}
