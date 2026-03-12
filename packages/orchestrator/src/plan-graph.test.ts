import { describe, expect, it } from "vitest";
import { PlanGraphSchema, validatePlanGraph } from "./plan-graph";

describe("plan graph", () => {
  it("accepts a valid graph with one root node", () => {
    const plan = {
      id: "plan_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "node_root",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning"
        },
        {
          id: "node_exec",
          kind: "task",
          title: "Execute outcome",
          capability: "coding"
        }
      ],
      edges: [
        {
          id: "edge_1",
          from: "node_root",
          to: "node_exec"
        }
      ]
    };

    expect(PlanGraphSchema.parse(plan)).toEqual(plan);
    expect(validatePlanGraph(plan).ok).toBe(true);
  });

  it("rejects a graph with more than one root node", () => {
    const result = validatePlanGraph({
      id: "plan_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "node_root_1",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning"
        },
        {
          id: "node_root_2",
          kind: "root",
          title: "Second root",
          capability: "research"
        }
      ],
      edges: []
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected the validation result to fail.");
    }
    expect(result.errors).toContain("Plan graph must contain exactly one root node.");
  });

  it("rejects edges that reference missing nodes", () => {
    const result = validatePlanGraph({
      id: "plan_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "node_root",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning"
        }
      ],
      edges: [
        {
          id: "edge_1",
          from: "node_root",
          to: "node_missing"
        }
      ]
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected the validation result to fail.");
    }
    expect(result.errors).toContain(
      "Plan edge edge_1 references a node that does not exist."
    );
  });

  it("rejects cyclic graphs", () => {
    const result = validatePlanGraph({
      id: "plan_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "node_root",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning"
        },
        {
          id: "node_a",
          kind: "task",
          title: "Task A",
          capability: "coding"
        },
        {
          id: "node_b",
          kind: "task",
          title: "Task B",
          capability: "document"
        }
      ],
      edges: [
        {
          id: "edge_root_a",
          from: "node_root",
          to: "node_a"
        },
        {
          id: "edge_a_b",
          from: "node_a",
          to: "node_b"
        },
        {
          id: "edge_b_a",
          from: "node_b",
          to: "node_a"
        }
      ]
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected the validation result to fail.");
    }
    expect(result.errors).toContain("Plan graph must be acyclic.");
  });

  it("rejects nodes that are not reachable from the root", () => {
    const result = validatePlanGraph({
      id: "plan_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "node_root",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning"
        },
        {
          id: "node_exec",
          kind: "task",
          title: "Execute outcome",
          capability: "coding"
        },
        {
          id: "node_orphan",
          kind: "task",
          title: "Orphan task",
          capability: "document"
        }
      ],
      edges: [
        {
          id: "edge_root_exec",
          from: "node_root",
          to: "node_exec"
        }
      ]
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected the validation result to fail.");
    }
    expect(result.errors).toContain(
      "All plan nodes must be reachable from the root node."
    );
  });
});
