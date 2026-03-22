import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import type {
  Approval,
  Artifact,
  RunDetail
} from "@computer-oss/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OutcomeDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getOutcome: vi.fn(),
  getPlan: vi.fn(),
  getRun: vi.fn(),
  getLatestRun: vi.fn(),
  getRunArtifacts: vi.fn(),
  getRunAssistantMessages: vi.fn(),
  getRunCheckpoints: vi.fn(),
  getCheckpoint: vi.fn(),
  getRunAudit: vi.fn(),
  getRunLogs: vi.fn(),
  getRunArtifactLineage: vi.fn(),
  getOutcomeMessageHistory: vi.fn(),
  listApprovals: vi.fn(),
  listWorkers: vi.fn(),
  listAuthProfiles: vi.fn(),
  listOutcomes: vi.fn(),
  createOutcomeMessage: vi.fn(),
  createPlan: vi.fn(),
  createRun: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn(),
  revalidatePath: vi.fn()
}));

let observedTaskOutcomes: Array<{ id: string; prompt: string; status: string }> = [];
let observedSelectedOutcomeId: string | null = null;
let observedConversationRun: RunDetail | null = null;
let observedConversationArtifacts: Artifact[] = [];
let observedConversationLogs: Array<{ message: string; level: string }> = [];
let observedConversationAssistantMessages: Array<{ content: string; kind: string }> = [];
let observedConversationPendingApprovals: Approval[] = [];
let observedConversationSource: string | null = null;

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

vi.mock("../../../components/outcomes/outcome-conversation", () => ({
  OutcomeConversation: ({
    outcomeSource,
    initialRun,
    initialArtifacts,
    initialLogs,
    initialAssistantMessages,
    initialPendingApprovals
  }: {
    outcomeSource: string;
    initialRun: RunDetail | null;
    initialArtifacts: Artifact[];
    initialLogs: Array<{ message: string; level: string }>;
    initialAssistantMessages: Array<{ content: string; kind: string }>;
    initialPendingApprovals: Approval[];
  }) => {
    observedConversationRun = initialRun;
    observedConversationArtifacts = initialArtifacts;
    observedConversationLogs = initialLogs;
    observedConversationAssistantMessages = initialAssistantMessages;
    observedConversationPendingApprovals = initialPendingApprovals;
    observedConversationSource = outcomeSource;
    return <div data-testid="outcome-conversation" />;
  }
}));

vi.mock("../../../components/outcomes/tasks-pane", () => ({
  TasksPane: ({
    outcomes,
    selectedOutcomeId
  }: {
    outcomes: Array<{ id: string; prompt: string; status: string }>;
    selectedOutcomeId: string | null;
  }) => {
    observedTaskOutcomes = outcomes;
    observedSelectedOutcomeId = selectedOutcomeId;
    return (
      <div data-testid="tasks-pane">
        {selectedOutcomeId}:{outcomes.length}
      </div>
    );
  }
}));

vi.mock("../../../components/outcomes/follow-up-input", () => ({
  FollowUpInput: () => <div data-testid="follow-up-input" />
}));

vi.mock("../../../components/outcomes/execution-console", () => ({
  ExecutionConsole: () => <div data-testid="execution-console" />
}));

vi.mock("../../../lib/api", () => ({
  createPlan: mocks.createPlan,
  createRun: mocks.createRun,
  createOutcomeMessage: mocks.createOutcomeMessage,
  getOutcome: mocks.getOutcome,
  getPlan: mocks.getPlan,
  getRun: mocks.getRun,
  getLatestRun: mocks.getLatestRun,
  getRunArtifacts: mocks.getRunArtifacts,
  getRunAssistantMessages: mocks.getRunAssistantMessages,
  getRunCheckpoints: mocks.getRunCheckpoints,
  getCheckpoint: mocks.getCheckpoint,
  getRunAudit: mocks.getRunAudit,
  getRunLogs: mocks.getRunLogs,
  getRunArtifactLineage: mocks.getRunArtifactLineage,
  getOutcomeMessageHistory: mocks.getOutcomeMessageHistory,
  listOutcomes: mocks.listOutcomes,
  listApprovals: mocks.listApprovals,
  listWorkers: mocks.listWorkers,
  listAuthProfiles: mocks.listAuthProfiles
}));

afterEach(() => {
  cleanup();
});

describe("OutcomeDetailPage", () => {
  beforeEach(() => {
    observedTaskOutcomes = [];
    observedSelectedOutcomeId = null;
    observedConversationRun = null;
    observedConversationArtifacts = [];
    observedConversationLogs = [];
    observedConversationAssistantMessages = [];
    observedConversationPendingApprovals = [];
    observedConversationSource = null;
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
    mocks.getRunArtifacts.mockResolvedValue([
      {
        id: "artifact_123",
        outcomeId: "outcome_123",
        runId: "run_latest",
        stepId: "step_1",
        kind: "analysis",
        relativePath: "artifacts/analyze-outcome.md",
        size: 128,
        metadata: {},
        createdAt: "2026-03-11T00:09:30.000Z"
      }
    ]);
    mocks.getRunLogs.mockResolvedValue([
      {
        runId: "run_latest",
        stepId: "step_1",
        stepTitle: "Analyze outcome",
        level: "info",
        message: "Recovered persisted log output.",
        createdAt: "2026-03-11T00:09:20.000Z"
      }
    ]);
    mocks.getRunAssistantMessages.mockResolvedValue([
      {
        id: "assistant_123",
        runId: "run_latest",
        kind: "acknowledgment",
        content: "I'll start by loading relevant skills.",
        createdAt: "2026-03-11T00:09:10.000Z",
        updatedAt: "2026-03-11T00:09:12.000Z",
        status: "completed"
      }
    ]);
    mocks.getRunArtifactLineage.mockResolvedValue([
      {
        id: "edge_123",
        runId: "run_latest",
        parentArtifactId: "artifact_parent",
        childArtifactId: "artifact_123",
        parentStepId: "step_parent",
        childStepId: "step_1",
        relation: "derived_from",
        createdAt: "2026-03-11T00:09:31.000Z"
      }
    ]);
    mocks.getRunCheckpoints.mockResolvedValue([
      {
        id: "checkpoint_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_latest",
        sequence: 2,
        kind: "step_completed",
        resumable: true,
        storeKey: "run_latest/000002.json",
        checksum:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        byteSize: 1024,
        stepId: "step_1",
        createdAt: "2026-03-11T00:09:32.000Z"
      }
    ]);
    mocks.getCheckpoint.mockResolvedValue({
      id: "checkpoint_123",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      runId: "run_latest",
      sequence: 2,
      kind: "step_completed",
      resumable: true,
      storeKey: "run_latest/000002.json",
      checksum:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      byteSize: 1024,
      stepId: "step_1",
      createdAt: "2026-03-11T00:09:32.000Z",
      payload: {
        version: 1,
        run: {
          id: "run_latest",
          outcomeId: "outcome_123",
          workspaceId: "ws_default",
          status: "queued"
        },
        steps: [],
        readyStepIds: [],
        blockedStepIds: [],
        workspacePaths: {
          inputDir: "/tmp/run_latest/input",
          logsDir: "/tmp/run_latest/logs",
          artifactsDir: "/tmp/run_latest/artifacts"
        },
        artifactIds: ["artifact_123"],
        latestAuditSequence: 2
      }
    });
    mocks.getRunAudit.mockResolvedValue([
      {
        id: "audit_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_latest",
        stepId: null,
        checkpointId: "checkpoint_123",
        sequence: 2,
        category: "checkpoint",
        eventType: "checkpoint.created",
        actorType: "system",
        summary: "Checkpoint #2 captured.",
        payload: {},
        createdAt: "2026-03-11T00:09:32.000Z"
      }
    ]);
    mocks.getOutcomeMessageHistory.mockResolvedValue(null);
    mocks.listApprovals.mockResolvedValue([
      {
        id: "approval_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_latest",
        stepId: "step_1",
        status: "pending",
        kind: "output_review_required",
        title: "Review final result",
        summary: "Inspect the final artifact before marking the run complete.",
        instruction: "Approve to complete the run or reject to fail it.",
        artifactIds: ["artifact_123"],
        requestedAt: "2026-03-11T00:09:40.000Z",
        resolvedAt: null,
        resolution: null,
        resolutionNote: null
      }
    ]);
    mocks.listAuthProfiles.mockResolvedValue([
      {
        id: "profile_openai_primary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        credentialId: "cred_openai_primary",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: null,
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z"
      }
    ]);
    mocks.listWorkers.mockResolvedValue([
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
          lastHeartbeatAt: "2026-03-11T00:09:00.000Z"
        },
        connectedAt: "2026-03-11T00:08:00.000Z",
        disconnectedAt: null,
        updatedAt: "2026-03-11T00:09:00.000Z"
      }
    ]);
    mocks.listOutcomes.mockResolvedValue([
      {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Resume the queued run from storage.",
        source: "web",
        status: "queued",
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:10:00.000Z"
      },
      {
        id: "outcome_456",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Summarize the overnight alerts.",
        source: "web",
        status: "running",
        createdAt: "2026-03-10T22:00:00.000Z",
        updatedAt: "2026-03-10T22:45:00.000Z"
      }
    ]);
  });

  it("loads the latest persisted run when no runId query param is provided", async () => {
    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.getLatestRun).toHaveBeenCalledWith("outcome_123");
    expect(mocks.getOutcomeMessageHistory).not.toHaveBeenCalled();
    expect(mocks.getRun).not.toHaveBeenCalled();
    expect(mocks.listOutcomes).toHaveBeenCalledWith("ws_default");
    expect(mocks.listApprovals).toHaveBeenCalledWith("ws_default");
    expect(mocks.getRunArtifacts).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunLogs).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunAssistantMessages).toHaveBeenCalledWith("run_latest");
    expect(mocks.listAuthProfiles).not.toHaveBeenCalled();
    expect(mocks.listWorkers).not.toHaveBeenCalled();
    expect(mocks.getRunArtifactLineage).not.toHaveBeenCalled();
    expect(mocks.getRunCheckpoints).not.toHaveBeenCalled();
    expect(mocks.getCheckpoint).not.toHaveBeenCalled();
    expect(mocks.getRunAudit).not.toHaveBeenCalled();
    expect(observedConversationSource).toBe("web");
    expect(observedSelectedOutcomeId).toBe("outcome_123");
    expect(observedTaskOutcomes).toEqual([
      expect.objectContaining({
        id: "outcome_123",
        prompt: "Resume the queued run from storage."
      }),
      expect.objectContaining({
        id: "outcome_456",
        prompt: "Summarize the overnight alerts."
      })
    ]);
    expect(observedConversationRun?.id).toBe("run_latest");
    expect(observedConversationArtifacts).toEqual([
      expect.objectContaining({
        id: "artifact_123",
        relativePath: "artifacts/analyze-outcome.md"
      })
    ]);
    expect(observedConversationLogs).toEqual([
      expect.objectContaining({
        message: "Recovered persisted log output.",
        level: "info"
      })
    ]);
    expect(observedConversationAssistantMessages).toEqual([
      expect.objectContaining({
        kind: "acknowledgment",
        content: "I'll start by loading relevant skills."
      })
    ]);
    expect(observedConversationPendingApprovals).toEqual([
      expect.objectContaining({
        id: "approval_123",
        runId: "run_latest"
      })
    ]);
    expect(screen.getByTestId("tasks-pane")).toHaveTextContent("outcome_123:2");
    expect(screen.getByTestId("outcome-conversation")).toBeInTheDocument();
    expect(screen.getByTestId("follow-up-input")).toBeInTheDocument();
    expect(screen.queryByTestId("execution-console")).not.toBeInTheDocument();
    expect(screen.queryByText("Operator trace")).not.toBeInTheDocument();
  });

  it("ignores a runId that belongs to a different outcome and falls back to the latest local run", async () => {
    mocks.getRun.mockResolvedValue({
      id: "run_other",
      outcomeId: "outcome_other",
      planId: "plan_outcome_other",
      status: "queued",
      createdAt: "2026-03-11T00:08:00.000Z",
      updatedAt: "2026-03-11T00:08:00.000Z",
      steps: []
    });

    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({ runId: "run_other" })
      })
    );

    expect(mocks.getRun).toHaveBeenCalledWith("run_other");
    expect(mocks.getLatestRun).toHaveBeenCalledWith("outcome_123");
    expect(mocks.listApprovals).toHaveBeenCalledWith("ws_default");
    expect(mocks.getRunArtifacts).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunLogs).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunAssistantMessages).toHaveBeenCalledWith("run_latest");
    expect(mocks.listAuthProfiles).not.toHaveBeenCalled();
    expect(mocks.getRunArtifactLineage).not.toHaveBeenCalled();
    expect(mocks.getRunCheckpoints).not.toHaveBeenCalled();
    expect(mocks.getCheckpoint).not.toHaveBeenCalled();
    expect(mocks.getRunAudit).not.toHaveBeenCalled();
    expect(observedConversationRun?.id).toBe("run_latest");
  });

  it("keeps the outcome page narrative-first even for messaging-triggered outcomes", async () => {
    mocks.getOutcome.mockResolvedValue({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Summarize the incident thread.",
      source: "slack",
      status: "running",
      createdAt: "2026-03-18T14:00:00.000Z",
      updatedAt: "2026-03-18T14:10:00.000Z"
    });

    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.getOutcomeMessageHistory).not.toHaveBeenCalled();
    expect(observedConversationSource).toBe("slack");
    expect(screen.queryByTestId("execution-console")).not.toBeInTheDocument();
  });

  it("shows a bootstrap error banner when automatic run start failed on home submit", async () => {
    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({ bootstrap: "run" })
      })
    );

    expect(
      screen.getByText(/automatic run start failed/i)
    ).toBeInTheDocument();
  });

  it("removes operator controls from the outcomes page", async () => {
    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(screen.queryByText("Operator trace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("execution-console")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plan-graph")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plan-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("outcome-activity")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More options" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Share")).not.toBeInTheDocument();
  });
});
