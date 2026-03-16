import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutcomeActivity } from "./outcome-activity";

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

describe("OutcomeActivity", () => {
  it("renders approval requested and resolved events in the live activity feed", () => {
    render(
      <OutcomeActivity
        outcome={{
          id: "outcome_123",
          workspaceId: "ws_default",
          userId: "user_123",
          prompt: "Draft a launch brief",
          source: "web",
          status: "running",
          createdAt: "2026-03-14T11:55:00.000Z",
          updatedAt: "2026-03-14T11:55:00.000Z"
        }}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "approval.requested",
          data: {
            id: "approval_123",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_123",
            status: "pending",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Operator review is required before publishing.",
            instruction: "Check tone, facts, and formatting.",
            artifactIds: ["artifact_1"],
            requestedAt: "2026-03-14T12:00:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "approval.resolved",
          data: {
            id: "approval_123",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_123",
            status: "resolved",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Operator review is required before publishing.",
            instruction: "Check tone, facts, and formatting.",
            artifactIds: ["artifact_1"],
            requestedAt: "2026-03-14T12:00:00.000Z",
            resolvedAt: "2026-03-14T12:05:00.000Z",
            resolution: "approved",
            resolutionNote: "Ready to ship."
          }
        });
      }
    });

    expect(screen.getByText("Approval approved")).toBeInTheDocument();
    expect(screen.getByText("Review final result approved. Ready to ship.")).toBeInTheDocument();
    expect(screen.getByText("Approval requested")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review final result is waiting for operator review. Check tone, facts, and formatting."
      )
    ).toBeInTheDocument();
  });

  it("renders checkpoint and resume lifecycle events in the live activity feed", () => {
    render(
      <OutcomeActivity
        outcome={{
          id: "outcome_123",
          workspaceId: "ws_default",
          userId: "user_123",
          prompt: "Draft a launch brief",
          source: "web",
          status: "running",
          createdAt: "2026-03-14T11:55:00.000Z",
          updatedAt: "2026-03-14T11:55:00.000Z"
        }}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "checkpoint.created",
          data: {
            id: "checkpoint_123",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            sequence: 3,
            kind: "step_completed",
            resumable: true,
            storeKey: "run_123/000003-checkpoint_123.json",
            checksum:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            byteSize: 2048,
            stepId: "step_456",
            createdAt: "2026-03-16T16:00:00.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "run.interrupted",
          data: {
            run: {
              id: "run_123",
              workspaceId: "ws_default",
              outcomeId: "outcome_123",
              planId: "plan_123",
              status: "interrupted",
              createdAt: "2026-03-16T15:30:00.000Z",
              updatedAt: "2026-03-16T16:05:00.000Z",
              latestCheckpointId: "checkpoint_123",
              resumable: true
            },
            interruptedFromCheckpointId: "checkpoint_123"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "run.resumed",
          data: {
            run: {
              id: "run_123",
              workspaceId: "ws_default",
              outcomeId: "outcome_123",
              planId: "plan_123",
              status: "running",
              createdAt: "2026-03-16T15:30:00.000Z",
              updatedAt: "2026-03-16T16:10:00.000Z",
              latestCheckpointId: "checkpoint_123",
              resumable: true
            },
            resumedFromCheckpointId: "checkpoint_123"
          }
        });
      }
    });

    expect(screen.getByText("Run resumed")).toBeInTheDocument();
    expect(
      screen.getByText("Run run_123 resumed from checkpoint checkpoint_123.")
    ).toBeInTheDocument();
    expect(screen.getByText("Run interrupted")).toBeInTheDocument();
    expect(
      screen.getByText("Run run_123 interrupted from checkpoint checkpoint_123.")
    ).toBeInTheDocument();
    expect(screen.getByText("Checkpoint created")).toBeInTheDocument();
    expect(
      screen.getByText("Checkpoint step_completed (#3) was persisted for the run.")
    ).toBeInTheDocument();
  });
});
