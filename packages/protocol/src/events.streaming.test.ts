import { describe, expect, it } from "vitest";
import {
  AssistantMessageListResponseSchema,
  OutcomePresentationHintSchema,
  OutcomeStreamEventSchema,
  sortOutcomePresentationHints
} from "./index";

describe("assistant streaming event contracts", () => {
  it("accepts assistant message lifecycle events", () => {
    const started = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "assistant.message.started",
      data: {
        messageId: "assistant_msg_1",
        runId: "run_123",
        kind: "acknowledgment",
        createdAt: "2026-03-22T00:00:00.000Z"
      }
    });

    const delta = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "assistant.message.delta",
      data: {
        messageId: "assistant_msg_1",
        runId: "run_123",
        kind: "acknowledgment",
        delta: "I’ll start by loading context",
        content: "I’ll start by loading context",
        createdAt: "2026-03-22T00:00:00.000Z",
        updatedAt: "2026-03-22T00:00:00.300Z"
      }
    });

    const completed = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "assistant.message.completed",
      data: {
        messageId: "assistant_msg_1",
        runId: "run_123",
        kind: "acknowledgment",
        content: "I’ll start by loading context and then break the work into parallel research tracks.",
        createdAt: "2026-03-22T00:00:00.000Z",
        completedAt: "2026-03-22T00:00:01.000Z"
      }
    });

    expect(started.type).toBe("assistant.message.started");
    expect(delta.type).toBe("assistant.message.delta");
    expect(completed.type).toBe("assistant.message.completed");
  });

  it("accepts authored presentation hint events", () => {
    const hint = OutcomePresentationHintSchema.parse({
      id: "hint_123",
      outcomeId: "outcome_123",
      entityType: "assistant-message",
      entityId: "assistant_msg_1",
      phaseId: "phase_1",
      seq: 10,
      laneId: "lane_primary",
      createdAt: "2026-03-22T00:00:00.000Z"
    });

    const event = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "presentation.hint",
      data: hint
    });

    expect(event.type).toBe("presentation.hint");
    expect(event.data).toMatchObject({
      id: "hint_123",
      outcomeId: "outcome_123",
      entityType: "assistant-message",
      entityId: "assistant_msg_1",
      phaseId: "phase_1",
      seq: 10,
      laneId: "lane_primary"
    });
  });

  it("accepts assistant message snapshots for initial hydration", () => {
    const snapshots = AssistantMessageListResponseSchema.parse({
      assistantMessages: [
        {
          id: "assistant_msg_1",
          runId: "run_123",
          kind: "acknowledgment",
          content: "I'll start by loading relevant skills.",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:01.000Z",
          status: "completed"
        }
      ]
    });

    expect(snapshots.assistantMessages).toHaveLength(1);
    expect(snapshots.assistantMessages[0]?.status).toBe("completed");
  });

  it("sorts presentation hints using authored phase order instead of raw arrival order", () => {
    const hints = [
      OutcomePresentationHintSchema.parse({
        id: "hint_alpha_seq30",
        outcomeId: "outcome_123",
        entityType: "artifact",
        entityId: "artifact_alpha",
        phaseId: "phase_alpha",
        seq: 30,
        laneId: "lane_a",
        createdAt: "2026-03-22T00:00:00.000Z"
      }),
      OutcomePresentationHintSchema.parse({
        id: "hint_beta_seq10",
        outcomeId: "outcome_123",
        entityType: "assistant-message",
        entityId: "assistant_beta",
        phaseId: "phase_beta",
        seq: 10,
        laneId: "lane_a",
        createdAt: "2026-03-22T00:05:00.000Z"
      }),
      OutcomePresentationHintSchema.parse({
        id: "hint_alpha_seq10",
        outcomeId: "outcome_123",
        entityType: "step",
        entityId: "step_alpha",
        phaseId: "phase_alpha",
        seq: 10,
        laneId: "lane_a",
        createdAt: "2026-03-22T00:20:00.000Z"
      })
    ];

    expect(sortOutcomePresentationHints(hints).map((hint) => hint.id)).toEqual([
      "hint_alpha_seq10",
      "hint_alpha_seq30",
      "hint_beta_seq10"
    ]);
  });
});
