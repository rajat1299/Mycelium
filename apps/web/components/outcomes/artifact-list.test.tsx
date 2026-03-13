import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactList } from "./artifact-list";

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

describe("ArtifactList", () => {
  it("renders persisted artifacts for the selected run and appends live artifacts", () => {
    render(
      <ArtifactList
        outcomeId="outcome_123"
        selectedRunId="run_123"
        initialArtifacts={[
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

    act(() => {
      eventStream.handler?.({
        outcomeId: "outcome_123",
        type: "artifact.created",
        data: {
          id: "artifact_2",
          outcomeId: "outcome_123",
          runId: "run_123",
          stepId: "step_2",
          kind: "result",
          relativePath: "artifacts/final-result.md",
          size: 256,
          metadata: {},
          createdAt: "2026-03-11T00:06:00.000Z"
        }
      });
    });

    expect(screen.getByText("artifacts/final-result.md")).toBeInTheDocument();
    expect(screen.getByText("2 artifacts")).toBeInTheDocument();
  });
});
