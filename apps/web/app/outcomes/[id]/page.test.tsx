import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import type {
  Approval,
  Artifact,
  Plan,
  RunDetail
} from "@computer-oss/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OutcomeDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getOutcomeThreadSnapshot: vi.fn(),
  getOutcome: vi.fn(),
  getPlan: vi.fn(),
  getRunPlan: vi.fn(),
  getRun: vi.fn(),
  getLatestRun: vi.fn(),
  getRunArtifacts: vi.fn(),
  getOutcomeMessages: vi.fn(),
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
  continueOutcome: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn(),
  revalidatePath: vi.fn()
}));

const hoistedErrors = vi.hoisted(() => ({
  OutcomeContinueConflictError: class MockOutcomeContinueConflictError extends Error {
    constructor(message = "Mycelium is still working on the current run.") {
      super(message);
      this.name = "OutcomeContinueConflictError";
    }
  }
}));

let observedTaskOutcomes: Array<{ id: string; prompt: string; status: string }> = [];
let observedSelectedOutcomeId: string | null = null;
let observedConversationPlan: Plan | null = null;
let observedConversationRun: RunDetail | null = null;
let observedConversationThread:
  | { plans: Plan[]; runs: RunDetail[]; isHydrated?: boolean }
  | null = null;
let observedConversationArtifacts: Artifact[] = [];
let observedConversationLogs: Array<{ message: string; level: string }> = [];
let observedConversationAssistantMessages: Array<{ content: string; kind: string }> = [];
let observedConversationMessages: Array<{ content: string; role: string }> = [];
let observedConversationPendingApprovals: Approval[] = [];
let observedConversationSource: string | null = null;
let observedFollowUpAction: ((formData: FormData) => Promise<void>) | null = null;
let observedFollowUpDisabled: boolean | null = null;

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
    initialPlan,
    outcomeSource,
    initialRun,
    initialThread,
    initialArtifacts,
    initialLogs,
    initialAssistantMessages,
    initialMessages,
    initialPendingApprovals
  }: {
    initialPlan: Plan | null;
    outcomeSource: string;
    initialRun: RunDetail | null;
    initialThread?: { plans: Plan[]; runs: RunDetail[]; isHydrated?: boolean };
    initialArtifacts: Artifact[];
    initialLogs: Array<{ message: string; level: string }>;
    initialAssistantMessages: Array<{ content: string; kind: string }>;
    initialMessages: Array<{ content: string; role: string }>;
    initialPendingApprovals: Approval[];
  }) => {
    observedConversationPlan = initialPlan;
    observedConversationRun = initialRun;
    observedConversationThread = initialThread ?? null;
    observedConversationArtifacts = initialArtifacts;
    observedConversationLogs = initialLogs;
    observedConversationAssistantMessages = initialAssistantMessages;
    observedConversationMessages = initialMessages;
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
  FollowUpInput: ({
    action,
    disabled
  }: {
    action: (formData: FormData) => Promise<void>;
    disabled?: boolean;
  }) => {
    observedFollowUpAction = action;
    observedFollowUpDisabled = disabled ?? null;
    return <div data-testid="follow-up-input" />;
  }
}));

vi.mock("../../../components/outcomes/execution-console", () => ({
  ExecutionConsole: () => <div data-testid="execution-console" />
}));

vi.mock("../../../lib/api", () => ({
  OutcomeContinueConflictError: hoistedErrors.OutcomeContinueConflictError,
  continueOutcome: mocks.continueOutcome,
  getOutcomeThreadSnapshot: mocks.getOutcomeThreadSnapshot,
  getOutcome: mocks.getOutcome,
  getPlan: mocks.getPlan,
  getRunPlan: mocks.getRunPlan,
  getRun: mocks.getRun,
  getLatestRun: mocks.getLatestRun,
  getRunArtifacts: mocks.getRunArtifacts,
  getOutcomeMessages: mocks.getOutcomeMessages,
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
    observedConversationPlan = null;
    observedConversationRun = null;
    observedConversationThread = null;
    observedConversationArtifacts = [];
    observedConversationLogs = [];
    observedConversationAssistantMessages = [];
    observedConversationMessages = [];
    observedConversationPendingApprovals = [];
    observedConversationSource = null;
    observedFollowUpAction = null;
    observedFollowUpDisabled = null;
    vi.clearAllMocks();

    mocks.getOutcomeThreadSnapshot.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Resume the queued run from storage.",
        source: "web",
        status: "queued",
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:10:00.000Z"
      },
      messages: [
        {
          id: "msg_123",
          outcomeId: "outcome_123",
          role: "user",
          content: "Refine the final report for principals.",
          createdAt: "2026-03-11T00:09:25.000Z"
        },
        {
          id: "msg_456",
          outcomeId: "outcome_123",
          role: "user",
          content: "Now make it shorter for the district cabinet.",
          createdAt: "2026-03-11T00:11:25.000Z"
        }
      ],
      plans: [
        {
          id: "plan_run_older",
          outcomeId: "outcome_123",
          triggerMessageId: "msg_123",
          status: "draft",
          createdAt: "2026-03-11T00:09:05.000Z",
          updatedAt: "2026-03-11T00:09:05.000Z",
          nodes: [],
          edges: []
        },
        {
          id: "plan_run_latest",
          outcomeId: "outcome_123",
          triggerMessageId: "msg_456",
          status: "draft",
          createdAt: "2026-03-11T00:11:05.000Z",
          updatedAt: "2026-03-11T00:11:05.000Z",
          nodes: [],
          edges: []
        }
      ],
      runs: [
        {
          id: "run_older",
          outcomeId: "outcome_123",
          planId: "plan_run_older",
          triggerMessageId: "msg_123",
          status: "completed",
          createdAt: "2026-03-11T00:09:00.000Z",
          updatedAt: "2026-03-11T00:10:00.000Z",
          steps: []
        },
        {
          id: "run_latest",
          outcomeId: "outcome_123",
          planId: "plan_run_latest",
          triggerMessageId: "msg_456",
          status: "queued",
          createdAt: "2026-03-11T00:11:00.000Z",
          updatedAt: "2026-03-11T00:11:00.000Z",
          steps: []
        }
      ],
      assistantMessages: [
        {
          id: "assistant_123",
          runId: "run_older",
          kind: "acknowledgment",
          content: "I'll start by loading relevant skills.",
          createdAt: "2026-03-11T00:09:10.000Z",
          updatedAt: "2026-03-11T00:09:12.000Z",
          status: "completed"
        },
        {
          id: "assistant_456",
          runId: "run_latest",
          kind: "acknowledgment",
          content: "I’m tightening the cabinet version now.",
          createdAt: "2026-03-11T00:11:10.000Z",
          updatedAt: "2026-03-11T00:11:12.000Z",
          status: "completed"
        }
      ],
      artifacts: [
        {
          id: "artifact_123",
          outcomeId: "outcome_123",
          runId: "run_older",
          stepId: "step_1",
          kind: "analysis",
          relativePath: "artifacts/analyze-outcome.md",
          size: 128,
          metadata: {},
          createdAt: "2026-03-11T00:09:30.000Z"
        }
      ],
      logs: [
        {
          runId: "run_older",
          stepId: "step_1",
          stepTitle: "Analyze outcome",
          level: "info",
          message: "Recovered persisted log output.",
          createdAt: "2026-03-11T00:09:20.000Z"
        }
      ],
      pendingApprovals: [
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
          requestedAt: "2026-03-11T00:11:40.000Z",
          resolvedAt: null,
          resolution: null,
          resolutionNote: null
        }
      ]
    });
    mocks.getPlan.mockResolvedValue(null);
    mocks.getRunPlan.mockResolvedValue({
      id: "plan_run_latest",
      outcomeId: "outcome_123",
      triggerMessageId: "msg_123",
      status: "draft",
      createdAt: "2026-03-11T00:09:05.000Z",
      updatedAt: "2026-03-11T00:09:05.000Z",
      nodes: [],
      edges: []
    });
    mocks.getRun.mockResolvedValue(null);
    mocks.getLatestRun.mockResolvedValue({
      id: "run_latest",
      outcomeId: "outcome_123",
      planId: "plan_run_latest",
      triggerMessageId: "msg_123",
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
    mocks.getOutcomeMessages.mockResolvedValue([]);
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

    expect(mocks.getOutcomeThreadSnapshot).toHaveBeenCalledWith("outcome_123");
    expect(mocks.getLatestRun).not.toHaveBeenCalled();
    expect(mocks.getOutcome).not.toHaveBeenCalled();
    expect(mocks.getRun).not.toHaveBeenCalled();
    expect(mocks.getRunPlan).not.toHaveBeenCalled();
    expect(mocks.getPlan).not.toHaveBeenCalled();
    expect(mocks.listOutcomes).toHaveBeenCalledWith("ws_default");
    expect(mocks.listApprovals).not.toHaveBeenCalled();
    expect(mocks.getRunArtifacts).not.toHaveBeenCalled();
    expect(mocks.getRunLogs).not.toHaveBeenCalled();
    expect(mocks.getOutcomeMessages).not.toHaveBeenCalled();
    expect(mocks.getRunAssistantMessages).not.toHaveBeenCalled();
    expect(observedConversationSource).toBe("web");
    expect(observedSelectedOutcomeId).toBe("outcome_123");
    expect(observedConversationPlan).toEqual(
      expect.objectContaining({
        id: "plan_run_latest",
        triggerMessageId: "msg_456"
      })
    );
    expect(observedConversationThread).toEqual(
      expect.objectContaining({
        isHydrated: true,
        plans: [
          expect.objectContaining({ id: "plan_run_older" }),
          expect.objectContaining({ id: "plan_run_latest" })
        ],
        runs: [
          expect.objectContaining({ id: "run_older" }),
          expect.objectContaining({ id: "run_latest" })
        ]
      })
    );
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
    expect(observedConversationAssistantMessages).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
        kind: "acknowledgment",
        content: "I'll start by loading relevant skills."
      })
      ])
    );
    expect(observedConversationMessages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "Refine the final report for principals."
      }),
      expect.objectContaining({
        role: "user",
        content: "Now make it shorter for the district cabinet."
      })
    ]);
    expect(observedConversationPendingApprovals).toEqual([
      expect.objectContaining({
        id: "approval_123",
        runId: "run_latest"
      })
    ]);
    expect(observedFollowUpDisabled).toBe(true);
    expect(screen.getByTestId("tasks-pane")).toHaveTextContent("outcome_123:2");
    expect(screen.getByTestId("outcome-conversation")).toBeInTheDocument();
    expect(screen.getByTestId("follow-up-input")).toBeInTheDocument();
    expect(screen.queryByTestId("execution-console")).not.toBeInTheDocument();
    expect(screen.queryByText("Operator trace")).not.toBeInTheDocument();
  });

  it("does not let runId replace the main thread transcript", async () => {
    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({ runId: "run_older" })
      })
    );

    expect(mocks.getOutcomeThreadSnapshot).toHaveBeenCalledWith("outcome_123");
    expect(mocks.getRun).not.toHaveBeenCalled();
    expect(mocks.getLatestRun).not.toHaveBeenCalled();
    expect(mocks.getRunPlan).not.toHaveBeenCalled();
    expect(observedConversationRun?.id).toBe("run_latest");
    expect(observedConversationMessages).toEqual([
      expect.objectContaining({
        content: "Refine the final report for principals."
      }),
      expect.objectContaining({
        content: "Now make it shorter for the district cabinet."
      })
    ]);
  });

  it("keeps the outcome page narrative-first even for messaging-triggered outcomes", async () => {
    mocks.getOutcomeThreadSnapshot.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Summarize the incident thread.",
        source: "slack",
        status: "running",
        createdAt: "2026-03-18T14:00:00.000Z",
        updatedAt: "2026-03-18T14:10:00.000Z"
      },
      messages: [],
      plans: [],
      runs: [],
      assistantMessages: [],
      artifacts: [],
      logs: [],
      pendingApprovals: []
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

  it("hydrates persisted follow-up messages even when the outcome has no run yet", async () => {
    mocks.getOutcomeThreadSnapshot.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Resume the queued run from storage.",
        source: "web",
        status: "completed",
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:10:00.000Z"
      },
      messages: [
        {
          id: "msg_123",
          outcomeId: "outcome_123",
          role: "user",
          content: "Refine the final report for principals.",
          createdAt: "2026-03-11T00:09:25.000Z"
        }
      ],
      plans: [],
      runs: [],
      assistantMessages: [],
      artifacts: [],
      logs: [],
      pendingApprovals: []
    });

    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.getOutcomeThreadSnapshot).toHaveBeenCalledWith("outcome_123");
    expect(mocks.getPlan).not.toHaveBeenCalled();
    expect(mocks.getRunPlan).not.toHaveBeenCalled();
    expect(mocks.getOutcomeMessages).not.toHaveBeenCalled();
    expect(observedConversationRun).toBeNull();
    expect(observedConversationThread).toEqual(
      expect.objectContaining({
        isHydrated: true,
        plans: [],
        runs: []
      })
    );
    expect(observedFollowUpDisabled).toBe(false);
    expect(observedConversationMessages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "Refine the final report for principals."
      })
    ]);
  });

  it("does not fall back to the latest outcome plan when the selected run has no plan snapshot", async () => {
    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.getPlan).not.toHaveBeenCalled();
    expect(observedConversationPlan).toEqual(
      expect.objectContaining({
        id: "plan_run_latest"
      })
    );
  });

  it("continues the thread and redirects to the returned run id", async () => {
    mocks.continueOutcome.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Resume the queued run from storage.",
        source: "web",
        status: "queued",
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:10:00.000Z"
      },
      triggerMessage: {
        id: "msg_followup",
        outcomeId: "outcome_123",
        role: "user",
        content: "Make it shorter.",
        createdAt: "2026-03-11T00:11:00.000Z"
      },
      plan: {
        id: "plan_followup",
        outcomeId: "outcome_123",
        triggerMessageId: "msg_followup",
        status: "draft",
        createdAt: "2026-03-11T00:11:00.000Z",
        updatedAt: "2026-03-11T00:11:00.000Z",
        nodes: [],
        edges: []
      },
      run: {
        id: "run_followup",
        outcomeId: "outcome_123",
        planId: "plan_followup",
        triggerMessageId: "msg_followup",
        status: "queued",
        createdAt: "2026-03-11T00:11:01.000Z",
        updatedAt: "2026-03-11T00:11:01.000Z",
        steps: []
      }
    });

    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({})
      })
    );

    const formData = new FormData();
    formData.set("content", "Make it shorter.");

    await observedFollowUpAction?.(formData);

    expect(mocks.continueOutcome).toHaveBeenCalledWith("outcome_123", {
      content: "Make it shorter."
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/outcomes/outcome_123?runId=run_followup"
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the follow-up composer disabled when viewing an older run while the outcome is still active", async () => {
    mocks.getOutcomeThreadSnapshot.mockResolvedValue({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_default",
        userId: "user_default",
        prompt: "Resume the queued run from storage.",
        source: "web",
        status: "running",
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:12:00.000Z"
      },
      messages: [],
      plans: [
        {
          id: "plan_historical",
          outcomeId: "outcome_123",
          triggerMessageId: "msg_historical",
          status: "draft",
          createdAt: "2026-03-11T00:08:00.000Z",
          updatedAt: "2026-03-11T00:08:00.000Z",
          nodes: [],
          edges: []
        }
      ],
      runs: [
        {
          id: "run_historical",
          outcomeId: "outcome_123",
          planId: "plan_historical",
          triggerMessageId: "msg_historical",
          status: "completed",
          createdAt: "2026-03-11T00:08:00.000Z",
          updatedAt: "2026-03-11T00:09:00.000Z",
          steps: []
        }
      ],
      assistantMessages: [],
      artifacts: [],
      logs: [],
      pendingApprovals: []
    });

    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({ runId: "run_historical" })
      })
    );

    expect(observedConversationRun?.id).toBe("run_historical");
    expect(observedFollowUpDisabled).toBe(true);
  });

  it("redirects back to the outcome page with a conflict banner when a stale follow-up hits an active run", async () => {
    mocks.continueOutcome.mockRejectedValue(
      new hoistedErrors.OutcomeContinueConflictError(
        "Outcome outcome_123 already has an active run run_live with status running."
      )
    );

    render(
      await OutcomeDetailPage({
        params: Promise.resolve({ id: "outcome_123" }),
        searchParams: Promise.resolve({ runId: "run_latest" })
      })
    );

    const formData = new FormData();
    formData.set("content", "Make it shorter.");

    await observedFollowUpAction?.(formData);

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/outcomes/outcome_123?runId=run_latest&conflict=active-run"
    );
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
