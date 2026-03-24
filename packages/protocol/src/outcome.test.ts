import { describe, expect, it } from "vitest";
import {
  ContinueOutcomeRequestSchema,
  OutcomeSchema,
  OutcomeStatusSchema,
  OutcomeTurnResponseSchema,
  StartOutcomeRequestSchema
} from "./index";

describe("OutcomeSchema", () => {
  it("accepts a valid outcome payload", () => {
    const parsed = OutcomeSchema.safeParse({
      id: "outcome_123",
      workspaceId: "ws_123",
      userId: "user_123",
      prompt: "Summarize the latest incident report",
      source: "web",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z"
    });

    expect(parsed.success).toBe(true);
    expect(OutcomeStatusSchema.parse("draft")).toBe("draft");
  });

  it("accepts turn-aware start and continue outcome payloads", () => {
    expect(
      StartOutcomeRequestSchema.parse({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Summarize the latest incident report",
        source: "web",
        triggerMessageId: "msg_123"
      })
    ).toEqual(
      expect.objectContaining({
        triggerMessageId: "msg_123"
      })
    );

    expect(
      ContinueOutcomeRequestSchema.parse({
        outcomeId: "outcome_123",
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Continue the incident follow-up",
        source: "slack",
        triggerMessageId: "msg_456"
      })
    ).toEqual(
      expect.objectContaining({
        outcomeId: "outcome_123",
        triggerMessageId: "msg_456"
      })
    );

    expect(
      OutcomeTurnResponseSchema.parse({
        outcome: {
          id: "outcome_123",
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Summarize the latest incident report",
          source: "web",
          status: "draft",
          createdAt: "2026-03-11T00:00:00.000Z",
          updatedAt: "2026-03-11T00:00:00.000Z"
        },
        triggerMessageId: "msg_123"
      })
    ).toEqual(
      expect.objectContaining({
        triggerMessageId: "msg_123"
      })
    );
  });
});
