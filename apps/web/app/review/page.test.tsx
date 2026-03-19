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
    expect(screen.getByRole("heading", { name: /approval queue/i })).toBeInTheDocument();
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

  it("keeps the review desk seeded when the blocked approval came from a remote worker run", async () => {
    mocks.listApprovals.mockResolvedValue([
      {
        id: "approval_remote",
        workspaceId: "ws_default",
        outcomeId: "outcome_2",
        runId: "run_remote",
        stepId: "step_remote",
        status: "pending",
        kind: "output_review_required",
        title: "Review remote result",
        summary: "Inspect the remote final artifact before marking the run complete.",
        instruction: "Approve to complete the run or reject to fail it.",
        artifactIds: ["artifact_remote"],
        requestedAt: "2026-03-17T00:00:00.000Z",
        resolvedAt: null,
        resolution: null,
        resolutionNote: null
      }
    ]);
    mocks.getRunArtifacts.mockResolvedValue([
      {
        id: "artifact_remote",
        outcomeId: "outcome_2",
        runId: "run_remote",
        stepId: "step_remote",
        kind: "result",
        relativePath: "artifacts/remote-result.md",
        size: 512,
        metadata: {
          workerId: "worker_1"
        },
        createdAt: "2026-03-17T00:00:01.000Z"
      }
    ]);

    render(await ReviewPage());

    expect(screen.getByTestId("review-queue")).toHaveTextContent("Review remote result");
    expect(observedArtifactMap).toEqual({
      run_remote: [
        expect.objectContaining({
          id: "artifact_remote",
          relativePath: "artifacts/remote-result.md"
        })
      ]
    });
  });
});
