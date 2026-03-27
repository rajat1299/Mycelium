import { describe, expect, it } from "vitest";
import { OutcomeThreadSnapshotSchema } from "./index";

describe("OutcomeThreadSnapshotSchema", () => {
  it("accepts a full outcome thread snapshot payload", () => {
    const parsed = OutcomeThreadSnapshotSchema.safeParse({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Research AI tools for district planning",
        source: "web",
        status: "running",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:05:00.000Z"
      },
      messages: [
        {
          id: "msg_123",
          outcomeId: "outcome_123",
          role: "user",
          content: "Research AI tools for district planning",
          createdAt: "2026-03-24T12:00:00.000Z"
        }
      ],
      plans: [
        {
          id: "plan_123",
          outcomeId: "outcome_123",
          triggerMessageId: "msg_123",
          status: "draft",
          createdAt: "2026-03-24T12:00:01.000Z",
          updatedAt: "2026-03-24T12:00:01.000Z",
          nodes: [
            {
              id: "node_1",
              kind: "task",
              title: "Research district planning tools",
              capability: "research",
              position: 0
            }
          ],
          edges: []
        }
      ],
      runs: [
        {
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_123",
          triggerMessageId: "msg_123",
          status: "running",
          createdAt: "2026-03-24T12:00:02.000Z",
          updatedAt: "2026-03-24T12:05:00.000Z",
          steps: [
            {
              id: "step_123",
              runId: "run_123",
              planNodeId: "node_1",
              title: "Research district planning tools",
              kind: "task",
              capability: "research",
              status: "running",
              position: 0,
              createdAt: "2026-03-24T12:00:02.000Z",
              updatedAt: "2026-03-24T12:04:00.000Z"
            }
          ]
        }
      ],
      assistantMessages: [
        {
          id: "assistant_msg_123",
          runId: "run_123",
          kind: "acknowledgment",
          content: "I’m loading the relevant planning context first.",
          createdAt: "2026-03-24T12:00:03.000Z",
          updatedAt: "2026-03-24T12:00:04.000Z",
          status: "completed"
        }
      ],
      artifacts: [
        {
          id: "artifact_123",
          outcomeId: "outcome_123",
          runId: "run_123",
          stepId: "step_123",
          kind: "analysis",
          relativePath: "reports/planning-tools.md",
          size: 2048,
          metadata: {
            previewBody: "Top district planning tools and tradeoffs."
          },
          createdAt: "2026-03-24T12:05:00.000Z"
        }
      ],
      logs: [
        {
          runId: "run_123",
          stepId: "step_123",
          stepTitle: "Research district planning tools",
          level: "info",
          message: "Collected district planning tool research.",
          createdAt: "2026-03-24T12:04:30.000Z"
        }
      ],
      pendingApprovals: [
        {
          id: "approval_123",
          workspaceId: "ws_123",
          outcomeId: "outcome_123",
          runId: "run_123",
          stepId: "step_123",
          status: "pending",
          kind: "output_review_required",
          title: "Review district planning summary",
          summary: "Confirm the planning summary before delivery.",
          instruction: "Check the findings before sending to the team.",
          artifactIds: ["artifact_123"],
          requestedAt: "2026-03-24T12:05:30.000Z",
          resolvedAt: null,
          resolution: null,
          resolutionNote: null
        }
      ],
      presentationHints: [
        {
          id: "hint_123",
          outcomeId: "outcome_123",
          entityType: "artifact",
          entityId: "artifact_123",
          phaseId: "phase_delivery",
          seq: 30,
          laneId: "lane_delivery",
          createdAt: "2026-03-24T12:05:00.000Z"
        }
      ]
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(
      expect.objectContaining({
        outcome: expect.objectContaining({
          id: "outcome_123"
        }),
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: "msg_123"
          })
        ]),
        plans: expect.arrayContaining([
          expect.objectContaining({
            id: "plan_123",
            triggerMessageId: "msg_123"
          })
        ]),
        runs: expect.arrayContaining([
          expect.objectContaining({
            id: "run_123",
            triggerMessageId: "msg_123"
          })
        ]),
        assistantMessages: expect.arrayContaining([
          expect.objectContaining({
            id: "assistant_msg_123"
          })
        ]),
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            id: "artifact_123"
          })
        ]),
        logs: expect.arrayContaining([
          expect.objectContaining({
            runId: "run_123"
          })
        ]),
        pendingApprovals: expect.arrayContaining([
          expect.objectContaining({
            id: "approval_123"
          })
        ]),
        presentationHints: expect.arrayContaining([
          expect.objectContaining({
            id: "hint_123",
            entityType: "artifact",
            phaseId: "phase_delivery"
          })
        ])
      })
    );
  });

  it("defaults presentationHints to an empty array when omitted", () => {
    const parsed = OutcomeThreadSnapshotSchema.parse({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Research AI tools for district planning",
        source: "web",
        status: "running",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:05:00.000Z"
      },
      messages: [],
      plans: [],
      runs: [],
      assistantMessages: [],
      artifacts: [],
      logs: [],
      pendingApprovals: []
    });

    expect(parsed.presentationHints).toEqual([]);
  });

  it("rejects non-pending approvals in pendingApprovals", () => {
    const parsed = OutcomeThreadSnapshotSchema.safeParse({
      outcome: {
        id: "outcome_123",
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Research AI tools for district planning",
        source: "web",
        status: "running",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:05:00.000Z"
      },
      messages: [],
      plans: [],
      runs: [],
      assistantMessages: [],
      artifacts: [],
      logs: [],
      pendingApprovals: [
        {
          id: "approval_123",
          workspaceId: "ws_123",
          outcomeId: "outcome_123",
          runId: "run_123",
          stepId: "step_123",
          status: "resolved",
          kind: "output_review_required",
          title: "Review district planning summary",
          summary: "Confirm the planning summary before delivery.",
          instruction: "Check the findings before sending to the team.",
          artifactIds: ["artifact_123"],
          requestedAt: "2026-03-24T12:05:30.000Z",
          resolvedAt: "2026-03-24T12:06:00.000Z",
          resolution: "approved",
          resolutionNote: null
        }
      ]
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["pendingApprovals", 0],
          message: "pendingApprovals must only include pending approvals."
        })
      ])
    );
  });
});
