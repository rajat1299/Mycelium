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
  contextCompleteMs: 2,
  toolsCompleteMs: 4,
  effectivenessCompleteMs: 6,
  concernsCompleteMs: 8,
  trendsCompleteMs: 10,
  synthesisCompleteMs: 4,
  streamChunkMs: 1
};

describe("development simulation mode", () => {
  it("creates the richer six-step mock narrative plan only for web outcomes", async () => {
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
        "Load context and working preferences",
        "Research AI tools used in K-12 classrooms",
        "Research effectiveness studies and learning outcomes",
        "Research concerns, challenges, and policy responses",
        "Research emerging trends and future outlook",
        "Compile the polished PDF report"
      ]);
      expect(plan.edges).toHaveLength(8);

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

  it("simulates a full persisted run with streamed assistant narrative and delivered artifacts", async () => {
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
            title: "Load context and working preferences",
            routeProviderId: "openai",
            routeModelId: "gpt-5.4",
            routeAuthProfileId: "simulated_openai_primary",
            status: "ready"
          }),
          expect.objectContaining({
            title: "Research AI tools used in K-12 classrooms",
            routeProviderId: "openrouter",
            routeModelId: "openrouter/claude-sonnet-4.5",
            routeAuthProfileId: "simulated_openrouter_primary",
            status: "pending"
          }),
          expect.objectContaining({
            title: "Compile the polished PDF report",
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
            title: "Load context and working preferences",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Research AI tools used in K-12 classrooms",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Research effectiveness studies and learning outcomes",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Research concerns, challenges, and policy responses",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Research emerging trends and future outlook",
            status: "completed"
          }),
          expect.objectContaining({
            title: "Compile the polished PDF report",
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
            message: expect.stringContaining("parallel research across all four topic areas")
          }),
          expect.objectContaining({
            message: expect.stringContaining("building the PDF report")
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
            relativePath: "artifacts/context-and-preferences.md"
          }),
          expect.objectContaining({
            relativePath: "artifacts/ai-k12-education-report.pdf",
            metadata: expect.objectContaining({
              title: "The State of AI in K-12 Education",
              pageCount: 16
            })
          })
        ])
      );
      expect(artifacts).toHaveLength(6);

      expect(events.some((event) => event.type === "run.updated")).toBe(true);
      expect(events.some((event) => event.type === "assistant.message.started")).toBe(true);
      expect(events.some((event) => event.type === "assistant.message.delta")).toBe(true);
      expect(events.some((event) => event.type === "assistant.message.completed")).toBe(true);
      expect(
        events.some(
          (event) =>
            event.type === "artifact.created" &&
            typeof event.data === "object" &&
            event.data !== null &&
            "relativePath" in event.data &&
            event.data.relativePath === "artifacts/ai-k12-education-report.pdf"
        )
      ).toBe(true);

      const completedAssistantMessages = events.filter(
        (event) => event.type === "assistant.message.completed"
      );
      expect(completedAssistantMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              kind: "acknowledgment",
              content: expect.stringContaining("loading relevant skills")
            })
          }),
          expect.objectContaining({
            data: expect.objectContaining({
              kind: "delivery",
              content: expect.stringContaining("Here's your report")
            })
          })
        ])
      );

      const finalArtifactIndex = events.findIndex(
        (event) =>
          event.type === "artifact.created" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "relativePath" in event.data &&
          event.data.relativePath === "artifacts/ai-k12-education-report.pdf"
      );
      const finalDeliveryIndex = events.findIndex(
        (event) =>
          event.type === "assistant.message.completed" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "kind" in event.data &&
          event.data.kind === "delivery"
      );
      const openingAcknowledgmentIndex = events.findIndex(
        (event) =>
          event.type === "assistant.message.completed" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "kind" in event.data &&
          event.data.kind === "acknowledgment"
      );

      expect(openingAcknowledgmentIndex).toBeGreaterThanOrEqual(0);
      expect(finalArtifactIndex).toBeGreaterThanOrEqual(0);
      expect(finalDeliveryIndex).toBeGreaterThan(finalArtifactIndex);
      expect(finalDeliveryIndex).toBeGreaterThan(openingAcknowledgmentIndex);
    } finally {
      await harness.cleanup();
    }
  });
});
