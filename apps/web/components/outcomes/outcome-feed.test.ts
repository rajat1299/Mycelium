import { describe, expect, it } from "vitest";
import {
  buildOutcomeFeed,
  buildOutcomeThreadTurns,
  type OutcomeConversationState
} from "./outcome-feed";

function buildMultiTurnState(): OutcomeConversationState {
  const mondayPlan = {
    id: "plan_monday",
    outcomeId: "outcome_123",
    triggerMessageId: "msg_monday",
    status: "draft" as const,
    createdAt: "2026-03-17T09:00:01.000Z",
    updatedAt: "2026-03-17T09:00:01.000Z",
    nodes: [
      {
        id: "node_monday",
        kind: "task" as const,
        title: "Research architecture options",
        capability: "research" as const,
        position: 0
      }
    ],
    edges: []
  };
  const tuesdayPlan = {
    id: "plan_tuesday",
    outcomeId: "outcome_123",
    triggerMessageId: "msg_tuesday",
    status: "draft" as const,
    createdAt: "2026-03-18T09:00:01.000Z",
    updatedAt: "2026-03-18T09:00:01.000Z",
    nodes: [
      {
        id: "node_tuesday",
        kind: "task" as const,
        title: "Refine the architecture plan",
        capability: "reasoning" as const,
        position: 0
      }
    ],
    edges: []
  };
  const wednesdayPlan = {
    id: "plan_wednesday",
    outcomeId: "outcome_123",
    triggerMessageId: "msg_wednesday",
    status: "draft" as const,
    createdAt: "2026-03-19T09:00:01.000Z",
    updatedAt: "2026-03-19T09:00:01.000Z",
    nodes: [
      {
        id: "node_wednesday",
        kind: "task" as const,
        title: "Prepare delivery packet",
        capability: "document" as const,
        position: 0
      }
    ],
    edges: []
  };

  const mondayRun = {
    id: "run_monday",
    outcomeId: "outcome_123",
    planId: "plan_monday",
    triggerMessageId: "msg_monday",
    status: "completed" as const,
    createdAt: "2026-03-17T09:00:02.000Z",
    updatedAt: "2026-03-17T09:10:00.000Z",
    steps: [
      {
        id: "step_monday",
        runId: "run_monday",
        planNodeId: "node_monday",
        title: "Research architecture options",
        kind: "task" as const,
        capability: "research" as const,
        status: "completed" as const,
        position: 0,
        createdAt: "2026-03-17T09:00:02.000Z",
        updatedAt: "2026-03-17T09:08:00.000Z"
      }
    ]
  };

  const tuesdayRun = {
    id: "run_tuesday",
    outcomeId: "outcome_123",
    planId: "plan_tuesday",
    triggerMessageId: "msg_tuesday",
    status: "completed" as const,
    createdAt: "2026-03-18T09:00:02.000Z",
    updatedAt: "2026-03-18T09:12:00.000Z",
    steps: [
      {
        id: "step_tuesday",
        runId: "run_tuesday",
        planNodeId: "node_tuesday",
        title: "Refine the architecture plan",
        kind: "task" as const,
        capability: "reasoning" as const,
        status: "completed" as const,
        position: 0,
        createdAt: "2026-03-18T09:00:02.000Z",
        updatedAt: "2026-03-18T09:10:00.000Z"
      }
    ]
  };

  const wednesdayRun = {
    id: "run_wednesday",
    outcomeId: "outcome_123",
    planId: "plan_wednesday",
    triggerMessageId: "msg_wednesday",
    status: "blocked" as const,
    createdAt: "2026-03-19T09:00:02.000Z",
    updatedAt: "2026-03-19T09:15:00.000Z",
    steps: [
      {
        id: "step_wednesday",
        runId: "run_wednesday",
        planNodeId: "node_wednesday",
        title: "Prepare delivery packet",
        kind: "task" as const,
        capability: "document" as const,
        status: "running" as const,
        position: 0,
        createdAt: "2026-03-19T09:00:02.000Z",
        updatedAt: "2026-03-19T09:13:00.000Z"
      }
    ]
  };

  return {
    plan: wednesdayPlan,
    run: wednesdayRun,
    thread: {
      isHydrated: true,
      plans: [mondayPlan, tuesdayPlan, wednesdayPlan],
      runs: [mondayRun, tuesdayRun, wednesdayRun]
    },
    artifacts: [
      {
        id: "artifact_monday",
        outcomeId: "outcome_123",
        runId: "run_monday",
        stepId: "step_monday",
        kind: "result",
        relativePath: "artifacts/monday.md",
        size: 1200,
        metadata: {
          summary: "Monday architecture notes"
        },
        createdAt: "2026-03-17T09:09:00.000Z"
      },
      {
        id: "artifact_tuesday",
        outcomeId: "outcome_123",
        runId: "run_tuesday",
        stepId: "step_tuesday",
        kind: "result",
        relativePath: "artifacts/tuesday.md",
        size: 1400,
        metadata: {
          summary: "Tuesday architecture revision"
        },
        createdAt: "2026-03-18T09:11:00.000Z"
      },
      {
        id: "artifact_wednesday",
        outcomeId: "outcome_123",
        runId: "run_wednesday",
        stepId: "step_wednesday",
        kind: "draft",
        relativePath: "artifacts/wednesday.md",
        size: 800,
        metadata: {
          previewBody: "Wednesday delivery packet draft"
        },
        createdAt: "2026-03-19T09:14:00.000Z"
      }
    ],
    logs: [
      {
        runId: "run_monday",
        level: "info" as const,
        message: "I’ll start by mapping the architecture tradeoffs.",
        createdAt: "2026-03-17T09:00:10.000Z"
      },
      {
        runId: "run_monday",
        stepId: "step_monday",
        stepTitle: "Research architecture options",
        level: "info" as const,
        message: "Monday research complete.",
        createdAt: "2026-03-17T09:08:30.000Z"
      },
      {
        runId: "run_tuesday",
        stepId: "step_tuesday",
        stepTitle: "Refine the architecture plan",
        level: "info" as const,
        message: "Tuesday revision complete.",
        createdAt: "2026-03-18T09:10:30.000Z"
      },
      {
        runId: "run_wednesday",
        level: "info" as const,
        message: "I’m preparing the delivery packet and checking for anything missing.",
        createdAt: "2026-03-19T09:00:20.000Z"
      },
      {
        runId: "run_wednesday",
        stepId: "step_wednesday",
        stepTitle: "Prepare delivery packet",
        level: "info" as const,
        message: "Wednesday packet still in progress.",
        createdAt: "2026-03-19T09:13:30.000Z"
      }
    ],
    pendingApprovals: [
      {
        id: "approval_wednesday",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_wednesday",
        stepId: "step_wednesday",
        status: "pending",
        kind: "output_review_required",
        title: "Review delivery packet",
        summary: "Approve the final delivery packet.",
        instruction: "Approve before sending.",
        artifactIds: ["artifact_wednesday"],
        requestedAt: "2026-03-19T09:14:30.000Z",
        resolvedAt: null,
        resolution: null,
        resolutionNote: null
      }
    ],
    messages: [
      {
        id: "msg_tuesday",
        outcomeId: "outcome_123",
        role: "user",
        content: "Tighten the architecture recommendation and remove dead ends.",
        createdAt: "2026-03-18T09:00:00.000Z",
        submissionId: null
      },
      {
        id: "msg_wednesday",
        outcomeId: "outcome_123",
        role: "user",
        content: "Package this up for delivery and call out the remaining risk.",
        createdAt: "2026-03-19T09:00:00.000Z",
        submissionId: null
      }
    ],
    assistantMessages: [
      {
        id: "assistant_monday",
        runId: "run_monday",
        kind: "acknowledgment",
        content: "I’m pulling the architecture options together first.",
        createdAt: "2026-03-17T09:00:05.000Z",
        updatedAt: "2026-03-17T09:00:15.000Z",
        status: "completed"
      },
      {
        id: "assistant_tuesday",
        runId: "run_tuesday",
        kind: "transition",
        content: "I’ll tighten the recommendation and keep only the viable paths.",
        createdAt: "2026-03-18T09:00:05.000Z",
        updatedAt: "2026-03-18T09:00:12.000Z",
        status: "completed"
      },
      {
        id: "assistant_wednesday",
        runId: "run_wednesday",
        kind: "transition",
        content: "I’m packaging the delivery and surfacing the remaining risk.",
        createdAt: "2026-03-19T09:00:05.000Z",
        updatedAt: "2026-03-19T09:00:10.000Z",
        status: "streaming"
      }
    ]
  };
}

function buildPresentationOrderingState(
  presentationHints: Array<{
    id: string;
    outcomeId: string;
    entityType: "assistant-message" | "step" | "artifact" | "approval";
    entityId: string;
    phaseId: string;
    seq: number;
    laneId?: string;
    createdAt: string;
  }>
): OutcomeConversationState {
  return {
    plan: {
      id: "plan_123",
      outcomeId: "outcome_123",
      triggerMessageId: "msg_123",
      status: "draft",
      createdAt: "2026-03-27T09:00:00.000Z",
      updatedAt: "2026-03-27T09:00:00.000Z",
      nodes: [
        {
          id: "node_delivery",
          kind: "synthesis",
          title: "Prepare delivery packet",
          capability: "document",
          position: 0
        }
      ],
      edges: []
    },
    run: {
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_123",
      triggerMessageId: "msg_123",
      status: "completed",
      createdAt: "2026-03-27T09:00:00.000Z",
      updatedAt: "2026-03-27T09:10:00.000Z",
      steps: [
        {
          id: "step_delivery",
          runId: "run_123",
          planNodeId: "node_delivery",
          title: "Prepare delivery packet",
          kind: "synthesis",
          capability: "document",
          status: "completed",
          position: 0,
          createdAt: "2026-03-27T09:00:30.000Z",
          updatedAt: "2026-03-27T09:01:00.000Z"
        }
      ]
    },
    artifacts: [
      {
        id: "artifact_delivery",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_delivery",
        kind: "result",
        relativePath: "artifacts/delivery.pdf",
        size: 2048,
        metadata: {
          summary: "Delivery packet ready."
        },
        createdAt: "2026-03-27T09:02:00.000Z"
      }
    ],
    logs: [],
    pendingApprovals: [],
    messages: [],
    assistantMessages: [
      {
        id: "assistant_lead",
        runId: "run_123",
        kind: "acknowledgment",
        content: "I'll start by loading context.",
        createdAt: "2026-03-27T09:00:05.000Z",
        updatedAt: "2026-03-27T09:00:06.000Z",
        status: "completed"
      },
      {
        id: "assistant_transition",
        runId: "run_123",
        kind: "transition",
        content: "Now I'll package the delivery packet.",
        createdAt: "2026-03-27T09:05:00.000Z",
        updatedAt: "2026-03-27T09:05:02.000Z",
        status: "completed"
      }
    ],
    presentationHints
  };
}

describe("buildOutcomeThreadTurns", () => {
  it("groups multi-turn work by trigger message instead of one global run", () => {
    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Map the system architecture and propose a path forward.",
      outcomeSource: "web",
      state: buildMultiTurnState()
    });

    expect(turns).toHaveLength(3);
    expect(turns.map((turn) => turn.triggerMessageId)).toEqual([
      null,
      "msg_tuesday",
      "msg_wednesday"
    ]);

    expect(turns[0]?.promptItem).toMatchObject({
      type: "prompt",
      prompt: "Map the system architecture and propose a path forward."
    });
    expect(turns[0]?.runIds).toEqual(["run_monday"]);
    expect(turns[0]?.planIds).toEqual(["plan_monday"]);

    expect(turns[1]?.messageItem).toMatchObject({
      type: "message",
      message: expect.objectContaining({
        id: "msg_tuesday",
        content: "Tighten the architecture recommendation and remove dead ends."
      })
    });
    expect(turns[1]?.runIds).toEqual(["run_tuesday"]);
    expect(turns[1]?.planIds).toEqual(["plan_tuesday"]);
    expect(turns[1]?.leadItem).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_tuesday",
        runId: "run_tuesday"
      })
    });

    expect(
      turns[0]?.bodyItems.some(
        (item) =>
          item.type === "artifact-delivery" && item.artifact.id === "artifact_monday"
      )
    ).toBe(true);
    expect(
      turns[0]?.bodyItems.some(
        (item) =>
          item.type === "artifact-delivery" && item.artifact.id === "artifact_tuesday"
      )
    ).toBe(false);
    expect(
      turns[1]?.bodyItems.some(
        (item) =>
          item.type === "artifact-delivery" && item.artifact.id === "artifact_tuesday"
      )
    ).toBe(true);

    expect(
      turns[2]?.bodyItems.some(
        (item) => item.type === "approval" && item.approval.id === "approval_wednesday"
      )
    ).toBe(true);
    expect(
      turns[1]?.bodyItems.some(
        (item) => item.type === "approval" && item.approval.id === "approval_wednesday"
      )
    ).toBe(false);
  });

  it("reuses unchanged turn objects when only a later turn receives new activity", () => {
    const state = buildMultiTurnState();
    const initialTurns = buildOutcomeThreadTurns({
      outcomePrompt: "Map the system architecture and propose a path forward.",
      outcomeSource: "web",
      state
    });

    const nextState: OutcomeConversationState = {
      ...state,
      logs: [
        ...state.logs,
        {
          runId: "run_wednesday",
          stepId: "step_wednesday",
          stepTitle: "Prepare delivery packet",
          level: "info",
          message: "Adding the final risk summary to the packet.",
          createdAt: "2026-03-19T09:14:45.000Z"
        }
      ]
    };

    const nextTurns = buildOutcomeThreadTurns({
      outcomePrompt: "Map the system architecture and propose a path forward.",
      outcomeSource: "web",
      state: nextState,
      previousTurns: initialTurns
    });

    expect(nextTurns[0]).toBe(initialTurns[0]);
    expect(nextTurns[1]).toBe(initialTurns[1]);
    expect(nextTurns[2]).not.toBe(initialTurns[2]);
  });
});

describe("buildOutcomeFeed", () => {
  it("keeps each follow-up message above the AI response it triggered", () => {
    const feed = buildOutcomeFeed({
      outcomePrompt: "Map the system architecture and propose a path forward.",
      outcomeSource: "web",
      state: buildMultiTurnState()
    });

    const tuesdayMessageIndex = feed.findIndex(
      (item) => item.type === "message" && item.message.id === "msg_tuesday"
    );
    const tuesdayAssistantIndex = feed.findIndex(
      (item) =>
        item.type === "assistant-message" && item.message.id === "assistant_tuesday"
    );
    const wednesdayMessageIndex = feed.findIndex(
      (item) => item.type === "message" && item.message.id === "msg_wednesday"
    );
    const wednesdayAssistantIndex = feed.findIndex(
      (item) =>
        item.type === "assistant-message" && item.message.id === "assistant_wednesday"
    );

    expect(tuesdayMessageIndex).toBeGreaterThan(0);
    expect(tuesdayAssistantIndex).toBeGreaterThan(tuesdayMessageIndex);
    expect(wednesdayMessageIndex).toBeGreaterThan(tuesdayAssistantIndex);
    expect(wednesdayAssistantIndex).toBeGreaterThan(wednesdayMessageIndex);
  });

  it("maps the initial prompt message to the prompt turn from thread identity even when the text differs", () => {
    const state = buildMultiTurnState();
    const initialMessage = {
      id: "msg_monday",
      outcomeId: "outcome_123",
      role: "user" as const,
      content: "  Map the system architecture and propose a path forward.\n",
      createdAt: "2026-03-17T09:00:00.000Z",
      submissionId: null
    };

    state.messages = [initialMessage, ...state.messages];

    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Map the system architecture and propose a path forward.",
      outcomeSource: "web",
      state
    });

    expect(turns[0]?.triggerMessageId).toBe("msg_monday");
    expect(turns[0]?.promptItem).toMatchObject({
      type: "prompt",
      prompt: "Map the system architecture and propose a path forward."
    });
    expect(turns[0]?.messageItem).toBeNull();
    expect(turns[0]?.planIds).toEqual(["plan_monday"]);
    expect(turns[0]?.runIds).toEqual(["run_monday"]);

    const feed = buildOutcomeFeed({
      outcomePrompt: "Map the system architecture and propose a path forward.",
      outcomeSource: "web",
      state
    });

    expect(
      feed.some((item) => item.type === "message" && item.message.id === "msg_monday")
    ).toBe(false);
  });

  it("keeps the single-turn delivery flow compatible for the current renderer", () => {
    const feed = buildOutcomeFeed({
      outcomePrompt: "Research AI in K-12 education and generate a PDF.",
      outcomeSource: "web",
      state: {
        plan: {
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
        },
        run: {
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
          }
        ],
        pendingApprovals: [],
        messages: [
          {
            id: "msg_123",
            outcomeId: "outcome_123",
            role: "user",
            content: "Research AI in K-12 education and generate a PDF.",
            createdAt: "2026-03-21T00:00:00.000Z",
            submissionId: null
          }
        ],
        assistantMessages: []
      }
    });

    expect(feed[0]).toMatchObject({
      type: "prompt"
    });
    expect(
      feed.some((item) => item.type === "message" && item.message.id === "msg_123")
    ).toBe(false);
    expect(feed[1]).toMatchObject({
      type: "intent",
      message:
        "I'll start by loading relevant context and shaping the work into focused subtasks."
    });

    const artifactIndex = feed.findIndex(
      (item) => item.type === "artifact-delivery"
    );
    const deliveryNoteIndex = feed.findIndex(
      (item) => item.type === "delivery-note"
    );

    expect(artifactIndex).toBeGreaterThan(-1);
    expect(deliveryNoteIndex).toBeGreaterThan(artifactIndex);
  });

  it("prefers authored presentation ordering when hints exist", () => {
    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Prepare the delivery packet.",
      outcomeSource: "web",
      state: buildPresentationOrderingState([
        {
          id: "hint_transition",
          outcomeId: "outcome_123",
          entityType: "assistant-message",
          entityId: "assistant_transition",
          phaseId: "phase_delivery",
          seq: 10,
          laneId: "lane_delivery",
          createdAt: "2026-03-27T09:00:30.000Z"
        },
        {
          id: "hint_step",
          outcomeId: "outcome_123",
          entityType: "step",
          entityId: "step_delivery",
          phaseId: "phase_delivery",
          seq: 20,
          laneId: "lane_delivery",
          createdAt: "2026-03-27T09:00:30.000Z"
        },
        {
          id: "hint_artifact",
          outcomeId: "outcome_123",
          entityType: "artifact",
          entityId: "artifact_delivery",
          phaseId: "phase_delivery",
          seq: 30,
          laneId: "lane_delivery",
          createdAt: "2026-03-27T09:00:30.000Z"
        }
      ])
    });

    expect(turns[0]?.leadItem).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_lead"
      })
    });
    expect(turns[0]?.bodyItems.map((item) => item.type)).toEqual([
      "assistant-message",
      "task",
      "artifact-delivery",
      "delivery-note"
    ]);
  });

  it("falls back to chrono ordering when presentation hints are absent", () => {
    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Prepare the delivery packet.",
      outcomeSource: "web",
      state: buildPresentationOrderingState([])
    });

    expect(turns[0]?.bodyItems.map((item) => item.type)).toEqual([
      "task",
      "artifact-delivery",
      "delivery-note",
      "assistant-message"
    ]);
  });

  it("uses authored hint order when choosing the lead assistant message", () => {
    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Prepare the delivery packet.",
      outcomeSource: "web",
      state: buildPresentationOrderingState([
        {
          id: "hint_transition",
          outcomeId: "outcome_123",
          entityType: "assistant-message",
          entityId: "assistant_transition",
          phaseId: "phase_delivery",
          seq: 10,
          laneId: "lane_delivery",
          createdAt: "2026-03-27T09:00:30.000Z"
        },
        {
          id: "hint_lead",
          outcomeId: "outcome_123",
          entityType: "assistant-message",
          entityId: "assistant_lead",
          phaseId: "phase_delivery",
          seq: 20,
          laneId: "lane_delivery",
          createdAt: "2026-03-27T09:00:30.000Z"
        }
      ])
    });

    expect(turns[0]?.leadItem).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_transition"
      })
    });
    expect(turns[0]?.bodyItems[0]).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_lead"
      })
    });
  });

  it("uses partial assistant hints to influence lead selection through phase anchors", () => {
    const state = buildPresentationOrderingState([
      {
        id: "hint_transition",
        outcomeId: "outcome_123",
        entityType: "assistant-message",
        entityId: "assistant_transition",
        phaseId: "phase_delivery",
        seq: 10,
        laneId: "lane_delivery",
        createdAt: "2026-03-27T09:00:00.000Z"
      }
    ]);

    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Prepare the delivery packet.",
      outcomeSource: "web",
      state
    });

    expect(turns[0]?.leadItem).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_transition"
      })
    });
    expect(turns[0]?.bodyItems[0]).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_lead"
      })
    });
  });

  it("uses the same mixed hinted ordering rule for lead selection and body ordering", () => {
    const state = buildPresentationOrderingState([
      {
        id: "hint_transition",
        outcomeId: "outcome_123",
        entityType: "assistant-message",
        entityId: "assistant_transition",
        phaseId: "phase_delivery",
        seq: 10,
        laneId: "lane_delivery",
        createdAt: "2026-03-27T09:00:00.000Z"
      },
      {
        id: "hint_step",
        outcomeId: "outcome_123",
        entityType: "step",
        entityId: "step_delivery",
        phaseId: "phase_delivery",
        seq: 20,
        laneId: "lane_delivery",
        createdAt: "2026-03-27T09:00:00.000Z"
      },
      {
        id: "hint_artifact",
        outcomeId: "outcome_123",
        entityType: "artifact",
        entityId: "artifact_delivery",
        phaseId: "phase_delivery",
        seq: 30,
        laneId: "lane_delivery",
        createdAt: "2026-03-27T09:00:00.000Z"
      }
    ]);

    state.messages = [
      {
        id: "msg_system_progress",
        outcomeId: "outcome_123",
        role: "assistant",
        content: "System note: delivery checks are still running.",
        createdAt: "2026-03-27T09:01:30.000Z",
        submissionId: null
      }
    ];

    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Prepare the delivery packet.",
      outcomeSource: "web",
      state
    });

    expect(turns[0]?.leadItem).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_transition"
      })
    });
    expect(turns[0]?.bodyItems.map((item) => item.type)).toEqual([
      "task",
      "artifact-delivery",
      "delivery-note",
      "assistant-message",
      "message"
    ]);
    expect(turns[0]?.bodyItems[3]).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_lead"
      })
    });
    expect(turns[0]?.bodyItems[4]).toMatchObject({
      type: "message",
      message: expect.objectContaining({
        id: "msg_system_progress"
      })
    });
  });

  it("uses hinted-before-unhinted precedence when mixed entries share the same anchor", () => {
    const state = buildPresentationOrderingState([
      {
        id: "hint_transition",
        outcomeId: "outcome_123",
        entityType: "assistant-message",
        entityId: "assistant_transition",
        phaseId: "phase_delivery",
        seq: 10,
        laneId: "lane_delivery",
        createdAt: "2026-03-27T09:00:05.000Z"
      },
      {
        id: "hint_step",
        outcomeId: "outcome_123",
        entityType: "step",
        entityId: "step_delivery",
        phaseId: "phase_delivery",
        seq: 20,
        laneId: "lane_delivery",
        createdAt: "2026-03-27T09:00:05.000Z"
      }
    ]);

    state.messages = [
      {
        id: "msg_same_anchor",
        outcomeId: "outcome_123",
        role: "assistant",
        content: "System note that shares the same anchor.",
        createdAt: "2026-03-27T09:00:05.000Z",
        submissionId: null
      }
    ];

    const turns = buildOutcomeThreadTurns({
      outcomePrompt: "Prepare the delivery packet.",
      outcomeSource: "web",
      state
    });

    expect(turns[0]?.leadItem).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_transition"
      })
    });
    expect(turns[0]?.bodyItems.map((item) => item.type)).toEqual([
      "task",
      "assistant-message",
      "message",
      "artifact-delivery",
      "delivery-note"
    ]);
    expect(turns[0]?.bodyItems[3]).toMatchObject({
      type: "artifact-delivery",
      artifact: expect.objectContaining({
        id: "artifact_delivery"
      })
    });
    expect(turns[0]?.bodyItems[4]).toMatchObject({
      type: "delivery-note"
    });
    expect(turns[0]?.bodyItems[1]).toMatchObject({
      type: "assistant-message",
      message: expect.objectContaining({
        id: "assistant_lead"
      })
    });
    expect(turns[0]?.bodyItems[2]).toMatchObject({
      type: "message",
      message: expect.objectContaining({
        id: "msg_same_anchor"
      })
    });
  });
});
