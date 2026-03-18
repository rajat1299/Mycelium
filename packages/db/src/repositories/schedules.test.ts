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

  it("rejects schedule fires that point at outcomes or runs outside the schedule workspace", async () => {
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

    state.outcomes.push({
      id: "outcome_default",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Create the workspace brief.",
      source: "schedule",
      status: "queued",
      createdAt: new Date("2026-03-17T12:00:00.000Z"),
      updatedAt: new Date("2026-03-17T12:00:00.000Z")
    });
    state.outcomes.push({
      id: "outcome_other",
      workspaceId: "ws_other",
      userId: "user_456",
      prompt: "Create a different workspace brief.",
      source: "schedule",
      status: "queued",
      createdAt: new Date("2026-03-17T12:01:00.000Z"),
      updatedAt: new Date("2026-03-17T12:01:00.000Z")
    });
    state.outcomeRuns.push({
      id: "run_other",
      outcomeId: "outcome_other",
      planId: "plan_outcome_other",
      status: "queued",
      latestCheckpointId: null,
      resumable: false,
      createdAt: new Date("2026-03-17T12:02:00.000Z"),
      updatedAt: new Date("2026-03-17T12:02:00.000Z")
    });

    await expect(
      repository.recordFire({
        id: "schedule_fire_cross_workspace",
        scheduleId: "schedule_1",
        occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z:cross-workspace",
        scheduledFor: "2026-03-18T14:00:00.000Z",
        firedAt: "2026-03-18T14:00:02.000Z",
        status: "triggered",
        outcomeId: "outcome_other",
        runId: null,
        errorMessage: null
      })
    ).rejects.toThrow("Outcome outcome_other belongs to ws_other, not ws_default.");

    await expect(
      repository.recordFire({
        id: "schedule_fire_run_mismatch",
        scheduleId: "schedule_1",
        occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z:run-mismatch",
        scheduledFor: "2026-03-18T14:00:00.000Z",
        firedAt: "2026-03-18T14:00:03.000Z",
        status: "triggered",
        outcomeId: "outcome_default",
        runId: "run_other",
        errorMessage: null
      })
    ).rejects.toThrow(
      "Run run_other belongs to outcome outcome_other, not outcome_default."
    );
  });

  it("supports compare-and-set schedule updates by updatedAt", async () => {
    const { db } = createRepositoryTestDatabase();
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

    const updated = await repository.update({
      id: created.id,
      status: "paused",
      expectedUpdatedAt: "2026-03-17T12:00:00.000Z",
      updatedAt: "2026-03-17T12:05:00.000Z"
    });

    expect(updated).toEqual(
      expect.objectContaining({
        id: created.id,
        status: "paused",
        updatedAt: "2026-03-17T12:05:00.000Z"
      })
    );

    await expect(
      repository.update({
        id: created.id,
        status: "active",
        expectedUpdatedAt: "2026-03-17T12:00:00.000Z",
        updatedAt: "2026-03-17T12:06:00.000Z"
      })
    ).resolves.toBeNull();
  });
});
