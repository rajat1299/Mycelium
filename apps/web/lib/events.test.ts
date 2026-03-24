import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToOutcomeEvents } from "./events";

type Listener = (event: Event) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const current = this.listeners.get(type) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    const message = {
      data: JSON.stringify(payload)
    } as MessageEvent<string>;

    for (const listener of this.listeners.get(type) ?? []) {
      listener(message);
    }
  }
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("subscribeToOutcomeEvents", () => {
  it("reuses a single EventSource per outcome and closes it after the last subscriber leaves", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const unsubscribeFirst = subscribeToOutcomeEvents("outcome_123", firstHandler);
    const unsubscribeSecond = subscribeToOutcomeEvents("outcome_123", secondHandler);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.url).toBe("/api/outcomes/outcome_123/events");

    FakeEventSource.instances[0]?.emit("run.log", {
      runId: "run_123",
      stepTitle: "Analyze outcome",
      level: "info",
      message: "shared stream",
      createdAt: "2026-03-13T15:00:00.000Z"
    });

    expect(firstHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomeId: "outcome_123",
        type: "run.log"
      })
    );
    expect(secondHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomeId: "outcome_123",
        type: "run.log"
      })
    );

    unsubscribeFirst();
    expect(FakeEventSource.instances[0]?.closed).toBe(false);

    unsubscribeSecond();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });

  it("forwards approval lifecycle SSE events to subscribers", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const handler = vi.fn();
    const unsubscribe = subscribeToOutcomeEvents("outcome_approval", handler);

    FakeEventSource.instances[0]?.emit("approval.requested", {
      id: "approval_123",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      status: "pending",
      kind: "output_review_required",
      title: "Review final result",
      summary: null,
      instruction: "Check tone, facts, and formatting.",
      artifactIds: ["artifact_1"],
      requestedAt: "2026-03-14T12:00:00.000Z",
      resolvedAt: null,
      resolution: null,
      resolutionNote: null
    });

    FakeEventSource.instances[0]?.emit("approval.resolved", {
      id: "approval_123",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      status: "resolved",
      kind: "output_review_required",
      title: "Review final result",
      summary: null,
      instruction: "Check tone, facts, and formatting.",
      artifactIds: ["artifact_1"],
      requestedAt: "2026-03-14T12:00:00.000Z",
      resolvedAt: "2026-03-14T12:05:00.000Z",
      resolution: "approved",
      resolutionNote: "Ready to ship."
    });

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        outcomeId: "outcome_approval",
        type: "approval.requested"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outcomeId: "outcome_approval",
        type: "approval.resolved"
      })
    );

    unsubscribe();
  });

  it("forwards checkpoint and resume lifecycle SSE events to subscribers", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const handler = vi.fn();
    const unsubscribe = subscribeToOutcomeEvents("outcome_checkpoint", handler);

    FakeEventSource.instances[0]?.emit("checkpoint.created", {
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
    });

    FakeEventSource.instances[0]?.emit("run.interrupted", {
      run: {
        id: "run_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        planId: "plan_123",
        triggerMessageId: "msg_123",
        status: "interrupted",
        createdAt: "2026-03-16T15:30:00.000Z",
        updatedAt: "2026-03-16T16:05:00.000Z",
        latestCheckpointId: "checkpoint_123",
        resumable: true
      },
      interruptedFromCheckpointId: "checkpoint_123"
    });

    FakeEventSource.instances[0]?.emit("run.resumed", {
      run: {
        id: "run_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        planId: "plan_123",
        triggerMessageId: "msg_123",
        status: "running",
        createdAt: "2026-03-16T15:30:00.000Z",
        updatedAt: "2026-03-16T16:10:00.000Z",
        latestCheckpointId: "checkpoint_123",
        resumable: true
      },
      resumedFromCheckpointId: "checkpoint_123"
    });

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        outcomeId: "outcome_checkpoint",
        type: "checkpoint.created"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outcomeId: "outcome_checkpoint",
        type: "run.interrupted"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        outcomeId: "outcome_checkpoint",
        type: "run.resumed"
      })
    );

    unsubscribe();
  });

  it("forwards remote worker lifecycle SSE events to subscribers", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const handler = vi.fn();
    const unsubscribe = subscribeToOutcomeEvents("outcome_worker", handler);

    FakeEventSource.instances[0]?.emit("worker.connected", {
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
    });

    FakeEventSource.instances[0]?.emit("remote.step.updated", {
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
    });

    FakeEventSource.instances[0]?.emit("worker.disconnected", {
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
    });

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        outcomeId: "outcome_worker",
        type: "worker.connected"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outcomeId: "outcome_worker",
        type: "remote.step.updated"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        outcomeId: "outcome_worker",
        type: "worker.disconnected"
      })
    );

    unsubscribe();
  });

  it("forwards assistant message streaming SSE events to subscribers", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const handler = vi.fn();
    const unsubscribe = subscribeToOutcomeEvents("outcome_streaming", handler);

    FakeEventSource.instances[0]?.emit("assistant.message.started", {
      messageId: "assistant_msg_1",
      runId: "run_123",
      kind: "acknowledgment",
      createdAt: "2026-03-22T00:00:00.000Z"
    });

    FakeEventSource.instances[0]?.emit("assistant.message.delta", {
      messageId: "assistant_msg_1",
      runId: "run_123",
      kind: "acknowledgment",
      delta: "I’ll start by loading context",
      content: "I’ll start by loading context",
      createdAt: "2026-03-22T00:00:00.000Z",
      updatedAt: "2026-03-22T00:00:00.300Z"
    });

    FakeEventSource.instances[0]?.emit("assistant.message.completed", {
      messageId: "assistant_msg_1",
      runId: "run_123",
      kind: "acknowledgment",
      content:
        "I’ll start by loading context and then break the work into parallel research tracks.",
      createdAt: "2026-03-22T00:00:00.000Z",
      completedAt: "2026-03-22T00:00:01.000Z"
    });

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        outcomeId: "outcome_streaming",
        type: "assistant.message.started"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outcomeId: "outcome_streaming",
        type: "assistant.message.delta"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        outcomeId: "outcome_streaming",
        type: "assistant.message.completed"
      })
    );

    unsubscribe();
  });

  it("forwards schedule and messaging SSE events to subscribers", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const handler = vi.fn();
    const unsubscribe = subscribeToOutcomeEvents("outcome_m8", handler);

    FakeEventSource.instances[0]?.emit("schedule.updated", {
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
    });

    FakeEventSource.instances[0]?.emit("schedule.fired", {
      id: "schedule_fire_1",
      scheduleId: "schedule_1",
      occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z",
      scheduledFor: "2026-03-18T14:00:00.000Z",
      firedAt: "2026-03-18T14:00:02.000Z",
      status: "triggered",
      outcomeId: "outcome_123",
      runId: "run_123",
      errorMessage: null
    });

    FakeEventSource.instances[0]?.emit("messaging.connection.updated", {
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
    });

    FakeEventSource.instances[0]?.emit("messaging.delivery.updated", {
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
    });

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        outcomeId: "outcome_m8",
        type: "schedule.updated"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outcomeId: "outcome_m8",
        type: "schedule.fired"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        outcomeId: "outcome_m8",
        type: "messaging.connection.updated"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        outcomeId: "outcome_m8",
        type: "messaging.delivery.updated"
      })
    );

    unsubscribe();
  });
});
