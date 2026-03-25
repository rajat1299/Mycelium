import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eventStream = vi.hoisted(() => ({
  handlers: new Set<(event: any) => void>()
}));

const markdownRenderCounts = vi.hoisted(() => new Map<string, number>());

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

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: React.ReactNode }) => {
    const text = Array.isArray(children)
      ? children.join("")
      : typeof children === "string"
        ? children
        : "";

    markdownRenderCounts.set(text, (markdownRenderCounts.get(text) ?? 0) + 1);

    return <div data-testid={`markdown:${text}`}>{text}</div>;
  }
}));

vi.mock("remark-gfm", () => ({
  default: () => null
}));

import { OutcomeConversation } from "./outcome-conversation";

afterEach(() => {
  cleanup();
  eventStream.handlers.clear();
  markdownRenderCounts.clear();
});

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

describe("OutcomeConversation render isolation", () => {
  beforeEach(() => {
    eventStream.handlers.clear();
    markdownRenderCounts.clear();
  });

  it("keeps an unchanged earlier turn subtree from re-rendering on later-turn SSE updates", () => {
    render(
      <OutcomeConversation
        outcomeId="outcome_123"
        outcomePrompt="Map the system architecture and propose a path forward."
        outcomeSource="web"
        initialPlan={{
          id: "plan_tuesday",
          outcomeId: "outcome_123",
          triggerMessageId: "msg_tuesday",
          status: "draft",
          createdAt: "2026-03-18T09:00:01.000Z",
          updatedAt: "2026-03-18T09:00:01.000Z",
          nodes: [
            {
              id: "node_tuesday",
              kind: "task",
              title: "Refine the architecture plan",
              capability: "reasoning",
              position: 0
            }
          ],
          edges: []
        }}
        initialRun={{
          id: "run_tuesday",
          outcomeId: "outcome_123",
          planId: "plan_tuesday",
          triggerMessageId: "msg_tuesday",
          status: "running",
          createdAt: "2026-03-18T09:00:02.000Z",
          updatedAt: "2026-03-18T09:12:00.000Z",
          steps: [
            {
              id: "step_tuesday",
              runId: "run_tuesday",
              planNodeId: "node_tuesday",
              title: "Refine the architecture plan",
              kind: "task",
              capability: "reasoning",
              status: "running",
              position: 0,
              createdAt: "2026-03-18T09:00:02.000Z",
              updatedAt: "2026-03-18T09:10:00.000Z"
            }
          ]
        }}
        initialThread={{
          isHydrated: true,
          plans: [
            {
              id: "plan_monday",
              outcomeId: "outcome_123",
              triggerMessageId: "msg_monday",
              status: "draft",
              createdAt: "2026-03-17T09:00:01.000Z",
              updatedAt: "2026-03-17T09:00:01.000Z",
              nodes: [
                {
                  id: "node_monday",
                  kind: "task",
                  title: "Research architecture options",
                  capability: "research",
                  position: 0
                }
              ],
              edges: []
            },
            {
              id: "plan_tuesday",
              outcomeId: "outcome_123",
              triggerMessageId: "msg_tuesday",
              status: "draft",
              createdAt: "2026-03-18T09:00:01.000Z",
              updatedAt: "2026-03-18T09:00:01.000Z",
              nodes: [
                {
                  id: "node_tuesday",
                  kind: "task",
                  title: "Refine the architecture plan",
                  capability: "reasoning",
                  position: 0
                }
              ],
              edges: []
            }
          ],
          runs: [
            {
              id: "run_monday",
              outcomeId: "outcome_123",
              planId: "plan_monday",
              triggerMessageId: "msg_monday",
              status: "completed",
              createdAt: "2026-03-17T09:00:02.000Z",
              updatedAt: "2026-03-17T09:10:00.000Z",
              steps: [
                {
                  id: "step_monday",
                  runId: "run_monday",
                  planNodeId: "node_monday",
                  title: "Research architecture options",
                  kind: "task",
                  capability: "research",
                  status: "completed",
                  position: 0,
                  createdAt: "2026-03-17T09:00:02.000Z",
                  updatedAt: "2026-03-17T09:08:00.000Z"
                }
              ]
            },
            {
              id: "run_tuesday",
              outcomeId: "outcome_123",
              planId: "plan_tuesday",
              triggerMessageId: "msg_tuesday",
              status: "running",
              createdAt: "2026-03-18T09:00:02.000Z",
              updatedAt: "2026-03-18T09:12:00.000Z",
              steps: [
                {
                  id: "step_tuesday",
                  runId: "run_tuesday",
                  planNodeId: "node_tuesday",
                  title: "Refine the architecture plan",
                  kind: "task",
                  capability: "reasoning",
                  status: "running",
                  position: 0,
                  createdAt: "2026-03-18T09:00:02.000Z",
                  updatedAt: "2026-03-18T09:10:00.000Z"
                }
              ]
            }
          ]
        }}
        initialArtifacts={[]}
        initialLogs={[
          {
            runId: "run_tuesday",
            level: "info",
            message: "I’m tightening the recommendation and pruning dead ends.",
            createdAt: "2026-03-18T09:00:10.000Z"
          }
        ]}
        initialAssistantMessages={[
          {
            id: "assistant_monday",
            runId: "run_monday",
            kind: "acknowledgment",
            content: "## Monday recap\n\nI mapped the architecture tradeoffs and captured the strongest path.",
            createdAt: "2026-03-17T09:00:05.000Z",
            updatedAt: "2026-03-17T09:00:15.000Z",
            status: "completed"
          }
        ]}
        initialMessages={[
          {
            id: "msg_tuesday",
            outcomeId: "outcome_123",
            role: "user",
            content: "Tighten the recommendation and remove the dead ends.",
            createdAt: "2026-03-18T09:00:00.000Z"
          }
        ]}
        initialPendingApprovals={[]}
      />
    );

    const mondayNarrative =
      "## Monday recap\n\nI mapped the architecture tradeoffs and captured the strongest path.";

    expect(markdownRenderCounts.get(mondayNarrative)).toBe(1);

    emitOutcomeEvent({
      type: "run.log",
      data: {
        runId: "run_tuesday",
        stepId: "step_tuesday",
        stepTitle: "Refine the architecture plan",
        level: "info",
        message: "I’m narrowing the recommendation to two viable options.",
        createdAt: "2026-03-18T09:11:00.000Z"
      }
    });

    expect(markdownRenderCounts.get(mondayNarrative)).toBe(1);
  });
});
