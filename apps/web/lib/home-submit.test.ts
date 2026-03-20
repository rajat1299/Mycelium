import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapOutcomeFromHome, buildOutcomeRedirectPath } from "./home-submit";

const mocks = vi.hoisted(() => ({
  createOutcome: vi.fn(),
  createPlan: vi.fn(),
  createRun: vi.fn()
}));

vi.mock("./api", () => ({
  createOutcome: mocks.createOutcome,
  createPlan: mocks.createPlan,
  createRun: mocks.createRun
}));

describe("home-submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createOutcome.mockResolvedValue({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update.",
      source: "web",
      status: "draft",
      createdAt: "2026-03-19T00:00:00.000Z",
      updatedAt: "2026-03-19T00:00:00.000Z"
    });

    mocks.createPlan.mockResolvedValue({
      id: "plan_outcome_123",
      outcomeId: "outcome_123",
      version: 1,
      createdAt: "2026-03-19T00:00:01.000Z",
      nodes: [],
      edges: []
    });

    mocks.createRun.mockResolvedValue({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "queued",
      createdAt: "2026-03-19T00:00:02.000Z",
      updatedAt: "2026-03-19T00:00:02.000Z",
      steps: []
    });
  });

  it("creates the outcome, plan, and run in sequence", async () => {
    const result = await bootstrapOutcomeFromHome({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update."
    });

    expect(mocks.createOutcome).toHaveBeenCalledWith({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update.",
      source: "web"
    });
    expect(mocks.createPlan).toHaveBeenCalledWith("outcome_123");
    expect(mocks.createRun).toHaveBeenCalledWith("outcome_123", {
      planId: "plan_outcome_123"
    });
    expect(result).toEqual({
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      runId: "run_123",
      bootstrapError: null
    });
    expect(buildOutcomeRedirectPath(result)).toBe("/outcomes/outcome_123?runId=run_123");
  });

  it("redirects to the outcome when plan creation fails", async () => {
    mocks.createPlan.mockRejectedValue(new Error("plan failed"));

    const result = await bootstrapOutcomeFromHome({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update."
    });

    expect(mocks.createRun).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcomeId: "outcome_123",
      planId: null,
      runId: null,
      bootstrapError: "plan"
    });
    expect(buildOutcomeRedirectPath(result)).toBe("/outcomes/outcome_123?bootstrap=plan");
  });

  it("redirects to the outcome with the plan when run creation fails", async () => {
    mocks.createRun.mockRejectedValue(new Error("run failed"));

    const result = await bootstrapOutcomeFromHome({
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft the weekly update."
    });

    expect(result).toEqual({
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      runId: null,
      bootstrapError: "run"
    });
    expect(buildOutcomeRedirectPath(result)).toBe("/outcomes/outcome_123?bootstrap=run");
  });
});
