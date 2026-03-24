import { afterEach, describe, expect, it, vi } from "vitest";
import { getOutcomeThreadSnapshot } from "./api";

const originalControlPlaneUrl = process.env.CONTROL_PLANE_URL;

function buildThreadSnapshotPayload() {
  return {
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
    ]
  };
}

describe("api getOutcomeThreadSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    if (originalControlPlaneUrl === undefined) {
      delete process.env.CONTROL_PLANE_URL;
    } else {
      process.env.CONTROL_PLANE_URL = originalControlPlaneUrl;
    }
  });

  it("fetches the outcome thread snapshot with no-store caching", async () => {
    process.env.CONTROL_PLANE_URL = "http://control-plane.test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildThreadSnapshotPayload()), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getOutcomeThreadSnapshot("outcome_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://control-plane.test/api/outcomes/outcome_123/thread",
      {
        cache: "no-store"
      }
    );
    expect(snapshot).toEqual(
      expect.objectContaining({
        outcome: expect.objectContaining({
          id: "outcome_123"
        }),
        messages: [
          expect.objectContaining({
            id: "msg_123"
          })
        ]
      })
    );
  });

  it("returns null when the thread snapshot response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("missing", { status: 404 })
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(getOutcomeThreadSnapshot("outcome_missing")).resolves.toBeNull();
  });

  it("returns null when the thread snapshot payload is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ outcome: { id: "broken" } }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(getOutcomeThreadSnapshot("outcome_123")).resolves.toBeNull();
  });
});
