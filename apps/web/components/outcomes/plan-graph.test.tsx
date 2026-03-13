import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanGraph } from "./plan-graph";
import { RunTimeline } from "./run-timeline";

const eventStream = vi.hoisted(() => ({
  handler: null as ((event: any) => void) | null
}));

vi.mock("../../lib/events", () => ({
  subscribeToOutcomeEvents: (_outcomeId: string, handler: (event: unknown) => void) => {
    eventStream.handler = handler as (event: any) => void;

    return () => {
      eventStream.handler = null;
    };
  }
}));

afterEach(() => {
  cleanup();
});

describe("PlanGraph", () => {
  it("renders the persisted draft plan nodes", () => {
    render(
      <PlanGraph
        outcomeId="outcome_123"
        initialPlan={{
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-11T00:00:00.000Z",
          updatedAt: "2026-03-11T00:00:00.000Z",
          nodes: [
            {
              id: "node_analyze",
              kind: "root",
              title: "Analyze outcome",
              capability: "reasoning",
              position: 0
            },
            {
              id: "node_execute",
              kind: "task",
              title: "Execute outcome",
              capability: "coding",
              position: 1
            },
            {
              id: "node_synthesize",
              kind: "synthesis",
              title: "Synthesize result",
              capability: "document",
              position: 2
            }
          ],
          edges: [
            {
              id: "edge_analyze_execute",
              from: "node_analyze",
              to: "node_execute"
            },
            {
              id: "edge_execute_synthesize",
              from: "node_execute",
              to: "node_synthesize"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Draft plan")).toBeInTheDocument();
    expect(screen.getByText("Analyze outcome")).toBeInTheDocument();
    expect(screen.getByText("Execute outcome")).toBeInTheDocument();
    expect(screen.getByText("Synthesize result")).toBeInTheDocument();
  });

  it("renders an empty state when no draft plan exists yet", () => {
    render(<PlanGraph outcomeId="outcome_123" initialPlan={null} />);

    expect(
      screen.getByText("Generate a draft plan to see the orchestration graph.")
    ).toBeInTheDocument();
  });
});

describe("RunTimeline", () => {
  it("renders a run timeline with ordered steps", () => {
    render(
      <RunTimeline
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              status: "ready",
              position: 0,
              createdAt: "2026-03-11T00:05:00.000Z",
              updatedAt: "2026-03-11T00:05:00.000Z"
            },
            {
              id: "step_2",
              runId: "run_123",
              planNodeId: "node_execute",
              title: "Execute outcome",
              kind: "task",
              capability: "coding",
              status: "pending",
              position: 1,
              createdAt: "2026-03-11T00:05:00.000Z",
              updatedAt: "2026-03-11T00:05:00.000Z"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Run timeline")).toBeInTheDocument();
    expect(screen.getByText("Analyze outcome")).toBeInTheDocument();
    expect(screen.getByText("Execute outcome")).toBeInTheDocument();
    expect(screen.getByText("queued")).toBeInTheDocument();
  });

  it("renders an empty state when no run has started", () => {
    render(<RunTimeline outcomeId="outcome_123" initialRun={null} />);

    expect(
      screen.getByText("Start a run to watch step state appear here.")
    ).toBeInTheDocument();
  });

  it("keeps the selected run pinned when another run is created for the same outcome", () => {
    render(
      <RunTimeline
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              status: "ready",
              position: 0,
              createdAt: "2026-03-11T00:05:00.000Z",
              updatedAt: "2026-03-11T00:05:00.000Z"
            },
            {
              id: "step_2",
              runId: "run_123",
              planNodeId: "node_execute",
              title: "Execute outcome",
              kind: "task",
              capability: "coding",
              status: "pending",
              position: 1,
              createdAt: "2026-03-11T00:05:00.000Z",
              updatedAt: "2026-03-11T00:05:00.000Z"
            }
          ]
        }}
      />
    );

    act(() => {
      eventStream.handler?.({
        outcomeId: "outcome_123",
        type: "run.created",
        data: {
          id: "run_999",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-11T00:06:00.000Z",
          updatedAt: "2026-03-11T00:06:00.000Z"
        }
      });
    });

    expect(screen.getByText("Analyze outcome")).toBeInTheDocument();
    expect(screen.getByText("Execute outcome")).toBeInTheDocument();
    expect(screen.getByText("2 steps")).toBeInTheDocument();
  });

  it("updates the selected run status when a run.updated event arrives", () => {
    render(
      <RunTimeline
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              status: "ready",
              position: 0,
              createdAt: "2026-03-11T00:05:00.000Z",
              updatedAt: "2026-03-11T00:05:00.000Z"
            }
          ]
        }}
      />
    );

    act(() => {
      eventStream.handler?.({
        outcomeId: "outcome_123",
        type: "run.updated",
        data: {
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "running",
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:06:00.000Z"
        }
      });
    });

    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.queryByText("queued")).not.toBeInTheDocument();
  });
});
