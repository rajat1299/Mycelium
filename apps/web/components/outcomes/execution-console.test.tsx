import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionConsole } from "./execution-console";

const eventStream = vi.hoisted(() => ({
  handlers: new Set<(event: any) => void>()
}));

vi.mock("../../lib/events", () => ({
  subscribeToOutcomeEvents: (
    _outcomeId: string,
    handler: (event: unknown) => void
  ) => {
    const typedHandler = handler as (event: any) => void;
    eventStream.handlers.add(typedHandler);

    return () => {
      eventStream.handlers.delete(typedHandler);
    };
  }
}));

afterEach(() => {
  cleanup();
  eventStream.handlers.clear();
});

describe("ExecutionConsole", () => {
  it("shares the live selected run across the timeline, artifacts, and logs", () => {
    render(
      <ExecutionConsole
        outcomeId="outcome_123"
        initialRun={null}
        initialArtifacts={[]}
        initialLogs={[]}
      />
    );

    expect(
      screen.getByText("Start a run to watch step state appear here.")
    ).toBeInTheDocument();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
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
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "artifact.created",
          data: {
            id: "artifact_1",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_1",
            kind: "analysis",
            relativePath: "artifacts/analyze-outcome.md",
            size: 128,
            metadata: {},
            createdAt: "2026-03-11T00:05:30.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "run.log",
          data: {
            runId: "run_123",
            stepId: "step_1",
            stepTitle: "Analyze outcome",
            level: "info",
            message: "Recovered log history is visible.",
            createdAt: "2026-03-11T00:05:40.000Z"
          }
        });
      }
    });

    expect(screen.getByText("queued")).toBeInTheDocument();
    expect(screen.getByText("artifacts/analyze-outcome.md")).toBeInTheDocument();
    expect(screen.getByText("Recovered log history is visible.")).toBeInTheDocument();
  });
});
