import { describe, expect, it, vi } from "vitest";
import { OutcomeTurnResponseSchema } from "@computer-oss/protocol";
import { createEventBus } from "../src/lib/event-bus";
import {
  createInMemoryRepositories,
  type Repositories
} from "../src/lib/repositories";
import { createRouterService } from "../src/lib/router-service";
import {
  OutcomeTurnConflictError,
  createOutcomeTurnService,
  type OutcomeTurnService
} from "../src/lib/outcome-turn-service";

function createTurnServiceHarness(options: { simulationMode?: boolean } = {}) {
  const repositories = createInMemoryRepositories();
  const eventBus = createEventBus();
  const executionService = {
    startRun: vi.fn()
  };
  const simulatedExecutionService = {
    startRun: vi.fn()
  };
  const routerService = createRouterService({ repositories });
  const events: Array<{ outcomeId: string; type: string; data: unknown }> = [];
  const startedAt = Date.parse("2026-03-24T12:00:00.000Z");
  let tick = 0;

  eventBus.subscribeAll((event) => {
    events.push(event);
  });

  const service = createOutcomeTurnService({
    repositories,
    eventBus,
    executionService,
    simulatedExecutionService,
    routerService,
    simulationMode: options.simulationMode ?? false,
    now: () => new Date(startedAt + tick++ * 1000)
  });

  return {
    repositories,
    events,
    executionService,
    simulatedExecutionService,
    service
  };
}

function expectedInitialEventTypes(stepCount: number) {
  return [
    "message.created",
    "plan.created",
    "outcome.updated",
    "run.created",
    ...Array.from({ length: stepCount }, () => "run.step.updated")
  ];
}

describe("OutcomeTurnService", () => {
  it("starts a thread by creating an outcome, trigger message, turn plan, and run in transcript-safe order", async () => {
    const harness = createTurnServiceHarness({ simulationMode: true });

    const response = OutcomeTurnResponseSchema.parse(
      await harness.service.startThread({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft the customer follow-up response.",
        source: "web"
      })
    );

    expect(response.outcome.status).toBe("queued");
    expect(response.triggerMessage).toEqual(
      expect.objectContaining({
        outcomeId: response.outcome.id,
        role: "user",
        content: "Draft the customer follow-up response."
      })
    );
    expect(response.plan).toEqual(
      expect.objectContaining({
        outcomeId: response.outcome.id,
        triggerMessageId: response.triggerMessage.id
      })
    );
    expect(response.run).toEqual(
      expect.objectContaining({
        outcomeId: response.outcome.id,
        planId: response.plan?.id,
        triggerMessageId: response.triggerMessage.id,
        status: "queued"
      })
    );

    await expect(
      harness.repositories.outcomes.listMessages(response.outcome.id)
    ).resolves.toEqual([response.triggerMessage]);

    expect(harness.events.map((event) => event.type)).toEqual(
      expectedInitialEventTypes(response.run?.steps.length ?? 0)
    );
    expect(harness.events[0]?.data).toEqual(
      expect.objectContaining({
        id: response.triggerMessage.id,
        content: "Draft the customer follow-up response."
      })
    );
    expect(harness.events[1]?.data).toEqual(
      expect.objectContaining({
        id: response.plan?.id,
        triggerMessageId: response.triggerMessage.id
      })
    );
    expect(harness.events[2]?.data).toEqual(
      expect.objectContaining({
        id: response.outcome.id,
        status: "queued"
      })
    );
    expect(harness.events[3]?.data).toEqual(
      expect.objectContaining({
        id: response.run?.id,
        triggerMessageId: response.triggerMessage.id
      })
    );
    expect(harness.simulatedExecutionService.startRun).toHaveBeenCalledWith(
      response.run?.id
    );
    expect(harness.executionService.startRun).not.toHaveBeenCalled();
  });

  it("rolls back a failed start thread without publishing partial turn records", async () => {
    const harness = createTurnServiceHarness({ simulationMode: true });
    let createdOutcomeId = "";

    const originalCreateOutcome = harness.repositories.outcomes.create.bind(
      harness.repositories.outcomes
    );
    vi.spyOn(harness.repositories.outcomes, "create").mockImplementation(
      async (input) => {
        const outcome = await originalCreateOutcome(input);
        createdOutcomeId = outcome.id;
        return outcome;
      }
    );

    const originalListSteps = harness.repositories.runs.listSteps.bind(
      harness.repositories.runs
    );
    let listStepsCalls = 0;
    vi.spyOn(harness.repositories.runs, "listSteps").mockImplementation(
      async (runId) => {
        listStepsCalls += 1;

        if (listStepsCalls === 2) {
          throw new Error("simulated run detail failure");
        }

        return originalListSteps(runId);
      }
    );

    await expect(
      harness.service.startThread({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Draft the customer follow-up response.",
        source: "web"
      })
    ).rejects.toThrow("simulated run detail failure");

    expect(createdOutcomeId).toBeTruthy();
    expect(harness.events).toEqual([]);
    await expect(
      harness.repositories.outcomes.listByWorkspace("ws_123")
    ).resolves.toEqual([]);
    await expect(
      harness.repositories.outcomes.listMessages(createdOutcomeId)
    ).resolves.toEqual([]);
    await expect(
      harness.repositories.plans.listByOutcome(createdOutcomeId)
    ).resolves.toEqual([]);
    await expect(
      harness.repositories.runs.listByOutcome(createdOutcomeId)
    ).resolves.toEqual([]);
  });

  it("continues an existing thread with a new trigger message, plan snapshot, and run while keeping prior turns intact", async () => {
    const harness = createTurnServiceHarness();

    const firstTurn = OutcomeTurnResponseSchema.parse(
      await harness.service.startThread({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Prepare the first draft.",
        source: "web"
      })
    );

    await harness.repositories.runs.updateStatus({
      runId: firstTurn.run?.id ?? "",
      status: "completed",
      updatedAt: "2026-03-24T12:15:00.000Z"
    });

    harness.events.length = 0;

    const secondTurn = OutcomeTurnResponseSchema.parse(
      await harness.service.continueThread({
        outcomeId: firstTurn.outcome.id,
        content: "Incorporate the customer feedback.",
        submissionId: "submit_123"
      })
    );

    expect(secondTurn.outcome.id).toBe(firstTurn.outcome.id);
    expect(secondTurn.triggerMessage).toEqual(
      expect.objectContaining({
        outcomeId: firstTurn.outcome.id,
        role: "user",
        content: "Incorporate the customer feedback.",
        submissionId: "submit_123"
      })
    );
    expect(secondTurn.plan).toEqual(
      expect.objectContaining({
        outcomeId: firstTurn.outcome.id,
        triggerMessageId: secondTurn.triggerMessage.id
      })
    );
    expect(secondTurn.run).toEqual(
      expect.objectContaining({
        outcomeId: firstTurn.outcome.id,
        planId: secondTurn.plan?.id,
        triggerMessageId: secondTurn.triggerMessage.id
      })
    );

    await expect(
      harness.repositories.outcomes.listMessages(firstTurn.outcome.id)
    ).resolves.toEqual([
      firstTurn.triggerMessage,
      secondTurn.triggerMessage
    ]);

    expect(secondTurn.triggerMessage.submissionId).toBe("submit_123");

    await expect(
      harness.repositories.plans.listByOutcome(firstTurn.outcome.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: firstTurn.plan?.id,
        triggerMessageId: firstTurn.triggerMessage.id
      }),
      expect.objectContaining({
        id: secondTurn.plan?.id,
        triggerMessageId: secondTurn.triggerMessage.id
      })
    ]);

    await expect(
      harness.repositories.plans.getById(firstTurn.plan?.id ?? "")
    ).resolves.toEqual(
      expect.objectContaining({
        id: firstTurn.plan?.id,
        triggerMessageId: firstTurn.triggerMessage.id
      })
    );
    await expect(
      harness.repositories.plans.getByOutcome(firstTurn.outcome.id)
    ).resolves.toEqual(
      expect.objectContaining({
        id: secondTurn.plan?.id,
        triggerMessageId: secondTurn.triggerMessage.id
      })
    );

    expect(harness.events.map((event) => event.type)).toEqual(
      expectedInitialEventTypes(secondTurn.run?.steps.length ?? 0)
    );
    expect(harness.events[0]?.data).toEqual(
      expect.objectContaining({
        id: secondTurn.triggerMessage.id,
        submissionId: "submit_123"
      })
    );
    expect(harness.executionService.startRun).toHaveBeenNthCalledWith(
      1,
      firstTurn.run?.id
    );
    expect(harness.executionService.startRun).toHaveBeenNthCalledWith(
      2,
      secondTurn.run?.id
    );
    expect(harness.simulatedExecutionService.startRun).not.toHaveBeenCalled();
  });

  it("rejects a follow-up turn while the latest run is still active", async () => {
    const harness = createTurnServiceHarness();

    const firstTurn = OutcomeTurnResponseSchema.parse(
      await harness.service.startThread({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Prepare the first draft.",
        source: "web"
      })
    );

    await expect(
      harness.service.continueThread({
        outcomeId: firstTurn.outcome.id,
        content: "Incorporate the customer feedback.",
        submissionId: "submit_conflict"
      })
    ).rejects.toBeInstanceOf(OutcomeTurnConflictError);

    await expect(
      harness.repositories.outcomes.listMessages(firstTurn.outcome.id)
    ).resolves.toEqual([firstTurn.triggerMessage]);
    await expect(
      harness.repositories.plans.listByOutcome(firstTurn.outcome.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: firstTurn.plan?.id,
        triggerMessageId: firstTurn.triggerMessage.id
      })
    ]);
    await expect(
      harness.repositories.runs.listByOutcome(firstTurn.outcome.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: firstTurn.run?.id,
        triggerMessageId: firstTurn.triggerMessage.id
      })
    ]);
  });

  it("rolls back a failed follow-up turn without publishing partial turn records", async () => {
    const harness = createTurnServiceHarness();

    const firstTurn = OutcomeTurnResponseSchema.parse(
      await harness.service.startThread({
        workspaceId: "ws_123",
        userId: "user_123",
        prompt: "Prepare the first draft.",
        source: "web"
      })
    );

    await harness.repositories.runs.updateStatus({
      runId: firstTurn.run?.id ?? "",
      status: "completed",
      updatedAt: "2026-03-24T12:15:00.000Z"
    });

    harness.events.length = 0;

    const originalListSteps = harness.repositories.runs.listSteps.bind(
      harness.repositories.runs
    );
    let listStepsCalls = 0;
    vi.spyOn(harness.repositories.runs, "listSteps").mockImplementation(
      async (runId) => {
        listStepsCalls += 1;

        if (listStepsCalls === 2) {
          throw new Error("simulated follow-up failure");
        }

        return originalListSteps(runId);
      }
    );

    await expect(
      harness.service.continueThread({
        outcomeId: firstTurn.outcome.id,
        content: "Incorporate the customer feedback.",
        submissionId: "submit_failure"
      })
    ).rejects.toThrow("simulated follow-up failure");

    expect(harness.events).toEqual([]);
    await expect(
      harness.repositories.outcomes.listMessages(firstTurn.outcome.id)
    ).resolves.toEqual([firstTurn.triggerMessage]);
    await expect(
      harness.repositories.plans.listByOutcome(firstTurn.outcome.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: firstTurn.plan?.id,
        triggerMessageId: firstTurn.triggerMessage.id
      })
    ]);
    await expect(
      harness.repositories.runs.listByOutcome(firstTurn.outcome.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: firstTurn.run?.id,
        triggerMessageId: firstTurn.triggerMessage.id
      })
    ]);
  });
});
