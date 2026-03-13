import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunLogPanel } from "./run-log-panel";

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

describe("RunLogPanel", () => {
  it("renders live run logs for the selected run", () => {
    render(
      <RunLogPanel
        outcomeId="outcome_123"
        selectedRunId="run_123"
        initialLogs={[]}
      />
    );

    expect(
      screen.getByText("Live step and run logs will appear here.")
    ).toBeInTheDocument();

    act(() => {
      eventStream.handler?.({
        outcomeId: "outcome_123",
        type: "run.log",
        data: {
          runId: "run_123",
          stepId: "step_1",
          stepTitle: "Analyze outcome",
          level: "error",
          message: "sandbox timed out",
          createdAt: "2026-03-11T00:06:00.000Z"
        }
      });
    });

    expect(screen.getByText("Analyze outcome")).toBeInTheDocument();
    expect(screen.getByText("sandbox timed out")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
