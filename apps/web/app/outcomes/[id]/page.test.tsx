import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import type {
  Approval,
  ArtifactLineageEdge,
  AuditEvent,
  CheckpointDetail,
  CheckpointSummary,
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
  getRunCheckpoints: vi.fn(),
  getCheckpoint: vi.fn(),
  getRunAudit: vi.fn(),
  getRunLogs: vi.fn(),
  getRunArtifactLineage: vi.fn(),
  listApprovals: vi.fn(),
  listAuthProfiles: vi.fn(),
  createPlan: vi.fn(),
  createRun: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn(),
  revalidatePath: vi.fn()
}));

let observedRun: RunDetail | null = null;
let observedSelectedRunId: string | null = null;
let observedArtifacts: Array<{ id: string; relativePath: string }> = [];
let observedLogs: Array<{ message: string; level: string }> = [];
let observedAuthProfiles: Array<{ id: string; label: string }> = [];
let observedPendingApprovals: Approval[] = [];
let observedLineageEdges: ArtifactLineageEdge[] = [];
let observedCheckpoints: CheckpointSummary[] = [];
let observedSelectedCheckpoint: CheckpointDetail | null = null;
let observedAuditEvents: AuditEvent[] = [];

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

vi.mock("../../../components/outcomes/execution-console", () => ({
  ExecutionConsole: ({
    initialRun,
    initialArtifacts,
    initialLogs,
    initialAuthProfiles,
    initialPendingApprovals = [],
    initialLineageEdges = [],
    initialCheckpoints = [],
    initialSelectedCheckpoint = null,
    initialAuditEvents = []
  }: {
    initialRun: RunDetail | null;
    initialArtifacts: Array<{ id: string; relativePath: string }>;
    initialLogs: Array<{ message: string; level: string }>;
    initialAuthProfiles: Array<{ id: string; label: string }>;
    initialPendingApprovals?: Approval[];
    initialLineageEdges?: ArtifactLineageEdge[];
    initialCheckpoints?: CheckpointSummary[];
    initialSelectedCheckpoint?: CheckpointDetail | null;
    initialAuditEvents?: AuditEvent[];
  }) => {
    observedRun = initialRun;
    observedSelectedRunId = initialRun?.id ?? null;
    observedArtifacts = initialArtifacts;
    observedLogs = initialLogs;
    observedAuthProfiles = initialAuthProfiles;
    observedPendingApprovals = initialPendingApprovals;
    observedLineageEdges = initialLineageEdges;
    observedCheckpoints = initialCheckpoints;
    observedSelectedCheckpoint = initialSelectedCheckpoint;
    observedAuditEvents = initialAuditEvents;
    return (
      <div data-testid="execution-console">
        {(initialRun?.id ?? "none") +
          ":" +
          initialArtifacts.length +
          ":" +
          initialLogs.length +
          ":" +
          initialPendingApprovals.length +
          ":" +
          initialLineageEdges.length +
          ":" +
          initialCheckpoints.length +
          ":" +
          initialAuditEvents.length}
      </div>
    );
  }
}));

vi.mock("../../../components/outcomes/artifact-list", () => ({
  ArtifactList: ({
    initialArtifacts
  }: {
    initialArtifacts: Array<{ id: string; relativePath: string }>;
  }) => {
    observedArtifacts = initialArtifacts;
    return <div data-testid="artifact-list">{initialArtifacts.length}</div>;
  }
}));

vi.mock("../../../lib/api", () => ({
  createPlan: mocks.createPlan,
  createRun: mocks.createRun,
  getOutcome: mocks.getOutcome,
  getPlan: mocks.getPlan,
  getRun: mocks.getRun,
  getLatestRun: mocks.getLatestRun,
  getRunArtifacts: mocks.getRunArtifacts,
  getRunCheckpoints: mocks.getRunCheckpoints,
  getCheckpoint: mocks.getCheckpoint,
  getRunAudit: mocks.getRunAudit,
  getRunLogs: mocks.getRunLogs,
  getRunArtifactLineage: mocks.getRunArtifactLineage,
  listApprovals: mocks.listApprovals,
  listAuthProfiles: mocks.listAuthProfiles
}));

afterEach(() => {
  cleanup();
});

describe("OutcomeDetailPage", () => {
  beforeEach(() => {
    observedRun = null;
    observedSelectedRunId = null;
    observedArtifacts = [];
    observedLogs = [];
    observedAuthProfiles = [];
    observedPendingApprovals = [];
    observedLineageEdges = [];
    observedCheckpoints = [];
    observedSelectedCheckpoint = null;
    observedAuditEvents = [];
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
    expect(mocks.listAuthProfiles).toHaveBeenCalledWith("ws_default");
    expect(mocks.listApprovals).toHaveBeenCalledWith("ws_default");
    expect(mocks.getRunArtifacts).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunArtifactLineage).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunCheckpoints).toHaveBeenCalledWith("run_latest");
    expect(mocks.getCheckpoint).toHaveBeenCalledWith("checkpoint_123");
    expect(mocks.getRunAudit).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunLogs).toHaveBeenCalledWith("run_latest");
    expect(screen.getByTestId("execution-console")).toHaveTextContent(
      "run_latest:1:1:1:1:1:1"
    );
    expect(observedRun?.id).toBe("run_latest");
    expect(observedSelectedRunId).toBe("run_latest");
    expect(observedArtifacts).toEqual([
      expect.objectContaining({
        id: "artifact_123",
        relativePath: "artifacts/analyze-outcome.md"
      })
    ]);
    expect(observedLogs).toEqual([
      expect.objectContaining({
        message: "Recovered persisted log output.",
        level: "info"
      })
    ]);
    expect(observedAuthProfiles).toEqual([
      expect.objectContaining({
        id: "profile_openai_primary",
        label: "OpenAI Primary"
      })
    ]);
    expect(observedPendingApprovals).toEqual([
      expect.objectContaining({
        id: "approval_123",
        runId: "run_latest"
      })
    ]);
    expect(observedCheckpoints).toEqual([
      expect.objectContaining({
        id: "checkpoint_123",
        sequence: 2
      })
    ]);
    expect(observedSelectedCheckpoint).toEqual(
      expect.objectContaining({
        id: "checkpoint_123"
      })
    );
    expect(observedAuditEvents).toEqual([
      expect.objectContaining({
        id: "audit_123",
        sequence: 2
      })
    ]);
    expect(observedLineageEdges).toEqual([
      expect.objectContaining({
        id: "edge_123",
        runId: "run_latest"
      })
    ]);
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
    expect(mocks.listAuthProfiles).toHaveBeenCalledWith("ws_default");
    expect(mocks.listApprovals).toHaveBeenCalledWith("ws_default");
    expect(mocks.getRunArtifacts).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunArtifactLineage).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunCheckpoints).toHaveBeenCalledWith("run_latest");
    expect(mocks.getCheckpoint).toHaveBeenCalledWith("checkpoint_123");
    expect(mocks.getRunAudit).toHaveBeenCalledWith("run_latest");
    expect(mocks.getRunLogs).toHaveBeenCalledWith("run_latest");
    expect(screen.getByTestId("execution-console")).toHaveTextContent(
      "run_latest:1:1:1:1:1:1"
    );
    expect(observedRun?.id).toBe("run_latest");
    expect(observedSelectedRunId).toBe("run_latest");
  });
});
