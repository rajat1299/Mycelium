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
        initialPendingApprovals={[]}
        initialLineageEdges={[]}
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

  it("shows blocked review state and clears it when approval resolution arrives", () => {
    render(
      <ExecutionConsole
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "blocked",
          createdAt: "2026-03-15T00:05:00.000Z",
          updatedAt: "2026-03-15T00:06:00.000Z",
          steps: [
            {
              id: "step_final",
              runId: "run_123",
              planNodeId: "plan_outcome_123:synthesize-result",
              title: "Synthesize result",
              kind: "synthesis",
              capability: "document",
              instruction: "Combine the brief and operator summary into the final result.",
              template: "synthesize_result",
              status: "blocked",
              position: 3,
              approvalRequirement: {
                kind: "output_review_required",
                title: "Review final result",
                summary: "Inspect the final artifact before marking the run complete.",
                instruction: "Approve to complete the run or reject to fail it."
              },
              routeStatus: "resolved",
              routeReason: null,
              routeProviderId: "anthropic",
              routeModelId: "claude-opus-4.6",
              routeAuthProfileId: "profile_anthropic_primary",
              routePolicyVersion: 1,
              routeResolvedAt: "2026-03-15T00:05:30.000Z",
              expectedArtifactPath: "artifacts/final-result.md",
              expectedArtifactKind: "result",
              createdAt: "2026-03-15T00:05:00.000Z",
              updatedAt: "2026-03-15T00:06:00.000Z"
            }
          ]
        }}
        initialArtifacts={[
          {
            id: "artifact_final",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_final",
            kind: "result",
            relativePath: "artifacts/final-result.md",
            size: 256,
            metadata: {},
            createdAt: "2026-03-15T00:05:30.000Z"
          }
        ]}
        initialLogs={[]}
        initialPendingApprovals={[
          {
            id: "approval_123",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_final",
            status: "pending",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_final"],
            requestedAt: "2026-03-15T00:06:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        ]}
        initialLineageEdges={[
          {
            id: "edge_123",
            runId: "run_123",
            parentArtifactId: "artifact_brief",
            childArtifactId: "artifact_final",
            parentStepId: "step_brief",
            childStepId: "step_final",
            relation: "derived_from",
            createdAt: "2026-03-15T00:05:31.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Blocked on review")).toBeInTheDocument();
    expect(screen.getByText("Artifact lineage")).toBeInTheDocument();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "approval.resolved",
          data: {
            id: "approval_123",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_final",
            status: "resolved",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_final"],
            requestedAt: "2026-03-15T00:06:00.000Z",
            resolvedAt: "2026-03-15T00:07:00.000Z",
            resolution: "approved",
            resolutionNote: "Looks good."
          }
        });
      }
    });

    expect(screen.queryByText("Blocked on review")).not.toBeInTheDocument();
  });
});
