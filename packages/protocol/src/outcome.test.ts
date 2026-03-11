import { describe, expect, it } from "vitest";
import { OutcomeSchema, OutcomeStatusSchema } from "./index";

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
});
