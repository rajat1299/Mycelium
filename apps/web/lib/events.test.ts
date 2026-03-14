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
    subscribeToOutcomeEvents("outcome_123", handler);

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
        outcomeId: "outcome_123",
        type: "approval.requested"
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outcomeId: "outcome_123",
        type: "approval.resolved"
      })
    );
  });
});
