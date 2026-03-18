import { afterEach, describe, expect, it } from "vitest";
import {
  RunDetailSchema,
  ScheduleFireListResponseSchema,
  ScheduleListResponseSchema,
  ScheduleSchema
} from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createInMemoryServiceContainer } from "../src/lib/service-container";
import { createFakeSandboxProvider } from "./execution-test-helpers";

const appsToClose = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    Array.from(appsToClose).map(async (app) => {
      appsToClose.delete(app);
      await app.close();
    })
  );
});

function buildSchedulePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Morning workspace brief",
    prompt: "Create the daily workspace briefing.",
    status: "active",
    trigger: {
      kind: "every",
      everyMs: 60_000,
      anchorAt: "2026-03-18T14:00:00.000Z",
      timezone: "America/Chicago"
    },
    outcomeMode: "create_outcome",
    dispatchMode: "outcome_only",
    ...overrides
  };
}

describe("schedule routes and runtime", () => {
  it("supports schedule CRUD and fire-history reads", async () => {
    const services = createInMemoryServiceContainer({
      now: () => new Date("2026-03-18T14:00:00.000Z")
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    const create = await app.inject({
      method: "POST",
      url: "/api/workspaces/ws_123/schedules",
      payload: buildSchedulePayload()
    });

    expect(create.statusCode).toBe(201);
    const created = ScheduleSchema.parse(create.json());

    expect(created).toEqual(
      expect.objectContaining({
        workspaceId: "ws_123",
        title: "Morning workspace brief",
        nextFireAt: "2026-03-18T14:00:00.000Z"
      })
    );

    const list = await app.inject({
      method: "GET",
      url: "/api/workspaces/ws_123/schedules"
    });

    expect(list.statusCode).toBe(200);
    expect(ScheduleListResponseSchema.parse(list.json())).toEqual({
      schedules: [expect.objectContaining({ id: created.id, status: "active" })]
    });

    const update = await app.inject({
      method: "PATCH",
      url: `/api/schedules/${created.id}`,
      payload: {
        status: "paused"
      }
    });

    expect(update.statusCode).toBe(200);
    expect(ScheduleSchema.parse(update.json())).toEqual(
      expect.objectContaining({
        id: created.id,
        status: "paused"
      })
    );

    const fires = await app.inject({
      method: "GET",
      url: `/api/schedules/${created.id}/fires`
    });

    expect(fires.statusCode).toBe(200);
    expect(ScheduleFireListResponseSchema.parse(fires.json())).toEqual({
      fires: []
    });

    const remove = await app.inject({
      method: "DELETE",
      url: `/api/schedules/${created.id}`
    });

    expect(remove.statusCode).toBe(204);

    const readMissing = await app.inject({
      method: "GET",
      url: `/api/schedules/${created.id}`
    });

    expect(readMissing.statusCode).toBe(404);
  });

  it("polls due schedules idempotently and can continue an existing schedule outcome into plan and run creation", async () => {
    const fakeSandbox = createFakeSandboxProvider();
    const services = createInMemoryServiceContainer({
      sandboxProvider: fakeSandbox.provider as never,
      now: () => new Date("2026-03-18T14:00:00.000Z")
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    const create = await app.inject({
      method: "POST",
      url: "/api/workspaces/ws_123/schedules",
      payload: buildSchedulePayload({
        outcomeMode: "continue_outcome",
        dispatchMode: "create_run"
      })
    });

    expect(create.statusCode).toBe(201);
    const schedule = ScheduleSchema.parse(create.json());

    await (services as unknown as {
      scheduleService: {
        processDueSchedules(reason: string): Promise<void>;
      };
    }).scheduleService.processDueSchedules("test");

    let outcomes = await services.repositories.outcomes.listByWorkspace("ws_123");
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        prompt: "Create the daily workspace briefing.",
        source: "schedule"
      })
    );

    const firstOutcomeId = outcomes[0]?.id;
    const firstRun = await services.repositories.runs.getLatestByOutcome(firstOutcomeId!);
    expect(firstRun).not.toBeNull();
    expect(await services.repositories.plans.getByOutcome(firstOutcomeId!)).not.toBeNull();

    await (services as unknown as {
      scheduleService: {
        processDueSchedules(reason: string): Promise<void>;
      };
    }).scheduleService.processDueSchedules("test");

    outcomes = await services.repositories.outcomes.listByWorkspace("ws_123");
    expect(outcomes).toHaveLength(1);

    const fires = await services.repositories.schedules.listFiresBySchedule(schedule.id);
    expect(fires).toHaveLength(1);
    expect(fires[0]).toEqual(
      expect.objectContaining({
        status: "triggered",
        outcomeId: firstOutcomeId
      })
    );

    const nextRun = await services.repositories.runs.getLatestByOutcome(firstOutcomeId!);
    expect(nextRun).not.toBeNull();
    expect(nextRun?.id).toBe(firstRun?.id);
  });

  it("streams schedule execution state over outcome SSE after a schedule continues that outcome", async () => {
    let currentNow = new Date("2026-03-18T14:00:00.000Z");
    const services = createInMemoryServiceContainer({
      now: () => currentNow
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    const create = await app.inject({
      method: "POST",
      url: "/api/workspaces/ws_123/schedules",
      payload: buildSchedulePayload({
        outcomeMode: "continue_outcome",
        dispatchMode: "outcome_only"
      })
    });

    expect(create.statusCode).toBe(201);
    const schedule = ScheduleSchema.parse(create.json());

    await (services as unknown as {
      scheduleService: {
        processDueSchedules(reason: string): Promise<void>;
      };
    }).scheduleService.processDueSchedules("test");

    const fires = await services.repositories.schedules.listFiresBySchedule(schedule.id);
    const outcomeId = fires[0]?.outcomeId;

    if (!outcomeId) {
      throw new Error("Expected the first schedule fire to create an outcome.");
    }

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected an address object from Fastify.");
    }

    const streamResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/outcomes/${outcomeId}/events`
    );
    const reader = streamResponse.body?.getReader();

    if (!reader) {
      throw new Error("Expected a response body for SSE route.");
    }

    await reader.read();

    await app.inject({
      method: "PATCH",
      url: `/api/schedules/${schedule.id}`,
      payload: {
        status: "active"
      }
    });

    currentNow = new Date("2026-03-18T14:01:00.000Z");
    await (services as unknown as {
      scheduleService: {
        processDueSchedules(reason: string): Promise<void>;
      };
    }).scheduleService.processDueSchedules("test");

    const eventChunk = await reader.read();
    const chunkText = new TextDecoder().decode(eventChunk.value);

    expect(chunkText).toContain("event: schedule.updated");
    expect(chunkText).toContain("event: schedule.fired");

    await reader.cancel();
  });

  it("preserves a concurrent pause or trigger edit while persisting fire completion metadata", async () => {
    let currentNow = new Date("2026-03-18T14:00:00.000Z");
    const services = createInMemoryServiceContainer({
      now: () => currentNow
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    const create = await app.inject({
      method: "POST",
      url: "/api/workspaces/ws_123/schedules",
      payload: buildSchedulePayload({
        dispatchMode: "outcome_only"
      })
    });

    expect(create.statusCode).toBe(201);
    const schedule = ScheduleSchema.parse(create.json());
    const originalRecordFire = services.repositories.schedules.recordFire.bind(
      services.repositories.schedules
    );
    let injected = false;

    services.repositories.schedules.recordFire = async (input) => {
      if (!injected) {
        injected = true;
        currentNow = new Date("2026-03-18T14:00:30.000Z");
        await (services as unknown as {
          scheduleService: {
            updateSchedule(
              id: string,
              input: {
                status?: "active" | "paused" | "disabled" | "error";
                trigger?: {
                  kind: "every";
                  everyMs: number;
                  anchorAt: string;
                  timezone: string;
                };
              }
            ): Promise<unknown>;
          };
        }).scheduleService.updateSchedule(schedule.id, {
          status: "paused",
          trigger: {
            kind: "every",
            everyMs: 300_000,
            anchorAt: "2026-03-18T14:00:00.000Z",
            timezone: "America/Chicago"
          }
        });
      }

      return originalRecordFire(input);
    };

    await (services as unknown as {
      scheduleService: {
        processDueSchedules(reason: string): Promise<void>;
      };
    }).scheduleService.processDueSchedules("test");

    const updated = await services.repositories.schedules.getById(schedule.id);

    expect(updated).toEqual(
      expect.objectContaining({
        id: schedule.id,
        status: "paused",
        trigger: {
          kind: "every",
          everyMs: 300_000,
          anchorAt: "2026-03-18T14:00:00.000Z",
          timezone: "America/Chicago"
        },
        nextFireAt: null,
        lastFiredAt: "2026-03-18T14:00:00.000Z"
      })
    );
  });
});
