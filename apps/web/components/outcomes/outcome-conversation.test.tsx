import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeConversation, StreamingText } from "./outcome-conversation";

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

function expectTextOrder(earlier: string, later: string) {
  const earlierNode = screen.getByText(earlier);
  const laterNode = screen.getByText(later);

  expect(
    earlierNode.compareDocumentPosition(laterNode) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
}

function emitOutcomeEvent(event: any) {
  act(() => {
    for (const handler of eventStream.handlers) {
      handler({
        outcomeId: "outcome_123",
        ...event
      });
    }
  });
}

function hasNodeByExactText(text: string) {
  return (
    screen.queryAllByText((_, node) => {
      return node !== null && node.textContent === text;
    }).length > 0
  );
}

function getLeafNodeByPrefix(prefix: string) {
  return screen.getByText((_, node) => {
    if (!node) {
      return false;
    }

    const text = node.textContent ?? "";

    if (!text.startsWith(prefix)) {
      return false;
    }

    return Array.from(node.children).every((child) => child.textContent !== text);
  });
}

function renderRunningStepConversation() {
  return render(
    <OutcomeConversation
      outcomeId="outcome_123"
      outcomePrompt="Draft the weekly update."
      outcomeSource="web"
      initialPlan={{
        id: "plan_outcome_123",
        outcomeId: "outcome_123",
        triggerMessageId: "msg_123",
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
        triggerMessageId: "msg_123",
        status: "running",
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
            status: "running",
            position: 0,
            createdAt: "2026-03-19T00:01:00.000Z",
            updatedAt: "2026-03-19T00:01:00.000Z"
          }
        ]
      }}
      initialArtifacts={[]}
      initialLogs={[]}
      initialAssistantMessages={[]}
      initialMessages={[]}
      optimisticMessages={[]}
      initialPendingApprovals={[]}
    />
  );
}

function renderQueuedPhaseConversation() {
  return render(
    <OutcomeConversation
      outcomeId="outcome_queued"
      outcomePrompt="Prepare the district packet."
      outcomeSource="web"
      initialPlan={{
        id: "plan_queue",
        outcomeId: "outcome_queued",
        triggerMessageId: "msg_queue",
        status: "draft",
        createdAt: "2026-03-27T10:00:00.000Z",
        updatedAt: "2026-03-27T10:00:00.000Z",
        nodes: [
          {
            id: "node_research",
            kind: "task",
            title: "Research district context",
            capability: "research",
            position: 0
          },
          {
            id: "node_outline",
            kind: "task",
            title: "Outline principal summary",
            capability: "document",
            position: 1
          }
        ],
        edges: []
      }}
      initialRun={{
        id: "run_queue",
        outcomeId: "outcome_queued",
        planId: "plan_queue",
        triggerMessageId: "msg_queue",
        status: "running",
        createdAt: "2026-03-27T10:00:00.000Z",
        updatedAt: "2026-03-27T10:00:30.000Z",
        steps: [
          {
            id: "step_research",
            runId: "run_queue",
            planNodeId: "node_research",
            title: "Research district context",
            kind: "task",
            capability: "research",
            status: "ready",
            position: 0,
            createdAt: "2026-03-27T10:00:30.000Z",
            updatedAt: "2026-03-27T10:00:30.000Z"
          },
          {
            id: "step_outline",
            runId: "run_queue",
            planNodeId: "node_outline",
            title: "Outline principal summary",
            kind: "task",
            capability: "document",
            status: "pending",
            position: 1,
            createdAt: "2026-03-27T10:00:31.000Z",
            updatedAt: "2026-03-27T10:00:31.000Z"
          }
        ]
      }}
      initialArtifacts={[]}
      initialLogs={[]}
      initialAssistantMessages={[
        {
          id: "assistant_queue_transition",
          runId: "run_queue",
          kind: "transition",
          content: "I'll split this into research and packaging tracks first.",
          createdAt: "2026-03-27T10:00:05.000Z",
          updatedAt: "2026-03-27T10:00:06.000Z",
          status: "completed"
        }
      ]}
      initialMessages={[]}
      optimisticMessages={[]}
      initialPendingApprovals={[]}
      initialPresentationHints={[
        {
          id: "hint_queue_transition",
          outcomeId: "outcome_queued",
          entityType: "assistant-message",
          entityId: "assistant_queue_transition",
          phaseId: "phase_queue",
          seq: 10,
          createdAt: "2026-03-27T10:00:05.000Z"
        },
        {
          id: "hint_step_research",
          outcomeId: "outcome_queued",
          entityType: "step",
          entityId: "step_research",
          phaseId: "phase_queue",
          seq: 20,
          createdAt: "2026-03-27T10:00:05.000Z"
        },
        {
          id: "hint_step_outline",
          outcomeId: "outcome_queued",
          entityType: "step",
          entityId: "step_outline",
          phaseId: "phase_queue",
          seq: 30,
          createdAt: "2026-03-27T10:00:05.000Z"
        }
      ]}
    />
  );
}

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
          triggerMessageId: "msg_123",
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
          triggerMessageId: "msg_123",
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
        initialMessages={[]}
        optimisticMessages={[]}
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
          triggerMessageId: "msg_123",
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
          triggerMessageId: "msg_123",
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
        initialMessages={[]}
        optimisticMessages={[]}
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
          triggerMessageId: "msg_123",
          status: "blocked",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialMessages={[]}
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

  it("removes a stale pending approval when a same-outcome hydrated rerender omits it", () => {
    const rendered = render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Draft the weekly update."
        outcomeSource="web"
        initialPlan={null}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          triggerMessageId: "msg_123",
          status: "blocked",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
          steps: []
        }}
        initialThread={{
          isHydrated: true,
          plans: [],
          runs: [
            {
              id: "run_123",
              outcomeId: "outcome_123",
              planId: "plan_outcome_123",
              triggerMessageId: "msg_123",
              status: "blocked",
              createdAt: "2026-03-19T00:01:00.000Z",
              updatedAt: "2026-03-19T00:02:00.000Z",
              steps: []
            }
          ]
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialMessages={[]}
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

    expect(screen.getByText("Review final result")).toBeInTheDocument();

    act(() => {
      rendered.rerender(
        <OutcomeConversation
          outcomeId="outcome_123"
          outcomePrompt="Draft the weekly update."
          outcomeSource="web"
          initialPlan={null}
          initialRun={{
            id: "run_123",
            outcomeId: "outcome_123",
            planId: "plan_outcome_123",
            triggerMessageId: "msg_123",
            status: "running",
            createdAt: "2026-03-19T00:01:00.000Z",
            updatedAt: "2026-03-19T00:03:00.000Z",
            steps: []
          }}
          initialThread={{
            isHydrated: true,
            plans: [],
            runs: [
              {
                id: "run_123",
                outcomeId: "outcome_123",
                planId: "plan_outcome_123",
                triggerMessageId: "msg_123",
                status: "running",
                createdAt: "2026-03-19T00:01:00.000Z",
                updatedAt: "2026-03-19T00:03:00.000Z",
                steps: []
              }
            ]
          }}
          initialArtifacts={[]}
          initialLogs={[
            {
              runId: "run_123",
              level: "info",
              message: "Approval was already resolved in the authoritative snapshot.",
              createdAt: "2026-03-19T00:03:00.000Z"
            }
          ]}
          initialAssistantMessages={[]}
          initialMessages={[]}
          initialPendingApprovals={[]}
        />
      );
    });

    expect(screen.queryByText("Approval required")).not.toBeInTheDocument();
    expect(screen.queryByText("Review final result")).not.toBeInTheDocument();
  });

  it("preserves a newer live approval when a stale hydrated rerender has not caught up yet", () => {
    const rendered = render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Draft the weekly update."
        outcomeSource="web"
        initialPlan={null}
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          triggerMessageId: "msg_123",
          status: "running",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:03:00.000Z",
          steps: []
        }}
        initialThread={{
          isHydrated: true,
          plans: [],
          runs: [
            {
              id: "run_123",
              outcomeId: "outcome_123",
              planId: "plan_outcome_123",
              triggerMessageId: "msg_123",
              status: "running",
              createdAt: "2026-03-19T00:01:00.000Z",
              updatedAt: "2026-03-19T00:03:00.000Z",
              steps: []
            }
          ]
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialMessages={[]}
        optimisticMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "approval.requested",
          data: {
            id: "approval_456",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_2",
            status: "pending",
            kind: "output_review_required",
            title: "Review cabinet brief",
            summary: "Check the shorter cabinet-facing version before sharing.",
            instruction: "Approve to publish or reject to revise.",
            artifactIds: ["artifact_2"],
            requestedAt: "2026-03-19T00:04:30.000Z",
            resolvedAt: null,
            resolution: null,
            resolutionNote: null
          }
        });
      }
    });

    expect(screen.getByText("Review cabinet brief")).toBeInTheDocument();

    act(() => {
      rendered.rerender(
        <OutcomeConversation
          outcomeId="outcome_123"
          outcomePrompt="Draft the weekly update."
          outcomeSource="web"
          initialPlan={null}
          initialRun={{
            id: "run_123",
            outcomeId: "outcome_123",
            planId: "plan_outcome_123",
            triggerMessageId: "msg_123",
            status: "running",
            createdAt: "2026-03-19T00:01:00.000Z",
            updatedAt: "2026-03-19T00:03:30.000Z",
            steps: []
          }}
          initialThread={{
            isHydrated: true,
            plans: [],
            runs: [
              {
                id: "run_123",
                outcomeId: "outcome_123",
                planId: "plan_outcome_123",
                triggerMessageId: "msg_123",
                status: "running",
                createdAt: "2026-03-19T00:01:00.000Z",
                updatedAt: "2026-03-19T00:03:30.000Z",
                steps: []
              }
            ]
          }}
          initialArtifacts={[]}
          initialLogs={[
            {
              runId: "run_123",
              level: "info",
              message: "The refreshed snapshot is still older than the live approval event.",
              createdAt: "2026-03-19T00:03:30.000Z"
            }
          ]}
          initialAssistantMessages={[]}
          initialMessages={[]}
          initialPendingApprovals={[]}
        />
      );
    });

    expect(screen.getByText("Review cabinet brief")).toBeInTheDocument();
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
        initialMessages={[]}
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

  it("renders persisted follow-up messages from initial page hydration", () => {
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
          triggerMessageId: "msg_123",
          status: "completed",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialMessages={[
          {
            id: "msg_123",
            outcomeId: "outcome_123",
            role: "user",
            content: "Refine the final report for principals.",
            createdAt: "2026-03-19T00:03:00.000Z",
            submissionId: null
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    expect(
      screen.getByText("Refine the final report for principals.")
    ).toBeInTheDocument();
  });

  it("does not duplicate a matching optimistic follow-up once the confirmed message is hydrated", () => {
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
          triggerMessageId: "msg_123",
          status: "completed",
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialMessages={[
          {
            id: "msg_456",
            outcomeId: "outcome_123",
            role: "user",
            content: "Refine the final report for principals.",
            createdAt: "2026-03-19T00:03:00.000Z",
            submissionId: "submit_456"
          }
        ]}
        optimisticMessages={[
          {
            id: "optimistic:msg_456",
            outcomeId: "outcome_123",
            role: "user",
            content: "Refine the final report for principals.",
            createdAt: "2026-03-19T00:02:59.000Z",
            submissionId: "submit_456"
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    expect(screen.getAllByText("Refine the final report for principals.")).toHaveLength(1);
  });

  it("does not duplicate a matching optimistic follow-up after message.created arrives", () => {
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
        initialMessages={[]}
        optimisticMessages={[
          {
            id: "optimistic:msg_456",
            outcomeId: "outcome_123",
            role: "user",
            content: "Refine the final report for principals.",
            createdAt: "2026-03-19T00:02:59.000Z",
            submissionId: "submit_456"
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    emitOutcomeEvent({
      type: "message.created",
      data: {
        id: "msg_456",
        outcomeId: "outcome_123",
        role: "user",
        content: "Refine the final report for principals.",
        createdAt: "2026-03-19T00:03:00.000Z",
        submissionId: "submit_456"
      }
    });

    expect(screen.getAllByText("Refine the final report for principals.")).toHaveLength(1);
  });

  it("does not consume a local optimistic follow-up when a foreign same-content message arrives first", () => {
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
        initialMessages={[]}
        optimisticMessages={[
          {
            id: "optimistic:local",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter.",
            createdAt: "2026-03-19T00:02:59.000Z",
            submissionId: "submit_local"
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    emitOutcomeEvent({
      type: "message.created",
      data: {
        id: "msg_foreign",
        outcomeId: "outcome_123",
        role: "user",
        content: "Make it shorter.",
        createdAt: "2026-03-19T00:03:00.000Z",
        submissionId: "submit_foreign"
      }
    });

    expect(screen.getAllByText("Make it shorter.")).toHaveLength(2);
  });

  it("consumes same-content optimistic follow-ups one-to-one when confirmed messages arrive", () => {
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
        initialMessages={[]}
        optimisticMessages={[
          {
            id: "optimistic:first",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter.",
            createdAt: "2026-03-19T00:02:58.000Z",
            submissionId: "submit_first"
          },
          {
            id: "optimistic:second",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter.",
            createdAt: "2026-03-19T00:02:59.000Z",
            submissionId: "submit_second"
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    emitOutcomeEvent({
      type: "message.created",
      data: {
        id: "msg_456",
        outcomeId: "outcome_123",
        role: "user",
        content: "Make it shorter.",
        createdAt: "2026-03-19T00:03:00.000Z",
        submissionId: "submit_first"
      }
    });

    expect(screen.getAllByText("Make it shorter.")).toHaveLength(2);
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
          triggerMessageId: "msg_123",
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
          triggerMessageId: "msg_123",
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
        initialMessages={[]}
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
          triggerMessageId: "msg_123",
          status: "running",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[]}
        initialMessages={[]}
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
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expectTextOrder(
      "I’ll start by loading relevant context and then break the work into four research tracks.",
      "Here’s your report — a 16-page PDF covering tools in use, effectiveness research, risks, and emerging trends."
    );
    expect(
      screen.queryByText(
        "I'll start by loading relevant context and shaping the work into focused subtasks."
      )
    ).not.toBeInTheDocument();
  });

  it("renders follow-up run events as a later thread turn in chronological order", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Research AI in K-12 education and generate a PDF."
        outcomeSource="web"
        initialPlan={{
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          triggerMessageId: "msg_123",
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
          triggerMessageId: "msg_123",
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
        initialMessages={[]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "message.created",
          data: {
            id: "msg_456",
            outcomeId: "outcome_123",
            role: "user",
            content: "Collect fresh research for the live follow-up run.",
            createdAt: "2026-03-22T00:05:00.000Z"
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "plan.created",
          data: {
            id: "plan_outcome_456",
            outcomeId: "outcome_123",
            triggerMessageId: "msg_456",
            status: "draft",
            createdAt: "2026-03-22T00:05:00.000Z",
            updatedAt: "2026-03-22T00:05:00.000Z",
            nodes: [
              {
                id: "node_collect",
                kind: "root",
                title: "Collect fresh research",
                capability: "reasoning",
                position: 0
              }
            ],
            edges: []
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "run.created",
          data: {
            id: "run_456",
            outcomeId: "outcome_123",
            planId: "plan_outcome_456",
            triggerMessageId: "msg_456",
            status: "running",
            createdAt: "2026-03-22T00:05:00.000Z",
            updatedAt: "2026-03-22T00:05:00.000Z",
            steps: []
          }
        });
        handler({
          outcomeId: "outcome_123",
          type: "run.step.updated",
          data: {
            id: "step_collect",
            runId: "run_456",
            planNodeId: "node_collect",
            title: "Collect fresh research",
            kind: "root",
            capability: "reasoning",
            status: "running",
            position: 0,
            createdAt: "2026-03-22T00:05:00.500Z",
            updatedAt: "2026-03-22T00:05:00.500Z"
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
      screen.getByText("Collect fresh research for the live follow-up run.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Collect fresh research").length).toBeGreaterThan(0);
    expect(
      screen.getByText("I’m starting a new live run and collecting fresh research.")
    ).toBeInTheDocument();
    expectTextOrder(
      "I archived the previous run and preserved the research trail.",
      "Collect fresh research for the live follow-up run."
    );
    expectTextOrder(
      "Collect fresh research for the live follow-up run.",
      "I’m starting a new live run and collecting fresh research."
    );
  });

  it("appends a newly hydrated running turn without retyping older thread content", () => {
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
          triggerMessageId: "msg_123",
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
        initialMessages={[]}
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
            triggerMessageId: "msg_123",
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
              message: "Read fresh persisted context for the selected run.",
              createdAt: "2026-03-22T00:05:05.000Z"
            }
          ]}
          initialAssistantMessages={[]}
          initialMessages={[]}
          initialPendingApprovals={[]}
        />
      );
    });

    expect(
      screen.getByText("Historical persisted summary for the earlier run.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Read fresh persisted context for the selected run.")
    ).toBeInTheDocument();
    expectTextOrder(
      "Historical persisted summary for the earlier run.",
      "Read fresh persisted context for the selected run."
    );
  });

  it("preserves older turn content when a follow-up run arrives through refreshed props", () => {
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
          triggerMessageId: "msg_123",
          status: "completed",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:04:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[
          {
            id: "assistant_delivery_first",
            runId: "run_123",
            kind: "delivery",
            content:
              "Here’s the first completed report with the full district rollout plan.",
            createdAt: "2026-03-22T00:04:00.000Z",
            updatedAt: "2026-03-22T00:04:05.000Z",
            status: "completed"
          }
        ]}
        initialMessages={[
          {
            id: "msg_followup",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter for principals.",
            createdAt: "2026-03-22T00:05:00.000Z",
            submissionId: null
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    expect(
      screen.getByText("Here’s the first completed report with the full district rollout plan.")
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
            triggerMessageId: "msg_followup",
            status: "running",
            createdAt: "2026-03-22T00:05:00.000Z",
            updatedAt: "2026-03-22T00:05:00.000Z",
            steps: []
          }}
          initialArtifacts={[]}
          initialLogs={[]}
          initialAssistantMessages={[
            {
              id: "assistant_ack_second",
              runId: "run_456",
              kind: "acknowledgment",
              content:
                "I’m tightening the report for school principals and focusing the research on implementation risks.",
              createdAt: "2026-03-22T00:05:02.000Z",
              updatedAt: "2026-03-22T00:05:03.000Z",
              status: "completed"
            }
          ]}
          initialMessages={[
            {
              id: "msg_followup",
              outcomeId: "outcome_123",
              role: "user",
              content: "Make it shorter for principals.",
              createdAt: "2026-03-22T00:05:00.000Z",
              submissionId: null
            }
          ]}
          initialPendingApprovals={[]}
        />
      );
    });

    expect(
      screen.getByText("Here’s the first completed report with the full district rollout plan.")
    ).toBeInTheDocument();
    expect(screen.getByText("Make it shorter for principals.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "I’m tightening the report for school principals and focusing the research on implementation risks."
      )
    ).toBeInTheDocument();
    expectTextOrder(
      "Here’s the first completed report with the full district rollout plan.",
      "Make it shorter for principals."
    );
    expectTextOrder(
      "Make it shorter for principals.",
      "I’m tightening the report for school principals and focusing the research on implementation risks."
    );
  });

  it("keeps an older follow-up visible when a newer follow-up run is merged", () => {
    const rendered = render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Research AI in K-12 education and generate a PDF."
        outcomeSource="web"
        initialPlan={null}
        initialRun={{
          id: "run_followup_a",
          outcomeId: "outcome_123",
          planId: "plan_followup_a",
          triggerMessageId: "msg_followup_a",
          status: "completed",
          createdAt: "2026-03-22T00:05:00.000Z",
          updatedAt: "2026-03-22T00:06:00.000Z",
          steps: []
        }}
        initialArtifacts={[]}
        initialLogs={[]}
        initialAssistantMessages={[
          {
            id: "assistant_followup_a",
            runId: "run_followup_a",
            kind: "delivery",
            content: "Here is the shorter principal-ready version.",
            createdAt: "2026-03-22T00:05:10.000Z",
            updatedAt: "2026-03-22T00:05:20.000Z",
            status: "completed"
          }
        ]}
        initialMessages={[
          {
            id: "msg_followup_a",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter for principals.",
            createdAt: "2026-03-22T00:05:00.000Z",
            submissionId: null
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    act(() => {
      rendered.rerender(
        <OutcomeConversation
          outcomeId="outcome_123"
          outcomePrompt="Research AI in K-12 education and generate a PDF."
          outcomeSource="web"
          initialPlan={null}
          initialRun={{
            id: "run_followup_b",
            outcomeId: "outcome_123",
            planId: "plan_followup_b",
            triggerMessageId: "msg_followup_b",
            status: "running",
            createdAt: "2026-03-22T00:07:00.000Z",
            updatedAt: "2026-03-22T00:07:00.000Z",
            steps: []
          }}
          initialArtifacts={[]}
          initialLogs={[]}
          initialAssistantMessages={[
            {
              id: "assistant_followup_b",
              runId: "run_followup_b",
              kind: "acknowledgment",
              content: "I’m trimming it down even further for cabinet review.",
              createdAt: "2026-03-22T00:07:05.000Z",
              updatedAt: "2026-03-22T00:07:06.000Z",
              status: "completed"
            }
          ]}
          initialMessages={[
            {
              id: "msg_followup_a",
              outcomeId: "outcome_123",
              role: "user",
              content: "Make it shorter for principals.",
              createdAt: "2026-03-22T00:05:00.000Z",
              submissionId: null
            },
            {
              id: "msg_followup_b",
              outcomeId: "outcome_123",
              role: "user",
              content: "Now make it shorter for the district cabinet.",
              createdAt: "2026-03-22T00:07:00.000Z",
              submissionId: null
            }
          ]}
          initialPendingApprovals={[]}
        />
      );
    });

    expect(screen.getByText("Make it shorter for principals.")).toBeInTheDocument();
    expect(
      screen.getByText("Now make it shorter for the district cabinet.")
    ).toBeInTheDocument();
    expectTextOrder(
      "Make it shorter for principals.",
      "Now make it shorter for the district cabinet."
    );
    expectTextOrder(
      "Now make it shorter for the district cabinet.",
      "I’m trimming it down even further for cabinet review."
    );
  });

  it("renders queued steps inside the transition phase group when authored grouping exists", () => {
    renderQueuedPhaseConversation();

    const phaseGroup = screen.getByTestId("phase-group");

    expect(
      within(phaseGroup).getByText(
        "I'll split this into research and packaging tracks first."
      )
    ).toBeInTheDocument();
    expect(
      within(phaseGroup).getByText("Ready to start.")
    ).toBeInTheDocument();
    expect(within(phaseGroup).getByText("Queued to start.")).toBeInTheDocument();
    expect(
      within(phaseGroup).getAllByText("Research district context").length
    ).toBeGreaterThan(0);
    expect(
      within(phaseGroup).getAllByText("Outline principal summary").length
    ).toBeGreaterThan(0);
  });

  it("keeps the plan block outside the transition phase group for queued authored steps", () => {
    renderQueuedPhaseConversation();

    const phaseGroup = screen.getByTestId("phase-group");

    expect(
      within(phaseGroup).queryByText("2 steps ready to execute")
    ).not.toBeInTheDocument();
    expect(screen.getByText("2 steps ready to execute")).toBeInTheDocument();
  });

  it("continues step streaming from the current visible progress when new text appends", async () => {
    vi.useFakeTimers();

    try {
      renderRunningStepConversation();
      await act(async () => {});

      emitOutcomeEvent({
        type: "run.log",
        data: {
          runId: "run_123",
          stepId: "step_1",
          stepTitle: "Analyze outcome",
          level: "info",
          message: "Loading context",
          createdAt: "2026-03-19T00:01:10.000Z"
        }
      });

      await act(async () => {});

      act(() => {
        vi.advanceTimersByTime(112);
      });

      const initialVisiblePrefix = getLeafNodeByPrefix("Load").textContent ?? "";
      expect(initialVisiblePrefix.length).toBeGreaterThan(0);

      emitOutcomeEvent({
        type: "run.log",
        data: {
          runId: "run_123",
          stepId: "step_1",
          stepTitle: "Analyze outcome",
          level: "info",
          message: "Loading context from workspace",
          createdAt: "2026-03-19T00:01:11.000Z"
        }
      });

      await act(async () => {});

      expect(hasNodeByExactText(initialVisiblePrefix)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restarts StreamingText from the beginning when the text is replaced instead of appended", () => {
    vi.useFakeTimers();

    try {
      const rendered = render(
        <StreamingText text="Loading context" charInterval={14} />
      );

      act(() => {
        vi.advanceTimersByTime(112);
      });

      const initialVisiblePrefix = getLeafNodeByPrefix("Load").textContent ?? "";
      expect(initialVisiblePrefix.length).toBeGreaterThan(0);

      act(() => {
        rendered.rerender(
          <StreamingText text="Searching memory" charInterval={14} />
        );
      });

      expect(hasNodeByExactText(initialVisiblePrefix)).toBe(false);

      act(() => {
        vi.advanceTimersByTime(252);
      });

      expect(getLeafNodeByPrefix("Search")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
