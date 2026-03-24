import { describe, expect, it } from "vitest";
import { createExecutionHarness, createOutcomeAndPlan } from "./execution-test-helpers";
import {
  createPlanForOutcomeTurn,
  createRunForExistingPlan
} from "./turn-test-helpers";

describe("checkpoint service", () => {
  it("persists semantic checkpoint manifests and matching audit events", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, events } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);
      const run = await createRunForExistingPlan(services.repositories, {
        id: `run_${outcome.id}_checkpoint`,
        outcomeId: outcome.id,
        planId: plan.id,
        createdAt: "2026-03-16T10:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z"
      });
      const [rootStep] = await services.repositories.runs.listSteps(run.id);

      await services.repositories.workspaceLeases.acquire({
        runId: run.id,
        rootPath: `/tmp/${run.id}`,
        inputPath: `/tmp/${run.id}/input`,
        artifactsPath: `/tmp/${run.id}/artifacts`,
        logsPath: `/tmp/${run.id}/logs`,
        acquiredAt: "2026-03-16T10:00:01.000Z"
      });
      await services.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-16T10:00:02.000Z"
      });
      await services.repositories.artifacts.create({
        id: "artifact_checkpoint_root",
        outcomeId: outcome.id,
        runId: run.id,
        stepId: rootStep.id,
        kind: rootStep.expectedArtifactKind ?? "analysis",
        relativePath: rootStep.expectedArtifactPath ?? "artifacts/analyze-outcome.md",
        size: 12,
        metadata: {},
        createdAt: "2026-03-16T10:00:03.000Z"
      });

      const checkpoint = await services.checkpointService.createCheckpoint({
        runId: run.id,
        kind: "run_started",
        stepId: null
      });

      expect(checkpoint).toEqual(
        expect.objectContaining({
          runId: run.id,
          outcomeId: outcome.id,
          workspaceId: outcome.workspaceId,
          kind: "run_started",
          resumable: true,
          sequence: 1
        })
      );
      await expect(
        services.repositories.checkpoints.getLatestResumableByRun(run.id)
      ).resolves.toEqual(expect.objectContaining({ id: checkpoint.id }));
      await expect(services.repositories.auditEvents.listByRun(run.id)).resolves.toEqual([
        expect.objectContaining({
          checkpointId: checkpoint.id,
          category: "checkpoint",
          eventType: "checkpoint.created",
          sequence: 1
        })
      ]);
      await expect(
        services.checkpointService.readCheckpoint(checkpoint.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: checkpoint.id,
          payload: expect.objectContaining({
            run: expect.objectContaining({
              id: run.id,
              outcomeId: outcome.id,
              workspaceId: outcome.workspaceId,
              status: "running"
            }),
            readyStepIds: expect.arrayContaining([rootStep.id]),
            artifactIds: ["artifact_checkpoint_root"],
            workspacePaths: {
              inputDir: `/tmp/${run.id}/input`,
              artifactsDir: `/tmp/${run.id}/artifacts`,
              logsDir: `/tmp/${run.id}/logs`
            }
          })
        })
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "checkpoint.created",
            data: expect.objectContaining({
              id: checkpoint.id,
              runId: run.id
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("allocates unique per-run checkpoint sequences under concurrent writes", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Capture concurrent sibling checkpoints.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createPlanForOutcomeTurn(services.repositories, {
        id: `plan_${outcome.id}_parallel`,
        outcomeId: outcome.id,
        status: "draft",
        createdAt: "2026-03-16T13:00:00.000Z",
        updatedAt: "2026-03-16T13:00:00.000Z",
        nodes: [
          {
            id: `plan_${outcome.id}_parallel:root`,
            kind: "root",
            title: "Root",
            capability: "reasoning",
            instruction: "Start",
            template: "analyze_outcome",
            expectedArtifactPath: "artifacts/root.md",
            expectedArtifactKind: "analysis"
          },
          {
            id: `plan_${outcome.id}_parallel:left`,
            kind: "task",
            title: "Left",
            capability: "document",
            instruction: "Left branch",
            template: "draft_brief",
            expectedArtifactPath: "artifacts/left.md",
            expectedArtifactKind: "brief"
          },
          {
            id: `plan_${outcome.id}_parallel:right`,
            kind: "task",
            title: "Right",
            capability: "document",
            instruction: "Right branch",
            template: "draft_operator_summary",
            expectedArtifactPath: "artifacts/right.md",
            expectedArtifactKind: "operator_summary"
          }
        ],
        edges: [
          {
            id: `plan_${outcome.id}_parallel:root-left`,
            from: `plan_${outcome.id}_parallel:root`,
            to: `plan_${outcome.id}_parallel:left`
          },
          {
            id: `plan_${outcome.id}_parallel:root-right`,
            from: `plan_${outcome.id}_parallel:root`,
            to: `plan_${outcome.id}_parallel:right`
          }
        ]
      });
      const run = await createRunForExistingPlan(services.repositories, {
        id: `run_${outcome.id}_parallel`,
        outcomeId: outcome.id,
        planId: plan.id,
        createdAt: "2026-03-16T13:00:00.000Z",
        updatedAt: "2026-03-16T13:00:00.000Z"
      });
      const [rootStep, leftStep, rightStep] = await services.repositories.runs.listSteps(run.id);

      await services.repositories.workspaceLeases.acquire({
        runId: run.id,
        rootPath: `/tmp/${run.id}`,
        inputPath: `/tmp/${run.id}/input`,
        artifactsPath: `/tmp/${run.id}/artifacts`,
        logsPath: `/tmp/${run.id}/logs`,
        acquiredAt: "2026-03-16T13:00:01.000Z"
      });
      await services.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-16T13:00:02.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: rootStep.id,
        status: "completed",
        updatedAt: "2026-03-16T13:00:03.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: leftStep.id,
        status: "completed",
        updatedAt: "2026-03-16T13:00:03.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: rightStep.id,
        status: "completed",
        updatedAt: "2026-03-16T13:00:03.000Z"
      });

      const [leftCheckpoint, rightCheckpoint] = await Promise.all([
        services.checkpointService.createCheckpoint({
          runId: run.id,
          kind: "step_completed",
          stepId: leftStep.id
        }),
        services.checkpointService.createCheckpoint({
          runId: run.id,
          kind: "step_completed",
          stepId: rightStep.id
        })
      ]);

      expect(
        new Set([leftCheckpoint.sequence, rightCheckpoint.sequence]).size
      ).toBe(2);
      await expect(services.repositories.checkpoints.listByRun(run.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sequence: leftCheckpoint.sequence }),
          expect.objectContaining({ sequence: rightCheckpoint.sequence })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });
});
