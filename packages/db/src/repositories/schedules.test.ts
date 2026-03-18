import { describe, expect, it } from "vitest";
import { ScheduleRepository } from "./schedules";
import { createRepositoryTestDatabase } from "./test-database";

describe("ScheduleRepository", () => {
  it("creates, updates, disables, and lists durable schedules with next-fire bookkeeping", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new ScheduleRepository(db as never);

    const created = await repository.create({
      id: "schedule_1",
      workspaceId: "ws_default",
      title: "Morning workspace brief",
      prompt: "Create the daily workspace briefing.",
      status: "active",
      trigger: {
        kind: "cron",
        expression: "0 9 * * 1-5",
        timezone: "America/Chicago"
      },
      outcomeMode: "create_outcome",
      dispatchMode: "create_run",
      nextFireAt: "2026-03-18T14:00:00.000Z",
      lastFiredAt: null,
      validationDiagnostics: [],
      createdAt: "2026-03-17T12:00:00.000Z",
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: "schedule_1",
        workspaceId: "ws_default",
        status: "active",
        nextFireAt: "2026-03-18T14:00:00.000Z"
      })
    );

    const updated = await repository.update({
      id: "schedule_1",
      status: "paused",
      nextFireAt: "2026-03-19T14:00:00.000Z",
      validationDiagnostics: [
        {
          code: "timezone_warning",
          message: "Timezone will change with DST.",
          severity: "warning",
          field: "trigger.timezone"
        }
      ],
      updatedAt: "2026-03-17T12:05:00.000Z"
    });

    expect(updated).toEqual(
      expect.objectContaining({
        id: "schedule_1",
        status: "paused",
        nextFireAt: "2026-03-19T14:00:00.000Z",
        validationDiagnostics: [
          expect.objectContaining({
            code: "timezone_warning"
          })
        ]
      })
    );

    expect(state.schedules).toEqual([
      expect.objectContaining({
        id: "schedule_1",
        status: "paused"
      })
    ]);

    await expect(repository.listByWorkspace("ws_default")).resolves.toEqual([
      expect.objectContaining({
        id: "schedule_1",
        status: "paused"
      })
    ]);
  });

  it("dedupes schedule fires per occurrence key and keeps the first durable winner", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new ScheduleRepository(db as never);

    await repository.create({
      id: "schedule_1",
      workspaceId: "ws_default",
      title: "Morning workspace brief",
      prompt: "Create the daily workspace briefing.",
      status: "active",
      trigger: {
        kind: "cron",
        expression: "0 9 * * 1-5",
        timezone: "America/Chicago"
      },
      outcomeMode: "create_outcome",
      dispatchMode: "create_run",
      nextFireAt: "2026-03-18T14:00:00.000Z",
      lastFiredAt: null,
      validationDiagnostics: [],
      createdAt: "2026-03-17T12:00:00.000Z",
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    const first = await repository.recordFire({
      id: "schedule_fire_1",
      scheduleId: "schedule_1",
      occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z",
      scheduledFor: "2026-03-18T14:00:00.000Z",
      firedAt: "2026-03-18T14:00:02.000Z",
      status: "triggered",
      outcomeId: null,
      runId: null,
      errorMessage: null
    });

    const duplicate = await repository.recordFire({
      id: "schedule_fire_2",
      scheduleId: "schedule_1",
      occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z",
      scheduledFor: "2026-03-18T14:00:00.000Z",
      firedAt: "2026-03-18T14:00:03.000Z",
      status: "triggered",
      outcomeId: null,
      runId: null,
      errorMessage: null
    });

    expect(duplicate).toEqual(first);
    expect(state.scheduleFires).toHaveLength(1);
    expect(state.scheduleFires[0]).toEqual(
      expect.objectContaining({
        id: "schedule_fire_1",
        occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z"
      })
    );

    await expect(repository.listFiresBySchedule("schedule_1")).resolves.toEqual([
      expect.objectContaining({
        id: "schedule_fire_1",
        runId: null
      })
    ]);
  });
});
