import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.useRealTimers();
});

describe("ReviewQueue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-selects the newest pending approval and lets the operator switch items", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url.startsWith("/api/approvals?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              approvals: [
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
                  summary:
                    "Inspect the operator summary before marking the run complete.",
                  instruction: "Approve to complete the run or reject to fail it.",
                  artifactIds: ["artifact_2"],
                  requestedAt: "2026-03-15T00:01:00.000Z",
                  resolvedAt: null,
                  resolution: null,
                  resolutionNote: null
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

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

    expect(screen.getByText("artifacts/operator-summary.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /review operator summary/i }));

    expect(screen.getByText("artifacts/operator-summary.md")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /review final result/i }));
    expect(screen.getByText("artifacts/final-result.md")).toBeInTheDocument();
  });

  it("hydrates artifact context for newly streamed approvals", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url.startsWith("/api/approvals?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              approvals: [
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
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }

      if (url === "/api/runs/run_2/artifacts") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              artifacts: [
                {
                  id: "artifact_2",
                  outcomeId: "outcome_1",
                  runId: "run_2",
                  stepId: "step_2",
                  kind: "result",
                  relativePath: "artifacts/reviewed-summary.md",
                  size: 384,
                  metadata: {},
                  createdAt: "2026-03-15T00:01:05.000Z"
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/approvals?workspaceId=ws_default",
        expect.objectContaining({
          cache: "no-store"
        })
      );
    });

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_1",
          type: "approval.requested",
          data: {
            id: "approval_2",
            workspaceId: "ws_default",
            outcomeId: "outcome_1",
            runId: "run_2",
            stepId: "step_2",
            status: "pending",
            kind: "output_review_required",
            title: "Review synthesized summary",
            summary: "Inspect the synthesized summary before completion.",
            instruction: "Approve to continue or reject to fail the run.",
            artifactIds: ["artifact_2"],
            requestedAt: "2026-03-15T00:01:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        });
      }
    });

    fireEvent.click(screen.getByRole("button", { name: /review synthesized summary/i }));

    await waitFor(() => {
      expect(screen.getByText("artifacts/reviewed-summary.md")).toBeInTheDocument();
    });
  });

  it("refreshes artifact context for later approvals on the same run", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url.startsWith("/api/approvals?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              approvals: [
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
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }

      if (url === "/api/runs/run_1/artifacts") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              artifacts: [
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
                },
                {
                  id: "artifact_2",
                  outcomeId: "outcome_1",
                  runId: "run_1",
                  stepId: "step_2",
                  kind: "summary",
                  relativePath: "artifacts/review-summary.md",
                  size: 312,
                  metadata: {},
                  createdAt: "2026-03-15T00:03:01.000Z"
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/approvals?workspaceId=ws_default",
        expect.objectContaining({
          cache: "no-store"
        })
      );
    });

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_1",
          type: "approval.requested",
          data: {
            id: "approval_2",
            workspaceId: "ws_default",
            outcomeId: "outcome_1",
            runId: "run_1",
            stepId: "step_2",
            status: "pending",
            kind: "output_review_required",
            title: "Review synthesized summary",
            summary: "Inspect the synthesized summary before completion.",
            instruction: "Approve to continue or reject to fail the run.",
            artifactIds: ["artifact_2"],
            requestedAt: "2026-03-15T00:03:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        });
      }
    });

    fireEvent.click(screen.getByRole("button", { name: /review synthesized summary/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/runs/run_1/artifacts", {
        cache: "no-store"
      });
    });

    await waitFor(() => {
      expect(screen.getByText("artifacts/review-summary.md")).toBeInTheDocument();
    });
  });

  it("discovers approvals and artifact context even when the review desk starts empty", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url.startsWith("/api/approvals?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              approvals: [
                {
                  id: "approval_9",
                  workspaceId: "ws_default",
                  outcomeId: "outcome_9",
                  runId: "run_9",
                  stepId: "step_9",
                  status: "pending",
                  kind: "output_review_required",
                  title: "Review rollout checklist",
                  summary: "Inspect the rollout checklist before completion.",
                  instruction: "Approve to continue or reject to fail the run.",
                  artifactIds: ["artifact_9"],
                  requestedAt: "2026-03-15T00:05:00.000Z",
                  resolvedAt: null,
                  resolution: null,
                  resolutionNote: null
                }
              ]
            }),
            {
            status: 200,
            headers: { "content-type": "application/json" }
            }
          )
        );
      }

      if (url === "/api/runs/run_9/artifacts") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              artifacts: [
                {
                  id: "artifact_9",
                  outcomeId: "outcome_9",
                  runId: "run_9",
                  stepId: "step_9",
                  kind: "checklist",
                  relativePath: "artifacts/rollout-checklist.md",
                  size: 144,
                  metadata: {},
                  createdAt: "2026-03-15T00:05:01.000Z"
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(
      <ReviewQueue
        workspaceId="ws_default"
        initialApprovals={[]}
        initialArtifactsByRunId={{}}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/approvals?workspaceId=ws_default",
        expect.objectContaining({
          cache: "no-store"
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /review rollout checklist/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /review rollout checklist/i }));

    await waitFor(() => {
      expect(screen.getByText("artifacts/rollout-checklist.md")).toBeInTheDocument();
    });
  });
});
