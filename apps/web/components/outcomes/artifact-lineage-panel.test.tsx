import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactLineagePanel } from "./artifact-lineage-panel";

afterEach(() => {
  cleanup();
});

describe("ArtifactLineagePanel", () => {
  it("renders derived-from relationships for the selected run", () => {
    render(
      <ArtifactLineagePanel
        selectedRunId="run_123"
        artifacts={[
          {
            id: "artifact_brief",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_brief",
            kind: "brief",
            relativePath: "artifacts/brief.md",
            size: 128,
            metadata: {},
            createdAt: "2026-03-15T00:00:00.000Z"
          },
          {
            id: "artifact_final",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_final",
            kind: "result",
            relativePath: "artifacts/final-result.md",
            size: 256,
            metadata: {},
            createdAt: "2026-03-15T00:00:10.000Z"
          }
        ]}
        edges={[
          {
            id: "edge_123",
            runId: "run_123",
            parentArtifactId: "artifact_brief",
            childArtifactId: "artifact_final",
            parentStepId: "step_brief",
            childStepId: "step_final",
            relation: "derived_from",
            createdAt: "2026-03-15T00:00:11.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Artifact lineage")).toBeInTheDocument();
    expect(screen.getByText("artifacts/final-result.md")).toBeInTheDocument();
    expect(screen.getByText(/derived from artifacts\/brief\.md/i)).toBeInTheDocument();
  });
});
