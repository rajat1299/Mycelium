import { describe, expect, it } from "vitest";
import { buildOutcomeFeed } from "./outcome-feed";

describe("buildOutcomeFeed", () => {
  it("places persisted follow-up messages before the assistant response they triggered", () => {
    const feed = buildOutcomeFeed({
      outcomePrompt: "Research AI in K-12 education and generate a PDF.",
      outcomeSource: "web",
      state: {
        plan: null,
        run: {
          id: "run_456",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "running",
          createdAt: "2026-03-22T00:05:00.000Z",
          updatedAt: "2026-03-22T00:05:10.000Z",
          steps: []
        },
        artifacts: [],
        logs: [],
        pendingApprovals: [],
        messages: [
          {
            id: "msg_followup",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make the report shorter and more executive-friendly.",
            createdAt: "2026-03-22T00:04:59.000Z"
          }
        ],
        assistantMessages: [
          {
            id: "assistant_msg_1",
            runId: "run_456",
            kind: "acknowledgment",
            content:
              "I’ll tighten the framing, keep the evidence, and rewrite it for school leaders.",
            createdAt: "2026-03-22T00:05:01.000Z",
            updatedAt: "2026-03-22T00:05:02.000Z",
            status: "completed"
          }
        ]
      }
    });

    expect(feed[1]).toMatchObject({
      type: "message",
      message: expect.objectContaining({
        content: "Make the report shorter and more executive-friendly."
      })
    });
    expect(feed[2]).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        content:
          "I’ll tighten the framing, keep the evidence, and rewrite it for school leaders."
      })
    });
  });

  it("keeps the opening intent and appends a separate delivery note after the final artifact", () => {
    const feed = buildOutcomeFeed({
      outcomePrompt: "Research AI in K-12 education and generate a PDF.",
      outcomeSource: "web",
      state: {
        plan: {
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
        },
        run: {
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
              routeModelId: "claude-sonnet-4.6",
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
        },
        artifacts: [
          {
            id: "artifact_report",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_report",
            kind: "result",
            relativePath: "artifacts/final-report.pdf",
            size: 2048,
            metadata: {
              summary:
                "Here's your report, with the executive summary and district recommendations."
            },
            createdAt: "2026-03-21T00:04:01.000Z"
          }
        ],
        logs: [
          {
            runId: "run_123",
            level: "info",
            message:
              "I'll start by loading relevant context and shaping the work into focused subtasks.",
            createdAt: "2026-03-21T00:01:05.000Z"
          },
          {
            runId: "run_123",
            level: "info",
            message:
              "All four research tracks are complete. Let me read through the findings and compile the PDF report.",
            createdAt: "2026-03-21T00:03:30.000Z"
          }
        ],
        pendingApprovals: [],
        messages: [],
        assistantMessages: []
      }
    });

    expect(feed[1]).toMatchObject({
      type: "intent",
      message:
        "I'll start by loading relevant context and shaping the work into focused subtasks."
    });

    expect(feed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "artifact-delivery",
          artifact: expect.objectContaining({
            id: "artifact_report"
          })
        }),
        expect.objectContaining({
          type: "delivery-note",
          message:
            "Here's your report, with the executive summary and district recommendations."
        })
      ])
    );

    const artifactIndex = feed.findIndex(
      (item) => item.type === "artifact-delivery"
    );
    const deliveryNoteIndex = feed.findIndex(
      (item) => item.type === "delivery-note"
    );

    expect(artifactIndex).toBeGreaterThan(-1);
    expect(deliveryNoteIndex).toBeGreaterThan(artifactIndex);
  });
});
