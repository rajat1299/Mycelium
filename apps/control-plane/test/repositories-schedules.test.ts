import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

describe("in-memory schedule repositories", () => {
  it("stores schedules, updates next-fire metadata, and dedupes occurrence fires", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.schedules.create({
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

    const updated = await repositories.schedules.update({
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
        status: "paused",
        nextFireAt: "2026-03-19T14:00:00.000Z"
      })
    );

    const first = await repositories.schedules.recordFire({
      id: "schedule_fire_1",
      scheduleId: "schedule_1",
      occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z",
      scheduledFor: "2026-03-18T14:00:00.000Z",
      firedAt: "2026-03-18T14:00:02.000Z",
      status: "triggered",
      outcomeId: "outcome_123",
      runId: "run_123",
      errorMessage: null
    });
    const duplicate = await repositories.schedules.recordFire({
      id: "schedule_fire_2",
      scheduleId: "schedule_1",
      occurrenceKey: "schedule_1:2026-03-18T14:00:00.000Z",
      scheduledFor: "2026-03-18T14:00:00.000Z",
      firedAt: "2026-03-18T14:00:03.000Z",
      status: "triggered",
      outcomeId: "outcome_456",
      runId: "run_456",
      errorMessage: null
    });

    expect(duplicate).toEqual(first);
  });
});
