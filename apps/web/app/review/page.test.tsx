import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewPage from "./page";

const mocks = vi.hoisted(() => ({
  getDefaultWorkspaceId: vi.fn(),
  listApprovals: vi.fn(),
  getRunArtifacts: vi.fn()
}));

let observedWorkspaceId = "";
let observedApprovals: Array<{ id: string; title: string }> = [];
let observedArtifactMap: Record<string, Array<{ id: string; relativePath: string }>> = {};

vi.mock("next/link", () => ({
  default: ({
    children,
    href
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>
}));

vi.mock("../../components/review/review-queue", () => ({
  ReviewQueue: ({
    workspaceId,
    initialApprovals,
    initialArtifactsByRunId
  }: {
    workspaceId: string;
    initialApprovals: Array<{ id: string; title: string }>;
    initialArtifactsByRunId: Record<string, Array<{ id: string; relativePath: string }>>;
  }) => {
    observedWorkspaceId = workspaceId;
    observedApprovals = initialApprovals;
    observedArtifactMap = initialArtifactsByRunId;
    return <div data-testid="review-queue">{initialApprovals[0]?.title ?? "empty"}</div>;
  }
}));

vi.mock("../../lib/api", () => ({
  getDefaultWorkspaceId: mocks.getDefaultWorkspaceId,
  listApprovals: mocks.listApprovals,
  getRunArtifacts: mocks.getRunArtifacts
}));

afterEach(() => {
  cleanup();
});

describe("ReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observedWorkspaceId = "";
    observedApprovals = [];
    observedArtifactMap = {};

    mocks.getDefaultWorkspaceId.mockReturnValue("ws_default");
    mocks.listApprovals.mockResolvedValue([
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
    ]);
    mocks.getRunArtifacts.mockResolvedValue([
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
    ]);
  });

  it("loads pending approvals for the default workspace and seeds the review queue", async () => {
    render(await ReviewPage());

    expect(mocks.getDefaultWorkspaceId).toHaveBeenCalled();
    expect(mocks.listApprovals).toHaveBeenCalledWith("ws_default");
    expect(mocks.getRunArtifacts).toHaveBeenCalledWith("run_1");
    expect(
      screen.getByRole("heading", { name: /operator review desk/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-queue")).toHaveTextContent("Review final result");
    expect(observedWorkspaceId).toBe("ws_default");
    expect(observedApprovals).toEqual([
      expect.objectContaining({
        id: "approval_1",
        title: "Review final result"
      })
    ]);
    expect(observedArtifactMap).toEqual({
      run_1: [
        expect.objectContaining({
          id: "artifact_1",
          relativePath: "artifacts/final-result.md"
        })
      ]
    });
  });
});
