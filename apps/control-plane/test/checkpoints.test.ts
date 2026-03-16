import { describe, expect, it } from "vitest";
import {
  AuditListResponseSchema,
  CheckpointDetailSchema,
  CheckpointListResponseSchema
} from "@computer-oss/protocol";
import { createExecutionHarness } from "./execution-test-helpers";

describe("checkpoint routes", () => {
  it("lists checkpoints, reads checkpoint detail, and lists audit events for a run", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Inspect checkpoint and audit APIs.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await services.repositories.plans.create({
        id: `plan_${outcome.id}_resume`,
        outcomeId: outcome.id,
        status: "draft",
        createdAt: "2026-03-16T14:00:00.000Z",
        updatedAt: "2026-03-16T14:00:00.000Z",
        nodes: [
          {
            id: `plan_${outcome.id}_resume:root`,
            kind: "root",
            title: "Analyze outcome",
            capability: "reasoning",
            instruction: "Inspect the prompt.",
            template: "analyze_outcome",
            expectedArtifactPath: "artifacts/analyze.md",
            expectedArtifactKind: "analysis"
          },
          {
            id: `plan_${outcome.id}_resume:synthesize`,
            kind: "synthesis",
            title: "Synthesize result",
            capability: "document",
            instruction: "Finish the result.",
            template: "synthesize_result",
            expectedArtifactPath: "artifacts/final.md",
            expectedArtifactKind: "result"
          }
        ],
        edges: [
          {
            id: `plan_${outcome.id}_resume:root-synthesize`,
            from: `plan_${outcome.id}_resume:root`,
            to: `plan_${outcome.id}_resume:synthesize`
          }
        ]
      });
      const run = await services.repositories.runs.createFromPlan({
        id: `run_${outcome.id}_resume`,
        outcomeId: outcome.id,
        planId: plan.id,
        createdAt: "2026-03-16T14:00:00.000Z",
        updatedAt: "2026-03-16T14:00:00.000Z"
      });
      const [rootStep, synthStep] = await services.repositories.runs.listSteps(run.id);

      await services.repositories.workspaceLeases.acquire({
        runId: run.id,
        rootPath: `/tmp/${run.id}`,
        inputPath: `/tmp/${run.id}/input`,
        artifactsPath: `/tmp/${run.id}/artifacts`,
        logsPath: `/tmp/${run.id}/logs`,
        acquiredAt: "2026-03-16T14:00:01.000Z"
      });
      await services.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-16T14:00:02.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: rootStep.id,
        status: "completed",
        updatedAt: "2026-03-16T14:00:03.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: synthStep.id,
        status: "ready",
        updatedAt: "2026-03-16T14:00:03.000Z"
      });
      const checkpoint = await services.checkpointService.createCheckpoint({
        runId: run.id,
        kind: "step_completed",
        stepId: rootStep.id
      });
      await services.repositories.workspaceLeases.release({
        runId: run.id,
        releasedAt: "2026-03-16T14:00:04.000Z"
      });
      await services.executionService.recoverInterruptedRuns();

      const listCheckpoints = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/checkpoints`
      });

      expect(listCheckpoints.statusCode).toBe(200);
      expect(CheckpointListResponseSchema.parse(listCheckpoints.json())).toEqual(
        expect.objectContaining({
          checkpoints: [expect.objectContaining({ id: checkpoint.id })]
        })
      );

      const checkpointDetail = await app.inject({
        method: "GET",
        url: `/api/checkpoints/${checkpoint.id}`
      });

      expect(checkpointDetail.statusCode).toBe(200);
      expect(CheckpointDetailSchema.parse(checkpointDetail.json())).toEqual(
        expect.objectContaining({
          id: checkpoint.id,
          payload: expect.objectContaining({
            run: expect.objectContaining({
              id: run.id
            }),
            readyStepIds: [synthStep.id]
          })
        })
      );

      const audit = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/audit`
      });

      expect(audit.statusCode).toBe(200);
      expect(AuditListResponseSchema.parse(audit.json())).toEqual(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              eventType: "checkpoint.created",
              checkpointId: checkpoint.id
            }),
            expect.objectContaining({
              eventType: "run.interrupted",
              checkpointId: checkpoint.id
            })
          ])
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("streams checkpoint-created and run-resumed events over outcome SSE", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();

      if (!address || typeof address === "string") {
        throw new Error("Expected an address object from Fastify.");
      }

      const baseUrl = `http://127.0.0.1:${address.port}`;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Stream replay events.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await services.repositories.plans.create({
        id: `plan_${outcome.id}_stream_resume`,
        outcomeId: outcome.id,
        status: "draft",
        createdAt: "2026-03-16T14:30:00.000Z",
        updatedAt: "2026-03-16T14:30:00.000Z",
        nodes: [
          {
            id: `plan_${outcome.id}_stream_resume:root`,
            kind: "root",
            title: "Analyze outcome",
            capability: "reasoning",
            instruction: "Inspect the prompt.",
            template: "analyze_outcome",
            expectedArtifactPath: "artifacts/analyze.md",
            expectedArtifactKind: "analysis"
          }
        ],
        edges: []
      });
      const run = await services.repositories.runs.createFromPlan({
        id: `run_${outcome.id}_stream_resume`,
        outcomeId: outcome.id,
        planId: plan.id,
        createdAt: "2026-03-16T14:30:00.000Z",
        updatedAt: "2026-03-16T14:30:00.000Z"
      });

      const streamResponse = await fetch(`${baseUrl}/api/outcomes/${outcome.id}/events`);
      const reader = streamResponse.body?.getReader();

      if (!reader) {
        throw new Error("Expected SSE reader.");
      }

      await reader.read();

      await services.repositories.workspaceLeases.acquire({
        runId: run.id,
        rootPath: `/tmp/${run.id}`,
        inputPath: `/tmp/${run.id}/input`,
        artifactsPath: `/tmp/${run.id}/artifacts`,
        logsPath: `/tmp/${run.id}/logs`,
        acquiredAt: "2026-03-16T14:30:01.000Z"
      });
      await services.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-16T14:30:02.000Z"
      });
      const checkpoint = await services.checkpointService.createCheckpoint({
        runId: run.id,
        kind: "run_started",
        stepId: null
      });
      await services.repositories.workspaceLeases.release({
        runId: run.id,
        releasedAt: "2026-03-16T14:30:03.000Z"
      });
      await services.executionService.recoverInterruptedRuns();

      const checkpointChunk = new TextDecoder().decode((await reader.read()).value);
      expect(checkpointChunk).toContain("event: checkpoint.created");
      expect(checkpointChunk).toContain(checkpoint.id);

      const resumeResponse = await fetch(`${baseUrl}/api/runs/${run.id}/resume`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      expect(resumeResponse.status).toBe(200);

      const resumedChunk = new TextDecoder().decode((await reader.read()).value);
      expect(resumedChunk).toContain("event: run.resumed");
      expect(resumedChunk).toContain(checkpoint.id);

      await reader.cancel();
      await services.executionService.waitForRun(run.id);
    } finally {
      await harness.cleanup();
    }
  });
});
