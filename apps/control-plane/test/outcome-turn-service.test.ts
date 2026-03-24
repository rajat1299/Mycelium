import { describe, expect, it, vi } from "vitest";
import { OutcomeTurnResponseSchema } from "@computer-oss/protocol";
import { createEventBus } from "../src/lib/event-bus";
import {
  createInMemoryRepositories,
  type Repositories
} from "../src/lib/repositories";
import { createRouterService } from "../src/lib/router-service";
import {
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

    harness.events.length = 0;

    const secondTurn = OutcomeTurnResponseSchema.parse(
      await harness.service.continueThread({
        outcomeId: firstTurn.outcome.id,
        content: "Incorporate the customer feedback."
      })
    );

    expect(secondTurn.outcome.id).toBe(firstTurn.outcome.id);
    expect(secondTurn.triggerMessage).toEqual(
      expect.objectContaining({
        outcomeId: firstTurn.outcome.id,
        role: "user",
        content: "Incorporate the customer feedback."
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
});
