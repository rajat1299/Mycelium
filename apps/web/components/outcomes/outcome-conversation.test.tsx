import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeConversation } from "./outcome-conversation";

const eventStream = vi.hoisted(() => ({
  handlers: new Set<(event: any) => void>()
}));

vi.mock("../../lib/events", () => ({
  subscribeToOutcomeEvents: (
    _outcomeId: string,
    handler: (event: unknown) => void
  ) => {
    const typedHandler = handler as (event: any) => void;
    eventStream.handlers.add(typedHandler);

    return () => {
      eventStream.handlers.delete(typedHandler);
    };
  }
}));

afterEach(() => {
  cleanup();
  eventStream.handlers.clear();
});

describe("OutcomeConversation", () => {
  beforeEach(() => {
    eventStream.handlers.clear();
  });

  it("renders the plan, system summary, and step cards from the current run state", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Draft the weekly update."
        outcomeSource="web"
        initialPlan={{
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
          nodes: [
            {
              id: "node_analyze",
              kind: "root",
              title: "Analyze outcome",
              capability: "reasoning",
              position: 0
            },
            {
              id: "node_synthesize",
              kind: "synthesis",
              title: "Synthesize result",
              capability: "document",
              position: 1
            }
          ],
          edges: [
            {
              id: "edge_1",
              from: "node_analyze",
              to: "node_synthesize"
            }
          ]
        }}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "running",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              routeStatus: "resolved",
              routeProviderId: "openrouter",
              routeModelId: "openrouter/claude-sonnet-4.5",
              routeAuthProfileId: "profile_openrouter_primary",
              routePolicyVersion: 1,
              routeReason: null,
              routeResolvedAt: "2026-03-19T00:01:00.000Z",
              status: "completed",
              position: 0,
              expectedArtifactPath: "artifacts/analyze-outcome.md",
              expectedArtifactKind: "analysis",
              createdAt: "2026-03-19T00:01:00.000Z",
              updatedAt: "2026-03-19T00:01:30.000Z"
            },
            {
              id: "step_2",
              runId: "run_123",
              planNodeId: "node_synthesize",
              title: "Synthesize result",
              kind: "synthesis",
              capability: "document",
              routeStatus: "resolved",
              routeProviderId: "openrouter",
              routeModelId: "openrouter/claude-sonnet-4.5",
              routeAuthProfileId: "profile_openrouter_primary",
              routePolicyVersion: 1,
              routeReason: null,
              routeResolvedAt: "2026-03-19T00:01:00.000Z",
              status: "running",
              position: 1,
              expectedArtifactPath: "artifacts/final-result.md",
              expectedArtifactKind: "result",
              createdAt: "2026-03-19T00:01:00.000Z",
              updatedAt: "2026-03-19T00:02:00.000Z"
            }
          ]
        }}
        initialArtifacts={[
          {
            id: "artifact_1",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_1",
            kind: "analysis",
            relativePath: "artifacts/analyze-outcome.md",
            size: 128,
            metadata: {},
            createdAt: "2026-03-19T00:01:35.000Z"
          }
        ]}
        initialLogs={[
          {
            runId: "run_123",
            stepId: "step_1",
            stepTitle: "Analyze outcome",
            level: "info",
            message: "Analysis finished and artifact persisted.",
            createdAt: "2026-03-19T00:01:34.000Z"
          }
        ]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    expect(screen.getByText("Draft the weekly update.")).toBeInTheDocument();
    expect(screen.getByText(/2 steps/i)).toBeInTheDocument();
    expect(screen.getAllByText("Analyze outcome").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Synthesize result").length).toBeGreaterThan(0);
    expect(screen.getAllByText("openrouter/claude-sonnet-4.5").length).toBeGreaterThan(0);
    expect(
      screen.getByText("/home/user/workspace/analyze-outcome.md")
    ).toBeInTheDocument();
    expect(screen.getByText("Analysis finished and artifact persisted.")).toBeInTheDocument();
  });

  it("updates step state and artifacts when live events arrive", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Draft the weekly update."
        outcomeSource="web"
        initialPlan={{
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
          nodes: [
            {
              id: "node_analyze",
              kind: "root",
              title: "Analyze outcome",
              capability: "reasoning",
              position: 0
            }
          ],
          edges: []
        }}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:01:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              status: "ready",
              position: 0,
              createdAt: "2026-03-19T00:01:00.000Z",
              updatedAt: "2026-03-19T00:01:00.000Z"
            }
          ]
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "run.step.updated",
          data: {
            id: "step_1",
            runId: "run_123",
            planNodeId: "node_analyze",
            title: "Analyze outcome",
            kind: "root",
            capability: "reasoning",
            routeStatus: "resolved",
            routeProviderId: "openrouter",
            routeModelId: "openrouter/claude-sonnet-4.5",
            routeAuthProfileId: "profile_openrouter_primary",
            routePolicyVersion: 1,
            routeReason: null,
            routeResolvedAt: "2026-03-19T00:01:05.000Z",
            status: "completed",
            position: 0,
            createdAt: "2026-03-19T00:01:00.000Z",
            updatedAt: "2026-03-19T00:01:10.000Z"
          }
        });
      }

      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "artifact.created",
          data: {
            id: "artifact_1",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_1",
            kind: "analysis",
            relativePath: "artifacts/analyze-outcome.md",
            size: 128,
            metadata: {},
            createdAt: "2026-03-19T00:01:11.000Z"
          }
        });
      }
    });

    expect(
      screen.getByText("/home/user/workspace/analyze-outcome.md")
    ).toBeInTheDocument();
  });

  it("shows a review blocker card when the run is waiting on approval", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Draft the weekly update."
        outcomeSource="web"
        initialPlan={null}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "blocked",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[
          {
            id: "approval_123",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_1",
            status: "pending",
            kind: "output_review_required",
            title: "Review final result",
            summary: "Inspect the final artifact before marking the run complete.",
            instruction: "Approve to complete the run or reject to fail it.",
            artifactIds: ["artifact_1"],
            requestedAt: "2026-03-19T00:02:00.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        ]}
      />
    );

    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getByText("Review final result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("appends follow-up messages when message.created events arrive", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Draft the weekly update."
        outcomeSource="web"
        initialPlan={null}
        initialRun={null}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "message.created",
          data: {
            id: "msg_123",
            outcomeId: "outcome_123",
            role: "user",
            content: "Refine the final report for principals.",
            createdAt: "2026-03-19T00:03:00.000Z"
          }
        });
      }
    });

    expect(
      screen.getByText("Refine the final report for principals.")
    ).toBeInTheDocument();
  });

  it("surfaces a completed result artifact as a dedicated delivery block", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Research AI in K-12 education and generate a PDF."
        outcomeSource="web"
        initialPlan={{
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-21T00:00:00.000Z",
          updatedAt: "2026-03-21T00:00:00.000Z",
          nodes: [
            {
              id: "node_report",
              kind: "synthesis",
              title: "Compile final report",
              capability: "document",
              position: 0
            }
          ],
          edges: []
        }}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "completed",
          createdAt: "2026-03-21T00:01:00.000Z",
          updatedAt: "2026-03-21T00:05:00.000Z",
          steps: [
            {
              id: "step_report",
              runId: "run_123",
              planNodeId: "node_report",
              title: "Compile final report",
              kind: "synthesis",
              capability: "document",
              routeStatus: "resolved",
              routeProviderId: "anthropic",
              routeModelId: "claude-opus-4.6",
              routeAuthProfileId: "profile_anthropic_primary",
              routePolicyVersion: 1,
              routeReason: null,
              routeResolvedAt: "2026-03-21T00:01:00.000Z",
              status: "completed",
              position: 0,
              expectedArtifactPath: "artifacts/final-report.pdf",
              expectedArtifactKind: "result",
              createdAt: "2026-03-21T00:01:00.000Z",
              updatedAt: "2026-03-21T00:04:00.000Z"
            }
          ]
        }}
        initialArtifacts={[
          {
            id: "artifact_report",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_report",
            kind: "result",
            relativePath: "artifacts/final-report.pdf",
            size: 2048,
            metadata: {
              summary: "Executive summary and district recommendations."
            },
            createdAt: "2026-03-21T00:04:01.000Z"
          }
        ]}
        initialLogs={[
          {
            runId: "run_123",
            level: "info",
            message: "All four research tracks are complete. Compiling the final report now.",
            createdAt: "2026-03-21T00:03:30.000Z"
          }
        ]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    expect(screen.getByText("Delivered artifact")).toBeInTheDocument();
    expect(screen.getByText("Final result ready")).toBeInTheDocument();
    expect(
      screen.getAllByText("/home/user/workspace/final-report.pdf").length
    ).toBe(1);
    expect(
      screen.getAllByText("Executive summary and district recommendations.").length
    ).toBe(1);
  });

  it("keeps streamed assistant acknowledgment and final delivery as separate narrative blocks", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Research AI in K-12 education and generate a PDF."
        outcomeSource="web"
        initialPlan={null}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "running",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.started",
          data: {
            messageId: "assistant_msg_1",
            runId: "run_123",
            kind: "acknowledgment",
            createdAt: "2026-03-22T00:00:00.000Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.delta",
          data: {
            messageId: "assistant_msg_1",
            runId: "run_123",
            kind: "acknowledgment",
            delta: "I’ll start by loading relevant context.",
            content: "I’ll start by loading relevant context.",
            createdAt: "2026-03-22T00:00:00.000Z",
            updatedAt: "2026-03-22T00:00:00.300Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.completed",
          data: {
            messageId: "assistant_msg_1",
            runId: "run_123",
            kind: "acknowledgment",
            content:
              "I’ll start by loading relevant context and then break the work into four research tracks.",
            createdAt: "2026-03-22T00:00:00.000Z",
            completedAt: "2026-03-22T00:00:01.000Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.started",
          data: {
            messageId: "assistant_msg_2",
            runId: "run_123",
            kind: "delivery",
            createdAt: "2026-03-22T00:00:05.000Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.delta",
          data: {
            messageId: "assistant_msg_2",
            runId: "run_123",
            kind: "delivery",
            delta: "Here’s your report",
            content: "Here’s your report",
            createdAt: "2026-03-22T00:00:05.000Z",
            updatedAt: "2026-03-22T00:00:05.300Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.completed",
          data: {
            messageId: "assistant_msg_2",
            runId: "run_123",
            kind: "delivery",
            content:
              "Here’s your report — a 16-page PDF covering tools in use, effectiveness research, risks, and emerging trends.",
            createdAt: "2026-03-22T00:00:05.000Z",
            completedAt: "2026-03-22T00:00:06.000Z"
          }
        });
      }
    });

    expect(
      screen.getByText(
        "I’ll start by loading relevant context and then break the work into four research tracks."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Here’s your report — a 16-page PDF covering tools in use, effectiveness research, risks, and emerging trends."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "I'll start by loading relevant context and shaping the work into focused subtasks."
      )
    ).not.toBeInTheDocument();
  });

  it("ignores assistant and run events for a different run while viewing a historical run", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Research AI in K-12 education and generate a PDF."
        outcomeSource="web"
        initialPlan={{
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:00.000Z",
          nodes: [
            {
              id: "node_archive",
              kind: "root",
              title: "Archive current findings",
              capability: "reasoning",
              position: 0
            }
          ],
          edges: []
        }}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "completed",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:04:00.000Z",
          steps: [
            {
              id: "step_archive",
              runId: "run_123",
              planNodeId: "node_archive",
              title: "Archive current findings",
              kind: "root",
              capability: "reasoning",
              status: "completed",
              position: 0,
              createdAt: "2026-03-22T00:00:00.000Z",
              updatedAt: "2026-03-22T00:03:00.000Z"
            }
          ]
        }}
        initialArtifacts={[
          {
            id: "artifact_archive",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_archive",
            kind: "analysis",
            relativePath: "artifacts/archive-findings.md",
            size: 512,
            metadata: {},
            createdAt: "2026-03-22T00:03:01.000Z"
          }
        ]}
        initialLogs={[
          {
            runId: "run_123",
            stepId: "step_archive",
            stepTitle: "Archive current findings",
            level: "info",
            message: "Historical run completed successfully.",
            createdAt: "2026-03-22T00:03:00.000Z"
          }
        ]}
        initialAssistantMessages={[
          {
            id: "assistant_msg_historical",
            runId: "run_123",
            kind: "acknowledgment",
            content: "I archived the previous run and preserved the research trail.",
            createdAt: "2026-03-22T00:00:10.000Z",
            updatedAt: "2026-03-22T00:00:20.000Z",
            status: "completed"
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "run.created",
          data: {
            id: "run_456",
            outcomeId: "outcome_123",
            planId: "plan_outcome_123",
            status: "running",
            createdAt: "2026-03-22T00:05:00.000Z",
            updatedAt: "2026-03-22T00:05:00.000Z",
            steps: []
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.started",
          data: {
            messageId: "assistant_msg_live",
            runId: "run_456",
            kind: "acknowledgment",
            createdAt: "2026-03-22T00:05:00.100Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.delta",
          data: {
            messageId: "assistant_msg_live",
            runId: "run_456",
            kind: "acknowledgment",
            delta: "I’m starting a new live run.",
            content: "I’m starting a new live run.",
            createdAt: "2026-03-22T00:05:00.100Z",
            updatedAt: "2026-03-22T00:05:00.300Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.completed",
          data: {
            messageId: "assistant_msg_live",
            runId: "run_456",
            kind: "acknowledgment",
            content: "I’m starting a new live run and collecting fresh research.",
            createdAt: "2026-03-22T00:05:00.100Z",
            completedAt: "2026-03-22T00:05:01.000Z"
          }
        });
      }
    });

    expect(
      screen.getByText("I archived the previous run and preserved the research trail.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Archive current findings").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("I’m starting a new live run and collecting fresh research.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Preparing steps…")).not.toBeInTheDocument();
  });

  it("renders a newly selected persisted running run as hydrated content instead of live streaming", () => {
    const rendered = render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Research AI in K-12 education and generate a PDF."
        outcomeSource="web"
        initialPlan={null}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "completed",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:04:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[
          {
            runId: "run_123",
            level: "info",
            message: "Historical persisted summary for the earlier run.",
            createdAt: "2026-03-22T00:00:10.000Z"
          }
        ]}
        initialAssistantMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    expect(
      screen.getByText("Historical persisted summary for the earlier run.")
    ).toBeInTheDocument();

    act(() => {
      rendered.rerender(
        <OutcomeConversation
          outcomeId="outcome_123"
          outcomePrompt="Research AI in K-12 education and generate a PDF."
          outcomeSource="web"
          initialPlan={null}
          initialRun={{
            id: "run_456",
            outcomeId: "outcome_123",
            planId: "plan_outcome_456",
            status: "running",
            createdAt: "2026-03-22T00:05:00.000Z",
            updatedAt: "2026-03-22T00:05:00.000Z",
            steps: []
          }}
          initialArtifacts={[]}
          initialLogs={[
            {
              runId: "run_456",
              level: "info",
              message: "Loading fresh persisted context for the selected run.",
              createdAt: "2026-03-22T00:05:05.000Z"
            }
          ]}
          initialAssistantMessages={[]}
          initialPendingApprovals={[]}
        />
      );
    });

    expect(
      screen.queryByText("Historical persisted summary for the earlier run.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading fresh persisted context for the selected run.")
    ).toBeInTheDocument();
  });
});
