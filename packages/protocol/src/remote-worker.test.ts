import { describe, expect, it } from "vitest";
import {
  EventTypeSchema,
  OutcomeStreamEventSchema,
  RemoteStepAssignmentSchema,
  RemoteStepLifecycleEventDataSchema,
  RemoteWorkerCapabilitySummarySchema,
  RemoteWorkerHeartbeatSchema,
  RemoteWorkerHealthSchema,
  RemoteWorkerRegistrationSchema,
  RemoteWorkerSchema,
  RunDetailSchema
} from "./index";

describe("remote worker protocol contracts", () => {
  it("accepts worker registration, heartbeat, summary, and remote step assignment payloads", () => {
    const capabilities = RemoteWorkerCapabilitySummarySchema.parse({
      capabilityFamilies: ["coding", "terminal", "document"],
      supportsArtifacts: true,
      supportsCheckpoints: true,
      supportsLogs: true
    });

    const registration = RemoteWorkerRegistrationSchema.parse({
      workerId: "worker_1",
      workerSessionId: "worker_session_1",
      workspaceId: "ws_default",
      label: "Primary remote worker",
      daemonVersion: "1.0.0",
      connectedAt: "2026-03-16T12:00:00.000Z",
      capabilities
    });

    const health = RemoteWorkerHealthSchema.parse({
      status: "healthy",
      lastHeartbeatAt: "2026-03-16T12:00:05.000Z"
    });

    const heartbeat = RemoteWorkerHeartbeatSchema.parse({
      workerId: registration.workerId,
      workerSessionId: registration.workerSessionId,
      sentAt: "2026-03-16T12:00:05.000Z",
      health
    });

    const worker = RemoteWorkerSchema.parse({
      id: registration.workerId,
      sessionId: registration.workerSessionId,
      workspaceId: registration.workspaceId,
      label: registration.label,
      daemonVersion: registration.daemonVersion,
      availability: "available",
      capabilities,
      health,
      connectedAt: registration.connectedAt,
      disconnectedAt: null,
      updatedAt: heartbeat.sentAt
    });

    const assignment = RemoteStepAssignmentSchema.parse({
      executionTarget: "remote_worker",
      workerId: worker.id,
      workerSessionId: worker.sessionId,
      attemptId: "attempt_1",
      assignedAt: "2026-03-16T12:00:10.000Z"
    });

    expect(worker).toEqual(
      expect.objectContaining({
        availability: "available",
        health: expect.objectContaining({
          status: "healthy"
        })
      })
    );

    expect(assignment.workerId).toBe(worker.id);
  });

  it("accepts remote worker lifecycle SSE events and persisted run-step assignment metadata", () => {
    const run = RunDetailSchema.parse({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_123",
      status: "waiting_for_worker",
      createdAt: "2026-03-16T12:00:00.000Z",
      updatedAt: "2026-03-16T12:00:00.000Z",
      steps: [
        {
          id: "step_1",
          runId: "run_123",
          planNodeId: "plan_123:analyze-outcome",
          title: "Analyze outcome",
          kind: "root",
          capability: "reasoning",
          status: "claimed",
          position: 0,
          executionTarget: "remote_worker",
          remoteWorkerId: "worker_1",
          remoteWorkerSessionId: "worker_session_1",
          remoteExecutionAttemptId: "attempt_1",
          remoteAssignedAt: "2026-03-16T12:00:10.000Z",
          createdAt: "2026-03-16T12:00:00.000Z",
          updatedAt: "2026-03-16T12:00:10.000Z"
        }
      ]
    });

    const lifecycle = RemoteStepLifecycleEventDataSchema.parse({
      runId: "run_123",
      stepId: "step_1",
      status: "running",
      assignment: {
        executionTarget: "remote_worker",
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        attemptId: "attempt_1",
        assignedAt: "2026-03-16T12:00:10.000Z"
      },
      message: "Worker accepted the step.",
      occurredAt: "2026-03-16T12:00:11.000Z"
    });

    expect(run.steps[0]).toEqual(
      expect.objectContaining({
        executionTarget: "remote_worker",
        remoteWorkerId: "worker_1",
        remoteExecutionAttemptId: "attempt_1"
      })
    );

    expect(EventTypeSchema.parse("worker.connected")).toBe("worker.connected");
    expect(EventTypeSchema.parse("worker.disconnected")).toBe("worker.disconnected");
    expect(EventTypeSchema.parse("remote.step.updated")).toBe("remote.step.updated");

    expect(
      OutcomeStreamEventSchema.parse({
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
            lastHeartbeatAt: "2026-03-16T12:00:05.000Z"
          },
          connectedAt: "2026-03-16T12:00:00.000Z",
          disconnectedAt: null,
          updatedAt: "2026-03-16T12:00:05.000Z"
        }
      })
    ).toEqual(expect.objectContaining({ type: "worker.connected" }));

    expect(
      OutcomeStreamEventSchema.parse({
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
            lastHeartbeatAt: "2026-03-16T12:00:05.000Z"
          },
          connectedAt: "2026-03-16T12:00:00.000Z",
          disconnectedAt: "2026-03-16T12:00:20.000Z",
          updatedAt: "2026-03-16T12:00:20.000Z"
        }
      })
    ).toEqual(expect.objectContaining({ type: "worker.disconnected" }));

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "remote.step.updated",
        data: lifecycle
      })
    ).toEqual(expect.objectContaining({ type: "remote.step.updated" }));
  });
});
