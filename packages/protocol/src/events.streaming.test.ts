import { describe, expect, it } from "vitest";
import {
  AssistantMessageListResponseSchema,
  OutcomeStreamEventSchema
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
});
