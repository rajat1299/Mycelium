import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RunLogPanel } from "./run-log-panel";

afterEach(() => {
  cleanup();
});

describe("RunLogPanel", () => {
  it("renders the persisted logs for the selected run", () => {
    render(
      <RunLogPanel
        selectedRunId="run_123"
        logs={[
          {
            runId: "run_123",
            stepId: "step_1",
            stepTitle: "Analyze outcome",
            level: "error",
            message: "sandbox timed out",
            createdAt: "2026-03-11T00:06:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Analyze outcome")).toBeInTheDocument();
    expect(screen.getByText("sandbox timed out")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
