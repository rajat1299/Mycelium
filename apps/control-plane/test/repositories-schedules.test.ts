import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

function buildPlanInput(outcomeId: string) {
  return {
    id: `plan_${outcomeId}`,
    outcomeId,
    status: "draft" as const,
    createdAt: "2026-03-17T12:00:00.000Z",
    updatedAt: "2026-03-17T12:00:00.000Z",
    nodes: [
      {
        id: `${outcomeId}:analyze-outcome`,
        kind: "root" as const,
        title: "Analyze outcome",
        capability: "reasoning" as const
      }
    ],
    edges: []
  };
}

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
      outcomeId: null,
      runId: null,
      errorMessage: null
    });
    const duplicate = await repositories.schedules.recordFire({
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
  });

  it("rejects schedule fires that point at outcomes or runs outside the schedule workspace", async () => {
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

    await repositories.outcomes.create({
      id: "outcome_default",
      workspaceId: "ws_default",
      userId: "user_123",
      prompt: "Create the workspace brief.",
      source: "schedule"
    });
    await repositories.outcomes.create({
      id: "outcome_other",
      workspaceId: "ws_other",
      userId: "user_456",
      prompt: "Create another workspace brief.",
      source: "schedule"
    });
    await repositories.plans.create(buildPlanInput("outcome_other"));
    await repositories.runs.createFromPlan({
      id: "run_other",
      outcomeId: "outcome_other",
      planId: "plan_outcome_other",
      createdAt: "2026-03-17T12:05:00.000Z",
      updatedAt: "2026-03-17T12:05:00.000Z"
    });

    await expect(
      repositories.schedules.recordFire({
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
      repositories.schedules.recordFire({
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
});
