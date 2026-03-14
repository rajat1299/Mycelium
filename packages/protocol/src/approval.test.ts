import { describe, expect, it } from "vitest";
import {
  ApprovalListResponseSchema,
  ApprovalResolutionRequestSchema,
  ApprovalSchema,
  OutcomeStreamEventSchema
} from "./index";

describe("approval protocols", () => {
  it("accepts a valid pending approval payload", () => {
    const parsed = ApprovalSchema.parse({
      id: "approval_123",
      workspaceId: "ws_default",
      outcomeId: "outcome_123",
      runId: "run_123",
      stepId: "step_123",
      status: "pending",
      kind: "output_review_required",
      title: "Review final result",
      summary: "Check the final result before the run completes.",
      instruction: "Approve only if the final result is ready to ship.",
      artifactIds: ["artifact_1"],
      requestedAt: "2026-03-14T12:00:00.000Z",
      resolvedAt: null,
      resolution: null,
      resolutionNote: null
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        status: "pending",
        kind: "output_review_required",
        artifactIds: ["artifact_1"]
      })
    );

    expect(
      ApprovalListResponseSchema.parse({
        approvals: [parsed]
      })
    ).toEqual({
      approvals: [parsed]
    });
  });

  it("rejects invalid approval resolution invariants", () => {
    expect(() =>
      ApprovalSchema.parse({
        id: "approval_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_123",
        status: "pending",
        kind: "output_review_required",
        title: "Review final result",
        summary: null,
        instruction: null,
        artifactIds: [],
        requestedAt: "2026-03-14T12:00:00.000Z",
        resolvedAt: "2026-03-14T12:05:00.000Z",
        resolution: "approved",
        resolutionNote: null
      })
    ).toThrow(/pending approvals cannot be resolved/i);

    expect(() =>
      ApprovalSchema.parse({
        id: "approval_124",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_123",
        status: "resolved",
        kind: "output_review_required",
        title: "Review final result",
        summary: null,
        instruction: null,
        artifactIds: [],
        requestedAt: "2026-03-14T12:00:00.000Z",
        resolvedAt: null,
        resolution: "approved",
        resolutionNote: null
      })
    ).toThrow(/resolved approvals require resolvedAt/i);
  });

  it("accepts approval resolution requests and approval events", () => {
    const resolutionRequest = ApprovalResolutionRequestSchema.parse({
      resolution: "rejected",
      resolutionNote: "Needs edits."
    });

    expect(resolutionRequest).toEqual({
      resolution: "rejected",
      resolutionNote: "Needs edits."
    });

    const requested = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "approval.requested",
      data: {
        id: "approval_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_123",
        status: "pending",
        kind: "output_review_required",
        title: "Review final result",
        summary: null,
        instruction: null,
        artifactIds: ["artifact_1"],
        requestedAt: "2026-03-14T12:00:00.000Z",
        resolvedAt: null,
        resolution: null,
        resolutionNote: null
      }
    });

    expect(requested.type).toBe("approval.requested");

    const resolved = OutcomeStreamEventSchema.parse({
      outcomeId: "outcome_123",
      type: "approval.resolved",
      data: {
        id: "approval_123",
        workspaceId: "ws_default",
        outcomeId: "outcome_123",
        runId: "run_123",
        stepId: "step_123",
        status: "resolved",
        kind: "output_review_required",
        title: "Review final result",
        summary: null,
        instruction: null,
        artifactIds: ["artifact_1"],
        requestedAt: "2026-03-14T12:00:00.000Z",
        resolvedAt: "2026-03-14T12:05:00.000Z",
        resolution: "approved",
        resolutionNote: "Ship it."
      }
    });

    expect(resolved.type).toBe("approval.resolved");
  });
});
