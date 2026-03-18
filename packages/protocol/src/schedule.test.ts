import { describe, expect, it } from "vitest";
import {
  EventTypeSchema,
  OutcomeSchema,
  OutcomeStreamEventSchema,
  ScheduleFireSummarySchema,
  ScheduleSchema,
  ScheduleTriggerSchema
} from "./index";

describe("schedule protocol contracts", () => {
  it("accepts durable schedules with trigger metadata and validation diagnostics", () => {
    const trigger = ScheduleTriggerSchema.parse({
      kind: "cron",
      expression: "0 9 * * 1-5",
      timezone: "America/Chicago"
    });

    const schedule = ScheduleSchema.parse({
      id: "schedule_1",
      workspaceId: "ws_default",
      title: "Morning workspace brief",
      prompt: "Create the daily workspace briefing.",
      status: "active",
      trigger,
      outcomeMode: "create_outcome",
      dispatchMode: "create_run",
      nextFireAt: "2026-03-18T14:00:00.000Z",
      lastFiredAt: null,
      validationDiagnostics: [],
      createdAt: "2026-03-17T12:00:00.000Z",
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    expect(schedule.trigger.kind).toBe("cron");
    expect(schedule.nextFireAt).toBe("2026-03-18T14:00:00.000Z");
  });

  it("accepts schedule fire summaries and schedule SSE events", () => {
    const fire = ScheduleFireSummarySchema.parse({
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

    expect(EventTypeSchema.parse("schedule.updated")).toBe("schedule.updated");
    expect(EventTypeSchema.parse("schedule.fired")).toBe("schedule.fired");

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "schedule.updated",
        data: {
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
        }
      })
    ).toEqual(expect.objectContaining({ type: "schedule.updated" }));

    expect(
      OutcomeStreamEventSchema.parse({
        outcomeId: "outcome_123",
        type: "schedule.fired",
        data: fire
      })
    ).toEqual(expect.objectContaining({ type: "schedule.fired" }));
  });

  it("allows scheduled outcomes as a first-class ingress source", () => {
    const outcome = OutcomeSchema.parse({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "scheduler",
      prompt: "Create the daily workspace briefing.",
      source: "schedule",
      status: "scheduled",
      createdAt: "2026-03-17T12:00:00.000Z",
      updatedAt: "2026-03-17T12:00:00.000Z"
    });

    expect(outcome.source).toBe("schedule");
  });
});
