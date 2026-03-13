import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactList } from "./artifact-list";

afterEach(() => {
  cleanup();
});

describe("ArtifactList", () => {
  it("renders the artifacts provided for the selected run", () => {
    render(
      <ArtifactList
        selectedRunId="run_123"
        artifacts={[
          {
            id: "artifact_1",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_1",
            kind: "analysis",
            relativePath: "artifacts/analyze-outcome.md",
            size: 128,
            metadata: {},
            createdAt: "2026-03-11T00:05:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Execution artifacts")).toBeInTheDocument();
    expect(screen.getByText("artifacts/analyze-outcome.md")).toBeInTheDocument();
    expect(screen.getByText("1 artifact")).toBeInTheDocument();
  });
});
