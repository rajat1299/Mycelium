import { describe, expect, it } from "vitest";
import { RunDetailSchema } from "@computer-oss/protocol";
import {
  createExecutionHarness,
  createOutcomeAndPlan
} from "./execution-test-helpers";

describe("execution service", () => {
  it("runs ready sibling steps before synthesis and emits logs plus artifacts", async () => {
    const startedSiblingNodeIds = new Set<string>();
    let releaseSiblings: (() => void) | null = null;
    const siblingsStarted = new Promise<void>((resolve) => {
      releaseSiblings = resolve;
    });
    const harness = await createExecutionHarness({
      async onExecute(request) {
        if (
          request.step.planNodeId.endsWith("draft-brief") ||
          request.step.planNodeId.endsWith("draft-operator-summary")
        ) {
          startedSiblingNodeIds.add(request.step.planNodeId);

          if (startedSiblingNodeIds.size === 2) {
            releaseSiblings?.();
          }

          await siblingsStarted;
        }

        return {
          stdout: `completed ${request.step.planNodeId}\n`
        };
      }
    });

    try {
      const { app, services, events, fakeSandbox } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      const started = fakeSandbox.startedPlanNodeIds;
      const briefIndex = started.findIndex((planNodeId) =>
        planNodeId.endsWith("draft-brief")
      );
      const summaryIndex = started.findIndex((planNodeId) =>
        planNodeId.endsWith("draft-operator-summary")
      );
      const synthesisIndex = started.findIndex((planNodeId) =>
        planNodeId.endsWith("synthesize-result")
      );

      expect(started[0]?.endsWith("analyze-outcome")).toBe(true);
      expect(briefIndex).toBeGreaterThan(0);
      expect(summaryIndex).toBeGreaterThan(0);
      expect(briefIndex).toBeLessThan(synthesisIndex);
      expect(summaryIndex).toBeLessThan(synthesisIndex);

      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "completed"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "completed"
        })
      );
      const artifacts = await services.repositories.artifacts.listByRun(createdRun.id);

      expect(artifacts).toHaveLength(4);
      expect(artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relativePath: "artifacts/analyze-outcome.md",
            kind: "analysis"
          }),
          expect.objectContaining({
            relativePath: "artifacts/brief.md",
            kind: "brief"
          }),
          expect.objectContaining({
            relativePath: "artifacts/operator-summary.md",
            kind: "operator_summary"
          }),
          expect.objectContaining({
            relativePath: "artifacts/final-result.md",
            kind: "result"
          })
        ])
      );

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.log",
            data: expect.objectContaining({
              runId: createdRun.id,
              message: expect.stringContaining("completed")
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "artifact.created",
            data: expect.objectContaining({
              runId: createdRun.id,
              relativePath: "artifacts/final-result.md"
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });
});
