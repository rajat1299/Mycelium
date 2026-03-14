import { describe, expect, it } from "vitest";
import {
  EventTypeSchema,
  OutcomeStreamEventSchema,
  PlanSchema,
  RunDetailSchema
} from "./index";

describe("plan and run protocols", () => {
  it("accepts a valid executable draft plan payload", () => {
    const parsed = PlanSchema.safeParse({
      id: "plan_outcome_123",
      outcomeId: "outcome_123",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      nodes: [
        {
          id: "plan_outcome_123:analyze-outcome",
          kind: "root",
          title: "Analyze outcome",
          capability: "reasoning",
          instruction: "Inspect the outcome prompt and produce execution notes.",
          template: "analyze_outcome",
          approvalRequirement: {
            kind: "output_review_required",
            title: "Review analysis artifact",
            summary: "Check the analysis before release.",
            instruction: "Approve when the analysis artifact is ready."
          },
          expectedArtifactPath: "artifacts/analyze-outcome.md",
          expectedArtifactKind: "analysis",
          position: 0
        },
        {
          id: "plan_outcome_123:draft-brief",
          kind: "task",
          title: "Draft brief",
          capability: "coding",
          instruction: "Write the execution brief for the requested outcome.",
          template: "draft_brief",
          expectedArtifactPath: "artifacts/brief.md",
          expectedArtifactKind: "brief",
          position: 1
        }
      ],
      edges: [
        {
          id: "plan_outcome_123:edge-analyze-brief",
          from: "plan_outcome_123:analyze-outcome",
          to: "plan_outcome_123:draft-brief"
        }
      ]
    });

    expect(parsed).toEqual({
      success: true,
      data: expect.objectContaining({
        nodes: [
          expect.objectContaining({
            approvalRequirement: {
              kind: "output_review_required",
              title: "Review analysis artifact",
              summary: "Check the analysis before release.",
              instruction: "Approve when the analysis artifact is ready."
            },
            instruction: "Inspect the outcome prompt and produce execution notes.",
            template: "analyze_outcome",
            expectedArtifactPath: "artifacts/analyze-outcome.md",
            expectedArtifactKind: "analysis"
          }),
          expect.objectContaining({
            instruction: "Write the execution brief for the requested outcome.",
            template: "draft_brief",
            expectedArtifactPath: "artifacts/brief.md",
            expectedArtifactKind: "brief"
          })
        ]
      })
    });
  });

  it("accepts run detail and expanded outcome stream events", () => {
    const run = RunDetailSchema.parse({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "queued",
      createdAt: "2026-03-11T00:05:00.000Z",
      updatedAt: "2026-03-11T00:05:00.000Z",
      steps: [
        {
          id: "step_run_123_plan_outcome_123:analyze-outcome",
          runId: "run_123",
          planNodeId: "plan_outcome_123:analyze-outcome",
          title: "Analyze outcome",
          kind: "root",
          capability: "reasoning",
          instruction: "Inspect the outcome prompt and produce execution notes.",
          template: "analyze_outcome",
          approvalRequirement: {
            kind: "output_review_required",
            title: "Review analysis artifact",
            summary: "Check the analysis before release.",
            instruction: "Approve when the analysis artifact is ready."
          },
          expectedArtifactPath: "artifacts/analyze-outcome.md",
          expectedArtifactKind: "analysis",
          status: "ready",
          position: 0,
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z"
        }
      ]
    });

    expect(run.steps).toEqual([
      expect.objectContaining({
        approvalRequirement: {
          kind: "output_review_required",
          title: "Review analysis artifact",
          summary: "Check the analysis before release.",
          instruction: "Approve when the analysis artifact is ready."
        },
        instruction: "Inspect the outcome prompt and produce execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      })
    ]);
    expect(EventTypeSchema.parse("plan.created")).toBe("plan.created");
    expect(EventTypeSchema.parse("run.created")).toBe("run.created");
    expect(EventTypeSchema.parse("run.step.updated")).toBe("run.step.updated");
    expect(EventTypeSchema.parse("approval.requested")).toBe("approval.requested");
    expect(EventTypeSchema.parse("approval.resolved")).toBe("approval.resolved");

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "plan.created",
        data: {
          id: "plan_outcome_123",
          outcomeId: "outcome_123",
          status: "draft",
          createdAt: "2026-03-11T00:00:00.000Z",
          updatedAt: "2026-03-11T00:00:00.000Z",
          nodes: [],
          edges: []
        }
      })
    ).toEqual(
      expect.objectContaining({
        type: "plan.created"
      })
    );

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "run.created",
        data: {
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-11T00:05:00.000Z",
          updatedAt: "2026-03-11T00:05:00.000Z"
        }
      })
    ).toEqual(
      expect.objectContaining({
        type: "run.created"
      })
    );

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "run.step.updated",
        data: run.steps[0]
      })
    ).toEqual(
      expect.objectContaining({
        type: "run.step.updated"
      })
    );
  });
});
