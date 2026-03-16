import { describe, expect, it } from "vitest";
import { AuditEventSchema, AuditListResponseSchema } from "./index";

describe("audit protocol contracts", () => {
  it("accepts stable audit events and list responses", () => {
    const event = AuditEventSchema.parse({
      id: "audit_123",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_synthesize",
      checkpointId: "checkpoint_123",
      sequence: 12,
      category: "checkpoint",
      eventType: "checkpoint.created",
      actorType: "system",
      summary: "Stored a resumable checkpoint after step completion.",
      payload: {
        kind: "step_completed",
        resumable: true
      },
      createdAt: "2026-03-16T00:00:00.000Z"
    });

    expect(
      AuditListResponseSchema.parse({
        events: [event]
      })
    ).toEqual({
      events: [event]
    });
  });

  it("rejects invalid audit invariants", () => {
    expect(() =>
      AuditEventSchema.parse({
        id: "audit_bad_sequence",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: null,
        checkpointId: null,
        sequence: -1,
        category: "resume",
        eventType: "run.resumed",
        actorType: "system",
        summary: "Bad sequence.",
        payload: {},
        createdAt: "2026-03-16T00:00:00.000Z"
      })
    ).toThrow(/too small/i);

    expect(() =>
      AuditEventSchema.parse({
        id: "audit_bad_summary",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: null,
        checkpointId: null,
        sequence: 0,
        category: "lifecycle",
        eventType: "run.started",
        actorType: "system",
        summary: "",
        payload: {},
        createdAt: "2026-03-16T00:00:00.000Z"
      })
    ).toThrow(/too small/i);
  });
});
