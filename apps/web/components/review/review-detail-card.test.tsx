import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewDetailCard } from "./review-detail-card";

afterEach(() => {
  cleanup();
});

describe("ReviewDetailCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the thread-first outcome page without pinning a historical run id", () => {
    render(
      <ReviewDetailCard
        approval={{
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
        }}
        artifacts={[]}
      />
    );

    expect(screen.getByRole("link", { name: "Open outcome" })).toHaveAttribute(
      "href",
      "/outcomes/outcome_1"
    );
  });

  it("sends approve and reject actions through the web approval API surface", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
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
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    render(
      <ReviewDetailCard
        approval={{
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
        }}
        artifacts={[
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
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/approvals/approval_1/approve",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/approvals/approval_1/reject",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });
});
