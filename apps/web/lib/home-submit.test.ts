import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapOutcomeFromHome, buildOutcomeRedirectPath } from "./home-submit";

const mocks = vi.hoisted(() => ({
  startOutcome: vi.fn()
}));

vi.mock("./api", () => ({
  startOutcome: mocks.startOutcome
}));

describe("home-submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.startOutcome.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Draft the weekly update.",
        source: "web",
        status: "queued",
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z"
      },
      triggerMessage: {
        id: "msg_123",
        outcomeId: "outcome_123",
        role: "user",
        content: "Draft the weekly update.",
        createdAt: "2026-03-19T00:00:00.000Z"
      },
      plan: {
        id: "plan_outcome_123",
        outcomeId: "outcome_123",
        triggerMessageId: "msg_123",
        status: "draft",
        createdAt: "2026-03-19T00:00:01.000Z",
        updatedAt: "2026-03-19T00:00:01.000Z",
        nodes: [],
        edges: []
      },
      run: {
        id: "run_123",
        outcomeId: "outcome_123",
        planId: "plan_outcome_123",
        triggerMessageId: "msg_123",
        status: "queued",
        createdAt: "2026-03-19T00:00:02.000Z",
        updatedAt: "2026-03-19T00:00:02.000Z",
        steps: []
      }
    });
  });

  it("starts an outcome thread with a single API call", async () => {
    const result = await bootstrapOutcomeFromHome({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update."
    });

    expect(mocks.startOutcome).toHaveBeenCalledWith({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update.",
      source: "web"
    });
    expect(result).toEqual({
      outcomeId: "outcome_123",
      runId: "run_123"
    });
    expect(buildOutcomeRedirectPath(result)).toBe("/outcomes/outcome_123?runId=run_123");
  });

  it("redirects to the outcome when the thread starts without a run", async () => {
    mocks.startOutcome.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Draft the weekly update.",
        source: "web",
        status: "draft",
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z"
      },
      triggerMessage: {
        id: "msg_123",
        outcomeId: "outcome_123",
        role: "user",
        content: "Draft the weekly update.",
        createdAt: "2026-03-19T00:00:00.000Z"
      },
      plan: null,
      run: null
    });

    const result = await bootstrapOutcomeFromHome({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update."
    });

    expect(result).toEqual({
      outcomeId: "outcome_123",
      runId: null
    });
    expect(buildOutcomeRedirectPath(result)).toBe("/outcomes/outcome_123");
  });
});
