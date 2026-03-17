import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RemoteWorkerPanel } from "./remote-worker-panel";

afterEach(() => {
  cleanup();
});

describe("RemoteWorkerPanel", () => {
  it("shows the selected run worker, remote step status, and recovery message", () => {
    render(
      <RemoteWorkerPanel
        run={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "interrupted",
          latestCheckpointId: "checkpoint_9",
          resumable: true,
          createdAt: "2026-03-17T00:00:00.000Z",
          updatedAt: "2026-03-17T00:05:00.000Z",
          steps: [
            {
              id: "step_remote",
              runId: "run_123",
              planNodeId: "plan_outcome_123:draft-brief",
              title: "Draft brief",
              kind: "task",
              capability: "coding",
              instruction: "Write the brief artifact.",
              template: "draft_brief",
              status: "claimed",
              position: 0,
              executionTarget: "remote_worker",
              remoteWorkerId: "worker_1",
              remoteWorkerSessionId: "worker_session_1",
              remoteExecutionAttemptId: "attempt_1",
              remoteAssignedAt: "2026-03-17T00:01:00.000Z",
              createdAt: "2026-03-17T00:00:00.000Z",
              updatedAt: "2026-03-17T00:01:00.000Z"
            }
          ]
        }}
        workers={[
          {
            id: "worker_1",
            sessionId: "worker_session_1",
            workspaceId: "ws_default",
            label: "Primary remote worker",
            daemonVersion: "1.0.0",
            availability: "available",
            capabilities: {
              capabilityFamilies: ["coding", "terminal"],
              supportsArtifacts: true,
              supportsCheckpoints: true,
              supportsLogs: true
            },
            health: {
              status: "healthy",
              lastHeartbeatAt: "2026-03-17T00:04:00.000Z"
            },
            connectedAt: "2026-03-17T00:00:00.000Z",
            disconnectedAt: null,
            updatedAt: "2026-03-17T00:04:00.000Z"
          }
        ]}
        remoteStepStates={{
          step_remote: {
            runId: "run_123",
            stepId: "step_remote",
            status: "running",
            assignment: {
              executionTarget: "remote_worker",
              workerId: "worker_1",
              workerSessionId: "worker_session_1",
              attemptId: "attempt_1",
              assignedAt: "2026-03-17T00:01:00.000Z"
            },
            message: "Worker accepted the assignment.",
            occurredAt: "2026-03-17T00:02:00.000Z"
          }
        }}
        statusMessage={{
          tone: "default",
          text: "Run interrupted from checkpoint checkpoint_9."
        }}
      />
    );

    expect(screen.getByText("Primary remote worker")).toBeInTheDocument();
    expect(screen.getAllByText("worker_1").length).toBeGreaterThan(0);
    expect(screen.getByText("healthy")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    expect(screen.getByText("Run interrupted from checkpoint checkpoint_9.")).toBeInTheDocument();
    expect(screen.getByText("Draft brief")).toBeInTheDocument();
    expect(screen.getByText("Worker accepted the assignment.")).toBeInTheDocument();
  });
});
