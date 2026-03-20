import { describe, expect, it } from "vitest";
import {
  ArtifactListResponseSchema,
  PlanSchema,
  RunDetailSchema,
  RunLogListResponseSchema
} from "@computer-oss/protocol";
import { createExecutionHarness } from "./execution-test-helpers";

const FAST_SIMULATION_TIMELINE = {
  kickoffMs: 1,
  markRunningMs: 1,
  memoryCompleteMs: 2,
  landscapeCompleteMs: 4,
  evidenceCompleteMs: 6,
  policyCompleteMs: 8,
  synthesisCompleteMs: 4
};

describe("development simulation mode", () => {
  it("creates the richer five-step simulated plan only for web outcomes", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true,
      simulationTimeline: FAST_SIMULATION_TIMELINE
    });

    try {
      const { app } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_simulation",
          userId: "user_simulation",
          prompt: "Produce a polished research briefing.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();

      const createPlan = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/plan`
      });

      expect(createPlan.statusCode).toBe(201);
      const plan = PlanSchema.parse(createPlan.json());

      expect(plan.nodes.map((node) => node.title)).toEqual([
        "Check memory and working context",
        "Research the current landscape",
        "Review evidence and effectiveness",
        "Map challenges and policy response",
        "Compile the final report"
      ]);
      expect(plan.edges).toHaveLength(6);

      const createSlackOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_simulation",
          userId: "user_simulation",
          prompt: "Summarize the Slack thread.",
          source: "slack"
        }
      });
      const slackOutcome = createSlackOutcome.json();

      const createSlackPlan = await app.inject({
        method: "POST",
        url: `/api/outcomes/${slackOutcome.id}/plan`
      });

      expect(createSlackPlan.statusCode).toBe(201);
      const slackPlan = PlanSchema.parse(createSlackPlan.json());

      expect(slackPlan.nodes.map((node) => node.title)).toEqual([
        "Analyze outcome",
        "Draft brief",
        "Draft operator summary",
        "Synthesize result"
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it("simulates a full persisted run with fake routes, streamed logs, and delivered artifacts", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true,
      simulationTimeline: FAST_SIMULATION_TIMELINE
    });

    try {
      const { app, services, events } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_simulation",
          userId: "user_simulation",
          prompt: "Research the topic and deliver a polished report.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();

      const createPlan = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/plan`
      });
      const plan = PlanSchema.parse(createPlan.json());

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      expect(createRun.statusCode).toBe(201);
      const run = RunDetailSchema.parse(createRun.json());

      expect(run.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Check memory and working context",
            routeProviderId: "openai",
            routeModelId: "gpt-5.4",
            routeAuthProfileId: "simulated_openai_primary",
            status: "ready"
          }),
          expect.objectContaining({
            title: "Research the current landscape",
            routeProviderId: "openrouter",
            routeModelId: "openrouter/claude-sonnet-4.5",
            routeAuthProfileId: "simulated_openrouter_primary",
            status: "pending"
          }),
          expect.objectContaining({
            title: "Compile the final report",
            routeProviderId: "anthropic",
            routeModelId: "claude-opus-4.6",
            routeAuthProfileId: "simulated_anthropic_primary",
            status: "pending"
          })
        ])
      );

      await services.simulatedExecutionService.waitForRun(run.id);

      const readRun = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}`
      });
      const completedRun = RunDetailSchema.parse(readRun.json());

      expect(completedRun.status).toBe("completed");
      expect(completedRun.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Check memory and working context",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Research the current landscape",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Review evidence and effectiveness",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Map challenges and policy response",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Compile the final report",
            status: "completed"
          })
        ])
      );

      const readLogs = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/logs`
      });
      const logs = RunLogListResponseSchema.parse(readLogs.json()).logs;

      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("parallel research tracks")
          }),
          expect.objectContaining({
            message: expect.stringContaining("final deliverable")
          })
        ])
      );

      const readArtifacts = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/artifacts`
      });
      const artifacts = ArtifactListResponseSchema.parse(readArtifacts.json()).artifacts;

      expect(artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relativePath: "artifacts/context-check.md"
          }),
          expect.objectContaining({
            relativePath: "artifacts/final-report.pdf",
            metadata: expect.objectContaining({
              title: "Final report",
              pageCount: 16
            })
          })
        ])
      );
      expect(artifacts).toHaveLength(5);

      expect(events.some((event) => event.type === "run.updated")).toBe(true);
      expect(
        events.some(
          (event) =>
            event.type === "artifact.created" &&
            typeof event.data === "object" &&
            event.data !== null &&
            "relativePath" in event.data &&
            event.data.relativePath === "artifacts/final-report.pdf"
        )
      ).toBe(true);
    } finally {
      await harness.cleanup();
    }
  });
});
