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

  it("renders remote worker lifecycle events in the live activity feed", () => {
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
          type: "worker.connected",
          data: {
            id: "worker_1",
            sessionId: "worker_session_1",
            workspaceId: "ws_default",
            label: "Primary remote worker",
            daemonVersion: "1.0.0",
            availability: "available",
            capabilities: {
              capabilityFamilies: ["coding", "terminal", "document"],
              supportsArtifacts: true,
              supportsCheckpoints: true,
              supportsLogs: true
            },
            health: {
              status: "healthy",
              lastHeartbeatAt: "2026-03-16T16:00:00.000Z"
            },
            connectedAt: "2026-03-16T15:59:00.000Z",
            disconnectedAt: null,
            updatedAt: "2026-03-16T16:00:00.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "remote.step.updated",
          data: {
            runId: "run_123",
            stepId: "step_123",
            status: "running",
            assignment: {
              executionTarget: "remote_worker",
              workerId: "worker_1",
              workerSessionId: "worker_session_1",
              attemptId: "attempt_1",
              assignedAt: "2026-03-16T16:00:00.000Z"
            },
            message: "Worker accepted the step.",
            occurredAt: "2026-03-16T16:00:05.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "worker.disconnected",
          data: {
            id: "worker_1",
            sessionId: "worker_session_1",
            workspaceId: "ws_default",
            label: "Primary remote worker",
            daemonVersion: "1.0.0",
            availability: "offline",
            capabilities: {
              capabilityFamilies: ["coding", "terminal", "document"],
              supportsArtifacts: true,
              supportsCheckpoints: true,
              supportsLogs: true
            },
            health: {
              status: "offline",
              lastHeartbeatAt: "2026-03-16T16:00:10.000Z"
            },
            connectedAt: "2026-03-16T15:59:00.000Z",
            disconnectedAt: "2026-03-16T16:00:10.000Z",
            updatedAt: "2026-03-16T16:00:10.000Z"
          }
        });
      }
    });

    expect(screen.getByText("Worker connected")).toBeInTheDocument();
    expect(
      screen.getByText("Primary remote worker is now available.")
    ).toBeInTheDocument();
    expect(screen.getByText("Remote step running")).toBeInTheDocument();
    expect(
      screen.getByText("Step step_123 is running on worker worker_1. Worker accepted the step.")
    ).toBeInTheDocument();
    expect(screen.getByText("Worker disconnected")).toBeInTheDocument();
    expect(
      screen.getByText("Primary remote worker went offline.")
    ).toBeInTheDocument();
  });

  it("renders schedule and messaging lifecycle events in the live activity feed", () => {
    render(
      <OutcomeActivity
        outcome={{
          id: "outcome_123",
          workspaceId: "ws_default",
          userId: "user_123",
          prompt: "Draft a launch brief",
          source: "schedule",
          status: "scheduled",
          createdAt: "2026-03-17T11:55:00.000Z",
          updatedAt: "2026-03-17T11:55:00.000Z"
        }}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "schedule.updated",
          data: {
            id: "schedule_1",
            workspaceId: "ws_default",
            title: "Morning workspace brief",
            prompt: "Create the daily workspace briefing.",
            status: "active",
            trigger: {
              kind: "cron",
              expression: "0 9 * * 1-5",
              timezone: "America/Chicago"
            },
            outcomeMode: "create_outcome",
            dispatchMode: "create_run",
            nextFireAt: "2026-03-18T14:00:00.000Z",
            lastFiredAt: null,
            validationDiagnostics: [],
            createdAt: "2026-03-17T12:00:00.000Z",
            updatedAt: "2026-03-17T12:00:00.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "schedule.fired",
          data: {
            id: "schedule_fire_1",
            scheduleId: "schedule_1",
            occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z",
            scheduledFor: "2026-03-18T14:00:00.000Z",
            firedAt: "2026-03-18T14:00:02.000Z",
            status: "triggered",
            outcomeId: "outcome_123",
            runId: "run_123",
            errorMessage: null
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "messaging.connection.updated",
          data: {
            id: "connection_slack_1",
            workspaceId: "ws_default",
            channel: "slack",
            transport: "socket_mode",
            status: "connected",
            enabled: true,
            accountLabel: "Ops workspace",
            externalWorkspaceId: "T123456",
            externalWorkspaceLabel: "Mycelium Ops",
            connectedAt: "2026-03-17T12:00:00.000Z",
            lastInboundAt: "2026-03-17T12:10:00.000Z",
            lastOutboundAt: "2026-03-17T12:11:00.000Z",
            lastError: null,
            updatedAt: "2026-03-17T12:11:00.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "messaging.delivery.updated",
          data: {
            id: "delivery_1",
            workspaceId: "ws_default",
            connectionId: "connection_slack_1",
            channel: "slack",
            externalWorkspaceId: "T123456",
            conversationId: "C123456",
            threadId: "1710763200.000100",
            kind: "result_summary",
            status: "sent",
            body: "Daily brief finished. Review is available in the web desk.",
            outcomeId: "outcome_123",
            runId: "run_123",
            sentAt: "2026-03-17T12:11:00.000Z",
            lastAttemptAt: "2026-03-17T12:11:00.000Z",
            errorMessage: null
          }
        });
      }
    });

    expect(screen.getByText("Schedule updated")).toBeInTheDocument();
    expect(
      screen.getByText("Morning workspace brief is active and will fire at 2026-03-18T14:00:00.000Z.")
    ).toBeInTheDocument();
    expect(screen.getByText("Schedule fired")).toBeInTheDocument();
    expect(
      screen.getByText("Schedule schedule_1 triggered for 2026-03-18T14:00:00.000Z.")
    ).toBeInTheDocument();
    expect(screen.getByText("slack connection connected")).toBeInTheDocument();
    expect(
      screen.getByText("Ops workspace is using socket_mode.")
    ).toBeInTheDocument();
    expect(screen.getByText("slack delivery sent")).toBeInTheDocument();
    expect(
      screen.getByText("Daily brief finished. Review is available in the web desk.")
    ).toBeInTheDocument();
  });
});
