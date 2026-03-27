import { describe, expect, it } from "vitest";
import {
  AssistantMessageListResponseSchema,
  ArtifactListResponseSchema,
  OutcomeThreadSnapshotSchema,
  OutcomeTurnResponseSchema,
  PlanSchema,
  RunDetailSchema,
  RunLogListResponseSchema
} from "@computer-oss/protocol";
import { createSimulatedDraftPlan } from "../src/lib/simulated-execution";
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

      const appendTurnMessage = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/messages`,
        payload: {
          role: "user",
          content: "Focus this turn on the latest classroom adoption signals."
        }
      });

      expect(appendTurnMessage.statusCode).toBe(202);

      const readMessages = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}/messages`
      });
      const triggerMessageId = readMessages.json().messages.at(-1)?.id;

      const createPlan = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/plan`
      });

      expect(createPlan.statusCode).toBe(201);
      const plan = PlanSchema.parse(createPlan.json());

      expect(plan.id).toBe(`plan_${outcome.id}_${triggerMessageId}`);
      expect(plan.triggerMessageId).toBe(triggerMessageId);
      expect(plan.nodes[0]?.id).toBe(
        `plan_${outcome.id}_${triggerMessageId}:context-and-preferences`
      );
      expect(plan.edges[0]?.id).toBe(
        `plan_${outcome.id}_${triggerMessageId}:edge-context-tools`
      );
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

      const appendSlackTurnMessage = await app.inject({
        method: "POST",
        url: `/api/outcomes/${slackOutcome.id}/messages`,
        payload: {
          role: "user",
          content: "Use this turn to summarize the Slack thread."
        }
      });

      expect(appendSlackTurnMessage.statusCode).toBe(202);

      const readSlackMessages = await app.inject({
        method: "GET",
        url: `/api/outcomes/${slackOutcome.id}/messages`
      });
      const slackTriggerMessageId = readSlackMessages.json().messages.at(-1)?.id;

      const createSlackPlan = await app.inject({
        method: "POST",
        url: `/api/outcomes/${slackOutcome.id}/plan`
      });

      expect(createSlackPlan.statusCode).toBe(201);
      const slackPlan = PlanSchema.parse(createSlackPlan.json());

      expect(slackPlan.id).toBe(
        `plan_${slackOutcome.id}_${slackTriggerMessageId}`
      );
      expect(slackPlan.triggerMessageId).toBe(slackTriggerMessageId);
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

  it("generates distinct simulated plan ids for different turns on the same outcome", async () => {
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

      const firstMessage = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/messages`,
        payload: {
          role: "user",
          content: "Turn one"
        }
      });

      expect(firstMessage.statusCode).toBe(202);

      const firstMessagesResponse = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}/messages`
      });
      const firstTriggerMessageId = firstMessagesResponse.json().messages.at(-1)?.id;

      const firstPlan = PlanSchema.parse(
        createSimulatedDraftPlan({
          outcomeId: outcome.id,
          triggerMessageId: firstTriggerMessageId,
          prompt: outcome.prompt,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z"
        })
      );

      const secondMessage = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/messages`,
        payload: {
          role: "user",
          content: "Turn two"
        }
      });

      expect(secondMessage.statusCode).toBe(202);

      const secondMessagesResponse = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}/messages`
      });
      const secondTriggerMessageId = secondMessagesResponse.json().messages.at(-1)?.id;

      const secondPlan = PlanSchema.parse(
        createSimulatedDraftPlan({
          outcomeId: outcome.id,
          triggerMessageId: secondTriggerMessageId,
          prompt: outcome.prompt,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z"
        })
      );

      expect(firstPlan.id).not.toBe(secondPlan.id);
      expect(new Set(firstPlan.nodes.map((node) => node.id))).not.toEqual(
        new Set(secondPlan.nodes.map((node) => node.id))
      );
      expect(new Set(firstPlan.edges.map((edge) => edge.id))).not.toEqual(
        new Set(secondPlan.edges.map((edge) => edge.id))
      );
      expect(
        new Set(
          firstPlan.nodes.map((node) => node.expectedArtifactPath).filter(Boolean)
        )
      ).not.toEqual(
        new Set(
          secondPlan.nodes.map((node) => node.expectedArtifactPath).filter(Boolean)
        )
      );
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

      const readAssistantMessages = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/assistant-messages`
      });
      const assistantMessages = AssistantMessageListResponseSchema.parse(
        readAssistantMessages.json()
      ).assistantMessages;

      expect(artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relativePath: expect.stringMatching(
              /artifacts\/.+\/context-and-preferences\.md$/
            )
          }),
          expect.objectContaining({
            relativePath: expect.stringMatching(
              /artifacts\/.+\/ai-k12-education-report\.pdf$/
            ),
            metadata: expect.objectContaining({
              title: "The State of AI in K-12 Education",
              pageCount: 16
            })
          })
        ])
      );
      expect(artifacts).toHaveLength(6);
      expect(assistantMessages).toEqual([
        expect.objectContaining({
          kind: "acknowledgment",
          status: "completed"
        }),
        expect.objectContaining({
          kind: "transition",
          status: "completed"
        }),
        expect.objectContaining({
          kind: "transition",
          status: "completed"
        }),
        expect.objectContaining({
          kind: "delivery",
          status: "completed",
          content: expect.stringContaining("Here's your report")
        })
      ]);

      const presentationHintEvents = events.filter(
        (event) => event.type === "presentation.hint"
      );

      expect(presentationHintEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              outcomeId: outcome.id,
              entityType: "assistant-message"
            })
          }),
          expect.objectContaining({
            data: expect.objectContaining({
              outcomeId: outcome.id,
              entityType: "step"
            })
          }),
          expect.objectContaining({
            data: expect.objectContaining({
              outcomeId: outcome.id,
              entityType: "artifact"
            })
          }),
          expect.objectContaining({
            data: expect.objectContaining({
              outcomeId: outcome.id,
              entityType: "approval"
            })
          })
        ])
      );

      const readThread = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}/thread`
      });
      const threadSnapshot = OutcomeThreadSnapshotSchema.parse(readThread.json());
      const liveHintIds = presentationHintEvents.map((event) =>
        typeof event.data === "object" &&
        event.data !== null &&
        "id" in event.data
          ? String(event.data.id)
          : null
      );

      expect(threadSnapshot.presentationHints.map((hint) => hint.id)).toEqual(
        expect.arrayContaining(liveHintIds.filter((hintId): hintId is string => Boolean(hintId)))
      );

      const firstAssistantHint = presentationHintEvents.find(
        (event) =>
          typeof event.data === "object" &&
          event.data !== null &&
          "entityType" in event.data &&
          event.data.entityType === "assistant-message"
      );
      const firstStepHint = presentationHintEvents.find(
        (event) =>
          typeof event.data === "object" &&
          event.data !== null &&
          "entityType" in event.data &&
          event.data.entityType === "step"
      );
      const firstArtifactHint = presentationHintEvents.find(
        (event) =>
          typeof event.data === "object" &&
          event.data !== null &&
          "entityType" in event.data &&
          event.data.entityType === "artifact"
      );
      const firstApprovalHint = presentationHintEvents.find(
        (event) =>
          typeof event.data === "object" &&
          event.data !== null &&
          "entityType" in event.data &&
          event.data.entityType === "approval"
      );

      expect(firstAssistantHint).toBeDefined();
      expect(firstStepHint).toBeDefined();
      expect(firstArtifactHint).toBeDefined();
      expect(firstApprovalHint).toBeDefined();

      const assistantHintEntityId =
        firstAssistantHint &&
        typeof firstAssistantHint.data === "object" &&
        firstAssistantHint.data !== null &&
        "entityId" in firstAssistantHint.data
          ? String(firstAssistantHint.data.entityId)
          : "";
      const stepHintEntityId =
        firstStepHint &&
        typeof firstStepHint.data === "object" &&
        firstStepHint.data !== null &&
        "entityId" in firstStepHint.data
          ? String(firstStepHint.data.entityId)
          : "";
      const artifactHintEntityId =
        firstArtifactHint &&
        typeof firstArtifactHint.data === "object" &&
        firstArtifactHint.data !== null &&
        "entityId" in firstArtifactHint.data
          ? String(firstArtifactHint.data.entityId)
          : "";
      const approvalHintEntityId =
        firstApprovalHint &&
        typeof firstApprovalHint.data === "object" &&
        firstApprovalHint.data !== null &&
        "entityId" in firstApprovalHint.data
          ? String(firstApprovalHint.data.entityId)
          : "";

      const assistantHintIndex = events.findIndex(
        (event) =>
          event.type === "presentation.hint" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "entityId" in event.data &&
          event.data.entityId === assistantHintEntityId
      );
      const assistantStartedIndex = events.findIndex(
        (event) =>
          event.type === "assistant.message.started" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "messageId" in event.data &&
          event.data.messageId === assistantHintEntityId
      );
      const stepHintIndex = events.findIndex(
        (event) =>
          event.type === "presentation.hint" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "entityId" in event.data &&
          event.data.entityId === stepHintEntityId
      );
      const stepStartedIndex = events.findIndex(
        (event) =>
          event.type === "run.step.updated" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "id" in event.data &&
          event.data.id === stepHintEntityId &&
          "status" in event.data &&
          event.data.status === "running"
      );
      const artifactHintIndex = events.findIndex(
        (event) =>
          event.type === "presentation.hint" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "entityId" in event.data &&
          event.data.entityId === artifactHintEntityId
      );
      const artifactCreatedIndex = events.findIndex(
        (event) =>
          event.type === "artifact.created" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "id" in event.data &&
          event.data.id === artifactHintEntityId
      );
      const approvalHintIndex = events.findIndex(
        (event) =>
          event.type === "presentation.hint" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "entityId" in event.data &&
          event.data.entityId === approvalHintEntityId
      );
      const approvalRequestedIndex = events.findIndex(
        (event) =>
          event.type === "approval.requested" &&
          typeof event.data === "object" &&
          event.data !== null &&
          "id" in event.data &&
          event.data.id === approvalHintEntityId
      );

      expect(assistantHintIndex).toBeGreaterThanOrEqual(0);
      expect(stepHintIndex).toBeGreaterThanOrEqual(0);
      expect(artifactHintIndex).toBeGreaterThanOrEqual(0);
      expect(approvalHintIndex).toBeGreaterThanOrEqual(0);
      expect(assistantHintIndex).toBeLessThan(assistantStartedIndex);
      expect(stepHintIndex).toBeLessThan(stepStartedIndex);
      expect(artifactHintIndex).toBeLessThan(artifactCreatedIndex);
      expect(approvalHintIndex).toBeLessThan(approvalRequestedIndex);

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
            /artifacts\/.+\/ai-k12-education-report\.pdf$/.test(
              String(event.data.relativePath)
            )
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
          /artifacts\/.+\/ai-k12-education-report\.pdf$/.test(
            String(event.data.relativePath)
          )
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

  it("produces a fresh simulated narrative for each follow-up turn on the same outcome", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true,
      simulationTimeline: FAST_SIMULATION_TIMELINE
    });

    try {
      const { app, services } = harness;
      const startOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_simulation",
          userId: "user_simulation",
          prompt: "Draft a district AI adoption report with rollout guidance.",
          source: "web"
        }
      });

      expect(startOutcome.statusCode).toBe(201);
      const firstTurn = OutcomeTurnResponseSchema.parse(startOutcome.json());
      await services.simulatedExecutionService.waitForRun(firstTurn.run?.id ?? "");

      const continueOutcome = await app.inject({
        method: "POST",
        url: `/api/outcomes/${firstTurn.outcome.id}/continue`,
        payload: {
          content:
            "Make it shorter for school principals and focus on implementation risks.",
          submissionId: "submit_second_turn"
        }
      });

      expect(continueOutcome.statusCode).toBe(201);
      const secondTurn = OutcomeTurnResponseSchema.parse(continueOutcome.json());
      await services.simulatedExecutionService.waitForRun(secondTurn.run?.id ?? "");

      expect(secondTurn.outcome.id).toBe(firstTurn.outcome.id);
      expect(secondTurn.triggerMessage.id).not.toBe(firstTurn.triggerMessage.id);
      expect(secondTurn.plan?.id).not.toBe(firstTurn.plan?.id);
      expect(secondTurn.run?.id).not.toBe(firstTurn.run?.id);

      const [firstRunMessagesResponse, secondRunMessagesResponse] = await Promise.all([
        app.inject({
          method: "GET",
          url: `/api/runs/${firstTurn.run?.id}/assistant-messages`
        }),
        app.inject({
          method: "GET",
          url: `/api/runs/${secondTurn.run?.id}/assistant-messages`
        })
      ]);

      const firstRunMessages = AssistantMessageListResponseSchema.parse(
        firstRunMessagesResponse.json()
      ).assistantMessages;
      const secondRunMessages = AssistantMessageListResponseSchema.parse(
        secondRunMessagesResponse.json()
      ).assistantMessages;

      expect(firstRunMessages[0]?.content).toContain(
        "district AI adoption report with rollout guidance"
      );
      expect(secondRunMessages[0]?.content).toContain("school principals");
      expect(
        firstRunMessages.find((message) => message.kind === "delivery")?.content
      ).toContain("district AI adoption report with rollout guidance");
      expect(
        secondRunMessages.find((message) => message.kind === "delivery")?.content
      ).toContain("implementation risks");
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps multiple simulated turns in one continuous thread with distinct delivered artifacts", async () => {
    const harness = await createExecutionHarness({
      simulationMode: true,
      simulationTimeline: FAST_SIMULATION_TIMELINE
    });

    try {
      const { app, services } = harness;
      const startOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes/start",
        payload: {
          workspaceId: "ws_simulation",
          userId: "user_simulation",
          prompt: "Draft a district AI adoption report with rollout guidance.",
          source: "web"
        }
      });

      expect(startOutcome.statusCode).toBe(201);
      const firstTurn = OutcomeTurnResponseSchema.parse(startOutcome.json());
      await services.simulatedExecutionService.waitForRun(firstTurn.run?.id ?? "");

      const secondTurnResponse = await app.inject({
        method: "POST",
        url: `/api/outcomes/${firstTurn.outcome.id}/continue`,
        payload: {
          content:
            "Make it shorter for school principals and focus on implementation risks.",
          submissionId: "submit_second_turn"
        }
      });

      expect(secondTurnResponse.statusCode).toBe(201);
      const secondTurn = OutcomeTurnResponseSchema.parse(secondTurnResponse.json());
      await services.simulatedExecutionService.waitForRun(secondTurn.run?.id ?? "");

      const thirdTurnResponse = await app.inject({
        method: "POST",
        url: `/api/outcomes/${firstTurn.outcome.id}/continue`,
        payload: {
          content: "Turn the same work into a board-ready briefing with headline bullets.",
          submissionId: "submit_third_turn"
        }
      });

      expect(thirdTurnResponse.statusCode).toBe(201);
      const thirdTurn = OutcomeTurnResponseSchema.parse(thirdTurnResponse.json());
      await services.simulatedExecutionService.waitForRun(thirdTurn.run?.id ?? "");

      const readThread = await app.inject({
        method: "GET",
        url: `/api/outcomes/${firstTurn.outcome.id}/thread`
      });

      expect(readThread.statusCode).toBe(200);
      const thread = OutcomeThreadSnapshotSchema.parse(readThread.json());

      expect(thread.messages.map((message) => message.content)).toEqual([
        "Draft a district AI adoption report with rollout guidance.",
        "Make it shorter for school principals and focus on implementation risks.",
        "Turn the same work into a board-ready briefing with headline bullets."
      ]);

      expect(thread.runs.map((run) => run.id)).toEqual([
        firstTurn.run?.id,
        secondTurn.run?.id,
        thirdTurn.run?.id
      ]);
      expect(thread.plans.map((plan) => plan.id)).toEqual([
        firstTurn.plan?.id,
        secondTurn.plan?.id,
        thirdTurn.plan?.id
      ]);

      const assistantMessagesByRun = new Map<string, string[]>();
      const deliveryByRun = new Map<string, string>();

      for (const message of thread.assistantMessages) {
        const current = assistantMessagesByRun.get(message.runId) ?? [];
        current.push(message.kind);
        assistantMessagesByRun.set(message.runId, current);

        if (message.kind === "delivery") {
          deliveryByRun.set(message.runId, message.content);
        }
      }

      expect(assistantMessagesByRun.get(firstTurn.run?.id ?? "")).toEqual([
        "acknowledgment",
        "transition",
        "transition",
        "delivery"
      ]);
      expect(assistantMessagesByRun.get(secondTurn.run?.id ?? "")).toEqual([
        "acknowledgment",
        "transition",
        "transition",
        "delivery"
      ]);
      expect(assistantMessagesByRun.get(thirdTurn.run?.id ?? "")).toEqual([
        "acknowledgment",
        "transition",
        "transition",
        "delivery"
      ]);
      expect(deliveryByRun.get(firstTurn.run?.id ?? "")).toContain(
        "district AI adoption report with rollout guidance"
      );
      expect(deliveryByRun.get(secondTurn.run?.id ?? "")).toContain(
        "implementation risks"
      );
      expect(deliveryByRun.get(thirdTurn.run?.id ?? "")).toContain(
        "board-ready briefing"
      );

      const deliveredArtifacts = thread.artifacts.filter(
        (artifact) => artifact.kind === "result"
      );

      expect(deliveredArtifacts).toHaveLength(3);
      expect(new Set(deliveredArtifacts.map((artifact) => artifact.relativePath)).size).toBe(3);
      expect(deliveredArtifacts.map((artifact) => artifact.runId)).toEqual([
        firstTurn.run?.id,
        secondTurn.run?.id,
        thirdTurn.run?.id
      ]);
    } finally {
      await harness.cleanup();
    }
  });
});
