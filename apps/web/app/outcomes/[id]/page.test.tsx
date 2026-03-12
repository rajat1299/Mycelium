import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { RunDetail } from "@computer-oss/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OutcomeDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getOutcome: vi.fn(),
  getPlan: vi.fn(),
  getRun: vi.fn(),
  getLatestRun: vi.fn(),
  createPlan: vi.fn(),
  createRun: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn(),
  revalidatePath: vi.fn()
}));

let observedRun: RunDetail | null = null;

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>
}));

vi.mock("../../../components/outcomes/outcome-activity", () => ({
  OutcomeActivity: () => <div data-testid="outcome-activity" />
}));

vi.mock("../../../components/outcomes/plan-actions", () => ({
  PlanActions: () => <div data-testid="plan-actions" />
}));

vi.mock("../../../components/outcomes/plan-graph", () => ({
  PlanGraph: () => <div data-testid="plan-graph" />
}));

vi.mock("../../../components/outcomes/run-timeline", () => ({
  RunTimeline: ({ initialRun }: { initialRun: RunDetail | null }) => {
    observedRun = initialRun;
    return <div data-testid="run-timeline">{initialRun?.id ?? "none"}</div>;
  }
}));

vi.mock("../../../lib/api", () => ({
  createPlan: mocks.createPlan,
  createRun: mocks.createRun,
  getOutcome: mocks.getOutcome,
  getPlan: mocks.getPlan,
  getRun: mocks.getRun,
  getLatestRun: mocks.getLatestRun
}));

describe("OutcomeDetailPage", () => {
  beforeEach(() => {
    observedRun = null;
    vi.clearAllMocks();

    mocks.getOutcome.mockResolvedValue({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Resume the queued run from storage.",
      source: "web",
      status: "queued",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:10:00.000Z"
    });
    mocks.getPlan.mockResolvedValue(null);
    mocks.getRun.mockResolvedValue(null);
    mocks.getLatestRun.mockResolvedValue({
      id: "run_latest",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "queued",
      createdAt: "2026-03-11T00:09:00.000Z",
      updatedAt: "2026-03-11T00:09:00.000Z",
      steps: []
    });
  });

  it("loads the latest persisted run when no runId query param is provided", async () => {
    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.getLatestRun).toHaveBeenCalledWith("outcome_123");
    expect(mocks.getRun).not.toHaveBeenCalled();
    expect(screen.getByTestId("run-timeline")).toHaveTextContent("run_latest");
    expect(observedRun?.id).toBe("run_latest");
  });
});
