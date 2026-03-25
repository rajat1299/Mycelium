import { describe, expect, it } from "vitest";
import {
  ContinueOutcomeRequestSchema,
  CreateOutcomeRequestSchema,
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
        source: "web"
      })
    ).toEqual(
      expect.objectContaining({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Summarize the latest incident report",
        source: "web"
      })
    );

    expect(
      ContinueOutcomeRequestSchema.parse({
        content: "Continue the incident follow-up",
        submissionId: "submit_123"
      })
    ).toEqual(
      expect.objectContaining({
        content: "Continue the incident follow-up",
        submissionId: "submit_123"
      })
    );

    expect(Object.keys(StartOutcomeRequestSchema.shape).sort()).toEqual(
      Object.keys(CreateOutcomeRequestSchema.shape).sort()
    );
    expect(Object.keys(ContinueOutcomeRequestSchema.shape).sort()).toEqual([
      "content",
      "submissionId"
    ]);
    expect(Object.keys(OutcomeTurnResponseSchema.shape).sort()).toEqual([
      "outcome",
      "plan",
      "run",
      "triggerMessage"
    ]);

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
        triggerMessage: {
          id: "msg_123",
          outcomeId: "outcome_123",
          role: "user",
          content: "Summarize the latest incident report",
          createdAt: "2026-03-11T00:00:00.000Z",
          submissionId: "submit_123"
        }
      })
    ).toEqual(
      expect.objectContaining({
        triggerMessage: expect.objectContaining({
          id: "msg_123",
          outcomeId: "outcome_123",
          role: "user",
          content: "Summarize the latest incident report",
          submissionId: "submit_123"
        })
      })
    );
  });
});
