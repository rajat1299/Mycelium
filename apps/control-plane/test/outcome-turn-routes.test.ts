import { describe, expect, it } from "vitest";
import {
  OutcomeThreadSnapshotSchema,
  OutcomeTurnResponseSchema
} from "@computer-oss/protocol";
import { createExecutionHarness } from "./execution-test-helpers";

describe("outcome turn routes", () => {
  it("returns the full raw thread snapshot for one outcome", async () => {
    const harness = await createExecutionHarness({
      simulationMode: false
    });

    harness.services.executionService.startRun = async () => undefined;

    try {
      const { app } = harness;
      const repositories = harness.services.repositories;

      const start = await app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft the kickoff brief.",
          source: "web"
        }
      });

      expect(start.statusCode).toBe(201);
      const started = OutcomeTurnResponseSchema.parse(start.json());

      await repositories.runs.updateStatus({
        runId: started.run?.id ?? "",
        status: "completed",
        updatedAt: "2026-03-24T12:15:00.000Z"
      });

      const cont = await app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout milestones.",
          submissionId: "submit_123"
        }
      });

      expect(cont.statusCode).toBe(201);
      const continued = OutcomeTurnResponseSchema.parse(cont.json());

      const [firstStep] = await repositories.runs.listSteps(started.run?.id ?? "");
      const [secondStep] = await repositories.runs.listSteps(continued.run?.id ?? "");

      await repositories.runs.appendEvent({
        id: "evt_ack_started",
        runId: started.run?.id ?? "",
        eventType: "assistant.message.started",
        payload: {
          messageId: "assistant_started",
          runId: started.run?.id ?? "",
          kind: "acknowledgment",
          createdAt: "2026-03-24T12:05:00.000Z"
        },
        createdAt: "2026-03-24T12:05:00.000Z"
      });
      await repositories.runs.appendEvent({
        id: "evt_ack_delta",
        runId: started.run?.id ?? "",
        eventType: "assistant.message.delta",
        payload: {
          messageId: "assistant_started",
          runId: started.run?.id ?? "",
          kind: "acknowledgment",
          delta: "Drafting kickoff brief.",
          content: "Drafting kickoff brief.",
          createdAt: "2026-03-24T12:05:00.000Z",
          updatedAt: "2026-03-24T12:05:10.000Z"
        },
        createdAt: "2026-03-24T12:05:10.000Z"
      });
      await repositories.runs.appendEvent({
        id: "evt_ack_complete",
        runId: started.run?.id ?? "",
        eventType: "assistant.message.completed",
        payload: {
          messageId: "assistant_started",
          runId: started.run?.id ?? "",
          kind: "acknowledgment",
          content: "Drafting kickoff brief.",
          createdAt: "2026-03-24T12:05:00.000Z",
          completedAt: "2026-03-24T12:05:20.000Z"
        },
        createdAt: "2026-03-24T12:05:20.000Z"
      });
      await repositories.runs.appendEvent({
        id: "evt_transition_started",
        runId: continued.run?.id ?? "",
        eventType: "assistant.message.started",
        payload: {
          messageId: "assistant_continued",
          runId: continued.run?.id ?? "",
          kind: "transition",
          createdAt: "2026-03-24T12:20:00.000Z"
        },
        createdAt: "2026-03-24T12:20:00.000Z"
      });
      await repositories.runs.appendEvent({
        id: "evt_transition_delta",
        runId: continued.run?.id ?? "",
        eventType: "assistant.message.delta",
        payload: {
          messageId: "assistant_continued",
          runId: continued.run?.id ?? "",
          kind: "transition",
          delta: "Adding the rollout milestones.",
          content: "Adding the rollout milestones.",
          createdAt: "2026-03-24T12:20:00.000Z",
          updatedAt: "2026-03-24T12:20:08.000Z"
        },
        createdAt: "2026-03-24T12:20:08.000Z"
      });
      await repositories.runs.appendEvent({
        id: "evt_log_started",
        runId: started.run?.id ?? "",
        eventType: "run.log",
        payload: {
          runId: started.run?.id ?? "",
          stepId: firstStep?.id,
          stepTitle: firstStep?.title,
          level: "info",
          message: "Kickoff brief research loaded.",
          createdAt: "2026-03-24T12:06:00.000Z"
        },
        createdAt: "2026-03-24T12:06:00.000Z"
      });
      await repositories.runs.appendEvent({
        id: "evt_log_continued",
        runId: continued.run?.id ?? "",
        eventType: "run.log",
        payload: {
          runId: continued.run?.id ?? "",
          stepId: secondStep?.id,
          stepTitle: secondStep?.title,
          level: "info",
          message: "Milestone timeline drafted.",
          createdAt: "2026-03-24T12:21:00.000Z"
        },
        createdAt: "2026-03-24T12:21:00.000Z"
      });

      const firstArtifact = await repositories.artifacts.create({
        id: "artifact_started",
        outcomeId: started.outcome.id,
        runId: started.run?.id,
        stepId: firstStep?.id,
        kind: "analysis",
        relativePath: "artifacts/kickoff-brief.md",
        size: 256,
        metadata: {
          summary: "Kickoff brief"
        },
        createdAt: "2026-03-24T12:07:00.000Z"
      });
      const secondArtifact = await repositories.artifacts.create({
        id: "artifact_continued",
        outcomeId: started.outcome.id,
        runId: continued.run?.id,
        stepId: secondStep?.id,
        kind: "result",
        relativePath: "artifacts/rollout-milestones.md",
        size: 512,
        metadata: {
          summary: "Rollout milestones"
        },
        createdAt: "2026-03-24T12:22:00.000Z"
      });

      await repositories.approvals.createPending({
        id: "approval_thread",
        workspaceId: started.outcome.workspaceId,
        outcomeId: started.outcome.id,
        runId: continued.run?.id ?? "",
        stepId: secondStep?.id ?? "",
        kind: "output_review_required",
        title: "Review rollout milestones",
        summary: "Check the milestone draft before delivery.",
        instruction: "Approve if the draft is ready to send.",
        artifactIds: [secondArtifact.id],
        requestedAt: "2026-03-24T12:23:00.000Z"
      });

      const other = await app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft the hiring memo.",
          source: "web"
        }
      });
      const otherStarted = OutcomeTurnResponseSchema.parse(other.json());
      const [otherStep] = await repositories.runs.listSteps(otherStarted.run?.id ?? "");
      const otherArtifact = await repositories.artifacts.create({
        id: "artifact_other",
        outcomeId: otherStarted.outcome.id,
        runId: otherStarted.run?.id,
        stepId: otherStep?.id,
        kind: "result",
        relativePath: "artifacts/hiring-memo.md",
        size: 128,
        metadata: {},
        createdAt: "2026-03-24T12:30:00.000Z"
      });
      await repositories.approvals.createPending({
        id: "approval_other",
        workspaceId: otherStarted.outcome.workspaceId,
        outcomeId: otherStarted.outcome.id,
        runId: otherStarted.run?.id ?? "",
        stepId: otherStep?.id ?? "",
        kind: "output_review_required",
        title: "Review hiring memo",
        summary: "Unrelated outcome approval.",
        instruction: "Approve the hiring memo.",
        artifactIds: [otherArtifact.id],
        requestedAt: "2026-03-24T12:31:00.000Z"
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/outcomes/${started.outcome.id}/thread`
      });

      expect(response.statusCode).toBe(200);
      const snapshot = OutcomeThreadSnapshotSchema.parse(response.json());

      expect(snapshot.outcome.id).toBe(started.outcome.id);
      expect(snapshot.messages.map((message) => message.content)).toEqual([
        "Draft the kickoff brief.",
        "Add the rollout milestones."
      ]);
      expect(snapshot.plans.map((plan) => plan.id)).toEqual([
        started.plan?.id,
        continued.plan?.id
      ]);
      expect(snapshot.runs.map((run) => run.id)).toEqual([
        started.run?.id,
        continued.run?.id
      ]);
      expect(snapshot.assistantMessages).toEqual([
        expect.objectContaining({
          id: "assistant_started",
          runId: started.run?.id,
          content: "Drafting kickoff brief.",
          status: "completed"
        }),
        expect.objectContaining({
          id: "assistant_continued",
          runId: continued.run?.id,
          content: "Adding the rollout milestones.",
          status: "streaming"
        })
      ]);
      expect(snapshot.logs.map((log) => log.message)).toEqual([
        "Kickoff brief research loaded.",
        "Milestone timeline drafted."
      ]);
      expect(snapshot.artifacts.map((artifact) => artifact.id)).toEqual([
        firstArtifact.id,
        secondArtifact.id
      ]);
      expect(snapshot.pendingApprovals.map((approval) => approval.id)).toEqual([
        "approval_thread"
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it("starts and continues turns through the shared outcome turn service", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true
    });

    try {
      const { app } = harness;
      const start = await app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft the kickoff brief.",
          source: "web"
        }
      });

      expect(start.statusCode).toBe(201);
      const started = OutcomeTurnResponseSchema.parse(start.json());

      await harness.services.repositories.runs.updateStatus({
        runId: started.run?.id ?? "",
        status: "completed",
        updatedAt: "2026-03-24T12:15:00.000Z"
      });

      expect(started.triggerMessage.content).toBe("Draft the kickoff brief.");
      expect(started.run?.triggerMessageId).toBe(started.triggerMessage.id);

      const cont = await app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout milestones.",
          submissionId: "submit_123"
        }
      });

      expect(cont.statusCode).toBe(201);
      const continued = OutcomeTurnResponseSchema.parse(cont.json());

      expect(continued.outcome.id).toBe(started.outcome.id);
      expect(continued.triggerMessage.content).toBe(
        "Add the rollout milestones."
      );
      expect(continued.triggerMessage.submissionId).toBe("submit_123");
      expect(continued.triggerMessage.id).not.toBe(started.triggerMessage.id);
      expect(continued.plan?.id).not.toBe(started.plan?.id);
      expect(continued.run?.id).not.toBe(started.run?.id);
      expect(continued.run?.triggerMessageId).toBe(continued.triggerMessage.id);

      const replay = await app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout milestones.",
          submissionId: "submit_123"
        }
      });

      expect(replay.statusCode).toBe(201);
      expect(OutcomeTurnResponseSchema.parse(replay.json())).toEqual(continued);

      await expect(
        harness.services.repositories.outcomes.listMessages(started.outcome.id)
      ).resolves.toEqual([
        started.triggerMessage,
        continued.triggerMessage
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it("returns 409 when continuing while the latest run is still active", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true
    });

    try {
      const start = await harness.app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Draft the kickoff brief.",
          source: "web"
        }
      });

      const started = OutcomeTurnResponseSchema.parse(start.json());

      const cont = await harness.app.inject({
        method: "POST",
        url: `/api/outcomes/${started.outcome.id}/continue`,
        payload: {
          content: "Add the rollout milestones.",
          submissionId: "submit_conflict"
        }
      });

      expect(cont.statusCode).toBe(409);
      expect(cont.json()).toEqual({
        error: expect.stringContaining("active run")
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("returns 404 when continuing a missing outcome", async () => {
    const app = createExecutionHarness({ simulationMode: true });
    const harness = await app;

    try {
      const response = await harness.app.inject({
        method: "POST",
        url: "/api/outcomes/outcome_missing/continue",
        payload: {
          content: "Try again",
          submissionId: "submit_missing"
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Outcome outcome_missing not found."
      });
    } finally {
      await harness.cleanup();
    }
  });
});
