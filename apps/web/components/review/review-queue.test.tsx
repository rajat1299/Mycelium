import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewQueue } from "./review-queue";

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

describe("ReviewQueue", () => {
  it("auto-selects the first pending approval and lets the operator switch items", () => {
    render(
      <ReviewQueue
        workspaceId="ws_default"
        initialApprovals={[
          {
            id: "approval_1",
            workspaceId: "ws_default",
            outcomeId: "outcome_1",
            runId: "run_1",
            stepId: "step_1",
            status: "pending",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_1"],
            requestedAt: "2026-03-15T00:00:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          },
          {
            id: "approval_2",
            workspaceId: "ws_default",
            outcomeId: "outcome_2",
            runId: "run_2",
            stepId: "step_2",
            status: "pending",
            kind: "output_review_required",
            title: "Review operator summary",
            summary: "Inspect the operator summary before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_2"],
            requestedAt: "2026-03-15T00:01:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        ]}
        initialArtifactsByRunId={{
          run_1: [
            {
              id: "artifact_1",
              outcomeId: "outcome_1",
              runId: "run_1",
              stepId: "step_1",
              kind: "result",
              relativePath: "artifacts/final-result.md",
              size: 256,
              metadata: {},
              createdAt: "2026-03-15T00:00:01.000Z"
            }
          ],
          run_2: [
            {
              id: "artifact_2",
              outcomeId: "outcome_2",
              runId: "run_2",
              stepId: "step_2",
              kind: "operator_summary",
              relativePath: "artifacts/operator-summary.md",
              size: 192,
              metadata: {},
              createdAt: "2026-03-15T00:01:01.000Z"
            }
          ]
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /review final result/i })
    ).toBeInTheDocument();
    expect(screen.getByText("artifacts/final-result.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /review operator summary/i }));

    expect(screen.getByText("artifacts/operator-summary.md")).toBeInTheDocument();
  });

  it("updates the queue when approval events arrive over SSE", () => {
    render(
      <ReviewQueue
        workspaceId="ws_default"
        initialApprovals={[
          {
            id: "approval_1",
            workspaceId: "ws_default",
            outcomeId: "outcome_1",
            runId: "run_1",
            stepId: "step_1",
            status: "pending",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_1"],
            requestedAt: "2026-03-15T00:00:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        ]}
        initialArtifactsByRunId={{
          run_1: [
            {
              id: "artifact_1",
              outcomeId: "outcome_1",
              runId: "run_1",
              stepId: "step_1",
              kind: "result",
              relativePath: "artifacts/final-result.md",
              size: 256,
              metadata: {},
              createdAt: "2026-03-15T00:00:01.000Z"
            }
          ]
        }}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_1",
          type: "approval.resolved",
          data: {
            id: "approval_1",
            workspaceId: "ws_default",
            outcomeId: "outcome_1",
            runId: "run_1",
            stepId: "step_1",
            status: "resolved",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_1"],
            requestedAt: "2026-03-15T00:00:00.000Z",
            resolvedAt: "2026-03-15T00:02:00.000Z",
            resolution: "approved",
            resolutionNote: "Looks good."
          }
        });
      }
    });

    expect(screen.getByRole("heading", { name: /no pending approvals/i })).toBeInTheDocument();
  });
});
